/* ============================================================
   API v2 · arquivos privados (currículos, anexos de vaga)
   Armazenados no banco (bytea), nunca em URL pública. Todo download
   passa por uma rota autenticada do módulo dono do arquivo.
   Limite: 3 MB (o corpo de uma função na Vercel é de 4,5 MB e o
   upload viaja em base64).
   ============================================================ */
import { Buffer } from 'node:buffer'
import { invalido, sha256, type Executor, type Res } from './nucleo.js'

export const LIMITE_BYTES = 3 * 1024 * 1024

export type TipoArquivo = 'pdf' | 'docx' | 'doc' | 'odt' | 'png' | 'jpg'
const MIME: Record<TipoArquivo, string> = {
  pdf: 'application/pdf',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  doc: 'application/msword',
  odt: 'application/vnd.oasis.opendocument.text',
  png: 'image/png',
  jpg: 'image/jpeg',
}

/** Detecta o tipo pelos primeiros bytes (a extensão informada pelo usuário não é confiável). */
export function detectarTipo(b: Buffer, nome: string): TipoArquivo | null {
  if (b.length < 8) return null
  if (b.subarray(0, 5).toString('latin1') === '%PDF-') return 'pdf'
  if (b[0] === 0x89 && b.subarray(1, 4).toString('latin1') === 'PNG') return 'png'
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'jpg'
  if (b[0] === 0xd0 && b[1] === 0xcf && b[2] === 0x11 && b[3] === 0xe0) return /\.doc$/i.test(nome) ? 'doc' : null
  if (b[0] === 0x50 && b[1] === 0x4b && (b[2] === 0x03 || b[2] === 0x05)) {
    // zip: só aceitamos DOCX/ODT (pela extensão + conteúdo característico)
    const amostra = b.subarray(0, Math.min(b.length, 4096)).toString('latin1')
    if (/\.docx$/i.test(nome) && amostra.includes('[Content_Types].xml')) return 'docx'
    if (/\.odt$/i.test(nome) && amostra.includes('mimetype')) return 'odt'
  }
  return null
}

export const nomeSeguro = (n: string) =>
  n.normalize('NFKD').replace(/[^\w.\- ]+/g, '').replace(/\s+/g, ' ').trim().slice(0, 120) || 'arquivo'

export interface UploadValidado { nome: string; tipo: TipoArquivo; mime: string; dados: Buffer }

/** `arquivo` = { nome, base64 } vindo do JSON. `permitidos` restringe os tipos aceitos. */
export function validarUpload(arquivo: unknown, permitidos: TipoArquivo[], campo = 'arquivo'): UploadValidado {
  const a = arquivo as { nome?: unknown; base64?: unknown } | null
  if (!a || typeof a.nome !== 'string' || typeof a.base64 !== 'string' || !a.base64) throw invalido('Arquivo inválido.', { [campo]: 'Envie um arquivo' })
  // Estimativa antes de decodificar, para não alocar memória à toa.
  if (a.base64.length > Math.ceil((LIMITE_BYTES * 4) / 3) + 8) throw invalido('Arquivo maior que 3 MB.', { [campo]: 'Máximo de 3 MB' })
  const dados = Buffer.from(a.base64, 'base64')
  if (!dados.length) throw invalido('Arquivo vazio.', { [campo]: 'Arquivo vazio' })
  if (dados.length > LIMITE_BYTES) throw invalido('Arquivo maior que 3 MB.', { [campo]: 'Máximo de 3 MB' })
  const tipo = detectarTipo(dados, a.nome)
  if (!tipo || !permitidos.includes(tipo)) {
    const lista = permitidos.map((t) => t.toUpperCase()).join(', ')
    throw invalido(`Formato não aceito. Envie ${lista}.`, { [campo]: `Formatos aceitos: ${lista}` })
  }
  return { nome: nomeSeguro(a.nome), tipo, mime: MIME[tipo], dados }
}

export async function guardarArquivo(ex: Executor, u: UploadValidado, donoTipo: string, donoId: string | null, criadoPor: string | null): Promise<string> {
  const r = await ex.query(
    'insert into arq_arquivos (nome, mime, tamanho, sha256, conteudo, dono_tipo, dono_id, criado_por) values ($1,$2,$3,$4,$5,$6,$7,$8) returning id',
    [u.nome, u.mime, u.dados.length, sha256(u.dados), u.dados, donoTipo, donoId, criadoPor])
  return r.rows[0].id
}

/** Monta a resposta de download. A autorização é feita ANTES pelo módulo dono. */
export async function baixarArquivo(ex: Executor, id: string): Promise<Res | null> {
  if (!/^[0-9a-f-]{36}$/i.test(id)) return null
  const r = await ex.query('select nome, mime, conteudo from arq_arquivos where id = $1', [id])
  const a = r.rows[0]
  if (!a) return null
  return { status: 200, binario: { mime: a.mime, nome: a.nome, dados: Buffer.from(a.conteudo as Uint8Array) } }
}
