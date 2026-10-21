import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";
import { toPdfResponse } from "@/lib/pdf";
import { formatDate, formatDateTime } from "@/lib/format";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  para_melhorar: "Para melhorar",
  neutro: "Neutro",
};

/** Exporta os feedbacks em Excel (CSV) ou PDF (RLS ativo: gestor só
 * exporta o próprio time). */
export async function GET(request: Request) {
  await requireAuth();
  const formato = new URL(request.url).searchParams.get("formato");
  const supabase = await createClient();

  const [{ data: feedbacks }, { data: colaboradores }, { data: autores }] =
    await Promise.all([
      supabase.from("feedbacks").select("*").order("data_feedback"),
      supabase.from("colaboradores").select("id, nome_completo"),
      supabase.from("perfis").select("id, nome_completo"),
    ]);

  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));
  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.nome_completo]));

  const cabecalho = ["Data do Feedback", "Colaborador", "Classificação", "Autor", "Data de criação"];
  const linhas = (feedbacks ?? []).map((f) => [
    formatDate(f.data_feedback),
    nomeColaborador.get(f.colaborador_id) ?? "",
    CLASSIFICACAO_LABEL[f.classificacao] ?? f.classificacao,
    nomeAutor.get(f.autor_id) ?? "",
    formatDateTime(f.criado_em),
  ]);

  if (formato === "pdf") {
    return toPdfResponse("Feedbacks", cabecalho, linhas, "feedbacks.pdf");
  }
  return toCsvResponse(cabecalho, linhas, "feedbacks.csv");
}
