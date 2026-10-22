-- =====================================================================
-- 60 · Gestão de prestadores PJ: fornecedores, contratos, documentos,
--      notas fiscais de serviço, contas a pagar, retenções e pagamentos.
-- Idempotente e ADITIVO. As coleções legadas (app_contratos,
-- app_documentos, app_notas) NÃO são apagadas: os dados são copiados
-- para cá (uma vez, por id) e passam a ser mantidos pelo servidor.
-- Não há integração bancária, fiscal (prefeitura/SEFAZ) nem de
-- assinatura: pagamentos são REGISTROS MANUAIS com comprovante.
-- =====================================================================

-- Funções adicionais do financeiro
alter table acl_funcoes drop constraint if exists acl_funcoes_funcao_check;
alter table acl_funcoes add constraint acl_funcoes_funcao_check
  check (funcao in ('recrutador','analista_rh','resp_pesquisas','aprovador_financeiro','analista_financeiro','autorizador_pagamentos'));

-- Configuração (linha única)
create table if not exists fin_config (
  id boolean primary key default true check (id),
  exigir_segregacao boolean not null default true,     -- quem aprova o serviço não autoriza o pagamento; quem registra não concilia
  dias_alerta_contrato int not null default 45 check (dias_alerta_contrato between 1 and 365),
  dias_alerta_pagamento int not null default 3 check (dias_alerta_pagamento between 0 and 60),
  dias_alerta_documento int not null default 30 check (dias_alerta_documento between 1 and 365),
  dias_alerta_aprovacao int not null default 3 check (dias_alerta_aprovacao between 1 and 60),
  dia_limite_envio_nf int not null default 22 check (dia_limite_envio_nf between 1 and 28),
  prazo_pagamento_padrao_dias int not null default 10 check (prazo_pagamento_padrao_dias between 0 and 120),
  atualizado_em timestamptz not null default now(),
  atualizado_por text
);
insert into fin_config (id) values (true) on conflict do nothing;

create table if not exists fin_centros_custo (
  id uuid primary key default gen_random_uuid(),
  codigo text not null,
  nome text not null,
  setor_id text,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);
create unique index if not exists fin_cc_codigo_uk on fin_centros_custo (lower(codigo));

-- Empresa (ou pessoa física) contratada. A pessoa que presta o serviço e usa o portal é o "representante".
create table if not exists fin_fornecedores (
  id text primary key default ('forn-' || replace(gen_random_uuid()::text, '-', '')),
  tipo text not null default 'pj' check (tipo in ('pj','mei','pf')),
  razao_social text not null,
  nome_fantasia text,
  documento text,                                     -- CNPJ (pj/mei) ou CPF (pf), só dígitos
  inscricao_municipal text,
  regime_tributario text not null default 'nao_informado'
    check (regime_tributario in ('mei','simples_nacional','lucro_presumido','lucro_real','pessoa_fisica','nao_informado')),
  municipio text,
  uf text,
  email text,
  telefone text,
  representante_id text,                              -- app_colaboradores
  -- Dados de pagamento da empresa. Vazios = usa os do perfil da pessoa representante.
  banco text, agencia text, conta text, pix_tipo text, pix_chave text,
  status text not null default 'ativo' check (status in ('ativo','suspenso','inativo')),
  observacoes text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1
);
create unique index if not exists fin_forn_doc_uk on fin_fornecedores (documento) where documento is not null and documento <> '';
create index if not exists fin_forn_rep_idx on fin_fornecedores (representante_id);

