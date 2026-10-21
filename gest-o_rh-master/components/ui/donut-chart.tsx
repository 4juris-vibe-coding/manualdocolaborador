import { ImageOff } from "lucide-react";

export type DonutDatum = { label: string; value: number; color: string };

/** Estado vazio compacto, pensado pra caber dentro de um card de métrica
 * (diferente do EmptyState padrão, que é maior/pra página inteira). */
export function SemDadosMetrica() {
  return (
    <div className="flex flex-col items-center justify-center gap-2 py-8 text-center">
      <div className="flex size-10 items-center justify-center rounded-full bg-muted">
        <ImageOff className="size-5 text-muted-foreground" />
      </div>
      <p className="text-sm text-muted-foreground">
        Ainda não existem dados para serem exibidos.
      </p>
    </div>
  );
}

function paraCartesiano(cx: number, cy: number, raio: number, anguloGraus: number) {
  const anguloRad = ((anguloGraus - 90) * Math.PI) / 180;
  return { x: cx + raio * Math.cos(anguloRad), y: cy + raio * Math.sin(anguloRad) };
}

/** Fatia de rosca com um pequeno vão (2px) entre segmentos, ponta
 * arredondada — como pede o guia de dataviz. */
function fatiaPath(
  cx: number,
  cy: number,
  raioExterno: number,
  raioInterno: number,
  anguloInicio: number,
  anguloFim: number,
) {
  const folga = anguloFim - anguloInicio > 2 ? 1 : 0;
  const inicio = anguloInicio + folga;
  const fim = anguloFim - folga;
  const largeArc = fim - inicio > 180 ? 1 : 0;

  const p1 = paraCartesiano(cx, cy, raioExterno, inicio);
  const p2 = paraCartesiano(cx, cy, raioExterno, fim);
  const p3 = paraCartesiano(cx, cy, raioInterno, fim);
  const p4 = paraCartesiano(cx, cy, raioInterno, inicio);

  return [
    `M ${p1.x} ${p1.y}`,
    `A ${raioExterno} ${raioExterno} 0 ${largeArc} 1 ${p2.x} ${p2.y}`,
    `L ${p3.x} ${p3.y}`,
    `A ${raioInterno} ${raioInterno} 0 ${largeArc} 0 ${p4.x} ${p4.y}`,
    "Z",
  ].join(" ");
}

/** Gráfico de rosca com legenda "N% (qtd) Rótulo" — o mesmo formato usado
 * no Sólides pra distribuições categóricas pequenas. Tooltip nativo (via
 * <title>) em cada fatia; sem estado de hover em JS pra manter o
 * componente 100% renderizável no servidor. */
export function DonutChart({
  data,
  size = 140,
  espessura = 24,
}: {
  data: DonutDatum[];
  size?: number;
  espessura?: number;
}) {
  const total = data.reduce((soma, d) => soma + d.value, 0);
  if (total === 0) return <SemDadosMetrica />;

  const raioExterno = size / 2;
  const raioInterno = raioExterno - espessura;
  const fatias = data
    .filter((d) => d.value > 0)
    .reduce<Array<DonutDatum & { anguloInicio: number; anguloFim: number }>>((acc, d) => {
      const acumuladoAnterior = acc.length ? acc[acc.length - 1].anguloFim : 0;
      const anguloInicio = acumuladoAnterior;
      const anguloFim = anguloInicio + (d.value / total) * 360;
      acc.push({ ...d, anguloInicio, anguloFim });
      return acc;
    }, []);

  return (
    <div className="flex flex-col items-center gap-4 sm:flex-row">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        {fatias.map((f) => (
          <path
            key={f.label}
            d={fatiaPath(raioExterno, raioExterno, raioExterno, raioInterno, f.anguloInicio, f.anguloFim)}
            fill={f.color}
          >
            <title>{`${f.label}: ${f.value} (${Math.round((f.value / total) * 100)}%)`}</title>
          </path>
        ))}
        <text
          x={raioExterno}
          y={raioExterno}
          textAnchor="middle"
          dominantBaseline="central"
          className="fill-foreground text-lg font-semibold"
        >
          {total}
        </text>
      </svg>
      <ul className="flex flex-1 flex-col gap-1.5 text-sm">
        {data.map((d) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ backgroundColor: d.color }}
            />
            <span className="text-muted-foreground">
              {total > 0 ? Math.round((d.value / total) * 100) : 0}% ({d.value}){" "}
              {d.label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
