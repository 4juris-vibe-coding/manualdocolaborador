-- Colaboradores: entidade central do sistema. departamento_id é NOT NULL de
-- propósito, pois é a coluna que sustenta toda a segmentação de RLS por gestor.

create table colaboradores (
  id uuid primary key default gen_random_uuid(),
  nome_completo text not null,
  email text not null unique,
  cpf text not null unique check (cpf ~ '^[0-9]{11}$'),
  telefone text,
  genero genero_colaborador,
  data_nascimento date,
  foto_url text,
  cargo_id uuid not null references cargos (id),
  departamento_id uuid not null references departamentos (id),
  unidade_id uuid not null references unidades (id),
  data_admissao date not null,
  status status_colaborador not null default 'ativo',
  data_desligamento date,
  motivo_desligamento_id uuid references motivos_demissao (id),
  banco_horas numeric(6, 2) not null default 0,
  criado_por uuid references perfis (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  constraint chk_desligamento_apos_admissao
    check (data_desligamento is null or data_desligamento >= data_admissao),
  constraint chk_motivo_so_com_desligamento
    check (motivo_desligamento_id is null or status = 'inativo')
);

create index on colaboradores (departamento_id);
create index on colaboradores (status);
create index on colaboradores (cargo_id);
create index on colaboradores (unidade_id);

create trigger set_atualizado_em before update on colaboradores
  for each row execute function moddatetime(atualizado_em);
