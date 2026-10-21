import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

export type EtapaWizard = {
  chave: string;
  titulo: string;
  descricao: string;
};

/** Barra lateral "Etapas" do assistente de Solicitar Avaliação — mostra
 * as 4 etapas com check (concluída) / bolinha preenchida (atual) / vazia
 * (pendente) e uma linha conectando os passos, igual ao Sólides. */
export function EtapasWizard({
  etapas,
  etapaAtual,
}: {
  etapas: EtapaWizard[];
  etapaAtual: string;
}) {
  const indiceAtual = etapas.findIndex((e) => e.chave === etapaAtual);

  return (
    <div className="rounded-lg border border-border bg-card p-5">
      <h2 className="mb-4 text-sm font-semibold text-foreground">Etapas</h2>
      <p className="mb-4 text-xs text-muted-foreground">Criação de avaliação</p>
      <ol className="flex flex-col">
        {etapas.map((etapa, indice) => {
          const concluida = indice < indiceAtual;
          const ativa = indice === indiceAtual;
          const ultima = indice === etapas.length - 1;
          return (
            <li key={etapa.chave} className="flex gap-3">
              <div className="flex flex-col items-center">
                <div
                  className={cn(
                    "flex size-6 shrink-0 items-center justify-center rounded-full border-2",
                    concluida && "border-primary bg-primary text-primary-foreground",
                    ativa && "border-primary bg-primary text-primary-foreground",
                    !concluida && !ativa && "border-border bg-background",
                  )}
                >
                  {concluida ? (
                    <Check className="size-3.5" />
                  ) : (
                    <span
                      className={cn(
                        "size-2 rounded-full",
                        ativa ? "bg-primary-foreground" : "bg-transparent",
                      )}
                    />
                  )}
                </div>
                {!ultima && <div className="w-0.5 flex-1 bg-border" />}
              </div>
              <div className={cn("pb-6", ultima && "pb-0")}>
                <p
                  className={cn(
                    "text-sm font-semibold",
                    ativa || concluida ? "text-primary" : "text-muted-foreground",
                  )}
                >
                  {etapa.titulo}
                </p>
                <p className="mt-0.5 text-xs text-muted-foreground">{etapa.descricao}</p>
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}

export const ETAPAS_SOLICITAR_AVALIACAO: EtapaWizard[] = [
  {
    chave: "criar",
    titulo: "CRIAR AVALIAÇÃO",
    descricao: "Defina nome, descrição e tipo da avaliação",
  },
  {
    chave: "escalas",
    titulo: "ESCALAS",
    descricao: "Escolha o modelo de rótulos e níveis de escala",
  },
  {
    chave: "configuracoes",
    titulo: "CONFIGURAÇÕES",
    descricao: "Configure e defina detalhes importantes",
  },
  {
    chave: "solicitar",
    titulo: "SOLICITAR AVALIAÇÃO",
    descricao: "Defina participantes e respectivos avaliadores",
  },
];
