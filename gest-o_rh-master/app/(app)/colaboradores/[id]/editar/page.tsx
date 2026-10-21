import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { FormPage } from "@/components/shared/form-layout";
import { StatusBadge } from "@/components/shared/status-badge";
import { ColaboradorForm } from "@/components/forms/colaborador-form";
import { DesligarColaboradorDialog } from "@/components/forms/desligar-colaborador-dialog";
import { ReativarColaboradorButton } from "@/components/shared/reativar-colaborador-button";
import { formatDate } from "@/lib/format";
import {
  atualizarColaborador,
  desligarColaborador,
  reativarColaborador,
} from "../../actions";

export default async function EditarColaboradorPage(
  props: PageProps<"/colaboradores/[id]/editar">,
) {
  await requireAdmin();
  const { id } = await props.params;
  const supabase = await createClient();

  const [
    { data: colaborador },
    { data: cargos },
    { data: departamentos },
    { data: motivos },
    { data: colaboradores },
  ] = await Promise.all([
    supabase.from("colaboradores").select("*").eq("id", id).single(),
    supabase.from("cargos").select("id, nome").order("nome"),
    supabase.from("departamentos").select("id, nome").order("nome"),
    supabase
      .from("motivos_demissao")
      .select("id, nome")
      .eq("ativo", true)
      .order("nome"),
    supabase
      .from("colaboradores")
      .select("id, nome_completo")
      .eq("status", "ativo")
      .order("nome_completo"),
  ]);

  if (!colaborador) notFound();

  return (
    <FormPage>
      <div className="flex flex-wrap items-center justify-between gap-4">
        <PageHeader title={`Editar Colaborador — ${colaborador.nome_completo}`} />
        <div className="flex items-center gap-3">
          <StatusBadge tone={colaborador.status === "ativo" ? "success" : "neutral"}>
            {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
          </StatusBadge>
          {colaborador.status === "ativo" ? (
            <DesligarColaboradorDialog
              action={desligarColaborador.bind(null, id)}
              colaboradorNome={colaborador.nome_completo}
              motivos={motivos ?? []}
            />
          ) : (
            <ReativarColaboradorButton
              action={reativarColaborador.bind(null, id)}
              colaboradorNome={colaborador.nome_completo}
            />
          )}
        </div>
      </div>

      {colaborador.status === "inativo" && colaborador.data_desligamento && (
        <p className="text-sm text-muted-foreground">
          Desligado em {formatDate(colaborador.data_desligamento)}.
        </p>
      )}

      <ColaboradorForm
        action={atualizarColaborador.bind(null, id)}
        colaboradorId={id}
        cargos={cargos ?? []}
        departamentos={departamentos ?? []}
        colaboradores={colaboradores ?? []}
        defaultValues={colaborador}
      />
    </FormPage>
  );
}
