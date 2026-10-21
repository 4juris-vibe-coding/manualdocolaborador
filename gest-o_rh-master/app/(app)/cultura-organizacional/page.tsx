import { requireAuth } from "@/lib/auth/session";
import { PaginaEmConstrucao } from "@/components/shared/pagina-em-construcao";

export default async function CulturaOrganizacionalPage() {
  await requireAuth();
  return <PaginaEmConstrucao titulo="Cultura Organizacional" />;
}
