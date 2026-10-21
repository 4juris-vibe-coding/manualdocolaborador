import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EtapasWizard, ETAPAS_SOLICITAR_AVALIACAO } from "@/components/shared/etapas-wizard";
import { CicloEtapa1Form } from "@/components/forms/ciclo-etapa1-form";
import { CicloEtapa2Form } from "@/components/forms/ciclo-etapa2-form";
import { CicloEtapa3Form } from "@/components/forms/ciclo-etapa3-form";
import { CicloEtapa4Participantes } from "@/components/forms/ciclo-etapa4-participantes";

const ETAPAS_VALIDAS = ["criar", "escalas", "configuracoes", "solicitar"] as const;
type Etapa = (typeof ETAPAS_VALIDAS)[number];

export default async function EditarAvaliacaoPage(
  props: PageProps<"/avaliacao-desempenho/solicitar/[id]">,
) {
  await requireAdmin();
  const { id } = await props.params;
  const searchParams = await props.searchParams;

  const supabase = await createClient();
  const { data: ciclo } = await supabase.from("ciclos_avaliativos").select("*").eq("id", id).single();
  if (!ciclo) notFound();

  const etapaParam = typeof searchParams.etapa === "string" ? searchParams.etapa : "";
  const etapa: Etapa = ETAPAS_VALIDAS.includes(etapaParam as Etapa)
    ? (etapaParam as Etapa)
    : (ciclo.etapa_atual as Etapa) || "criar";

  let conteudo: React.ReactNode;

  if (etapa === "criar") {
    conteudo = <CicloEtapa1Form ciclo={ciclo} />;
  } else if (etapa === "escalas") {
    conteudo = <CicloEtapa2Form ciclo={ciclo} />;
  } else if (etapa === "configuracoes") {
    const [{ data: unidades }, { data: departamentos }, { data: cargos }] = await Promise.all([
      supabase.from("unidades").select("id, nome").order("nome"),
      supabase.from("departamentos").select("id, nome").order("nome"),
      supabase.from("cargos").select("id, nome").order("nome"),
    ]);
    conteudo = (
      <CicloEtapa3Form
        ciclo={ciclo}
        unidades={unidades ?? []}
        departamentos={departamentos ?? []}
        cargos={cargos ?? []}
      />
    );
  } else {
    const [{ data: participantes }, { data: colaboradores }] = await Promise.all([
      supabase
        .from("ciclo_avaliativo_participantes")
        .select("id, avaliador_id, avaliado_id")
        .eq("ciclo_id", ciclo.id),
      supabase.from("colaboradores").select("id, nome_completo, status").order("nome_completo"),
    ]);
    const nomePorId = new Map((colaboradores ?? []).map((c) => [c.id, c.nome_completo]));
    conteudo = (
      <CicloEtapa4Participantes
        cicloId={ciclo.id}
        tipoRelacao={ciclo.tipo_relacao}
        participantes={(participantes ?? []).map((p) => ({
          id: p.id,
          avaliadorNome: nomePorId.get(p.avaliador_id) ?? "—",
          avaliadoNome: nomePorId.get(p.avaliado_id) ?? "—",
        }))}
        colaboradores={(colaboradores ?? [])
          .filter((c) => c.status === "ativo")
          .map((c) => ({ id: c.id, nome: c.nome_completo }))}
      />
    );
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title={etapa === "solicitar" ? "Solicitar avaliação" : "Nova avaliação"} />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <Card>
          <CardContent>{conteudo}</CardContent>
        </Card>
        <EtapasWizard etapas={ETAPAS_SOLICITAR_AVALIACAO} etapaAtual={etapa} />
      </div>
    </div>
  );
}
