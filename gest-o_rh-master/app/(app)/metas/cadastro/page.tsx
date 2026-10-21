import Link from "next/link";
import { Target, Pencil, Plus, Download } from "lucide-react";
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
import { excluirMeta } from "./actions";

function formatarMesAno(data: string) {
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR", {
    month: "2-digit",
    year: "numeric",
  });
}

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CadastroMetasPage(props: PageProps<"/metas/cadastro">) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  let query = supabase
    .from("metas")
    .select("*", { count: "exact" })
    .order("nome")
    .range(from, to);
  if (q) query = query.ilike("nome", `%${q}%`);

  const { data: metas, count } = await query;
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Metas"
        action={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/metas/cadastro/export" />}>
                <Download /> Exportar
              </Button>
              <Button render={<Link href="/metas/cadastro/novo" />}>
                <Plus /> Novo(a) Cadastro de Metas
              </Button>
            </div>
          )
        }
      />

      <SearchInput placeholder="Buscar meta..." />

      {!metas || metas.length === 0 ? (
        // Sem `action` aqui: diferente de outras listagens deste app, o
        // botão de criar desta tela fica sempre visível no cabeçalho
        // (igual ao Sólides) — repetir o CTA aqui duplicaria o botão.
        <EmptyState
          icon={Target}
          title={q ? "Nenhuma meta encontrada" : "Ainda não há metas cadastradas"}
          description={
            q ? "Tente buscar por outro termo." : "Cadastre a primeira meta para começar."
          }
        />
      ) : (
        <>
          <DataTable
            rows={metas}
            rowKey={(m) => m.id}
            columns={[
              { header: "Nome", cell: (m) => m.nome },
              { header: "Código", cell: (m) => m.codigo || "—" },
              { header: "Mês/Ano", cell: (m) => formatarMesAno(m.mes_ano) },
              { header: "Valor da Meta", cell: (m) => formatarValor(m.valor_meta) },
              {
                header: "Ações",
                className: "w-24 text-right",
                cell: (m) =>
                  isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/metas/cadastro/${m.id}/editar`} />}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {m.nome}</span>
                      </Button>
                      <DeleteButton
                        itemLabel={`a meta "${m.nome}"`}
                        action={excluirMeta.bind(null, m.id)}
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
