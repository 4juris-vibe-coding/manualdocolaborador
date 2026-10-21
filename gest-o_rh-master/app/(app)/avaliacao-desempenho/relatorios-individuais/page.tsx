import { requireAuth } from "@/lib/auth/session";
import { PaginaEmConstrucao } from "@/components/shared/pagina-em-construcao";

export default async function RelatoriosIndividuaisPage() {
  await requireAuth();
  return <PaginaEmConstrucao titulo="Relatórios Individuais" />;
}
