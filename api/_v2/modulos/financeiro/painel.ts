/* ============================================================
   API v2 · Gestão de prestadores PJ · painel, agenda, alertas e
   visão do prestador.
   Indicadores: cada um traz definição e fonte; tudo é calculado
   na hora a partir do banco (sem número fixo).
   Alertas: notificações internas idempotentes (chave por evento).
   Rodam pelo agendador da Vercel (CRON_SECRET) e, como reserva,
   quando o painel é aberto e a última execução tem mais de 12 h.
   Não enviam e-mail.
   ============================================================ */
import { timingSafeEqual } from 'node:crypto'
import { auditar, notificar, ok, proibido, tem, type Executor, type Rota } from '../../nucleo.js'
import { RE_COMPETENCIA, centavos, reais, somarDias, somarMeses } from '../../../../src/domain/v2/financeiro.js'
import { dstr, espelharContrato, hoje, idsComCapacidade, lerConfig, mapaPessoas, meusFornecedores, nomeDe, num, type Linha } from './comum.js'
import { contaJson } from './contas.js'
import { notaJson } from './notas.js'
import { disparosAutomaticos, lerDisparoAuto } from './disparos.js'

const n2 = (v: unknown) => Number(v ?? 0)

/** Indicadores com período [de, ate] (datas) e filtros opcionais. */
async function indicadores(ex: Executor, de: string, ate: string, hojeStr: string, filtro: { fornecedor?: string; centro?: string }) {
  const ps: unknown[] = [de, ate]
  const fc: string[] = []
  if (filtro.fornecedor) { ps.push(filtro.fornecedor); fc.push(`fornecedor_id = $${ps.length}`) }
  if (filtro.centro) { ps.push(filtro.centro); fc.push(`centro_custo_id = $${ps.length}`) }
  const e = fc.length ? ' and ' + fc.join(' and ') : ''
  const compDe = de.slice(0, 7), compAte = ate.slice(0, 7)
  const q1 = async (sql: string, extra: unknown[] = []) => (await ex.query(sql, [...ps, ...extra])).rows[0]
  const ctr = await q1(`select count(*) filter (where status = 'vigente')::int as ativos,
      coalesce(sum(valor) filter (where status = 'vigente' and modelo_remuneracao = 'mensal_fixo'), 0)::text as mensal,
      count(*) filter (where status in ('vigente','suspenso') and fim between $${ps.length + 1}::date and $${ps.length + 1}::date + 60)::int as a_vencer,
      count(*) filter (where status in ('vigente','suspenso') and fim < $${ps.length + 1}::date)::int as vencidos
    from fin_contratos where $1::date is not null and $2::date is not null ${e}`, [hojeStr])
  const nf = await q1(`select coalesce(sum(valor_bruto) filter (where status <> 'cancelada'), 0)::text as faturado,
      coalesce(sum(valor_bruto) filter (where status = 'aprovada'), 0)::text as aprovado,
      count(*) filter (where status = 'recebida')::int as a_conferir, count(*) filter (where status = 'conferida')::int as a_aceitar,
      count(*) filter (where status = 'devolvida')::int as devolvidas,
      count(*) filter (where status in ('recebida','conferida') and jsonb_array_length(divergencias) > 0)::int as divergentes,
      avg(extract(epoch from (aprovada_em - enviada_em)) / 86400) filter (where status = 'aprovada' and not legado)::float8 as dias_aprovacao
    from fin_notas where competencia between to_char($1::date, 'YYYY-MM') and to_char($2::date, 'YYYY-MM') ${e}`)
  const ct = await q1(`select coalesce(sum(valor_bruto - valor_retencoes) filter (where status in ('prevista','autorizada') and vencimento between $1 and $2), 0)::text as previsto,
      coalesce(sum(valor_bruto - valor_retencoes) filter (where status in ('prevista','autorizada') and vencimento < $${ps.length + 1}::date), 0)::text as vencido,
      count(*) filter (where status in ('prevista','autorizada') and vencimento < $${ps.length + 1}::date)::int as qtd_vencidas,
      coalesce(sum(valor_bruto - valor_retencoes) filter (where status in ('prevista','autorizada') and vencimento > $2), 0)::text as futuro,
      count(*) filter (where status = 'prevista')::int as a_autorizar, count(*) filter (where status = 'autorizada')::int as a_pagar,
      count(*) filter (where status = 'paga' and conciliada_em is null)::int as a_conciliar,
      coalesce(sum(valor_retencoes) filter (where status = 'paga'), 0)::text as retido
    from fin_contas where true ${e}`, [hojeStr])
  const pago = await q1(`select coalesce(sum(p.valor_pago), 0)::text as total, count(*)::int as qtd,
      avg(p.data_pagamento - n.aprovada_em::date) filter (where n.id is not null and p.meio = 'registro_manual')::float8 as dias_liquidacao
    from fin_pagamentos p join fin_contas c on c.id = p.conta_id left join fin_notas n on n.id = c.nota_id
    where p.data_pagamento between $1 and $2 ${e.replace(/fornecedor_id/g, 'c.fornecedor_id').replace(/centro_custo_id/g, 'c.centro_custo_id')}`)
  const docs = (await ex.query(`select count(*) filter (where status = 'pendente' and not legado)::int as pendentes,
      count(*) filter (where status in ('valido','pendente') and validade < $1::date)::int as vencidos,
      count(*) filter (where legado and status = 'pendente')::int as legados from doc_documentos`, [hojeStr])).rows[0]
  const concentracao = (await ex.query(`select f.razao_social as nome, sum(p.valor_pago)::text as v from fin_pagamentos p join fin_contas c on c.id = p.conta_id
      join fin_fornecedores f on f.id = c.fornecedor_id where p.data_pagamento between $1 and $2 ${e.replace(/fornecedor_id/g, 'c.fornecedor_id').replace(/centro_custo_id/g, 'c.centro_custo_id')}
      group by f.razao_social order by sum(p.valor_pago) desc limit 8`, ps)).rows
  const porCentro = (await ex.query(`select coalesce(cc.codigo || ' · ' || cc.nome, 'Sem centro de custo') as nome, sum(n.valor_bruto)::text as v
      from fin_notas n left join fin_centros_custo cc on cc.id = n.centro_custo_id
      where n.status <> 'cancelada' and n.competencia between to_char($1::date, 'YYYY-MM') and to_char($2::date, 'YYYY-MM') ${e.replace(/fornecedor_id/g, 'n.fornecedor_id').replace(/centro_custo_id/g, 'n.centro_custo_id')}
      group by 1 order by sum(n.valor_bruto) desc limit 10`, ps)).rows
  const totalPago = n2(pago.total)
  const R = (d: string, f: string) => ({ definicao: d, fonte: f })
  return {
    periodo: { de, ate, competencias: `${compDe} a ${compAte}` },
    atualizadoEm: new Date().toISOString(),
    contratos: {
      ativos: { valor: ctr.ativos, ...R('Contratos com situação "vigente".', 'Contratos'), link: '/financeiro/contratos?status=vigente' },
      valorMensalContratado: { valor: n2(ctr.mensal), ...R('Soma do valor mensal dos contratos vigentes de valor mensal fixo (não inclui contratos por projeto, hora ou entrega).', 'Contratos') },
      aVencer60: { valor: ctr.a_vencer, ...R('Vigentes ou suspensos com término entre hoje e 60 dias.', 'Contratos'), link: '/financeiro/contratos?prazo=a_vencer&dias=60' },
      vencidosSemRegularizacao: { valor: ctr.vencidos, ...R('Término já passou e o contrato não foi encerrado nem renovado por aditivo.', 'Contratos'), link: '/financeiro/contratos?prazo=vencido' },
    },
    financeiro: {
      faturado: { valor: n2(nf.faturado), ...R('Soma do valor bruto das notas não canceladas com competência no período.', 'Notas fiscais') },
      aprovado: { valor: n2(nf.aprovado), ...R('Valor bruto das notas com aceite do serviço, competência no período.', 'Notas fiscais') },
      previsto: { valor: n2(ct.previsto), ...R('Líquido (bruto − retenções) das contas não pagas com vencimento no período.', 'Contas a pagar'), link: `/financeiro/contas?status=prevista,autorizada&de=${de}&ate=${ate}` },
      pago: { valor: totalPago, ...R('Soma dos pagamentos registrados com data no período (registro manual; sem integração bancária).', 'Pagamentos'), link: '/financeiro/contas?status=paga' },
      vencido: { valor: n2(ct.vencido), quantidade: ct.qtd_vencidas, ...R('Líquido das contas não pagas com vencimento anterior a hoje.', 'Contas a pagar'), link: '/financeiro/contas?atrasadas=1' },
      futuro: { valor: n2(ct.futuro), ...R('Líquido das contas não pagas com vencimento depois do período.', 'Contas a pagar') },
      retidoPago: { valor: n2(ct.retido), ...R('Retenções registradas em contas pagas (controle interno; não é apuração fiscal).', 'Retenções') },
    },
    operacao: {
      notasAConferir: { valor: nf.a_conferir, link: '/financeiro/notas?status=recebida', ...R('Notas recebidas aguardando conferência documental.', 'Notas fiscais') },
      notasAAceitar: { valor: nf.a_aceitar, link: '/financeiro/notas?status=conferida', ...R('Notas conferidas aguardando o aceite do serviço.', 'Notas fiscais') },
      notasDevolvidas: { valor: nf.devolvidas, link: '/financeiro/notas?status=devolvida', ...R('Notas devolvidas aguardando reenvio pelo prestador.', 'Notas fiscais') },
      notasComDivergencia: { valor: nf.divergentes, link: '/financeiro/notas?divergencia=1', ...R('Notas em análise com divergência em relação ao contrato.', 'Notas fiscais') },
      contasAAutorizar: { valor: ct.a_autorizar, link: '/financeiro/contas?status=prevista', ...R('Contas previstas aguardando autorização.', 'Contas a pagar') },
      contasAPagar: { valor: ct.a_pagar, link: '/financeiro/contas?status=autorizada', ...R('Contas autorizadas aguardando o registro do pagamento.', 'Contas a pagar') },
      contasAConciliar: { valor: ct.a_conciliar, link: '/financeiro/contas?conciliar=1', ...R('Pagamentos registrados ainda não conciliados.', 'Pagamentos') },
      documentosPendentes: { valor: docs.pendentes, link: '/financeiro/documentos?status=pendente', ...R('Documentos enviados aguardando conferência.', 'Documentos') },
      documentosVencidos: { valor: docs.vencidos, link: '/financeiro/documentos?validade=vencidos', ...R('Documentos válidos ou pendentes com validade vencida.', 'Documentos') },
      documentosLegadosSemArquivo: { valor: docs.legados, link: '/financeiro/documentos?status=pendente', ...R('Registros do cadastro antigo que só tinham metadados: peça o arquivo.', 'Documentos') },
      diasMediosAprovacao: { valor: nf.dias_aprovacao === null ? null : Math.round(nf.dias_aprovacao * 10) / 10, ...R('Média de dias entre o envio e o aceite das notas aprovadas na competência do período (exclui importadas).', 'Notas fiscais') },
      diasMediosLiquidacao: { valor: pago.dias_liquidacao === null ? null : Math.round(pago.dias_liquidacao * 10) / 10, ...R('Média de dias entre o aceite da nota e a data do pagamento registrado no período.', 'Pagamentos') },
    },
    concentracao: concentracao.map((r) => ({ rotulo: r.nome, valor: n2(r.v), percentual: totalPago ? Math.round((n2(r.v) / totalPago) * 1000) / 10 : 0 })),
    concentracaoDefinicao: 'Participação de cada fornecedor no total pago no período.',
    porCentroCusto: porCentro.map((r) => ({ rotulo: r.nome, valor: n2(r.v) })),
    porCentroCustoDefinicao: 'Valor bruto das notas não canceladas, por centro de custo, competência no período.',
  }
}

