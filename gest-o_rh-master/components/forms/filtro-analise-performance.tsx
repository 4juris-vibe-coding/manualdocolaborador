"use client";

import { useRef } from "react";
import { Field, FieldLabel } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

type Opcao = { id: string; nome: string };

/** Os dois selects filtram na hora (sem botão "Filtrar") — igual ao
 * Sólides, que já reenvia a página assim que troca o Departamento ou o
 * Cargo. */
export function FiltroAnalisePerformance({
  departamentoAtual,
  cargoAtual,
  departamentos,
  cargos,
}: {
  departamentoAtual?: string;
  cargoAtual?: string;
  departamentos: Opcao[];
  cargos: Opcao[];
}) {
  const formRef = useRef<HTMLFormElement>(null);

  return (
    <form ref={formRef} method="GET" className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="departamento_id">Departamentos</FieldLabel>
        <Select
          name="departamento_id"
          items={[{ value: "todos", label: "Todos os Departamentos" }, ...departamentos.map((d) => ({ value: d.id, label: d.nome }))]}
          defaultValue={departamentoAtual ?? "todos"}
          onValueChange={() => formRef.current?.requestSubmit()}
        >
          <SelectTrigger id="departamento_id" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Departamentos</SelectItem>
            {departamentos.map((d) => (
              <SelectItem key={d.id} value={d.id}>
                {d.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>

      <Field>
        <FieldLabel htmlFor="cargo_id">Cargos</FieldLabel>
        <Select
          name="cargo_id"
          items={[{ value: "todos", label: "Todos os Cargos" }, ...cargos.map((c) => ({ value: c.id, label: c.nome }))]}
          defaultValue={cargoAtual ?? "todos"}
          onValueChange={() => formRef.current?.requestSubmit()}
        >
          <SelectTrigger id="cargo_id" className="w-full">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="todos">Todos os Cargos</SelectItem>
            {cargos.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
    </form>
  );
}
