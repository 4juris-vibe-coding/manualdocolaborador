import Link from "next/link";
import { Filter } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Collapsible,
  CollapsibleTrigger,
  CollapsibleContent,
} from "@/components/ui/collapsible";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { CLASSIFICACAO_OPTIONS } from "@/lib/validations/registro";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  neutro: "Neutro",
};

export default async function AnaliseRegistrosPage(
  props: PageProps<"/registros/analise">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const colaboradorId =
    typeof searchParams.colaborador_id === "string" ? searchParams.colaborador_id : undefined;
  const tipoId =
    typeof searchParams.tipo_registro_id === "string" ? searchParams.tipo_registro_id : undefined;
  const classificacao =
    typeof searchParams.classificacao === "string" ? searchParams.classificacao : undefined;
  const de = typeof searchParams.de === "string" ? searchParams.de : undefined;
  const ate = typeof searchParams.ate === "string" ? searchParams.ate : undefined;
  const temFiltro = Boolean(colaboradorId || tipoId || classificacao || de || ate);

  const classificacaoValida = CLASSIFICACAO_OPTIONS.find((o) => o.value === classificacao)?.value;

  const supabase = await createClient();
  let query = supabase.from("registros").select("classificacao, tipo_registro_id");
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  if (tipoId) query = query.eq("tipo_registro_id", tipoId);
  if (classificacaoValida) query = query.eq("classificacao", classificacaoValida);
  if (de) query = query.gte("data_registro", de);
  if (ate) query = query.lte("data_registro", ate);

  const [{ data: registros }, { data: colaboradores }, { data: tipos }] = await Promise.all([
    query,
    supabase.from("colaboradores").select("id, nome_completo").order("nome_completo"),
    supabase.from("tipos_registro").select("id, nome").order("nome"),
  ]);

  const total = registros?.length ?? 0;
  const porClassificacao: Record<string, number> = { positivo: 0, negativo: 0, neutro: 0 };
  for (const r of registros ?? []) {
    porClassificacao[r.classificacao] = (porClassificacao[r.classificacao] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Análise de Registros" />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Collapsible className="flex flex-col items-end gap-4">
            <CollapsibleTrigger render={<Button variant="outline" />}>
              <Filter /> Filtrar
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <form method="GET" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <Select
                  name="colaborador_id"
                  items={(colaboradores ?? []).map((c) => ({ value: c.id, label: c.nome_completo }))}
                  defaultValue={colaboradorId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Colaborador" />
                  </SelectTrigger>
                  <SelectContent>
                    {(colaboradores ?? []).map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select
                  name="tipo_registro_id"
                  items={(tipos ?? []).map((t) => ({ value: t.id, label: t.nome }))}
                  defaultValue={tipoId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Tipo de Registro" />
                  </SelectTrigger>
                  <SelectContent>
                    {(tipos ?? []).map((t) => (
                      <SelectItem key={t.id} value={t.id}>
                        {t.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Select name="classificacao" items={CLASSIFICACAO_OPTIONS} defaultValue={classificacao}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Classificação" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACAO_OPTIONS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>
                        {c.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>

                <Input type="date" name="de" defaultValue={de} />
                <Input type="date" name="ate" defaultValue={ate} />

                <Button type="submit" className="w-fit">
                  Aplicar filtro
                </Button>
              </form>
            </CollapsibleContent>
          </Collapsible>

          {total === 0 ? (
            <div className="rounded-md border-l-4 border-status-warning-foreground bg-status-warning px-4 py-3 text-sm text-status-warning-foreground">
              <span className="font-semibold">Atenção!</span> Não existem
              registros cadastrados{temFiltro && " que batam com esse filtro"}.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardDescription>Total de registros</CardDescription>
                  <CardTitle className="text-3xl">{total}</CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>{CLASSIFICACAO_LABEL.positivo}</CardDescription>
                  <CardTitle className="text-3xl text-status-success-foreground">
                    {porClassificacao.positivo}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>{CLASSIFICACAO_LABEL.negativo}</CardDescription>
                  <CardTitle className="text-3xl text-status-danger-foreground">
                    {porClassificacao.negativo}
                  </CardTitle>
                </CardHeader>
              </Card>
              <Card>
                <CardHeader>
                  <CardDescription>{CLASSIFICACAO_LABEL.neutro}</CardDescription>
                  <CardTitle className="text-3xl text-status-neutral-foreground">
                    {porClassificacao.neutro}
                  </CardTitle>
                </CardHeader>
              </Card>
            </div>
          )}

          <Button variant="outline" className="w-fit" render={<Link href="/registros" />}>
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
