import Link from "next/link";
import { Download, Pencil, Plus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { CountPill } from "@/components/shared/count-pill";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatDate } from "@/lib/format";
import {
  parseListParams,
  totalDePaginas,
  toFlatSearchParams,
} from "@/lib/list-params";
import { TIPO_CONTRATO_OPTIONS } from "@/lib/validations/colaborador";
import { excluirColaborador } from "./actions";

const TIPO_CONTRATO_LABEL = Object.fromEntries(
  TIPO_CONTRATO_OPTIONS.map((o) => [o.value, o.label]),
);

export default async function ColaboradoresPage(
  props: PageProps<"/colaboradores">,
) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const status =
    searchParams.status === "inativo" || searchParams.status === "todos"
      ? searchParams.status
      : "ativo";
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();

  let query = supabase
    .from("colaboradores")
    .select("*", { count: "exact" })
    .order("nome_completo")
    .range(from, to);
  if (status !== "todos") query = query.eq("status", status);
  if (q) {
    query = query.or(
      `nome_completo.ilike.%${q}%,email.ilike.%${q}%,cpf.ilike.%${q}%`,
    );
  }

  const [
    { data: colaboradores, count },
    { data: cargos },
    { data: departamentos },
    { count: totalAtivos },
    { count: totalInativos },
  ] = await Promise.all([
    query,
    supabase.from("cargos").select("id, nome"),
    supabase.from("departamentos").select("id, nome"),
    supabase
      .from("colaboradores")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("colaboradores")
      .select("*", { count: "exact", head: true })
      .eq("status", "inativo"),
  ]);

  const nomeCargo = new Map((cargos ?? []).map((c) => [c.id, c.nome]));
  const nomeDepartamento = new Map(
    (departamentos ?? []).map((d) => [d.id, d.nome]),
  );
  const totalPaginas = totalDePaginas(count ?? 0);

  function linkStatus(valor: string) {
    const params = new URLSearchParams(toFlatSearchParams(searchParams) as Record<string, string>);
    params.set("status", valor);
    params.delete("pagina");
    return `?${params.toString()}`;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Colaboradores"
        description="Cadastro completo do quadro de pessoas da empresa."
        badges={
          <>
            <CountPill label="Ativos" value={totalAtivos ?? 0} />
            <CountPill label="Inativos" value={totalInativos ?? 0} />
          </>
        }
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/colaboradores/export" />}>
              <Download /> Exportar
            </Button>
            {isAdmin && (
              <>
                <Button
                  variant="outline"
                  render={<Link href="/colaboradores/importar" />}
                >
                  Importar
                </Button>
                <Button render={<Link href="/colaboradores/novo" />}>
                  <Plus /> Novo Colaborador
                </Button>
              </>
            )}
          </div>
        }
      />

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <SearchInput placeholder="Buscar por nome, e-mail ou CPF..." />
        <div className="flex gap-1 text-sm">
          {[
            { valor: "ativo", label: "Ativos" },
            { valor: "inativo", label: "Inativos" },
            { valor: "todos", label: "Todos" },
          ].map((opcao) => (
            <Button
              key={opcao.valor}
              size="sm"
              variant={status === opcao.valor ? "default" : "outline"}
              render={<Link href={linkStatus(opcao.valor)} />}
            >
              {opcao.label}
            </Button>
          ))}
        </div>
      </div>

      {!colaboradores || colaboradores.length === 0 ? (
        <EmptyState
          icon={Users}
          title={
            q ? "Nenhum colaborador encontrado" : "Ainda não há colaboradores cadastrados"
          }
          description={
            q
              ? "Tente buscar por outro termo."
              : "Cadastre o primeiro colaborador para começar."
          }
          action={
            isAdmin &&
            !q && (
              <Button render={<Link href="/colaboradores/novo" />}>
                <Plus /> Novo Colaborador
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            rows={colaboradores}
            rowKey={(c) => c.id}
            columns={[
              {
                header: "Nome",
                cell: (c) => (
                  <Link
                    href={`/colaboradores/${c.id}`}
                    className="font-medium text-foreground hover:text-primary hover:underline"
                  >
                    {c.nome_completo}
                  </Link>
                ),
              },
              { header: "Cargo", cell: (c) => nomeCargo.get(c.cargo_id) ?? "—" },
              {
                header: "Departamento",
                cell: (c) => nomeDepartamento.get(c.departamento_id) ?? "—",
              },
              {
                header: "Tipo",
                cell: (c) => (
                  <Badge variant="outline">
                    {TIPO_CONTRATO_LABEL[c.tipo_contrato]}
                  </Badge>
                ),
              },
              { header: "Admissão", cell: (c) => formatDate(c.data_admissao) },
              {
                header: "Status",
                cell: (c) => (
                  <StatusBadge tone={c.status === "ativo" ? "success" : "neutral"}>
                    {c.status === "ativo" ? "Ativo" : "Inativo"}
                  </StatusBadge>
                ),
              },
              {
                header: "Ações",
                className: "w-16 text-right",
                cell: (c) =>
                  isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/colaboradores/${c.id}/editar`} />}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {c.nome_completo}</span>
                      </Button>
                      <DeleteButton
                        itemLabel={`o colaborador "${c.nome_completo}"`}
                        description="Isso apaga permanentemente o cadastro e o histórico de férias, registros e checklists dele. Para um desligamento normal, use a opção 'Desligar' na ficha do colaborador em vez de excluir."
                        action={excluirColaborador.bind(null, c.id)}
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
