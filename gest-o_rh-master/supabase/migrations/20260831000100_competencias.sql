-- Competências (dentro de Desenv. e Performance > Competências): usadas
-- na Avaliação de Desempenho ou na Avaliação de Período de Experiência,
-- pertencem a um Grupo de Competências e são vinculadas a cargos (isso
-- define quem recebe a competência no preenchimento da avaliação).
create type tipo_avaliacao_competencia as enum ('desempenho', 'periodo_experiencia');

create table competencias (
  id uuid primary key default gen_random_uuid(),
  tipo_avaliacao tipo_avaliacao_competencia not null default 'desempenho',
  grupo_id uuid not null references grupos_competencias (id),
  nome text not null,
  descricao text,
  peso smallint not null default 1 check (peso between 1 and 100),
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on competencias (grupo_id);
create index on competencias (ativo);

-- N:N — uma competência pode valer pra vários cargos, um cargo pode ter
-- várias competências.
create table competencia_cargos (
  competencia_id uuid not null references competencias (id) on delete cascade,
  cargo_id uuid not null references cargos (id) on delete cascade,
  primary key (competencia_id, cargo_id)
);
create index on competencia_cargos (cargo_id);

alter table competencias enable row level security;
alter table competencia_cargos enable row level security;

create policy "competencias_select_authenticated" on competencias
  for select using (auth.role() = 'authenticated');
create policy "competencias_insert_admin" on competencias
  for insert with check (is_admin());
create policy "competencias_update_admin" on competencias
  for update using (is_admin()) with check (is_admin());
create policy "competencias_delete_admin" on competencias
  for delete using (is_admin());

create policy "competencia_cargos_select_authenticated" on competencia_cargos
  for select using (auth.role() = 'authenticated');
create policy "competencia_cargos_insert_admin" on competencia_cargos
  for insert with check (is_admin());
create policy "competencia_cargos_update_admin" on competencia_cargos
  for update using (is_admin()) with check (is_admin());
create policy "competencia_cargos_delete_admin" on competencia_cargos
  for delete using (is_admin());
