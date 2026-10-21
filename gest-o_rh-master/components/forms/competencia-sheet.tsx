"use client";

import Link from "next/link";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchSelect } from "@/components/shared/search-select";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import {
  Sheet,
  SheetTrigger,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetFooter,
  SheetClose,
} from "@/components/ui/sheet";
import { TIPO_AVALIACAO_OPTIONS } from "@/lib/validations/competencia";
import type { FormState } from "@/app/(app)/competencias/actions";
import type { CompetenciaRow, GrupoCompetenciaRow, CargoRow } from "@/types/database.types";

export function CompetenciaSheet({
  trigger,
  tituloSheet,
  action,
  grupos,
  cargos,
  defaultValues,
  cargosVinculadosIds = [],
}: {
  trigger: React.ReactElement;
  tituloSheet: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  grupos: Pick<GrupoCompetenciaRow, "id" | "nome">[];
  cargos: Pick<CargoRow, "id" | "nome">[];
  defaultValues?: Pick<
    CompetenciaRow,
    "tipo_avaliacao" | "grupo_id" | "nome" | "descricao" | "peso"
  >;
  cargosVinculadosIds?: string[];
}) {
  const [open, setOpen] = useState(false);
  // Só incrementa ao abrir — reseta o form a cada nova abertura sem
  // atropelar a animação de fechamento do Sheet (mesma solução do
  // GrupoCompetenciaDialog).
  const [instanciaForm, setInstanciaForm] = useState(0);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleOpenChange(novoAberto: boolean) {
    setOpen(novoAberto);
    if (novoAberto) setInstanciaForm((n) => n + 1);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await action(null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.success("Competência salva.");
      setOpen(false);
    });
  }

  return (
    <Sheet open={open} onOpenChange={handleOpenChange}>
      <SheetTrigger render={trigger} />
      <SheetContent className="flex w-full flex-col sm:max-w-lg">
        <form
          key={instanciaForm}
          onSubmit={handleSubmit}
          className="flex min-h-0 flex-1 flex-col"
        >
          <SheetHeader>
            <SheetTitle>{tituloSheet}</SheetTitle>
          </SheetHeader>

          <div className="flex flex-1 flex-col gap-5 overflow-y-auto px-4">
            <Field>
              <FieldLabel>Tipo de avaliação*</FieldLabel>
              <FieldDescription>
                Selecione onde esta competência será avaliada.
              </FieldDescription>
              <RadioGroup
                name="tipo_avaliacao"
                defaultValue={defaultValues?.tipo_avaliacao ?? "desempenho"}
                className="flex gap-4"
              >
                {TIPO_AVALIACAO_OPTIONS.map((option) => (
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
              <FieldLabel htmlFor="grupo_id">Grupo de competências*</FieldLabel>
              <FieldDescription>
                Escolha o grupo desta competência. Lembre-se de segmentá-la
                pelo mesmo contexto.
              </FieldDescription>
              {grupos.length === 0 ? (
                <p className="rounded-lg border border-dashed border-border p-4 text-center text-sm text-muted-foreground">
                  Você ainda não possui Grupo de Competências criado.{" "}
                  <Link href="/competencias/grupos" className="font-medium text-primary underline">
                    Clique aqui
                  </Link>{" "}
                  para criar um grupo. Depois, retorne para criar a Competência.
                </p>
              ) : (
                <SearchSelect
                  id="grupo_id"
                  name="grupo_id"
                  items={grupos.map((g) => ({ value: g.id, label: g.nome }))}
                  defaultValue={defaultValues?.grupo_id}
                  required
                />
              )}
            </Field>

            <Field>
              <FieldLabel htmlFor="cargo_ids">Vincular cargos*</FieldLabel>
              <FieldDescription>
                Selecione quais cargos estarão vinculados a esta competência.
                Isso definirá quais colaboradores receberão as competências
                no preenchimento da avaliação.
              </FieldDescription>
              <span className="text-sm text-foreground">Vincular cargos</span>
              <MultiSelectCombobox
                id="cargo_ids"
                name="cargo_ids"
                items={cargos.map((c) => ({ value: c.id, label: c.nome }))}
                defaultValues={cargosVinculadosIds}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="nome">Nome*</FieldLabel>
              <FieldDescription>
                Dê um nome à competência. Será exibido na lista de
                competências, no formulário de preenchimento, na relação de
                vínculos e relatórios gerados.
              </FieldDescription>
              <span className="text-sm text-foreground">Nome da competência</span>
              <Input
                id="nome"
                name="nome"
                placeholder="Ex.: Resiliência"
                defaultValue={defaultValues?.nome}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
              <FieldDescription>
                Descreva o significado desta competência. Isso auxiliará o
                avaliador no momento do preenchimento da avaliação.
              </FieldDescription>
              <span className="text-sm text-foreground">Descrição da competência</span>
              <Textarea
                id="descricao"
                name="descricao"
                rows={3}
                placeholder="Ex.: Considere a forma como o colaborador reage ao ter que enfrentar obstáculos em suas demandas."
                defaultValue={defaultValues?.descricao ?? ""}
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="peso">Peso</FieldLabel>
              <FieldDescription>
                Pesos são multiplicadores aplicados sobre a nota atribuída
                pelo gestor para esta competência. Preencha um valor de 1 a
                100. Se não for preenchido, o sistema considerará o valor 1
                automaticamente.
              </FieldDescription>
              <span className="text-sm text-foreground">Peso da competência</span>
              <Input
                id="peso"
                name="peso"
                type="number"
                min={1}
                max={100}
                placeholder="Ex.: 1"
                defaultValue={defaultValues?.peso ?? undefined}
              />
            </Field>

            {error && <FieldError>{error}</FieldError>}
          </div>

          <SheetFooter className="flex-row items-center justify-between">
            <SheetClose render={<Button type="button" variant="link" />}>
              Cancelar
            </SheetClose>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </SheetFooter>
        </form>
      </SheetContent>
    </Sheet>
  );
}
