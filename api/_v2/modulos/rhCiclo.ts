/* ============================================================
   API v2 · rotinas do ciclo de vida e alertas do RH
   - Aplica encerramentos AGENDADOS cuja data efetiva chegou
     (mesma regra da ação do RH: domain/vinculos.aplicarEncerramento).
   - Gera notificações internas a partir dos alertas do RH
     (domain/alertasRH), uma vez por alerta (chave estável).
   - Retenção LGPD de candidaturas (api/_v2/lgpdRetencao.ts).
   Rodam pelo agendador da Vercel (rh/cron/diario, CRON_SECRET) e,
   por segurança, o encerramento vencido também é aplicado no login
   e na abertura do portal (api/[acao].ts).
   ============================================================ */
import { randomBytes, timingSafeEqual } from 'node:crypto'
import { auditar, idsComPapel, notificar, ok, proibido, type Db, type Executor, type Rota } from '../nucleo.js'
import { aplicarEncerramento, agendamentoVencido, retencaoPorGrupo } from '../../../src/domain/vinculos.js'
import { criarProcesso, processoAberto } from '../../../src/domain/jornada.js'
import { alertasRH } from '../../../src/domain/alertasRH.js'
import { convidarParaDesligamento } from './pesquisas.js'
import { processarRetencaoCandidatos } from '../lgpdRetencao.js'
import type { ChecklistModelo, Colaborador, ProcessoJornada } from '../../../src/lib/types.js'

type Obj = Record<string, any>
const rid = (p: string) => `${p}${randomBytes(6).toString('hex')}`

/** Data de hoje no fuso de Brasília (a data efetiva é um dia do calendário brasileiro, não UTC). */
export const hojeBR = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)

const lerColecao = async <T = Obj>(ex: Executor, tabela: string): Promise<{ ord: number; dados: T }[]> =>
  (await ex.query(`select ord, dados from ${tabela} order by ord`)).rows as { ord: number; dados: T }[]
const gravar = (ex: Executor, tabela: string, id: string, dados: unknown) =>
  ex.query(`update ${tabela} set dados = $2::jsonb, atualizado_em = now() where id = $1`, [id, JSON.stringify(dados)])

