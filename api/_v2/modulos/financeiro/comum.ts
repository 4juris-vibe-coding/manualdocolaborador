/* ============================================================
   API v2 · Gestão de prestadores PJ · peças comuns
   Escopo de acesso, leitura de linhas, notificações por capacidade,
   documentos com arquivo e os ESPELHOS legados (app_contratos e
   app_documentos), que mantêm as telas antigas coerentes.
   ============================================================ */
import { Buffer } from 'node:buffer'
import { auditar, invalido, naoEncontrado, notificar, pessoas, proibido, tem, type Executor, type NovaNotificacao, type Usuario } from '../../nucleo.js'
import { guardarArquivo, validarUpload, type TipoArquivo } from '../../arquivos.js'
import { capacidadesDe, type Capacidade, type FuncaoAdicional } from '../../../../src/domain/permissions.js'
import { CATEGORIAS_DOCUMENTO, centavos, type CategoriaDocumento } from '../../../../src/domain/v2/financeiro.js'
import type { Papel } from '../../../../src/lib/types.js'

export type Linha = Record<string, any>
export const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
export const uuid = (v: unknown, campo = 'id'): string => { if (typeof v !== 'string' || !UUID.test(v)) throw invalido(`${campo} inválido.`, { [campo]: 'Inválido' }); return v }
export const uuidOuNulo = (v: unknown, campo: string) => (v === undefined || v === null || v === '' ? null : uuid(v, campo))
export const idTexto = (v: unknown, campo = 'id'): string => { if (typeof v !== 'string' || !/^[\w.:-]{1,80}$/.test(v)) throw invalido(`${campo} inválido.`, { [campo]: 'Inválido' }); return v }
export const hoje = (agora: Date) => agora.toISOString().slice(0, 10)
export const num = (v: unknown) => (v === null || v === undefined ? null : Number(v))
export const dstr = (v: unknown) => (v instanceof Date ? v.toISOString().slice(0, 10) : v ? String(v).slice(0, 10) : null)

/** Valor monetário vindo do corpo: número ≥ 0 (ou > 0), até 2 casas. Devolve em reais. */
export function dinheiro(v: unknown, campo: string, { positivo = true, max = 100_000_000 } = {}): number {
  const n = typeof v === 'string' ? Number(v.replace(',', '.')) : Number(v)
  if (v === undefined || v === null || v === '' || !Number.isFinite(n)) throw invalido(`Informe ${campo}.`, { [campo]: 'Valor inválido' })
  if (positivo ? n <= 0 : n < 0) throw invalido(`${campo} deve ser ${positivo ? 'maior que zero' : 'zero ou mais'}.`, { [campo]: 'Valor inválido' })
  if (n > max) throw invalido(`${campo} acima do limite.`, { [campo]: 'Valor muito alto' })
  if (Math.abs(n * 100 - Math.round(n * 100)) > 1e-6) throw invalido(`${campo}: use no máximo 2 casas decimais.`, { [campo]: 'Máx. 2 casas decimais' })
  return centavos(n) / 100
}

/* ---------- configuração ---------- */
export interface ConfigFin {
  exigirSegregacao: boolean; diasAlertaContrato: number; diasAlertaPagamento: number; diasAlertaDocumento: number; diasAlertaAprovacao: number
  diaLimiteEnvioNf: number; prazoPagamentoPadraoDias: number; atualizadoEm: string | null; atualizadoPor: string | null
}
export async function lerConfig(ex: Executor): Promise<ConfigFin> {
  const r = (await ex.query('select * from fin_config where id')).rows[0] ?? {}
  return {
    exigirSegregacao: r.exigir_segregacao ?? true, diasAlertaContrato: r.dias_alerta_contrato ?? 45, diasAlertaPagamento: r.dias_alerta_pagamento ?? 3,
    diasAlertaDocumento: r.dias_alerta_documento ?? 30, diasAlertaAprovacao: r.dias_alerta_aprovacao ?? 3, diaLimiteEnvioNf: r.dia_limite_envio_nf ?? 22,
    prazoPagamentoPadraoDias: r.prazo_pagamento_padrao_dias ?? 10, atualizadoEm: r.atualizado_em ?? null, atualizadoPor: r.atualizado_por ?? null,
  }
}

