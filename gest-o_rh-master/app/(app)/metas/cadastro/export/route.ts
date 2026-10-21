import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";

/** Exporta as metas cadastradas em CSV. */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();
  const { data: metas } = await supabase.from("metas").select("*").order("nome");

  const cabecalho = ["Nome", "Código", "Descrição", "Mês/Ano", "Valor da Meta"];
  const linhas = (metas ?? []).map((m) => [
    m.nome,
    m.codigo ?? "",
    m.descricao,
    new Date(`${m.mes_ano}T00:00:00`).toLocaleDateString("pt-BR", {
      month: "2-digit",
      year: "numeric",
    }),
    String(m.valor_meta),
  ]);

  return toCsvResponse(cabecalho, linhas, "metas.csv");
}
