"use client";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { toast } from "sonner";
import { Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Field, FieldError } from "@/components/ui/field";
import { Card, CardHeader, CardTitle, CardDescription, CardContent } from "@/components/ui/card";
import { MultiSelectCombobox } from "@/components/shared/multi-select-combobox";
import { TIPO_CONTRATO_OPTIONS } from "@/lib/validations/colaborador";
import { PERIODO_AVALIATIVO_EXPERIENCIA_OPTIONS } from "@/lib/validations/configuracao-avaliacao-experiencia";
import { salvarConfiguracaoAvaliacaoExperiencia, type FormState } from "@/app/(app)/avaliacao-experiencia/configurar/actions";
import type { ConfiguracaoAvaliacaoExperienciaRow, CargoRow } from "@/types/database.types";

export function ConfiguracaoAvaliacaoExperienciaForm({
  config,
  cargos,
}: {
  config: ConfiguracaoAvaliacaoExperienciaRow;
  cargos: Pick<CargoRow, "id" | "nome">[];
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    salvarConfiguracaoAvaliacaoExperiencia,
    null,
  );
  // Controlados (em vez de defaultChecked/defaultValue) porque, depois de
  // salvar, o revalidatePath traz um `config` novo pro Server Component
  // pai enquanto este componente continua montado — com valor "default"
  // o Base UI acusa "changing default state of an uncontrolled component
  // after being initialized".
  const [habilitado, setHabilitado] = useState(config.habilitado);
  const [periodoAvaliativo, setPeriodoAvaliativo] = useState(config.periodo_avaliativo);

  useEffect(() => {
    if (state?.success) toast.success("Configurações salvas com sucesso.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex items-start gap-2 rounded-lg border-l-4 border-status-info-foreground bg-status-info px-4 py-3 text-sm text-status-info-foreground">
        <Info className="mt-0.5 size-4 shrink-0" />
        <div className="flex flex-col gap-3">
          <p>
            Serão considerados elegíveis para participar do ciclo completo de avaliação os
            colaboradores que tenham sido admitidos após a data de ativação.{" "}
            <span className="font-semibold">
              Caso a data de admissão seja ANTERIOR, mas o ciclo completo ainda não tenha sido
              concluído, o colaborador será incluído normalmente,
            </span>{" "}
            porém, as e/ou as primeiras avaliações que não se enquadrarem no ciclo completo serão
            desconsideradas e marcadas como expiradas.
          </p>
          <p>
            Os avaliadores <span className="font-semibold">receberão os formulários 7 dias antes da data de expiração.</span>
          </p>
          <p>
            O progresso das avaliações pode ser acompanhado: na página &quot;Acompanhar
            Avaliações&quot;, e pelo dashboard de &quot;Relatório Geral&quot;.
          </p>
        </div>
      </div>

      <Card>
        <CardContent className="flex items-center justify-between gap-4">
          <div>
            <p className="font-semibold text-foreground">
              Habilitar o envio da avaliação do período de experiência
            </p>
            <p className="text-sm text-muted-foreground">
              Ao ativar esse recurso e configurar as opções de avaliação, o envio das avaliações
              de período de experiência será automático.
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Switch name="habilitado" checked={habilitado} onCheckedChange={setHabilitado} />
            <span className="text-sm text-muted-foreground">Ativar</span>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Período avaliativo*</CardTitle>
          <CardDescription>
            Defina qual ou quais períodos serão considerados para a avaliação do período de
            experiência do colaborador.
            <br />
            A avaliação será enviada por e-mail aos gestores 7 dias antes do término dos períodos
            definidos abaixo, considerando dias corridos.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <RadioGroup
            name="periodo_avaliativo"
            value={periodoAvaliativo}
            onValueChange={(v) => v && setPeriodoAvaliativo(v as typeof periodoAvaliativo)}
          >
            {PERIODO_AVALIATIVO_EXPERIENCIA_OPTIONS.map((opcao) => (
              <label key={opcao.value} className="flex items-center gap-2 text-sm text-foreground">
                <RadioGroupItem value={opcao.value} />
                {opcao.label}
              </label>
            ))}
          </RadioGroup>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Vínculo empregatício</CardTitle>
          <CardDescription>
            Defina quais vínculos empregatícios entre empresa e colaborador serão considerados
            para estas avaliações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelectCombobox
            id="tipos_contrato"
            name="tipos_contrato"
            items={[...TIPO_CONTRATO_OPTIONS]}
            defaultValues={config.tipos_contrato ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cargos</CardTitle>
          <CardDescription>
            Defina quais cargos serão considerados para estas avaliações.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <MultiSelectCombobox
            id="cargo_ids"
            name="cargo_ids"
            items={cargos.map((c) => ({ value: c.id, label: c.nome }))}
            defaultValues={config.cargo_ids ?? []}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Competências avaliadas</CardTitle>
          <CardDescription>
            Assim como na Avaliação de Desempenho, as competências avaliadas são atreladas aos
            cargos e gerenciadas na tela de competências.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex justify-end">
          <Button type="button" render={<Link href="/competencias" />}>
            Gerenciar competências
          </Button>
        </CardContent>
      </Card>

      {state?.error && (
        <Field>
          <FieldError>{state.error}</FieldError>
        </Field>
      )}

      <div className="flex justify-end">
        <Button type="submit" disabled={pending}>
          {pending ? "Salvando..." : "Salvar alterações"}
        </Button>
      </div>
    </form>
  );
}
