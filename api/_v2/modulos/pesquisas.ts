/* ============================================================
   API v2 · Central de pesquisas
   Admin (pesq:*): criar, versionar, distribuir, acompanhar, analisar.
   Respondente (público, por token): ler, salvar progresso (identificada), responder.
   Anonimato: ver db/v2/30-pesquisas.sql e docs/V2.md §5.
   ============================================================ */
import { randomBytes } from 'node:crypto'
import {
  auditar, camel, conflito, dataISO, enumerado, ErroHttp, hashToken, hojeISO, inteiro, invalido, naoEncontrado, notificar, novoToken, ok, paginacao,
  pessoaPorId, pessoas, setores, sha256, texto, unidades, proibido,
  type Ctx, type Executor, type PessoaOrg, type Rota,
} from '../nucleo.js'
import { enviarEmail, emailConfigurado, type StatusEnvio } from '../email.js'
import { urlPortal } from '../../_lib.js'
import {
  calcularResultados, resultadosParaCsv, resumoExecutivo, suprimirGrupos, type RespostaBruta, type VersaoEstrutura,
} from '../../../src/domain/v2/pesquisaCalculo.js'
import {
  resolverPublico, tempoEstimadoMin, textoConfidencialidade, TIPOS, tipoTemOpcoes, tipoTexto, validarEstrutura, validarRespostas,
  type CriteriosPublico, type PerguntaPesquisa,
} from '../../../src/domain/v2/pesquisaTipos.js'
import { modeloPorChave } from '../../../src/domain/v2/pesquisaModelos.js'

const MODOS = ['anonima', 'identificada'] as const
const COLS = `p.id, p.titulo, p.descricao, p.objetivo, p.categoria, p.modelo_chave, p.modo, p.status,
  to_char(p.inicio,'YYYY-MM-DD') as inicio, to_char(p.fim,'YYYY-MM-DD') as fim, p.min_grupo, p.publico, p.intro, p.mensagem_final,
  p.finalidade, p.quem_acessa, p.config, p.rascunho_perguntas, p.versao_atual, p.link_publico_ativo, p.criado_por, p.criado_em,
  p.atualizado_em, p.publicada_em, p.encerrada_em`
const CONTAGENS = `(select count(*) from pq_convites c where c.pesquisa_id = p.id)::int as convidados,
  (select count(*) from pq_convites c where c.pesquisa_id = p.id and c.status = 'pendente')::int as pendentes,
  (select count(*) from pq_respostas r where r.pesquisa_id = p.id)::int as respostas`

/* ---------- utilidades ---------- */
function saida(l: Record<string, any>) {
  const { rascunho_perguntas, ...resto } = l
  const o = camel(resto) as Record<string, any>
  o.perguntas = rascunho_perguntas ?? []
  if (typeof o.convidados === 'number') o.taxaResposta = !o.linkPublicoAtivo && o.convidados > 0 ? Math.round((o.respostas / o.convidados) * 1000) / 10 : null
  return o
}

async function carregar(ex: Executor, id: string, extra = '') {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw naoEncontrado('Pesquisa não encontrada.')
  const r = await ex.query(`select ${COLS}${extra ? ', ' + extra : ''} from pq_pesquisas p where p.id = $1`, [id])
  if (!r.rows[0]) throw naoEncontrado('Pesquisa não encontrada.')
  return r.rows[0]
}

async function evento(ex: Executor, pesquisaId: string, quem: string | null, tipo: string, detalhes: Record<string, unknown> = {}) {
  await ex.query('insert into pq_eventos (pesquisa_id, colaborador_id, tipo, detalhes) values ($1,$2,$3,$4::jsonb)', [pesquisaId, quem, tipo, JSON.stringify(detalhes)])
}

/* ---------- plano de ação (pq_acoes) ---------- */
const STATUS_ACAO = ['planejada', 'em_andamento', 'concluida', 'cancelada'] as const
const COLS_ACAO = `a.id, a.pesquisa_id, a.dimensao, a.problema, a.acao, a.responsavel_id, to_char(a.prazo,'YYYY-MM-DD') as prazo, a.status, a.indicador, a.conclusao,
  to_char(a.concluida_em,'YYYY-MM-DD') as concluida_em, a.criado_em, a.atualizado_em`

async function lerUmaAcao(ex: Executor, id: string) {
  return (await ex.query(`select ${COLS_ACAO} from pq_acoes a where a.id = $1`, [id])).rows[0] as Record<string, any>
}

function saidaAcao(x: Record<string, any>, nomes: Map<string, string>, hoje: string) {
  const o = camel(x) as Record<string, any>
  o.responsavelNome = x.responsavel_id ? nomes.get(x.responsavel_id) ?? null : null
  o.atrasada = !!x.prazo && x.prazo < hoje && (x.status === 'planejada' || x.status === 'em_andamento')
  return o
}

/** Lê os campos de uma ação. Em `novo`, problema e ação são obrigatórios; na edição, só o que veio no corpo. */
async function lerAcao(ex: Executor, b: Record<string, unknown>, novo: boolean): Promise<Record<string, unknown>> {
  const v: Record<string, unknown> = {}
  const tem = (k: string) => novo || Object.prototype.hasOwnProperty.call(b, k)
  if (tem('problema')) v.problema = texto(b.problema, 'problema', { max: 1000 })
  if (tem('acao')) v.acao = texto(b.acao, 'acao', { max: 1000 })
  if (tem('dimensao')) v.dimensao = texto(b.dimensao, 'dimensao', { max: 120, obrigatorio: false }) || null
  if (tem('indicador')) v.indicador = texto(b.indicador, 'indicador', { max: 300, obrigatorio: false }) || null
  if (tem('conclusao')) v.conclusao = texto(b.conclusao, 'conclusao', { max: 2000, obrigatorio: false }) || null
  if (tem('prazo')) v.prazo = dataISO(b.prazo, 'prazo')
  if (tem('status') && (b.status !== undefined || !novo)) v.status = enumerado(b.status, 'status', STATUS_ACAO, 'planejada')
  if (tem('responsavelId')) {
    const id = typeof b.responsavelId === 'string' && b.responsavelId.trim() ? b.responsavelId.trim() : null
    if (id) {
      const p = await pessoaPorId(ex, id)
      if (!p || p.status === 'encerrado') throw invalido('Responsável não encontrado.', { responsavelId: 'Selecione uma pessoa ativa' })
    }
    v.responsavel_id = id
  }
  return v
}

/** Agendadas começam; abertas/pausadas vencidas encerram. Chamado de forma preguiçosa (não há cron). */
async function avancarEstados(ex: Executor, hoje: string) {
  await ex.query("update pq_pesquisas set status = 'aberta', atualizado_em = now() where status = 'agendada' and inicio <= $1::date", [hoje])
  const venc = await ex.query(
    "update pq_pesquisas set status = 'encerrada', encerrada_em = now(), atualizado_em = now() where status in ('aberta','pausada') and fim < $1::date returning id", [hoje])
  for (const v of venc.rows) {
    await ex.query("update pq_convites set status = 'revogado' where pesquisa_id = $1 and status = 'pendente'", [v.id])
    await evento(ex, v.id, null, 'encerrada_automaticamente', {})
  }
}

