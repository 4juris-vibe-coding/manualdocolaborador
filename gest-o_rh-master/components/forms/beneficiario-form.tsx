"use client";

import { useActionState } from "react";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import { SearchSelect } from "@/components/shared/search-select";
import type { FormState } from "@/app/(app)/beneficios/beneficiarios/actions";

type Opcao = { id: string; nome: string };

export function BeneficiarioForm({
  action,
  colaboradores,
  beneficios,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  colaboradores: Opcao[];
  beneficios: Opcao[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/beneficios/beneficiarios" />}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="colaborador_id">Colaborador*</FieldLabel>
            <SearchSelect
              id="colaborador_id"
              name="colaborador_id"
              items={colaboradores.map((c) => ({ value: c.id, label: c.nome }))}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="beneficio_id">Benefício*</FieldLabel>
            <SearchSelect
              id="beneficio_id"
              name="beneficio_id"
              items={beneficios.map((b) => ({ value: b.id, label: b.nome }))}
              required
            />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
