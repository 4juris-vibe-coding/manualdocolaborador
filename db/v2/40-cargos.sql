-- 40 · Arquitetura de cargos. cargo_id = Cargo.id da coleção legada app_cargos (fonte da verdade do cargo).

create table if not exists cg_familias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  descricao text,
  pai_id uuid references cg_familias(id),         -- subfamília = família com pai
  ativa boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists cg_familias_nome_uk on cg_familias (lower(nome), coalesce(pai_id, '00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists cg_trilhas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique,
  descricao text,
  ordem int not null default 0,
  ativa boolean not null default true
);

create table if not exists cg_niveis (
  id uuid primary key default gen_random_uuid(),
  trilha_id uuid not null references cg_trilhas(id) on delete cascade,
  ordem int not null,
  nome text not null,
  criterios_evolucao text,
  requisitos text,
  unique (trilha_id, nome)
);

-- Ficha oficial viva (versão em edição/vigente). Uma por cargo legado.
create table if not exists cg_fichas (
  cargo_id text primary key,
  codigo text not null,
  familia_id uuid references cg_familias(id),
  subfamilia_id uuid references cg_familias(id),
  area text,
  trilha_id uuid references cg_trilhas(id),
  nivel_id uuid references cg_niveis(id),
  cargo_referencia_id text,
  descricao_oficial text,
  objetivo text,
  responsabilidades text,
  entregas text,
  requisitos_minimos text,
  formacao text,
  experiencia text,
  competencias_tecnicas jsonb not null default '[]'::jsonb,
  competencias_comportamentais jsonb not null default '[]'::jsonb,
  conhecimentos jsonb not null default '[]'::jsonb,
  certificacoes jsonb not null default '[]'::jsonb,
  kpis jsonb not null default '[]'::jsonb,
  vigencia_inicio date,
  aprovadores jsonb not null default '[]'::jsonb,   -- ids de pessoas designadas (opcional; vazio = quem tem cargos:aprovar)
  status text not null default 'rascunho' check (status in ('rascunho','em_aprovacao','vigente','inativo')),
  versao_vigente int not null default 0,
  revisado_em timestamptz,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  criado_em timestamptz not null default now()
);
create unique index if not exists cg_fichas_codigo_uk on cg_fichas (upper(codigo));

-- Versões imutáveis (uma por aprovação). dados = retrato da ficha aprovada.
create table if not exists cg_ficha_versoes (
  id uuid primary key default gen_random_uuid(),
  cargo_id text not null,
  versao int not null,
  dados jsonb not null,
  nome_cargo text,
  aprovada_por text,
  aprovada_em timestamptz not null default now(),
  proposta_por text,
  unique (cargo_id, versao)
);

-- Solicitações de mudança (ficha ou faixa) com aprovação
create table if not exists cg_solicitacoes (
  id uuid primary key default gen_random_uuid(),
  tipo text not null check (tipo in ('ficha','faixa')),
  cargo_id text not null,
  alvo_id uuid,                                      -- faixa (cg_faixas.id) quando tipo = faixa
  proposta_por text not null,
  proposta_em timestamptz not null default now(),
  descricao text,
  status text not null default 'pendente' check (status in ('pendente','aprovada','rejeitada','cancelada')),
  decidido_por text,
  decidido_em timestamptz,
  justificativa text
);
create index if not exists cg_solic_status_idx on cg_solicitacoes (status, tipo);
create unique index if not exists cg_solic_pendente_uk on cg_solicitacoes (tipo, cargo_id, coalesce(alvo_id, '00000000-0000-0000-0000-000000000000'::uuid)) where status = 'pendente';

-- Matriz cargo × competência (competência = id da coleção legada app_competencias)
create table if not exists cg_cargo_competencias (
  cargo_id text not null,
  competencia_id text not null,
  nivel_esperado int not null check (nivel_esperado between 1 and 5),
  obrigatoria boolean not null default true,
  criterio text,
  atualizado_por text,
  atualizado_em timestamptz not null default now(),
  primary key (cargo_id, competencia_id)
);

-- Faixas salariais (valores restritos a cargos:ver_faixas). Vigência sem sobreposição por escopo.
create table if not exists cg_faixas (
  id uuid primary key default gen_random_uuid(),
  cargo_id text not null,
  nivel_id uuid references cg_niveis(id),
  unidade_id text,
  criterio text,                                     -- rótulo livre do critério (ex.: "Capital")
  minimo numeric(14,2) not null,
  referencia numeric(14,2),
  maximo numeric(14,2) not null,
  moeda text not null default 'BRL',
  vigencia_inicio date not null,
  vigencia_fim date,
  status text not null default 'rascunho' check (status in ('rascunho','em_aprovacao','vigente','encerrada','rejeitada')),
  revisao_de uuid references cg_faixas(id),
  criado_por text,
  criado_em timestamptz not null default now(),
  aprovado_por text,
  aprovado_em timestamptz,
  check (minimo <= maximo and (referencia is null or (referencia >= minimo and referencia <= maximo))),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create index if not exists cg_faixas_cargo_idx on cg_faixas (cargo_id, status);

alter table cg_familias enable row level security;
alter table cg_trilhas enable row level security;
alter table cg_niveis enable row level security;
alter table cg_fichas enable row level security;
alter table cg_ficha_versoes enable row level security;
alter table cg_solicitacoes enable row level security;
alter table cg_cargo_competencias enable row level security;
alter table cg_faixas enable row level security;
