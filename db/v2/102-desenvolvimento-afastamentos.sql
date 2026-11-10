-- Ciclo de desenvolvimento · afastamentos e revisões do PDI (aditivo e idempotente).
-- Afastamento: os ciclos abertos da pessoa ficam suspensos automaticamente enquanto durar e são
-- retomados no retorno, com os prazos estendidos pelos dias de pausa. Categoria genérica: o motivo
-- detalhado (ex.: saúde) não é guardado aqui (minimização, LGPD).

create table if not exists dsv_afastamentos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id text not null,
  inicio date not null,
  fim date,
  categoria text not null default 'afastamento' check (categoria in ('descanso','licenca','afastamento','outro')),
  observacao text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (fim is null or fim >= inicio)
);
create index if not exists dsv_afastamentos_pessoa on dsv_afastamentos (colaborador_id, inicio);

-- Suspensão feita pela rotina por causa de um afastamento (retomada automática no retorno).
alter table dsv_ciclos add column if not exists afastamento_id uuid;
alter table dsv_ciclos add column if not exists suspenso_em date;

-- Revisões (check-ins) do PDI: data, quem registrou e o que foi visto. A próxima revisão fica em revisao_em.
alter table dsv_pdis add column if not exists revisoes jsonb not null default '[]'::jsonb;
