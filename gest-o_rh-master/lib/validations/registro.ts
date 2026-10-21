import { z } from "zod";

export const CLASSIFICACAO_OPTIONS = [
  { value: "positivo", label: "Positivo" },
  { value: "negativo", label: "Negativo" },
  { value: "neutro", label: "Neutro" },
] as const;

export const registroSchema = z.object({
  colaborador_id: z.uuid("Selecione o colaborador."),
  data_registro: z.string().min(1, "Informe a data."),
  tipo_registro_id: z.uuid("Selecione o tipo de registro."),
  classificacao: z.enum(["positivo", "negativo", "neutro"]),
  valor_qtd_horas: z.coerce.number().nonnegative().optional(),
  descricao: z.string().trim().min(3, "Descreva o registro."),
});

export type RegistroInput = z.infer<typeof registroSchema>;
