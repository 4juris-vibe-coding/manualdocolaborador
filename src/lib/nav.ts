/* ============================================================
   4JURIS Pessoas · Navegação (uma plataforma, três áreas)
   - Área pessoal: todo participante.
   - Liderança: coordenação das próprias áreas.
   - RH e Administração: ferramentas administrativas.
   O acesso de cada item vem da matriz em src/domain/permissions.ts.
   ============================================================ */
import { canAny, type Capacidade } from '@/domain/permissions'
import type { Papel } from '@/lib/types'
import { MODO_API } from '@/data/config'

export interface NavItem {
  /** Caminho; em EXTRAS pode ter parâmetros (`/pesquisas-rh/:id/resultados`). */
  to: string
  label: string
  icon: string // nome do ícone lucide
  desc: string
  cap?: Capacidade | Capacidade[] // basta uma; se ausente, todos veem
  /** Só guarda de rota: não aparece em menu nem na busca. */
  oculto?: boolean
  /** Só existe com o banco conectado (módulos que gravam no servidor). */
  soApi?: boolean
}

export const permitido = (papel: Papel, i: NavItem) => (!i.soApi || MODO_API) && (!i.cap || canAny(papel, Array.isArray(i.cap) ? i.cap : [i.cap]))
export interface NavGroup {
  title: string
  area: 'pessoal' | 'lideranca' | 'rh' | 'admin'
  items: NavItem[]
}

