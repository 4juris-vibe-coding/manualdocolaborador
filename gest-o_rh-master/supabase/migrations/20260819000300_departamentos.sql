-- Departamentos e o vínculo com os gestores responsáveis por cada um.

create table departamentos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  localizacao text,
  telefone text,
  unidade_id uuid not null references unidades (id),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index on departamentos (unidade_id);
create trigger set_atualizado_em before update on departamentos
  for each row execute function moddatetime(atualizado_em);

-- Tabela de junção (N:N): permite tanto um gestor cuidar de vários
-- departamentos quanto um departamento ter mais de um gestor no futuro.
-- Na Fase 1 a UI só permite atribuir 1 gestor por departamento.
create table departamento_gestores (
  departamento_id uuid not null references departamentos (id) on delete cascade,
  gestor_id uuid not null references perfis (id) on delete cascade,
  criado_em timestamptz not null default now(),
  primary key (departamento_id, gestor_id)
);
create index on departamento_gestores (gestor_id);

-- Agora que departamento_gestores existe, podemos criar a função helper
-- de RLS que resolve quais departamentos um gestor logado gerencia.
create or replace function managed_department_ids()
returns setof uuid
language sql stable security definer set search_path = public
as $$
  select departamento_id from departamento_gestores
  where gestor_id = auth.uid();
$$;
