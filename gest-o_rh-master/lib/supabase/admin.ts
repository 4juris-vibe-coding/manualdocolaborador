import "server-only";
import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

/**
 * Cliente Supabase com a Service Role Key — ignora Row Level Security e tem
 * acesso à Admin API do Auth (criar/editar/excluir usuários do sistema).
 *
 * `import "server-only"` garante que o build quebra se algum Client
 * Component acabar importando este módulo, evitando vazar a chave para o
 * navegador.
 *
 * NUNCA chame isso a partir de uma Server Action sem antes confirmar, com o
 * client normal (lib/supabase/server.ts) e RLS ativo, que quem está
 * chamando é de fato `admin_rh` — este client ignora RLS, então a checagem
 * de papel precisa ser explícita no código, não delegada ao banco.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    },
  );
}
