"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SearchSelect } from "@/components/shared/search-select";
import { CLASSIFICACAO_FEEDBACK_OPTIONS } from "@/lib/validations/feedback";
import type { FormState } from "@/app/(app)/feedbacks/actions";
import type { ColaboradorRow, FeedbackRow } from "@/types/database.types";

export function FeedbackForm({
  action,
  colaboradores,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  colaboradores: Pick<ColaboradorRow, "id" | "nome_completo">[];
  defaultValues?: Pick<
    FeedbackRow,
    "colaborador_id" | "data_feedback" | "classificacao" | "comentario"
  >;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const [classificacao, setClassificacao] = useState(
    defaultValues?.classificacao ?? "neutro",
  );
  const hoje = new Date().toISOString().slice(0, 10);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="rounded-md border-l-4 border-status-info-foreground bg-status-info px-4 py-3 text-sm text-status-info-foreground">
        <span className="font-semibold">Importante!</span> Feedbacks
        registrados aqui serão enviados ao colaborador. Para anotações
        confidenciais, utilize o menu{" "}
        <Link href="/registros" className="underline underline-offset-2">
          Registros
        </Link>
        .
      </div>

      <div className="rounded-lg border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5">
          <Field>
            <FieldLabel htmlFor="colaborador_id">Colaborador*</FieldLabel>
            <SearchSelect
              id="colaborador_id"
              name="colaborador_id"
              items={colaboradores.map((c) => ({ value: c.id, label: c.nome_completo }))}
              defaultValue={defaultValues?.colaborador_id}
              required
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="data_feedback">Data do Feedback*</FieldLabel>
            <Input
              id="data_feedback"
              name="data_feedback"
              type="date"
              defaultValue={defaultValues?.data_feedback ?? hoje}
              required
            />
          </Field>

          <Field>
            <FieldLabel>Classificação*</FieldLabel>
            <input type="hidden" name="classificacao" value={classificacao} />
            <RadioGroup value={classificacao} onValueChange={setClassificacao}>
              {CLASSIFICACAO_FEEDBACK_OPTIONS.map((option) => (
                <label
                  key={option.value}
                  className="flex items-center gap-2 text-sm text-foreground"
                >
                  <RadioGroupItem value={option.value} />
                  {option.label}
                </label>
              ))}
            </RadioGroup>
          </Field>

          <Field>
            <FieldLabel htmlFor="comentario">Comentário*</FieldLabel>
            <RichTextEditor
              name="comentario"
              defaultValue={defaultValues?.comentario ?? ""}
            />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" render={<Link href="/feedbacks" />}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
