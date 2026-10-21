import Link from "next/link";
import { notFound } from "next/navigation";
import { AlertTriangle, Pencil, UserRound } from "lucide-react";
import { createClient } from "@/lib/supabase/server";
import { getPerfil, requireAuth } from "@/lib/auth/session";
import { PageHeader } from "@/components/shared/page-header";
import { StatusBadge } from "@/components/shared/status-badge";
import { DependentesSection } from "@/components/forms/dependentes-section";
import { DocumentosSection } from "@/components/forms/documentos-section";
import { ExamesSection } from "@/components/forms/exames-section";
import { ColaboradorPerfilComportamentalSection } from "@/components/forms/colaborador-perfil-comportamental-section";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  formatCNPJ,
  formatCPF,
  formatCurrency,
  formatDate,
  formatPhone,
  SENIORIDADE_LABEL,
} from "@/lib/format";
import {
  calcularDiasDeCasa,
  estaEmPeriodoDeExperiencia,
} from "@/lib/admissao-calculo";
import {
  ESCOLARIDADE_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  RACA_ETNIA_OPTIONS,
  SEXO_OPTIONS,
  TIPO_CONTRATO_OPTIONS,
  temRegimeClt,
} from "@/lib/validations/colaborador";

const TIPO_CONTRATO_LABEL = Object.fromEntries(
  TIPO_CONTRATO_OPTIONS.map((o) => [o.value, o.label]),
);
const SEXO_LABEL = Object.fromEntries(SEXO_OPTIONS.map((o) => [o.value, o.label]));
const RACA_ETNIA_LABEL = Object.fromEntries(
  RACA_ETNIA_OPTIONS.map((o) => [o.value, o.label]),
);
const ESTADO_CIVIL_LABEL = Object.fromEntries(
  ESTADO_CIVIL_OPTIONS.map((o) => [o.value, o.label]),
);
const ESCOLARIDADE_LABEL = Object.fromEntries(
  ESCOLARIDADE_OPTIONS.map((o) => [o.value, o.label]),
);

function InfoItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm text-foreground">{value || "—"}</p>
    </div>
  );
}

