-- Simplifica Checklists pro modelo real do Sólides: uma lista simples de
-- "tópicos" por tipo (Contratação/Demissão) — sem a camada de "aplicar a
-- um colaborador com progresso" que o Sólides não tem (confirmado com a
-- cliente). Os prints mostram só: lista de tópicos + form de criar tópico
-- (Descrição + Tipo).
drop table if exists checklist_aplicado_itens cascade;
drop table if exists checklist_aplicados cascade;
drop table if exists checklist_template_itens cascade;
drop table if exists checklist_templates cascade;

create table checklist_topicos (
  id uuid primary key default gen_random_uuid(),
  descricao text not null,
  tipo tipo_checklist not null,
  criado_em timestamptz not null default now()
);

alter table checklist_topicos enable row level security;

create policy "checklist_topicos_select_authenticated" on checklist_topicos
  for select using (auth.role() = 'authenticated');
create policy "checklist_topicos_insert_admin" on checklist_topicos
  for insert with check (is_admin());
create policy "checklist_topicos_update_admin" on checklist_topicos
  for update using (is_admin()) with check (is_admin());
create policy "checklist_topicos_delete_admin" on checklist_topicos
  for delete using (is_admin());
