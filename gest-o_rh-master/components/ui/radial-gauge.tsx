/** Anel de progresso pra um valor único (0-100%) — diferente do
 * DonutChart (que quebra o total em várias categorias com legenda), este
 * é só "quanto desse um valor foi atingido". Uma cor só (magnitude, não
 * identidade), seguindo a regra do guia de dataviz de sequencial = 1 matiz. */
export function RadialGauge({
  percentual,
  size = 140,
  espessura = 14,
}: {
  percentual: number;
  size?: number;
  espessura?: number;
}) {
  const raio = (size - espessura) / 2;
  const circunferencia = 2 * Math.PI * raio;
  const fracao = Math.min(1, Math.max(0, percentual / 100));
  const offset = circunferencia * (1 - fracao);
  const centro = size / 2;

  return (
    <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
      <circle cx={centro} cy={centro} r={raio} fill="none" stroke="var(--color-muted)" strokeWidth={espessura} />
      {fracao > 0 && (
        <circle
          cx={centro}
          cy={centro}
          r={raio}
          fill="none"
          stroke="var(--color-primary)"
          strokeWidth={espessura}
          strokeLinecap="round"
          strokeDasharray={circunferencia}
          strokeDashoffset={offset}
          transform={`rotate(-90 ${centro} ${centro})`}
        />
      )}
      <text
        x={centro}
        y={centro}
        textAnchor="middle"
        dominantBaseline="central"
        className="fill-foreground text-lg font-semibold"
      >
        {percentual.toLocaleString("pt-BR", { minimumFractionDigits: 1, maximumFractionDigits: 1 })}%
      </text>
    </svg>
  );
}
