"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import {
  TIPO_BENEFICIO_OPTIONS,
  APLICADO_COMO_OPTIONS,
  PERIODICIDADE_BENEFICIO_OPTIONS,
  OPCAO_DESCONTO_OPTIONS,
} from "@/lib/validations/beneficio";
import type { FormState } from "@/app/(app)/beneficios/cadastro-beneficios/actions";
import type { BeneficioRow } from "@/types/database.types";

export function BeneficioForm({
  action,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: Pick<
    BeneficioRow,
    | "nome"
    | "tipo"
    | "valor_beneficio"
    | "aplicado_como"
    | "periodicidade"
    | "valor_descontado"
    | "opcao_desconto"
  >;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(action, null);

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/beneficios/cadastro-beneficios" />}>
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="nome">Nome do Benefício*</FieldLabel>
            <Input id="nome" name="nome" defaultValue={defaultValues?.nome} required />
          </Field>

          <Field>
            <FieldLabel htmlFor="tipo">Tipo de Benefício*</FieldLabel>
            <Select name="tipo" items={TIPO_BENEFICIO_OPTIONS} defaultValue={defaultValues?.tipo} required>
              <SelectTrigger id="tipo" className="w-full">
                <SelectValue placeholder="Pesquisar" />
              </SelectTrigger>
              <SelectContent>
                {TIPO_BENEFICIO_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    {option.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>

          <Field>
            <FieldLabel htmlFor="valor_beneficio">Valor do Benefício*</FieldLabel>
            <Input
              id="valor_beneficio"
              name="valor_beneficio"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={defaultValues?.valor_beneficio ?? undefined}
              required
            />
          </Field>

          <Field>
            <FieldLabel>Benefício aplicado como*</FieldLabel>
            <RadioGroup
              name="aplicado_como"
              defaultValue={defaultValues?.aplicado_como ?? "reais"}
              className="flex flex-col gap-2"
            >
              {APLICADO_COMO_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel>Periodicidade*</FieldLabel>
            <RadioGroup
              name="periodicidade"
              defaultValue={defaultValues?.periodicidade ?? "mensal"}
              className="flex flex-wrap gap-4"
            >
              {PERIODICIDADE_BENEFICIO_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="valor_descontado">Valor Descontado</FieldLabel>
            <Input
              id="valor_descontado"
              name="valor_descontado"
              type="number"
              step="0.01"
              min="0"
              placeholder="0,00"
              defaultValue={defaultValues?.valor_descontado ?? undefined}
            />
          </Field>

          <Field>
            <FieldLabel>Opção de Desconto</FieldLabel>
            <RadioGroup
              name="opcao_desconto"
              defaultValue={defaultValues?.opcao_desconto ?? undefined}
              className="flex flex-col gap-2"
            >
              {OPCAO_DESCONTO_OPTIONS.map((option) => (
                <label key={option.value} className="flex items-center gap-2 text-sm text-foreground">
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
