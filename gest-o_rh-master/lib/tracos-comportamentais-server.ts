import "server-only";
import type { createClient } from "@/lib/supabase/server";

/** Junta todos os campos `traco_<chave>` de um FormData num record
 * { chave: valor }. Usado tanto no form de Cargo (perfil ideal) quanto
 * no de Colaborador (perfil real). */
export function parseTracosFormData(formData: FormData) {
  const tracos: Record<string, string> = {};
  for (const [chave, valor] of formData.entries()) {
    if (chave.startsWith("traco_")) {
      tracos[chave.slice("traco_".length)] = String(valor);
    }
  }
  return tracos;
}

/** Substitui o perfil comportamental (de um cargo ou colaborador) pelos
 * valores enviados — mais simples e robusto do que tentar casar quais
 * traços mudaram. `tabela`/`colunaId` apontam pra qual das duas tabelas
 * de traços (cargo_tracos_comportamentais ou
 * colaborador_tracos_comportamentais) e qual coluna referencia o dono. */
export async function salvarTracosComportamentais(
  supabase: Awaited<ReturnType<typeof createClient>>,
  tabela: "cargo_tracos_comportamentais" | "colaborador_tracos_comportamentais",
  donoId: string,
  tracos: Record<string, number> | undefined,
) {
  if (!tracos || Object.keys(tracos).length === 0) return;
  const linhas = Object.entries(tracos).map(([chave, valor]) => ({ chave, valor }));

  // Ramificado explicitamente (em vez de `[colunaId]: donoId` genérico)
  // porque o postgrest-js precisa do nome literal da tabela pra casar o
  // formato exato do insert — com união de tabelas ele não consegue
  // inferir qual das duas colunas FK esperar.
  if (tabela === "cargo_tracos_comportamentais") {
    await supabase
      .from(tabela)
      .upsert(
        linhas.map((l) => ({ ...l, cargo_id: donoId })),
        { onConflict: "cargo_id,chave" },
      );
  } else {
    await supabase
      .from(tabela)
      .upsert(
        linhas.map((l) => ({ ...l, colaborador_id: donoId })),
        { onConflict: "colaborador_id,chave" },
      );
  }
}
