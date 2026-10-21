import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase para uso em Server Components, Server Actions e Route
 * Handlers. Sempre respeita a sessão do usuário logado (cookies) e, por
 * consequência, a Row Level Security do banco — é a base de segurança do
 * app, junto com `lib/supabase/proxy.ts`.
 *
 * Crie uma instância nova a cada chamada (nunca reutilize entre requests).
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Chamado de dentro de um Server Component (não pode escrever
            // cookies). Sem problema: o proxy.ts já cuida de renovar a
            // sessão a cada request.
          }
        },
      },
    },
  );
}
