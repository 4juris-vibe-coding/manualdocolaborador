import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { ImportarColaboradoresForm } from "@/components/forms/importar-colaboradores-form";

export default async function ImportarColaboradoresPage() {
  await requireAdmin();

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Importar Colaboradores"
        description="Cadastre vários colaboradores de uma vez a partir de um arquivo CSV."
      />
      <ImportarColaboradoresForm />
    </div>
  );
}
