-- 80 · Texto "Sobre a empresa" e endereço completo do local de trabalho, exibidos na página pública da vaga.
alter table rec_vagas add column if not exists sobre_empresa text;
alter table rec_vagas add column if not exists endereco text;
