/* ============================================================
   API v2 · ATS (candidaturas, pipeline, entrevistas, avaliações,
   propostas, banco de talentos, comunicação, LGPD)
   Escopo por registro: quem não tem `ats:gerenciar` só enxerga
   candidaturas das vagas da própria área/que solicitou ou entrevistas
   em que participa. Fora do escopo = 404 (não vaza existência).
   ============================================================ */
import {
  auditar, camel, conflito, dataISO, email as validarEmail, enumerado, escopoVagas, hojeISO, idsComPapel, inteiro, invalido, lista, listaTexto,
  naoEncontrado, notificar, ok, paginacao, pessoaPorId, pessoas, proibido, texto, tem,
  type Ctx, type Executor, type Res, type Rota, type Usuario, ErroHttp,
} from '../nucleo.js'
import { baixarArquivo, guardarArquivo, validarUpload } from '../arquivos.js'
import {
  concluirContratacao, criarCandidatura, garantirEtapas, garantirModeloAvaliacao, garantirTemplates, modeloPreenchido,
  obterPrivacidade, registrarConsentimento, registrarEEnviar, variaveisCandidatura,
} from '../atsLib.js'
import {
  ORIGENS, STATUS_CANDIDATURA, analisarCsvCandidatos, diasNaEtapa, linhaCsv, mediaPonderada, somarMeses, validarMovimento, type Criterio,
} from '../../../src/domain/v2/ats.js'
import { CORES_ETAPA, STATUS_FINAIS, TIPOS_ETAPA, validarEtapas, type StatusVaga } from '../../../src/domain/v2/vagas.js'

const VER: ('ats:ver' | 'ats:avaliar' | 'ats:gerenciar')[] = ['ats:ver', 'ats:avaliar', 'ats:gerenciar']

/* ---------- escopo ---------- */
/** Fragmento SQL (aliases c = rec_candidaturas, v = rec_vagas) que limita ao que a pessoa pode ver. */
function escopoCand(u: Usuario, proximo: number): { sql: string; params: unknown[] } {
  if (tem(u, 'ats:gerenciar')) return { sql: 'true', params: [] }
  const e = escopoVagas(u, 'v', proximo)
  const q = proximo + e.params.length
  return {
    sql: `(${e.sql} or exists (select 1 from rec_entrevistas ent where ent.candidatura_id = c.id and ent.participantes ? $${q}))`,
    params: [...e.params, u.colaboradorId],
  }
}

async function carregarCandidatura(ex: Executor, id: string, u: Usuario) {
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw naoEncontrado('Candidatura não encontrada.')
  const e = escopoCand(u, 2)
  const r = await ex.query(
    `select c.*, v.codigo as vaga_codigo, v.titulo as vaga_titulo, v.status as vaga_status, v.setor_id as vaga_setor_id, v.qtd_posicoes, v.posicoes_preenchidas
     from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id where c.id = $1 and ${e.sql}`, [id, ...e.params])
  if (!r.rowCount) throw naoEncontrado('Candidatura não encontrada.')
  return r.rows[0]
}

const exigirGerenciar = (u: Usuario) => { if (!tem(u, 'ats:gerenciar')) throw proibido() }
const uuid = (v: string) => /^[0-9a-f-]{36}$/i.test(v)

function dataHora(v: unknown, campo: string, obrigatorio = true): string | null {
  if (v === undefined || v === null || v === '') { if (obrigatorio) throw invalido(`Informe ${campo}.`, { [campo]: 'Obrigatório' }); return null }
  if (typeof v !== 'string' || Number.isNaN(Date.parse(v))) throw invalido(`${campo} inválida.`, { [campo]: 'Data e hora inválidas' })
  return new Date(v).toISOString()
}

async function validarPessoas(ex: Executor, ids: string[]): Promise<string[]> {
  const unicos = [...new Set(ids)].slice(0, 20)
  for (const id of unicos) {
    const p = await pessoaPorId(ex, id)
    if (!p || p.status === 'encerrado') throw invalido('Participante não encontrado ou inativo.', { participantes: 'Pessoa inválida' })
  }
  return unicos
}

/* ---------- cartões ---------- */
function cartao(r: any, medias: Map<string, number | null>, podeVerPretensao: boolean) {
  return {
    id: r.id, candidatoId: r.candidato_id, vagaId: r.vaga_id, vagaTitulo: r.vaga_titulo, vagaCodigo: r.vaga_codigo,
    nome: r.nome, email: r.email, cidade: r.cidade, uf: r.uf, etapaId: r.etapa_id, etapaNome: r.etapa_nome, etapaTipo: r.etapa_tipo,
    status: r.status, origem: r.origem, criadoEm: r.criado_em, etapaDesde: r.etapa_desde, diasNaEtapa: diasNaEtapa(r.etapa_desde),
    temCurriculo: !!r.curriculo_arquivo_id, entrevistasAgendadas: r.entrevistas_agendadas ?? 0,
    mediaAvaliacoes: medias.get(r.id) ?? null, pretensao: podeVerPretensao ? (r.pretensao === null ? null : Number(r.pretensao)) : undefined,
  }
}

async function mediasDe(ex: Executor, ids: string[]): Promise<Map<string, number | null>> {
  const out = new Map<string, number | null>()
  if (!ids.length) return out
  const r = await ex.query('select candidatura_id, notas from rec_avaliacoes where candidatura_id = any($1::uuid[])', [ids])
  const por = new Map<string, number[]>()
  for (const a of r.rows) {
    const m = mediaPonderada(a.notas as Record<string, number>)
    if (m !== null) por.set(a.candidatura_id, [...(por.get(a.candidatura_id) ?? []), m])
  }
  for (const [k, v] of por) out.set(k, Math.round((v.reduce((x, y) => x + y, 0) / v.length) * 100) / 100)
  return out
}

const SELECT_CARTAO = `c.id, c.candidato_id, c.vaga_id, c.etapa_id, c.status, c.origem, c.criado_em, c.etapa_desde, c.curriculo_arquivo_id, c.pretensao,
  k.nome, k.email, k.cidade, k.uf, v.titulo as vaga_titulo, v.codigo as vaga_codigo, e.nome as etapa_nome, e.tipo as etapa_tipo,
  (select count(*)::int from rec_entrevistas ent where ent.candidatura_id = c.id and ent.status = 'agendada') as entrevistas_agendadas`
const FROM_CARTAO = `rec_candidaturas c join rec_candidatos k on k.id = c.candidato_id join rec_vagas v on v.id = c.vaga_id left join rec_vaga_etapas e on e.id = c.etapa_id`

/* ---------- alertas (notificações internas, sem duplicar) ---------- */
let ultimaRodada = 0
export async function processarAlertas(ex: Executor, agora = new Date(), forcar = false): Promise<number> {
  if (!forcar && agora.getTime() - ultimaRodada < 60_000) return 0
  ultimaRodada = agora.getTime()
  let n = 0
  const em24 = new Date(agora.getTime() + 24 * 3600_000).toISOString()
  const prox = await ex.query(
    `select e.id, e.participantes, e.criado_por, v.titulo from rec_entrevistas e join rec_candidaturas c on c.id = e.candidatura_id join rec_vagas v on v.id = c.vaga_id
     where e.status = 'agendada' and e.inicio >= $1 and e.inicio <= $2`, [agora.toISOString(), em24])
  for (const e of prox.rows) {
    for (const d of new Set<string>([...(e.participantes as string[]), ...(e.criado_por ? [e.criado_por] : [])])) {
      await notificar(ex, { destinatarioId: d, tipo: 'entrevista_proxima', titulo: 'Entrevista nas próximas 24 horas', corpo: `Vaga: ${e.titulo}`, link: '/recrutamento/entrevistas', chave: `ent-prox-${e.id}` }); n++
    }
  }
  const sem = await ex.query(
    `select e.id, e.participantes, e.criado_por, v.titulo from rec_entrevistas e join rec_candidaturas c on c.id = e.candidatura_id join rec_vagas v on v.id = c.vaga_id
     where e.status = 'agendada' and e.inicio < $1`, [agora.toISOString()])
  for (const e of sem.rows) {
    for (const d of new Set<string>([...(e.participantes as string[]), ...(e.criado_por ? [e.criado_por] : [])])) {
      await notificar(ex, { destinatarioId: d, tipo: 'parecer_pendente', titulo: 'Entrevista aguardando resultado', corpo: `Vaga: ${e.titulo}`, link: '/recrutamento/entrevistas', chave: `ent-parecer-${e.id}` }); n++
    }
  }
  const prop = await ex.query(
    `select p.id, p.criado_por, v.titulo from rec_propostas p join rec_candidaturas c on c.id = p.candidatura_id join rec_vagas v on v.id = c.vaga_id
     where p.status in ('enviada','negociacao') and coalesce(p.enviada_em, p.atualizado_em) < $1 and p.criado_por is not null`, [new Date(agora.getTime() - 3 * 86400_000).toISOString()])
  for (const p of prop.rows) { await notificar(ex, { destinatarioId: p.criado_por, tipo: 'proposta_pendente', titulo: 'Proposta aguardando resposta', corpo: `Vaga: ${p.titulo}`, link: '/recrutamento/candidatos', chave: `prop-pend-${p.id}` }); n++ }
  const aguardando = await ex.query(
    `select c.id, v.titulo, v.recrutador_id from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id join rec_vaga_etapas e on e.id = c.etapa_id
     where c.status = 'ativa' and e.tipo = 'nova' and c.etapa_desde < $1 and v.recrutador_id is not null`, [new Date(agora.getTime() - 3 * 86400_000).toISOString()])
  for (const c of aguardando.rows) { await notificar(ex, { destinatarioId: c.recrutador_id, tipo: 'candidato_aguardando', titulo: 'Candidatura aguardando avaliação há mais de 3 dias', corpo: `Vaga: ${c.titulo}`, link: `/recrutamento/candidatos/${c.id}`, chave: `cand-aguarda-${c.id}` }); n++ }
  return n
}

