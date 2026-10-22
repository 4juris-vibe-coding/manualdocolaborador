-- 94 · Cor das colunas do kanban de candidatos (etapas da vaga). Aditiva: etapas existentes ficam sem cor (cinza).
alter table rec_vaga_etapas add column if not exists cor text;
