/* ============================================================
   API v2 · Gestão de prestadores PJ · disparos de cobrança de NF
   - Manual: o financeiro escolhe o público (quem não enviou, quem
     teve a nota devolvida, todos os contratos mensais ou pessoas
     selecionadas) e a mensagem.
   - Automático: nos dias configurados em relação ao dia limite de
     envio, o agendador cobra quem ainda não enviou (chave única por
     competência e dia: não repete).
   A entrega é SÓ dentro do sistema: notificação no portal (sino e
   página de notificações), com link para enviar a nota. Não há
   e-mail. Tudo fica registrado (fin_disparos + fin_disparo_envios).
   ============================================================ */
import { auditar, conflito, enumerado, invalido, naoEncontrado, notificar, ok, texto, type Executor, type Rota } from '../../nucleo.js'
import { preencherModelo } from '../../email.js'
import { RE_COMPETENCIA, somarDias, somarMeses } from '../../../../src/domain/v2/financeiro.js'
import { hoje, lerConfig, mapaPessoas, nomeDe, uuid, type Linha } from './comum.js'

export const PUBLICOS_DISPARO = ['pendentes', 'devolvidas', 'pendentes_e_devolvidas', 'todos', 'selecionados'] as const
export type PublicoDisparo = (typeof PUBLICOS_DISPARO)[number]
export const ROTULO_PUBLICO: Record<PublicoDisparo, string> = {
  pendentes: 'Quem ainda não enviou', devolvidas: 'Notas devolvidas sem reenvio', pendentes_e_devolvidas: 'Não enviou ou devolvida',
  todos: 'Todos os contratos mensais', selecionados: 'Pessoas selecionadas',
}

const MESES = ['janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho', 'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro']
export const mesAno = (comp: string) => `${MESES[Number(comp.slice(5, 7)) - 1]} de ${comp.slice(0, 4)}`
const dataBR = (d: string) => `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}`
export const prazoDaCompetencia = (comp: string, diaLimite: number) => `${comp}-${String(diaLimite).padStart(2, '0')}`

export const MODELO_PADRAO = {
  assunto: 'Envie sua nota fiscal de {{competencia}}',
  mensagem: 'Olá, {{nome}}!\n\nAinda não recebemos a sua nota fiscal de {{competencia}} ({{contratos}}). O prazo de envio é {{prazo}}.\n\nEnvie em Notas fiscais, aqui no portal.\n\nQualquer dúvida, fale com o financeiro.',
}

/* ---------- público ---------- */
export interface Alvo { pessoaId: string; contratos: string[]; pendente: boolean; devolvida: boolean; temNota: boolean }

/**
 * Pessoas que prestam contratos mensais vigentes na competência (prestador do contrato ou, sem ele, o representante do fornecedor)
 * e quem teve nota devolvida na competência. Cada pessoa aparece uma vez, com os contratos dela.
 */
export async function alvosDaCompetencia(ex: Executor, comp: string): Promise<Map<string, Alvo>> {
  const m = new Map<string, Alvo>()
  const pegar = (id: string) => { let a = m.get(id); if (!a) { a = { pessoaId: id, contratos: [], pendente: false, devolvida: false, temNota: false }; m.set(id, a) } return a }
  const ks = (await ex.query(`select k.numero, coalesce(k.prestador_id, f.representante_id) as pessoa,
      exists (select 1 from fin_notas n where n.contrato_id = k.id and n.competencia = $1 and n.status <> 'cancelada') as tem_nota
    from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
    where k.status = 'vigente' and k.periodicidade_faturamento = 'mensal' and k.inicio <= ($1 || '-28')::date and (k.fim is null or k.fim >= ($1 || '-01')::date)
    order by k.numero`, [comp])).rows
  for (const k of ks) {
    if (!k.pessoa) continue
    const a = pegar(k.pessoa)
    if (!a.contratos.includes(k.numero)) a.contratos.push(k.numero)
    if (k.tem_nota) a.temNota = true; else a.pendente = true
  }
  const devs = (await ex.query(`select coalesce(n.enviada_por, k.prestador_id, f.representante_id) as pessoa, coalesce(k.numero, 'NF ' || n.numero) as numero
    from fin_notas n left join fin_contratos k on k.id = n.contrato_id join fin_fornecedores f on f.id = n.fornecedor_id
    where n.status = 'devolvida' and n.competencia = $1`, [comp])).rows
  for (const d of devs) {
    if (!d.pessoa) continue
    const a = pegar(d.pessoa)
    a.devolvida = true
    if (!a.contratos.includes(d.numero)) a.contratos.push(d.numero)
  }
  // Parceria encerrada não recebe cobrança.
  const gente = await mapaPessoas(ex)
  for (const id of [...m.keys()]) if (!gente.get(id) || gente.get(id)!.status === 'encerrado') m.delete(id)
  return m
}

