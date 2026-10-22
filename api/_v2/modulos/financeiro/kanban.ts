/* ============================================================
   API v2 · Gestão de prestadores PJ · kanban das notas fiscais
   Colunas (por competência):
     aguardando → contratos mensais vigentes sem nota recebida
     recebida   → nota recebida ou conferida (em análise)
     aprovada   → serviço aceito; conta a pagar prevista/autorizada
     recusada   → devolvida para correção (aguarda reenvio)
     paga       → pagamento registrado (conta paga)
   Mover um cartão executa, numa única transação, as mesmas etapas do
   fluxo detalhado (conferência, aceite, autorização, registro do
   pagamento), com as mesmas travas: ninguém decide nota própria,
   divergência exige justificativa e a segregação de funções vale.
   ============================================================ */
import { auditar, conflito, dataISO, enumerado, invalido, notificar, ok, proibido, tem, texto, type Rota } from '../../nucleo.js'
import { FORMAS_PAGAMENTO, RE_COMPETENCIA, centavos, reais } from '../../../../src/domain/v2/financeiro.js'
import { contratoOu404, exigirNaoProprio, hoje, lerConfig, mapaPessoas, meusFornecedores, nomeDe, notificarCap, num, podeAceitar, registrarDocumento, type Linha } from './comum.js'
import { criarContaDaNota, notaOu404 } from './notas.js'
import { atualizarReembolso, beneficiarios } from './contas.js'
import { alvosDaCompetencia, prazoDaCompetencia } from './disparos.js'
import { planoContratosBase } from './contratosBase.js'

export const COLUNAS_KANBAN = ['aguardando', 'recebida', 'aprovada', 'recusada', 'paga'] as const
export type ColunaKanban = (typeof COLUNAS_KANBAN)[number]

