import Link from "next/link";
import { MapPin, Pencil, Plus } from "lucide-react";
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
import { excluirUnidade } from "./actions";

export default async function UnidadesPage(props: PageProps<"/unidades">) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  let query = supabase
    .from("unidades")
    .select("*", { count: "exact" })
    .order("nome")
    .range(from, to);
  if (q) query = query.ilike("nome", `%${q}%`);

  const { data: unidades, count } = await query;
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Unidades"
        description="Filiais e unidades de atendimento da empresa."
        action={
          isAdmin && (
            <Button render={<Link href="/unidades/nova" />}>
              <Plus /> Nova Unidade
            </Button>
          )
        }
      />

      <SearchInput placeholder="Buscar unidade..." />

      {!unidades || unidades.length === 0 ? (
        <EmptyState
          icon={MapPin}
          title={
            q ? "Nenhuma unidade encontrada" : "Ainda não há unidades cadastradas"
          }
          description={
            q
              ? "Tente buscar por outro termo."
              : "Cadastre a primeira unidade para começar a organizar os departamentos."
          }
          action={
            isAdmin &&
            !q && (
              <Button render={<Link href="/unidades/nova" />}>
                <Plus /> Nova Unidade
              </Button>
            )
          }
        />
      ) : (
        <>
          <DataTable
            rows={unidades}
            rowKey={(u) => u.id}
            columns={[
              { header: "Nome", cell: (u) => u.nome },
              { header: "Endereço", cell: (u) => u.endereco || "—" },
              { header: "Telefone", cell: (u) => u.telefone || "—" },
              {
                header: "Ações",
                className: "w-24 text-right",
                cell: (u) =>
                  isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/unidades/${u.id}/editar`} />}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {u.nome}</span>
                      </Button>
                      <DeleteButton
                        itemLabel={`a unidade "${u.nome}"`}
                        action={excluirUnidade.bind(null, u.id)}
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
