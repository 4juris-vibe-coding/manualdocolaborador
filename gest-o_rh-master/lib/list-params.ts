export const ITENS_POR_PAGINA = 20;

/** Lê os parâmetros comuns de listagem (busca + página) vindos da URL e já
 * calcula o range para usar em `.range(from, to)` do Supabase. */
export function parseListParams(
  searchParams: Record<string, string | string[] | undefined>,
  itensPorPagina = ITENS_POR_PAGINA,
) {
  const q =
    typeof searchParams.q === "string" && searchParams.q.trim()
      ? searchParams.q.trim()
      : undefined;
  const paginaBruta = Number(searchParams.pagina);
  const pagina =
    Number.isFinite(paginaBruta) && paginaBruta > 0 ? Math.floor(paginaBruta) : 1;
  const from = (pagina - 1) * itensPorPagina;
  const to = from + itensPorPagina - 1;

  return { q, pagina, from, to, itensPorPagina };
}

export function totalDePaginas(totalRegistros: number, itensPorPagina = ITENS_POR_PAGINA) {
  return Math.max(1, Math.ceil(totalRegistros / itensPorPagina));
}

/** Normaliza searchParams (que podem vir como string[] em Next.js) para
 * Record<string, string> — usado pelo PaginationBar para remontar a URL. */
export function toFlatSearchParams(
  searchParams: Record<string, string | string[] | undefined>,
): Record<string, string | undefined> {
  const flat: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(searchParams)) {
    flat[key] = Array.isArray(value) ? value[0] : value;
  }
  return flat;
}
