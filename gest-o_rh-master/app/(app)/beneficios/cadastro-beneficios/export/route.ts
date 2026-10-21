import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";
import {
  TIPO_BENEFICIO_OPTIONS,
  PERIODICIDADE_BENEFICIO_OPTIONS,
  APLICADO_COMO_OPTIONS,
} from "@/lib/validations/beneficio";

const TIPO_LABEL = Object.fromEntries(TIPO_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]));
const PERIODICIDADE_LABEL = Object.fromEntries(
  PERIODICIDADE_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]),
);
const APLICADO_COMO_LABEL = Object.fromEntries(APLICADO_COMO_OPTIONS.map((o) => [o.value, o.label]));

/** Exporta os benefícios cadastrados em CSV. */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();
  const { data: beneficios } = await supabase.from("beneficios").select("*").order("nome");

  const cabecalho = [
    "Nome do Benefício",
    "Tipo de Benefício",
    "Valor do Benefício",
    "Aplicado como",
    "Periodicidade",
    "Valor Descontado",
  ];
  const linhas = (beneficios ?? []).map((b) => [
    b.nome,
    TIPO_LABEL[b.tipo] ?? b.tipo,
    String(b.valor_beneficio),
    APLICADO_COMO_LABEL[b.aplicado_como] ?? b.aplicado_como,
    PERIODICIDADE_LABEL[b.periodicidade] ?? b.periodicidade,
    b.valor_descontado != null ? String(b.valor_descontado) : "",
  ]);

  return toCsvResponse(cabecalho, linhas, "beneficios.csv");
}
