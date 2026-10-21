import Link from "next/link";
import { Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { PerfilDiscSlider } from "@/components/ui/perfil-disc-slider";
import { CATEGORIAS_DISC } from "@/lib/perfil-disc";
import { BuscaPerfilIndicadorForm } from "@/components/forms/busca-perfil-indicador-form";
import { BuscaPerfilProntosForm } from "@/components/forms/busca-perfil-prontos-form";
import { VALOR_TRACO_PADRAO } from "@/lib/cargo-tracos";

type Modo = "prontos" | "indicador" | "personalizar";
type ChaveDisc = (typeof CATEGORIAS_DISC)[number]["chave"];

function valorParam(valor: string | string[] | undefined, padrao: number) {
  if (typeof valor !== "string") return padrao;
  const n = Number(valor);
  return Number.isFinite(n) ? n : padrao;
}

function textoParam(valor: string | string[] | undefined) {
  return typeof valor === "string" ? valor : undefined;
}

function TabButton({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button variant={active ? "default" : "outline"} size="sm" render={<Link href={href} />}>
      {children}
    </Button>
  );
}

export default async function BuscaPerfilPage(
  props: PageProps<"/cargos/busca-perfil">,
) {
  await requireAuth();
  const searchParams = await props.searchParams;
  const modoParam = searchParams.modo;
  const modo: Modo =
    modoParam === "indicador" || modoParam === "prontos" ? modoParam : "personalizar";

  const supabase = await createClient();

  // "Personalizar perfis": um valor-alvo por categoria DISC.
  const valoresIniciaisDisc = Object.fromEntries(
    CATEGORIAS_DISC.map((c) => [c.chave, valorParam(searchParams[`perfil_${c.chave}`], 50)]),
  ) as Record<ChaveDisc, number>;
  const buscouPersonalizado =
    modo === "personalizar" &&
    CATEGORIAS_DISC.some((c) => typeof searchParams[`perfil_${c.chave}`] === "string");

  // "Por indicador específico": uma competência (traço) + faixa aceitável.
  const chaveIndicador = textoParam(searchParams.traco_chave);
  const valorMinIndicador = valorParam(searchParams.valor_min, 60);
  const valorMaxIndicador = valorParam(searchParams.valor_max, 100);
  const buscouIndicador = modo === "indicador" && !!chaveIndicador;

  // "Por perfis prontos": Tipo de perfil (Grupo/Empresa) + Escolher.
  const tipoPerfilProntos = textoParam(searchParams.tipo_perfil);
  const escolherProntos = textoParam(searchParams.escolher);
  const buscouProntos = modo === "prontos" && !!tipoPerfilProntos && !!escolherProntos;

  const buscou = buscouPersonalizado || buscouIndicador || buscouProntos;

  let resultados: { id: string; nome: string; match: number }[] = [];

  if (buscou) {
    const { data: colaboradores } = await supabase
      .from("colaboradores")
      .select(
        "id, nome_completo, perfil_executor, perfil_comunicador, perfil_planejador, perfil_analista",
      )
      .eq("status", "ativo");

    if (buscouIndicador && chaveIndicador) {
      const { data: todosTracos } = await supabase
        .from("colaborador_tracos_comportamentais")
        .select("colaborador_id, valor")
        .eq("chave", chaveIndicador);

      const valorPorColaborador = new Map(
        (todosTracos ?? []).map((linha) => [linha.colaborador_id, linha.valor]),
      );

      resultados = (colaboradores ?? [])
        .filter((c) => valorPorColaborador.has(c.id))
        .map((c) => {
          const valor = valorPorColaborador.get(c.id) ?? VALOR_TRACO_PADRAO;
          const foraDaFaixa =
            valor < valorMinIndicador
              ? valorMinIndicador - valor
              : valor > valorMaxIndicador
                ? valor - valorMaxIndicador
                : 0;
          return { id: c.id, nome: c.nome_completo, match: Math.round(Math.max(0, 100 - foraDaFaixa)) };
        })
        .sort((a, b) => b.match - a.match);
    } else if (buscouProntos) {
      if (tipoPerfilProntos === "grupo") {
        const chave = escolherProntos as ChaveDisc;
        const campo = `perfil_${chave}` as const;
        resultados = (colaboradores ?? [])
          .filter((c) => c[campo] !== null)
          .map((c) => ({ id: c.id, nome: c.nome_completo, match: c[campo] as number }))
          .sort((a, b) => b.match - a.match);
      } else {
        // "Empresa" > "Média da empresa": ranqueia por proximidade ao
        // perfil médio de toda a empresa (perfil mais "típico").
        const comPerfil = (colaboradores ?? []).filter(
          (c) => c.perfil_executor !== null,
        );
        const media = CATEGORIAS_DISC.reduce(
          (acc, cat) => {
            const campo = `perfil_${cat.chave}` as const;
            const soma = comPerfil.reduce((s, c) => s + (Number(c[campo]) || 0), 0);
            acc[cat.chave] = comPerfil.length ? soma / comPerfil.length : 50;
            return acc;
          },
          {} as Record<ChaveDisc, number>,
        );
        resultados = comPerfil
          .map((c) => {
            const diferencas = CATEGORIAS_DISC.map((cat) => {
              const campo = `perfil_${cat.chave}` as const;
              return Math.abs((Number(c[campo]) || 0) - media[cat.chave]);
            });
            const mediaDiferenca = diferencas.reduce((a, b) => a + b, 0) / diferencas.length;
            return { id: c.id, nome: c.nome_completo, match: Math.round(Math.max(0, 100 - mediaDiferenca)) };
          })
          .sort((a, b) => b.match - a.match);
      }
    } else if (buscouPersonalizado) {
      resultados = (colaboradores ?? [])
        .filter((c) => c.perfil_executor !== null)
        .map((c) => {
          const diferencas = CATEGORIAS_DISC.map((cat) => {
            const campo = `perfil_${cat.chave}` as const;
            return Math.abs((Number(c[campo]) || 0) - valoresIniciaisDisc[cat.chave]);
          });
          const mediaDiferenca = diferencas.reduce((a, b) => a + b, 0) / diferencas.length;
          return { id: c.id, nome: c.nome_completo, match: Math.round(Math.max(0, 100 - mediaDiferenca)) };
        })
        .sort((a, b) => b.match - a.match);
    }
  }

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Busca de Perfil"
        description="Encontre colaboradores com o perfil comportamental mais parecido com o que você precisa."
      />

      <div className="flex flex-wrap gap-2">
        <TabButton href="?modo=prontos" active={modo === "prontos"}>
          Por perfis prontos
        </TabButton>
        <TabButton href="?modo=indicador" active={modo === "indicador"}>
          Por indicador específico
        </TabButton>
        <TabButton href="?modo=personalizar" active={modo === "personalizar"}>
          Personalizar perfis
        </TabButton>
      </div>

      {modo === "prontos" && (
        <Card>
          <CardContent>
            <BuscaPerfilProntosForm tipoAtual={tipoPerfilProntos} escolherAtual={escolherProntos} />
          </CardContent>
        </Card>
      )}

      {modo === "indicador" && (
        <Card>
          <CardContent>
            <BuscaPerfilIndicadorForm
              chaveAtual={chaveIndicador}
              minAtual={valorMinIndicador}
              maxAtual={valorMaxIndicador}
            />
          </CardContent>
        </Card>
      )}

      {modo === "personalizar" && (
        <form method="GET">
          <input type="hidden" name="modo" value="personalizar" />
          <Card>
            <CardContent className="flex flex-col gap-4">
              <div className="flex flex-col gap-1">
                {CATEGORIAS_DISC.map((cat) => (
                  <PerfilDiscSlider
                    key={cat.chave}
                    chave={cat.chave}
                    label={cat.label}
                    cor={cat.cor}
                    valorInicial={valoresIniciaisDisc[cat.chave]}
                  />
                ))}
              </div>
              <Button type="submit" className="w-fit">
                Buscar
              </Button>
            </CardContent>
          </Card>
        </form>
      )}

      {buscou &&
        (resultados.length === 0 ? (
          <EmptyState
            icon={Users}
            title="Ainda não há dados a serem exibidos"
            description="Nenhum colaborador ativo com perfil comportamental cadastrado bate com essa busca — cadastre o perfil na ficha de cada colaborador."
          />
        ) : (
          <Card>
            <CardContent className="flex flex-col gap-2">
              {resultados.map((r) => (
                <Link
                  key={r.id}
                  href={`/colaboradores/${r.id}`}
                  className="flex items-center justify-between rounded-lg border border-border p-3 text-sm hover:bg-muted"
                >
                  <span className="font-medium text-foreground">{r.nome}</span>
                  <Badge variant="secondary">{r.match}% de match</Badge>
                </Link>
              ))}
            </CardContent>
          </Card>
        ))}
    </div>
  );
}
