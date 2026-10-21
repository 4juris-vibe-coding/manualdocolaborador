-- Dados padrão para o ambiente começar utilizável. Roda com `supabase db reset`
-- (local) ou pode ser aplicado manualmente uma vez no projeto remoto.

insert into motivos_demissao (nome) values
  ('Pedido de demissão'),
  ('Demissão sem justa causa'),
  ('Demissão com justa causa'),
  ('Término de contrato de experiência'),
  ('Acordo entre as partes (distrato)'),
  ('Aposentadoria'),
  ('Falecimento')
on conflict (nome) do nothing;

insert into tipos_registro (nome) values
  ('Advertência verbal'),
  ('Advertência escrita'),
  ('Suspensão'),
  ('Elogio'),
  ('Atestado médico'),
  ('Ocorrência geral')
on conflict (nome) do nothing;

insert into checklist_templates (nome, tipo) values
  ('Checklist padrão de admissão', 'admissao'),
  ('Checklist padrão de desligamento', 'demissao')
on conflict do nothing;
