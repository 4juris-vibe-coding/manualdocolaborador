-- 97 · Ciclo de vida da parceria (aditivo, idempotente, sem apagar dados)
-- 1) Processos (checklists) DUPLICADOS em andamento para a mesma pessoa e tipo — efeito do
--    encerrar → reativar → encerrar, que criava um segundo checklist. Mantém o de maior progresso
--    (empate: o mais antigo) e marca os demais como cancelados, com o motivo. Nada é removido.
do $ciclo$
begin
  if to_regclass('app_processos') is null or to_regclass('app_colaboradores') is null then return; end if;
  with abertos as (
    select p.id, p.ord,
           p.dados->>'colaboradorId' as pessoa, p.dados->>'tipo' as tipo,
           (select count(*) from jsonb_array_elements(coalesce(p.dados->'itens', '[]'::jsonb)) i where (i->>'feito')::boolean) as feitos
      from app_processos p
     where p.dados->>'concluidoEm' is null and p.dados->>'canceladoEm' is null
  ), ordenados as (
    select id, row_number() over (partition by pessoa, tipo order by feitos desc, ord asc) as n from abertos
  )
  update app_processos p
     set dados = p.dados || jsonb_build_object('canceladoEm', to_char(current_date, 'YYYY-MM-DD'), 'motivoCancelamento', 'Duplicidade corrigida (checklist repetido do mesmo encerramento)'),
         atualizado_em = now()
    from ordenados o
   where o.id = p.id and o.n > 1;

    -- 2) Data de referência (data EFETIVA) nos checklists de encerramento antigos, que mostravam
  --    a data em que o checklist foi aberto no lugar da data do encerramento.
  update app_processos p
     set dados = p.dados || jsonb_build_object('referencia', c.dados->'encerramento'->>'data'),
         atualizado_em = now()
    from app_colaboradores c
   where c.id = p.dados->>'colaboradorId'
     and p.dados->>'tipo' = 'encerramento'
     and p.dados->>'referencia' is null
     and c.dados->'encerramento'->>'data' is not null;
end
$ciclo$;
