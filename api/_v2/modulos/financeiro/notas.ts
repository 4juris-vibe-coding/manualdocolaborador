/* ============================================================
   API v2 · Gestão de prestadores PJ · notas fiscais de serviço
   Fluxo: recebida → (conferência documental) conferida →
          (aceite do serviço) aprovada → conta a pagar.
   Devolução volta para a pessoa corrigir e reenviar.
   NÃO há validação junto à prefeitura/Receita: "conferida" significa
   conferência interna do documento, não validação fiscal oficial.
   ============================================================ */
import { auditar, conflito, dataISO, enumerado, invalido, naoEncontrado, notificar, ok, paginacao, proibido, tem, texto, type Executor, type Rota, type Usuario } from '../../nucleo.js'
import { baixarArquivo, guardarArquivo, validarUpload } from '../../arquivos.js'
import { RE_COMPETENCIA, STATUS_NOTA, calcularRetencao, centavos, divergenciasNota, vencimentoConta } from '../../../../src/domain/v2/financeiro.js'
import {
  contratoOu404, dinheiro, dstr, escopoContrato, exigirNaoProprio, hoje, idTexto, lerConfig, mapaPessoas, meusFornecedores, nomeDe, notificarCap, num,
  podeAceitar, uuid, type Linha,
} from './comum.js'
import { contratoParaNota } from './cadastros.js'

const SEL = `n.*, n.data_emissao::text as emissao_t, n.vencimento::text as venc_t, k.numero as contrato_numero, k.gestor_id, k.setor_id, k.prestador_id,
  f.razao_social as fornecedor_nome, c.id as conta_id, c.status as conta_status`
const FROM = `fin_notas n left join fin_contratos k on k.id = n.contrato_id join fin_fornecedores f on f.id = n.fornecedor_id left join fin_contas c on c.nota_id = n.id`

export function notaJson(n: Linha, gente: Map<string, Linha>) {
  return {
    id: n.id, contratoId: n.contrato_id, contratoNumero: n.contrato_numero, fornecedorId: n.fornecedor_id, fornecedorNome: n.fornecedor_nome,
    prestadorNome: nomeDe(gente, n.prestador_id), gestorNome: nomeDe(gente, n.gestor_id),
    numero: n.numero, serie: n.serie, dataEmissao: n.emissao_t ?? dstr(n.data_emissao), competencia: n.competencia, valorBruto: num(n.valor_bruto),
    descricao: n.descricao, vencimento: n.venc_t ?? dstr(n.vencimento), status: n.status, divergencias: n.divergencias ?? [], justificativaDivergencia: n.justificativa_divergencia,
    temArquivo: !!n.arquivo_id, enviadaPor: nomeDe(gente, n.enviada_por), enviadaEm: n.enviada_em,
    conferidaPor: nomeDe(gente, n.conferida_por), conferidaEm: n.conferida_em, aprovadaPor: nomeDe(gente, n.aprovada_por), aprovadaEm: n.aprovada_em,
    devolvidaPor: nomeDe(gente, n.devolvida_por), devolvidaEm: n.devolvida_em, motivoDevolucao: n.motivo_devolucao,
    canceladaPor: nomeDe(gente, n.cancelada_por), canceladaEm: n.cancelada_em, motivoCancelamento: n.motivo_cancelamento,
    reenvios: n.reenvios, legado: n.legado, contaId: n.conta_id ?? null, contaStatus: n.conta_status ?? null, versao: n.versao,
  }
}

export async function notaOu404(ex: Executor, id: string, travar = false): Promise<Linha> {
  const r = await ex.query(`select n.*, n.data_emissao::text as emissao_t from fin_notas n where n.id = $1 ${travar ? 'for update' : ''}`, [uuid(id)])
  if (!r.rows[0]) throw naoEncontrado('Nota fiscal não encontrada.')
  return r.rows[0]
}

/** Quem vê a nota: financeiro, quem presta o contrato e quem dá o aceite. */
async function acessoNota(ex: Executor, u: Usuario, n: Linha) {
  const k = n.contrato_id ? await contratoOu404(ex, n.contrato_id) : null
  const prestador = (k?.prestador_id === u.colaboradorId) || (await meusFornecedores(ex, u)).includes(n.fornecedor_id)
  const gestor = !!k && podeAceitar(u, k)
  if (!tem(u, 'fin:ver') && !prestador && !gestor) throw naoEncontrado('Nota fiscal não encontrada.')
  return { k, prestador, gestor }
}

