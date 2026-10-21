import { z } from "zod";

export const unidadeSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da unidade."),
  endereco: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
});

export type UnidadeInput = z.infer<typeof unidadeSchema>;
