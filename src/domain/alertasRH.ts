/* ============================================================
   4JURIS Pessoas · Alertas do RH (puro: cliente e servidor)
   Uma lista única do que pede ação ou atenção, com chave estável
   (para notificar uma vez só) e link para resolver.
   ============================================================ */
import type { Colaborador, Contrato, Documento, Exigencia, MotivoEncerramento, ProcessoJornada } from '@/lib/types'
import { diasEntre, somarDias } from './datas.js'
import { vinculosDe, ultimo } from './vinculos.js'
import { processoAberto, prazoItem } from './jornada.js'

export type TipoAlerta =
  | 'aniversario_parceria' | 'marco_inicio' | 'contrato_vencendo' | 'contrato_vencido' | 'documento_vencendo' | 'documento_vencido'
  | 'exigencia_vencendo' | 'exigencia_vencida' | 'checklist_atrasado' | 'encerramento_agendado' | 'encerramento_sem_classificacao' | 'cadastro_pendente' | 'contrato_pessoa_encerrada'

export type Severidade = 'critico' | 'atencao' | 'info'

export interface AlertaRH {
  /** Estável entre execuções: base da deduplicação das notificações. */
  chave: string
  tipo: TipoAlerta
  severidade: Severidade
  titulo: string
  descricao: string
  pessoaId?: string
  /** Data de referência (vencimento, marco, prazo). */
  data: string
  link: string
}

export const ROTULO_TIPO_ALERTA: Record<TipoAlerta, string> = {
  aniversario_parceria: 'Aniversário de parceria', marco_inicio: 'Marco do início de parceria (30/60/90 dias)',
  contrato_vencendo: 'Contrato vencendo', contrato_vencido: 'Contrato vencido', documento_vencendo: 'Documento vencendo', documento_vencido: 'Documento vencido',
  exigencia_vencendo: 'Exigência vencendo', exigencia_vencida: 'Exigência vencida', checklist_atrasado: 'Checklist atrasado',
  encerramento_agendado: 'Encerramento agendado', encerramento_sem_classificacao: 'Encerramento sem classificação', cadastro_pendente: 'Cadastro pendente', contrato_pessoa_encerrada: 'Contrato vigente de parceria encerrada',
}

export interface EntradaAlertas {
  colaboradores: Colaborador[]
  contratos?: Contrato[]
  documentos?: Documento[]
  exigencias?: Exigencia[]
  processos?: ProcessoJornada[]
  motivosEncerramento?: MotivoEncerramento[]
}

export interface OpcoesAlertas {
  /** Antecedência (dias) para aniversários de parceria. */
  diasAniversario?: number
  /** Antecedência (dias) para vencimentos de contrato. */
  diasContrato?: number
  /** Antecedência (dias) para documentos e exigências. */
  diasDocumento?: number
}

const fmt = (d: string) => d.split('-').reverse().join('/')
const SEV: Record<Severidade, number> = { critico: 0, atencao: 1, info: 2 }

/** Próximo aniversário de parceria (6 meses, depois anos completos) a partir de `hoje`. */
export function proximoMarcoParceria(inicio: string, hoje: string): { data: string; rotulo: string } | null {
  const [y, m, d] = inicio.split('-').map(Number)
  const seis = new Date(y, m - 1 + 6, d)
  const iso = (x: Date) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
  if (iso(seis) >= hoje) return { data: iso(seis), rotulo: '6 meses' }
  for (let anos = 1; anos <= 60; anos++) {
    const dt = iso(new Date(y + anos, m - 1, d))
    if (dt >= hoje) return { data: dt, rotulo: anos === 1 ? '1 ano' : `${anos} anos` }
  }
  return null
}

