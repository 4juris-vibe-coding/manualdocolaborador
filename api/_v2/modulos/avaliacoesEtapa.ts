/* ============================================================
   API v2 · questionários (fit cultural / DISC) e documentos por
   etapa do pipeline.
   - RH configura por vaga, ligando cada questionário a uma etapa.
   - O candidato responde/envia pelo portal com o código de
     acompanhamento (rotas públicas, limitadas por IP, que revalidam
     o código a cada chamada). Para o público só saem textos das
     perguntas e alternativas: nunca pontos, pesos, competências,
     critérios, perfil recomendado ou observações do RH.
   - Resultados são apoio à decisão: nada aprova ou reprova sozinho.
   Escopo: quem não tem `ats:gerenciar` só enxerga candidaturas das
   vagas do próprio escopo (mesma regra do módulo ATS). Fora do
   escopo = 404.
   ============================================================ */
import { randomBytes } from 'node:crypto'
import {
  auditar, conflito, enumerado, escopoVagas, hashToken, idsComPapel, invalido, lista, naoEncontrado, notificar, ok, pessoas, tem, texto,
  type Executor, type Res, type Rota, type Usuario,
} from '../nucleo.js'
import { baixarArquivo, guardarArquivo, validarUpload, type TipoArquivo } from '../arquivos.js'
import {
  AVISO_APOIO, AVISO_DISC_INTERNO, DIMENSOES, TIPOS_PERGUNTA_FIT, TIPOS_QUESTIONARIO, compatibilidadeDisc, itensPublicos, perguntaPontuada, perguntasPublicas,
  pontuarDisc, pontuarFit, validarItensDisc, validarPerfil, validarPerguntasFit, validarRespostasDisc, validarRespostasFit,
  type FaixaInterpretacao, type Instrumento, type ItemDisc, type PerfilDisc, type PerguntaFit, type RespostasDisc, type RespostasFit,
} from '../../../src/domain/v2/avaliacoesEtapa.js'

const VER: ('ats:ver' | 'ats:avaliar' | 'ats:gerenciar')[] = ['ats:ver', 'ats:avaliar', 'ats:gerenciar']
const TIPOS_DOC: TipoArquivo[] = ['pdf', 'docx', 'doc', 'odt', 'png', 'jpg']
export const CATEGORIAS_DOC = ['documento', 'comprovante', 'certificado', 'avaliacao', 'contrato', 'outro'] as const
const MAX_DOCS_CANDIDATO_ETAPA = 10

const uuid = (v: unknown): v is string => typeof v === 'string' && /^[0-9a-f-]{36}$/i.test(v)
const novoId = () => randomBytes(6).toString('hex')
const idCurto = (v: unknown) => (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v) ? v : novoId())

/* ---------- escopo (mesma regra de api/_v2/modulos/ats.ts) ---------- */
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
  if (!uuid(id)) throw naoEncontrado('Candidatura não encontrada.')
  const e = escopoCand(u, 2)
  const r = await ex.query(
    `select c.id, c.vaga_id, c.etapa_id, c.status, v.titulo as vaga_titulo from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id where c.id = $1 and ${e.sql}`, [id, ...e.params])
  if (!r.rowCount) throw naoEncontrado('Candidatura não encontrada.')
  return r.rows[0] as { id: string; vaga_id: string; etapa_id: string | null; status: string; vaga_titulo: string }
}

async function carregarVaga(ex: Executor, id: string, u: Usuario) {
  if (!uuid(id)) throw naoEncontrado('Vaga não encontrada.')
  const e = tem(u, 'ats:gerenciar') ? { sql: 'true', params: [] as unknown[] } : escopoVagas(u, 'v', 2)
  const r = await ex.query(`select v.id, v.codigo, v.titulo from rec_vagas v where v.id = $1 and ${e.sql}`, [id, ...e.params])
  if (!r.rowCount) throw naoEncontrado('Vaga não encontrada.')
  return r.rows[0] as { id: string; codigo: string; titulo: string }
}

const etapasDa = async (ex: Executor, vagaId: string) =>
  (await ex.query('select id, nome, tipo, ordem from rec_vaga_etapas where vaga_id = $1 order by ordem', [vagaId])).rows as { id: string; nome: string; tipo: string; ordem: number }[]

