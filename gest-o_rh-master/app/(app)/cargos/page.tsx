import Link from "next/link";
import { ChevronDown, FileBarChart, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { PorPaginaSelect } from "@/components/shared/por-pagina-select";
import { DeleteButton } from "@/components/shared/delete-button";
import {
  PerfilDiscBadge,
  categoriaDiscDominante,
} from "@/components/shared/perfil-disc-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { formatCurrency, SENIORIDADE_LABEL } from "@/lib/format";
import { CATEGORIAS_DISC } from "@/lib/perfil-disc";
import { totalDePaginas, toFlatSearchParams } from "@/lib/list-params";
import { excluirCargo } from "./actions";

function CriarCargoDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button />}>
        <Plus /> Criar cargo
        <ChevronDown className="ml-1 size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/cargos/novo" />}>
          Novo cargo
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Novo por um template <span className="ml-auto text-xs">Em breve</span>
        </DropdownMenuItem>
        <DropdownMenuItem disabled>
          Adicionar por uma lista <span className="ml-auto text-xs">Em breve</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RelatoriosDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <FileBarChart /> Relatórios
        <ChevronDown className="ml-1 size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem disabled>
          Relatório de cargos <span className="ml-auto text-xs">Em breve</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function FiltrosPerfil({
  perfilAtual,
  searchParams,
}: {
  perfilAtual?: string;
  searchParams: Record<string, string | undefined>;
}) {
  function href(perfil?: string) {
    const params = new URLSearchParams();
    for (const [key, value] of Object.entries(searchParams)) {
      if (value && key !== "perfil" && key !== "pagina") params.set(key, value);
    }
    if (perfil) params.set("perfil", perfil);
    const query = params.toString();
    return query ? `?${query}` : "?";
  }

  return (
    <Card className="h-fit">
      <CardContent className="flex flex-col gap-1">
        <h2 className="mb-1 text-xs font-semibold tracking-wide text-muted-foreground">
          FILTROS
        </h2>
        <Link
          href={href(undefined)}
          className={cn(
            "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors",
            !perfilAtual
              ? "bg-primary/10 text-primary"
              : "text-foreground hover:bg-muted",
          )}
        >
          Todos
        </Link>
        {CATEGORIAS_DISC.map((cat) => (
          <Link
            key={cat.chave}
            href={href(cat.chave)}
            className={cn(
              "rounded-lg px-3 py-1.5 text-sm font-medium transition-colors hover:bg-muted",
              perfilAtual === cat.chave && "bg-muted",
            )}
            style={{ color: cat.cor }}
          >
            {cat.label === "Comunicador"
              ? "Comunicadores"
              : cat.label === "Executor"
                ? "Executores"
                : cat.label === "Analista"
                  ? "Analistas"
                  : "Planejadores"}
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}

export default async function CargosPage(props: PageProps<"/cargos">) {
  const searchParamsRaw = await props.searchParams;
  const searchParams = toFlatSearchParams(searchParamsRaw);
  const q = searchParams.q?.trim() || undefined;
  const perfilFiltro = searchParams.perfil;
  const itensPorPagina = [10, 25, 50, 100].includes(Number(searchParams.por_pagina))
    ? Number(searchParams.por_pagina)
    : 25;
  const paginaBruta = Number(searchParams.pagina);
  const pagina = Number.isFinite(paginaBruta) && paginaBruta > 0 ? Math.floor(paginaBruta) : 1;

  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  let query = supabase.from("cargos").select("*").order("nome");
  if (q) query = query.ilike("nome", `%${q}%`);
  const { data: todosCargos } = await query;

  // O "Perfil" (categoria DISC dominante) é derivado, não uma coluna
  // simples de filtrar no banco — por isso busca/filtra/pagina em memória
  // (lista de cargos de uma empresa é pequena, isso não é um problema).
  const cargosFiltrados = (todosCargos ?? []).filter((c) => {
    if (!perfilFiltro) return true;
    return categoriaDiscDominante(c)?.chave === perfilFiltro;
  });

  const totalRegistros = cargosFiltrados.length;
  const totalPaginas = totalDePaginas(totalRegistros, itensPorPagina);
  const from = (pagina - 1) * itensPorPagina;
  const cargos = cargosFiltrados.slice(from, from + itensPorPagina);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Cargos"
        description="Estrutura de cargos usada nos cadastros de colaboradores."
        action={isAdmin && <CriarCargoDropdown />}
      />

      <div className="flex flex-wrap items-center gap-2">
        <SearchInput placeholder="Buscar cargo..." />
        <RelatoriosDropdown />
      </div>

      <PorPaginaSelect totalRegistros={totalRegistros} />

      <div className="grid gap-6 lg:grid-cols-[1fr_14rem]">
        <div className="flex flex-col gap-4">
          {cargos.length === 0 ? (
            <EmptyState
              title="Ainda não há dados a serem exibidos"
              titleClassName="text-lg font-semibold text-primary"
              description={
                q || perfilFiltro ? "Tente ajustar a busca ou os filtros." : undefined
              }
              action={isAdmin && !q && !perfilFiltro && <CriarCargoDropdown />}
            />
          ) : (
            <DataTable
              rows={cargos}
              rowKey={(c) => c.id}
              columns={[
                { header: "Nome", cell: (c) => c.nome },
                { header: "Perfil", cell: (c) => <PerfilDiscBadge valores={c} /> },
                {
                  header: "Senioridade",
                  cell: (c) =>
                    c.senioridade ? SENIORIDADE_LABEL[c.senioridade] : "—",
                },
                { header: "CBO", cell: (c) => c.codigo_cbo || "—" },
                {
                  header: "Piso salarial",
                  cell: (c) => formatCurrency(c.piso_salarial),
                },
                {
                  header: "Ações",
                  className: "w-24 text-right",
                  cell: (c) =>
                    isAdmin && (
                      <div className="flex justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon-sm"
                          render={<Link href={`/cargos/${c.id}/editar`} />}
                        >
                          <Pencil />
                          <span className="sr-only">Editar {c.nome}</span>
                        </Button>
                        <DeleteButton
                          itemLabel={`o cargo "${c.nome}"`}
                          action={excluirCargo.bind(null, c.id)}
                        />
                      </div>
                    ),
                },
              ]}
            />
          )}
          <PaginationBar
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalRegistros={totalRegistros}
            searchParams={searchParams}
          />
        </div>

        <FiltrosPerfil perfilAtual={perfilFiltro} searchParams={searchParams} />
      </div>
    </div>
  );
}
