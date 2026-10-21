import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, TipoContratoColaborador } from "@/types/database.types";

const PERIODOS_POR_CONFIG: Record<string, number[]> = {
  "90_dias": [90],
  "45_e_90_dias": [45, 90],
  "30_60_e_90_dias": [30, 60, 90],
};

function paraDataISO(data: Date) {
  return data.toISOString().slice(0, 10);
}

/**
 * Gera as avaliações de período de experiência que "vencem" a partir de
 * hoje, a partir da configuração em configuracao_avaliacao_experiencia
 * (Configurar Avaliação): pra cada colaborador ativo elegível e cada
 * checkpoint (30/45/60/90 dias após a admissão), cria a linha em
 * avaliacoes_experiencia quando faltam <= 7 dias pro checkpoint — mesmo
 * prazo de envio do formulário descrito na tela de configuração — e ainda
 * não existe uma linha pra aquele par colaborador+período (idempotente via
 * `unique (avaliado_id, periodo_dias)`).
 *
 * Também marca como "expirada" toda avaliação "pendente" cujo prazo
 * (expira_em) já passou. Chamada pela rota de cron
 * `/api/cron/gerar-avaliacoes-experiencia` — ver esse arquivo pra como
 * ela é agendada (vercel.json).
 */
export async function gerarAvaliacoesExperiencia(supabase: SupabaseClient<Database>) {
  const { data: config } = await supabase
    .from("configuracao_avaliacao_experiencia")
    .select("*")
    .single();
  if (!config || !config.habilitado) {
    return { geradas: 0, expiradas: 0, motivo: "Envio automático desabilitado." };
  }

  const periodos = PERIODOS_POR_CONFIG[config.periodo_avaliativo] ?? [90];

  const { data: colaboradores } = await supabase
    .from("colaboradores")
    .select(
      "id, data_admissao, tipo_contrato, cargo_id, departamento_id, unidade_id, superior_direto_id",
    )
    .eq("status", "ativo");

  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  const hojeISO = paraDataISO(hoje);

  const linhas: Database["public"]["Tables"]["avaliacoes_experiencia"]["Insert"][] = [];
  for (const colaborador of colaboradores ?? []) {
    if (
      config.tipos_contrato &&
      config.tipos_contrato.length > 0 &&
      !config.tipos_contrato.includes(colaborador.tipo_contrato as TipoContratoColaborador)
    ) {
      continue;
    }
    if (
      config.cargo_ids &&
      config.cargo_ids.length > 0 &&
      !config.cargo_ids.includes(colaborador.cargo_id)
    ) {
      continue;
    }

    for (const dias of periodos) {
      const referencia = new Date(`${colaborador.data_admissao}T00:00:00`);
      referencia.setDate(referencia.getDate() + dias);
      // Envia o formulário 7 dias antes do checkpoint — só gera a linha
      // quando já estamos dentro dessa janela.
      const envioEm = new Date(referencia);
      envioEm.setDate(envioEm.getDate() - 7);
      if (envioEm > hoje) continue;

      linhas.push({
        avaliado_id: colaborador.id,
        avaliador_id: colaborador.superior_direto_id,
        cargo_id: colaborador.cargo_id,
        departamento_id: colaborador.departamento_id,
        unidade_id: colaborador.unidade_id,
        periodo_dias: dias,
        data_referencia: paraDataISO(referencia),
        expira_em: paraDataISO(referencia),
      });
    }
  }

  let geradas = 0;
  if (linhas.length > 0) {
    const { data, error } = await supabase
      .from("avaliacoes_experiencia")
      .upsert(linhas, { onConflict: "avaliado_id,periodo_dias", ignoreDuplicates: true })
      .select("id");
    if (error) throw error;
    geradas = data?.length ?? 0;
  }

  const { data: expiradas, error: erroExpirar } = await supabase
    .from("avaliacoes_experiencia")
    .update({ status: "expirada" })
    .eq("status", "pendente")
    .lt("expira_em", hojeISO)
    .select("id");
  if (erroExpirar) throw erroExpirar;

  return { geradas, expiradas: expiradas?.length ?? 0 };
}
