-- Remove o módulo de Férias por completo, a pedido do cliente (não vai ser
-- usado no sistema interno). `cascade` derruba junto os índices, o
-- trigger de atualizado_em e as policies de RLS da tabela.
drop table if exists ferias cascade;
drop type if exists status_ferias;
