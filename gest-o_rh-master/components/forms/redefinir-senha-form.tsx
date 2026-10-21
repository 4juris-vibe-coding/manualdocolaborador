"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import { FormCard } from "@/components/shared/form-layout";
import type { SenhaFormState } from "@/app/(app)/configuracoes/usuarios/actions";

export function RedefinirSenhaForm({
  action,
}: {
  action: (
    state: SenhaFormState,
    formData: FormData,
  ) => Promise<SenhaFormState>;
}) {
  const [state, formAction, pending] = useActionState<SenhaFormState, FormData>(
    action,
    null,
  );

  useEffect(() => {
    if (state?.success) toast.success("Senha redefinida com sucesso.");
  }, [state]);

  return (
    <form action={formAction}>
      <FormCard
        footer={
          <Button type="submit" disabled={pending}>
            {pending ? "Redefinindo..." : "Redefinir senha"}
          </Button>
        }
      >
        <FieldGroup>
          <Field>
            <FieldLabel htmlFor="senha">Nova senha*</FieldLabel>
            <Input
              id="senha"
              name="senha"
              type="password"
              minLength={8}
              required
            />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </FieldGroup>
      </FormCard>
    </form>
  );
}
