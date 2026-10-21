import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { MetricaCard } from "@/components/shared/metrica-card";
import { DonutChart } from "@/components/ui/donut-chart";
import { MesBarChart } from "@/components/ui/mes-bar-chart";
import { RadialGauge } from "@/components/ui/radial-gauge";
import { FiltroRelatorioGeralExperiencia } from "@/components/forms/filtro-relatorio-geral-experiencia";
import type { NivelRelatorioParticipacao } from "@/lib/validations/ciclo-avaliativo";

function EstatisticaCard({
  titulo,
  numerador,
  denominador,
}: {
  titulo: string;
  numerador: number;
  denominador: number;
}) {
  const percentual = denominador > 0 ? Math.round((numerador / denominador) * 100) : 0;
  return (
    <div className="flex flex-col items-center justify-center gap-2 rounded-lg border border-border p-8 text-center">
      <p className="text-sm font-semibold text-foreground">{titulo}</p>
      <p className="text-3xl font-bold text-primary">
        {numerador}
        <span className="text-base font-normal text-muted-foreground">/{denominador}</span>
      </p>
      <p className="text-sm text-muted-foreground">{percentual}%</p>
    </div>
  );
}

function chaveMs(data: Date) {
  return `${data.getFullYear()}-${String(data.getMonth() + 1).padStart(2, "0")}`;
}

