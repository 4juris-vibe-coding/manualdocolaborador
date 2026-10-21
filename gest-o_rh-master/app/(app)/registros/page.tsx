import Link from "next/link";
import { BarChart3, ChevronDown, ClipboardList, Download, Pencil, Plus } from "lucide-react";
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
import { excluirRegistro } from "./actions";

const CLASSIFICACAO_TONE: Record<string, StatusTone> = {
  positivo: "success",
  negativo: "danger",
  neutro: "neutral",
};
const CLASSIFICACAO_LABEL: Record<string, string> = {
  positivo: "Positivo",
  negativo: "Negativo",
  neutro: "Neutro",
};

function NovoRegistroButton() {
  return (
    <Button render={<Link href="/registros/novo" />}>
      <Plus /> Novo(a) Registro
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
        <DropdownMenuItem render={<Link href="/registros/export?formato=excel" />}>
          Excel
        </DropdownMenuItem>
        <DropdownMenuItem render={<Link href="/registros/export?formato=pdf" />}>
          PDF
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default async function RegistrosPage(props: PageProps<"/registros">) {
  const searchParams = await props.searchParams;
  const { q, pagina, from, to } = parseListParams(searchParams);

  const supabase = await createClient();
  let query = supabase
    .from("registros")
    .select("*", { count: "exact" })
    .order("data_registro", { ascending: false })
    .range(from, to);
  if (q) query = query.ilike("descricao", `%${q}%`);

  const [
    { data: registros, count },
    { data: colaboradores },
    { data: tipos },
    { data: autores },
  ] = await Promise.all([
    query,
    supabase.from("colaboradores").select("id, nome_completo"),
    supabase.from("tipos_registro").select("id, nome"),
    supabase.from("perfis").select("id, nome_completo"),
  ]);
  const nomeColaborador = new Map(
    (colaboradores ?? []).map((c) => [c.id, c.nome_completo]),
  );
  const nomeTipo = new Map((tipos ?? []).map((t) => [t.id, t.nome]));
  const nomeAutor = new Map((autores ?? []).map((a) => [a.id, a.nome_completo]));
  const totalPaginas = totalDePaginas(count ?? 0);

  return (
    <div className="flex flex-col gap-6">
      <PageHeader
        title="Registros"
        description="Ocorrências funcionais dos colaboradores (advertências, elogios, atestados, etc.) — anotações confidenciais, não vão pro colaborador."
        action={
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" render={<Link href="/registros/analise" />}>
              <BarChart3 /> Análise de Registros
            </Button>
            <NovoRegistroButton />
            <ExportarDropdown />
          </div>
        }
      />

      <SearchInput placeholder="Buscar no comentário..." />

      {!registros || registros.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={q ? "Nenhum registro encontrado" : "Ainda não há registros"}
          description={
            q
              ? "Tente buscar por outro termo."
              : "Crie o primeiro registro de ocorrência de um colaborador."
          }
          action={!q && <NovoRegistroButton />}
        />
      ) : (
        <>
          <DataTable
            rows={registros}
            rowKey={(r) => r.id}
            columns={[
              { header: "Data do Registro", cell: (r) => formatDate(r.data_registro) },
              {
                header: "Colaborador",
                cell: (r) => nomeColaborador.get(r.colaborador_id) ?? "—",
              },
              {
                header: "Tipo de Registro",
                cell: (r) => nomeTipo.get(r.tipo_registro_id) ?? "—",
              },
              {
                header: "Classificação",
                cell: (r) => (
                  <StatusBadge tone={CLASSIFICACAO_TONE[r.classificacao]}>
                    {CLASSIFICACAO_LABEL[r.classificacao]}
                  </StatusBadge>
                ),
              },
              {
                header: "Autor",
                cell: (r) => nomeAutor.get(r.autor_id) ?? "—",
              },
              {
                header: "Data de criação",
                cell: (r) => formatDateTime(r.criado_em),
              },
              {
                header: "Ações",
                className: "w-16 text-right",
                cell: (r) => (
                  <div className="flex justify-end gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      render={<Link href={`/registros/${r.id}/editar`} />}
                    >
                      <Pencil />
                      <span className="sr-only">Editar registro</span>
                    </Button>
                    <DeleteButton
                      itemLabel="este registro"
                      action={excluirRegistro.bind(null, r.id)}
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