/* ---------- rotas ---------- */
export const rotas: Rota[] = [
  /* ===== vagas com candidaturas (seletor do pipeline) ===== */
  {
    metodo: 'GET', padrao: 'ats/vagas', cap: VER,
    h: async ({ db, usuario }) => {
      const e = escopoVagas(usuario, 'v', 1)
      const r = await db.query(
        `select v.id, v.codigo, v.titulo, v.status, v.setor_id, v.qtd_posicoes, v.posicoes_preenchidas,
           (select count(*)::int from rec_candidaturas c where c.vaga_id = v.id and c.status = 'ativa') as ativas,
           (select count(*)::int from rec_candidaturas c where c.vaga_id = v.id) as total
         from rec_vagas v where not v.arquivada and v.status in ('publicada','pausada','encerrada','aprovada') and ${e.sql}
         order by (v.status = 'publicada') desc, v.criado_em desc limit 300`, e.params)
      return ok({ itens: r.rows.map(camel) })
    },
  },

  /* ===== pipeline ===== */
  {
    metodo: 'GET', padrao: 'ats/vagas/:vagaId/pipeline', cap: VER,
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.vagaId)) throw naoEncontrado('Vaga não encontrada.')
      const e = escopoVagas(usuario, 'v', 2)
      const vr = await db.query(`select v.id, v.codigo, v.titulo, v.status, v.qtd_posicoes, v.posicoes_preenchidas from rec_vagas v where v.id = $1 and ${e.sql}`, [params.vagaId, ...e.params])
      let vaga = vr.rows[0]
      if (!vaga && !tem(usuario, 'ats:gerenciar')) {
        // entrevistador convidado: vê apenas as candidaturas em que participa
        const part = await db.query(`select v.id, v.codigo, v.titulo, v.status, v.qtd_posicoes, v.posicoes_preenchidas from rec_vagas v where v.id = $1 and exists (select 1 from rec_candidaturas c join rec_entrevistas ent on ent.candidatura_id = c.id where c.vaga_id = v.id and ent.participantes ? $2)`, [params.vagaId, usuario.colaboradorId])
        vaga = part.rows[0]
      }
      if (!vaga) throw naoEncontrado('Vaga não encontrada.')
      const etapas = await garantirEtapas(db, vaga.id)
      const ec = escopoCand(usuario, 2)
      const filtros: unknown[] = [vaga.id, ...ec.params]
      let extra = ''
      if (req.query.q) { filtros.push(`%${req.query.q.slice(0, 80)}%`); extra += ` and (k.nome ilike $${filtros.length} or k.email ilike $${filtros.length})` }
      if (req.query.origem) { filtros.push(req.query.origem); extra += ` and c.origem = $${filtros.length}` }
      const linhas = await db.query(`select ${SELECT_CARTAO} from ${FROM_CARTAO} where c.vaga_id = $1 and ${ec.sql}${extra} order by c.etapa_desde asc limit 1000`, filtros)
      const podeMedia = tem(usuario, 'ats:gerenciar')
      const medias = podeMedia ? await mediasDe(db, linhas.rows.map((x) => x.id)) : new Map<string, number | null>()
      const pRem = tem(usuario, 'vagas:ver_remuneracao')
      const cards = linhas.rows.map((x) => cartao(x, medias, pRem))
      const saidas: Record<string, number> = { contratado: 0, reprovado: 0, desistiu: 0, cancelada: 0, encerrada: 0 }
      for (const c of cards) if (c.status !== 'ativa') saidas[c.status] = (saidas[c.status] ?? 0) + 1
      return ok({
        vaga: camel(vaga),
        etapas: etapas.map((et) => ({ id: et.id, nome: et.nome, tipo: et.tipo, ordem: et.ordem, cor: et.cor, candidaturas: cards.filter((c) => c.status === 'ativa' && c.etapaId === et.id) })),
        saidas, encerradas: req.query.saidas === '1' ? cards.filter((c) => c.status !== 'ativa') : undefined,
        total: cards.length,
      })
    },
  },

  /* ===== colunas do kanban (etapas da vaga) ===== */
  // Recebe a lista completa, na ordem desejada. Etapas que somem e têm candidaturas exigem um destino em `realocar`
  // ({ idRemovida: idDestino }); as ativas ganham registro de movimentação, as encerradas só trocam a referência.
  {
    metodo: 'PUT', padrao: 'ats/vagas/:vagaId/etapas', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.vagaId)) throw naoEncontrado('Vaga não encontrada.')
      const novas = lista<Record<string, unknown>>(req.corpo?.etapas, 20).map((e) => ({
        id: typeof e.id === 'string' && uuid(e.id) ? e.id : null,
        nome: texto(e.nome, 'nome da coluna', { max: 80 }),
        tipo: enumerado(e.tipo, 'tipo da coluna', TIPOS_ETAPA, 'generica'),
        cor: e.cor ? enumerado(e.cor, 'cor da coluna', CORES_ETAPA) : null,
      }))
      const erro = validarEtapas(novas)
      if (erro) throw invalido(erro, { etapas: erro })
      const realocar = (req.corpo?.realocar && typeof req.corpo.realocar === 'object' ? req.corpo.realocar : {}) as Record<string, unknown>
      await db.tx(async (t) => {
        const v = (await t.query('select id, codigo, status from rec_vagas where id = $1 and not arquivada', [params.vagaId])).rows[0]
        if (!v) throw naoEncontrado('Vaga não encontrada.')
        if (STATUS_FINAIS.includes(v.status as StatusVaga)) throw conflito('A vaga está encerrada: as colunas não podem mais ser alteradas.')
        const atuais = (await t.query(
          `select e.id, e.nome, (select count(*)::int from rec_candidaturas c where c.etapa_id = e.id) as n
           from rec_vaga_etapas e where e.vaga_id = $1`, [v.id])).rows as { id: string; nome: string; n: number }[]
        const idsAtuais = new Set(atuais.map((a) => a.id))
        for (const n of novas) if (n.id && !idsAtuais.has(n.id)) n.id = null
        const mantidas = new Set(novas.map((n) => n.id).filter(Boolean) as string[])
        for (let i = 0; i < novas.length; i++) {
          const n = novas[i]
          if (n.id) await t.query('update rec_vaga_etapas set ordem = $2, nome = $3, tipo = $4, cor = $5 where id = $1', [n.id, i + 1, n.nome, n.tipo, n.cor])
          else n.id = (await t.query('insert into rec_vaga_etapas (vaga_id, ordem, nome, tipo, cor) values ($1,$2,$3,$4,$5) returning id', [v.id, i + 1, n.nome, n.tipo, n.cor])).rows[0].id
        }
        for (const a of atuais) {
          if (mantidas.has(a.id)) continue
          if (a.n > 0) {
            const destino = realocar[a.id]
            if (typeof destino !== 'string' || !mantidas.has(destino)) throw new ErroHttp(409, `A coluna "${a.nome}" tem candidaturas. Escolha para qual coluna elas vão antes de excluí-la.`, { realocar: a.id })
            const ativas = (await t.query(`select id from rec_candidaturas where etapa_id = $1 and status = 'ativa'`, [a.id])).rows
            for (const c of ativas) {
              await t.query('insert into rec_candidatura_movs (candidatura_id, colaborador_id, de_etapa_id, para_etapa_id, de_status, para_status, motivo) values ($1,$2,$3,$4,$5,$5,$6)',
                [c.id, usuario.colaboradorId, a.id, destino, 'ativa', `Coluna "${a.nome}" excluída`])
            }
            await t.query(`update rec_candidaturas set etapa_id = $2, etapa_desde = case when status = 'ativa' then now() else etapa_desde end, atualizado_em = now() where etapa_id = $1`, [a.id, destino])
          }
          await t.query('delete from rec_vaga_etapas where id = $1', [a.id])
        }
        await t.query('update rec_vagas set versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1', [v.id, usuario.colaboradorId])
        await t.query(`insert into rec_vaga_eventos (vaga_id, colaborador_id, tipo) values ($1,$2,'etapas_alteradas')`, [v.id, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'vaga', v.id, 'etapas', { codigo: v.codigo, origem: 'kanban' })
      })
      const etapas = await garantirEtapas(db, params.vagaId)
      return ok({ etapas })
    },
  },

  /* ===== lista / busca ===== */
  {
    metodo: 'GET', padrao: 'ats/candidaturas', cap: VER,
    h: async ({ db, usuario, req }) => {
      const { pagina, por, offset } = paginacao(req.query)
      const ec = escopoCand(usuario, 1)
      const ps: unknown[] = [...ec.params]
      let where = ec.sql
      const add = (cond: string, v: unknown) => { ps.push(v); where += ` and ${cond.replace('?', `$${ps.length}`)}` }
      if (req.query.vagaId && uuid(req.query.vagaId)) add('c.vaga_id = ?', req.query.vagaId)
      if (req.query.status) add('c.status = ?', req.query.status)
      if (req.query.etapaId && uuid(req.query.etapaId)) add('c.etapa_id = ?', req.query.etapaId)
      if (req.query.origem) add('c.origem = ?', req.query.origem)
      if (req.query.q) { ps.push(`%${req.query.q.slice(0, 80)}%`); where += ` and (k.nome ilike $${ps.length} or k.email ilike $${ps.length})` }
      const total = (await db.query(`select count(*)::int as n from ${FROM_CARTAO} where ${where}`, ps)).rows[0].n
      const r = await db.query(`select ${SELECT_CARTAO} from ${FROM_CARTAO} where ${where} order by c.criado_em desc limit ${por} offset ${offset}`, ps)
      const medias = tem(usuario, 'ats:gerenciar') ? await mediasDe(db, r.rows.map((x) => x.id)) : new Map()
      const pRem = tem(usuario, 'vagas:ver_remuneracao')
      return ok({ itens: r.rows.map((x) => cartao(x, medias, pRem)), total, pagina, por })
    },
  },

  /* ===== cadastro manual ===== */
  {
    metodo: 'POST', padrao: 'ats/candidaturas', cap: 'ats:gerenciar',
    h: async ({ db, usuario, req }) => {
      const b = req.corpo ?? {}
      const vagaId = texto(b.vagaId, 'vaga', { max: 40 })
      if (!uuid(vagaId)) throw invalido('Vaga inválida.', { vagaId: 'Vaga inválida' })
      const dados = {
        nome: texto(b.nome, 'nome', { max: 200 }), email: validarEmail(b.email),
        telefone: texto(b.telefone, 'telefone', { max: 40, obrigatorio: false }), cidade: texto(b.cidade, 'cidade', { max: 100, obrigatorio: false }),
        uf: texto(b.uf, 'uf', { max: 2, obrigatorio: false }).toUpperCase(), linkedin: texto(b.linkedin, 'linkedin', { max: 200, obrigatorio: false }),
      }
      const origem = enumerado(b.origem, 'origem', ORIGENS, 'manual')
      const pretensao = b.pretensao === undefined || b.pretensao === '' || b.pretensao === null ? null : Number(b.pretensao)
      if (pretensao !== null && (!Number.isFinite(pretensao) || pretensao < 0)) throw invalido('Pretensão inválida.', { pretensao: 'Valor inválido' })
      if (pretensao !== null && !tem(usuario, 'vagas:ver_remuneracao')) throw proibido('Sem permissão para registrar dados salariais.')
      const up = b.curriculo ? validarUpload(b.curriculo, ['pdf', 'docx', 'doc', 'odt'], 'curriculo') : null
      const out = await db.tx(async (t) => {
        const v = (await t.query('select id, status, arquivada from rec_vagas where id = $1', [vagaId])).rows[0]
        if (!v || v.arquivada) throw naoEncontrado('Vaga não encontrada.')
        if (['cancelada'].includes(v.status)) throw conflito('Vaga cancelada não recebe candidaturas.')
        const arq = up ? await guardarArquivo(t, up, 'candidatura', null, usuario.colaboradorId) : null
        const c = await criarCandidatura(t, { vagaId, candidato: dados, origem, origemDetalhe: texto(b.origemDetalhe, 'origem', { max: 200, obrigatorio: false }) || null, curriculoArquivoId: arq, pretensao, disponibilidade: texto(b.disponibilidade, 'disponibilidade', { max: 200, obrigatorio: false }) || null, colaboradorId: usuario.colaboradorId })
        if (arq) await t.query('update arq_arquivos set dono_id = $2 where id = $1', [arq, c.candidaturaId])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.candidaturaId, 'cadastro_manual', { vagaId, origem })
        return c
      })
      return ok({ id: out.candidaturaId, candidatoId: out.candidatoId, candidatoReutilizado: out.candidatoReutilizado, outrasCandidaturas: out.outrasCandidaturas,
        aviso: 'Cadastro manual: registre a base legal/consentimento do candidato no perfil, se aplicável.' }, 201)
    },
  },

  /* ===== importação em lote ===== */
  {
    metodo: 'POST', padrao: 'ats/candidaturas/importar', cap: 'ats:gerenciar',
    h: async ({ db, usuario, req }) => {
      const b = req.corpo ?? {}
      const vagaId = texto(b.vagaId, 'vaga', { max: 40 })
      if (!uuid(vagaId)) throw invalido('Vaga inválida.')
      const csv = texto(b.csv, 'arquivo CSV', { max: 600_000 })
      const an = analisarCsvCandidatos(csv)
      const simular = b.simular === true
      const erros = [...an.erros]
      let criadas = 0
      if (!simular && an.validas.length) {
        await db.tx(async (t) => {
          const v = (await t.query('select id, arquivada, status from rec_vagas where id = $1', [vagaId])).rows[0]
          if (!v || v.arquivada) throw naoEncontrado('Vaga não encontrada.')
          for (const l of an.validas) {
            try {
              await criarCandidatura(t, { vagaId, candidato: l, origem: 'importacao', colaboradorId: usuario.colaboradorId })
              criadas++
            } catch (e) {
              if (e instanceof ErroHttp && e.status === 409) erros.push({ linha: l.linha, mensagem: `${l.email}: já se candidatou a esta vaga (ignorado).` })
              else throw e
            }
          }
          await auditar(t, usuario.colaboradorId, 'candidatura', null, 'importacao', { vagaId, criadas, erros: erros.length })
        })
      }
      erros.sort((a, c) => a.linha - c.linha)
      return ok({ simulacao: simular, totalLinhas: an.total, validas: an.validas.length, criadas, ignoradas: erros.length, erros,
        aviso: 'Registre a base legal/consentimento dos candidatos importados antes de usá-los em outros processos.' })
    },
  },

  /* ===== perfil completo ===== */
  {
    metodo: 'GET', padrao: 'ats/candidaturas/:id', cap: VER,
    h: async ({ db, usuario, params }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const gerenciar = tem(usuario, 'ats:gerenciar'), notasRh = tem(usuario, 'ats:notas_rh'), rem = tem(usuario, 'vagas:ver_remuneracao')
      const gente = new Map((await pessoas(db)).map((p) => [p.id, p.nome]))
      const nome = (id: string | null) => (id ? gente.get(id) ?? 'Pessoa removida' : null)
      const k = (await db.query('select * from rec_candidatos where id = $1', [c.candidato_id])).rows[0]
      const etapas = await garantirEtapas(db, c.vaga_id)
      const nomeEtapa = (id: string | null) => etapas.find((e) => e.id === id)?.nome ?? null
      const outras = (await db.query(
        `select c2.id, c2.status, v.titulo, v.codigo from rec_candidaturas c2 join rec_vagas v on v.id = c2.vaga_id where c2.candidato_id = $1 and c2.id <> $2 order by c2.criado_em desc`, [c.candidato_id, c.id])).rows
      const movs = (await db.query('select * from rec_candidatura_movs where candidatura_id = $1 order by em', [c.id])).rows
      const entrevistas = (await db.query('select * from rec_entrevistas where candidatura_id = $1 order by inicio', [c.id])).rows
      const avRows = (await db.query('select * from rec_avaliacoes where candidatura_id = $1 order by criado_em', [c.id])).rows
      const modelos = (await db.query('select id, nome, criterios from rec_modelos_avaliacao')).rows
      const avaliacoes = avRows.filter((a) => gerenciar || a.avaliador_id === usuario.colaboradorId).map((a) => {
        const crit = modelos.find((m) => m.id === a.modelo_id)?.criterios as Criterio[] | undefined
        return { id: a.id, entrevistaId: a.entrevista_id, avaliadorId: a.avaliador_id, avaliadorNome: nome(a.avaliador_id), modeloId: a.modelo_id, notas: a.notas, media: mediaPonderada(a.notas, crit), recomendacao: a.recomendacao, parecer: a.parecer, criadoEm: a.criado_em }
      })
      let comparativo: unknown = undefined
      if (gerenciar && avaliacoes.length) {
        const porCriterio: Record<string, { soma: number; n: number }> = {}
        for (const a of avaliacoes) for (const [cid, v] of Object.entries(a.notas as Record<string, number>)) { const x = (porCriterio[cid] ??= { soma: 0, n: 0 }); x.soma += v; x.n++ }
        const med = avaliacoes.map((a) => a.media).filter((m): m is number => m !== null)
        comparativo = {
          mediaGeral: med.length ? Math.round((med.reduce((s, m) => s + m, 0) / med.length) * 100) / 100 : null,
          porCriterio: Object.fromEntries(Object.entries(porCriterio).map(([cid, x]) => [cid, Math.round((x.soma / x.n) * 100) / 100])),
          divergencia: med.length > 1 ? Math.round((Math.max(...med) - Math.min(...med)) * 100) / 100 : 0,
        }
      }
      const notas = (await db.query('select * from rec_candidatura_notas where candidatura_id = $1 order by criado_em desc', [c.id])).rows
        .filter((n) => notasRh || n.visibilidade === 'banca' || n.autor_id === usuario.colaboradorId)
        .map((n) => ({ id: n.id, autorId: n.autor_id, autorNome: nome(n.autor_id), texto: n.texto, visibilidade: n.visibilidade, criadoEm: n.criado_em }))
      const propostas = gerenciar
        ? (await db.query('select * from rec_propostas where candidatura_id = $1 order by criado_em desc', [c.id])).rows.map((p) => propostaOut(p, rem))
        : []
      const comunicacoes = gerenciar ? (await db.query('select id, template_chave, canal, assunto, corpo, status, erro, criado_em, enviada_em from rec_comunicacoes where candidatura_id = $1 order by criado_em desc', [c.id])).rows.map(camel) : []
      const consentimentos = gerenciar ? (await db.query('select * from rec_consentimentos where candidato_id = $1 order by registrado_em desc', [c.candidato_id])).rows.map(camel) : []
      const talento = gerenciar ? (await db.query('select * from rec_talentos where candidato_id = $1', [c.candidato_id])).rows[0] : undefined
      const curriculo = c.curriculo_arquivo_id ? (await db.query('select nome, mime, tamanho from arq_arquivos where id = $1', [c.curriculo_arquivo_id])).rows[0] : null
      const dono = (id: string) => entrevistas.find((e) => e.id === id)
      void dono
      return ok({
        candidatura: {
          id: c.id, status: c.status, etapaId: c.etapa_id, etapaDesde: c.etapa_desde, motivoSaida: c.motivo_saida, origem: c.origem, origemDetalhe: c.origem_detalhe,
          criadoEm: c.criado_em, encerradaEm: c.encerrada_em, disponibilidade: c.disponibilidade, respostasTriagem: c.respostas_triagem,
          pretensao: rem ? (c.pretensao === null ? null : Number(c.pretensao)) : undefined,
          curriculo: curriculo ? { nome: curriculo.nome, mime: curriculo.mime, tamanho: curriculo.tamanho } : null,
        },
        candidato: {
          id: k.id, nome: k.nome, email: k.email, telefone: k.telefone, cidade: k.cidade, uf: k.uf, linkedin: k.linkedin, resumo: k.resumo,
          experiencias: k.experiencias, formacoes: k.formacoes, competencias: k.competencias, areasInteresse: k.areas_interesse,
          anonimizado: !!k.anonimizado_em, criadoEm: k.criado_em,
        },
        vaga: { id: c.vaga_id, codigo: c.vaga_codigo, titulo: c.vaga_titulo, status: c.vaga_status, qtdPosicoes: c.qtd_posicoes, posicoesPreenchidas: c.posicoes_preenchidas },
        etapas: etapas.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, ordem: e.ordem })),
        outrasCandidaturas: outras.map(camel),
        movimentacoes: movs.map((m) => ({ em: m.em, porId: m.colaborador_id, porNome: m.colaborador_id ? nome(m.colaborador_id) : 'Candidato / sistema', deEtapa: nomeEtapa(m.de_etapa_id), paraEtapa: nomeEtapa(m.para_etapa_id), deStatus: m.de_status, paraStatus: m.para_status, motivo: m.motivo })),
        entrevistas: entrevistas.map((e) => entrevistaOut(e, nome, usuario, gerenciar)),
        avaliacoes, comparativo, notas, propostas, comunicacoes, consentimentos, talento: talento ? camel(talento) : null,
        permissoes: { gerenciar, notasRh, verRemuneracao: rem, avaliar: tem(usuario, 'ats:avaliar') || gerenciar },
      })
    },
  },

  /* ===== mover etapa / mudar situação ===== */
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/mover', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const b = req.corpo ?? {}
      const pedido = {
        etapaId: typeof b.etapaId === 'string' && b.etapaId ? b.etapaId : null,
        status: typeof b.status === 'string' && b.status ? b.status : null,
        motivo: texto(b.motivo, 'motivo', { max: 500, obrigatorio: false }) || null,
      }
      const res = await db.tx(async (t) => {
        const c = await carregarCandidatura(t, params.id, usuario)
        if (b.deEtapaId && b.deEtapaId !== c.etapa_id) throw conflito('Esta candidatura já foi movida por outra pessoa. Atualize a tela.')
        const etapas = await garantirEtapas(t, c.vaga_id)
        const v = validarMovimento({ status: c.status, etapaId: c.etapa_id }, pedido, etapas)
        if (!v.ok) throw v.erro.startsWith('Informe o motivo') ? invalido(v.erro, { motivo: 'Obrigatório' }) : conflito(v.erro)
        if (v.contratar) {
          const r = await concluirContratacao(t, c.id, usuario.colaboradorId)
          await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'contratada', { vagaId: c.vaga_id })
          return { status: 'contratado', etapaId: etapas.find((e) => e.tipo === 'contratado')?.id ?? c.etapa_id, vagaEncerrada: r.vagaEncerrada }
        }
        const mudouEtapa = v.etapaId !== c.etapa_id
        const saiu = v.status !== 'ativa'
        await t.query(
          `update rec_candidaturas set status = $2, etapa_id = $3, etapa_desde = case when $4 then now() else etapa_desde end,
             motivo_saida = case when $5 then $6 else null end, encerrada_em = case when $5 then now() else null end, atualizado_em = now() where id = $1`,
          [c.id, v.status, v.etapaId, mudouEtapa, saiu, pedido.motivo])
        await t.query('insert into rec_candidatura_movs (candidatura_id, colaborador_id, de_etapa_id, para_etapa_id, de_status, para_status, motivo) values ($1,$2,$3,$4,$5,$6,$7)',
          [c.id, usuario.colaboradorId, c.etapa_id, v.etapaId, c.status, v.status, pedido.motivo])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'movida', { deStatus: c.status, paraStatus: v.status, deEtapa: c.etapa_id, paraEtapa: v.etapaId })
        return { status: v.status, etapaId: v.etapaId, vagaEncerrada: false }
      })
      // aviso opcional ao candidato (fora da transação: depende de serviço externo)
      let comunicacao: unknown = undefined
      if (b.notificarCandidato === true) {
        const { vars, email, candidatoId } = await variaveisCandidatura(db, params.id)
        const modelo = await modeloPreenchido(db, res.status === 'reprovado' ? 'encerramento' : 'atualizacao_etapa', vars)
        comunicacao = await registrarEEnviar(db, { candidaturaId: params.id, candidatoId, templateChave: res.status === 'reprovado' ? 'encerramento' : 'atualizacao_etapa', ...modelo, para: email, criadoPor: usuario.colaboradorId, enviar: true })
      }
      return ok({ ...res, comunicacao })
    },
  },

  /* ===== notas internas ===== */
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/notas', cap: VER,
    h: async ({ db, usuario, params, req }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const vis = enumerado(req.corpo?.visibilidade, 'visibilidade', ['rh', 'banca'] as const, 'banca')
      if (vis === 'rh' && !tem(usuario, 'ats:notas_rh')) throw proibido('Somente o RH registra notas restritas.')
      const txt = texto(req.corpo?.texto, 'nota', { max: 3000 })
      const r = await db.query('insert into rec_candidatura_notas (candidatura_id, autor_id, texto, visibilidade) values ($1,$2,$3,$4) returning id', [c.id, usuario.colaboradorId, txt, vis])
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'nota_criada', { visibilidade: vis })
      return ok({ id: r.rows[0].id }, 201)
    },
  },

  /* ===== currículo (download autenticado e upload) ===== */
  {
    metodo: 'GET', padrao: 'ats/candidaturas/:id/curriculo', cap: VER,
    h: async ({ db, usuario, params }): Promise<Res> => {
      const c = await carregarCandidatura(db, params.id, usuario)
      if (!c.curriculo_arquivo_id) throw naoEncontrado('Esta candidatura não tem currículo anexado.')
      const out = await baixarArquivo(db, c.curriculo_arquivo_id)
      if (!out) throw naoEncontrado('Arquivo não encontrado.')
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'curriculo_baixado', {})
      return out
    },
  },
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/curriculo', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const up = validarUpload(req.corpo?.curriculo, ['pdf', 'docx', 'doc', 'odt'], 'curriculo')
      await db.tx(async (t) => {
        const id = await guardarArquivo(t, up, 'candidatura', c.id, usuario.colaboradorId)
        await t.query('update rec_candidaturas set curriculo_arquivo_id = $2, atualizado_em = now() where id = $1', [c.id, id])
        if (c.curriculo_arquivo_id) await t.query('delete from arq_arquivos where id = $1', [c.curriculo_arquivo_id])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'curriculo_anexado', {})
      })
      return ok()
    },
  },

  /* ===== dados do candidato revisados por humano ===== */
  {
    metodo: 'PATCH', padrao: 'ats/candidatos/:id', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado()
      const b = req.corpo ?? {}
      const k = (await db.query('select id, anonimizado_em from rec_candidatos where id = $1', [params.id])).rows[0]
      if (!k || k.anonimizado_em) throw naoEncontrado('Candidato não encontrado.')
      const lst = (v: unknown) => JSON.stringify(listaTexto(v, 40, 120))
      await db.query(
        `update rec_candidatos set telefone = coalesce($2, telefone), cidade = coalesce($3, cidade), uf = coalesce($4, uf), linkedin = coalesce($5, linkedin), resumo = coalesce($6, resumo),
           competencias = coalesce($7::jsonb, competencias), areas_interesse = coalesce($8::jsonb, areas_interesse), atualizado_em = now() where id = $1`,
        [params.id, b.telefone === undefined ? null : texto(b.telefone, 'telefone', { max: 40, obrigatorio: false }), b.cidade === undefined ? null : texto(b.cidade, 'cidade', { max: 100, obrigatorio: false }),
          b.uf === undefined ? null : texto(b.uf, 'uf', { max: 2, obrigatorio: false }).toUpperCase(), b.linkedin === undefined ? null : texto(b.linkedin, 'linkedin', { max: 200, obrigatorio: false }),
          b.resumo === undefined ? null : texto(b.resumo, 'resumo', { max: 3000, obrigatorio: false }), b.competencias === undefined ? null : lst(b.competencias), b.areasInteresse === undefined ? null : lst(b.areasInteresse)])
      await auditar(db, usuario.colaboradorId, 'candidato', params.id, 'dados_revisados', {})
      return ok()
    },
  },

  /* ===== busca de candidatos (banco de talentos) ===== */
  {
    metodo: 'GET', padrao: 'ats/candidatos', cap: 'ats:gerenciar',
    h: async ({ db, req }) => {
      const q = `%${(req.query.q ?? '').slice(0, 80)}%`
      const r = await db.query(
        `select k.id, k.nome, k.email, k.cidade, k.uf, (select count(*)::int from rec_candidaturas c where c.candidato_id = k.id) as candidaturas
         from rec_candidatos k where k.anonimizado_em is null and (k.nome ilike $1 or k.email ilike $1) order by k.nome limit 30`, [q])
      return ok({ itens: r.rows.map(camel) })
    },
  },

  /* ===== entrevistas ===== */
  {
    // Sem `cap`: entrevistador(a) designado(a) pode não ter acesso ao ATS; o escopo (escopoCand) limita às entrevistas de que participa.
    metodo: 'GET', padrao: 'ats/entrevistas',
    h: async ({ db, usuario, req, agora }) => {
      await processarAlertas(db, agora)
      const ec = escopoCand(usuario, 1)
      const ps: unknown[] = [...ec.params]
      let where = ec.sql
      if (req.query.pendentes === '1') where += ` and ent.status = 'agendada' and ent.inicio < now()`
      if (req.query.de) { ps.push(req.query.de); where += ` and ent.inicio >= $${ps.length}::timestamptz` }
      if (req.query.ate) { ps.push(req.query.ate); where += ` and ent.inicio <= $${ps.length}::timestamptz` }
      if (req.query.status) { ps.push(req.query.status); where += ` and ent.status = $${ps.length}` }
      const r = await db.query(
        `select ent.*, k.nome as candidato_nome, v.titulo as vaga_titulo, v.codigo as vaga_codigo
         from rec_entrevistas ent join rec_candidaturas c on c.id = ent.candidatura_id join rec_candidatos k on k.id = c.candidato_id join rec_vagas v on v.id = c.vaga_id
         where ${where} order by ent.inicio asc limit 300`, ps)
      const gente = new Map((await pessoas(db)).map((p) => [p.id, p.nome]))
      const nome = (id: string | null) => (id ? gente.get(id) ?? 'Pessoa removida' : null)
      const gerenciar = tem(usuario, 'ats:gerenciar')
      return ok({
        itens: r.rows.map((e) => ({ ...entrevistaOut(e, nome, usuario, gerenciar), candidatoNome: e.candidato_nome, vagaTitulo: e.vaga_titulo, vagaCodigo: e.vaga_codigo,
          parecerPendente: e.status === 'agendada' && new Date(e.inicio) < agora })),
      })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/entrevistas', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const b = req.corpo ?? {}
      const c = await carregarCandidatura(db, params.id, usuario)
      if (c.status !== 'ativa') throw conflito('Só é possível agendar entrevistas para candidaturas em andamento.')
      const inicio = dataHora(b.inicio, 'inicio')!, fim = dataHora(b.fim, 'fim', false)
      if (fim && fim <= inicio) throw invalido('O fim deve ser depois do início.', { fim: 'Depois do início' })
      const tipo = enumerado(b.tipo, 'tipo', ['rh', 'tecnica', 'gestor', 'final', 'outra'] as const, 'rh')
      const modalidade = enumerado(b.modalidade, 'modalidade', ['online', 'presencial', 'telefone'] as const, 'online')
      const out = await db.tx(async (t) => {
        const part = await validarPessoas(t, lista<string>(b.participantes).map(String))
        if (!part.length) throw invalido('Informe ao menos um(a) entrevistador(a).', { participantes: 'Obrigatório' })
        const r = await t.query(
          `insert into rec_entrevistas (candidatura_id, tipo, inicio, fim, modalidade, local_ou_link, participantes, criado_por) values ($1,$2,$3,$4,$5,$6,$7::jsonb,$8) returning id`,
          [c.id, tipo, inicio, fim, modalidade, texto(b.localOuLink, 'local ou link', { max: 300, obrigatorio: false }) || null, JSON.stringify(part), usuario.colaboradorId])
        for (const p of part) await notificar(t, { destinatarioId: p, tipo: 'entrevista_agendada', titulo: 'Você foi designado(a) para uma entrevista', corpo: `Vaga: ${c.vaga_titulo}`, link: '/recrutamento/entrevistas', chave: `ent-nova-${r.rows[0].id}` })
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'entrevista_agendada', { entrevistaId: r.rows[0].id, tipo })
        return r.rows[0].id as string
      })
      return ok({ id: out }, 201)
    },
  },
  {
    // Sem `cap`: participante registra o resultado; reagendar/cancelar continuam exigindo ats:gerenciar (abaixo).
    metodo: 'PATCH', padrao: 'ats/entrevistas/:id',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado()
      const b = req.corpo ?? {}
      const e = (await db.query('select * from rec_entrevistas where id = $1', [params.id])).rows[0]
      if (!e) throw naoEncontrado('Entrevista não encontrada.')
      const c = await carregarCandidatura(db, e.candidatura_id, usuario)
      const gerenciar = tem(usuario, 'ats:gerenciar')
      const participa = (e.participantes as string[]).includes(usuario.colaboradorId)
      const acao = enumerado(b.acao, 'ação', ['reagendar', 'cancelar', 'registrar'] as const)
      if (acao === 'registrar' ? !(gerenciar || participa) : !gerenciar) throw proibido()
      if (e.status === 'cancelada' && acao !== 'registrar') throw conflito('Entrevista cancelada.')
      if (acao === 'reagendar') {
        const novo = dataHora(b.inicio, 'inicio')!
        // Sem fim informado, mantém a duração original (a tela de reagendamento só pede o novo início).
        const duracao = e.fim && e.inicio ? new Date(e.fim).getTime() - new Date(e.inicio).getTime() : null
        const fim = dataHora(b.fim, 'fim', false) ?? (duracao && duracao > 0 ? new Date(new Date(novo).getTime() + duracao).toISOString() : null)
        if (fim && fim <= novo) throw invalido('O fim deve ser depois do início.', { fim: 'Depois do início' })
        const motivo = texto(b.motivo, 'motivo', { max: 300 })
        const hist = [...(e.reagendamentos as unknown[]), { de: e.inicio, para: novo, motivo, por: usuario.colaboradorId, em: new Date().toISOString() }]
        await db.query("update rec_entrevistas set inicio = $2, fim = $3, status = 'agendada', reagendamentos = $4::jsonb where id = $1", [e.id, novo, fim, JSON.stringify(hist)])
        for (const p of e.participantes as string[]) await notificar(db, { destinatarioId: p, tipo: 'entrevista_reagendada', titulo: 'Entrevista reagendada', corpo: `Vaga: ${c.vaga_titulo}`, link: '/recrutamento/entrevistas', chave: `ent-reag-${e.id}-${Date.parse(novo)}` })
        await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'entrevista_reagendada', { entrevistaId: e.id })
      } else if (acao === 'cancelar') {
        const motivo = texto(b.motivo, 'motivo', { max: 300 })
        const hist = [...(e.reagendamentos as unknown[]), { cancelada: true, motivo, por: usuario.colaboradorId, em: new Date().toISOString() }]
        await db.query("update rec_entrevistas set status = 'cancelada', reagendamentos = $2::jsonb where id = $1", [e.id, JSON.stringify(hist)])
        await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'entrevista_cancelada', { entrevistaId: e.id })
      } else {
        const status = enumerado(b.status, 'situação', ['realizada', 'nao_compareceu'] as const, 'realizada')
        const resultado = status === 'realizada' ? enumerado(b.resultado, 'resultado', ['aprovado', 'reprovado', 'indeciso'] as const) : null
        await db.query('update rec_entrevistas set status = $2, resultado = $3, parecer = $4, registrada_em = now() where id = $1',
          [e.id, status, resultado, texto(b.parecer, 'parecer', { max: 3000, obrigatorio: false }) || null])
        await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'entrevista_resultado', { entrevistaId: e.id, status, resultado })
      }
      return ok()
    },
  },

  /* ===== avaliações ===== */
  {
    metodo: 'GET', padrao: 'ats/modelos-avaliacao', cap: VER,
    h: async ({ db }) => {
      await garantirModeloAvaliacao(db)
      return ok({ itens: (await db.query('select id, nome, criterios from rec_modelos_avaliacao where ativo order by criado_em')).rows.map(camel) })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/modelos-avaliacao', cap: 'ats:gerenciar',
    h: async ({ db, usuario, req }) => {
      const nome = texto(req.corpo?.nome, 'nome', { max: 120 })
      const crit = lista<{ nome?: string; peso?: number }>(req.corpo?.criterios, 20).map((c, i) => ({
        id: `c${i + 1}`, nome: texto(c?.nome, 'critério', { max: 120 }), peso: inteiro(c?.peso ?? 1, 'peso', { min: 1, max: 5 }),
      }))
      if (!crit.length) throw invalido('Cadastre ao menos um critério.', { criterios: 'Obrigatório' })
      const r = await db.query('insert into rec_modelos_avaliacao (nome, criterios) values ($1,$2::jsonb) returning id', [nome, JSON.stringify(crit)])
      await auditar(db, usuario.colaboradorId, 'modelo_avaliacao', r.rows[0].id, 'criado', {})
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/avaliacoes', cap: ['ats:avaliar', 'ats:gerenciar'],
    h: async ({ db, usuario, params, req }) => {
      const b = req.corpo ?? {}
      const c = await carregarCandidatura(db, params.id, usuario)
      await garantirModeloAvaliacao(db)
      const modeloId = typeof b.modeloId === 'string' && b.modeloId ? b.modeloId : null
      const criterios: Criterio[] | undefined = modeloId ? (await db.query('select criterios from rec_modelos_avaliacao where id = $1', [modeloId])).rows[0]?.criterios : undefined
      if (modeloId && !criterios) throw invalido('Modelo de avaliação inexistente.')
      const notas: Record<string, number> = {}
      for (const [k, v] of Object.entries((b.notas ?? {}) as Record<string, unknown>)) {
        if (criterios && !criterios.some((x) => x.id === k)) throw invalido('Critério não pertence ao modelo.', { notas: 'Critério inválido' })
        notas[k] = inteiro(v, `nota de ${k}`, { min: 1, max: 5 })
      }
      if (!Object.keys(notas).length) throw invalido('Informe ao menos uma nota.', { notas: 'Obrigatório' })
      const entrevistaId = typeof b.entrevistaId === 'string' && b.entrevistaId ? b.entrevistaId : null
      if (entrevistaId) {
        const e = (await db.query('select candidatura_id from rec_entrevistas where id = $1', [entrevistaId])).rows[0]
        if (!e || e.candidatura_id !== c.id) throw invalido('Entrevista não pertence a esta candidatura.')
      }
      const recomendacao = b.recomendacao ? enumerado(b.recomendacao, 'recomendação', ['avancar', 'manter', 'nao_avancar'] as const) : null
      const parecer = texto(b.parecer, 'parecer', { max: 3000, obrigatorio: false }) || null
      const antes = (await db.query('select id from rec_avaliacoes where candidatura_id = $1 and avaliador_id = $2 and entrevista_id is not distinct from $3', [c.id, usuario.colaboradorId, entrevistaId])).rows[0]
      let id: string
      if (antes) {
        await db.query('update rec_avaliacoes set modelo_id = $2, notas = $3::jsonb, recomendacao = $4, parecer = $5 where id = $1', [antes.id, modeloId, JSON.stringify(notas), recomendacao, parecer])
        id = antes.id
      } else {
        id = (await db.query('insert into rec_avaliacoes (candidatura_id, entrevista_id, avaliador_id, modelo_id, notas, recomendacao, parecer) values ($1,$2,$3,$4,$5::jsonb,$6,$7) returning id',
          [c.id, entrevistaId, usuario.colaboradorId, modeloId, JSON.stringify(notas), recomendacao, parecer])).rows[0].id
      }
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'avaliacao_registrada', { avaliacaoId: id })
      return ok({ id, media: mediaPonderada(notas, criterios) }, antes ? 200 : 201)
    },
  },

  /* ===== propostas ===== */
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/propostas', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const b = req.corpo ?? {}
      const c = await carregarCandidatura(db, params.id, usuario)
      if (c.status !== 'ativa') throw conflito('Só é possível propor a candidaturas em andamento.')
      const aberta = await db.query("select 1 from rec_propostas where candidatura_id = $1 and status in ('rascunho','enviada','negociacao')", [c.id])
      if (aberta.rowCount) throw conflito('Já existe uma proposta em aberto para esta candidatura.')
      const valor = valorProposta(b.valor, usuario)
      const r = await db.query(
        `insert into rec_propostas (candidatura_id, valor, moeda, tipo_remuneracao, beneficios, data_inicio_prevista, criado_por) values ($1,$2,$3,$4,$5::jsonb,$6,$7) returning *`,
        [c.id, valor, texto(b.moeda, 'moeda', { max: 3, obrigatorio: false }).toUpperCase() || 'BRL', texto(b.tipoRemuneracao, 'tipo de remuneração', { max: 40, obrigatorio: false }) || 'mensal',
          JSON.stringify(listaTexto(b.beneficios, 30, 120)), dataISO(b.dataInicioPrevista, 'data de início'), usuario.colaboradorId])
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'proposta_criada', { propostaId: r.rows[0].id })
      return ok(propostaOut(r.rows[0], tem(usuario, 'vagas:ver_remuneracao')), 201)
    },
  },
  {
    metodo: 'PATCH', padrao: 'ats/propostas/:id', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado()
      const b = req.corpo ?? {}
      const acao = enumerado(b.acao, 'ação', ['atualizar', 'enviar', 'negociar', 'aceitar', 'recusar', 'cancelar'] as const)
      const out = await db.tx(async (t) => {
        const p = (await t.query('select * from rec_propostas where id = $1 for update', [params.id])).rows[0]
        if (!p) throw naoEncontrado('Proposta não encontrada.')
        const c = await carregarCandidatura(t, p.candidatura_id, usuario)
        const hist = p.historico as unknown[]
        const registro = (tipo: string, extra: Record<string, unknown> = {}) => [...hist, { em: new Date().toISOString(), por: usuario.colaboradorId, tipo, ...extra }]
        const aberta = ['rascunho', 'enviada', 'negociacao'].includes(p.status)
        if (!aberta) throw conflito('Esta proposta já foi finalizada.')
        if (acao === 'atualizar') {
          if (p.status !== 'rascunho') throw conflito('Só é possível editar propostas em rascunho. Use "negociar".')
          const valor = b.valor === undefined ? p.valor : valorProposta(b.valor, usuario)
          await t.query('update rec_propostas set valor = $2, data_inicio_prevista = coalesce($3, data_inicio_prevista), beneficios = coalesce($4::jsonb, beneficios), atualizado_em = now() where id = $1',
            [p.id, valor, dataISO(b.dataInicioPrevista, 'data de início'), b.beneficios === undefined ? null : JSON.stringify(listaTexto(b.beneficios, 30, 120))])
        } else if (acao === 'enviar') {
          if (p.status === 'enviada') throw conflito('A proposta já foi enviada.')
          await t.query("update rec_propostas set status = 'enviada', enviada_em = now(), historico = $2::jsonb, atualizado_em = now() where id = $1", [p.id, JSON.stringify(registro('enviada'))])
        } else if (acao === 'negociar') {
          if (p.status === 'rascunho') throw conflito('Envie a proposta antes de negociar.')
          const valor = b.valor === undefined || b.valor === null || b.valor === '' ? null : valorProposta(b.valor, usuario)
          await t.query("update rec_propostas set status = 'negociacao', valor = coalesce($2, valor), historico = $3::jsonb, atualizado_em = now() where id = $1",
            [p.id, valor, JSON.stringify(registro('negociacao', { valor: valor ?? undefined, nota: texto(b.nota, 'nota', { max: 1000, obrigatorio: false }) || undefined }))])
        } else if (acao === 'aceitar') {
          if (p.status === 'rascunho') throw conflito('Envie a proposta antes de registrar o aceite.')
          await t.query("update rec_propostas set status = 'aceita', decidida_em = now(), historico = $2::jsonb, atualizado_em = now() where id = $1", [p.id, JSON.stringify(registro('aceita'))])
          const r = await concluirContratacao(t, c.id, usuario.colaboradorId)
          await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'contratada', { propostaId: p.id })
          return { status: 'aceita', contratado: true, vagaEncerrada: r.vagaEncerrada }
        } else if (acao === 'recusar') {
          await t.query("update rec_propostas set status = 'recusada', motivo_recusa = $2, decidida_em = now(), historico = $3::jsonb, atualizado_em = now() where id = $1",
            [p.id, texto(b.motivo, 'motivo', { max: 500, obrigatorio: false }) || null, JSON.stringify(registro('recusada'))])
        } else {
          await t.query("update rec_propostas set status = 'cancelada', decidida_em = now(), historico = $2::jsonb, atualizado_em = now() where id = $1", [p.id, JSON.stringify(registro('cancelada'))])
        }
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, `proposta_${acao}`, { propostaId: p.id })
        return { status: acao, contratado: false, vagaEncerrada: false }
      })
      return ok(out)
    },
  },

  /* ===== banco de talentos ===== */
  {
    metodo: 'GET', padrao: 'ats/talentos', cap: 'ats:gerenciar',
    h: async ({ db, req }) => {
      const { pagina, por, offset } = paginacao(req.query)
      const ps: unknown[] = []
      let where = 'k.anonimizado_em is null'
      if (req.query.q) { ps.push(`%${req.query.q.slice(0, 80)}%`); where += ` and (k.nome ilike $${ps.length} or k.email ilike $${ps.length} or t.observacao ilike $${ps.length})` }
      if (req.query.tag) { ps.push(JSON.stringify([req.query.tag])); where += ` and (t.tags @> $${ps.length}::jsonb or k.competencias @> $${ps.length}::jsonb)` }
      if (req.query.area) { ps.push(JSON.stringify([req.query.area])); where += ` and (t.areas @> $${ps.length}::jsonb or k.areas_interesse @> $${ps.length}::jsonb)` }
      const total = (await db.query(`select count(*)::int as n from rec_talentos t join rec_candidatos k on k.id = t.candidato_id where ${where}`, ps)).rows[0].n
      const r = await db.query(
        `select t.candidato_id, t.tags, t.areas, t.observacao, t.incluido_em, to_char(t.retencao_ate, 'YYYY-MM-DD') as retencao_ate, t.ultimo_contato_em, t.historico_contato, k.nome, k.email, k.telefone, k.cidade, k.uf, k.competencias, k.areas_interesse,
           (select to_char(max(valido_ate), 'YYYY-MM-DD') from rec_consentimentos co where co.candidato_id = k.id and co.finalidade = 'banco_talentos' and co.concedido and co.revogado_em is null) as consentimento_ate
         from rec_talentos t join rec_candidatos k on k.id = t.candidato_id where ${where} order by t.incluido_em desc limit ${por} offset ${offset}`, ps)
      const hoje = hojeISO()
      return ok({ itens: r.rows.map((x) => ({ ...camel(x), retencaoVencida: !!x.retencao_ate && String(x.retencao_ate).slice(0, 10) < hoje })), total, pagina, por })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/talentos', cap: 'ats:gerenciar',
    h: async ({ db, usuario, req, agora }) => {
      const b = req.corpo ?? {}
      const candidatoId = texto(b.candidatoId, 'candidato', { max: 40 })
      if (!uuid(candidatoId)) throw invalido('Candidato inválido.')
      const meses = inteiro(b.retencaoMeses, 'prazo de retenção', { min: 1, max: 60, padrao: 12 })
      const out = await db.tx(async (t) => {
        const k = (await t.query('select id, anonimizado_em from rec_candidatos where id = $1', [candidatoId])).rows[0]
        if (!k || k.anonimizado_em) throw naoEncontrado('Candidato não encontrado.')
        const priv = await obterPrivacidade(t)
        const ate = somarMeses(hojeISO(agora), meses)
        const jaTem = (await t.query("select 1 from rec_consentimentos where candidato_id = $1 and finalidade = 'banco_talentos' and concedido and revogado_em is null and (valido_ate is null or valido_ate >= current_date)", [candidatoId])).rowCount
        if (!jaTem) {
          // Sem autorização registrada: o RH precisa declarar COMO o candidato autorizou (não é consentimento presumido).
          if (b.confirmaAutorizacao !== true) throw invalido('A inclusão no banco de talentos exige autorização específica do candidato para uso futuro.', { confirmaAutorizacao: 'Confirme a autorização' })
          const como = texto(b.comoAutorizou, 'como o candidato autorizou', { max: 300 })
          await registrarConsentimento(t, { candidatoId, finalidade: 'banco_talentos', baseLegal: 'consentimento', versao: `registro-manual: ${como}`.slice(0, 300), concedido: true, validoAte: ate })
        }
        await t.query(
          `insert into rec_talentos (candidato_id, tags, areas, observacao, incluido_por, retencao_ate) values ($1,$2::jsonb,$3::jsonb,$4,$5,$6)
           on conflict (candidato_id) do update set tags = excluded.tags, areas = excluded.areas, observacao = excluded.observacao, retencao_ate = excluded.retencao_ate`,
          [candidatoId, JSON.stringify(listaTexto(b.tags, 30, 60)), JSON.stringify(listaTexto(b.areas, 20, 60)), texto(b.observacao, 'observação', { max: 1000, obrigatorio: false }) || null, usuario.colaboradorId, ate])
        await auditar(t, usuario.colaboradorId, 'candidato', candidatoId, 'talento_incluido', { retencaoAte: ate, versaoTexto: priv.versao })
        return ate
      })
      return ok({ retencaoAte: out }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'ats/talentos/:candidatoId/contatos', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.candidatoId)) throw naoEncontrado()
      const t = (await db.query('select historico_contato from rec_talentos where candidato_id = $1', [params.candidatoId])).rows[0]
      if (!t) throw naoEncontrado('Candidato não está no banco de talentos.')
      const hist = [...(t.historico_contato as unknown[]), { em: new Date().toISOString(), por: usuario.colaboradorId, canal: texto(req.corpo?.canal, 'canal', { max: 40 }), nota: texto(req.corpo?.nota, 'nota', { max: 500, obrigatorio: false }) }]
      await db.query('update rec_talentos set historico_contato = $2::jsonb, ultimo_contato_em = now() where candidato_id = $1', [params.candidatoId, JSON.stringify(hist)])
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'ats/talentos/:candidatoId', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params }) => {
      if (!uuid(params.candidatoId)) throw naoEncontrado()
      await db.tx(async (t) => {
        await t.query('delete from rec_talentos where candidato_id = $1', [params.candidatoId])
        await t.query("update rec_consentimentos set revogado_em = now() where candidato_id = $1 and finalidade = 'banco_talentos' and revogado_em is null", [params.candidatoId])
        await auditar(t, usuario.colaboradorId, 'candidato', params.candidatoId, 'talento_removido', {})
      })
      return ok()
    },
  },

  /* ===== comunicação ===== */
  {
    metodo: 'GET', padrao: 'ats/templates', cap: 'ats:gerenciar',
    h: async ({ db }) => {
      await garantirTemplates(db)
      return ok({ itens: (await db.query('select chave, nome, assunto, corpo, atualizado_em from rec_templates_msg order by nome')).rows.map(camel) })
    },
  },
  {
    metodo: 'PUT', padrao: 'ats/templates/:chave', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      await garantirTemplates(db)
      const r = await db.query('update rec_templates_msg set assunto = $2, corpo = $3, atualizado_em = now(), atualizado_por = $4 where chave = $1 returning chave',
        [params.chave, texto(req.corpo?.assunto, 'assunto', { max: 200 }), texto(req.corpo?.corpo, 'mensagem', { max: 5000 }), usuario.colaboradorId])
      if (!r.rowCount) throw naoEncontrado('Modelo não encontrado.')
      await auditar(db, usuario.colaboradorId, 'template_msg', params.chave, 'editado', {})
      return ok()
    },
  },
  {
    metodo: 'GET', padrao: 'ats/comunicacoes', cap: 'ats:gerenciar',
    h: async ({ db, req }) => {
      const { pagina, por, offset } = paginacao(req.query)
      const ps: unknown[] = []
      let where = 'true'
      if (req.query.status) { ps.push(req.query.status); where += ` and m.status = $${ps.length}` }
      const total = (await db.query(`select count(*)::int as n from rec_comunicacoes m where ${where}`, ps)).rows[0].n
      const r = await db.query(
        `select m.id, m.candidatura_id, m.template_chave, m.canal, m.assunto, m.status, m.erro, m.criado_em, m.enviada_em, k.nome as candidato_nome, v.titulo as vaga_titulo
         from rec_comunicacoes m left join rec_candidatos k on k.id = m.candidato_id left join rec_candidaturas c on c.id = m.candidatura_id left join rec_vagas v on v.id = c.vaga_id
         where ${where} order by m.criado_em desc limit ${por} offset ${offset}`, ps)
      const pend = (await db.query("select count(*)::int as n from rec_comunicacoes where status in ('pendente','falhou','nao_configurado')")).rows[0].n
      return ok({ itens: r.rows.map(camel), total, pagina, por, pendentes: pend })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/comunicacoes', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const b = req.corpo ?? {}
      const c = await carregarCandidatura(db, params.id, usuario)
      const { vars, email, candidatoId } = await variaveisCandidatura(db, c.id)
      Object.assign(vars, Object.fromEntries(Object.entries((b.variaveis ?? {}) as Record<string, unknown>).slice(0, 20).map(([k, v]) => [k, String(v ?? '').slice(0, 500)])))
      let assunto: string, corpo: string
      const chave = typeof b.templateChave === 'string' && b.templateChave ? b.templateChave : null
      if (chave && !b.corpo) ({ assunto, corpo } = await modeloPreenchido(db, chave, vars))
      else { assunto = texto(b.assunto, 'assunto', { max: 200 }); corpo = texto(b.corpo, 'mensagem', { max: 5000 }) }
      const r = await registrarEEnviar(db, { candidaturaId: c.id, candidatoId, templateChave: chave, assunto, corpo, para: email, criadoPor: usuario.colaboradorId, enviar: b.enviar !== false })
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'comunicacao', { status: r.status, template: chave })
      return ok(r, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'ats/comunicacoes/:id/enviar', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params }) => {
      if (!uuid(params.id)) throw naoEncontrado()
      const m = (await db.query('select m.*, k.email from rec_comunicacoes m join rec_candidatos k on k.id = m.candidato_id where m.id = $1', [params.id])).rows[0]
      if (!m) throw naoEncontrado('Mensagem não encontrada.')
      if (m.status === 'enviada') throw conflito('Esta mensagem já foi enviada.')
      const { enviarEmail } = await import('../email.js')
      const res = await enviarEmail(m.email, m.assunto, m.corpo)
      await db.query('update rec_comunicacoes set status = $2, erro = $3, enviada_em = case when $2 = $4 then now() else null end where id = $1', [m.id, res.status, res.erro ?? null, 'enviada'])
      await auditar(db, usuario.colaboradorId, 'comunicacao', m.id, 'reenvio', { status: res.status })
      return ok(res)
    },
  },

  /* ===== alertas ===== */
  {
    metodo: 'POST', padrao: 'ats/alertas/processar', cap: 'ats:gerenciar',
    h: async ({ db, agora }) => ok({ notificacoes: await processarAlertas(db, agora, true) }),
  },

  /* ===== LGPD: anonimização ===== */
  {
    metodo: 'POST', padrao: 'ats/candidatos/:id/anonimizar', cap: 'pessoas:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado()
      if (req.corpo?.confirmar !== true) throw invalido('Confirme a anonimização (ação irreversível).')
      await db.tx(async (t) => {
        const k = (await t.query('select id, anonimizado_em from rec_candidatos where id = $1 for update', [params.id])).rows[0]
        if (!k) throw naoEncontrado('Candidato não encontrado.')
        if (k.anonimizado_em) throw conflito('Candidato já anonimizado.')
        const ativas = await t.query("select 1 from rec_candidaturas where candidato_id = $1 and status = 'ativa'", [params.id])
        if (ativas.rowCount) throw conflito('Há candidaturas em andamento. Encerre-as antes de anonimizar.')
        const arqs = (await t.query('select curriculo_arquivo_id from rec_candidaturas where candidato_id = $1 and curriculo_arquivo_id is not null', [params.id])).rows.map((x) => x.curriculo_arquivo_id)
        await t.query(`update rec_candidaturas set curriculo_arquivo_id = null, respostas_triagem = '[]'::jsonb, pretensao = null, disponibilidade = null, token_hash = null, origem_detalhe = null where candidato_id = $1`, [params.id])
        if (arqs.length) await t.query('delete from arq_arquivos where id = any($1::uuid[])', [arqs])
        await t.query(`update rec_candidatura_notas set texto = '[removido por anonimização]' where candidatura_id in (select id from rec_candidaturas where candidato_id = $1)`, [params.id])
        await t.query(`update rec_avaliacoes set parecer = null where candidatura_id in (select id from rec_candidaturas where candidato_id = $1)`, [params.id])
        await t.query(`update rec_entrevistas set parecer = null where candidatura_id in (select id from rec_candidaturas where candidato_id = $1)`, [params.id])
        await t.query(`update rec_comunicacoes set corpo = '[removido por anonimização]', assunto = '[removido]' where candidato_id = $1`, [params.id])
        await t.query('delete from rec_talentos where candidato_id = $1', [params.id])
        await t.query(
          `update rec_candidatos set nome = 'Candidato anonimizado', email = $2, telefone = null, cidade = null, uf = null, linkedin = null, resumo = null,
             experiencias = '[]'::jsonb, formacoes = '[]'::jsonb, competencias = '[]'::jsonb, areas_interesse = '[]'::jsonb, pretensao = null, disponibilidade = null,
             anonimizado_em = now(), atualizado_em = now() where id = $1`, [params.id, `anonimizado-${params.id}@anonimizado.invalid`])
        await auditar(t, usuario.colaboradorId, 'candidato', params.id, 'anonimizado', {})
      })
      return ok()
    },
  },

  /* ===== exportação ===== */
  {
    metodo: 'GET', padrao: 'ats/exportar', cap: 'ats:exportar',
    h: async ({ db, usuario, req }): Promise<Res> => {
      const ec = escopoCand(usuario, 1)
      const ps: unknown[] = [...ec.params]
      let where = ec.sql
      if (req.query.vagaId && uuid(req.query.vagaId)) { ps.push(req.query.vagaId); where += ` and c.vaga_id = $${ps.length}` }
      if (req.query.status && (STATUS_CANDIDATURA as readonly string[]).includes(req.query.status)) { ps.push(req.query.status); where += ` and c.status = $${ps.length}` }
      const r = await db.query(`select ${SELECT_CARTAO} from ${FROM_CARTAO} where ${where} and k.anonimizado_em is null order by c.criado_em desc limit 5000`, ps)
      const rem = tem(usuario, 'vagas:ver_remuneracao')
      const cab = ['Vaga', 'Candidato', 'E-mail', 'Cidade', 'UF', 'Etapa', 'Situação', 'Origem', 'Data da candidatura', ...(rem ? ['Pretensão'] : [])]
      const linhas = [linhaCsv(cab), ...r.rows.map((x) => linhaCsv([x.vaga_codigo, x.nome, x.email, x.cidade, x.uf, x.etapa_nome, x.status, x.origem, new Date(x.criado_em).toISOString().slice(0, 10), ...(rem ? [x.pretensao] : [])]))]
      await auditar(db, usuario.colaboradorId, 'candidatura', null, 'exportacao', { linhas: r.rows.length })
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: 'candidaturas.csv', dados: Buffer.from('﻿' + linhas.join('\r\n'), 'utf8') } }
    },
  },
]

