-- =====================================================================
-- 4JURIS Pessoas · schema v2 (módulos normalizados) · 00 base
-- Idempotente. Acesso SOMENTE pelo servidor (api/). RLS ligado e sem
-- políticas: chaves anon/authenticated do Supabase não leem nem escrevem.
--
-- Convenção: pessoas, áreas, unidades e funções continuam sendo as
-- coleções JSONB legadas (app_colaboradores, app_setores, app_unidades,
-- app_cargos) — FONTE DA VERDADE. As tabelas v2 guardam esses IDs como
-- texto (referência lógica, validada no servidor), nunca uma cópia.
-- =====================================================================

-- Funções adicionais além do papel (recrutador, analista de RH, responsável por pesquisas…)
create table if not exists acl_funcoes (
  colaborador_id text not null,
  funcao text not null check (funcao in ('recrutador','analista_rh','resp_pesquisas','aprovador_financeiro')),
  concedido_por text,
  criado_em timestamptz not null default now(),
  primary key (colaborador_id, funcao)
);

-- Auditoria dos módulos v2 (sem dados sensíveis desnecessários no detalhe)
create table if not exists aud_eventos (
  id bigserial primary key,
  em timestamptz not null default now(),
  colaborador_id text,
  entidade text not null,
  entidade_id text,
  acao text not null,
  detalhes jsonb not null default '{}'::jsonb
);
create index if not exists aud_eventos_entidade_idx on aud_eventos (entidade, entidade_id);
create index if not exists aud_eventos_em_idx on aud_eventos (em desc);

-- Notificações internas (a chave evita duplicidade por destinatário)
create table if not exists ntf_notificacoes (
  id uuid primary key default gen_random_uuid(),
  destinatario_id text not null,
  tipo text not null,
  titulo text not null,
  corpo text,
  link text,
  chave text,
  criada_em timestamptz not null default now(),
  lida_em timestamptz,
  unique (destinatario_id, chave)
);
create index if not exists ntf_dest_idx on ntf_notificacoes (destinatario_id, criada_em desc);

-- Arquivos privados (currículos, anexos). Servidos só por endpoint autenticado.
create table if not exists arq_arquivos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  mime text not null,
  tamanho int not null,
  sha256 text not null,
  conteudo bytea not null,
  dono_tipo text not null,          -- 'vaga' | 'candidatura' | 'candidato' | ...
  dono_id text,
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists arq_dono_idx on arq_arquivos (dono_tipo, dono_id);

-- Limites de uso por chave (anti-abuso nos endpoints públicos, valendo entre instâncias)
create table if not exists lim_tentativas (
  chave text not null,
  janela bigint not null,
  n int not null default 1,
  primary key (chave, janela)
);

alter table acl_funcoes enable row level security;
alter table aud_eventos enable row level security;
alter table ntf_notificacoes enable row level security;
alter table arq_arquivos enable row level security;
alter table lim_tentativas enable row level security;
