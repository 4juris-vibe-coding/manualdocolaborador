"use client";

import { useActionState, useEffect, useRef } from "react";
import { FileText, HeartPulse } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Field, FieldError } from "@/components/ui/field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";
import {
  RESULTADO_EXAME_OPTIONS,
  TIPO_EXAME_OPTIONS,
} from "@/lib/validations/exame";
import {
  criarExame,
  excluirExame,
  obterUrlDocumento,
} from "@/app/(app)/colaboradores/[id]/actions";
import type {
  ColaboradorDocumentoRow,
  ColaboradorExameRow,
} from "@/types/database.types";

const TIPO_LABEL = Object.fromEntries(
  TIPO_EXAME_OPTIONS.map((o) => [o.value, o.label]),
);
const RESULTADO_LABEL = Object.fromEntries(
  RESULTADO_EXAME_OPTIONS.map((o) => [o.value, o.label]),
);
const RESULTADO_TONE: Record<string, StatusTone> = {
  apto: "success",
  apto_com_restricoes: "warning",
  inapto: "danger",
};

function diasParaVencer(dataValidade: string | null) {
  if (!dataValidade) return null;
  const validade = new Date(`${dataValidade}T00:00:00Z`);
  return Math.ceil((validade.getTime() - Date.now()) / (1000 * 60 * 60 * 24));
}

export function ExamesSection({
  colaboradorId,
  exames,
  documentos,
  isAdmin,
}: {
  colaboradorId: string;
  exames: ColaboradorExameRow[];
  documentos: ColaboradorDocumentoRow[];
  isAdmin: boolean;
}) {
  const acao = criarExame.bind(null, colaboradorId);
  const [state, formAction, pending] = useActionState(acao, null);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (state?.success) formRef.current?.reset();
  }, [state]);

  const documentoPorId = new Map(documentos.map((d) => [d.id, d]));

  async function handleAbrirDocumento(caminho: string) {
    const resultado = await obterUrlDocumento(caminho);
    if (resultado.error || !resultado.url) {
      toast.error(resultado.error ?? "Não foi possível abrir o documento.");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      {exames.length === 0 ? (
        <EmptyState icon={HeartPulse} title="Nenhum exame registrado" />
      ) : (
        <ul className="flex flex-col gap-2">
          {exames.map((exame) => {
            const restantes = diasParaVencer(exame.data_validade);
            return (
              <li
                key={exame.id}
                className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
              >
                <div>
                  <p className="font-medium text-foreground">
                    {TIPO_LABEL[exame.tipo_exame]} · {formatDate(exame.data_exame)}
                  </p>
                  <p className="text-muted-foreground">
                    {exame.medico_nome && `Dr(a). ${exame.medico_nome} · `}
                    {exame.data_validade &&
                      `válido até ${formatDate(exame.data_validade)}`}
                    {restantes !== null &&
                      restantes <= 60 &&
                      ` (${restantes <= 0 ? "vencido" : `${restantes} dias`})`}
                  </p>
                  {exame.documento_id &&
                    documentoPorId.get(exame.documento_id) && (
                      <button
                        type="button"
                        onClick={() =>
                          handleAbrirDocumento(
                            documentoPorId.get(exame.documento_id!)!
                              .caminho_arquivo,
                          )
                        }
                        className="mt-1 flex items-center gap-1 text-xs text-primary hover:underline"
                      >
                        <FileText className="size-3" />
                        {documentoPorId.get(exame.documento_id)!.nome}
                      </button>
                    )}
                </div>
                <div className="flex items-center gap-2">
                  <StatusBadge tone={RESULTADO_TONE[exame.resultado]}>
                    {RESULTADO_LABEL[exame.resultado]}
                  </StatusBadge>
                  {isAdmin && (
                    <DeleteButton
                      itemLabel="este exame"
                      action={excluirExame.bind(null, colaboradorId, exame.id)}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}

      {isAdmin && (
        <form
          ref={formRef}
          action={formAction}
          className="grid gap-3 rounded-lg border border-dashed border-border p-4 sm:grid-cols-4"
        >
          <Field>
            <Select
              name="tipo_exame"
              items={TIPO_EXAME_OPTIONS}
              defaultValue="periodico"
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {TIPO_EXAME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Input name="data_exame" type="date" placeholder="Data do exame" required />
          </Field>
          <Field>
            <Input name="data_validade" type="date" placeholder="Validade" />
          </Field>
          <Field>
            <Select
              name="resultado"
              items={RESULTADO_EXAME_OPTIONS}
              defaultValue="apto"
              required
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {RESULTADO_EXAME_OPTIONS.map((o) => (
                  <SelectItem key={o.value} value={o.value}>
                    {o.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field>
            <Input name="medico_nome" placeholder="Médico(a)" />
          </Field>
          <Field>
            <Input name="medico_crm" placeholder="CRM" />
          </Field>
          <Field className="sm:col-span-2">
            <Textarea name="observacoes" placeholder="Observações" rows={1} />
          </Field>
          {documentos.length > 0 && (
            <Field className="sm:col-span-2">
              <Select
                name="documento_id"
                items={documentos.map((d) => ({ value: d.id, label: d.nome }))}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Anexar documento já enviado (opcional)" />
                </SelectTrigger>
                <SelectContent>
                  {documentos.map((documento) => (
                    <SelectItem key={documento.id} value={documento.id}>
                      {documento.nome}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          )}
          <Button type="submit" variant="outline" disabled={pending} className="w-fit">
            {pending ? "Salvando..." : "Adicionar exame"}
          </Button>
          {state?.error && (
            <div className="sm:col-span-4">
              <FieldError>{state.error}</FieldError>
            </div>
          )}
        </form>
      )}
    </div>
  );
}
