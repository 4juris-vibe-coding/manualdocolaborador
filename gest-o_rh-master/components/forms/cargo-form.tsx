"use client";

import { useActionState, useState } from "react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldLabel,
  FieldError,
  FieldDescription,
} from "@/components/ui/field";
import { FormCard, FormActions } from "@/components/shared/form-layout";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { TagInput } from "@/components/shared/tag-input";
import { PerfilComportamentalSliders } from "@/components/forms/perfil-comportamental-sliders";
import { PerfilDiscSlider } from "@/components/ui/perfil-disc-slider";
import { CATEGORIAS_DISC } from "@/lib/perfil-disc";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SENIORIDADE_OPTIONS } from "@/lib/validations/cargo";
import type { FormState } from "@/app/(app)/cargos/actions";
import type { CargoRow, CargoTracoComportamentalRow, PerfilRow } from "@/types/database.types";

type Defaults = Partial<
  Pick<
    CargoRow,
    | "nome"
    | "cargo_superior_id"
    | "senioridade"
    | "codigo_cbo"
    | "descricao"
    | "atividades"
    | "piso_salarial"
    | "piso_salarial_visivel"
    | "habilidades"
    | "assistencias"
    | "responsaveis_ids"
    | "perfil_executor"
    | "perfil_comunicador"
    | "perfil_planejador"
    | "perfil_analista"
  >
>;

export function CargoForm({
  action,
  cargoId,
  cargosSuperiores,
  responsaveisDisponiveis,
  defaultValues,
  defaultTracos = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Id do próprio cargo (edição) — excluído da lista de "Cargo superior"
   * pra não deixar um cargo ser superior de si mesmo. */
  cargoId?: string;
  cargosSuperiores: Pick<CargoRow, "id" | "nome">[];
  responsaveisDisponiveis: Pick<PerfilRow, "id" | "nome_completo">[];
  defaultValues?: Defaults;
  defaultTracos?: Pick<CargoTracoComportamentalRow, "chave" | "valor">[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const [senioridade, setSenioridade] = useState(defaultValues?.senioridade ?? "");
  const responsaveisIniciais = new Set(defaultValues?.responsaveis_ids ?? []);

  const valoresIniciaisTracos = Object.fromEntries(
    defaultTracos.map((t) => [t.chave, t.valor]),
  );

  return (
    <form action={formAction}>
      <FormCard footer={<FormActions pending={pending} cancelHref="/cargos" />}>
        <div className="flex flex-col gap-6">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field className="sm:col-span-2">
              <FieldLabel htmlFor="nome">Nome do cargo*</FieldLabel>
              <Input
                id="nome"
                name="nome"
                defaultValue={defaultValues?.nome}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="cargo_superior_id">Cargo superior</FieldLabel>
              <Select
                name="cargo_superior_id"
                items={cargosSuperiores
                  .filter((c) => c.id !== cargoId)
                  .map((c) => ({ value: c.id, label: c.nome }))}
                defaultValue={defaultValues?.cargo_superior_id ?? undefined}
              >
                <SelectTrigger id="cargo_superior_id" className="w-full">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {cargosSuperiores
                    .filter((c) => c.id !== cargoId)
                    .map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                </SelectContent>
              </Select>
            </Field>

            <Field>
              <FieldLabel htmlFor="codigo_cbo">Código CBO</FieldLabel>
              <Input
                id="codigo_cbo"
                name="codigo_cbo"
                defaultValue={defaultValues?.codigo_cbo ?? ""}
              />
            </Field>

            <Field className="sm:col-span-2">
              <FieldLabel>Senioridade</FieldLabel>
              <input type="hidden" name="senioridade" value={senioridade} />
              <div className="flex flex-wrap gap-2">
                {SENIORIDADE_OPTIONS.map((option) => (
                  <Button
                    key={option.value}
                    type="button"
                    size="sm"
                    variant={senioridade === option.value ? "default" : "outline"}
                    onClick={() =>
                      setSenioridade((atual) =>
                        atual === option.value ? "" : option.value,
                      )
                    }
                  >
                    {option.label}
                  </Button>
                ))}
              </div>
            </Field>
          </div>

          <Field>
            <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
            <RichTextEditor
              name="descricao"
              defaultValue={defaultValues?.descricao ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel htmlFor="atividades">Atividades</FieldLabel>
            <RichTextEditor
              name="atividades"
              defaultValue={defaultValues?.atividades ?? ""}
            />
          </Field>

          <Field>
            <FieldLabel>Responsáveis pelo cargo</FieldLabel>
            <FieldDescription>
              Quem no RH/gestão acompanha esse cargo (aprovações, revisão do
              perfil etc.).
            </FieldDescription>
            <div className="flex flex-col gap-2 rounded-lg border border-border p-3">
              {responsaveisDisponiveis.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Nenhum usuário do sistema cadastrado ainda.
                </p>
              ) : (
                responsaveisDisponiveis.map((pessoa) => (
                  <label
                    key={pessoa.id}
                    className="flex items-center gap-2 text-sm"
                  >
                    <Checkbox
                      name="responsaveis_ids"
                      value={pessoa.id}
                      defaultChecked={responsaveisIniciais.has(pessoa.id)}
                    />
                    {pessoa.nome_completo}
                  </label>
                ))
              )}
            </div>
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel htmlFor="piso_salarial">Piso salarial (R$)</FieldLabel>
              <Input
                id="piso_salarial"
                name="piso_salarial"
                type="number"
                step="0.01"
                min="0"
                defaultValue={defaultValues?.piso_salarial ?? ""}
              />
              <label className="mt-1 flex items-center gap-2 text-sm text-muted-foreground">
                <Checkbox
                  name="piso_salarial_visivel"
                  defaultChecked={defaultValues?.piso_salarial_visivel ?? false}
                />
                Exibir aos colaboradores
              </label>
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field>
              <FieldLabel>Habilidades específicas</FieldLabel>
              <TagInput
                name="habilidades"
                defaultTags={defaultValues?.habilidades ?? []}
                placeholder="Digite e pressione Enter..."
              />
            </Field>
            <Field>
              <FieldLabel>Assistências</FieldLabel>
              <TagInput
                name="assistencias"
                defaultTags={defaultValues?.assistencias ?? []}
                placeholder="Digite e pressione Enter..."
              />
            </Field>
          </div>

          {state?.error && <FieldError>{state.error}</FieldError>}
        </div>
      </FormCard>

      <FormCard className="mt-6">
        <div className="flex flex-col gap-6">
          <div>
            <div className="flex flex-col gap-1">
              <h2 className="text-base font-semibold text-foreground">
                Engenharia Comportamental
              </h2>
              <p className="text-sm text-muted-foreground">
                Categorias DISC do perfil ideal pra esse cargo — usadas na
                coluna &ldquo;Perfil&rdquo; e nos filtros da listagem de cargos.
              </p>
            </div>
            <div className="mt-3 flex flex-col gap-1">
              {CATEGORIAS_DISC.map((cat) => (
                <PerfilDiscSlider
                  key={cat.chave}
                  chave={cat.chave}
                  label={cat.label}
                  cor={cat.cor}
                  valorInicial={defaultValues?.[`perfil_${cat.chave}`] ?? 50}
                />
              ))}
            </div>
          </div>

          <div>
            <p className="text-sm text-muted-foreground">
              Defina o perfil comportamental ideal pra esse cargo, arrastando
              cada traço pro lado que mais combina com a vaga.
            </p>
            <PerfilComportamentalSliders valoresIniciais={valoresIniciaisTracos} />
          </div>
        </div>
      </FormCard>
    </form>
  );
}
