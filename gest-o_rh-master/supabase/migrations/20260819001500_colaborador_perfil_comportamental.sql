-- Perfil comportamental do colaborador — mesma ideia do perfil ideal do
-- cargo (cargo_tracos_comportamentais), mas por colaborador. É o que
-- alimenta a "Busca de Perfil": comparar o perfil de cada colaborador
-- contra um perfil-alvo (o de um cargo, ou um perfil customizado na
-- hora da busca).
create table colaborador_tracos_comportamentais (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores(id) on delete cascade,
  chave text not null,
  valor smallint not null default 50 check (valor between 0 and 100),
  unique (colaborador_id, chave)
);
create index on colaborador_tracos_comportamentais (colaborador_id);

-- RLS: mesmo padrão de colaborador_dependentes (admin total; gestor só
-- dos colaboradores do próprio departamento).
alter table colaborador_tracos_comportamentais enable row level security;

create policy "colaborador_tracos_admin_all" on colaborador_tracos_comportamentais
  for all using (is_admin()) with check (is_admin());

create policy "colaborador_tracos_gestor_all" on colaborador_tracos_comportamentais
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = colaborador_tracos_comportamentais.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = colaborador_tracos_comportamentais.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));