create table if not exists fin_contratos (
  id text primary key default ('ctr-' || replace(gen_random_uuid()::text, '-', '')),
  numero text not null,
  fornecedor_id text not null references fin_fornecedores(id),
  prestador_id text,                                  -- pessoa que executa os serviços (app_colaboradores)
  gestor_id text,                                     -- responsável interno: relacionamento e aceite dos serviços
  setor_id text,
  centro_custo_id uuid references fin_centros_custo(id),
  objeto text not null,
  escopo text,
  modelo_remuneracao text not null default 'mensal_fixo' check (modelo_remuneracao in ('mensal_fixo','por_projeto','por_hora','por_entrega')),
  valor numeric(14,2) not null check (valor >= 0),    -- mensal (mensal_fixo), global (por_projeto) ou unitário (hora/entrega)
  periodicidade_faturamento text not null default 'mensal' check (periodicidade_faturamento in ('mensal','quinzenal','por_entrega','unica')),
  prazo_pagamento_dias int check (prazo_pagamento_dias between 0 and 120),  -- dias após o aceite da NF
  tipo_prazo text not null default 'determinado' check (tipo_prazo in ('determinado','indeterminado')),
  data_assinatura date,
  inicio date not null,
  fim date,
  renovacao text not null default 'manual' check (renovacao in ('automatica','manual','nao_renova')),
  renovacao_meses int not null default 12 check (renovacao_meses between 1 and 60),
  aviso_renovacao_dias int not null default 30 check (aviso_renovacao_dias between 0 and 365),
  obrigacoes_contratada text,
  obrigacoes_contratante text,
  observacoes text,
  status text not null default 'rascunho' check (status in ('rascunho','vigente','suspenso','encerrado')),
  encerrado_em date,
  encerramento_tipo text check (encerramento_tipo in ('termino_prazo','nao_renovacao','distrato','rescisao_contratual','outro')),
  encerramento_motivo text,
  criado_por text,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  versao int not null default 1,
  check (fim is null or fim >= inicio),
  check (tipo_prazo = 'indeterminado' or fim is not null)
);
create unique index if not exists fin_ctr_numero_uk on fin_contratos (lower(numero));
create index if not exists fin_ctr_forn_idx on fin_contratos (fornecedor_id);
create index if not exists fin_ctr_prest_idx on fin_contratos (prestador_id);
create index if not exists fin_ctr_status_idx on fin_contratos (status, fim);

create table if not exists fin_aditivos (
  id uuid primary key default gen_random_uuid(),
  contrato_id text not null references fin_contratos(id) on delete cascade,
  numero int not null,
  tipo text not null check (tipo in ('valor','prazo','escopo','valor_prazo','renovacao_automatica','outro')),
  descricao text not null,
  vigencia_inicio date not null,
  valor_anterior numeric(14,2), valor_novo numeric(14,2),
  fim_anterior date, fim_novo date,
  documento_id uuid,
  criado_por text,
  criado_em timestamptz not null default now(),
  unique (contrato_id, numero)
);

-- Repositório de documentos com arquivo real (bytea em arq_arquivos), validação e substituição.
create table if not exists doc_documentos (
  id uuid primary key default gen_random_uuid(),
  categoria text not null check (categoria in ('contrato','aditivo','cadastral','certidao','fiscal','nota_fiscal','comprovante_pagamento','aprovacao','encerramento','outro')),
  titulo text not null,
  pessoa_id text,                                     -- titular (app_colaboradores)
  fornecedor_id text references fin_fornecedores(id),
  contrato_id text references fin_contratos(id),
  emitido_em date,
  validade date,
  status text not null default 'pendente' check (status in ('pendente','valido','rejeitado','substituido')),
  conferido_por text, conferido_em timestamptz, motivo_rejeicao text,
  substitui_id uuid references doc_documentos(id),
  arquivo_id uuid,
  tamanho int,
  confidencial boolean not null default true,
  legado boolean not null default false,              -- veio do cadastro antigo (só metadados, sem arquivo)
  enviado_por text,
  criado_em timestamptz not null default now(),
  check (legado or arquivo_id is not null),
  check (validade is null or emitido_em is null or validade >= emitido_em)
);
create index if not exists doc_pessoa_idx on doc_documentos (pessoa_id);
create index if not exists doc_forn_idx on doc_documentos (fornecedor_id);
create index if not exists doc_ctr_idx on doc_documentos (contrato_id);
create index if not exists doc_status_idx on doc_documentos (status, validade);

