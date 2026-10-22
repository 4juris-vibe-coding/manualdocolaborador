/* ============================================================
   API v2 · Gestão de prestadores PJ · contas a pagar
   prevista → autorizada → paga (registro manual) → conciliada.
   NÃO há integração bancária: "paga" é o REGISTRO de um pagamento
   feito fora do sistema, com data, forma, referência e/ou
   comprovante. O sistema nunca executa transferências.
   ============================================================ */
import { auditar, conflito, dataISO, enumerado, invalido, naoEncontrado, notificar, ok, paginacao, proibido, tem, texto, type Executor, type Rota, type Usuario } from '../../nucleo.js'
import { FORMAS_PAGAMENTO, TIPOS_RETENCAO, calcularRetencao, centavos, reais } from '../../../../src/domain/v2/financeiro.js'
import {
  csv, dinheiro, dstr, exigirNaoProprio, hoje, lerConfig, mapaPessoas, meusFornecedores, nomeDe, notificarCap, num, registrarDocumento, uuid, uuidOuNulo, idTexto, type Linha,
} from './comum.js'
import { dadosPagamento } from './cadastros.js'

const SEL = `c.*, c.vencimento::text as venc_t, f.razao_social as fornecedor_nome, k.numero as contrato_numero, k.prestador_id,
  n.numero as nota_numero, n.aprovada_por as nota_aprovada_por, n.enviada_por as nota_enviada_por, cc.codigo as centro_codigo, cc.nome as centro_nome,
  p.data_pagamento::text as pago_em, p.forma, p.referencia, p.valor_pago, p.comprovante_id, p.meio, p.registrado_por as pago_por, p.registrado_em as pago_registrado_em, p.observacoes as pago_obs`
const FROM = `fin_contas c left join fin_fornecedores f on f.id = c.fornecedor_id left join fin_contratos k on k.id = c.contrato_id
  left join fin_notas n on n.id = c.nota_id left join fin_centros_custo cc on cc.id = c.centro_custo_id left join fin_pagamentos p on p.conta_id = c.id`

export function contaJson(c: Linha, gente: Map<string, Linha>, hojeStr: string) {
  const bruto = num(c.valor_bruto)!, ret = num(c.valor_retencoes)!
  return {
    id: c.id, origem: c.origem, notaId: c.nota_id, notaNumero: c.nota_numero, reembolsoId: c.reembolso_id, contratoId: c.contrato_id, contratoNumero: c.contrato_numero,
    fornecedorId: c.fornecedor_id, fornecedorNome: c.fornecedor_nome, pessoaId: c.pessoa_id, pessoaNome: nomeDe(gente, c.pessoa_id),
    centroCusto: c.centro_codigo ? `${c.centro_codigo} · ${c.centro_nome}` : null, descricao: c.descricao, competencia: c.competencia,
    valorBruto: bruto, valorRetencoes: ret, valorLiquido: reais(centavos(bruto) - centavos(ret)), vencimento: c.venc_t ?? dstr(c.vencimento),
    status: c.status, atrasada: ['prevista', 'autorizada'].includes(c.status) && (c.venc_t ?? dstr(c.vencimento)) < hojeStr,
    autorizadaPor: nomeDe(gente, c.autorizada_por), autorizadaEm: c.autorizada_em, conciliadaPor: nomeDe(gente, c.conciliada_por), conciliadaEm: c.conciliada_em,
    canceladaPor: nomeDe(gente, c.cancelada_por), canceladaEm: c.cancelada_em, motivoCancelamento: c.motivo_cancelamento,
    pagamento: c.pago_em ? {
      data: c.pago_em, forma: c.forma, referencia: c.referencia, valorPago: num(c.valor_pago), comprovanteId: c.comprovante_id, meio: c.meio,
      registradoPor: nomeDe(gente, c.pago_por) ?? (c.pago_por === 'migracao' ? 'Importação' : null), registradoEm: c.pago_registrado_em, observacoes: c.pago_obs,
    } : null,
    criadoEm: c.criado_em, versao: c.versao,
  }
}

