import { CATEGORIAS_DISC } from "@/lib/perfil-disc";

/** Descobre qual das 4 categorias DISC predomina, a partir dos 4 valores
 * 0-100. Retorna undefined se nenhuma categoria foi definida ainda. */
export function categoriaDiscDominante(valores: {
  perfil_executor: number | null;
  perfil_comunicador: number | null;
  perfil_planejador: number | null;
  perfil_analista: number | null;
}) {
  const pontuadas = CATEGORIAS_DISC.map((cat) => ({
    ...cat,
    valor: valores[`perfil_${cat.chave}`],
  })).filter((cat): cat is (typeof CATEGORIAS_DISC)[number] & { valor: number } => cat.valor !== null);
  if (pontuadas.length === 0) return undefined;
  return pontuadas.reduce((maior, atual) => (atual.valor > maior.valor ? atual : maior));
}

/** Bolinha colorida + nome da categoria DISC — usado na coluna "Perfil"
 * das listagens (Cargos, e no futuro Colaboradores). */
export function PerfilDiscBadge({
  valores,
}: {
  valores: {
    perfil_executor: number | null;
    perfil_comunicador: number | null;
    perfil_planejador: number | null;
    perfil_analista: number | null;
  };
}) {
  const dominante = categoriaDiscDominante(valores);
  if (!dominante) return <span className="text-muted-foreground">—</span>;
  return (
    <span className="inline-flex items-center gap-1.5 font-medium" style={{ color: dominante.cor }}>
      <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: dominante.cor }} />
      {dominante.label}
    </span>
  );
}