interface DadosNota { numero: string; serie: string; dataEmissao: string; competencia: string; valorBruto: number; descricao: string | null; vencimento: string | null }
function lerDados(b: Linha, agora: Date): DadosNota {
  const competencia = texto(b.competencia, 'competência', { max: 7 })
  if (!RE_COMPETENCIA.test(competencia)) throw invalido('Competência inválida (AAAA-MM).', { competencia: 'Use AAAA-MM' })
  const dataEmissao = dataISO(b.dataEmissao, 'data de emissão', true)!
  if (dataEmissao > hoje(agora)) throw invalido('A data de emissão não pode estar no futuro.', { dataEmissao: 'Data futura' })
  return {
    numero: texto(b.numero, 'número da nota', { max: 30 }).replace(/\s+/g, ''), serie: texto(b.serie, 'série', { obrigatorio: false, max: 10 }),
    dataEmissao, competencia, valorBruto: dinheiro(b.valorBruto, 'valor bruto'), descricao: texto(b.descricao, 'descrição', { obrigatorio: false, max: 2000 }) || null,
    vencimento: dataISO(b.vencimento, 'vencimento'),
  }
}

async function calcularDivergencias(ex: Executor, k: Linha, d: DadosNota, ignorarId: string | null) {
  const outras = (await ex.query("select count(*)::int as n from fin_notas where contrato_id = $1 and competencia = $2 and status <> 'cancelada' and id <> coalesce($3::uuid, '00000000-0000-0000-0000-000000000000')",
    [k.id, d.competencia, ignorarId])).rows[0].n
  return divergenciasNota({ valorBruto: d.valorBruto, competencia: d.competencia, dataEmissao: d.dataEmissao, fornecedorId: k.fornecedor_id },
    { status: k.status, inicio: dstr(k.inicio)!, fim: dstr(k.fim), valor: Number(k.valor), modeloRemuneracao: k.modelo_remuneracao, fornecedorId: k.fornecedor_id }, outras)
}

async function exigirNaoDuplicada(ex: Executor, fornecedorId: string, d: DadosNota, ignorarId: string | null) {
  const dup = (await ex.query("select id from fin_notas where fornecedor_id = $1 and lower(numero) = lower($2) and serie = $3 and status <> 'cancelada' and id <> coalesce($4::uuid, '00000000-0000-0000-0000-000000000000')",
    [fornecedorId, d.numero, d.serie, ignorarId])).rows[0]
  if (dup) throw conflito('Esta nota (mesmo emitente, número e série) já foi registrada.')
}

