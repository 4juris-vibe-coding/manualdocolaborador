import { z } from "zod";
import { isValidCPF } from "@/lib/cpf";
import { isValidCNPJ } from "@/lib/cnpj";

/** Tipos de contrato sem vínculo empregatício CLT — não têm CTPS, não
 * entram no regime legal de férias/período de experiência da CLT (PJ não
 * tem vínculo nenhum; estágio é regido pela Lei 11.788/2008, não pela
 * CLT). Temporário e aprendiz SÃO registrados em CTPS e têm direito a
 * férias — por isso ficam de fora desta lista. */
export const TIPOS_CONTRATO_SEM_VINCULO_CLT = ["pj", "estagio"] as const;

export function temRegimeClt(
  tipoContrato: string | null | undefined,
): boolean {
  if (!tipoContrato) return true;
  return !(
    TIPOS_CONTRATO_SEM_VINCULO_CLT as readonly string[]
  ).includes(tipoContrato);
}

export const GENERO_OPTIONS = [
  { value: "feminino", label: "Feminino" },
  { value: "masculino", label: "Masculino" },
  { value: "outro", label: "Outro" },
  { value: "prefiro_nao_informar", label: "Prefiro não informar" },
] as const;

export const SEXO_OPTIONS = [
  { value: "masculino", label: "Masculino" },
  { value: "feminino", label: "Feminino" },
] as const;

export const RACA_ETNIA_OPTIONS = [
  { value: "branca", label: "Branca" },
  { value: "preta", label: "Preta" },
  { value: "parda", label: "Parda" },
  { value: "amarela", label: "Amarela" },
  { value: "indigena", label: "Indígena" },
  { value: "nao_informado", label: "Prefiro não informar" },
] as const;

export const ESTADO_CIVIL_OPTIONS = [
  { value: "solteiro", label: "Solteiro(a)" },
  { value: "casado", label: "Casado(a)" },
  { value: "divorciado", label: "Divorciado(a)" },
  { value: "viuvo", label: "Viúvo(a)" },
  { value: "uniao_estavel", label: "União estável" },
] as const;

export const ESCOLARIDADE_OPTIONS = [
  { value: "fundamental_incompleto", label: "Fundamental incompleto" },
  { value: "fundamental_completo", label: "Fundamental completo" },
  { value: "medio_incompleto", label: "Médio incompleto" },
  { value: "medio_completo", label: "Médio completo" },
  { value: "superior_incompleto", label: "Superior incompleto" },
  { value: "superior_completo", label: "Superior completo" },
  { value: "pos_graduacao", label: "Pós-graduação" },
  { value: "mestrado", label: "Mestrado" },
  { value: "doutorado", label: "Doutorado" },
] as const;

export const TIPO_CONTRATO_OPTIONS = [
  { value: "clt", label: "CLT" },
  { value: "pj", label: "PJ" },
  { value: "estagio", label: "Estágio" },
  { value: "temporario", label: "Temporário" },
  { value: "aprendiz", label: "Aprendiz" },
] as const;

export const UF_OPTIONS = [
  "AC", "AL", "AP", "AM", "BA", "CE", "DF", "ES", "GO", "MA", "MT", "MS",
  "MG", "PA", "PB", "PR", "PE", "PI", "RJ", "RN", "RS", "RO", "RR", "SC",
  "SP", "SE", "TO",
] as const;

/** Os 3 graus de insalubridade previstos na NR-15 (Norma Regulamentadora
 * de Higiene do Trabalho), percentual sobre o salário mínimo. */
export const PERCENTUAL_INSALUBRIDADE_OPTIONS = [
  { value: "10", label: "10% (grau mínimo)" },
  { value: "20", label: "20% (grau médio)" },
  { value: "40", label: "40% (grau máximo)" },
] as const;

export const TAMANHO_CAMISA_OPTIONS = ["PP", "P", "M", "G", "GG", "XG"] as const;

