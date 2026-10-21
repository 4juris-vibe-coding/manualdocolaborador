"use client";

import { useState, useTransition } from "react";
import Papa from "papaparse";
import { toast } from "sonner";
import { UploadCloud } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable, type DataTableColumn } from "@/components/shared/data-table";
import { COLUNAS_IMPORTACAO } from "@/lib/validations/colaborador-import";
import {
  importarColaboradores,
  type ResultadoImportacao,
} from "@/app/(app)/colaboradores/importar/actions";

type LinhaPreview = Record<string, string> & { __chave: string };

export function ImportarColaboradoresForm() {
  const [linhas, setLinhas] = useState<Record<string, string>[]>([]);
  const [nomeArquivo, setNomeArquivo] = useState("");
  const [resultado, setResultado] = useState<ResultadoImportacao | null>(null);
  const [pending, startTransition] = useTransition();

  function handleArquivo(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    setNomeArquivo(arquivo.name);
    setResultado(null);
    Papa.parse<Record<string, string>>(arquivo, {
      header: true,
      skipEmptyLines: true,
      complete: (resultados) => setLinhas(resultados.data),
    });
    // Permite selecionar o mesmo arquivo de novo depois de corrigi-lo.
    event.target.value = "";
  }

  function handleConfirmar() {
    startTransition(async () => {
      const resultado = await importarColaboradores(linhas);
      setResultado(resultado);
      setLinhas([]);
      if (resultado.sucesso > 0) {
        toast.success(`${resultado.sucesso} colaborador(es) importado(s).`);
      }
      if (resultado.erros.length > 0) {
        toast.error(`${resultado.erros.length} linha(s) com erro.`);
      }
    });
  }

  const preview = linhas
    .slice(0, 10)
    .map((linha, index) => ({ ...linha, __chave: String(index) }));

  return (
    <div className="flex flex-col gap-6">
      <div className="rounded-lg border border-dashed border-border bg-card p-6">
        <p className="mb-1 text-sm font-medium text-foreground">
          Colunas esperadas no CSV (primeira linha = cabeçalho):
        </p>
        <p className="mb-4 text-sm text-muted-foreground">
          {COLUNAS_IMPORTACAO.join(", ")}
        </p>
        <p className="mb-4 text-xs text-muted-foreground">
          &ldquo;Cargo&rdquo; e &ldquo;Departamento&rdquo; precisam ser
          exatamente iguais (sem diferenciar maiúsculas/minúsculas) a um
          cargo/departamento já cadastrado. &ldquo;Data de admissão&rdquo; no
          formato AAAA-MM-DD. &ldquo;Tipo de contrato&rdquo; é opcional (em
          branco vira CLT) — aceita CLT, PJ, Estágio, Temporário ou
          Aprendiz. &ldquo;CNPJ&rdquo; é obrigatório só quando o tipo de
          contrato for PJ. Colaboradores importados entram como ativos e
          não recebem o checklist de admissão automaticamente.
        </p>
        <label className="flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted">
          <UploadCloud className="size-4" />
          Escolher arquivo CSV
          <Input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={handleArquivo}
          />
        </label>
      </div>

      {preview.length > 0 && (
        <>
          <p className="text-sm text-muted-foreground">
            {nomeArquivo} — {linhas.length} linha(s) encontradas
            {linhas.length > 10 ? " (mostrando as 10 primeiras)" : ""}.
          </p>
          <DataTable
            rows={preview}
            rowKey={(linha) => linha.__chave}
            columns={COLUNAS_IMPORTACAO.map(
              (coluna): DataTableColumn<LinhaPreview> => ({
                header: coluna,
                cell: (linha) => linha[coluna] ?? "",
              }),
            )}
          />
          <Button onClick={handleConfirmar} disabled={pending} className="w-fit">
            {pending
              ? "Importando..."
              : `Confirmar importação de ${linhas.length} colaborador(es)`}
          </Button>
        </>
      )}

      {resultado && (
        <div className="rounded-lg border border-border bg-card p-4 text-sm">
          <p className="font-medium">
            {resultado.sucesso} colaborador(es) importado(s) com sucesso.
          </p>
          {resultado.erros.length > 0 && (
            <ul className="mt-2 list-disc space-y-1 pl-4 text-destructive">
              {resultado.erros.map((erro) => (
                <li key={erro.linha}>
                  Linha {erro.linha}: {erro.motivo}
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  );
}
