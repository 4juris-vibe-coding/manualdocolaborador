import Link from "next/link";
import { Download } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { DismissableBanner } from "@/components/shared/dismissable-banner";
import { MetricaCard } from "@/components/shared/metrica-card";
import { Card, CardContent, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DonutChart } from "@/components/ui/donut-chart";
import { CategoryBarChart } from "@/components/ui/category-bar-chart";
import { EmptyState } from "@/components/shared/empty-state";
import { formatCurrency } from "@/lib/format";
import { comCores } from "@/lib/metricas-colaborador";
import {
  buscarMetricasColaborador,
  buscarEstruturaOrganizacional,
} from "@/lib/metricas-colaborador-dados";

type Aba = "visao-geral" | "organizacao";

function textoParam(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : undefined;
}

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
          ? "border-b-2 border-primary px-1 pb-2 text-sm font-semibold text-primary"
          : "border-b-2 border-transparent px-1 pb-2 text-sm font-medium text-muted-foreground hover:text-foreground"
      }
    >
      {children}
    </Link>
  );
}

export default async function MetricasColaboradorPage(
  props: PageProps<"/metricas-colaborador">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const aba: Aba = textoParam(searchParams.aba) === "organizacao" ? "organizacao" : "visao-geral";

  const filtros = {
    unidade_id: textoParam(searchParams.unidade_id),
    departamento_id: textoParam(searchParams.departamento_id),
    cargo_id: textoParam(searchParams.cargo_id),
    superior_direto_id: textoParam(searchParams.superior_direto_id),
  };
  const semFiltro = !Object.values(filtros).some(Boolean);

  const supabase = await createClient();
  const [
    metricas,
    estrutura,
    { data: unidades },
    { data: departamentos },
    { data: cargos },
    { data: colaboradoresParaSuperior },
  ] = await Promise.all([
    aba === "visao-geral" ? buscarMetricasColaborador(supabase, filtros) : Promise.resolve(null),
    aba === "organizacao"
      ? buscarEstruturaOrganizacional(supabase, filtros)
      : Promise.resolve(null),
    supabase.from("unidades").select("id, nome").order("nome"),
    supabase.from("departamentos").select("id, nome").order("nome"),
    supabase.from("cargos").select("id, nome").order("nome"),
    supabase
      .from("colaboradores")
      .select("id, nome_completo")
      .eq("status", "ativo")
      .order("nome_completo"),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Métricas de Colaborador" />

      <div className="flex gap-6 border-b border-border">
        <TabButton href="?aba=visao-geral" active={aba === "visao-geral"}>
          Visão Geral
        </TabButton>
        <TabButton href="?aba=organizacao" active={aba === "organizacao"}>
          Organização e Estrutura
        </TabButton>
      </div>

      {aba === "organizacao" && estrutura ? (
        <>
          <DismissableBanner>
            Para garantir que os gráficos reflitam a realidade da sua empresa, é
            importante manter o cadastro dos seus colaboradores atualizado.
          </DismissableBanner>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Visão atual da estrutura organizacional: últimos 30 Dias
            </h2>
            <p className="text-sm text-muted-foreground">
              Estes gráficos mostram uma análise da distribuição de colaboradores
              por superior direto, departamento e unidade.
            </p>
          </div>

          <div className="flex flex-col gap-4">
            <MetricaCard titulo="Colaboradores por departamento">
              <CategoryBarChart data={estrutura.porDepartamento} />
            </MetricaCard>
            <MetricaCard titulo="Colaboradores por unidade">
              <CategoryBarChart data={estrutura.porUnidade} />
            </MetricaCard>
            <MetricaCard titulo="Colaboradores por superior direto">
              <CategoryBarChart data={estrutura.porSuperiorDireto} />
            </MetricaCard>
          </div>
        </>
      ) : null}

      {aba === "visao-geral" && metricas && (
        <>
          <DismissableBanner>
            Para garantir que os gráficos reflitam a realidade da sua empresa, é
            importante manter o cadastro dos seus colaboradores atualizado.
          </DismissableBanner>

          <div>
            <h2 className="text-base font-semibold text-foreground">Produtividade</h2>
            <p className="text-sm text-muted-foreground">
              Este indicador significa a divisão entre o Faturamento Bruto e o
              número de Funcionários ativos.
            </p>
            <div className="mt-3 grid gap-4 sm:grid-cols-3">
              {["Último mês", "Últimos 3 meses", "Últimos 6 meses"].map((periodo) => (
                <Card key={periodo}>
                  <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                    <CardDescription>{periodo}</CardDescription>
                    <CardTitle className="text-2xl text-primary">
                      {formatCurrency(0)}
                    </CardTitle>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <CardDescription>Total de Colaboradores Ativos</CardDescription>
                <CardTitle className="text-2xl text-primary">
                  {metricas.totalAtivos}
                </CardTitle>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex flex-col items-center gap-2 py-6 text-center">
                <CardDescription>Idade média dos colaboradores</CardDescription>
                <CardTitle className="text-2xl text-primary">
                  {metricas.idadeMedia}
                  <span className="ml-1 text-base font-normal text-muted-foreground">
                    anos
                  </span>
                </CardTitle>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardContent className="flex flex-col gap-4">
              <h2 className="text-base font-semibold text-foreground">Filtro</h2>
              <form method="GET" className="flex flex-col gap-4">
                <input type="hidden" name="aba" value="visao-geral" />
                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Unidade</label>
                    <Select
                      name="unidade_id"
                      items={(unidades ?? []).map((u) => ({ value: u.id, label: u.nome }))}
                      defaultValue={filtros.unidade_id}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todas as unidades" />
                      </SelectTrigger>
                      <SelectContent>
                        {(unidades ?? []).map((u) => (
                          <SelectItem key={u.id} value={u.id}>
                            {u.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Departamento</label>
                    <Select
                      name="departamento_id"
                      items={(departamentos ?? []).map((d) => ({ value: d.id, label: d.nome }))}
                      defaultValue={filtros.departamento_id}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos os departamentos" />
                      </SelectTrigger>
                      <SelectContent>
                        {(departamentos ?? []).map((d) => (
                          <SelectItem key={d.id} value={d.id}>
                            {d.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Cargo</label>
                    <Select
                      name="cargo_id"
                      items={(cargos ?? []).map((c) => ({ value: c.id, label: c.nome }))}
                      defaultValue={filtros.cargo_id}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos os cargos" />
                      </SelectTrigger>
                      <SelectContent>
                        {(cargos ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-foreground">Superior Direto</label>
                    <Select
                      name="superior_direto_id"
                      items={(colaboradoresParaSuperior ?? []).map((c) => ({
                        value: c.id,
                        label: c.nome_completo,
                      }))}
                      defaultValue={filtros.superior_direto_id}
                    >
                      <SelectTrigger className="w-full">
                        <SelectValue placeholder="Todos superiores" />
                      </SelectTrigger>
                      <SelectContent>
                        {(colaboradoresParaSuperior ?? []).map((c) => (
                          <SelectItem key={c.id} value={c.id}>
                            {c.nome_completo}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div className="flex items-center gap-4">
                    <Button type="submit">Filtrar</Button>
                    {!semFiltro && (
                      <Link
                        href="?aba=visao-geral"
                        className="text-sm text-primary underline underline-offset-2"
                      >
                        Limpar Filtros
                      </Link>
                    )}
                  </div>
                  <Button
                    variant="outline"
                    render={
                      <Link
                        href={`/metricas-colaborador/export?${new URLSearchParams(
                          Object.entries(filtros).filter(([, v]) => v) as [string, string][],
                        ).toString()}`}
                      />
                    }
                  >
                    <Download /> Exportar
                  </Button>
                </div>
              </form>
            </CardContent>
          </Card>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Métricas de Diversidade e Demografia
            </h2>
            <p className="text-sm text-muted-foreground">
              Análise detalhada de perfis de colaboradores por dados demográficos.
            </p>
            <div className="mt-3 grid gap-4 md:grid-cols-2">
              <MetricaCard titulo="Colaboradores por gênero">
                <DonutChart data={comCores(metricas.porGenero)} />
              </MetricaCard>
              <MetricaCard titulo="Colaboradores por raça/etnia">
                <DonutChart data={comCores(metricas.porRacaEtnia)} />
              </MetricaCard>
              <MetricaCard titulo="Colaboradores por grau hierárquico">
                <CategoryBarChart data={metricas.porGrauHierarquico} />
              </MetricaCard>
              <MetricaCard titulo="Estado civil dos colaboradores">
                <DonutChart data={comCores(metricas.porEstadoCivil)} />
              </MetricaCard>
              <MetricaCard titulo="Pessoas com deficiência">
                <DonutChart
                  data={[
                    { ...metricas.comDeficiencia[0], color: "var(--color-primary)" },
                    { ...metricas.comDeficiencia[1], color: "var(--color-accent)" },
                  ]}
                />
              </MetricaCard>
              <MetricaCard
                titulo="Colaboradores com e sem dependentes"
                info="Considera qualquer colaborador com pelo menos um dependente cadastrado na ficha."
              >
                <DonutChart
                  data={[
                    { ...metricas.comDependentes[0], color: "var(--color-primary)" },
                    { ...metricas.comDependentes[1], color: "var(--color-accent)" },
                  ]}
                />
              </MetricaCard>
              <MetricaCard titulo="Colaboradores por grupo de idade">
                <CategoryBarChart data={metricas.porGrupoIdade} />
              </MetricaCard>
              <MetricaCard titulo="Colaboradores por tempo de empresa">
                <CategoryBarChart data={metricas.porTempoEmpresa} />
              </MetricaCard>
            </div>
          </div>

          <div>
            <h2 className="text-base font-semibold text-foreground">
              Formação e contratos dos seus colaboradores
            </h2>
            <p className="text-sm text-muted-foreground">
              Níveis de educação e tipos de contrato na sua empresa.
            </p>
            <div className="mt-3 grid gap-4">
              <MetricaCard titulo="Colaboradores por escolaridade">
                <CategoryBarChart data={metricas.porEscolaridade} />
              </MetricaCard>
              <MetricaCard
                titulo="Distribuição por período de experiência"
                info="Considera só colaboradores em regime CLT (CLT, Temporário, Aprendiz) — PJ e Estágio não têm período de experiência."
              >
                <CategoryBarChart data={metricas.porPeriodoExperiencia} />
              </MetricaCard>
              <MetricaCard titulo="Colaboradores por tipo de contrato">
                <CategoryBarChart data={metricas.porTipoContrato} />
              </MetricaCard>
              <MetricaCard
                titulo="Número de logins no aplicativo por colaborador"
                info="O 4Juris RH não tem portal de autoatendimento pro colaborador (só o time de RH e gestores fazem login) — por isso essa tabela não se aplica aqui."
              >
                <EmptyState title="Não há resultados para essa busca" />
              </MetricaCard>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
