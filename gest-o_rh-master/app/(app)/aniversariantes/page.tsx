import Link from "next/link";
import { Cake } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { Button } from "@/components/ui/button";

const MESES = [
  "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro",
];

function parseMes(valor: string | undefined) {
  const numero = Number(valor);
  return Number.isInteger(numero) && numero >= 0 && numero <= 11
    ? numero
    : new Date().getMonth();
}

export default async function AniversariantesPage(
  props: PageProps<"/aniversariantes">,
) {
  const searchParams = await props.searchParams;
  const mesSelecionado = parseMes(
    typeof searchParams.mes === "string" ? searchParams.mes : undefined,
  );

  const supabase = await createClient();
  const { data: colaboradores } = await supabase
    .from("colaboradores")
    .select("id, nome_completo, data_nascimento, status")
    .eq("status", "ativo")
    .not("data_nascimento", "is", null);

  const aniversariantes = (colaboradores ?? [])
    .filter((c) => {
      const data = new Date(`${c.data_nascimento}T00:00:00Z`);
      return data.getUTCMonth() === mesSelecionado;
    })
    .sort((a, b) => {
      const diaA = new Date(`${a.data_nascimento}T00:00:00Z`).getUTCDate();
      const diaB = new Date(`${b.data_nascimento}T00:00:00Z`).getUTCDate();
      return diaA - diaB;
    });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Aniversariantes"
        description="Aniversários dos colaboradores ativos, mês a mês."
      />

      <div className="flex flex-wrap gap-1">
        {MESES.map((nomeMes, indice) => (
          <Button
            key={nomeMes}
            size="sm"
            variant={indice === mesSelecionado ? "default" : "outline"}
            render={<Link href={`?mes=${indice}`} />}
          >
            {nomeMes}
          </Button>
        ))}
      </div>

      {aniversariantes.length === 0 ? (
        <EmptyState
          icon={Cake}
          title={`Ninguém faz aniversário em ${MESES[mesSelecionado]}`}
        />
      ) : (
        <DataTable
          rows={aniversariantes}
          rowKey={(c) => c.id}
          columns={[
            {
              header: "Dia",
              className: "w-16",
              cell: (c) =>
                new Date(`${c.data_nascimento}T00:00:00Z`).getUTCDate(),
            },
            {
              header: "Colaborador",
              cell: (c) => (
                <Link
                  href={`/colaboradores/${c.id}`}
                  className="hover:underline"
                >
                  {c.nome_completo}
                </Link>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
