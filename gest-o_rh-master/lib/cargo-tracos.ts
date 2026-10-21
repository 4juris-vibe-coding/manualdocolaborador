/**
 * Perfil comportamental ideal do cargo: 24 pares de traços opostos, cada
 * um com um valor de 0 a 100 indicando o quanto o perfil ideal pende pro
 * lado direito do par (0 = 100% do traço da esquerda, 100 = 100% do
 * traço da direita, 50 = neutro). Mesma lista e ordem do "Engenharia de
 * Cargo" do Sólides.
 */
export const TRACOS_COMPORTAMENTAIS = [
  { chave: "realista_otimista", esquerda: "Realista", direita: "Otimista" },
  {
    chave: "analise_comunicacao",
    esquerda: "Habilidade em análise",
    direita: "Habilidade em comunicação",
  },
  {
    chave: "introspectiva_social",
    esquerda: "Habilidade introspectiva",
    direita: "Habilidade social",
  },
  { chave: "sensivel_motivador", esquerda: "Sensível", direita: "Motivador" },
  {
    chave: "reservado_comunicador",
    esquerda: "Reservado",
    direita: "Comunicador e divulgador",
  },
  {
    chave: "detalhista_generalista",
    esquerda: "Atento a detalhes",
    direita: "Generalista",
  },
  {
    chave: "exatidao_entusiasmo",
    esquerda: "Busca exatidão em seu trabalho",
    direita: "Entusiasta",
  },
  {
    chave: "decisao_segura_rapida",
    esquerda: "Busca decisões mais seguras",
    direita: "Busca decisões mais rápidas",
  },
  {
    chave: "condescendente_dominante",
    esquerda: "Condescendente",
    direita: "Dominante",
  },
  {
    chave: "estruturado_multitarefa",
    esquerda: "Tem o trabalho estruturado",
    direita: "Executa várias coisas ao mesmo tempo",
  },
  {
    chave: "conhecido_novo",
    esquerda: "Gosta de trabalhar com o conhecido",
    direita: "Gosta de novos empreendimentos",
  },
  {
    chave: "regularidade_praticidade",
    esquerda: "Se preocupa com a regularidade",
    direita: "Se preocupa com a praticidade",
  },
  {
    chave: "consultivo_agressivo",
    esquerda: "Tem estilo consultivo",
    direita: "Tem o estilo agressivo",
  },
  { chave: "calmo_agitado", esquerda: "Calmo", direita: "Agitado" },
  {
    chave: "rotina_nao_rotina",
    esquerda: "Gosta de rotina",
    direita: "Não gosta de rotina",
  },
  { chave: "cauteloso_destemido", esquerda: "Cauteloso", direita: "Destemido" },
  {
    chave: "ambiente_calmo_agitado",
    esquerda: "Gosta de ambientes calmos",
    direita: "Gosta de ambientes agitados",
  },
  {
    chave: "concentrado_dinamico",
    esquerda: "Concentrado",
    direita: "Dinâmico",
  },
  {
    chave: "orientado_proatividade",
    esquerda: "Prefere ser orientado",
    direita: "Gosta de tomar a frente",
  },
  {
    chave: "evita_assume_riscos",
    esquerda: "Evita riscos",
    direita: "Assume riscos",
  },
  {
    chave: "introvertido_extrovertido",
    esquerda: "Introvertido",
    direita: "Extrovertido",
  },
  { chave: "formal_informal", esquerda: "Mais formal", direita: "Mais informal" },
  { chave: "critico_amigavel", esquerda: "É mais crítico", direita: "Amigável" },
  {
    chave: "trabalho_relacionamento",
    esquerda: "Se desenvolve via Trabalho",
    direita: "Se desenvolve via Relacionamentos",
  },
] as const;

export type TracoChave = (typeof TRACOS_COMPORTAMENTAIS)[number]["chave"];

/** Valor neutro (50/50) usado como default quando um cargo ainda não tem
 * esse traço configurado. */
export const VALOR_TRACO_PADRAO = 50;
