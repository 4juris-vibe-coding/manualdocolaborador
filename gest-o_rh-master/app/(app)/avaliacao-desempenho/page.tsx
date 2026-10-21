import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FiltroRelatorioParticipacao } from "@/components/forms/filtro-relatorio-participacao";

export default async function AvaliacaoDesempenhoDashboardPage(
  props: PageProps<"/avaliacao-desempenho">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const cicloId = typeof searchParams.ciclo_id === "string" ? searchParams.ciclo_id : undefined;

  const supabase = await createClient();
  const [{ data: ciclos }, { data: unidades }, { data: departamentos }, { data: colaboradores }] =
    await Promise.all([
      supabase.from("ciclos_avaliativos").select("id, nome").order("criado_em", { ascending: false }),
      supabase.from("unidades").select("id, nome").order("nome"),
      supabase.from("departamentos").select("id, nome").order("nome"),
      supabase
        .from("colaboradores")
        .select("id, nome_completo")
        .eq("status", "ativo")
        .order("nome_completo"),
    ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Dashboard Relatório de Participação" />

      <div className="rounded-lg bg-status-info px-4 py-3 text-center text-sm text-status-info-foreground">
        Interaja com os dados exibidos para mais detalhes.
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <FiltroRelatorioParticipacao
            ciclos={ciclos ?? []}
            cicloAtual={cicloId}
            statusAtual={typeof searchParams.status === "string" ? searchParams.status : undefined}
            nivelAtual={typeof searchParams.nivel === "string" ? searchParams.nivel : undefined}
            opcaoAtual={typeof searchParams.opcao_id === "string" ? searchParams.opcao_id : undefined}
            unidades={unidades ?? []}
            departamentos={departamentos ?? []}
            colaboradores={(colaboradores ?? []).map((c) => ({ id: c.id, nome: c.nome_completo }))}
          />
        </CardContent>
      </Card>

      {cicloId && (
        <EmptyState title="Não há dados para mostrar." />
      )}
    </div>
  );
}
