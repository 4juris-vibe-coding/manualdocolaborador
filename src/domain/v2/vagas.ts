/* ============================================================
   4JURIS Pessoas · Vagas (regras puras)
   Usado pelo servidor (api/_v2/modulos/vagas.ts) e pela interface.
   Sem React, sem banco; somente imports relativos.
   ============================================================ */

export const STATUS_VAGA = ['rascunho', 'em_aprovacao', 'ajustes', 'aprovada', 'publicada', 'pausada', 'encerrada', 'cancelada'] as const
export type StatusVaga = (typeof STATUS_VAGA)[number]

export type TomVaga = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold'
export const MAPA_STATUS_VAGA: Record<StatusVaga, { rotulo: string; tom: TomVaga }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutral' },
  em_aprovacao: { rotulo: 'Em aprovação', tom: 'warning' },
  ajustes: { rotulo: 'Ajustes solicitados', tom: 'gold' },
  aprovada: { rotulo: 'Aprovada', tom: 'brand' },
  publicada: { rotulo: 'Publicada', tom: 'success' },
  pausada: { rotulo: 'Pausada', tom: 'warning' },
  encerrada: { rotulo: 'Encerrada', tom: 'neutral' },
  cancelada: { rotulo: 'Cancelada', tom: 'danger' },
}

/** Texto padrão de "Sobre a empresa" nas vagas novas (editável em cada vaga). */
export const SOBRE_4JURIS_PADRAO = 'A 4juris é uma empresa de marketing jurídico que une estratégia, tecnologia e performance para impulsionar escritórios de advocacia em todo o Brasil. Oferecemos soluções inovadoras e de alto valor agregado, que ajudam nossos clientes a conquistar mais visibilidade, atrair oportunidades e potencializar seus resultados.\nAqui, você terá a oportunidade de trabalhar com produtos que geram valor real para os clientes, em um mercado com grande potencial de crescimento. Buscamos pessoas ambiciosas, que gostam de vender, encaram desafios e querem crescer junto com o negócio.'