function limparPerguntas(raw: unknown): PerguntaPesquisa[] {
  if (!Array.isArray(raw)) throw invalido('Perguntas inválidas.')
  if (raw.length > 100) throw invalido('No máximo 100 perguntas por pesquisa.')
  const tipos = TIPOS.map((t) => t.tipo)
  return raw.map((x: any, i) => {
    if (!x || typeof x !== 'object') throw invalido(`Pergunta ${i + 1} inválida.`)
    if (!tipos.includes(x.tipo)) throw invalido(`Pergunta ${i + 1}: tipo inválido.`)
    const p: PerguntaPesquisa = {
      id: String(x.id ?? '').slice(0, 40), tipo: x.tipo, texto: String(x.texto ?? '').slice(0, 500), obrigatoria: x.obrigatoria !== false,
    }
    if (x.descricao) p.descricao = String(x.descricao).slice(0, 500)
    if (x.dimensao) p.dimensao = String(x.dimensao).slice(0, 60)
    if (tipoTemOpcoes(x.tipo)) p.opcoes = (Array.isArray(x.opcoes) ? x.opcoes : []).slice(0, 20).map((o: unknown) => String(o ?? '').slice(0, 200))
    if (x.tipo === 'escala') p.escala = { min: Number(x.escala?.min), max: Number(x.escala?.max), rotuloMin: x.escala?.rotuloMin ? String(x.escala.rotuloMin).slice(0, 60) : undefined, rotuloMax: x.escala?.rotuloMax ? String(x.escala.rotuloMax).slice(0, 60) : undefined }
    if (x.condicao && typeof x.condicao === 'object') {
      const op = ['igual', 'diferente', 'maior_igual', 'menor_igual', 'contem', 'respondida']
      if (!op.includes(x.condicao.operador)) throw invalido(`Pergunta ${i + 1}: condição inválida.`)
      p.condicao = { perguntaId: String(x.condicao.perguntaId ?? ''), operador: x.condicao.operador, valor: x.condicao.valor === undefined ? undefined : typeof x.condicao.valor === 'number' ? x.condicao.valor : String(x.condicao.valor).slice(0, 200) }
    }
    return p
  })
}

function limparCriterios(raw: any): CriteriosPublico {
  const ids = (v: unknown) => (Array.isArray(v) ? [...new Set(v.map((x) => String(x)).filter(Boolean))].slice(0, 2000) : undefined)
  const c: CriteriosPublico = {}
  if (raw?.todos === true) c.todos = true
  for (const k of ['unidadeIds', 'setorIds', 'gestorIds', 'cargoIds', 'pessoaIds', 'excluirIds'] as const) { const v = ids(raw?.[k]); if (v?.length) c[k] = v }
  return c
}

const elegiveisDe = (c: CriteriosPublico, gente: PessoaOrg[]) => resolverPublico(c, gente)

function grupoDe(p: PessoaOrg | null, setorUnidade: Map<string, string | undefined>): { setorId?: string; unidadeId?: string } {
  if (!p) return {}
  return { setorId: p.setorId || undefined, unidadeId: p.unidadeId || setorUnidade.get(p.setorId) || undefined }
}

/** Cria convites (um por pessoa) e devolve os tokens em claro — só existem em memória, para os links. */
async function criarConvites(ex: Executor, pesquisaId: string, ids: string[], fim: string): Promise<Map<string, string>> {
  const tokens = new Map<string, string>()
  for (const colaboradorId of ids) {
    const token = novoToken()
    const r = await ex.query(
      `insert into pq_convites (pesquisa_id, colaborador_id, token_hash, expira_em) values ($1,$2,$3, ($4::date + 1)::timestamptz)
       on conflict (pesquisa_id, colaborador_id) do nothing returning id`, [pesquisaId, colaboradorId, hashToken(token), fim])
    if (r.rowCount) tokens.set(colaboradorId, token)
  }
  return tokens
}

interface ResumoEnvio { internas: number; email: Record<StatusEnvio, number>; emailConfigurado: boolean }

/** Notificação interna + e-mail (status real; nunca finge envio). Rodar FORA de transações longas. */
async function avisarConvidados(ctx: Ctx, pesquisa: Record<string, any>, tokens: Map<string, string>, lembrete = false): Promise<ResumoEnvio> {
  const { db } = ctx
  const gente = new Map((await pessoas(db)).map((p) => [p.id, p]))
  const resumo: ResumoEnvio = { internas: 0, email: { enviada: 0, falhou: 0, nao_configurado: 0 }, emailConfigurado: emailConfigurado() }
  const dia = hojeISO(ctx.agora)
  const fila = [...tokens.entries()]
  for (const [colabId] of fila) {
    await notificar(db, {
      destinatarioId: colabId, tipo: 'pesquisa', titulo: lembrete ? `Lembrete: pesquisa "${pesquisa.titulo}"` : `Nova pesquisa: ${pesquisa.titulo}`,
      corpo: `Responda até ${pesquisa.fim?.split('-').reverse().join('/')}.`, link: '/pesquisas', chave: lembrete ? `pq-lembrete-${pesquisa.id}-${dia}` : `pq-conv-${pesquisa.id}`,
    })
    resumo.internas++
  }
  // E-mails em lotes pequenos (limite de tempo da função serverless).
  for (let i = 0; i < fila.length; i += 8) {
    await Promise.all(fila.slice(i, i + 8).map(async ([colabId, token]) => {
      const p = gente.get(colabId)
      if (!p?.email) return
      const link = `${urlPortal()}/responder/${token}`
      const anon = pesquisa.modo === 'anonima'
      const corpo = `Olá, ${(p.nomeSocial || p.nome).split(' ')[0]}!\n\n${lembrete ? 'Lembrando que' : 'Convidamos você a responder à pesquisa'} "${pesquisa.titulo}".\n\n` +
        `Prazo: ${pesquisa.fim?.split('-').reverse().join('/')}.\nResponder: ${link}\n\n` +
        (anon ? 'Esta pesquisa é anônima: o link é pessoal e de uso único, mas sua resposta não é gravada com o seu nome.' : 'Atenção: esta pesquisa é identificada; suas respostas ficam associadas ao seu nome.') +
        '\n\nO link vale somente para você. Não o encaminhe.'
      const r = await enviarEmail(p.email, lembrete ? `Lembrete: ${pesquisa.titulo}` : `Pesquisa: ${pesquisa.titulo}`, corpo)
      resumo.email[r.status]++
      await db.query("update pq_convites set canal = case when $3 = 'enviada' then 'email' else canal end, email_status = $3, email_erro = $4, enviado_em = case when $3 = 'enviada' then now() else enviado_em end where pesquisa_id = $1 and colaborador_id = $2",
        [pesquisa.id, colabId, r.status, r.erro ?? null])
    }))
  }
  return resumo
}

function dadosPublicos(p: Record<string, any>, perguntas: PerguntaPesquisa[], via: 'convite' | 'link') {
  return {
    // pesquisaId: chave estável do rascunho local (o token muda a cada lembrete ou abertura pelo portal).
    pesquisaId: p.id, titulo: p.titulo, intro: p.intro, objetivo: p.objetivo, mensagemFinal: p.mensagem_final, modo: p.modo, via,
    confidencialidade: textoConfidencialidade(p.modo, via, p.min_grupo, p.finalidade, p.quem_acessa),
    tempoMin: tempoEstimadoMin(perguntas), prazo: p.fim, perguntas, barraProgresso: p.config?.barraProgresso !== false,
    salvaProgresso: p.modo === 'identificada' && via === 'convite',
  }
}

/* ---------- resolução do token do respondente ---------- */
async function resolverToken(ex: Executor, token: string, agora: Date) {
  await avancarEstados(ex, hojeISO(agora))
  if (!token || token.length < 20 || token.length > 100) throw naoEncontrado('Link inválido.')
  const h = hashToken(token)
  let via: 'convite' | 'link' = 'convite'
  let convite: Record<string, any> | null = null
  let pesquisaId: string | null = null
  const c = await ex.query('select id, pesquisa_id, colaborador_id, status, expira_em from pq_convites where token_hash = $1', [h])
  if (c.rows[0]) { convite = c.rows[0]; pesquisaId = c.rows[0].pesquisa_id }
  else {
    const l = await ex.query('select id from pq_pesquisas where link_publico_hash = $1 and link_publico_ativo', [h])
    if (!l.rows[0]) throw naoEncontrado('Link inválido ou desativado.')
    via = 'link'; pesquisaId = l.rows[0].id
  }
  const p = (await ex.query(`select ${COLS} from pq_pesquisas p where p.id = $1`, [pesquisaId])).rows[0]
  if (convite) {
    if (convite.status === 'usado') throw new ErroHttp(410, 'Este link já foi usado. Cada convite aceita uma única resposta.')
    if (convite.status === 'revogado') throw new ErroHttp(410, 'Este link não é mais válido.')
    if (new Date(convite.expira_em).getTime() < agora.getTime()) throw new ErroHttp(410, 'Este link expirou.')
  }
  if (p.status === 'encerrada') throw new ErroHttp(410, 'A coleta desta pesquisa foi encerrada.')
  if (p.status === 'pausada') throw new ErroHttp(403, 'Esta pesquisa está temporariamente pausada.')
  if (p.status === 'agendada') throw new ErroHttp(403, `Esta pesquisa começa em ${String(p.inicio).split('-').reverse().join('/')}.`)
  if (p.status !== 'aberta') throw naoEncontrado('Pesquisa indisponível.')
  const v = (await ex.query('select perguntas from pq_versoes where pesquisa_id = $1 and versao = $2', [p.id, p.versao_atual])).rows[0]
  if (!v) throw naoEncontrado('Pesquisa indisponível.')
  return { via, convite, pesquisa: p, perguntas: v.perguntas as PerguntaPesquisa[] }
}

