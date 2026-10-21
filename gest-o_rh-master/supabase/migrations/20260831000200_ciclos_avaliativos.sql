-- Ciclos avaliativos: a "rodada" de Avaliação de Desempenho (ex.: "1º
-- semestre 2026"). Por enquanto só o essencial pra alimentar o filtro do
-- Dashboard/Relatório de Participação — o fluxo completo de criar um
-- ciclo (com público-alvo, prazo etc.) é a tela "Solicitar Avaliação",
-- que ainda não foi enviada; esta tabela deve ganhar mais colunas
-- quando ela vier.
create type status_ciclo_avaliativo as enum ('rascunho', 'ativo', 'encerrado');

create table ciclos_avaliativos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  status status_ciclo_avaliativo not null default 'rascunho',
  criado_em timestamptz not null default now()
);

alter table ciclos_avaliativos enable row level security;

create policy "ciclos_avaliativos_select_authenticated" on ciclos_avaliativos
  for select using (auth.role() = 'authenticated');
create policy "ciclos_avaliativos_insert_admin" on ciclos_avaliativos
  for insert with check (is_admin());
create policy "ciclos_avaliativos_update_admin" on ciclos_avaliativos
  for update using (is_admin()) with check (is_admin());
create policy "ciclos_avaliativos_delete_admin" on ciclos_avaliativos
  for delete using (is_admin());
