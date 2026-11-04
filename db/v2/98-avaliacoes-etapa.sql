-- 98 · Questionários (fit cultural / DISC) e documentos por etapa do pipeline (aditivo, idempotente)
-- A configuração é POR VAGA e ligada a uma etapa (rec_vaga_etapas). A semântica de rec_vaga_etapas não muda.

-- Configuração da etapa para o candidato: pedir documentos enquanto ele estiver nela.
create table if not exists rec_etapa_config (
  etapa_id uuid primary key references rec_vaga_etapas(id) on delete cascade,
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  solicita_documentos boolean not null default false,
  instrucao_documentos text,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
create index if not exists rec_etapa_config_vaga_idx on rec_etapa_config (vaga_id);

-- Questionários respondidos pelo candidato no portal (fit cultural e DISC de escolha forçada).
create table if not exists rec_questionarios (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  etapa_id uuid references rec_vaga_etapas(id) on delete set null,   -- etapa removida: o questionário fica sem etapa (as respostas ficam)
  tipo text not null check (tipo in ('fit_cultural', 'disc')),
  titulo text not null,
  instrucoes text,
  competencias jsonb not null default '[]'::jsonb,     -- fit: nomes livres das competências
  perguntas jsonb not null default '[]'::jsonb,        -- fit: [{id,tipo,texto,obrigatoria,alternativas[{id,texto,pontos}],competencia,peso,criterio}]
  itens jsonb not null default '[]'::jsonb,            -- disc: [{id, afirmacoes[{id,texto,dimensao}]}]
  faixas jsonb not null default '[]'::jsonb,           -- fit: critérios de interpretação [{min,rotulo,descricao}]
  perfil_recomendado jsonb,                            -- disc: {D,I,S,C,justificativa}
  instrumento jsonb not null default '{"origem":"interno","nome":"Instrumento interno","versao":"1"}'::jsonb,
  ativo boolean not null default true,
  versao int not null default 1,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create index if not exists rec_questionarios_vaga_idx on rec_questionarios (vaga_id);
create index if not exists rec_questionarios_etapa_idx on rec_questionarios (etapa_id);

-- Uma resposta por (candidatura, questionário). Guarda o retrato das perguntas respondidas.
create table if not exists rec_questionario_respostas (
  id uuid primary key default gen_random_uuid(),
  questionario_id uuid not null references rec_questionarios(id) on delete cascade,
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  etapa_id uuid references rec_vaga_etapas(id) on delete set null,
  versao int not null,
  retrato jsonb not null,           -- {perguntas|itens} no momento da resposta
  respostas jsonb not null,
  observacoes_rh text,
  observacoes_por text,
  observacoes_em timestamptz,
  enviado_em timestamptz not null default now(),
  unique (candidatura_id, questionario_id)
);
create index if not exists rec_quest_resp_quest_idx on rec_questionario_respostas (questionario_id);

-- Documentos de uma candidatura, por etapa (RH ou o próprio candidato).
create table if not exists rec_candidatura_documentos (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  etapa_id uuid references rec_vaga_etapas(id) on delete set null,
  arquivo_id uuid not null references arq_arquivos(id) on delete cascade,
  categoria text not null default 'outro',
  visivel_candidato boolean not null default false,
  enviado_por text not null check (enviado_por in ('rh', 'candidato')),
  colaborador_id text,
  observacao text,
  criado_em timestamptz not null default now()
);
create index if not exists rec_cand_docs_idx on rec_candidatura_documentos (candidatura_id, etapa_id);

alter table rec_etapa_config enable row level security;
alter table rec_questionarios enable row level security;
alter table rec_questionario_respostas enable row level security;
alter table rec_candidatura_documentos enable row level security;