create table if not exists fin_notas (
  id uuid primary key default gen_random_uuid(),
  contrato_id text references fin_contratos(id),
  fornecedor_id text not null references fin_fornecedores(id),
  numero text not null,
  serie text not null default '',
  data_emissao date not null,
  competencia text not null check (competencia ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'),
  valor_bruto numeric(14,2) not null check (valor_bruto > 0),
  descricao text,
  centro_custo_id uuid references fin_centros_custo(id),
  vencimento date,                                    -- informado na NF (opcional); a conta a pagar define o vencimento final
  arquivo_id uuid,
  status text not null default 'recebida' check (status in ('recebida','conferida','aprovada','devolvida','cancelada')),
  divergencias jsonb not null default '[]'::jsonb,
  justificativa_divergencia text,
  enviada_por text, enviada_em timestamptz not null default now(),
  conferida_por text, conferida_em timestamptz,
  aprovada_por text, aprovada_em timestamptz,
  devolvida_por text, devolvida_em timestamptz, motivo_devolucao text,
  cancelada_por text, cancelada_em timestamptz, motivo_cancelamento text,
  reenvios int not null default 0,
  legado boolean not null default false,
  legado_id text unique,
  versao int not null default 1,
  check (legado or (contrato_id is not null and arquivo_id is not null))
);
-- Mesma nota (fornecedor + número + série) só uma vez, exceto as canceladas.
create unique index if not exists fin_nf_unica_uk on fin_notas (fornecedor_id, lower(numero), serie) where status <> 'cancelada';
create index if not exists fin_nf_ctr_idx on fin_notas (contrato_id, competencia);
create index if not exists fin_nf_status_idx on fin_notas (status, enviada_em);

create table if not exists fin_contas (
  id uuid primary key default gen_random_uuid(),
  origem text not null check (origem in ('nota_fiscal','reembolso','avulsa')),
  nota_id uuid unique references fin_notas(id),       -- uma conta por nota: impede pagamento em dobro
  reembolso_id text unique,                           -- app_reembolsos
  contrato_id text references fin_contratos(id),
  fornecedor_id text references fin_fornecedores(id),
  pessoa_id text,                                     -- beneficiário pessoa (reembolso)
  centro_custo_id uuid references fin_centros_custo(id),
  descricao text not null,
  competencia text,
  valor_bruto numeric(14,2) not null check (valor_bruto > 0),
  valor_retencoes numeric(14,2) not null default 0 check (valor_retencoes >= 0),
  vencimento date not null,
  status text not null default 'prevista' check (status in ('prevista','autorizada','paga','cancelada')),
  autorizada_por text, autorizada_em timestamptz,
  conciliada_por text, conciliada_em timestamptz,
  cancelada_por text, cancelada_em timestamptz, motivo_cancelamento text,
  criado_por text,
  criado_em timestamptz not null default now(),
  versao int not null default 1,
  check (valor_retencoes <= valor_bruto),
  check (origem <> 'nota_fiscal' or nota_id is not null),
  check (origem <> 'reembolso' or reembolso_id is not null),
  check (fornecedor_id is not null or pessoa_id is not null)
);
create index if not exists fin_conta_status_idx on fin_contas (status, vencimento);
create index if not exists fin_conta_forn_idx on fin_contas (fornecedor_id);

-- Retenções registradas por pessoa autorizada (nenhuma alíquota é fixada no código).
create table if not exists fin_regras_retencao (
  id uuid primary key default gen_random_uuid(),
  fornecedor_id text not null references fin_fornecedores(id) on delete cascade,
  tipo text not null check (tipo in ('IRRF','ISS','INSS','PIS','COFINS','CSLL','CSRF','outra')),
  aliquota numeric(7,4) not null check (aliquota > 0 and aliquota <= 100),
  fundamento text not null,
  vigencia_inicio date not null,
  vigencia_fim date,
  ativo boolean not null default true,
  criado_por text,
  criado_em timestamptz not null default now(),
  check (vigencia_fim is null or vigencia_fim >= vigencia_inicio)
);
create table if not exists fin_retencoes (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null references fin_contas(id) on delete cascade,
  tipo text not null check (tipo in ('IRRF','ISS','INSS','PIS','COFINS','CSLL','CSRF','outra')),
  descricao text,
  base_calculo numeric(14,2) not null check (base_calculo >= 0),
  aliquota numeric(7,4) check (aliquota is null or (aliquota > 0 and aliquota <= 100)),
  valor numeric(14,2) not null check (valor >= 0),
  fundamento text not null,
  origem text not null default 'manual' check (origem in ('manual','regra')),
  regra_id uuid references fin_regras_retencao(id) on delete set null,
  registrado_por text,
  registrado_em timestamptz not null default now(),
  revisado_por text,
  revisado_em timestamptz
);
create index if not exists fin_ret_conta_idx on fin_retencoes (conta_id);

-- Liquidação: sem integração bancária, é um registro manual com referência e/ou comprovante.
create table if not exists fin_pagamentos (
  id uuid primary key default gen_random_uuid(),
  conta_id uuid not null unique references fin_contas(id),
  data_pagamento date not null,
  forma text not null check (forma in ('pix','ted','boleto','transferencia','outro')),
  referencia text,
  valor_pago numeric(14,2) not null check (valor_pago > 0),
  comprovante_id uuid references doc_documentos(id),
  meio text not null default 'registro_manual' check (meio in ('registro_manual','importado')),
  observacoes text,
  registrado_por text not null,
  registrado_em timestamptz not null default now()
);

create table if not exists fin_execucoes_alertas (
  id bigserial primary key,
  origem text not null,                               -- 'agendado' | 'painel' | 'manual'
  iniciado_em timestamptz not null default now(),
  concluido_em timestamptz,
  notificacoes int not null default 0,
  renovacoes int not null default 0,
  erro text
);

alter table fin_config enable row level security;
alter table fin_centros_custo enable row level security;
alter table fin_fornecedores enable row level security;
alter table fin_contratos enable row level security;
alter table fin_aditivos enable row level security;
alter table doc_documentos enable row level security;
alter table fin_notas enable row level security;
alter table fin_contas enable row level security;
alter table fin_regras_retencao enable row level security;
alter table fin_retencoes enable row level security;
alter table fin_pagamentos enable row level security;
alter table fin_execucoes_alertas enable row level security;

-- ---------------------------------------------------------------------
-- Migração dos dados legados (uma vez por registro; nunca apaga nada)
-- ---------------------------------------------------------------------

-- Data tolerante: texto inválido vira null em vez de abortar a migração inteira.
create or replace function fin_data(t text) returns date language plpgsql immutable as $$
begin
  if t is null or t !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}' then return null; end if;
  return substr(t, 1, 10)::date;
