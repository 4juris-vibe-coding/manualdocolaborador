-- 99 · Linha do tempo do candidato (aditivo, idempotente)
-- Nome da etapa mostrado ao candidato. Vazio = rótulo genérico pelo tipo (o nome interno nunca é exibido).
alter table rec_vaga_etapas add column if not exists nome_publico text;
