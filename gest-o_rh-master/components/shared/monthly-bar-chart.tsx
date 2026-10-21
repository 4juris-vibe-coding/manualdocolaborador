"use client";

import { useId, useState } from "react";
import { cn } from "@/lib/utils";

export type PontoMensal = { label: string; value: number };

// Viewbox largo (600×180) com preserveAspectRatio uniforme por padrão —
// de propósito: um viewBox quadrado-ish esticado com `preserveAspectRatio
//="none"` distorce texto (letras ficam achatadas/esticadas). Com escala
// uniforme, o gráfico só faz "letterbox" se a proporção do contêiner for
// bem diferente, o que é um efeito colateral muito mais seguro.
const LARGURA_VIEWBOX = 600;
const ALTURA = 180;
const LARGURA_BARRA_MAX = 24;
const GAP_MIN = 8;
const MARGEM_ESQUERDA = 40;
const MARGEM_INFERIOR = 24;
const MARGEM_SUPERIOR = 16;

function caminhoBarraTopoArredondado(
  x: number,
  y: number,
  largura: number,
  altura: number,
  raio: number,
) {
  if (altura <= 0) return "";
  const r = Math.min(raio, largura / 2, altura);
  return `M ${x},${y + altura} L ${x},${y + r} Q ${x},${y} ${x + r},${y} L ${x + largura - r},${y} Q ${x + largura},${y} ${x + largura},${y + r} L ${x + largura},${y + altura} Z`;
}

/** Um valor "redondo" um pouco acima do máximo, pra servir de teto do eixo
 * (ex.: máximo 7 -> teto 8; máximo 23 -> teto 25). */
function tetoArredondado(valor: number) {
  if (valor <= 0) return 1;
  const magnitude = 10 ** Math.floor(Math.log10(valor));
  return Math.ceil(valor / magnitude) * magnitude;
}

/** Gráfico de barras de uma série só (sem necessidade de legenda — o
 * título do card já diz o que é plotado). Tooltip por barra no hover/foco,
 * eixo Y com 3 marcações discretas, rótulo direto só na barra de maior
 * valor (o ponto da "história"). */
export function MonthlyBarChart({ data }: { data: PontoMensal[] }) {
  const [indiceAtivo, setIndiceAtivo] = useState<number | null>(null);
  const idBase = useId();

  const maiorValor = Math.max(0, ...data.map((d) => d.value));
  const teto = tetoArredondado(maiorValor);
  const areaAltura = ALTURA - MARGEM_INFERIOR - MARGEM_SUPERIOR;
  const areaLargura = LARGURA_VIEWBOX - MARGEM_ESQUERDA;
  const indiceMaximo = data.findIndex((d) => d.value === maiorValor && maiorValor > 0);
  const larguraSlot = areaLargura / Math.max(data.length, 1);
  const largura = Math.max(
    4,
    Math.min(LARGURA_BARRA_MAX, larguraSlot - GAP_MIN),
  );

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${LARGURA_VIEWBOX} ${ALTURA}`}
        className="h-44 w-full"
        role="img"
        aria-label="Desligamentos por mês nos últimos 12 meses"
      >
        {/* Gridlines horizontais recessivas, com marcação em 0 / metade / teto */}
        {[0, 0.5, 1].map((fracao) => {
          const y = MARGEM_SUPERIOR + areaAltura * (1 - fracao);
          return (
            <g key={fracao}>
              <line
                x1={MARGEM_ESQUERDA}
                x2={LARGURA_VIEWBOX}
                y1={y}
                y2={y}
                stroke="var(--border)"
                strokeWidth={1}
              />
              <text
                x={MARGEM_ESQUERDA - 6}
                y={y}
                textAnchor="end"
                dominantBaseline="middle"
                className="fill-muted-foreground"
                fontSize={11}
              >
                {Math.round(teto * fracao)}
              </text>
            </g>
          );
        })}

        {data.map((ponto, index) => {
          const xCentro = MARGEM_ESQUERDA + larguraSlot * (index + 0.5);
          const alturaBarra = teto > 0 ? (ponto.value / teto) * areaAltura : 0;
          const yTopo = MARGEM_SUPERIOR + areaAltura - alturaBarra;
          const ativo = indiceAtivo === index;

          return (
            <g key={`${ponto.label}-${index}`}>
              {/* Hit target maior que a barra, cobrindo o slot inteiro */}
              <rect
                x={MARGEM_ESQUERDA + larguraSlot * index}
                y={MARGEM_SUPERIOR}
                width={larguraSlot}
                height={areaAltura + MARGEM_INFERIOR}
                fill="transparent"
                onPointerEnter={() => setIndiceAtivo(index)}
                onPointerLeave={() => setIndiceAtivo(null)}
                onFocus={() => setIndiceAtivo(index)}
                onBlur={() => setIndiceAtivo(null)}
                tabIndex={0}
                aria-describedby={`${idBase}-${index}`}
              />
              <path
                d={caminhoBarraTopoArredondado(
                  xCentro - largura / 2,
                  yTopo,
                  largura,
                  Math.max(alturaBarra, ponto.value > 0 ? 2 : 0),
                  4,
                )}
                className={cn(
                  "fill-primary transition-opacity",
                  ativo ? "opacity-100" : "opacity-80",
                )}
                pointerEvents="none"
              />
              {index === indiceMaximo && (
                <text
                  x={xCentro}
                  y={yTopo - 6}
                  textAnchor="middle"
                  className="fill-foreground"
                  fontSize={12}
                  fontWeight={600}
                  pointerEvents="none"
                >
                  {ponto.value}
                </text>
              )}
              <text
                x={xCentro}
                y={ALTURA - 6}
                textAnchor="middle"
                className="fill-muted-foreground"
                fontSize={11}
                pointerEvents="none"
              >
                {ponto.label}
              </text>
            </g>
          );
        })}
      </svg>

      {indiceAtivo !== null && (
        <p
          id={`${idBase}-${indiceAtivo}`}
          className="mt-1 text-center text-xs text-muted-foreground"
        >
          <span className="font-medium text-foreground">
            {data[indiceAtivo].value}
          </span>{" "}
          desligamento(s) em {data[indiceAtivo].label}
        </p>
      )}
    </div>
  );
}
