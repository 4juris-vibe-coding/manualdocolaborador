"use client";

import Link from "next/link";
import { useActionState } from "react";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { FieldError, FieldDescription } from "@/components/ui/field";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { FormState } from "@/app/(app)/departamentos/actions";
import type { DepartamentoRow, UnidadeRow, PerfilRow } from "@/types/database.types";

type Defaults = Partial<
  Pick<
    DepartamentoRow,
    | "nome"
    | "descricao"
    | "orcamento_mensal"
    | "localizacao"
    | "telefone"
    | "fax"
    | "ramal"
    | "email"
    | "unidade_id"
  >
>;

/** Label à esquerda + campo ocupando o resto da linha — mesmo modelo do
 * formulário de Departamento no Sólides (diferente do padrão label-em-cima
 * usado no resto do sistema, que segue outra referência). Não usa
 * <Field orientation="horizontal">: aquela variante aplica `flex-auto` na
 * label via uma regra do próprio componente (`*:data-[slot=field-label]`),
 * que vence a largura fixa que a gente tenta dar aqui e faz a label
 * "crescer" até quase metade da linha — daí a margem gigante. Markup
 * simples evita essa disputa de especificidade. */
function CampoLinha({
  htmlFor,
  label,
  children,
}: {
  htmlFor: string;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-start gap-4">
      <label
        htmlFor={htmlFor}
        className="w-40 shrink-0 pt-2 text-right text-sm font-medium text-foreground"
      >
        {label}
      </label>
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  );
}

export function DepartamentoForm({
  action,
  unidades,
  gestores,
  defaultValues,
  gestoresAtuaisIds = [],
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  unidades: Pick<UnidadeRow, "id" | "nome">[];
  gestores: Pick<PerfilRow, "id" | "nome_completo">[];
  defaultValues?: Defaults;
  gestoresAtuaisIds?: string[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="rounded-lg border border-border bg-card p-5 sm:p-7">
        <div className="flex flex-col gap-5">
          <CampoLinha htmlFor="nome" label="Nome*">
            <Input id="nome" name="nome" defaultValue={defaultValues?.nome} required />
          </CampoLinha>

          <CampoLinha htmlFor="descricao" label="Descrição">
            <Textarea
              id="descricao"
              name="descricao"
              rows={3}
              defaultValue={defaultValues?.descricao ?? ""}
            />
          </CampoLinha>

          <CampoLinha htmlFor="gestores_ids" label="Responsáveis">
            <MultiSelectCombobox
              id="gestores_ids"
              name="gestores_ids"
              items={gestores.map((g) => ({ value: g.id, label: g.nome_completo }))}
              defaultValues={gestoresAtuaisIds}
            />
            {gestores.length === 0 && (
              <FieldDescription>
                Nenhum usuário com papel de Gestor cadastrado ainda — crie um
                em Configurações {'>'} Usuários do sistema.
              </FieldDescription>
            )}
          </CampoLinha>

          <CampoLinha htmlFor="orcamento_mensal" label="Orçamento Mensal">
            <Input
              id="orcamento_mensal"
              name="orcamento_mensal"
              type="number"
              step="0.01"
              min="0"
              defaultValue={defaultValues?.orcamento_mensal ?? 0}
            />
          </CampoLinha>

          {unidades.length > 1 ? (
            <CampoLinha htmlFor="unidade_id" label="Unidade*">
              <Select
                name="unidade_id"
                items={unidades.map((u) => ({ value: u.id, label: u.nome }))}
                defaultValue={defaultValues?.unidade_id}
                required
              >
                <SelectTrigger id="unidade_id" className="w-full">
                  <SelectValue placeholder="Selecione a unidade..." />
                </SelectTrigger>
                <SelectContent>
                  {unidades.map((unidade) => (
                    <SelectItem key={unidade.id} value={unidade.id}>
                      {unidade.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </CampoLinha>
          ) : (
            <input type="hidden" name="unidade_id" value={unidades[0]?.id ?? ""} />
          )}
          {unidades.length === 0 && (
            <FieldError>Cadastre uma unidade antes de criar departamentos.</FieldError>
          )}

          <CampoLinha htmlFor="localizacao" label="Localização">
            <Input
              id="localizacao"
              name="localizacao"
              defaultValue={defaultValues?.localizacao ?? ""}
            />
          </CampoLinha>

          <CampoLinha htmlFor="telefone" label="Telefone">
            <Input
              id="telefone"
              name="telefone"
              defaultValue={defaultValues?.telefone ?? ""}
            />
          </CampoLinha>

          <CampoLinha htmlFor="fax" label="Fax">
            <Input id="fax" name="fax" defaultValue={defaultValues?.fax ?? ""} />
          </CampoLinha>

          <CampoLinha htmlFor="ramal" label="Ramal">
            <Input id="ramal" name="ramal" defaultValue={defaultValues?.ramal ?? ""} />
          </CampoLinha>

          <CampoLinha htmlFor="email" label="Email">
            <Input
              id="email"
              name="email"
              type="email"
              defaultValue={defaultValues?.email ?? ""}
            />
          </CampoLinha>

          {state?.error && (
            <div className="pl-44">
              <FieldError>{state.error}</FieldError>
            </div>
          )}
        </div>
      </div>

      <div className="flex gap-3">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar"}
        </Button>
        <Button type="button" variant="outline" render={<Link href="/departamentos" />}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
