import { z } from "zod";
import { isValidCPF } from "@/lib/cpf";
import { isValidCNPJ } from "@/lib/cnpj";
import { TIPO_CONTRATO_OPTIONS } from "@/lib/validations/colaborador";

const TIPO_CONTRATO_POR_LABEL = new Map(
  TIPO_CONTRATO_OPTIONS.map((o) => [o.label.toLowerCase(), o.value]),
);
const TIPOS_CONTRATO_VALIDOS = TIPO_CONTRATO_OPTIONS.map((o) => o.value);

export const COLUNAS_IMPORTACAO = [
  "Nome completo",
  "E-mail",
  "CPF",
  "Telefone",
  "Cargo",
  "Departamento",
  "Data de admissão",
  "Tipo de contrato",
  "CNPJ",
] as const;

export const linhaImportacaoSchema = z
  .object({
    "Nome completo": z.string().trim().min(2, "Nome inválido."),
    "E-mail": z.email("E-mail inválido."),
    CPF: z
      .string()
      .transform((valor) => valor.replace(/\D/g, ""))
      .pipe(
        z
          .string()
          .length(11, "CPF deve ter 11 dígitos.")
          .refine(isValidCPF, "CPF inválido."),
      ),
    Telefone: z.string().optional(),
    Cargo: z.string().trim().min(1, "Informe o cargo."),
    Departamento: z.string().trim().min(1, "Informe o departamento."),
    "Data de admissão": z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use o formato AAAA-MM-DD."),
    // Opcional — em branco vira CLT (comportamento anterior à importação
    // ganhar esta coluna). Aceita tanto o rótulo (CLT, PJ, Estágio...)
    // quanto o valor bruto do enum (clt, pj, estagio...).
    "Tipo de contrato": z
      .string()
      .optional()
      .transform((valor) => {
        if (!valor || !valor.trim()) return "clt";
        const chave = valor.trim().toLowerCase();
        return TIPO_CONTRATO_POR_LABEL.get(chave) ?? chave;
      })
      .refine(
        (valor): valor is (typeof TIPOS_CONTRATO_VALIDOS)[number] =>
          (TIPOS_CONTRATO_VALIDOS as string[]).includes(valor),
        "Tipo de contrato inválido — use CLT, PJ, Estágio, Temporário ou Aprendiz.",
      ),
    // Obrigatório só quando "Tipo de contrato" é PJ (ver superRefine abaixo).
    CNPJ: z
      .string()
      .optional()
      .transform((valor) => (valor ? valor.replace(/\D/g, "") : undefined)),
  })
  .superRefine((data, ctx) => {
    if (data["Tipo de contrato"] !== "pj") return;
    if (!data.CNPJ || !isValidCNPJ(data.CNPJ)) {
      ctx.addIssue({
        code: "custom",
        path: ["CNPJ"],
        message: "CNPJ inválido — obrigatório para colaborador PJ.",
      });
    }
  });