export function filtrarPublico(todos: Map<string, Alvo>, publico: PublicoDisparo, selecionados: string[] = []): Alvo[] {
  const lista = [...todos.values()]
  switch (publico) {
    case 'pendentes': return lista.filter((a) => a.pendente)
    case 'devolvidas': return lista.filter((a) => a.devolvida)
    case 'pendentes_e_devolvidas': return lista.filter((a) => a.pendente || a.devolvida)
    case 'todos': return lista
    case 'selecionados': return lista.filter((a) => selecionados.includes(a.pessoaId))
  }
}

/* ---------- execução ---------- */
export interface NovoDisparo {
  competencia: string; publico: PublicoDisparo; selecionados?: string[]
  assunto: string; mensagem: string; criadoPor: string; chave?: string | null; automatico?: boolean
}
export interface ResultadoDisparo { id: string | null; destinatarios: number }

/** Registra o disparo e notifica cada pessoa no portal. Com `chave` repetida, não faz nada. */
export async function executarDisparo(ex: Executor, d: NovoDisparo): Promise<ResultadoDisparo> {
  const vazio: ResultadoDisparo = { id: null, destinatarios: 0 }
  const alvos = filtrarPublico(await alvosDaCompetencia(ex, d.competencia), d.publico, d.selecionados)
  if (!alvos.length) return vazio
  const ins = (await ex.query(`insert into fin_disparos (competencia, publico, canais, assunto, mensagem, destinatarios, criado_por, chave, automatico)
    values ($1,$2,$3,$4,$5,$6,$7,$8,$9) on conflict (chave) where chave is not null do nothing returning id`,
    [d.competencia, d.publico, ['portal'], d.assunto, d.mensagem, alvos.length, d.criadoPor, d.chave ?? null, !!d.automatico])).rows[0]
  if (!ins) return vazio
  const id = ins.id as string
  const cfg = await lerConfig(ex)
  const gente = await mapaPessoas(ex)
  const r: ResultadoDisparo = { ...vazio, id, destinatarios: alvos.length }
  for (const a of alvos) {
    const p = gente.get(a.pessoaId)!
    const vars = {
      nome: String(p.nomeSocial || p.nome || '').split(' ')[0], nome_completo: p.nome, competencia: mesAno(d.competencia),
      prazo: dataBR(prazoDaCompetencia(d.competencia, cfg.diaLimiteEnvioNf)), contratos: a.contratos.join(', '), link: 'Notas fiscais › Enviar nota',
    }
    const assunto = preencherModelo(d.assunto, vars).slice(0, 200)
    const corpo = preencherModelo(d.mensagem, vars)
    await notificar(ex, { destinatarioId: a.pessoaId, tipo: 'nota_fiscal', titulo: assunto, corpo: corpo.slice(0, 1000), link: '/notas', chave: `disparo:${id}:${a.pessoaId}` })
    await ex.query('insert into fin_disparo_envios (disparo_id, pessoa_id, contratos) values ($1,$2,$3)', [id, a.pessoaId, a.contratos])
  }
  await auditar(ex, d.criadoPor, 'fin_disparo', id, 'enviado', { competencia: d.competencia, publico: d.publico, destinatarios: r.destinatarios, automatico: !!d.automatico })
  return r
}

