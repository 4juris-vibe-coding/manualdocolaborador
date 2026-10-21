import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { toPdfResponse } from "@/lib/pdf";
import { buscarMetricasColaborador } from "@/lib/metricas-colaborador-dados";

/** Exporta um resumo em PDF das Métricas de Colaborador (respeita os
 * mesmos filtros aplicados na tela). */
export async function GET(request: Request) {
  await requireAuth();
  const params = new URL(request.url).searchParams;
  const filtros = {
    unidade_id: params.get("unidade_id") || undefined,
    departamento_id: params.get("departamento_id") || undefined,
    cargo_id: params.get("cargo_id") || undefined,
    superior_direto_id: params.get("superior_direto_id") || undefined,
  };

  const supabase = await createClient();
  const metricas = await buscarMetricasColaborador(supabase, filtros);

  const linhas: string[][] = [
    ["Total de Colaboradores Ativos", String(metricas.totalAtivos)],
    ["Idade média dos colaboradores", `${metricas.idadeMedia} anos`],
    ...metricas.porGenero.map((d) => [`Gênero — ${d.label}`, String(d.value)]),
    ...metricas.porRacaEtnia.map((d) => [`Raça/etnia — ${d.label}`, String(d.value)]),
    ...metricas.porGrauHierarquico.map((d) => [`Grau hierárquico — ${d.label}`, String(d.value)]),
    ...metricas.porEstadoCivil.map((d) => [`Estado civil — ${d.label}`, String(d.value)]),
    ...metricas.comDeficiencia.map((d) => [d.label, String(d.value)]),
    ...metricas.comDependentes.map((d) => [d.label, String(d.value)]),
    ...metricas.porGrupoIdade.map((d) => [`Grupo de idade — ${d.label}`, String(d.value)]),
    ...metricas.porTempoEmpresa.map((d) => [`Tempo de empresa — ${d.label}`, String(d.value)]),
    ...metricas.porEscolaridade.map((d) => [`Escolaridade — ${d.label}`, String(d.value)]),
    ...metricas.porPeriodoExperiencia.map((d) => [`Período de experiência — ${d.label}`, String(d.value)]),
    ...metricas.porTipoContrato.map((d) => [`Tipo de contrato — ${d.label}`, String(d.value)]),
  ];

  return toPdfResponse(
    "Métricas de Colaborador",
    ["Métrica", "Valor"],
    linhas,
    "metricas-colaborador.pdf",
  );
}
