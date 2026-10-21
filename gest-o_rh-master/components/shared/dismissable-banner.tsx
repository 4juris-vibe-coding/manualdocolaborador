"use client";

import { useState } from "react";
import { Info, X } from "lucide-react";

/** Banner informativo com botão de fechar (só no estado da sessão da
 * página, sem persistir) — igual ao aviso azul no topo da Métricas do
 * Colaborador no Sólides. */
export function DismissableBanner({ children }: { children: React.ReactNode }) {
  const [visivel, setVisivel] = useState(true);
  if (!visivel) return null;

  return (
    <div className="flex items-start gap-2 rounded-lg border-l-4 border-status-info-foreground bg-status-info px-4 py-3 text-sm text-status-info-foreground">
      <Info className="mt-0.5 size-4 shrink-0" />
      <p className="flex-1">{children}</p>
      <button
        type="button"
        onClick={() => setVisivel(false)}
        className="shrink-0 rounded-sm hover:opacity-70"
        aria-label="Fechar aviso"
      >
        <X className="size-4" />
      </button>
    </div>
  );
}
