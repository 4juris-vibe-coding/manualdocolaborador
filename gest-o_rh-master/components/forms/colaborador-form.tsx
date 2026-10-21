"use client";

import { useActionState, useState } from "react";
import {
  User,
  IdCard,
  MapPin,
  Phone,
  Briefcase,
  Landmark,
  Clock,
  ClipboardList,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldGroup, FieldLabel, FieldError } from "@/components/ui/field";
import {
  FormCard,
  FormActions,
  FormSectionHeading,
} from "@/components/shared/form-layout";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  GENERO_OPTIONS,
  SEXO_OPTIONS,
  RACA_ETNIA_OPTIONS,
  ESTADO_CIVIL_OPTIONS,
  ESCOLARIDADE_OPTIONS,
  TIPO_CONTRATO_OPTIONS,
  UF_OPTIONS,
  PERCENTUAL_INSALUBRIDADE_OPTIONS,
  TAMANHO_CAMISA_OPTIONS,
  FUSO_HORARIO_OPTIONS,
  temRegimeClt,
} from "@/lib/validations/colaborador";
import type { FormState } from "@/app/(app)/colaboradores/actions";
import type {
  CargoRow,
  ColaboradorRow,
  DepartamentoRow,
  TipoContratoColaborador,
} from "@/types/database.types";

type Defaults = Partial<
  Omit<ColaboradorRow, "id" | "criado_em" | "atualizado_em" | "criado_por" | "unidade_id" | "status">
>;

