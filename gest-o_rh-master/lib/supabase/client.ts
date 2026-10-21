import { createBrowserClient } from "@supabase/ssr";
import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase para uso em Client Components. Usar com moderação — a
 * maior parte das leituras/mutações do app passa por Server Components e
 * Server Actions (lib/supabase/server.ts), que já carregam a sessão via
 * cookies. Este client serve para interações puramente no navegador (ex.:
 * preview de importação de planilha antes de confirmar o envio).
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
  );
}