/* ---------- escopo ---------- */
/** Fornecedores que a pessoa representa (é o "prestador" no portal). */
export async function meusFornecedores(ex: Executor, u: Usuario): Promise<string[]> {
  return (await ex.query('select id from fin_fornecedores where representante_id = $1', [u.colaboradorId])).rows.map((r) => r.id)
}

/**
 * Contratos visíveis: o financeiro vê todos; os demais veem os que prestam (prestador ou representante do fornecedor),
 * os que gerem (gestor do contrato) e os da área que lideram. `a` = alias de fin_contratos; `p` = próximo $n livre.
 */
export function escopoContrato(u: Usuario, a = 'k', p = 1): { sql: string; params: unknown[] } {
  if (tem(u, 'fin:ver')) return { sql: 'true', params: [] }
  return {
    sql: `(${a}.prestador_id = $${p} or ${a}.gestor_id = $${p} or ${a}.setor_id = any($${p + 1}::text[])
      or ${a}.fornecedor_id in (select id from fin_fornecedores where representante_id = $${p}))`,
    params: [u.colaboradorId, u.setoresLiderados],
  }
}

/** A pessoa presta este contrato (é prestador ou representa o fornecedor)? */
export async function ehPrestador(ex: Executor, u: Usuario, k: Linha): Promise<boolean> {
  if (k.prestador_id === u.colaboradorId) return true
  return (await meusFornecedores(ex, u)).includes(k.fornecedor_id)
}
/** Pode dar o aceite do serviço: gestor do contrato, liderança da área do contrato ou quem tem fin:aprovar. */
export const podeAceitar = (u: Usuario, k: Linha) => tem(u, 'fin:aprovar') || k.gestor_id === u.colaboradorId || (!!k.setor_id && u.setoresLiderados.includes(k.setor_id))

export async function contratoOu404(ex: Executor, id: string, travar = false): Promise<Linha> {
  const r = await ex.query(`select * from fin_contratos where id = $1 ${travar ? 'for update' : ''}`, [id])
  if (!r.rows[0]) throw naoEncontrado('Contrato não encontrado.')
  return r.rows[0]
}
export async function exigirAcessoContrato(ex: Executor, u: Usuario, k: Linha): Promise<{ prestador: boolean; gestor: boolean }> {
  const prestador = await ehPrestador(ex, u, k)
  const gestor = podeAceitar(u, k)
  if (!tem(u, 'fin:ver') && !prestador && !gestor) throw naoEncontrado('Contrato não encontrado.')
  return { prestador, gestor }
}

/* ---------- pessoas ---------- */
export async function mapaPessoas(ex: Executor): Promise<Map<string, Linha>> {
  return new Map((await pessoas(ex)).map((p) => [p.id, p as unknown as Linha]))
}
export const nomeDe = (m: Map<string, Linha>, id: unknown) => (typeof id === 'string' ? (m.get(id)?.nome as string | undefined) ?? null : null)

/** Ids de quem tem a capacidade (papel + funções adicionais), com cadastro ativo. */
export async function idsComCapacidade(ex: Executor, cap: Capacidade): Promise<string[]> {
  const funcoes = new Map<string, FuncaoAdicional[]>()
  for (const r of (await ex.query('select colaborador_id, funcao from acl_funcoes')).rows) funcoes.set(r.colaborador_id, [...(funcoes.get(r.colaborador_id) ?? []), r.funcao])
  return (await pessoas(ex)).filter((p) => p.status !== 'encerrado' && capacidadesDe(p.papel as Papel, funcoes.get(p.id) ?? []).has(cap)).map((p) => p.id)
}
export async function notificarCap(ex: Executor, cap: Capacidade, n: Omit<NovaNotificacao, 'destinatarioId'>, exceto: (string | null | undefined)[] = []) {
  for (const id of await idsComCapacidade(ex, cap)) if (!exceto.includes(id)) await notificar(ex, { ...n, destinatarioId: id })
}