/** Itens com data nos próximos `dias`: término de contratos, aviso de renovação, validade de documentos, vencimento de contas e prazo de envio de notas. */
async function agenda(ex: Executor, hojeStr: string, dias: number, diaNf: number) {
  const ate = somarDias(hojeStr, dias)
  const itens: { data: string; tipo: string; titulo: string; detalhe: string; link: string; atrasado: boolean }[] = []
  for (const k of (await ex.query(`select k.id, k.numero, k.fim::text as fim, k.renovacao, k.aviso_renovacao_dias, f.razao_social from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
      where k.status in ('vigente','suspenso') and k.fim is not null and k.fim <= $1::date order by k.fim`, [ate])).rows) {
    itens.push({ data: k.fim, tipo: 'contrato', titulo: `Término do contrato ${k.numero}`, detalhe: `${k.razao_social} · ${k.renovacao === 'automatica' ? 'renovação automática' : k.renovacao === 'manual' ? 'decidir renovação' : 'não renova'}`, link: `/financeiro/contratos/${k.id}`, atrasado: k.fim < hojeStr })
    const aviso = somarDias(k.fim, -k.aviso_renovacao_dias)
    if (k.renovacao === 'manual' && aviso >= hojeStr && aviso <= ate) itens.push({ data: aviso, tipo: 'renovacao', titulo: `Decidir renovação · ${k.numero}`, detalhe: k.razao_social, link: `/financeiro/contratos/${k.id}`, atrasado: false })
  }
  for (const d of (await ex.query(`select id, titulo, validade::text as v from doc_documentos where status in ('valido','pendente') and validade is not null and validade <= $1::date order by validade limit 200`, [ate])).rows) {
    itens.push({ data: d.v, tipo: 'documento', titulo: `Validade: ${d.titulo}`, detalhe: 'Documento', link: `/financeiro/documentos?validade=vencendo&dias=${dias}`, atrasado: d.v < hojeStr })
  }
  for (const c of (await ex.query(`select c.id, c.descricao, c.vencimento::text as v, c.status, (c.valor_bruto - c.valor_retencoes)::text as liq from fin_contas c
      where c.status in ('prevista','autorizada') and c.vencimento <= $1::date order by c.vencimento limit 300`, [ate])).rows) {
    itens.push({ data: c.v, tipo: 'pagamento', titulo: `Pagamento: ${c.descricao}`, detalhe: `${c.status === 'prevista' ? 'aguarda autorização' : 'autorizado'} · líquido ${Number(c.liq).toFixed(2)}`, link: `/financeiro/contas?conta=${c.id}`, atrasado: c.v < hojeStr })
  }
  // Prazo de envio das notas do mês corrente (contratos mensais vigentes sem nota).
  const comp = hojeStr.slice(0, 7)
  const limite = `${comp}-${String(diaNf).padStart(2, '0')}`
  const semNota = (await ex.query(`select count(*)::int as n from fin_contratos k where k.status = 'vigente' and k.periodicidade_faturamento = 'mensal'
      and k.inicio <= ($1 || '-28')::date and (k.fim is null or k.fim >= ($1 || '-01')::date)
      and not exists (select 1 from fin_notas n where n.contrato_id = k.id and n.competencia = $1 and n.status <> 'cancelada')`, [comp])).rows[0].n
  if (semNota && limite <= ate) itens.push({ data: limite, tipo: 'nota', titulo: `Prazo de envio das notas de ${comp}`, detalhe: `${semNota} contrato(s) ainda sem nota`, link: `/financeiro/notas?aba=esperadas`, atrasado: limite < hojeStr })
  return itens.sort((a, b) => a.data.localeCompare(b.data))
}

