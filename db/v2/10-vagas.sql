-- 10 · Vagas, aprovações e configuração do recrutamento

-- Configuração por chave: 'fluxos_aprovacao', 'etapas_padrao', 'canais', 'tipos_vaga', 'privacidade', 'retencao'
create table if not exists rec_config (
  chave text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);

create sequence if not exists rec_vaga_seq;

create table if not exists rec_vagas (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,                       -- VAG-2026-0001
  slug text not null unique,                         -- link público (/carreiras/<slug>)
  titulo text not null,
  resumo text,
  objetivo text,
  tipo text not null default 'efetivo',              -- efetivo | temporario | estagio | aprendiz | contrato | outro
  motivo text not null default 'expansao',           -- substituicao | expansao | nova_posicao | outro
  qtd_posicoes int not null default 1 check (qtd_posicoes >= 1),
  posicoes_preenchidas int not null default 0 check (posicoes_preenchidas >= 0),
  prioridade text not null default 'normal',         -- baixa | normal | alta | critica
  status text not null default 'rascunho',
    -- rascunho | em_aprovacao | ajustes | aprovada | publicada | pausada | encerrada | cancelada
  arquivada boolean not null default false,
  -- estrutura (referências lógicas às coleções legadas)
  setor_id text,
  unidade_id text,
  cargo_id text,
  senioridade text,
  equipe text,
  gestor_solicitante_id text,
  gestor_responsavel_id text,
  gestor_imediato_id text,
  recrutador_id text,
  -- local
  pais text default 'Brasil',
  estado text,
  cidade text,
  modalidade text not null default 'presencial',     -- presencial | hibrido | remoto
  viagens text,
  -- remuneração (restrita por permissão)
  salario_min numeric(14,2),
  salario_max numeric(14,2),
  moeda text not null default 'BRL',
  tipo_remuneracao text default 'mensal',
  beneficios jsonb not null default '[]'::jsonb,
  variavel text,
  divulgar_salario boolean not null default false,
  -- perfil
  responsabilidades text,
  atividades text,
  requisitos_obrigatorios jsonb not null default '[]'::jsonb,
  requisitos_desejaveis jsonb not null default '[]'::jsonb,
  formacao text,
  experiencia text,
  competencias_tecnicas jsonb not null default '[]'::jsonb,
  competencias_comportamentais jsonb not null default '[]'::jsonb,
  idiomas jsonb not null default '[]'::jsonb,
  certificacoes jsonb not null default '[]'::jsonb,
  criterios_avaliacao jsonb not null default '[]'::jsonb,
  perguntas_triagem jsonb not null default '[]'::jsonb,  -- [{id,texto,tipo:'texto'|'sim_nao'|'opcoes',obrigatoria,opcoes?,eliminatoria?}]
  documentos_necessarios jsonb not null default '[]'::jsonb,
  -- divulgação
  canais jsonb not null default '["portal"]'::jsonb,
  texto_publico text,
  mensagem_confirmacao text,
  criterios_encerramento text,
  data_abertura date not null default current_date,
  prazo_preenchimento date,
  data_inicio_prevista date,
  publicar_em date,
  encerra_candidaturas_em date,
  observacoes_rh text,                               -- restrito ao RH
  -- ciclo de vida
  solicitada_em timestamptz,
  aprovada_em timestamptz,
  publicada_em timestamptz,
  primeira_candidatura_em timestamptz,
  encerrada_em timestamptz,
  motivo_encerramento text,
  fluxo_chave text,                                  -- fluxo de aprovação aplicado
  versao int not null default 1,                     -- controle otimista de edição
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  check (salario_max is null or salario_min is null or salario_max >= salario_min)
);
create index if not exists rec_vagas_status_idx on rec_vagas (status) where not arquivada;
create index if not exists rec_vagas_setor_idx on rec_vagas (setor_id);
create index if not exists rec_vagas_recrutador_idx on rec_vagas (recrutador_id);
create index if not exists rec_vagas_cargo_idx on rec_vagas (cargo_id);

-- Etapas do processo seletivo da vaga (configuráveis, reordenáveis)
create table if not exists rec_vaga_etapas (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  ordem int not null,
  nome text not null,
  tipo text not null default 'generica',   -- nova | triagem | curricular | tecnica | entrevista_rh | entrevista_gestor | entrevista_final | proposta | contratado | generica
  criado_em timestamptz not null default now()
);
create index if not exists rec_vaga_etapas_idx on rec_vaga_etapas (vaga_id, ordem);

-- Aprovações (uma linha por passo do fluxo, por rodada)
create table if not exists rec_vaga_aprovacoes (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  rodada int not null default 1,
  ordem int not null,
  rotulo text not null,
  aprovador_tipo text not null check (aprovador_tipo in ('funcao','papel','pessoa')),
  aprovador_ref text not null,             -- ex.: 'rh' (papel) | 'aprovador_financeiro' (função) | id da pessoa
  status text not null default 'pendente', -- pendente | aprovada | rejeitada | ajustes | dispensada | cancelada
  decidido_por text,
  decidido_em timestamptz,
  justificativa text,
  prazo date,
  criado_em timestamptz not null default now()
);
create index if not exists rec_vaga_aprov_vaga_idx on rec_vaga_aprovacoes (vaga_id, rodada, ordem);
create index if not exists rec_vaga_aprov_pend_idx on rec_vaga_aprovacoes (status) where status = 'pendente';

-- Histórico (mudanças de status, edições, aprovações, publicações)
create table if not exists rec_vaga_eventos (
  id bigserial primary key,
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  em timestamptz not null default now(),
  colaborador_id text,
  tipo text not null,
  de_status text,
  para_status text,
  detalhes jsonb not null default '{}'::jsonb
);
create index if not exists rec_vaga_ev_idx on rec_vaga_eventos (vaga_id, em);

create table if not exists rec_vaga_comentarios (
  id uuid primary key default gen_random_uuid(),
  vaga_id uuid not null references rec_vagas(id) on delete cascade,
  autor_id text not null,
  texto text not null,
  criado_em timestamptz not null default now()
);

-- Imagem de capa da vaga (arq_arquivos); exibida no portal público quando a vaga está publicada
alter table rec_vagas add column if not exists imagem_arquivo_id uuid;

alter table rec_config enable row level security;
alter table rec_vagas enable row level security;
alter table rec_vaga_etapas enable row level security;
alter table rec_vaga_aprovacoes enable row level security;
alter table rec_vaga_eventos enable row level security;
alter table rec_vaga_comentarios enable row level security;

-- Acrescimos do modulo de vagas
alter table rec_vagas add column if not exists atualizado_por text;
create index if not exists rec_vaga_ev_tipo_idx on rec_vaga_eventos (tipo, em);