export const NAV: NavGroup[] = [
  {
    title: 'Início', area: 'pessoal',
    items: [
      { to: '/', label: 'Início', icon: 'LayoutDashboard', desc: 'Seu resumo, agenda e avisos.' },
      { to: '/experiencia', label: 'Minha jornada', icon: 'Sparkles', desc: 'Pontos, conquistas e reconhecimentos.' },
    ],
  },
  {
    title: 'Meu espaço', area: 'pessoal',
    items: [
      { to: '/perfil', label: 'Meu perfil', icon: 'UserCircle', desc: 'Dados, contrato, documentos e privacidade.' },
      { to: '/disponibilidade', label: 'Disponibilidade', icon: 'Palmtree', desc: 'Descanso combinado e períodos de indisponibilidade.' },
      { to: '/notas', label: 'Notas fiscais', icon: 'FileText', desc: 'Envio e acompanhamento das NFs de serviço.' },
      { to: '/reembolsos', label: 'Reembolsos', icon: 'ReceiptText', desc: 'Reembolso de despesas vinculadas aos serviços.' },
      { to: '/meus-contratos', label: 'Meus contratos', icon: 'FileSignature', desc: 'Contratos de prestação de serviços em que você é contratada(o).', soApi: true },
      { to: '/meus-documentos', label: 'Meus documentos', icon: 'FolderLock', desc: 'Envio e acompanhamento dos seus documentos.', soApi: true },
    ],
  },
  {
    title: 'Comunidade', area: 'pessoal',
    items: [
      { to: '/comunicados', label: 'Comunicados', icon: 'Megaphone', desc: 'Avisos e novidades da empresa.' },
      { to: '/eventos', label: 'Agenda & eventos', icon: 'CalendarHeart', desc: 'Calendário de eventos e encontros.' },
      { to: '/organograma', label: 'Organograma', icon: 'Network', desc: 'Quem é quem: equipes, lideranças e funções.', cap: 'org:ver' },
      { to: '/aniversarios', label: 'Celebrações', icon: 'Cake', desc: 'Aniversários e marcos de parceria.' },
      { to: '/gamificacao', label: 'Reconhecimento', icon: 'Trophy', desc: 'Reconhecimentos, desafios e iniciativas.' },
      { to: '/pesquisas', label: 'Pesquisas', icon: 'MessagesSquare', desc: 'Pesquisas voluntárias e anônimas.' },
      { to: '/sugestoes', label: 'Caixa de sugestões', icon: 'Lightbulb', desc: 'Ideias anônimas da comunidade e seu andamento.' },
      { to: '/avaliacoes', label: 'Avaliações', icon: 'ClipboardCheck', desc: 'Avaliações para responder e seus resultados.' },
    ],
  },
  {
    title: 'Conhecimento', area: 'pessoal',
    items: [
      { to: '/onboarding', label: 'Minha integração', icon: 'Rocket', desc: 'Primeiros passos na 4JURIS.' },
      { to: '/conteudos', label: 'Conteúdos & trilhas', icon: 'GraduationCap', desc: 'Materiais de apoio e trilhas voluntárias.' },
      { to: '/canva', label: '4juris Canva', icon: 'Palette', desc: 'Crie apresentações, posts, stories e artes com modelos prontos.' },
      { to: '/cultura', label: 'Nossa cultura', icon: 'Sparkle', desc: 'Propósito, missão, visão e valores.' },
      { to: '/manual', label: 'Manual de convivência', icon: 'BookOpen', desc: 'Cultura, comunicação e boas práticas.' },
      { to: '/faq', label: 'Central de dúvidas', icon: 'HelpCircle', desc: 'Perguntas frequentes e busca.' },
      { to: '/assistente', label: 'Assistente', icon: 'Bot', desc: 'Respostas rápidas sobre a plataforma.' },
      { to: '/beneficios', label: 'Vantagens & parcerias', icon: 'Gift', desc: 'Parcerias e condições opcionais.' },
    ],
  },
  {
    title: 'Liderança', area: 'lideranca',
    items: [
      { to: '/lideranca', label: 'Painel da liderança', icon: 'UserCog', desc: 'Equipe, disponibilidade, objetivos e integração.', cap: 'lideranca:painel' },
      { to: '/financeiro/notas', label: 'Aceite de serviços', icon: 'BadgeCheck', desc: 'Notas fiscais dos contratos que você gere, para aceitar ou devolver.', cap: 'lideranca:painel', soApi: true },
      { to: '/rh/feedbacks', label: 'Feedbacks', icon: 'MessageSquareText', desc: 'Feedbacks de alinhamento sobre as entregas.', cap: 'feedbacks:registrar' },
      // Também para quem só aprova (diretoria, aprovação financeira, analista de RH): o servidor limita ao que cabe a cada um.
      { to: '/recrutamento/vagas', label: 'Vagas e aprovações', icon: 'BadgePlus', desc: 'Solicite vagas, acompanhe e decida aprovações.', cap: ['vagas:solicitar', 'vagas:ver'] },
    ],
  },
  {
    title: 'Visão geral', area: 'rh',
    items: [
      { to: '/rh', label: 'Indicadores', icon: 'BarChart3', desc: 'Indicadores com definição, fonte e período.', cap: 'rh:painel' },
      { to: '/rh/analytics', label: 'People Analytics', icon: 'LineChart', desc: 'Recrutamento, pesquisas e estrutura em um só painel.', cap: 'analytics:ver' },
    ],
  },
  {
    title: 'Gestão de prestadores', area: 'rh',
    items: [
      { to: '/financeiro/kanban', label: 'Kanban de notas', icon: 'KanbanSquare', desc: 'Quem já mandou a nota, quem falta, cobranças e pagamentos, por competência.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro', label: 'Painel financeiro', icon: 'Landmark', desc: 'Contratado, faturado, aprovado, previsto e pago; alertas e agenda.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro/contratos', label: 'Contratos', icon: 'FileSignature', desc: 'Contratos PJ: vigência, aditivos, renovação e encerramento.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro/fornecedores', label: 'Fornecedores', icon: 'Building2', desc: 'Empresas e autônomos contratados, dados fiscais e de pagamento.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro/notas', label: 'Notas fiscais', icon: 'FileCheck2', desc: 'Conferência e aceite das notas de serviço.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro/contas', label: 'Contas a pagar', icon: 'Wallet', desc: 'Retenções, autorização, registro de pagamento e conciliação.', cap: 'fin:ver', soApi: true },
      { to: '/financeiro/documentos', label: 'Documentos', icon: 'FolderLock', desc: 'Repositório com conferência, validade e substituição.', cap: ['fin:ver', 'documentos:gerenciar'], soApi: true },
      { to: '/financeiro/config', label: 'Configurações financeiras', icon: 'Settings2', desc: 'Segregação de funções, alertas e centros de custo.', cap: 'fin:ver', soApi: true },
    ],
  },
  {
    title: 'Recrutamento', area: 'rh',
    items: [
      { to: '/recrutamento', label: 'Painel de vagas', icon: 'LayoutDashboard', desc: 'Visão executiva e operacional do recrutamento.', cap: 'vagas:gerenciar' },
      { to: '/recrutamento/vagas', label: 'Vagas', icon: 'BriefcaseBusiness', desc: 'Criação, aprovação, publicação e encerramento de vagas.', cap: 'vagas:gerenciar' },
      { to: '/recrutamento/candidatos', label: 'Candidatos (ATS)', icon: 'KanbanSquare', desc: 'Pipeline seletivo, perfis e avaliações.', cap: 'ats:ver' },
      { to: '/recrutamento/curriculos', label: 'Currículos', icon: 'FileText', desc: 'Currículos recebidos, com download seguro.', cap: 'ats:ver' },
      { to: '/recrutamento/entrevistas', label: 'Entrevistas', icon: 'CalendarClock', desc: 'Agenda de entrevistas e pareceres pendentes.', cap: 'ats:ver' },
      { to: '/recrutamento/talentos', label: 'Banco de talentos', icon: 'Contact', desc: 'Pessoas para processos futuros, com autorização.', cap: 'ats:gerenciar' },
      { to: '/recrutamento/comunicacao', label: 'Comunicação', icon: 'MailCheck', desc: 'Mensagens a candidatos e modelos.', cap: 'ats:gerenciar' },
      { to: '/recrutamento/config', label: 'Configurar recrutamento', icon: 'Settings', desc: 'Fluxos de aprovação, etapas padrão e canais.', cap: 'vagas:config' },
    ],
  },
  {
    title: 'Central de pesquisas', area: 'rh',
    items: [
      { to: '/pesquisas-rh', label: 'Painel de pesquisas', icon: 'LayoutDashboard', desc: 'Participação, prazos e resultados.', cap: 'pesq:gerenciar' },
      { to: '/pesquisas-rh/lista', label: 'Pesquisas', icon: 'ClipboardList', desc: 'Criar, distribuir e acompanhar pesquisas.', cap: ['pesq:gerenciar', 'pesq:resultados'] },
      { to: '/pesquisas-rh/modelos', label: 'Biblioteca de modelos', icon: 'LibraryBig', desc: 'eNPS, clima, liderança, onboarding e mais.', cap: 'pesq:gerenciar' },
    ],
  },
  {
    title: 'Arquitetura de cargos', area: 'rh',
    items: [
      { to: '/cargos', label: 'Catálogo de cargos', icon: 'Layers3', desc: 'Fichas oficiais, famílias, trilhas e níveis.', cap: 'cargos:ver' },
      { to: '/cargos/matriz', label: 'Matriz de competências', icon: 'Grid3x3', desc: 'Competências esperadas por cargo e nível.', cap: 'cargos:ver' },
      { to: '/cargos/faixas', label: 'Faixas salariais', icon: 'Coins', desc: 'Faixas por cargo, com vigência e histórico.', cap: 'cargos:ver_faixas' },
      { to: '/cargos/governanca', label: 'Governança de cargos', icon: 'ShieldCheck', desc: 'Aprovações, versões e duplicidades.', cap: ['cargos:gerenciar', 'cargos:aprovar'] },
    ],
  },
  {
    title: 'Gestão de talentos', area: 'rh',
    items: [
      { to: '/rh/pessoas', label: 'Pessoas & contratos', icon: 'Users', desc: 'Cadastro, contratos, registros e encerramentos.', cap: 'pessoas:gerenciar' },
      { to: '/rh/estrutura', label: 'Departamentos & cargos', icon: 'Building2', desc: 'Departamentos, líderes, cargos, unidades e organograma.', cap: 'estrutura:gerenciar' },
      { to: '/rh/funcoes', label: 'Engenharia de funções', icon: 'Briefcase', desc: 'Funções, atividades, faixas de valor e perfil ideal.', cap: 'estrutura:gerenciar' },
      { to: '/rh/registros', label: 'Registros', icon: 'NotebookPen', desc: 'Registros administrativos e análise.', cap: 'pessoas:gerenciar' },
      { to: '/rh/jornadas', label: 'Integração & encerramento', icon: 'ListChecks', desc: 'Checklists e acompanhamento por pessoa.', cap: 'onboarding:gerenciar' },
      { to: '/rh/documentos', label: 'Documentos', icon: 'FolderLock', desc: 'Documentos, validades e pendências.', cap: 'documentos:gerenciar' },
      { to: '/rh/exigencias', label: 'Exigências & certificações', icon: 'ShieldPlus', desc: 'Certificações, exames exigidos por clientes e validades.', cap: 'documentos:gerenciar' },
    ],
  },
  {
    title: 'Desenvolvimento & performance', area: 'rh',
    items: [
      { to: '/rh/competencias', label: 'Competências', icon: 'Layers', desc: 'Grupos de competências e pesos por função.', cap: 'desenvolvimento:gerenciar' },
      { to: '/rh/avaliacoes', label: 'Ciclos de avaliação', icon: 'ClipboardCheck', desc: 'Ciclos 90°, 180°, 360° e relatórios.', cap: 'desenvolvimento:gerenciar' },
      { to: '/rh/inicio-parceria', label: 'Início de parceria', icon: 'Sprout', desc: 'Avaliações nos primeiros 30, 60 e 90 dias.', cap: 'desenvolvimento:gerenciar' },
      { to: '/rh/metas', label: 'Metas', icon: 'Target', desc: 'Metas e objetivos das áreas.', cap: 'desenvolvimento:gerenciar' },
      { to: '/rh/analise-grupos', label: 'Análise de grupos', icon: 'GitCompare', desc: 'Compare grupos de pessoas definidos pelo RH.', cap: 'desenvolvimento:gerenciar' },
      { to: '/rh/busca-perfil', label: 'Busca de perfil', icon: 'ScanSearch', desc: 'Aderência de perfis comportamentais (com consentimento).', cap: 'perfis:consultar' },
    ],
  },
  {
    title: 'Engajamento & benefícios', area: 'rh',
    items: [
      { to: '/rh/beneficios', label: 'Benefícios', icon: 'HeartHandshake', desc: 'Cadastro de benefícios, beneficiários e dependentes.', cap: 'beneficios:gerenciar' },
      { to: '/rh/pesquisas', label: 'Gestão de pesquisas', icon: 'ClipboardList', desc: 'Criação e resultados agregados.', cap: 'pesquisas:gerenciar' },
      { to: '/rh/gamificacao', label: 'Gestão da gamificação', icon: 'SlidersHorizontal', desc: 'Regras, desafios, conquistas e histórico.', cap: 'gamificacao:configurar' },
      { to: '/rh/cultura', label: 'Cultura organizacional', icon: 'Sparkle', desc: 'Propósito, missão, visão e valores.', cap: 'estrutura:gerenciar' },
    ],
  },
  {
    title: 'Relatórios', area: 'rh',
    items: [
      { to: '/rh/metricas', label: 'Métricas de pessoas', icon: 'PieChart', desc: 'Perfil da comunidade e da organização.', cap: 'rh:painel' },
      { to: '/rh/rotatividade', label: 'Rotatividade', icon: 'RefreshCw', desc: 'Entradas, encerramentos e taxa por período.', cap: 'rh:painel' },
      { to: '/rh/encerramentos', label: 'Métricas de encerramento', icon: 'UserMinus', desc: 'Motivos, áreas e duração das parcerias encerradas.', cap: 'rh:painel' },
      { to: '/rh/faturamento', label: 'Faturamento', icon: 'Landmark', desc: 'Notas fiscais e reembolsos por competência.', cap: 'financeiro:gerenciar' },
      { to: '/rh/disponibilidade', label: 'Agenda de disponibilidade', icon: 'CalendarRange', desc: 'Visão geral e política de disponibilidade.', cap: 'disponibilidade:configurar' },
    ],
  },
  {
    title: 'Configurações', area: 'admin',
    items: [
      { to: '/admin', label: 'Usuários & acessos', icon: 'ShieldCheck', desc: 'Papéis, permissões e dados de demonstração.', cap: 'admin:usuarios' },
      { to: '/admin/funcoes', label: 'Funções adicionais', icon: 'UserCheck', desc: 'Recrutadores, analistas de RH e responsáveis por pesquisas.', cap: 'admin:usuarios' },
      { to: '/admin/configuracoes', label: 'Configurações gerais', icon: 'Settings2', desc: 'Empresa, tomador das notas e contatos.', cap: 'config:geral' },
      { to: '/seguranca', label: 'Privacidade & auditoria', icon: 'ScrollText', desc: 'Histórico de ações e direitos do titular (LGPD).', cap: 'admin:auditoria' },
    ],
  },
]

