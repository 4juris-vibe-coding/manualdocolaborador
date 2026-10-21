import { z } from "zod";
import type { SenioridadeCargo } from "@/types/database.types";
import { TRACOS_COMPORTAMENTAIS } from "@/lib/cargo-tracos";

// Rótulo "Principal" (não "Liderança") pra bater com o Sólides — o valor
// gravado no banco continua "lideranca", só o texto exibido muda.
export const SENIORIDADE_OPTIONS: { value: SenioridadeCargo; label: string }[] = [
  { value: "estagiario", label: "Estagiário" },
  { value: "junior", label: "Júnior" },
  { value: "pleno", label: "Pleno" },
  { value: "senior", label: "Sênior" },
  { value: "especialista", label: "Especialista" },
  { value: "lideranca", label: "Principal" },
];

const tracosSchema = z
  .record(z.string(), z.coerce.number().min(0).max(100))
  .optional();

export const cargoSchema = z.object({
  nome: z.string().trim().min(2, "Informe o nome do cargo."),
  cargo_superior_id: z.string().trim().optional(),
  senioridade: z
    .enum(["estagiario", "junior", "pleno", "senior", "especialista", "lideranca"])
    .optional(),
  codigo_cbo: z.string().trim().optional(),
  descricao: z.string().trim().optional(),
  atividades: z.string().trim().optional(),
  piso_salarial: z.coerce
    .number()
    .nonnegative("Informe um valor válido.")
    .optional(),
  piso_salarial_visivel: z.coerce.boolean().optional(),
  habilidades: z.array(z.string().trim().min(1)).optional(),
  assistencias: z.array(z.string().trim().min(1)).optional(),
  responsaveis_ids: z.array(z.uuid()).optional(),
  tracos: tracosSchema,
  perfil_executor: z.coerce.number().min(0).max(100).optional(),
  perfil_comunicador: z.coerce.number().min(0).max(100).optional(),
  perfil_planejador: z.coerce.number().min(0).max(100).optional(),
  perfil_analista: z.coerce.number().min(0).max(100).optional(),
});

export type CargoInput = z.infer<typeof cargoSchema>;

export const CHAVES_TRACOS = TRACOS_COMPORTAMENTAIS.map((t) => t.chave);
