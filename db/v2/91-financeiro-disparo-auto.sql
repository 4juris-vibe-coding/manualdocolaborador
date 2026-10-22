-- =====================================================================
-- 91 · Disparos automáticos de cobrança de nota fiscal.
--      Regra única (linha id = true): em quais dias, relativos ao dia
--      limite de envio da NF, o sistema cobra quem ainda não enviou.
--      `chave` em fin_disparos impede que o mesmo disparo automático
--      rode duas vezes (agendador + reserva do painel). ADITIVO.
--      A entrega é só dentro do sistema (notificação no portal).
-- =====================================================================

create table if not exists fin_disparo_auto (
  id boolean primary key default true check (id),
  ativo boolean not null default true,
  dias int[] not null default '{-5,-1,0,3}',            -- dias em relação ao limite (negativo = antes; 0 = no dia)
  incluir_devolvidas boolean not null default true,     -- cobra também quem teve a nota devolvida e não reenviou
  assunto text not null default 'Envie sua nota fiscal de {{competencia}}',
  mensagem text not null default E'Olá, {{nome}}!\n\nAinda não recebemos a sua nota fiscal de {{competencia}} ({{contratos}}). O prazo de envio é {{prazo}}.\n\nEnvie em Notas fiscais, aqui no portal.\n\nQualquer dúvida, fale com o financeiro.',
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into fin_disparo_auto (id) values (true) on conflict do nothing;

alter table fin_disparos add column if not exists chave text;
alter table fin_disparos add column if not exists automatico boolean not null default false;
create unique index if not exists fin_disp_chave_uk on fin_disparos (chave) where chave is not null;

alter table fin_disparo_auto enable row level security;
