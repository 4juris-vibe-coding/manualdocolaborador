-- Extensões e enums usados em todo o schema do 4Juris RH.

create extension if not exists pgcrypto;   -- gen_random_uuid()
create extension if not exists moddatetime; -- trigger de atualizado_em automático

create type papel_usuario as enum ('admin_rh', 'gestor');

create type genero_colaborador as enum (
  'feminino',
  'masculino',
  'outro',
  'prefiro_nao_informar'
);

create type status_colaborador as enum ('ativo', 'inativo');

create type status_ferias as enum (
  'pendente',
  'aprovado',
  'rejeitado',
  'em_gozo',
  'concluido'
);

create type classificacao_registro as enum ('positivo', 'negativo', 'neutro');

create type tipo_checklist as enum ('admissao', 'demissao');

create type senioridade_cargo as enum (
  'estagiario',
  'junior',
  'pleno',
  'senior',
  'especialista',
  'lideranca'
);