export function ColaboradorForm({
  action,
  colaboradorId,
  cargos,
  departamentos,
  colaboradores,
  defaultValues,
}: {
  action: (state: FormState, formData: FormData) => Promise<FormState>;
  /** Id do próprio colaborador (edição) — excluído da lista de "Superior
   * direto" pra não deixar alguém ser superior de si mesmo. */
  colaboradorId?: string;
  cargos: Pick<CargoRow, "id" | "nome">[];
  departamentos: Pick<DepartamentoRow, "id" | "nome">[];
  colaboradores: Pick<ColaboradorRow, "id" | "nome_completo">[];
  defaultValues?: Defaults;
}) {
  const [state, formAction, pending] = useActionState<FormState, FormData>(
    action,
    null,
  );
  const [tipoContrato, setTipoContrato] = useState<TipoContratoColaborador>(
    defaultValues?.tipo_contrato ?? "clt",
  );
  const ehPj = tipoContrato === "pj";
  const semVinculoClt = !temRegimeClt(tipoContrato);

  const superioresDisponiveis = colaboradores.filter((c) => c.id !== colaboradorId);

  return (
    <form action={formAction}>
      <FormCard
        footer={
          <FormActions pending={pending} cancelHref="/colaboradores" />
        }
      >
        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={User} title="Dados pessoais" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="nome_completo">Nome completo*</FieldLabel>
                <Input
                  id="nome_completo"
                  name="nome_completo"
                  defaultValue={defaultValues?.nome_completo}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nome_social">Nome social</FieldLabel>
                <Input
                  id="nome_social"
                  name="nome_social"
                  defaultValue={defaultValues?.nome_social ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="cpf">CPF*</FieldLabel>
                <Input
                  id="cpf"
                  name="cpf"
                  inputMode="numeric"
                  placeholder="000.000.000-00"
                  defaultValue={defaultValues?.cpf}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email">E-mail*</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  defaultValue={defaultValues?.email}
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="data_nascimento">
                  Data de nascimento
                </FieldLabel>
                <Input
                  id="data_nascimento"
                  name="data_nascimento"
                  type="date"
                  defaultValue={defaultValues?.data_nascimento ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="sexo">Sexo</FieldLabel>
                <Select
                  name="sexo"
                  items={SEXO_OPTIONS}
                  defaultValue={defaultValues?.sexo ?? undefined}
                >
                  <SelectTrigger id="sexo" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {SEXO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="genero">Gênero</FieldLabel>
                <Select
                  name="genero"
                  items={GENERO_OPTIONS}
                  defaultValue={defaultValues?.genero ?? undefined}
                >
                  <SelectTrigger id="genero" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {GENERO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="saudacao">Saudação</FieldLabel>
                <Input
                  id="saudacao"
                  name="saudacao"
                  placeholder="Sr., Sra., Dr.(a)..."
                  defaultValue={defaultValues?.saudacao ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="raca_etnia">Raça/Etnia</FieldLabel>
                <Select
                  name="raca_etnia"
                  items={RACA_ETNIA_OPTIONS}
                  defaultValue={defaultValues?.raca_etnia ?? undefined}
                >
                  <SelectTrigger id="raca_etnia" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {RACA_ETNIA_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="estado_civil">Estado civil</FieldLabel>
                <Select
                  name="estado_civil"
                  items={ESTADO_CIVIL_OPTIONS}
                  defaultValue={defaultValues?.estado_civil ?? undefined}
                >
                  <SelectTrigger id="estado_civil" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ESTADO_CIVIL_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="escolaridade">Escolaridade</FieldLabel>
                <Select
                  name="escolaridade"
                  items={ESCOLARIDADE_OPTIONS}
                  defaultValue={defaultValues?.escolaridade ?? undefined}
                >
                  <SelectTrigger id="escolaridade" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ESCOLARIDADE_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="curso">Curso</FieldLabel>
                <Input id="curso" name="curso" defaultValue={defaultValues?.curso ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nacionalidade">Nacionalidade</FieldLabel>
                <Input
                  id="nacionalidade"
                  name="nacionalidade"
                  defaultValue={defaultValues?.nacionalidade ?? "Brasileira"}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="naturalidade">Naturalidade</FieldLabel>
                <Input
                  id="naturalidade"
                  name="naturalidade"
                  placeholder="Cidade de nascimento"
                  defaultValue={defaultValues?.naturalidade ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="nome_pai">Nome do pai</FieldLabel>
                <Input id="nome_pai" name="nome_pai" defaultValue={defaultValues?.nome_pai ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="nome_mae">Nome da mãe</FieldLabel>
                <Input id="nome_mae" name="nome_mae" defaultValue={defaultValues?.nome_mae ?? ""} />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="pessoa_com_deficiencia"
                  name="pessoa_com_deficiencia"
                  defaultChecked={defaultValues?.pessoa_com_deficiencia ?? false}
                />
                <FieldLabel htmlFor="pessoa_com_deficiencia" className="font-normal">
                  Pessoa com deficiência
                </FieldLabel>
              </Field>
              <Field>
                <FieldLabel htmlFor="tipo_deficiencia">Tipo de deficiência</FieldLabel>
                <Input
                  id="tipo_deficiencia"
                  name="tipo_deficiencia"
                  defaultValue={defaultValues?.tipo_deficiencia ?? ""}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={MapPin} title="Endereço" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="endereco_pais">País</FieldLabel>
                <Input
                  id="endereco_pais"
                  name="endereco_pais"
                  defaultValue={defaultValues?.endereco_pais ?? "Brasil"}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_cep">CEP</FieldLabel>
                <Input
                  id="endereco_cep"
                  name="endereco_cep"
                  defaultValue={defaultValues?.endereco_cep ?? ""}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="endereco_logradouro">Rua/Avenida</FieldLabel>
                <Input
                  id="endereco_logradouro"
                  name="endereco_logradouro"
                  defaultValue={defaultValues?.endereco_logradouro ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_numero">Número</FieldLabel>
                <Input
                  id="endereco_numero"
                  name="endereco_numero"
                  defaultValue={defaultValues?.endereco_numero ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_complemento">Complemento</FieldLabel>
                <Input
                  id="endereco_complemento"
                  name="endereco_complemento"
                  defaultValue={defaultValues?.endereco_complemento ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_bairro">Bairro</FieldLabel>
                <Input
                  id="endereco_bairro"
                  name="endereco_bairro"
                  defaultValue={defaultValues?.endereco_bairro ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_cidade">Cidade</FieldLabel>
                <Input
                  id="endereco_cidade"
                  name="endereco_cidade"
                  defaultValue={defaultValues?.endereco_cidade ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="endereco_estado">Estado</FieldLabel>
                <Select
                  name="endereco_estado"
                  items={UF_OPTIONS.map((uf) => ({ value: uf, label: uf }))}
                  defaultValue={defaultValues?.endereco_estado ?? undefined}
                >
                  <SelectTrigger id="endereco_estado" className="w-full">
                    <SelectValue placeholder="UF" />
                  </SelectTrigger>
                  <SelectContent>
                    {UF_OPTIONS.map((uf) => (
                      <SelectItem key={uf} value={uf}>
                        {uf}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={Phone} title="Contatos" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="celular">Celular</FieldLabel>
                <Input id="celular" name="celular" defaultValue={defaultValues?.celular ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefone">Telefone</FieldLabel>
                <Input
                  id="telefone"
                  name="telefone"
                  defaultValue={defaultValues?.telefone ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="telefone_emergencia">
                  Telefone de emergência
                </FieldLabel>
                <Input
                  id="telefone_emergencia"
                  name="telefone_emergencia"
                  defaultValue={defaultValues?.telefone_emergencia ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email_pessoal">E-mail pessoal</FieldLabel>
                <Input
                  id="email_pessoal"
                  name="email_pessoal"
                  type="email"
                  defaultValue={defaultValues?.email_pessoal ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="email_corporativo">E-mail corporativo</FieldLabel>
                <Input
                  id="email_corporativo"
                  name="email_corporativo"
                  type="email"
                  defaultValue={defaultValues?.email_corporativo ?? ""}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={Briefcase} title="Dados contratuais" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="departamento_id">
                  Departamento*
                </FieldLabel>
                <Select
                  name="departamento_id"
                  items={departamentos.map((d) => ({ value: d.id, label: d.nome }))}
                  defaultValue={defaultValues?.departamento_id}
                  required
                >
                  <SelectTrigger id="departamento_id" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {departamentos.map((departamento) => (
                      <SelectItem key={departamento.id} value={departamento.id}>
                        {departamento.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="cargo_id">Cargo*</FieldLabel>
                <Select
                  name="cargo_id"
                  items={cargos.map((c) => ({ value: c.id, label: c.nome }))}
                  defaultValue={defaultValues?.cargo_id}
                  required
                >
                  <SelectTrigger id="cargo_id" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {cargos.map((cargo) => (
                      <SelectItem key={cargo.id} value={cargo.id}>
                        {cargo.nome}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="tipo_contrato">Tipo de contrato*</FieldLabel>
                <Select
                  name="tipo_contrato"
                  items={TIPO_CONTRATO_OPTIONS}
                  value={tipoContrato}
                  onValueChange={(valor) =>
                    valor && setTipoContrato(valor as TipoContratoColaborador)
                  }
                  required
                >
                  <SelectTrigger id="tipo_contrato" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {TIPO_CONTRATO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="turno">Turno</FieldLabel>
                <Input id="turno" name="turno" defaultValue={defaultValues?.turno ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="data_admissao">
                  Data de admissão*
                </FieldLabel>
                <Input
                  id="data_admissao"
                  name="data_admissao"
                  type="date"
                  defaultValue={defaultValues?.data_admissao}
                  required
                />
              </Field>
              {!semVinculoClt && (
                <Field>
                  <FieldLabel htmlFor="periodo_experiencia_dias">
                    Período de experiência (dias)
                  </FieldLabel>
                  <Input
                    id="periodo_experiencia_dias"
                    name="periodo_experiencia_dias"
                    type="number"
                    min={1}
                    placeholder="90 (padrão)"
                    defaultValue={defaultValues?.periodo_experiencia_dias ?? ""}
                  />
                </Field>
              )}
              <Field>
                <FieldLabel htmlFor="matricula">Matrícula</FieldLabel>
                <Input
                  id="matricula"
                  name="matricula"
                  defaultValue={defaultValues?.matricula ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="superior_direto_id">Superior direto</FieldLabel>
                <Select
                  name="superior_direto_id"
                  items={superioresDisponiveis.map((c) => ({
                    value: c.id,
                    label: c.nome_completo,
                  }))}
                  defaultValue={defaultValues?.superior_direto_id ?? undefined}
                >
                  <SelectTrigger id="superior_direto_id" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {superioresDisponiveis.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.nome_completo}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <Field>
                <FieldLabel htmlFor="grau_hierarquico">Grau hierárquico</FieldLabel>
                <Input
                  id="grau_hierarquico"
                  name="grau_hierarquico"
                  defaultValue={defaultValues?.grau_hierarquico ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="codigo_externo">Código externo</FieldLabel>
                <Input
                  id="codigo_externo"
                  name="codigo_externo"
                  defaultValue={defaultValues?.codigo_externo ?? ""}
                />
              </Field>
              {(tipoContrato === "temporario" || tipoContrato === "pj") && (
                <>
                  <Field>
                    <FieldLabel htmlFor="data_contrato">Data do contrato</FieldLabel>
                    <Input
                      id="data_contrato"
                      name="data_contrato"
                      type="date"
                      defaultValue={defaultValues?.data_contrato ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="duracao_contrato">Duração do contrato</FieldLabel>
                    <Input
                      id="duracao_contrato"
                      name="duracao_contrato"
                      placeholder="Ex.: 12 meses"
                      defaultValue={defaultValues?.duracao_contrato ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="vencimento_contrato">
                      Vencimento do contrato
                    </FieldLabel>
                    <Input
                      id="vencimento_contrato"
                      name="vencimento_contrato"
                      type="date"
                      defaultValue={defaultValues?.vencimento_contrato ?? ""}
                    />
                  </Field>
                </>
              )}
              <Field>
                <FieldLabel htmlFor="data_inicio_cargo">Data de início no cargo</FieldLabel>
                <Input
                  id="data_inicio_cargo"
                  name="data_inicio_cargo"
                  type="date"
                  defaultValue={defaultValues?.data_inicio_cargo ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="inicio_vigencia">Início de vigência</FieldLabel>
                <Input
                  id="inicio_vigencia"
                  name="inicio_vigencia"
                  type="date"
                  defaultValue={defaultValues?.inicio_vigencia ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="salario">
                  {ehPj ? "Valor do contrato (R$)" : "Salário (R$)"}
                </FieldLabel>
                <Input
                  id="salario"
                  name="salario"
                  type="number"
                  step="0.01"
                  min="0"
                  defaultValue={defaultValues?.salario ?? ""}
                />
              </Field>
              {!semVinculoClt && (
                <Field>
                  <FieldLabel htmlFor="banco_horas">
                    Banco de horas (saldo)
                  </FieldLabel>
                  <Input
                    id="banco_horas"
                    name="banco_horas"
                    type="number"
                    step="0.5"
                    defaultValue={defaultValues?.banco_horas ?? 0}
                  />
                </Field>
              )}
              {insalubridadeCampo(defaultValues)}
            </div>
            <div className="flex flex-wrap gap-4">
              <Field orientation="horizontal">
                <Checkbox
                  id="duplo_vinculo"
                  name="duplo_vinculo"
                  defaultChecked={defaultValues?.duplo_vinculo ?? false}
                />
                <FieldLabel htmlFor="duplo_vinculo" className="font-normal">
                  Duplo vínculo
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="periculosidade"
                  name="periculosidade"
                  defaultChecked={defaultValues?.periculosidade ?? false}
                />
                <FieldLabel htmlFor="periculosidade" className="font-normal">
                  Periculosidade
                </FieldLabel>
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="permite_bater_ponto"
                  name="permite_bater_ponto"
                  defaultChecked={defaultValues?.permite_bater_ponto ?? false}
                />
                <FieldLabel htmlFor="permite_bater_ponto" className="font-normal">
                  Permitir que o colaborador bata ponto
                </FieldLabel>
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={IdCard} title="Documentos" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="rg">RG</FieldLabel>
                <Input id="rg" name="rg" defaultValue={defaultValues?.rg ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="rg_data_expedicao">Data de expedição</FieldLabel>
                <Input
                  id="rg_data_expedicao"
                  name="rg_data_expedicao"
                  type="date"
                  defaultValue={defaultValues?.rg_data_expedicao ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="rg_orgao_expedidor">Órgão expedidor</FieldLabel>
                <Input
                  id="rg_orgao_expedidor"
                  name="rg_orgao_expedidor"
                  defaultValue={defaultValues?.rg_orgao_expedidor ?? ""}
                />
              </Field>
              <Field orientation="horizontal">
                <Checkbox
                  id="estrangeiro"
                  name="estrangeiro"
                  defaultChecked={defaultValues?.estrangeiro ?? false}
                />
                <FieldLabel htmlFor="estrangeiro" className="font-normal">
                  Estrangeiro
                </FieldLabel>
              </Field>
              {!semVinculoClt && (
                <>
                  <Field>
                    <FieldLabel htmlFor="pis">PIS/NIS</FieldLabel>
                    <Input id="pis" name="pis" defaultValue={defaultValues?.pis ?? ""} />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ctps_numero">CTPS (número)</FieldLabel>
                    <Input
                      id="ctps_numero"
                      name="ctps_numero"
                      defaultValue={defaultValues?.ctps_numero ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="ctps_serie">CTPS (série)</FieldLabel>
                    <Input
                      id="ctps_serie"
                      name="ctps_serie"
                      defaultValue={defaultValues?.ctps_serie ?? ""}
                    />
                  </Field>
                  <Field>
                    <FieldLabel htmlFor="matricula_esocial">Matrícula eSocial</FieldLabel>
                    <Input
                      id="matricula_esocial"
                      name="matricula_esocial"
                      defaultValue={defaultValues?.matricula_esocial ?? ""}
                    />
                  </Field>
                </>
              )}
              {ehPj && (
                <>
                  <Field>
                    <FieldLabel htmlFor="cnpj">CNPJ*</FieldLabel>
                    <Input
                      id="cnpj"
                      name="cnpj"
                      inputMode="numeric"
                      placeholder="00.000.000/0000-00"
                      defaultValue={defaultValues?.cnpj ?? ""}
                      required
                    />
                  </Field>
                  <Field className="sm:col-span-2">
                    <FieldLabel htmlFor="razao_social">Razão social*</FieldLabel>
                    <Input
                      id="razao_social"
                      name="razao_social"
                      defaultValue={defaultValues?.razao_social ?? ""}
                      required
                    />
                  </Field>
                </>
              )}
              <Field>
                <FieldLabel htmlFor="cnh">CNH</FieldLabel>
                <Input id="cnh" name="cnh" defaultValue={defaultValues?.cnh ?? ""} />
              </Field>
              <Field>
                <FieldLabel htmlFor="reservista">Reservista</FieldLabel>
                <Input
                  id="reservista"
                  name="reservista"
                  defaultValue={defaultValues?.reservista ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="titulo_eleitor">Título de eleitor</FieldLabel>
                <Input
                  id="titulo_eleitor"
                  name="titulo_eleitor"
                  defaultValue={defaultValues?.titulo_eleitor ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="zona_eleitoral">Zona eleitoral</FieldLabel>
                <Input
                  id="zona_eleitoral"
                  name="zona_eleitoral"
                  defaultValue={defaultValues?.zona_eleitoral ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="secao_eleitoral">Seção eleitoral</FieldLabel>
                <Input
                  id="secao_eleitoral"
                  name="secao_eleitoral"
                  defaultValue={defaultValues?.secao_eleitoral ?? ""}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={Landmark} title="Dados bancários (para pagamento)" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="banco_nome">Banco</FieldLabel>
                <Input
                  id="banco_nome"
                  name="banco_nome"
                  defaultValue={defaultValues?.banco_nome ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="banco_agencia">Agência</FieldLabel>
                <Input
                  id="banco_agencia"
                  name="banco_agencia"
                  defaultValue={defaultValues?.banco_agencia ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="banco_conta">Conta</FieldLabel>
                <Input
                  id="banco_conta"
                  name="banco_conta"
                  defaultValue={defaultValues?.banco_conta ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="banco_tipo_conta">Tipo de conta</FieldLabel>
                <Input
                  id="banco_tipo_conta"
                  name="banco_tipo_conta"
                  placeholder="Corrente, poupança..."
                  defaultValue={defaultValues?.banco_tipo_conta ?? ""}
                />
              </Field>
              <Field className="sm:col-span-2">
                <FieldLabel htmlFor="chave_pix">Chave PIX</FieldLabel>
                <Input
                  id="chave_pix"
                  name="chave_pix"
                  defaultValue={defaultValues?.chave_pix ?? ""}
                />
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={Clock} title="Fuso horário" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="fuso_horario">Fuso horário</FieldLabel>
                <Select
                  name="fuso_horario"
                  items={FUSO_HORARIO_OPTIONS}
                  defaultValue={defaultValues?.fuso_horario ?? "America/Sao_Paulo"}
                >
                  <SelectTrigger id="fuso_horario" className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {FUSO_HORARIO_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </div>

        <div className="flex flex-col gap-4">
          <FormSectionHeading icon={ClipboardList} title="Dados adicionais" />
          <FieldGroup>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field>
                <FieldLabel htmlFor="quantidade_filhos">Quantidade de filhos</FieldLabel>
                <Input
                  id="quantidade_filhos"
                  name="quantidade_filhos"
                  type="number"
                  min={0}
                  defaultValue={defaultValues?.quantidade_filhos ?? ""}
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="tamanho_camisa">Tamanho da camisa</FieldLabel>
                <Select
                  name="tamanho_camisa"
                  items={TAMANHO_CAMISA_OPTIONS.map((t) => ({ value: t, label: t }))}
                  defaultValue={defaultValues?.tamanho_camisa ?? undefined}
                >
                  <SelectTrigger id="tamanho_camisa" className="w-full">
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {TAMANHO_CAMISA_OPTIONS.map((t) => (
                      <SelectItem key={t} value={t}>
                        {t}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            </div>
          </FieldGroup>
        </div>

        {state?.error && <FieldError>{state.error}</FieldError>}
      </FormCard>
    </form>
  );
}

/** Campos de insalubridade — só faz sentido pedir o percentual quando a
 * caixa "Insalubridade" está marcada, mas como o form é um <form> nativo
 * (sem watch reativo pra evitar mais um useState), deixamos o checkbox e
 * o percentual sempre visíveis juntos, lado a lado. */
function insalubridadeCampo(defaultValues?: Defaults) {
  return (
    <Field>
      <FieldLabel htmlFor="percentual_insalubridade">
        Percentual de insalubridade
      </FieldLabel>
      <Select
        name="percentual_insalubridade"
        items={PERCENTUAL_INSALUBRIDADE_OPTIONS}
        defaultValue={
          defaultValues?.percentual_insalubridade
            ? String(defaultValues.percentual_insalubridade)
            : undefined
        }
      >
        <SelectTrigger id="percentual_insalubridade" className="w-full">
          <SelectValue placeholder="Não se aplica" />
        </SelectTrigger>
        <SelectContent>
          {PERCENTUAL_INSALUBRIDADE_OPTIONS.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}
