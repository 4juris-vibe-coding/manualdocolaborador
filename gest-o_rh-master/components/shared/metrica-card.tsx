import { Info } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/** Card de uma métrica: título + linha divisória logo abaixo (igual ao
 * Sólides), com um ícone de info opcional pra explicar o indicador. */
export function MetricaCard({
  titulo,
  info,
  children,
}: {
  titulo: string;
  info?: string;
  children: React.ReactNode;
}) {
  return (
    <Card>
      <CardContent className="flex flex-col gap-4">
        <div className="flex items-center justify-between gap-2 border-b border-border pb-2.5">
          <h3 className="text-sm font-semibold text-foreground">{titulo}</h3>
          {info && (
            <Tooltip>
              <TooltipTrigger
                render={
                  <span className="text-muted-foreground">
                    <Info className="size-4" />
                  </span>
                }
              />
              <TooltipContent>{info}</TooltipContent>
            </Tooltip>
          )}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
