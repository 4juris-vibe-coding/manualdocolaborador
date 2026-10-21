-- "Busca de Perfil" de verdade usa 4 categorias (Executor/Comunicador/
-- Planejador/Analista — o mesmo DISC que já aparecia como filtro colorido
-- em Cargos), não os 24 traços do perfil comportamental de Engenharia de
-- Cargo. São conceitos relacionados mas distintos no Sólides, então viram
-- colunas próprias em vez de reaproveitar cargo_tracos_comportamentais.
alter table colaboradores
  add column perfil_executor smallint check (perfil_executor between 0 and 100),
  add column perfil_comunicador smallint check (perfil_comunicador between 0 and 100),
  add column perfil_planejador smallint check (perfil_planejador between 0 and 100),
  add column perfil_analista smallint check (perfil_analista between 0 and 100);

comment on column colaboradores.perfil_executor is
  'Perfil comportamental DISC (0-100) — usado na Busca de Perfil "Personalizar perfis".';
