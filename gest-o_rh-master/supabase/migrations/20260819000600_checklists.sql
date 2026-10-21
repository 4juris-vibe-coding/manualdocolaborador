-- Checklists de admissão/demissão aplicados a um colaborador específico.
-- checklist_aplicado_itens.descricao é um SNAPSHOT do texto do item do
-- template no momento da aplicação: se o RH editar o template depois,
-- checklists já aplicados não mudam retroativamente.

create table checklist_aplicados (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  template_id uuid not null references checklist_templates (id),
  tipo tipo_checklist not null,
  data_aplicacao date not null default current_date,
  criado_por uuid references perfis (id),
  criado_em timestamptz not null default now()
);
create index on checklist_aplicados (colaborador_id);

create table checklist_aplicado_itens (
  id uuid primary key default gen_random_uuid(),
  checklist_aplicado_id uuid not null references checklist_aplicados (id) on delete cascade,
  descricao text not null,
  ordem integer not null default 0,
  concluido boolean not null default false,
  concluido_por uuid references perfis (id),
  concluido_em timestamptz
);
create index on checklist_aplicado_itens (checklist_aplicado_id);

-- Carimba automaticamente quem/quando concluiu um item, em vez de confiar
-- nesses campos vindos do cliente.
create or replace function set_conclusao_item_checklist()
returns trigger
language plpgsql
as $$
begin
  if new.concluido and not old.concluido then
    new.concluido_por := auth.uid();
    new.concluido_em := now();
  elsif not new.concluido and old.concluido then
    new.concluido_por := null;
    new.concluido_em := null;
  end if;
  return new;
end;
$$;

create trigger trg_set_conclusao_item_checklist
  before update on checklist_aplicado_itens
  for each row
  execute function set_conclusao_item_checklist();
