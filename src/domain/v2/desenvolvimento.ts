/* ============================================================
   4JURIS Pessoas · Ciclo de Desenvolvimento e Avaliação de Desempenho
   Regras PURAS (sem React/DB; só imports relativos), usadas pelo
   servidor (api/_v2/modulos/desenvolvimento.ts) e pelas telas.

   - Cronograma: 30, 60 e 90 dias (acompanhamento inicial) e AVD
     formal aos 6 meses e depois a cada 6 meses, a partir do início
     do vínculo (período de parceria) em aberto.
   - Liderança direta = responsável direto (responsavelId) ou, sem
     ele, a liderança da área (mesma regra de domain/avaliacoes.ts).
   - Resultado numérico é indicador de APOIO: nenhuma decisão é
     tomada automaticamente a partir dele.
   ============================================================ */
import { somarDias, diasEntre } from '../datas.js'
export { diasEntre }

/* ---------- tipos ---------- */
export type TipoCiclo = 'acompanhamento' | 'avd'
export type TipoFormulario = 'acomp_colaborador' | 'acomp_lideranca' | 'autoavaliacao' | 'lider_avalia' | 'equipe_avalia_lider'
export type ChaveModelo =
  | 'acomp_colaborador' | 'acomp_lideranca'
  | 'avd_auto_membro' | 'avd_lider_membro'
  | 'avd_auto_lideranca' | 'avd_superior_lideranca' | 'avd_equipe_lideranca'
export type Etapa = 'coleta' | 'consolidacao' | 'devolutiva' | 'pdi' | 'encerramento' | 'concluida' | 'cancelada' | 'suspensa'
export type StatusFormulario = 'pendente' | 'rascunho' | 'enviado' | 'dispensado' | 'expirado'
export type StatusAcao = 'planejada' | 'em_andamento' | 'concluida' | 'cancelada'
export type ResponsavelAcao = 'colaborador' | 'lideranca' | 'ambos' | 'rh'
export type TipoEscala = 'avd' | 'percepcao'

export interface Criterio { id: string; nome: string; descricao?: string; dimensao: string; peso: number }
export interface Pergunta { id: string; texto: string; obrigatoria: boolean; ajuda?: string }
export interface Modelo {
  chave: ChaveModelo
  versao: number
  titulo: string
  descricao: string
  escala: TipoEscala
  criterios: Criterio[]
  perguntas: Pergunta[]
}
/** Retrato do modelo gravado em cada formulário (mudanças posteriores não alteram formulários já abertos). */
export type RetratoModelo = Omit<Modelo, 'chave'> & { chave: ChaveModelo }

export type Nota = 1 | 2 | 3 | 4 | 5 | 'na'
export interface Respostas {
  notas: Record<string, Nota>
  justificativas: Record<string, string>
  abertas: Record<string, string>
}

export interface NivelEscala { valor: number; rotulo: string; descricao: string }
export interface ConfigDesenvolvimento {
  /** Data em que o módulo passou a valer. Marcos anteriores (com folga do prazo) não são gerados retroativamente. */
  inicioVigencia: string | null
  acompanhamento: { antecedenciaDias: number; prazoDias: number; registroDias: number }
  avd: { antecedenciaDias: number; prazoColetaDias: number; prazoConsolidacaoDias: number; prazoDevolutivaDias: number; prazoPdiDias: number; prazoEncerramentoDias: number }
  feedbackLideranca: { minRespostas: number; minDiasNaEquipe: number }
  escala: NivelEscala[]
  naRotulo: string
  naDescricao: string
  /** Notas que exigem justificativa/evidência na AVD (padrão 1, 2 e 5). */
  justificativaObrigatoria: number[]
  /** Lembrete enviado X dias antes do prazo. */
  lembreteDiasAntes: number
  /** O(a) colaborador(a) vê a avaliação feita pela liderança depois da devolutiva registrada. */
  colaboradorVeAvaliacaoLideranca: boolean
  /** RH recebe aviso a cada ciclo iniciado. */
  avisarRhInicio: boolean
  /** Os avisos principais (formulário aberto, prazo, atraso, devolutiva pendente) também vão por e-mail. */
  emailNotificacoes: boolean
  /** A diretoria recebe um resumo semanal do módulo (os avisos operacionais ficam com o RH). */
  resumoSemanalDiretoria: boolean
}

export const ESCALA_AVD_PADRAO: NivelEscala[] = [
  { valor: 1, rotulo: 'Abaixo do esperado', descricao: 'Apresenta dificuldades relevantes e precisa de acompanhamento próximo.' },
  { valor: 2, rotulo: 'Em desenvolvimento', descricao: 'Atende parcialmente e ainda precisa evoluir.' },
  { valor: 3, rotulo: 'Dentro do esperado', descricao: 'Desempenha adequadamente o que é esperado da função.' },
  { valor: 4, rotulo: 'Acima do esperado', descricao: 'Apresenta desempenho consistente acima das expectativas.' },
  { valor: 5, rotulo: 'Destaque', descricao: 'É referência na competência avaliada.' },
]

/** Escala dos acompanhamentos iniciais: percepção do momento, sem classificação de desempenho. */
export const ESCALA_PERCEPCAO: NivelEscala[] = [
  { valor: 1, rotulo: 'Com dificuldade', descricao: 'Há obstáculos importantes neste ponto; vale conversar e combinar apoio.' },
  { valor: 2, rotulo: 'Em adaptação', descricao: 'Está avançando, mas ainda precisa de apoio.' },
  { valor: 3, rotulo: 'Adequado', descricao: 'Está acontecendo como esperado para este momento.' },
  { valor: 4, rotulo: 'Bem', descricao: 'Está fluindo bem, com segurança.' },
  { valor: 5, rotulo: 'Muito bem', descricao: 'Está fluindo muito bem; nada a ajustar agora.' },
]

export const CONFIG_PADRAO: ConfigDesenvolvimento = {
  inicioVigencia: null,
  acompanhamento: { antecedenciaDias: 3, prazoDias: 10, registroDias: 10 },
  avd: { antecedenciaDias: 10, prazoColetaDias: 20, prazoConsolidacaoDias: 7, prazoDevolutivaDias: 15, prazoPdiDias: 10, prazoEncerramentoDias: 10 },
  feedbackLideranca: { minRespostas: 3, minDiasNaEquipe: 60 },
  escala: ESCALA_AVD_PADRAO,
  naRotulo: 'Não se aplica',
  naDescricao: 'Não há elementos suficientes para avaliar ou a competência não se aplica.',
  justificativaObrigatoria: [1, 2, 5],
  lembreteDiasAntes: 3,
  colaboradorVeAvaliacaoLideranca: true,
  avisarRhInicio: true,
  emailNotificacoes: true,
  resumoSemanalDiretoria: true,
}

