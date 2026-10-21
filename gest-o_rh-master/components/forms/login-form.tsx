"use client";

import { useActionState } from "react";
import { login, type LoginState } from "@/app/login/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";

export function LoginForm({ next }: { next?: string }) {
  const [state, formAction, pending] = useActionState<LoginState, FormData>(
    login,
    null,
  );

  return (
    <form action={formAction}>
      <FieldGroup>
        {next && <input type="hidden" name="next" value={next} />}

        <Field>
          <FieldLabel htmlFor="email">E-mail</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="voce@4juris.com.br"
            required
          />
        </Field>

        <Field>
          <FieldLabel htmlFor="password">Senha</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>

        {state?.error && (
          <FieldError>{state.error}</FieldError>
        )}

        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando..." : "Entrar"}
        </Button>
      </FieldGroup>
    </form>
  );
}
