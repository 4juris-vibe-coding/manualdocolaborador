import { Activity, LogOut, UserPlus, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { EmptyState } from "@/components/shared/empty-state";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { calcularRotatividade, desligamentosPorMes } from "@/lib/turnover-calculo";
import { MonthlyBarChart } from "@/components/shared/monthly-bar-chart";

const JANELAS = [
  { dias: 30, label: "Últimos 30 dias" },
  { dias: 90, label: "Últimos 90 dias" },
  { dias: 365, label: "Últimos 12 meses" },
];

export default async function RotatividadePage() {
  await requireAdmin();
  const supabase = await createClient();

  const [{ data: colaboradores }, { data: departamentos }, { data: motivos }] =
    await Promise.all([
      supabase
        .from("colaboradores")
        .select("data_admissao, data_desligamento, departamento_id, motivo_desligamento_id"),
      supabase.from("departamentos").select("id, nome"),
      supabase.from("motivos_demissao").select("id, nome"),
    ]);

  const base = colaboradores ?? [];
  const nomeDepartamento = new Map((departamentos ?? []).map((d) => [d.id, d.nome]));
  const nomeMotivo = new Map((motivos ?? []).map((m) => [m.id, m.nome]));

  const resultados = JANELAS.map((janela) => ({
    ...janela,
    ...calcularRotatividade(base, janela.dias),
  }));

  const anual = resultados[resultados.length - 1];

  const porDepartamento = new Map<string, number>();
  const porMotivo = new Map<string, number>();
  for (const c of anual.desligados) {
    porDepartamento.set(
      c.departamento_id,
      (porDepartamento.get(c.departamento_id) ?? 0) + 1,
    );
    const chaveMotivo = c.motivo_desligamento_id ?? "sem-motivo";
    porMotivo.set(chaveMotivo, (porMotivo.get(chaveMotivo) ?? 0) + 1);
  }

  const linhasDepartamento = Array.from(porDepartamento.entries())
    .map(([id, total]) => ({ id, nome: nomeDepartamento.get(id) ?? "—", total }))
    .sort((a, b) => b.total - a.total);
  const linhasMotivo = Array.from(porMotivo.entries())
    .map(([id, total]) => ({
      id,
      nome: id === "sem-motivo" ? "Não informado" : nomeMotivo.get(id) ?? "—",
      total,
    }))
    .sort((a, b) => b.total - a.total);

  const serieMensal = desligamentosPorMes(base, 12);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Rotatividade"
        description="Taxa de turnover e desligamentos, por período, departamento e motivo."
      />

      <div className="grid gap-4 md:grid-cols-3">
        {resultados.map((r) => (
          <Card key={r.dias}>
            <CardHeader>
              <CardDescription className="flex items-center gap-1.5">
                <Activity className="size-4" /> {r.label}
              </CardDescription>
              <CardTitle className="text-3xl">{r.taxa.toFixed(1)}%</CardTitle>
            </CardHeader>
            <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <LogOut className="size-3.5" /> {r.desligamentos} desligamento(s)
              </span>
              <span className="flex items-center gap-1.5">
                <UserPlus className="size-3.5" /> {r.admissoes} admissão(ões)
              </span>
              <span className="flex items-center gap-1.5">
                <Users className="size-3.5" /> {Math.round(r.headcountMedio)}{" "}
                colaboradores em média
              </span>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Desligamentos por mês</CardTitle>
          <CardDescription>Últimos 12 meses.</CardDescription>
        </CardHeader>
        <CardContent>
          <MonthlyBarChart data={serieMensal} />
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Desligamentos por departamento (12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linhasDepartamento.length === 0 ? (
              <EmptyState icon={Activity} title="Nenhum desligamento no período" />
            ) : (
              <DataTable
                rows={linhasDepartamento}
                rowKey={(l) => l.id}
                columns={[
                  { header: "Departamento", cell: (l) => l.nome },
                  {
                    header: "Desligamentos",
                    className: "text-right tabular-nums",
                    cell: (l) => l.total,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">
              Desligamentos por motivo (12 meses)
            </CardTitle>
          </CardHeader>
          <CardContent>
            {linhasMotivo.length === 0 ? (
              <EmptyState icon={Activity} title="Nenhum desligamento no período" />
            ) : (
              <DataTable
                rows={linhasMotivo}
                rowKey={(l) => l.id}
                columns={[
                  { header: "Motivo", cell: (l) => l.nome },
                  {
                    header: "Desligamentos",
                    className: "text-right tabular-nums",
                    cell: (l) => l.total,
                  },
                ]}
              />
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
