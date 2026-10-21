import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

export type StatusTone = "success" | "warning" | "danger" | "info" | "neutral";

const TONE_CLASSES: Record<StatusTone, string> = {
  success: "bg-status-success text-status-success-foreground",
  warning: "bg-status-warning text-status-warning-foreground",
  danger: "bg-status-danger text-status-danger-foreground",
  info: "bg-status-info text-status-info-foreground",
  neutral: "bg-status-neutral text-status-neutral-foreground",
};

/** Badge de status com paleta semântica própria (nunca usa o dourado da
 * marca, que fica reservado para ações). */
export function StatusBadge({
  tone,
  children,
  className,
}: {
  tone: StatusTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <Badge className={cn(TONE_CLASSES[tone], className)}>{children}</Badge>
  );
}