const num = (v: unknown, padrao: number, min: number, max: number) => {
  const n = Number(v)
  return Number.isInteger(n) && n >= min && n <= max ? n : padrao
}
const txt = (v: unknown, padrao: string, max = 300) => (typeof v === 'string' && v.trim() ? v.trim().slice(0, max) : padrao)

/** Normaliza a configuração vinda do banco/da tela (valores fora da faixa voltam ao padrão). */
export function normalizarConfig(v: unknown): ConfigDesenvolvimento {
  const o = (v && typeof v === 'object' ? v : {}) as Record<string, any>
  const p = CONFIG_PADRAO
  const ac = o.acompanhamento ?? {}, av = o.avd ?? {}, fl = o.feedbackLideranca ?? {}
  const escala = Array.isArray(o.escala) && o.escala.length === 5
    ? ESCALA_AVD_PADRAO.map((n, i) => ({ valor: n.valor, rotulo: txt(o.escala[i]?.rotulo, n.rotulo, 40), descricao: txt(o.escala[i]?.descricao, n.descricao) }))
    : p.escala
  const just = Array.isArray(o.justificativaObrigatoria) ? [...new Set(o.justificativaObrigatoria.map(Number).filter((n: number) => [1, 2, 3, 4, 5].includes(n)))] as number[] : p.justificativaObrigatoria
  return {
    inicioVigencia: typeof o.inicioVigencia === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(o.inicioVigencia) ? o.inicioVigencia : null,
    acompanhamento: {
      antecedenciaDias: num(ac.antecedenciaDias, p.acompanhamento.antecedenciaDias, 0, 15),
      prazoDias: num(ac.prazoDias, p.acompanhamento.prazoDias, 3, 30),
      registroDias: num(ac.registroDias, p.acompanhamento.registroDias, 3, 30),
    },
    avd: {
      antecedenciaDias: num(av.antecedenciaDias, p.avd.antecedenciaDias, 0, 30),
      prazoColetaDias: num(av.prazoColetaDias, p.avd.prazoColetaDias, 5, 60),
      prazoConsolidacaoDias: num(av.prazoConsolidacaoDias, p.avd.prazoConsolidacaoDias, 1, 30),
      prazoDevolutivaDias: num(av.prazoDevolutivaDias, p.avd.prazoDevolutivaDias, 3, 60),
      prazoPdiDias: num(av.prazoPdiDias, p.avd.prazoPdiDias, 3, 60),
      prazoEncerramentoDias: num(av.prazoEncerramentoDias, p.avd.prazoEncerramentoDias, 1, 60),
    },
    feedbackLideranca: {
      minRespostas: num(fl.minRespostas, p.feedbackLideranca.minRespostas, 2, 20),
      minDiasNaEquipe: num(fl.minDiasNaEquipe, p.feedbackLideranca.minDiasNaEquipe, 0, 365),
    },
    escala,
    naRotulo: txt(o.naRotulo, p.naRotulo, 40),
    naDescricao: txt(o.naDescricao, p.naDescricao),
    justificativaObrigatoria: just,
    lembreteDiasAntes: num(o.lembreteDiasAntes, p.lembreteDiasAntes, 0, 15),
    colaboradorVeAvaliacaoLideranca: typeof o.colaboradorVeAvaliacaoLideranca === 'boolean' ? o.colaboradorVeAvaliacaoLideranca : p.colaboradorVeAvaliacaoLideranca,
    avisarRhInicio: typeof o.avisarRhInicio === 'boolean' ? o.avisarRhInicio : p.avisarRhInicio,
    emailNotificacoes: typeof o.emailNotificacoes === 'boolean' ? o.emailNotificacoes : p.emailNotificacoes,
    resumoSemanalDiretoria: typeof o.resumoSemanalDiretoria === 'boolean' ? o.resumoSemanalDiretoria : p.resumoSemanalDiretoria,
  }
}

export const escalaDe = (tipo: TipoEscala, cfg: ConfigDesenvolvimento) => (tipo === 'percepcao' ? ESCALA_PERCEPCAO : cfg.escala)

/* ---------- modelos padrão (editáveis pelo RH: cada edição cria uma nova versão) ---------- */
const c = (id: string, nome: string, dimensao: string, descricao = '', peso = 1): Criterio => ({ id, nome, dimensao, descricao, peso })
const q = (id: string, texto: string, obrigatoria = false, ajuda?: string): Pergunta => ({ id, texto, obrigatoria, ...(ajuda ? { ajuda } : {}) })

