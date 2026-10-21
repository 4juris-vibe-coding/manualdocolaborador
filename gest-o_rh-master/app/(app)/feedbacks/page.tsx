import Link from "next/link";
import { BarChart3, ChevronDown, Download, MessageSquareText, Pencil, Plus } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { PageHeader } from "@/components/shared/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { DataTable } from "@/components/shared/data-table";
import { SearchInput } from "@/components/shared/search-input";
import { PaginationBar } from "@/components/shared/pagination-bar";
import { StatusBadge, type StatusTone } from "@/components/shared/status-badge";
import { DeleteButton } from "@/components/shared/delete-button";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatDate, formatDateTime } from "@/lib/format";
import {
  parseListParams,
  totalDePaginas,
  toFlatSearchParams,
} from "@/lib/list-params";
import { excluirFeedback } from "./actions";

const CLASSIFICACAO_TONE: Record<string, StatusTone> = {
  positivo: "success",
  para_melhorar: "warning",
  neutro: "neutral",
};
const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  para_melhorar: "Para melhorar",
  neutro: "Neutro",
};

function NovoFeedbackButton() {
  return (
    <Button render={<Link href="/feedbacks/novo" />}>
      <Plus /> Novo Feedback
    </Button>
  );
}

function ExportarDropdown() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger render={<Button variant="outline" />}>
        <Download /> Exportar
        <ChevronDown className="ml-1 size-3.5" />
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem render={<Link href="/feedbacks/export?formato=excel" />}>
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/feedbacks/export?formato=pdf" />}>
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default async function FeedbacksPage(props: PageProps<"/feedbacks">) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);

  const supabase = await createClient();
  let query = supabase
    .from("feedbacks")
    .select("*", { count: "exact" })
    .order("data_feedback", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("comentario", `%${q}%`);

  const [{ data: feedbacks, count }, { data: colaboradores }, { data: autores }] =
    await Promise.all([
      query,
      supabase.from("colaboradores").select("id, nome_completo"),
      supabase.from("perfis").select("id, nome_completo"),
    ]);
  const nomeColaborador = new Map(
    (colaboradores ?? []).map((c) => [c.id, c.nome_completo]),
  );
  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.nome_completo]));
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Feedbacks"
        description="Feedbacks enviados aos colaboradores — eles conseguem ver por e-mail e/ou app."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/feedbacks/analise" />}>
              <BarChart3 /> Análise de Feedbacks
            </Button>
            <NovoFeedbackButton />
            <ExportarDropdown />
          </div>
        }
      />

      <SearchInput placeholder="Buscar no comentário..." />

      {!feedbacks || feedbacks.length === 0 ? (
        <EmptyState
          icon={MessageSquareText}
          title={q ? "Não há resultados para essa busca" : "Ainda não há feedbacks"}
          description={
            q
              ? "Tente buscar por outro termo."
              : "Envie o primeiro feedback pra um colaborador."
          }
          action={!q && <NovoFeedbackButton />}
        />
      ) : (
        <>
          <DataTable
            rows={feedbacks}
            rowKey={(f) => f.id}
            columns={[
              { header: "Data do Feedback", cell: (f) => formatDate(f.data_feedback) },
              {
                header: "Colaborador",
                cell: (f) => nomeColaborador.get(f.colaborador_id) ?? "—",
              },
              {
                header: "Classificação",
                cell: (f) => (
                  <StatusBadge tone={CLASSIFICACAO_TONE[f.classificacao]}>
                    {CLASSIFICACAO_LABEL[f.classificacao]}
                  </StatusBadge>
                ),
              },
              { header: "Autor", cell: (f) => nomeAutor.get(f.autor_id) ?? "—" },
              { header: "Data de criação", cell: (f) => formatDateTime(f.criado_em) },
              {
                header: "Ações",
                className: "w-16 text-right",
                cell: (f) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={<Link href={`/feedbacks/${f.id}/editar`} />}
                    >
                      <Pencil />
                      <span className="sr-only">Editar feedback</span>
                    </Button>
                    <DeleteButton
                      itemLabel="este feedback"
                      action={excluirFeedback.bind(null, f.id)}
                    />
                  </div>
                ),
              },
            ]}
          />
          <PaginationBar
            pagina={pagina}
            totalPaginas={totalPaginas}
            totalRegistros={count ?? 0}
            searchParams={toFlatSearchParams(searchParams)}
          />
        </>
      )}
    </div>
  );
}
