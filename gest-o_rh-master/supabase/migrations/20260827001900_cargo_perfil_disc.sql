-- Categorias DISC (Executor/Comunicador/Planejador/Analista) do perfil
-- comportamental ideal do cargo — mesma ideia já usada em colaboradores
-- (20260819001800_perfil_disc.sql), agora espelhada em cargos: alimenta a
-- coluna "Perfil" e o painel de FILTROS da listagem de Cargos.
alter table cargos
  add column perfil_executor smallint check (perfil_executor between 0 and 100),
  add column perfil_comunicador smallint check (perfil_comunicador between 0 and 100),
  add column perfil_planejador smallint check (perfil_planejador between 0 and 100),
  add column perfil_analista smallint check (perfil_analista between 0 and 100);
