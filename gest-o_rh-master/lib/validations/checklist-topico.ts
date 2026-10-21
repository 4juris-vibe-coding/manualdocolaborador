import { z } from "zod";

export const TIPO_CHECKLIST_OPTIONS = [
  { value: "admissao", label: "Contratação" },
  { value: "demissao", label: "Demissão" },
] as const;

export const checklistTopicoSchema = z.object({
  descricao: z.string().trim().min(2, "Informe a descrição."),
  tipo: z.enum(["admissao", "demissao"]),
});

export type ChecklistTopicoInput = z.infer<typeof checklistTopicoSchema>;
