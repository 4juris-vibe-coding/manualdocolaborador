"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import type { FormState } from "@/app/(app)/unidades/actions";
import type { UnidadeRow } from "@/types/database.types";

export function UnidadeForm({
  action,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: Pick<UnidadeRow, "nome" | "endereco" | "telefone">;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/unidades" />}>
        <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nome">Nome*</FieldLabel>
          <Input
            id="nome"
            name="nome"
            defaultValue={defaultValues?.nome}
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="endereco">Endereço</FieldLabel>
          <Input
            id="endereco"
            name="endereco"
            defaultValue={defaultValues?.endereco ?? ""}
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
          <Input
            id="telefone"
            name="telefone"
            defaultValue={defaultValues?.telefone ?? ""}
          />
        </Field>

        {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
