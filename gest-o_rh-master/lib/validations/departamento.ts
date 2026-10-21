import { z } from "zod";

export const departamentoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do departamento."),
  descricao: z.string().trim().optional(),
  localizacao: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  fax: z.string().trim().optional(),
  ramal: z.string().trim().optional(),
  email: z.string().trim().optional(),
  orcamento_mensal: z.coerce.number().nonnegative().optional(),
  unidade_id: z.uuid("Selecione a unidade."),
  gestores_ids: z.array(z.uuid()).optional(),
});

export type DepartamentoInput = z.infer<typeof departamentoSchema>;