export default async function RelatorioParticipacaoExperienciaPage(
  props: PageProps<"/avaliacao-experiencia/relatorio-participacao">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;

  const intervalo = typeof searchParams.intervalo === "string" ? searchParams.intervalo : "6";
  const periodo = typeof searchParams.periodo === "string" ? searchParams.periodo : "todos";
  const nivel =
    typeof searchParams.nivel === "string"
      ? (searchParams.nivel as NivelRelatorioParticipacao)
      : undefined;
  const opcaoId = typeof searchParams.opcao_id === "string" ? searchParams.opcao_id : undefined;

  const supabase = await createClient();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const desde = new Date(hoje);
  desde.setMonth(desde.getMonth() - Number(intervalo || "6"));
  const desdeISO = desde.toISOString().slice(0, 10);

  let query = supabase
    .from("avaliacoes_experiencia")
    .select("id, status, avaliador_id, avaliado_id, nota, respondido_em, periodo_dias")
    .gte("data_referencia", desdeISO);
  if (periodo !== "todos") query = query.eq("periodo_dias", Number(periodo));
  if (nivel && opcaoId) {
    const campo =
      nivel === "unidade" ? "unidade_id" : nivel === "departamento" ? "departamento_id" : "avaliador_id";
    query = query.eq(campo, opcaoId);
  }

  const [{ data: linhas }, { data: unidades }, { data: departamentos }, { data: colaboradoresTodos }] =
    await Promise.all([
      query,
      supabase.from("unidades").select("id, nome").order("nome"),
      supabase.from("departamentos").select("id, nome").order("nome"),
      supabase.from("colaboradores").select("id, nome_completo").order("nome_completo"),
    ]);

  const dados = linhas ?? [];
  const total = dados.length;
  const respondidas = dados.filter((l) => l.status === "respondida").length;
  const pendentes = dados.filter((l) => l.status === "pendente").length;
  const expiradas = dados.filter((l) => l.status === "expirada").length;
  const avaliadoresTotal = new Set(dados.map((l) => l.avaliador_id).filter(Boolean)).size;
  const avaliadoresComPendencia = new Set(
    dados.filter((l) => l.status === "pendente" || l.status === "expirada").map((l) => l.avaliador_id).filter(Boolean),
  ).size;

  const notasValidas = dados.filter((l) => l.status === "respondida" && l.nota != null);
  const notaMedia =
    notasValidas.length > 0
      ? notasValidas.reduce((soma, l) => soma + Number(l.nota), 0) / notasValidas.length
      : 0;

  // Participações por mês: um balde por mês dentro do intervalo, contando
  // avaliações respondidas pela data em que a resposta chegou.
  const meses: { chave: string; label: string }[] = [];
  const cursor = new Date(desde.getFullYear(), desde.getMonth(), 1);
  const fimCursor = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  while (cursor <= fimCursor) {
    meses.push({
      chave: chaveMs(cursor),
      label: cursor.toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }).replace(".", ""),
    });
    cursor.setMonth(cursor.getMonth() + 1);
  }
  const contagemPorMes = new Map(meses.map((m) => [m.chave, 0]));
  for (const l of dados) {
    if (l.status !== "respondida" || !l.respondido_em) continue;
    const chave = chaveMs(new Date(l.respondido_em));
    if (contagemPorMes.has(chave)) contagemPorMes.set(chave, (contagemPorMes.get(chave) ?? 0) + 1);
  }
  const dadosPorMes = meses.map((m) => ({ label: m.label, value: contagemPorMes.get(m.chave) ?? 0 }));

  // Efetivações: dos colaboradores avaliados neste recorte, quantos
  // seguem ativos (efetivados) vs foram desligados (não efetivados).
  const idsAvaliados = [...new Set(dados.map((l) => l.avaliado_id))];
  let efetivados = 0;
  let naoEfetivados = 0;
  if (idsAvaliados.length > 0) {
    const { data: colaboradoresAvaliados } = await supabase
      .from("colaboradores")
      .select("id, status")
      .in("id", idsAvaliados);
    for (const c of colaboradoresAvaliados ?? []) {
      if (c.status === "ativo") efetivados += 1;
      else naoEfetivados += 1;
    }
  }
  const totalEfetivacoes = efetivados + naoEfetivados;

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Relatório geral e participação da Avaliação de Experiência" />

      <Card>
        <CardHeader>
          <CardTitle>Filtrar relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <FiltroRelatorioGeralExperiencia
            intervaloAtual={intervalo}
            periodoAtual={periodo}
            nivelAtual={nivel}
            opcaoAtual={opcaoId}
            unidades={unidades ?? []}
            departamentos={departamentos ?? []}
            colaboradores={(colaboradoresTodos ?? []).map((c) => ({ id: c.id, nome: c.nome_completo }))}
          />
        </CardContent>
      </Card>

      <div>
        <h2 className="mb-3 text-base font-semibold text-foreground">Engajamento</h2>
        <div className="grid gap-4 sm:grid-cols-2">
          <EstatisticaCard titulo="Avaliações respondidas" numerador={respondidas} denominador={total} />
          <EstatisticaCard titulo="Avaliações pendentes" numerador={pendentes} denominador={total} />
          <EstatisticaCard
            titulo="Avaliadores com pendência"
            numerador={avaliadoresComPendencia}
            denominador={avaliadoresTotal}
          />
          <EstatisticaCard titulo="Avaliações expiradas" numerador={expiradas} denominador={total} />
        </div>
      </div>

      <MetricaCard titulo="Participações por mês">
        <MesBarChart data={dadosPorMes} />
      </MetricaCard>

      <div className="grid gap-4 lg:grid-cols-[280px_1fr]">
        <MetricaCard
          titulo="Nota média"
          info="Média das notas atribuídas nas avaliações de período de experiência já respondidas, dentro do recorte filtrado."
        >
          <div className="flex justify-center py-2">
            <RadialGauge percentual={notaMedia} />
          </div>
        </MetricaCard>

        <MetricaCard titulo="Efetivações após o período de experiência">
          {totalEfetivacoes === 0 ? (
            <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
              Nenhum resultado encontrado!
            </div>
          ) : (
            <DonutChart
              data={[
                { label: "Efetivado", value: efetivados, color: "var(--color-primary)" },
                { label: "Não efetivado", value: naoEfetivados, color: "var(--color-accent)" },
              ]}
            />
          )}
        </MetricaCard>
      </div>
    </div>
  );
}
