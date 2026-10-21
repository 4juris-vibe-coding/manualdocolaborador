"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldError } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { SearchSelect } from "@/components/shared/search-select";
import {
  Dialog,
  DialogTrigger,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { classificarColaborador, type FormState } from "@/app/(app)/analise-performance/actions";

type Opcao = { id: string; nome: string };

/** Popup "Adicionar colaborador" — escolhe alguém ainda não categorizado
 * (dentro do recorte de Departamento/Cargo da página) e joga direto numa
 * das duas colunas. */
export function AdicionarColaboradorPerformanceDialog({
  trigger,
  naoCategorizados,
}: {
  trigger: React.ReactElement;
  naoCategorizados: Opcao[];
}) {
  const [open, setOpen] = useState(false);
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
      const result: FormState = await classificarColaborador(null, formData);
      if (result?.error) {
        setError(result.error);
        return;
      }
      setError(null);
      toast.success("Colaborador adicionado.");
      setOpen(false);
    });
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger render={trigger} />
      <DialogContent className="sm:max-w-md">
        <form key={instanciaForm} onSubmit={handleSubmit} className="flex flex-col gap-4">
          <DialogHeader>
            <DialogTitle>Adicionar colaborador</DialogTitle>
          </DialogHeader>

          <Field>
            <FieldDescription>
              Selecione colaboradores que não foram categorizados como alta ou baixa
              performance para adicionar às colunas abaixo.
            </FieldDescription>
            <SearchSelect
              name="colaborador_id"
              items={naoCategorizados.map((c) => ({ value: c.id, label: c.nome }))}
              required
            />
          </Field>

          <RadioGroup name="classificacao" defaultValue="alta" className="flex gap-4">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value="baixa" />
              Baixa performance
            </label>
            <label className="flex items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value="alta" />
              Alta performance
            </label>
          </RadioGroup>

          {error && <FieldError>{error}</FieldError>}

          <DialogFooter>
            <Button type="submit" disabled={pending}>
              {pending ? "Adicionando..." : "Adicionar"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
