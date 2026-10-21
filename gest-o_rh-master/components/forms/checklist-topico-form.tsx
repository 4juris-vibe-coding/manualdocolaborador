"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { TIPO_CHECKLIST_OPTIONS } from "@/lib/validations/checklist-topico";
import type { FormState } from "@/app/(app)/checklists/actions";
import type { ChecklistTopicoRow } from "@/types/database.types";

export function ChecklistTopicoForm({
  action,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: Pick<ChecklistTopicoRow, "descricao" | "tipo">;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/checklists" />}>
        <Field>
          <FieldLabel htmlFor="descricao">Descrição*</FieldLabel>
          <Input
            id="descricao"
            name="descricao"
            defaultValue={defaultValues?.descricao}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="tipo">Tipo*</FieldLabel>
          <Select
            name="tipo"
            items={TIPO_CHECKLIST_OPTIONS}
            defaultValue={defaultValues?.tipo}
            required
          >
            <SelectTrigger id="tipo" className="w-full">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {TIPO_CHECKLIST_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        {state?.error && <FieldError>{state.error}</FieldError>}
      </FormCard>
    </form>
  );
}
