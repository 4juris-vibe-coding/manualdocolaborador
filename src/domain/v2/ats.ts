/* ============================================================
   4JURIS Pessoas · ATS · regras puras (servidor e cliente)
   Sem React, sem banco. Apenas imports relativos.
   ============================================================ */

export type TomStatus = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold'

export const STATUS_CANDIDATURA = ['ativa', 'contratado', 'reprovado', 'desistiu', 'cancelada', 'encerrada'] as const
export type StatusCandidatura = (typeof STATUS_CANDIDATURA)[number]

export const ROTULO_STATUS_CANDIDATURA: Record<string, { rotulo: string; tom: TomStatus }> = {
  ativa: { rotulo: 'Em andamento', tom: 'brand' },
  contratado: { rotulo: 'Contratado(a)', tom: 'success' },
  reprovado: { rotulo: 'Reprovado(a)', tom: 'danger' },
  desistiu: { rotulo: 'Desistiu', tom: 'warning' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
  encerrada: { rotulo: 'Processo encerrado', tom: 'neutral' },
}

export const ROTULO_STATUS_ENTREVISTA: Record<string, { rotulo: string; tom: TomStatus }> = {
  agendada: { rotulo: 'Agendada', tom: 'brand' },
  realizada: { rotulo: 'Realizada', tom: 'success' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
  nao_compareceu: { rotulo: 'Não compareceu', tom: 'warning' },
}

export const ROTULO_STATUS_PROPOSTA: Record<string, { rotulo: string; tom: TomStatus }> = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutral' },
  enviada: { rotulo: 'Enviada', tom: 'brand' },
  negociacao: { rotulo: 'Em negociação', tom: 'gold' },
  aceita: { rotulo: 'Aceita', tom: 'success' },
  recusada: { rotulo: 'Recusada', tom: 'danger' },
  expirada: { rotulo: 'Expirada', tom: 'warning' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
}

export const ROTULO_STATUS_COMUNICACAO: Record<string, { rotulo: string; tom: TomStatus }> = {
  pendente: { rotulo: 'Pendente', tom: 'warning' },
  enviada: { rotulo: 'Enviada', tom: 'success' },
  falhou: { rotulo: 'Falhou', tom: 'danger' },
  nao_configurado: { rotulo: 'E-mail não configurado', tom: 'neutral' },
}

export const ORIGENS = ['portal', 'indicacao', 'linkedin', 'manual', 'importacao', 'banco_talentos', 'outro'] as const
export const ROTULO_ORIGEM: Record<string, string> = {
  portal: 'Portal de carreiras', indicacao: 'Indicação', linkedin: 'LinkedIn', manual: 'Cadastro manual',
  importacao: 'Importação', banco_talentos: 'Banco de talentos', outro: 'Outra',
}
/** Origens que o candidato pode informar no link público (?origem=). */
export const ORIGENS_PUBLICAS = ['portal', 'indicacao', 'linkedin', 'outro'] as const

export const TIPOS_ETAPA = ['nova', 'triagem', 'curricular', 'tecnica', 'entrevista_rh', 'entrevista_gestor', 'entrevista_final', 'proposta', 'contratado', 'generica'] as const

/** Etapas criadas quando a vaga ainda não tem nenhuma. */
export const ETAPAS_PADRAO: { nome: string; tipo: (typeof TIPOS_ETAPA)[number] }[] = [
  { nome: 'Nova candidatura', tipo: 'nova' },
  { nome: 'Triagem inicial', tipo: 'triagem' },
  { nome: 'Análise curricular', tipo: 'curricular' },
  { nome: 'Avaliação técnica', tipo: 'tecnica' },
  { nome: 'Entrevista com RH', tipo: 'entrevista_rh' },
  { nome: 'Entrevista com gestor', tipo: 'entrevista_gestor' },
  { nome: 'Entrevista final', tipo: 'entrevista_final' },
  { nome: 'Proposta', tipo: 'proposta' },
  { nome: 'Contratado', tipo: 'contratado' },
]

/** Status amigável mostrado ao candidato (nunca expõe nomes internos de etapas, notas ou avaliações). */
export function statusPublico(status: string, etapaTipo?: string | null): { rotulo: string; descricao: string } {
  if (status === 'contratado') return { rotulo: 'Processo concluído', descricao: 'Parabéns! O processo seletivo foi concluído com a sua contratação.' }
  if (status === 'reprovado') return { rotulo: 'Não seguiremos com a sua candidatura', descricao: 'Agradecemos o seu interesse. Neste momento não seguiremos com a sua candidatura para esta vaga.' }
  if (status === 'desistiu') return { rotulo: 'Candidatura encerrada a seu pedido', descricao: 'Registramos a sua desistência deste processo.' }
  if (status === 'cancelada' || status === 'encerrada') return { rotulo: 'Processo encerrado', descricao: 'Este processo seletivo foi encerrado. Agradecemos a sua participação.' }
  switch (etapaTipo) {
    case 'nova': return { rotulo: 'Candidatura recebida', descricao: 'Recebemos a sua candidatura e ela será analisada em breve.' }
    case 'triagem': case 'curricular': return { rotulo: 'Em análise', descricao: 'Estamos analisando o seu perfil.' }
    case 'tecnica': return { rotulo: 'Avaliação em andamento', descricao: 'Você está na fase de avaliação do processo.' }
    case 'entrevista_rh': case 'entrevista_gestor': case 'entrevista_final': return { rotulo: 'Fase de entrevistas', descricao: 'Você está na fase de entrevistas. Fique atento(a) ao seu e-mail.' }
    case 'proposta': return { rotulo: 'Fase final', descricao: 'Você está na fase final do processo.' }
    default: return { rotulo: 'Em andamento', descricao: 'A sua candidatura segue em andamento.' }
  }
}

/* ---------- movimentação ---------- */
export interface EtapaMin { id: string; tipo: string; ordem: number }
export type PedidoMovimento = { etapaId?: string | null; status?: string | null; motivo?: string | null }
export type ResultadoMovimento =
  | { ok: true; status: StatusCandidatura; etapaId: string | null; contratar: boolean }
  | { ok: false; erro: string }

const SAIDAS_COM_MOTIVO = ['reprovado', 'desistiu', 'cancelada']

/** Valida a movimentação de uma candidatura. Moverpara a etapa do tipo "contratado" conclui a contratação. */
export function validarMovimento(atual: { status: string; etapaId: string | null }, pedido: PedidoMovimento, etapas: EtapaMin[]): ResultadoMovimento {
  if (atual.status === 'contratado') return { ok: false, erro: 'Esta candidatura já foi concluída com contratação.' }
  const alvoStatus = pedido.status && pedido.status !== atual.status ? pedido.status : null
  if (alvoStatus && !(STATUS_CANDIDATURA as readonly string[]).includes(alvoStatus)) return { ok: false, erro: 'Situação inválida.' }
  if (alvoStatus === 'contratado') return { ok: false, erro: 'Use o fluxo de proposta (aceite) ou mova para a etapa "Contratado".' }
  if (alvoStatus && alvoStatus !== 'ativa') {
    if (atual.status !== 'ativa') return { ok: false, erro: 'A candidatura já está fora do processo ativo. Reative-a antes.' }
    if (SAIDAS_COM_MOTIVO.includes(alvoStatus) && !(pedido.motivo ?? '').trim()) return { ok: false, erro: 'Informe o motivo.' }
    return { ok: true, status: alvoStatus as StatusCandidatura, etapaId: atual.etapaId, contratar: false }
  }
  // reativar ou mover de etapa (ambos terminam em status "ativa")
  if (alvoStatus === 'ativa' && !pedido.etapaId && !atual.etapaId) return { ok: false, erro: 'Escolha a etapa para reativar.' }
  const etapaId = pedido.etapaId ?? atual.etapaId
  if (pedido.etapaId) {
    const e = etapas.find((x) => x.id === pedido.etapaId)
    if (!e) return { ok: false, erro: 'A etapa não pertence a esta vaga.' }
    if (pedido.etapaId === atual.etapaId && !alvoStatus) return { ok: false, erro: 'A candidatura já está nesta etapa.' }
    return { ok: true, status: 'ativa', etapaId: e.id, contratar: e.tipo === 'contratado' }
  }
  if (alvoStatus === 'ativa') return { ok: true, status: 'ativa', etapaId, contratar: false }
  return { ok: false, erro: 'Informe a etapa ou a nova situação.' }
}

/* ---------- vaga aceita candidaturas? ---------- */
export function vagaAceitaCandidaturas(v: { status: string; arquivada?: boolean; publicar_em?: string | null; encerra_candidaturas_em?: string | null }, hoje: string): { ok: true } | { ok: false; motivo: string } {
  if (v.arquivada) return { ok: false, motivo: 'Esta vaga não está mais disponível.' }
  if (v.status === 'pausada') return { ok: false, motivo: 'As candidaturas para esta vaga estão temporariamente pausadas.' }
  if (v.status === 'encerrada' || v.status === 'cancelada') return { ok: false, motivo: 'Esta vaga foi encerrada e não recebe mais candidaturas.' }
  if (v.status !== 'publicada') return { ok: false, motivo: 'Esta vaga não está disponível para candidaturas.' }
  if (v.publicar_em && v.publicar_em > hoje) return { ok: false, motivo: 'Esta vaga ainda não foi aberta para candidaturas.' }
  if (v.encerra_candidaturas_em && v.encerra_candidaturas_em < hoje) return { ok: false, motivo: 'O prazo para candidaturas desta vaga terminou.' }
  return { ok: true }
}

/* ---------- avaliações ---------- */
export interface Criterio { id: string; nome: string; peso: number }

export const MODELO_AVALIACAO_PADRAO: { nome: string; criterios: Criterio[] } = {
  nome: 'Entrevista geral',
  criterios: [
    { id: 'comunicacao', nome: 'Comunicação', peso: 1 },
    { id: 'conhecimento_tecnico', nome: 'Conhecimento técnico', peso: 2 },
    { id: 'aderencia_cultural', nome: 'Aderência à cultura', peso: 1 },
    { id: 'motivacao', nome: 'Motivação para a vaga', peso: 1 },
  ],
}

/** Média ponderada (1 a 5). Critérios sem nota são ignorados; null se nada foi avaliado. */
export function mediaPonderada(notas: Record<string, number>, criterios?: Criterio[]): number | null {
  let soma = 0, pesos = 0
  for (const [id, n] of Object.entries(notas)) {
    if (typeof n !== 'number' || n < 1 || n > 5) continue
    const peso = criterios?.find((c) => c.id === id)?.peso ?? 1
    soma += n * peso; pesos += peso
  }
  return pesos ? Math.round((soma / pesos) * 100) / 100 : null
}

/* ---------- modelos de mensagem ---------- */
export const TEMPLATES_PADRAO: { chave: string; nome: string; assunto: string; corpo: string }[] = [
  { chave: 'confirmacao_candidatura', nome: 'Confirmação de candidatura', assunto: 'Recebemos a sua candidatura — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nRecebemos a sua candidatura para a vaga "{{vaga}}". Vamos analisar o seu perfil e retornaremos pelos seus contatos.\n\nVocê pode acompanhar o andamento em:\n{{link_acompanhamento}}\n\nObrigado pelo interesse!\nEquipe {{empresa}}' },
  { chave: 'convite_entrevista', nome: 'Convite para entrevista', assunto: 'Convite para entrevista — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nGostaríamos de conversar com você sobre a vaga "{{vaga}}".\n\nData e horário: {{data_entrevista}}\nLocal / link: {{local_entrevista}}\n\nPor favor, confirme a sua presença respondendo esta mensagem.\n\nEquipe {{empresa}}' },
  { chave: 'solicitacao_informacoes', nome: 'Solicitação de informações', assunto: 'Precisamos de uma informação — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nPara seguirmos com a sua candidatura à vaga "{{vaga}}", precisamos que nos envie:\n\n{{informacao_solicitada}}\n\nEquipe {{empresa}}' },
  { chave: 'atualizacao_etapa', nome: 'Atualização de etapa', assunto: 'Atualização da sua candidatura — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nA sua candidatura à vaga "{{vaga}}" avançou no processo seletivo. Em breve entraremos em contato com os próximos passos.\n\nEquipe {{empresa}}' },
  { chave: 'envio_proposta', nome: 'Envio de proposta', assunto: 'Proposta — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nÉ com satisfação que enviamos a proposta para a vaga "{{vaga}}". Os detalhes serão compartilhados por um(a) recrutador(a) da nossa equipe.\n\nEquipe {{empresa}}' },
  { chave: 'encerramento', nome: 'Comunicação de encerramento', assunto: 'Sobre a sua candidatura — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nAgradecemos o seu interesse e o tempo dedicado ao processo da vaga "{{vaga}}". Neste momento não seguiremos com a sua candidatura.\n\nDesejamos sucesso!\nEquipe {{empresa}}' },
  { chave: 'acompanhamento', nome: 'Mensagem de acompanhamento', assunto: 'Como está a sua candidatura — {{vaga}}',
    corpo: 'Olá, {{nome}}!\n\nPassando para avisar que a sua candidatura à vaga "{{vaga}}" continua em análise. Assim que tivermos novidades, entraremos em contato.\n\nEquipe {{empresa}}' },
]

export const PRIVACIDADE_PADRAO = {
  versao: '2026-01',
  texto:
    'Tratamos os dados que você informa (identificação, contato, currículo e respostas da triagem) para avaliar a sua candidatura e conduzir o processo seletivo, o que inclui contato por e-mail ou telefone, entrevistas e, se houver contratação, a formalização. ' +
    'Os dados são acessados apenas por pessoas do RH, pelo(a) recrutador(a) e pelas pessoas envolvidas na vaga. ' +
    'Guardamos os dados pelo prazo do processo e por até 12 meses depois, salvo se você autorizar a permanência no nosso banco de talentos. ' +
    'Você pode solicitar acesso, correção, anonimização ou exclusão dos dados a qualquer momento, pelo canal indicado abaixo.',
  finalidade: 'processo_seletivo',
  baseLegal: 'execucao_pre_contratual',
  contato: 'rh@4juris.com.br',
  retencaoMeses: 12,
  aviso: 'Texto inicial de referência. A base legal, a finalidade e o prazo de retenção precisam ser validados pelo jurídico da empresa antes do uso em produção.',
}

/* ---------- CSV (importação em lote) ---------- */
const ALIAS: Record<string, string> = {
  nome: 'nome', 'nome completo': 'nome', email: 'email', 'e-mail': 'email', telefone: 'telefone', celular: 'telefone', fone: 'telefone',
  cidade: 'cidade', uf: 'uf', estado: 'uf', linkedin: 'linkedin', origem: 'origem',
}

/** Quebra um CSV (vírgula ou ponto e vírgula, com aspas). */
export function lerCsv(texto: string): string[][] {
  const t = texto.replace(/^﻿/, '')
  const primeira = t.split(/\r?\n/)[0] ?? ''
  const sep = (primeira.match(/;/g)?.length ?? 0) > (primeira.match(/,/g)?.length ?? 0) ? ';' : ','
  const linhas: string[][] = []
  let campo = '', linha: string[] = [], aspas = false
  for (let i = 0; i < t.length; i++) {
    const c = t[i]
    if (aspas) {
      if (c === '"' && t[i + 1] === '"') { campo += '"'; i++ } else if (c === '"') aspas = false
      else campo += c
    } else if (c === '"') aspas = true
    else if (c === sep) { linha.push(campo); campo = '' }
    else if (c === '\n' || c === '\r') {
      if (c === '\r' && t[i + 1] === '\n') i++
      linha.push(campo); campo = ''
      if (linha.some((x) => x.trim())) linhas.push(linha)
      linha = []
    } else campo += c
  }
  linha.push(campo)
  if (linha.some((x) => x.trim())) linhas.push(linha)
  return linhas
}

export interface LinhaCandidato { linha: number; nome: string; email: string; telefone: string; cidade: string; uf: string; linkedin: string; origem: string }
export interface ErroLinha { linha: number; mensagem: string }

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/

/** Valida linha a linha. Linhas inválidas viram erros e NÃO entram em `validas`. E-mails repetidos no arquivo são sinalizados. */
export function analisarCsvCandidatos(texto: string, maxLinhas = 500): { validas: LinhaCandidato[]; erros: ErroLinha[]; total: number } {
  const linhas = lerCsv(texto)
  if (linhas.length === 0) return { validas: [], erros: [{ linha: 1, mensagem: 'O arquivo está vazio.' }], total: 0 }
  const cab = linhas[0].map((h) => ALIAS[h.trim().toLowerCase()] ?? '')
  if (!cab.includes('nome') || !cab.includes('email')) {
    return { validas: [], erros: [{ linha: 1, mensagem: 'O cabeçalho precisa ter, no mínimo, as colunas "nome" e "email".' }], total: 0 }
  }
  const corpo = linhas.slice(1)
  if (corpo.length > maxLinhas) return { validas: [], erros: [{ linha: 1, mensagem: `Máximo de ${maxLinhas} linhas por importação.` }], total: corpo.length }
  const validas: LinhaCandidato[] = [], erros: ErroLinha[] = []
  const vistos = new Set<string>()
  corpo.forEach((cols, i) => {
    const n = i + 2
    const v: Record<string, string> = {}
    cab.forEach((k, j) => { if (k) v[k] = (cols[j] ?? '').trim() })
    const nome = (v.nome ?? '').slice(0, 200), email = (v.email ?? '').toLowerCase()
    if (!nome) return void erros.push({ linha: n, mensagem: 'Nome em branco.' })
    if (!EMAIL_RE.test(email)) return void erros.push({ linha: n, mensagem: `E-mail inválido: "${email.slice(0, 60)}".` })
    if (vistos.has(email)) return void erros.push({ linha: n, mensagem: `E-mail repetido no arquivo: ${email}.` })
    const uf = (v.uf ?? '').toUpperCase()
    if (uf && !/^[A-Z]{2}$/.test(uf)) return void erros.push({ linha: n, mensagem: `UF inválida: "${uf.slice(0, 10)}".` })
    vistos.add(email)
    validas.push({ linha: n, nome, email, telefone: (v.telefone ?? '').slice(0, 40), cidade: (v.cidade ?? '').slice(0, 100), uf, linkedin: (v.linkedin ?? '').slice(0, 200), origem: 'importacao' })
  })
  return { validas, erros, total: corpo.length }
}

/** Escapa um campo CSV e neutraliza fórmulas de planilha (=, +, -, @). */
export function campoCsv(v: unknown): string {
  let s = v === null || v === undefined ? '' : String(v)
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`
  return /[",;\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
}
export const linhaCsv = (cols: unknown[]) => cols.map(campoCsv).join(';')

export const diasNaEtapa = (desde: string | Date, agora = new Date()) => Math.max(0, Math.floor((agora.getTime() - new Date(desde).getTime()) / 86400000))

/** Data de retenção: hoje + N meses (AAAA-MM-DD). */
export function somarMeses(hoje: string, meses: number): string {
  const d = new Date(hoje + 'T00:00:00Z')
  d.setUTCMonth(d.getUTCMonth() + meses)
  return d.toISOString().slice(0, 10)
}
