"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import type { VariantProps } from "class-variance-authority";
import type { buttonVariants } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

export type ActionResult = { error?: string } | void;

/** Botão genérico com confirmação (AlertDialog) para ações de um clique só
 * (excluir, reativar, etc.) — usado pelo DeleteButton e por outras ações de
 * mudança de estado que merecem uma confirmação antes de executar. */
export function ConfirmActionButton({
  action,
  trigger,
  title,
  description,
  confirmLabel = "Confirmar",
  confirmVariant = "default",
  successMessage,
}: {
  action: () => Promise<ActionResult>;
  trigger: React.ReactElement;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: VariantProps<typeof buttonVariants>["variant"];
  successMessage: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  function handleConfirm() {
    startTransition(async () => {
      const result = await action();
      if (result && "error" in result && result.error) {
        toast.error(result.error);
        return;
      }
      toast.success(successMessage);
      setOpen(false);
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger render={trigger} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{title}</AlertDialogTitle>
          {description && (
            <AlertDialogDescription>{description}</AlertDialogDescription>
          )}
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={pending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            variant={confirmVariant}
            onClick={handleConfirm}
            disabled={pending}
          >
            {pending ? "Aguarde..." : confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
