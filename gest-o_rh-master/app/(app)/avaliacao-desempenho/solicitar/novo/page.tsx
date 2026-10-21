import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { EtapasWizard, ETAPAS_SOLICITAR_AVALIACAO } from "@/components/shared/etapas-wizard";
import { CicloEtapa1Form } from "@/components/forms/ciclo-etapa1-form";

export default async function NovaAvaliacaoPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Nova avaliação" />
      <div className="grid gap-6 lg:grid-cols-[1fr_280px] lg:items-start">
        <Card>
          <CardContent>
            <CicloEtapa1Form />
          </CardContent>
        </Card>
        <EtapasWizard etapas={ETAPAS_SOLICITAR_AVALIACAO} etapaAtual="criar" />
      </div>
    </div>
  );
}
