"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { RichTextEditor } from "@/components/ui/rich-text-editor";
import { criarCicloEtapa1, atualizarCicloEtapa1 } from "@/app/(app)/avaliacao-desempenho/solicitar/actions";
import type { CicloAvaliativoRow } from "@/types/database.types";

/** Etapa 1 do assistente "Solicitar Avaliação" — cria o rascunho (se
 * ainda não existir `ciclo`) ou atualiza o nome/descrição/prazo de um já
 * existente, e sempre avança para a etapa de Escalas. */
export function CicloEtapa1Form({ ciclo }: { ciclo?: CicloAvaliativoRow }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = ciclo
        ? await atualizarCicloEtapa1(ciclo.id, formData)
        : await criarCicloEtapa1(formData);
      if (result.error || !result.id) {
        toast.error(result.error ?? "Não foi possível salvar.");
        return;
      }
      toast.success("A etapa foi salva com sucesso!");
      router.push(`/avaliacao-desempenho/solicitar/${result.id}?etapa=escalas`);
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-6">
      <div className="rounded-lg bg-status-info px-4 py-3 text-center text-sm text-status-info-foreground">
        Aqui você define um nome, uma descrição e datas de abertura e encerramento para este
        período avaliativo.
      </div>

      <Field>
        <FieldLabel htmlFor="nome">Nome*</FieldLabel>
        <FieldDescription>
          Defina um nome para a Avaliação que servirá como um identificador nos emails e
          relatórios.
        </FieldDescription>
        <span className="text-sm text-foreground">Nome da avaliação</span>
        <Input
          id="nome"
          name="nome"
          placeholder="Ex: Avaliação Colaboradores - período mm/aaaa"
          defaultValue={ciclo?.nome}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="descricao">Descrição</FieldLabel>
        <FieldDescription>Escreva uma introdução para a Avaliação.</FieldDescription>
        <RichTextEditor
          name="descricao"
          defaultValue={ciclo?.descricao ?? ""}
          placeholder="Ex: Bem-vindo a Avaliação de Desempenho..."
        />
      </Field>

      <Field>
        <FieldLabel>Prazo de participação*</FieldLabel>
        <FieldDescription>
          Defina quando começa e quando termina este período avaliativo.
        </FieldDescription>
        <span className="text-sm text-foreground">Período avaliativo</span>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="data_abertura" className="text-xs text-muted-foreground">
              Início
            </label>
            <Input
              id="data_abertura"
              name="data_abertura"
              type="date"
              defaultValue={ciclo?.data_abertura ?? ""}
              required
            />
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="data_encerramento" className="text-xs text-muted-foreground">
              Término
            </label>
            <Input
              id="data_encerramento"
              name="data_encerramento"
              type="date"
              defaultValue={ciclo?.data_encerramento ?? ""}
              required
            />
          </div>
        </div>
      </Field>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <Button type="button" variant="link" render={<Link href="/avaliacao-desempenho/solicitar" />}>
          Cancelar
        </Button>
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar e continuar"}
        </Button>
      </div>
    </form>
  );
}
