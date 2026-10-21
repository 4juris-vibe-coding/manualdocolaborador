"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { CATEGORIA_9BOX_OPTIONS } from "@/lib/validations/grupo-competencia";
import type { FormState } from "@/app/(app)/competencias/grupos/actions";
import type { GrupoCompetenciaRow } from "@/types/database.types";

/** Popup de criar/editar um Grupo de Competências — igual ao Sólides, o
 * formulário vive num modal, não numa página própria. */
export function GrupoCompetenciaDialog({
  trigger,
  tituloDialog,
  action,
  defaultValues,
}: {
  trigger: React.ReactElement;
  tituloDialog: string;
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  defaultValues?: Pick<GrupoCompetenciaRow, "nome" | "categoria_9box">;
}) {
  const [open, setOpen] = useState(false);
  // Incrementa só ao ABRIR (não ao fechar) — usado como key do form pra
  // resetar os campos a cada nova abertura, sem interferir na animação
  // de fechamento do próprio Dialog (que precisa que o Popup continue
  // montado com a MESMA identidade enquanto ela roda).
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
      toast.success("Grupo de competências salvo.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form key={instanciaForm} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>{tituloDialog}</DialogTitle>
          </DialogHeader>

          <Field>
            <FieldLabel htmlFor="nome">Nome*</FieldLabel>
            <FieldDescription>
              Dê um nome ao grupo de competências. Será exibido na lista de
              competências, no formulário de preenchimento e nos relatórios
              gerados.
            </FieldDescription>
            <Input
              id="nome"
              name="nome"
              placeholder="Ex.: Competências técnicas"
              defaultValue={defaultValues?.nome}
              required
            />
          </Field>

          <Field>
            <FieldLabel>Categoria 9 box</FieldLabel>
            <FieldDescription>
              As notas atribuídas às competências deste grupo devem ser
              consideradas para a construção do gráfico 9 box. Portanto, ao
              selecionar uma das opções abaixo, você define que o grupo de
              competências em questão será atribuído a esta categoria.
            </FieldDescription>
            <RadioGroup
              name="categoria_9box"
              defaultValue={defaultValues?.categoria_9box ?? "nenhuma"}
              className="flex flex-col gap-2"
            >
              {CATEGORIA_9BOX_OPTIONS.map((option) => (
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

          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
            <Button type="submit" disabled={pending}>
              {pending ? "Salvando..." : "Salvar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
