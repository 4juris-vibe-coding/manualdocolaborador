import { UserPlus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { MetricaCard } from "@/components/shared/metrica-card";
import { CategoryBarChart } from "@/components/ui/category-bar-chart";
import { FiltroAnalisePerformance } from "@/components/forms/filtro-analise-performance";
import { AdicionarColaboradorPerformanceDialog } from "@/components/forms/adicionar-colaborador-performance-dialog";
import {
  RemoverColaboradorPerformanceButton,
  TrocarColunasButton,
} from "@/components/forms/analise-performance-controles";

type ColaboradorPerfil = {
  id: string;
  nome_completo: string;
  data_admissao: string;
  classificacao_performance: string | null;
  perfil_executor: number | null;
  perfil_comunicador: number | null;
  perfil_planejador: number | null;
  perfil_analista: number | null;
};

function anosDesde(dataISO: string) {
  const inicio = new Date(`${dataISO}T00:00:00`).getTime();
  const hoje = Date.now();
  return (hoje - inicio) / (1000 * 60 * 60 * 24 * 365.25);
}

function media(valores: number[]) {
  return valores.length > 0 ? valores.reduce((soma, v) => soma + v, 0) / valores.length : 0;
}

function ColunaPerformance({
  titulo,
  colaboradores,
}: {
  titulo: string;
  colaboradores: ColaboradorPerfil[];
}) {
  return (
    <div className="flex flex-1 flex-col gap-2">
      <h2 className="text-lg font-semibold text-foreground">{titulo}</h2>
      <div className="min-h-32 rounded-lg border border-dashed border-border p-3">
        {colaboradores.length === 0 ? (
          <p className="py-2 text-center text-sm text-muted-foreground">
            Nenhum colaborador nesta lista.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {colaboradores.map((c) => (
              <li
                key={c.id}
                className="flex items-center justify-between gap-2 rounded-md bg-muted px-3 py-1.5 text-sm"
              >
                <span className="truncate text-foreground">{c.nome_completo}</span>
                <RemoverColaboradorPerformanceButton colaboradorId={c.id} nome={c.nome_completo} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

function AnaliseGrupo({ titulo, colaboradores }: { titulo: string; colaboradores: ColaboradorPerfil[] }) {
  const tempoMedio = media(colaboradores.map((c) => anosDesde(c.data_admissao)));
  const perfilDados = [
    { label: "Executor", value: Math.round(media(colaboradores.map((c) => c.perfil_executor).filter((v): v is number => v != null))) },
    { label: "Comunicador", value: Math.round(media(colaboradores.map((c) => c.perfil_comunicador).filter((v): v is number => v != null))) },
    { label: "Planejador", value: Math.round(media(colaboradores.map((c) => c.perfil_planejador).filter((v): v is number => v != null))) },
    { label: "Analista", value: Math.round(media(colaboradores.map((c) => c.perfil_analista).filter((v): v is number => v != null))) },
  ];

  return (
    <MetricaCard
      titulo={titulo}
      info="Perfil comportamental médio (DISC) e tempo médio de casa dos colaboradores desta lista."
    >
      <p className="text-sm text-muted-foreground">
        {colaboradores.length} colaborador(es) · tempo médio de casa:{" "}
        <span className="font-medium text-foreground">{tempoMedio.toFixed(1)} anos</span>
      </p>
      <CategoryBarChart data={perfilDados} />
    </MetricaCard>
  );
}

export default async function AnalisePerformancePage(props: PageProps<"/analise-performance">) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const departamentoId =
    typeof searchParams.departamento_id === "string" && searchParams.departamento_id !== "todos"
      ? searchParams.departamento_id
      : undefined;
  const cargoId =
    typeof searchParams.cargo_id === "string" && searchParams.cargo_id !== "todos"
      ? searchParams.cargo_id
      : undefined;
  const analisar = searchParams.analisar === "1";

  const supabase = await createClient();

  let query = supabase
    .from("colaboradores")
    .select(
      "id, nome_completo, data_admissao, classificacao_performance, perfil_executor, perfil_comunicador, perfil_planejador, perfil_analista",
    )
    .eq("status", "ativo");
  if (departamentoId) query = query.eq("departamento_id", departamentoId);
  if (cargoId) query = query.eq("cargo_id", cargoId);

  const [{ data: colaboradores }, { data: departamentos }, { data: cargos }] = await Promise.all([
    query,
    supabase.from("departamentos").select("id, nome").order("nome"),
    supabase.from("cargos").select("id, nome").order("nome"),
  ]);

  const todos = colaboradores ?? [];
  const baixaPerformance = todos.filter((c) => c.classificacao_performance === "baixa");
  const altaPerformance = todos.filter((c) => c.classificacao_performance === "alta");
  const naoCategorizados = todos
    .filter((c) => !c.classificacao_performance)
    .map((c) => ({ id: c.id, nome: c.nome_completo }));

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Análise de Performance" />

      <Card>
        <CardContent className="flex flex-col gap-6">
          <FiltroAnalisePerformance
            departamentoAtual={departamentoId}
            cargoAtual={cargoId}
            departamentos={departamentos ?? []}
            cargos={cargos ?? []}
          />

          <AdicionarColaboradorPerformanceDialog
            naoCategorizados={naoCategorizados}
            trigger={
              <Button className="w-fit">
                <UserPlus /> Adicionar colaborador
              </Button>
            }
          />

          <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
            <ColunaPerformance titulo="Baixa performance" colaboradores={baixaPerformance} />
            <div className="flex justify-center pt-9 sm:pt-9">
              <TrocarColunasButton departamentoId={departamentoId} cargoId={cargoId} />
            </div>
            <ColunaPerformance titulo="Alta performance" colaboradores={altaPerformance} />
          </div>

          <form method="GET" className="w-fit">
            {departamentoId && <input type="hidden" name="departamento_id" value={departamentoId} />}
            {cargoId && <input type="hidden" name="cargo_id" value={cargoId} />}
            <input type="hidden" name="analisar" value="1" />
            <Button type="submit">Analisar</Button>
          </form>
        </CardContent>
      </Card>

      {analisar && (
        <div className="grid gap-4 sm:grid-cols-2">
          <AnaliseGrupo titulo="Baixa performance" colaboradores={baixaPerformance} />
          <AnaliseGrupo titulo="Alta performance" colaboradores={altaPerformance} />
        </div>
      )}
    </div>
  );
}
