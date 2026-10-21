-- Suporte real a colaboradores PJ: até aqui "pj" já existia no enum
-- tipo_contrato_colaborador, mas nada no schema diferenciava PJ de CLT —
-- não havia CNPJ/razão social, os motivos de desligamento eram todos de
-- terminologia CLT ("justa causa" etc.) e os checklists de admissão/
-- demissão eram únicos e genéricos pra qualquer tipo de contrato.

-- CNPJ e razão social do prestador de serviço (colaborador PJ).
alter table colaboradores
  add column cnpj text,
  add column razao_social text;

alter table colaboradores
  add constraint chk_cnpj_formato check (cnpj is null or cnpj ~ '^[0-9]{14}$');

comment on column colaboradores.cnpj is
  'CNPJ do prestador de serviço (colaboradores PJ). Só dígitos, sem pontuação.';
comment on column colaboradores.razao_social is
  'Razão social da empresa do colaborador PJ.';

-- Motivos de desligamento neutros pra contrato PJ — "demissão"/"justa
-- causa" são termos de vínculo empregatício CLT e não deveriam ser usados
-- pra rescisão de um contrato de prestação de serviço.
insert into motivos_demissao (nome) values
  ('Rescisão de contrato (PJ)'),
  ('Fim de contrato / não renovação (PJ)')
on conflict do nothing;

-- Um checklist_template pode ser específico de um tipo de contrato (ex.:
-- admissão CLT pede CTPS/exame admissional; admissão PJ pede contrato de
-- prestação de serviço assinado e CNPJ ativo). Nulo = aplica a qualquer
-- tipo de contrato, preservando o comportamento anterior.
alter table checklist_templates
  add column tipo_contrato tipo_contrato_colaborador;

comment on column checklist_templates.tipo_contrato is
  'Se definido, o template só é aplicado automaticamente a colaboradores desse tipo de contrato. Nulo = aplica a qualquer tipo.';