export const MODELOS_PADRAO: Record<ChaveModelo, Modelo> = {
  acomp_colaborador: {
    chave: 'acomp_colaborador', versao: 1, escala: 'percepcao',
    titulo: 'Acompanhamento inicial · sua percepção',
    descricao: 'Uma conversa sobre como estão sendo seus primeiros meses. Não é uma avaliação de desempenho: serve para ajustar o apoio que você recebe.',
    criterios: [
      c('adaptacao', 'Minha adaptação à 4JURIS', 'Integração'),
      c('responsabilidades', 'Compreendo minhas responsabilidades e entregas', 'Clareza'),
      c('rotina', 'Consigo acompanhar a rotina e os processos da minha função', 'Rotina'),
      c('suporte', 'Recebi orientações e suporte suficientes', 'Apoio'),
      c('expectativas', 'Tenho clareza sobre o que a empresa espera de mim', 'Clareza'),
      c('comunicacao', 'Comunicação com minha liderança e equipe', 'Integração'),
    ],
    perguntas: [
      q('dificuldade', 'Existe alguma dificuldade que esteja impedindo sua evolução?'),
      q('aprendizados', 'Quais foram seus principais aprendizados até agora?', true),
      q('apoio', 'Em que aspectos gostaria de receber mais apoio?'),
      q('comentarios', 'Quer acrescentar algo?'),
    ],
  },
  acomp_lideranca: {
    chave: 'acomp_lideranca', versao: 1, escala: 'percepcao',
    titulo: 'Acompanhamento inicial · percepção da liderança',
    descricao: 'Sua leitura sobre a adaptação da pessoa neste momento. O objetivo é orientar e combinar apoio, não classificar.',
    criterios: [
      c('adaptacao', 'Adaptação à empresa e à equipe', 'Integração'),
      c('atribuicoes', 'Compreensão das atribuições da função', 'Clareza'),
      c('aprendizado', 'Evolução no aprendizado', 'Aprendizado'),
      c('compromissos', 'Cumprimento de compromissos e prazos', 'Entregas'),
      c('iniciativa', 'Responsabilidade e iniciativa', 'Entregas'),
      c('comunicacao', 'Comunicação e integração com a equipe', 'Integração'),
    ],
    perguntas: [
      q('positivos', 'Quais são os principais pontos positivos?', true),
      q('atencao', 'Quais pontos precisam de atenção?'),
      q('orientacoes', 'Quais orientações e ações devem ser realizadas até o próximo acompanhamento?', true),
    ],
  },
  avd_auto_membro: {
    chave: 'avd_auto_membro', versao: 1, escala: 'avd',
    titulo: 'Autoavaliação',
    descricao: 'Um momento para refletir sobre o seu semestre: o que foi bem, o que aprendeu e onde quer evoluir.',
    criterios: [
      c('qualidade', 'Qualidade das entregas', 'Entregas'),
      c('organizacao', 'Organização e gestão do tempo', 'Entregas'),
      c('prazos', 'Cumprimento de prazos', 'Entregas'),
      c('responsabilidade', 'Responsabilidade e comprometimento', 'Atitude'),
      c('comunicacao', 'Comunicação', 'Relacionamento'),
      c('equipe', 'Trabalho em equipe', 'Relacionamento'),
      c('iniciativa', 'Iniciativa e autonomia', 'Atitude'),
      c('problemas', 'Capacidade de solucionar problemas', 'Atitude'),
      c('aprendizado', 'Aprendizado e desenvolvimento', 'Desenvolvimento'),
      c('cultura', 'Alinhamento aos valores e à cultura da 4JURIS', 'Desenvolvimento'),
    ],
    perguntas: [
      q('contribuicoes', 'Quais foram suas principais contribuições neste semestre?', true),
      q('resultados', 'Quais resultados você considera mais importantes?'),
      q('dificuldades', 'Quais dificuldades enfrentou?'),
      q('evolucao', 'Em quais competências percebeu maior evolução?'),
      q('desenvolver', 'Quais habilidades precisa desenvolver?', true),
      q('melhor', 'O que poderia ter feito melhor?'),
      q('suporte', 'Como avalia o suporte recebido da liderança?'),
      q('objetivos', 'Quais objetivos pretende alcançar no próximo semestre?', true),
    ],
  },
  avd_lider_membro: {
    chave: 'avd_lider_membro', versao: 1, escala: 'avd',
    titulo: 'Avaliação da liderança',
    descricao: 'Sua avaliação sobre o semestre da pessoa. Sempre que possível, justifique com exemplos e situações concretas.',
    criterios: [
      c('tecnica', 'Qualidade técnica e operacional', 'Entregas'),
      c('qualidade', 'Qualidade das entregas', 'Entregas'),
      c('prazos', 'Cumprimento de prazos e responsabilidades', 'Entregas'),
      c('organizacao', 'Organização', 'Entregas'),
      c('comunicacao', 'Comunicação', 'Relacionamento'),
      c('colaboracao', 'Colaboração', 'Relacionamento'),
      c('proatividade', 'Proatividade', 'Atitude'),
      c('autonomia', 'Autonomia', 'Atitude'),
      c('problemas', 'Capacidade de solucionar problemas', 'Atitude'),
      c('comprometimento', 'Comprometimento', 'Atitude'),
      c('evolucao', 'Evolução profissional', 'Desenvolvimento'),
      c('valores', 'Alinhamento aos valores e procedimentos da empresa', 'Desenvolvimento'),
    ],
    perguntas: [
      q('qualidades', 'Quais são as principais qualidades desta pessoa?', true),
      q('reconhecimento', 'Quais entregas merecem reconhecimento?'),
      q('desenvolver', 'Quais competências precisam ser desenvolvidas?', true),
      q('evolucao_anterior', 'A pessoa demonstra evolução em relação à última avaliação?'),
      q('prioridades', 'Quais são as prioridades de desenvolvimento para o próximo semestre?', true),
      q('suporte', 'Que tipo de suporte ou treinamento poderia melhorar o desempenho?'),
    ],
  },
  avd_auto_lideranca: {
    chave: 'avd_auto_lideranca', versao: 1, escala: 'avd',
    titulo: 'Autoavaliação da liderança',
    descricao: 'Reflexão sobre seu semestre como liderança: como você conduziu pessoas, resultados e cultura.',
    criterios: [
      c('pessoas', 'Gestão e desenvolvimento de pessoas', 'Pessoas'),
      c('comunicacao', 'Comunicação e relacionamento', 'Pessoas'),
      c('planejamento', 'Planejamento e organização', 'Gestão'),
      c('distribuicao', 'Distribuição e acompanhamento de responsabilidades', 'Gestão'),
      c('decisao', 'Capacidade de tomar decisões', 'Gestão'),
      c('conflitos', 'Resolução de problemas e conflitos', 'Gestão'),
      c('resultados', 'Gestão de resultados', 'Gestão'),
      c('feedback', 'Capacidade de fornecer feedback', 'Pessoas'),
      c('reconhecimento', 'Reconhecimento e valorização da equipe', 'Pessoas'),
      c('ambiente', 'Promoção de um ambiente respeitoso', 'Cultura'),
      c('autonomia', 'Desenvolvimento da autonomia dos membros', 'Pessoas'),
      c('estrategia', 'Alinhamento com a estratégia e os valores da 4JURIS', 'Cultura'),
    ],
    perguntas: [
      q('contribuicoes', 'Quais foram suas principais contribuições neste semestre?', true),
      q('resultados_equipe', 'Quais resultados da equipe você considera mais importantes?'),
      q('dificuldades', 'Quais dificuldades enfrentou na gestão da equipe?'),
      q('evolucao', 'Em quais competências de liderança percebeu maior evolução?'),
      q('desenvolver', 'Quais habilidades de liderança precisa desenvolver?', true),
      q('melhor', 'O que poderia ter feito melhor?'),
      q('suporte', 'Como avalia o suporte recebido da sua liderança?'),
      q('objetivos', 'Quais objetivos pretende alcançar no próximo semestre?', true),
    ],
  },
  avd_superior_lideranca: {
    chave: 'avd_superior_lideranca', versao: 1, escala: 'avd',
    titulo: 'Avaliação da liderança pelo superior',
    descricao: 'Avalie a atuação desta pessoa como liderança. Justifique com exemplos e situações concretas sempre que possível.',
    criterios: [
      c('pessoas', 'Gestão e desenvolvimento de pessoas', 'Pessoas'),
      c('comunicacao', 'Comunicação e relacionamento', 'Pessoas'),
      c('planejamento', 'Planejamento e organização', 'Gestão'),
      c('distribuicao', 'Distribuição e acompanhamento de responsabilidades', 'Gestão'),
      c('decisao', 'Capacidade de tomar decisões', 'Gestão'),
      c('conflitos', 'Resolução de problemas e conflitos', 'Gestão'),
      c('resultados', 'Gestão de resultados', 'Gestão'),
      c('feedback', 'Capacidade de fornecer feedback', 'Pessoas'),
      c('reconhecimento', 'Reconhecimento e valorização da equipe', 'Pessoas'),
      c('ambiente', 'Promoção de um ambiente respeitoso', 'Cultura'),
      c('autonomia', 'Desenvolvimento da autonomia dos membros', 'Pessoas'),
      c('estrategia', 'Alinhamento com a estratégia e os valores da 4JURIS', 'Cultura'),
    ],
    perguntas: [
      q('qualidades', 'Quais são os principais pontos fortes desta liderança?', true),
      q('destaques', 'Quais resultados ou atitudes merecem reconhecimento?'),
      q('desenvolver', 'Quais competências de liderança precisam ser desenvolvidas?', true),
      q('evolucao', 'Houve evolução em relação à última avaliação?'),
      q('prioridades', 'Quais são as prioridades de desenvolvimento para o próximo semestre?', true),
      q('suporte', 'Que tipo de suporte ou formação ajudaria esta liderança?'),
    ],
  },
  avd_equipe_lideranca: {
    chave: 'avd_equipe_lideranca', versao: 1, escala: 'avd',
    titulo: 'Feedback sobre a sua liderança',
    descricao: 'Conte como é trabalhar com sua liderança direta. O objetivo é ajudar a liderança a evoluir, não criar confronto.',
    criterios: [
      c('clareza', 'Clareza na comunicação', 'Comunicação'),
      c('orientacao', 'Capacidade de orientar a equipe', 'Gestão'),
      c('planejamento', 'Organização e planejamento', 'Gestão'),
      c('distribuicao', 'Distribuição equilibrada de tarefas', 'Gestão'),
      c('disponibilidade', 'Disponibilidade para ajudar', 'Apoio'),
      c('escuta', 'Capacidade de ouvir', 'Comunicação'),
      c('respeito', 'Respeito e tratamento justo', 'Ambiente'),
      c('cobrancas', 'Clareza nas cobranças e expectativas', 'Comunicação'),
      c('feedback', 'Capacidade de fornecer feedback', 'Apoio'),
      c('reconhecimento', 'Reconhecimento do trabalho da equipe', 'Apoio'),
      c('conflitos', 'Capacidade de resolver conflitos', 'Ambiente'),
      c('desenvolvimento', 'Estímulo ao desenvolvimento profissional', 'Apoio'),
      c('coerencia', 'Coerência entre discurso e prática', 'Ambiente'),
      c('exemplo', 'Exemplo de conduta e alinhamento aos valores da 4JURIS', 'Ambiente'),
    ],
    perguntas: [
      q('continuar', 'O que sua liderança faz bem e deveria continuar fazendo?'),
      q('melhorar', 'O que poderia melhorar na forma de liderar?'),
      q('orientacoes', 'Você recebe orientações claras sobre suas responsabilidades?'),
      q('abertura', 'Sente que pode apresentar dificuldades e opiniões?'),
      q('feedbacks', 'Recebe feedbacks que ajudam no seu desenvolvimento?'),
      q('ambiente', 'Sua liderança contribui para um ambiente de trabalho produtivo e respeitoso?'),
      q('mudanca', 'Que mudança teria maior impacto positivo na equipe?'),
    ],
  },
}

