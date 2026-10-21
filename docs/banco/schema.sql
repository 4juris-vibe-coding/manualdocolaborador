-- =====================================================================
-- 4JURIS Pessoas — schema PROPOSTO para PostgreSQL (ex.: Supabase)
-- ---------------------------------------------------------------------
-- Status: proposta, NÃO aplicada em nenhum banco. Espelha os tipos de
-- src/lib/types.ts e aproveita a modelagem do antigo sistema de RH
-- (gest-o_rh-master/supabase/migrations), removendo os conceitos de
-- vínculo CLT (CTPS, PIS, banco de horas, ponto, insalubridade, ASO,
-- dependentes, benefícios trabalhistas, período de experiência).
-- Convenções: uuid como PK, timestamptz para instantes, date para datas,
-- trigger de atualizado_em. Autorização via RLS (ver final do arquivo).
-- =====================================================================

create extension if not exists pgcrypto;
create extension if not exists citext;

create type papel as enum ('colaborador', 'gestor', 'rh', 'diretoria', 'admin');
create type status_parceria as enum ('integracao', 'ativo', 'pendente', 'encerrado');
create type regime as enum ('PJ', 'MEI', 'autonomo');
create type status_contrato as enum ('rascunho', 'vigente', 'em_renovacao', 'encerrado');
create type status_periodo as enum ('planejado', 'alinhado', 'cancelado');
create type tipo_jornada as enum ('integracao', 'encerramento');
create type responsavel_item as enum ('pessoa', 'rh', 'lideranca');

-- ---------- Estrutura ----------
create table unidades (
  id uuid primary key default gen_random_uuid(),
  nome text not null, endereco text, telefone text,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);

create table areas (
  id uuid primary key default gen_random_uuid(),
  nome text not null unique, descricao text not null default '',
  cor text not null default '#0032D2', icone text not null default 'Building2',
  unidade_id uuid references unidades(id) on delete set null,
  reembolso_apenas_lideranca boolean not null default false,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);

create table funcoes (
  id uuid primary key default gen_random_uuid(),
  area_id uuid not null references areas(id) on delete cascade,
  nome text not null, senioridade text not null default 'Pleno', descricao text
);

-- ---------- Pessoas (identidade vem do provedor de autenticação) ----------
create table pessoas (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique,                       -- auth.users.id (Supabase) ou sub do IdP
  nome text not null, nome_social text,
  email citext not null unique,
  telefone text, cidade text, uf char(2),
  nascimento date,                                -- opcional, apenas para celebrações
  papel papel not null default 'colaborador',
  area_id uuid not null references areas(id),
  funcao_id uuid references funcoes(id) on delete set null,
  unidade_id uuid references unidades(id) on delete set null,
  status status_parceria not null default 'integracao',
  inicio_parceria date not null,
  regime regime not null default 'PJ',
  cpf text check (cpf ~ '^[0-9]{11}$'),
  cnpj text check (cnpj ~ '^[0-9]{14}$'),
  razao_social text,
  -- pagamento (acesso restrito: própria pessoa e financeiro/RH)
  banco text, agencia text, conta text, pix_tipo text, pix_chave text,
  emergencia_nome text, emergencia_telefone text, emergencia_relacao text,
  -- privacidade
  mostrar_aniversario boolean not null default false,
  mostrar_marcos boolean not null default true,
  aparecer_em_destaques boolean not null default false,
  -- encerramento
  encerrada_em date, motivo_encerramento_id uuid, observacao_encerramento text,
  anonimizada_em timestamptz,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now(),
  constraint pj_exige_cnpj check (regime = 'autonomo' or (cnpj is not null and razao_social is not null)),
  constraint encerramento_coerente check ((status = 'encerrado') = (encerrada_em is not null))
);

create table area_liderancas (
  area_id uuid references areas(id) on delete cascade,
  pessoa_id uuid references pessoas(id) on delete cascade,
  primary key (area_id, pessoa_id)
);

