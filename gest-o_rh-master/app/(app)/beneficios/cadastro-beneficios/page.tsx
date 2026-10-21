import Link from "next/link";
import { Gift, Pencil, Plus, Download } from "lucide-react";
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
import { TIPO_BENEFICIO_OPTIONS, PERIODICIDADE_BENEFICIO_OPTIONS } from "@/lib/validations/beneficio";
import { excluirBeneficio } from "./actions";

const TIPO_LABEL = Object.fromEntries(TIPO_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]));
const PERIODICIDADE_LABEL = Object.fromEntries(
  PERIODICIDADE_BENEFICIO_OPTIONS.map((o) => [o.value, o.label]),
);

function formatarValor(valor: number) {
  return valor.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export default async function CadastroBeneficiosPage(
  props: PageProps<"/beneficios/cadastro-beneficios">,
) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  let query = supabase
    .from("beneficios")
    .select("*", { count: "exact" })
    .order("nome")
    .range(from, to);
  if (q) query = query.ilike("nome", `%${q}%`);

  const { data: beneficios, count } = await query;
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cadastro de Benefício"
        action={
          isAdmin && (
            <div className="flex gap-2">
              <Button variant="outline" render={<Link href="/beneficios/cadastro-beneficios/export" />}>
                <Download /> Exportar
              </Button>
              <Button render={<Link href="/beneficios/cadastro-beneficios/novo" />}>
                <Plus /> Novo(a) Cadastro de Benefícios
              </Button>
            </div>
          )
        }
      />

      <SearchInput placeholder="Buscar benefício..." />

      {!beneficios || beneficios.length === 0 ? (
        // Sem `action` aqui: igual à Cadastro de Metas, o CTA do
        // cabeçalho fica sempre visível, então o EmptyState não repete o
        // botão de criar.
        <EmptyState
          icon={Gift}
          title={q ? "Nenhum benefício encontrado" : "Ainda não há benefícios cadastrados"}
          description={
            q ? "Tente buscar por outro termo." : "Cadastre o primeiro benefício para começar."
          }
        />
      ) : (
        <>
          <DataTable
            rows={beneficios}
            rowKey={(b) => b.id}
            columns={[
              { header: "Nome do Benefício", cell: (b) => b.nome },
              { header: "Tipo de Benefício", cell: (b) => TIPO_LABEL[b.tipo] },
              { header: "Valor do Benefício", cell: (b) => formatarValor(b.valor_beneficio) },
              { header: "Periodicidade", cell: (b) => PERIODICIDADE_LABEL[b.periodicidade] },
              {
                header: "Valor Descontado",
                cell: (b) => (b.valor_descontado != null ? formatarValor(b.valor_descontado) : "—"),
              },
              {
                header: "Ações",
                className: "w-24 text-right",
                cell: (b) =>
                  isAdmin && (
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon-sm"
                        render={<Link href={`/beneficios/cadastro-beneficios/${b.id}/editar`} />}
                      >
                        <Pencil />
                        <span className="sr-only">Editar {b.nome}</span>
                      </Button>
                      <DeleteButton
                        itemLabel={`o benefício "${b.nome}"`}
                        action={excluirBeneficio.bind(null, b.id)}
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
