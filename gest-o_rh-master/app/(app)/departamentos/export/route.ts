import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";

/** Exporta os departamentos em CSV. */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();
  const { data: departamentos } = await supabase
    .from("departamentos")
    .select("*")
    .order("nome");

  const cabecalho = [
    "Nome",
    "Descrição",
    "Localização",
    "Telefone",
    "Fax",
    "Ramal",
    "Email",
    "Orçamento Mensal",
  ];
  const linhas = (departamentos ?? []).map((d) => [
    d.nome,
    d.descricao ?? "",
    d.localizacao ?? "",
    d.telefone ?? "",
    d.fax ?? "",
    d.ramal ?? "",
    d.email ?? "",
    String(d.orcamento_mensal ?? 0),
  ]);

  return toCsvResponse(cabecalho, linhas, "departamentos.csv");
}