exception when others then return null;
end $$;

-- Fornecedores: um por documento (CNPJ do PJ/MEI ou CPF do autônomo).
insert into fin_fornecedores (id, tipo, razao_social, documento, regime_tributario, municipio, uf, email, telefone, representante_id, criado_por)
select distinct on (x.doc) 'forn-' || x.id,
  case x.regime when 'MEI' then 'mei' when 'autonomo' then 'pf' else 'pj' end,
  coalesce(nullif(trim(x.dados->>'razaoSocial'), ''), x.dados->>'nome'),
  x.doc,
  case x.regime when 'MEI' then 'mei' when 'autonomo' then 'pessoa_fisica' else 'nao_informado' end,
  x.dados->>'cidade', x.dados->>'uf', x.dados->>'email', x.dados->>'telefone', x.id, 'migracao'
from (
  select id, dados, coalesce(dados->>'regime', 'PJ') as regime,
    regexp_replace(coalesce(case when dados->>'regime' = 'autonomo' then dados->>'cpf' else dados->>'cnpj' end, ''), '[^0-9]', '', 'g') as doc
  from app_colaboradores where coalesce(dados->>'status', '') <> 'encerrado' or exists (select 1 from app_contratos k where k.dados->>'colaboradorId' = app_colaboradores.id)
) x
where length(x.doc) in (11, 14)
order by x.doc, x.id
on conflict do nothing;

