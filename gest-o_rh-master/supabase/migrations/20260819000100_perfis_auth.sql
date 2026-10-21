-- Perfis (extensão de auth.users) + trigger de criação automática + funções
-- helper de autorização usadas por todas as RLS policies do projeto.

create table perfis (
  id uuid primary key references auth.users (id) on delete cascade,
  nome_completo text not null,
  email text not null,
  papel papel_usuario not null default 'gestor',
  ativo boolean not null default true,
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create trigger set_atualizado_em
  before update on perfis
  for each row
  execute function moddatetime(atualizado_em);

-- Popula "perfis" automaticamente sempre que um usuário é criado no Auth
-- (fluxo: Configurações > Usuários do sistema chama auth.admin.createUser
-- com nome_completo/papel em user_metadata).
create or replace function handle_new_user()
returns trigger
language plpgsql
security definer set search_path = public
as $$
begin
  insert into perfis (id, nome_completo, email, papel)
  values (
    new.id,
    coalesce(new.raw_user_meta_data ->> 'nome_completo', new.email),
    new.email,
    coalesce((new.raw_user_meta_data ->> 'papel')::papel_usuario, 'gestor')
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- Funções helper para as RLS policies. security definer + search_path fixo
-- evitam tanto a recursão de RLS (a função ignora as policies das tabelas
-- que consulta) quanto o sequestro de schema.

create or replace function is_admin()
returns boolean
language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from perfis
    where id = auth.uid() and papel = 'admin_rh' and ativo
  );
$$;

-- managed_department_ids() é criada na migration de departamentos
-- (20260819000300_departamentos.sql), pois depende da tabela
-- departamento_gestores, que ainda não existe neste ponto.
