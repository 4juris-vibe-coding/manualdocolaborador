-- Saúde Ocupacional (ASO — Atestado de Saúde Ocupacional) e histórico
-- automático de mudanças de cargo/salário do colaborador.

create type tipo_exame_ocupacional as enum (
  'admissional',
  'periodico',
  'retorno_trabalho',
  'mudanca_funcao',
  'demissional'
);

create type resultado_exame_ocupacional as enum (
  'apto',
  'apto_com_restricoes',
  'inapto'
);

create table colaborador_exames (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  tipo_exame tipo_exame_ocupacional not null,
  data_exame date not null,
  data_validade date,
  resultado resultado_exame_ocupacional not null default 'apto',
  medico_nome text,
  medico_crm text,
  observacoes text,
  criado_por uuid references perfis (id),
  criado_em timestamptz not null default now(),
  constraint chk_validade_apos_exame
    check (data_validade is null or data_validade >= data_exame)
);
create index on colaborador_exames (colaborador_id);
create index on colaborador_exames (data_validade);

alter table colaborador_exames enable row level security;

create policy "exames_admin_all" on colaborador_exames
  for all using (is_admin()) with check (is_admin());

-- Dado de saúde é sensível (LGPD) — gestor só lê, não cria/edita/exclui.
create policy "exames_gestor_select" on colaborador_exames
  for select
  using (exists (
    select 1 from colaboradores c
    where c.id = colaborador_exames.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));

-- Histórico de cargo/salário: preenchido automaticamente por trigger sempre
-- que colaboradores.cargo_id ou colaboradores.salario mudar — não existe
-- insert manual pela aplicação, então não precisa de policy de insert.
create table colaborador_historico_cargo (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  cargo_anterior_id uuid references cargos (id),
  cargo_novo_id uuid references cargos (id),
  salario_anterior numeric(12, 2),
  salario_novo numeric(12, 2),
  alterado_por uuid references perfis (id),
  criado_em timestamptz not null default now()
);
create index on colaborador_historico_cargo (colaborador_id);

create or replace function registrar_historico_cargo_salario()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  if (old.cargo_id is distinct from new.cargo_id)
     or (old.salario is distinct from new.salario) then
    insert into colaborador_historico_cargo (
      colaborador_id, cargo_anterior_id, cargo_novo_id,
      salario_anterior, salario_novo, alterado_por
    )
    values (
      new.id, old.cargo_id, new.cargo_id,
      old.salario, new.salario, auth.uid()
    );
  end if;
  return new;
end;
$$;

create trigger trg_historico_cargo_salario
  after update on colaboradores
  for each row
  execute function registrar_historico_cargo_salario();

alter table colaborador_historico_cargo enable row level security;

create policy "historico_cargo_admin_all" on colaborador_historico_cargo
  for all using (is_admin()) with check (is_admin());

create policy "historico_cargo_gestor_select" on colaborador_historico_cargo
  for select
  using (exists (
    select 1 from colaboradores c
    where c.id = colaborador_historico_cargo.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));
