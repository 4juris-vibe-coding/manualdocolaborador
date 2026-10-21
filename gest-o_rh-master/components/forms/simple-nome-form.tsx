"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";

export type SimpleFormState = { error?: string } | null;

/** Formulário genérico para os cadastros de apoio que têm só um campo
 * "nome" (Motivos de Demissão, Tipos de Registro). */
export function SimpleNomeForm({
  action,
  label,
  defaultNome,
  cancelHref,
}: {
  action: (
    state: SimpleFormState,
    formData: FormData,
  ) => Promise<SimpleFormState>;
  label: string;
  defaultNome?: string;
  cancelHref: string;
}) {
  const [state, formAction, pending] = useActionState<
    SimpleFormState,
    FormData
  >(action, null);

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref={cancelHref} />}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nome">{label}*</FieldLabel>
            <Input id="nome" name="nome" defaultValue={defaultNome} required />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
