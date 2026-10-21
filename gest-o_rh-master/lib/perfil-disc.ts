/** As 4 categorias do perfil comportamental DISC do Sólides, com as
 * mesmas cores usadas lá (e no filtro "FILTROS" da tela de Cargos).
 * Vive num módulo neutro (sem "use client") porque tanto Server
 * Components (Busca de Perfil) quanto Client Components (o slider)
 * precisam importar essa lista — um Server Component não consegue
 * importar valores de um módulo "use client". */
export const CATEGORIAS_DISC = [
  { chave: "executor", label: "Executor", cor: "#DC2626" },
  { chave: "comunicador", label: "Comunicador", cor: "#F59E0B" },
  { chave: "planejador", label: "Planejador", cor: "#16A34A" },
  { chave: "analista", label: "Analista", cor: "#2563EB" },
] as const;
