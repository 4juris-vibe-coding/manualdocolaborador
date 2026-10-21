import { SemDadosMetrica } from "@/components/ui/donut-chart";

export type BarDatum = { label: string; value: number };

/** Barras horizontais simples pra distribuições com muitas categorias
 * (onde uma rosca ficaria poluída) — uma cor só (a categoria já está
 * identificada pelo rótulo à esquerda, não precisa de legenda extra). */
export function CategoryBarChart({
  data,
  cor = "var(--color-primary)",
}: {
  data: BarDatum[];
  cor?: string;
}) {
  const total = data.reduce((soma, d) => soma + d.value, 0);
  if (total === 0) return <SemDadosMetrica />;

  const maximo = Math.max(...data.map((d) => d.value));

  return (
    <div className="flex flex-col gap-3">
      {data.map((d) => (
        <div key={d.label} className="flex items-center gap-3">
          <span
            className="w-48 shrink-0 truncate text-sm text-muted-foreground"
            title={d.label}
          >
            {d.label}
          </span>
          <div className="h-3 flex-1 rounded-full bg-muted" title={`${d.label}: ${d.value} (${Math.round((d.value / total) * 100)}%)`}>
            <div
              className="h-3 rounded-full"
              style={{ width: `${maximo > 0 ? (d.value / maximo) * 100 : 0}%`, backgroundColor: cor }}
            />
          </div>
          <span className="w-10 shrink-0 text-right text-sm tabular-nums text-muted-foreground">
            {d.value}
          </span>
        </div>
      ))}
    </div>
  );
}
