import Link from "next/link";
import { Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { TIPO_CHECKLIST_OPTIONS } from "@/lib/validations/checklist-topico";
import type { ChecklistTopicoRow, TipoChecklist } from "@/types/database.types";
import { excluirChecklistTopico } from "./actions";

function ColunaTopicos({
  tipo,
  label,
  topicos,
  isAdmin,
}: {
  tipo: TipoChecklist;
  label: string;
  topicos: ChecklistTopicoRow[];
  isAdmin: boolean;
}) {
  const doTipo = topicos.filter((t) => t.tipo === tipo);

  return (
    <div className="flex flex-col gap-2">
      <h2 className="text-base font-semibold text-foreground">{label}</h2>
      {doTipo.length === 0 ? (
        <p className="rounded-lg border border-dashed border-border p-4 text-sm text-muted-foreground">
          Nenhum tópico cadastrado.
        </p>
      ) : (
        <DataTable
          rows={doTipo}
          rowKey={(t) => t.id}
          columns={[
            { header: "Descrição", cell: (t) => t.descricao },
            {
              header: "Opções",
              className: "w-16 text-right",
              cell: (t) =>
                isAdmin && (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={<Link href={`/checklists/${t.id}/editar`} />}
                    >
                      <Pencil />
                      <span className="sr-only">Editar tópico</span>
                    </Button>
                    <DeleteButton
                      itemLabel={`o tópico "${t.descricao}"`}
                      action={excluirChecklistTopico.bind(null, t.id)}
                    />
                  </div>
                ),
            },
          ]}
        />
      )}
    </div>
  );
}

export default async function ChecklistsPage() {
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";

  const supabase = await createClient();
  const { data: topicos } = await supabase
    .from("checklist_topicos")
    .select("*")
    .order("criado_em");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Checklists"
        description="Tópicos usados nos roteiros de contratação e demissão de colaboradores."
        action={
          isAdmin && (
            <Button render={<Link href="/checklists/novo" />}>
              <Plus /> Novo Tópico
            </Button>
          )
        }
      />

      {!topicos || topicos.length === 0 ? (
        <EmptyState
          title="Ainda não há tópicos cadastrados"
          description="Cadastre o primeiro tópico de contratação ou demissão."
          action={
            isAdmin && (
              <Button render={<Link href="/checklists/novo" />}>
                <Plus /> Novo Tópico
              </Button>
            )
          }
        />
      ) : (
        <Card>
          <CardContent className="grid gap-6 md:grid-cols-2">
            {TIPO_CHECKLIST_OPTIONS.map((opcao) => (
              <ColunaTopicos
                key={opcao.value}
                tipo={opcao.value}
                label={opcao.label}
                topicos={topicos}
                isAdmin={isAdmin}
              />
            ))}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