create table motivos_encerramento (id uuid primary key default gen_random_uuid(), nome text not null unique, ativo boolean not null default true);
alter table pessoas add foreign key (motivo_encerramento_id) references motivos_encerramento(id);

-- ---------- Contratos e documentos ----------
create table contratos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete restrict,
  numero text not null, objeto text not null,
  modalidade text not null check (modalidade in ('mensal', 'por-projeto')),
  valor_referencia numeric(12,2) not null check (valor_referencia >= 0),
  inicio date not null, fim date check (fim is null or fim >= inicio),
  renovacao_automatica boolean not null default false,
  status status_contrato not null default 'vigente', observacoes text,
  atualizado_em timestamptz not null default now()
);

create table documentos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  nome text not null, tipo text not null,
  caminho_storage text not null,                  -- bucket PRIVADO; download por URL assinada de curta duração
  tamanho_bytes bigint, data date not null default current_date,
  validade date, confidencial boolean not null default true,
  enviado_por uuid references pessoas(id), criado_em timestamptz not null default now()
);

create table tipos_registro (id uuid primary key default gen_random_uuid(), nome text not null unique, ativo boolean not null default true);
create table registros_administrativos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  tipo_id uuid not null references tipos_registro(id),
  data date not null, descricao text not null,
  autor_id uuid not null references pessoas(id), criado_em timestamptz not null default now()
);

-- ---------- Financeiro PJ ----------
create table notas_fiscais (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id),
  competencia char(7) not null,                   -- 'YYYY-MM'
  valor numeric(12,2) not null, status text not null,
  prazo date not null, pagamento_previsto date, arquivo_storage text,
  enviada_em date, aprovada_em date, aprovada_por uuid references pessoas(id), paga_em date,
  unique (pessoa_id, competencia)
);
create table reembolsos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id),
  categoria text not null, descricao text not null, valor numeric(12,2) not null check (valor > 0),
  data date not null, status text not null default 'pendente', comprovante_storage text,
  aprovado_por uuid references pessoas(id), aprovado_em date, pago_em date,
  criado_em timestamptz not null default now(),
  constraint nao_aprova_o_proprio check (aprovado_por is null or aprovado_por <> pessoa_id)
);

-- ---------- Disponibilidade (descanso combinado; sem saldo/aprovação) ----------
create table periodos_indisponibilidade (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  inicio date not null, fim date not null check (fim >= inicio),
  mensagem_equipe text check (char_length(mensagem_equipe) <= 280),
  observacao_privada text,                        -- somente a pessoa e o RH (coluna protegida por view/política)
  contato_continuidade_id uuid references pessoas(id),
  plano_continuidade text,
  status status_periodo not null default 'planejado',
  alinhado_por uuid references pessoas(id), alinhado_em date,
  criado_em timestamptz not null default now(), atualizado_em timestamptz not null default now()
);

-- ---------- Comunicação e eventos ----------
create table comunicados (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, resumo text not null, corpo text not null, categoria text not null,
  autor_id uuid references pessoas(id), publicado_em date not null default current_date,
  fixado boolean not null default false, importante boolean not null default false,
  alvo text not null check (alvo in ('todos', 'setores', 'usuarios'))
);
create table comunicado_destinos (comunicado_id uuid references comunicados(id) on delete cascade, area_id uuid references areas(id), pessoa_id uuid references pessoas(id));
create table comunicado_leituras (comunicado_id uuid references comunicados(id) on delete cascade, pessoa_id uuid references pessoas(id) on delete cascade, lido_em timestamptz not null default now(), primary key (comunicado_id, pessoa_id));

