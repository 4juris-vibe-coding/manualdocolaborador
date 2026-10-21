-- 30 · Central de pesquisas (pq_*)
--
-- ANONIMATO: em pesquisa 'anonima' NÃO existe ligação entre convite e resposta em nenhuma tabela.
--   * pq_convites guarda quem foi convidado e, ao usar, só a DATA de uso;
--   * pq_respostas (anônima) guarda versão, data, atributos de grupo (área/unidade) e as respostas;
--     colaborador_id é sempre nulo; o id é aleatório (uuid) e não há hora nem sequência.
-- Em 'identificada', colaborador_id é gravado e a tela informa quem acessa e para quê.

create table if not exists pq_pesquisas (
  id uuid primary key default gen_random_uuid(),
  titulo text not null,
  descricao text,
  objetivo text,
  categoria text not null default 'Personalizada',
  modelo_chave text,
  modo text not null default 'anonima' check (modo in ('anonima','identificada')),
  status text not null default 'rascunho' check (status in ('rascunho','agendada','aberta','pausada','encerrada')),
  inicio date,
  fim date,
  min_grupo int not null default 5 check (min_grupo >= 3),
  publico jsonb not null default '{"todos":true}'::jsonb,   -- critérios de elegibilidade
  intro text,
  mensagem_final text,
  finalidade text,                -- identificada: para que os dados serão usados
  quem_acessa text,               -- identificada: quem poderá ver as respostas individuais
  config jsonb not null default '{}'::jsonb,   -- {barraProgresso, lembretesDias:[..], salvarProgresso}
  rascunho_perguntas jsonb not null default '[]'::jsonb,   -- estrutura em edição (o que está no ar fica em pq_versoes)
  versao_atual int not null default 0,
  link_publico_hash text unique,
  link_publico_ativo boolean not null default false,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  publicada_em timestamptz,
  encerrada_em timestamptz
);
create index if not exists pq_pesq_status_idx on pq_pesquisas (status);

-- Retrato imutável da estrutura a cada publicação
create table if not exists pq_versoes (
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  versao int not null,
  titulo text not null,
  intro text,
  mensagem_final text,
  modo text not null,
  perguntas jsonb not null,
  publicada_em timestamptz not null default now(),
  publicada_por text,
  primary key (pesquisa_id, versao)
);

create table if not exists pq_convites (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  colaborador_id text not null,
  token_hash text not null unique,
  canal text not null default 'interno',          -- interno | email
  status text not null default 'pendente',        -- pendente | usado | revogado
  expira_em timestamptz not null,
  usado_em date,                                  -- só a data (nunca a hora)
  enviado_em timestamptz,
  email_status text,                              -- enviada | falhou | nao_configurado
  email_erro text,
  lembretes int not null default 0,
  ultimo_lembrete_em timestamptz,
  criado_em timestamptz not null default now(),
  unique (pesquisa_id, colaborador_id)
);
create index if not exists pq_conv_colab_idx on pq_convites (colaborador_id, status);

-- Progresso salvo (apenas pesquisas identificadas)
create table if not exists pq_progresso (
  convite_id uuid primary key references pq_convites(id) on delete cascade,
  itens jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now()
);

create table if not exists pq_respostas (
  id uuid primary key default gen_random_uuid(),
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  versao int not null,
  enviada_em date not null,
  grupo jsonb not null default '{}'::jsonb,       -- {setorId, unidadeId} para recortes agregados
  colaborador_id text,                            -- SOMENTE em pesquisa identificada
  itens jsonb not null default '{}'::jsonb        -- {perguntaId: valor}
);
create index if not exists pq_resp_pesq_idx on pq_respostas (pesquisa_id, versao);

-- Marca anti-repetição do link público (hash de um identificador do navegador; sem relação com a resposta)
create table if not exists pq_link_marcas (
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  marca_hash text not null,
  primary key (pesquisa_id, marca_hash)
);

-- Categorização manual de respostas abertas
create table if not exists pq_tags (
  resposta_id uuid not null references pq_respostas(id) on delete cascade,
  pergunta_id text not null,
  tag text not null,
  primary key (resposta_id, pergunta_id, tag)
);

create table if not exists pq_eventos (
  id bigserial primary key,
  pesquisa_id uuid not null references pq_pesquisas(id) on delete cascade,
  em timestamptz not null default now(),
  colaborador_id text,
  tipo text not null,
  detalhes jsonb not null default '{}'::jsonb
);
create index if not exists pq_ev_idx on pq_eventos (pesquisa_id, em);

alter table pq_pesquisas enable row level security;
alter table pq_versoes enable row level security;
alter table pq_convites enable row level security;
alter table pq_progresso enable row level security;
alter table pq_respostas enable row level security;
alter table pq_link_marcas enable row level security;
alter table pq_tags enable row level security;
alter table pq_eventos enable row level security;