export const ROTULO_MODELO: Record<ChaveModelo, string> = {
  acomp_colaborador: 'Acompanhamento · colaborador(a)',
  acomp_lideranca: 'Acompanhamento · liderança',
  avd_auto_membro: 'AVD · autoavaliação (membros)',
  avd_lider_membro: 'AVD · liderança avalia membro',
  avd_auto_lideranca: 'AVD · autoavaliação (lideranças)',
  avd_superior_lideranca: 'AVD · superior avalia liderança',
  avd_equipe_lideranca: 'AVD · equipe avalia a liderança (confidencial)',
}
export const CHAVES_MODELO = Object.keys(MODELOS_PADRAO) as ChaveModelo[]

/** Valida um modelo editado pelo RH. Devolve a mensagem de erro ou null. */
export function validarModelo(m: Pick<Modelo, 'titulo' | 'criterios' | 'perguntas'>): string | null {
  if (!m.titulo?.trim()) return 'Informe o título do formulário.'
  if (!Array.isArray(m.criterios) || !Array.isArray(m.perguntas)) return 'Formulário inválido.'
  if (m.criterios.length + m.perguntas.length === 0) return 'O formulário precisa de ao menos um critério ou pergunta.'
  if (m.criterios.length > 30 || m.perguntas.length > 20) return 'Formulário grande demais (máx. 30 critérios e 20 perguntas).'
  const ids = new Set<string>()
  for (const x of [...m.criterios, ...m.perguntas]) {
    if (!x.id || !/^[a-z0-9_-]{1,40}$/i.test(x.id)) return 'Identificador de item inválido.'
    if (ids.has(x.id)) return `Identificador repetido: ${x.id}.`
    ids.add(x.id)
  }
  for (const k of m.criterios) {
    if (!k.nome?.trim()) return 'Todo critério precisa de nome.'
    if (!(Number(k.peso) > 0 && Number(k.peso) <= 10)) return `Peso inválido em "${k.nome}" (entre 0,1 e 10).`
  }
  for (const p of m.perguntas) if (!p.texto?.trim()) return 'Toda pergunta precisa de texto.'
  return null
}

/* ---------- cronograma ---------- */
export interface Marco { marco: string; tipo: TipoCiclo; numero: number; rotulo: string; data: string }

