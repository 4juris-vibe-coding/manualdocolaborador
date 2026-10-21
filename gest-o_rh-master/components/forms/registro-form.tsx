"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { SearchSelect } from "@/components/shared/search-select";
import { CLASSIFICACAO_OPTIONS } from "@/lib/validations/registro";
import type { FormState } from "@/app/(app)/registros/actions";
import type {
  ColaboradorRow,
  RegistroRow,
  TipoRegistroRow,
} from "@/types/database.types";

export function RegistroForm({
  action,
  colaboradores,
  tipos,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  colaboradores: Pick<ColaboradorRow, "id" | "nome_completo">[];
  tipos: Pick<TipoRegistroRow, "id" | "nome">[];
  defaultValues?: Pick<
    RegistroRow,
    | "colaborador_id"
    | "data_registro"
    | "tipo_registro_id"
    | "classificacao"
    | "valor_qtd_horas"
    | "descricao"
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
            <FieldLabel htmlFor="tipo_registro_id">Tipo de Registro*</FieldLabel>
            <SearchSelect
              id="tipo_registro_id"
              name="tipo_registro_id"
              items={tipos.map((t) => ({ value: t.id, label: t.nome }))}
              defaultValue={defaultValues?.tipo_registro_id}
              required
            />
            {tipos.length === 0 && (
              <FieldError>
                Cadastre ao menos um tipo em Configurações antes de criar
                registros.
              </FieldError>
            )}
          </Field>

          <Field>
            <FieldLabel htmlFor="data_registro">Data do Registro*</FieldLabel>
            <Input
              id="data_registro"
              name="data_registro"
              type="date"
              defaultValue={defaultValues?.data_registro ?? hoje}
              required
            />
          </Field>

          <Field>
            <FieldLabel>Classificação*</FieldLabel>
            <input type="hidden" name="classificacao" value={classificacao} />
            <RadioGroup value={classificacao} onValueChange={setClassificacao}>
              {CLASSIFICACAO_OPTIONS.map((option) => (
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
            <FieldLabel htmlFor="valor_qtd_horas">Valor/Qtd/Hs</FieldLabel>
            <Input
              id="valor_qtd_horas"
              name="valor_qtd_horas"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValues?.valor_qtd_horas ?? 0}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="descricao">Comentário*</FieldLabel>
            <RichTextEditor
              name="descricao"
              defaultValue={defaultValues?.descricao ?? ""}
            />
          </Field>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </div>
      </div>

      <div className="flex justify-end gap-3">
        <Button type="button" variant="outline" render={<Link href="/registros" />}>
          Voltar
        </Button>
        <Button type="submit" disabled={pending || tipos.length === 0}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
      </div>
    </form>
  );
}
