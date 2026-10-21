-- "Valor/Qtd/Hs" do formulário de Registro (ex.: quantidade de horas de
-- atraso, valor de uma bonificação etc. — um número livre por registro).
alter table registros add column valor_qtd_horas numeric(10, 2) not null default 0;

-- Feedbacks: parecido com Registros, mas é enviado ao colaborador (por
-- isso não tem "tipo" nem "valor/qtd/hs" — só o essencial pra um feedback
-- direto). Anotação confidencial continua sendo Registros.
create type classificacao_feedback as enum ('positivo', 'para_melhorar', 'neutro');

create table feedbacks (
  id uuid primary key default gen_random_uuid(),
  colaborador_id uuid not null references colaboradores (id) on delete cascade,
  data_feedback date not null default current_date,
  classificacao classificacao_feedback not null,
  comentario text not null,
  autor_id uuid not null references perfis (id),
  criado_em timestamptz not null default now()
);
create index on feedbacks (colaborador_id);
create index on feedbacks (data_feedback);

alter table feedbacks enable row level security;

create policy "feedbacks_admin_all" on feedbacks
  for all using (is_admin()) with check (is_admin());

create policy "feedbacks_gestor_all" on feedbacks
  for all
  using (exists (
    select 1 from colaboradores c
    where c.id = feedbacks.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ))
  with check (exists (
    select 1 from colaboradores c
    where c.id = feedbacks.colaborador_id
      and c.departamento_id in (select managed_department_ids())
  ));
