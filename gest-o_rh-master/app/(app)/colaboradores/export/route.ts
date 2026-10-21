import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toCsvResponse } from "@/lib/csv";
import { TIPO_CONTRATO_OPTIONS } from "@/lib/validations/colaborador";

const TIPO_CONTRATO_LABEL = Object.fromEntries(
  TIPO_CONTRATO_OPTIONS.map((o) => [o.value, o.label]),
);

/** Exporta os colaboradores em CSV. Roda com o client normal (RLS ativo):
 * um gestor exporta só o próprio time, admin_rh exporta todo mundo. */
export async function GET() {
  await requireAuth();
  const supabase = await createClient();

  const [{ data: colaboradores }, { data: cargos }, { data: departamentos }] =
    await Promise.all([
      supabase.from("colaboradores").select("*").order("nome_completo"),
      supabase.from("cargos").select("id, nome"),
      supabase.from("departamentos").select("id, nome"),
    ]);

  const nomeCargo = new Map((cargos ?? []).map((c) => [c.id, c.nome]));
  const nomeDepartamento = new Map(
    (departamentos ?? []).map((d) => [d.id, d.nome]),
  );

  const cabecalho = [
    "Nome completo",
    "E-mail",
    "CPF",
    "Telefone",
    "Cargo",
    "Departamento",
    "Tipo de contrato",
    "CNPJ",
    "Razão social",
    "Data de admissão",
    "Status",
    "Banco de horas",
  ];
  const linhas = (colaboradores ?? []).map((c) => [
    c.nome_completo,
    c.email,
    c.cpf,
    c.telefone ?? "",
    nomeCargo.get(c.cargo_id) ?? "",
    nomeDepartamento.get(c.departamento_id) ?? "",
    TIPO_CONTRATO_LABEL[c.tipo_contrato] ?? c.tipo_contrato,
    c.cnpj ?? "",
    c.razao_social ?? "",
    c.data_admissao,
    c.status,
    String(c.banco_horas),
  ]);

  return toCsvResponse(cabecalho, linhas, "colaboradores.csv");
}
