import Link from "next/link";
import { Plus, Pencil, Archive, ArchiveRestore } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { DeleteButton } from "@/components/shared/delete-button";
import { GrupoCompetenciaDialog } from "@/components/forms/grupo-competencia-dialog";
import { CATEGORIA_9BOX_LABEL_CURTO } from "@/lib/validations/grupo-competencia";
import {
  criarGrupoCompetencia,
  atualizarGrupoCompetencia,
  alternarArquivadoGrupoCompetencia,
  excluirGrupoCompetencia,
} from "./actions";

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

export default async function GruposCompetenciasPage(
  props: PageProps<"/competencias/grupos">,
) {
  const searchParams = await props.searchParams;
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const aba = searchParams.aba === "arquivados" ? "arquivados" : "ativos";
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : undefined;

  const supabase = await createClient();
  let query = supabase
    .from("grupos_competencias")
    .select("*")
    .eq("ativo", aba === "ativos")
    .order("nome");
  if (q) query = query.ilike("nome", `%${q}%`);
  const { data: grupos } = await query;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Grupos de competências"
        action={
          isAdmin && (
            <GrupoCompetenciaDialog
              tituloDialog="Criar grupo de competências"
              action={criarGrupoCompetencia}
              trigger={
                <Button>
                  <Plus /> Criar Grupo de competências
                </Button>
              }
            />
          )
        }
      />

      <div className="rounded-lg bg-status-info px-4 py-3 text-sm text-status-info-foreground">
        Crie e gerencie grupos de competência que ajudarão na organização e
        controle do RH para Avaliações de Desempenho.
      </div>

      <div className="flex gap-6 border-b border-border">
        <TabButton href="?aba=ativos" active={aba === "ativos"}>
          Ativos
        </TabButton>
        <TabButton href="?aba=arquivados" active={aba === "arquivados"}>
          Arquivados
        </TabButton>
      </div>

      <SearchInput placeholder="Pesquisar..." />

      {!grupos || grupos.length === 0 ? (
        <EmptyState title="Não há dados para mostrar." />
      ) : (
        <DataTable
          rows={grupos}
          rowKey={(g) => g.id}
          columns={[
            { header: "Nome", cell: (g) => g.nome },
            {
              header: "Categoria 9 box",
              cell: (g) => CATEGORIA_9BOX_LABEL_CURTO[g.categoria_9box],
            },
            ...(isAdmin
              ? [
                  {
                    header: "Ações",
                    className: "w-28 text-right",
                    cell: (g: (typeof grupos)[number]) => (
                      <div className="flex justify-end gap-1">
                        <GrupoCompetenciaDialog
                          tituloDialog="Editar grupo de competências"
                          action={atualizarGrupoCompetencia.bind(null, g.id)}
                          defaultValues={g}
                          trigger={
                            <Button variant="ghost" size="icon-sm">
                              <Pencil />
                              <span className="sr-only">Editar {g.nome}</span>
                            </Button>
                          }
                        />
                        {g.ativo ? (
                          <ConfirmActionButton
                            action={alternarArquivadoGrupoCompetencia.bind(null, g.id, false)}
                            trigger={
                              <Button variant="ghost" size="icon-sm">
                                <Archive />
                                <span className="sr-only">Arquivar {g.nome}</span>
                              </Button>
                            }
                            title={`Arquivar "${g.nome}"?`}
                            description="O grupo deixa de aparecer na aba Ativos, mas continua disponível em Arquivados."
                            confirmLabel="Arquivar"
                            successMessage="Grupo arquivado."
                          />
                        ) : (
                          <ConfirmActionButton
                            action={alternarArquivadoGrupoCompetencia.bind(null, g.id, true)}
                            trigger={
                              <Button variant="ghost" size="icon-sm">
                                <ArchiveRestore />
                                <span className="sr-only">Reativar {g.nome}</span>
                              </Button>
                            }
                            title={`Reativar "${g.nome}"?`}
                            confirmLabel="Reativar"
                            successMessage="Grupo reativado."
                          />
                        )}
                        <DeleteButton
                          itemLabel={`o grupo "${g.nome}"`}
                          action={excluirGrupoCompetencia.bind(null, g.id)}
                        />
                      </div>
                    ),
                  },
                ]
              : []),
          ]}
        />
      )}
    </div>
  );
}
