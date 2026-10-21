import { requireAuth } from "@/lib/auth/session";
import { PaginaEmConstrucao } from "@/components/shared/pagina-em-construcao";

export default async function MetricasDesligamentoPage() {
  await requireAuth();
  return <PaginaEmConstrucao titulo="Métricas de Desligamento" />;
}
