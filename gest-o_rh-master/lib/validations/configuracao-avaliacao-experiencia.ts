import { z } from "zod";

export const PERIODO_AVALIATIVO_EXPERIENCIA_OPTIONS = [
  { value: "90_dias", label: "90 dias" },
  { value: "45_e_90_dias", label: "45 e 90 dias" },
  { value: "30_60_e_90_dias", label: "30, 60 e 90 dias" },
] as const;

export const configuracaoAvaliacaoExperienciaSchema = z.object({
  habilitado: z.coerce.boolean().default(false),
  periodo_avaliativo: z.enum(["90_dias", "45_e_90_dias", "30_60_e_90_dias"]),
  tipos_contrato: z.array(z.enum(["clt", "pj", "estagio", "temporario", "aprendiz"])),
  cargo_ids: z.array(z.uuid()),
});

export type ConfiguracaoAvaliacaoExperienciaInput = z.infer<
  typeof configuracaoAvaliacaoExperienciaSchema
>;