/** Os 4 fusos horários oficiais do Brasil. */
export const FUSO_HORARIO_OPTIONS = [
  { value: "America/Noronha", label: "Fernando de Noronha (UTC-2)" },
  { value: "America/Sao_Paulo", label: "Brasília (UTC-3)" },
  { value: "America/Manaus", label: "Amazonas (UTC-4)" },
  { value: "America/Rio_Branco", label: "Acre (UTC-5)" },
] as const;

const camposOpcionais = {
  // Dados pessoais
  nome_social: z.string().trim().optional(),
  sexo: z.enum(["masculino", "feminino"]).optional(),
  saudacao: z.string().trim().optional(),
  raca_etnia: z
    .enum(["branca", "preta", "parda", "amarela", "indigena", "nao_informado"])
    .optional(),
  estado_civil: z
    .enum(["solteiro", "casado", "divorciado", "viuvo", "uniao_estavel"])
    .optional(),
  escolaridade: z
    .enum([
      "fundamental_incompleto",
      "fundamental_completo",
      "medio_incompleto",
      "medio_completo",
      "superior_incompleto",
      "superior_completo",
      "pos_graduacao",
      "mestrado",
      "doutorado",
    ])
    .optional(),
  curso: z.string().trim().optional(),
  pessoa_com_deficiencia: z.coerce.boolean().optional(),
  tipo_deficiencia: z.string().trim().optional(),
  nacionalidade: z.string().trim().optional(),
  naturalidade: z.string().trim().optional(),
  nome_pai: z.string().trim().optional(),
  nome_mae: z.string().trim().optional(),

  // Endereço
  endereco_pais: z.string().trim().optional(),

  // Contatos
  celular: z.string().trim().optional(),
  telefone_emergencia: z.string().trim().optional(),
  email_pessoal: z.string().trim().optional(),
  email_corporativo: z.string().trim().optional(),

  // Dados contratuais
  turno: z.string().trim().optional(),
  periodo_experiencia_dias: z.coerce.number().int().positive().optional(),
  matricula: z.string().trim().optional(),
  superior_direto_id: z.string().trim().optional(),
  grau_hierarquico: z.string().trim().optional(),
  data_contrato: z.string().optional(),
  duracao_contrato: z.string().trim().optional(),
  vencimento_contrato: z.string().optional(),
  codigo_externo: z.string().trim().optional(),
  duplo_vinculo: z.coerce.boolean().optional(),
  data_inicio_cargo: z.string().optional(),
  inicio_vigencia: z.string().optional(),
  periculosidade: z.coerce.boolean().optional(),
  insalubridade: z.coerce.boolean().optional(),
  percentual_insalubridade: z.coerce.number().optional(),
  permite_bater_ponto: z.coerce.boolean().optional(),

  // Documentos
  estrangeiro: z.coerce.boolean().optional(),
  rg_data_expedicao: z.string().optional(),
  rg_orgao_expedidor: z.string().trim().optional(),
  matricula_esocial: z.string().trim().optional(),
  cnh: z.string().trim().optional(),
  reservista: z.string().trim().optional(),
  titulo_eleitor: z.string().trim().optional(),
  zona_eleitoral: z.string().trim().optional(),
  secao_eleitoral: z.string().trim().optional(),

  // Fuso horário
  fuso_horario: z.string().trim().optional(),

  // Dados adicionais
  quantidade_filhos: z.coerce.number().int().nonnegative().optional(),
  tamanho_camisa: z.string().trim().optional(),
};

