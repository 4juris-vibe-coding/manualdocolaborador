"use client";

import { Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ConfirmActionButton,
  type ActionResult,
} from "@/components/shared/confirm-action-button";

export type DeleteActionResult = ActionResult;

/** Botão de exclusão com confirmação, usado nas listagens. `action` é uma
 * Server Action já vinculada ao registro (ex.: `excluirCargo.bind(null, id)`). */
export function DeleteButton({
  action,
  itemLabel,
  description,
}: {
  action: () => Promise<DeleteActionResult>;
  itemLabel: string;
  description?: string;
}) {
  return (
    <ConfirmActionButton
      action={action}
      trigger={
        <Button variant="ghost" size="icon-sm">
          <Trash2 className="text-destructive" />
          <span className="sr-only">Excluir {itemLabel}</span>
        </Button>
      }
      title={`Excluir ${itemLabel}?`}
      description={description ?? "Essa ação não pode ser desfeita."}
      confirmLabel="Excluir"
      confirmVariant="destructive"
      successMessage={`${itemLabel} excluído(a) com sucesso.`}
    />
  );
}
