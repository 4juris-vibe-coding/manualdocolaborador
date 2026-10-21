import { z } from "zod";

export const CLASSIFICACAO_FEEDBACK_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "para_melhorar", label: "Para melhorar" },
  { value: "neutro", label: "Neutro" },
] as const;

export const feedbackSchema = z.object({
  colaborador_id: z.uuid("Selecione o colaborador."),
  data_feedback: z.string().min(1, "Informe a data."),
  classificacao: z.enum(["positivo", "para_melhorar", "neutro"]),
  comentario: z.string().trim().min(3, "Escreva o feedback."),
});

export type FeedbackInput = z.infer<typeof feedbackSchema>;
