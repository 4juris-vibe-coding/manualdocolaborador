-- Vínculo colaborador <-> benefício (Reten. e Engajamento > Gestão de
-- Benefícios > Beneficiários). Valor/periodicidade/desconto exibidos na
-- listagem vêm direto do cadastro do benefício (não há override por
-- colaborador — não apareceu nenhum campo assim nos prints).
create table beneficiarios (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  beneficio_id uuid not null references beneficios(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (colaborador_id, beneficio_id)
);

create index on beneficiarios (colaborador_id);
create index on beneficiarios (beneficio_id);

alter table beneficiarios enable row level security;

create policy "beneficiarios_select_authenticated" on beneficiarios
  for select using (auth.role() = 'authenticated');
create policy "beneficiarios_insert_admin" on beneficiarios
  for insert with check (is_admin());
create policy "beneficiarios_update_admin" on beneficiarios
  for update using (is_admin()) with check (is_admin());
create policy "beneficiarios_delete_admin" on beneficiarios
  for delete using (is_admin());
