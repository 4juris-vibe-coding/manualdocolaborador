/* Gera um PDF de verdade (Helvetica, WinAnsi) com uma linha de texto por item — para testar a extração sem arquivos binários no repositório. */
export function pdfComTexto(linhas: string[]): Buffer {
  // WinAnsi: os caracteres fora do latin1 que aparecem em vagas (marcadores e travessões).
  const WIN: Record<string, string> = { '•': '\x95', '–': '\x96', '—': '\x97' }
  const esc = (s: string) => s.replace(/[\\()]/g, (c) => '\\' + c).replace(/[•–—]/g, (c) => WIN[c])
  const POR_PAGINA = 45
  const paginas: string[][] = []
  for (let i = 0; i < linhas.length; i += POR_PAGINA) paginas.push(linhas.slice(i, i + POR_PAGINA))
  if (!paginas.length) paginas.push([])

  // objetos: 1 catálogo, 2 páginas, 3 fonte, depois (página, conteúdo) para cada página
  const objs: string[] = []
  const idPagina = (i: number) => 4 + i * 2
  objs[1] = '<< /Type /Catalog /Pages 2 0 R >>'
  objs[2] = `<< /Type /Pages /Kids [${paginas.map((_, i) => `${idPagina(i)} 0 R`).join(' ')}] /Count ${paginas.length} >>`
  objs[3] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>'
  paginas.forEach((ls, i) => {
    const fluxo = ['BT', '/F1 11 Tf', '14 TL', '50 800 Td', ...ls.map((l) => `(${esc(l)}) Tj T*`), 'ET'].join('\n')
    objs[idPagina(i)] = `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 3 0 R >> >> /Contents ${idPagina(i) + 1} 0 R >>`
    objs[idPagina(i) + 1] = `<< /Length ${Buffer.byteLength(fluxo, 'latin1')} >>\nstream\n${fluxo}\nendstream`
  })

  let saida = '%PDF-1.4\n'
  const offsets: number[] = []
  for (let n = 1; n < objs.length; n++) {
    offsets[n] = Buffer.byteLength(saida, 'latin1')
    saida += `${n} 0 obj\n${objs[n]}\nendobj\n`
  }
  const xref = Buffer.byteLength(saida, 'latin1')
  saida += `xref\n0 ${objs.length}\n0000000000 65535 f \n`
  for (let n = 1; n < objs.length; n++) saida += `${String(offsets[n]).padStart(10, '0')} 00000 n \n`
  saida += `trailer\n<< /Size ${objs.length} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`
  return Buffer.from(saida, 'latin1')
}