-- Quem tem contrato legado mas nenhum fornecedor ainda (documento ausente/inválido): fornecedor sem documento.
insert into fin_fornecedores (id, tipo, razao_social, representante_id, criado_por, observacoes)
select distinct 'forn-' || p.id,
  case p.dados->>'regime' when 'MEI' then 'mei' when 'autonomo' then 'pf' else 'pj' end,
  coalesce(nullif(trim(p.dados->>'razaoSocial'), ''), p.dados->>'nome'), p.id, 'migracao',
  'Criado na migração sem CNPJ/CPF válido no cadastro — complete o documento.'
from app_contratos k join app_colaboradores p on p.id = k.dados->>'colaboradorId'
where not exists (select 1 from fin_fornecedores f where f.representante_id = p.id)
on conflict do nothing;

-- Contratos (mesmo id do legado). Números repetidos ganham sufixo para não perder registros.
insert into fin_contratos (id, numero, fornecedor_id, prestador_id, setor_id, objeto, modelo_remuneracao, valor, periodicidade_faturamento,
  tipo_prazo, inicio, fim, renovacao, observacoes, status, encerrado_em, encerramento_tipo, criado_por)
select k.id,
  case when k.rn = 1 then k.numero else k.numero || ' (' || k.rn || ')' end,
  (select f.id from fin_fornecedores f where f.representante_id = k.dados->>'colaboradorId' order by f.criado_em, f.id limit 1),
  k.dados->>'colaboradorId',
  (select p.dados->>'setorId' from app_colaboradores p where p.id = k.dados->>'colaboradorId'),
  coalesce(nullif(k.dados->>'objeto', ''), 'Prestação de serviços'),
  case k.dados->>'modalidade' when 'por-projeto' then 'por_projeto' else 'mensal_fixo' end,
  greatest(coalesce((k.dados->>'valorMensal')::numeric, 0), 0),
  case k.dados->>'modalidade' when 'por-projeto' then 'por_entrega' else 'mensal' end,
  case when fin_data(k.dados->>'fim') >= fin_data(k.dados->>'inicio') then 'determinado' else 'indeterminado' end,
  fin_data(k.dados->>'inicio'),
  case when fin_data(k.dados->>'fim') >= fin_data(k.dados->>'inicio') then fin_data(k.dados->>'fim') end,
  case when k.dados->>'renovacaoAutomatica' = 'true' then 'automatica' else 'manual' end,
  nullif(k.dados->>'observacoes', ''),
  case k.dados->>'status' when 'rascunho' then 'rascunho' when 'encerrado' then 'encerrado' else 'vigente' end,
  case when k.dados->>'status' = 'encerrado' then coalesce(fin_data(k.dados->>'fim'), fin_data(k.dados->>'atualizadoEm')) end,
  case when k.dados->>'status' = 'encerrado' then 'outro' end,
  'migracao'
from (
  select a.*, coalesce(nullif(trim(a.dados->>'numero'), ''), 'LEG-' || a.id) as numero,
    row_number() over (partition by lower(coalesce(nullif(trim(a.dados->>'numero'), ''), 'LEG-' || a.id)) order by a.ord) as rn
  from app_contratos a where a.id is not null and fin_data(a.dados->>'inicio') is not null
) k
where exists (select 1 from fin_fornecedores f where f.representante_id = k.dados->>'colaboradorId')
  and not exists (select 1 from fin_contratos c where c.id = k.id)
  and not exists (select 1 from fin_contratos c where lower(c.numero) = lower(case when k.rn = 1 then k.numero else k.numero || ' (' || k.rn || ')' end))
on conflict do nothing;

-- Documentos: o cadastro antigo guardava só metadados (sem arquivo). Ficam marcados como legado e pendentes.
insert into doc_documentos (id, categoria, titulo, pessoa_id, emitido_em, validade, status, confidencial, legado, enviado_por, criado_em)
select gen_random_uuid(),
  case d.dados->>'tipo' when 'Contrato' then 'contrato' when 'Aditivo' then 'aditivo' when 'Cartão CNPJ' then 'cadastral'
    when 'Documento pessoal' then 'cadastral' when 'Certidão' then 'certidao' else 'outro' end,
  coalesce(nullif(d.dados->>'nome', ''), d.dados->>'tipo', 'Documento'),
  d.dados->>'colaboradorId',
  fin_data(d.dados->>'data'),
  case when fin_data(d.dados->>'data') is null or fin_data(d.dados->>'validade') >= fin_data(d.dados->>'data') then fin_data(d.dados->>'validade') end,
  'pendente', (d.dados->>'confidencial') is distinct from 'false', true, d.dados->>'enviadoPorId', now()