/** Soma meses mantendo o dia (dia inexistente vira o último dia do mês: 31/01 + 1 mês = 28 ou 29/02). */
export function somarMeses(iso: string, meses: number): string {
  const [y, m, d] = iso.slice(0, 10).split('-').map(Number)
  const alvo = new Date(Date.UTC(y, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  const dia = Math.min(d, ultimo)
  return `${alvo.getUTCFullYear()}-${String(alvo.getUTCMonth() + 1).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

export const ACOMPANHAMENTOS = [30, 60, 90] as const

export function rotuloMarco(tipo: TipoCiclo, numero: number): string {
  return tipo === 'acompanhamento' ? `Acompanhamento de ${numero} dias` : `${numero}ª AVD · ${numero * 6} meses`
}

/** Marco da n-ésima AVD (n ≥ 1): 6n meses após a admissão. */
export const marcoAvd = (base: string, n: number): Marco => ({ marco: `${n * 6}m`, tipo: 'avd', numero: n, rotulo: rotuloMarco('avd', n), data: somarMeses(base, n * 6) })

/** Todos os marcos com data até `ate` (inclusive), em ordem. A sequência semestral é infinita. */
export function cronograma(base: string, ate: string): Marco[] {
  const out: Marco[] = ACOMPANHAMENTOS.map((d) => ({ marco: `${d}d`, tipo: 'acompanhamento' as const, numero: d, rotulo: rotuloMarco('acompanhamento', d), data: somarDias(base, d) }))
    .filter((m) => m.data <= ate)
  for (let n = 1; n < 400; n++) {
    const m = marcoAvd(base, n)
    if (m.data > ate) break
    out.push(m)
  }
  return out
}

/** Próximos `qtd` marcos a partir de `hoje` (exclusive o passado). */
export function proximosMarcos(base: string, hoje: string, qtd = 3): Marco[] {
  const out: Marco[] = []
  for (const d of ACOMPANHAMENTOS) { const data = somarDias(base, d); if (data >= hoje) out.push({ marco: `${d}d`, tipo: 'acompanhamento', numero: d, rotulo: rotuloMarco('acompanhamento', d), data }) }
  for (let n = 1; out.length < qtd + 3 && n < 400; n++) { const m = marcoAvd(base, n); if (m.data >= hoje) out.push(m) }
  return out.sort((a, b) => a.data.localeCompare(b.data)).slice(0, qtd)
}

/**
 * Marcos que devem existir HOJE como ciclo aberto: já chegou a janela de abertura (data − antecedência)
 * e não são anteriores à vigência do módulo (com a folga do prazo, para não gerar o passado inteiro de quem já estava na base).
 */
export function marcosDevidos(base: string, hoje: string, cfg: ConfigDesenvolvimento): Marco[] {
  const vigencia = cfg.inicioVigencia ?? hoje
  const ate = somarDias(hoje, Math.max(cfg.acompanhamento.antecedenciaDias, cfg.avd.antecedenciaDias))
  return cronograma(base, ate).filter((m) => {
    const antecedencia = m.tipo === 'acompanhamento' ? cfg.acompanhamento.antecedenciaDias : cfg.avd.antecedenciaDias
    const prazo = m.tipo === 'acompanhamento' ? cfg.acompanhamento.prazoDias : cfg.avd.prazoColetaDias
    if (somarDias(m.data, -antecedencia) > hoje) return false
    // Anterior à implantação: só entra se o prazo de resposta ainda alcança a data de vigência.
    if (somarDias(m.data, prazo) < vigencia) return false
    return true
  }).filter((m, _i, todos) => {
    // Nunca abre duas AVDs ao mesmo tempo (ex.: sistema parado): só a mais recente.
    if (m.tipo !== 'avd') return true
    return m.numero === Math.max(...todos.filter((x) => x.tipo === 'avd').map((x) => x.numero))
  })
}

export function prazoColeta(m: Pick<Marco, 'tipo' | 'data'>, cfg: ConfigDesenvolvimento): string {
  return somarDias(m.data, m.tipo === 'acompanhamento' ? cfg.acompanhamento.prazoDias : cfg.avd.prazoColetaDias)
}

/* ---------- organização (liderança e equipe) ---------- */
export interface PessoaMin {
  id: string; nome: string; status: string; setorId: string; cargoId: string; responsavelId?: string; dataEntrada?: string
  papel?: string; vinculos?: { id: string; inicio: string; fim?: string }[]; encerramentoAgendado?: { data: string }
}
export interface SetorMin { id: string; nome?: string; gestorId: string | null; liderancaIds: string[] }

const ativa = (p: PessoaMin | undefined) => !!p && p.status !== 'encerrado'

/** Liderança direta: responsável direto ativo ou, sem ele, a liderança da área (exceto a própria pessoa). */
export function liderDe(p: PessoaMin, pessoas: PessoaMin[], setores: SetorMin[], indice?: Map<string, PessoaMin>): string | null {
  const porId = indice ?? new Map(pessoas.map((x) => [x.id, x]))
  if (p.responsavelId && p.responsavelId !== p.id && ativa(porId.get(p.responsavelId))) return p.responsavelId
  const s = setores.find((x) => x.id === p.setorId)
  const candidatos = [...(s?.gestorId ? [s.gestorId] : []), ...(s?.liderancaIds ?? [])].filter((id) => id !== p.id && ativa(porId.get(id)))
  return candidatos[0] ?? null
}

/** Pessoas ativas cuja liderança direta é `liderId`. */
export function equipeDe(liderId: string, pessoas: PessoaMin[], setores: SetorMin[]): PessoaMin[] {
  const indice = new Map(pessoas.map((x) => [x.id, x]))
  return pessoas.filter((p) => p.id !== liderId && elegivelStatus(p) && liderDe(p, pessoas, setores, indice) === liderId)
}

/** Exerce liderança: tem equipe direta ou é liderança declarada de alguma área. */
export function ehLideranca(id: string, pessoas: PessoaMin[], setores: SetorMin[]): boolean {
  return equipeDe(id, pessoas, setores).length > 0 || setores.some((s) => s.gestorId === id || s.liderancaIds.includes(id))
}

export const elegivelStatus = (p: Pick<PessoaMin, 'status'>) => p.status === 'ativo' || p.status === 'integracao'

/** Vínculo (período de parceria) em aberto e sua data de início — a "data de admissão" do cronograma. */
export function vinculoAberto(p: PessoaMin): { id: string; inicio: string } | null {
  if (p.vinculos?.length) {
    const ord = [...p.vinculos].sort((a, b) => a.inicio.localeCompare(b.inicio))
    const v = ord[ord.length - 1]
    return v.fim ? null : { id: v.id, inicio: v.inicio }
  }
  return p.dataEntrada && /^\d{4}-\d{2}-\d{2}/.test(p.dataEntrada) ? { id: `${p.id}-v1`, inicio: p.dataEntrada.slice(0, 10) } : null
}

/* ---------- formulários do ciclo ---------- */
export interface PlanoFormulario { tipo: TipoFormulario; respondenteId: string; modelo: ChaveModelo }

/** Quais formulários um ciclo abre, conforme o tipo e se a pessoa exerce liderança. */
export function formulariosDoCiclo(tipo: TipoCiclo, avaliadoId: string, liderId: string | null, lideranca: boolean, equipe: string[]): PlanoFormulario[] {
  if (tipo === 'acompanhamento') {
    return [
      { tipo: 'acomp_colaborador', respondenteId: avaliadoId, modelo: 'acomp_colaborador' },
      ...(liderId ? [{ tipo: 'acomp_lideranca' as const, respondenteId: liderId, modelo: 'acomp_lideranca' as const }] : []),
    ]
  }
  const out: PlanoFormulario[] = [{ tipo: 'autoavaliacao', respondenteId: avaliadoId, modelo: lideranca ? 'avd_auto_lideranca' : 'avd_auto_membro' }]
  if (liderId) out.push({ tipo: 'lider_avalia', respondenteId: liderId, modelo: lideranca ? 'avd_superior_lideranca' : 'avd_lider_membro' })
  if (lideranca) for (const m of equipe) if (m !== avaliadoId && m !== liderId) out.push({ tipo: 'equipe_avalia_lider', respondenteId: m, modelo: 'avd_equipe_lideranca' })
  return out
}

export const FORMULARIO_INFO: Record<TipoFormulario, { rotulo: string; curto: string; confidencial: boolean }> = {
  acomp_colaborador: { rotulo: 'Percepção do(a) colaborador(a)', curto: 'Sua percepção', confidencial: false },
  acomp_lideranca: { rotulo: 'Percepção da liderança', curto: 'Liderança', confidencial: false },
  autoavaliacao: { rotulo: 'Autoavaliação', curto: 'Autoavaliação', confidencial: false },
  lider_avalia: { rotulo: 'Avaliação da liderança', curto: 'Liderança', confidencial: false },
  equipe_avalia_lider: { rotulo: 'Feedback da equipe sobre a liderança', curto: 'Equipe', confidencial: true },
}

/* ---------- respostas ---------- */
export const respostasVazias = (): Respostas => ({ notas: {}, justificativas: {}, abertas: {} })

/** Limpa o que veio do cliente: só itens do modelo, notas válidas e textos com limite. */
export function sanitizarRespostas(r: unknown, modelo: Pick<Modelo, 'criterios' | 'perguntas'>): Respostas {
  const o = (r && typeof r === 'object' ? r : {}) as Record<string, any>
  const out = respostasVazias()
  for (const k of modelo.criterios) {
    const v = o.notas?.[k.id]
    if (v === 'na' || [1, 2, 3, 4, 5].includes(Number(v))) out.notas[k.id] = v === 'na' ? 'na' : (Number(v) as Nota)
    const j = o.justificativas?.[k.id]
    if (typeof j === 'string' && j.trim()) out.justificativas[k.id] = j.trim().slice(0, 2000)
  }
  for (const p of modelo.perguntas) {
    const t = o.abertas?.[p.id]
    if (typeof t === 'string' && t.trim()) out.abertas[p.id] = t.trim().slice(0, 4000)
  }
  return out
}

/** Erros que impedem o envio (por item). Justificativa: escala AVD e nota na lista configurada. */
export function errosDeEnvio(r: Respostas, modelo: Pick<Modelo, 'criterios' | 'perguntas' | 'escala'>, cfg: Pick<ConfigDesenvolvimento, 'justificativaObrigatoria'>): Record<string, string> {
  const e: Record<string, string> = {}
  for (const k of modelo.criterios) {
    const n = r.notas[k.id]
    if (n === undefined) { e[k.id] = 'Escolha um nível (ou "Não se aplica").'; continue }
    if (modelo.escala === 'avd' && n !== 'na' && cfg.justificativaObrigatoria.includes(n) && (r.justificativas[k.id]?.length ?? 0) < 10)
      e[k.id] = 'Para este nível, descreva um exemplo ou evidência (mín. 10 caracteres).'
  }
  for (const p of modelo.perguntas) if (p.obrigatoria && !(r.abertas[p.id]?.trim())) e[p.id] = 'Resposta obrigatória.'
  return e
}

/** Média ponderada pelos pesos (N/A fica de fora). Escala 1–5, uma casa. Null sem notas. */
export function notaPonderada(r: Pick<Respostas, 'notas'>, criterios: Criterio[]): number | null {
  let soma = 0, pesos = 0
  for (const k of criterios) {
    const n = r.notas[k.id]
    if (typeof n === 'number') { soma += n * k.peso; pesos += k.peso }
  }
  return pesos ? Math.round((soma / pesos) * 10) / 10 : null
}

export interface MediaCriterio { id: string; nome: string; dimensao: string; media: number | null; n: number }
export interface Agregado { n: number; suprimido: boolean; media: number | null; porCriterio: MediaCriterio[]; porDimensao: { dimensao: string; media: number | null }[] }

/** Agrega respostas (feedback da equipe). Abaixo do mínimo, nada é exibido além da contagem. */
export function agregar(respostas: Pick<Respostas, 'notas'>[], criterios: Criterio[], minimo: number): Agregado {
  const n = respostas.length
  if (n < minimo) return { n, suprimido: true, media: null, porCriterio: [], porDimensao: [] }
  const porCriterio = criterios.map((k) => {
    const v = respostas.map((r) => r.notas[k.id]).filter((x): x is 1 | 2 | 3 | 4 | 5 => typeof x === 'number')
    return { id: k.id, nome: k.nome, dimensao: k.dimensao, media: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null, n: v.length }
  })
  const notas = respostas.map((r) => notaPonderada(r, criterios)).filter((x): x is number => x !== null)
  const dims = [...new Set(criterios.map((k) => k.dimensao))]
  return {
    n, suprimido: false,
    media: notas.length ? Math.round((notas.reduce((a, b) => a + b, 0) / notas.length) * 10) / 10 : null,
    porCriterio,
    porDimensao: dims.map((d) => {
      const v = porCriterio.filter((x) => x.dimensao === d && x.media !== null).map((x) => x.media!)
      return { dimensao: d, media: v.length ? Math.round((v.reduce((a, b) => a + b, 0) / v.length) * 10) / 10 : null }
    }),
  }
}

/** Embaralha (Fisher–Yates com semente) para que a ordem dos comentários não revele a ordem de envio. */
export function embaralhar<T>(lista: T[], semente: number): T[] {
  const a = [...lista]
  let s = semente >>> 0 || 1
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

/* ---------- etapas e status ---------- */
export interface FormStatus { tipo: TipoFormulario; status: StatusFormulario }
export interface CicloMin { tipo: TipoCiclo; etapa: Etapa; prazo: string; lideranca: boolean; avaliadorId?: string | null }

export const formFeito = (f: Pick<FormStatus, 'status'>) => f.status === 'enviado' || f.status === 'dispensado' || f.status === 'expirado'

/** Formulário respondido pela liderança direta do ciclo. */
export const ehFormLideranca = (t: TipoFormulario) => t === 'acomp_lideranca' || t === 'lider_avalia'

/**
 * Precisa da liderança para fechar a coleta? Sim, salvo na AVD de quem já é liderança e não tem superior (ex.: diretoria),
 * em que a avaliação é a autoavaliação mais o feedback da equipe.
 */
export const exigeLideranca = (c: Pick<CicloMin, 'tipo' | 'lideranca'>) => !(c.tipo === 'avd' && c.lideranca)

/**
 * A coleta terminou? Formulários obrigatórios entregues (ou dispensados pelo RH); o feedback da equipe fecha no prazo.
 * Sem formulário da liderança quando ela é exigida, a coleta não fecha (o RH designa quem conduz).
 */
export function coletaConcluida(forms: FormStatus[], prazo: string, hoje: string, c?: Pick<CicloMin, 'tipo' | 'lideranca'>): boolean {
  if (c && exigeLideranca(c) && !forms.some((f) => ehFormLideranca(f.tipo))) return false
  const obrig = forms.filter((f) => f.tipo !== 'equipe_avalia_lider')
  const equipe = forms.filter((f) => f.tipo === 'equipe_avalia_lider')
  if (!obrig.every(formFeito)) return false
  return equipe.every(formFeito) || hoje > prazo
}

/** Etapa seguinte ao fim da coleta. */
export function etapaAposColeta(c: Pick<CicloMin, 'tipo' | 'lideranca'>, temFeedbackEquipe: boolean): Etapa {
  if (c.tipo === 'acompanhamento') return 'devolutiva'
  return c.lideranca && temFeedbackEquipe ? 'consolidacao' : 'devolutiva'
}

export type StatusExibido =
  | 'aguardando_colaborador' | 'aguardando_autoavaliacao' | 'aguardando_lideranca' | 'aguardando_equipe' | 'sem_lideranca'
  | 'em_consolidacao' | 'aguardando_registro' | 'aguardando_devolutiva' | 'aguardando_pdi' | 'aguardando_encerramento'
  | 'concluida' | 'cancelada' | 'suspensa'

export const STATUS_DSV: Record<StatusExibido | 'programada', { rotulo: string; tom: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }> = {
  programada: { rotulo: 'Programada', tom: 'neutral' },
  aguardando_colaborador: { rotulo: 'Aguardando colaborador(a)', tom: 'brand' },
  aguardando_autoavaliacao: { rotulo: 'Aguardando autoavaliação', tom: 'brand' },
  aguardando_lideranca: { rotulo: 'Aguardando avaliação da liderança', tom: 'brand' },
  aguardando_equipe: { rotulo: 'Aguardando feedback da equipe', tom: 'brand' },
  sem_lideranca: { rotulo: 'Sem liderança definida', tom: 'warning' },
  em_consolidacao: { rotulo: 'Em consolidação', tom: 'gold' },
  aguardando_registro: { rotulo: 'Aguardando registro do acompanhamento', tom: 'gold' },
  aguardando_devolutiva: { rotulo: 'Aguardando devolutiva', tom: 'gold' },
  aguardando_pdi: { rotulo: 'Aguardando PDI', tom: 'gold' },
  aguardando_encerramento: { rotulo: 'Aguardando encerramento pelo RH', tom: 'gold' },
  concluida: { rotulo: 'Concluída', tom: 'success' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
  suspensa: { rotulo: 'Suspensa', tom: 'warning' },
}

export const ETAPA_ROTULO: Record<Etapa, string> = {
  coleta: 'Formulários', consolidacao: 'Consolidação', devolutiva: 'Devolutiva', pdi: 'PDI', encerramento: 'Encerramento',
  concluida: 'Concluída', cancelada: 'Cancelada', suspensa: 'Suspensa',
}

/** Status mostrado a partir da etapa e dos formulários. */
export function statusExibido(c: CicloMin, forms: FormStatus[]): StatusExibido {
  switch (c.etapa) {
    case 'concluida': case 'cancelada': case 'suspensa': return c.etapa
    case 'consolidacao': return 'em_consolidacao'
    case 'devolutiva': return c.tipo === 'acompanhamento' ? 'aguardando_registro' : 'aguardando_devolutiva'
    case 'pdi': return 'aguardando_pdi'
    case 'encerramento': return 'aguardando_encerramento'
  }
  const pend = (t: TipoFormulario) => forms.some((f) => f.tipo === t && !formFeito(f))
  if (c.tipo === 'acompanhamento') {
    if (pend('acomp_colaborador')) return 'aguardando_colaborador'
    if (!forms.some((f) => f.tipo === 'acomp_lideranca')) return 'sem_lideranca'
    return 'aguardando_lideranca'
  }
  if (pend('autoavaliacao')) return 'aguardando_autoavaliacao'
  if (!forms.some((f) => f.tipo === 'lider_avalia') && !c.lideranca) return 'sem_lideranca'
  if (pend('lider_avalia')) return 'aguardando_lideranca'
  return 'aguardando_equipe'
}

/** Ciclo aberto com o prazo da etapa atual vencido. Concluído, cancelado e suspenso nunca estão "em atraso". */
export const emAtraso = (c: Pick<CicloMin, 'etapa' | 'prazo'>, hoje: string) => !['concluida', 'cancelada', 'suspensa'].includes(c.etapa) && c.prazo < hoje
export const cicloAberto = (etapa: Etapa) => !['concluida', 'cancelada'].includes(etapa)

/** Prazo da próxima etapa a partir de hoje. */
export function prazoDaEtapa(etapa: Etapa, tipo: TipoCiclo, hoje: string, cfg: ConfigDesenvolvimento): string {
  if (tipo === 'acompanhamento') return somarDias(hoje, cfg.acompanhamento.registroDias)
  const d = etapa === 'consolidacao' ? cfg.avd.prazoConsolidacaoDias : etapa === 'devolutiva' ? cfg.avd.prazoDevolutivaDias : etapa === 'pdi' ? cfg.avd.prazoPdiDias : cfg.avd.prazoEncerramentoDias
  return somarDias(hoje, d)
}

/** Dias até o prazo (negativo = atrasado). */
export const diasParaPrazo = (prazo: string, hoje: string) => diasEntre(hoje, prazo)

export const STATUS_ACAO: Record<StatusAcao, { rotulo: string; tom: 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold' }> = {
  planejada: { rotulo: 'Planejada', tom: 'neutral' },
  em_andamento: { rotulo: 'Em andamento', tom: 'brand' },
  concluida: { rotulo: 'Concluída', tom: 'success' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
}
export const RESPONSAVEL_ACAO: Record<ResponsavelAcao, string> = {
  colaborador: 'Colaborador(a)', lideranca: 'Liderança', ambos: 'Colaborador(a) e liderança', rh: 'RH',
}
export const acaoAtrasada = (a: { status: StatusAcao; prazo: string | null }, hoje: string) => !!a.prazo && a.prazo < hoje && (a.status === 'planejada' || a.status === 'em_andamento')

/** Texto padrão de transparência mostrado antes do feedback sobre a liderança. */
export function avisoConfidencialidade(minimo: number): string {
  return `Suas respostas sobre a liderança são vistas apenas pelo RH, pela diretoria e por pessoas expressamente autorizadas, para construir um feedback de desenvolvimento. ` +
    `A liderança nunca vê respostas individuais: recebe médias e uma síntese preparada pelo RH, e só quando houver pelo menos ${minimo} respostas. ` +
    `As respostas não ficam ligadas ao seu nome no banco de dados, mas, em equipes pequenas, o conteúdo de um comentário pode permitir identificar quem escreveu — por isso não prometemos anonimato absoluto. Escreva de forma respeitosa e com exemplos.`
}

/* ---------- afastamentos ---------- */
export type CategoriaAfastamento = 'descanso' | 'licenca' | 'afastamento' | 'outro'
export const CATEGORIA_AFASTAMENTO: Record<CategoriaAfastamento, string> = {
  descanso: 'Descanso combinado', licenca: 'Licença', afastamento: 'Afastamento', outro: 'Outro motivo',
}
export interface Afastamento { id: string; inicio: string; fim: string | null }

/** Afastamento em curso na data (início ≤ dia ≤ fim; sem fim = em aberto). */
export const afastamentoEm = <T extends Afastamento>(lista: T[], dia: string): T | null =>
  lista.find((a) => a.inicio <= dia && (!a.fim || a.fim >= dia)) ?? null


/**
 * Novo prazo na retomada depois de um afastamento: o prazo anterior + os dias de pausa,
 * nunca antes de `minimoDias` a partir de hoje (quem volta precisa de tempo para responder).
 */
export function prazoAposPausa(prazoAntes: string, suspensoEm: string, hoje: string, minimoDias = 5): string {
  const pausa = Math.max(0, diasEntre(suspensoEm, hoje))
  const estendido = somarDias(prazoAntes, pausa)
  const minimo = somarDias(hoje, minimoDias)
  return estendido > minimo ? estendido : minimo
}

/* ---------- resumo semanal ---------- */
/** Semana ISO no formato 2026-W46 (chave do resumo semanal: um por semana). */
export function semanaISO(dia: string): string {
  const d = new Date(`${dia}T12:00:00Z`)
  d.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7)) // quinta-feira da mesma semana
  const ano = d.getUTCFullYear()
  const jan4 = new Date(Date.UTC(ano, 0, 4, 12))
  jan4.setUTCDate(jan4.getUTCDate() + 3 - ((jan4.getUTCDay() + 6) % 7))
  const semana = 1 + Math.round((d.getTime() - jan4.getTime()) / (7 * 86400000))
  return `${ano}-W${String(semana).padStart(2, '0')}`
}

/* ---------- calibração ---------- */
export interface LinhaCalibracao { avaliadorId: string | null; avaliadorNome: string | null; setorNome: string | null; notaAuto: number | null; notaLideranca: number | null }
export interface GrupoCalibracao {
  chave: string; nome: string; n: number; media: number; mediaAuto: number | null
  /** Diferença média liderança − autoavaliação (negativa: a liderança avalia abaixo da percepção da pessoa). */
  diferenca: number | null
  /** % de avaliações com média ≥ 4 e com média ≤ 2. */
  altas: number; baixas: number
  /** Distância da média geral (positiva: avalia acima da média da empresa). */
  desvio: number
  alerta: 'acima' | 'abaixo' | null
}
const r1 = (n: number) => Math.round(n * 10) / 10

/**
 * Agrupa as avaliações da liderança por quem avaliou (ou por área) para comparar os critérios de quem avalia.
 * Alerta quando o grupo tem ao menos `minimo` avaliações e se afasta da média geral em `limite` ou mais.
 * Serve para conversar sobre critérios (calibração), não para corrigir notas.
 */
export function calibrar(linhas: LinhaCalibracao[], por: 'avaliador' | 'area', minimo = 3, limite = 0.7): { geral: number | null; grupos: GrupoCalibracao[] } {
  const validas = linhas.filter((l) => l.notaLideranca !== null)
  if (!validas.length) return { geral: null, grupos: [] }
  const geral = validas.reduce((s, l) => s + l.notaLideranca!, 0) / validas.length
  const mapa = new Map<string, { nome: string; ls: LinhaCalibracao[] }>()
  for (const l of validas) {
    const chave = por === 'avaliador' ? l.avaliadorId ?? '—' : l.setorNome ?? '—'
    const nome = por === 'avaliador' ? l.avaliadorNome ?? 'Sem liderança' : l.setorNome ?? 'Sem área'
    const g = mapa.get(chave) ?? { nome, ls: [] }
    g.ls.push(l)
    mapa.set(chave, g)
  }
  const grupos = [...mapa.entries()].map(([chave, g]): GrupoCalibracao => {
    const n = g.ls.length
    const media = g.ls.reduce((s, l) => s + l.notaLideranca!, 0) / n
    const comAuto = g.ls.filter((l) => l.notaAuto !== null)
    const mediaAuto = comAuto.length ? comAuto.reduce((s, l) => s + l.notaAuto!, 0) / comAuto.length : null
    const diferenca = comAuto.length ? comAuto.reduce((s, l) => s + (l.notaLideranca! - l.notaAuto!), 0) / comAuto.length : null
    const desvio = media - geral
    return {
      chave, nome: g.nome, n, media: r1(media), mediaAuto: mediaAuto === null ? null : r1(mediaAuto), diferenca: diferenca === null ? null : r1(diferenca),
      altas: Math.round((g.ls.filter((l) => l.notaLideranca! >= 4).length / n) * 100),
      baixas: Math.round((g.ls.filter((l) => l.notaLideranca! <= 2).length / n) * 100),
      desvio: r1(desvio),
      alerta: n >= minimo && Math.abs(desvio) >= limite ? (desvio > 0 ? 'acima' : 'abaixo') : null,
    }
  }).sort((a, b) => b.n - a.n || a.nome.localeCompare(b.nome))
  return { geral: r1(geral), grupos }
}

/* ---------- comparação autoavaliação × liderança (apoio à devolutiva) ---------- */
export interface ItemComparacao { id: string; nome: string; dimensao: string; auto: number | null; lideranca: number | null; diferenca: number | null; conversar: boolean }
type AvaliacaoComparavel = { modelo: Pick<RetratoModelo, 'criterios'>; respostas: Pick<Respostas, 'notas'> }

/**
 * Cruza, critério a critério, a autoavaliação e a avaliação da liderança (casa por id e, sem id igual, por nome).
 * `conversar` marca diferenças de 2 pontos ou mais: bons pontos de partida para a conversa.
 * Ordem: maiores diferenças primeiro; critérios sem as duas notas no fim.
 */
export function compararAvaliacoes(lider: AvaliacaoComparavel, auto: AvaliacaoComparavel | null): ItemComparacao[] {
  const nota = (v: unknown) => (typeof v === 'number' ? v : null)
  const norm = (t: string) => t.trim().toLowerCase()
  const itens = lider.modelo.criterios.map((k): ItemComparacao => {
    const par = auto ? auto.modelo.criterios.find((x) => x.id === k.id) ?? auto.modelo.criterios.find((x) => norm(x.nome) === norm(k.nome)) : undefined
    const l = nota(lider.respostas.notas?.[k.id])
    const a = par && auto ? nota(auto.respostas.notas?.[par.id]) : null
    const diferenca = l !== null && a !== null ? l - a : null
    return { id: k.id, nome: k.nome, dimensao: k.dimensao, auto: a, lideranca: l, diferenca, conversar: diferenca !== null && Math.abs(diferenca) >= 2 }
  })
  const peso = (x: ItemComparacao) => (x.diferenca === null ? -1 : Math.abs(x.diferenca))
  return itens.sort((x, y) => peso(y) - peso(x))
}