/** Coluna de uma nota existente (null = fora do kanban, ex.: cancelada). */
export function colunaDaNota(status: string, contaStatus: string | null): ColunaKanban | null {
  if (status === 'cancelada') return null
  if (status === 'devolvida') return 'recusada'
  if (status === 'recebida' || status === 'conferida') return 'recebida'
  if (contaStatus === 'paga') return 'paga'
  return 'aprovada'
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'financeiro/kanban', cap: 'fin:ver',
    h: async ({ db, req, usuario, agora }) => {
      const comp = req.query.competencia && RE_COMPETENCIA.test(req.query.competencia) ? req.query.competencia : hoje(agora).slice(0, 7)
      const gente = await mapaPessoas(db)
      const cfg = await lerConfig(db)
      const notas = (await db.query(`select n.id, n.numero, n.serie, n.status, n.valor_bruto, n.enviada_em, n.conferida_em, n.aprovada_em, n.devolvida_em, n.motivo_devolucao,
          n.divergencias, n.enviada_por, n.data_emissao::text as emissao, n.reenvios, k.id as contrato_id, k.numero as contrato_numero, k.prestador_id, k.gestor_id,
          f.razao_social, f.representante_id, c.id as conta_id, c.status as conta_status, c.valor_bruto - c.valor_retencoes as liquido, c.vencimento::text as venc,
          p.data_pagamento::text as pago_em
        from fin_notas n left join fin_contratos k on k.id = n.contrato_id join fin_fornecedores f on f.id = n.fornecedor_id
          left join fin_contas c on c.nota_id = n.id left join fin_pagamentos p on p.conta_id = c.id
        where n.competencia = $1 and n.status <> 'cancelada' order by n.enviada_em desc`, [comp])).rows
      const cartoes: Linha[] = []
      for (const n of notas) {
        const coluna = colunaDaNota(n.status, n.conta_status)
        if (!coluna) continue
        const pessoa = n.prestador_id ?? n.representante_id ?? n.enviada_por
        cartoes.push({
          tipo: 'nota', id: n.id, coluna, pessoaId: pessoa, pessoaNome: nomeDe(gente, pessoa), fornecedorNome: n.razao_social, contratoId: n.contrato_id, contratoNumero: n.contrato_numero,
          numero: `${n.numero}${n.serie ? `/${n.serie}` : ''}`, status: n.status, contaId: n.conta_id, contaStatus: n.conta_status, valor: num(n.valor_bruto), liquido: num(n.liquido),
          emissao: n.emissao, enviadaEm: n.enviada_em, vencimento: n.venc, pagoEm: n.pago_em, motivoDevolucao: n.motivo_devolucao, divergencias: (n.divergencias ?? []).length,
          reenvios: n.reenvios, gestorNome: nomeDe(gente, n.gestor_id),
        })
      }
      // Aguardando: contratos mensais vigentes sem nota (ativa) na competência, com a última cobrança enviada.
      const esperados = (await db.query(`select k.id, k.numero, k.valor, coalesce(k.prestador_id, f.representante_id) as pessoa, f.razao_social from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
        where k.status = 'vigente' and k.periodicidade_faturamento = 'mensal' and k.inicio <= ($1 || '-28')::date and (k.fim is null or k.fim >= ($1 || '-01')::date)
          and not exists (select 1 from fin_notas n where n.contrato_id = k.id and n.competencia = $1 and n.status <> 'cancelada') order by f.razao_social`, [comp])).rows
      const cobrancas = new Map<string, { n: number; ultima: string }>((await db.query(`select e.pessoa_id, count(*)::int as n, max(e.criado_em) as ultima from fin_disparo_envios e
        join fin_disparos d on d.id = e.disparo_id where d.competencia = $1 group by e.pessoa_id`, [comp])).rows.map((r) => [r.pessoa_id, { n: r.n, ultima: r.ultima }]))
      for (const k of esperados) {
        cartoes.push({
          tipo: 'esperada', id: `esperada:${k.id}`, coluna: 'aguardando', pessoaId: k.pessoa, pessoaNome: nomeDe(gente, k.pessoa), fornecedorNome: k.razao_social,
          contratoId: k.id, contratoNumero: k.numero, valor: num(k.valor), cobrancas: cobrancas.get(k.pessoa)?.n ?? 0, ultimaCobranca: cobrancas.get(k.pessoa)?.ultima ?? null,
        })
      }
      const caps = { mover: tem(usuario, 'fin:conferir') || tem(usuario, 'fin:aprovar'), pagar: tem(usuario, 'fin:pagar'), autorizar: tem(usuario, 'fin:autorizar'), disparar: tem(usuario, 'fin:disparar'), registrar: tem(usuario, 'fin:conferir') }
      const totais = Object.fromEntries(COLUNAS_KANBAN.map((c) => {
        const cs = cartoes.filter((x) => x.coluna === c)
        return [c, { quantidade: cs.length, valor: reais(cs.reduce((a, x) => a + centavos(x.valor ?? 0), 0)) }]
      }))
      const alvos = await alvosDaCompetencia(db, comp)
      return ok({
        competencia: comp, prazo: prazoDaCompetencia(comp, cfg.diaLimiteEnvioNf), segregacao: cfg.exigirSegregacao, cartoes, totais, capacidades: caps,
        pessoasPendentes: [...alvos.values()].filter((a) => a.pendente || a.devolvida).length,
        semContrato: (await planoContratosBase(db)).criar.length, podeGerarContratos: tem(usuario, 'fin:cadastrar'),
      })
    },
  },
  {
    // Move a nota no kanban: aprovada (confere + aceita), recusada (devolve com motivo) ou paga (aprova, autoriza e registra o pagamento).
    metodo: 'POST', padrao: 'financeiro/notas/:id/mover', cap: ['fin:conferir', 'fin:aprovar'],
    h: async ({ db, params, req, usuario, agora }) => {
      const b = req.corpo ?? {}
      const destino = enumerado(b.destino, 'destino', ['aprovada', 'recusada', 'paga'] as const)
      const h = hoje(agora)
      await db.tx(async (t) => {
        const n = await notaOu404(t, params.id, true)
        const k = n.contrato_id ? await contratoOu404(t, n.contrato_id) : null
        exigirNaoProprio(usuario, n.enviada_por, k?.prestador_id)
        if ((await meusFornecedores(t, usuario)).includes(n.fornecedor_id)) throw proibido('Você não pode decidir nota do fornecedor que representa.')
        if (n.status === 'cancelada') throw conflito('Nota cancelada.')
        let status: string = n.status

        if (destino === 'recusada') {
          if (!['recebida', 'conferida'].includes(status)) throw conflito(status === 'devolvida' ? 'Esta nota já está recusada.' : 'Só notas em análise podem ser recusadas. Uma nota aprovada pode ser cancelada pelo detalhe.')
          if (!tem(usuario, 'fin:conferir') && !(k && podeAceitar(usuario, k))) throw proibido()
          const motivo = texto(b.motivo, 'motivo da recusa', { min: 5, max: 1000 })
          await t.query("update fin_notas set status = 'devolvida', devolvida_por = $2, devolvida_em = now(), motivo_devolucao = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, motivo])
          await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'devolvida', { etapa: status === 'recebida' ? 'conferencia' : 'aceite', motivo, via: 'kanban' })
          if (n.enviada_por) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal recusada: corrija e reenvie', corpo: `NF ${n.numero}: ${motivo}`, link: '/notas', chave: `nf-dev:${n.id}:${n.versao}` })
          return { pago: null as string | null }
        }

        if (status === 'devolvida') throw conflito('Esta nota foi recusada e aguarda o reenvio corrigido pelo prestador.')
        if (destino === 'aprovada' && status === 'aprovada') throw conflito('Esta nota já está aprovada.')

        // Recebida → conferida → aprovada (cria a conta a pagar).
        if (status === 'recebida' || status === 'conferida') {
          if (!k) throw conflito('Nota sem contrato vinculado.')
          if (status === 'recebida') {
            if (!tem(usuario, 'fin:conferir')) throw proibido('A conferência documental é do financeiro.')
            await t.query("update fin_notas set status = 'conferida', conferida_por = $2, conferida_em = now(), versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId])
            await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'conferida', { via: 'kanban' })
          }
          if (!podeAceitar(usuario, k)) throw proibido('O aceite é do(a) gestor(a) do contrato ou de quem tem permissão de aprovar serviços.')
          const div = (n.divergencias ?? []) as unknown[]
          const justificativa = div.length ? texto(b.justificativa, 'justificativa das divergências', { min: 10, max: 2000 }) : null
          await t.query("update fin_notas set status = 'aprovada', aprovada_por = $2, aprovada_em = now(), justificativa_divergencia = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, justificativa])
          await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'aprovada', { divergencias: div.length, justificativa, via: 'kanban' })
          const contaId = await criarContaDaNota(t, n, k, h, usuario.colaboradorId)
          if (destino === 'aprovada') await notificarCap(t, 'fin:autorizar', { tipo: 'pagamento', titulo: 'Pagamento para autorizar', corpo: `NF ${n.numero} · ${k.numero}`, link: `/financeiro/contas?conta=${contaId}`, chave: `conta-aut:${contaId}` }, [usuario.colaboradorId, k.prestador_id])
          if (n.enviada_por) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal aprovada', corpo: `NF ${n.numero} · ${n.competencia}. O pagamento segue para autorização.`, link: '/notas', chave: `nf-ok:${n.id}` })
          status = 'aprovada'
        }
        if (destino === 'aprovada') return { pago: null }

        // Aprovada → paga: revisa retenções de regra, autoriza (se preciso) e registra o pagamento manual.
        const c = (await t.query('select c.*, c.vencimento::text as venc_t from fin_contas c where c.nota_id = $1 for update', [n.id])).rows[0]
        if (!c) throw conflito('Esta nota não tem conta a pagar.')
        if (c.status === 'paga') throw conflito('Esta nota já está paga.')
        if (c.status === 'cancelada') throw conflito('A conta a pagar desta nota foi cancelada.')
        if (!tem(usuario, 'fin:pagar')) throw proibido('O registro do pagamento é do financeiro.')
        exigirNaoProprio(usuario, ...(await beneficiarios(t, c)))
        if (c.status === 'prevista') {
          if (!tem(usuario, 'fin:autorizar')) throw proibido('O pagamento ainda precisa ser autorizado por quem tem a função de autorização.')
          const cfg = await lerConfig(t)
          const aprovador = (await t.query('select aprovada_por from fin_notas where id = $1', [n.id])).rows[0]?.aprovada_por
          if (cfg.exigirSegregacao && aprovador === usuario.colaboradorId) {
            throw proibido('Com a segregação de funções ligada, quem aprovou o serviço não autoriza o pagamento. Peça a outra pessoa com autorização ou desligue a segregação em Configurações financeiras.')
          }
          const rev = await t.query('update fin_retencoes set revisado_por = $2, revisado_em = now() where conta_id = $1 and revisado_por is null', [c.id, usuario.colaboradorId])
          if (rev.rowCount) await auditar(t, usuario.colaboradorId, 'conta', c.id, 'retencao_revisada', { quantidade: rev.rowCount, via: 'kanban' })
          await t.query("update fin_contas set status = 'autorizada', autorizada_por = $2, autorizada_em = now(), versao = versao + 1 where id = $1", [c.id, usuario.colaboradorId])
          await auditar(t, usuario.colaboradorId, 'conta', c.id, 'autorizada', { valorBruto: Number(c.valor_bruto), retencoes: Number(c.valor_retencoes), via: 'kanban' })
        }
        const p = b.pagamento ?? {}
        const data = dataISO(p.dataPagamento, 'data do pagamento') ?? h
        if (data > h) throw invalido('Registre o pagamento depois de efetuado (data futura não é aceita).', { dataPagamento: 'Data futura' })
        const forma = enumerado(p.forma, 'forma de pagamento', FORMAS_PAGAMENTO, 'pix')
        const referencia = texto(p.referencia, 'referência da transação', { obrigatorio: false, max: 120 }) || null
        if (!referencia && !p.comprovante) throw invalido('Informe a referência da transação (ex.: ID do PIX) ou anexe o comprovante.', { referencia: 'Referência ou comprovante' })
        const atual = (await t.query('select valor_bruto, valor_retencoes from fin_contas where id = $1', [c.id])).rows[0]
        const liquido = reais(centavos(atual.valor_bruto) - centavos(atual.valor_retencoes))
        let comp: string | null = null
        if (p.comprovante) comp = await registrarDocumento(t, usuario, { categoria: 'comprovante_pagamento', titulo: `Comprovante · ${c.descricao}`.slice(0, 200), fornecedorId: c.fornecedor_id, contratoId: c.contrato_id, pessoaId: c.pessoa_id, emitidoEm: data, status: 'valido' }, p.comprovante, 'comprovante')
        await t.query('insert into fin_pagamentos (conta_id, data_pagamento, forma, referencia, valor_pago, comprovante_id, observacoes, registrado_por) values ($1,$2,$3,$4,$5,$6,$7,$8)',
          [c.id, data, forma, referencia, liquido, comp, texto(p.observacoes, 'observações', { obrigatorio: false, max: 1000 }) || null, usuario.colaboradorId])
        await t.query("update fin_contas set status = 'paga', versao = versao + 1 where id = $1", [c.id])
        await auditar(t, usuario.colaboradorId, 'conta', c.id, 'pagamento_registrado', { data, forma, valorPago: liquido, comComprovante: !!comp, meio: 'registro_manual', via: 'kanban' })
        if (c.reembolso_id) await atualizarReembolso(t, c.reembolso_id, 'pago', data)
        for (const b2 of await beneficiarios(t, c)) await notificar(t, { destinatarioId: b2, tipo: 'pagamento', titulo: 'Pagamento realizado', corpo: `${c.descricao} · pago em ${data} · líquido R$ ${liquido.toFixed(2).replace('.', ',')}`, link: '/notas', chave: `conta-paga:${c.id}` })
        return { pago: c.id as string }
      })
      return ok({ ok: true })
    },
  },
]
