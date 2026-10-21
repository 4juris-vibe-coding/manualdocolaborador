import Link from "next/link";
import { Pencil, Plus, UserCog } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { Button } from "@/components/ui/button";

const PAPEL_LABEL: Record<string, string> = {
  admin_rh: "Administrador de RH",
  gestor: "Gestor",
};

export default async function UsuariosPage() {
  await requireAdmin();
  const supabase = await createClient();
  const { data: usuarios } = await supabase
    .from("perfis")
    .select("*")
    .order("nome_completo");

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Usuários do sistema"
        description="Quem pode acessar o 4Juris RH e com qual papel (Administrador de RH ou Gestor)."
        action={
          <Button render={<Link href="/configuracoes/usuarios/novo" />}>
            <Plus /> Novo Usuário
          </Button>
        }
      />

      {!usuarios || usuarios.length === 0 ? (
        <EmptyState
          icon={UserCog}
          title="Ainda não há outros usuários cadastrados"
          description="Crie contas para os demais membros do RH e para os gestores de cada departamento."
          action={
            <Button render={<Link href="/configuracoes/usuarios/novo" />}>
              <Plus /> Novo Usuário
            </Button>
          }
        />
      ) : (
        <DataTable
          rows={usuarios}
          rowKey={(u) => u.id}
          columns={[
            { header: "Nome", cell: (u) => u.nome_completo },
            { header: "E-mail", cell: (u) => u.email },
            { header: "Papel", cell: (u) => PAPEL_LABEL[u.papel] },
            {
              header: "Status",
              cell: (u) => (
                <StatusBadge tone={u.ativo ? "success" : "neutral"}>
                  {u.ativo ? "Ativo" : "Inativo"}
                </StatusBadge>
              ),
            },
            {
              header: "Ações",
              className: "w-16 text-right",
              cell: (u) => (
                <div className="flex justify-end">
                  <Button
                    variant="ghost"
                    size="icon-sm"
                    render={
                      <Link href={`/configuracoes/usuarios/${u.id}/editar`} />
                    }
                  >
                    <Pencil />
                    <span className="sr-only">Editar {u.nome_completo}</span>
                  </Button>
                </div>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