/** Rotas fora do menu. */
export const EXTRAS: NavItem[] = [
  { to: '/notificacoes', label: 'Notificações', icon: 'Bell', desc: 'Tudo o que aconteceu recentemente.' },
  // Entrevistador(a) designado(a) sem acesso ao ATS chega aqui pela notificação; o servidor mostra só as entrevistas de que participa.
  { to: '/recrutamento/entrevistas', label: 'Entrevistas', icon: 'CalendarClock', desc: '', oculto: true },
  // Ficha do contrato: o servidor limita ao que cada pessoa pode ver (prestador, gestor do contrato, financeiro).
  { to: '/financeiro/contratos/:id', label: 'Contrato', icon: 'FileSignature', desc: '', oculto: true, soApi: true },
  { to: '/financeiro/contratos/novo', label: 'Novo contrato', icon: 'FileSignature', desc: '', cap: 'fin:cadastrar', oculto: true, soApi: true },
  { to: '/financeiro/contratos/:id/editar', label: 'Editar contrato', icon: 'FileSignature', desc: '', cap: 'fin:cadastrar', oculto: true, soApi: true },
  { to: '/financeiro/fornecedores/:id', label: 'Fornecedor', icon: 'Building2', desc: '', cap: 'fin:ver', oculto: true, soApi: true },
  // Resultados de pesquisa: quem só lê resultados (diretoria, analista de RH) não passa pela guarda do painel.
  { to: '/pesquisas-rh/:id/resultados', label: 'Resultados da pesquisa', icon: 'ClipboardList', desc: '', cap: ['pesq:gerenciar', 'pesq:resultados'], oculto: true },
]

