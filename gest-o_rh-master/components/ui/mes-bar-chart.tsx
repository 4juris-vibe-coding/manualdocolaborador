export type MesDatum = { label: string; value: number };

/** Colunas verticais ancoradas na base, uma por mês — pra tendência ao
 * longo do tempo (diferente do CategoryBarChart, que é horizontal e pra
 * categorias nomeadas sem ordem cronológica). */
export function MesBarChart({ data }: { data: MesDatum[] }) {
  const total = data.reduce((soma, d) => soma + d.value, 0);
  if (total === 0) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-muted-foreground">
        Nenhum resultado encontrado!
      </div>
    );
  }

  const maximo = Math.max(...data.map((d) => d.value), 1);

  return (
    <div className="flex items-end gap-3 overflow-x-auto pb-1">
      {data.map((d) => (
        <div key={d.label} className="flex min-w-12 flex-1 flex-col items-center gap-2">
          <span className="text-xs tabular-nums text-muted-foreground">{d.value}</span>
          <div className="flex h-36 w-full flex-col-reverse overflow-hidden rounded-t-sm bg-muted">
            <div
              className="w-full rounded-t-sm"
              style={{
                height: `${(d.value / maximo) * 100}%`,
                backgroundColor: "var(--color-primary)",
              }}
            />
          </div>
          <span className="text-xs text-muted-foreground">{d.label}</span>
        </div>
      ))}
    </div>
  );
}
