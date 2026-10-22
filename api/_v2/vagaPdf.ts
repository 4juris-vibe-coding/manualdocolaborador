/* ============================================================
   API v2 · Leitura de vaga em PDF
   Extrai o texto do PDF (unpdf, sem serviço externo) e separa os campos
   pelo modelo de vaga da 4JURIS (src/domain/v2/vagaImportada.ts).
   ============================================================ */
import { extractText, getDocumentProxy } from 'unpdf'
import { invalido } from './nucleo.js'
import { extrairVagaDoTexto, type VagaImportada } from '../../src/domain/v2/vagaImportada.js'

/** Lê o PDF e devolve os campos da vaga. Erros viram mensagens para a pessoa. */
export async function lerVagaDoPdf(pdf: Buffer): Promise<VagaImportada> {
  let texto: string
  try {
    const doc = await getDocumentProxy(new Uint8Array(pdf))
    texto = (await extractText(doc, { mergePages: true })).text
  } catch {
    throw invalido('Não foi possível ler este PDF. Confira se o arquivo abre normalmente e tente de novo.')
  }
  if (!texto.trim()) throw invalido('Este PDF não tem texto selecionável (parece digitalizado). Preencha a vaga manualmente.')
  const v = extrairVagaDoTexto(texto)
  if (!v.titulo && !v.textoPublico && !v.responsabilidades && !v.requisitos.length) throw invalido('Não encontramos dados de vaga neste PDF.')
  return v
}
