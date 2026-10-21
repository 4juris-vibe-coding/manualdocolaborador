-- Tabelas de apoio (lookups): leitura livre para autenticados, escrita
-- restrita a admin_rh (policies na migration 20260819000700_rls_policies.sql).

create table unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  endereco text,
  telefone text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger set_atualizado_em before update on unidades
  for each row execute function moddatetime(atualizado_em);

create table cargos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  senioridade senioridade_cargo,
  codigo_cbo text,
  piso_salarial numeric(12, 2),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger set_atualizado_em before update on cargos
  for each row execute function moddatetime(atualizado_em);

create table motivos_demissao (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table tipos_registro (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table checklist_templates (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_checklist not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create trigger set_atualizado_em before update on checklist_templates
  for each row execute function moddatetime(atualizado_em);

create table checklist_template_itens (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references checklist_templates (id) on delete cascade,
  descricao text not null,
  ordem integer not null default 0
);
create index on checklist_template_itens (template_id);

create table empresa_config (
  id boolean primary key default true check (id),
  nome_empresa text not null default '4Juris',
  logo_url text,
  atualizado_em timestamptz not null default now()
);
create trigger set_atualizado_em before update on empresa_config
  for each row execute function moddatetime(atualizado_em);

insert into empresa_config (id) values (true);
