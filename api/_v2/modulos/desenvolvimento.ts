/* ============================================================
   API v2 · Ciclo de Desenvolvimento e Avaliação de Desempenho
   Regras puras: src/domain/v2/desenvolvimento.ts. Tabelas: db/v2/101.

   Quem vê o quê (decidido AQUI, nunca no cliente):
   - Formulário: só o próprio respondente abre, salva e envia. Enviado
     não muda (nem pelo RH, nem pela liderança).
   - Ciclo: RH/diretoria (dsv:gerenciar), a pessoa avaliada e a liderança
     responsável (avaliador_id). Outras pessoas recebem 404.
   - Autoavaliação: a liderança só vê depois de enviar a própria.
   - Avaliação da liderança: a pessoa vê depois da devolutiva (config).
   - Feedback da equipe sobre a liderança: respostas sem respondente
     (dsv_respostas_equipe). Comentários e médias só para quem tem
     dsv:confidencial, com mínimo de respostas e registro de acesso.
     A liderança avaliada (e quem conduz a devolutiva dela) vê só
     médias + síntese do RH, depois que o RH libera.
   ============================================================ */
import { createHash } from 'node:crypto'
import {
  auditar, conflito, dataISO, enumerado, idsComFuncao, idsComPapel, invalido, naoEncontrado, notificar, ok, paginacao,
  pessoas as lerPessoas, setores as lerSetores, cargos as lerCargos, proibido, tem, texto,
  type Db, type Executor, type Rota, type Usuario,
} from '../nucleo.js'
import * as D from '../../../src/domain/v2/desenvolvimento.js'
import { somarDias } from '../../../src/domain/datas.js'

type Obj = Record<string, any>

/** Hoje no fuso de Brasília (datas do cronograma são dias do calendário brasileiro). */
export const hojeBR = (agora = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(agora)
const dataBR = (iso: string) => iso.split('-').reverse().join('/')
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: string) => { if (!UUID.test(v)) throw naoEncontrado(); return v }

const CICLO_COLS = `c.id, c.colaborador_id, c.vinculo_id, c.data_base::text as data_base, c.tipo, c.marco, c.numero,
  c.data_prevista::text as data_prevista, c.prazo::text as prazo, c.etapa, c.etapa_antes_suspensao, c.lideranca,
  c.avaliador_id, c.avaliador_manual, c.setor_id, c.cargo_id, c.coleta_concluida_em, c.concluido_em, c.concluido_por,
  c.cancelado_em, c.cancelado_por, c.motivo, c.criado_em`
const FORM_COLS = `f.id, f.ciclo_id, f.tipo, f.respondente_id, f.modelo_chave, f.modelo_versao, f.retrato, f.status, f.rascunho, f.respostas,
  f.nota, f.prazo::text as prazo, f.enviado_em, f.motivo`

interface Ciclo {
  id: string; colaborador_id: string; vinculo_id: string; data_base: string; tipo: D.TipoCiclo; marco: string; numero: number
  data_prevista: string; prazo: string; etapa: D.Etapa; etapa_antes_suspensao: D.Etapa | null; lideranca: boolean
  avaliador_id: string | null; avaliador_manual: boolean; setor_id: string | null; cargo_id: string | null
  coleta_concluida_em: Date | null; concluido_em: Date | null; concluido_por: string | null; cancelado_em: Date | null; cancelado_por: string | null; motivo: string | null; criado_em: Date
}
interface Form {
  id: string; ciclo_id: string; tipo: D.TipoFormulario; respondente_id: string; modelo_chave: D.ChaveModelo; modelo_versao: number
  retrato: D.RetratoModelo; status: D.StatusFormulario; rascunho: D.Respostas | null; respostas: D.Respostas | null; nota: string | number | null
  prazo: string; enviado_em: Date | null; motivo: string | null
}

/* ---------- configuração e modelos ---------- */
export async function lerConfig(ex: Executor): Promise<D.ConfigDesenvolvimento> {
  const r = await ex.query("select valor from dsv_config where chave = 'geral'")
  return D.normalizarConfig(r.rows[0]?.valor)
}
async function gravarConfig(ex: Executor, cfg: D.ConfigDesenvolvimento, por: string | null) {
  await ex.query(`insert into dsv_config (chave, valor, atualizado_por, atualizado_em) values ('geral', $1::jsonb, $2, now())
    on conflict (chave) do update set valor = excluded.valor, atualizado_por = excluded.atualizado_por, atualizado_em = now()`, [JSON.stringify(cfg), por])
}
export async function modeloAtual(ex: Executor, chave: D.ChaveModelo): Promise<D.Modelo> {
  const r = await ex.query('select chave, versao, titulo, descricao, escala, criterios, perguntas from dsv_modelos where chave = $1 order by versao desc limit 1', [chave])
  const m = r.rows[0]
  return m ? { chave: m.chave, versao: m.versao, titulo: m.titulo, descricao: m.descricao ?? '', escala: m.escala, criterios: m.criterios, perguntas: m.perguntas } : D.MODELOS_PADRAO[chave]
}

/* ---------- organização ---------- */
interface Org { gente: D.PessoaMin[]; setores: D.SetorMin[]; porId: Map<string, D.PessoaMin> }
async function lerOrg(ex: Executor): Promise<Org> {
  const gente = (await lerPessoas(ex)) as unknown as D.PessoaMin[]
  const setores = (await lerSetores(ex)).map((s) => ({ id: s.id, nome: s.nome, gestorId: s.gestorId ?? null, liderancaIds: s.liderancaIds ?? [] }))
  return { gente, setores, porId: new Map(gente.map((p) => [p.id, p])) }
}
const nomeDe = (org: Org, id: string | null | undefined) => (id ? org.porId.get(id)?.nome ?? 'Cadastro removido' : null)

/** Quem administra o desenvolvimento: RH, administração e a função adicional "gestão de desenvolvimento". */
async function idsGestoresDsv(ex: Executor): Promise<string[]> {
  return [...new Set([...(await idsComPapel(ex, 'rh', 'admin', 'diretoria')), ...(await idsComFuncao(ex, 'gestor_desenvolvimento'))])]
}

/* ---------- helpers de ciclo ---------- */
async function cicloPorId(ex: Executor, id: string, travar = false): Promise<Ciclo> {
  const r = await ex.query(`select ${CICLO_COLS} from dsv_ciclos c where c.id = $1 ${travar ? 'for update' : ''}`, [uuid(id)])
  if (!r.rows[0]) throw naoEncontrado()
  return r.rows[0] as Ciclo
}
const formsDoCiclo = async (ex: Executor, cicloId: string): Promise<Form[]> =>
  (await ex.query(`select ${FORM_COLS} from dsv_formularios f where f.ciclo_id = $1 order by f.criado_em, f.tipo`, [cicloId])).rows as Form[]

const linkCiclo = (id: string) => `/desenvolvimento/ciclos/${id}`
const linkForm = (id: string) => `/desenvolvimento/responder/${id}`

function tituloNotificacaoForm(tipo: D.TipoFormulario, ciclo: Pick<Ciclo, 'tipo' | 'numero'>, avaliado: string): { titulo: string; corpo: string } {
  const marco = D.rotuloMarco(ciclo.tipo, ciclo.numero)
  switch (tipo) {
    case 'acomp_colaborador': return { titulo: `Seu acompanhamento de ${ciclo.numero} dias`, corpo: 'Conte como estão sendo seus primeiros meses na 4JURIS.' }
    case 'acomp_lideranca': return { titulo: `Acompanhamento de ${avaliado}`, corpo: `${marco}: registre sua percepção sobre a adaptação.` }
    case 'autoavaliacao': return { titulo: 'Sua autoavaliação está disponível', corpo: `${marco}: um momento para refletir sobre o seu semestre.` }
    case 'lider_avalia': return { titulo: `Avaliação de ${avaliado}`, corpo: `${marco}: avalie o semestre de ${avaliado}.` }
    case 'equipe_avalia_lider': return { titulo: 'Feedback sobre a sua liderança direta', corpo: 'Sua visão ajuda a liderança a evoluir. Veja antes como as respostas são usadas.' }
  }
}

async function criarFormulario(ex: Executor, ciclo: Pick<Ciclo, 'id' | 'tipo' | 'numero'>, plano: D.PlanoFormulario, prazo: string, avaliadoNome: string, cache: Map<D.ChaveModelo, D.Modelo>) {
  let m = cache.get(plano.modelo)
  if (!m) { m = await modeloAtual(ex, plano.modelo); cache.set(plano.modelo, m) }
  const r = await ex.query(`insert into dsv_formularios (ciclo_id, tipo, respondente_id, modelo_chave, modelo_versao, retrato, prazo)
    values ($1,$2,$3,$4,$5,$6::jsonb,$7) on conflict (ciclo_id, tipo, respondente_id) do nothing returning id`,
    [ciclo.id, plano.tipo, plano.respondenteId, m.chave, m.versao, JSON.stringify(m), prazo])
  const id = r.rows[0]?.id as string | undefined
  if (id) {
    const n = tituloNotificacaoForm(plano.tipo, ciclo, avaliadoNome)
    await notificar(ex, { destinatarioId: plano.respondenteId, tipo: 'desenvolvimento', titulo: n.titulo, corpo: `${n.corpo} Prazo: ${dataBR(prazo)}.`, link: linkForm(id), chave: `dsv-form:${id}` })
  }
  return id
}

/** Data em que a pessoa passou a ter `liderId` como liderança (último registro do histórico; sem registro, o início do vínculo). */
function naEquipeDesde(p: D.PessoaMin, liderId: string, historico: Obj[]): string | null {
  const regs = historico.filter((h) => h.colaboradorId === p.id && h.gestorNovoId === liderId).map((h) => String(h.dataEfetiva ?? h.em ?? '').slice(0, 10)).filter(Boolean).sort()
  return regs[regs.length - 1] ?? D.vinculoAberto(p)?.inicio ?? null
}

