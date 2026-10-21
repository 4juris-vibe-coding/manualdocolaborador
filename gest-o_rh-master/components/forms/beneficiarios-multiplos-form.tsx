"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Field, FieldLabel, FieldError } from "@/components/ui/field";
import { SearchSelect } from "@/components/shared/search-select";
import { criarBeneficiariosEmMassa } from "@/app/(app)/beneficios/beneficiarios/actions";

type Opcao = { id: string; nome: string };

/** Etapa 2 (revelada depois de "Filtrar"): escolhe o benefício e aplica
 * pra todos os colaboradores do recorte de uma vez. */
export function BeneficiariosMultiplosForm({
  departamentoId,
  cargoId,
  totalColaboradores,
  beneficios,
}: {
  departamentoId?: string;
  cargoId?: string;
  totalColaboradores: number;
  beneficios: Opcao[];
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formData = new FormData(event.currentTarget);
    startTransition(async () => {
      const result = await criarBeneficiariosEmMassa(null, formData);
      if (result?.error) {
        toast.error(result.error);
        return;
      }
      toast.success(`${result?.adicionados ?? 0} beneficiário(s) adicionado(s).`);
      router.push("/beneficios/beneficiarios");
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4 border-t border-border pt-4">
      {departamentoId && <input type="hidden" name="departamento_id" value={departamentoId} />}
      {cargoId && <input type="hidden" name="cargo_id" value={cargoId} />}

      <p className="text-sm text-foreground">
        <span className="font-semibold">{totalColaboradores}</span> colaborador(es) ativo(s)
        encontrado(s) com esse filtro.
      </p>

      <Field>
        <FieldLabel htmlFor="beneficio_id">Benefício*</FieldLabel>
        <SearchSelect
          id="beneficio_id"
          name="beneficio_id"
          items={beneficios.map((b) => ({ value: b.id, label: b.nome }))}
          required
        />
      </Field>

      {totalColaboradores === 0 && (
        <FieldError>Nenhum colaborador encontrado com esse filtro.</FieldError>
      )}

      <Button type="submit" className="w-fit" disabled={pending || totalColaboradores === 0}>
        {pending ? "Adicionando..." : "Salvar"}
      </Button>
    </form>
  );
}
