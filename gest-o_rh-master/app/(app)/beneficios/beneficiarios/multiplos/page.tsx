import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field, FieldLabel } from "@/components/ui/field";
import { BeneficiariosMultiplosForm } from "@/components/forms/beneficiarios-multiplos-form";

export default async function AdicionarMultiplosBeneficiariosPage(
  props: PageProps<"/beneficios/beneficiarios/multiplos">,
) {
  await requireAdmin();
  const searchParams = await props.searchParams;

  const departamentoId =
    typeof searchParams.departamento_id === "string" ? searchParams.departamento_id : "todos";
  const cargoId = typeof searchParams.cargo_id === "string" ? searchParams.cargo_id : "todos";
  const filtrado = searchParams.filtrado === "1";

  const supabase = await createClient();
  const [{ data: departamentos }, { data: cargos }, { data: beneficios }] = await Promise.all([
    supabase.from("departamentos").select("id, nome").order("nome"),
    supabase.from("cargos").select("id, nome").order("nome"),
    supabase.from("beneficios").select("id, nome").order("nome"),
  ]);

  let totalColaboradores = 0;
  if (filtrado) {
    let query = supabase
      .from("colaboradores")
      .select("id", { count: "exact", head: true })
      .eq("status", "ativo");
    if (departamentoId !== "todos") query = query.eq("departamento_id", departamentoId);
    if (cargoId !== "todos") query = query.eq("cargo_id", cargoId);
    const { count } = await query;
    totalColaboradores = count ?? 0;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Benefícios" />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <h2 className="text-base font-semibold text-foreground">Novos Beneficiários</h2>

          <div>
            <h3 className="text-sm font-semibold text-foreground">Filtro de Colaboradores</h3>
            <p className="text-sm text-muted-foreground">
              Obs: ao clicar em <span className="font-semibold">FILTRAR</span>, mas nenhum
              parâmetro for escolhido, todos os colaboradores ativos serão selecionados!
            </p>
          </div>

          <form method="GET" className="flex flex-col gap-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="departamento_id">Departamento</FieldLabel>
                <Select
                  name="departamento_id"
                  items={[
                    { value: "todos", label: "Todos os Departamentos" },
                    ...(departamentos ?? []).map((d) => ({ value: d.id, label: d.nome })),
                  ]}
                  defaultValue={departamentoId}
                >
                  <SelectTrigger id="departamento_id" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Departamentos</SelectItem>
                    {(departamentos ?? []).map((d) => (
                      <SelectItem key={d.id} value={d.id}>
                        {d.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>

              <Field>
                <FieldLabel htmlFor="cargo_id">Cargo</FieldLabel>
                <Select
                  name="cargo_id"
                  items={[
                    { value: "todos", label: "Todos os Cargos" },
                    ...(cargos ?? []).map((c) => ({ value: c.id, label: c.nome })),
                  ]}
                  defaultValue={cargoId}
                >
                  <SelectTrigger id="cargo_id" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="todos">Todos os Cargos</SelectItem>
                    {(cargos ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>

            <input type="hidden" name="filtrado" value="1" />
            <div className="flex gap-2">
              <Button type="submit">Filtrar</Button>
              <Button type="button" variant="outline" render={<Link href="/beneficios/beneficiarios" />}>
                Cancelar
              </Button>
            </div>
          </form>

          {filtrado && (
            <BeneficiariosMultiplosForm
              departamentoId={departamentoId !== "todos" ? departamentoId : undefined}
              cargoId={cargoId !== "todos" ? cargoId : undefined}
              totalColaboradores={totalColaboradores}
              beneficios={beneficios ?? []}
            />
          )}
        </CardContent>
      </Card>
    </div>
  );
}
