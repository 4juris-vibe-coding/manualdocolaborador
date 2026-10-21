import { z } from "zod";

export const CATEGORIA_9BOX_OPTIONS = [
  { value: "nenhuma", label: "Não considerar este grupo no relatório 9 box" },
  { value: "comportamento", label: "Comportamento" },
  { value: "desempenho", label: "Desempenho" },
] as const;

/** Rótulo curto, pra caber na coluna da tabela (o rótulo completo da
 * primeira opção é a instrução do formulário, não cabe numa célula). */
export const CATEGORIA_9BOX_LABEL_CURTO: Record<string, string> = {
  nenhuma: "—",
  comportamento: "Comportamento",
  desempenho: "Desempenho",
};

export const grupoCompetenciaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do grupo."),
  categoria_9box: z.enum(["nenhuma", "comportamento", "desempenho"]),
});

export type GrupoCompetenciaInput = z.infer<typeof grupoCompetenciaSchema>;
