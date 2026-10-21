"use client";

import { useState } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIAS_DISC } from "@/components/ui/perfil-disc-slider";

const TIPOS_PERFIL = [
  { value: "grupo", label: "Grupo" },
  { value: "empresa", label: "Empresa" },
] as const;

/** Modo "Por perfis prontos": escolhe um "Tipo de perfil" (Grupo ou
 * Empresa) e depois, em "Escolher", a opção específica dentro daquele
 * tipo — as opções de "Escolher" mudam de acordo com o tipo (por isso
 * precisa de estado no cliente, diferente dos outros dois modos). */
export function BuscaPerfilProntosForm({
  tipoAtual,
  escolherAtual,
}: {
  tipoAtual?: string;
  escolherAtual?: string;
}) {
  const [tipo, setTipo] = useState(tipoAtual ?? "");

  const opcoesEscolher =
    tipo === "grupo"
      ? CATEGORIAS_DISC.map((c) => ({ value: c.chave, label: c.label }))
      : tipo === "empresa"
        ? [{ value: "media_empresa", label: "Média da empresa" }]
        : [];

  return (
    <form method="GET" className="flex flex-col gap-4">
      <input type="hidden" name="modo" value="prontos" />
      <div className="grid gap-4 sm:grid-cols-2">
        <Field>
          <FieldLabel htmlFor="tipo_perfil">Tipo de perfil*</FieldLabel>
          <Select
            name="tipo_perfil"
            items={TIPOS_PERFIL}
            value={tipo}
            onValueChange={(valor) => valor && setTipo(valor)}
          >
            <SelectTrigger id="tipo_perfil" className="w-full">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {TIPOS_PERFIL.map((t) => (
                <SelectItem key={t.value} value={t.value}>
                  {t.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="escolher">Escolher*</FieldLabel>
          <Select
            name="escolher"
            items={opcoesEscolher}
            defaultValue={escolherAtual}
            disabled={opcoesEscolher.length === 0}
          >
            <SelectTrigger id="escolher" className="w-full">
              <SelectValue placeholder="Selecione..." />
            </SelectTrigger>
            <SelectContent>
              {opcoesEscolher.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <Button type="submit" className="w-fit" disabled={!tipo}>
        Buscar
      </Button>
    </form>
  );
}
