"use client";

import { useActionState, useEffect, useRef } from "react";
import { Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldError } from "@/components/ui/field";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { formatDate, formatCPF } from "@/lib/format";
import { criarDependente, excluirDependente } from "@/app/(app)/colaboradores/[id]/actions";
import type { ColaboradorDependenteRow } from "@/types/database.types";

export function DependentesSection({
  colaboradorId,
  dependentes,
  podeEditar,
}: {
  colaboradorId: string;
  dependentes: ColaboradorDependenteRow[];
  podeEditar: boolean;
}) {
  const acao = criarDependente.bind(null, colaboradorId);
  const [state, formAction, pending] = useActionState(acao, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  return (
    <div className="flex flex-col gap-4">
      {dependentes.length === 0 ? (
        <EmptyState icon={Users} title="Nenhum dependente cadastrado" />
      ) : (
        <ul className="flex flex-col gap-2">
          {dependentes.map((dependente) => (
            <li
              key={dependente.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <div>
                <p className="font-medium text-foreground">{dependente.nome}</p>
                <p className="text-muted-foreground">
                  {dependente.parentesco}
                  {dependente.data_nascimento &&
                    ` · nascido em ${formatDate(dependente.data_nascimento)}`}
                  {dependente.cpf && ` · CPF ${formatCPF(dependente.cpf)}`}
                </p>
              </div>
              {podeEditar && (
                <DeleteButton
                  itemLabel={`o dependente "${dependente.nome}"`}
                  action={excluirDependente.bind(null, colaboradorId, dependente.id)}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {podeEditar && (
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-4"
        >
          <Field className="sm:col-span-2">
            <Input name="nome" placeholder="Nome do dependente" required />
          </Field>
          <Field>
            <Input name="parentesco" placeholder="Parentesco" required />
          </Field>
          <Field>
            <Input name="data_nascimento" type="date" />
          </Field>
          <Field className="sm:col-span-3">
            <Input name="cpf" placeholder="CPF (opcional)" />
          </Field>
          <Button type="submit" variant="outline" disabled={pending} className="sm:col-span-1">
            {pending ? "Salvando..." : "Adicionar"}
          </Button>
          {state?.error && (
            <div className="sm:col-span-4">
              <FieldError>{state.error}</FieldError>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
