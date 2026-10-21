-- Dados de admissão CLT que ainda faltavam em colaboradores (endereço,
-- documentos pessoais, dados bancários, tipo de contrato e salário
-- individual — distinto do piso_salarial do cargo), além de dependentes e
-- documentos anexados ao colaborador.

create type tipo_contrato_colaborador as enum (
  'clt',
  'pj',
  'estagio',
  'temporario',
  'aprendiz'
);

alter table colaboradores
  add column rg text,
  add column pis text,
  add column ctps_numero text,
  add column ctps_serie text,
  add column endereco_logradouro text,
  add column endereco_numero text,
  add column endereco_complemento text,
  add column endereco_bairro text,
  add column endereco_cidade text,
  add column endereco_estado text,
  add column endereco_cep text,
  add column tipo_contrato tipo_contrato_colaborador not null default 'clt',
  add column salario numeric(12, 2),
  add column banco_nome text,
  add column banco_agencia text,
  add column banco_conta text,
  add column banco_tipo_conta text,
  add column chave_pix text;

create table colaborador_dependentes (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  nome text not null,
  parentesco text not null,
  data_nascimento date,
  cpf text,
  criado_em timestamptz not null default now()
);
create index on colaborador_dependentes (colaborador_id);

-- caminho_arquivo aponta para um objeto no bucket "colaboradores" do
-- Storage, no padrão {colaborador_id}/documentos/{arquivo} — reaproveita
-- as policies de storage já criadas em 20260819000800_storage.sql (elas
-- filtram pelo primeiro segmento do caminho = colaborador_id, então
-- funcionam para qualquer subpasta, não só a de fotos).
create table colaborador_documentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  nome text not null,
  categoria text not null default 'outro',
  caminho_arquivo text not null,
  tamanho_bytes bigint,
  enviado_por uuid references perfis (id),
  criado_em timestamptz not null default now()
);
create index on colaborador_documentos (colaborador_id);

-- RLS: mesmo padrão de ferias/registros (admin total; gestor só do próprio
-- time, via join até colaboradores.departamento_id).
alter table colaborador_dependentes enable row level security;

create policy "dependentes_admin_all" on colaborador_dependentes
  for all using (is_admin()) with check (is_admin());

create policy "dependentes_gestor_all" on colaborador_dependentes
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = colaborador_dependentes.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = colaborador_dependentes.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));

alter table colaborador_documentos enable row level security;

create policy "documentos_admin_all" on colaborador_documentos
  for all using (is_admin()) with check (is_admin());

-- Gestor só pode LER documentos do próprio time (upload/exclusão ficam
-- centralizados em admin_rh, mesmo critério usado em colaboradores).
create policy "documentos_gestor_select" on colaborador_documentos
  for select
  using (exists (
    select 1 from colaboradores c
    where c.id = colaborador_documentos.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));