/* ---------- resultados ---------- */
async function montarResultados(ctx: Ctx, id: string, filtro: { setorId?: string; unidadeId?: string }) {
  const { db } = ctx
  const p = await carregar(db, id, CONTAGENS)
  const versoes = (await db.query('select versao, perguntas from pq_versoes where pesquisa_id = $1 order by versao', [id])).rows as VersaoEstrutura[]
  const rs = (await db.query("select id, versao, to_char(enviada_em,'YYYY-MM-DD') as enviada_em, grupo, itens from pq_respostas where pesquisa_id = $1", [id])).rows
  const tags = (await db.query('select t.resposta_id, t.pergunta_id, t.tag from pq_tags t join pq_respostas r on r.id = t.resposta_id where r.pesquisa_id = $1', [id])).rows
  const tagMap = new Map<string, Record<string, string[]>>()
  for (const t of tags) { const m = tagMap.get(t.resposta_id) ?? {}; (m[t.pergunta_id] ??= []).push(t.tag); tagMap.set(t.resposta_id, m) }
  const brutas: RespostaBruta[] = rs.map((r) => ({ id: r.id, versao: r.versao, enviadaEm: r.enviada_em, grupo: r.grupo ?? {}, itens: r.itens ?? {}, tags: tagMap.get(r.id) }))
  const rotulosSetor = Object.fromEntries((await setores(db)).map((s) => [s.id, s.nome]))
  const rotulosUnidade = Object.fromEntries((await unidades(db)).map((u) => [u.id, u.nome]))
  const comLink = !!p.link_publico_ativo || rs.some((r) => r.grupo?.via === 'link')
  const res = calcularResultados({
    versoes, respostas: brutas, elegiveis: comLink ? 0 : p.convidados, convidados: p.convidados, minGrupo: p.min_grupo,
    filtro, rotulosSetor, rotulosUnidade, incluirTextos: true,
  })
  return { pesquisa: saida(p), resultados: res, resumo: resumoExecutivo(res, p.titulo), comLinkPublico: comLink }
}

/* ============================================================
   ROTAS — ordem importa: rotas estáticas antes das com :id
   ============================================================ */