create table eventos (
  id uuid primary key default gen_random_uuid(),
  titulo text not null, descricao text not null default '', categoria text not null,
  inicio timestamptz not null, fim timestamptz check (fim is null or fim > inicio),
  local text not null, link text, organizador_id uuid not null references pessoas(id),
  visibilidade text not null check (visibilidade in ('todos', 'setores')),
  status text not null default 'agendado' check (status in ('agendado', 'cancelado')),
  motivo_cancelamento text, capacidade int check (capacidade is null or capacidade > 0),
  criado_em timestamptz not null default now()
);
create table evento_areas (evento_id uuid references eventos(id) on delete cascade, area_id uuid references areas(id), primary key (evento_id, area_id));
create table evento_respostas (evento_id uuid references eventos(id) on delete cascade, pessoa_id uuid references pessoas(id) on delete cascade, resposta text not null check (resposta in ('vou', 'talvez')), primary key (evento_id, pessoa_id));
create table evento_presencas (evento_id uuid references eventos(id) on delete cascade, pessoa_id uuid references pessoas(id) on delete cascade, registrado_por uuid references pessoas(id), primary key (evento_id, pessoa_id));

create table mensagens_celebracao (
  id uuid primary key default gen_random_uuid(),
  de_id uuid not null references pessoas(id), para_id uuid not null references pessoas(id),
  ocasiao text not null, mensagem text not null check (char_length(mensagem) between 2 and 280),
  criado_em timestamptz not null default now(), unique (de_id, para_id, ocasiao), check (de_id <> para_id)
);

-- ---------- Gamificação (pontos = soma do ledger; nunca coluna editável) ----------
create table regras_pontuacao (
  id uuid primary key default gen_random_uuid(),
  acao text not null unique, nome text not null, descricao text not null,
  pontos int not null check (pontos between 0 and 1000), ativa boolean not null default true,
  limite_mensal int check (limite_mensal is null or limite_mensal >= 1)
);
create table lancamentos_pontos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references pessoas(id) on delete cascade,
  acao text not null, regra_id uuid references regras_pontuacao(id),
  referencia_id text not null, pontos int not null, descricao text not null,
  registrado_por uuid references pessoas(id), criado_em timestamptz not null default now(),
  unique (pessoa_id, acao, referencia_id)          -- idempotência: cada ação pontua uma vez
);
create view saldo_pontos as select pessoa_id, greatest(0, sum(pontos)) as pontos from lancamentos_pontos group by pessoa_id;

create table conquistas (id uuid primary key default gen_random_uuid(), nome text not null, descricao text not null, icone text, cor text, raridade text, criterio jsonb not null, ativa boolean not null default true);
create table conquistas_obtidas (pessoa_id uuid references pessoas(id) on delete cascade, conquista_id uuid references conquistas(id), obtida_em timestamptz not null default now(), primary key (pessoa_id, conquista_id));
create table desafios (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text not null, inicio date not null, fim date not null check (fim >= inicio), criterio_acao text not null, criterio_meta int not null check (criterio_meta >= 1), pontos_bonus int not null default 0, criado_por uuid references pessoas(id));
create table desafio_participantes (desafio_id uuid references desafios(id) on delete cascade, pessoa_id uuid references pessoas(id) on delete cascade, primary key (desafio_id, pessoa_id));
create table reconhecimentos (id uuid primary key default gen_random_uuid(), de_id uuid not null references pessoas(id), para_id uuid not null references pessoas(id), valor text not null, mensagem text not null check (char_length(mensagem) between 10 and 400), publico boolean not null default true, criado_em timestamptz not null default now(), check (de_id <> para_id));
create table iniciativas (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text not null default '', pontos int not null check (pontos >= 0), status text not null default 'aberta', voluntario_id uuid references pessoas(id), criada_por uuid not null references pessoas(id), prazo date, entrega text, confirmada_por uuid references pessoas(id), concluida_em date, criada_em timestamptz not null default now(), check (confirmada_por is null or confirmada_por <> voluntario_id));

