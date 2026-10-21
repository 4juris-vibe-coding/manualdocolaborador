"use client";

import { useActionState, useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PerfilComportamentalSliders } from "@/components/forms/perfil-comportamental-sliders";
import { PerfilDiscSlider, CATEGORIAS_DISC } from "@/components/ui/perfil-disc-slider";
import { salvarPerfilComportamental } from "@/app/(app)/colaboradores/[id]/actions";

/**
 * Perfil comportamental do colaborador: os 24 traços (mesmos da
 * Engenharia de Cargo, perfil detalhado) + as 4 categorias DISC
 * (Executor/Comunicador/Planejador/Analista, é o que a Busca de Perfil
 * usa). Ambos vivem no mesmo card e salvam juntos.
 */
export function ColaboradorPerfilComportamentalSection({
  colaboradorId,
  valoresIniciais,
  valoresIniciaisDisc,
}: {
  colaboradorId: string;
  valoresIniciais: Record<string, number>;
  valoresIniciaisDisc: Record<string, number>;
}) {
  const acao = salvarPerfilComportamental.bind(null, colaboradorId);
  const [state, formAction, pending] = useActionState(acao, null);

  useEffect(() => {
    if (state?.success) toast.success("Perfil comportamental salvo.");
  }, [state]);

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Categorias DISC
        </h3>
        <p className="mb-3 text-xs text-muted-foreground">
          Usado na Busca de Perfil (aba &ldquo;Personalizar perfis&rdquo;).
        </p>
        <div className="flex flex-col gap-1">
          {CATEGORIAS_DISC.map((cat) => (
            <PerfilDiscSlider
              key={cat.chave}
              chave={cat.chave}
              label={cat.label}
              cor={cat.cor}
              valorInicial={valoresIniciaisDisc[cat.chave] ?? 50}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="mb-2 text-sm font-semibold text-foreground">
          Traços detalhados
        </h3>
        <PerfilComportamentalSliders valoresIniciais={valoresIniciais} />
      </div>

      <Button type="submit" disabled={pending} className="w-fit">
        {pending ? "Salvando..." : "Salvar perfil"}
      </Button>
    </form>
  );
}