export default async function FichaColaboradorPage(
  props: PageProps<"/colaboradores/[id]">,
) {
  await requireAuth();
  const perfil = await getPerfil();
  const isAdmin = perfil?.papel === "admin_rh";
  const { id } = await props.params;
  const supabase = await createClient();

  const { data: colaborador } = await supabase
    .from("colaboradores")
    .select("*")
    .eq("id", id)
    .single();
  if (!colaborador) notFound();

  const [
    { data: cargo },
    { data: departamento },
    { data: dependentes },
    { data: documentos },
    { data: exames },
    { data: historicoCargo },
    { data: registrosRecentes },
    { data: tracosComportamentais },
  ] = await Promise.all([
    supabase.from("cargos").select("*").eq("id", colaborador.cargo_id).single(),
    supabase
      .from("departamentos")
      .select("nome")
      .eq("id", colaborador.departamento_id)
      .single(),
    supabase
      .from("colaborador_dependentes")
      .select("*")
      .eq("colaborador_id", id)
      .order("criado_em"),
    supabase
      .from("colaborador_documentos")
      .select("*")
      .eq("colaborador_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("colaborador_exames")
      .select("*")
      .eq("colaborador_id", id)
      .order("data_exame", { ascending: false }),
    supabase
      .from("colaborador_historico_cargo")
      .select("*")
      .eq("colaborador_id", id)
      .order("criado_em", { ascending: false }),
    supabase
      .from("registros")
      .select("*")
      .eq("colaborador_id", id)
      .order("data_registro", { ascending: false })
      .limit(5),
    supabase
      .from("colaborador_tracos_comportamentais")
      .select("chave, valor")
      .eq("colaborador_id", id),
  ]);

  const { data: superiorDireto } = colaborador.superior_direto_id
    ? await supabase
        .from("colaboradores")
        .select("nome_completo")
        .eq("id", colaborador.superior_direto_id)
        .single()
    : { data: null };

  const valoresIniciaisTracos = Object.fromEntries(
    (tracosComportamentais ?? []).map((t) => [t.chave, t.valor]),
  );

  // Nomes de cargo anterior/novo para o histórico — busca só os que aparecem.
  const idsCargosHistorico = Array.from(
    new Set(
      (historicoCargo ?? [])
        .flatMap((h) => [h.cargo_anterior_id, h.cargo_novo_id])
        .filter((v): v is string => Boolean(v)),
    ),
  );
  const { data: cargosHistorico } =
    idsCargosHistorico.length > 0
      ? await supabase.from("cargos").select("id, nome").in("id", idsCargosHistorico)
      : { data: [] as { id: string; nome: string }[] };
  const nomeCargoHistorico = new Map(
    (cargosHistorico ?? []).map((c) => [c.id, c.nome]),
  );

  const diasDeCasa = calcularDiasDeCasa(colaborador.data_admissao);
  const temVinculoClt = temRegimeClt(colaborador.tipo_contrato);
  const experiencia =
    colaborador.tipo_contrato === "clt" && colaborador.status === "ativo"
      ? estaEmPeriodoDeExperiencia(colaborador.data_admissao)
      : { emExperiencia: false, diasDeCasa: 0, diasRestantes: 0 };

  const endereco = [
    colaborador.endereco_logradouro,
    colaborador.endereco_numero,
    colaborador.endereco_complemento,
  ]
    .filter(Boolean)
    .join(", ");
  const enderecoLinha2 = [
    colaborador.endereco_bairro,
    colaborador.endereco_cidade && colaborador.endereco_estado
      ? `${colaborador.endereco_cidade}/${colaborador.endereco_estado}`
      : colaborador.endereco_cidade,
    colaborador.endereco_cep,
  ]
    .filter(Boolean)
    .join(" — ");

  return (
    <div className="flex flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <PageHeader
          title={colaborador.nome_completo}
          description={`${cargo?.nome ?? "—"} · ${departamento?.nome ?? "—"}`}
        />
        <div className="flex items-center gap-2">
          <StatusBadge tone={colaborador.status === "ativo" ? "success" : "neutral"}>
            {colaborador.status === "ativo" ? "Ativo" : "Inativo"}
          </StatusBadge>
          <Button
            variant="outline"
            render={<Link href={`/colaboradores/${id}/editar`} />}
          >
            <Pencil /> Editar
          </Button>
        </div>
      </div>

      {experiencia.emExperiencia && (
        <div className="flex items-center gap-2 rounded-lg border border-status-warning-foreground/20 bg-status-warning p-3 text-sm text-status-warning-foreground">
          <AlertTriangle className="size-4 shrink-0" />
          Em período de experiência há {experiencia.diasDeCasa} dias
          {experiencia.diasRestantes > 0
            ? ` — restam ${experiencia.diasRestantes} dias para completar 90 dias de casa.`
            : "."}
        </div>
      )}
      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-base">
              <UserRound className="size-4" /> Dados pessoais
            </CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            {colaborador.nome_social && (
              <InfoItem label="Nome social" value={colaborador.nome_social} />
            )}
            <InfoItem label="E-mail" value={colaborador.email} />
            <InfoItem label="Telefone" value={formatPhone(colaborador.telefone)} />
            <InfoItem label="CPF" value={formatCPF(colaborador.cpf)} />
            <InfoItem
              label="Data de nascimento"
              value={formatDate(colaborador.data_nascimento)}
            />
            <InfoItem
              label="Sexo"
              value={colaborador.sexo ? SEXO_LABEL[colaborador.sexo] : ""}
            />
            <InfoItem
              label="Estado civil"
              value={
                colaborador.estado_civil
                  ? ESTADO_CIVIL_LABEL[colaborador.estado_civil]
                  : ""
              }
            />
            <InfoItem
              label="Raça/Etnia"
              value={
                colaborador.raca_etnia
                  ? RACA_ETNIA_LABEL[colaborador.raca_etnia]
                  : ""
              }
            />
            <InfoItem
              label="Escolaridade"
              value={
                colaborador.escolaridade
                  ? ESCOLARIDADE_LABEL[colaborador.escolaridade]
                  : ""
              }
            />
            {colaborador.curso && <InfoItem label="Curso" value={colaborador.curso} />}
            <InfoItem
              label="Nacionalidade"
              value={colaborador.nacionalidade ?? ""}
            />
            {colaborador.naturalidade && (
              <InfoItem label="Naturalidade" value={colaborador.naturalidade} />
            )}
            {colaborador.pessoa_com_deficiencia && (
              <InfoItem
                label="Pessoa com deficiência"
                value={colaborador.tipo_deficiencia || "Sim"}
              />
            )}
            <InfoItem label="RG" value={colaborador.rg ?? ""} />
            {temVinculoClt && (
              <>
                <InfoItem label="PIS/NIS" value={colaborador.pis ?? ""} />
                <InfoItem
                  label="CTPS"
                  value={
                    colaborador.ctps_numero
                      ? `${colaborador.ctps_numero}${colaborador.ctps_serie ? ` / ${colaborador.ctps_serie}` : ""}`
                      : ""
                  }
                />
                <InfoItem
                  label="Matrícula eSocial"
                  value={colaborador.matricula_esocial ?? ""}
                />
              </>
            )}
            <InfoItem label="CNH" value={colaborador.cnh ?? ""} />
            <InfoItem label="Título de eleitor" value={colaborador.titulo_eleitor ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Endereço</CardTitle>
          </CardHeader>
          <CardContent>
            {endereco || enderecoLinha2 ? (
              <div className="text-sm text-foreground">
                <p>{endereco || "—"}</p>
                <p className="text-muted-foreground">{enderecoLinha2}</p>
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Endereço não cadastrado.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Contatos</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem label="Celular" value={formatPhone(colaborador.celular)} />
            <InfoItem
              label="Telefone de emergência"
              value={formatPhone(colaborador.telefone_emergencia)}
            />
            <InfoItem label="E-mail pessoal" value={colaborador.email_pessoal ?? ""} />
            <InfoItem
              label="E-mail corporativo"
              value={colaborador.email_corporativo ?? ""}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados profissionais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem
              label="Tipo de contrato"
              value={TIPO_CONTRATO_LABEL[colaborador.tipo_contrato]}
            />
            {colaborador.tipo_contrato === "pj" && (
              <>
                <InfoItem label="CNPJ" value={formatCNPJ(colaborador.cnpj)} />
                <InfoItem
                  label="Razão social"
                  value={colaborador.razao_social ?? ""}
                />
              </>
            )}
            <InfoItem
              label="Senioridade do cargo"
              value={cargo?.senioridade ? SENIORIDADE_LABEL[cargo.senioridade] : ""}
            />
            <InfoItem label="Data de admissão" value={formatDate(colaborador.data_admissao)} />
            <InfoItem label="Tempo de casa" value={`${diasDeCasa} dias`} />
            <InfoItem
              label={colaborador.tipo_contrato === "pj" ? "Valor do contrato" : "Salário"}
              value={formatCurrency(colaborador.salario)}
            />
            {temVinculoClt && (
              <InfoItem
                label="Banco de horas"
                value={`${colaborador.banco_horas}h`}
              />
            )}
            <InfoItem label="Turno" value={colaborador.turno ?? ""} />
            <InfoItem label="Matrícula" value={colaborador.matricula ?? ""} />
            <InfoItem
              label="Superior direto"
              value={superiorDireto?.nome_completo ?? ""}
            />
            {colaborador.grau_hierarquico && (
              <InfoItem
                label="Grau hierárquico"
                value={colaborador.grau_hierarquico}
              />
            )}
            {(colaborador.tipo_contrato === "temporario" ||
              colaborador.tipo_contrato === "pj") &&
              colaborador.vencimento_contrato && (
                <InfoItem
                  label="Vencimento do contrato"
                  value={formatDate(colaborador.vencimento_contrato)}
                />
              )}
            {colaborador.periculosidade && (
              <InfoItem label="Periculosidade" value="Sim" />
            )}
            {colaborador.insalubridade && (
              <InfoItem
                label="Insalubridade"
                value={
                  colaborador.percentual_insalubridade
                    ? `${colaborador.percentual_insalubridade}%`
                    : "Sim"
                }
              />
            )}
            <InfoItem
              label="Bate ponto"
              value={colaborador.permite_bater_ponto ? "Sim" : "Não"}
            />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados bancários</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem label="Banco" value={colaborador.banco_nome ?? ""} />
            <InfoItem label="Agência" value={colaborador.banco_agencia ?? ""} />
            <InfoItem label="Conta" value={colaborador.banco_conta ?? ""} />
            <InfoItem label="Tipo de conta" value={colaborador.banco_tipo_conta ?? ""} />
            <InfoItem label="Chave PIX" value={colaborador.chave_pix ?? ""} />
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Dados adicionais</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-4">
            <InfoItem
              label="Fuso horário"
              value={colaborador.fuso_horario ?? ""}
            />
            <InfoItem
              label="Quantidade de filhos"
              value={
                colaborador.quantidade_filhos !== null &&
                colaborador.quantidade_filhos !== undefined
                  ? String(colaborador.quantidade_filhos)
                  : ""
              }
            />
            <InfoItem
              label="Tamanho da camisa"
              value={colaborador.tamanho_camisa ?? ""}
            />
            <InfoItem label="Nome do pai" value={colaborador.nome_pai ?? ""} />
            <InfoItem label="Nome da mãe" value={colaborador.nome_mae ?? ""} />
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Dependentes</CardTitle>
        </CardHeader>
        <CardContent>
          <DependentesSection
            colaboradorId={id}
            dependentes={dependentes ?? []}
            podeEditar
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Documentos</CardTitle>
        </CardHeader>
        <CardContent>
          <DocumentosSection
            colaboradorId={id}
            documentos={documentos ?? []}
            podeGerenciar={isAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Saúde ocupacional</CardTitle>
        </CardHeader>
        <CardContent>
          <ExamesSection
            colaboradorId={id}
            exames={exames ?? []}
            documentos={documentos ?? []}
            isAdmin={isAdmin}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Perfil comportamental</CardTitle>
        </CardHeader>
        <CardContent>
          <ColaboradorPerfilComportamentalSection
            colaboradorId={id}
            valoresIniciais={valoresIniciaisTracos}
            valoresIniciaisDisc={{
              executor: colaborador.perfil_executor ?? 50,
              comunicador: colaborador.perfil_comunicador ?? 50,
              planejador: colaborador.perfil_planejador ?? 50,
              analista: colaborador.perfil_analista ?? 50,
            }}
          />
        </CardContent>
      </Card>

      {historicoCargo && historicoCargo.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Histórico de cargo e salário</CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="flex flex-col gap-2 text-sm">
              {historicoCargo.map((h) => (
                <li
                  key={h.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-border bg-card p-3"
                >
                  <span>
                    {h.cargo_anterior_id !== h.cargo_novo_id && (
                      <>
                        Cargo:{" "}
                        {h.cargo_anterior_id
                          ? nomeCargoHistorico.get(h.cargo_anterior_id)
                          : "—"}{" "}
                        → {h.cargo_novo_id ? nomeCargoHistorico.get(h.cargo_novo_id) : "—"}
                        {h.salario_anterior !== h.salario_novo && " · "}
                      </>
                    )}
                    {h.salario_anterior !== h.salario_novo && (
                      <>
                        Salário: {formatCurrency(h.salario_anterior)} →{" "}
                        {formatCurrency(h.salario_novo)}
                      </>
                    )}
                  </span>
                  <span className="text-muted-foreground">
                    {formatDate(h.criado_em.slice(0, 10))}
                  </span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Últimos registros</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-2 text-sm">
          {!registrosRecentes || registrosRecentes.length === 0 ? (
            <p className="text-muted-foreground">Nenhum registro.</p>
          ) : (
            registrosRecentes.map((r) => (
              <div key={r.id} className="flex justify-between gap-2">
                <span className="line-clamp-1">{r.descricao}</span>
                <span className="shrink-0 text-muted-foreground">
                  {formatDate(r.data_registro)}
                </span>
              </div>
            ))
          )}
          <Link href="/registros" className="text-primary hover:underline">
            Ver todos →
          </Link>
        </CardContent>
      </Card>
    </div>
  );
}
