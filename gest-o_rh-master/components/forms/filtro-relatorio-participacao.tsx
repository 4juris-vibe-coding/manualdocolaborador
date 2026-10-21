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
  NIVEL_RELATORIO_PARTICIPACAO_OPTIONS,
  STATUS_RESPOSTA_AVALIACAO_OPTIONS,
  type NivelRelatorioParticipacao,
} from "@/lib/validations/ciclo-avaliativo";

type Opcao = { id: string; nome: string };

/** Filtro do Dashboard/Relatório de Participação. "Opção" depende do
 * "Nível" escolhido (Unidade/Departamento/Superior direto/Avaliador) —
 * por isso precisa de estado no cliente, igual ao par
 * Tipo de perfil/Escolher de BuscaPerfilProntosForm. */
export function FiltroRelatorioParticipacao({
  ciclos,
  cicloAtual,
  statusAtual,
  nivelAtual,
  opcaoAtual,
  unidades,
  departamentos,
  colaboradores,
}: {
  ciclos: Opcao[];
  cicloAtual?: string;
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
    <form method="GET" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 lg:items-end">
      <Field>
        <FieldLabel htmlFor="ciclo_id">Ciclo avaliativo*</FieldLabel>
        <SearchSelect
          id="ciclo_id"
          name="ciclo_id"
          items={ciclos.map((c) => ({ value: c.id, label: c.nome }))}
          defaultValue={cicloAtual}
          required
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="status">Status</FieldLabel>
        <Select name="status" items={STATUS_RESPOSTA_AVALIACAO_OPTIONS} defaultValue={statusAtual}>
          <SelectTrigger id="status" className="w-full">
            <SelectValue placeholder="Selecione..." />
          </SelectTrigger>
          <SelectContent>
            {STATUS_RESPOSTA_AVALIACAO_OPTIONS.map((o) => (
              <SelectItem key={o.value} value={o.value}>
                {o.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="nivel">Nível</FieldLabel>
        <Select
          name="nivel"
          items={NIVEL_RELATORIO_PARTICIPACAO_OPTIONS}
          value={nivel ?? ""}
          onValueChange={(valor) => setNivel((valor || undefined) as NivelRelatorioParticipacao)}
        >
          <SelectTrigger id="nivel" className="w-full">
            <SelectValue placeholder="Selecione..." />
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

      <Field>
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
    </form>
  );
}