export const TIPOS_VAGA = ['efetivo', 'temporario', 'estagio', 'aprendiz', 'contrato', 'outro'] as const
/** Forma de contratação (vínculo). PJ/MEI/autônomo são contratos comerciais; CLT e estágio têm regras próprias, fora deste portal. */
export const REGIMES_CONTRATACAO = ['pj', 'mei', 'autonomo', 'clt', 'estagio', 'temporario', 'nao_informado'] as const
export const ROTULO_REGIME_CONTRATACAO: Record<string, string> = {
  pj: 'Prestação de serviços (PJ)', mei: 'Prestação de serviços (MEI)', autonomo: 'Autônomo', clt: 'CLT', estagio: 'Estágio', temporario: 'Temporário', nao_informado: 'Não informado',
}
export const ROTULO_TIPO: Record<string, string> = { efetivo: 'Efetivo', temporario: 'Temporário', estagio: 'Estágio', aprendiz: 'Aprendiz', contrato: 'Contrato (PJ)', outro: 'Outro' }
export const MOTIVOS_VAGA = ['substituicao', 'expansao', 'nova_posicao', 'outro'] as const
export const ROTULO_MOTIVO: Record<string, string> = { substituicao: 'Substituição', expansao: 'Expansão', nova_posicao: 'Nova posição', outro: 'Outro' }
export const PRIORIDADES_VAGA = ['baixa', 'normal', 'alta', 'critica'] as const
export const ROTULO_PRIORIDADE: Record<string, string> = { baixa: 'Baixa', normal: 'Normal', alta: 'Alta', critica: 'Crítica' }
export const MODALIDADES_VAGA = ['presencial', 'hibrido', 'remoto'] as const
export const ROTULO_MODALIDADE: Record<string, string> = { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' }
export const MOEDAS = ['BRL', 'USD', 'EUR'] as const
export const TIPOS_REMUNERACAO = ['mensal', 'hora', 'projeto', 'anual'] as const
export const ROTULO_REMUNERACAO: Record<string, string> = { mensal: 'Mensal', hora: 'Por hora', projeto: 'Por projeto', anual: 'Anual' }

export const TIPOS_ETAPA = ['nova', 'triagem', 'curricular', 'tecnica', 'entrevista_rh', 'entrevista_gestor', 'entrevista_final', 'proposta', 'contratado', 'generica'] as const
export type TipoEtapa = (typeof TIPOS_ETAPA)[number]
export const ROTULO_ETAPA: Record<TipoEtapa, string> = {
  nova: 'Nova candidatura', triagem: 'Triagem inicial', curricular: 'Análise curricular', tecnica: 'Avaliação técnica',
  entrevista_rh: 'Entrevista com RH', entrevista_gestor: 'Entrevista com gestor', entrevista_final: 'Entrevista final',
  proposta: 'Proposta', contratado: 'Contratado', generica: 'Etapa personalizada',
}

export interface EtapaModelo { nome: string; tipo: TipoEtapa }
export const ETAPAS_PADRAO: EtapaModelo[] = [
  { nome: 'Nova candidatura', tipo: 'nova' }, { nome: 'Triagem inicial', tipo: 'triagem' }, { nome: 'Análise curricular', tipo: 'curricular' },
  { nome: 'Avaliação técnica', tipo: 'tecnica' }, { nome: 'Entrevista com RH', tipo: 'entrevista_rh' }, { nome: 'Entrevista com gestor', tipo: 'entrevista_gestor' },
  { nome: 'Entrevista final', tipo: 'entrevista_final' }, { nome: 'Proposta', tipo: 'proposta' }, { nome: 'Contratado', tipo: 'contratado' },
]

export const CANAIS_PADRAO = [
  { chave: 'portal', nome: 'Portal de carreiras 4JURIS' },
  { chave: 'linkedin', nome: 'LinkedIn' },
  { chave: 'indeed', nome: 'Indeed' },
  { chave: 'indicacao', nome: 'Indicação interna' },
  { chave: 'outro', nome: 'Outro canal' },
]

/** Valida a lista de etapas de uma vaga: a primeira recebe as novas candidaturas e deve existir uma etapa final de contratação. */
export function validarEtapas(etapas: { nome: string; tipo: string }[]): string | null {
  if (etapas.length < 2) return 'Defina ao menos duas etapas (entrada e contratação).'
  if (etapas.length > 20) return 'No máximo 20 etapas.'
  if (etapas[0].tipo !== 'nova') return 'A primeira etapa deve ser a de novas candidaturas.'
  if (etapas.filter((e) => e.tipo === 'nova').length !== 1) return 'Só pode haver uma etapa de novas candidaturas.'
  if (etapas[etapas.length - 1].tipo !== 'contratado') return 'A última etapa deve ser a de contratação.'
  if (etapas.filter((e) => e.tipo === 'contratado').length !== 1) return 'Só pode haver uma etapa de contratação.'
  if (etapas.some((e) => !e.nome.trim())) return 'Toda etapa precisa de um nome.'
  const nomes = etapas.map((e) => e.nome.trim().toLowerCase())
  if (new Set(nomes).size !== nomes.length) return 'Há etapas com o mesmo nome.'
  return null
}

/* ---------- máquina de estados ---------- */
export type AcaoVaga = 'solicitar' | 'publicar' | 'pausar' | 'retomar' | 'encerrar' | 'cancelar' | 'reabrir'
export const ACOES_VAGA: readonly AcaoVaga[] = ['solicitar', 'publicar', 'pausar', 'retomar', 'encerrar', 'cancelar', 'reabrir']

const TRANSICOES: Record<AcaoVaga, Partial<Record<StatusVaga, StatusVaga>>> = {
  solicitar: { rascunho: 'em_aprovacao', ajustes: 'em_aprovacao' },
  publicar: { aprovada: 'publicada' },
  pausar: { publicada: 'pausada' },
  retomar: { pausada: 'publicada' },
  encerrar: { aprovada: 'encerrada', publicada: 'encerrada', pausada: 'encerrada' },
  cancelar: { rascunho: 'cancelada', em_aprovacao: 'cancelada', ajustes: 'cancelada', aprovada: 'cancelada', publicada: 'cancelada', pausada: 'cancelada' },
  reabrir: { encerrada: 'aprovada', cancelada: 'rascunho' },
}
/** Estado de destino, ou null se a ação não é permitida a partir do estado atual. (Decisões de aprovação têm regras próprias.) */
export function proximoStatus(de: StatusVaga, acao: AcaoVaga): StatusVaga | null {
  return TRANSICOES[acao][de] ?? null
}
export const acoesPossiveis = (de: StatusVaga): AcaoVaga[] => ACOES_VAGA.filter((a) => proximoStatus(de, a))

/** Quem pode editar o conteúdo, por estado. 'solicitante' = quem pediu/criou; 'gestao' = RH/recrutador. */
export function quemEdita(status: StatusVaga): 'solicitante' | 'gestao' | 'ninguem' {
  if (status === 'rascunho' || status === 'ajustes') return 'solicitante'
  if (status === 'aprovada' || status === 'publicada' || status === 'pausada') return 'gestao'
  return 'ninguem'
}

export const STATUS_ATIVOS: StatusVaga[] = ['em_aprovacao', 'ajustes', 'aprovada', 'publicada', 'pausada']
export const STATUS_FINAIS: StatusVaga[] = ['encerrada', 'cancelada']

/* ---------- requisitos de preenchimento ---------- */
export interface VagaCampos {
  titulo?: string | null; setorId?: string | null; qtdPosicoes?: number | null; prioridade?: string | null; motivo?: string | null
  responsabilidades?: string | null; resumo?: string | null; modalidade?: string | null; cidade?: string | null; estado?: string | null
  textoPublico?: string | null; canais?: string[] | null; encerraCandidaturasEm?: string | null; prazoPreenchimento?: string | null
  requisitosObrigatorios?: string[] | null
}

/** Campos que faltam para solicitar a aprovação ou publicar. Mapa campo → mensagem (vazio = ok). */
export function camposFaltantes(v: VagaCampos, para: 'solicitar' | 'publicar', hoje: string): Record<string, string> {
  const f: Record<string, string> = {}
  const vazio = (s: unknown) => !(typeof s === 'string' && s.trim())
  if (vazio(v.titulo)) f.titulo = 'Informe o título da vaga'
  if (vazio(v.setorId)) f.setorId = 'Escolha a área (departamento)'
  if (!v.qtdPosicoes || v.qtdPosicoes < 1) f.qtdPosicoes = 'Informe a quantidade de posições'
  if (vazio(v.responsabilidades) && vazio(v.resumo)) f.responsabilidades = 'Descreva as responsabilidades ou o resumo da vaga'
  if (vazio(v.modalidade)) f.modalidade = 'Informe a modalidade de trabalho'
  if (para === 'publicar') {
    if (vazio(v.textoPublico) && vazio(v.resumo)) f.textoPublico = 'Escreva o texto público da vaga (ou o resumo)'
    if (v.modalidade !== 'remoto' && (vazio(v.cidade) || vazio(v.estado))) f.cidade = 'Informe cidade e estado (vaga não remota)'
    if (!v.canais || v.canais.length === 0) f.canais = 'Escolha ao menos um canal de divulgação'
    if (!v.encerraCandidaturasEm) f.encerraCandidaturasEm = 'Defina a data de encerramento das candidaturas'
    else if (v.encerraCandidaturasEm < hoje) f.encerraCandidaturasEm = 'A data de encerramento das candidaturas já passou'
  }
  return f
}

/* ---------- fluxo de aprovação ---------- */
export type TipoAprovador = 'papel' | 'funcao' | 'pessoa'
export interface PassoFluxo { rotulo: string; tipo: TipoAprovador; ref: string; prazoDias?: number }
export interface CondicoesFluxo { tipos?: string[]; prioridades?: string[]; salarioMaxAcima?: number; motivos?: string[] }
export interface FluxoAprovacao { chave: string; nome: string; passos: PassoFluxo[]; condicoes?: CondicoesFluxo }

export const FLUXOS_PADRAO: FluxoAprovacao[] = [
  { chave: 'padrao', nome: 'Análise do RH', passos: [{ rotulo: 'Análise do RH', tipo: 'papel', ref: 'rh', prazoDias: 3 }] },
  {
    chave: 'critica', nome: 'Vaga crítica: RH, financeiro e diretoria',
    condicoes: { prioridades: ['critica'] },
    passos: [
      { rotulo: 'Análise do RH', tipo: 'papel', ref: 'rh', prazoDias: 3 },
      { rotulo: 'Aprovação do orçamento', tipo: 'funcao', ref: 'aprovador_financeiro', prazoDias: 3 },
      { rotulo: 'Aprovação da diretoria', tipo: 'papel', ref: 'diretoria', prazoDias: 5 },
    ],
  },
]

/** Primeiro fluxo (que não seja o padrão) cujas condições todas batem; senão o 'padrao'. */
export function escolherFluxo(fluxos: FluxoAprovacao[], v: { tipo?: string | null; prioridade?: string | null; motivo?: string | null; salarioMax?: number | null }): FluxoAprovacao {
  const casa = (f: FluxoAprovacao) => {
    const c = f.condicoes
    if (!c) return false
    const checks: boolean[] = []
    if (c.tipos?.length) checks.push(!!v.tipo && c.tipos.includes(v.tipo))
    if (c.prioridades?.length) checks.push(!!v.prioridade && c.prioridades.includes(v.prioridade))
    if (c.motivos?.length) checks.push(!!v.motivo && c.motivos.includes(v.motivo))
    if (c.salarioMaxAcima !== undefined) checks.push((v.salarioMax ?? 0) > c.salarioMaxAcima)
    return checks.length > 0 && checks.every(Boolean)
  }
  return fluxos.find((f) => f.chave !== 'padrao' && casa(f)) ?? fluxos.find((f) => f.chave === 'padrao') ?? FLUXOS_PADRAO[0]
}

export interface PassoAprovacao { id: string; ordem: number; status: string; aprovadorTipo: TipoAprovador; aprovadorRef: string }
export interface DecisorLike { colaboradorId: string; papel: string; funcoes: string[] }

/** A pessoa é a designada para o passo? (Administração decide qualquer passo.) */
export function podeDecidirPasso(passo: Pick<PassoAprovacao, 'aprovadorTipo' | 'aprovadorRef'>, u: DecisorLike): boolean {
  if (u.papel === 'admin') return true
  if (passo.aprovadorTipo === 'pessoa') return u.colaboradorId === passo.aprovadorRef
  if (passo.aprovadorTipo === 'papel') return u.papel === passo.aprovadorRef
  return u.funcoes.includes(passo.aprovadorRef)
}

/** Passo atual da rodada: o pendente de menor ordem (aprovações são sequenciais). */
export function passoAtual<T extends { ordem: number; status: string }>(passos: T[]): T | null {
  return [...passos].filter((p) => p.status === 'pendente').sort((a, b) => a.ordem - b.ordem)[0] ?? null
}

/* ---------- datas e prazos ---------- */
export const somarDias = (iso: string, dias: number): string => {
  const d = new Date(`${iso}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
export const diasEntreISO = (a: string, b: string): number => Math.round((Date.parse(`${b.slice(0, 10)}T12:00:00Z`) - Date.parse(`${a.slice(0, 10)}T12:00:00Z`)) / 86400000)

export type SituacaoPrazo = 'vencida' | 'proxima' | 'ok'
/** Prazo de preenchimento de vagas em andamento. null = sem prazo ou vaga fora de andamento/já preenchida. */
export function situacaoPrazo(v: { status: string; prazoPreenchimento?: string | null; qtdPosicoes: number; posicoesPreenchidas: number }, hoje: string, diasAviso = 7): SituacaoPrazo | null {
  if (!v.prazoPreenchimento || !['aprovada', 'publicada', 'pausada'].includes(v.status) || v.posicoesPreenchidas >= v.qtdPosicoes) return null
  if (v.prazoPreenchimento < hoje) return 'vencida'
  return diasEntreISO(hoje, v.prazoPreenchimento) <= diasAviso ? 'proxima' : 'ok'
}

export function semMovimentacao(v: { status: string }, ultimaAtividadeEm: string | null, hoje: string, dias = 14): boolean {
  if (v.status !== 'publicada' || !ultimaAtividadeEm) return false
  return diasEntreISO(ultimaAtividadeEm, hoje) >= dias
}

export function slugificar(texto: string): string {
  return texto.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 60) || 'vaga'
}

/** Protege células de planilhas contra injeção de fórmulas e escapa o separador. */
export function celulaCsv(v: unknown): string {
  let t = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(t)) t = `'${t}`
  return /[";\n\r]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t
}
