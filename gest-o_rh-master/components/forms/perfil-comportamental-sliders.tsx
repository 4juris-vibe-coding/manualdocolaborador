"use client";

import { useState } from "react";
import { TRACOS_COMPORTAMENTAIS, VALOR_TRACO_PADRAO } from "@/lib/cargo-tracos";

function TracoSlider({
  chave,
  esquerda,
  direita,
  valorInicial,
}: {
  chave: string;
  esquerda: string;
  direita: string;
  valorInicial: number;
}) {
  const [valor, setValor] = useState(valorInicial);

  return (
    <div className="grid grid-cols-[1fr_auto_2fr_auto_1fr] items-center gap-3 py-2 text-sm">
      <span className="text-right font-medium text-foreground">{esquerda}</span>
      <span className="w-10 text-right text-xs tabular-nums text-muted-foreground">
        {100 - valor}%
      </span>
      <input
        type="range"
        name={`traco_${chave}`}
        min={0}
        max={100}
        step={5}
        value={valor}
        onChange={(event) => setValor(Number(event.target.value))}
        className="h-1.5 w-full cursor-pointer appearance-none rounded-full bg-border accent-primary"
      />
      <span className="w-10 text-xs tabular-nums text-muted-foreground">{valor}%</span>
      <span className="font-medium text-foreground">{direita}</span>
    </div>
  );
}

/**
 * Os 24 pares de traços comportamentais opostos (mesma lista do Sólides),
 * cada um com um slider 0-100 indicando o quanto o perfil pende pra
 * direita do par. Usado tanto no perfil ideal do cargo (Engenharia de
 * Cargo) quanto no perfil real do colaborador — cada slider vira um
 * input nativo `traco_<chave>`, a action lê com formData.entries().
 */
export function PerfilComportamentalSliders({
  valoresIniciais = {},
}: {
  valoresIniciais?: Record<string, number>;
}) {
  return (
    <div className="flex flex-col divide-y divide-border">
      {TRACOS_COMPORTAMENTAIS.map((traco) => (
        <TracoSlider
          key={traco.chave}
          chave={traco.chave}
          esquerda={traco.esquerda}
          direita={traco.direita}
          valorInicial={valoresIniciais[traco.chave] ?? VALOR_TRACO_PADRAO}
        />
      ))}
    </div>
  );
}
