-- Campos do formulário de Departamento pra bater com o Sólides: descrição,
-- orçamento mensal e mais contatos (fax/ramal/email) além do telefone que
-- já existia.
alter table departamentos
  add column descricao text,
  add column orcamento_mensal numeric(12, 2) not null default 0,
  add column fax text,
  add column ramal text,
  add column email text;
