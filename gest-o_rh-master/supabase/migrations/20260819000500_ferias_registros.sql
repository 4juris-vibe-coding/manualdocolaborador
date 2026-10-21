-- Férias e Registros (ocorrências funcionais) do colaborador.

create table ferias (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  periodo_aquisitivo_inicio date not null,
  periodo_aquisitivo_fim date not null,
  periodo_gozo_inicio date,
  periodo_gozo_fim date,
  quantidade_dias integer not null check (quantidade_dias > 0),
  status status_ferias not null default 'pendente',
  aprovado_por uuid references perfis (id),
  aprovado_em timestamptz,
  observacoes text,
  criado_por uuid references perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_periodo_aquisitivo_valido
    check (periodo_aquisitivo_fim >= periodo_aquisitivo_inicio),
  constraint chk_gozo_valido
    check (periodo_gozo_fim is null or periodo_gozo_fim >= periodo_gozo_inicio)
);
create index on ferias (colaborador_id);
create index on ferias (status);
create trigger set_atualizado_em before update on ferias
  for each row execute function moddatetime(atualizado_em);

create table registros (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  data_registro date not null default current_date,
  tipo_registro_id uuid not null references tipos_registro (id),
  classificacao classificacao_registro not null,
  descricao text not null,
  autor_id uuid not null references perfis (id),
  criado_em timestamptz not null default now()
);
create index on registros (colaborador_id);
create index on registros (data_registro);
create index on registros (tipo_registro_id);
