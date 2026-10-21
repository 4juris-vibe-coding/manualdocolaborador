-- Instâncias de avaliação do período de experiência (uma linha por
-- colaborador+período — ex.: 45 dias e 90 dias), geradas a partir da
-- configuração em configuracao_avaliacao_experiencia. Alimenta as telas
-- "Acompanhar Avaliações" e "Rel. Geral e Participação".
create type status_avaliacao_experiencia as enum ('pendente', 'respondida', 'expirada');

create table avaliacoes_experiencia (
  id uuid primary key default gen_random_uuid(),
  avaliado_id uuid not null references colaboradores(id) on delete cascade,
  avaliador_id uuid references colaboradores(id) on delete set null,
  -- Cargo/departamento no momento em que a avaliação foi gerada — não
  -- reflete uma mudança posterior do colaborador (mesma lógica do aviso
  -- em Configurar Avaliação).
  cargo_id uuid references cargos(id) on delete set null,
  departamento_id uuid references departamentos(id) on delete set null,
  unidade_id uuid references unidades(id) on delete set null,
  periodo_dias smallint not null,
  data_referencia date not null,
  expira_em date not null,
  status status_avaliacao_experiencia not null default 'pendente',
  nota numeric(4,2),
  respondido_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (avaliado_id, periodo_dias)
);

create index on avaliacoes_experiencia (status);

alter table avaliacoes_experiencia enable row level security;

create policy "avaliacoes_experiencia_select_authenticated" on avaliacoes_experiencia
  for select using (auth.role() = 'authenticated');
create policy "avaliacoes_experiencia_insert_admin" on avaliacoes_experiencia
  for insert with check (is_admin());
create policy "avaliacoes_experiencia_update_admin" on avaliacoes_experiencia
  for update using (is_admin()) with check (is_admin());
create policy "avaliacoes_experiencia_delete_admin" on avaliacoes_experiencia
  for delete using (is_admin());
