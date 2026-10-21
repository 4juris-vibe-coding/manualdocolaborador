import Link from "next/link";
import { Building2, Download, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import {
  parseListParams,
  totalDePaginas,
  toFlatSearchParams,
} from "@/lib/list-params";
import { excluirDepartamento } from "./actions";

function NovoDepartamentoButton() {
  return (
    <Button render={<Link href="/departamentos/novo" />}>
      <Plus /> Novo(a) Departamento
    </Button>
  );
}

export default async function DepartamentosPage(
  props: PageProps<"/departamentos">,
) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  let query = supabase
    .from("departamentos")
    .select("*", { count: "exact" })
    .order("nome")
    .range(from, to);
  if (q) query = query.ilike("nome", `%${q}%`);

  const { data: departamentos, count } = await query;
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Departamentos"
        description="Estrutura organizacional da empresa."
        action={
          isAdmin && (
            <div className="flex flex-wrap gap-2">
              <Button variant="outline" render={<Link href="/departamentos/export" />}>
                <Download /> Exportar
              </Button>
              <NovoDepartamentoButton />
            </div>
          )
        }
      />

      <SearchInput placeholder="Buscar departamento..." />

      {!departamentos || departamentos.length === 0 ? (
        <EmptyState
          icon={Building2}
          title={
            q
              ? "Nenhum departamento encontrado"
              : "Ainda não há departamentos cadastrados"
          }
          description={
            q
              ? "Tente buscar por outro termo."
              : "Cadastre o primeiro departamento para começar a organizar os colaboradores."
          }
          action={isAdmin && !q && <NovoDepartamentoButton />}
        />
      ) : (
        <>
          <DataTable
            rows={departamentos}
            rowKey={(d) => d.id}
            columns={[
              { header: "Nome", cell: (d) => d.nome },
              { header: "Localização", cell: (d) => d.localizacao || "—" },
              { header: "Telefone", cell: (d) => d.telefone || "—" },
              {
                header: "Opções",
                className: "w-24 text-right",
                cell: (d) =>
                  isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/departamentos/${d.id}/editar`} />}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {d.nome}</span>
                      </Button>
                      <DeleteButton
                        itemLabel={`o departamento "${d.nome}"`}
                        action={excluirDepartamento.bind(null, d.id)}
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
