"use client";

import { useRef, useState, useTransition } from "react";
import { toast } from "sonner";
import { FileText, UploadCloud } from "lucide-react";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { DeleteButton } from "@/components/shared/delete-button";
import { createClient } from "@/lib/supabase/client";
import { caminhoDocumento } from "@/lib/documento-path";
import {
  excluirDocumento,
  obterUrlDocumento,
  registrarDocumento,
} from "@/app/(app)/colaboradores/[id]/actions";
import type { ColaboradorDocumentoRow } from "@/types/database.types";

const CATEGORIAS = [
  "RG/CPF",
  "CTPS",
  "Comprovante de residência",
  "Contrato assinado",
  "Exame admissional",
  "Outro",
];

export function DocumentosSection({
  colaboradorId,
  documentos,
  podeGerenciar,
}: {
  colaboradorId: string;
  documentos: ColaboradorDocumentoRow[];
  podeGerenciar: boolean;
}) {
  const [categoria, setCategoria] = useState(CATEGORIAS[0]);
  const [enviando, startTransition] = useTransition();
  const inputRef = useRef<HTMLInputElement>(null);

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const arquivo = event.target.files?.[0];
    if (!arquivo) return;

    startTransition(async () => {
      const supabase = createClient();
      const caminho = caminhoDocumento(colaboradorId, arquivo.name);
      const { error: uploadError } = await supabase.storage
        .from("colaboradores")
        .upload(caminho, arquivo);

      if (uploadError) {
        toast.error("Não foi possível enviar o arquivo.");
        return;
      }

      const resultado = await registrarDocumento(colaboradorId, {
        nome: arquivo.name,
        categoria,
        caminhoArquivo: caminho,
        tamanhoBytes: arquivo.size,
      });

      if (resultado && "error" in resultado && resultado.error) {
        toast.error(resultado.error);
      } else {
        toast.success("Documento enviado.");
      }
      if (inputRef.current) inputRef.current.value = "";
    });
  }

  async function handleAbrir(caminho: string) {
    const resultado = await obterUrlDocumento(caminho);
    if (resultado.error || !resultado.url) {
      toast.error(resultado.error ?? "Não foi possível abrir o documento.");
      return;
    }
    window.open(resultado.url, "_blank", "noopener,noreferrer");
  }

  return (
    <div className="flex flex-col gap-4">
      {documentos.length === 0 ? (
        <EmptyState icon={FileText} title="Nenhum documento anexado" />
      ) : (
        <ul className="flex flex-col gap-2">
          {documentos.map((documento) => (
            <li
              key={documento.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-border bg-card p-3 text-sm"
            >
              <button
                type="button"
                onClick={() => handleAbrir(documento.caminho_arquivo)}
                className="flex items-center gap-2 text-left hover:underline"
              >
                <FileText className="size-4 shrink-0 text-muted-foreground" />
                <span>
                  <span className="font-medium text-foreground">
                    {documento.nome}
                  </span>
                  <span className="text-muted-foreground">
                    {" "}
                    · {documento.categoria}
                  </span>
                </span>
              </button>
              {podeGerenciar && (
                <DeleteButton
                  itemLabel={`o documento "${documento.nome}"`}
                  action={excluirDocumento.bind(
                    null,
                    colaboradorId,
                    documento.id,
                    documento.caminho_arquivo,
                  )}
                />
              )}
            </li>
          ))}
        </ul>
      )}

      {podeGerenciar && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border border-dashed border-border p-4">
          <Select
            value={categoria}
            onValueChange={(valor) => valor && setCategoria(valor)}
          >
            <SelectTrigger className="w-56">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CATEGORIAS.map((opcao) => (
                <SelectItem key={opcao} value={opcao}>
                  {opcao}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <label className="flex cursor-pointer items-center gap-2 rounded-lg border border-input bg-transparent px-3 py-2 text-sm hover:bg-muted">
            <UploadCloud className="size-4" />
            {enviando ? "Enviando..." : "Enviar arquivo"}
            <input
              ref={inputRef}
              type="file"
              className="hidden"
              onChange={handleUpload}
              disabled={enviando}
            />
          </label>
        </div>
      )}
    </div>
  );
}
