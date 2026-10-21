import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/proxy";

// A partir do Next.js 16, "Middleware" passou a se chamar "Proxy" (mesma
// funcionalidade, arquivo na raiz do projeto). Ver lib/supabase/proxy.ts
// para a lógica de sessão/redirecionamento.
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    // Rotas de API (ex.: /api/cron/*) cuidam da própria autenticação
    // (ex.: segredo do cron) — não fazem sentido redirecionadas pra
    // /login, já que quem chama não é um navegador com sessão.
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
