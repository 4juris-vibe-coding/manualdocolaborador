import Link from "next/link";
import { Users, Plus, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { parseListParams, totalDePaginas, toFlatSearchParams } from "@/lib/list-params";
import { PERIODICIDADE_BENEFICIO_OPTIONS } from "@/lib/validations/beneficio";
import { excluirBeneficiario } from "./actions";

const PERIODICIDADE_LABEL = Object.fromEntries(
  PERIODICIDADE_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]),
);

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function BeneficiariosPage(props: PageProps<"/beneficios/beneficiarios">) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();

  let query = supabase
    .from("beneficiarios")
    .select("id, colaborador_id, beneficio_id", { count: "exact" })
    .order("criado_em", { ascending: false })
    .range(from, to);

  if (q) {
    const [{ data: colaboradoresBusca }, { data: beneficiosBusca }] = await Promise.all([
      supabase.from("colaboradores").select("id").ilike("nome_completo", `%${q}%`),
      supabase.from("beneficios").select("id").ilike("nome", `%${q}%`),
    ]);
    const idsColab = (colaboradoresBusca ?? []).map((c) => c.id);
    const idsBenef = (beneficiosBusca ?? []).map((b) => b.id);
    if (idsColab.length === 0 && idsBenef.length === 0) {
      query = query.eq("colaborador_id", "00000000-0000-0000-0000-000000000000");
    } else {
      const partes = [];
      if (idsColab.length > 0) partes.push(`colaborador_id.in.(${idsColab.join(",")})`);
      if (idsBenef.length > 0) partes.push(`beneficio_id.in.(${idsBenef.join(",")})`);
      query = query.or(partes.join(","));
    }
  }

  const { data: beneficiariosPagina, count } = await query;
  const linhas = beneficiariosPagina ?? [];

  const idsColaboradores = [...new Set(linhas.map((b) => b.colaborador_id))];
  const idsBeneficios = [...new Set(linhas.map((b) => b.beneficio_id))];

  const [{ data: colaboradores }, { data: beneficios }] = await Promise.all([
    supabase.from("colaboradores").select("id, nome_completo").in("id", idsColaboradores.length > 0 ? idsColaboradores : [""]),
    supabase.from("beneficios").select("*").in("id", idsBeneficios.length > 0 ? idsBeneficios : [""]),
  ]);

  const nomeColaborador = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));
  const beneficioPorId = new Map((beneficios ?? []).map((b) => [b.id, b]));

  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Benefícios"
        action={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/beneficios/beneficiarios/export" />}>
                <Download /> Exportar
              </Button>
              <Button variant="outline" render={<Link href="/beneficios/beneficiarios/multiplos" />}>
                <Plus /> Adicionar Múltiplos Beneficiários
              </Button>
              <Button render={<Link href="/beneficios/beneficiarios/novo" />}>
                <Plus /> Novo Beneficiário
              </Button>
            </div>
          )
        }
      />

      <SearchInput placeholder="Buscar colaborador ou benefício..." />

      {linhas.length === 0 ? (
        <EmptyState
          icon={Users}
          title={q ? "Nenhum beneficiário encontrado" : "Ainda não há beneficiários cadastrados"}
          description={
            q ? "Tente buscar por outro termo." : "Cadastre o primeiro beneficiário para começar."
          }
        />
      ) : (
        <>
          <DataTable
            rows={linhas}
            rowKey={(b) => b.id}
            columns={[
              { header: "Colaborador", cell: (b) => nomeColaborador.get(b.colaborador_id) ?? "—" },
              { header: "Nome do Benefício", cell: (b) => beneficioPorId.get(b.beneficio_id)?.nome ?? "—" },
              {
                header: "Valor do Benefício",
                cell: (b) => {
                  const beneficio = beneficioPorId.get(b.beneficio_id);
                  return beneficio ? formatarValor(beneficio.valor_beneficio) : "—";
                },
              },
              {
                header: "Periodicidade",
                cell: (b) => {
                  const beneficio = beneficioPorId.get(b.beneficio_id);
                  return beneficio ? PERIODICIDADE_LABEL[beneficio.periodicidade] : "—";
                },
              },
              {
                header: "Valor Descontado",
                cell: (b) => {
                  const beneficio = beneficioPorId.get(b.beneficio_id);
                  return beneficio?.valor_descontado != null ? formatarValor(beneficio.valor_descontado) : "—";
                },
              },
              {
                header: "Ações",
                className: "w-16 text-right",
                cell: (b) =>
                  isAdmin && (
                    <div className="flex justify-end">
                      <DeleteButton
                        itemLabel={`o beneficiário "${nomeColaborador.get(b.colaborador_id) ?? ""} — ${beneficioPorId.get(b.beneficio_id)?.nome ?? ""}"`}
                        action={excluirBeneficiario.bind(null, b.id)}
                      />
                    </div>
                  ),
              },
            ]}
          />
          <PaginationBar
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalRegistros={count ?? 0}
            searchParams={toFlatSearchParams(searchParams)}
          />
        </>
      )}
    </div>
  );
}
