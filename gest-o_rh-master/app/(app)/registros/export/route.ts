import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";
import { toPdfResponse } from "@/lib/pdf";
import { formatDate, formatDateTime } from "@/lib/format";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  neutro: "Neutro",
};

/** Exporta os registros em Excel (CSV) ou PDF (RLS ativo: gestor só
 * exporta o próprio time). */
export async function GET(request: Request) {
  await requireAuth();
  const formato = new URL(request.url).searchParams.get("formato");
  const supabase = await createClient();

  const [
    { data: registros },
    { data: colaboradores },
    { data: tipos },
    { data: autores },
  ] = await Promise.all([
    supabase.from("registros").select("*").order("data_registro"),
    supabase.from("colaboradores").select("id, nome_completo"),
    supabase.from("tipos_registro").select("id, nome"),
    supabase.from("perfis").select("id, nome_completo"),
  ]);

  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));
  const nomeTipo = new Map((tipos ?? []).map((t) => [t.id, t.nome]));
  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.nome_completo]));

  const cabecalho = [
    "Data do Registro",
    "Colaborador",
    "Tipo de Registro",
    "Classificação",
    "Valor/Qtd/Hs",
    "Autor",
    "Data de criação",
  ];
  const linhas = (registros ?? []).map((r) => [
    formatDate(r.data_registro),
    nomeColaborador.get(r.colaborador_id) ?? "",
    nomeTipo.get(r.tipo_registro_id) ?? "",
    CLASSIFICACAO_LABEL[r.classificacao] ?? r.classificacao,
    String(r.valor_qtd_horas ?? 0),
    nomeAutor.get(r.autor_id) ?? "",
    formatDateTime(r.criado_em),
  ]);

  if (formato === "pdf") {
    return toPdfResponse("Registros", cabecalho, linhas, "registros.pdf");
  }
  return toCsvResponse(cabecalho, linhas, "registros.csv");
}
