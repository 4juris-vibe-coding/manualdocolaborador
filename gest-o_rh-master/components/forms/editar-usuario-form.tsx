"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Field,
  FieldGroup,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { PAPEL_OPTIONS } from "@/lib/validations/usuario";
import type { FormState } from "@/app/(app)/configuracoes/usuarios/actions";
import type { PerfilRow } from "@/types/database.types";

export function EditarUsuarioForm({
  action,
  defaultValues,
  isSelf,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues: Pick<PerfilRow, "nome_completo" | "email" | "papel" | "ativo">;
  isSelf: boolean;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction}>
      <FormCard
        footer={
          <FormActions pending={pending} cancelHref="/configuracoes/usuarios" />
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nome_completo">Nome completo*</FieldLabel>
          <Input
            id="nome_completo"
            name="nome_completo"
            defaultValue={defaultValues.nome_completo}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input id="email" defaultValue={defaultValues.email} disabled />
          <FieldDescription>
            Para trocar o e-mail de acesso, fale com outro administrador.
          </FieldDescription>
        </Field>

        <Field>
          <FieldLabel htmlFor="papel">Papel*</FieldLabel>
          <Select
            name="papel"
            items={PAPEL_OPTIONS}
            defaultValue={defaultValues.papel}
            required
          >
            <SelectTrigger id="papel" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PAPEL_OPTIONS.map((option) => (
                <SelectItem key={option.value} value={option.value}>
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field orientation="horizontal">
          <Checkbox
            id="ativo"
            name="ativo"
            defaultChecked={defaultValues.ativo}
            disabled={isSelf}
          />
          <FieldLabel htmlFor="ativo" className="font-normal">
            Usuário ativo (desmarque para bloquear o acesso)
          </FieldLabel>
        </Field>
        {isSelf && (
          <FieldDescription>
            Você não pode desativar a própria conta.
          </FieldDescription>
        )}

        {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
