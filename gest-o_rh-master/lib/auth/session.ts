import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { PerfilRow } from "@/types/database.types";

/**
 * Data Access Layer de autenticação/autorização (ver guia oficial do
 * Next.js: app/guides/authentication). Centraliza a checagem de sessão para
 * que toda Server Action e toda página protegida chamem a mesma função —
 * evita esquecer a checagem em algum lugar novo.
 *
 * `cache()` evita repetir a consulta em `perfis` várias vezes durante o
 * mesmo request quando várias partes da árvore chamam getPerfil().
 */
export const getPerfil = cache(async (): Promise<PerfilRow | null> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;

  const { data } = await supabase
    .from("perfis")
    .select("*")
    .eq("id", user.id)
    .single();

  return data;
});

/** Usa em toda página/Server Action protegida. Redireciona para /login se
 * não houver sessão válida. A garantia real de segurança continua sendo a
 * RLS no banco — isto é só a checagem de UX/roteamento. */
export async function requireAuth(): Promise<PerfilRow> {
  const perfil = await getPerfil();
  if (!perfil) redirect("/login");
  return perfil;
}

/** Usa em telas/ações exclusivas de admin_rh (ex.: Configurações >
 * Usuários, criar/excluir colaborador). */
export async function requireAdmin(): Promise<PerfilRow> {
  const perfil = await requireAuth();
  if (perfil.papel !== "admin_rh") redirect("/dashboard");
  return perfil;
}

/** IDs dos departamentos que o usuário logado gerencia (vazio para
 * admin_rh, que não precisa dessa lista — já enxerga tudo). */
export async function getManagedDepartmentIds(): Promise<string[]> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("managed_department_ids");
  if (error) throw error;
  return data ?? [];
}
