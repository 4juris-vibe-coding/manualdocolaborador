import Link from "next/link";
import { HeartPulse } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/format";
import {
  RESULTADO_EXAME_OPTIONS,
  TIPO_EXAME_OPTIONS,
} from "@/lib/validations/exame";

const TIPO_LABEL = Object.fromEntries(
  TIPO_EXAME_OPTIONS.map((o) => [o.value, o.label]),
);
const RESULTADO_LABEL = Object.fromEntries(
  RESULTADO_EXAME_OPTIONS.map((o) => [o.value, o.label]),
);
const RESULTADO_TONE: Record<string, StatusTone> = {
  apto: "success",
  apto_com_restricoes: "warning",
  inapto: "danger",
};

function situacaoValidade(dataValidade: string | null) {
  if (!dataValidade) return { label: "Sem validade", tone: "neutral" as StatusTone };
  const dias = Math.ceil(
    (new Date(`${dataValidade}T00:00:00Z`).getTime() - Date.now()) /
      (1000 * 60 * 60 * 24),
  );
  if (dias < 0) return { label: "Vencido", tone: "danger" as StatusTone };
  if (dias <= 60) return { label: `Vence em ${dias}d`, tone: "warning" as StatusTone };
  return { label: `Válido (${dias}d)`, tone: "success" as StatusTone };
}

export default async function SaudeOcupacionalPage() {
  const supabase = await createClient();

  const [{ data: exames }, { data: colaboradores }] = await Promise.all([
    supabase
      .from("colaborador_exames")
      .select("*")
      .order("data_validade", { ascending: true, nullsFirst: false }),
    supabase.from("colaboradores").select("id, nome_completo, status"),
  ]);

  const nomeColaborador = new Map(
    (colaboradores ?? []).map((c) => [c.id, c]),
  );

  // Prioriza: vencidos/vencendo primeiro, sem validade por último.
  const ordenados = [...(exames ?? [])].sort((a, b) => {
    if (!a.data_validade) return 1;
    if (!b.data_validade) return -1;
    return a.data_validade.localeCompare(b.data_validade);
  });

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Saúde Ocupacional"
        description="Exames admissionais, periódicos e demissionais (ASO) de todos os colaboradores."
      />

      {ordenados.length === 0 ? (
        <EmptyState
          icon={HeartPulse}
          title="Nenhum exame registrado ainda"
          description="Adicione exames na ficha de cada colaborador."
        />
      ) : (
        <DataTable
          rows={ordenados}
          rowKey={(e) => e.id}
          columns={[
            {
              header: "Colaborador",
              cell: (e) => {
                const colaborador = nomeColaborador.get(e.colaborador_id);
                return (
                  <Link
                    href={`/colaboradores/${e.colaborador_id}`}
                    className="hover:underline"
                  >
                    {colaborador?.nome_completo ?? "—"}
                  </Link>
                );
              },
            },
            { header: "Tipo", cell: (e) => TIPO_LABEL[e.tipo_exame] },
            { header: "Data do exame", cell: (e) => formatDate(e.data_exame) },
            { header: "Validade", cell: (e) => formatDate(e.data_validade) },
            {
              header: "Situação",
              cell: (e) => {
                const s = situacaoValidade(e.data_validade);
                return <StatusBadge tone={s.tone}>{s.label}</StatusBadge>;
              },
            },
            {
              header: "Resultado",
              cell: (e) => (
                <StatusBadge tone={RESULTADO_TONE[e.resultado]}>
                  {RESULTADO_LABEL[e.resultado]}
                </StatusBadge>
              ),
            },
          ]}
        />
      )}
    </div>
  );
}
