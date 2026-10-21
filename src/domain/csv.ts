/* Exportação e leitura de CSV (sem dependências). Separador ';' para abrir
   corretamente no Excel em pt-BR; BOM UTF-8 para acentuação. */

export interface ColunaCSV<T> { titulo: string; valor: (r: T) => string | number | undefined | null }

function escapar(v: unknown): string {
  const s = v == null ? '' : String(v)
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}

export function gerarCSV<T>(linhas: T[], colunas: ColunaCSV<T>[], meta?: string[]): string {
  const cab = colunas.map((c) => escapar(c.titulo)).join(';')
  const corpo = linhas.map((r) => colunas.map((c) => escapar(c.valor(r))).join(';'))
  const pre = (meta ?? []).map((m) => escapar(`# ${m}`))
  return '﻿' + [...pre, cab, ...corpo].join('\r\n')
}

export function baixarArquivo(conteudo: string, nome: string, tipo = 'text/csv;charset=utf-8') {
  const blob = new Blob([conteudo], { type: tipo })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = nome
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

/** Parser CSV simples com suporte a aspas. Detecta ';' ou ','. */
export function lerCSV(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) >= (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const ch = t[i]
    if (aspas) {
      if (ch === '"' && t[i + 1] === '"') { campo += '"'; i++ }
      else if (ch === '"') aspas = false
      else campo += ch
    } else if (ch === '"') aspas = true
    else if (ch === sep) { linha.push(campo); campo = '' }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
      linha = []
    } else campo += ch
  }
  linha.push(campo)
  if (linha.some((c) => c.trim() !== '')) linhas.push(linha)
  return linhas.filter((l) => !l[0]?.startsWith('#'))
}
