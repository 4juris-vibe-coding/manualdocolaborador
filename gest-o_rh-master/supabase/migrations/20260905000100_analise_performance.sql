-- Classificação de performance do colaborador (Desenv. e Performance >
-- Análise de Performance) — cada colaborador pode estar categorizado
-- como baixa ou alta performance, ou ainda não categorizado (null).
create type classificacao_performance_colaborador as enum ('baixa', 'alta');

alter table colaboradores
  add column classificacao_performance classificacao_performance_colaborador;
