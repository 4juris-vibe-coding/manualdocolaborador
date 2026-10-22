-- =====================================================================
-- 90 · Disparos do financeiro: lembretes de nota fiscal enviados às
--      pessoas que prestam os contratos (notificação no portal e,
--      opcionalmente, e-mail). Guarda o que foi enviado, para quem e
--      o resultado de cada e-mail. Idempotente e ADITIVO.
-- =====================================================================

create table if not exists fin_disparos (
  id uuid primary key default gen_random_uuid(),
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  publico text not null,                              -- rótulo do filtro usado (pendentes, devolvidas, todos, selecionados, individual)
  canais text[] not null,                             -- {'portal'} | {'portal','email'}
  assunto text not null,
  mensagem text not null,                             -- modelo com {{variaveis}}, como foi escrito
  destinatarios int not null default 0,
  emails_enviados int not null default 0,
  emails_falharam int not null default 0,
  criado_por text not null,
  criado_em timestamptz not null default now()
);
create index if not exists fin_disp_comp_idx on fin_disparos (competencia, criado_em desc);

create table if not exists fin_disparo_envios (
  id bigserial primary key,
  disparo_id uuid not null references fin_disparos(id) on delete cascade,
  pessoa_id text not null,
  contratos text[] not null default '{}',
  email text,
  status_email text check (status_email in ('enviada','falhou','nao_configurado','sem_email')),  -- null: e-mail não pedido
  erro text,
  criado_em timestamptz not null default now()
);
create index if not exists fin_disp_env_idx on fin_disparo_envios (disparo_id);
create index if not exists fin_disp_env_pessoa_idx on fin_disparo_envios (pessoa_id, criado_em desc);

alter table fin_disparos enable row level security;
alter table fin_disparo_envios enable row level security;
