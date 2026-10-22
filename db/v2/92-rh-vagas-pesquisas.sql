-- 92 · RH: campos de divulgação da vaga e plano de ação das pesquisas.
-- Aditiva e idempotente: vagas existentes ficam com os campos vazios (omitidos na página pública e no PDF).

-- Vaga: desafios da posição, jornada/horário e etapas do processo seletivo exibidas ao candidato.
-- As etapas do pipeline (rec_vaga_etapas) são internas; estas são o texto público.
alter table rec_vagas add column if not exists desafios text;
alter table rec_vagas add column if not exists jornada text;
alter table rec_vagas add column if not exists etapas_processo jsonb not null default '[]'::jsonb;

-- Plano de ação a partir dos resultados de uma pesquisa.
-- Não guarda respostas nem identifica respondentes: só o problema observado e a ação.
create table if not exists pq_acoes (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  dimensao text,                                  -- dimensão/pergunta relacionada (texto livre)
  problema text not null,                         -- resultado observado ou oportunidade
  acao text not null,                             -- ação proposta
  responsavel_id text,                            -- colaborador (coleção legada)
  prazo date,
  status text not null default 'planejada' check (status in ('planejada','em_andamento','concluida','cancelada')),
  indicador text,                                 -- como acompanhar
  conclusao text,                                 -- registro de conclusão
  concluida_em date,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists pq_acoes_pesq_idx on pq_acoes (pesquisa_id);
create index if not exists pq_acoes_abertas_idx on pq_acoes (prazo) where status in ('planejada','em_andamento');
alter table pq_acoes enable row level security;