export const rotas: Rota[] = [
  /* ---------- pessoa autenticada: meus convites ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas/meus-convites',
    h: async ({ db, usuario, agora }) => {
      await avancarEstados(db, hojeISO(agora))
      const r = await db.query(
        `select c.id, p.titulo, p.modo, to_char(p.fim,'YYYY-MM-DD') as fim, p.versao_atual, p.id as pesquisa_id
         from pq_convites c join pq_pesquisas p on p.id = c.pesquisa_id
         where c.colaborador_id = $1 and c.status = 'pendente' and p.status = 'aberta' and c.expira_em > now() order by p.fim`, [usuario.colaboradorId])
      const itens = []
      for (const x of r.rows) {
        const v = (await db.query('select perguntas from pq_versoes where pesquisa_id = $1 and versao = $2', [x.pesquisa_id, x.versao_atual])).rows[0]
        itens.push({ conviteId: x.id, titulo: x.titulo, modo: x.modo, prazo: x.fim, tempoMin: v ? tempoEstimadoMin(v.perguntas) : null })
      }
      return ok({ itens })
    },
  },
  {
    // O token em claro não é guardado; ao abrir, gera-se um novo (o anterior deixa de valer).
    metodo: 'POST', padrao: 'pesquisas/meus-convites/:id/abrir',
    h: async ({ db, usuario, params, agora }) => {
      if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw naoEncontrado()
      const token = novoToken()
      const r = await db.query(
        `update pq_convites c set token_hash = $3 from pq_pesquisas p
         where c.id = $1 and c.colaborador_id = $2 and c.status = 'pendente' and p.id = c.pesquisa_id and p.status = 'aberta' and c.expira_em > $4::timestamptz returning c.id`,
        [params.id, usuario.colaboradorId, hashToken(token), agora.toISOString()])
      if (!r.rowCount) throw naoEncontrado('Convite indisponível.')
      return ok({ token })
    },
  },

  /* ---------- painel ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas/painel', cap: 'pesq:gerenciar',
    h: async (ctx) => {
      const { db, agora, usuario } = ctx
      const hoje = hojeISO(agora)
      await avancarEstados(db, hoje)
      const porStatus = Object.fromEntries((await db.query('select status, count(*)::int as n from pq_pesquisas group by status')).rows.map((r) => [r.status, r.n]))
      const ativas = (await db.query(`select ${COLS}, ${CONTAGENS} from pq_pesquisas p where p.status in ('aberta','pausada','agendada') order by p.fim`)).rows
      const convidados = ativas.reduce((a, p) => a + p.convidados, 0)
      const respondidas = ativas.reduce((a, p) => a + p.respostas, 0)
      const pend = ativas.filter((p) => p.status === 'aberta').reduce((a, p) => a + p.pendentes, 0)
      // Alertas
      const alertas: { tipo: string; pesquisaId: string; titulo: string; mensagem: string }[] = []
      for (const p of ativas.filter((x) => x.status === 'aberta')) {
        const dias = Math.round((Date.parse(p.fim) - Date.parse(hoje)) / 86400000)
        const taxa = p.convidados ? (p.respostas / p.convidados) * 100 : null
        if (dias <= 3 && (taxa === null || taxa < 60)) alertas.push({ tipo: 'fim_proximo', pesquisaId: p.id, titulo: p.titulo, mensagem: `Encerra em ${dias <= 0 ? 'hoje' : dias + ' dia(s)'}` + (taxa === null ? '' : ` com ${Math.round(taxa)}% de participação.`) })
        const total = Math.max(1, Math.round((Date.parse(p.fim) - Date.parse(String(p.inicio))) / 86400000))
        const decorrido = (Date.parse(hoje) - Date.parse(String(p.inicio))) / 86400000
        if (taxa !== null && p.convidados >= 5 && decorrido / total >= 0.4 && taxa < 30) alertas.push({ tipo: 'baixa_adesao', pesquisaId: p.id, titulo: p.titulo, mensagem: `Participação de ${Math.round(taxa)}% com ${Math.round((decorrido / total) * 100)}% do prazo decorrido.` })
      }
      for (const a of alertas) {
        const dono = ativas.find((p) => p.id === a.pesquisaId)?.criado_por
        if (dono) await notificar(db, { destinatarioId: dono, tipo: 'pesquisa', titulo: a.tipo === 'fim_proximo' ? 'Pesquisa perto de encerrar' : 'Pesquisa com baixa participação', corpo: a.titulo, link: `/pesquisas-rh/${a.pesquisaId}/resultados`, chave: `pq-${a.tipo}-${a.pesquisaId}-${a.tipo === 'fim_proximo' ? hoje : hoje.slice(0, 8)}` })
      }
      // Respostas por dia (30 dias, só contagens)
      const dias = (await db.query(
        "select to_char(enviada_em,'YYYY-MM-DD') as data, count(*)::int as qtd from pq_respostas where enviada_em >= $1::date - 29 group by 1 order by 1", [hoje])).rows
      // Participação por área, com supressão de grupos pequenos
      const gente = await pessoas(db)
      const nomes = Object.fromEntries((await setores(db)).map((s) => [s.id, s.nome]))
      const convPorSetor = new Map<string, number>()
      const convs = (await db.query("select colaborador_id from pq_convites c join pq_pesquisas p on p.id = c.pesquisa_id where p.status in ('aberta','pausada','encerrada')")).rows
      for (const c of convs) { const s = gente.find((g) => g.id === c.colaborador_id)?.setorId; if (s) convPorSetor.set(s, (convPorSetor.get(s) ?? 0) + 1) }
      const respPorSetor = (await db.query("select grupo->>'setorId' as setor, count(*)::int as n from pq_respostas where grupo ? 'setorId' group by 1")).rows
      const contagens = [...convPorSetor.keys()].map((k) => ({ chave: k, n: respPorSetor.find((r) => r.setor === k)?.n ?? 0 }))
      const oculto = suprimirGrupos(contagens.filter((c) => c.n > 0), 5)
      const porArea = [...convPorSetor.entries()].map(([setorId, conv]) => {
        const n = respPorSetor.find((r) => r.setor === setorId)?.n ?? 0
        const suprimido = n > 0 ? !!oculto.get(setorId) : false
        return { setorId, area: nomes[setorId] ?? setorId, convidados: conv, respostas: suprimido ? null : n, taxa: suprimido || !conv ? null : Math.round((n / conv) * 100), suprimido }
      }).sort((a, b) => a.area.localeCompare(b.area))
      const recentes = (await db.query(`select ${COLS}, ${CONTAGENS} from pq_pesquisas p where p.status = 'encerrada' order by p.encerrada_em desc nulls last limit 5`)).rows.map(saida)
      void usuario
      return ok({
        porStatus: { rascunho: 0, agendada: 0, aberta: 0, pausada: 0, encerrada: 0, ...porStatus },
        elegiveis: convidados, convitesEnviados: convidados, respostas: respondidas, pendentes: pend,
        taxaResposta: convidados ? Math.round((respondidas / convidados) * 1000) / 10 : null,
        proximasDoFim: ativas.filter((p) => p.status === 'aberta' && Date.parse(p.fim) - Date.parse(hoje) <= 7 * 86400000).map((p) => ({ id: p.id, titulo: p.titulo, fim: p.fim, taxa: p.convidados ? Math.round((p.respostas / p.convidados) * 100) : null })),
        alertas, respostasPorDia: dias, participacaoPorArea: porArea, resultadosRecentes: recentes,
        ativas: ativas.map(saida),
        acoes: await resumoAcoes(db, hoje),
      })
    },
  },

  /* ---------- lista / criação ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas', cap: ['pesq:gerenciar', 'pesq:resultados'],
    h: async ({ db, req, agora }) => {
      await avancarEstados(db, hojeISO(agora))
      const { pagina, por, offset } = paginacao(req.query)
      const params: unknown[] = []
      let where = 'true'
      if (req.query.status) { params.push(req.query.status); where += ` and p.status = $${params.length}` }
      if (req.query.categoria) { params.push(req.query.categoria); where += ` and p.categoria = $${params.length}` }
      if (req.query.modo) { params.push(req.query.modo); where += ` and p.modo = $${params.length}` }
      if (req.query.q) { params.push(`%${req.query.q.toLowerCase()}%`); where += ` and lower(p.titulo) like $${params.length}` }
      if (req.query.de) { params.push(dataISO(req.query.de, 'de')); where += ` and p.fim >= $${params.length}::date` }
      if (req.query.ate) { params.push(dataISO(req.query.ate, 'ate')); where += ` and p.inicio <= $${params.length}::date` }
      const total = (await db.query(`select count(*)::int as n from pq_pesquisas p where ${where}`, params)).rows[0].n
      const r = await db.query(`select ${COLS}, ${CONTAGENS} from pq_pesquisas p where ${where} order by p.atualizado_em desc limit ${por} offset ${offset}`, params)
      return ok({ itens: r.rows.map(saida), total, pagina, por })
    },
  },
  {
    metodo: 'POST', padrao: 'pesquisas', cap: 'pesq:gerenciar',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const modelo = b.modeloChave ? modeloPorChave(String(b.modeloChave)) : undefined
      if (b.modeloChave && !modelo) throw invalido('Modelo não encontrado.')
      const titulo = texto(b.titulo ?? modelo?.titulo, 'título', { max: 160 })
      const modo = enumerado(b.modo ?? modelo?.modoSugerido, 'modo', MODOS, 'anonima')
      const id = await db.tx(async (t) => {
        const r = await t.query(
          `insert into pq_pesquisas (titulo, descricao, objetivo, categoria, modelo_chave, modo, intro, mensagem_final, rascunho_perguntas, criado_por)
           values ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb,$10) returning id`,
          [titulo, modelo?.descricao ?? null, modelo?.objetivo ?? null, modelo?.categoria ?? 'Personalizada', modelo?.chave ?? null, modo,
            modelo?.intro ?? null, modelo?.mensagemFinal ?? null, JSON.stringify(modelo?.perguntas ?? []), usuario.colaboradorId])
        await evento(t, r.rows[0].id, usuario.colaboradorId, 'criada', { modelo: modelo?.chave ?? null })
        await auditar(t, usuario.colaboradorId, 'pesquisa', r.rows[0].id, 'criada', { modo })
        return r.rows[0].id as string
      })
      return ok(saida(await carregar(db, id, CONTAGENS)), 201)
    },
  },

  /* ---------- automação de lembretes (manual ou por agendador externo) ---------- */
  {
    metodo: 'POST', padrao: 'pesquisas/automacoes/lembretes', cap: 'pesq:gerenciar',
    h: async (ctx) => {
      const { db, agora } = ctx
      const hoje = hojeISO(agora)
      await avancarEstados(db, hoje)
      const abertas = (await db.query(`select ${COLS} from pq_pesquisas p where p.status = 'aberta'`)).rows
      const feitos: { pesquisaId: string; titulo: string; lembretes: number }[] = []
      for (const p of abertas) {
        const dias: number[] = Array.isArray(p.config?.lembretesDias) ? p.config.lembretesDias : []
        const faltam = Math.round((Date.parse(p.fim) - Date.parse(hoje)) / 86400000)
        if (!dias.includes(faltam)) continue
        const n = await enviarLembretes(ctx, p)
        if (n.total) feitos.push({ pesquisaId: p.id, titulo: p.titulo, lembretes: n.total })
      }
      return ok({ processadas: feitos })
    },
  },

  /* ---------- respondente (PÚBLICO, por token) ---------- */
  {
    metodo: 'GET', padrao: 'responder/:token', publica: true, limite: 60,
    h: async ({ db, params, agora }) => {
      const { via, convite, pesquisa, perguntas } = await resolverToken(db, params.token, agora)
      const dados: Record<string, any> = dadosPublicos(pesquisa, perguntas, via)
      if (dados.salvaProgresso && convite) {
        const pr = await db.query('select itens from pq_progresso where convite_id = $1', [convite.id])
        dados.progresso = pr.rows[0]?.itens ?? {}
      }
      return ok(dados)
    },
  },
  {
    metodo: 'PUT', padrao: 'responder/:token/progresso', publica: true, limite: 60,
    h: async ({ db, params, req, agora }) => {
      const { convite, pesquisa, perguntas } = await resolverToken(db, params.token, agora)
      if (!convite || pesquisa.modo !== 'identificada') throw invalido('Esta pesquisa não permite salvar o progresso no servidor.')
      const itens = req.corpo?.respostas
      if (!itens || typeof itens !== 'object' || Array.isArray(itens)) throw invalido('Respostas inválidas.')
      const ids = new Set(perguntas.map((q) => q.id))
      const limpo = Object.fromEntries(Object.entries(itens).filter(([k]) => ids.has(k)))
      if (JSON.stringify(limpo).length > 200_000) throw invalido('Conteúdo muito grande.')
      await db.query('insert into pq_progresso (convite_id, itens) values ($1,$2::jsonb) on conflict (convite_id) do update set itens = excluded.itens, atualizado_em = now()', [convite.id, JSON.stringify(limpo)])
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'responder/:token', publica: true, limite: 30,
    h: async ({ db, params, req, agora }) => {
      const { via, convite, pesquisa, perguntas } = await resolverToken(db, params.token, agora)
      const brutas = req.corpo?.respostas
      if (!brutas || typeof brutas !== 'object' || Array.isArray(brutas)) throw invalido('Envie as respostas.')
      const { erros, limpas } = validarRespostas(perguntas, brutas)
      if (Object.keys(erros).length) throw invalido('Revise as respostas destacadas.', erros)
      const hoje = hojeISO(agora)
      const gente = await pessoas(db)
      const setorUnidade = new Map((await setores(db)).map((s) => [s.id, s.unidadeId]))
      await db.tx(async (t) => {
        let colaboradorId: string | null = null
        let grupo: Record<string, string | undefined> = {}
        if (via === 'convite' && convite) {
          // Consome o convite (uso único). A data de uso é só o dia; nada liga o convite à resposta.
          const u = await t.query("update pq_convites set status = 'usado', usado_em = $2::date where id = $1 and status = 'pendente' returning colaborador_id", [convite.id, hoje])
          if (!u.rowCount) throw conflito('Este convite já foi usado.')
          const pessoa = gente.find((g) => g.id === convite.colaborador_id) ?? null
          grupo = grupoDe(pessoa, setorUnidade)
          if (pesquisa.modo === 'identificada') colaboradorId = convite.colaborador_id
          await t.query('delete from pq_progresso where convite_id = $1', [convite.id])
        } else {
          const marca = typeof req.corpo?.marca === 'string' ? req.corpo.marca : ''
          if (marca.length < 16 || marca.length > 100) throw invalido('Não foi possível validar o navegador. Recarregue a página.')
          const m = await t.query('insert into pq_link_marcas (pesquisa_id, marca_hash) values ($1,$2) on conflict do nothing returning 1', [pesquisa.id, sha256(Buffer.from(pesquisa.id + marca))])
          if (!m.rowCount) throw conflito('Este navegador já enviou uma resposta para esta pesquisa.')
          grupo = { via: 'link' }
        }
        await t.query('insert into pq_respostas (pesquisa_id, versao, enviada_em, grupo, colaborador_id, itens) values ($1,$2,$3::date,$4::jsonb,$5,$6::jsonb)',
          [pesquisa.id, pesquisa.versao_atual, hoje, JSON.stringify(grupo), colaboradorId, JSON.stringify(limpas)])
      })
      return ok({ ok: true, mensagemFinal: pesquisa.mensagem_final || 'Obrigado por responder!' }, 201)
    },
  },

  /* ---------- detalhe e edição ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas/:id', cap: ['pesq:gerenciar', 'pesq:resultados'],
    h: async ({ db, params, usuario, agora }) => {
      await avancarEstados(db, hojeISO(agora))
      const p = await carregar(db, params.id, CONTAGENS)
      const versoes = (await db.query('select versao, titulo, publicada_em, publicada_por, jsonb_array_length(perguntas)::int as perguntas from pq_versoes where pesquisa_id = $1 order by versao desc', [params.id])).rows
      const eventos = (await db.query('select id, em, colaborador_id, tipo, detalhes from pq_eventos where pesquisa_id = $1 order by em desc, id desc limit 60', [params.id])).rows
      const out = saida(p)
      if (!usuario.caps.has('pesq:gerenciar')) out.perguntas = []
      return ok({ ...out, versoes: versoes.map(camel), historico: eventos.map(camel) })
    },
  },
  {
    metodo: 'PUT', padrao: 'pesquisas/:id', cap: 'pesq:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const p = await carregar(db, params.id)
      if (p.status === 'encerrada') throw conflito('Pesquisa encerrada não pode ser alterada. Duplique-a para reutilizar.')
      const b = req.corpo ?? {}
      const sets: string[] = [], vals: unknown[] = [], mudou: string[] = []
      const set = (col: string, v: unknown, campo: string, cast = '') => { vals.push(v); sets.push(`${col} = $${vals.length}${cast}`); mudou.push(campo) }
      if (b.titulo !== undefined) set('titulo', texto(b.titulo, 'título', { max: 160 }), 'titulo')
      for (const [k, col] of [['descricao', 'descricao'], ['objetivo', 'objetivo'], ['intro', 'intro'], ['mensagemFinal', 'mensagem_final'], ['finalidade', 'finalidade'], ['quemAcessa', 'quem_acessa']] as const) {
        if (b[k] !== undefined) set(col, texto(b[k], k, { obrigatorio: false, max: 3000 }) || null, k)
      }
      if (b.categoria !== undefined) set('categoria', texto(b.categoria, 'categoria', { max: 80 }), 'categoria')
      if (b.modo !== undefined && b.modo !== p.modo) {
        if (p.versao_atual > 0) throw conflito('O modo (anônima/identificada) não pode mudar depois da primeira publicação. Duplique a pesquisa.')
        set('modo', enumerado(b.modo, 'modo', MODOS), 'modo')
      }
      if (b.inicio !== undefined) set('inicio', dataISO(b.inicio, 'início'), 'inicio', '::date')
      if (b.fim !== undefined) set('fim', dataISO(b.fim, 'fim'), 'fim', '::date')
      if (b.minGrupo !== undefined) set('min_grupo', inteiro(b.minGrupo, 'mínimo por grupo', { min: 3, max: 50 }), 'minGrupo')
      if (b.publico !== undefined) set('publico', JSON.stringify(limparCriterios(b.publico)), 'publico', '::jsonb')
      if (b.config !== undefined && typeof b.config === 'object') {
        const dias = Array.isArray(b.config.lembretesDias) ? [...new Set<number>(b.config.lembretesDias.map(Number).filter((n: number) => Number.isInteger(n) && n >= 0 && n <= 60))].sort((a, c) => c - a) : []
        set('config', JSON.stringify({ barraProgresso: b.config.barraProgresso !== false, lembretesDias: dias }), 'config', '::jsonb')
      }
      if (b.perguntas !== undefined) set('rascunho_perguntas', JSON.stringify(limparPerguntas(b.perguntas)), 'perguntas', '::jsonb')
      if (!sets.length) return ok(saida(await carregar(db, params.id, CONTAGENS)))
      vals.push(params.id)
      await db.tx(async (t) => {
        await t.query(`update pq_pesquisas set ${sets.join(', ')}, atualizado_em = now() where id = $${vals.length}`, vals)
        await evento(t, params.id, usuario.colaboradorId, 'editada', { campos: mudou })
        await auditar(t, usuario.colaboradorId, 'pesquisa', params.id, 'editada', { campos: mudou })
      })
      return ok(saida(await carregar(db, params.id, CONTAGENS)))
    },
  },

  /* ---------- público elegível (prévia) ---------- */
  {
    metodo: 'POST', padrao: 'pesquisas/:id/elegiveis', cap: 'pesq:gerenciar',
    h: async ({ db, params, req }) => {
      const p = await carregar(db, params.id)
      const criterios = req.corpo?.publico !== undefined ? limparCriterios(req.corpo.publico) : (p.publico as CriteriosPublico)
      const gente = await pessoas(db)
      const ids = new Set(elegiveisDe(criterios, gente))
      const nomes = Object.fromEntries((await setores(db)).map((s) => [s.id, s.nome]))
      const porSetor = new Map<string, number>()
      for (const g of gente) if (ids.has(g.id)) porSetor.set(g.setorId, (porSetor.get(g.setorId) ?? 0) + 1)
      const convidados = new Set((await db.query('select colaborador_id from pq_convites where pesquisa_id = $1', [params.id])).rows.map((r) => r.colaborador_id))
      return ok({
        total: ids.size, jaConvidados: [...ids].filter((i) => convidados.has(i)).length, novos: [...ids].filter((i) => !convidados.has(i)).length,
        porArea: [...porSetor.entries()].map(([setorId, n]) => ({ setorId, area: nomes[setorId] ?? setorId, n })).sort((a, b) => b.n - a.n),
        regra: 'Pessoas com parceria encerrada não entram. Dentro de cada critério vale "ou"; entre critérios diferentes vale "e". Pessoas avulsas são somadas e exclusões sempre retiram.',
      })
    },
  },

  /* ---------- publicar / ciclo de vida ---------- */
  {
    metodo: 'POST', padrao: 'pesquisas/:id/publicar', cap: 'pesq:gerenciar',
    h: async (ctx) => {
      const { db, params, usuario, agora } = ctx
      const hoje = hojeISO(agora)
      const p = await carregar(db, params.id)
      if (p.status === 'encerrada') throw conflito('Pesquisa encerrada não pode ser publicada.')
      const perguntas = (p.rascunho_perguntas ?? []) as PerguntaPesquisa[]
      const erroEstrutura = validarEstrutura(perguntas)
      if (erroEstrutura) throw invalido(erroEstrutura)
      if (!p.fim) throw invalido('Defina a data de término.', { fim: 'Obrigatório' })
      const inicio: string = p.inicio ?? hoje
      if (p.fim < inicio) throw invalido('O término não pode ser anterior ao início.', { fim: 'Anterior ao início' })
      if (p.fim < hoje) throw invalido('A data de término já passou.', { fim: 'Já passou' })
      if (p.modo === 'identificada' && (!p.finalidade || !p.quem_acessa)) throw invalido('Pesquisa identificada exige informar a finalidade e quem poderá acessar as respostas.', { finalidade: 'Obrigatório' })
      const gente = await pessoas(db)
      const elegiveis = elegiveisDe(p.publico as CriteriosPublico, gente)
      const primeira = p.versao_atual === 0
      if (primeira && !elegiveis.length && !p.link_publico_ativo) throw invalido('Nenhuma pessoa elegível. Ajuste o público antes de publicar.')
      const ultima = primeira ? null : (await db.query('select perguntas, titulo, intro, mensagem_final from pq_versoes where pesquisa_id = $1 and versao = $2', [p.id, p.versao_atual])).rows[0]
      const mudouEstrutura = primeira || JSON.stringify(ultima.perguntas) !== JSON.stringify(perguntas) || ultima.titulo !== p.titulo || (ultima.intro ?? null) !== (p.intro ?? null) || (ultima.mensagem_final ?? null) !== (p.mensagem_final ?? null)
      const nova = mudouEstrutura ? p.versao_atual + 1 : p.versao_atual
      const status = p.status === 'rascunho' ? (inicio > hoje ? 'agendada' : 'aberta') : p.status
      const tokens = await db.tx(async (t) => {
        if (mudouEstrutura) await t.query('insert into pq_versoes (pesquisa_id, versao, titulo, intro, mensagem_final, modo, perguntas, publicada_por) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8)',
          [p.id, nova, p.titulo, p.intro, p.mensagem_final, p.modo, JSON.stringify(perguntas), usuario.colaboradorId])
        await t.query('update pq_pesquisas set status = $2, versao_atual = $3, inicio = $4::date, publicada_em = coalesce(publicada_em, now()), atualizado_em = now() where id = $1', [p.id, status, nova, inicio])
        const tk = primeira ? await criarConvites(t, p.id, elegiveis, p.fim) : new Map<string, string>()
        await evento(t, p.id, usuario.colaboradorId, primeira ? 'publicada' : mudouEstrutura ? 'nova_versao' : 'republicada', { versao: nova, elegiveis: primeira ? elegiveis.length : undefined })
        await auditar(t, usuario.colaboradorId, 'pesquisa', p.id, primeira ? 'publicada' : 'nova_versao', { versao: nova, modo: p.modo })
        return tk
      })
      const envio = tokens.size ? await avisarConvidados(ctx, { ...p, inicio }, tokens) : null
      return ok({ status, versao: nova, novaVersao: mudouEstrutura, convitesCriados: tokens.size, envio, pesquisa: saida(await carregar(db, p.id, CONTAGENS)) })
    },
  },
  ...(['pausar', 'retomar', 'encerrar'] as const).map((acao): Rota => ({
    metodo: 'POST', padrao: `pesquisas/:id/${acao}`, cap: 'pesq:gerenciar',
    h: async ({ db, params, usuario }) => {
      const p = await carregar(db, params.id)
      const permitido: Record<string, string[]> = { pausar: ['aberta'], retomar: ['pausada'], encerrar: ['aberta', 'pausada', 'agendada'] }
      if (!permitido[acao].includes(p.status)) throw conflito(`Não é possível ${acao} uma pesquisa ${p.status}.`)
      const novo = acao === 'pausar' ? 'pausada' : acao === 'retomar' ? 'aberta' : 'encerrada'
      await db.tx(async (t) => {
        await t.query(`update pq_pesquisas set status = $2, atualizado_em = now()${novo === 'encerrada' ? ', encerrada_em = now()' : ''} where id = $1`, [p.id, novo])
        if (novo === 'encerrada') await t.query("update pq_convites set status = 'revogado' where pesquisa_id = $1 and status = 'pendente'", [p.id])
        await evento(t, p.id, usuario.colaboradorId, acao === 'encerrar' ? 'encerrada' : acao === 'pausar' ? 'pausada' : 'retomada')
        await auditar(t, usuario.colaboradorId, 'pesquisa', p.id, acao)
      })
      return ok(saida(await carregar(db, p.id, CONTAGENS)))
    },
  })),
  {
    metodo: 'POST', padrao: 'pesquisas/:id/duplicar', cap: 'pesq:gerenciar',
    h: async ({ db, params, usuario }) => {
      const p = await carregar(db, params.id)
      const r = await db.tx(async (t) => {
        const n = await t.query(
          `insert into pq_pesquisas (titulo, descricao, objetivo, categoria, modelo_chave, modo, min_grupo, publico, intro, mensagem_final, finalidade, quem_acessa, config, rascunho_perguntas, criado_por)
           values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,$10,$11,$12,$13::jsonb,$14::jsonb,$15) returning id`,
          [`${p.titulo} (cópia)`.slice(0, 160), p.descricao, p.objetivo, p.categoria, p.modelo_chave, p.modo, p.min_grupo, JSON.stringify(p.publico), p.intro, p.mensagem_final, p.finalidade, p.quem_acessa,
            JSON.stringify(p.config), JSON.stringify(p.rascunho_perguntas), usuario.colaboradorId])
        await evento(t, n.rows[0].id, usuario.colaboradorId, 'criada', { duplicadaDe: p.id })
        await auditar(t, usuario.colaboradorId, 'pesquisa', n.rows[0].id, 'duplicada', { origem: p.id })
        return n.rows[0].id as string
      })
      return ok(saida(await carregar(db, r, CONTAGENS)), 201)
    },
  },

  /* ---------- distribuição ---------- */
  {
    metodo: 'POST', padrao: 'pesquisas/:id/convidar-novos', cap: 'pesq:gerenciar',
    h: async (ctx) => {
      const { db, params, usuario } = ctx
      const p = await carregar(db, params.id)
      if (!['aberta', 'agendada', 'pausada'].includes(p.status)) throw conflito('Só é possível convidar enquanto a coleta não terminou.')
      const gente = await pessoas(db)
      const elegiveis = elegiveisDe(p.publico as CriteriosPublico, gente)
      const tokens = await db.tx(async (t) => {
        const tk = await criarConvites(t, p.id, elegiveis, p.fim)
        await evento(t, p.id, usuario.colaboradorId, 'convites_adicionais', { quantidade: tk.size })
        await auditar(t, usuario.colaboradorId, 'pesquisa', p.id, 'convites_adicionais', { quantidade: tk.size })
        return tk
      })
      const envio = tokens.size ? await avisarConvidados(ctx, p, tokens) : null
      return ok({ convitesCriados: tokens.size, envio })
    },
  },
  {
    metodo: 'POST', padrao: 'pesquisas/:id/lembretes', cap: 'pesq:gerenciar',
    h: async (ctx) => {
      const p = await carregar(ctx.db, ctx.params.id)
      if (p.status !== 'aberta') throw conflito('Só é possível enviar lembretes para pesquisas em andamento.')
      const r = await enviarLembretes(ctx, p)
      await auditar(ctx.db, ctx.usuario.colaboradorId, 'pesquisa', p.id, 'lembretes', { pendentes: r.total })
      await evento(ctx.db, p.id, ctx.usuario.colaboradorId, 'lembretes', { quantidade: r.total })
      return ok(r)
    },
  },
  {
    // Anônima: só números (listar nomes de quem falta revelaria quem respondeu). Identificada: lista nominal.
    metodo: 'GET', padrao: 'pesquisas/:id/convites', cap: 'pesq:gerenciar',
    h: async ({ db, params }) => {
      const p = await carregar(db, params.id, CONTAGENS)
      const emails = (await db.query("select email_status, count(*)::int as n from pq_convites where pesquisa_id = $1 and email_status is not null group by 1", [params.id])).rows
      const base = {
        modo: p.modo, convidados: p.convidados, pendentes: p.pendentes, respondidos: (await db.query("select count(*)::int as n from pq_convites where pesquisa_id = $1 and status = 'usado'", [params.id])).rows[0].n,
        emailConfigurado: emailConfigurado(), email: Object.fromEntries(emails.map((e) => [e.email_status, e.n])),
        aviso: p.modo === 'anonima' ? 'Pesquisa anônima: por proteção, só são exibidas contagens — nunca quem respondeu ou deixou de responder.' : undefined,
      }
      if (p.modo === 'anonima') return ok(base)
      const gente = new Map((await pessoas(db)).map((g) => [g.id, g]))
      const r = await db.query("select id, colaborador_id, status, to_char(usado_em,'YYYY-MM-DD') as usado_em, canal, email_status, lembretes from pq_convites where pesquisa_id = $1 order by criado_em", [params.id])
      return ok({ ...base, itens: r.rows.map((c) => ({ conviteId: c.id, colaboradorId: c.colaborador_id, nome: gente.get(c.colaborador_id)?.nome ?? '—', status: c.status, respondidoEm: c.usado_em, emailStatus: c.email_status, lembretes: c.lembretes })) })
    },
  },
  {
    metodo: 'POST', padrao: 'pesquisas/:id/link-publico', cap: 'pesq:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const p = await carregar(db, params.id)
      if (p.modo !== 'anonima') throw invalido('Link público só existe para pesquisas anônimas: ele não identifica ninguém.')
      if (p.status === 'encerrada') throw conflito('Pesquisa encerrada.')
      const ativo = req.corpo?.ativo !== false
      let token: string | null = null
      if (ativo) {
        token = 'p' + randomBytes(24).toString('base64url')
        await db.query('update pq_pesquisas set link_publico_hash = $2, link_publico_ativo = true where id = $1', [p.id, hashToken(token)])
      } else await db.query('update pq_pesquisas set link_publico_ativo = false where id = $1', [p.id])
      await evento(db, p.id, usuario.colaboradorId, ativo ? 'link_publico_ativado' : 'link_publico_desativado')
      await auditar(db, usuario.colaboradorId, 'pesquisa', p.id, ativo ? 'link_publico_ativado' : 'link_publico_desativado')
      return ok({ ativo, url: token ? `${urlPortal()}/responder/${token}` : null, token,
        regras: 'Qualquer pessoa com o link pode responder. Para limitar repetições usamos uma marca do navegador (sem ligação com a resposta) e um limite por rede. Não há como saber quem respondeu.' })
    },
  },

  /* ---------- resultados ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas/:id/resultados', cap: 'pesq:resultados',
    h: async (ctx) => {
      const { req, params } = ctx
      const filtro = { setorId: req.query.setorId || undefined, unidadeId: req.query.unidadeId || undefined }
      return ok(await montarResultados(ctx, params.id, filtro))
    },
  },
  {
    metodo: 'GET', padrao: 'pesquisas/:id/resultados.csv', cap: 'pesq:exportar',
    h: async (ctx) => {
      const { req, params, usuario, db } = ctx
      const filtro = { setorId: req.query.setorId || undefined, unidadeId: req.query.unidadeId || undefined }
      const { resultados, pesquisa } = await montarResultados(ctx, params.id, filtro)
      await auditar(db, usuario.colaboradorId, 'pesquisa', params.id, 'exportada', { filtro: !!(filtro.setorId || filtro.unidadeId) })
      const nome = String(pesquisa.titulo).normalize('NFKD').replace(/[^\w]+/g, '-').slice(0, 50) || 'pesquisa'
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: `resultados-${nome}.csv`, dados: Buffer.from(resultadosParaCsv(resultados), 'utf8') } }
    },
  },
  {
    // Somente pesquisas identificadas; cada consulta é auditada.
    metodo: 'GET', padrao: 'pesquisas/:id/respostas-individuais', cap: 'pesq:resultados',
    h: async ({ db, params, usuario }) => {
      const p = await carregar(db, params.id)
      if (p.modo !== 'identificada') throw proibido('Esta pesquisa é anônima: não existem respostas individuais identificáveis.')
      if (!usuario.caps.has('pesq:gerenciar')) throw proibido()
      const gente = new Map((await pessoas(db)).map((g) => [g.id, g]))
      const r = await db.query("select id, versao, to_char(enviada_em,'YYYY-MM-DD') as enviada_em, colaborador_id, itens from pq_respostas where pesquisa_id = $1 order by enviada_em", [params.id])
      await auditar(db, usuario.colaboradorId, 'pesquisa', params.id, 'consulta_individual', { registros: r.rowCount })
      // Enunciado de cada pergunta (todas as versões), para a tela não mostrar ids internos.
      const enunciados: Record<string, string> = {}
      for (const v of (await db.query('select perguntas from pq_versoes where pesquisa_id = $1 order by versao', [params.id])).rows) for (const q of v.perguntas as PerguntaPesquisa[]) enunciados[q.id] = q.texto
      return ok({ finalidade: p.finalidade, quemAcessa: p.quem_acessa, enunciados, itens: r.rows.map((x) => ({ respostaId: x.id, versao: x.versao, enviadaEm: x.enviada_em, nome: gente.get(x.colaborador_id)?.nome ?? '—', itens: x.itens })) })
    },
  },
  /* ---------- plano de ação ---------- */
  {
    metodo: 'GET', padrao: 'pesquisas/:id/acoes', cap: ['pesq:gerenciar', 'pesq:resultados'],
    h: async ({ db, params, agora }) => {
      await carregar(db, params.id)
      const r = await db.query(`select ${COLS_ACAO} from pq_acoes a where a.pesquisa_id = $1 order by (a.status in ('concluida','cancelada')), a.prazo nulls last, a.criado_em`, [params.id])
      const nomes = new Map((await pessoas(db)).map((g) => [g.id, g.nomeSocial || g.nome]))
      return ok({ itens: r.rows.map((x) => saidaAcao(x, nomes, hojeISO(agora))) })
    },
  },
  {
    metodo: 'POST', padrao: 'pesquisas/:id/acoes', cap: 'pesq:gerenciar',
    h: async ({ db, params, req, usuario, agora }) => {
      await carregar(db, params.id)
      const n = (await db.query('select count(*)::int as n from pq_acoes where pesquisa_id = $1', [params.id])).rows[0].n
      if (n >= 100) throw invalido('Limite de 100 ações por pesquisa.')
      const v = await lerAcao(db, req.corpo ?? {}, true)
      const r = await db.query(
        `insert into pq_acoes (pesquisa_id, dimensao, problema, acao, responsavel_id, prazo, status, indicador, conclusao, concluida_em, criado_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [params.id, v.dimensao, v.problema, v.acao, v.responsavel_id, v.prazo, v.status ?? 'planejada', v.indicador, v.conclusao, v.status === 'concluida' ? hojeISO(agora) : null, usuario.colaboradorId])
      const criada = await lerUmaAcao(db, r.rows[0].id)
      await evento(db, params.id, usuario.colaboradorId, 'acao_criada', { acaoId: criada.id })
      await auditar(db, usuario.colaboradorId, 'pesquisa', params.id, 'acao_criada', { acaoId: r.rows[0].id })
      if (v.responsavel_id && v.responsavel_id !== usuario.colaboradorId) {
        await notificar(db, { destinatarioId: String(v.responsavel_id), tipo: 'pesquisa', titulo: 'Nova ação de plano de pesquisa sob sua responsabilidade', corpo: String(v.acao).slice(0, 120), link: `/pesquisas-rh/${params.id}/resultados`, chave: `pq-acao-${r.rows[0].id}-${v.responsavel_id}` })
      }
      const nomes = new Map((await pessoas(db)).map((g) => [g.id, g.nomeSocial || g.nome]))
      return ok(saidaAcao(criada, nomes, hojeISO(agora)), 201)
    },
  },
  {
    metodo: 'PATCH', padrao: 'pesquisas/:id/acoes/:acaoId', cap: 'pesq:gerenciar',
    h: async ({ db, params, req, usuario, agora }) => {
      if (!/^[0-9a-f-]{36}$/i.test(params.acaoId)) throw naoEncontrado('Ação não encontrada.')
      const atual = (await db.query('select * from pq_acoes where id = $1 and pesquisa_id = $2', [params.acaoId, params.id])).rows[0]
      if (!atual) throw naoEncontrado('Ação não encontrada.')
      const v = await lerAcao(db, req.corpo ?? {}, false)
      const sets: string[] = []
      const ps: unknown[] = [params.acaoId]
      for (const [col, val] of Object.entries(v)) { ps.push(val); sets.push(`${col} = $${ps.length}`) }
      if (v.status !== undefined && v.status !== atual.status) { ps.push(v.status === 'concluida' ? hojeISO(agora) : null); sets.push(`concluida_em = $${ps.length}`) }
      if (!sets.length) throw invalido('Nada para alterar.')
      await db.query(`update pq_acoes set ${sets.join(', ')}, atualizado_em = now() where id = $1`, ps)
      const nova = await lerUmaAcao(db, params.acaoId)
      await auditar(db, usuario.colaboradorId, 'pesquisa', params.id, 'acao_alterada', { acaoId: params.acaoId, campos: Object.keys(v) })
      if (v.responsavel_id && v.responsavel_id !== atual.responsavel_id && v.responsavel_id !== usuario.colaboradorId) {
        await notificar(db, { destinatarioId: v.responsavel_id as string, tipo: 'pesquisa', titulo: 'Nova ação de plano de pesquisa sob sua responsabilidade', corpo: String(nova.acao).slice(0, 120), link: `/pesquisas-rh/${params.id}/resultados`, chave: `pq-acao-${params.acaoId}-${v.responsavel_id}` })
      }
      const nomes = new Map((await pessoas(db)).map((g) => [g.id, g.nomeSocial || g.nome]))
      return ok(saidaAcao(nova, nomes, hojeISO(agora)))
    },
  },
  {
    metodo: 'DELETE', padrao: 'pesquisas/:id/acoes/:acaoId', cap: 'pesq:gerenciar',
    h: async ({ db, params, usuario }) => {
      if (!/^[0-9a-f-]{36}$/i.test(params.acaoId)) throw naoEncontrado('Ação não encontrada.')
      const r = await db.query('delete from pq_acoes where id = $1 and pesquisa_id = $2', [params.acaoId, params.id])
      if (!r.rowCount) throw naoEncontrado('Ação não encontrada.')
      await auditar(db, usuario.colaboradorId, 'pesquisa', params.id, 'acao_removida', { acaoId: params.acaoId })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'pesquisas/:id/tags', cap: 'pesq:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const { respostaId, perguntaId } = req.corpo ?? {}
      if (typeof respostaId !== 'string' || !/^[0-9a-f-]{36}$/i.test(respostaId) || typeof perguntaId !== 'string') throw invalido('Resposta inválida.')
      const tags = [...new Set<string>((Array.isArray(req.corpo.tags) ? req.corpo.tags : []).map((t: unknown) => String(t ?? '').trim().toLowerCase().slice(0, 30)).filter(Boolean))].slice(0, 10)
      const r = await db.query('select 1 from pq_respostas where id = $1 and pesquisa_id = $2', [respostaId, params.id])
      if (!r.rowCount) throw naoEncontrado('Resposta não encontrada.')
      const versoes = (await db.query('select perguntas from pq_versoes where pesquisa_id = $1', [params.id])).rows
      const ehTexto = versoes.some((v) => (v.perguntas as PerguntaPesquisa[]).some((q) => q.id === perguntaId && tipoTexto(q.tipo)))
      if (!ehTexto) throw invalido('Só respostas abertas podem receber marcadores.')
      await db.tx(async (t) => {
        await t.query('delete from pq_tags where resposta_id = $1 and pergunta_id = $2', [respostaId, perguntaId])
        for (const tag of tags) await t.query('insert into pq_tags (resposta_id, pergunta_id, tag) values ($1,$2,$3)', [respostaId, perguntaId, tag])
        await auditar(t, usuario.colaboradorId, 'pesquisa', params.id, 'marcadores_atualizados', { quantidade: tags.length })
      })
      return ok({ tags })
    },
  },
]

/* ---------- resumo do plano de ação (painel) ---------- */
async function resumoAcoes(ex: Executor, hoje: string) {
  const abertas = (await ex.query(
    `select a.id, a.pesquisa_id, a.acao, a.responsavel_id, to_char(a.prazo,'YYYY-MM-DD') as prazo, a.status, p.titulo as pesquisa_titulo
     from pq_acoes a join pq_pesquisas p on p.id = a.pesquisa_id where a.status in ('planejada','em_andamento') order by a.prazo nulls last`)).rows
  const nomes = new Map((await pessoas(ex)).map((g) => [g.id, g.nomeSocial || g.nome]))
  const atrasadas = abertas.filter((a) => a.prazo && a.prazo < hoje)
  return {
    abertas: abertas.length,
    atrasadas: atrasadas.length,
    itens: [...atrasadas, ...abertas.filter((a) => !(a.prazo && a.prazo < hoje))].slice(0, 6).map((a) => ({
      id: a.id, pesquisaId: a.pesquisa_id, pesquisaTitulo: a.pesquisa_titulo, acao: a.acao, prazo: a.prazo, status: a.status,
      responsavelNome: a.responsavel_id ? nomes.get(a.responsavel_id) ?? null : null, atrasada: !!a.prazo && a.prazo < hoje,
    })),
  }
}

/* ---------- lembretes ---------- */
async function enviarLembretes(ctx: Ctx, p: Record<string, any>) {
  const { db } = ctx
  // No máximo um lembrete por pessoa a cada 24 h (evita spam). Gera novo token (o anterior deixa de valer).
  const pend = (await db.query(
    "select id, colaborador_id from pq_convites where pesquisa_id = $1 and status = 'pendente' and (ultimo_lembrete_em is null or ultimo_lembrete_em < now() - interval '23 hours')", [p.id])).rows
  const tokens = new Map<string, string>()
  for (const c of pend) {
    const token = novoToken()
    await db.query('update pq_convites set token_hash = $2, lembretes = lembretes + 1, ultimo_lembrete_em = now() where id = $1', [c.id, hashToken(token)])
    tokens.set(c.colaborador_id, token)
  }
  const envio = tokens.size ? await avisarConvidados(ctx, p, tokens, true) : { internas: 0, email: { enviada: 0, falhou: 0, nao_configurado: 0 }, emailConfigurado: emailConfigurado() }
  return { total: tokens.size, ...envio }
}