-- ---------- Conteúdos e jornadas ----------
create table conteudos (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text not null default '', categoria text not null, duracao_min int not null default 0, modulos int not null default 1, recomendado boolean not null default false, link text);
create table conteudos_concluidos (pessoa_id uuid references pessoas(id) on delete cascade, conteudo_id uuid references conteudos(id) on delete cascade, concluido_em date not null default current_date, primary key (pessoa_id, conteudo_id));
create table checklist_modelos (id uuid primary key default gen_random_uuid(), nome text not null, tipo tipo_jornada not null);
create table checklist_modelo_itens (id uuid primary key default gen_random_uuid(), modelo_id uuid not null references checklist_modelos(id) on delete cascade, ordem int not null, titulo text not null, responsavel responsavel_item not null, prazo_dias int);
create table jornadas (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, modelo_id uuid references checklist_modelos(id), tipo tipo_jornada not null, iniciada_em date not null, concluida_em date);
-- itens copiados do modelo no início (snapshot), para mudanças no modelo não afetarem processos em andamento
create table jornada_itens (id uuid primary key default gen_random_uuid(), jornada_id uuid not null references jornadas(id) on delete cascade, ordem int not null, titulo text not null, responsavel responsavel_item not null, prazo_dias int, feito boolean not null default false, feito_em date, feito_por uuid references pessoas(id));
create unique index jornada_unica_em_andamento on jornadas (pessoa_id, tipo) where concluida_em is null;

create table objetivos (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text not null default '', area_id uuid not null references areas(id) on delete cascade, periodo char(7) not null, meta numeric not null check (meta > 0), atual numeric not null default 0, unidade_medida text not null, responsavel_id uuid references pessoas(id));

-- ---------- Pesquisas (anonimato por separação de tabelas) ----------
create table pesquisas (id uuid primary key default gen_random_uuid(), titulo text not null, descricao text not null default '', perguntas jsonb not null, inicio date not null, fim date not null, status text not null default 'rascunho', areas_alvo uuid[] not null default '{}', minimo_respostas int not null default 3 check (minimo_respostas >= 3), criada_por uuid references pessoas(id), criada_em timestamptz not null default now());
-- SEM pessoa_id. Apenas área e DATA (sem hora), para dificultar correlação temporal.
create table pesquisa_respostas (id uuid primary key default gen_random_uuid(), pesquisa_id uuid not null references pesquisas(id) on delete cascade, area_id uuid references areas(id), respostas jsonb not null, enviada_em date not null default current_date);
create table pesquisa_participacoes (pesquisa_id uuid references pesquisas(id) on delete cascade, pessoa_id uuid references pessoas(id) on delete cascade, primary key (pesquisa_id, pessoa_id));
-- Inserir resposta + participação numa única função SECURITY DEFINER; nenhum papel lê pesquisa_respostas diretamente:
-- resultados saem de uma função que agrega e aplica minimo_respostas (ver src/domain/pesquisas.ts).

-- ---------- Notificações, auditoria, configuração ----------
create table notificacoes (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, tipo text not null, titulo text not null, texto text not null, href text, lida boolean not null default false, criado_em timestamptz not null default now());
create table auditoria (id bigserial primary key, em timestamptz not null default now(), ator_id uuid references pessoas(id), acao text not null, entidade text not null, entidade_id text, resumo text not null);  -- nunca gravar conteúdo sensível
create table configuracoes (chave text primary key, valor jsonb not null, atualizado_em timestamptz not null default now()); -- 'disponibilidade', 'gamificacao', 'financeiro'

-- ---------- Módulos de RH (2ª etapa) ----------
alter table pessoas add column if not exists endereco jsonb, add column if not exists celular text, add column if not exists email_pessoal text,
  add column if not exists matricula text, add column if not exists responsavel_id uuid references pessoas(id), add column if not exists fuso_horario text,
  add column if not exists tamanho_camisa text, add column if not exists escolaridade text, add column if not exists curso text, add column if not exists codigo_externo text;
