-- Extensão de ciclos_avaliativos com os dados coletados nas 4 etapas de
-- "Solicitar Avaliação" (Criar avaliação / Escalas / Configurações /
-- Solicitar avaliação), e a tabela de participantes (pares
-- avaliador->avaliado) gerados a partir dessas configurações.

create type tipo_relacao_avaliacao as enum (
  'direta_90',
  'conjunta_180',
  'trezentos_sessenta',
  'customizada'
);

create type nivel_estrutura_avaliacao as enum ('unidade', 'departamento', 'cargo');

alter table ciclos_avaliativos
  add column descricao text,
  add column data_abertura date,
  add column data_encerramento date,
  add column niveis_escala smallint not null default 5,
  add column rotulo_escala text,
  add column comentario_competencia_mostrar boolean not null default false,
  add column comentario_competencia_obrigatorio boolean not null default false,
  add column comentario_geral_obrigatorio boolean not null default false,
  add column tipo_relacao tipo_relacao_avaliacao not null default 'direta_90',
  add column autoavaliacao boolean not null default false,
  add column admitidos_ate date,
  add column tipos_contrato tipo_contrato_colaborador[],
  add column nivel_estrutura nivel_estrutura_avaliacao,
  add column opcao_estrutura_id uuid,
  -- Etapa em que o rascunho parou, pra "continuar de onde parei".
  add column etapa_atual text not null default 'criar';

alter table ciclos_avaliativos
  add constraint ciclos_avaliativos_niveis_escala_check check (niveis_escala in (4, 5));

create table ciclo_avaliativo_participantes (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references ciclos_avaliativos(id) on delete cascade,
  avaliado_id uuid not null references colaboradores(id) on delete cascade,
  avaliador_id uuid not null references colaboradores(id) on delete cascade,
  criado_em timestamptz not null default now(),
  unique (ciclo_id, avaliado_id, avaliador_id)
);

alter table ciclo_avaliativo_participantes enable row level security;

create policy "ciclo_avaliativo_participantes_select_authenticated" on ciclo_avaliativo_participantes
  for select using (auth.role() = 'authenticated');
create policy "ciclo_avaliativo_participantes_insert_admin" on ciclo_avaliativo_participantes
  for insert with check (is_admin());
create policy "ciclo_avaliativo_participantes_update_admin" on ciclo_avaliativo_participantes
  for update using (is_admin()) with check (is_admin());
create policy "ciclo_avaliativo_participantes_delete_admin" on ciclo_avaliativo_participantes
  for delete using (is_admin());
