"use client";

import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DualRangeSlider } from "@/components/ui/dual-range-slider";
import { TRACOS_COMPORTAMENTAIS } from "@/lib/cargo-tracos";

const ITENS_TRACO = TRACOS_COMPORTAMENTAIS.map((t) => ({
  value: t.chave,
  label: `${t.esquerda} ↔ ${t.direita}`,
}));

/** Modo "Por indicador específico": escolhe UMA competência e a faixa
 * (mín/máx) aceitável de valor pra ela — quem estiver dentro da faixa
 * bate 100%. */
export function BuscaPerfilIndicadorForm({
  chaveAtual,
  minAtual,
  maxAtual,
}: {
  chaveAtual?: string;
  minAtual: number;
  maxAtual: number;
}) {
  return (
    <form method="GET" className="flex flex-col gap-4">
      <input type="hidden" name="modo" value="indicador" />
      <Field>
        <FieldLabel htmlFor="traco_chave">Competências</FieldLabel>
        <Select name="traco_chave" items={ITENS_TRACO} defaultValue={chaveAtual}>
          <SelectTrigger id="traco_chave" className="w-full">
            <SelectValue placeholder="Selecione uma competência..." />
          </SelectTrigger>
          <SelectContent>
            {TRACOS_COMPORTAMENTAIS.map((t) => (
              <SelectItem key={t.chave} value={t.chave}>
                {t.esquerda} ↔ {t.direita}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel>Faixa aceitável</FieldLabel>
        <DualRangeSlider
          nomeMin="valor_min"
          nomeMax="valor_max"
          valorInicialMin={minAtual}
          valorInicialMax={maxAtual}
        />
      </Field>

      <Button type="submit" className="w-fit">
        Buscar
      </Button>
    </form>
  );
}