-- Dados sensíveis (LGPD art. 11) em tabela própria, só com consentimento; leitura direta proibida — apenas agregados com mínimo de 5.
create table pessoa_diversidade (pessoa_id uuid primary key references pessoas(id) on delete cascade, consentido_em timestamptz not null, genero text, raca_etnia text, pcd boolean, tipo_deficiencia text, estado_civil text);
create table perfis_comportamentais (pessoa_id uuid primary key references pessoas(id) on delete cascade, consentimento boolean not null check (consentimento), fonte text not null, disc jsonb not null, tracos jsonb not null, atualizado_em timestamptz not null default now());
alter table areas add column if not exists localizacao text, add column if not exists telefone text, add column if not exists ramal text, add column if not exists email text, add column if not exists orcamento_mensal numeric(12,2);
alter table funcoes add column if not exists codigo_cbo text, add column if not exists funcao_superior_id uuid references funcoes(id), add column if not exists atividades text,
  add column if not exists habilidades text[] not null default '{}', add column if not exists requisitos text[] not null default '{}', add column if not exists responsaveis_ids uuid[] not null default '{}',
  add column if not exists faixa_min numeric(12,2), add column if not exists faixa_max numeric(12,2), add column if not exists faixa_visivel boolean not null default false, add column if not exists perfil_ideal jsonb;
create table historico_funcao (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, em date not null, por_id uuid references pessoas(id), funcao_anterior_id uuid, funcao_nova_id uuid, valor_anterior numeric(12,2), valor_novo numeric(12,2));
create table dependentes (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, nome text not null, parentesco text not null, nascimento date, cpf text);
create table exigencias (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, tipo text not null, descricao text not null, data date not null, validade date check (validade is null or validade >= data), situacao text not null, emissor text, registro text, observacoes text, documento_id uuid references documentos(id) on delete set null, criado_por uuid references pessoas(id));
alter table vantagens add column if not exists tipo text, add column if not exists fornecedor text, add column if not exists valor numeric(12,2), add column if not exists aplicado_como text,
  add column if not exists periodicidade text, add column if not exists coparticipacao numeric(12,2), add column if not exists opcao_coparticipacao text, add column if not exists permite_dependentes boolean default false, add column if not exists ativo boolean default true;
create table beneficiarios (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, beneficio_id uuid not null, desde date not null, unique (pessoa_id, beneficio_id));
create table beneficiario_dependentes (beneficiario_id uuid references beneficiarios(id) on delete cascade, dependente_id uuid references dependentes(id) on delete cascade, primary key (beneficiario_id, dependente_id));
create table grupos_competencia (id uuid primary key default gen_random_uuid(), nome text not null, categoria_9box text not null default 'nenhuma', ativo boolean not null default true);
create table competencias (id uuid primary key default gen_random_uuid(), tipo text not null, grupo_id uuid not null references grupos_competencia(id), nome text not null, descricao text, peso smallint not null default 1 check (peso between 1 and 100), ativo boolean not null default true);
create table competencia_funcoes (competencia_id uuid references competencias(id) on delete cascade, funcao_id uuid references funcoes(id) on delete cascade, primary key (competencia_id, funcao_id));
create table ciclos_avaliativos (id uuid primary key default gen_random_uuid(), nome text not null, descricao text, abertura date not null, encerramento date not null check (encerramento >= abertura), niveis_escala smallint not null check (niveis_escala in (4,5)), rotulo_escala text not null,
  comentario_competencia_mostrar boolean not null, comentario_competencia_obrigatorio boolean not null, comentario_geral_obrigatorio boolean not null, tipo_relacao text not null, autoavaliacao boolean not null,
  iniciados_ate date, regimes regime[] not null default '{}', nivel_estrutura text, opcao_estrutura_id uuid, status text not null default 'rascunho', etapa smallint not null default 1, criado_em timestamptz not null default now());
