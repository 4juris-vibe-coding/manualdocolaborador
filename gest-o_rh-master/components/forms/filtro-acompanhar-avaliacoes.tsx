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
import { SearchSelect } from "@/components/shared/search-select";
import {
  INTERVALO_RELATORIO_OPTIONS,
  PERIODO_AVALIACAO_FILTRO_OPTIONS,
  STATUS_AVALIACAO_EXPERIENCIA_FILTRO_OPTIONS,
} from "@/lib/validations/acompanhar-avaliacao-experiencia";
import {
  NIVEL_RELATORIO_PARTICIPACAO_OPTIONS,
  type NivelRelatorioParticipacao,
} from "@/lib/validations/ciclo-avaliativo";

type Opcao = { id: string; nome: string };

/** Mesmo par Nível/Opção em cascata do Dashboard de Avaliação de
 * Desempenho (Unidade/Departamento/Superior direto/Avaliador). */
export function FiltroAcompanharAvaliacoes({
  aba,
  intervaloAtual,
  periodoAtual,
  statusAtual,
  nivelAtual,
  opcaoAtual,
  unidades,
  departamentos,
  colaboradores,
}: {
  aba: string;
  intervaloAtual?: string;
  periodoAtual?: string;
  statusAtual?: string;
  nivelAtual?: string;
  opcaoAtual?: string;
  unidades: Opcao[];
  departamentos: Opcao[];
  colaboradores: Opcao[];
}) {
  const nivelInicial = NIVEL_RELATORIO_PARTICIPACAO_OPTIONS.some((o) => o.value === nivelAtual)
    ? (nivelAtual as NivelRelatorioParticipacao)
    : undefined;
  const [nivel, setNivel] = useState<NivelRelatorioParticipacao | undefined>(nivelInicial);

  const listaPorNivel: Record<NivelRelatorioParticipacao, Opcao[]> = {
    unidade: unidades,
    departamento: departamentos,
    superior_direto: colaboradores,
    avaliador: colaboradores,
  };
  const opcoesOpcao = nivel ? listaPorNivel[nivel] : [];

  return (
    <form method="GET" className="flex flex-col gap-4">
      <input type="hidden" name="aba" value={aba} />
      <div className="grid gap-4 sm:grid-cols-3">
        <Field>
          <FieldLabel htmlFor="intervalo">Intervalo</FieldLabel>
          <Select
            name="intervalo"
            items={INTERVALO_RELATORIO_OPTIONS}
            defaultValue={intervaloAtual ?? "6"}
          >
            <SelectTrigger id="intervalo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {INTERVALO_RELATORIO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="periodo">Período de avaliação</FieldLabel>
          <Select
            name="periodo"
            items={PERIODO_AVALIACAO_FILTRO_OPTIONS}
            defaultValue={periodoAtual ?? "todos"}
          >
            <SelectTrigger id="periodo" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {PERIODO_AVALIACAO_FILTRO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field>
          <FieldLabel htmlFor="status">Status</FieldLabel>
          <Select
            name="status"
            items={STATUS_AVALIACAO_EXPERIENCIA_FILTRO_OPTIONS}
            defaultValue={statusAtual ?? "todos"}
          >
            <SelectTrigger id="status" className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {STATUS_AVALIACAO_EXPERIENCIA_FILTRO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>
      </div>

      <div className="flex flex-wrap items-end gap-4">
        <Field className="w-full sm:w-56">
          <FieldLabel htmlFor="nivel">Nível</FieldLabel>
          <Select
            name="nivel"
            items={NIVEL_RELATORIO_PARTICIPACAO_OPTIONS}
            value={nivel ?? ""}
            onValueChange={(valor) => setNivel((valor || undefined) as NivelRelatorioParticipacao)}
          >
            <SelectTrigger id="nivel" className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {NIVEL_RELATORIO_PARTICIPACAO_OPTIONS.map((o) => (
                <SelectItem key={o.value} value={o.value}>
                  {o.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </Field>

        <Field className="min-w-0 flex-1">
          <FieldLabel htmlFor="opcao_id">Opção</FieldLabel>
          <SearchSelect
            key={nivel ?? "sem-nivel"}
            id="opcao_id"
            name="opcao_id"
            items={opcoesOpcao.map((o) => ({ value: o.id, label: o.nome }))}
            defaultValue={nivel === nivelInicial ? opcaoAtual : undefined}
            disabled={!nivel}
          />
        </Field>

        <Button type="submit" className="w-fit">
          Filtrar
        </Button>
      </div>
    </form>
  );
}
