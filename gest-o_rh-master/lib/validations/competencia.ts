import { z } from "zod";

export const TIPO_AVALIACAO_OPTIONS = [
  { value: "desempenho", label: "Desempenho" },
  { value: "periodo_experiencia", label: "Período de experiência" },
] as const;

export const competenciaSchema = z.object({
  tipo_avaliacao: z.enum(["desempenho", "periodo_experiencia"]),
  grupo_id: z.uuid("Selecione o grupo de competências."),
  nome: z.string().trim().min(2, "Informe o nome da competência."),
  descricao: z.string().trim().optional(),
  peso: z.coerce.number().int().min(1).max(100).optional().default(1),
  cargo_ids: z.array(z.uuid()).min(1, "Selecione ao menos um cargo."),
});

export type CompetenciaInput = z.infer<typeof competenciaSchema>;
