-- 96 · Nota fiscal sem arquivo: o financeiro pode registrar a nota como recebida sem anexar o documento.
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
