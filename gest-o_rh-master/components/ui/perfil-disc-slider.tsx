"use client";

import { useState } from "react";

export { CATEGORIAS_DISC } from "@/lib/perfil-disc";

/** Barra de preenchimento único (0-100%) de uma categoria DISC — cabo
 * único, cor própria por categoria, sem o par de rótulos opostos usado
 * no perfil comportamental de 24 traços. */
export function PerfilDiscSlider({
  chave,
  label,
  cor,
  valorInicial = 50,
}: {
  chave: string;
  label: string;
  cor: string;
  valorInicial?: number;
}) {
  const [valor, setValor] = useState(valorInicial);

  return (
    <div className="flex items-center gap-3 py-1.5">
      <span
        className="w-28 shrink-0 text-sm font-semibold"
        style={{ color: cor }}
      >
        {label}
      </span>
      <div className="relative h-4 w-full">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full"
          style={{ width: `${valor}%`, backgroundColor: cor }}
        />
        <input
          type="range"
          name={`perfil_${chave}`}
          min={0}
          max={100}
          step={5}
          value={valor}
          onChange={(event) => setValor(Number(event.target.value))}
          className="absolute inset-0 w-full cursor-pointer appearance-none bg-transparent
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:size-4
            [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:border-2
            [&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow
            [&::-moz-range-thumb]:size-4 [&::-moz-range-thumb]:rounded-full
            [&::-moz-range-thumb]:border-2 [&::-moz-range-thumb]:bg-background"
          style={{ accentColor: cor }}
        />
      </div>
      <span className="w-10 shrink-0 text-right text-xs tabular-nums text-muted-foreground">
        {valor}%
      </span>
    </div>
  );
}
