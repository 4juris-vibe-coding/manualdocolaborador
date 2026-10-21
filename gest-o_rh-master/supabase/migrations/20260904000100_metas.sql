-- Cadastro de Metas (Desenv. e Performance > Gestão de Metas).
create table metas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  codigo text,
  descricao text not null,
  valor_meta numeric(14, 2) not null default 0,
  -- Só mês/ano (sem dia) — guardado como o 1º dia do mês pra facilitar
  -- ordenação/filtro por período.
  mes_ano date not null,
  criado_em timestamptz not null default now()
);

alter table metas enable row level security;

create policy "metas_select_authenticated" on metas
  for select using (auth.role() = 'authenticated');
create policy "metas_insert_admin" on metas
  for insert with check (is_admin());
create policy "metas_update_admin" on metas
  for update using (is_admin()) with check (is_admin());
create policy "metas_delete_admin" on metas
  for delete using (is_admin());