/* ---------- serializadores ---------- */
function valorProposta(v: unknown, u: Usuario): number | null {
  if (v === undefined || v === null || v === '') return null
  if (!tem(u, 'vagas:ver_remuneracao')) throw proibido('Sem permissão para registrar valores de remuneração.')
  const n = Number(v)
  if (!Number.isFinite(n) || n < 0 || n > 10_000_000) throw invalido('Valor inválido.', { valor: 'Valor inválido' })
  return n
}

function propostaOut(p: any, verValor: boolean) {
  const base = camel(p) as Record<string, unknown>
  if (verValor) return { ...base, valor: p.valor === null ? null : Number(p.valor) }
  // Sem permissão: nada de valores, benefícios nem valores dentro do histórico de negociação.
  return {
    ...base, valor: null, beneficios: [], valorOculto: true,
    historico: (p.historico as any[]).map((h) => ({ em: h.em, por: h.por, tipo: h.tipo })),
  }
}

function entrevistaOut(e: any, nome: (id: string | null) => string | null, u: Usuario, gerenciar: boolean) {
  const participa = (e.participantes as string[]).includes(u.colaboradorId)
  return {
    id: e.id, candidaturaId: e.candidatura_id, tipo: e.tipo, inicio: e.inicio, fim: e.fim, modalidade: e.modalidade, localOuLink: e.local_ou_link,
    participantes: (e.participantes as string[]).map((id) => ({ id, nome: nome(id) })), status: e.status,
    resultado: gerenciar || participa ? e.resultado : null, parecer: gerenciar || participa ? e.parecer : null,
    reagendamentos: gerenciar ? e.reagendamentos : [], ehParticipante: participa, criadoEm: e.criado_em,
  }
}

export type { Ctx }
void idsComPapel
