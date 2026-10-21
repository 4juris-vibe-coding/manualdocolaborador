-- "Link de Preenchimento": um link público (sem login) que o RH gera e
-- compartilha (WhatsApp, e-mail manual etc.) pra um candidato/novo
-- colaborador preencher os próprios dados cadastrais, em vez do RH
-- digitar tudo manualmente. Não envia e-mail sozinho (não temos SMTP
-- configurado) — é só a geração/validação do link; o envio é manual.
create table colaborador_links_preenchimento (
  id uuid primary key default gen_random_uuid(),
  token text not null unique default replace(gen_random_uuid()::text, '-', ''),
  departamento_id uuid references departamentos(id) on delete set null,
  cargo_id uuid references cargos(id) on delete set null,
  expira_em timestamptz not null,
  criado_por uuid references perfis(id),
  criado_em timestamptz not null default now(),
  -- Preenchido quando alguém usa o link pra criar um colaborador — um
  -- link usado uma vez não pode ser reusado.
  colaborador_criado_id uuid references colaboradores(id) on delete set null,
  usado_em timestamptz
);
create index on colaborador_links_preenchimento (token);

alter table colaborador_links_preenchimento enable row level security;

-- Só admin_rh gerencia (cria/lista/revoga) os links — o preenchimento em
-- si roda com a service role (ver lib/supabase/admin.ts), porque quem
-- preenche não está autenticado.
create policy "links_preenchimento_admin_all" on colaborador_links_preenchimento
  for all using (is_admin()) with check (is_admin());
