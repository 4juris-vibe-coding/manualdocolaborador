-- Grupos de Competências (dentro de Desenv. e Performance > Competências):
-- agrupam competências pra organizar a Avaliação de Desempenho, e podem
-- opcionalmente alimentar o gráfico 9 box (Comportamento/Desempenho).
create type categoria_9box as enum ('nenhuma', 'comportamento', 'desempenho');

create table grupos_competencias (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  categoria_9box categoria_9box not null default 'nenhuma',
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create index on grupos_competencias (ativo);

alter table grupos_competencias enable row level security;

create policy "grupos_competencias_select_authenticated" on grupos_competencias
  for select using (auth.role() = 'authenticated');
create policy "grupos_competencias_insert_admin" on grupos_competencias
  for insert with check (is_admin());
create policy "grupos_competencias_update_admin" on grupos_competencias
  for update using (is_admin()) with check (is_admin());
create policy "grupos_competencias_delete_admin" on grupos_competencias
  for delete using (is_admin());