/* ---------- documentos ---------- */
const TIPOS_DOC: TipoArquivo[] = ['pdf', 'png', 'jpg']
export interface NovoDocumento {
  categoria: CategoriaDocumento; titulo: string; pessoaId?: string | null; fornecedorId?: string | null; contratoId?: string | null
  emitidoEm?: string | null; validade?: string | null; substituiId?: string | null; status?: 'pendente' | 'valido'; confidencial?: boolean
}
/** Valida o arquivo (PDF/PNG/JPG, até 3 MB, tipo pelo conteúdo) e grava documento + arquivo. Devolve o id do documento. */
export async function registrarDocumento(ex: Executor, u: Usuario, d: NovoDocumento, arquivo: unknown, campo = 'arquivo'): Promise<string> {
  if (!CATEGORIAS_DOCUMENTO.includes(d.categoria)) throw invalido('Categoria inválida.', { categoria: 'Inválida' })
  if (d.validade && d.emitidoEm && d.validade < d.emitidoEm) throw invalido('A validade não pode ser anterior à emissão.', { validade: 'Anterior à emissão' })
  const up = validarUpload(arquivo, TIPOS_DOC, campo)
  const arq = await guardarArquivo(ex, up, 'documento', null, u.colaboradorId)
  const r = await ex.query(
    `insert into doc_documentos (categoria, titulo, pessoa_id, fornecedor_id, contrato_id, emitido_em, validade, status, substitui_id, arquivo_id, tamanho, confidencial, enviado_por, conferido_por, conferido_em)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15) returning id`,
    [d.categoria, d.titulo, d.pessoaId ?? null, d.fornecedorId ?? null, d.contratoId ?? null, d.emitidoEm ?? null, d.validade ?? null, d.status ?? 'pendente',
      d.substituiId ?? null, arq, up.dados.length, d.confidencial ?? true, u.colaboradorId,
      d.status === 'valido' ? u.colaboradorId : null, d.status === 'valido' ? new Date() : null])
  const id = r.rows[0].id as string
  await ex.query("update arq_arquivos set dono_id = $2 where id = $1", [arq, id])
  if (d.substituiId) await ex.query("update doc_documentos set status = 'substituido' where id = $1", [d.substituiId])
  await auditar(ex, u.colaboradorId, 'documento', id, 'enviado', { categoria: d.categoria, contratoId: d.contratoId ?? null, fornecedorId: d.fornecedorId ?? null, substitui: d.substituiId ?? null })
  await espelharDocumento(ex, id)
  if (d.substituiId) await espelharDocumento(ex, d.substituiId)
  return id
}

/** Titular do documento para fins de acesso: a pessoa, o representante do fornecedor ou o prestador do contrato. */
export async function titularDoc(ex: Executor, d: Linha): Promise<string | null> {
  if (d.pessoa_id) return d.pessoa_id
  if (d.fornecedor_id) { const f = (await ex.query('select representante_id from fin_fornecedores where id = $1', [d.fornecedor_id])).rows[0]; if (f?.representante_id) return f.representante_id }
  if (d.contrato_id) { const k = (await ex.query('select prestador_id, fornecedor_id from fin_contratos where id = $1', [d.contrato_id])).rows[0]; if (k?.prestador_id) return k.prestador_id }
  return null
}

/** Quem vê o documento: financeiro/RH de documentos, o titular, e o gestor do contrato (só documentos do contrato, não pessoais). */
export async function podeVerDocumento(ex: Executor, u: Usuario, d: Linha): Promise<boolean> {
  if (tem(u, 'fin:ver') || tem(u, 'documentos:gerenciar')) return true
  if ((await titularDoc(ex, d)) === u.colaboradorId) return true
  if (d.fornecedor_id && (await meusFornecedores(ex, u)).includes(d.fornecedor_id)) return true
  if (d.contrato_id && ['contrato', 'aditivo', 'nota_fiscal', 'aprovacao', 'encerramento'].includes(d.categoria)) {
    const k = (await ex.query('select gestor_id, setor_id from fin_contratos where id = $1', [d.contrato_id])).rows[0]
    if (k && podeAceitar(u, k)) return true
  }
  return false
}

