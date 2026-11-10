-- 101 · Ciclo de Desenvolvimento e Avaliação de Desempenho (dsv_*) — aditivo e idempotente
-- Acompanhamento inicial (30/60/90 dias) e AVD semestral, com autoavaliação, avaliação da liderança,
-- feedback da equipe sobre a liderança (confidencial), devolutiva e PDI.
-- Pessoas, áreas e funções continuam nas coleções legadas (app_colaboradores/app_setores/app_cargos);
-- aqui ficam só os IDs (texto). Regras em src/domain/v2/desenvolvimento.ts; acesso em api/_v2/modulos/desenvolvimento.ts.

-- Função adicional "Gestão de desenvolvimento" (autorização expressa para administrar ciclos e ler o feedback confidencial).
alter table acl_funcoes drop constraint if exists acl_funcoes_funcao_check;
alter table acl_funcoes add constraint acl_funcoes_funcao_check
  check (funcao in ('recrutador','analista_rh','resp_pesquisas','aprovador_financeiro','analista_financeiro','autorizador_pagamentos','gestor_desenvolvimento'));

-- Configuração por chave ('geral': prazos, escala, mínimo de respostas…). Ausente = padrão do código.
create table if not exists dsv_config (
  chave text primary key,
  valor jsonb not null,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

-- Formulários configuráveis. Cada edição do RH cria uma VERSÃO nova; ciclos abertos guardam o retrato da versão usada.
-- Sem linha para uma chave, vale o modelo padrão do código (versão 1).
create table if not exists dsv_modelos (
  id uuid primary key default gen_random_uuid(),
  chave text not null check (chave in ('acomp_colaborador','acomp_lideranca','avd_auto_membro','avd_lider_membro','avd_auto_lideranca','avd_superior_lideranca','avd_equipe_lideranca')),
  versao int not null check (versao >= 1),
  titulo text not null,
  descricao text,
  escala text not null default 'avd' check (escala in ('avd','percepcao')),
  criterios jsonb not null default '[]'::jsonb,   -- [{id,nome,descricao,dimensao,peso}]
  perguntas jsonb not null default '[]'::jsonb,   -- [{id,texto,obrigatoria,ajuda}]
  criado_por text,
  criado_em timestamptz not null default now(),
  unique (chave, versao)
);

-- Um ciclo por (pessoa, período de parceria, marco). A chave única impede ciclos duplicados.
create table if not exists dsv_ciclos (
  id uuid primary key default gen_random_uuid(),
  colaborador_id text not null,
  vinculo_id text not null,                 -- Vinculo.id (período de parceria em aberto na abertura)
  data_base date not null,                  -- início do vínculo usado no cálculo (data de admissão)
  tipo text not null check (tipo in ('acompanhamento','avd')),
  marco text not null,                      -- '30d','60d','90d','6m','12m','18m',…
  numero int not null,                      -- dias (30/60/90) ou nº da AVD (1, 2, 3…)
  data_prevista date not null,
  prazo date not null,                      -- prazo da ETAPA atual
  etapa text not null default 'coleta' check (etapa in ('coleta','consolidacao','devolutiva','pdi','encerramento','concluida','cancelada','suspensa')),
  etapa_antes_suspensao text,
  lideranca boolean not null default false, -- exercia liderança na abertura (critérios de liderança)
  avaliador_id text,                        -- liderança responsável pelas próximas etapas (atualizada na troca de liderança)
  avaliador_manual boolean not null default false, -- designado pelo RH: a rotina não substitui pela liderança do cadastro
  setor_id text,                            -- retrato na abertura (histórico)
  cargo_id text,
  coleta_concluida_em timestamptz,
  concluido_em timestamptz,
  concluido_por text,
  cancelado_em timestamptz,
  cancelado_por text,
  motivo text,                              -- cancelamento/suspensão/reabertura (texto do RH)
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (colaborador_id, vinculo_id, marco)
);
create index if not exists dsv_ciclos_colab_idx on dsv_ciclos (colaborador_id, data_prevista);
create index if not exists dsv_ciclos_avaliador_idx on dsv_ciclos (avaliador_id);
create index if not exists dsv_ciclos_etapa_idx on dsv_ciclos (etapa, prazo);

-- Formulário de cada participante. Respostas enviadas são IMUTÁVEIS (só o próprio respondente envia; ninguém altera).
-- No feedback da equipe sobre a liderança, as respostas NÃO ficam aqui: vão para dsv_respostas_equipe, sem ligação com quem respondeu.
create table if not exists dsv_formularios (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references dsv_ciclos(id) on delete cascade,
  tipo text not null check (tipo in ('acomp_colaborador','acomp_lideranca','autoavaliacao','lider_avalia','equipe_avalia_lider')),
  respondente_id text not null,
  modelo_chave text not null,
  modelo_versao int not null,
  retrato jsonb not null,                   -- modelo no momento da abertura
  status text not null default 'pendente' check (status in ('pendente','rascunho','enviado','dispensado','expirado')),
  rascunho jsonb,                           -- só do próprio respondente; apagado no envio
  respostas jsonb,                          -- null no feedback da equipe
  nota numeric(3,1),                        -- média ponderada (indicador de apoio); null no feedback da equipe
  prazo date not null,
  enviado_em timestamptz,
  motivo text,                              -- dispensa/expiração/troca de liderança
  dispensado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  unique (ciclo_id, tipo, respondente_id)
);
create index if not exists dsv_form_resp_idx on dsv_formularios (respondente_id, status);
create index if not exists dsv_form_ciclo_idx on dsv_formularios (ciclo_id);

-- Respostas do feedback da equipe sobre a liderança: sem respondente, sem convite, sem hora (só a data).
create table if not exists dsv_respostas_equipe (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references dsv_ciclos(id) on delete cascade,
  modelo_versao int not null,
  respostas jsonb not null,
  data date not null default current_date
);
create index if not exists dsv_resp_equipe_idx on dsv_respostas_equipe (ciclo_id);

-- Síntese do RH sobre o feedback da equipe (o que a liderança recebe, além das médias).
create table if not exists dsv_sinteses (
  ciclo_id uuid primary key references dsv_ciclos(id) on delete cascade,
  texto text not null default '',
  liberada_em timestamptz,
  liberada_por text,
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

-- Devolutiva (AVD) ou registro do acompanhamento (30/60/90).
create table if not exists dsv_devolutivas (
  ciclo_id uuid primary key references dsv_ciclos(id) on delete cascade,
  realizada_em date,
  rh_acompanhou boolean not null default false,
  pontos_fortes text,                       -- AVD: pontos fortes · acompanhamento: pontos positivos
  a_desenvolver text,                       -- competências a desenvolver
  dificuldades text,                        -- acompanhamento: dificuldades identificadas
  orientacoes text,                         -- acompanhamento: orientações fornecidas
  feedback text,                            -- feedback da liderança
  percepcao_colaborador text,               -- escrita pelo(a) próprio(a) colaborador(a)
  percepcao_em timestamptz,
  registrada_por text,
  registrada_em timestamptz,
  atualizado_em timestamptz not null default now()
);

-- Plano de Desenvolvimento Individual (um por AVD).
create table if not exists dsv_pdis (
  ciclo_id uuid primary key references dsv_ciclos(id) on delete cascade,
  colaborador_id text not null,
  metas text,
  treinamentos text,
  indicadores text,
  revisao_em date,
  registrado_por text,
  registrado_em timestamptz,
  atualizado_em timestamptz not null default now()
);
create index if not exists dsv_pdis_colab_idx on dsv_pdis (colaborador_id);

-- Ações combinadas (acompanhamento) e ações do PDI. Ficam ligadas à pessoa: a avaliação seguinte mostra o que foi concluído.
create table if not exists dsv_acoes (
  id uuid primary key default gen_random_uuid(),
  ciclo_id uuid not null references dsv_ciclos(id) on delete cascade,
  colaborador_id text not null,
  origem text not null check (origem in ('acompanhamento','pdi')),
  competencia text,
  descricao text not null,
  responsavel text not null default 'colaborador' check (responsavel in ('colaborador','lideranca','ambos','rh')),
  prazo date,
  indicador text,
  status text not null default 'planejada' check (status in ('planejada','em_andamento','concluida','cancelada')),
  resultado text,
  concluida_em date,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);
create index if not exists dsv_acoes_colab_idx on dsv_acoes (colaborador_id, status);
create index if not exists dsv_acoes_ciclo_idx on dsv_acoes (ciclo_id);

alter table dsv_config enable row level security;
alter table dsv_modelos enable row level security;
alter table dsv_ciclos enable row level security;
alter table dsv_formularios enable row level security;
alter table dsv_respostas_equipe enable row level security;
alter table dsv_sinteses enable row level security;
alter table dsv_devolutivas enable row level security;
alter table dsv_pdis enable row level security;
alter table dsv_acoes enable row level security;
