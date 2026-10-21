"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import {
  editarUsuarioSchema,
  novoUsuarioSchema,
  redefinirSenhaSchema,
} from "@/lib/validations/usuario";

export type FormState = { error?: string } | null;
export type SenhaFormState = { error?: string; success?: boolean } | null;

const BASE_PATH = "/configuracoes/usuarios";

export async function criarUsuario(
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  // requireAdmin usa o client normal (com RLS) — a checagem de papel
  // precisa acontecer ANTES de tocar no client de service role, que
  // ignora RLS por completo.
  await requireAdmin();

  const parsed = novoUsuarioSchema.safeParse({
    nome_completo: formData.get("nome_completo"),
    email: formData.get("email"),
    senha: formData.get("senha"),
    papel: formData.get("papel"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.createUser({
    email: parsed.data.email,
    password: parsed.data.senha,
    email_confirm: true,
    user_metadata: {
      nome_completo: parsed.data.nome_completo,
      papel: parsed.data.papel,
    },
  });
  if (error) {
    const jaExiste = error.message.toLowerCase().includes("already");
    return {
      error: jaExiste
        ? "Já existe um usuário com esse e-mail."
        : "Não foi possível criar o usuário.",
    };
  }

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function atualizarUsuario(
  id: string,
  _prevState: FormState,
  formData: FormData,
): Promise<FormState> {
  const admin = await requireAdmin();

  const parsed = editarUsuarioSchema.safeParse({
    nome_completo: formData.get("nome_completo"),
    papel: formData.get("papel"),
    ativo: formData.get("ativo") === "on",
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Dados inválidos." };
  }

  if (admin.id === id && !parsed.data.ativo) {
    return { error: "Você não pode desativar sua própria conta." };
  }

  const supabase = await createClient();
  const { error } = await supabase
    .from("perfis")
    .update(parsed.data)
    .eq("id", id);
  if (error) return { error: "Não foi possível salvar o usuário." };

  revalidatePath(BASE_PATH);
  redirect(BASE_PATH);
}

export async function redefinirSenha(
  id: string,
  _prevState: SenhaFormState,
  formData: FormData,
): Promise<SenhaFormState> {
  await requireAdmin();

  const parsed = redefinirSenhaSchema.safeParse({
    senha: formData.get("senha"),
  });
  if (!parsed.success) {
    return { error: parsed.error.issues[0]?.message ?? "Senha inválida." };
  }

  const admin = createAdminClient();
  const { error } = await admin.auth.admin.updateUserById(id, {
    password: parsed.data.senha,
  });
  if (error) return { error: "Não foi possível redefinir a senha." };

  return { success: true };
}
