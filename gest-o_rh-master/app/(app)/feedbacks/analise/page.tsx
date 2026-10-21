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
import { CLASSIFICACAO_FEEDBACK_OPTIONS } from "@/lib/validations/feedback";

const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  para_melhorar: "Para melhorar",
  neutro: "Neutro",
};

export default async function AnaliseFeedbacksPage(
  props: PageProps<"/feedbacks/analise">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const colaboradorId =
    typeof searchParams.colaborador_id === "string" ? searchParams.colaborador_id : undefined;
  const classificacao =
    typeof searchParams.classificacao === "string" ? searchParams.classificacao : undefined;
  const de = typeof searchParams.de === "string" ? searchParams.de : undefined;
  const ate = typeof searchParams.ate === "string" ? searchParams.ate : undefined;
  const temFiltro = Boolean(colaboradorId || classificacao || de || ate);

  const classificacaoValida = CLASSIFICACAO_FEEDBACK_OPTIONS.find(
    (o) => o.value === classificacao,
  )?.value;

  const supabase = await createClient();
  let query = supabase.from("feedbacks").select("classificacao");
  if (colaboradorId) query = query.eq("colaborador_id", colaboradorId);
  if (classificacaoValida) query = query.eq("classificacao", classificacaoValida);
  if (de) query = query.gte("data_feedback", de);
  if (ate) query = query.lte("data_feedback", ate);

  const [{ data: feedbacks }, { data: colaboradores }] = await Promise.all([
    query,
    supabase.from("colaboradores").select("id, nome_completo").order("nome_completo"),
  ]);

  const total = feedbacks?.length ?? 0;
  const porClassificacao: Record<string, number> = {
    positivo: 0,
    para_melhorar: 0,
    neutro: 0,
  };
  for (const f of feedbacks ?? []) {
    porClassificacao[f.classificacao] = (porClassificacao[f.classificacao] ?? 0) + 1;
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Análise de Feedbacks" />

      <Card>
        <CardContent className="flex flex-col gap-4">
          <Collapsible className="flex flex-col items-end gap-4">
            <CollapsibleTrigger render={<Button variant="outline" />}>
              <Filter /> Filtrar
            </CollapsibleTrigger>
            <CollapsibleContent className="w-full">
              <form method="GET" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
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
                  name="classificacao"
                  items={CLASSIFICACAO_FEEDBACK_OPTIONS}
                  defaultValue={classificacao}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Classificação" />
                  </SelectTrigger>
                  <SelectContent>
                    {CLASSIFICACAO_FEEDBACK_OPTIONS.map((c) => (
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
              feedbacks cadastrados{temFiltro && " que batam com esse filtro"}.
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <Card>
                <CardHeader>
                  <CardDescription>Total de feedbacks</CardDescription>
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
                  <CardDescription>{CLASSIFICACAO_LABEL.para_melhorar}</CardDescription>
                  <CardTitle className="text-3xl text-status-warning-foreground">
                    {porClassificacao.para_melhorar}
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

          <Button variant="outline" className="w-fit" render={<Link href="/feedbacks" />}>
            Cancelar
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
