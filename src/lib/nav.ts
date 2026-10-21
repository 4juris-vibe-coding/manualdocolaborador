/* ============================================================
   4JURIS Pessoas · Navegação (uma plataforma, três áreas)
   - Área pessoal: todo participante.
   - Liderança: coordenação das próprias áreas.
   - RH e Administração: ferramentas administrativas.
   O acesso de cada item vem da matriz em src/domain/permissions.ts.
   ============================================================ */
import type { Capacidade } from '@/domain/permissions'

export interface NavItem {
  to: string
  label: string
  icon: string // nome do ícone lucide
  desc: string
  cap?: Capacidade // se ausente, todos veem
}
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
      { to: '/rh/feedbacks', label: 'Feedbacks', icon: 'MessageSquareText', desc: 'Feedbacks de alinhamento sobre as entregas.', cap: 'feedbacks:registrar' },
      { to: '/recrutamento/vagas', label: 'Vagas da minha área', icon: 'BadgePlus', desc: 'Solicite vagas e acompanhe aprovações e candidatos.', cap: 'vagas:solicitar' },
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
    title: 'Recrutamento', area: 'rh',
    items: [
      { to: '/recrutamento', label: 'Painel de vagas', icon: 'LayoutDashboard', desc: 'Visão executiva e operacional do recrutamento.', cap: 'vagas:gerenciar' },
      { to: '/recrutamento/vagas', label: 'Vagas', icon: 'BriefcaseBusiness', desc: 'Criação, aprovação, publicação e encerramento de vagas.', cap: 'vagas:gerenciar' },
      { to: '/recrutamento/candidatos', label: 'Candidatos (ATS)', icon: 'KanbanSquare', desc: 'Pipeline seletivo, perfis e avaliações.', cap: 'ats:ver' },
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
      { to: '/pesquisas-rh/lista', label: 'Pesquisas', icon: 'ClipboardList', desc: 'Criar, distribuir e acompanhar pesquisas.', cap: 'pesq:gerenciar' },
      { to: '/pesquisas-rh/modelos', label: 'Biblioteca de modelos', icon: 'LibraryBig', desc: 'eNPS, clima, liderança, onboarding e mais.', cap: 'pesq:gerenciar' },
    ],
  },
  {
    title: 'Arquitetura de cargos', area: 'rh',
    items: [
      { to: '/cargos', label: 'Catálogo de cargos', icon: 'Layers3', desc: 'Fichas oficiais, famílias, trilhas e níveis.', cap: 'cargos:ver' },
      { to: '/cargos/matriz', label: 'Matriz de competências', icon: 'Grid3x3', desc: 'Competências esperadas por cargo e nível.', cap: 'cargos:ver' },
      { to: '/cargos/faixas', label: 'Faixas salariais', icon: 'Coins', desc: 'Faixas por cargo, com vigência e histórico.', cap: 'cargos:ver_faixas' },
      { to: '/cargos/governanca', label: 'Governança de cargos', icon: 'ShieldCheck', desc: 'Aprovações, versões e duplicidades.', cap: 'cargos:gerenciar' },
    ],
  },
  {
    title: 'Gestão de talentos', area: 'rh',
    items: [
      { to: '/rh/pessoas', label: 'Pessoas & contratos', icon: 'Users', desc: 'Cadastro, contratos, registros e encerramentos.', cap: 'pessoas:gerenciar' },
      { to: '/rh/estrutura', label: 'Áreas & unidades', icon: 'Building2', desc: 'Áreas, lideranças, unidades e listas.', cap: 'estrutura:gerenciar' },
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
]

export function grupoDaRota(pathname: string): NavGroup | undefined {
  const it = itemDaRota(pathname)
  return it ? NAV.find((g) => g.items.includes(it)) : undefined
}

export function flatNav(): NavItem[] {
  return [...NAV.flatMap((g) => g.items), ...EXTRAS]
}

/** Item de navegação mais específico para um caminho (ex.: /rh/pessoas/123 → /rh/pessoas). */
export function itemDaRota(pathname: string): NavItem | undefined {
  return flatNav()
    .filter((i) => i.to === pathname || (i.to !== '/' && pathname.startsWith(i.to + '/')))
    .sort((a, b) => b.to.length - a.to.length)[0]
}
