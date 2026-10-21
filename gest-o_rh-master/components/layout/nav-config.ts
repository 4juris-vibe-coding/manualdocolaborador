import type { LucideIcon } from "lucide-react";
import { BarChart3, Rocket, Wallet, ShieldPlus, Settings, RefreshCw } from "lucide-react";

export type NavChild = {
  title: string;
  /** Sem filhos, precisa de href (é um link folha). Com filhos, vira um
   * sub-grupo que expande/recolhe dentro do grupo — não tem href próprio
   * (igual ao NavItem de nível 1, só que aninhado mais uma vez). */
  href?: string;
  adminOnly?: boolean;
  children?: NavChild[];
};

export type NavItem = {
  title: string;
  icon: LucideIcon;
  /** Item sem filhos vira link direto; com filhos vira um grupo que
   * expande/recolhe (igual ao menu de referência). */
  href?: string;
  children?: NavChild[];
  /** Se true, o grupo inteiro só aparece no menu para admin_rh. */
  adminOnly?: boolean;
  /** Selo "NOVO" ao lado do título, para funcionalidades recentes. */
  badge?: string;
};

export const DASHBOARD_ITEM: { title: string; href: string } = {
  title: "Início",
  href: "/dashboard",
};

// Ordem e agrupamento seguem o menu real do Sólides (ver Print/menu.png e
// prints de 19/08): Cargos e Salários vem antes de Gestão de Talentos, e
// "Motivo de Demissões" mora dentro de Gestão de Talentos — não em
// Configurações. Os grupos que no Sólides são só vitrine de venda (Sólides
// Profiler, Sólides Benefícios, Marketplace) ficam de fora: é o combinado
// de não replicar nada de marketplace/upsell no sistema interno.
// "Desenv. e Performance" entrou (30/08) e "Reten. e Engajamento" entrou
// (31/08): ambos têm funcionalidade real de RH, não são só vitrine.
export const NAV_ITEMS: NavItem[] = [
  {
    title: "Cargos e Salários",
    icon: Wallet,
    children: [
      { title: "Engenharia de Cargo", href: "/cargos" },
      { title: "Busca de Perfil", href: "/cargos/busca-perfil" },
    ],
  },
  {
    title: "Gestão de Talentos",
    icon: BarChart3,
    children: [
      { title: "Colaboradores", href: "/colaboradores" },
      { title: "Departamentos", href: "/departamentos" },
      { title: "Registros", href: "/registros" },
      { title: "Feedbacks", href: "/feedbacks" },
      { title: "Checklists", href: "/checklists" },
      { title: "Aniversariantes", href: "/aniversariantes" },
      { title: "Motivos de Demissão", href: "/motivos-demissao", adminOnly: true },
      { title: "Unidades", href: "/unidades" },
      { title: "Métricas do Colaborador", href: "/metricas-colaborador" },
      { title: "Rotatividade", href: "/rotatividade", adminOnly: true },
    ],
  },
  {
    title: "Desenv. e Performance",
    icon: Rocket,
    children: [
      {
        title: "Competências",
        children: [
          { title: "Grupos de competências", href: "/competencias/grupos" },
          { title: "Competências", href: "/competencias" },
        ],
      },
      {
        title: "Avaliação Desemp.",
        children: [
          { title: "Dashboard", href: "/avaliacao-desempenho" },
          { title: "Solicitar Avaliação", href: "/avaliacao-desempenho/solicitar" },
          {
            title: "Relatórios Individuais",
            href: "/avaliacao-desempenho/relatorios-individuais",
          },
          { title: "Relatório Geral", href: "/avaliacao-desempenho/relatorio-geral" },
        ],
      },
      {
        title: "Avaliação de Experiência",
        children: [
          { title: "Configurar Avaliação", href: "/avaliacao-experiencia/configurar" },
          { title: "Acompanhar Avaliações", href: "/avaliacao-experiencia/acompanhar" },
          {
            title: "Rel. Geral e Participação",
            href: "/avaliacao-experiencia/relatorio-participacao",
          },
        ],
      },
      {
        title: "Gestão de Metas",
        children: [{ title: "Cadastro de Metas", href: "/metas/cadastro" }],
      },
      { title: "Análise de Performance", href: "/analise-performance" },
    ],
  },
  {
    title: "Reten. e Engajamento",
    icon: RefreshCw,
    children: [
      { title: "Pesquisas", href: "/pesquisas" },
      {
        title: "Gestão de Benefícios",
        children: [
          { title: "Cadastro de Benefícios", href: "/beneficios/cadastro-beneficios" },
          { title: "Beneficiários", href: "/beneficios/beneficiarios" },
        ],
      },
      { title: "Cultura Organizacional", href: "/cultura-organizacional" },
      { title: "Faturamentos", href: "/faturamentos" },
      { title: "Métricas de Desligamento", href: "/metricas-desligamento" },
    ],
  },
  {
    title: "Saúde Ocupacional",
    icon: ShieldPlus,
    href: "/saude-ocupacional",
    badge: "NOVO!",
  },
  {
    title: "Configurações",
    icon: Settings,
    adminOnly: true,
    children: [
      { title: "Geral", href: "/configuracoes" },
      { title: "Usuários do sistema", href: "/configuracoes/usuarios" },
      { title: "Tipos de Registro", href: "/configuracoes/tipos-registro" },
    ],
  },
];

/** Rótulo de cada segmento de rota, usado para montar o breadcrumb. */
export const ROUTE_LABELS: Record<string, string> = {
  dashboard: "Início",
  colaboradores: "Colaboradores",
  departamentos: "Departamentos",
  cargos: "Cargos",
  "busca-perfil": "Busca de Perfil",
  unidades: "Unidades",
  registros: "Registros",
  feedbacks: "Feedbacks",
  analise: "Análise",
  "metricas-colaborador": "Métricas de Colaborador",
  export: "Exportar",
  checklists: "Checklists",
  "saude-ocupacional": "Saúde Ocupacional",
  aniversariantes: "Aniversariantes",
  rotatividade: "Rotatividade",
  configuracoes: "Configurações",
  usuarios: "Usuários do sistema",
  "motivos-demissao": "Motivos de Demissão",
  "tipos-registro": "Tipos de Registro",
  novo: "Novo",
  nova: "Nova",
  editar: "Editar",
  importar: "Importar",
  competencias: "Competências",
  grupos: "Grupos de competências",
  "avaliacao-desempenho": "Avaliação Desemp.",
  solicitar: "Solicitar Avaliação",
  "relatorios-individuais": "Relatórios Individuais",
  "relatorio-geral": "Relatório Geral",
  "avaliacao-experiencia": "Avaliação de Experiência",
  configurar: "Configurar Avaliação",
  acompanhar: "Acompanhar Avaliações",
  "relatorio-participacao": "Rel. Geral e Participação",
  metas: "Gestão de Metas",
  cadastro: "Cadastro de Metas",
  "analise-performance": "Análise de Performance",
  pesquisas: "Pesquisas",
  beneficios: "Gestão de Benefícios",
  "cadastro-beneficios": "Cadastro de Benefícios",
  beneficiarios: "Beneficiários",
  "cultura-organizacional": "Cultura Organizacional",
  faturamentos: "Faturamentos",
  "metricas-desligamento": "Métricas de Desligamento",
};
