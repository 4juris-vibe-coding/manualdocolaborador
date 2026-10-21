import { z } from "zod";

export const metaSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome da meta."),
  codigo: z.string().trim().optional(),
  descricao: z.string().trim().min(2, "Informe a descrição da meta."),
  valor_meta: z.coerce.number().min(0, "Informe o valor da meta."),
  // Vem do <input type="month"> como "AAAA-MM" — completa com o dia 1.
  mes_ano: z
    .string()
    .regex(/^\d{4}-\d{2}$/, "Informe o mês/ano da meta.")
    .transform((valor) => `${valor}-01`),
});

export type MetaInput = z.infer<typeof metaSchema>;
