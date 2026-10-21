import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { EditarUsuarioForm } from "@/components/forms/editar-usuario-form";
import { RedefinirSenhaForm } from "@/components/forms/redefinir-senha-form";
import { atualizarUsuario, redefinirSenha } from "../../actions";

export default async function EditarUsuarioPage(
  props: PageProps<"/configuracoes/usuarios/[id]/editar">,
) {
  const admin = await requireAdmin();
  const { id } = await props.params;

  const supabase = await createClient();
  const { data: usuario } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", id)
    .single();

  if (!usuario) notFound();

  return (
    <FormPage className="gap-8">
      <div>
        <PageHeader title={`Editar Usuário — ${usuario.nome_completo}`} />
        <div className="mt-6">
          <EditarUsuarioForm
            action={atualizarUsuario.bind(null, id)}
            defaultValues={usuario}
            isSelf={admin.id === id}
          />
        </div>
      </div>

      <div>
        <h2 className="text-base font-semibold text-foreground">Senha de acesso</h2>
        <p className="mb-4 text-sm text-muted-foreground">
          Defina uma nova senha para este usuário.
        </p>
        <RedefinirSenhaForm action={redefinirSenha.bind(null, id)} />
      </div>
    </FormPage>
  );
}
