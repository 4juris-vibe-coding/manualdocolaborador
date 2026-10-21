-- Cadastro de Benefícios (Reten. e Engajamento > Gestão de Benefícios).
-- Aqui só a DEFINIÇÃO do benefício (o "catálogo") — vincular um
-- benefício a um colaborador específico é a tela "Beneficiários", que
-- ainda não foi enviada.
create type tipo_beneficio as enum (
  'vale_refeicao',
  'vale_alimentacao',
  'vale_transporte',
  'plano_saude',
  'plano_odontologico',
  'seguro_vida',
  'auxilio_creche',
  'auxilio_educacao',
  'gympass',
  'plr',
  'outro'
);

create type aplicado_como_beneficio as enum ('reais', 'percentual_salario');

create type periodicidade_beneficio as enum ('diario', 'semanal', 'quinzenal', 'mensal', 'anual');

create type opcao_desconto_beneficio as enum ('percentual_salario', 'valor_fixo');

create table beneficios (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  tipo tipo_beneficio not null,
  valor_beneficio numeric(12, 2) not null default 0,
  aplicado_como aplicado_como_beneficio not null default 'reais',
  periodicidade periodicidade_beneficio not null default 'mensal',
  valor_descontado numeric(12, 2),
  opcao_desconto opcao_desconto_beneficio,
  criado_em timestamptz not null default now()
);

alter table beneficios enable row level security;

create policy "beneficios_select_authenticated" on beneficios
  for select using (auth.role() = 'authenticated');
create policy "beneficios_insert_admin" on beneficios
  for insert with check (is_admin());
create policy "beneficios_update_admin" on beneficios
  for update using (is_admin()) with check (is_admin());
create policy "beneficios_delete_admin" on beneficios
  for delete using (is_admin());
