-- 20 · ATS: candidatos, candidaturas, entrevistas, avaliações, propostas, comunicação, privacidade

-- Uma pessoa = um candidato reutilizável; várias candidaturas apontam para ele.
create table if not exists rec_candidatos (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  telefone text,
  cidade text,
  uf text,
  linkedin text,
  resumo text,
  experiencias jsonb not null default '[]'::jsonb,   -- [{empresa,cargo,inicio,fim,descricao}] (conferido por humano)
  formacoes jsonb not null default '[]'::jsonb,
  competencias jsonb not null default '[]'::jsonb,
  areas_interesse jsonb not null default '[]'::jsonb,
  pretensao numeric(14,2),
  disponibilidade text,
  origem_inicial text,
  anonimizado_em timestamptz,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);
create unique index if not exists rec_candidatos_email_uk on rec_candidatos (lower(email)) where anonimizado_em is null;

create table if not exists rec_candidaturas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references rec_vagas(id),
  candidato_id uuid not null references rec_candidatos(id),
  etapa_id uuid references rec_vaga_etapas(id),
  status text not null default 'ativa',   -- ativa | contratado | reprovado | desistiu | cancelada | encerrada
  motivo_saida text,
  origem text not null default 'portal',  -- portal | indicacao | linkedin | manual | importacao | banco_talentos | outro
  origem_detalhe text,
  respostas_triagem jsonb not null default '[]'::jsonb,   -- [{perguntaId,texto,resposta}]
  curriculo_arquivo_id uuid references arq_arquivos(id),
  pretensao numeric(14,2),
  disponibilidade text,
  token_hash text unique,                 -- acompanhamento do candidato (hash do token entregue só a ele)
  etapa_desde timestamptz not null default now(),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  encerrada_em timestamptz,
  unique (vaga_id, candidato_id)
);
create index if not exists rec_cand_vaga_idx on rec_candidaturas (vaga_id, status);
create index if not exists rec_cand_etapa_idx on rec_candidaturas (etapa_id);

create table if not exists rec_candidatura_movs (
  id bigserial primary key,
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  em timestamptz not null default now(),
  colaborador_id text,                    -- null = o próprio candidato / sistema
  de_etapa_id uuid,
  para_etapa_id uuid,
  de_status text,
  para_status text,
  motivo text
);
create index if not exists rec_movs_idx on rec_candidatura_movs (candidatura_id, em);

-- Notas internas (visibilidade: 'rh' = só RH/recrutadores; 'banca' = também gestor/entrevistadores da vaga)
create table if not exists rec_candidatura_notas (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  autor_id text not null,
  texto text not null,
  visibilidade text not null default 'rh' check (visibilidade in ('rh','banca')),
  criado_em timestamptz not null default now()
);

create table if not exists rec_entrevistas (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  tipo text not null default 'rh',        -- rh | tecnica | gestor | final | outra
  inicio timestamptz not null,
  fim timestamptz,
  modalidade text not null default 'online', -- online | presencial | telefone
  local_ou_link text,
  participantes jsonb not null default '[]'::jsonb,  -- ids de colaboradores (entrevistadores)
  status text not null default 'agendada',  -- agendada | realizada | cancelada | nao_compareceu
  resultado text,                           -- aprovado | reprovado | indeciso
  parecer text,
  reagendamentos jsonb not null default '[]'::jsonb, -- [{de,para,motivo,por,em}]
  criado_por text,
  criado_em timestamptz not null default now()
);
create index if not exists rec_entrev_inicio_idx on rec_entrevistas (inicio);

create table if not exists rec_modelos_avaliacao (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  criterios jsonb not null,                -- [{id,nome,peso}] notas de 1 a 5
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

create table if not exists rec_avaliacoes (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  entrevista_id uuid references rec_entrevistas(id) on delete set null,
  avaliador_id text not null,
  modelo_id uuid references rec_modelos_avaliacao(id),
  notas jsonb not null default '{}'::jsonb,  -- {criterioId: 1..5}
  recomendacao text,                         -- avancar | manter | nao_avancar
  parecer text,
  criado_em timestamptz not null default now()
);
create index if not exists rec_aval_cand_idx on rec_avaliacoes (candidatura_id);

create table if not exists rec_propostas (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid not null references rec_candidaturas(id) on delete cascade,
  valor numeric(14,2),
  moeda text not null default 'BRL',
  tipo_remuneracao text default 'mensal',
  beneficios jsonb not null default '[]'::jsonb,
  data_inicio_prevista date,
  status text not null default 'rascunho',   -- rascunho | enviada | aceita | recusada | negociacao | expirada | cancelada
  motivo_recusa text,
  historico jsonb not null default '[]'::jsonb, -- negociação [{em,por,tipo,valor,nota}]
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

-- Comunicação: nunca marcar como enviada sem envio real
create table if not exists rec_templates_msg (
  chave text primary key,                    -- confirmacao_candidatura | convite_entrevista | ...
  nome text not null,
  assunto text not null,
  corpo text not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create table if not exists rec_comunicacoes (
  id uuid primary key default gen_random_uuid(),
  candidatura_id uuid references rec_candidaturas(id) on delete cascade,
  candidato_id uuid references rec_candidatos(id),
  template_chave text,
  canal text not null default 'email',
  assunto text not null,
  corpo text not null,
  status text not null default 'pendente',   -- pendente | enviada | falhou | nao_configurado
  erro text,
  criado_por text,
  criado_em timestamptz not null default now(),
  enviada_em timestamptz
);
create index if not exists rec_com_status_idx on rec_comunicacoes (status);

-- Privacidade (LGPD): finalidade, base legal, versão do texto, prazo de retenção
create table if not exists rec_consentimentos (
  id uuid primary key default gen_random_uuid(),
  candidato_id uuid not null references rec_candidatos(id) on delete cascade,
  candidatura_id uuid references rec_candidaturas(id) on delete set null,
  finalidade text not null,                  -- 'processo_seletivo' | 'banco_talentos' | 'contato_futuro'
  base_legal text not null,                  -- 'execucao_pre_contratual' | 'consentimento' | 'legitimo_interesse'
  texto_versao text not null,
  concedido boolean not null,
  registrado_em timestamptz not null default now(),
  valido_ate date,
  revogado_em timestamptz
);
create index if not exists rec_consent_idx on rec_consentimentos (candidato_id, finalidade);

create table if not exists rec_talentos (
  candidato_id uuid primary key references rec_candidatos(id) on delete cascade,
  tags jsonb not null default '[]'::jsonb,
  areas jsonb not null default '[]'::jsonb,
  observacao text,
  incluido_por text,
  incluido_em timestamptz not null default now(),
  retencao_ate date,
  ultimo_contato_em timestamptz,
  historico_contato jsonb not null default '[]'::jsonb
);

alter table rec_candidatos enable row level security;
alter table rec_candidaturas enable row level security;
alter table rec_candidatura_movs enable row level security;
alter table rec_candidatura_notas enable row level security;
alter table rec_entrevistas enable row level security;
alter table rec_modelos_avaliacao enable row level security;
alter table rec_avaliacoes enable row level security;
alter table rec_propostas enable row level security;
alter table rec_templates_msg enable row level security;
alter table rec_comunicacoes enable row level security;
alter table rec_consentimentos enable row level security;
alter table rec_talentos enable row level security;
