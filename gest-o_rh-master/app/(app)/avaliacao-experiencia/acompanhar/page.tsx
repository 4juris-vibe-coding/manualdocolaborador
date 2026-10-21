import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { FiltroAcompanharAvaliacoes } from "@/components/forms/filtro-acompanhar-avaliacoes";
import {
  STATUS_AVALIACAO_EXPERIENCIA_LABEL,
} from "@/lib/validations/acompanhar-avaliacao-experiencia";
import type { NivelRelatorioParticipacao } from "@/lib/validations/ciclo-avaliativo";
import type { AvaliacaoExperienciaRow } from "@/types/database.types";

const STATUS_TONE: Record<string, StatusTone> = {
  pendente: "warning",
  respondida: "success",
  expirada: "danger",
};

type Aba = "andamento" | "pendencia";

function TabButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className={
        active
          ? "border-b-2 border-primary px-1 pb-3 text-sm font-semibold text-primary"
          : "border-b-2 border-transparent px-1 pb-3 text-sm font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

function formatarData(data: string | null) {
  if (!data) return "—";
  return new Date(`${data}T00:00:00`).toLocaleDateString("pt-BR");
}

export default async function AcompanharAvaliacoesExperienciaPage(
  props: PageProps<"/avaliacao-experiencia/acompanhar">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;

  const abaParam = typeof searchParams.aba === "string" ? searchParams.aba : "";
  const aba: Aba = abaParam === "pendencia" ? "pendencia" : "andamento";
  const intervalo = typeof searchParams.intervalo === "string" ? searchParams.intervalo : "6";
  const periodo = typeof searchParams.periodo === "string" ? searchParams.periodo : "todos";
  const status = typeof searchParams.status === "string" ? searchParams.status : "todos";
  const nivel =
    typeof searchParams.nivel === "string"
      ? (searchParams.nivel as NivelRelatorioParticipacao)
      : undefined;
  const opcaoId = typeof searchParams.opcao_id === "string" ? searchParams.opcao_id : undefined;
  const q = typeof searchParams.q === "string" ? searchParams.q.trim() : undefined;

  const supabase = await createClient();

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = hoje.toISOString().slice(0, 10);
  const desde = new Date(hoje);
  desde.setMonth(desde.getMonth() - Number(intervalo || "6"));
  const desdeISO = desde.toISOString().slice(0, 10);

  let colaboradorIdsBusca: string[] | null = null;
  if (q) {
    const { data: encontrados } = await supabase
      .from("colaboradores")
      .select("id")
      .ilike("nome_completo", `%${q}%`);
    colaboradorIdsBusca = (encontrados ?? []).map((c) => c.id);
  }

  const campoNivel =
    nivel === "unidade" ? "unidade_id" : nivel === "departamento" ? "departamento_id" : "avaliador_id";
  const filtroBusca =
    colaboradorIdsBusca && colaboradorIdsBusca.length > 0
      ? `avaliado_id.in.(${colaboradorIdsBusca.join(",")}),avaliador_id.in.(${colaboradorIdsBusca.join(",")})`
      : undefined;
  const buscaSemResultado = colaboradorIdsBusca?.length === 0;

  let queryAndamento = supabase
    .from("avaliacoes_experiencia")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente")
    .gte("expira_em", hojeISO)
    .gte("data_referencia", desdeISO);
  let queryPendencia = supabase
    .from("avaliacoes_experiencia")
    .select("id", { count: "exact", head: true })
    .or(`status.eq.expirada,and(status.eq.pendente,expira_em.lt.${hojeISO})`)
    .gte("data_referencia", desdeISO);
  let queryLinhas =
    aba === "andamento"
      ? supabase
          .from("avaliacoes_experiencia")
          .select("*")
          .eq("status", "pendente")
          .gte("expira_em", hojeISO)
          .gte("data_referencia", desdeISO)
      : supabase
          .from("avaliacoes_experiencia")
          .select("*")
          .or(`status.eq.expirada,and(status.eq.pendente,expira_em.lt.${hojeISO})`)
          .gte("data_referencia", desdeISO);

  if (status !== "todos") {
    const statusValido = status as "pendente" | "respondida" | "expirada";
    queryAndamento = queryAndamento.eq("status", statusValido);
    queryPendencia = queryPendencia.eq("status", statusValido);
    queryLinhas = queryLinhas.eq("status", statusValido);
  }
  if (periodo !== "todos") {
    queryAndamento = queryAndamento.eq("periodo_dias", Number(periodo));
    queryPendencia = queryPendencia.eq("periodo_dias", Number(periodo));
    queryLinhas = queryLinhas.eq("periodo_dias", Number(periodo));
  }
  if (nivel && opcaoId) {
    queryAndamento = queryAndamento.eq(campoNivel, opcaoId);
    queryPendencia = queryPendencia.eq(campoNivel, opcaoId);
    queryLinhas = queryLinhas.eq(campoNivel, opcaoId);
  }
  if (buscaSemResultado) {
    queryAndamento = queryAndamento.eq("avaliado_id", "00000000-0000-0000-0000-000000000000");
    queryPendencia = queryPendencia.eq("avaliado_id", "00000000-0000-0000-0000-000000000000");
    queryLinhas = queryLinhas.eq("avaliado_id", "00000000-0000-0000-0000-000000000000");
  } else if (filtroBusca) {
    queryAndamento = queryAndamento.or(filtroBusca);
    queryPendencia = queryPendencia.or(filtroBusca);
    queryLinhas = queryLinhas.or(filtroBusca);
  }

  const [{ count: totalAndamento }, { count: totalPendencia }, { data: linhas }] = await Promise.all([
    queryAndamento,
    queryPendencia,
    queryLinhas.order("expira_em", { ascending: true }),
  ]);

  const idsColaboradores = new Set<string>();
  const idsCargos = new Set<string>();
  const idsDepartamentos = new Set<string>();
  for (const linha of linhas ?? []) {
    if (linha.avaliado_id) idsColaboradores.add(linha.avaliado_id);
    if (linha.avaliador_id) idsColaboradores.add(linha.avaliador_id);
    if (linha.cargo_id) idsCargos.add(linha.cargo_id);
    if (linha.departamento_id) idsDepartamentos.add(linha.departamento_id);
  }

  const [{ data: unidades }, { data: departamentos }, { data: colaboradoresTodos }] =
    await Promise.all([
      supabase.from("unidades").select("id, nome").order("nome"),
      supabase.from("departamentos").select("id, nome").order("nome"),
      supabase.from("colaboradores").select("id, nome_completo").order("nome_completo"),
    ]);

  const nomeColaborador = new Map((colaboradoresTodos ?? []).map((c) => [c.id, c.nome_completo]));
  const cargosMap = new Map<string, string>();
  const departamentosMap = new Map<string, string>();
  if (idsCargos.size > 0) {
    const { data } = await supabase.from("cargos").select("id, nome").in("id", [...idsCargos]);
    for (const c of data ?? []) cargosMap.set(c.id, c.nome);
  }
  if (idsDepartamentos.size > 0) {
    const { data } = await supabase
      .from("departamentos")
      .select("id, nome")
      .in("id", [...idsDepartamentos]);
    for (const d of data ?? []) departamentosMap.set(d.id, d.nome);
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Relatório geral e participação da Avaliação de Experiência" />

      <div className="flex gap-6 border-b border-border">
        <TabButton href="?aba=andamento" active={aba === "andamento"}>
          Avaliações em andamento ({totalAndamento ?? 0})
        </TabButton>
        <TabButton href="?aba=pendencia" active={aba === "pendencia"}>
          Avaliações com pendência ({totalPendencia ?? 0})
        </TabButton>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Filtrar relatório</CardTitle>
        </CardHeader>
        <CardContent>
          <FiltroAcompanharAvaliacoes
            aba={aba}
            intervaloAtual={intervalo}
            periodoAtual={periodo}
            statusAtual={status}
            nivelAtual={nivel}
            opcaoAtual={opcaoId}
            unidades={unidades ?? []}
            departamentos={departamentos ?? []}
            colaboradores={(colaboradoresTodos ?? []).map((c) => ({ id: c.id, nome: c.nome_completo }))}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Avaliações de experiência</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          <SearchInput placeholder="Pesquisar avaliador ou avaliado..." />

          {!linhas || linhas.length === 0 ? (
            <EmptyState title="Não há dados para mostrar." />
          ) : (
            <DataTable
              rows={linhas}
              rowKey={(l) => l.id}
              columns={[
                { header: "Avaliador", cell: (l) => nomeColaborador.get(l.avaliador_id ?? "") ?? "—" },
                { header: "Avaliado", cell: (l) => nomeColaborador.get(l.avaliado_id) ?? "—" },
                { header: "Cargo", cell: (l) => cargosMap.get(l.cargo_id ?? "") ?? "—" },
                {
                  header: "Departamento",
                  cell: (l) => departamentosMap.get(l.departamento_id ?? "") ?? "—",
                },
                { header: "Período av.", cell: (l) => `${l.periodo_dias} dias` },
                { header: "Expira em", cell: (l) => formatarData(l.expira_em) },
                {
                  header: "Notas Colab.",
                  cell: (l: AvaliacaoExperienciaRow) => (l.nota != null ? l.nota : "—"),
                },
                {
                  header: "Status",
                  cell: (l) => (
                    <StatusBadge tone={STATUS_TONE[l.status]}>
                      {STATUS_AVALIACAO_EXPERIENCIA_LABEL[l.status]}
                    </StatusBadge>
                  ),
                },
              ]}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