export async function contaOu404(ex: Executor, id: string, travar = false): Promise<Linha> {
  const r = await ex.query(`select c.*, c.vencimento::text as venc_t from fin_contas c where c.id = $1 ${travar ? 'for update' : ''}`, [uuid(id)])
  if (!r.rows[0]) throw naoEncontrado('Conta a pagar não encontrada.')
  return r.rows[0]
}

/** Beneficiário(s) da conta: prestador do contrato, representante do fornecedor ou pessoa do reembolso. Nunca decidem a própria conta. */
export async function beneficiarios(ex: Executor, c: Linha): Promise<string[]> {
  const ids: string[] = []
  if (c.pessoa_id) ids.push(c.pessoa_id)
  if (c.fornecedor_id) { const f = (await ex.query('select representante_id from fin_fornecedores where id = $1', [c.fornecedor_id])).rows[0]; if (f?.representante_id) ids.push(f.representante_id) }
  if (c.contrato_id) { const k = (await ex.query('select prestador_id from fin_contratos where id = $1', [c.contrato_id])).rows[0]; if (k?.prestador_id) ids.push(k.prestador_id) }
  return ids
}

async function recalcularRetencoes(ex: Executor, contaId: string) {
  const r = (await ex.query('select coalesce(sum(valor), 0)::text as t from fin_retencoes where conta_id = $1', [contaId])).rows[0]
  const conta = (await ex.query('select valor_bruto from fin_contas where id = $1', [contaId])).rows[0]
  if (centavos(r.t) > centavos(conta.valor_bruto)) throw conflito('As retenções não podem superar o valor bruto.')
  await ex.query('update fin_contas set valor_retencoes = $2, versao = versao + 1 where id = $1', [contaId, Number(r.t)])
}

