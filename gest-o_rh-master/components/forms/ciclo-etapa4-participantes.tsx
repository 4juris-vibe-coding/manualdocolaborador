"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { UserPlus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchSelect } from "@/components/shared/search-select";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import {
  gerarParticipantesAutomaticos,
  adicionarParticipantesManual,
  removerParticipante,
  finalizarCiclo,
} from "@/app/(app)/avaliacao-desempenho/solicitar/actions";
import type { TipoRelacaoAvaliacao } from "@/types/database.types";

type Participante = { id: string; avaliadorNome: string; avaliadoNome: string };
type Opcao = { id: string; nome: string };

export function CicloEtapa4Participantes({
  cicloId,
  tipoRelacao,
  participantes,
  colaboradores,
}: {
  cicloId: string;
  tipoRelacao: TipoRelacaoAvaliacao;
  participantes: Participante[];
  colaboradores: Opcao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [instanciaFormManual, setInstanciaFormManual] = useState(0);

  function gerarAutomatico() {
    startTransition(async () => {
      const result = await gerarParticipantesAutomaticos(cicloId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Participantes gerados com sucesso.");
      router.refresh();
    });
  }

  function adicionarManual(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    const avaliadorId = String(formData.get("avaliador_id") ?? "");
    const avaliadoIds = formData.getAll("avaliado_ids").map(String);
    if (!avaliadorId || avaliadoIds.length === 0) {
      toast.error("Escolha um avaliador e ao menos um avaliado.");
      return;
    }
    startTransition(async () => {
      const result = await adicionarParticipantesManual(cicloId, avaliadorId, avaliadoIds);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Participantes adicionados.");
      setInstanciaFormManual((n) => n + 1);
      router.refresh();
    });
  }

  function remover(id: string) {
    startTransition(async () => {
      const result = await removerParticipante(id, cicloId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  function criarAvaliacao() {
    startTransition(async () => {
      const result = await finalizarCiclo(cicloId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Avaliação criada com sucesso!");
      router.push("/avaliacao-desempenho/solicitar");
    });
  }

  return (
    <div className="flex flex-col gap-6">
      <p className="text-sm text-foreground">
        Aqui você define quem participará deste período avaliativo, como avaliadores e
        respectivos avaliados.
      </p>

      <div className="rounded-lg bg-status-info px-4 py-3 text-sm text-status-info-foreground">
        Informamos que após a criação da Avaliação de Desempenho, pode haver uma demora no
        carregamento do envio, mas não se preocupe, garantimos que o conteúdo será entregue a
        todos os colaboradores selecionados.
      </div>

      {tipoRelacao === "customizada" && (
        <form
          key={instanciaFormManual}
          onSubmit={adicionarManual}
          className="flex flex-col gap-3 rounded-lg border border-border p-4"
        >
          <p className="text-sm font-medium text-foreground">Adicionar participantes manualmente</p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Avaliador</span>
              <SearchSelect
                id="avaliador_id"
                name="avaliador_id"
                items={colaboradores.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
            <div className="flex flex-col gap-1">
              <span className="text-xs text-muted-foreground">Avaliados</span>
              <MultiSelectCombobox
                id="avaliado_ids"
                name="avaliado_ids"
                items={colaboradores.map((c) => ({ value: c.id, label: c.nome }))}
              />
            </div>
          </div>
          <Button type="submit" className="w-fit" disabled={pending}>
            <UserPlus /> Adicionar
          </Button>
        </form>
      )}

      {participantes.length === 0 ? (
        <EmptyState
          title="Ainda não existem participantes a serem exibidos."
          description="Selecione o botão abaixo para visualizar as configurações e definir quem serão os participantes deste ciclo de avaliação."
          action={
            tipoRelacao !== "customizada" && (
              <Button type="button" disabled={pending} onClick={gerarAutomatico}>
                <UserPlus /> {pending ? "Gerando..." : "Adicionar participantes"}
              </Button>
            )
          }
        />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {participantes.length} participante(s)
            </p>
            {tipoRelacao !== "customizada" && (
              <Button type="button" variant="outline" size="sm" disabled={pending} onClick={gerarAutomatico}>
                <UserPlus /> Gerar novamente
              </Button>
            )}
          </div>
          <DataTable
            rows={participantes}
            rowKey={(p) => p.id}
            columns={[
              { header: "Avaliador", cell: (p) => p.avaliadorNome },
              { header: "Avaliado", cell: (p) => p.avaliadoNome },
              {
                header: "Ações",
                className: "w-12 text-right",
                cell: (p) => (
                  <Button variant="ghost" size="icon-sm" onClick={() => remover(p.id)} disabled={pending}>
                    <Trash2 className="text-destructive" />
                    <span className="sr-only">Remover</span>
                  </Button>
                ),
              },
            ]}
          />
        </div>
      )}

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => router.push("/avaliacao-desempenho/solicitar")}
          className="text-sm font-medium text-primary underline disabled:opacity-50"
        >
          Salvar rascunho
        </button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            render={<a href={`/avaliacao-desempenho/solicitar/${cicloId}?etapa=configuracoes`} />}
          >
            Voltar
          </Button>
          <Button type="button" disabled={pending} onClick={criarAvaliacao}>
            {pending ? "Criando..." : "Criar avaliação"}
          </Button>
        </div>
      </div>
    </div>
  );
}
