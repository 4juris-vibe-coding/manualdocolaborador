-- 100 · Automações do recrutamento e retenção LGPD (aditivo, idempotente)
-- ATENÇÃO à ordem: os carregadores ordenam os arquivos pelo NÚMERO do prefixo (100 vem depois de 99).

-- E-mail automático ao candidato quando a candidatura entra na etapa (usa o modelo "atualizacao_etapa").
alter table rec_etapa_config add column if not exists avisar_candidato boolean not null default false;

-- Retenção: marca do candidato anonimizado (já criada em 20-ats.sql; repetida aqui por segurança, sem efeito se existir).
alter table rec_candidatos add column if not exists anonimizado_em timestamptz;
create index if not exists rec_cand_candidato_idx on rec_candidaturas (candidato_id, status);

-- Relatório de acessos a dados sensíveis (filtro por ação e período).
create index if not exists aud_eventos_acao_em_idx on aud_eventos (acao, em desc);
create index if not exists aud_eventos_colab_em_idx on aud_eventos (colaborador_id, em desc);
