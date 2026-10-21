-- Singleton (mesmo truque de empresa_config) com a configuração de envio
-- automático da Avaliação do Período de Experiência — tela
-- Configurações > Avaliação de experiência > Configurar Avaliação.
create type periodo_avaliativo_experiencia as enum ('90_dias', '45_e_90_dias', '30_60_e_90_dias');

create table configuracao_avaliacao_experiencia (
  id boolean primary key default true check (id),
  habilitado boolean not null default false,
  periodo_avaliativo periodo_avaliativo_experiencia not null default '90_dias',
  tipos_contrato tipo_contrato_colaborador[],
  cargo_ids uuid[],
  atualizado_em timestamptz not null default now()
);

create trigger set_atualizado_em before update on configuracao_avaliacao_experiencia
  for each row execute function moddatetime(atualizado_em);

insert into configuracao_avaliacao_experiencia (id) values (true);

alter table configuracao_avaliacao_experiencia enable row level security;

create policy "configuracao_avaliacao_experiencia_select_authenticated" on configuracao_avaliacao_experiencia
  for select using (auth.role() = 'authenticated');
create policy "configuracao_avaliacao_experiencia_insert_admin" on configuracao_avaliacao_experiencia
  for insert with check (is_admin());
create policy "configuracao_avaliacao_experiencia_update_admin" on configuracao_avaliacao_experiencia
  for update using (is_admin()) with check (is_admin());
create policy "configuracao_avaliacao_experiencia_delete_admin" on configuracao_avaliacao_experiencia
  for delete using (is_admin());
