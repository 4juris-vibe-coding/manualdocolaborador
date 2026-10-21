import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export function EmptyState({
  icon: Icon,
  title,
  titleClassName,
  description,
  action,
}: {
  /** Sem ícone, mostra só o texto centralizado (igual ao "Ainda não há
   * dados a serem exibidos" das listagens do Sólides). */
  icon?: LucideIcon;
  title: string;
  titleClassName?: string;
  description?: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-lg border border-dashed border-border bg-card px-6 py-16 text-center">
      {Icon && (
        <div className="flex size-12 items-center justify-center rounded-full bg-muted">
          <Icon className="size-6 text-muted-foreground" />
        </div>
      )}
      <div className="space-y-1">
        <p className={cn("font-medium text-foreground", titleClassName)}>{title}</p>
        {description && (
          <p className="text-sm text-muted-foreground">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