from app_documentos d
where d.id is not null and not exists (select 1 from doc_documentos x where x.legado and x.titulo = coalesce(nullif(d.dados->>'nome', ''), d.dados->>'tipo', 'Documento') and x.pessoa_id = d.dados->>'colaboradorId' and x.emitido_em is not distinct from fin_data(d.dados->>'data'))
  and not exists (select 1 from app_meta where chave = 'fin_docs_legado_migrados');
insert into app_meta (chave, valor) values ('fin_docs_legado_migrados', to_jsonb(now())) on conflict do nothing;

-- Notas fiscais legadas já enviadas (as "aguardando" eram só expectativa de envio e não viram nota).
insert into fin_notas (contrato_id, fornecedor_id, numero, data_emissao, competencia, valor_bruto, status, enviada_por, enviada_em, aprovada_por, aprovada_em, legado, legado_id)
select
  (select c.id from fin_contratos c where c.prestador_id = n.dados->>'colaboradorId' order by (c.status = 'vigente') desc, c.inicio desc limit 1),
  (select f.id from fin_fornecedores f where f.representante_id = n.dados->>'colaboradorId' order by f.criado_em, f.id limit 1),
  'LEG-' || n.id,
  coalesce(fin_data(n.dados->>'enviadaEm'), fin_data(n.dados->>'competencia' || '-01')),
  n.dados->>'competencia',
  (n.dados->>'valor')::numeric,
  case when n.dados->>'status' = 'enviada' then 'recebida' else 'aprovada' end,
  n.dados->>'colaboradorId',
  coalesce(fin_data(n.dados->>'enviadaEm')::timestamptz, now()),
  case when n.dados->>'status' <> 'enviada' then nullif(n.dados->>'aprovadorId', '') end,
  case when n.dados->>'status' <> 'enviada' then coalesce(fin_data(n.dados->>'aprovadaEm')::timestamptz, fin_data(n.dados->>'enviadaEm')::timestamptz, now()) end,
  true, n.id
from app_notas n
where n.dados->>'status' in ('enviada', 'aprovada', 'pagamento', 'paga')
  and coalesce((n.dados->>'valor')::numeric, 0) > 0
  and (n.dados->>'competencia') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
  and exists (select 1 from fin_fornecedores f where f.representante_id = n.dados->>'colaboradorId')
on conflict do nothing;

insert into fin_contas (origem, nota_id, contrato_id, fornecedor_id, descricao, competencia, valor_bruto, vencimento, status, autorizada_em, criado_por)
select 'nota_fiscal', f.id, f.contrato_id, f.fornecedor_id, 'NF ' || f.numero || ' · competência ' || f.competencia, f.competencia, f.valor_bruto,
  coalesce(fin_data(n.dados->>'pagamentoEm'), fin_data(n.dados->>'prazo'), (f.competencia || '-28')::date),
  case n.dados->>'status' when 'paga' then 'paga' when 'pagamento' then 'autorizada' else 'prevista' end,
  case when n.dados->>'status' in ('paga', 'pagamento') then f.aprovada_em end,
  'migracao'
from fin_notas f join app_notas n on n.id = f.legado_id
where f.legado and f.status = 'aprovada'
on conflict do nothing;

insert into fin_pagamentos (conta_id, data_pagamento, forma, referencia, valor_pago, meio, observacoes, registrado_por)
select c.id, coalesce(fin_data(n.dados->>'pagaEm'), c.vencimento), 'outro', null, c.valor_bruto, 'importado',
  'Importado do controle anterior: sem comprovante anexado.', 'migracao'
from fin_contas c join fin_notas f on f.id = c.nota_id join app_notas n on n.id = f.legado_id
where c.status = 'paga'
on conflict do nothing;
