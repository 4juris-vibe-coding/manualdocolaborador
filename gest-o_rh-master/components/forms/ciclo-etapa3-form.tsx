"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { AlertTriangle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { SearchSelect } from "@/components/shared/search-select";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { TIPO_CONTRATO_OPTIONS } from "@/lib/validations/colaborador";
import {
  TIPO_RELACAO_OPTIONS,
  NIVEL_ESTRUTURA_OPTIONS,
} from "@/lib/validations/ciclo-avaliativo";
import { atualizarCicloEtapa3 } from "@/app/(app)/avaliacao-desempenho/solicitar/actions";
import type { CicloAvaliativoRow, NivelEstruturaAvaliacao } from "@/types/database.types";

type Opcao = { id: string; nome: string };

export function CicloEtapa3Form({
  ciclo,
  unidades,
  departamentos,
  cargos,
}: {
  ciclo: CicloAvaliativoRow;
  unidades: Opcao[];
  departamentos: Opcao[];
  cargos: Opcao[];
}) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [tipoRelacao, setTipoRelacao] = useState(ciclo.tipo_relacao);
  const [nivelEstrutura, setNivelEstrutura] = useState<NivelEstruturaAvaliacao | "">(
    ciclo.nivel_estrutura ?? "",
  );

  const listaPorNivel: Record<NivelEstruturaAvaliacao, Opcao[]> = {
    unidade: unidades,
    departamento: departamentos,
    cargo: cargos,
  };
  const opcoesEstrutura = nivelEstrutura ? listaPorNivel[nivelEstrutura] : [];

  function salvar(indoParaListagem: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await atualizarCicloEtapa3(ciclo.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("A etapa foi salva com sucesso!");
      router.push(
        indoParaListagem
          ? "/avaliacao-desempenho/solicitar"
          : `/avaliacao-desempenho/solicitar/${ciclo.id}?etapa=solicitar`,
      );
    });
  }

  return (
    <form
      ref={formRef}
      onSubmit={(e) => {
        e.preventDefault();
        salvar(false);
      }}
      className="flex flex-col gap-6"
    >
      <Field>
        <FieldLabel>Tipo de avaliação</FieldLabel>
        <FieldDescription>
          Selecionaremos automaticamente os participantes de acordo com o tipo de avaliação
          definido. A relação líder-liderado se dará através do campo de Superior direto, na
          ficha do colaborador. Consideramos pares os colaboradores de mesmo cargo e mesmo líder.
        </FieldDescription>

        <div className="flex items-start gap-2 rounded-md border-l-4 border-status-warning-foreground bg-status-warning px-4 py-3 text-sm text-status-warning-foreground">
          <AlertTriangle className="mt-0.5 size-4 shrink-0" />
          <p>
            <span className="font-semibold">Atenção:</span> Consideramos os dados da ficha do
            colaborador (superior direto, cargo, departamento e unidade) que estavam presentes no
            momento da criação das avaliações. Quaisquer alterações nas informações do colaborador
            feitas após a criação da avaliação não serão refletidas no histórico, o que exigirá a
            exclusão das avaliações inconsistentes e a criação de novas.
          </p>
        </div>

        <div className="grid gap-4 lg:grid-cols-[1fr_240px] lg:items-start">
          <RadioGroup
            name="tipo_relacao"
            value={tipoRelacao}
            onValueChange={(v) => v && setTipoRelacao(v as typeof tipoRelacao)}
            className="flex flex-col gap-3"
          >
            {TIPO_RELACAO_OPTIONS.map((opcao) => (
              <label
                key={opcao.value}
                className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm has-data-checked:border-primary"
              >
                <RadioGroupItem value={opcao.value} className="mt-0.5" />
                <span>
                  <span className="block font-medium text-foreground">{opcao.label}</span>
                  <span className="text-muted-foreground">{opcao.descricao}</span>
                </span>
              </label>
            ))}
          </RadioGroup>

          <label className="flex items-start gap-2 rounded-lg border border-border p-3 text-sm">
            <Checkbox
              name="autoavaliacao"
              defaultChecked={ciclo.autoavaliacao}
              className="mt-0.5"
            />
            <span>
              <span className="block font-medium text-foreground">Autoavaliação (opcional)</span>
              <span className="text-muted-foreground">Liderado se autoavalia.</span>
            </span>
          </label>
        </div>
      </Field>

      <Field>
        <FieldLabel htmlFor="admitidos_ate">Data de admissão</FieldLabel>
        <FieldDescription>
          Considerar como elegível para este período avaliativo todos os colaboradores admitidos
          até a data abaixo:
        </FieldDescription>
        <span className="text-sm text-foreground">Admitidos até</span>
        <Input
          id="admitidos_ate"
          name="admitidos_ate"
          type="date"
          defaultValue={ciclo.admitidos_ate ?? ""}
        />
      </Field>

      <Field>
        <FieldLabel htmlFor="tipos_contrato">Vínculo empregatício</FieldLabel>
        <FieldDescription>
          Defina quais vínculos empregatícios entre empresa e colaborador serão considerados para
          este período avaliativo.
        </FieldDescription>
        <span className="text-sm text-foreground">Tipos de contrato</span>
        <MultiSelectCombobox
          id="tipos_contrato"
          name="tipos_contrato"
          items={[...TIPO_CONTRATO_OPTIONS]}
          defaultValues={ciclo.tipos_contrato ?? []}
        />
      </Field>

      <Field>
        <FieldLabel>Estrutura e funções</FieldLabel>
        <FieldDescription>
          Selecione quais unidades, departamentos e cargos serão considerados para esta avaliação.
        </FieldDescription>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="flex flex-col gap-1">
            <label htmlFor="nivel_estrutura" className="text-xs text-muted-foreground">
              Nível
            </label>
            <Select
              name="nivel_estrutura"
              items={NIVEL_ESTRUTURA_OPTIONS}
              value={nivelEstrutura}
              onValueChange={(v) => setNivelEstrutura((v ?? "") as NivelEstruturaAvaliacao | "")}
            >
              <SelectTrigger id="nivel_estrutura" className="w-full">
                <SelectValue placeholder="Selecione um nível" />
              </SelectTrigger>
              <SelectContent>
                {NIVEL_ESTRUTURA_OPTIONS.map((opcao) => (
                  <SelectItem key={opcao.value} value={opcao.value}>
                    {opcao.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-col gap-1">
            <label htmlFor="opcao_estrutura_id" className="text-xs text-muted-foreground">
              Opções
            </label>
            <SearchSelect
              key={nivelEstrutura || "sem-nivel"}
              id="opcao_estrutura_id"
              name="opcao_estrutura_id"
              items={opcoesEstrutura.map((o) => ({ value: o.id, label: o.nome }))}
              defaultValue={nivelEstrutura === ciclo.nivel_estrutura ? (ciclo.opcao_estrutura_id ?? undefined) : undefined}
              placeholder={nivelEstrutura ? "Digite para buscar" : "Todos as opções"}
              disabled={!nivelEstrutura}
            />
          </div>
        </div>
      </Field>

      <div className="flex items-center justify-between border-t border-border pt-4">
        <button
          type="button"
          disabled={pending}
          onClick={() => salvar(true)}
          className="text-sm font-medium text-primary underline disabled:opacity-50"
        >
          Salvar rascunho
        </button>
        <div className="flex gap-3">
          <Button
            type="button"
            variant="outline"
            render={<a href={`/avaliacao-desempenho/solicitar/${ciclo.id}?etapa=escalas`} />}
          >
            Voltar
          </Button>
          <Button type="submit" disabled={pending}>
            {pending ? "Salvando..." : "Salvar e continuar"}
          </Button>
        </div>
      </div>
    </form>
  );
}
