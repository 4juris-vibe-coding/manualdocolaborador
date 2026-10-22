-- =====================================================================
-- 4JURIS Pessoas — schema APLICADO no Supabase (PostgreSQL)
-- Idempotente: pode ser executado várias vezes (npm run db:setup).
--
-- Modelo: uma tabela por coleção do app (app_<coleção>), guardando cada
-- registro como JSONB — espelha 1:1 as coleções de src/lib/types.ts (DB).
-- Acesso SOMENTE pelo servidor (api/), com a conexão DATABASE_URL.
-- RLS ligado e sem políticas: as chaves anon/authenticated do Supabase
-- não leem nem escrevem nada diretamente.
-- (docs/banco/schema.sql continua sendo a proposta normalizada futura.)
-- =====================================================================

create table if not exists usuarios (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  senha_hash text not null,
  colaborador_id text not null,
  papel text not null default 'admin',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  ultimo_acesso timestamptz
);
create unique index if not exists usuarios_email_uk on usuarios (lower(email));
alter table usuarios enable row level security;

create table if not exists redefinicoes_senha (
  token_hash text primary key,
  usuario_id uuid not null references usuarios(id) on delete cascade,
  expira_em timestamptz not null,
  usado_em timestamptz,
  criado_em timestamptz not null default now()
);
alter table redefinicoes_senha enable row level security;

-- Cadastro por link: a pessoa preenche nome, e-mail e senha; o acesso só vale depois da aprovação (Usuários & acessos).
create table if not exists convites_cadastro (
  token text primary key,
  criado_por text not null,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
alter table convites_cadastro enable row level security;

create table if not exists solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  convite_token text,
  colaborador_id text,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por text
);
create unique index if not exists solicitacoes_pendente_email_uk on solicitacoes_acesso (lower(email)) where status = 'pendente';
alter table solicitacoes_acesso enable row level security;

do $$
declare c text;
begin
  foreach c in array array[
    'colaboradores','setores','unidades','cargos','contratos','documentos','reembolsos','notas','periodos',
    'comunicados','eventos','beneficios','treinamentos','progressoConteudos','badges','conquistas','regras',
    'lancamentos','desafios','reconhecimentos','iniciativas','checklists','processos','motivosEncerramento',
    'tiposRegistro','registros','objetivos','pesquisas','respostas','participacoes','parabens','notificacoes',
    'auditoria','historicoFuncao','dependentes','exigencias','beneficiarios','gruposCompetencia','competencias',
    'ciclos','participantesCiclo','respostasAvaliacao','avaliacoesInicio','classificacoesGrupo','feedbacks',
    'apresentacoes','sugestoes'
  ] loop
    execute format('create table if not exists %I (
      ord int primary key,
      id text,
      dados jsonb not null,
      atualizado_em timestamptz not null default now()
    )', 'app_' || lower(c));
    execute format('create index if not exists %I on %I (id)', 'app_' || lower(c) || '_id_idx', 'app_' || lower(c));
    execute format('alter table %I enable row level security', 'app_' || lower(c));
  end loop;
end $$;

-- Configurações da plataforma (uma linha por seção: disponibilidade, gamificacao, financeiro, geral, cultura, avaliacaoInicio)
create table if not exists app_config (
  chave text primary key,
  dados jsonb not null,
  atualizado_em timestamptz not null default now()
);
alter table app_config enable row level security;

-- Marca de inicialização (impede reinserir o conteúdo padrão depois de apagado)
create table if not exists app_meta (
  chave text primary key,
  valor jsonb not null
);
alter table app_meta enable row level security;