/** Fecha a coleta se possível e avança a etapa. Devolve a nova etapa (ou null se não mudou). */
async function avancarSePronto(ex: Executor, cicloId: string, hoje: string, cfg: D.ConfigDesenvolvimento, org: Org): Promise<D.Etapa | null> {
  const c = await cicloPorId(ex, cicloId, true)
  if (c.etapa !== 'coleta') return null
  const forms = await formsDoCiclo(ex, c.id)
  if (!D.coletaConcluida(forms, c.prazo, hoje, c)) return null
  // Feedback da equipe ainda pendente no fim do prazo: expira (não responder ≠ avaliação negativa).
  await ex.query(`update dsv_formularios set status = 'expirado', rascunho = null, motivo = 'Prazo encerrado sem resposta', atualizado_em = now()
    where ciclo_id = $1 and tipo = 'equipe_avalia_lider' and status in ('pendente','rascunho')`, [c.id])
  const nEquipe = Number((await ex.query('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [c.id])).rows[0].n)
  const etapa = D.etapaAposColeta(c, nEquipe > 0)
  const prazo = D.prazoDaEtapa(etapa, c.tipo, hoje, cfg)
  await ex.query('update dsv_ciclos set etapa = $2, prazo = $3, coleta_concluida_em = now(), atualizado_em = now() where id = $1', [c.id, etapa, prazo])
  await auditar(ex, null, 'dsv_ciclo', c.id, 'coleta_concluida', { etapa })
  const nome = nomeDe(org, c.colaborador_id) ?? 'colaborador(a)'
  if (etapa === 'consolidacao') {
    for (const g of await idsGestoresDsv(ex)) await notificar(ex, { destinatarioId: g, tipo: 'desenvolvimento', titulo: `Consolidar feedback da equipe de ${nome}`, corpo: `Prepare a síntese para a devolutiva até ${dataBR(prazo)}.`, link: linkCiclo(c.id), chave: `dsv-consolidar:${c.id}` })
  } else if (c.avaliador_id) {
    const t = c.tipo === 'acompanhamento' ? `Registre o acompanhamento de ${nome}` : `Hora da devolutiva de ${nome}`
    await notificar(ex, { destinatarioId: c.avaliador_id, tipo: 'desenvolvimento', titulo: t, corpo: `Os formulários foram concluídos. Prazo: ${dataBR(prazo)}.`, link: linkCiclo(c.id), chave: `dsv-devolutiva:${c.id}` })
  }
  return etapa
}

/* ---------- rotina: gera ciclos, acompanha lideranças, avança etapas e lembra prazos ---------- */
export interface ResultadoSync { criados: number; avancados: number; reprogramados: number; cancelados: number; lembretes: number }

export async function sincronizarDesenvolvimento(db: Db, agora = new Date(), so?: string[]): Promise<ResultadoSync> {
  const hoje = hojeBR(agora)
  return db.tx(async (t) => {
    await t.query('select pg_advisory_xact_lock(hashtext($1))', ['dsv:sync'])
    const out: ResultadoSync = { criados: 0, avancados: 0, reprogramados: 0, cancelados: 0, lembretes: 0 }
    let cfg = await lerConfig(t)
    if (!cfg.inicioVigencia) { cfg = { ...cfg, inicioVigencia: hoje }; await gravarConfig(t, cfg, null) }
    const org = await lerOrg(t)
    const alvo = so ? org.gente.filter((p) => so.includes(p.id)) : org.gente
    const gestores = await idsGestoresDsv(t)
    const cache = new Map<D.ChaveModelo, D.Modelo>()
    let historico: Obj[] | null = null
    const filtroSo = so ? 'and colaborador_id = any($1::text[])' : ''

    const abertos = (await t.query(`select ${CICLO_COLS} from dsv_ciclos c where c.etapa not in ('concluida','cancelada') ${filtroSo.replace('colaborador_id', 'c.colaborador_id')}`, so ? [so] : [])).rows as Ciclo[]
    const cancelar = async (c: Ciclo, motivo: string) => {
      await t.query("update dsv_ciclos set etapa = 'cancelada', cancelado_em = now(), motivo = $2, atualizado_em = now() where id = $1", [c.id, motivo])
      await t.query("update dsv_formularios set status = 'dispensado', rascunho = null, motivo = $2, atualizado_em = now() where ciclo_id = $1 and status in ('pendente','rascunho')", [c.id, motivo])
      await auditar(t, null, 'dsv_ciclo', c.id, 'ciclo_cancelado_automaticamente', { motivo })
      out.cancelados++
    }

    for (const p of alvo) {
      const meus = abertos.filter((c) => c.colaborador_id === p.id)
      if (!D.elegivelStatus(p)) {
        // Encerramento: ciclos abertos são cancelados; respostas enviadas ficam no histórico.
        if (p.status === 'encerrado') for (const c of meus) await cancelar(c, 'Parceria encerrada')
        continue
      }
      const v = D.vinculoAberto(p)
      if (!v) continue
      for (const c of meus) {
        if (c.vinculo_id !== v.id) { await cancelar(c, 'Novo período de parceria'); continue }
        if (c.data_base !== v.inicio && c.etapa === 'coleta') {
          const forms = await formsDoCiclo(t, c.id)
          if (forms.every((f) => f.status === 'pendente')) {
            // Data de admissão corrigida e nada respondido: o ciclo some e é recriado na data certa (nada humano se perde).
            await t.query('delete from dsv_ciclos where id = $1', [c.id])
            await t.query("update ntf_notificacoes set lida_em = coalesce(lida_em, now()) where chave = any($1::text[])", [forms.map((f) => `dsv-form:${f.id}`)])
            await auditar(t, null, 'pessoa', p.id, 'dsv_ciclo_reprogramado', { marco: c.marco, de: c.data_base, para: v.inicio })
            out.reprogramados++
          } else {
            // Já há respostas: preserva o ciclo e registra a nova base.
            await t.query('update dsv_ciclos set data_base = $2, atualizado_em = now() where id = $1', [c.id, v.inicio])
            await auditar(t, null, 'dsv_ciclo', c.id, 'data_base_corrigida', { de: c.data_base, para: v.inicio })
          }
        }
      }

      const lider = D.liderDe(p, org.gente, org.setores)
      const lideranca = D.ehLideranca(p.id, org.gente, org.setores)
      for (const m of D.marcosDevidos(v.inicio, hoje, cfg)) {
        if (p.encerramentoAgendado?.data && p.encerramentoAgendado.data <= m.data) continue
        const prazo = D.prazoColeta(m, cfg)
        const ins = await t.query(`insert into dsv_ciclos (colaborador_id, vinculo_id, data_base, tipo, marco, numero, data_prevista, prazo, lideranca, avaliador_id, setor_id, cargo_id)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) on conflict (colaborador_id, vinculo_id, marco) do nothing returning id`,
          [p.id, v.id, v.inicio, m.tipo, m.marco, m.numero, m.data, prazo, m.tipo === 'avd' && lideranca, lider, p.setorId ?? null, p.cargoId ?? null])
        const id = ins.rows[0]?.id as string | undefined
        if (!id) continue
        out.criados++
        let equipe: string[] = []
        if (m.tipo === 'avd' && lideranca) {
          historico ??= (await t.query('select dados from app_historicofuncao')).rows.map((r) => r.dados as Obj)
          const limite = somarDias(hoje, -cfg.feedbackLideranca.minDiasNaEquipe)
          equipe = D.equipeDe(p.id, org.gente, org.setores).filter((x) => { const desde = naEquipeDesde(x, p.id, historico!); return !!desde && desde <= limite }).map((x) => x.id)
        }
        const ciclo = { id, tipo: m.tipo, numero: m.numero }
        for (const plano of D.formulariosDoCiclo(m.tipo, p.id, lider, m.tipo === 'avd' && lideranca, equipe)) await criarFormulario(t, ciclo, plano, prazo, p.nome, cache)
        await auditar(t, null, 'dsv_ciclo', id, 'ciclo_aberto', { marco: m.marco, dataPrevista: m.data, lideranca: m.tipo === 'avd' && lideranca, avaliadorId: lider, equipe: equipe.length })
        if (cfg.avisarRhInicio || !lider) for (const g of gestores) {
          await notificar(t, {
            destinatarioId: g, tipo: 'desenvolvimento', titulo: `${m.rotulo} de ${p.nome} iniciado`,
            corpo: lider ? `Data prevista ${dataBR(m.data)}; formulários até ${dataBR(prazo)}.` : 'Sem liderança definida no cadastro: designe quem conduz.',
            link: linkCiclo(id), chave: `dsv-inicio:${id}`,
          })
        }
      }
    }

    // Ciclos abertos: troca de liderança, equipe, avanço de etapa e lembretes.
    const vivos = (await t.query(`select ${CICLO_COLS} from dsv_ciclos c where c.etapa not in ('concluida','cancelada','suspensa') ${filtroSo.replace('colaborador_id', 'c.colaborador_id')}`, so ? [so] : [])).rows as Ciclo[]
    for (const c of vivos) {
      const p = org.porId.get(c.colaborador_id)
      if (!p || !D.elegivelStatus(p)) continue
      const nome = p.nome
      const liderAtual = c.avaliador_manual ? c.avaliador_id : D.liderDe(p, org.gente, org.setores)
      if (liderAtual && liderAtual !== c.avaliador_id) {
        // Troca de liderança: formulários ainda NÃO enviados passam à liderança atual; o que já foi enviado fica como está (histórico).
        const forms = await formsDoCiclo(t, c.id)
        for (const f of forms.filter((x) => D.ehFormLideranca(x.tipo) && !D.formFeito(x))) {
          await t.query("update dsv_formularios set respondente_id = $2, status = 'pendente', rascunho = null, motivo = 'Troca de liderança', atualizado_em = now() where id = $1", [f.id, liderAtual])
          await notificar(t, { destinatarioId: liderAtual, tipo: 'desenvolvimento', ...(() => { const n = tituloNotificacaoForm(f.tipo, c, nome); return { titulo: n.titulo, corpo: `${n.corpo} Prazo: ${dataBR(f.prazo)}.` } })(), link: linkForm(f.id), chave: `dsv-form:${f.id}:${liderAtual}` })
        }
        if (c.etapa === 'coleta' && D.exigeLideranca(c) && !forms.some((x) => D.ehFormLideranca(x.tipo))) {
          const plano = D.formulariosDoCiclo(c.tipo, p.id, liderAtual, c.lideranca, []).find((x) => D.ehFormLideranca(x.tipo))
          if (plano) await criarFormulario(t, c, plano, c.prazo, nome, cache)
        }
        await t.query('update dsv_ciclos set avaliador_id = $2, atualizado_em = now() where id = $1', [c.id, liderAtual])
        await auditar(t, null, 'dsv_ciclo', c.id, 'lideranca_atualizada', { de: c.avaliador_id, para: liderAtual })
        c.avaliador_id = liderAtual
      } else if (!liderAtual && c.avaliador_id && org.porId.get(c.avaliador_id)?.status === 'encerrado') {
        for (const g of gestores) await notificar(t, { destinatarioId: g, tipo: 'desenvolvimento', titulo: `Ciclo de ${nome} sem liderança ativa`, corpo: 'A liderança responsável saiu. Designe quem conduz.', link: linkCiclo(c.id), chave: `dsv-semlider:${c.id}:${c.avaliador_id}` })
      }

      if (c.etapa === 'coleta' && c.lideranca) {
        // Quem saiu da equipe antes de responder é dispensado (não conta como resposta nem como avaliação negativa).
        for (const f of (await formsDoCiclo(t, c.id)).filter((x) => x.tipo === 'equipe_avalia_lider' && !D.formFeito(x))) {
          const m = org.porId.get(f.respondente_id)
          if (!m || !D.elegivelStatus(m) || D.liderDe(m, org.gente, org.setores) !== c.colaborador_id)
            await t.query("update dsv_formularios set status = 'dispensado', rascunho = null, motivo = 'Saiu da equipe', atualizado_em = now() where id = $1", [f.id])
        }
      }
      if (c.etapa === 'coleta' && await avancarSePronto(t, c.id, hoje, cfg, org)) { out.avancados++; continue }

      // Lembretes e atrasos (uma notificação por formulário/etapa, sem duplicar).
      if (c.etapa === 'coleta') {
        for (const f of (await formsDoCiclo(t, c.id)).filter((x) => !D.formFeito(x))) {
          const dias = D.diasParaPrazo(f.prazo, hoje)
          if (dias >= 0 && dias <= cfg.lembreteDiasAntes) {
            await notificar(t, { destinatarioId: f.respondente_id, tipo: 'desenvolvimento', titulo: `Prazo próximo: ${D.FORMULARIO_INFO[f.tipo].rotulo.toLowerCase()}`, corpo: `Responda até ${dataBR(f.prazo)}.`, link: linkForm(f.id), chave: `dsv-lembrete:${f.id}` }); out.lembretes++
          } else if (dias < 0) {
            await notificar(t, { destinatarioId: f.respondente_id, tipo: 'desenvolvimento', titulo: `Formulário em atraso: ${D.FORMULARIO_INFO[f.tipo].rotulo.toLowerCase()}`, corpo: `O prazo era ${dataBR(f.prazo)}. Ainda dá para responder.`, link: linkForm(f.id), chave: `dsv-atraso:${f.id}` }); out.lembretes++
          }
        }
        if (c.prazo < hoje) for (const g of gestores) await notificar(t, { destinatarioId: g, tipo: 'desenvolvimento', titulo: `${D.rotuloMarco(c.tipo, c.numero)} de ${nome} em atraso`, corpo: 'Há formulários pendentes depois do prazo.', link: linkCiclo(c.id), chave: `dsv-atraso-rh:${c.id}:coleta` })
      } else {
        const resp = c.etapa === 'consolidacao' || c.etapa === 'encerramento' ? gestores : c.avaliador_id ? [c.avaliador_id] : gestores
        const dias = D.diasParaPrazo(c.prazo, hoje)
        const etapa = D.ETAPA_ROTULO[c.etapa].toLowerCase()
        for (const d of resp) {
          if (dias < 0) { await notificar(t, { destinatarioId: d, tipo: 'desenvolvimento', titulo: `Etapa em atraso (${etapa}): ${nome}`, corpo: `O prazo era ${dataBR(c.prazo)}.`, link: linkCiclo(c.id), chave: `dsv-atraso:${c.id}:${c.etapa}` }); out.lembretes++ }
          else if (dias <= cfg.lembreteDiasAntes) { await notificar(t, { destinatarioId: d, tipo: 'desenvolvimento', titulo: `Prazo próximo (${etapa}): ${nome}`, corpo: `Até ${dataBR(c.prazo)}.`, link: linkCiclo(c.id), chave: `dsv-lembrete:${c.id}:${c.etapa}` }); out.lembretes++ }
        }
        if (dias < 0 && c.etapa !== 'consolidacao' && c.etapa !== 'encerramento')
          for (const g of gestores) await notificar(t, { destinatarioId: g, tipo: 'desenvolvimento', titulo: `Etapa em atraso (${etapa}): ${nome}`, corpo: `O prazo era ${dataBR(c.prazo)}.`, link: linkCiclo(c.id), chave: `dsv-atraso-rh:${c.id}:${c.etapa}` })
      }
    }

    // Ações de desenvolvimento (PDI e acompanhamentos): prazo próximo e atraso.
    const acoes = (await t.query(`select a.id, a.ciclo_id, a.colaborador_id, a.descricao, a.responsavel, a.prazo::text as prazo, c.avaliador_id
      from dsv_acoes a join dsv_ciclos c on c.id = a.ciclo_id
      where a.status in ('planejada','em_andamento') and a.prazo is not null and a.prazo <= $1::date ${so ? 'and a.colaborador_id = any($2::text[])' : ''}`, so ? [somarDias(hoje, 7), so] : [somarDias(hoje, 7)])).rows
    for (const a of acoes) {
      const p = org.porId.get(a.colaborador_id)
      if (!p || !D.elegivelStatus(p)) continue
      const atrasada = a.prazo < hoje
      const dest = new Set<string>()
      if (a.responsavel === 'colaborador' || a.responsavel === 'ambos') dest.add(a.colaborador_id)
      if ((a.responsavel === 'lideranca' || a.responsavel === 'ambos' || atrasada) && a.avaliador_id) dest.add(a.avaliador_id)
      if (a.responsavel === 'rh') for (const g of gestores) dest.add(g)
      const desc = String(a.descricao).slice(0, 80)
      for (const d of dest) {
        await notificar(t, {
          destinatarioId: d, tipo: 'desenvolvimento', titulo: atrasada ? 'Ação de desenvolvimento atrasada' : 'Ação de desenvolvimento com prazo próximo',
          corpo: `${desc}${d !== a.colaborador_id ? ` (${p.nome})` : ''} · prazo ${dataBR(a.prazo)}.`, link: linkCiclo(a.ciclo_id), chave: `dsv-acao:${a.id}:${atrasada ? 'atraso' : 'proximo'}`,
        })
        out.lembretes++
      }
    }
    return out
  })
}

/* ---------- acesso por ciclo ---------- */
interface PapelCiclo { rh: boolean; confidencial: boolean; avaliado: boolean; lider: boolean }
function papelNoCiclo(u: Usuario, c: Ciclo): PapelCiclo {
  const p = { rh: tem(u, 'dsv:gerenciar'), confidencial: tem(u, 'dsv:confidencial'), avaliado: c.colaborador_id === u.colaboradorId, lider: !!c.avaliador_id && c.avaliador_id === u.colaboradorId }
  // Quem não participa não descobre nem que o ciclo existe.
  if (!p.rh && !p.avaliado && !p.lider) throw naoEncontrado()
  return p
}

/** Linha de listagem: ciclo + nomes + status exibido + resumo dos formulários. */
interface LinhaCiclo {
  id: string; colaboradorId: string; colaboradorNome: string; setorId: string | null; setorNome: string | null; cargoId: string | null; cargoNome: string | null
  avaliadorId: string | null; avaliadorNome: string | null; tipo: D.TipoCiclo; marco: string; numero: number; rotulo: string; dataPrevista: string; prazo: string
  etapa: D.Etapa; status: D.StatusExibido; atrasado: boolean; lideranca: boolean; concluidoEm: Date | null; dataBase: string
  formularios: { total: number; feitos: number; pendentesPorTipo: Partial<Record<D.TipoFormulario, number>> }
  notaAuto: number | null; notaLideranca: number | null
}
async function linhasCiclos(ex: Executor, where: string, params: unknown[], org: Org, hoje: string, comNotas = false): Promise<LinhaCiclo[]> {
  const rows = (await ex.query(`select ${CICLO_COLS},
      coalesce(json_agg(json_build_object('tipo', f.tipo, 'status', f.status, 'nota', f.nota)) filter (where f.id is not null), '[]'::json) as forms
    from dsv_ciclos c left join dsv_formularios f on f.ciclo_id = c.id
    where ${where} group by c.id order by c.data_prevista desc, c.criado_em desc`, params)).rows as (Ciclo & { forms: { tipo: D.TipoFormulario; status: D.StatusFormulario; nota: number | string | null }[] })[]
  const cargosL = await lerCargos(ex)
  const setorNome = (id: string | null) => (id ? org.setores.find((s) => s.id === id)?.nome ?? null : null)
  return rows.map((c) => {
    const pend: Partial<Record<D.TipoFormulario, number>> = {}
    for (const f of c.forms) if (!D.formFeito(f)) pend[f.tipo] = (pend[f.tipo] ?? 0) + 1
    const nota = (t: D.TipoFormulario[]) => { const f = c.forms.find((x) => t.includes(x.tipo) && x.status === 'enviado' && x.nota !== null); return f ? Number(f.nota) : null }
    return {
      id: c.id, colaboradorId: c.colaborador_id, colaboradorNome: nomeDe(org, c.colaborador_id)!, setorId: c.setor_id, setorNome: setorNome(c.setor_id), cargoId: c.cargo_id,
      cargoNome: c.cargo_id ? cargosL.find((g) => g.id === c.cargo_id)?.nome ?? null : null, avaliadorId: c.avaliador_id, avaliadorNome: nomeDe(org, c.avaliador_id),
      tipo: c.tipo, marco: c.marco, numero: c.numero, rotulo: D.rotuloMarco(c.tipo, c.numero), dataPrevista: c.data_prevista, prazo: c.prazo, etapa: c.etapa,
      status: D.statusExibido(c, c.forms), atrasado: D.emAtraso(c, hoje), lideranca: c.lideranca, concluidoEm: c.concluido_em, dataBase: c.data_base,
      formularios: { total: c.forms.length, feitos: c.forms.filter(D.formFeito).length, pendentesPorTipo: pend },
      notaAuto: comNotas ? nota(['autoavaliacao']) : null, notaLideranca: comNotas ? nota(['lider_avalia']) : null,
    }
  })
}

/** Agregado do feedback da equipe de um ciclo (com mínimo de respostas). */
async function agregadoEquipe(ex: Executor, cicloId: string, cfg: D.ConfigDesenvolvimento) {
  const resp = (await ex.query('select respostas, modelo_versao from dsv_respostas_equipe where ciclo_id = $1', [cicloId])).rows
  const form = (await ex.query("select retrato from dsv_formularios where ciclo_id = $1 and tipo = 'equipe_avalia_lider' limit 1", [cicloId])).rows[0]
  const modelo: D.RetratoModelo = form?.retrato ?? D.MODELOS_PADRAO.avd_equipe_lideranca
  return { modelo, respostas: resp.map((r) => r.respostas as D.Respostas), agregado: D.agregar(resp.map((r) => r.respostas as D.Respostas), modelo.criterios, cfg.feedbackLideranca.minRespostas) }
}

/** Visão do formulário enviado, se o papel pode ver. */
function podeVerRespostas(f: Form, papel: PapelCiclo, c: Ciclo, forms: Form[], devolutivaRegistrada: boolean, cfg: D.ConfigDesenvolvimento, eu: string): boolean {
  if (f.tipo === 'equipe_avalia_lider' || f.status !== 'enviado') return false
  if (papel.rh || f.respondente_id === eu) return true
  if (f.tipo === 'autoavaliacao' || f.tipo === 'acomp_colaborador') {
    // A liderança vê a percepção/autoavaliação depois de enviar a própria (evita ancoragem) ou quando a coleta acabou.
    if (!papel.lider) return false
    const minha = forms.find((x) => D.ehFormLideranca(x.tipo))
    return !minha || minha.status === 'enviado' || c.etapa !== 'coleta'
  }
  if (D.ehFormLideranca(f.tipo)) return papel.lider || (papel.avaliado && cfg.colaboradorVeAvaliacaoLideranca && devolutivaRegistrada)
  return false
}

async function detalheCiclo(ex: Executor, u: Usuario, c: Ciclo, hoje: string) {
  const papel = papelNoCiclo(u, c)
  const cfg = await lerConfig(ex)
  const org = await lerOrg(ex)
  const forms = await formsDoCiclo(ex, c.id)
  const dev = (await ex.query(`select realizada_em::text as realizada_em, rh_acompanhou, pontos_fortes, a_desenvolver, dificuldades, orientacoes, feedback,
      percepcao_colaborador, percepcao_em, registrada_por, registrada_em from dsv_devolutivas where ciclo_id = $1`, [c.id])).rows[0] ?? null
  const pdi = (await ex.query('select metas, treinamentos, indicadores, revisao_em::text as revisao_em, registrado_por, registrado_em from dsv_pdis where ciclo_id = $1', [c.id])).rows[0] ?? null
  const acoes = (await ex.query(`select id, origem, competencia, descricao, responsavel, prazo::text as prazo, indicador, status, resultado, concluida_em::text as concluida_em
      from dsv_acoes where ciclo_id = $1 order by criado_em`, [c.id])).rows
  // Ações de ciclos anteriores ainda abertas ou concluídas desde então: "o que foi feito do último PDI".
  const anteriores = (await ex.query(`select a.id, a.origem, a.competencia, a.descricao, a.responsavel, a.prazo::text as prazo, a.status, a.resultado, a.concluida_em::text as concluida_em, c.marco, c.tipo, c.numero
      from dsv_acoes a join dsv_ciclos c on c.id = a.ciclo_id where a.colaborador_id = $1 and a.ciclo_id <> $2 and c.data_prevista < $3::date
      order by c.data_prevista desc, a.criado_em limit 40`, [c.colaborador_id, c.id, c.data_prevista])).rows
  const sintese = (await ex.query('select texto, liberada_em, atualizado_em from dsv_sinteses where ciclo_id = $1', [c.id])).rows[0] ?? null
  const devolutivaRegistrada = !!dev?.registrada_em
  const equipeForms = forms.filter((f) => f.tipo === 'equipe_avalia_lider')

  let feedbackEquipe: Obj | null = null
  if (c.lideranca && equipeForms.length) {
    const nResp = Number((await ex.query('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [c.id])).rows[0].n)
    feedbackEquipe = {
      convidados: equipeForms.length, respostas: nResp, minimo: cfg.feedbackLideranca.minRespostas,
      pendentes: equipeForms.filter((f) => !D.formFeito(f)).length, suprimido: nResp < cfg.feedbackLideranca.minRespostas,
      sinteseLiberada: !!sintese?.liberada_em,
    }
    // Liderança avaliada e quem conduz a devolutiva dela: médias e síntese, depois de liberadas e com o mínimo.
    if ((papel.avaliado || papel.lider) && sintese?.liberada_em && nResp >= cfg.feedbackLideranca.minRespostas) {
      const ag = await agregadoEquipe(ex, c.id, cfg)
      feedbackEquipe.agregado = { ...ag.agregado }
      feedbackEquipe.sintese = sintese.texto
    }
    if (papel.confidencial) feedbackEquipe.sinteseRascunho = sintese?.texto ?? ''
  }

  const formularios = forms.map((f) => {
    const visivel = podeVerRespostas(f, papel, c, forms, devolutivaRegistrada, cfg, u.colaboradorId)
    const mostrarQuem = f.tipo !== 'equipe_avalia_lider' || papel.rh
    if (f.tipo === 'equipe_avalia_lider' && !papel.rh) return null
    return {
      id: f.id, tipo: f.tipo, rotulo: D.FORMULARIO_INFO[f.tipo].rotulo, status: f.status, prazo: f.prazo, enviadoEm: f.enviado_em, motivo: f.motivo,
      respondenteId: mostrarQuem ? f.respondente_id : null, respondenteNome: mostrarQuem ? nomeDe(org, f.respondente_id) : null,
      meu: f.respondente_id === u.colaboradorId,
      nota: visivel && f.nota !== null ? Number(f.nota) : null,
      retrato: visivel ? f.retrato : null,
      respostas: visivel ? f.respostas : null,
    }
  }).filter(Boolean)

  const aberto = D.cicloAberto(c.etapa)
  const conduz = papel.rh || papel.lider
  const linha = (await linhasCiclos(ex, 'c.id = $1', [c.id], org, hoje))[0]
  const eventos = papel.rh ? (await ex.query(`select em, colaborador_id, acao, detalhes from aud_eventos where entidade = 'dsv_ciclo' and entidade_id = $1 order by em desc limit 60`, [c.id])).rows
    .map((e) => ({ em: e.em, quem: nomeDe(org, e.colaborador_id) ?? 'Rotina automática', acao: e.acao, detalhes: e.detalhes })) : []
  return {
    ciclo: { ...linha, motivo: c.motivo, canceladoEm: c.cancelado_em, avaliadorManual: c.avaliador_manual, coletaConcluidaEm: c.coleta_concluida_em, etapaAntesSuspensao: c.etapa_antes_suspensao },
    papel: { rh: papel.rh, confidencial: papel.confidencial, avaliado: papel.avaliado, lider: papel.lider },
    formularios, feedbackEquipe,
    devolutiva: dev && {
      realizadaEm: dev.realizada_em, rhAcompanhou: dev.rh_acompanhou, pontosFortes: dev.pontos_fortes, aDesenvolver: dev.a_desenvolver, dificuldades: dev.dificuldades,
      orientacoes: dev.orientacoes, feedback: dev.feedback, percepcaoColaborador: dev.percepcao_colaborador, percepcaoEm: dev.percepcao_em,
      registradaPor: nomeDe(org, dev.registrada_por), registradaEm: dev.registrada_em,
    },
    pdi: pdi && { metas: pdi.metas, treinamentos: pdi.treinamentos, indicadores: pdi.indicadores, revisaoEm: pdi.revisao_em, registradoPor: nomeDe(org, pdi.registrado_por), registradoEm: pdi.registrado_em },
    acoes, acoesAnteriores: anteriores.map((a) => ({ ...a, rotulo: D.rotuloMarco(a.tipo, a.numero) })),
    eventos,
    permissoes: {
      devolutiva: conduz && aberto && ['devolutiva', 'pdi', 'encerramento'].includes(c.etapa),
      pdi: c.tipo === 'avd' && conduz && aberto && ['pdi', 'encerramento'].includes(c.etapa),
      acoes: conduz && aberto && (c.tipo === 'acompanhamento' ? c.etapa === 'devolutiva' : ['devolutiva', 'pdi', 'encerramento'].includes(c.etapa)),
      percepcao: papel.avaliado && devolutivaRegistrada && c.etapa !== 'cancelada',
      atualizarAcoes: papel.avaliado || conduz,
      consolidar: papel.rh && c.etapa === 'consolidacao',
      sintese: papel.confidencial && c.lideranca && equipeForms.length > 0,
      encerrar: papel.rh && c.etapa === 'encerramento',
      reabrir: papel.rh && c.etapa === 'concluida',
      cancelar: papel.rh && aberto,
      suspender: papel.rh && aberto && c.etapa !== 'suspensa',
      retomar: papel.rh && c.etapa === 'suspensa',
      designar: papel.rh && aberto && c.etapa !== 'suspensa',
      dispensar: papel.rh && c.etapa === 'coleta',
    },
    escala: cfg.escala, escalaPercepcao: D.ESCALA_PERCEPCAO, naRotulo: cfg.naRotulo,
  }
}

/* ---------- validações de corpo ---------- */
const textoOpc = (v: unknown, campo: string, max = 4000) => texto(v, campo, { obrigatorio: false, max }) || null
function exigirAberto(c: Ciclo) { if (!D.cicloAberto(c.etapa)) throw conflito('Este ciclo está encerrado.') }

async function lerAcaoCorpo(corpo: Obj) {
  return {
    competencia: textoOpc(corpo.competencia, 'competência', 120),
    descricao: texto(corpo.descricao, 'descrição da ação', { max: 1000 }),
    responsavel: enumerado(corpo.responsavel, 'responsável', ['colaborador', 'lideranca', 'ambos', 'rh'] as const, 'colaborador'),
    prazo: dataISO(corpo.prazo, 'prazo'),
    indicador: textoOpc(corpo.indicador, 'indicador', 500),
  }
}

/* ---------- jornada ---------- */
async function jornada(ex: Executor, u: Usuario, pessoaId: string, hoje: string) {
  const org = await lerOrg(ex)
  const p = org.porId.get(pessoaId)
  if (!p) throw naoEncontrado()
  const rh = tem(u, 'dsv:gerenciar')
  const eu = u.colaboradorId === pessoaId
  const lider = D.liderDe(p, org.gente, org.setores) === u.colaboradorId ||
    Number((await ex.query("select count(*)::int n from dsv_ciclos where colaborador_id = $1 and avaliador_id = $2 and etapa not in ('cancelada')", [pessoaId, u.colaboradorId])).rows[0].n) > 0
  if (!rh && !eu && !lider) throw naoEncontrado()
  const cfg = await lerConfig(ex)
  const v = D.vinculoAberto(p)
  const ciclos = await linhasCiclos(ex, 'c.colaborador_id = $1', [pessoaId], org, hoje, true)
  const devs = (await ex.query(`select d.ciclo_id, d.realizada_em::text as realizada_em, d.registrada_em from dsv_devolutivas d join dsv_ciclos c on c.id = d.ciclo_id where c.colaborador_id = $1`, [pessoaId])).rows
  const devPorCiclo = new Map(devs.map((d) => [d.ciclo_id, d]))
  const sinteses = new Map((await ex.query(`select s.ciclo_id, s.liberada_em from dsv_sinteses s join dsv_ciclos c on c.id = s.ciclo_id where c.colaborador_id = $1`, [pessoaId])).rows.map((s) => [s.ciclo_id, s.liberada_em]))
  // Notas: a avaliação da liderança aparece para a própria pessoa só depois da devolutiva (mesma regra do ciclo).
  const evolucao = []
  for (const c of ciclos.filter((x) => x.tipo === 'avd' && x.etapa !== 'cancelada').reverse()) {
    const devOk = !!devPorCiclo.get(c.id)?.registrada_em
    const verLider = rh || lider || (eu && cfg.colaboradorVeAvaliacaoLideranca && devOk)
    let equipe: number | null = null
    if (c.lideranca && (rh && tem(u, 'dsv:confidencial') || ((eu || lider) && sinteses.get(c.id)))) {
      const ag = await agregadoEquipe(ex, c.id, cfg)
      equipe = ag.agregado.suprimido ? null : ag.agregado.media
    }
    evolucao.push({ cicloId: c.id, rotulo: `${c.numero}ª AVD`, data: c.dataPrevista, auto: c.notaAuto, lideranca: verLider ? c.notaLideranca : null, equipe })
  }
  // Comparação por critério entre as duas últimas avaliações da liderança visíveis.
  const comparativo: Obj[] = []
  const visiveis = ciclos.filter((x) => x.tipo === 'avd' && x.notaLideranca !== null && (rh || lider || (eu && cfg.colaboradorVeAvaliacaoLideranca && devPorCiclo.get(x.id)?.registrada_em))).slice(0, 2)
  if (visiveis.length) {
    const fs = (await ex.query("select ciclo_id, retrato, respostas from dsv_formularios where ciclo_id = any($1::uuid[]) and tipo = 'lider_avalia' and status = 'enviado'", [visiveis.map((x) => x.id)])).rows
    const atual = fs.find((f) => f.ciclo_id === visiveis[0].id), anterior = visiveis[1] ? fs.find((f) => f.ciclo_id === visiveis[1].id) : null
    if (atual) for (const k of (atual.retrato as D.RetratoModelo).criterios) {
      const n = atual.respostas?.notas?.[k.id], a = anterior?.respostas?.notas?.[k.id]
      comparativo.push({ id: k.id, nome: k.nome, atual: typeof n === 'number' ? n : null, anterior: typeof a === 'number' ? a : null })
    }
  }
  const historico = (await ex.query("select dados from app_historicofuncao where dados->>'colaboradorId' = $1", [pessoaId])).rows.map((r) => r.dados as Obj)
  const cargosL = await lerCargos(ex)
  const cargoNome = (id?: string) => (id ? cargosL.find((g) => g.id === id)?.nome ?? 'Função removida' : null)
  const setorNome = (id?: string) => (id ? org.setores.find((s) => s.id === id)?.nome ?? 'Área removida' : null)
  const mudancas = historico.map((h) => ({
    data: String(h.dataEfetiva ?? h.em ?? '').slice(0, 10),
    cargo: h.cargoNovoId && h.cargoNovoId !== h.cargoAnteriorId ? { de: cargoNome(h.cargoAnteriorId), para: cargoNome(h.cargoNovoId) } : null,
    area: h.setorNovoId && h.setorNovoId !== h.setorAnteriorId ? { de: setorNome(h.setorAnteriorId), para: setorNome(h.setorNovoId) } : null,
    lideranca: h.gestorNovoId !== undefined && h.gestorNovoId !== h.gestorAnteriorId ? { de: nomeDe(org, h.gestorAnteriorId), para: nomeDe(org, h.gestorNovoId) } : null,
  })).filter((m) => m.data && (m.cargo || m.area || m.lideranca))
  const acoes = (await ex.query(`select a.id, a.ciclo_id, a.origem, a.competencia, a.descricao, a.responsavel, a.prazo::text as prazo, a.status, a.resultado, a.concluida_em::text as concluida_em
     from dsv_acoes a where a.colaborador_id = $1 order by a.criado_em desc`, [pessoaId])).rows
  const existentes = new Set(ciclos.filter((c) => c.dataBase === v?.inicio).map((c) => c.marco))
  return {
    pessoa: { id: p.id, nome: p.nome, setor: setorNome(p.setorId), cargo: cargoNome(p.cargoId), lideranca: nomeDe(org, D.liderDe(p, org.gente, org.setores)), ehLideranca: D.ehLideranca(p.id, org.gente, org.setores), admissao: v?.inicio ?? null, status: p.status },
    ciclos: ciclos.map((c) => ({ ...c, devolutivaEm: devPorCiclo.get(c.id)?.realizada_em ?? null, notaLideranca: (rh || lider || (eu && cfg.colaboradorVeAvaliacaoLideranca && devPorCiclo.get(c.id)?.registrada_em)) ? c.notaLideranca : null })),
    proximos: v ? D.proximosMarcos(v.inicio, hoje, 4).filter((m) => !existentes.has(m.marco)) : [],
    evolucao, comparativo, mudancas, acoes,
  }
}

/* ---------- rotas ---------- */
const filtrosLista = (q: Record<string, string>) => ({
  setor: q.setor || '', cargo: q.cargo || '', lider: q.lider || '', tipo: q.tipo === 'acompanhamento' || q.tipo === 'avd' ? q.tipo : '',
  status: q.status || '', marco: q.marco || '', q: (q.q || '').trim().toLowerCase(),
  de: /^\d{4}-\d{2}-\d{2}$/.test(q.de ?? '') ? q.de : '', ate: /^\d{4}-\d{2}-\d{2}$/.test(q.ate ?? '') ? q.ate : '',
  situacao: q.situacao === 'abertos' || q.situacao === 'encerrados' || q.situacao === 'atrasados' ? q.situacao : '',
})
function aplicarFiltros(l: LinhaCiclo[], f: ReturnType<typeof filtrosLista>) {
  return l.filter((c) =>
    (!f.setor || c.setorId === f.setor) && (!f.cargo || c.cargoId === f.cargo) && (!f.lider || c.avaliadorId === f.lider) &&
    (!f.tipo || c.tipo === f.tipo) && (!f.status || c.status === f.status) && (!f.marco || c.marco === f.marco) &&
    (!f.q || c.colaboradorNome.toLowerCase().includes(f.q)) && (!f.de || c.dataPrevista >= f.de) && (!f.ate || c.dataPrevista <= f.ate) &&
    (!f.situacao || (f.situacao === 'abertos' ? D.cicloAberto(c.etapa) : f.situacao === 'encerrados' ? !D.cicloAberto(c.etapa) : c.atrasado)))
}

export const rotas: Rota[] = [
  /* ===== área da pessoa ===== */
  {
    metodo: 'GET', padrao: 'desenvolvimento/meu',
    h: async ({ db, usuario, agora }) => {
      const hoje = hojeBR(agora)
      let org = await lerOrg(db)
      const equipe = D.equipeDe(usuario.colaboradorId, org.gente, org.setores).map((x) => x.id)
      const euAntes = org.porId.get(usuario.colaboradorId)
      const minhaLideranca = euAntes ? D.liderDe(euAntes, org.gente, org.setores) : null
      // Eu, minha equipe e minha liderança (o feedback sobre ela aparece para mim assim que o ciclo dela abre).
      await sincronizarDesenvolvimento(db, agora, [usuario.colaboradorId, ...equipe, ...(minhaLideranca ? [minhaLideranca] : [])])
      org = await lerOrg(db)
      const eu = org.porId.get(usuario.colaboradorId)!
      const pend = (await db.query(`select f.id, f.tipo, f.status, f.prazo::text as prazo, c.colaborador_id, c.tipo as ciclo_tipo, c.numero, c.id as ciclo_id
          from dsv_formularios f join dsv_ciclos c on c.id = f.ciclo_id
          where f.respondente_id = $1 and f.status in ('pendente','rascunho') and c.etapa = 'coleta' order by f.prazo`, [usuario.colaboradorId])).rows
      const cfg = await lerConfig(db)
      const ciclos = await linhasCiclos(db, 'c.colaborador_id = $1', [usuario.colaboradorId], org, hoje)
      const tarefas = (await linhasCiclos(db, "c.avaliador_id = $1 and c.etapa in ('devolutiva','pdi')", [usuario.colaboradorId], org, hoje))
      const acoes = (await db.query(`select a.id, a.ciclo_id, a.origem, a.competencia, a.descricao, a.responsavel, a.prazo::text as prazo, a.status, a.resultado, a.concluida_em::text as concluida_em
          from dsv_acoes a where a.colaborador_id = $1 and (a.status in ('planejada','em_andamento') or a.concluida_em >= $2::date) order by a.prazo nulls last`, [usuario.colaboradorId, somarDias(hoje, -120)])).rows
      const v = D.vinculoAberto(eu)
      const existentes = new Set(ciclos.filter((c) => c.dataBase === v?.inicio).map((c) => c.marco))
      return ok({
        hoje, admissao: v?.inicio ?? null, ehLideranca: D.ehLideranca(usuario.colaboradorId, org.gente, org.setores), tamanhoEquipe: equipe.length,
        lideranca: nomeDe(org, D.liderDe(eu, org.gente, org.setores)),
        pendentes: pend.map((f) => ({
          id: f.id, tipo: f.tipo, rotulo: D.FORMULARIO_INFO[f.tipo as D.TipoFormulario].rotulo, status: f.status, prazo: f.prazo, atrasado: f.prazo < hoje, cicloId: f.ciclo_id,
          marco: D.rotuloMarco(f.ciclo_tipo, f.numero), sobre: f.tipo === 'acomp_colaborador' || f.tipo === 'autoavaliacao' ? 'Você' : nomeDe(org, f.colaborador_id),
          confidencial: f.tipo === 'equipe_avalia_lider',
        })),
        ciclos, tarefas, acoes, proximos: v ? D.proximosMarcos(v.inicio, hoje, 4).filter((m) => !existentes.has(m.marco)) : [],
        minimoEquipe: cfg.feedbackLideranca.minRespostas,
      })
    },
  },
  {
    // Resumo leve para o Início (sem rodar a rotina): formulários a responder e conversas a conduzir.
    metodo: 'GET', padrao: 'desenvolvimento/pendencias',
    h: async ({ db, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const f = (await db.query(`select count(*)::int n, count(*) filter (where f.prazo < $2::date)::int atrasados, min(f.prazo)::text as proximo
          from dsv_formularios f join dsv_ciclos c on c.id = f.ciclo_id where f.respondente_id = $1 and f.status in ('pendente','rascunho') and c.etapa = 'coleta'`, [usuario.colaboradorId, hoje])).rows[0]
      const t = (await db.query("select count(*)::int n from dsv_ciclos where avaliador_id = $1 and etapa in ('devolutiva','pdi')", [usuario.colaboradorId])).rows[0]
      return ok({ formularios: f.n, atrasados: f.atrasados, proximoPrazo: f.proximo, conversas: t.n })
    },
  },
  {
    // Formulário: só quem responde.
    metodo: 'GET', padrao: 'desenvolvimento/formularios/:id',
    h: async ({ db, params, usuario, agora }) => {
      const f = (await db.query(`select ${FORM_COLS} from dsv_formularios f where f.id = $1`, [uuid(params.id)])).rows[0] as Form | undefined
      if (!f || f.respondente_id !== usuario.colaboradorId) throw naoEncontrado()
      const c = await cicloPorId(db, f.ciclo_id)
      const cfg = await lerConfig(db)
      const org = await lerOrg(db)
      const editavel = (f.status === 'pendente' || f.status === 'rascunho') && c.etapa === 'coleta'
      return ok({
        id: f.id, tipo: f.tipo, rotulo: D.FORMULARIO_INFO[f.tipo].rotulo, status: f.status, prazo: f.prazo, atrasado: f.prazo < hojeBR(agora), editavel, motivo: f.motivo,
        confidencial: f.tipo === 'equipe_avalia_lider',
        avisoConfidencialidade: f.tipo === 'equipe_avalia_lider' ? D.avisoConfidencialidade(cfg.feedbackLideranca.minRespostas) : null,
        ciclo: { id: c.id, tipo: c.tipo, rotulo: D.rotuloMarco(c.tipo, c.numero), dataPrevista: c.data_prevista },
        sobre: { id: c.colaborador_id, nome: nomeDe(org, c.colaborador_id), voce: c.colaborador_id === usuario.colaboradorId },
        modelo: f.retrato,
        escala: D.escalaDe(f.retrato.escala, cfg), naRotulo: cfg.naRotulo, naDescricao: cfg.naDescricao,
        justificativaObrigatoria: f.retrato.escala === 'avd' ? cfg.justificativaObrigatoria : [],
        respostas: f.status === 'enviado' ? f.respostas : f.rascunho ?? D.respostasVazias(),
        enviadoEm: f.enviado_em,
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'desenvolvimento/formularios/:id',
    h: async ({ db, params, req, usuario }) => {
      const f = (await db.query(`select ${FORM_COLS} from dsv_formularios f where f.id = $1`, [uuid(params.id)])).rows[0] as Form | undefined
      if (!f || f.respondente_id !== usuario.colaboradorId) throw naoEncontrado()
      const c = await cicloPorId(db, f.ciclo_id)
      if (c.etapa !== 'coleta' || (f.status !== 'pendente' && f.status !== 'rascunho')) throw conflito('Este formulário não aceita mais alterações.')
      const r = D.sanitizarRespostas(req.corpo?.respostas, f.retrato)
      const up = await db.query("update dsv_formularios set rascunho = $2::jsonb, status = 'rascunho', atualizado_em = now() where id = $1 and status in ('pendente','rascunho') and respondente_id = $3", [f.id, JSON.stringify(r), usuario.colaboradorId])
      if (!up.rowCount) throw conflito('Este formulário não aceita mais alterações.')
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/formularios/:id/enviar',
    h: async ({ db, params, req, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const res = await db.tx(async (t) => {
        const f = (await t.query(`select ${FORM_COLS} from dsv_formularios f where f.id = $1 for update`, [uuid(params.id)])).rows[0] as Form | undefined
        if (!f || f.respondente_id !== usuario.colaboradorId) throw naoEncontrado()
        const c = await cicloPorId(t, f.ciclo_id, true)
        if (f.status === 'enviado') throw conflito('Este formulário já foi enviado. Respostas enviadas não podem ser alteradas.')
        if (c.etapa !== 'coleta' || (f.status !== 'pendente' && f.status !== 'rascunho')) throw conflito('Este formulário não aceita mais respostas.')
        const cfg = await lerConfig(t)
        const r = D.sanitizarRespostas(req.corpo?.respostas, f.retrato)
        const erros = D.errosDeEnvio(r, f.retrato, cfg)
        if (Object.keys(erros).length) throw invalido('Revise os itens indicados antes de enviar.', erros)
        if (f.tipo === 'equipe_avalia_lider') {
          // Confidencial: a resposta vai para uma tabela sem respondente e sem hora; o formulário guarda só "enviado" (data).
          await t.query('insert into dsv_respostas_equipe (ciclo_id, modelo_versao, respostas, data) values ($1,$2,$3::jsonb,$4)', [c.id, f.modelo_versao, JSON.stringify(r), hoje])
          await t.query("update dsv_formularios set status = 'enviado', rascunho = null, respostas = null, nota = null, enviado_em = $2::date, atualizado_em = now() where id = $1", [f.id, hoje])
          await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'feedback_equipe_enviado', {})
        } else {
          await t.query("update dsv_formularios set status = 'enviado', rascunho = null, respostas = $2::jsonb, nota = $3, enviado_em = now(), atualizado_em = now() where id = $1",
            [f.id, JSON.stringify(r), D.notaPonderada(r, f.retrato.criterios)])
          await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'formulario_enviado', { formularioId: f.id, tipo: f.tipo })
        }
        await t.query(`update ntf_notificacoes set lida_em = coalesce(lida_em, now()) where destinatario_id = $1 and link = $2`, [usuario.colaboradorId, linkForm(f.id)])
        const etapa = await avancarSePronto(t, c.id, hoje, cfg, await lerOrg(t))
        return { cicloId: c.id, etapa }
      })
      return ok({ ok: true, ...res })
    },
  },

  /* ===== ciclo ===== */
  {
    metodo: 'GET', padrao: 'desenvolvimento/ciclos/:id',
    h: async ({ db, params, usuario, agora }) => ok(await detalheCiclo(db, usuario, await cicloPorId(db, params.id), hojeBR(agora))),
  },
  {
    // Devolutiva (AVD) ou registro do acompanhamento. `concluir` avança a etapa (acompanhamento: conclui o ciclo).
    metodo: 'PUT', padrao: 'desenvolvimento/ciclos/:id/devolutiva',
    h: async ({ db, params, req, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const r = await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        const papel = papelNoCiclo(usuario, c)
        if (!papel.rh && !papel.lider) throw proibido('Só a liderança responsável ou o RH registram a devolutiva.')
        exigirAberto(c)
        if (!['devolutiva', 'pdi', 'encerramento'].includes(c.etapa)) throw conflito(c.etapa === 'coleta' ? 'A devolutiva fica disponível quando os formulários forem concluídos.' : 'Etapa atual não permite registrar a devolutiva.')
        const b = req.corpo ?? {}
        const acomp = c.tipo === 'acompanhamento'
        const realizadaEm = dataISO(b.realizadaEm, 'data da conversa', !!b.concluir)
        if (realizadaEm && realizadaEm > hoje) throw invalido('A data da conversa não pode ser futura.', { realizadaEm: 'Data futura' })
        const d = {
          pontos: texto(b.pontosFortes, acomp ? 'pontos positivos' : 'pontos fortes', { obrigatorio: !!b.concluir, max: 4000 }) || null,
          desenvolver: textoOpc(b.aDesenvolver, 'competências a desenvolver'),
          dificuldades: textoOpc(b.dificuldades, 'dificuldades'),
          orientacoes: texto(b.orientacoes, 'orientações', { obrigatorio: !!b.concluir && acomp, max: 4000 }) || null,
          feedback: texto(b.feedback, 'feedback da liderança', { obrigatorio: !!b.concluir && !acomp, max: 4000 }) || null,
        }
        if (!acomp && b.concluir && !d.desenvolver) throw invalido('Informe as competências a desenvolver.', { aDesenvolver: 'Obrigatório' })
        await t.query(`insert into dsv_devolutivas (ciclo_id, realizada_em, rh_acompanhou, pontos_fortes, a_desenvolver, dificuldades, orientacoes, feedback, registrada_por, registrada_em, atualizado_em)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9, case when $10 then now() end, now())
          on conflict (ciclo_id) do update set realizada_em = excluded.realizada_em, rh_acompanhou = excluded.rh_acompanhou, pontos_fortes = excluded.pontos_fortes,
            a_desenvolver = excluded.a_desenvolver, dificuldades = excluded.dificuldades, orientacoes = excluded.orientacoes, feedback = excluded.feedback,
            registrada_por = coalesce(dsv_devolutivas.registrada_por, excluded.registrada_por), registrada_em = coalesce(dsv_devolutivas.registrada_em, excluded.registrada_em), atualizado_em = now()`,
          [c.id, realizadaEm, !!b.rhAcompanhou, d.pontos, d.desenvolver, d.dificuldades, d.orientacoes, d.feedback, usuario.colaboradorId, !!b.concluir])
        let etapa: D.Etapa = c.etapa
        if (b.concluir && c.etapa === 'devolutiva') {
          const cfg = await lerConfig(t)
          if (acomp) {
            etapa = 'concluida'
            await t.query("update dsv_ciclos set etapa = 'concluida', concluido_em = now(), concluido_por = $2, atualizado_em = now() where id = $1", [c.id, usuario.colaboradorId])
          } else {
            etapa = 'pdi'
            await t.query("update dsv_ciclos set etapa = 'pdi', prazo = $2, atualizado_em = now() where id = $1", [c.id, D.prazoDaEtapa('pdi', 'avd', hoje, cfg)])
          }
          await notificar(t, { destinatarioId: c.colaborador_id, tipo: 'desenvolvimento', titulo: acomp ? 'Seu acompanhamento foi registrado' : 'Sua devolutiva foi registrada', corpo: 'Veja os pontos combinados e, se quiser, registre sua percepção.', link: linkCiclo(c.id), chave: `dsv-dev-registrada:${c.id}` })
        }
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, b.concluir ? 'devolutiva_registrada' : 'devolutiva_salva', { etapa })
        return { etapa }
      })
      return ok({ ok: true, ...r })
    },
  },
  {
    // Percepção da própria pessoa sobre o resultado (depois da devolutiva).
    metodo: 'PUT', padrao: 'desenvolvimento/ciclos/:id/percepcao',
    h: async ({ db, params, req, usuario }) => {
      const c = await cicloPorId(db, params.id)
      const papel = papelNoCiclo(usuario, c)
      if (!papel.avaliado) throw proibido('Só a pessoa avaliada registra a própria percepção.')
      if (c.etapa === 'cancelada') throw conflito('Ciclo cancelado.')
      const up = await db.query('update dsv_devolutivas set percepcao_colaborador = $2, percepcao_em = now(), atualizado_em = now() where ciclo_id = $1 and registrada_em is not null',
        [c.id, texto(req.corpo?.texto, 'sua percepção', { max: 4000 })])
      if (!up.rowCount) throw conflito('A devolutiva ainda não foi registrada.')
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', c.id, 'percepcao_registrada', {})
      if (c.avaliador_id) await notificar(db, { destinatarioId: c.avaliador_id, tipo: 'desenvolvimento', titulo: `${usuario.nome} registrou a percepção sobre a devolutiva`, link: linkCiclo(c.id), chave: `dsv-percepcao:${c.id}:${Date.now()}` })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'PUT', padrao: 'desenvolvimento/ciclos/:id/pdi',
    h: async ({ db, params, req, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const r = await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        const papel = papelNoCiclo(usuario, c)
        if (!papel.rh && !papel.lider) throw proibido('Só a liderança responsável ou o RH registram o PDI.')
        exigirAberto(c)
        if (c.tipo !== 'avd' || !['pdi', 'encerramento'].includes(c.etapa)) throw conflito('O PDI é registrado depois da devolutiva.')
        const b = req.corpo ?? {}
        const metas = texto(b.metas, 'metas para o próximo semestre', { obrigatorio: !!b.registrar, max: 4000 }) || null
        const revisao = dataISO(b.revisaoEm, 'data de revisão', !!b.registrar)
        if (revisao && revisao < hoje) throw invalido('A revisão precisa ser hoje ou no futuro.', { revisaoEm: 'Data passada' })
        await t.query(`insert into dsv_pdis (ciclo_id, colaborador_id, metas, treinamentos, indicadores, revisao_em, registrado_por, registrado_em, atualizado_em)
          values ($1,$2,$3,$4,$5,$6,$7, case when $8 then now() end, now())
          on conflict (ciclo_id) do update set metas = excluded.metas, treinamentos = excluded.treinamentos, indicadores = excluded.indicadores, revisao_em = excluded.revisao_em,
            registrado_por = coalesce(dsv_pdis.registrado_por, excluded.registrado_por), registrado_em = coalesce(dsv_pdis.registrado_em, excluded.registrado_em), atualizado_em = now()`,
          [c.id, c.colaborador_id, metas, textoOpc(b.treinamentos, 'treinamentos'), textoOpc(b.indicadores, 'indicadores de evolução'), revisao, usuario.colaboradorId, !!b.registrar])
        let etapa = c.etapa
        if (b.registrar && c.etapa === 'pdi') {
          const n = Number((await t.query("select count(*)::int n from dsv_acoes where ciclo_id = $1 and origem = 'pdi' and status <> 'cancelada'", [c.id])).rows[0].n)
          if (!n) throw invalido('Inclua ao menos uma ação de desenvolvimento no PDI.')
          const cfg = await lerConfig(t)
          etapa = 'encerramento'
          await t.query("update dsv_ciclos set etapa = 'encerramento', prazo = $2, atualizado_em = now() where id = $1", [c.id, D.prazoDaEtapa('encerramento', 'avd', hoje, cfg)])
          const org = await lerOrg(t)
          await notificar(t, { destinatarioId: c.colaborador_id, tipo: 'desenvolvimento', titulo: 'Seu PDI foi registrado', corpo: 'Acompanhe metas e ações na sua área de desenvolvimento.', link: linkCiclo(c.id), chave: `dsv-pdi:${c.id}` })
          for (const g of await idsGestoresDsv(t)) await notificar(t, { destinatarioId: g, tipo: 'desenvolvimento', titulo: `PDI de ${nomeDe(org, c.colaborador_id)} registrado`, corpo: 'Confira e encerre formalmente o ciclo.', link: linkCiclo(c.id), chave: `dsv-encerrar:${c.id}` })
        }
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, b.registrar ? 'pdi_registrado' : 'pdi_salvo', {})
        return { etapa }
      })
      return ok({ ok: true, ...r })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/acoes',
    h: async ({ db, params, req, usuario }) => {
      const c = await cicloPorId(db, params.id)
      const papel = papelNoCiclo(usuario, c)
      if (!papel.rh && !papel.lider) throw proibido('Só a liderança responsável ou o RH incluem ações.')
      exigirAberto(c)
      const permitido = c.tipo === 'acompanhamento' ? c.etapa === 'devolutiva' : ['devolutiva', 'pdi', 'encerramento'].includes(c.etapa)
      if (!permitido) throw conflito('As ações são combinadas na devolutiva/registro do acompanhamento.')
      const a = await lerAcaoCorpo(req.corpo ?? {})
      const r = await db.query(`insert into dsv_acoes (ciclo_id, colaborador_id, origem, competencia, descricao, responsavel, prazo, indicador, criado_por, atualizado_por)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$9) returning id`, [c.id, c.colaborador_id, c.tipo === 'avd' ? 'pdi' : 'acompanhamento', a.competencia, a.descricao, a.responsavel, a.prazo, a.indicador, usuario.colaboradorId])
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', c.id, 'acao_incluida', { acaoId: r.rows[0].id })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    // Atualiza uma ação. Liderança/RH editam tudo; a pessoa atualiza andamento e resultado das ações que são dela.
    metodo: 'PATCH', padrao: 'desenvolvimento/acoes/:id',
    h: async ({ db, params, req, usuario, agora }) => {
      const a = (await db.query('select id, ciclo_id, responsavel, status from dsv_acoes where id = $1', [uuid(params.id)])).rows[0]
      if (!a) throw naoEncontrado()
      const c = await cicloPorId(db, a.ciclo_id)
      const papel = papelNoCiclo(usuario, c)
      const b = req.corpo ?? {}
      const conduz = papel.rh || papel.lider
      if (!conduz && !(papel.avaliado && (a.responsavel === 'colaborador' || a.responsavel === 'ambos'))) throw proibido('Esta ação é acompanhada pela liderança ou pelo RH.')
      if (c.etapa === 'cancelada') throw conflito('Ciclo cancelado.')
      const status = b.status === undefined ? a.status : enumerado(b.status, 'situação', ['planejada', 'em_andamento', 'concluida', 'cancelada'] as const)
      if (status === 'cancelada' && !conduz) throw proibido('Só a liderança ou o RH cancelam uma ação.')
      const sets: string[] = ['status = $2', 'resultado = coalesce($3, resultado)', "concluida_em = case when $2 = 'concluida' then coalesce(concluida_em, $4::date) else null end", 'atualizado_por = $5', 'atualizado_em = now()']
      const vals: unknown[] = [a.id, status, b.resultado === undefined ? null : textoOpc(b.resultado, 'resultado', 2000), hojeBR(agora), usuario.colaboradorId]
      if (conduz && b.descricao !== undefined) {
        const x = await lerAcaoCorpo({ ...b })
        vals.push(x.descricao, x.competencia, x.responsavel, x.prazo, x.indicador)
        sets.push(`descricao = $${vals.length - 4}`, `competencia = $${vals.length - 3}`, `responsavel = $${vals.length - 2}`, `prazo = $${vals.length - 1}`, `indicador = $${vals.length}`)
      }
      await db.query(`update dsv_acoes set ${sets.join(', ')} where id = $1`, vals)
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', c.id, 'acao_atualizada', { acaoId: a.id, status })
      return ok({ ok: true })
    },
  },

  /* ===== RH: condução e exceções do ciclo ===== */
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/consolidar', cap: 'dsv:gerenciar',
    h: async ({ db, params, usuario, agora }) => {
      const hoje = hojeBR(agora)
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        if (c.etapa !== 'consolidacao') throw conflito('O ciclo não está em consolidação.')
        const cfg = await lerConfig(t)
        const prazo = D.prazoDaEtapa('devolutiva', 'avd', hoje, cfg)
        await t.query("update dsv_ciclos set etapa = 'devolutiva', prazo = $2, atualizado_em = now() where id = $1", [c.id, prazo])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'consolidacao_concluida', {})
        const org = await lerOrg(t)
        if (c.avaliador_id) await notificar(t, { destinatarioId: c.avaliador_id, tipo: 'desenvolvimento', titulo: `Hora da devolutiva de ${nomeDe(org, c.colaborador_id)}`, corpo: `Prazo: ${dataBR(prazo)}.`, link: linkCiclo(c.id), chave: `dsv-devolutiva:${c.id}` })
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/encerrar', cap: 'dsv:gerenciar',
    h: async ({ db, params, usuario }) => {
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        if (c.etapa !== 'encerramento') throw conflito('Só é possível encerrar depois da devolutiva e do PDI registrados.')
        const pdi = (await t.query('select registrado_em from dsv_pdis where ciclo_id = $1', [c.id])).rows[0]
        const dev = (await t.query('select registrada_em from dsv_devolutivas where ciclo_id = $1', [c.id])).rows[0]
        if (!pdi?.registrado_em || !dev?.registrada_em) throw conflito('Devolutiva e PDI precisam estar registrados.')
        await t.query("update dsv_ciclos set etapa = 'concluida', concluido_em = now(), concluido_por = $2, atualizado_em = now() where id = $1", [c.id, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'ciclo_encerrado', {})
        for (const d of [c.colaborador_id, c.avaliador_id].filter(Boolean) as string[])
          await notificar(t, { destinatarioId: d, tipo: 'desenvolvimento', titulo: `${D.rotuloMarco(c.tipo, c.numero)} concluída`, corpo: 'O ciclo foi encerrado pelo RH. O PDI segue em acompanhamento.', link: linkCiclo(c.id), chave: `dsv-concluido:${c.id}` })
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/reabrir', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario, agora }) => {
      const motivo = texto(req.corpo?.motivo, 'justificativa', { min: 10, max: 1000 })
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        if (c.etapa !== 'concluida') throw conflito('Só ciclos concluídos podem ser reabertos.')
        const cfg = await lerConfig(t)
        await t.query("update dsv_ciclos set etapa = 'devolutiva', prazo = $2, concluido_em = null, concluido_por = null, motivo = $3, atualizado_em = now() where id = $1",
          [c.id, D.prazoDaEtapa('devolutiva', c.tipo, hojeBR(agora), cfg), motivo])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'ciclo_reaberto', { motivo })
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/cancelar', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const motivo = texto(req.corpo?.motivo, 'justificativa', { min: 10, max: 1000 })
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        exigirAberto(c)
        await t.query("update dsv_ciclos set etapa = 'cancelada', cancelado_em = now(), cancelado_por = $2, motivo = $3, atualizado_em = now() where id = $1", [c.id, usuario.colaboradorId, motivo])
        await t.query("update dsv_formularios set status = 'dispensado', rascunho = null, motivo = 'Ciclo cancelado', dispensado_por = $2, atualizado_em = now() where ciclo_id = $1 and status in ('pendente','rascunho')", [c.id, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'ciclo_cancelado', { motivo })
      })
      return ok({ ok: true })
    },
  },
  {
    // Afastamento ou outra pausa: os prazos param de correr até a retomada.
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/suspender', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const motivo = texto(req.corpo?.motivo, 'justificativa', { min: 10, max: 1000 })
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        exigirAberto(c)
        if (c.etapa === 'suspensa') throw conflito('O ciclo já está suspenso.')
        await t.query("update dsv_ciclos set etapa = 'suspensa', etapa_antes_suspensao = $2, motivo = $3, atualizado_em = now() where id = $1", [c.id, c.etapa, motivo])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'ciclo_suspenso', { motivo, etapa: c.etapa })
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/retomar', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const prazo = dataISO(req.corpo?.prazo, 'novo prazo', true)!
      if (prazo < hoje) throw invalido('O novo prazo precisa ser hoje ou no futuro.', { prazo: 'Data passada' })
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        if (c.etapa !== 'suspensa') throw conflito('O ciclo não está suspenso.')
        const etapa = c.etapa_antes_suspensao ?? 'coleta'
        await t.query('update dsv_ciclos set etapa = $2, etapa_antes_suspensao = null, prazo = $3, atualizado_em = now() where id = $1', [c.id, etapa, prazo])
        if (etapa === 'coleta') await t.query("update dsv_formularios set prazo = $2, atualizado_em = now() where ciclo_id = $1 and status in ('pendente','rascunho')", [c.id, prazo])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'ciclo_retomado', { prazo, etapa })
      })
      return ok({ ok: true })
    },
  },
  {
    // Designa quem conduz (sem liderança no cadastro, liderança afastada etc.). A rotina não substitui a designação.
    metodo: 'POST', padrao: 'desenvolvimento/ciclos/:id/avaliador', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const novo = texto(req.corpo?.avaliadorId, 'liderança responsável', { max: 80 })
      await db.tx(async (t) => {
        const c = await cicloPorId(t, params.id, true)
        exigirAberto(c)
        const org = await lerOrg(t)
        const p = org.porId.get(novo)
        if (!p || !D.elegivelStatus(p)) throw invalido('Escolha uma pessoa ativa.', { avaliadorId: 'Pessoa inválida' })
        if (novo === c.colaborador_id) throw invalido('A própria pessoa não pode conduzir o próprio ciclo.', { avaliadorId: 'Pessoa inválida' })
        const forms = await formsDoCiclo(t, c.id)
        if (forms.some((f) => f.tipo === 'equipe_avalia_lider' && f.respondente_id === novo && f.status === 'enviado'))
          throw invalido('Esta pessoa respondeu ao feedback da equipe deste ciclo; escolha outra.', { avaliadorId: 'Conflito' })
        for (const f of forms.filter((x) => D.ehFormLideranca(x.tipo) && !D.formFeito(x)))
          await t.query("update dsv_formularios set respondente_id = $2, status = 'pendente', rascunho = null, motivo = 'Designação do RH', atualizado_em = now() where id = $1", [f.id, novo])
        if (c.etapa === 'coleta' && D.exigeLideranca(c) && !forms.some((x) => D.ehFormLideranca(x.tipo))) {
          const plano = D.formulariosDoCiclo(c.tipo, c.colaborador_id, novo, c.lideranca, []).find((x) => D.ehFormLideranca(x.tipo))
          if (plano) await criarFormulario(t, c, plano, c.prazo, nomeDe(org, c.colaborador_id)!, new Map())
        }
        await t.query('update dsv_ciclos set avaliador_id = $2, avaliador_manual = true, atualizado_em = now() where id = $1', [c.id, novo])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', c.id, 'avaliador_designado', { de: c.avaliador_id, para: novo })
        await notificar(t, { destinatarioId: novo, tipo: 'desenvolvimento', titulo: `Você conduzirá o ciclo de ${nomeDe(org, c.colaborador_id)}`, corpo: D.rotuloMarco(c.tipo, c.numero), link: linkCiclo(c.id), chave: `dsv-designado:${c.id}:${novo}` })
      })
      return ok({ ok: true })
    },
  },
  {
    // Dispensa um formulário pendente (ex.: afastamento do respondente). Não é avaliação negativa: fica registrado como "não respondido".
    metodo: 'POST', padrao: 'desenvolvimento/formularios/:id/dispensar', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario, agora }) => {
      const motivo = texto(req.corpo?.motivo, 'justificativa', { min: 10, max: 1000 })
      const r = await db.tx(async (t) => {
        const f = (await t.query(`select ${FORM_COLS} from dsv_formularios f where f.id = $1 for update`, [uuid(params.id)])).rows[0] as Form | undefined
        if (!f) throw naoEncontrado()
        if (D.formFeito(f)) throw conflito('Este formulário já foi concluído.')
        await t.query("update dsv_formularios set status = 'dispensado', rascunho = null, motivo = $2, dispensado_por = $3, atualizado_em = now() where id = $1", [f.id, motivo, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'dsv_ciclo', f.ciclo_id, 'formulario_dispensado', { formularioId: f.id, tipo: f.tipo, motivo })
        return { etapa: await avancarSePronto(t, f.ciclo_id, hojeBR(agora), await lerConfig(t), await lerOrg(t)) }
      })
      return ok({ ok: true, ...r })
    },
  },

  /* ===== feedback da equipe sobre a liderança (confidencial) ===== */
  {
    metodo: 'GET', padrao: 'desenvolvimento/ciclos/:id/feedback-equipe', cap: 'dsv:confidencial',
    h: async ({ db, params, usuario }) => {
      const c = await cicloPorId(db, params.id)
      if (!c.lideranca) throw naoEncontrado()
      const cfg = await lerConfig(db)
      const { modelo, respostas, agregado } = await agregadoEquipe(db, c.id, cfg)
      const sintese = (await db.query('select texto, liberada_em, atualizado_em from dsv_sinteses where ciclo_id = $1', [c.id])).rows[0] ?? null
      // Acesso a dado sensível: registrado (quem, quando, qual ciclo — nunca o conteúdo).
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', c.id, 'feedback_equipe_visualizado', { respostas: respostas.length })
      const semente = parseInt(createHash('sha256').update(c.id).digest('hex').slice(0, 8), 16)
      const comentarios = agregado.suprimido ? [] : modelo.perguntas.map((p) => ({
        id: p.id, texto: p.texto,
        respostas: D.embaralhar(respostas.map((r) => r.abertas[p.id]).filter((x): x is string => !!x), semente + p.id.length),
      }))
      const evidencias = agregado.suprimido ? [] : modelo.criterios.map((k) => ({
        id: k.id, nome: k.nome, textos: D.embaralhar(respostas.map((r) => r.justificativas[k.id]).filter((x): x is string => !!x), semente + k.id.length),
      })).filter((e) => e.textos.length)
      return ok({ minimo: cfg.feedbackLideranca.minRespostas, agregado, comentarios, evidencias, sintese, modelo: { criterios: modelo.criterios } })
    },
  },
  {
    metodo: 'PUT', padrao: 'desenvolvimento/ciclos/:id/sintese', cap: 'dsv:confidencial',
    h: async ({ db, params, req, usuario }) => {
      const c = await cicloPorId(db, params.id)
      if (!c.lideranca) throw naoEncontrado()
      const t = texto(req.corpo?.texto, 'síntese', { obrigatorio: !!req.corpo?.liberar, max: 6000 })
      const cfg = await lerConfig(db)
      const n = Number((await db.query('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [c.id])).rows[0].n)
      if (req.corpo?.liberar && n < cfg.feedbackLideranca.minRespostas) throw conflito(`São necessárias ao menos ${cfg.feedbackLideranca.minRespostas} respostas para liberar resultados à liderança.`)
      await db.query(`insert into dsv_sinteses (ciclo_id, texto, liberada_em, liberada_por, atualizado_por, atualizado_em) values ($1,$2, case when $3 then now() end, case when $3 then $4 end, $4, now())
        on conflict (ciclo_id) do update set texto = excluded.texto, atualizado_por = excluded.atualizado_por, atualizado_em = now(),
          liberada_em = coalesce(dsv_sinteses.liberada_em, excluded.liberada_em), liberada_por = coalesce(dsv_sinteses.liberada_por, excluded.liberada_por)`,
        [c.id, t, !!req.corpo?.liberar, usuario.colaboradorId])
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', c.id, req.corpo?.liberar ? 'sintese_liberada' : 'sintese_salva', {})
      if (req.corpo?.liberar) await notificar(db, { destinatarioId: c.colaborador_id, tipo: 'desenvolvimento', titulo: 'Feedback da sua equipe disponível', corpo: 'O RH preparou uma síntese do feedback sobre a sua liderança.', link: linkCiclo(c.id), chave: `dsv-sintese:${c.id}` })
      return ok({ ok: true })
    },
  },

  /* ===== liderança ===== */
  {
    metodo: 'GET', padrao: 'desenvolvimento/equipe',
    h: async ({ db, usuario, agora }) => {
      const hoje = hojeBR(agora)
      let org = await lerOrg(db)
      const equipeIds = D.equipeDe(usuario.colaboradorId, org.gente, org.setores).map((x) => x.id)
      await sincronizarDesenvolvimento(db, agora, [usuario.colaboradorId, ...equipeIds])
      org = await lerOrg(db)
      const ciclos = await linhasCiclos(db, "c.avaliador_id = $1 or (c.colaborador_id = any($2::text[]) and c.etapa <> 'cancelada')", [usuario.colaboradorId, equipeIds], org, hoje)
      const ids = [...new Set([...equipeIds, ...ciclos.filter((c) => c.avaliadorId === usuario.colaboradorId && D.cicloAberto(c.etapa)).map((c) => c.colaboradorId)])]
      const acoes = ids.length ? (await db.query(`select colaborador_id, count(*) filter (where status in ('planejada','em_andamento'))::int abertas,
          count(*) filter (where status in ('planejada','em_andamento') and prazo < $2::date)::int atrasadas, count(*) filter (where status = 'concluida')::int concluidas
          from dsv_acoes where colaborador_id = any($1::text[]) group by colaborador_id`, [ids, hoje])).rows : []
      const cargosL = await lerCargos(db)
      const meus = (await db.query(`select f.id, f.tipo, f.prazo::text as prazo, c.colaborador_id, c.tipo as ciclo_tipo, c.numero from dsv_formularios f join dsv_ciclos c on c.id = f.ciclo_id
          where f.respondente_id = $1 and f.status in ('pendente','rascunho') and c.etapa = 'coleta' and f.tipo in ('acomp_lideranca','lider_avalia') order by f.prazo`, [usuario.colaboradorId])).rows
      const meusComoLider = await linhasCiclos(db, "c.colaborador_id = $1 and c.lideranca and c.tipo = 'avd'", [usuario.colaboradorId], org, hoje)
      const cfg = await lerConfig(db)
      const feedback = []
      for (const c of meusComoLider) {
        const s = (await db.query('select liberada_em from dsv_sinteses where ciclo_id = $1', [c.id])).rows[0]
        const n = Number((await db.query('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [c.id])).rows[0].n)
        const visivel = !!s?.liberada_em && n >= cfg.feedbackLideranca.minRespostas
        feedback.push({ cicloId: c.id, rotulo: c.rotulo, data: c.dataPrevista, respostas: visivel ? n : null, liberado: visivel, media: visivel ? (await agregadoEquipe(db, c.id, cfg)).agregado.media : null })
      }
      return ok({
        membros: ids.map((id) => {
          const p = org.porId.get(id)!
          const meusC = ciclos.filter((c) => c.colaboradorId === id)
          const atual = meusC.find((c) => D.cicloAberto(c.etapa)) ?? null
          const v = D.vinculoAberto(p)
          const a = acoes.find((x) => x.colaborador_id === id)
          return {
            id, nome: p.nome, cargo: cargosL.find((g) => g.id === p.cargoId)?.nome ?? null, admissao: v?.inicio ?? null, direto: equipeIds.includes(id),
            cicloAtual: atual, ultimoConcluido: meusC.find((c) => c.etapa === 'concluida') ?? null,
            proximo: v ? D.proximosMarcos(v.inicio, hoje, 4).find((mc) => !meusC.some((c) => c.dataBase === v.inicio && c.marco === mc.marco)) ?? null : null,
            acoes: { abertas: a?.abertas ?? 0, atrasadas: a?.atrasadas ?? 0, concluidas: a?.concluidas ?? 0 },
          }
        }).sort((a, b) => a.nome.localeCompare(b.nome)),
        formularios: meus.map((f) => ({ id: f.id, tipo: f.tipo, rotulo: D.FORMULARIO_INFO[f.tipo as D.TipoFormulario].rotulo, prazo: f.prazo, atrasado: f.prazo < hoje, sobre: nomeDe(org, f.colaborador_id), marco: D.rotuloMarco(f.ciclo_tipo, f.numero) })),
        tarefas: ciclos.filter((c) => c.avaliadorId === usuario.colaboradorId && ['devolutiva', 'pdi'].includes(c.etapa)),
        feedbackLideranca: feedback, minimoEquipe: cfg.feedbackLideranca.minRespostas,
      })
    },
  },
  {
    metodo: 'GET', padrao: 'desenvolvimento/pessoas/:id/jornada',
    h: async ({ db, params, usuario, agora }) => ok(await jornada(db, usuario, params.id, hojeBR(agora))),
  },

  /* ===== RH: painel, listas, configuração ===== */
  {
    metodo: 'GET', padrao: 'desenvolvimento/painel', cap: 'dsv:gerenciar',
    h: async ({ db, req, agora }) => {
      const hoje = hojeBR(agora)
      await sincronizarDesenvolvimento(db, agora)
      const org = await lerOrg(db)
      const cfg = await lerConfig(db)
      const f = filtrosLista(req.query)
      const todos = aplicarFiltros(await linhasCiclos(db, 'true', [], org, hoje, true), { ...f, de: '', ate: '' })
      const noPeriodo = todos.filter((c) => (!f.de || c.dataPrevista >= f.de) && (!f.ate || c.dataPrevista <= f.ate))
      const abertos = todos.filter((c) => D.cicloAberto(c.etapa))
      const filtroPessoa = (p: D.PessoaMin) => (!f.setor || p.setorId === f.setor) && (!f.cargo || p.cargoId === f.cargo) && (!f.lider || D.liderDe(p, org.gente, org.setores) === f.lider)
      const elegiveis = org.gente.filter((p) => D.elegivelStatus(p) && D.vinculoAberto(p) && filtroPessoa(p))
      const mes = hoje.slice(0, 7)
      const fimMes = `${mes}-31`
      const previstasMes = elegiveis.flatMap((p) => D.cronograma(D.vinculoAberto(p)!.inicio, fimMes).filter((m) => m.tipo === 'avd' && m.data.startsWith(mes)).map((m) => ({ p, m })))
      // Só o que ainda não abriu (o que já abriu aparece nos ciclos em andamento).
      const jaAbertos = new Set(todos.map((c) => `${c.colaboradorId}|${c.dataBase}|${c.marco}`))
      const proximas = elegiveis.flatMap((p) => { const ini = D.vinculoAberto(p)!.inicio; return D.proximosMarcos(ini, hoje, 3).filter((m) => !jaAbertos.has(`${p.id}|${ini}|${m.marco}`)).slice(0, 2).map((m) => ({ pessoaId: p.id, nome: p.nome, ...m })) })
        .filter((m) => (!f.tipo || m.tipo === f.tipo) && m.data <= somarDias(hoje, 60)).sort((a, b) => a.data.localeCompare(b.data)).slice(0, 30)
      const contaForm = (t: D.TipoFormulario) => abertos.reduce((s, c) => s + (c.etapa === 'coleta' ? c.formularios.pendentesPorTipo[t] ?? 0 : 0), 0)
      const pdiRows = (await db.query(`select p.ciclo_id, c.colaborador_id, count(a.id) filter (where a.status in ('planejada','em_andamento'))::int abertas,
          count(a.id) filter (where a.status = 'concluida')::int concluidas, count(a.id) filter (where a.status in ('planejada','em_andamento') and a.prazo < $1::date)::int atrasadas
          from dsv_pdis p join dsv_ciclos c on c.id = p.ciclo_id left join dsv_acoes a on a.ciclo_id = p.ciclo_id where p.registrado_em is not null group by p.ciclo_id, c.colaborador_id`, [hoje])).rows
        .filter((r) => todos.some((c) => c.id === r.ciclo_id))
      const porStatus: Record<string, number> = {}
      for (const c of noPeriodo) porStatus[c.status] = (porStatus[c.status] ?? 0) + 1
      // Visão histórica: médias por critério (avaliação da liderança) nas AVDs encerradas e competências mais trabalhadas nos PDIs.
      const concluidasAvd = noPeriodo.filter((c) => c.tipo === 'avd' && c.etapa === 'concluida').map((c) => c.id)
      const criterios: Record<string, { nome: string; soma: number; n: number }> = {}
      if (concluidasAvd.length) {
        for (const r of (await db.query("select retrato, respostas from dsv_formularios where ciclo_id = any($1::uuid[]) and tipo = 'lider_avalia' and status = 'enviado'", [concluidasAvd])).rows) {
          for (const k of (r.retrato as D.RetratoModelo).criterios) {
            const n = r.respostas?.notas?.[k.id]
            if (typeof n !== 'number') continue
            const x = (criterios[k.nome] ??= { nome: k.nome, soma: 0, n: 0 }); x.soma += n; x.n++
          }
        }
      }
      const competencias = (await db.query(`select coalesce(nullif(trim(a.competencia),''),'Sem competência informada') as competencia, count(*)::int n
          from dsv_acoes a where a.ciclo_id = any($1::uuid[]) group by 1 order by n desc limit 10`, [noPeriodo.map((c) => c.id)])).rows
      const evolucao: Record<string, { soma: number; n: number }> = {}
      for (const c of noPeriodo.filter((x) => x.tipo === 'avd' && x.notaLideranca !== null)) {
        const sem = `${c.dataPrevista.slice(0, 4)}/${Number(c.dataPrevista.slice(5, 7)) <= 6 ? 1 : 2}`
        const x = (evolucao[sem] ??= { soma: 0, n: 0 }); x.soma += c.notaLideranca!; x.n++
      }
      const cargosL = await lerCargos(db)
      const lideres = [...new Set(org.gente.filter((p) => D.elegivelStatus(p)).map((p) => D.liderDe(p, org.gente, org.setores)).filter((x): x is string => !!x))]
      return ok({
        hoje, inicioVigencia: cfg.inicioVigencia,
        indicadores: {
          elegiveis: elegiveis.length,
          acompanhamentosPendentes: abertos.filter((c) => c.tipo === 'acompanhamento').length,
          acompanhamentosPorMarco: Object.fromEntries(['30d', '60d', '90d'].map((m) => [m, abertos.filter((c) => c.marco === m).length])),
          avdPrevistasMes: previstasMes.length,
          avdAndamento: abertos.filter((c) => c.tipo === 'avd').length,
          avdConcluidas: noPeriodo.filter((c) => c.tipo === 'avd' && c.etapa === 'concluida').length,
          atrasados: abertos.filter((c) => c.atrasado).length,
          autoavaliacoesPendentes: contaForm('autoavaliacao') + contaForm('acomp_colaborador'),
          liderancaPendentes: contaForm('lider_avalia') + contaForm('acomp_lideranca'),
          feedbackEquipePendentes: contaForm('equipe_avalia_lider'),
          semLideranca: abertos.filter((c) => c.status === 'sem_lideranca').length,
          pdisAndamento: pdiRows.filter((r) => r.abertas > 0).length,
          pdisConcluidos: pdiRows.filter((r) => r.abertas === 0 && r.concluidas > 0).length,
          acoesAtrasadas: pdiRows.reduce((s, r) => s + r.atrasadas, 0),
        },
        porStatus, proximas,
        atencao: abertos.filter((c) => c.atrasado || c.status === 'sem_lideranca').slice(0, 20),
        historico: {
          criterios: Object.values(criterios).map((x) => ({ nome: x.nome, media: Math.round((x.soma / x.n) * 10) / 10, n: x.n })).sort((a, b) => a.media - b.media),
          competencias,
          evolucao: Object.entries(evolucao).sort().map(([semestre, x]) => ({ semestre, media: Math.round((x.soma / x.n) * 10) / 10, n: x.n })),
        },
        filtros: {
          setores: org.setores.map((s) => ({ id: s.id, nome: s.nome })),
          cargos: cargosL.map((g) => ({ id: g.id, nome: g.nome })),
          lideres: lideres.map((id) => ({ id, nome: nomeDe(org, id) })).sort((a, b) => String(a.nome).localeCompare(String(b.nome))),
        },
      })
    },
  },
  {
    metodo: 'GET', padrao: 'desenvolvimento/ciclos', cap: 'dsv:gerenciar',
    h: async ({ db, req, agora }) => {
      const hoje = hojeBR(agora)
      const org = await lerOrg(db)
      const lista = aplicarFiltros(await linhasCiclos(db, 'true', [], org, hoje), filtrosLista(req.query))
      const { pagina, por, offset } = paginacao(req.query, 25, 100)
      return ok({ itens: lista.slice(offset, offset + por), total: lista.length, pagina, por })
    },
  },
  {
    metodo: 'GET', padrao: 'desenvolvimento/exportar', cap: 'dsv:gerenciar',
    h: async ({ db, req, usuario, agora }) => {
      const hoje = hojeBR(agora)
      const org = await lerOrg(db)
      const lista = aplicarFiltros(await linhasCiclos(db, 'true', [], org, hoje, true), filtrosLista(req.query))
      const esc = (v: unknown) => { const s = v === null || v === undefined ? '' : String(v); return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s }
      const num = (n: number | null) => (n === null ? '' : String(n).replace('.', ','))
      const cab = ['Colaborador(a)', 'Área', 'Função', 'Liderança responsável', 'Tipo', 'Marco', 'Data prevista', 'Prazo da etapa', 'Situação', 'Em atraso', 'Autoavaliação (1-5)', 'Avaliação da liderança (1-5)', 'Concluído em']
      const linhas = [cab.join(';'), ...lista.map((c) => [c.colaboradorNome, c.setorNome, c.cargoNome, c.avaliadorNome, c.tipo === 'avd' ? 'AVD' : 'Acompanhamento', c.rotulo, c.dataPrevista, c.prazo,
        D.STATUS_DSV[c.status].rotulo, c.atrasado ? 'sim' : 'não', num(c.notaAuto), num(c.notaLideranca), c.concluidoEm ? new Date(c.concluidoEm).toISOString().slice(0, 10) : ''].map(esc).join(';'))]
      await auditar(db, usuario.colaboradorId, 'dsv_ciclo', null, 'exportacao', { linhas: lista.length })
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: `avaliacoes-desempenho-${hoje}.csv`, dados: Buffer.from('﻿' + linhas.join('\r\n'), 'utf8') } }
    },
  },
  {
    metodo: 'POST', padrao: 'desenvolvimento/sincronizar', cap: 'dsv:gerenciar',
    h: async ({ db, usuario, agora }) => {
      const r = await sincronizarDesenvolvimento(db, agora)
      await auditar(db, usuario.colaboradorId, 'rotina', null, 'dsv_sincronizacao_manual', { ...r })
      return ok(r)
    },
  },
  {
    metodo: 'GET', padrao: 'desenvolvimento/config', cap: 'dsv:gerenciar',
    h: async ({ db }) => {
      const cfg = await lerConfig(db)
      const modelos = []
      for (const k of D.CHAVES_MODELO) {
        const m = await modeloAtual(db, k)
        const versoes = Number((await db.query('select count(*)::int n from dsv_modelos where chave = $1', [k])).rows[0].n)
        modelos.push({ ...m, rotulo: D.ROTULO_MODELO[k], personalizado: versoes > 0 })
      }
      return ok({ config: cfg, modelos, padrao: D.CONFIG_PADRAO })
    },
  },
  {
    metodo: 'PUT', padrao: 'desenvolvimento/config', cap: 'dsv:gerenciar',
    h: async ({ db, req, usuario }) => {
      const atual = await lerConfig(db)
      // A data de vigência não é editável pela tela (evita gerar o passado inteiro de uma vez).
      const nova = D.normalizarConfig({ ...req.corpo, inicioVigencia: atual.inicioVigencia })
      await gravarConfig(db, nova, usuario.colaboradorId)
      await auditar(db, usuario.colaboradorId, 'dsv_config', 'geral', 'config_atualizada', {})
      return ok({ config: nova })
    },
  },
  {
    // Nova versão de um formulário. Ciclos já abertos continuam com a versão que receberam.
    metodo: 'PUT', padrao: 'desenvolvimento/modelos/:chave', cap: 'dsv:gerenciar',
    h: async ({ db, params, req, usuario }) => {
      const chave = enumerado(params.chave, 'formulário', D.CHAVES_MODELO)
      const b = req.corpo ?? {}
      const padrao = D.MODELOS_PADRAO[chave]
      const criterios: D.Criterio[] = (Array.isArray(b.criterios) ? b.criterios : []).map((k: Obj) => ({
        id: String(k.id ?? '').trim(), nome: String(k.nome ?? '').trim().slice(0, 160), descricao: String(k.descricao ?? '').trim().slice(0, 400),
        dimensao: String(k.dimensao ?? '').trim().slice(0, 60) || 'Geral', peso: Number(k.peso),
      }))
      const perguntas: D.Pergunta[] = (Array.isArray(b.perguntas) ? b.perguntas : []).map((p: Obj) => ({
        id: String(p.id ?? '').trim(), texto: String(p.texto ?? '').trim().slice(0, 300), obrigatoria: !!p.obrigatoria,
        ...(p.ajuda ? { ajuda: String(p.ajuda).trim().slice(0, 300) } : {}),
      }))
      const titulo = texto(b.titulo, 'título', { max: 160 })
      const erro = D.validarModelo({ titulo, criterios, perguntas })
      if (erro) throw invalido(erro)
      const r = await db.tx(async (t) => {
        const v = Number((await t.query('select coalesce(max(versao), 1)::int v from dsv_modelos where chave = $1', [chave])).rows[0].v) + 1
        await t.query('insert into dsv_modelos (chave, versao, titulo, descricao, escala, criterios, perguntas, criado_por) values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8)',
          [chave, v, titulo, textoOpc(b.descricao, 'descrição', 1000) ?? '', padrao.escala, JSON.stringify(criterios), JSON.stringify(perguntas), usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'dsv_modelo', chave, 'modelo_versionado', { versao: v })
        return v
      })
      return ok({ versao: r })
    },
  },
]