/** Atualiza o reembolso legado (app_reembolsos) quando a conta de reembolso muda. */
export async function atualizarReembolso(ex: Executor, reembolsoId: string, status: 'pagamento' | 'pago' | 'aprovado', pagoEm?: string) {
  const r = (await ex.query('select dados from app_reembolsos where id = $1', [reembolsoId])).rows[0]
  if (!r) return
  const dados = { ...r.dados, status, ...(pagoEm ? { pagoEm } : {}) }
  await ex.query('update app_reembolsos set dados = $2::jsonb, atualizado_em = now() where id = $1', [reembolsoId, JSON.stringify(dados)])
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'financeiro/contas', cap: 'fin:ver',
    h: async ({ db, req, agora }) => {
      const { pagina, por, offset } = paginacao(req.query, 25)
      const ps: unknown[] = []
      const w: string[] = []
      const h = hoje(agora)
      if (req.query.status) { ps.push(req.query.status.split(',')); w.push(`c.status = any($${ps.length}::text[])`) }
      if (req.query.fornecedor) { ps.push(req.query.fornecedor); w.push(`c.fornecedor_id = $${ps.length}`) }
      if (req.query.centro && /^[0-9a-f-]{36}$/i.test(req.query.centro)) { ps.push(req.query.centro); w.push(`c.centro_custo_id = $${ps.length}`) }
      if (req.query.de && /^\d{4}-\d{2}-\d{2}$/.test(req.query.de)) { ps.push(req.query.de); w.push(`c.vencimento >= $${ps.length}::date`) }
      if (req.query.ate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate)) { ps.push(req.query.ate); w.push(`c.vencimento <= $${ps.length}::date`) }
      if (req.query.atrasadas === '1') { ps.push(h); w.push(`c.status in ('prevista','autorizada') and c.vencimento < $${ps.length}::date`) }
      if (req.query.conciliar === '1') w.push(`c.status = 'paga' and c.conciliada_em is null`)
      if (req.query.q) { ps.push(`%${req.query.q.trim().toLowerCase()}%`); w.push(`(lower(c.descricao) like $${ps.length} or lower(coalesce(f.razao_social,'')) like $${ps.length})`) }
      const where = w.length ? w.join(' and ') : 'true'
      const total = (await db.query(`select count(*)::int as n from ${FROM} where ${where}`, ps)).rows[0].n
      const somas = (await db.query(`select coalesce(sum(c.valor_bruto),0)::text as bruto, coalesce(sum(c.valor_bruto - c.valor_retencoes),0)::text as liquido from ${FROM} where ${where}`, ps)).rows[0]
      const rows = (await db.query(`select ${SEL} from ${FROM} where ${where} order by (c.status in ('prevista','autorizada')) desc, c.vencimento asc limit ${por} offset ${offset}`, ps)).rows
      const gente = await mapaPessoas(db)
      return ok({ itens: rows.map((c) => contaJson(c, gente, h)), total, pagina, por, somas: { bruto: Number(somas.bruto), liquido: Number(somas.liquido) } })
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/contas/exportar', cap: 'fin:ver',
    h: async ({ db, req, usuario, agora }) => {
      const ps: unknown[] = []
      const w: string[] = []
      if (req.query.status) { ps.push(req.query.status.split(',')); w.push(`c.status = any($${ps.length}::text[])`) }
      if (req.query.de && /^\d{4}-\d{2}-\d{2}$/.test(req.query.de)) { ps.push(req.query.de); w.push(`c.vencimento >= $${ps.length}::date`) }
      if (req.query.ate && /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate)) { ps.push(req.query.ate); w.push(`c.vencimento <= $${ps.length}::date`) }
      const rows = (await db.query(`select ${SEL} from ${FROM} where ${w.length ? w.join(' and ') : 'true'} order by c.vencimento limit 10000`, ps)).rows
      const gente = await mapaPessoas(db)
      const h = hoje(agora)
      const linhas = [['Fornecedor', 'Descrição', 'Contrato', 'Competência', 'Vencimento', 'Situação', 'Valor bruto', 'Retenções', 'Valor líquido', 'Data do pagamento', 'Forma', 'Referência', 'Conciliada em']]
      for (const r of rows) {
        const c = contaJson(r, gente, h)
        linhas.push([c.fornecedorNome ?? c.pessoaNome ?? '', c.descricao, c.contratoNumero ?? '', c.competencia ?? '', c.vencimento ?? '', c.status, c.valorBruto.toFixed(2).replace('.', ','),
          c.valorRetencoes.toFixed(2).replace('.', ','), c.valorLiquido.toFixed(2).replace('.', ','), c.pagamento?.data ?? '', c.pagamento?.forma ?? '', c.pagamento?.referencia ?? '', c.conciliadaEm ? String(c.conciliadaEm).slice(0, 10) : ''])
      }
      await auditar(db, usuario.colaboradorId, 'conta', null, 'exportacao', { linhas: rows.length })
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: `contas-a-pagar-${h}.csv`, dados: csv(linhas) } }
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/contas/:id',
    h: async ({ db, params, usuario, agora }) => {
      const base = await contaOu404(db, params.id)
      const benef = await beneficiarios(db, base)
      const meu = benef.includes(usuario.colaboradorId)
      if (!tem(usuario, 'fin:ver') && !meu) throw naoEncontrado('Conta a pagar não encontrada.')
      const c = (await db.query(`select ${SEL} from ${FROM} where c.id = $1`, [base.id])).rows[0]
      const gente = await mapaPessoas(db)
      const rets = (await db.query('select * from fin_retencoes where conta_id = $1 order by registrado_em', [base.id])).rows
      const cfg = await lerConfig(db)
      const h = hoje(agora)
      let destino = null
      if (tem(usuario, 'fin:pagar') || tem(usuario, 'fin:autorizar') || meu) {
        if (c.fornecedor_id) destino = dadosPagamento((await db.query('select * from fin_fornecedores where id = $1', [c.fornecedor_id])).rows[0], gente)
        else if (c.pessoa_id) { const p = gente.get(c.pessoa_id); destino = { origem: 'representante', banco: p?.banco ?? null, agencia: p?.agencia ?? null, conta: p?.conta ?? null, pixTipo: p?.pixTipo ?? null, pixChave: p?.pixChave ?? null } }
      }
      const pendRevisao = rets.filter((r) => !r.revisado_por).length
      const segregado = (quem: string | null | undefined) => !cfg.exigirSegregacao || quem !== usuario.colaboradorId
      return ok({
        conta: contaJson(c, gente, h),
        destino,
        retencoes: rets.map((r) => ({ id: r.id, tipo: r.tipo, descricao: r.descricao, baseCalculo: num(r.base_calculo), aliquota: num(r.aliquota), valor: num(r.valor), fundamento: r.fundamento, origem: r.origem,
          registradoPor: nomeDe(gente, r.registrado_por) ?? (r.registrado_por === 'sistema' ? 'Regra do fornecedor' : null), registradoEm: r.registrado_em, revisadoPor: nomeDe(gente, r.revisado_por), revisadoEm: r.revisado_em })),
        avisoRetencoes: 'Retenções são registro de controle interno, conforme as regras cadastradas por pessoa autorizada. Não substituem a apuração fiscal oficial nem a orientação contábil.',
        acoes: meu ? {} : {
          retencoes: tem(usuario, 'fin:pagar') && c.status === 'prevista',
          autorizar: tem(usuario, 'fin:autorizar') && c.status === 'prevista' && pendRevisao === 0 && segregado(c.nota_aprovada_por),
          desautorizar: tem(usuario, 'fin:autorizar') && c.status === 'autorizada',
          pagar: tem(usuario, 'fin:pagar') && c.status === 'autorizada',
          conciliar: tem(usuario, 'fin:pagar') && c.status === 'paga' && !c.conciliada_em && segregado(c.pago_por),
          cancelar: tem(usuario, 'fin:autorizar') && ['prevista', 'autorizada'].includes(c.status) && c.origem !== 'nota_fiscal',
        },
        bloqueios: [
          ...(pendRevisao ? [`${pendRevisao} retenção(ões) aplicada(s) por regra aguardam revisão.`] : []),
          ...(c.status === 'prevista' && cfg.exigirSegregacao && c.nota_aprovada_por === usuario.colaboradorId ? ['Você deu o aceite do serviço desta nota: outra pessoa autoriza o pagamento (segregação de funções).'] : []),
          ...(destino && destino.origem === 'ausente' ? ['Fornecedor sem dados de pagamento cadastrados.'] : []),
        ],
      })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas', cap: 'fin:pagar',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const fornecedorId = idTexto(b.fornecedorId, 'fornecedorId')
      if (!(await db.query("select 1 from fin_fornecedores where id = $1 and status <> 'inativo'", [fornecedorId])).rowCount) throw invalido('Fornecedor inválido.', { fornecedorId: 'Inválido' })
      if ((await meusFornecedores(db, usuario)).includes(fornecedorId)) throw proibido('Você não pode lançar conta para o fornecedor que representa.')
      const contratoId = b.contratoId ? idTexto(b.contratoId, 'contratoId') : null
      if (contratoId && !(await db.query('select 1 from fin_contratos where id = $1 and fornecedor_id = $2', [contratoId, fornecedorId])).rowCount) throw invalido('Contrato não é deste fornecedor.', { contratoId: 'Inválido' })
      const r = await db.tx(async (t) => {
        const c = await t.query(`insert into fin_contas (origem, contrato_id, fornecedor_id, centro_custo_id, descricao, competencia, valor_bruto, vencimento, criado_por)
          values ('avulsa',$1,$2,$3,$4,$5,$6,$7,$8) returning id`,
          [contratoId, fornecedorId, uuidOuNulo(b.centroCustoId, 'centroCustoId'), texto(b.descricao, 'descrição', { min: 5, max: 300 }), b.competencia || null,
            dinheiro(b.valorBruto, 'valor bruto'), dataISO(b.vencimento, 'vencimento', true)!, usuario.colaboradorId])
        if (b.documento) await registrarDocumento(t, usuario, { categoria: 'fiscal', titulo: `Documento da conta: ${String(b.descricao).slice(0, 80)}`, fornecedorId, contratoId }, b.documento, 'documento')
        await auditar(t, usuario.colaboradorId, 'conta', c.rows[0].id, 'criada', { origem: 'avulsa' })
        return c.rows[0].id
      })
      return ok({ id: r }, 201)
    },
  },
  {
    // Reembolso aprovado (fluxo legado) entra em contas a pagar; o pedido passa a "em pagamento".
    metodo: 'POST', padrao: 'financeiro/contas/de-reembolso', cap: 'fin:pagar',
    h: async ({ db, req, usuario }) => {
      const reembolsoId = idTexto(req.corpo?.reembolsoId, 'reembolsoId')
      const vencimento = dataISO(req.corpo?.vencimento, 'vencimento', true)!
      const id = await db.tx(async (t) => {
        await t.query("select pg_advisory_xact_lock(hashtext('app_estado:reembolsos'))")
        const r = (await t.query('select dados from app_reembolsos where id = $1', [reembolsoId])).rows[0]?.dados
        if (!r) throw naoEncontrado('Reembolso não encontrado.')
        if (r.status !== 'aprovado') throw conflito('Só reembolsos aprovados entram em contas a pagar.')
        exigirNaoProprio(usuario, r.colaboradorId)
        const c = await t.query(`insert into fin_contas (origem, reembolso_id, pessoa_id, descricao, competencia, valor_bruto, vencimento, criado_por)
          values ('reembolso',$1,$2,$3,$4,$5,$6,$7) on conflict (reembolso_id) do nothing returning id`,
          [reembolsoId, r.colaboradorId, `Reembolso: ${String(r.descricao ?? r.categoria).slice(0, 200)}`, String(r.data ?? '').slice(0, 7) || null, dinheiro(r.valor, 'valor do reembolso'), vencimento, usuario.colaboradorId])
        if (!c.rows[0]) throw conflito('Este reembolso já está em contas a pagar.')
        await atualizarReembolso(t, reembolsoId, 'pagamento')
        await auditar(t, usuario.colaboradorId, 'conta', c.rows[0].id, 'criada', { origem: 'reembolso', reembolsoId })
        return c.rows[0].id
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/retencoes', cap: 'fin:pagar',
    h: async ({ db, params, req, usuario }) => {
      const b = req.corpo ?? {}
      const tipo = enumerado(b.tipo, 'tipo', TIPOS_RETENCAO)
      const base = dinheiro(b.baseCalculo, 'base de cálculo', { positivo: false })
      const aliquota = b.aliquota === undefined || b.aliquota === null || b.aliquota === '' ? null : Number(b.aliquota)
      if (aliquota !== null && (!Number.isFinite(aliquota) || aliquota <= 0 || aliquota > 100)) throw invalido('Alíquota inválida.', { aliquota: 'Entre 0 e 100' })
      // Com alíquota, o valor é calculado (arredondamento meio para cima); sem alíquota, o valor informado é registrado.
      const valor = aliquota !== null ? calcularRetencao(base, aliquota) : dinheiro(b.valor, 'valor da retenção', { positivo: false })
      const fundamento = texto(b.fundamento, 'fundamento', { min: 5, max: 1000 })
      const id = await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status !== 'prevista') throw conflito('Retenções só podem ser alteradas antes da autorização do pagamento.')
        exigirNaoProprio(usuario, ...(await beneficiarios(t, c)))
        const r = await t.query(`insert into fin_retencoes (conta_id, tipo, descricao, base_calculo, aliquota, valor, fundamento, origem, registrado_por, revisado_por, revisado_em)
          values ($1,$2,$3,$4,$5,$6,$7,'manual',$8,$8,now()) returning id`, [c.id, tipo, texto(b.descricao, 'descrição', { obrigatorio: false, max: 300 }) || null, base, aliquota, valor, fundamento, usuario.colaboradorId])
        await recalcularRetencoes(t, c.id)
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'retencao_registrada', { tipo, base, aliquota, valor })
        return r.rows[0].id
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'DELETE', padrao: 'financeiro/contas/:id/retencoes/:rid', cap: 'fin:pagar',
    h: async ({ db, params, usuario }) => {
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status !== 'prevista') throw conflito('Retenções só podem ser alteradas antes da autorização do pagamento.')
        const r = await t.query('delete from fin_retencoes where id = $1 and conta_id = $2 returning tipo, valor', [uuid(params.rid), c.id])
        if (!r.rowCount) throw naoEncontrado('Retenção não encontrada.')
        await recalcularRetencoes(t, c.id)
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'retencao_removida', { tipo: r.rows[0].tipo, valor: Number(r.rows[0].valor) })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/retencoes/:rid/revisar', cap: 'fin:pagar',
    h: async ({ db, params, usuario }) => {
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status !== 'prevista') throw conflito('Conta já autorizada.')
        exigirNaoProprio(usuario, ...(await beneficiarios(t, c)))
        const r = await t.query('update fin_retencoes set revisado_por = $3, revisado_em = now() where id = $1 and conta_id = $2 and revisado_por is null', [uuid(params.rid), c.id, usuario.colaboradorId])
        if (!r.rowCount) throw conflito('Retenção não encontrada ou já revisada.')
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'retencao_revisada', { retencaoId: params.rid })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/autorizar', cap: 'fin:autorizar',
    h: async ({ db, params, req, usuario }) => {
      const versao = Number(req.corpo?.versao)
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (Number.isInteger(versao) && versao !== c.versao) throw conflito('A conta mudou desde que você abriu. Recarregue antes de autorizar.')
        if (c.status !== 'prevista') throw conflito('Só contas previstas podem ser autorizadas.')
        exigirNaoProprio(usuario, ...(await beneficiarios(t, c)))
        const cfg = await lerConfig(t)
        if (cfg.exigirSegregacao && c.nota_id) {
          const n = (await t.query('select aprovada_por from fin_notas where id = $1', [c.nota_id])).rows[0]
          if (n?.aprovada_por === usuario.colaboradorId) throw proibido('Quem deu o aceite do serviço não autoriza o pagamento (segregação de funções).')
        }
        if (c.nota_id) {
          const n = (await t.query('select status from fin_notas where id = $1', [c.nota_id])).rows[0]
          if (n?.status !== 'aprovada') throw conflito('A nota fiscal desta conta não está aprovada.')
        }
        const pend = (await t.query('select count(*)::int as n from fin_retencoes where conta_id = $1 and revisado_por is null', [c.id])).rows[0].n
        if (pend) throw conflito('Revise as retenções aplicadas por regra antes de autorizar.')
        await t.query("update fin_contas set status = 'autorizada', autorizada_por = $2, autorizada_em = now(), versao = versao + 1 where id = $1", [c.id, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'autorizada', { valorBruto: Number(c.valor_bruto), retencoes: Number(c.valor_retencoes) })
        await notificarCap(t, 'fin:pagar', { tipo: 'pagamento', titulo: 'Pagamento autorizado para executar', corpo: c.descricao, link: `/financeiro/contas?conta=${c.id}`, chave: `conta-pagar:${c.id}` }, [usuario.colaboradorId])
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/desautorizar', cap: 'fin:autorizar',
    h: async ({ db, params, req, usuario }) => {
      const motivo = texto(req.corpo?.motivo, 'motivo', { min: 5, max: 1000 })
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status !== 'autorizada') throw conflito('Só contas autorizadas (e não pagas) podem voltar para revisão.')
        await t.query("update fin_contas set status = 'prevista', autorizada_por = null, autorizada_em = null, versao = versao + 1 where id = $1", [c.id])
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'autorizacao_revogada', { motivo })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/pagamento', cap: 'fin:pagar',
    h: async ({ db, params, req, usuario, agora }) => {
      const b = req.corpo ?? {}
      const data = dataISO(b.dataPagamento, 'data do pagamento', true)!
      if (data > hoje(agora)) throw invalido('Registre o pagamento depois de efetuado (data futura não é aceita).', { dataPagamento: 'Data futura' })
      const forma = enumerado(b.forma, 'forma de pagamento', FORMAS_PAGAMENTO)
      const referencia = texto(b.referencia, 'referência da transação', { obrigatorio: false, max: 120 }) || null
      const valorPago = dinheiro(b.valorPago, 'valor pago')
      if (!referencia && !b.comprovante) throw invalido('Informe a referência da transação ou anexe o comprovante.', { referencia: 'Referência ou comprovante' })
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status === 'paga') throw conflito('Esta conta já tem pagamento registrado.')
        if (c.status !== 'autorizada') throw conflito('O pagamento só pode ser registrado depois da autorização.')
        exigirNaoProprio(usuario, ...(await beneficiarios(t, c)))
        const liquido = reais(centavos(c.valor_bruto) - centavos(c.valor_retencoes))
        if (centavos(valorPago) !== centavos(liquido)) throw invalido(`O valor pago deve ser igual ao líquido autorizado (${liquido.toFixed(2)}). Divergências exigem nova autorização.`, { valorPago: 'Diferente do líquido' })
        let comp: string | null = null
        if (b.comprovante) comp = await registrarDocumento(t, usuario, { categoria: 'comprovante_pagamento', titulo: `Comprovante · ${c.descricao}`.slice(0, 200), fornecedorId: c.fornecedor_id, contratoId: c.contrato_id, pessoaId: c.pessoa_id, emitidoEm: data, status: 'valido' }, b.comprovante, 'comprovante')
        await t.query(`insert into fin_pagamentos (conta_id, data_pagamento, forma, referencia, valor_pago, comprovante_id, observacoes, registrado_por) values ($1,$2,$3,$4,$5,$6,$7,$8)`,
          [c.id, data, forma, referencia, valorPago, comp, texto(b.observacoes, 'observações', { obrigatorio: false, max: 1000 }) || null, usuario.colaboradorId])
        await t.query("update fin_contas set status = 'paga', versao = versao + 1 where id = $1", [c.id])
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'pagamento_registrado', { data, forma, valorPago, comComprovante: !!comp, meio: 'registro_manual' })
        if (c.reembolso_id) await atualizarReembolso(t, c.reembolso_id, 'pago', data)
        for (const b2 of await beneficiarios(t, c)) await notificar(t, { destinatarioId: b2, tipo: 'pagamento', titulo: 'Pagamento registrado', corpo: `${c.descricao} · pago em ${data}`, link: c.reembolso_id ? '/reembolsos' : '/notas', chave: `conta-paga:${c.id}` })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/conciliar', cap: 'fin:pagar',
    h: async ({ db, params, usuario }) => {
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (c.status !== 'paga') throw conflito('Só contas pagas podem ser conciliadas.')
        if (c.conciliada_em) throw conflito('Conta já conciliada.')
        const p = (await t.query('select registrado_por from fin_pagamentos where conta_id = $1', [c.id])).rows[0]
        const cfg = await lerConfig(t)
        if (cfg.exigirSegregacao && p?.registrado_por === usuario.colaboradorId) throw proibido('Quem registrou o pagamento não faz a conciliação (segregação de funções).')
        await t.query('update fin_contas set conciliada_por = $2, conciliada_em = now(), versao = versao + 1 where id = $1', [c.id, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'conciliada')
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contas/:id/cancelar', cap: 'fin:autorizar',
    h: async ({ db, params, req, usuario }) => {
      const motivo = texto(req.corpo?.motivo, 'motivo', { min: 5, max: 1000 })
      await db.tx(async (t) => {
        const c = await contaOu404(t, params.id, true)
        if (!['prevista', 'autorizada'].includes(c.status)) throw conflito('Só contas não pagas podem ser canceladas.')
        if (c.origem === 'nota_fiscal') throw conflito('Conta de nota fiscal: cancele a nota (o cancelamento da conta acompanha).')
        await t.query("update fin_contas set status = 'cancelada', cancelada_por = $2, cancelada_em = now(), motivo_cancelamento = $3, versao = versao + 1 where id = $1", [c.id, usuario.colaboradorId, motivo])
        if (c.reembolso_id) await atualizarReembolso(t, c.reembolso_id, 'aprovado')
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'cancelada', { motivo })
      })
      return ok()
    },
  },
]

export type { Usuario }
