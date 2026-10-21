import { z } from "zod";

export const STATUS_RESPOSTA_AVALIACAO_OPTIONS = [
  { value: "todas", label: "Todas" },
  { value: "pendente", label: "Pendente" },
  { value: "respondida", label: "Respondida" },
] as const;

export const NIVEL_RELATORIO_PARTICIPACAO_OPTIONS = [
  { value: "unidade", label: "Unidade" },
  { value: "departamento", label: "Departamento" },
  { value: "superior_direto", label: "Superior direto" },
  { value: "avaliador", label: "Avaliador" },
] as const;

export type NivelRelatorioParticipacao =
  (typeof NIVEL_RELATORIO_PARTICIPACAO_OPTIONS)[number]["value"];

// --- Solicitar Avaliação (assistente de 4 etapas) ---------------------

export const cicloEtapa1Schema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da avaliação."),
  descricao: z.string().trim().optional(),
  data_abertura: z.string().min(1, "Informe a data de abertura."),
  data_encerramento: z.string().min(1, "Informe a data de encerramento."),
});

export const NIVEIS_ESCALA_OPTIONS = [
  { value: "5", label: "5 estrelas" },
  { value: "4", label: "4 estrelas" },
] as const;

/** Presets de rótulo pra cada nível da escala de notas — "nossas
 * sugestões" no Sólides. A pré-visualização usa os rótulos na ordem
 * (1 estrela primeiro). */
export const ROTULO_ESCALA_OPTIONS = [
  {
    value: "concordancia",
    label: "Concordância: (Discordo fortemente ... Concordo fortemente)",
    rotulos5: [
      "Discordo fortemente",
      "Discordo",
      "Concordo parcialmente",
      "Concordo",
      "Concordo fortemente",
    ],
    rotulos4: ["Discordo fortemente", "Discordo", "Concordo", "Concordo fortemente"],
  },
  {
    value: "desempenho",
    label: "Desempenho: (Insatisfatório ... Excepcional)",
    rotulos5: [
      "Insatisfatório",
      "Abaixo do esperado",
      "Dentro do esperado",
      "Acima do esperado",
      "Excepcional",
    ],
    rotulos4: ["Insatisfatório", "Dentro do esperado", "Acima do esperado", "Excepcional"],
  },
  {
    value: "frequencia",
    label: "Frequência: (Nunca ... Sempre)",
    rotulos5: ["Nunca", "Raramente", "Às vezes", "Frequentemente", "Sempre"],
    rotulos4: ["Nunca", "Às vezes", "Frequentemente", "Sempre"],
  },
] as const;

export const cicloEtapa2Schema = z.object({
  niveis_escala: z.coerce.number().int().refine((v) => v === 4 || v === 5, {
    message: "Selecione a quantidade de níveis de escala.",
  }),
  rotulo_escala: z.string().trim().optional(),
  comentario_competencia_mostrar: z.coerce.boolean().default(false),
  comentario_competencia_obrigatorio: z.coerce.boolean().default(false),
  comentario_geral_obrigatorio: z.coerce.boolean().default(false),
});

export const TIPO_RELACAO_OPTIONS = [
  {
    value: "direta_90",
    label: "Avaliação direta ou 90°",
    descricao: "Líder avalia liderado",
  },
  {
    value: "conjunta_180",
    label: "Avaliação conjunta ou 180°",
    descricao: "Líder avalia liderado, liderado avalia líder.",
  },
  {
    value: "trezentos_sessenta",
    label: "Avaliação 360°",
    descricao: "Líder avalia liderado, liderado avalia líder, pares se avaliam.",
  },
  {
    value: "customizada",
    label: "Avaliação customizada",
    descricao: "Defina livremente quem serão os avaliadores e avaliados.",
  },
] as const;

export const NIVEL_ESTRUTURA_OPTIONS = [
  { value: "unidade", label: "Unidade" },
  { value: "departamento", label: "Departamento" },
  { value: "cargo", label: "Cargo" },
] as const;

export const cicloEtapa3Schema = z.object({
  tipo_relacao: z.enum(["direta_90", "conjunta_180", "trezentos_sessenta", "customizada"]),
  autoavaliacao: z.coerce.boolean().default(false),
  admitidos_ate: z.string().trim().optional(),
  tipos_contrato: z.array(z.enum(["clt", "pj", "estagio", "temporario", "aprendiz"])).optional(),
  nivel_estrutura: z.enum(["unidade", "departamento", "cargo"]).optional(),
  opcao_estrutura_id: z.uuid().optional(),
});

export type CicloEtapa1Input = z.infer<typeof cicloEtapa1Schema>;
export type CicloEtapa2Input = z.infer<typeof cicloEtapa2Schema>;
export type CicloEtapa3Input = z.infer<typeof cicloEtapa3Schema>;
