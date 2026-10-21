import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { ConfiguracaoAvaliacaoExperienciaForm } from "@/components/forms/configuracao-avaliacao-experiencia-form";

export default async function ConfigurarAvaliacaoExperienciaPage() {
  await requireAdmin();

  const supabase = await createClient();
  const [{ data: config }, { data: cargos }] = await Promise.all([
    supabase.from("configuracao_avaliacao_experiencia").select("*").single(),
    supabase.from("cargos").select("id, nome").order("nome"),
  ]);

  // Singleton (1 linha só, semeada na migration) — o fallback abaixo só
  // entra em cena se, por algum motivo, essa linha ainda não existir.
  const configuracao = config ?? {
    id: true as const,
    habilitado: false,
    periodo_avaliativo: "90_dias" as const,
    tipos_contrato: null,
    cargo_ids: null,
    atualizado_em: new Date().toISOString(),
  };

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Avaliação do período de experiência" />
      <ConfiguracaoAvaliacaoExperienciaForm config={configuracao} cargos={cargos ?? []} />
    </div>
  );
}