const colaboradorSchemaBase = z.object({
  // Dados pessoais
  nome_completo: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido."),
  cpf: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .length(11, "O CPF deve ter 11 dígitos.")
        .refine(isValidCPF, "CPF inválido — confira os dígitos."),
    ),
  // CNPJ/razão social só se aplicam a colaborador PJ (ver superRefine
  // abaixo) — o prestador de serviço é contratado pela empresa (CNPJ),
  // ainda que o CPF da pessoa continue sendo cadastrado.
  cnpj: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor.replace(/\D/g, "") : undefined)),
  razao_social: z.string().trim().optional(),
  telefone: z.string().trim().optional(),
  genero: z
    .enum(["feminino", "masculino", "outro", "prefiro_nao_informar"])
    .optional(),
  data_nascimento: z.string().optional(),

  // Documentos
  rg: z.string().trim().optional(),
  pis: z.string().trim().optional(),
  ctps_numero: z.string().trim().optional(),
  ctps_serie: z.string().trim().optional(),

  // Endereço
  endereco_logradouro: z.string().trim().optional(),
  endereco_numero: z.string().trim().optional(),
  endereco_complemento: z.string().trim().optional(),
  endereco_bairro: z.string().trim().optional(),
  endereco_cidade: z.string().trim().optional(),
  endereco_estado: z.string().trim().length(2, "Use a sigla (ex.: SP).").optional(),
  endereco_cep: z.string().trim().optional(),

  // Dados profissionais
  cargo_id: z.uuid("Selecione o cargo."),
  departamento_id: z.uuid("Selecione o departamento."),
  data_admissao: z.string().min(1, "Informe a data de admissão."),
  banco_horas: z.coerce.number().optional(),
  tipo_contrato: z.enum(["clt", "pj", "estagio", "temporario", "aprendiz"]),
  salario: z.coerce.number().nonnegative("Informe um valor válido.").optional(),

  // Dados bancários
  banco_nome: z.string().trim().optional(),
  banco_agencia: z.string().trim().optional(),
  banco_conta: z.string().trim().optional(),
  banco_tipo_conta: z.string().trim().optional(),
  chave_pix: z.string().trim().optional(),

  ...camposOpcionais,
});

export const colaboradorSchema = colaboradorSchemaBase.superRefine(
  (data, ctx) => {
    if (data.tipo_contrato !== "pj") return;
    if (!data.cnpj || !isValidCNPJ(data.cnpj)) {
      ctx.addIssue({
        code: "custom",
        path: ["cnpj"],
        message: "Informe um CNPJ válido — obrigatório para colaborador PJ.",
      });
    }
    if (!data.razao_social || data.razao_social.trim().length < 2) {
      ctx.addIssue({
        code: "custom",
        path: ["razao_social"],
        message: "Informe a razão social — obrigatória para colaborador PJ.",
      });
    }
  },
);

export type ColaboradorInput = z.infer<typeof colaboradorSchema>;

/** Schema usado no formulário público de "Link de Preenchimento" — só os
 * campos essenciais, sem nada administrativo (cargo/departamento vêm do
 * link, não do formulário). */
export const colaboradorPreenchimentoSchema = z.object({
  nome_completo: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido."),
  cpf: z
    .string()
    .transform((valor) => valor.replace(/\D/g, ""))
    .pipe(
      z
        .string()
        .length(11, "O CPF deve ter 11 dígitos.")
        .refine(isValidCPF, "CPF inválido — confira os dígitos."),
    ),
  telefone: z.string().trim().optional(),
  data_nascimento: z.string().optional(),
  endereco_logradouro: z.string().trim().optional(),
  endereco_numero: z.string().trim().optional(),
  endereco_bairro: z.string().trim().optional(),
  endereco_cidade: z.string().trim().optional(),
  endereco_estado: z.string().trim().length(2).optional(),
  endereco_cep: z.string().trim().optional(),
});

export const desligamentoSchema = z.object({
  data_desligamento: z.string().min(1, "Informe a data do desligamento."),
  motivo_desligamento_id: z.uuid("Selecione o motivo do desligamento."),
});

export const dependenteSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do dependente."),
  parentesco: z.string().trim().min(2, "Informe o parentesco."),
  data_nascimento: z.string().optional(),
  cpf: z
    .string()
    .trim()
    .optional()
    .transform((valor) => (valor ? valor.replace(/\D/g, "") : undefined))
    .refine(
      (valor) => valor === undefined || isValidCPF(valor),
      "CPF inválido — confira os dígitos.",
    ),
});