export function grupoDaRota(pathname: string, papel?: Papel): NavGroup | undefined {
  const it = itemDaRota(pathname, papel)
  return it ? NAV.find((g) => g.items.includes(it)) : undefined
}

export function flatNav(): NavItem[] {
  return [...NAV.flatMap((g) => g.items), ...EXTRAS]
}

/** Quantos segmentos de `to` casam com o início do caminho (`:x` casa qualquer um); -1 se não casar. */
function especificidade(to: string, pathname: string): number {
  if (to === '/') return pathname === '/' ? 0 : -1
  const a = to.split('/').filter(Boolean), b = pathname.split('/').filter(Boolean)
  if (a.length > b.length) return -1
  return a.every((s, i) => s.startsWith(':') || s === b[i]) ? a.length : -1
}

/** Itens igualmente mais específicos para um caminho (ex.: /rh/pessoas/123 → /rh/pessoas). Pode haver mais de um com o mesmo `to`. */
function itensDaRota(pathname: string): NavItem[] {
  let melhor = -1
  let itens: NavItem[] = []
  for (const i of flatNav()) {
    const e = especificidade(i.to, pathname)
    if (e > melhor) { melhor = e; itens = [i] } else if (e === melhor && e >= 0) itens.push(i)
  }
  return melhor < 0 ? [] : itens
}

/** Com `papel`, prefere o último item que a pessoa vê (o mesmo que o menu mostra quando a rota se repete). */
export function itemDaRota(pathname: string, papel?: Papel): NavItem | undefined {
  const itens = itensDaRota(pathname)
  return (papel && [...itens].reverse().find((i) => permitido(papel, i))) || itens[0]
}

/** Para cada caminho repetido no menu, o último item visível ao papel (os anteriores ficam ocultos). */
export function ultimosVisiveis(papel: Papel): Map<string, NavItem> {
  const m = new Map<string, NavItem>()
  for (const i of NAV.flatMap((g) => g.items)) if (permitido(papel, i)) m.set(i.to, i)
  return m
}

/** Guarda de rota: libera se qualquer item equivalente permitir (ex.: /recrutamento/vagas existe para liderança e para o RH). */
export function podeAbrir(papel: Papel, pathname: string): boolean {
  const itens = itensDaRota(pathname)
  return !itens.length || itens.some((i) => permitido(papel, i))
}
