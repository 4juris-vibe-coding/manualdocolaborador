/* ============================================================
   API v2 · Leitura da descrição de cargo em PDF
   Extrai o texto do PDF (unpdf, sem serviço externo) e separa os campos
   da ficha oficial (src/domain/v2/cargoImportado.ts).
   ============================================================ */
import { invalido } from './nucleo.js'
import { textoDoPdf } from './vagaPdf.js'
import { extrairFichaDoTexto, temConteudoDeCargo, type FichaImportada } from '../../src/domain/v2/cargoImportado.js'

/** Lê o PDF e devolve os campos da ficha. Erros viram mensagens para a pessoa. */
export async function lerFichaDoPdf(pdf: Buffer): Promise<FichaImportada> {
  const texto = await textoDoPdf(pdf, 'Preencha a ficha manualmente.')
  const f = extrairFichaDoTexto(texto)
  if (!temConteudoDeCargo(f)) throw invalido('Não encontramos dados de cargo neste PDF. Confira se ele tem seções como Descrição, Objetivo, Responsabilidades ou Requisitos.')
  return f
}
