import { z } from "zod";

export const TIPO_BENEFICIO_OPTIONS = [
  { value: "vale_refeicao", label: "Vale Refeição" },
  { value: "vale_alimentacao", label: "Vale Alimentação" },
  { value: "vale_transporte", label: "Vale Transporte" },
  { value: "plano_saude", label: "Plano de Saúde" },
  { value: "plano_odontologico", label: "Plano Odontológico" },
  { value: "seguro_vida", label: "Seguro de Vida" },
  { value: "auxilio_creche", label: "Auxílio Creche" },
  { value: "auxilio_educacao", label: "Auxílio Educação" },
  { value: "gympass", label: "Gympass / Bem-estar" },
  { value: "plr", label: "PLR (Participação nos Lucros)" },
  { value: "outro", label: "Outro" },
] as const;

export const APLICADO_COMO_OPTIONS = [
  { value: "reais", label: "Em Reais" },
  { value: "percentual_salario", label: "Percentual do Salário" },
] as const;

export const PERIODICIDADE_BENEFICIO_OPTIONS = [
  { value: "diario", label: "Diário" },
  { value: "semanal", label: "Semanal" },
  { value: "quinzenal", label: "Quinzenal" },
  { value: "mensal", label: "Mensal" },
  { value: "anual", label: "Anual" },
] as const;

export const OPCAO_DESCONTO_OPTIONS = [
  { value: "percentual_salario", label: "Percentual do Salário" },
  { value: "valor_fixo", label: "Valor Fixo" },
] as const;

export const beneficioSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do benefício."),
  tipo: z.enum([
    "vale_refeicao",
    "vale_alimentacao",
    "vale_transporte",
    "plano_saude",
    "plano_odontologico",
    "seguro_vida",
    "auxilio_creche",
    "auxilio_educacao",
    "gympass",
    "plr",
    "outro",
  ]),
  valor_beneficio: z.coerce.number().min(0, "Informe o valor do benefício."),
  aplicado_como: z.enum(["reais", "percentual_salario"]),
  periodicidade: z.enum(["diario", "semanal", "quinzenal", "mensal", "anual"]),
  valor_descontado: z.coerce.number().min(0).optional(),
  opcao_desconto: z.enum(["percentual_salario", "valor_fixo"]).optional(),
});

export type BeneficioInput = z.infer<typeof beneficioSchema>;
