"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import type { FormState } from "@/app/(app)/metas/cadastro/actions";
import type { MetaRow } from "@/types/database.types";

export function MetaForm({
  action,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: Pick<MetaRow, "nome" | "codigo" | "descricao" | "valor_meta" | "mes_ano">;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/metas/cadastro" />}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nome">Nome*</FieldLabel>
            <Input id="nome" name="nome" defaultValue={defaultValues?.nome} required />
          </Field>

          <Field>
            <FieldLabel htmlFor="codigo">Código</FieldLabel>
            <Input id="codigo" name="codigo" defaultValue={defaultValues?.codigo ?? ""} />
          </Field>

          <Field>
            <FieldLabel htmlFor="descricao">Descrição*</FieldLabel>
            <Textarea
              id="descricao"
              name="descricao"
              rows={4}
              defaultValue={defaultValues?.descricao}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="valor_meta">Valor da Meta*</FieldLabel>
            <Input
              id="valor_meta"
              name="valor_meta"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={defaultValues?.valor_meta ?? undefined}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="mes_ano">Mês/Ano*</FieldLabel>
            <Input
              id="mes_ano"
              name="mes_ano"
              type="month"
              defaultValue={defaultValues?.mes_ano?.slice(0, 7)}
              required
            />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