/* ---------- automático ---------- */
export interface ConfigDisparoAuto { ativo: boolean; dias: number[]; incluirDevolvidas: boolean; assunto: string; mensagem: string; atualizadoEm: string | null; atualizadoPor: string | null }
export async function lerDisparoAuto(ex: Executor): Promise<ConfigDisparoAuto> {
  const r = (await ex.query('select * from fin_disparo_auto where id')).rows[0] ?? {}
  return {
    ativo: r.ativo ?? true, dias: (r.dias ?? [-5, -1, 0, 3]).map(Number), incluirDevolvidas: r.incluir_devolvidas ?? true,
    assunto: r.assunto ?? MODELO_PADRAO.assunto, mensagem: r.mensagem ?? MODELO_PADRAO.mensagem, atualizadoEm: r.atualizado_em ?? null, atualizadoPor: r.atualizado_por ?? null,
  }
}

/** Roda os disparos automáticos do dia (competência atual e a anterior, para lembretes depois da virada do mês). */
export async function disparosAutomaticos(ex: Executor, hojeStr: string): Promise<number> {
  const auto = await lerDisparoAuto(ex)
  if (!auto.ativo || !auto.dias.length) return 0
  const cfg = await lerConfig(ex)
  let feitos = 0
  const atual = hojeStr.slice(0, 7)
  for (const comp of [atual, somarMeses(`${atual}-01`, -1).slice(0, 7)]) {
    const limite = prazoDaCompetencia(comp, cfg.diaLimiteEnvioNf)
    for (const dia of auto.dias) {
      if (somarDias(limite, dia) !== hojeStr) continue
      const r = await executarDisparo(ex, {
        competencia: comp, publico: auto.incluirDevolvidas ? 'pendentes_e_devolvidas' : 'pendentes',
        assunto: auto.assunto, mensagem: auto.mensagem, criadoPor: 'sistema', chave: `auto:${comp}:${dia}`, automatico: true,
      })
      if (r.id) feitos++
    }
  }
  return feitos
}

/* ---------- rotas ---------- */
function lerAlvoJson(a: Alvo, gente: Map<string, Linha>) {
  return { pessoaId: a.pessoaId, nome: nomeDe(gente, a.pessoaId), contratos: a.contratos, pendente: a.pendente, devolvida: a.devolvida, temNota: a.temNota }
}
const competenciaDe = (v: unknown, agora: Date) => (typeof v === 'string' && RE_COMPETENCIA.test(v) ? v : hoje(agora).slice(0, 7))

