-- Permite vincular um exame de saúde ocupacional a um arquivo já anexado em
-- Documentos (reaproveita o upload que já existe, em vez de duplicar o
-- fluxo de envio de arquivo dentro da seção de exames).

alter table colaborador_exames
  add column documento_id uuid references colaborador_documentos (id) on delete set null;
