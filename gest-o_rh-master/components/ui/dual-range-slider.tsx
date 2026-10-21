"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

/**
 * Slider de faixa (dois cabos) — dois inputs `range` nativos empilhados,
 * cada um só reage a clique perto do próprio cabo (`pointer-events-none`
 * no input inteiro, `pointer-events-auto` só na "bolinha" via seletor de
 * thumb). Mostra marcação de 10 em 10% embaixo, igual ao Sólides.
 */
export function DualRangeSlider({
  nomeMin,
  nomeMax,
  min = 0,
  max = 100,
  passo = 10,
  valorInicialMin = 60,
  valorInicialMax = 100,
}: {
  nomeMin: string;
  nomeMax: string;
  min?: number;
  max?: number;
  passo?: number;
  valorInicialMin?: number;
  valorInicialMax?: number;
}) {
  const [valorMin, setValorMin] = useState(valorInicialMin);
  const [valorMax, setValorMax] = useState(valorInicialMax);

  const thumbClasses =
    "absolute inset-0 w-full appearance-none bg-transparent pointer-events-none " +
    "[&::-webkit-slider-thumb]:pointer-events-auto [&::-webkit-slider-thumb]:appearance-none " +
    "[&::-webkit-slider-thumb]:size-4 [&::-webkit-slider-thumb]:rounded-full " +
    "[&::-webkit-slider-thumb]:border-2 [&::-webkit-slider-thumb]:border-primary " +
    "[&::-webkit-slider-thumb]:bg-background [&::-webkit-slider-thumb]:shadow " +
    "[&::-moz-range-thumb]:pointer-events-auto [&::-moz-range-thumb]:size-4 " +
    "[&::-moz-range-thumb]:rounded-full [&::-moz-range-thumb]:border-2 " +
    "[&::-moz-range-thumb]:border-primary [&::-moz-range-thumb]:bg-background";

  return (
    <div>
      <div className="relative h-4">
        <div className="absolute top-1/2 h-1.5 w-full -translate-y-1/2 rounded-full bg-border" />
        <div
          className="absolute top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-primary"
          style={{
            left: `${((valorMin - min) / (max - min)) * 100}%`,
            right: `${100 - ((valorMax - min) / (max - min)) * 100}%`,
          }}
        />
        <input
          type="range"
          name={nomeMin}
          min={min}
          max={max}
          step={passo}
          value={valorMin}
          onChange={(event) =>
            setValorMin(Math.min(Number(event.target.value), valorMax))
          }
          className={thumbClasses}
        />
        <input
          type="range"
          name={nomeMax}
          min={min}
          max={max}
          step={passo}
          value={valorMax}
          onChange={(event) =>
            setValorMax(Math.max(Number(event.target.value), valorMin))
          }
          className={thumbClasses}
        />
      </div>
      <div className="mt-1 flex justify-between text-xs text-muted-foreground">
        {Array.from({ length: (max - min) / passo + 1 }, (_, i) => min + i * passo).map(
          (marca) => (
            <span key={marca} className={cn(marca === min || marca === max ? "" : "hidden sm:inline")}>
              {marca}%
            </span>
          ),
        )}
      </div>
    </div>
  );
}
