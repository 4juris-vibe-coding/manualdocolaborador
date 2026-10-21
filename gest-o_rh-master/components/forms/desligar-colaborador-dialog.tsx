"use client";

import { useActionState } from "react";
import { UserX } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import type { FormState } from "@/app/(app)/colaboradores/actions";
import type { MotivoDemissaoRow } from "@/types/database.types";

export function DesligarColaboradorDialog({
  action,
  colaboradorNome,
  motivos,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  colaboradorNome: string;
  motivos: Pick<MotivoDemissaoRow, "id" | "nome">[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <Dialog>
      <DialogTrigger render={<Button variant="outline" size="sm" />}>
        <UserX /> Desligar
      </DialogTrigger>
      <DialogContent>
        <form action={formAction}>
          <DialogHeader>
            <DialogTitle>Desligar {colaboradorNome}</DialogTitle>
            <DialogDescription>
              O colaborador passa a ficar inativo e o checklist de
              desligamento (se houver um modelo ativo) é aplicado
              automaticamente.
            </DialogDescription>
          </DialogHeader>

          <FieldGroup className="py-4">
            <Field>
              <FieldLabel htmlFor="data_desligamento">
                Data do desligamento*
              </FieldLabel>
              <Input
                id="data_desligamento"
                name="data_desligamento"
                type="date"
                required
              />
            </Field>
            <Field>
              <FieldLabel htmlFor="motivo_desligamento_id">
                Motivo*
              </FieldLabel>
              <Select
                name="motivo_desligamento_id"
                items={motivos.map((m) => ({ value: m.id, label: m.nome }))}
                required
              >
                <SelectTrigger id="motivo_desligamento_id" className="w-full">
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  {motivos.map((motivo) => (
                    <SelectItem key={motivo.id} value={motivo.id}>
                      {motivo.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {motivos.length === 0 && (
                <FieldError>
                  Cadastre ao menos um motivo em Configurações antes de
                  desligar um colaborador.
                </FieldError>
              )}
            </Field>

            {state?.error && <FieldError>{state.error}</FieldError>}
          </FieldGroup>

          <DialogFooter>
            <Button
              type="submit"
              variant="destructive"
              disabled={pending || motivos.length === 0}
            >
              {pending ? "Salvando..." : "Confirmar desligamento"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
