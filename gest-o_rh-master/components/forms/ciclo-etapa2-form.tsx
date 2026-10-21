"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Star } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldDescription } from "@/components/ui/field";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  NIVEIS_ESCALA_OPTIONS,
  ROTULO_ESCALA_OPTIONS,
} from "@/lib/validations/ciclo-avaliativo";
import { atualizarCicloEtapa2 } from "@/app/(app)/avaliacao-desempenho/solicitar/actions";
import type { CicloAvaliativoRow } from "@/types/database.types";

function PreviaEscala({ niveis, rotuloChave }: { niveis: number; rotuloChave: string }) {
  const preset = ROTULO_ESCALA_OPTIONS.find((r) => r.value === rotuloChave);
  if (!preset) return null;
  const rotulos = niveis === 4 ? preset.rotulos4 : preset.rotulos5;

  return (
    <div className="flex flex-col gap-2 rounded-lg border border-border bg-muted/30 p-4">
      {rotulos.map((rotulo, indice) => (
        <div key={rotulo} className="flex items-center gap-3">
          <div className="flex gap-0.5">
            {Array.from({ length: niveis }).map((_, estrela) => (
              <Star
                key={estrela}
                className={
                  estrela <= indice ? "size-4 fill-accent text-accent" : "size-4 text-muted-foreground"
                }
              />
            ))}
          </div>
          <span className="text-sm font-medium text-primary">{rotulo}</span>
        </div>
      ))}
    </div>
  );
}

export function CicloEtapa2Form({ ciclo }: { ciclo: CicloAvaliativoRow }) {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [niveis, setNiveis] = useState(String(ciclo.niveis_escala ?? 5));
  const [rotulo, setRotulo] = useState(ciclo.rotulo_escala ?? "");
  const [mostrarComentario, setMostrarComentario] = useState(
    ciclo.comentario_competencia_mostrar,
  );

  function salvar(indoParaListagem: boolean) {
    const formData = new FormData(formRef.current!);
    startTransition(async () => {
      const result = await atualizarCicloEtapa2(ciclo.id, formData);
      if (result.error) {
        toast.error(result.error);
        return;
      }
      toast.success("A etapa foi salva com sucesso!");
      router.push(
        indoParaListagem
          ? "/avaliacao-desempenho/solicitar"
          : `/avaliacao-desempenho/solicitar/${ciclo.id}?etapa=configuracoes`,
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
      <div className="rounded-lg bg-status-info px-4 py-3 text-center text-sm text-status-info-foreground">
        Escolha a quantidade de níveis de escala e qual modelo de rótulos este período avaliativo
        receberá.
      </div>

      <Field>
        <FieldLabel>Níveis de escala*</FieldLabel>
        <FieldDescription>
          Selecione quantos níveis de escala serão apresentados neste período avaliativo.
        </FieldDescription>
        <RadioGroup name="niveis_escala" value={niveis} onValueChange={setNiveis} className="flex flex-col gap-2">
          {NIVEIS_ESCALA_OPTIONS.map((opcao) => (
            <label key={opcao.value} className="flex items-center gap-2 text-sm text-foreground">
              <RadioGroupItem value={opcao.value} />
              {opcao.label}
            </label>
          ))}
        </RadioGroup>
      </Field>

      <Field>
        <FieldLabel htmlFor="rotulo_escala">Rótulo da escala de notas*</FieldLabel>
        <FieldDescription>
          Escolha qual rótulo dentre nossas sugestões será aplicado à avaliação. Selecione
          qualquer opção para pré-visualizar.
        </FieldDescription>
        <span className="text-sm text-foreground">Opções de rótulos</span>
        <Select name="rotulo_escala" items={ROTULO_ESCALA_OPTIONS} value={rotulo} onValueChange={(v) => v && setRotulo(v)}>
          <SelectTrigger id="rotulo_escala" className="w-full">
            <SelectValue placeholder="Selecione" />
          </SelectTrigger>
          <SelectContent>
            {ROTULO_ESCALA_OPTIONS.map((opcao) => (
              <SelectItem key={opcao.value} value={opcao.value}>
                {opcao.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {rotulo && <PreviaEscala niveis={Number(niveis)} rotuloChave={rotulo} />}
      </Field>

      <Field>
        <div className="flex items-center justify-between gap-4">
          <div>
            <FieldLabel>Comentários por competência avaliada</FieldLabel>
            <FieldDescription>
              Defina se cada competência avaliada terá um campo para a inclusão de comentários.
            </FieldDescription>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <span className="text-sm text-muted-foreground">Mostrar</span>
            <Switch
              name="comentario_competencia_mostrar"
              checked={mostrarComentario}
              onCheckedChange={setMostrarComentario}
            />
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            name="comentario_competencia_obrigatorio"
            defaultChecked={ciclo.comentario_competencia_obrigatorio}
            disabled={!mostrarComentario}
          />
          Tornar o preenchimento obrigatório
        </label>
      </Field>

      <Field>
        <FieldLabel>Comentários e observações gerais</FieldLabel>
        <FieldDescription>
          Defina se neste ciclo avaliativo o campo de Comentários e observações do formulário
          deverá ter preenchimento obrigatório ou não.
        </FieldDescription>
        <label className="flex items-center gap-2 text-sm text-foreground">
          <Checkbox
            name="comentario_geral_obrigatorio"
            defaultChecked={ciclo.comentario_geral_obrigatorio}
          />
          Tornar o preenchimento obrigatório
        </label>
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
            render={<a href={`/avaliacao-desempenho/solicitar/${ciclo.id}?etapa=criar`} />}
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
