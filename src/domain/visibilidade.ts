/* ============================================================
   4JURIS Pessoas · Regras de visibilidade de dados (LGPD)
   Quem vê o quê. Usadas pela interface; no backend devem virar
   políticas de acesso (RLS/consultas filtradas).
   ============================================================ */
import type { Colaborador, Comunicado, Documento, Evento, PeriodoIndisponibilidade, Setor } from '@/lib/types'
import { can } from './permissions'

export function comunicadoVisivel(m: Comunicado, user: { id: string; setorId: string }): boolean {
  if (m.alvo === 'todos') return true
  if (m.alvo === 'setores') return m.setoresAlvo.includes(user.setorId)
  if (m.alvo === 'usuarios') return m.usuariosAlvo.includes(user.id)
  return true
}

export function eventoVisivel(e: Evento, user: Colaborador): boolean {
  if (e.organizadorId === user.id || can(user.papel, 'eventos:gerenciar')) return true
  return e.visibilidade === 'todos' || e.setoresAlvo.includes(user.setorId)
}

/** Áreas que a pessoa coordena (liderança). */
export function areasLideradas(user: Colaborador, setores: Setor[]): Setor[] {
  return setores.filter((s) => s.gestorId === user.id || s.liderancaIds.includes(user.id))
}

/** Pode editar/cancelar um evento? */
export function podeGerenciarEvento(e: Evento, user: Colaborador, setores: Setor[]): boolean {
  if (can(user.papel, 'eventos:gerenciar')) return true
  if (e.organizadorId === user.id) return true
  if (!can(user.papel, 'eventos:gerenciar_area')) return false
  const minhas = new Set(areasLideradas(user, setores).map((s) => s.id))
  return e.visibilidade === 'setores' && e.setoresAlvo.length > 0 && e.setoresAlvo.every((id) => minhas.has(id))
}

/** Documentos: a própria pessoa e o RH. Lideranças NÃO veem documentos da equipe. */
export function podeVerDocumento(d: Documento, user: Colaborador): boolean {
  return d.colaboradorId === user.id || can(user.papel, 'documentos:gerenciar')
}

/**
 * Períodos de indisponibilidade: a própria pessoa, o RH, lideranças da área
 * e colegas da mesma área (apenas datas e mensagem para a equipe — nunca a
 * observação privada). Use `podeVerObservacaoPrivada` para o campo privado.
 */
export function podeVerPeriodo(p: PeriodoIndisponibilidade, user: Colaborador, setorDaPessoa: string | undefined): boolean {
  if (p.status === 'cancelado' && p.colaboradorId !== user.id && !can(user.papel, 'disponibilidade:configurar')) return false
  return p.colaboradorId === user.id || can(user.papel, 'disponibilidade:configurar') || setorDaPessoa === user.setorId ||
    can(user.papel, 'lideranca:ver_disponibilidade_equipe')
}

export function podeVerObservacaoPrivada(p: PeriodoIndisponibilidade, user: Colaborador): boolean {
  return p.colaboradorId === user.id || can(user.papel, 'disponibilidade:configurar')
}

/** Liderança pode registrar alinhamento de continuidade em períodos da sua área. */
export function podeAlinharPeriodo(p: PeriodoIndisponibilidade, user: Colaborador, setorDaPessoa: string | undefined, setores: Setor[]): boolean {
  if (p.colaboradorId === user.id) return false
  if (can(user.papel, 'disponibilidade:configurar')) return true
  return areasLideradas(user, setores).some((s) => s.id === setorDaPessoa)
}

/** Dados de contrato e financeiros de terceiros: somente RH/Admin. */
export function podeVerContratoDe(alvoId: string, user: Colaborador): boolean {
  return alvoId === user.id || can(user.papel, 'pessoas:ver_contratos')
}
