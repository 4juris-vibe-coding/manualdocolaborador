-- 70 · Forma de contratação explícita na vaga (PJ, MEI, autônomo, CLT, estágio, temporário).
-- Vagas existentes ficam "não informado" (não se presume o regime).
alter table rec_vagas add column if not exists regime_contratacao text not null default 'nao_informado';
alter table rec_vagas drop constraint if exists rec_vagas_regime_contratacao_check;
alter table rec_vagas add constraint rec_vagas_regime_contratacao_check
  check (regime_contratacao in ('pj','mei','autonomo','clt','estagio','temporario','nao_informado'));
