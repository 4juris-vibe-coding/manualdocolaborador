import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";

/** Placeholder pra uma rota que já existe no menu mas ainda não tem os
 * prints de referência — evita 404 enquanto a página de verdade não vem
 * (ver conversa de 30/08 sobre "Desenv. e Performance": menu primeiro,
 * telas depois). */
export function PaginaEmConstrucao({ titulo }: { titulo: string }) {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={titulo} />
      <EmptyState
        title="Essa tela ainda não foi construída"
        description="Me manda os prints dessa página que eu construo igual às outras."
      />
    </div>
  );
}