create table ciclo_participantes (id uuid primary key default gen_random_uuid(), ciclo_id uuid not null references ciclos_avaliativos(id) on delete cascade, avaliado_id uuid not null references pessoas(id), avaliador_id uuid not null references pessoas(id), unique (ciclo_id, avaliado_id, avaliador_id));
-- Só o avaliador grava; o avaliado só lê agregados do próprio resultado após o encerramento.
create table avaliacao_respostas (id uuid primary key default gen_random_uuid(), participante_id uuid not null unique references ciclo_participantes(id) on delete cascade, notas jsonb not null, comentarios jsonb not null default '{}', comentario_geral text, respondida_em date not null);
create table avaliacoes_inicio_parceria (id uuid primary key default gen_random_uuid(), avaliado_id uuid not null references pessoas(id) on delete cascade, avaliador_id uuid references pessoas(id), funcao_id uuid, area_id uuid, unidade_id uuid,
  marco_dias smallint not null, data_referencia date not null, expira_em date not null, status text not null default 'pendente', notas jsonb, nota smallint, comentario text, continuidade text, respondida_em date, unique (avaliado_id, marco_dias));
-- A geração diária (equivalente ao cron do sistema de RH) deve rodar no servidor com src/domain/avaliacoes.ts → gerarAvaliacoesInicio.
create table classificacoes_grupo (pessoa_id uuid primary key references pessoas(id) on delete cascade, grupo text not null, por_id uuid references pessoas(id), em date not null);
create table feedbacks (id uuid primary key default gen_random_uuid(), pessoa_id uuid not null references pessoas(id) on delete cascade, data date not null, classificacao text not null, comentario text not null, autor_id uuid not null references pessoas(id), visivel_para_pessoa boolean not null default true, criado_em timestamptz not null default now(), check (autor_id <> pessoa_id));

-- ---------- Apresentações e caixa de sugestões ----------
create table apresentacoes (id uuid primary key default gen_random_uuid(), titulo text not null, modelo_id text not null, tema jsonb not null, slides jsonb not null, criada_por uuid not null references pessoas(id), compartilhada boolean not null default false, criada_em timestamptz not null default now(), atualizada_em timestamptz not null default now());
-- ANÔNIMA: sem pessoa_id. autor_chave = HMAC(segredo_do_servidor, pessoa_id) calculado no servidor; segredo fora do banco.
create table sugestoes (id uuid primary key default gen_random_uuid(), titulo text not null check (char_length(titulo) between 5 and 100), descricao text not null check (char_length(descricao) between 10 and 800), categoria text not null,
  status text not null default 'aguardando' check (status in ('aguardando','aprovada','recusada')), autor_chave text not null, resposta text, respondida_em date, moderador_id uuid references pessoas(id), criada_em date not null default current_date, editada_em date,
  check (status <> 'recusada' or char_length(coalesce(resposta,'')) >= 10));
create table sugestao_apoios (sugestao_id uuid references sugestoes(id) on delete cascade, apoio_chave text not null, primary key (sugestao_id, apoio_chave));
-- RLS: select das sugestões liberado a autenticados MENOS a coluna autor_chave (use view); update/delete só pelo dono da chave e enquanto 'aguardando'; mudança de status só rh/admin.

-- =====================================================================
-- RLS (esboço) — replicar src/domain/permissions.ts e src/domain/visibilidade.ts
-- =====================================================================
-- create function eu() returns uuid ... (pessoa do auth.uid())
-- create function tem_papel(p papel[]) returns boolean ...
-- create function lidera_area(a uuid) returns boolean ...
--
-- pessoas:   select dos campos públicos (nome, área, função) para autenticados via VIEW pessoas_publico;
--            linha completa: a própria pessoa e papéis rh/admin. Liderança NÃO lê pagamento/contrato.
-- contratos, documentos, registros_administrativos: própria pessoa (exceto registros) e rh/admin.
-- periodos_indisponibilidade: própria pessoa, rh/admin, liderança da área e colegas da mesma área
--            (colegas via VIEW sem observacao_privada).
-- reembolsos: própria pessoa; update de status por rh/admin ou liderança da área (nunca o próprio).
-- lancamentos_pontos: insert SOMENTE por funções do servidor que aplicam as regras.
-- pesquisa_respostas: sem select direto para nenhum papel.
