/**
 * Contador compacto "Rótulo [N]" ao lado do título da página — mesmo
 * padrão do cabeçalho do Sólides (ex.: "Ativos [12]  Inativos [3]"),
 * usado no lugar de cards grandes quando o número é só um resumo rápido.
 */
export function CountPill({ label, value }: { label: string; value: number }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-sm text-muted-foreground">
      {label}
      <span className="inline-flex min-w-5 items-center justify-center rounded-full bg-status-success-foreground px-1.5 py-0.5 text-xs font-semibold text-white">
        {value}
      </span>
    </span>
  );
}
