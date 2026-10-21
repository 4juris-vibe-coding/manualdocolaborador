import Link from "next/link";
import { AlertTriangle, Cake, HeartPulse, Users } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { requireAuth } from "@/lib/auth/session";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { estaEmPeriodoDeExperiencia } from "@/lib/admissao-calculo";
import { formatDate } from "@/lib/format";

async function getDashboardData() {
  const supabase = await createClient();

  const daquiA60Dias = new Date();
  daquiA60Dias.setDate(daquiA60Dias.getDate() + 60);

  const [
    { count: totalAtivos },
    { data: aniversariantes },
    { data: colaboradoresParaAlertas },
    { data: examesVencendo },
  ] = await Promise.all([
    supabase
      .from("colaboradores")
      .select("*", { count: "exact", head: true })
      .eq("status", "ativo"),
    supabase
      .from("colaboradores")
      .select("nome_completo, data_nascimento")
      .eq("status", "ativo")
      .not("data_nascimento", "is", null),
    supabase
      .from("colaboradores")
      .select("id, nome_completo, data_admissao, tipo_contrato")
      .eq("status", "ativo"),
    supabase
      .from("colaborador_exames")
      .select("id, colaborador_id, tipo_exame, data_validade")
      .not("data_validade", "is", null)
      .lte("data_validade", daquiA60Dias.toISOString().slice(0, 10))
      .order("data_validade"),
  ]);

  const mesAtual = new Date().getMonth();
  const aniversariantesDoMes = (aniversariantes ?? []).filter((c) => {
    if (!c.data_nascimento) return false;
    return new Date(`${c.data_nascimento}T00:00:00`).getMonth() === mesAtual;
  });

  const colaboradores = colaboradoresParaAlertas ?? [];

  const emExperiencia = colaboradores
    .filter((c) => c.tipo_contrato === "clt")
    .map((c) => ({ ...c, ...estaEmPeriodoDeExperiencia(c.data_admissao) }))
    .filter((c) => c.emExperiencia)
    .sort((a, b) => a.diasRestantes - b.diasRestantes);

  const nomeColaborador = new Map(colaboradores.map((c) => [c.id, c.nome_completo]));
  const examesAlerta = (examesVencendo ?? [])
    .filter((e) => nomeColaborador.has(e.colaborador_id))
    .map((e) => ({ ...e, nome: nomeColaborador.get(e.colaborador_id)! }));

  return {
    totalAtivos: totalAtivos ?? 0,
    aniversariantesDoMes,
    emExperiencia,
    examesAlerta,
  };
}

export default async function DashboardPage() {
  const perfil = await requireAuth();
  const { totalAtivos, aniversariantesDoMes, emExperiencia, examesAlerta } =
    await getDashboardData();

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">
          Olá, {perfil.nome_completo.split(" ")[0]}
        </h1>
        <p className="text-sm text-muted-foreground">
          Aqui está um resumo rápido do RH hoje.
        </p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Users className="size-4" /> Colaboradores ativos
            </CardDescription>
            <CardTitle className="text-3xl">{totalAtivos}</CardTitle>
          </CardHeader>
        </Card>

        <Card>
          <CardHeader>
            <CardDescription className="flex items-center gap-1.5">
              <Cake className="size-4" /> Aniversariantes do mês
            </CardDescription>
            <CardTitle className="text-3xl">
              {aniversariantesDoMes.length}
            </CardTitle>
          </CardHeader>
          {aniversariantesDoMes.length > 0 && (
            <CardContent className="flex flex-col gap-1 text-sm text-muted-foreground">
              {aniversariantesDoMes.slice(0, 5).map((c) => (
                <span key={c.nome_completo}>{c.nome_completo}</span>
              ))}
            </CardContent>
          )}
        </Card>
      </div>

      <div>
        <h2 className="mb-3 text-lg font-semibold text-foreground">
          Central de Avisos
        </h2>
        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <AlertTriangle className="size-4 text-status-warning-foreground" />
                Em período de experiência
              </CardTitle>
              <CardDescription>
                Colaboradores CLT nos primeiros 90 dias de casa.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {emExperiencia.length === 0 ? (
                <p className="text-muted-foreground">Nada por aqui.</p>
              ) : (
                emExperiencia.map((c) => (
                  <Link
                    key={c.id}
                    href={`/colaboradores/${c.id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted"
                  >
                    <span>{c.nome_completo}</span>
                    <span className="text-xs text-muted-foreground">
                      {c.diasRestantes <= 0
                        ? "venceu"
                        : `${c.diasRestantes} dias restantes`}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <HeartPulse className="size-4 text-status-danger-foreground" />
                Exames de saúde vencendo
              </CardTitle>
              <CardDescription>
                ASO vencido ou vencendo nos próximos 60 dias.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col gap-2 text-sm">
              {examesAlerta.length === 0 ? (
                <p className="text-muted-foreground">Nada por aqui.</p>
              ) : (
                examesAlerta.map((e) => (
                  <Link
                    key={e.id}
                    href={`/colaboradores/${e.colaborador_id}`}
                    className="flex items-center justify-between rounded-md px-2 py-1 hover:bg-muted"
                  >
                    <span>{e.nome}</span>
                    <span className="text-xs text-muted-foreground">
                      {formatDate(e.data_validade)}
                    </span>
                  </Link>
                ))
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