/**
 * Processa alertas e renovações automáticas. Idempotente: cada notificação tem chave por evento (não duplica)
 * e a renovação automática só acontece uma vez por término (o aditivo muda o término).
 */
export async function processarAlertas(ex: Executor, hojeStr: string, origem: string) {
  const cfg = await lerConfig(ex)
  const exec = (await ex.query('insert into fin_execucoes_alertas (origem) values ($1) returning id', [origem])).rows[0].id
  let notificacoes = 0, renovacoes = 0
  const avisar = async (dest: string | null | undefined, tipo: string, titulo: string, corpo: string, link: string, chave: string) => {
    if (!dest) return
    const r = await ex.query('select 1 from ntf_notificacoes where destinatario_id = $1 and chave = $2', [dest, chave])
    if (r.rowCount) return
    await notificar(ex, { destinatarioId: dest, tipo, titulo, corpo, link, chave })
    notificacoes++
  }
  const cadastro = await idsComCapacidade(ex, 'fin:cadastrar')
  const pagadores = await idsComCapacidade(ex, 'fin:pagar')
  const conferentes = await idsComCapacidade(ex, 'fin:conferir')

  // 1) Renovação automática: término passou e o contrato renova sozinho → aditivo de prazo registrado pelo sistema.
  for (const k of (await ex.query(`select *, fim::text as fim_t from fin_contratos where status = 'vigente' and renovacao = 'automatica' and fim is not null and fim < $1::date for update`, [hojeStr])).rows) {
    let novoFim = k.fim_t as string
    while (novoFim < hojeStr) novoFim = somarMeses(novoFim, k.renovacao_meses)
    const numero = (await ex.query('select coalesce(max(numero), 0) + 1 as n from fin_aditivos where contrato_id = $1', [k.id])).rows[0].n
    await ex.query(`insert into fin_aditivos (contrato_id, numero, tipo, descricao, vigencia_inicio, fim_anterior, fim_novo, criado_por)
      values ($1,$2,'renovacao_automatica',$3,$4,$5,$6,'sistema')`, [k.id, numero, `Renovação automática por ${k.renovacao_meses} mês(es), conforme regra cadastrada no contrato.`, somarDias(k.fim_t, 1), k.fim_t, novoFim])
    await ex.query('update fin_contratos set fim = $2, atualizado_em = now(), versao = versao + 1 where id = $1', [k.id, novoFim])
    await auditar(ex, 'sistema', 'contrato', k.id, 'renovado_automaticamente', { fimAnterior: k.fim_t, fimNovo: novoFim })
    await espelharContrato(ex, k.id)
    for (const d of [k.gestor_id, ...cadastro]) await avisar(d, 'contrato', `Contrato ${k.numero} renovado automaticamente`, `Novo término: ${novoFim}.`, `/financeiro/contratos/${k.id}`, `ctr-renov:${k.id}:${novoFim}`)
    renovacoes++
  }
  // 2) Contratos a vencer (janela de aviso) e vencidos sem regularização.
  for (const k of (await ex.query(`select id, numero, gestor_id, fim::text as fim, renovacao from fin_contratos where status in ('vigente','suspenso') and fim is not null
      and fim <= $1::date + greatest(aviso_renovacao_dias, $2::int)`, [hojeStr, cfg.diasAlertaContrato])).rows) {
    const vencido = k.fim < hojeStr
    for (const d of [k.gestor_id, ...cadastro]) {
      await avisar(d, 'contrato', vencido ? `Contrato ${k.numero} vencido sem regularização` : `Contrato ${k.numero} vence em ${k.fim}`,
        vencido ? 'Encerre ou registre um aditivo de prazo.' : k.renovacao === 'manual' ? 'Decida a renovação.' : 'Confira o encerramento ou a renovação.', `/financeiro/contratos/${k.id}`, `ctr-${vencido ? 'vencido' : 'vence'}:${k.id}:${k.fim}`)
    }
  }
  // 3) Notas paradas.
  const limiteNota = somarDias(hojeStr, -cfg.diasAlertaAprovacao)
  for (const n of (await ex.query(`select n.id, n.numero, n.status, k.gestor_id from fin_notas n left join fin_contratos k on k.id = n.contrato_id
      where n.status in ('recebida','conferida') and coalesce(n.conferida_em, n.enviada_em)::date <= $1::date`, [limiteNota])).rows) {
    const dests = n.status === 'recebida' ? conferentes : [n.gestor_id]
    for (const d of dests) await avisar(d, 'nota_fiscal', n.status === 'recebida' ? `NF ${n.numero} aguarda conferência há mais de ${cfg.diasAlertaAprovacao} dias` : `NF ${n.numero} aguarda seu aceite`, '', `/financeiro/notas?nota=${n.id}`, `nf-parada:${n.id}:${n.status}`)
  }
  // 4) Contas próximas do vencimento ou vencidas.
  for (const c of (await ex.query(`select id, descricao, status, vencimento::text as v from fin_contas where status in ('prevista','autorizada') and vencimento <= $1::date`, [somarDias(hojeStr, cfg.diasAlertaPagamento)])).rows) {
    const vencida = c.v < hojeStr
    const dests = c.status === 'prevista' ? await idsComCapacidade(ex, 'fin:autorizar') : pagadores
    for (const d of dests) await avisar(d, 'pagamento', vencida ? `Pagamento vencido: ${c.descricao}` : `Pagamento vence em ${c.v}: ${c.descricao}`, c.status === 'prevista' ? 'Aguarda autorização.' : 'Autorizado, aguarda registro do pagamento.', `/financeiro/contas?conta=${c.id}`, `conta-${vencida ? 'vencida' : 'vence'}:${c.id}:${c.v}`)
  }
  // 5) Documentos vencendo/vencidos: titular e conferentes.
  for (const d of (await ex.query(`select id, titulo, pessoa_id, validade::text as v from doc_documentos where status in ('valido','pendente') and validade is not null and validade <= $1::date`, [somarDias(hojeStr, cfg.diasAlertaDocumento)])).rows) {
    const vencido = d.v < hojeStr
    for (const dest of [d.pessoa_id, ...conferentes]) await avisar(dest, 'documento', vencido ? `Documento vencido: ${d.titulo}` : `Documento vence em ${d.v}: ${d.titulo}`, 'Envie a versão atualizada.', dest === d.pessoa_id ? '/meus-documentos' : '/financeiro/documentos?validade=vencendo', `doc-${vencido ? 'vencido' : 'vence'}:${d.id}:${d.v}`)
  }
  // 6) Nota do mês ainda não enviada (a partir de 5 dias antes do limite). Com os disparos automáticos ligados, a cobrança é feita por eles (passo 7).
  const comp = hojeStr.slice(0, 7)
  const limite = `${comp}-${String(cfg.diaLimiteEnvioNf).padStart(2, '0')}`
  const auto = await lerDisparoAuto(ex)
  if (!auto.ativo && hojeStr >= somarDias(limite, -5)) {
    for (const k of (await ex.query(`select k.id, k.numero, k.prestador_id, f.representante_id from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
        where k.status = 'vigente' and k.periodicidade_faturamento = 'mensal' and k.inicio <= ($1 || '-28')::date and (k.fim is null or k.fim >= ($1 || '-01')::date)
        and not exists (select 1 from fin_notas n where n.contrato_id = k.id and n.competencia = $1 and n.status <> 'cancelada')`, [comp])).rows) {
      await avisar(k.prestador_id ?? k.representante_id, 'nota_fiscal', `Envie a nota fiscal de ${comp}`, `Contrato ${k.numero} · prazo ${limite}.`, '/notas', `nf-pendente:${k.id}:${comp}`)
    }
  }
  // 7) Disparos automáticos de cobrança da NF (notificação no portal), nos dias configurados.
  const disparos = await disparosAutomaticos(ex, hojeStr)
  await ex.query('update fin_execucoes_alertas set concluido_em = now(), notificacoes = $2, renovacoes = $3 where id = $1', [exec, notificacoes, renovacoes])
  return { notificacoes, renovacoes, disparos }
}

