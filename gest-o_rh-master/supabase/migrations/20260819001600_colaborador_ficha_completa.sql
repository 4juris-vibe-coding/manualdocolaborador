-- Expansão grande do cadastro de colaborador, pra bater com o formulário
-- completo do Sólides (a cliente mandou os prints de "Novo Colaborador"
-- inteiro). Novos enums de apoio primeiro, depois as colunas por seção
-- do formulário (Dados pessoais, Endereço, Contatos, Dados contratuais,
-- Documentos, Fuso horário, Dados adicionais).

create type sexo_colaborador as enum ('masculino', 'feminino');

create type raca_etnia_colaborador as enum (
  'branca', 'preta', 'parda', 'amarela', 'indigena', 'nao_informado'
);

create type estado_civil_colaborador as enum (
  'solteiro', 'casado', 'divorciado', 'viuvo', 'uniao_estavel'
);

create type escolaridade_colaborador as enum (
  'fundamental_incompleto', 'fundamental_completo',
  'medio_incompleto', 'medio_completo',
  'superior_incompleto', 'superior_completo',
  'pos_graduacao', 'mestrado', 'doutorado'
);

alter table colaboradores
  -- Dados pessoais
  add column nome_social text,
  add column sexo sexo_colaborador,
  add column saudacao text,
  add column raca_etnia raca_etnia_colaborador,
  add column estado_civil estado_civil_colaborador,
  add column escolaridade escolaridade_colaborador,
  add column curso text,
  add column pessoa_com_deficiencia boolean not null default false,
  add column tipo_deficiencia text,
  add column nacionalidade text default 'Brasileira',
  add column naturalidade text,
  add column nome_pai text,
  add column nome_mae text,
  -- Endereço
  add column endereco_pais text default 'Brasil',
  -- Contatos (mantém "telefone" já existente como o campo principal)
  add column celular text,
  add column telefone_emergencia text,
  add column email_pessoal text,
  add column email_corporativo text,
  -- Dados contratuais
  add column turno text,
  add column moeda text not null default 'BRL',
  add column periodo_experiencia_dias smallint,
  add column matricula text,
  add column superior_direto_id uuid references colaboradores(id) on delete set null,
  add column grau_hierarquico text,
  add column data_contrato date,
  add column duracao_contrato text,
  add column vencimento_contrato date,
  add column codigo_externo text,
  add column duplo_vinculo boolean not null default false,
  add column data_inicio_cargo date,
  add column inicio_vigencia date,
  add column periculosidade boolean not null default false,
  add column insalubridade boolean not null default false,
  add column percentual_insalubridade numeric(4, 1),
  add column permite_bater_ponto boolean not null default false,
  -- Documentos
  add column estrangeiro boolean not null default false,
  add column rg_data_expedicao date,
  add column rg_orgao_expedidor text,
  add column matricula_esocial text,
  add column cnh text,
  add column reservista text,
  add column titulo_eleitor text,
  add column zona_eleitoral text,
  add column secao_eleitoral text,
  -- Fuso horário
  add column fuso_horario text not null default 'America/Sao_Paulo',
  -- Dados adicionais
  add column quantidade_filhos smallint,
  add column tamanho_camisa text;

comment on column colaboradores.periodo_experiencia_dias is
  'Override do período de experiência em dias corridos. Nulo = usa o padrão de 90 dias (lib/admissao-calculo.ts).';
comment on column colaboradores.superior_direto_id is
  'Quem esse colaborador reporta diretamente — pessoa, não só o departamento (diferente de departamento_gestores).';

create index on colaboradores (superior_direto_id);
