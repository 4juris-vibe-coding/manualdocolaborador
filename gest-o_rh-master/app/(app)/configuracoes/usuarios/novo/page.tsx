import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { UsuarioForm } from "@/components/forms/usuario-form";
import { criarUsuario } from "../actions";

export default async function NovoUsuarioPage() {
  await requireAdmin();

  return (
    <FormPage>
      <PageHeader
        title="Novo Usuário"
        description="A pessoa vai poder entrar com este e-mail e senha; recomende trocar a senha no primeiro acesso."
      />
      <UsuarioForm action={criarUsuario} />
    </FormPage>
  );
}
