import { z } from "zod";

export const TIPO_EXAME_OPTIONS = [
  { value: "admissional", label: "Admissional" },
  { value: "periodico", label: "Periódico" },
  { value: "retorno_trabalho", label: "Retorno ao trabalho" },
  { value: "mudanca_funcao", label: "Mudança de função" },
  { value: "demissional", label: "Demissional" },
] as const;

export const RESULTADO_EXAME_OPTIONS = [
  { value: "apto", label: "Apto" },
  { value: "apto_com_restricoes", label: "Apto com restrições" },
  { value: "inapto", label: "Inapto" },
] as const;

export const exameSchema = z.object({
  tipo_exame: z.enum([
    "admissional",
    "periodico",
    "retorno_trabalho",
    "mudanca_funcao",
    "demissional",
  ]),
  data_exame: z.string().min(1, "Informe a data do exame."),
  data_validade: z.string().optional(),
  resultado: z.enum(["apto", "apto_com_restricoes", "inapto"]),
  medico_nome: z.string().trim().optional(),
  medico_crm: z.string().trim().optional(),
  observacoes: z.string().trim().optional(),
  documento_id: z.uuid().optional(),
});
