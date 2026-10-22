-- 95 · Foto de perfil das pessoas (recortada no navegador, até 512 KB). Fora das coleções legadas para não pesar
-- o carregamento do estado: a interface busca só o mapa de versões e cada imagem por rota autenticada.
create table if not exists pes_fotos (
  colaborador_id text primary key,
  mime text not null,
  dados bytea not null,
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
alter table pes_fotos enable row level security;