export function alertasRH(e: EntradaAlertas, hoje: string, o: OpcoesAlertas = {}): AlertaRH[] {
  const dAniv = o.diasAniversario ?? 30, dCont = o.diasContrato ?? 60, dDoc = o.diasDocumento ?? 30
  const out: AlertaRH[] = []
  const ativos = e.colaboradores.filter((c) => c.status !== 'encerrado')
  const ativo = new Set(ativos.map((c) => c.id))
  const nome = (id: string) => e.colaboradores.find((c) => c.id === id)?.nome ?? 'Cadastro removido'

  for (const c of ativos) {
    const v = ultimo(vinculosDe(c))
    if (!v || v.fim) continue
    // Aniversário de parceria (celebração; aparece só com antecedência)
    const marco = proximoMarcoParceria(v.inicio, hoje)
    if (marco && marco.data <= somarDias(hoje, dAniv) && v.inicio <= hoje)
      out.push({ chave: `aniv:${c.id}:${marco.data}`, tipo: 'aniversario_parceria', severidade: 'info', titulo: `${c.nome} completa ${marco.rotulo} de parceria`, descricao: `Em ${fmt(marco.data)}.`, pessoaId: c.id, data: marco.data, link: `/rh/pessoas/${c.id}` })
    // Marcos de 30, 60 e 90 dias do início (acompanhamento do início de parceria / experiência)
    for (const dias of [30, 60, 90]) {
      const dt = somarDias(v.inicio, dias)
      const dist = diasEntre(hoje, dt)
      if (dist >= -3 && dist <= 7)
        out.push({ chave: `marco:${c.id}:${v.id}:${dias}`, tipo: 'marco_inicio', severidade: 'atencao', titulo: `${c.nome}: ${dias} dias de parceria`, descricao: `${dist < 0 ? 'Foi' : dist === 0 ? 'É hoje' : 'Será'} em ${fmt(dt)}. Hora da conversa de acompanhamento do início.`, pessoaId: c.id, data: dt, link: '/rh/inicio-parceria' })
    }
    if (c.encerramentoAgendado && c.encerramentoAgendado.data <= somarDias(hoje, 15))
      out.push({ chave: `agend:${c.id}:${c.encerramentoAgendado.data}`, tipo: 'encerramento_agendado', severidade: 'atencao', titulo: `Encerramento de ${c.nome} em ${fmt(c.encerramentoAgendado.data)}`, descricao: 'Agendado. No dia, o acesso é encerrado automaticamente; confira contratos e pendências.', pessoaId: c.id, data: c.encerramentoAgendado.data, link: `/rh/pessoas/${c.id}` })
    if (c.status === 'pendente' && diasEntre(v.inicio, hoje) >= 7)
      out.push({ chave: `pend:${c.id}`, tipo: 'cadastro_pendente', severidade: 'atencao', titulo: `Cadastro de ${c.nome} ainda pendente`, descricao: 'Complete os dados (razão social, CNPJ, função) para liberar a parceria.', pessoaId: c.id, data: v.inicio, link: `/rh/pessoas/${c.id}` })
  }

  for (const c of e.colaboradores) {
    if (c.status === 'encerrado' && c.encerramento && !c.encerramento.iniciativa)
      out.push({ chave: `semclass:${c.id}:${c.encerramento.data}`, tipo: 'encerramento_sem_classificacao', severidade: 'atencao', titulo: `Classifique o encerramento de ${c.nome}`, descricao: `Encerrado em ${fmt(c.encerramento.data)} sem iniciativa definida: fica fora do turnover involuntário.`, pessoaId: c.id, data: c.encerramento.data, link: `/rh/pessoas/${c.id}` })
  }

  for (const k of e.contratos ?? []) {
    const pessoa = e.colaboradores.find((c) => c.id === k.colaboradorId)
    if (pessoa?.status === 'encerrado' && (k.status === 'vigente' || k.status === 'em_renovacao'))
      out.push({ chave: `contenc:${k.id}`, tipo: 'contrato_pessoa_encerrada', severidade: 'critico', titulo: `Contrato ainda vigente: ${pessoa.nome}`, descricao: `A parceria foi encerrada${pessoa.encerramento ? ` em ${fmt(pessoa.encerramento.data)}` : ''}, mas o contrato segue vigente. Encerre-o em Gestão de prestadores.`, pessoaId: pessoa.id, data: pessoa.encerramento?.data ?? hoje, link: '/financeiro/contratos' })
    if (!ativo.has(k.colaboradorId) || k.status === 'encerrado' || k.status === 'rascunho' || !k.fim) continue
    if (k.fim < hoje) out.push({ chave: `contv:${k.id}:${k.fim}`, tipo: 'contrato_vencido', severidade: 'critico', titulo: `Contrato de ${nome(k.colaboradorId)} venceu`, descricao: `Venceu em ${fmt(k.fim)} e não foi renovado nem encerrado.`, pessoaId: k.colaboradorId, data: k.fim, link: `/rh/pessoas/${k.colaboradorId}` })
    else if (k.fim <= somarDias(hoje, dCont)) out.push({ chave: `cont:${k.id}:${k.fim}`, tipo: 'contrato_vencendo', severidade: diasEntre(hoje, k.fim) <= 15 ? 'critico' : 'atencao', titulo: `Contrato de ${nome(k.colaboradorId)} vence em ${fmt(k.fim)}`, descricao: `Faltam ${diasEntre(hoje, k.fim)} dia(s). Renove ou programe o encerramento.`, pessoaId: k.colaboradorId, data: k.fim, link: `/rh/pessoas/${k.colaboradorId}` })
  }

  for (const d of e.documentos ?? []) {
    if (!ativo.has(d.colaboradorId) || !d.validade) continue
    if (d.validade < hoje) out.push({ chave: `docv:${d.id}:${d.validade}`, tipo: 'documento_vencido', severidade: 'critico', titulo: `Documento vencido: ${d.nome}`, descricao: `${nome(d.colaboradorId)} · venceu em ${fmt(d.validade)}.`, pessoaId: d.colaboradorId, data: d.validade, link: `/rh/pessoas/${d.colaboradorId}` })
    else if (d.validade <= somarDias(hoje, dDoc)) out.push({ chave: `doc:${d.id}:${d.validade}`, tipo: 'documento_vencendo', severidade: 'atencao', titulo: `Documento vence em ${fmt(d.validade)}: ${d.nome}`, descricao: nome(d.colaboradorId), pessoaId: d.colaboradorId, data: d.validade, link: `/rh/pessoas/${d.colaboradorId}` })
  }

  for (const x of e.exigencias ?? []) {
    if (!ativo.has(x.colaboradorId) || !x.validade) continue
    const tipo = String(x.tipo)
    if (x.validade < hoje) out.push({ chave: `exv:${x.id}:${x.validade}`, tipo: 'exigencia_vencida', severidade: 'critico', titulo: `Exigência vencida (${tipo}): ${nome(x.colaboradorId)}`, descricao: `Venceu em ${fmt(x.validade)}.`, pessoaId: x.colaboradorId, data: x.validade, link: '/rh/exigencias' })
    else if (x.validade <= somarDias(hoje, dDoc)) out.push({ chave: `ex:${x.id}:${x.validade}`, tipo: 'exigencia_vencendo', severidade: 'atencao', titulo: `Exigência vence em ${fmt(x.validade)} (${tipo})`, descricao: nome(x.colaboradorId), pessoaId: x.colaboradorId, data: x.validade, link: '/rh/exigencias' })
  }

  for (const p of e.processos ?? []) {
    if (!processoAberto(p)) continue
    const atrasados = p.itens.filter((i) => !i.feito && (prazoItem(p, i.prazoDias) ?? '9999') < hoje)
    if (!atrasados.length) continue
    const maisAntigo = atrasados.map((i) => prazoItem(p, i.prazoDias)!).sort()[0]
    out.push({ chave: `ck:${p.id}:${atrasados.length}`, tipo: 'checklist_atrasado', severidade: diasEntre(maisAntigo, hoje) > 7 ? 'critico' : 'atencao', titulo: `${p.tipo === 'integracao' ? 'Integração' : 'Encerramento'} de ${nome(p.colaboradorId)}: ${atrasados.length} item(ns) atrasado(s)`, descricao: atrasados.slice(0, 3).map((i) => i.titulo).join(' · '), pessoaId: p.colaboradorId, data: maisAntigo, link: '/rh/jornadas?visao=cronograma' })
  }

  return out.sort((a, b) => SEV[a.severidade] - SEV[b.severidade] || a.data.localeCompare(b.data))
}