/** Aplica os encerramentos agendados vencidos. Idempotente; serializa com as gravações do portal. */
export async function aplicarEncerramentosAgendados(db: Db, agora = new Date()): Promise<{ aplicados: string[]; recusados: string[] }> {
  const hoje = hojeBR(agora)
  // Consulta barata antes de abrir a transação (roda no login).
  const pend = (await db.query(
    `select id from app_colaboradores where dados ? 'encerramentoAgendado' and coalesce(dados->>'status','') <> 'encerrado' and dados->'encerramentoAgendado'->>'data' <= $1`, [hoje])).rows
  if (!pend.length) return { aplicados: [], recusados: [] }
  return db.tx(async (t) => {
    for (const n of ['checklists', 'colaboradores', 'periodos', 'processos', 'setores']) await t.query('select pg_advisory_xact_lock(hashtext($1))', [`app_estado:${n}`])
    const aplicados: string[] = [], recusados: string[] = []
    const convitesSaida: { pesquisaId: string; pessoaId: string; por: string | null }[] = []
    const linhas = (await t.query(`select id, dados from app_colaboradores where dados ? 'encerramentoAgendado' and coalesce(dados->>'status','') <> 'encerrado' and dados->'encerramentoAgendado'->>'data' <= $1 for update`, [hoje])).rows
    const agoraIso = agora.toISOString()
    for (const l of linhas) {
      const c = l.dados as Colaborador
      if (!agendamentoVencido(c, hoje)) continue
      const ag = c.encerramentoAgendado!
      const novo = aplicarEncerramento(c, ag, ag.porId, agoraIso, rid('mv'))
      if (!novo) {
        // Não há período aberto (ex.: reativado e encerrado de outra forma): o agendamento é descartado e o RH avisado.
        const { encerramentoAgendado: _a, ...resto } = c
        await gravar(t, 'app_colaboradores', c.id, resto)
        recusados.push(c.id)
        await auditar(t, null, 'pessoa', c.id, 'encerramento_agendado_descartado', { data: ag.data })
        continue
      }
      await gravar(t, 'app_colaboradores', c.id, novo)
      // Mesmos efeitos da ação do RH: sai da liderança das áreas, cancela indisponibilidades futuras e a integração aberta.
      for (const s of (await t.query('select id, dados from app_setores')).rows) {
        const d = s.dados as Obj
        if (d.gestorId === c.id || (d.liderancaIds ?? []).includes(c.id)) await gravar(t, 'app_setores', s.id, { ...d, gestorId: d.gestorId === c.id ? null : d.gestorId, liderancaIds: (d.liderancaIds ?? []).filter((x: string) => x !== c.id) })
      }
      for (const p of (await t.query("select id, dados from app_periodos where dados->>'colaboradorId' = $1", [c.id])).rows) {
        if (p.dados.inicio > ag.data && p.dados.status !== 'cancelado') await gravar(t, 'app_periodos', p.id, { ...p.dados, status: 'cancelado' })
      }
      const procs = (await t.query("select id, dados from app_processos where dados->>'colaboradorId' = $1", [c.id])).rows as { id: string; dados: ProcessoJornada }[]
      for (const p of procs) if (p.dados.tipo === 'integracao' && processoAberto(p.dados)) await gravar(t, 'app_processos', p.id, { ...p.dados, canceladoEm: hoje, motivoCancelamento: 'Parceria encerrada' })
      if (ag.iniciarChecklist && !procs.some((p) => p.dados.tipo === 'encerramento' && processoAberto(p.dados))) {
        const modelo = (await lerColecao<ChecklistModelo>(t, 'app_checklists')).map((x) => x.dados).find((m) => m.tipo === 'encerramento')
        if (modelo) {
          const proc = { ...criarProcesso(modelo, c.id, hoje, rid('pj')), referencia: ag.data }
          await t.query('insert into app_processos (ord, id, dados, atualizado_em) values ((select coalesce(max(ord), -1) + 1 from app_processos), $1, $2::jsonb, now())', [proc.id, JSON.stringify(proc)])
        }
      }
      await auditar(t, ag.porId ?? null, 'pessoa', c.id, 'encerramento_agendado_aplicado', { data: ag.data })
      if (ag.pesquisaDesligamentoId) convitesSaida.push({ pesquisaId: ag.pesquisaDesligamentoId, pessoaId: c.id, por: ag.porId ?? null })
      for (const rh of await idsComPapel(t, 'rh', 'admin'))
        await notificar(t, { destinatarioId: rh, tipo: 'pessoas', titulo: 'Encerramento agendado aplicado', corpo: `A parceria de ${c.nome} foi encerrada em ${ag.data.split('-').reverse().join('/')}, como agendado.`, link: `/rh/pessoas/${c.id}`, chave: `enc-agendado:${c.id}:${ag.data}` })
      aplicados.push(c.id)
    }
    return { aplicados, recusados, convitesSaida }
  }).then(async (r) => {
    // Convites da pesquisa de desligamento: fora da transação (envio de e-mail); falha não desfaz o encerramento.
    for (const cv of r.convitesSaida) await convidarParaDesligamento(db, cv.pesquisaId, cv.pessoaId, cv.por, agora).catch((e) => console.error('[pesquisa de desligamento]', e))
    return { aplicados: r.aplicados, recusados: r.recusados }
  })
}

/** Notifica RH e administração sobre os alertas (uma notificação por alerta, sem duplicar). */
export async function notificarAlertasRH(ex: Executor, agora = new Date()): Promise<{ alertas: number; notificados: number }> {
  const hoje = hojeBR(agora)
  const col = async <T,>(t: string) => (await lerColecao<T>(ex, t)).map((x) => x.dados)
  const lista = alertasRH({
    colaboradores: await col('app_colaboradores'), contratos: await col('app_contratos'), documentos: await col('app_documentos'),
    exigencias: await col('app_exigencias'), processos: await col('app_processos'),
  }, hoje)
  const destinatarios = await idsComPapel(ex, 'rh', 'admin')
  let n = 0
  // Avisos de atenção e críticos; celebrações (aniversários) só aparecem no painel.
  for (const a of lista.filter((x) => x.severidade !== 'info').slice(0, 80)) {
    for (const d of destinatarios) {
      // Sem dados sensíveis no título/corpo: só nome, tipo e data.
      const r = await ex.query('insert into ntf_notificacoes (destinatario_id, tipo, titulo, corpo, link, chave) values ($1,$2,$3,$4,$5,$6) on conflict (destinatario_id, chave) do nothing',
        [d, 'pessoas', a.titulo, a.descricao.slice(0, 280), a.link, `rh-alerta:${a.chave}`])
      n += r.rowCount ?? 0
    }
  }
  return { alertas: lista.length, notificados: n }
}

