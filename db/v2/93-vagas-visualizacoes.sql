-- 93 · Visualizações da página pública da vaga (contador agregado, sem dado do visitante).
-- Base do indicador de conversão (candidaturas ÷ visualizações). Contagem aproximada: inclui acessos internos e robôs.
alter table rec_vagas add column if not exists visualizacoes int not null default 0;
