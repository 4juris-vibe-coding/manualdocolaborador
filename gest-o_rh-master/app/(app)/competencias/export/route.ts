import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";

/** Exporta a lista de cargos com a quantidade de competências ativas
 * vinculadas — a mesma tabela da aba "Listar por cargos". */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();

  const [{ data: cargos }, { data: vinculos }, { data: competencias }] = await Promise.all([
    supabase.from("cargos").select("id, nome").order("nome"),
    supabase.from("competencia_cargos").select("cargo_id, competencia_id"),
    supabase.from("competencias").select("id, ativo"),
  ]);

  const ativoPorCompetencia = new Map((competencias ?? []).map((c) => [c.id, c.ativo]));
  const qtdPorCargo = new Map<string, number>();
  for (const v of vinculos ?? []) {
    if (!ativoPorCompetencia.get(v.competencia_id)) continue;
    qtdPorCargo.set(v.cargo_id, (qtdPorCargo.get(v.cargo_id) ?? 0) + 1);
  }

  const cabecalho = ["Nome", "Competências vinculadas"];
  const linhas = (cargos ?? []).map((c) => [c.nome, String(qtdPorCargo.get(c.id) ?? 0)]);

  return toCsvResponse(cabecalho, linhas, "competencias-por-cargo.csv");
}
