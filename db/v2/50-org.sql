-- 50 · Organograma: retratos mensais da estrutura (para mostrar a evolução quando houver histórico)
create table if not exists org_snapshots (
  mes date primary key,                 -- primeiro dia do mês
  dados jsonb not null,
  criado_em timestamptz not null default now(),
  criado_por text                       -- null = gerado automaticamente na leitura da análise
);
alter table org_snapshots enable row level security;
