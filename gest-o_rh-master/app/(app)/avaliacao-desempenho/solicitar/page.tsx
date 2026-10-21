import Link from "next/link";
import { Plus, Pencil, Eye } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";
import { DeleteButton } from "@/components/shared/delete-button";
import { excluirCicloRascunho } from "./actions";
import type { CicloAvaliativoRow } from "@/types/database.types";

const STATUS_LABEL: Record<string, string> = {
  rascunho: "Rascunho",
  ativo: "Ativa",
  encerrado: "Encerrada",
};
const STATUS_TONE: Record<string, StatusTone> = {
  rascunho: "neutral",
  ativo: "success",
  encerrado: "info",
};

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function SolicitarAvaliacaoPage() {
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";
  const supabase = await createClient();
  const { data: ciclos } = await supabase
    .from("ciclos_avaliativos")
    .select("*")
    .order("criado_em", { ascending: false });

  const lista = ciclos ?? [];

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Avaliações"
        action={
          isAdmin &&
          lista.length > 0 && (
            <Button render={<Link href="/avaliacao-desempenho/solicitar/novo" />}>
              <Plus /> Nova avaliação
            </Button>
          )
        }
      />

      {lista.length === 0 ? (
        <EmptyState
          title="Você ainda não criou nenhuma avaliação."
          description='Clique no botão "Nova avaliação" para iniciar a criação de uma Avaliação de desempenho.'
          action={
            isAdmin && (
              <Button render={<Link href="/avaliacao-desempenho/solicitar/novo" />}>
                <Plus /> Nova avaliação
              </Button>
            )
          }
        />
      ) : (
        <DataTable
          rows={lista}
          rowKey={(c) => c.id}
          columns={[
            { header: "Nome", cell: (c) => c.nome },
            {
              header: "Período",
              cell: (c) => `${formatarData(c.data_abertura)} — ${formatarData(c.data_encerramento)}`,
            },
            {
              header: "Status",
              cell: (c) => <StatusBadge tone={STATUS_TONE[c.status]}>{STATUS_LABEL[c.status]}</StatusBadge>,
            },
            ...(isAdmin
              ? [
                  {
                    header: "Ações",
                    className: "w-24 text-right",
                    cell: (c: CicloAvaliativoRow) => (
                      <div className="flex justify-end gap-1">
                        {c.status === "rascunho" ? (
                          <>
                            <Button
                              variant="ghost"
                              size="icon-sm"
                              render={
                                <Link
                                  href={`/avaliacao-desempenho/solicitar/${c.id}?etapa=${c.etapa_atual}`}
                                />
                              }
                            >
                              <Pencil />
                              <span className="sr-only">Continuar {c.nome}</span>
                            </Button>
                            <DeleteButton
                              action={excluirCicloRascunho.bind(null, c.id)}
                              itemLabel={`o rascunho "${c.nome}"`}
                            />
                          </>
                        ) : (
                          <Button
                            variant="ghost"
                            size="icon-sm"
                            render={
                              <Link href={`/avaliacao-desempenho/solicitar/${c.id}?etapa=solicitar`} />
                            }
                          >
                            <Eye />
                            <span className="sr-only">Ver participantes de {c.nome}</span>
                          </Button>
                        )}
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