/* ---------- leitura/validação da configuração ---------- */
function numeroOuNulo(v: unknown): number | null {
  if (v === undefined || v === null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : NaN
}

function primeiroErro(erros: Record<string, string>, prefixo: string) {
  const [k, m] = Object.entries(erros)[0]
  throw invalido(`${prefixo}: ${m}`, { [k]: m })
}

interface DadosQuestionario {
  etapaId: string; tipo: 'fit_cultural' | 'disc'; titulo: string; instrucoes: string | null; competencias: string[]; perguntas: PerguntaFit[]; itens: ItemDisc[]
  faixas: FaixaInterpretacao[]; perfil: PerfilDisc | null; instrumento: Instrumento; ativo: boolean
}

function lerQuestionario(b: any, etapas: { id: string }[], tipoFixo?: 'fit_cultural' | 'disc'): DadosQuestionario {
  const tipo = tipoFixo ?? enumerado(b.tipo, 'tipo', TIPOS_QUESTIONARIO)
  const etapaId = typeof b.etapaId === 'string' ? b.etapaId : ''
  if (!etapas.some((e) => e.id === etapaId)) throw invalido('Escolha uma etapa desta vaga.', { etapaId: 'Etapa inválida' })
  const titulo = texto(b.titulo, 'título', { max: 120 })
  const instrucoes = texto(b.instrucoes, 'instruções', { max: 1000, obrigatorio: false }) || null
  const ativo = b.ativo !== false
  if (tipo === 'fit_cultural') {
    const competencias = [...new Set(lista<unknown>(b.competencias, 12).map((x) => String(x ?? '').trim().slice(0, 60)).filter(Boolean))]
    const perguntas: PerguntaFit[] = lista<any>(b.perguntas, 41).map((p) => {
      const t = enumerado(p?.tipo, 'tipo da pergunta', TIPOS_PERGUNTA_FIT)
      const peso = numeroOuNulo(p?.peso)
      return {
        id: idCurto(p?.id), tipo: t, texto: typeof p?.texto === 'string' ? p.texto.trim() : '', obrigatoria: p?.obrigatoria !== false,
        ...(t === 'escolha' ? { alternativas: lista<any>(p?.alternativas, 9).map((a) => ({ id: idCurto(a?.id), texto: typeof a?.texto === 'string' ? a.texto.trim().slice(0, 200) : '', pontos: numeroOuNulo(a?.pontos) })) } : {}),
        competencia: typeof p?.competencia === 'string' && p.competencia.trim() ? p.competencia.trim() : null,
        peso: peso === null ? 1 : peso,
        criterio: typeof p?.criterio === 'string' && p.criterio.trim() ? p.criterio.trim().slice(0, 1000) : null,
      }
    })
    const erros = validarPerguntasFit(perguntas, competencias)
    if (Object.keys(erros).length) primeiroErro(erros, 'Revise as perguntas')
    const faixas: FaixaInterpretacao[] = lista<any>(b.faixas, 6).map((f, i) => {
      const min = Number(f?.min)
      if (!Number.isFinite(min) || min < 0 || min > 100) throw invalido('Critério de interpretação: nota mínima entre 0 e 100.', { [`faixa_${i + 1}`]: 'Entre 0 e 100' })
      return { min, rotulo: texto(f?.rotulo, 'rótulo do critério', { max: 60 }), descricao: texto(f?.descricao, 'descrição do critério', { max: 300, obrigatorio: false }) || undefined }
    })
    return { etapaId, tipo, titulo, instrucoes, competencias, perguntas, itens: [], faixas, perfil: null, instrumento: { origem: 'interno', nome: 'Questionário de fit cultural', versao: '1' }, ativo }
  }
  const itens: ItemDisc[] = lista<any>(b.itens, 31).map((it) => ({
    id: idCurto(it?.id),
    afirmacoes: lista<any>(it?.afirmacoes, 5).map((a) => ({ id: idCurto(a?.id), texto: typeof a?.texto === 'string' ? a.texto.trim().slice(0, 200) : '', dimensao: enumerado(a?.dimensao, 'dimensão', DIMENSOES) })),
  }))
  const erros = validarItensDisc(itens)
  if (Object.keys(erros).length) primeiroErro(erros, 'Revise os blocos de afirmações')
  let perfil: PerfilDisc | null = null
  if (b.perfilRecomendado && typeof b.perfilRecomendado === 'object') {
    const p = b.perfilRecomendado
    perfil = { D: Number(p.D), I: Number(p.I), S: Number(p.S), C: Number(p.C), justificativa: texto(p.justificativa, 'justificativa do perfil', { max: 1000, obrigatorio: false }) }
    const ep = validarPerfil(perfil)
    if (Object.keys(ep).length) primeiroErro(ep, 'Perfil recomendado')
  }
  const ins = b.instrumento ?? {}
  const instrumento: Instrumento = {
    origem: enumerado(ins.origem, 'origem do instrumento', ['interno', 'externo'] as const, 'interno'),
    nome: texto(ins.nome, 'nome do instrumento', { max: 120, obrigatorio: false }) || 'Instrumento interno de escolha forçada',
    versao: texto(ins.versao, 'versão do instrumento', { max: 20, obrigatorio: false }) || '1',
  }
  return { etapaId, tipo, titulo, instrucoes, competencias: [], perguntas: [], itens, faixas: [], perfil, instrumento, ativo }
}

function questionarioOut(q: any, respostas = 0) {
  return {
    id: q.id, vagaId: q.vaga_id, etapaId: q.etapa_id, tipo: q.tipo, titulo: q.titulo, instrucoes: q.instrucoes, competencias: q.competencias, perguntas: q.perguntas,
    itens: q.itens, faixas: q.faixas, perfilRecomendado: q.perfil_recomendado, instrumento: q.instrumento, ativo: q.ativo, versao: q.versao,
    criadoEm: q.criado_em, atualizadoEm: q.atualizado_em, respostas,
    aviso: q.tipo === 'disc' && q.instrumento?.origem !== 'externo' ? AVISO_DISC_INTERNO : null,
  }
}

/* ---------- resultado para o RH ---------- */
function resultadoOut(r: any, q: any, verObs: boolean, nomes: Map<string, string>, etapaNome: (id: string | null) => string | null) {
  const base = {
    id: r.id, questionarioId: q.id, tipo: q.tipo, titulo: q.titulo, etapaId: r.etapa_id, etapaNome: etapaNome(r.etapa_id), versao: r.versao, enviadoEm: r.enviado_em,
    instrumento: q.instrumento, avisoApoio: AVISO_APOIO,
    ...(verObs ? { observacoesRh: r.observacoes_rh ?? '', observacoesPor: r.observacoes_por ? nomes.get(r.observacoes_por) ?? 'Pessoa removida' : null, observacoesEm: r.observacoes_em } : {}),
  }
  if (q.tipo === 'fit_cultural') {
    const perguntas = (r.retrato?.perguntas ?? []) as PerguntaFit[]
    const resp = (r.respostas ?? {}) as RespostasFit
    const res = pontuarFit(perguntas, resp, q.faixas)
    return {
      ...base,
      fit: {
        ...res, temCriterios: (q.faixas ?? []).length > 0,
        respostas: perguntas.map((p) => {
          const v = resp[p.id]
          const alt = p.tipo === 'escolha' ? (p.alternativas ?? []).find((a) => a.id === v) : undefined
          return {
            perguntaId: p.id, texto: p.texto, tipo: p.tipo, competencia: p.competencia ?? null, peso: p.peso ?? 1, criterio: p.criterio ?? null, pontuada: perguntaPontuada(p),
            resposta: v === undefined ? null : alt ? alt.texto : String(v), pontos: alt ? alt.pontos ?? null : null,
          }
        }),
      },
    }
  }
  const itens = (r.retrato?.itens ?? []) as ItemDisc[]
  const resp = (r.respostas ?? {}) as RespostasDisc
  const res = pontuarDisc(itens, resp)
  const perfil = q.perfil_recomendado as PerfilDisc | null
  return {
    ...base,
    aviso: q.instrumento?.origem !== 'externo' ? AVISO_DISC_INTERNO : null,
    disc: {
      ...res,
      perfilRecomendado: perfil,
      compatibilidade: perfil ? compatibilidadeDisc(res.pontuacao, perfil) : null,
      escolhas: itens.map((it) => ({
        itemId: it.id,
        mais: it.afirmacoes.find((a) => a.id === resp[it.id]?.mais) ?? null,
        menos: it.afirmacoes.find((a) => a.id === resp[it.id]?.menos) ?? null,
      })),
    },
  }
}

/* ---------- público: candidatura pelo código ---------- */
async function candidaturaDoCodigo(ex: Executor, corpo: any) {
  const token = typeof corpo?.token === 'string' ? corpo.token.trim() : ''
  if (!token || token.length > 200) throw invalido('Informe o código de acompanhamento.', { token: 'Obrigatório' })
  const c = (await ex.query(
    `select c.id, c.vaga_id, c.etapa_id, c.status, v.titulo as vaga_titulo, v.recrutador_id from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id where c.token_hash = $1`,
    [hashToken(token)])).rows[0]
  if (!c) throw naoEncontrado('Código não encontrado. Confira se copiou o código completo.')
  return c as { id: string; vaga_id: string; etapa_id: string | null; status: string; vaga_titulo: string; recrutador_id: string | null }
}

const destinosDaVaga = async (ex: Executor, recrutadorId: string | null) => (recrutadorId ? [recrutadorId] : await idsComPapel(ex, 'rh'))

function docOut(d: any, nomes?: Map<string, string>) {
  return {
    id: d.id, etapaId: d.etapa_id, categoria: d.categoria, visivelCandidato: d.visivel_candidato, enviadoPor: d.enviado_por,
    ...(nomes ? { colaboradorNome: d.colaborador_id ? nomes.get(d.colaborador_id) ?? 'Pessoa removida' : null, observacao: d.observacao } : {}),
    nome: d.nome, mime: d.mime, tamanho: d.tamanho, criadoEm: d.criado_em,
  }
}

async function documentoDa(ex: Executor, candidaturaId: string, docId: string) {
  if (!uuid(docId)) throw naoEncontrado('Documento não encontrado.')
  const d = (await ex.query(
    `select d.*, a.nome, a.mime, a.tamanho from rec_candidatura_documentos d join arq_arquivos a on a.id = d.arquivo_id where d.id = $1 and d.candidatura_id = $2`, [docId, candidaturaId])).rows[0]
  if (!d) throw naoEncontrado('Documento não encontrado.')
  return d
}

export const rotas: Rota[] = [
  /* ===================== RH · configuração por vaga ===================== */
  {
    metodo: 'GET', padrao: 'ats/vagas/:vagaId/avaliacoes-etapa', cap: VER,
    h: async ({ db, usuario, params }) => {
      const v = await carregarVaga(db, params.vagaId, usuario)
      const etapas = await etapasDa(db, v.id)
      const cfg = (await db.query('select * from rec_etapa_config where vaga_id = $1', [v.id])).rows
      const qs = (await db.query(
        `select q.*, (select count(*)::int from rec_questionario_respostas r where r.questionario_id = q.id) as n from rec_questionarios q where q.vaga_id = $1 order by q.criado_em`, [v.id])).rows
      return ok({
        vaga: { id: v.id, codigo: v.codigo, titulo: v.titulo },
        etapas: etapas.map((e) => {
          const c = cfg.find((x) => x.etapa_id === e.id)
          return { ...e, solicitaDocumentos: !!c?.solicita_documentos, instrucaoDocumentos: c?.instrucao_documentos ?? '', avisarCandidato: !!c?.avisar_candidato }
        }),
        questionarios: qs.map((q) => questionarioOut(q, q.n)),
        permissoes: { gerenciar: tem(usuario, 'ats:gerenciar') },
        avisos: { apoio: AVISO_APOIO, discInterno: AVISO_DISC_INTERNO },
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'ats/vagas/:vagaId/etapas/:etapaId/config', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const v = await carregarVaga(db, params.vagaId, usuario)
      if (!(await etapasDa(db, v.id)).some((e) => e.id === params.etapaId)) throw naoEncontrado('Etapa não encontrada.')
      const b = req.corpo ?? {}
      // Campos ausentes no corpo mantêm o valor gravado (o aviso por e-mail pode ser ligado sem mexer nos documentos).
      const atual = (await db.query('select solicita_documentos, instrucao_documentos, avisar_candidato from rec_etapa_config where etapa_id = $1', [params.etapaId])).rows[0]
      const solicita = b.solicitaDocumentos === undefined ? !!atual?.solicita_documentos : b.solicitaDocumentos === true
      const instrucao = b.instrucaoDocumentos === undefined ? (atual?.instrucao_documentos ?? null) : (texto(b.instrucaoDocumentos, 'instrução', { max: 500, obrigatorio: false }) || null)
      const avisar = b.avisarCandidato === undefined ? !!atual?.avisar_candidato : b.avisarCandidato === true
      if (solicita && !instrucao) throw invalido('Escreva uma instrução curta para o candidato.', { instrucaoDocumentos: 'Obrigatório ao solicitar documentos' })
      await db.tx(async (t) => {
        await t.query(
          `insert into rec_etapa_config (etapa_id, vaga_id, solicita_documentos, instrucao_documentos, avisar_candidato, atualizado_por) values ($1,$2,$3,$4,$5,$6)
           on conflict (etapa_id) do update set solicita_documentos = excluded.solicita_documentos, instrucao_documentos = excluded.instrucao_documentos,
             avisar_candidato = excluded.avisar_candidato, atualizado_por = excluded.atualizado_por, atualizado_em = now()`,
          [params.etapaId, v.id, solicita, instrucao, avisar, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'vaga', v.id, 'etapa_documentos', { etapaId: params.etapaId, solicita, avisarCandidato: avisar })
      })
      return ok({ solicitaDocumentos: solicita, instrucaoDocumentos: instrucao ?? '', avisarCandidato: avisar })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/vagas/:vagaId/questionarios', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const v = await carregarVaga(db, params.vagaId, usuario)
      const d = lerQuestionario(req.corpo ?? {}, await etapasDa(db, v.id))
      const id = await db.tx(async (t) => {
        const r = await t.query(
          `insert into rec_questionarios (vaga_id, etapa_id, tipo, titulo, instrucoes, competencias, perguntas, itens, faixas, perfil_recomendado, instrumento, ativo, criado_por)
           values ($1,$2,$3,$4,$5,$6::jsonb,$7::jsonb,$8::jsonb,$9::jsonb,$10::jsonb,$11::jsonb,$12,$13) returning id`,
          [v.id, d.etapaId, d.tipo, d.titulo, d.instrucoes, JSON.stringify(d.competencias), JSON.stringify(d.perguntas), JSON.stringify(d.itens), JSON.stringify(d.faixas),
            d.perfil ? JSON.stringify(d.perfil) : null, JSON.stringify(d.instrumento), d.ativo, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'vaga', v.id, 'questionario_criado', { questionarioId: r.rows[0].id, tipo: d.tipo, etapaId: d.etapaId })
        return r.rows[0].id as string
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'ats/questionarios/:id', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado('Questionário não encontrado.')
      const q = (await db.query('select id, vaga_id, tipo from rec_questionarios where id = $1', [params.id])).rows[0]
      if (!q) throw naoEncontrado('Questionário não encontrado.')
      await carregarVaga(db, q.vaga_id, usuario)
      const d = lerQuestionario(req.corpo ?? {}, await etapasDa(db, q.vaga_id), q.tipo)
      await db.tx(async (t) => {
        // Respostas já enviadas guardam o próprio retrato: editar não altera o que o candidato respondeu.
        await t.query(
          `update rec_questionarios set etapa_id = $2, titulo = $3, instrucoes = $4, competencias = $5::jsonb, perguntas = $6::jsonb, itens = $7::jsonb, faixas = $8::jsonb,
             perfil_recomendado = $9::jsonb, instrumento = $10::jsonb, ativo = $11, versao = versao + 1, atualizado_em = now() where id = $1`,
          [q.id, d.etapaId, d.titulo, d.instrucoes, JSON.stringify(d.competencias), JSON.stringify(d.perguntas), JSON.stringify(d.itens), JSON.stringify(d.faixas),
            d.perfil ? JSON.stringify(d.perfil) : null, JSON.stringify(d.instrumento), d.ativo])
        await auditar(t, usuario.colaboradorId, 'vaga', q.vaga_id, 'questionario_editado', { questionarioId: q.id })
      })
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'ats/questionarios/:id', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params }) => {
      if (!uuid(params.id)) throw naoEncontrado('Questionário não encontrado.')
      const q = (await db.query('select id, vaga_id from rec_questionarios where id = $1', [params.id])).rows[0]
      if (!q) throw naoEncontrado('Questionário não encontrado.')
      await carregarVaga(db, q.vaga_id, usuario)
      const n = (await db.query('select count(*)::int as n from rec_questionario_respostas where questionario_id = $1', [q.id])).rows[0].n
      if (n > 0) throw conflito('Este questionário já tem respostas e não pode ser excluído. Desative-o para que não fique mais disponível.')
      await db.tx(async (t) => {
        await t.query('delete from rec_questionarios where id = $1', [q.id])
        await auditar(t, usuario.colaboradorId, 'vaga', q.vaga_id, 'questionario_excluido', { questionarioId: q.id })
      })
      return ok()
    },
  },

  /* ===================== RH · resultados na candidatura ===================== */
  {
    metodo: 'GET', padrao: 'ats/candidaturas/:id/questionarios', cap: VER,
    h: async ({ db, usuario, params }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const verObs = tem(usuario, 'ats:notas_rh')
      const etapas = await etapasDa(db, c.vaga_id)
      const etapaNome = (id: string | null) => etapas.find((e) => e.id === id)?.nome ?? null
      const nomes = new Map((await pessoas(db)).map((p) => [p.id, p.nome]))
      const qs = (await db.query('select * from rec_questionarios where vaga_id = $1', [c.vaga_id])).rows
      const rs = (await db.query('select * from rec_questionario_respostas where candidatura_id = $1 order by enviado_em', [c.id])).rows
      const respondidos = new Set(rs.map((r) => r.questionario_id))
      const pendentes = c.status === 'ativa'
        ? qs.filter((q) => q.ativo && q.etapa_id && q.etapa_id === c.etapa_id && !respondidos.has(q.id)).map((q) => ({ id: q.id, tipo: q.tipo, titulo: q.titulo, etapaNome: etapaNome(q.etapa_id) }))
        : []
      // Observações do RH sobre os questionários (restritas): a leitura é registrada, sem o texto.
      const nObs = verObs ? rs.filter((r) => r.observacoes_rh).length : 0
      if (nObs) await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'observacoes_rh_visualizadas', { quantidade: nObs })
      return ok({
        resultados: rs.map((r) => resultadoOut(r, qs.find((q) => q.id === r.questionario_id), verObs, nomes, etapaNome)),
        pendentes,
        permissoes: { observacoes: verObs },
        avisoApoio: AVISO_APOIO,
      })
    },
  },
  {
    metodo: 'PATCH', padrao: 'ats/questionario-respostas/:id', cap: 'ats:notas_rh',
    h: async ({ db, usuario, params, req }) => {
      if (!uuid(params.id)) throw naoEncontrado('Resposta não encontrada.')
      const r = (await db.query('select id, candidatura_id from rec_questionario_respostas where id = $1', [params.id])).rows[0]
      if (!r) throw naoEncontrado('Resposta não encontrada.')
      await carregarCandidatura(db, r.candidatura_id, usuario)
      const obs = texto(req.corpo?.observacoesRh, 'observações do RH', { max: 3000, obrigatorio: false }) || null
      await db.tx(async (t) => {
        await t.query('update rec_questionario_respostas set observacoes_rh = $2, observacoes_por = $3, observacoes_em = now() where id = $1', [r.id, obs, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'candidatura', r.candidatura_id, 'questionario_observacoes', { respostaId: r.id })
      })
      return ok()
    },
  },

  /* ===================== RH · documentos por etapa ===================== */
  {
    metodo: 'GET', padrao: 'ats/candidaturas/:id/documentos', cap: VER,
    h: async ({ db, usuario, params }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const etapas = await etapasDa(db, c.vaga_id)
      const cfg = (await db.query('select etapa_id, solicita_documentos, instrucao_documentos from rec_etapa_config where vaga_id = $1 and solicita_documentos', [c.vaga_id])).rows
      const nomes = new Map((await pessoas(db)).map((p) => [p.id, p.nome]))
      const docs = (await db.query(
        `select d.*, a.nome, a.mime, a.tamanho from rec_candidatura_documentos d join arq_arquivos a on a.id = d.arquivo_id where d.candidatura_id = $1 order by d.criado_em`, [c.id])).rows
      return ok({
        etapaAtualId: c.etapa_id,
        etapas: etapas.map((e) => ({ id: e.id, nome: e.nome, ordem: e.ordem, solicitaDocumentos: cfg.some((x) => x.etapa_id === e.id), instrucaoDocumentos: cfg.find((x) => x.etapa_id === e.id)?.instrucao_documentos ?? null })),
        documentos: docs.map((d) => docOut(d, nomes)),
        permissoes: { gerenciar: tem(usuario, 'ats:gerenciar') },
      })
    },
  },
  {
    metodo: 'POST', padrao: 'ats/candidaturas/:id/documentos', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const b = req.corpo ?? {}
      let etapaId: string | null = null
      if (b.etapaId) {
        if (!(await etapasDa(db, c.vaga_id)).some((e) => e.id === b.etapaId)) throw invalido('Etapa inválida.', { etapaId: 'Etapa inválida' })
        etapaId = b.etapaId
      }
      const categoria = enumerado(b.categoria, 'categoria', CATEGORIAS_DOC, 'outro')
      const observacao = texto(b.observacao, 'observação', { max: 500, obrigatorio: false }) || null
      const up = validarUpload(b.arquivo, TIPOS_DOC, 'arquivo')
      const id = await db.tx(async (t) => {
        const arq = await guardarArquivo(t, up, 'candidatura_documento', c.id, usuario.colaboradorId)
        const r = await t.query(
          `insert into rec_candidatura_documentos (candidatura_id, etapa_id, arquivo_id, categoria, visivel_candidato, enviado_por, colaborador_id, observacao) values ($1,$2,$3,$4,$5,'rh',$6,$7) returning id`,
          [c.id, etapaId, arq, categoria, b.visivelCandidato === true, usuario.colaboradorId, observacao])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'documento_anexado', { documentoId: r.rows[0].id, etapaId, visivelCandidato: b.visivelCandidato === true })
        return r.rows[0].id as string
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'PATCH', padrao: 'ats/candidaturas/:id/documentos/:docId', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params, req }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const d = await documentoDa(db, c.id, params.docId)
      const b = req.corpo ?? {}
      const visivel = typeof b.visivelCandidato === 'boolean' ? b.visivelCandidato : d.visivel_candidato
      const categoria = b.categoria === undefined ? d.categoria : enumerado(b.categoria, 'categoria', CATEGORIAS_DOC)
      const observacao = b.observacao === undefined ? d.observacao : texto(b.observacao, 'observação', { max: 500, obrigatorio: false }) || null
      await db.tx(async (t) => {
        await t.query('update rec_candidatura_documentos set visivel_candidato = $2, categoria = $3, observacao = $4 where id = $1', [d.id, visivel, categoria, observacao])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'documento_alterado', { documentoId: d.id, visivelCandidato: visivel })
      })
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'ats/candidaturas/:id/documentos/:docId', cap: 'ats:gerenciar',
    h: async ({ db, usuario, params }) => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const d = await documentoDa(db, c.id, params.docId)
      await db.tx(async (t) => {
        // Exclusão real (como a troca de currículo): o arquivo sai do banco e o vínculo cai em cascata.
        await t.query('delete from arq_arquivos where id = $1', [d.arquivo_id])
        await auditar(t, usuario.colaboradorId, 'candidatura', c.id, 'documento_excluido', { documentoId: d.id, nome: d.nome, enviadoPor: d.enviado_por })
      })
      return ok()
    },
  },
  {
    metodo: 'GET', padrao: 'ats/candidaturas/:id/documentos/:docId/arquivo', cap: VER,
    h: async ({ db, usuario, params }): Promise<Res> => {
      const c = await carregarCandidatura(db, params.id, usuario)
      const d = await documentoDa(db, c.id, params.docId)
      const out = await baixarArquivo(db, d.arquivo_id)
      if (!out) throw naoEncontrado('Arquivo não encontrado.')
      await auditar(db, usuario.colaboradorId, 'candidatura', c.id, 'documento_baixado', { documentoId: d.id })
      return out
    },
  },

  /* ===================== público · candidato pelo código ===================== */
  {
    // Tarefas da etapa atual: questionários pendentes/respondidos e documentos visíveis. Nada de nomes internos de etapa.
    metodo: 'POST', padrao: 'publico/candidaturas/tarefas', publica: true, limite: 30,
    h: async ({ db, req }) => {
      const c = await candidaturaDoCodigo(db, req.corpo)
      const ativa = c.status === 'ativa'
      const respondidas = (await db.query(
        `select r.questionario_id, r.enviado_em, q.titulo, q.tipo from rec_questionario_respostas r join rec_questionarios q on q.id = r.questionario_id where r.candidatura_id = $1 order by r.enviado_em`, [c.id])).rows
      const feitos = new Set(respondidas.map((r) => r.questionario_id))
      const pend = ativa && c.etapa_id
        ? (await db.query('select * from rec_questionarios where vaga_id = $1 and etapa_id = $2 and ativo order by criado_em', [c.vaga_id, c.etapa_id])).rows.filter((q) => !feitos.has(q.id))
        : []
      const cfg = ativa && c.etapa_id ? (await db.query('select solicita_documentos, instrucao_documentos from rec_etapa_config where etapa_id = $1', [c.etapa_id])).rows[0] : null
      const docs = (await db.query(
        `select d.id, d.etapa_id, d.categoria, d.visivel_candidato, d.enviado_por, d.criado_em, a.nome, a.mime, a.tamanho
         from rec_candidatura_documentos d join arq_arquivos a on a.id = d.arquivo_id where d.candidatura_id = $1 and d.visivel_candidato order by d.criado_em`, [c.id])).rows
      return ok({
        vaga: c.vaga_titulo,
        ativa,
        pendentes: pend.map((q) => ({
          id: q.id, tipo: q.tipo, titulo: q.titulo, instrucoes: q.instrucoes,
          ...(q.tipo === 'fit_cultural' ? { perguntas: perguntasPublicas(q.perguntas) } : { itens: itensPublicos(q.itens) }),
        })),
        respondidos: respondidas.map((r) => ({ id: r.questionario_id, tipo: r.tipo, titulo: r.titulo, enviadoEm: r.enviado_em })),
        documentos: {
          solicita: !!cfg?.solicita_documentos,
          instrucao: cfg?.solicita_documentos ? cfg.instrucao_documentos : null,
          formatos: TIPOS_DOC.map((t) => t.toUpperCase()),
          arquivos: docs.map((d) => ({ id: d.id, nome: d.nome, mime: d.mime, tamanho: d.tamanho, categoria: d.categoria, enviadoPor: d.enviado_por, criadoEm: d.criado_em })),
        },
      })
    },
  },
  {
    metodo: 'POST', padrao: 'publico/candidaturas/questionarios/:id/responder', publica: true, limite: 10,
    h: async ({ db, req, params }) => {
      const c = await candidaturaDoCodigo(db, req.corpo)
      if (!uuid(params.id)) throw naoEncontrado('Questionário não encontrado.')
      const q = (await db.query('select * from rec_questionarios where id = $1 and vaga_id = $2', [params.id, c.vaga_id])).rows[0]
      if (!q) throw naoEncontrado('Questionário não encontrado.')
      if (c.status !== 'ativa') throw conflito('Esta candidatura não está mais em andamento.')
      if (!q.ativo || !q.etapa_id || q.etapa_id !== c.etapa_id) throw conflito('Este questionário não está disponível nesta fase do processo.')
      if ((await db.query('select 1 from rec_questionario_respostas where candidatura_id = $1 and questionario_id = $2', [c.id, q.id])).rowCount) throw conflito('Você já respondeu este questionário.')
      const bruto = req.corpo?.respostas && typeof req.corpo.respostas === 'object' ? req.corpo.respostas : {}
      let respostas: RespostasFit | RespostasDisc
      let retrato: Record<string, unknown>
      if (q.tipo === 'fit_cultural') {
        const v = validarRespostasFit(q.perguntas, bruto as RespostasFit)
        if (Object.keys(v.erros).length) throw invalido('Responda às perguntas obrigatórias.', v.erros)
        respostas = v.limpas; retrato = { perguntas: q.perguntas }
      } else {
        const v = validarRespostasDisc(q.itens, bruto as RespostasDisc)
        if (Object.keys(v.erros).length) throw invalido('Marque, em cada bloco, a afirmação que mais e a que menos parece com você.', v.erros)
        respostas = v.limpas; retrato = { itens: q.itens }
      }
      await db.tx(async (t) => {
        const r = await t.query(
          `insert into rec_questionario_respostas (questionario_id, candidatura_id, etapa_id, versao, retrato, respostas) values ($1,$2,$3,$4,$5::jsonb,$6::jsonb)
           on conflict (candidatura_id, questionario_id) do nothing returning id`,
          [q.id, c.id, c.etapa_id, q.versao, JSON.stringify(retrato), JSON.stringify(respostas)])
        if (!r.rowCount) throw conflito('Você já respondeu este questionário.')
        await auditar(t, null, 'candidatura', c.id, 'questionario_respondido', { questionarioId: q.id, tipo: q.tipo })
        for (const d of await destinosDaVaga(t, c.recrutador_id)) {
          await notificar(t, { destinatarioId: d, tipo: 'questionario_respondido', titulo: 'Questionário respondido por candidato', corpo: `Vaga: ${c.vaga_titulo}`, link: `/recrutamento/candidatos/${c.id}`, chave: `quest-resp-${q.id}-${c.id}` })
        }
      })
      return ok({ ok: true, mensagem: 'Respostas enviadas. Obrigado!' }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'publico/candidaturas/documentos', publica: true, limite: 10,
    h: async ({ db, req }) => {
      const c = await candidaturaDoCodigo(db, req.corpo)
      if (c.status !== 'ativa') throw conflito('Esta candidatura não está mais em andamento.')
      const cfg = c.etapa_id ? (await db.query('select solicita_documentos from rec_etapa_config where etapa_id = $1', [c.etapa_id])).rows[0] : null
      if (!cfg?.solicita_documentos) throw conflito('Nesta fase do processo não há envio de documentos.')
      const n = (await db.query(`select count(*)::int as n from rec_candidatura_documentos where candidatura_id = $1 and etapa_id = $2 and enviado_por = 'candidato'`, [c.id, c.etapa_id])).rows[0].n
      if (n >= MAX_DOCS_CANDIDATO_ETAPA) throw conflito(`Limite de ${MAX_DOCS_CANDIDATO_ETAPA} arquivos nesta fase atingido.`)
      const observacao = texto(req.corpo?.observacao, 'observação', { max: 300, obrigatorio: false }) || null
      const up = validarUpload(req.corpo?.arquivo, TIPOS_DOC, 'arquivo')
      const id = await db.tx(async (t) => {
        const arq = await guardarArquivo(t, up, 'candidatura_documento', c.id, null)
        const r = await t.query(
          `insert into rec_candidatura_documentos (candidatura_id, etapa_id, arquivo_id, categoria, visivel_candidato, enviado_por, observacao) values ($1,$2,$3,'documento',true,'candidato',$4) returning id`,
          [c.id, c.etapa_id, arq, observacao])
        await auditar(t, null, 'candidatura', c.id, 'documento_enviado_candidato', { documentoId: r.rows[0].id, etapaId: c.etapa_id })
        for (const d of await destinosDaVaga(t, c.recrutador_id)) {
          await notificar(t, { destinatarioId: d, tipo: 'documento_candidato', titulo: 'Candidato enviou documento', corpo: `Vaga: ${c.vaga_titulo}`, link: `/recrutamento/candidatos/${c.id}`, chave: `cand-doc-${c.id}-${c.etapa_id}` })
        }
        return r.rows[0].id as string
      })
      return ok({ id, mensagem: 'Arquivo enviado.' }, 201)
    },
  },
  {
    // Download pelo candidato: revalida o código a cada vez e só entrega arquivo marcado como visível.
    metodo: 'POST', padrao: 'publico/candidaturas/documentos/:id/arquivo', publica: true, limite: 30,
    h: async ({ db, req, params }): Promise<Res> => {
      const c = await candidaturaDoCodigo(db, req.corpo)
      if (!uuid(params.id)) throw naoEncontrado('Arquivo não encontrado.')
      const d = (await db.query('select arquivo_id from rec_candidatura_documentos where id = $1 and candidatura_id = $2 and visivel_candidato', [params.id, c.id])).rows[0]
      if (!d) throw naoEncontrado('Arquivo não encontrado.')
      const out = await baixarArquivo(db, d.arquivo_id)
      if (!out) throw naoEncontrado('Arquivo não encontrado.')
      return { ...out, cabecalhos: { 'Cache-Control': 'no-store' } }
    },
  },
]