/** No aceite: cria a conta a pagar (uma por nota) e aplica as regras de retenção vigentes do fornecedor, pendentes de revisão. */
export async function criarContaDaNota(ex: Executor, n: Linha, k: Linha, aceite: string, quem: string) {
  const cfg = await lerConfig(ex)
  const venc = vencimentoConta(aceite, k.prazo_pagamento_dias, dstr(n.vencimento), cfg.prazoPagamentoPadraoDias)
  const emissao = n.emissao_t ?? dstr(n.data_emissao)
  const regras = (await ex.query(`select * from fin_regras_retencao where fornecedor_id = $1 and ativo and vigencia_inicio <= $2::date and (vigencia_fim is null or vigencia_fim >= $2::date)`,
    [n.fornecedor_id, emissao])).rows
  const bruto = Number(n.valor_bruto)
  const rets = regras.map((r) => ({ r, valor: calcularRetencao(bruto, Number(r.aliquota)) }))
  const totalRet = rets.reduce((a, x) => a + centavos(x.valor), 0) / 100
  if (centavos(totalRet) > centavos(bruto)) throw conflito('As regras de retenção do fornecedor somam mais que o valor da nota. Revise as regras antes do aceite.')
  const conta = (await ex.query(`insert into fin_contas (origem, nota_id, contrato_id, fornecedor_id, centro_custo_id, descricao, competencia, valor_bruto, valor_retencoes, vencimento, criado_por)
    values ('nota_fiscal',$1,$2,$3,$4,$5,$6,$7,$8,$9,$10) on conflict (nota_id) do nothing returning id`,
    [n.id, k.id, n.fornecedor_id, n.centro_custo_id ?? k.centro_custo_id, `NF ${n.numero}${n.serie ? `/${n.serie}` : ''} · ${k.numero} · ${n.competencia}`, n.competencia, bruto, totalRet, venc, quem])).rows[0]
  if (!conta) throw conflito('Já existe conta a pagar para esta nota.')
  for (const { r, valor } of rets) {
    await ex.query(`insert into fin_retencoes (conta_id, tipo, base_calculo, aliquota, valor, fundamento, origem, regra_id, registrado_por) values ($1,$2,$3,$4,$5,$6,'regra',$7,'sistema')`,
      [conta.id, r.tipo, bruto, r.aliquota, valor, r.fundamento, r.id])
  }
  await auditar(ex, quem, 'conta', conta.id, 'criada', { origem: 'nota_fiscal', notaId: n.id, vencimento: venc, retencoesPorRegra: rets.length })
  return conta.id as string
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'financeiro/notas',
    h: async ({ db, req, usuario }) => {
      const { pagina, por, offset } = paginacao(req.query, 25)
      const ps: unknown[] = []
      const w: string[] = []
      if (!tem(usuario, 'fin:ver')) {
        const e = escopoContrato(usuario, 'k', 1)
        ps.push(...e.params)
        w.push(`(${e.sql} or n.fornecedor_id in (select id from fin_fornecedores where representante_id = $1))`)
      }
      if (req.query.status) { ps.push(req.query.status.split(',')); w.push(`n.status = any($${ps.length}::text[])`) }
      if (req.query.competencia && RE_COMPETENCIA.test(req.query.competencia)) { ps.push(req.query.competencia); w.push(`n.competencia = $${ps.length}`) }
      if (req.query.fornecedor) { ps.push(req.query.fornecedor); w.push(`n.fornecedor_id = $${ps.length}`) }
      if (req.query.contrato) { ps.push(req.query.contrato); w.push(`n.contrato_id = $${ps.length}`) }
      if (req.query.divergencia === '1') w.push(`jsonb_array_length(n.divergencias) > 0 and n.status in ('recebida','conferida')`)
      if (req.query.q) { ps.push(`%${req.query.q.trim().toLowerCase()}%`); w.push(`(lower(n.numero) like $${ps.length} or lower(f.razao_social) like $${ps.length} or lower(coalesce(k.numero,'')) like $${ps.length})`) }
      // "Minhas pendências": conferência para quem confere; aceite para quem é gestor do contrato.
      if (req.query.pendentes === '1') {
        const partes: string[] = []
        if (tem(usuario, 'fin:conferir')) partes.push(`n.status = 'recebida'`)
        if (tem(usuario, 'fin:aprovar')) partes.push(`n.status = 'conferida'`)
        else { ps.push(usuario.colaboradorId, usuario.setoresLiderados); partes.push(`(n.status = 'conferida' and (k.gestor_id = $${ps.length - 1} or k.setor_id = any($${ps.length}::text[])))`) }
        w.push(partes.length ? `(${partes.join(' or ')})` : 'false')
      }
      const where = w.length ? w.join(' and ') : 'true'
      const total = (await db.query(`select count(*)::int as n from ${FROM} where ${where}`, ps)).rows[0].n
      const porStatus = Object.fromEntries((await db.query(`select n.status, count(*)::int as q from ${FROM} where ${where} group by n.status`, ps)).rows.map((r) => [r.status, r.q]))
      const rows = (await db.query(`select ${SEL} from ${FROM} where ${where} order by n.enviada_em desc limit ${por} offset ${offset}`, ps)).rows
      const gente = await mapaPessoas(db)
      return ok({ itens: rows.map((n) => notaJson(n, gente)), total, pagina, por, porStatus })
    },
  },
  {
    // Notas esperadas e não recebidas: contratos mensais vigentes na competência sem nota ativa.
    metodo: 'GET', padrao: 'financeiro/notas/esperadas', cap: 'fin:ver',
    h: async ({ db, req, agora }) => {
      const comp = req.query.competencia && RE_COMPETENCIA.test(req.query.competencia) ? req.query.competencia : hoje(agora).slice(0, 7)
      const rows = (await db.query(`select k.id, k.numero, k.valor, k.prestador_id, f.razao_social from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
        where k.status = 'vigente' and k.periodicidade_faturamento = 'mensal' and k.inicio <= ($1 || '-28')::date and (k.fim is null or k.fim >= ($1 || '-01')::date)
          and not exists (select 1 from fin_notas n where n.contrato_id = k.id and n.competencia = $1 and n.status <> 'cancelada') order by f.razao_social`, [comp])).rows
      const gente = await mapaPessoas(db)
      return ok({ competencia: comp, itens: rows.map((r) => ({ contratoId: r.id, contratoNumero: r.numero, fornecedorNome: r.razao_social, prestadorNome: nomeDe(gente, r.prestador_id), valor: num(r.valor) })) })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/notas',
    h: async ({ db, req, usuario, agora }) => {
      const b = req.corpo ?? {}
      const d = lerDados(b, agora)
      const up = validarUpload(b.arquivo, ['pdf', 'png', 'jpg'], 'arquivo')
      const id = await db.tx(async (t) => {
        const { k, prestador } = await contratoParaNota(t, usuario, idTexto(b.contratoId, 'contratoId'))
        // Contrato encerrado ainda recebe a nota de serviços já prestados (sai marcada como divergência para conferência).
        if (k.status === 'rascunho') throw conflito('Este contrato ainda é rascunho e não aceita notas.')
        await exigirNaoDuplicada(t, k.fornecedor_id, d, null)
        const div = await calcularDivergencias(t, k, d, null)
        const arq = await guardarArquivo(t, up, 'nota_fiscal', null, usuario.colaboradorId)
        const r = await t.query(`insert into fin_notas (contrato_id, fornecedor_id, numero, serie, data_emissao, competencia, valor_bruto, descricao, centro_custo_id, vencimento, arquivo_id, divergencias, enviada_por)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12::jsonb,$13) returning id`,
          [k.id, k.fornecedor_id, d.numero, d.serie, d.dataEmissao, d.competencia, d.valorBruto, d.descricao, k.centro_custo_id, d.vencimento, arq, JSON.stringify(div), usuario.colaboradorId])
        const id = r.rows[0].id as string
        await t.query('update arq_arquivos set dono_id = $2 where id = $1', [arq, id])
        await auditar(t, usuario.colaboradorId, 'nota_fiscal', id, 'enviada', { contrato: k.numero, competencia: d.competencia, valor: d.valorBruto, divergencias: div.map((x) => x.codigo), emNomeDe: prestador ? null : 'financeiro' })
        await notificarCap(t, 'fin:conferir', { tipo: 'nota_fiscal', titulo: 'Nota fiscal para conferir', corpo: `Contrato ${k.numero} · ${d.competencia}`, link: `/financeiro/notas?nota=${id}`, chave: `nf-nova:${id}` }, [usuario.colaboradorId])
        return id
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/notas/:id',
    h: async ({ db, params, usuario }) => {
      const base = await notaOu404(db, params.id)
      const acesso = await acessoNota(db, usuario, base)
      const n = (await db.query(`select ${SEL} from ${FROM} where n.id = $1`, [base.id])).rows[0]
      const gente = await mapaPessoas(db)
      const historico = (await db.query("select id, em, colaborador_id, acao, detalhes from aud_eventos where entidade = 'nota_fiscal' and entidade_id = $1 order by em desc", [base.id])).rows
      return ok({
        nota: notaJson(n, gente),
        acoes: {
          conferir: n.status === 'recebida' && tem(usuario, 'fin:conferir') && !acesso.prestador,
          aceitar: n.status === 'conferida' && acesso.gestor && !acesso.prestador,
          reenviar: n.status === 'devolvida' && (acesso.prestador || tem(usuario, 'fin:conferir')),
          cancelar: tem(usuario, 'fin:conferir') && !['cancelada'].includes(n.status) && n.conta_status !== 'paga',
        },
        historico: historico.map((e) => ({ id: Number(e.id), em: e.em, autor: nomeDe(gente, e.colaborador_id), acao: e.acao, detalhes: e.detalhes })),
      })
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/notas/:id/arquivo',
    h: async ({ db, params, usuario }) => {
      const n = await notaOu404(db, params.id)
      await acessoNota(db, usuario, n)
      if (!n.arquivo_id) throw naoEncontrado('Nota importada do controle anterior: não há arquivo anexado.')
      const out = await baixarArquivo(db, n.arquivo_id)
      if (!out?.binario) throw naoEncontrado('Arquivo não encontrado.')
      return { ...out, binario: { ...out.binario, inline: true } }
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/notas/:id/conferir', cap: 'fin:conferir',
    h: async ({ db, params, req, usuario }) => {
      const decisao = enumerado(req.corpo?.decisao, 'decisão', ['conferir', 'devolver'] as const)
      const motivo = decisao === 'devolver' ? texto(req.corpo?.motivo, 'motivo da devolução', { min: 5, max: 1000 }) : null
      await db.tx(async (t) => {
        const n = await notaOu404(t, params.id, true)
        const k = n.contrato_id ? await contratoOu404(t, n.contrato_id) : null
        if (n.status !== 'recebida') throw conflito('Esta nota não está aguardando conferência.')
        exigirNaoProprio(usuario, n.enviada_por, k?.prestador_id)
        if ((await meusFornecedores(t, usuario)).includes(n.fornecedor_id)) throw proibido('Você não pode conferir nota do fornecedor que representa.')
        if (decisao === 'conferir') {
          await t.query("update fin_notas set status = 'conferida', conferida_por = $2, conferida_em = now(), versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId])
          await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'conferida')
          if (k?.gestor_id && k.gestor_id !== usuario.colaboradorId) await notificar(t, { destinatarioId: k.gestor_id, tipo: 'nota_fiscal', titulo: 'Aceite de serviço pendente', corpo: `NF ${n.numero} · contrato ${k.numero} · ${n.competencia}`, link: `/financeiro/notas?nota=${n.id}`, chave: `nf-aceite:${n.id}` })
          else if (!k?.gestor_id) await notificarCap(t, 'fin:aprovar', { tipo: 'nota_fiscal', titulo: 'Aceite de serviço pendente', corpo: `NF ${n.numero} · ${n.competencia}`, link: `/financeiro/notas?nota=${n.id}`, chave: `nf-aceite:${n.id}` }, [usuario.colaboradorId])
        } else {
          await t.query("update fin_notas set status = 'devolvida', devolvida_por = $2, devolvida_em = now(), motivo_devolucao = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, motivo])
          await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'devolvida', { etapa: 'conferencia', motivo })
          if (n.enviada_por) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal devolvida para correção', corpo: `NF ${n.numero}: ${motivo}`, link: '/notas', chave: `nf-dev:${n.id}:${n.versao}` })
        }
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/notas/:id/aceite',
    h: async ({ db, params, req, usuario, agora }) => {
      const decisao = enumerado(req.corpo?.decisao, 'decisão', ['aprovar', 'devolver'] as const)
      const motivo = decisao === 'devolver' ? texto(req.corpo?.motivo, 'motivo da devolução', { min: 5, max: 1000 }) : null
      const out = await db.tx(async (t) => {
        const n = await notaOu404(t, params.id, true)
        if (!n.contrato_id) throw conflito('Nota sem contrato vinculado.')
        const k = await contratoOu404(t, n.contrato_id)
        if (!podeAceitar(usuario, k)) throw proibido('O aceite é do(a) gestor(a) do contrato ou de quem tem permissão de aprovar serviços.')
        if (n.status !== 'conferida') throw conflito('A nota precisa estar conferida para o aceite.')
        exigirNaoProprio(usuario, n.enviada_por, k.prestador_id)
        if ((await meusFornecedores(t, usuario)).includes(n.fornecedor_id)) throw proibido('Você não pode aceitar serviço do fornecedor que representa.')
        if (decisao === 'devolver') {
          await t.query("update fin_notas set status = 'devolvida', devolvida_por = $2, devolvida_em = now(), motivo_devolucao = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, motivo])
          await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'devolvida', { etapa: 'aceite', motivo })
          if (n.enviada_por) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal devolvida para correção', corpo: `NF ${n.numero}: ${motivo}`, link: '/notas', chave: `nf-dev:${n.id}:${n.versao}` })
          return { contaId: null }
        }
        const div = (n.divergencias ?? []) as unknown[]
        const justificativa = div.length ? texto(req.corpo?.justificativa, 'justificativa das divergências', { min: 10, max: 2000 }) : null
        await t.query("update fin_notas set status = 'aprovada', aprovada_por = $2, aprovada_em = now(), justificativa_divergencia = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, justificativa])
        await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'aprovada', { divergencias: div.length, justificativa })
        const contaId = await criarContaDaNota(t, n, k, hoje(agora), usuario.colaboradorId)
        await notificarCap(t, 'fin:autorizar', { tipo: 'pagamento', titulo: 'Pagamento para autorizar', corpo: `NF ${n.numero} · ${k.numero}`, link: `/financeiro/contas?conta=${contaId}`, chave: `conta-aut:${contaId}` }, [usuario.colaboradorId, k.prestador_id])
        if (n.enviada_por) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal aprovada', corpo: `NF ${n.numero} · ${n.competencia}. O pagamento segue para autorização.`, link: '/notas', chave: `nf-ok:${n.id}` })
        return { contaId }
      })
      return ok(out)
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/notas/:id/reenviar',
    h: async ({ db, params, req, usuario, agora }) => {
      const b = req.corpo ?? {}
      const d = lerDados(b, agora)
      const up = validarUpload(b.arquivo, ['pdf', 'png', 'jpg'], 'arquivo')
      await db.tx(async (t) => {
        const n = await notaOu404(t, params.id, true)
        const acesso = await acessoNota(t, usuario, n)
        if (!acesso.prestador && !tem(usuario, 'fin:conferir')) throw proibido('Só quem presta o serviço reenvia a nota.')
        if (n.status !== 'devolvida') throw conflito('Só notas devolvidas podem ser reenviadas.')
        await exigirNaoDuplicada(t, n.fornecedor_id, d, n.id)
        const div = await calcularDivergencias(t, acesso.k!, d, n.id)
        const arq = await guardarArquivo(t, up, 'nota_fiscal', n.id, usuario.colaboradorId)
        await t.query(`update fin_notas set numero = $2, serie = $3, data_emissao = $4, competencia = $5, valor_bruto = $6, descricao = $7, vencimento = $8, arquivo_id = $9,
          divergencias = $10::jsonb, status = 'recebida', conferida_por = null, conferida_em = null, reenvios = reenvios + 1, versao = versao + 1 where id = $1`,
          [n.id, d.numero, d.serie, d.dataEmissao, d.competencia, d.valorBruto, d.descricao, d.vencimento, arq, JSON.stringify(div)])
        await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'reenviada', { arquivoAnterior: n.arquivo_id, valorAnterior: Number(n.valor_bruto), valor: d.valorBruto, numeroAnterior: n.numero, numero: d.numero })
        await notificarCap(t, 'fin:conferir', { tipo: 'nota_fiscal', titulo: 'Nota fiscal corrigida para conferir', corpo: `NF ${d.numero} · ${d.competencia}`, link: `/financeiro/notas?nota=${n.id}`, chave: `nf-reenvio:${n.id}:${n.versao}` }, [usuario.colaboradorId])
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/notas/:id/cancelar', cap: 'fin:conferir',
    h: async ({ db, params, req, usuario }) => {
      const motivo = texto(req.corpo?.motivo, 'motivo do cancelamento', { min: 5, max: 1000 })
      await db.tx(async (t) => {
        const n = await notaOu404(t, params.id, true)
        if (n.status === 'cancelada') throw conflito('Nota já cancelada.')
        const conta = (await t.query('select id, status from fin_contas where nota_id = $1 for update', [n.id])).rows[0]
        if (conta?.status === 'paga') throw conflito('Esta nota já foi paga; não pode ser cancelada.')
        await t.query("update fin_notas set status = 'cancelada', cancelada_por = $2, cancelada_em = now(), motivo_cancelamento = $3, versao = versao + 1 where id = $1", [n.id, usuario.colaboradorId, motivo])
        if (conta) {
          await t.query("update fin_contas set status = 'cancelada', cancelada_por = $2, cancelada_em = now(), motivo_cancelamento = $3, versao = versao + 1 where id = $1", [conta.id, usuario.colaboradorId, `Nota cancelada: ${motivo}`])
          await auditar(t, usuario.colaboradorId, 'conta', conta.id, 'cancelada', { motivo: 'nota cancelada' })
        }
        await auditar(t, usuario.colaboradorId, 'nota_fiscal', n.id, 'cancelada', { motivo })
        if (n.enviada_por && n.enviada_por !== usuario.colaboradorId) await notificar(t, { destinatarioId: n.enviada_por, tipo: 'nota_fiscal', titulo: 'Nota fiscal cancelada', corpo: `NF ${n.numero}: ${motivo}`, link: '/notas', chave: `nf-canc:${n.id}` })
      })
      return ok()
    },
  },
]

export { STATUS_NOTA }
