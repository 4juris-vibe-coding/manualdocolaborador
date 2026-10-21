import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";
import { PERIODICIDADE_BENEFICIO_OPTIONS } from "@/lib/validations/beneficio";

const PERIODICIDADE_LABEL = Object.fromEntries(
  PERIODICIDADE_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]),
);

/** Exporta os beneficiários (colaborador + benefício vinculado) em CSV. */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();
  const { data: beneficiarios } = await supabase
    .from("beneficiarios")
    .select("colaborador_id, beneficio_id")
    .order("criado_em", { ascending: false });

  const idsColaboradores = [...new Set((beneficiarios ?? []).map((b) => b.colaborador_id))];
  const idsBeneficios = [...new Set((beneficiarios ?? []).map((b) => b.beneficio_id))];

  const [{ data: colaboradores }, { data: beneficios }] = await Promise.all([
    supabase.from("colaboradores").select("id, nome_completo").in("id", idsColaboradores.length > 0 ? idsColaboradores : [""]),
    supabase.from("beneficios").select("*").in("id", idsBeneficios.length > 0 ? idsBeneficios : [""]),
  ]);
  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));
  const beneficioPorId = new Map((beneficios ?? []).map((b) => [b.id, b]));

  const cabecalho = [
    "Colaborador",
    "Nome do Benefício",
    "Valor do Benefício",
    "Periodicidade",
    "Valor Descontado",
  ];
  const linhas = (beneficiarios ?? []).map((b) => {
    const beneficio = beneficioPorId.get(b.beneficio_id);
    return [
      nomeColaborador.get(b.colaborador_id) ?? "",
      beneficio?.nome ?? "",
      beneficio ? String(beneficio.valor_beneficio) : "",
      beneficio ? (PERIODICIDADE_LABEL[beneficio.periodicidade] ?? "") : "",
      beneficio?.valor_descontado != null ? String(beneficio.valor_descontado) : "",
    ];
  });

  return toCsvResponse(cabecalho, linhas, "beneficiarios.csv");
}