const TIPO_LEGADO: Record<string, string> = {
  contrato: 'Contrato', aditivo: 'Aditivo', cadastral: 'Documento pessoal', certidao: 'Certidão', fiscal: 'Comprovante', encerramento: 'Outro', outro: 'Outro',
}
const tamanhoTexto = (b: number | null) => (!b ? '—' : b >= 1024 * 1024 ? `${(b / 1024 / 1024).toFixed(1)} MB` : `${Math.max(1, Math.round(b / 1024))} KB`)

/** Upsert/remoção do registro espelho numa coleção legada (mesmo id). */
async function espelhar(ex: Executor, colecao: 'contratos' | 'documentos', id: string, dados: Linha | null) {
  const t = `app_${colecao}`
  if (!dados) { await ex.query(`delete from ${t} where id = $1`, [id]); return }
  const r = await ex.query(`update ${t} set dados = $2::jsonb, atualizado_em = now() where id = $1`, [id, JSON.stringify(dados)])
  if (!r.rowCount) await ex.query(`insert into ${t} (ord, id, dados) values ((select coalesce(max(ord), -1) + 1 from ${t}), $1, $2::jsonb)`, [id, JSON.stringify(dados)])
}

/** Documentos pessoais/contratuais (não notas nem comprovantes) válidos ou pendentes aparecem nas telas antigas. */
export async function espelharDocumento(ex: Executor, id: string) {
  const d = (await ex.query(`select *, emitido_em::text as emitido, validade::text as val, criado_em::date::text as criado from doc_documentos where id = $1`, [id])).rows[0]
  if (!d || d.legado || !TIPO_LEGADO[d.categoria] || !['pendente', 'valido'].includes(d.status)) return espelhar(ex, 'documentos', id, null)
  const titular = await titularDoc(ex, d)
  if (!titular) return espelhar(ex, 'documentos', id, null)
  return espelhar(ex, 'documentos', id, {
    id, colaboradorId: titular, nome: d.titulo, tipo: TIPO_LEGADO[d.categoria], data: d.emitido ?? d.criado, ...(d.val ? { validade: d.val } : {}),
    tamanho: tamanhoTexto(d.tamanho), confidencial: d.confidencial, enviadoPorId: d.enviado_por ?? undefined,
  })
}

/** Contrato no formato antigo (telas de perfil, indicadores e notas legadas leem dele). */
export async function espelharContrato(ex: Executor, id: string) {
  const k = (await ex.query(`select *, inicio::text as ini, fim::text as fi, atualizado_em::date::text as atu from fin_contratos where id = $1`, [id])).rows[0]
  if (!k) return espelhar(ex, 'contratos', id, null)
  const pessoa = k.prestador_id ?? (await ex.query('select representante_id from fin_fornecedores where id = $1', [k.fornecedor_id])).rows[0]?.representante_id
  if (!pessoa) return espelhar(ex, 'contratos', id, null)
  return espelhar(ex, 'contratos', id, {
    id, colaboradorId: pessoa, numero: k.numero, objeto: k.objeto, modalidade: k.modelo_remuneracao === 'mensal_fixo' ? 'mensal' : 'por-projeto',
    valorMensal: Number(k.valor), inicio: k.ini, ...(k.fi ? { fim: k.fi } : {}), renovacaoAutomatica: k.renovacao === 'automatica',
    status: k.status === 'encerrado' ? 'encerrado' : k.status === 'rascunho' ? 'rascunho' : 'vigente', ...(k.observacoes ? { observacoes: k.observacoes } : {}), atualizadoEm: k.atu,
  })
}

export function exigirNaoProprio(u: Usuario, ...donos: (string | null | undefined)[]) {
  if (donos.includes(u.colaboradorId)) throw proibido('Você não pode decidir sobre um registro em seu próprio nome.')
}

/** CSV (;) com BOM. Texto que começa com = + - @ ganha apóstrofo (evita virar fórmula ao abrir na planilha). */
export const csv = (linhas: unknown[][]) => Buffer.from('﻿' + linhas.map((l) => l.map((v) => {
  let s = v === null || v === undefined ? '' : String(v)
  if (typeof v === 'string' && /^[=+\-@\t\r]/.test(s) && !/^-?\d+([.,]\d+)?$/.test(s)) s = `'${s}`
  return /[";\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}).join(';')).join('\r\n'), 'utf8')
