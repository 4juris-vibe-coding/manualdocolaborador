-- Row Level Security: admin_rh tem acesso total; gestor só enxerga/edita
-- o que pertence ao(s) departamento(s) que ele gerencia (managed_department_ids()).
-- Tabelas de apoio são de leitura livre para todo autenticado e escrita
-- restrita a admin_rh.

-- ============================================================
-- perfis
-- ============================================================
alter table perfis enable row level security;

create policy "perfis_self_select" on perfis
  for select using (id = auth.uid());

create policy "perfis_admin_all" on perfis
  for all using (is_admin()) with check (is_admin());

-- ============================================================
-- departamento_gestores
-- ============================================================
alter table departamento_gestores enable row level security;

create policy "dg_admin_all" on departamento_gestores
  for all using (is_admin()) with check (is_admin());

create policy "dg_gestor_select_own" on departamento_gestores
  for select using (gestor_id = auth.uid());

-- ============================================================
-- Tabelas de apoio: leitura para todo autenticado, escrita admin_rh
-- ============================================================
do $$
declare
  tabela text;
begin
  foreach tabela in array array[
    'unidades', 'cargos', 'motivos_demissao', 'tipos_registro',
    'checklist_templates', 'checklist_template_itens', 'empresa_config',
    'departamentos'
  ]
  loop
    execute format('alter table %I enable row level security;', tabela);

    execute format(
      'create policy "%s_select_authenticated" on %I for select using (auth.role() = ''authenticated'');',
      tabela, tabela
    );
    execute format(
      'create policy "%s_insert_admin" on %I for insert with check (is_admin());',
      tabela, tabela
    );
    execute format(
      'create policy "%s_update_admin" on %I for update using (is_admin()) with check (is_admin());',
      tabela, tabela
    );
    execute format(
      'create policy "%s_delete_admin" on %I for delete using (is_admin());',
      tabela, tabela
    );
  end loop;
end $$;

-- ============================================================
-- colaboradores: admin total; gestor só do(s) próprio(s) departamento(s),
-- sem poder criar/excluir (admissão/demissão fica centralizada em admin_rh).
-- ============================================================
alter table colaboradores enable row level security;

create policy "colaboradores_admin_all" on colaboradores
  for all using (is_admin()) with check (is_admin());

create policy "colaboradores_gestor_select" on colaboradores
  for select using (departamento_id in (select managed_department_ids()));

create policy "colaboradores_gestor_update" on colaboradores
  for update
  using (departamento_id in (select managed_department_ids()))
  with check (departamento_id in (select managed_department_ids()));

-- ============================================================
-- ferias: admin total; gestor CRUD completo (pode aprovar/rejeitar) no
-- time do(s) departamento(s) que gerencia.
-- ============================================================
alter table ferias enable row level security;

create policy "ferias_admin_all" on ferias
  for all using (is_admin()) with check (is_admin());

create policy "ferias_gestor_all" on ferias
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = ferias.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = ferias.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));

-- ============================================================
-- registros: mesmo padrão de ferias.
-- ============================================================
alter table registros enable row level security;

create policy "registros_admin_all" on registros
  for all using (is_admin()) with check (is_admin());

create policy "registros_gestor_all" on registros
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = registros.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = registros.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));

-- ============================================================
-- checklist_aplicados: mesmo padrão.
-- ============================================================
alter table checklist_aplicados enable row level security;

create policy "checklist_aplicados_admin_all" on checklist_aplicados
  for all using (is_admin()) with check (is_admin());

create policy "checklist_aplicados_gestor_all" on checklist_aplicados
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = checklist_aplicados.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = checklist_aplicados.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));

-- ============================================================
-- checklist_aplicado_itens: escopo via checklist_aplicados -> colaboradores.
-- ============================================================
alter table checklist_aplicado_itens enable row level security;

create policy "checklist_aplicado_itens_admin_all" on checklist_aplicado_itens
  for all using (is_admin()) with check (is_admin());

create policy "checklist_aplicado_itens_gestor_all" on checklist_aplicado_itens
  for all
  using (exists (
    select 1 from checklist_aplicados ca
    join colaboradores c on c.id = ca.colaborador_id
    where ca.id = checklist_aplicado_itens.checklist_aplicado_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from checklist_aplicados ca
    join colaboradores c on c.id = ca.colaborador_id
    where ca.id = checklist_aplicado_itens.checklist_aplicado_id
      and c.departamento_id in (select managed_department_ids())
  ));
