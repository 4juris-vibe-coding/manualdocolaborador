"use client";

import { RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { ConfirmActionButton, type ActionResult } from "@/components/shared/confirm-action-button";

export function ReativarColaboradorButton({
  action,
  colaboradorNome,
}: {
  action: () => Promise<ActionResult>;
  colaboradorNome: string;
}) {
  return (
    <ConfirmActionButton
      action={action}
      trigger={
        <Button variant="outline" size="sm">
          <RotateCcw /> Reativar
        </Button>
      }
      title={`Reativar ${colaboradorNome}?`}
      description="O colaborador volta a aparecer como ativo. A data e o motivo do desligamento anterior são apagados."
      confirmLabel="Reativar"
      successMessage="Colaborador reativado."
    />
  );
}
