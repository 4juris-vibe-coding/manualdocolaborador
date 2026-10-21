import { requireAuth } from "@/lib/auth/session";
import { PaginaEmConstrucao } from "@/components/shared/pagina-em-construcao";

export default async function RelatorioGeralAvaliacaoPage() {
  await requireAuth();
  return <PaginaEmConstrucao titulo="Relatório Geral" />;
}