/** Rotina diária completa: encerramentos agendados, alertas do RH e retenção LGPD de candidaturas. */
export async function rotinaDiariaRH(db: Db, agora = new Date()) {
  const encerramentos = await aplicarEncerramentosAgendados(db, agora)
  const alertas = await db.tx((t) => notificarAlertasRH(t, agora))
  let retencao: { anonimizados: number } | { erro: string } = { anonimizados: 0 }
  // Falha na retenção não impede o resto da rotina; o erro volta no resultado (e no log do agendador).
  try { retencao = await processarRetencaoCandidatos(db, agora) } catch (e) { retencao = { erro: e instanceof Error ? e.message : 'falha na retenção' } }
  return { encerramentos, alertas, retencao }
}

export const rotas: Rota[] = [
  {
    // Retenção das contratações feitas pelo recrutamento (90 dias), por recrutador e por vaga. Agregado: sem dados pessoais.
    metodo: 'GET', padrao: 'rh/retencao-contratacoes', cap: ['rh:painel', 'analytics:ver'],
    h: async ({ db, req, agora }) => {
      const hoje = hojeBR(agora)
      const ate = /^\d{4}-\d{2}-\d{2}$/.test(req.query.ate ?? '') ? req.query.ate! : hoje
      const de = /^\d{4}-\d{2}-\d{2}$/.test(req.query.de ?? '') ? req.query.de! : `${Number(ate.slice(0, 4)) - 1}${ate.slice(4)}`
      const dias = [30, 60, 90, 180].includes(Number(req.query.dias)) ? Number(req.query.dias) : 90
      const linhas = (await db.query(
        `select lower(k.email) as email, to_char(coalesce(c.encerrada_em, c.atualizado_em) at time zone 'America/Sao_Paulo', 'YYYY-MM-DD') as contratado_em,
                v.recrutador_id, v.titulo
           from rec_candidaturas c join rec_candidatos k on k.id = c.candidato_id join rec_vagas v on v.id = c.vaga_id
          where c.status = 'contratado' and coalesce(c.encerrada_em, c.atualizado_em) >= $1::date and coalesce(c.encerrada_em, c.atualizado_em) < ($2::date + 1)`, [de, ate])).rows
      const gente = (await db.query('select dados from app_colaboradores')).rows.map((r) => r.dados as Colaborador)
      const porEmail = new Map(gente.map((p) => [String(p.email ?? '').toLowerCase(), p]))
      const nome = (id: string | null) => (id ? gente.find((p) => p.id === id)?.nome ?? 'Cadastro removido' : 'Sem recrutador')
      const base = linhas.map((l) => ({ pessoa: porEmail.get(l.email) ?? null, contratadoEm: l.contratado_em, recrutador: nome(l.recrutador_id), vaga: l.titulo as string }))
      return ok({
        de, ate, dias,
        porRecrutador: retencaoPorGrupo(base.map((b) => ({ ...b, grupo: b.recrutador })), hoje, dias),
        porVaga: retencaoPorGrupo(base.map((b) => ({ ...b, grupo: b.vaga })), hoje, dias),
        definicao: `Das contratações concluídas no ATS no período, % cuja parceria seguia ativa ${dias} dias após o início. Contratações que ainda não completaram o prazo ficam em observação; sem cadastro de pessoa correspondente (mesmo e-mail) ficam de fora.`,
      })
    },
  },
  {
    // Agendador da Vercel (vercel.json → crons). Exige Authorization: Bearer $CRON_SECRET; sem a variável, fica desligado.
    metodo: 'GET', padrao: 'rh/cron/diario', publica: true, limite: 10,
    h: async ({ db, req, agora }) => {
      const segredo = process.env.CRON_SECRET
      const enviado = (req.cabecalhos.authorization ?? '').replace(/^Bearer\s+/i, '')
      if (!segredo || segredo.length < 16 || enviado.length !== segredo.length || !timingSafeEqual(Buffer.from(enviado), Buffer.from(segredo))) throw proibido('Agendamento não autorizado.')
      return ok(await rotinaDiariaRH(db, agora))
    },
  },
  {
    // Execução manual pelo RH (ex.: logo depois de agendar ou para conferir os alertas).
    metodo: 'POST', padrao: 'rh/rotinas/executar', cap: 'pessoas:gerenciar',
    h: async ({ db, agora, usuario }) => {
      const encerramentos = await aplicarEncerramentosAgendados(db, agora)
      const alertas = await db.tx((t) => notificarAlertasRH(t, agora))
      await auditar(db, usuario.colaboradorId, 'rotina', null, 'rh_rotina_manual', { aplicados: encerramentos.aplicados.length })
      return ok({ encerramentos, alertas })
    },
  },
]