export const rotas: Rota[] = [
  {
    // Público possível (com contagens), modelo padrão, regra automática e situação do e-mail.
    metodo: 'GET', padrao: 'financeiro/disparos/previa', cap: 'fin:ver',
    h: async ({ db, req, agora }) => {
      const comp = competenciaDe(req.query.competencia, agora)
      const todos = await alvosDaCompetencia(db, comp)
      const gente = await mapaPessoas(db)
      const contagem = Object.fromEntries(PUBLICOS_DISPARO.filter((p) => p !== 'selecionados').map((p) => [p, filtrarPublico(todos, p).length]))
      const cfg = await lerConfig(db)
      return ok({
        competencia: comp, prazo: prazoDaCompetencia(comp, cfg.diaLimiteEnvioNf), contagem, pessoas: [...todos.values()].map((a) => lerAlvoJson(a, gente)).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
        modelo: MODELO_PADRAO, automatico: await lerDisparoAuto(db),
      })
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/disparos', cap: 'fin:ver',
    h: async ({ db, req }) => {
      const ps: unknown[] = []
      let w = 'true'
      if (req.query.competencia && RE_COMPETENCIA.test(req.query.competencia)) { ps.push(req.query.competencia); w = 'competencia = $1' }
      const rows = (await db.query(`select * from fin_disparos where ${w} order by criado_em desc limit 50`, ps)).rows
      const gente = await mapaPessoas(db)
      return ok({
        itens: rows.map((d) => ({
          id: d.id, competencia: d.competencia, publico: d.publico, rotuloPublico: ROTULO_PUBLICO[d.publico as PublicoDisparo] ?? d.publico, assunto: d.assunto,
          destinatarios: d.destinatarios, automatico: d.automatico,
          criadoPor: d.criado_por === 'sistema' ? 'Automático' : nomeDe(gente, d.criado_por), criadoEm: d.criado_em,
        })),
      })
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/disparos/:id', cap: 'fin:ver',
    h: async ({ db, params }) => {
      const d = (await db.query('select * from fin_disparos where id = $1', [uuid(params.id)])).rows[0]
      if (!d) throw naoEncontrado('Disparo não encontrado.')
      const gente = await mapaPessoas(db)
      const envios = (await db.query('select * from fin_disparo_envios where disparo_id = $1 order by id', [d.id])).rows
      // Se a pessoa já abriu a notificação no portal.
      const lidas = new Map<string, boolean>((await db.query("select destinatario_id, lida_em is not null as lida from ntf_notificacoes where chave like $1", [`disparo:${d.id}:%`])).rows.map((x) => [x.destinatario_id, x.lida]))
      return ok({
        disparo: { id: d.id, competencia: d.competencia, publico: d.publico, rotuloPublico: ROTULO_PUBLICO[d.publico as PublicoDisparo] ?? d.publico, assunto: d.assunto, mensagem: d.mensagem, automatico: d.automatico, criadoEm: d.criado_em, criadoPor: d.criado_por === 'sistema' ? 'Automático' : nomeDe(gente, d.criado_por) },
        envios: envios.map((e) => ({ pessoaId: e.pessoa_id, nome: nomeDe(gente, e.pessoa_id), contratos: e.contratos,
          lida: !!lidas.get(e.pessoa_id) })),
      })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/disparos', cap: 'fin:disparar',
    h: async ({ db, req, usuario, agora }) => {
      const b = req.corpo ?? {}
      const competencia = texto(b.competencia, 'competência', { max: 7 })
      if (!RE_COMPETENCIA.test(competencia)) throw invalido('Competência inválida (AAAA-MM).', { competencia: 'Use AAAA-MM' })
      if (competencia > somarMeses(`${hoje(agora).slice(0, 7)}-01`, 1).slice(0, 7)) throw invalido('Não é possível cobrar notas de competências futuras.', { competencia: 'Futura' })
      const publico = enumerado(b.publico, 'público', PUBLICOS_DISPARO)
      const selecionados = publico === 'selecionados' ? (Array.isArray(b.pessoas) ? b.pessoas.filter((x: unknown) => typeof x === 'string').slice(0, 500) as string[] : []) : []
      if (publico === 'selecionados' && !selecionados.length) throw invalido('Selecione ao menos uma pessoa.', { pessoas: 'Obrigatório' })
      const assunto = texto(b.assunto, 'assunto', { min: 3, max: 200 })
      const mensagem = texto(b.mensagem, 'mensagem', { min: 10, max: 4000 })
      const r = await db.tx((t) => executarDisparo(t, { competencia, publico, selecionados, assunto, mensagem, criadoPor: usuario.colaboradorId }))
      if (!r.id) throw conflito('Ninguém se encaixa nesse público para a competência escolhida.')
      return ok(r, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'financeiro/disparos-automaticos', cap: 'fin:disparar',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const dias = Array.isArray(b.dias) ? [...new Set((b.dias as unknown[]).map(Number))].sort((x, y) => x - y) : []
      if (dias.some((d) => !Number.isInteger(d) || d < -20 || d > 15)) throw invalido('Cada dia deve estar entre 20 dias antes e 15 dias depois do limite.', { dias: 'Entre -20 e 15' })
      if (dias.length > 10) throw invalido('No máximo 10 lembretes por mês.', { dias: 'Máx. 10' })
      const ativo = b.ativo !== false
      if (ativo && !dias.length) throw invalido('Escolha ao menos um dia para o lembrete automático.', { dias: 'Obrigatório' })
      const assunto = texto(b.assunto, 'assunto', { min: 3, max: 200 })
      const mensagem = texto(b.mensagem, 'mensagem', { min: 10, max: 4000 })
      await db.tx(async (t) => {
        await t.query(`insert into fin_disparo_auto (id, ativo, dias, incluir_devolvidas, assunto, mensagem, atualizado_em, atualizado_por) values (true,$1,$2,$3,$4,$5,now(),$6)
          on conflict (id) do update set ativo = $1, dias = $2, incluir_devolvidas = $3, assunto = $4, mensagem = $5, atualizado_em = now(), atualizado_por = $6`,
          [ativo, dias, b.incluirDevolvidas !== false, assunto, mensagem, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'fin_disparo_auto', null, 'configurado', { ativo, dias })
      })
      return ok(await lerDisparoAuto(db))
    },
  },
]
