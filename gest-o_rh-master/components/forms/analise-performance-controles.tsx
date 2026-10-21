"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { X, ArrowLeftRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { removerClassificacao, trocarClassificacoes } from "@/app/(app)/analise-performance/actions";

export function RemoverColaboradorPerformanceButton({
  colaboradorId,
  nome,
}: {
  colaboradorId: string;
  nome: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remover() {
    startTransition(async () => {
      const result = await removerClassificacao(colaboradorId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      router.refresh();
    });
  }

  return (
    <button
      type="button"
      onClick={remover}
      disabled={pending}
      className="rounded-sm text-muted-foreground hover:text-destructive disabled:opacity-50"
      aria-label={`Remover ${nome}`}
    >
      <X className="size-3.5" />
    </button>
  );
}

export function TrocarColunasButton({
  departamentoId,
  cargoId,
}: {
  departamentoId?: string;
  cargoId?: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function trocar() {
    startTransition(async () => {
      const result = await trocarClassificacoes(departamentoId, cargoId);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success("Colunas trocadas.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      onClick={trocar}
      disabled={pending}
      aria-label="Trocar baixa e alta performance"
    >
      <ArrowLeftRight />
    </Button>
  );
}
