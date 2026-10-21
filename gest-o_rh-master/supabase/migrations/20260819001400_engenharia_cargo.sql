-- "Engenharia de Cargo" — a tela de Cargos ganha os campos do Sólides:
-- cargo superior (hierarquia), descrição/atividades (texto rico), piso
-- salarial visível ou não aos colaboradores, habilidades específicas,
-- assistências oferecidas, responsáveis pelo cargo, e o perfil
-- comportamental ideal (pares de traços opostos, 0-100).
alter table cargos
  add column cargo_superior_id uuid references cargos(id) on delete set null,
  add column descricao text,
  add column atividades text,
  add column piso_salarial_visivel boolean not null default false,
  add column habilidades text[] not null default '{}',
  add column assistencias text[] not null default '{}',
  add column responsaveis_ids uuid[] not null default '{}';

comment on column cargos.cargo_superior_id is
  'Cargo hierarquicamente superior (organograma). Nulo = topo da hierarquia.';
comment on column cargos.piso_salarial_visivel is
  'Se true, o piso salarial deste cargo aparece pro colaborador (não só pro RH).';
comment on column cargos.responsaveis_ids is
  'IDs de perfis (admin_rh/gestor) responsáveis por este cargo. Sem FK de array — validado na aplicação.';

-- Perfil comportamental ideal do cargo: cada linha é um par de traços
-- opostos (ex.: "Realista" vs "Otimista") com um valor 0-100 indicando o
-- quanto o perfil ideal pende pro lado direito do par.
create table cargo_tracos_comportamentais (
  id uuid primary key default gen_random_uuid(),
  cargo_id uuid not null references cargos(id) on delete cascade,
  chave text not null,
  valor smallint not null default 50 check (valor between 0 and 100),
  unique (cargo_id, chave)
);

alter table cargo_tracos_comportamentais enable row level security;

create policy "cargo_tracos_select_authenticated" on cargo_tracos_comportamentais
  for select using (auth.role() = 'authenticated');
create policy "cargo_tracos_insert_admin" on cargo_tracos_comportamentais
  for insert with check (is_admin());
create policy "cargo_tracos_update_admin" on cargo_tracos_comportamentais
  for update using (is_admin()) with check (is_admin());
create policy "cargo_tracos_delete_admin" on cargo_tracos_comportamentais
  for delete using (is_admin());
