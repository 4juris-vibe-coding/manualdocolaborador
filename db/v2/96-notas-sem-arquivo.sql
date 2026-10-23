-- 96 · Nota fiscal enviada só com o arquivo: sem número obrigatório, e o financeiro pode registrá-la sem anexo.
-- A regra antiga (check sem nome em 60-financeiro) exigia contrato E arquivo fora do legado; agora só o contrato.
do $$
declare c text;
begin
  for c in select conname from pg_constraint where conrelid = 'fin_notas'::regclass and contype = 'c'
    and pg_get_constraintdef(oid) ilike '%arquivo_id%' loop
    execute format('alter table fin_notas drop constraint %I', c);
  end loop;
end $$;
alter table fin_notas drop constraint if exists fin_notas_contrato_check;
alter table fin_notas add constraint fin_notas_contrato_check check (legado or contrato_id is not null);

-- Nota enviada só com o arquivo fica com numero = 'S/N' (ver SEM_NUMERO em notas.ts): fora da regra de duplicidade.
do $$
begin
  if exists (select 1 from pg_indexes where indexname = 'fin_nf_unica_uk' and indexdef not like '%S/N%') then
    drop index fin_nf_unica_uk;
  end if;
end $$;
create unique index if not exists fin_nf_unica_uk on fin_notas (fornecedor_id, lower(numero), serie) where status <> 'cancelada' and numero <> 'S/N';