async function talvezProcessar(ex: Executor & { tx?: unknown }, hojeStr: string) {
  const ult = (await ex.query("select max(iniciado_em) as em from fin_execucoes_alertas where concluido_em is not null")).rows[0]?.em
  if (ult && Date.now() - new Date(ult).getTime() < 12 * 3600 * 1000) return
  try { await processarAlertas(ex, hojeStr, 'painel') } catch (e) { console.error('[financeiro] alertas', e instanceof Error ? e.message : e) }
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'financeiro/painel', cap: 'fin:ver',
    h: async ({ db, req, agora }) => {
      const h = hoje(agora)
      await db.tx((t) => talvezProcessar(t, h))
      const de = /^\d{4}-\d{2}-\d{2}$/.test(req.query.de ?? '') ? req.query.de : `${h.slice(0, 7)}-01`
      const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate ?? '') ? req.query.ate : somarDias(somarMeses(`${h.slice(0, 7)}-01`, 1), -1)
      const filtro = { fornecedor: req.query.fornecedor || undefined, centro: /^[0-9a-f-]{36}$/i.test(req.query.centro ?? '') ? req.query.centro : undefined }
      const ult = (await db.query('select iniciado_em, concluido_em, origem, notificacoes, renovacoes, erro from fin_execucoes_alertas order by id desc limit 1')).rows[0] ?? null
      return ok({ ...(await indicadores(db, de, ate < de ? de : ate, h, filtro)), ultimaExecucaoAlertas: ult })
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/agenda', cap: 'fin:ver',
    h: async ({ db, req, agora }) => {
      const dias = Math.min(180, Math.max(7, Number(req.query.dias) || 60))
      return ok({ dias, itens: await agenda(db, hoje(agora), dias, (await lerConfig(db)).diaLimiteEnvioNf) })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/alertas/processar', cap: 'fin:ver',
    h: async ({ db, agora, usuario }) => {
      const r = await db.tx((t) => processarAlertas(t, hoje(agora), 'manual'))
      await auditar(db, usuario.colaboradorId, 'fin_alertas', null, 'processados', r)
      return ok(r)
    },
  },
  {
    // Agendador da Vercel (vercel.json → crons). Exige Authorization: Bearer $CRON_SECRET; sem a variável, fica desligado.
    metodo: 'GET', padrao: 'financeiro/cron/alertas', publica: true, limite: 10,
    h: async ({ db, req, agora }) => {
      const segredo = process.env.CRON_SECRET
      const enviado = (req.cabecalhos.authorization ?? '').replace(/^Bearer\s+/i, '')
      if (!segredo || segredo.length < 16 || enviado.length !== segredo.length || !timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))) throw proibido('Agendamento não autorizado.')
      return ok(await db.tx((t) => processarAlertas(t, hoje(agora), 'agendado')))
    },
  },
  {
    // Visão do prestador: contratos, notas, pagamentos e pendência do mês.
    metodo: 'GET', padrao: 'financeiro/eu',
    h: async ({ db, usuario, agora }) => {
      const h = hoje(agora)
      const forn = await meusFornecedores(db, usuario)
      const gente = await mapaPessoas(db)
      const cfg = await lerConfig(db)
      const contratos = (await db.query(`select k.*, k.inicio::text as ini, k.fim::text as fi, f.razao_social from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
        where (k.prestador_id = $1 or k.fornecedor_id = any($2::text[])) order by (k.status = 'vigente') desc, k.inicio desc`, [usuario.colaboradorId, forn])).rows
      const ids = contratos.map((k) => k.id)
      const notas = (await db.query(`select n.*, n.data_emissao::text as emissao_t, n.vencimento::text as venc_t, k.numero as contrato_numero, k.gestor_id, k.setor_id, k.prestador_id, f.razao_social as fornecedor_nome,
          c.id as conta_id, c.status as conta_status from fin_notas n left join fin_contratos k on k.id = n.contrato_id join fin_fornecedores f on f.id = n.fornecedor_id left join fin_contas c on c.nota_id = n.id
        where n.contrato_id = any($1::text[]) or n.fornecedor_id = any($2::text[]) order by n.competencia desc, n.enviada_em desc limit 36`, [ids, forn])).rows
      const contas = (await db.query(`select c.*, c.vencimento::text as venc_t, f.razao_social as fornecedor_nome, k.numero as contrato_numero, k.prestador_id, n.numero as nota_numero,
          null as nota_aprovada_por, null as nota_enviada_por, null as centro_codigo, null as centro_nome, p.data_pagamento::text as pago_em, p.forma, p.referencia, p.valor_pago, p.comprovante_id, p.meio,
          p.registrado_por as pago_por, p.registrado_em as pago_registrado_em, null as pago_obs
        from fin_contas c left join fin_fornecedores f on f.id = c.fornecedor_id left join fin_contratos k on k.id = c.contrato_id left join fin_notas n on n.id = c.nota_id left join fin_pagamentos p on p.conta_id = c.id
        where c.contrato_id = any($1::text[]) or c.fornecedor_id = any($2::text[]) or c.pessoa_id = $3 order by c.vencimento desc limit 36`, [ids, forn, usuario.colaboradorId])).rows
      const rets = contas.length ? (await db.query('select conta_id, tipo, valor from fin_retencoes where conta_id = any($1::uuid[])', [contas.map((c) => c.id)])).rows : []
      const comp = h.slice(0, 7)
      const pendentes = contratos.filter((k) => k.status === 'vigente' && k.periodicidade_faturamento === 'mensal' && k.ini <= `${comp}-28` && (!k.fi || k.fi >= `${comp}-01`)
        && !notas.some((n) => n.contrato_id === k.id && n.competencia === comp && n.status !== 'cancelada'))
      return ok({
        competencia: comp,
        prazoEnvio: `${comp}-${String(cfg.diaLimiteEnvioNf).padStart(2, '0')}`,
        contratos: contratos.map((k) => ({ id: k.id, numero: k.numero, objeto: k.objeto, fornecedorNome: k.razao_social, modeloRemuneracao: k.modelo_remuneracao, valor: num(k.valor),
          inicio: k.ini, fim: k.fi, status: k.status, renovacao: k.renovacao, gestorNome: nomeDe(gente, k.gestor_id), periodicidade: k.periodicidade_faturamento })),
        notas: notas.map((n) => notaJson(n, gente)),
        pagamentos: contas.map((c) => ({ ...contaJson(c, gente, h), retencoes: rets.filter((r) => r.conta_id === c.id).map((r) => ({ tipo: r.tipo, valor: num(r.valor) })) })),
        pendenciasDoMes: pendentes.map((k) => ({ contratoId: k.id, contratoNumero: k.numero, valor: num(k.valor) })),
        totais: {
          recebidoNoAno: reais(contas.filter((c) => c.status === 'paga' && String(c.pago_em ?? '').slice(0, 4) === h.slice(0, 4)).reduce((a, c) => a + centavos(c.valor_pago), 0)),
        },
      })
    },
  },
  {
    // Contratos e notas que aguardam o aceite de quem gere (liderança): resumo para o painel da liderança.
    metodo: 'GET', padrao: 'financeiro/aceites-pendentes',
    h: async ({ db, usuario }) => {
      const ps: unknown[] = [usuario.colaboradorId]
      let cond = 'true'
      if (!tem(usuario, 'fin:aprovar')) { ps.push(usuario.setoresLiderados); cond = `(k.gestor_id = $1 or k.setor_id = any($2::text[]))` }
      const r = await db.query(`select n.id, n.numero, n.competencia, n.valor_bruto, k.numero as contrato, f.razao_social from fin_notas n join fin_contratos k on k.id = n.contrato_id join fin_fornecedores f on f.id = n.fornecedor_id
        where n.status = 'conferida' and ${cond} and k.prestador_id is distinct from $1 order by n.conferida_em limit 50`, ps)
      return ok({ itens: r.rows.map((x) => ({ id: x.id, numero: x.numero, competencia: x.competencia, valorBruto: num(x.valor_bruto), contrato: x.contrato, fornecedor: x.razao_social })) })
    },
  },
]

export { RE_COMPETENCIA, dstr }
export type { Linha }
