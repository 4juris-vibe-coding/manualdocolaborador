"use client";

import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
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

export function UsuarioForm({
  action,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction}>
      <FormCard
        footer={
          <FormActions
            pending={pending}
            cancelHref="/configuracoes/usuarios"
            submitLabel="Criar usuário"
            pendingLabel="Criando..."
          />
        }
      >
        <FieldGroup>
        <Field>
          <FieldLabel htmlFor="nome_completo">Nome completo*</FieldLabel>
          <Input id="nome_completo" name="nome_completo" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="email">E-mail*</FieldLabel>
          <Input id="email" name="email" type="email" required />
        </Field>

        <Field>
          <FieldLabel htmlFor="senha">Senha inicial*</FieldLabel>
          <Input
            id="senha"
            name="senha"
            type="password"
            minLength={8}
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="papel">Papel*</FieldLabel>
          <Select name="papel" items={PAPEL_OPTIONS} defaultValue="gestor" required>
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

        {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
