import Link from "next/link";
import { Plus, Pencil, Archive, ArchiveRestore, Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { DeleteButton } from "@/components/shared/delete-button";
import { CompetenciaSheet } from "@/components/forms/competencia-sheet";
import { TIPO_AVALIACAO_OPTIONS } from "@/lib/validations/competencia";
import { parseListParams, totalDePaginas, toFlatSearchParams } from "@/lib/list-params";
import type { CompetenciaRow } from "@/types/database.types";
import {
  criarCompetencia,
  atualizarCompetencia,
  alternarArquivadoCompetencia,
  excluirCompetencia,
} from "./actions";

const TIPO_AVALIACAO_LABEL = Object.fromEntries(
  TIPO_AVALIACAO_OPTIONS.map((o) => [o.value, o.label]),
);

type Aba = "competencias" | "cargos" | "arquivadas";

function TabButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary"
          : "border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

function NovaCompetenciaButton({
  grupos,
  cargos,
}: {
  grupos: { id: string; nome: string }[];
  cargos: { id: string; nome: string }[];
}) {
  return (
    <CompetenciaSheet
      tituloSheet="Criar competência"
      action={criarCompetencia}
      grupos={grupos}
      cargos={cargos}
      trigger={
        <Button>
          <Plus /> Criar Competência
        </Button>
      }
    />
  );
}

export default async function CompetenciasPage(props: PageProps<"/competencias">) {
  const searchParams = await props.searchParams;
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const abaParam = typeof searchParams.aba === "string" ? searchParams.aba : "";
  const aba: Aba =
    abaParam === "cargos" ? "cargos" : abaParam === "arquivadas" ? "arquivadas" : "competencias";
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : undefined;

  const supabase = await createClient();

  const [{ data: gruposAtivos }, { data: cargosTodos }, { data: gruposTodos }] =
    await Promise.all([
      supabase.from("grupos_competencias").select("id, nome").eq("ativo", true).order("nome"),
      supabase.from("cargos").select("id, nome").order("nome"),
      supabase.from("grupos_competencias").select("id, nome"),
    ]);
  const nomeGrupo = new Map((gruposTodos ?? []).map((g) => [g.id, g.nome]));

  // Só na aba de cargos não faz sentido oferecer "Criar Competência" no
  // cabeçalho — nas outras duas, o botão do cabeçalho só aparece quando
  // já existe pelo menos 1 competência (a lista vazia tem o próprio CTA,
  // igual ao Sólides — evita os dois botões juntos).
  let competencias: CompetenciaRow[] = [];
  let totalCompetencias = 0;
  if (aba !== "cargos") {
    let query = supabase
      .from("competencias")
      .select("*")
      .eq("ativo", aba !== "arquivadas")
      .order("nome");
    if (q) query = query.ilike("nome", `%${q}%`);
    const { data } = await query;
    competencias = data ?? [];
    totalCompetencias = competencias.length;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Competências"
        action={
          isAdmin &&
          aba !== "cargos" &&
          totalCompetencias > 0 && (
            <NovaCompetenciaButton grupos={gruposAtivos ?? []} cargos={cargosTodos ?? []} />
          )
        }
      />

      <div className="flex gap-6 border-b border-border">
        <TabButton href="?aba=competencias" active={aba === "competencias"}>
          Listar por competências
        </TabButton>
        <TabButton href="?aba=cargos" active={aba === "cargos"}>
          Listar por cargos
        </TabButton>
        <TabButton href="?aba=arquivadas" active={aba === "arquivadas"}>
          Arquivadas
        </TabButton>
      </div>

      {aba === "cargos" ? (
        <ListaPorCargos q={q} searchParams={searchParams} />
      ) : (
        <ListaPorCompetencias
          aba={aba}
          isAdmin={isAdmin}
          competencias={competencias}
          gruposAtivos={gruposAtivos ?? []}
          cargosTodos={cargosTodos ?? []}
          nomeGrupo={nomeGrupo}
        />
      )}
    </div>
  );
}

async function ListaPorCompetencias({
  aba,
  isAdmin,
  competencias,
  gruposAtivos,
  cargosTodos,
  nomeGrupo,
}: {
  aba: Aba;
  isAdmin: boolean;
  competencias: CompetenciaRow[];
  gruposAtivos: { id: string; nome: string }[];
  cargosTodos: { id: string; nome: string }[];
  nomeGrupo: Map<string, string>;
}) {
  const supabase = await createClient();
  const { data: vinculos } = await supabase
    .from("competencia_cargos")
    .select("competencia_id, cargo_id");

  const cargosPorCompetencia = new Map<string, string[]>();
  for (const v of vinculos ?? []) {
    const lista = cargosPorCompetencia.get(v.competencia_id) ?? [];
    lista.push(v.cargo_id);
    cargosPorCompetencia.set(v.competencia_id, lista);
  }

  return (
    <>
      <SearchInput placeholder="Pesquisar..." />

      {competencias.length === 0 ? (
        aba === "arquivadas" ? (
          <EmptyState title="Não há dados para mostrar." />
        ) : (
          <EmptyState
            title="Você ainda não criou nenhuma competência."
            description="Competências são valores de referência utilizados na Avaliação de desempenho para designar a nota a ser dada ao colaborador avaliado."
            action={
              isAdmin && <NovaCompetenciaButton grupos={gruposAtivos} cargos={cargosTodos} />
            }
          />
        )
      ) : (
        <DataTable
          rows={competencias}
          rowKey={(c) => c.id}
          columns={[
            { header: "Nome", cell: (c) => c.nome },
            { header: "Grupo", cell: (c) => nomeGrupo.get(c.grupo_id) ?? "—" },
            {
              header: "Tipo de avaliação",
              cell: (c) => TIPO_AVALIACAO_LABEL[c.tipo_avaliacao],
            },
            { header: "Peso", cell: (c) => c.peso },
            ...(isAdmin
              ? [
                  {
                    header: "Ações",
                    className: "w-28 text-right",
                    cell: (c: CompetenciaRow) => (
                      <div className="flex justify-end gap-1">
                        <CompetenciaSheet
                          tituloSheet="Editar competência"
                          action={atualizarCompetencia.bind(null, c.id)}
                          grupos={gruposAtivos}
                          cargos={cargosTodos}
                          defaultValues={c}
                          cargosVinculadosIds={cargosPorCompetencia.get(c.id) ?? []}
                          trigger={
                            <Button variant="ghost" size="icon-sm">
                              <Pencil />
                              <span className="sr-only">Editar {c.nome}</span>
                            </Button>
                          }
                        />
                        {c.ativo ? (
                          <ConfirmActionButton
                            action={alternarArquivadoCompetencia.bind(null, c.id, false)}
                            trigger={
                              <Button variant="ghost" size="icon-sm">
                                <Archive />
                                <span className="sr-only">Arquivar {c.nome}</span>
                              </Button>
                            }
                            title={`Arquivar "${c.nome}"?`}
                            description="A competência deixa de aparecer na lista principal, mas continua disponível em Arquivadas."
                            confirmLabel="Arquivar"
                            successMessage="Competência arquivada."
                          />
                        ) : (
                          <ConfirmActionButton
                            action={alternarArquivadoCompetencia.bind(null, c.id, true)}
                            trigger={
                              <Button variant="ghost" size="icon-sm">
                                <ArchiveRestore />
                                <span className="sr-only">Reativar {c.nome}</span>
                              </Button>
                            }
                            title={`Reativar "${c.nome}"?`}
                            confirmLabel="Reativar"
                            successMessage="Competência reativada."
                          />
                        )}
                        <DeleteButton
                          itemLabel={`a competência "${c.nome}"`}
                          action={excluirCompetencia.bind(null, c.id)}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </>
  );
}

async function ListaPorCargos({
  q,
  searchParams,
}: {
  q?: string;
  searchParams: Record<string, string | string[] | undefined>;
}) {
  const supabase = await createClient();
  const { pagina, from, to } = parseListParams(searchParams, 10);

  let query = supabase.from("cargos").select("id, nome", { count: "exact" }).order("nome").range(from, to);
  if (q) query = query.ilike("nome", `%${q}%`);
  const [{ data: cargosPagina, count }, { data: vinculos }, { data: competencias }] =
    await Promise.all([
      query,
      supabase.from("competencia_cargos").select("cargo_id, competencia_id"),
      supabase.from("competencias").select("id, ativo"),
    ]);

  const ativoPorCompetencia = new Map((competencias ?? []).map((c) => [c.id, c.ativo]));
  const qtdPorCargo = new Map<string, number>();
  for (const v of vinculos ?? []) {
    if (!ativoPorCompetencia.get(v.competencia_id)) continue;
    qtdPorCargo.set(v.cargo_id, (qtdPorCargo.get(v.cargo_id) ?? 0) + 1);
  }
  const totalPaginas = totalDePaginas(count ?? 0, 10);

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <SearchInput placeholder="Pesquisar..." />
        <Button variant="outline" render={<Link href="/competencias/export" />}>
          <Download /> Exportar CSV
        </Button>
      </div>

      {!cargosPagina || cargosPagina.length === 0 ? (
        <EmptyState title="Não há dados para mostrar." />
      ) : (
        <>
          <DataTable
            rows={cargosPagina}
            rowKey={(c) => c.id}
            columns={[
              { header: "Nome", cell: (c) => c.nome },
              {
                header: "Competências vinculadas",
                cell: (c) => qtdPorCargo.get(c.id) ?? 0,
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
    </>
  );
}
