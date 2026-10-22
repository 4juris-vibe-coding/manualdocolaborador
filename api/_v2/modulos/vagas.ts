/* ============================================================
   API v2 · Vagas, aprovações, painel, alertas e configuração
   Rotas: vagas*, recrutamento/{painel,config,opcoes,alertas,aprovacoes-pendentes}
   Regras de negócio puras: src/domain/v2/vagas.ts e indicadoresRecrutamento.ts
   ============================================================ */
import { randomBytes } from 'node:crypto'
import {
  auditar, camel, cargos, conflito, qualquerArea, dataISO, enumerado, escopoVagas, hojeISO, idsComFuncao, idsComPapel, inteiro, invalido, lista, listaTexto,
  naoEncontrado, notificar, ok, paginacao, pessoaPorId, pessoas, proibido, setores, texto, unidades,
  type Ctx, type Executor, type Res, type Rota, type Usuario,
} from '../nucleo.js'
import { baixarArquivo, guardarArquivo, validarUpload } from '../arquivos.js'
import { FUNCAO_LABEL, PAPEL_LABEL } from '../../../src/domain/permissions.js'
import type { Papel } from '../../../src/lib/types.js'
import {
  acoesPossiveis, CANAIS_PADRAO, camposFaltantes, celulaCsv, escolherFluxo, ETAPAS_PADRAO, FLUXOS_PADRAO, MODALIDADES_VAGA, MOEDAS, MOTIVOS_VAGA,
  passoAtual, podeDecidirPasso, PRIORIDADES_VAGA, proximoStatus, quemEdita, ROTULO_ETAPA, ROTULO_MODALIDADE, ROTULO_PRIORIDADE, semMovimentacao,
  situacaoPrazo, slugificar, somarDias, STATUS_ATIVOS, STATUS_FINAIS, STATUS_VAGA, TIPOS_ETAPA, TIPOS_REMUNERACAO, TIPOS_VAGA, validarEtapas,
  type AcaoVaga, type EtapaModelo, type FluxoAprovacao, type PassoFluxo, type StatusVaga, type TipoEtapa,
} from '../../../src/domain/v2/vagas.js'
import {
  DEFINICOES, funilPorTipo, media, taxaConversao, tempoAtePrimeiraCandidaturaDias, tempoPorEtapa, tempoPreenchimentoDias, vagaNoPrazo,
  type ContratacaoIndicador, type VagaIndicador,
} from '../../../src/domain/v2/indicadoresRecrutamento.js'

const uuid = (s: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s)
const linkVaga = (id: string) => `/recrutamento/vagas/${id}`

/* ---------- configuração (com padrões criados no primeiro uso) ---------- */
async function config<T>(ex: Executor, chave: string, padrao: T): Promise<T> {
  const r = await ex.query('select dados from rec_config where chave = $1', [chave])
  if (r.rows[0]) return r.rows[0].dados as T
  await ex.query('insert into rec_config (chave, dados) values ($1, $2::jsonb) on conflict (chave) do nothing', [chave, JSON.stringify(padrao)])
  return padrao
}
const TIPOS_PADRAO = TIPOS_VAGA.map((t) => ({ chave: t, nome: { efetivo: 'Efetivo', temporario: 'Temporário', estagio: 'Estágio', aprendiz: 'Aprendiz', contrato: 'Contrato (PJ)', outro: 'Outro' }[t] }))
const lerConfig = async (ex: Executor) => ({
  fluxos: await config<FluxoAprovacao[]>(ex, 'fluxos_aprovacao', FLUXOS_PADRAO),
  etapas: await config<EtapaModelo[]>(ex, 'etapas_padrao', ETAPAS_PADRAO),
  canais: await config<{ chave: string; nome: string }[]>(ex, 'canais', CANAIS_PADRAO),
  tipos: await config<{ chave: string; nome: string }[]>(ex, 'tipos_vaga', TIPOS_PADRAO),
})

/* ---------- organização (nomes) ---------- */
interface Org { pessoa: Map<string, { nome: string; setorId: string; status: string }>; setor: Map<string, string>; cargo: Map<string, { nome: string; nivel?: string; setorId: string }>; unidade: Map<string, string> }
async function carregarOrg(ex: Executor): Promise<Org> {
  const [p, s, c, u] = await Promise.all([pessoas(ex), setores(ex), cargos(ex), unidades(ex)])
  return {
    pessoa: new Map(p.map((x) => [x.id, { nome: x.nomeSocial || x.nome, setorId: x.setorId, status: x.status }])),
    setor: new Map(s.map((x) => [x.id, x.nome])),
    cargo: new Map(c.map((x) => [x.id, { nome: x.nome, nivel: x.nivel, setorId: x.setorId }])),
    unidade: new Map(u.map((x) => [x.id, x.nome])),
  }
}
const nomeDe = (m: Map<string, { nome: string }>, id: string | null | undefined) => (id ? m.get(id)?.nome ?? null : null)

/* ---------- escopo ---------- */
/** RH/recrutador veem tudo; diretoria vê tudo (leitura); gestor vê a própria área/solicitações; aprovador vê o que lhe cabe decidir. */
function escopo(u: Usuario, alias: string, p: number): { sql: string; params: unknown[] } {
  if (u.caps.has('vagas:gerenciar') || u.papel === 'diretoria') return { sql: 'true', params: [] }
  const e = escopoVagas(u, alias, p)
  if (!e.params.length) return e // vê todas (ex.: analista de RH); o trecho abaixo supõe os parâmetros do escopo por área
  return {
    sql: `(${e.sql} or exists (select 1 from rec_vaga_aprovacoes ap where ap.vaga_id = ${alias}.id and (
      (ap.aprovador_tipo = 'pessoa' and ap.aprovador_ref = $${p}) or (ap.aprovador_tipo = 'papel' and ap.aprovador_ref = $${p + 2}) or
      (ap.aprovador_tipo = 'funcao' and ap.aprovador_ref = any($${p + 3}::text[])))))`,
    params: [...e.params, u.papel, u.funcoes],
  }
}

/* ---------- campos editáveis ---------- */
type Tipo = 'texto' | 'longo' | 'enum' | 'int' | 'data' | 'num' | 'bool' | 'lista' | 'perguntas'
interface Spec { campo: string; col: string; tipo: Tipo; max?: number; valores?: readonly string[]; perm?: 'rem' | 'notasRh' | 'gestao'; ref?: 'setor' | 'unidade' | 'cargo' | 'pessoa' }
const S = (campo: string, col: string, tipo: Tipo, extra: Partial<Spec> = {}): Spec => ({ campo, col, tipo, ...extra })
const ESPECIFICACOES: Spec[] = [
  S('titulo', 'titulo', 'texto', { max: 200 }), S('resumo', 'resumo', 'longo', { max: 600 }), S('objetivo', 'objetivo', 'longo', { max: 2000 }),
  S('tipo', 'tipo', 'enum', { valores: TIPOS_VAGA }), S('motivo', 'motivo', 'enum', { valores: MOTIVOS_VAGA }),
  S('qtdPosicoes', 'qtd_posicoes', 'int'), S('prioridade', 'prioridade', 'enum', { valores: PRIORIDADES_VAGA }),
  S('setorId', 'setor_id', 'texto', { ref: 'setor', max: 80 }), S('unidadeId', 'unidade_id', 'texto', { ref: 'unidade', max: 80 }), S('cargoId', 'cargo_id', 'texto', { ref: 'cargo', max: 80 }),
  S('senioridade', 'senioridade', 'texto', { max: 60 }), S('equipe', 'equipe', 'texto', { max: 120 }),
  S('gestorSolicitanteId', 'gestor_solicitante_id', 'texto', { ref: 'pessoa', max: 80 }), S('gestorResponsavelId', 'gestor_responsavel_id', 'texto', { ref: 'pessoa', max: 80 }),
  S('gestorImediatoId', 'gestor_imediato_id', 'texto', { ref: 'pessoa', max: 80 }), S('recrutadorId', 'recrutador_id', 'texto', { ref: 'pessoa', max: 80, perm: 'gestao' }),
  S('pais', 'pais', 'texto', { max: 80 }), S('estado', 'estado', 'texto', { max: 80 }), S('cidade', 'cidade', 'texto', { max: 120 }),
  S('modalidade', 'modalidade', 'enum', { valores: MODALIDADES_VAGA }), S('viagens', 'viagens', 'texto', { max: 300 }),
  S('salarioMin', 'salario_min', 'num', { perm: 'rem' }), S('salarioMax', 'salario_max', 'num', { perm: 'rem' }),
  S('moeda', 'moeda', 'enum', { valores: MOEDAS, perm: 'rem' }), S('tipoRemuneracao', 'tipo_remuneracao', 'enum', { valores: TIPOS_REMUNERACAO, perm: 'rem' }),
  S('beneficios', 'beneficios', 'lista'), S('variavel', 'variavel', 'texto', { max: 300, perm: 'rem' }), S('divulgarSalario', 'divulgar_salario', 'bool', { perm: 'rem' }),
  S('responsabilidades', 'responsabilidades', 'longo', { max: 6000 }), S('atividades', 'atividades', 'longo', { max: 6000 }),
  S('requisitosObrigatorios', 'requisitos_obrigatorios', 'lista'), S('requisitosDesejaveis', 'requisitos_desejaveis', 'lista'),
  S('formacao', 'formacao', 'texto', { max: 600 }), S('experiencia', 'experiencia', 'texto', { max: 600 }),
  S('competenciasTecnicas', 'competencias_tecnicas', 'lista'), S('competenciasComportamentais', 'competencias_comportamentais', 'lista'),
  S('idiomas', 'idiomas', 'lista'), S('certificacoes', 'certificacoes', 'lista'), S('criteriosAvaliacao', 'criterios_avaliacao', 'lista'),
  S('perguntasTriagem', 'perguntas_triagem', 'perguntas'), S('documentosNecessarios', 'documentos_necessarios', 'lista'),
  S('canais', 'canais', 'lista'), S('textoPublico', 'texto_publico', 'longo', { max: 8000 }), S('mensagemConfirmacao', 'mensagem_confirmacao', 'longo', { max: 1000 }),
  S('criteriosEncerramento', 'criterios_encerramento', 'longo', { max: 1000 }),
  S('dataAbertura', 'data_abertura', 'data'), S('prazoPreenchimento', 'prazo_preenchimento', 'data'), S('dataInicioPrevista', 'data_inicio_prevista', 'data'),
  S('publicarEm', 'publicar_em', 'data'), S('encerraCandidaturasEm', 'encerra_candidaturas_em', 'data'),
  S('observacoesRh', 'observacoes_rh', 'longo', { max: 4000, perm: 'notasRh' }),
]
const COLUNAS_JSON = new Set(['beneficios', 'requisitos_obrigatorios', 'requisitos_desejaveis', 'competencias_tecnicas', 'competencias_comportamentais', 'idiomas', 'certificacoes', 'criterios_avaliacao', 'perguntas_triagem', 'documentos_necessarios', 'canais'])
const COLUNAS_COPIA = ESPECIFICACOES.map((e) => e.col).filter((c) => !['titulo', 'data_abertura', 'prazo_preenchimento', 'data_inicio_prevista', 'publicar_em', 'encerra_candidaturas_em'].includes(c))

function normalizarPerguntas(v: unknown): unknown[] {
  return lista<Record<string, unknown>>(v, 20).map((p, i) => {
    const tipo = enumerado(p.tipo, `perguntasTriagem[${i}].tipo`, ['texto', 'sim_nao', 'opcoes'] as const, 'texto')
    const opcoes = tipo === 'opcoes' ? listaTexto(p.opcoes, 12, 120) : undefined
    if (!String(p.texto ?? '').trim()) throw invalido('Informe o texto de todas as perguntas de triagem.', { perguntasTriagem: 'Pergunta sem texto' })
    if (String(p.texto).trim().length > 300) throw invalido('Pergunta de triagem muito longa (máx. 300).', { perguntasTriagem: 'Máx. 300 caracteres' })
    if (tipo === 'opcoes' && (!opcoes || opcoes.length < 2)) throw invalido('Perguntas de múltipla escolha precisam de ao menos duas opções.', { perguntasTriagem: 'Informe as opções' })
    return {
      id: typeof p.id === 'string' && /^[\w-]{3,40}$/.test(p.id) ? p.id : `q${randomBytes(4).toString('hex')}`,
      texto: String(p.texto).trim(), tipo, obrigatoria: !!p.obrigatoria, eliminatoria: !!p.eliminatoria, ...(opcoes ? { opcoes } : {}),
    }
  })
}

interface Lido { valores: Record<string, unknown>; campos: string[] }
function lerCampos(corpo: Record<string, unknown>, u: Usuario, cfg: Awaited<ReturnType<typeof lerConfig>>): Lido {
  const valores: Record<string, unknown> = {}
  const campos: string[] = []
  for (const e of ESPECIFICACOES) {
    if (!Object.prototype.hasOwnProperty.call(corpo, e.campo)) continue
    if (e.perm === 'rem' && !u.caps.has('vagas:ver_remuneracao')) continue
    if (e.perm === 'notasRh' && !u.caps.has('ats:notas_rh')) continue
    if (e.perm === 'gestao' && !u.caps.has('vagas:gerenciar')) continue
    const v = corpo[e.campo]
    let r: unknown
    switch (e.tipo) {
      case 'texto': case 'longo': r = texto(v, e.campo, { obrigatorio: e.campo === 'titulo', max: e.max ?? 2000 }) || null; break
      case 'enum': r = v === null || v === '' || v === undefined ? undefined : enumerado(v, e.campo, e.valores!); break
      case 'int': r = inteiro(v, e.campo, { min: 1, max: 500 }); break
      case 'data': r = dataISO(v, e.campo); break
      case 'num': {
        if (v === null || v === '' || v === undefined) { r = null; break }
        const n = Number(v)
        if (!Number.isFinite(n) || n < 0 || n > 1e9) throw invalido(`${e.campo} inválido.`, { [e.campo]: 'Valor inválido' })
        r = Math.round(n * 100) / 100; break
      }
      case 'bool': r = !!v; break
      case 'lista': r = listaTexto(v, 40, 200); break
      case 'perguntas': r = normalizarPerguntas(v); break
    }
    if (r === undefined) continue
    // Canal removido da configuração depois de marcado na vaga: descarta em vez de travar todo salvamento da vaga.
    if (e.campo === 'canais') r = (r as string[]).filter((c) => cfg.canais.some((x) => x.chave === c))
    if (e.campo === 'tipo' && !cfg.tipos.some((t) => t.chave === r)) throw invalido('Tipo de oportunidade inválido.', { tipo: 'Tipo inválido' })
    valores[e.col] = COLUNAS_JSON.has(e.col) ? JSON.stringify(r) : r
    campos.push(e.campo)
  }
  return { valores, campos }
}

function validarRefs(l: Lido, org: Org, u: Usuario) {
  for (const e of ESPECIFICACOES) {
    const v = l.valores[e.col]
    if (!e.ref || !v) continue
    const id = String(v)
    const existe = e.ref === 'setor' ? org.setor.has(id) : e.ref === 'unidade' ? org.unidade.has(id) : e.ref === 'cargo' ? org.cargo.has(id) : org.pessoa.has(id) && org.pessoa.get(id)!.status !== 'encerrado'
    if (!existe) throw invalido(`${e.campo}: registro não encontrado no cadastro.`, { [e.campo]: 'Selecione um item do cadastro' })
    if (e.campo === 'setorId' && !qualquerArea(u) && !u.setoresLiderados.includes(id)) throw proibido('Você só pode abrir vagas para áreas que lidera.')
  }
}

/* ---------- serialização ---------- */
const CAMPOS_REMUNERACAO = ['salarioMin', 'salarioMax', 'variavel']
function serializar(row: Record<string, any>, u: Usuario, org: Org) {
  const o = camel(row) as Record<string, any>
  for (const k of ['nCand', 'nAtivas', 'nContr', 'ultima']) delete o[k]
  for (const k of ['dataAbertura', 'prazoPreenchimento', 'dataInicioPrevista', 'publicarEm', 'encerraCandidaturasEm']) o[k] = dataStr(o[k])
  if (!u.caps.has('vagas:ver_remuneracao')) for (const k of CAMPOS_REMUNERACAO) delete o[k]
  if (!u.caps.has('ats:notas_rh')) delete o.observacoesRh
  const hoje = hojeISO()
  return {
    ...o,
    temImagem: !!row.imagem_arquivo_id,
    setorNome: org.setor.get(row.setor_id) ?? null, unidadeNome: org.unidade.get(row.unidade_id) ?? null, cargoNome: org.cargo.get(row.cargo_id)?.nome ?? null,
    gestorSolicitanteNome: nomeDe(org.pessoa, row.gestor_solicitante_id), gestorResponsavelNome: nomeDe(org.pessoa, row.gestor_responsavel_id),
    gestorImediatoNome: nomeDe(org.pessoa, row.gestor_imediato_id), recrutadorNome: nomeDe(org.pessoa, row.recrutador_id), criadoPorNome: nomeDe(org.pessoa, row.criado_por),
    // dataStr: o driver pg devolve colunas `date` como Date, e situacaoPrazo compara texto AAAA-MM-DD.
    situacaoPrazo: situacaoPrazo({ status: row.status, prazoPreenchimento: dataStr(row.prazo_preenchimento), qtdPosicoes: row.qtd_posicoes, posicoesPreenchidas: row.posicoes_preenchidas }, hoje),
    ...(row.n_cand !== undefined ? { candidaturas: { total: row.n_cand, ativas: row.n_ativas, contratadas: row.n_contr } } : {}),
  }
}

function descreverAprovador(tipo: string, ref: string, org: Org): string {
  if (tipo === 'pessoa') return org.pessoa.get(ref)?.nome ?? 'Pessoa removida'
  if (tipo === 'papel') return PAPEL_LABEL[ref as Papel] ?? ref
  return FUNCAO_LABEL[ref as keyof typeof FUNCAO_LABEL] ?? ref
}

async function resolverAprovadores(ex: Executor, tipo: string, ref: string): Promise<string[]> {
  if (tipo === 'pessoa') return [ref]
  if (tipo === 'papel') return idsComPapel(ex, ref as Papel)
  return idsComFuncao(ex, ref as keyof typeof FUNCAO_LABEL)
}

/* ---------- carregamento com escopo ---------- */
async function carregar(ex: Executor, u: Usuario, id: string, travar = false): Promise<Record<string, any>> {
  if (!uuid(id)) throw naoEncontrado('Vaga não encontrada.')
  const e = escopo(u, 'v', 2)
  const r = await ex.query(`select v.* from rec_vagas v where v.id = $1 and ${e.sql} ${travar ? 'for update of v' : ''}`, [id, ...e.params])
  if (!r.rows[0]) throw naoEncontrado('Vaga não encontrada.')
  return r.rows[0]
}

async function evento(ex: Executor, vagaId: string, quem: string | null, tipo: string, extra: { de?: string; para?: string; detalhes?: Record<string, unknown> } = {}) {
  await ex.query('insert into rec_vaga_eventos (vaga_id, colaborador_id, tipo, de_status, para_status, detalhes) values ($1,$2,$3,$4,$5,$6::jsonb)',
    [vagaId, quem, tipo, extra.de ?? null, extra.para ?? null, JSON.stringify(extra.detalhes ?? {})])
}

const ehSolicitante = (v: Record<string, any>, u: Usuario) => v.criado_por === u.colaboradorId || v.gestor_solicitante_id === u.colaboradorId

interface Permissoes { editar: boolean; solicitar: boolean; acoes: AcaoVaga[]; arquivar: boolean; desarquivar: boolean; duplicar: boolean; decidir: string[]; gerenciar: boolean; verRemuneracao: boolean; verObservacoesRh: boolean; anexar: boolean }
function permissoes(v: Record<string, any>, u: Usuario, passos: any[]): Permissoes {
  const gestao = u.caps.has('vagas:gerenciar')
  const sol = ehSolicitante(v, u) && (u.caps.has('vagas:solicitar') || gestao)
  const st = v.status as StatusVaga
  const q = quemEdita(st)
  const editar = q === 'solicitante' ? gestao || sol : q === 'gestao' ? gestao : false
  const atual = st === 'em_aprovacao' ? passoAtual(passos.filter((p) => p.rodada === Math.max(...passos.map((x) => x.rodada)))) : null
  const dec = atual && podeDecidirPasso({ aprovadorTipo: atual.aprovador_tipo, aprovadorRef: atual.aprovador_ref }, u) ? [atual.id as string] : []
  const acoes = acoesPossiveis(st).filter((a) => {
    if (a === 'solicitar') return gestao || sol
    if (a === 'cancelar') return gestao || (sol && ['rascunho', 'em_aprovacao', 'ajustes'].includes(st))
    return gestao
  })
  return { editar, solicitar: acoes.includes('solicitar'), acoes, arquivar: gestao && STATUS_FINAIS.includes(st) && !v.arquivada, desarquivar: gestao && v.arquivada, duplicar: gestao || u.caps.has('vagas:solicitar'), decidir: dec, gerenciar: gestao, verRemuneracao: u.caps.has('vagas:ver_remuneracao'), verObservacoesRh: u.caps.has('ats:notas_rh'), anexar: editar }
}

/* ---------- filtros (lista, CSV, painel) ---------- */
function csvLista(s: string | undefined): string[] { return (s ?? '').split(',').map((x) => x.trim()).filter(Boolean) }
function filtrosVagas(q: Record<string, string>, u: Usuario, hoje: string, painel = false) {
  const e = escopo(u, 'v', 1)
  const params: unknown[] = [...e.params]
  const w: string[] = [e.sql]
  const add = (sql: string, ...vals: unknown[]) => { const base = params.length; params.push(...vals); w.push(sql.replace(/\$(\d+)/g, (_, n) => `$${base + Number(n)}`)) }
  const st = csvLista(q.status).filter((s) => (STATUS_VAGA as readonly string[]).includes(s))
  if (st.length) add('v.status = any($1::text[])', st)
  if (q.setor) add('v.setor_id = $1', q.setor)
  if (q.unidade) add('v.unidade_id = $1', q.unidade)
  if (q.cargo) add('v.cargo_id = $1', q.cargo)
  if (q.recrutador) add('v.recrutador_id = $1', q.recrutador)
  if (q.gestor) add('(v.gestor_solicitante_id = $1 or v.gestor_responsavel_id = $1 or v.gestor_imediato_id = $1)', q.gestor)
  if (q.modalidade) add('v.modalidade = $1', q.modalidade)
  if (q.prioridade) add('v.prioridade = $1', q.prioridade)
  if (q.tipo) add('v.tipo = $1', q.tipo)
  if (q.de && /^\d{4}-\d{2}-\d{2}$/.test(q.de)) add('v.data_abertura >= $1::date', q.de)
  if (q.ate && /^\d{4}-\d{2}-\d{2}$/.test(q.ate)) add('v.data_abertura <= $1::date', q.ate)
  if (!painel && q.q) add(`(v.titulo ilike $1 or v.codigo ilike $1 or coalesce(v.cidade,'') ilike $1 or coalesce(v.equipe,'') ilike $1)`, `%${q.q.replace(/[%_\\]/g, '')}%`)
  if (q.prazo === 'vencida') add(`v.status in ('aprovada','publicada','pausada') and v.prazo_preenchimento < $1::date and v.posicoes_preenchidas < v.qtd_posicoes`, hoje)
  if (q.prazo === 'proxima') add(`v.status in ('aprovada','publicada','pausada') and v.prazo_preenchimento between $1::date and ($1::date + 7) and v.posicoes_preenchidas < v.qtd_posicoes`, hoje)
  if (q.criticas === '1') add(`v.prioridade = 'critica' and v.status = any($1::text[])`, STATUS_ATIVOS)
  if (q.arquivadas === '1') w.push('v.arquivada') ; else if (q.arquivadas !== 'todas') w.push('not v.arquivada')
  return { where: w.join(' and '), params }
}

const ORDENS: Record<string, string> = {
  recentes: 'v.atualizado_em desc', prazo: 'v.prazo_preenchimento asc nulls last, v.atualizado_em desc', titulo: 'v.titulo asc',
  abertura: 'v.data_abertura desc, v.criado_em desc', candidaturas: 'n_cand desc, v.atualizado_em desc',
}
const SELECT_LISTA = `v.*, (select count(*)::int from rec_candidaturas c where c.vaga_id = v.id) as n_cand,
  (select count(*)::int from rec_candidaturas c where c.vaga_id = v.id and c.status = 'ativa') as n_ativas,
  (select count(*)::int from rec_candidaturas c where c.vaga_id = v.id and c.status = 'contratado') as n_contr`

/* ---------- criação ---------- */
async function gerarCodigoESlug(ex: Executor, titulo: string, agora: Date) {
  const n = (await ex.query("select nextval('rec_vaga_seq')::int as n")).rows[0].n as number
  const codigo = `VAG-${agora.getUTCFullYear()}-${String(n).padStart(4, '0')}`
  for (let i = 0; i < 5; i++) {
    const slug = `${slugificar(titulo)}-${randomBytes(3).toString('hex')}`
    if (!(await ex.query('select 1 from rec_vagas where slug = $1', [slug])).rowCount) return { codigo, slug }
  }
  return { codigo, slug: `${slugificar(titulo)}-${randomBytes(6).toString('hex')}` }
}

async function criarEtapas(ex: Executor, vagaId: string, etapas: { nome: string; tipo: string }[]) {
  for (let i = 0; i < etapas.length; i++) await ex.query('insert into rec_vaga_etapas (vaga_id, ordem, nome, tipo) values ($1,$2,$3,$4)', [vagaId, i + 1, etapas[i].nome, etapas[i].tipo])
}

async function inserirVaga(ex: Executor, valores: Record<string, unknown>, ids: { codigo: string; slug: string; criadoPor: string }): Promise<string> {
  const cols = ['codigo', 'slug', 'criado_por', 'atualizado_por', ...Object.keys(valores)]
  const vals = [ids.codigo, ids.slug, ids.criadoPor, ids.criadoPor, ...Object.values(valores)]
  const ph = cols.map((c, i) => (COLUNAS_JSON.has(c) ? `$${i + 1}::jsonb` : `$${i + 1}`))
  return (await ex.query(`insert into rec_vagas (${cols.join(', ')}) values (${ph.join(', ')}) returning id`, vals)).rows[0].id
}

/* ---------- notificações ---------- */
function envolvidos(v: Record<string, any>, excluir?: string): string[] {
  return [...new Set([v.gestor_solicitante_id, v.criado_por, v.recrutador_id, v.gestor_responsavel_id].filter((x): x is string => !!x && x !== excluir))]
}
async function avisar(ex: Executor, dests: string[], tipo: string, titulo: string, vagaId: string, chave: string, corpo?: string) {
  for (const d of dests) await notificar(ex, { destinatarioId: d, tipo, titulo, corpo, link: linkVaga(vagaId), chave: `${chave}:${d}` })
}
const rotuloVaga = (v: Record<string, any>) => `${v.codigo} · ${v.titulo}`

/* ---------- transições ---------- */
async function abrirRodada(t: Executor, v: Record<string, any>, u: Usuario | null, hoje: string): Promise<{ aprovadaDireto: boolean }> {
  const cfg = await lerConfig(t)
  const fluxo = escolherFluxo(cfg.fluxos, { tipo: v.tipo, prioridade: v.prioridade, motivo: v.motivo, salarioMax: v.salario_max === null ? null : Number(v.salario_max) })
  const rodada = ((await t.query('select coalesce(max(rodada),0)::int as r from rec_vaga_aprovacoes where vaga_id = $1', [v.id])).rows[0].r as number) + 1
  await t.query("update rec_vaga_aprovacoes set status = 'cancelada' where vaga_id = $1 and status = 'pendente'", [v.id])
  const passos = fluxo.passos as PassoFluxo[]
  if (passos.length === 0) {
    await t.query("update rec_vagas set status = 'aprovada', aprovada_em = now(), solicitada_em = now(), fluxo_chave = $2, versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1", [v.id, fluxo.chave, u?.colaboradorId ?? null])
    await evento(t, v.id, u?.colaboradorId ?? null, 'aprovada_automaticamente', { de: v.status, para: 'aprovada', detalhes: { fluxo: fluxo.chave } })
    return { aprovadaDireto: true }
  }
  for (let i = 0; i < passos.length; i++) {
    const p = passos[i]
    await t.query('insert into rec_vaga_aprovacoes (vaga_id, rodada, ordem, rotulo, aprovador_tipo, aprovador_ref, prazo) values ($1,$2,$3,$4,$5,$6,$7)',
      [v.id, rodada, i + 1, p.rotulo, p.tipo, p.ref, p.prazoDias ? somarDias(hoje, p.prazoDias) : null])
  }
  await t.query("update rec_vagas set status = 'em_aprovacao', solicitada_em = now(), fluxo_chave = $2, versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1", [v.id, fluxo.chave, u?.colaboradorId ?? null])
  await evento(t, v.id, u?.colaboradorId ?? null, 'aprovacao_solicitada', { de: v.status, para: 'em_aprovacao', detalhes: { fluxo: fluxo.chave, rodada } })
  const primeiro = passos[0]
  const dests = (await resolverAprovadores(t, primeiro.tipo, primeiro.ref)).filter((d) => d !== u?.colaboradorId)
  await avisar(t, dests, 'vaga_aprovacao', 'Vaga aguardando sua aprovação', v.id, `vaga:${v.id}:r${rodada}:p1`, rotuloVaga(v))
  return { aprovadaDireto: false }
}

function estadoParaPublicar(v: Record<string, any>, hoje: string) {
  return camposFaltantes({
    titulo: v.titulo, setorId: v.setor_id, qtdPosicoes: v.qtd_posicoes, responsabilidades: v.responsabilidades, resumo: v.resumo, modalidade: v.modalidade,
    cidade: v.cidade, estado: v.estado, textoPublico: v.texto_publico, canais: v.canais, encerraCandidaturasEm: dataStr(v.encerra_candidaturas_em),
  }, 'publicar', hoje)
}
const dataStr = (d: unknown) => (d instanceof Date ? d.toISOString().slice(0, 10) : d ? String(d).slice(0, 10) : null)

async function executarAcao(c: Ctx, acao: AcaoVaga, corpo: Record<string, unknown>): Promise<Record<string, any>> {
  const { db, usuario: u } = c
  const hoje = hojeISO(c.agora)
  return db.tx(async (t) => {
    const v = await carregar(t, u, c.params.id, true)
    const de = v.status as StatusVaga
    const para = proximoStatus(de, acao)
    if (!para) throw conflito(`Não é possível "${acao}" uma vaga no estado "${de}".`)
    const gestao = u.caps.has('vagas:gerenciar')
    const sol = ehSolicitante(v, u) && (u.caps.has('vagas:solicitar') || gestao)
    if (acao === 'solicitar') { if (!gestao && !sol) throw proibido() }
    else if (acao === 'cancelar') { if (!gestao && !(sol && ['rascunho', 'em_aprovacao', 'ajustes'].includes(de))) throw proibido() }
    else if (!gestao) throw proibido()

    const motivo = acao === 'encerrar' || acao === 'cancelar' ? texto(corpo.motivo, 'motivo', { min: 3, max: 500 }) : corpo.motivo ? texto(corpo.motivo, 'motivo', { max: 500 }) : null

    if (acao === 'solicitar') {
      const falta = camposFaltantes({ titulo: v.titulo, setorId: v.setor_id, qtdPosicoes: v.qtd_posicoes, responsabilidades: v.responsabilidades, resumo: v.resumo, modalidade: v.modalidade }, 'solicitar', hoje)
      if (Object.keys(falta).length) throw invalido('Complete os campos obrigatórios antes de solicitar a aprovação.', falta)
      const { aprovadaDireto } = await abrirRodada(t, v, u, hoje)
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'solicitar_aprovacao', { codigo: v.codigo })
      if (aprovadaDireto) await avisar(t, envolvidos(v, u.colaboradorId), 'vaga_aprovada', 'Vaga aprovada', v.id, `vaga:${v.id}:aprovada`, rotuloVaga(v))
    } else if (acao === 'publicar') {
      const falta = estadoParaPublicar(v, hoje)
      if (Object.keys(falta).length) throw invalido('Complete os campos para publicar a vaga.', falta)
      const nEtapas = (await t.query('select count(*)::int as n from rec_vaga_etapas where vaga_id = $1', [v.id])).rows[0].n
      if (nEtapas < 2) throw invalido('A vaga precisa ter etapas seletivas configuradas.', { etapas: 'Configure as etapas' })
      await t.query("update rec_vagas set status = 'publicada', publicada_em = coalesce(publicada_em, now()), versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1", [v.id, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'publicada', { de, para })
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'publicar', { codigo: v.codigo })
      await avisar(t, envolvidos(v, u.colaboradorId), 'vaga_publicada', 'Vaga publicada', v.id, `vaga:${v.id}:publicada`, rotuloVaga(v))
    } else if (acao === 'retomar') {
      const venc = v.encerra_candidaturas_em ? dataStr(v.encerra_candidaturas_em)! : null
      if (venc && venc < hoje) throw invalido('O prazo de candidaturas já passou. Ajuste a data de encerramento antes de retomar.', { encerraCandidaturasEm: 'Data já passou' })
      await t.query("update rec_vagas set status = 'publicada', versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1", [v.id, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'retomada', { de, para })
    } else if (acao === 'pausar') {
      await t.query("update rec_vagas set status = 'pausada', versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1", [v.id, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'pausada', { de, para, detalhes: motivo ? { motivo } : {} })
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'pausar', { codigo: v.codigo })
    } else if (acao === 'encerrar') {
      await t.query("update rec_vagas set status = 'encerrada', encerrada_em = now(), motivo_encerramento = $2, versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1", [v.id, motivo, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'encerrada', { de, para, detalhes: { motivo } })
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'encerrar', { codigo: v.codigo })
      await avisar(t, envolvidos(v, u.colaboradorId), 'vaga_encerrada', 'Vaga encerrada', v.id, `vaga:${v.id}:encerrada`, rotuloVaga(v))
    } else if (acao === 'cancelar') {
      await t.query("update rec_vaga_aprovacoes set status = 'cancelada' where vaga_id = $1 and status = 'pendente'", [v.id])
      await t.query("update rec_vagas set status = 'cancelada', encerrada_em = now(), motivo_encerramento = $2, versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1", [v.id, motivo, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'cancelada', { de, para, detalhes: { motivo } })
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'cancelar', { codigo: v.codigo })
      await avisar(t, envolvidos(v, u.colaboradorId), 'vaga_cancelada', 'Vaga cancelada', v.id, `vaga:${v.id}:cancelada`, rotuloVaga(v))
    } else if (acao === 'reabrir') {
      await t.query(`update rec_vagas set status = $2, encerrada_em = null, motivo_encerramento = null, ${para === 'rascunho' ? 'aprovada_em = null, solicitada_em = null,' : ''} versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1`, [v.id, para, u.colaboradorId])
      await evento(t, v.id, u.colaboradorId, 'reaberta', { de, para })
      await auditar(t, u.colaboradorId, 'vaga', v.id, 'reabrir', { codigo: v.codigo })
    }
    return (await t.query('select * from rec_vagas where id = $1', [v.id])).rows[0]
  })
}

/* ---------- decisões de aprovação ---------- */
async function decidirPasso(c: Ctx): Promise<Res> {
  const { db, usuario: u, req } = c
  const decisao = enumerado(req.corpo?.decisao, 'decisão', ['aprovar', 'rejeitar', 'ajustes', 'devolver'] as const)
  const justificativa = decisao === 'aprovar' ? (req.corpo?.justificativa ? texto(req.corpo.justificativa, 'justificativa', { max: 1000 }) : null) : texto(req.corpo?.justificativa, 'justificativa', { min: 5, max: 1000 })
  const hoje = hojeISO(c.agora)
  const r = await db.tx(async (t) => {
    const v = await carregar(t, u, c.params.id, true)
    if (v.status !== 'em_aprovacao') throw conflito('Esta vaga não está em aprovação.')
    const passos = (await t.query('select * from rec_vaga_aprovacoes where vaga_id = $1 and rodada = (select max(rodada) from rec_vaga_aprovacoes where vaga_id = $1) order by ordem', [v.id])).rows
    const atual = passoAtual(passos)
    if (!atual || atual.id !== c.params.passoId) throw conflito('Este passo não está aguardando decisão (as aprovações seguem a ordem).')
    if (!podeDecidirPasso({ aprovadorTipo: atual.aprovador_tipo, aprovadorRef: atual.aprovador_ref }, u)) throw proibido('Você não é o aprovador designado para este passo.')
    const st = decisao === 'aprovar' ? 'aprovada' : decisao === 'rejeitar' ? 'rejeitada' : 'ajustes'
    await t.query('update rec_vaga_aprovacoes set status = $2, decidido_por = $3, decidido_em = now(), justificativa = $4 where id = $1', [atual.id, st, u.colaboradorId, justificativa])
    await auditar(t, u.colaboradorId, 'vaga', v.id, `aprovacao_${decisao}`, { codigo: v.codigo, passo: atual.rotulo })
    const solicitantes = envolvidos(v, u.colaboradorId)
    if (decisao === 'aprovar') {
      const prox = passoAtual(passos.filter((p) => p.id !== atual.id))
      await evento(t, v.id, u.colaboradorId, 'passo_aprovado', { detalhes: { passo: atual.rotulo } })
      if (prox) {
        const dests = (await resolverAprovadores(t, prox.aprovador_tipo, prox.aprovador_ref)).filter((d) => d !== u.colaboradorId)
        await avisar(t, dests, 'vaga_aprovacao', 'Vaga aguardando sua aprovação', v.id, `vaga:${v.id}:r${atual.rodada}:p${prox.ordem}`, rotuloVaga(v))
      } else {
        await t.query("update rec_vagas set status = 'aprovada', aprovada_em = now(), versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1", [v.id, u.colaboradorId])
        await evento(t, v.id, u.colaboradorId, 'aprovada', { de: 'em_aprovacao', para: 'aprovada' })
        await avisar(t, solicitantes, 'vaga_aprovada', 'Vaga aprovada', v.id, `vaga:${v.id}:aprovada:r${atual.rodada}`, rotuloVaga(v))
      }
    } else {
      await t.query("update rec_vaga_aprovacoes set status = 'cancelada' where vaga_id = $1 and rodada = $2 and status = 'pendente'", [v.id, atual.rodada])
      if (decisao === 'rejeitar') {
        await t.query("update rec_vagas set status = 'cancelada', encerrada_em = now(), motivo_encerramento = $2, versao = versao + 1, atualizado_em = now(), atualizado_por = $3 where id = $1", [v.id, `Rejeitada: ${justificativa}`, u.colaboradorId])
        await evento(t, v.id, u.colaboradorId, 'rejeitada', { de: 'em_aprovacao', para: 'cancelada', detalhes: { passo: atual.rotulo } })
        await avisar(t, solicitantes, 'vaga_rejeitada', 'Solicitação de vaga rejeitada', v.id, `vaga:${v.id}:rejeitada:r${atual.rodada}`, rotuloVaga(v))
      } else {
        await t.query("update rec_vagas set status = 'ajustes', versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1", [v.id, u.colaboradorId])
        await evento(t, v.id, u.colaboradorId, decisao === 'devolver' ? 'devolvida' : 'ajustes_solicitados', { de: 'em_aprovacao', para: 'ajustes', detalhes: { passo: atual.rotulo } })
        await avisar(t, solicitantes, 'vaga_ajustes', 'Solicitação devolvida para ajustes', v.id, `vaga:${v.id}:ajustes:r${atual.rodada}`, rotuloVaga(v))
      }
    }
    return (await t.query('select * from rec_vagas where id = $1', [v.id])).rows[0]
  })
  void hoje
  return ok({ status: r.status })
}

/* ---------- detalhe ---------- */
async function montarDetalhe(ex: Executor, u: Usuario, id: string): Promise<Record<string, any>> {
  const row = await carregar(ex, u, id)
  const org = await carregarOrg(ex)
  const [etapas, aprov, evs, coms, anex, cont] = await Promise.all([
    ex.query('select e.id, e.ordem, e.nome, e.tipo, (select count(*)::int from rec_candidaturas c where c.etapa_id = e.id and c.status = $2) as ativas from rec_vaga_etapas e where e.vaga_id = $1 order by e.ordem', [id, 'ativa']),
    ex.query('select * from rec_vaga_aprovacoes where vaga_id = $1 order by rodada, ordem', [id]),
    ex.query('select id, em, colaborador_id, tipo, de_status, para_status, detalhes from rec_vaga_eventos where vaga_id = $1 order by em desc, id desc limit 200', [id]),
    ex.query('select id, autor_id, texto, criado_em from rec_vaga_comentarios where vaga_id = $1 order by criado_em', [id]),
    ex.query("select id, nome, mime, tamanho, criado_por, criado_em from arq_arquivos where dono_tipo = 'vaga' and dono_id = $1 order by criado_em", [id]),
    ex.query("select count(*)::int as total, count(*) filter (where status = 'ativa')::int as ativas, count(*) filter (where status = 'contratado')::int as contratadas from rec_candidaturas where vaga_id = $1", [id]),
  ])
  const hoje = hojeISO()
  const passos = aprov.rows.map((p) => ({
    id: p.id, rodada: p.rodada, ordem: p.ordem, rotulo: p.rotulo, aprovadorTipo: p.aprovador_tipo, aprovadorRef: p.aprovador_ref,
    aprovadorNome: descreverAprovador(p.aprovador_tipo, p.aprovador_ref, org), status: p.status, decididoPor: p.decidido_por, decididoPorNome: nomeDe(org.pessoa, p.decidido_por),
    decididoEm: p.decidido_em, justificativa: p.justificativa, prazo: dataStr(p.prazo), atrasado: p.status === 'pendente' && !!p.prazo && dataStr(p.prazo)! < hoje,
  }))
  const semRem = !u.caps.has('vagas:ver_remuneracao'), semNotas = !u.caps.has('ats:notas_rh')
  const eventos = evs.rows.map((e) => {
    let det = (e.detalhes ?? {}) as Record<string, any>
    if (Array.isArray(det.campos)) det = { ...det, campos: det.campos.filter((c: string) => !(semRem && CAMPOS_REMUNERACAO.concat(['moeda', 'tipoRemuneracao', 'divulgarSalario']).includes(c)) && !(semNotas && c === 'observacoesRh')) }
    return { id: Number(e.id), em: e.em, tipo: e.tipo, deStatus: e.de_status, paraStatus: e.para_status, detalhes: det, autorId: e.colaborador_id, autorNome: nomeDe(org.pessoa, e.colaborador_id) }
  })
  return {
    vaga: serializar({ ...row, n_cand: cont.rows[0].total, n_ativas: cont.rows[0].ativas, n_contr: cont.rows[0].contratadas }, u, org),
    etapas: etapas.rows.map((e) => ({ id: e.id, ordem: e.ordem, nome: e.nome, tipo: e.tipo, ativas: e.ativas })),
    aprovacoes: passos,
    eventos,
    comentarios: coms.rows.map((c) => ({ id: c.id, autorId: c.autor_id, autorNome: nomeDe(org.pessoa, c.autor_id), texto: c.texto, criadoEm: c.criado_em })),
    anexos: anex.rows.map((a) => ({ id: a.id, nome: a.nome, mime: a.mime, tamanho: a.tamanho, criadoPorNome: nomeDe(org.pessoa, a.criado_por), criadoEm: a.criado_em })),
    contagens: cont.rows[0],
    permissoes: permissoes(row, u, aprov.rows),
  }
}

/* ---------- alertas ---------- */
export interface Alerta { tipo: string; severidade: 'danger' | 'warning' | 'info'; vagaId: string; codigo: string; titulo: string; mensagem: string; link: string; destinatarios: string[]; chave: string }
async function calcularAlertas(ex: Executor, escopoSql: string, params: unknown[], hoje: string): Promise<Alerta[]> {
  const rows = (await ex.query(`select v.id, v.codigo, v.titulo, v.status, v.prazo_preenchimento, v.encerra_candidaturas_em, v.qtd_posicoes, v.posicoes_preenchidas, v.recrutador_id,
      v.gestor_solicitante_id, v.gestor_responsavel_id, v.criado_por,
      greatest(v.atualizado_em, coalesce((select max(e.em) from rec_vaga_eventos e where e.vaga_id = v.id), v.atualizado_em),
        coalesce((select max(c.criado_em) from rec_candidaturas c where c.vaga_id = v.id), v.atualizado_em),
        coalesce((select max(m.em) from rec_candidatura_movs m join rec_candidaturas c2 on c2.id = m.candidatura_id where c2.vaga_id = v.id), v.atualizado_em)) as ultima
    from rec_vagas v where not v.arquivada and v.status = any($${params.length + 1}::text[]) and ${escopoSql}`, [...params, STATUS_ATIVOS])).rows
  const out: Alerta[] = []
  const semana = Math.floor(Date.parse(hoje) / (7 * 86400000))
  for (const v of rows) {
    const dests = envolvidos(v)
    const base = { vagaId: v.id as string, codigo: v.codigo as string, titulo: v.titulo as string, link: linkVaga(v.id), destinatarios: dests }
    const prazo = dataStr(v.prazo_preenchimento)
    const sp = situacaoPrazo({ status: v.status, prazoPreenchimento: prazo, qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas }, hoje)
    if (sp === 'vencida') out.push({ ...base, tipo: 'prazo_vencido', severidade: 'danger', mensagem: `O prazo de preenchimento (${prazo}) já passou.`, chave: `alerta:vencida:${v.id}:${prazo}` })
    if (sp === 'proxima') out.push({ ...base, tipo: 'prazo_proximo', severidade: 'warning', mensagem: `O prazo de preenchimento vence em ${prazo}.`, chave: `alerta:proxima:${v.id}:${prazo}` })
    if (semMovimentacao({ status: v.status }, v.ultima instanceof Date ? v.ultima.toISOString() : String(v.ultima), hoje)) out.push({ ...base, tipo: 'sem_movimentacao', severidade: 'warning', mensagem: 'Vaga publicada sem movimentação há 14 dias ou mais.', chave: `alerta:semmov:${v.id}:${semana}` })
    const enc = dataStr(v.encerra_candidaturas_em)
    if (v.status === 'publicada' && enc && enc < hoje) out.push({ ...base, tipo: 'candidaturas_encerradas', severidade: 'info', mensagem: `O prazo de candidaturas terminou em ${enc}. Encerre a vaga ou prorrogue a data.`, chave: `alerta:candenc:${v.id}:${enc}` })
    if (v.status === 'ajustes') out.push({ ...base, tipo: 'ajustes_pendentes', severidade: 'info', mensagem: 'A solicitação foi devolvida e aguarda ajustes.', chave: `alerta:ajustes:${v.id}:${semana}`, destinatarios: [v.gestor_solicitante_id, v.criado_por].filter(Boolean) })
  }
  const ids = rows.filter((v) => v.status === 'em_aprovacao').map((v) => v.id as string)
  if (ids.length) {
    const atras = (await ex.query("select ap.id, ap.vaga_id, ap.rotulo, ap.aprovador_tipo, ap.aprovador_ref, ap.prazo from rec_vaga_aprovacoes ap where ap.vaga_id = any($1::uuid[]) and ap.status = 'pendente' and ap.prazo < $2::date", [ids, hoje])).rows
    for (const p of atras) {
      const v = rows.find((x) => x.id === p.vaga_id)!
      out.push({ vagaId: v.id, codigo: v.codigo, titulo: v.titulo, link: linkVaga(v.id), tipo: 'aprovacao_atrasada', severidade: 'danger', mensagem: `Aprovação "${p.rotulo}" atrasada (prazo ${dataStr(p.prazo)}).`, destinatarios: await resolverAprovadores(ex, p.aprovador_tipo, p.aprovador_ref), chave: `alerta:aprovatraso:${p.id}` })
    }
  }
  return out
}

/* ---------- painel ---------- */
const ORDEM_TIPOS = TIPOS_ETAPA as readonly string[]
async function montarPainel(c: Ctx): Promise<Record<string, unknown>> {
  const { db, usuario: u, req } = c
  const hoje = hojeISO(c.agora)
  const f = filtrosVagas(req.query, u, hoje, true)
  const org = await carregarOrg(db)
  const vagas = (await db.query(`select v.id, v.codigo, v.titulo, v.status, v.prioridade, v.qtd_posicoes, v.posicoes_preenchidas, v.publicada_em, v.primeira_candidatura_em, v.prazo_preenchimento, v.encerrada_em,
      v.setor_id, v.unidade_id, v.recrutador_id, v.gestor_solicitante_id, v.gestor_responsavel_id, v.data_abertura from rec_vagas v where ${f.where}`, f.params)).rows
  const ids = vagas.map((v) => v.id as string)
  const cands = ids.length ? (await db.query('select id, vaga_id, status, origem, etapa_id, criado_em, coalesce(encerrada_em, atualizado_em) as fim from rec_candidaturas where vaga_id = any($1::uuid[])', [ids])).rows : []
  const etapas = ids.length ? (await db.query('select id, nome, tipo from rec_vaga_etapas where vaga_id = any($1::uuid[])', [ids])).rows : []
  const movs = cands.length ? (await db.query('select m.candidatura_id, m.em, m.para_etapa_id from rec_candidatura_movs m where m.candidatura_id = any($1::uuid[])', [cands.map((x) => x.id)])).rows : []
  const etapaPorId = new Map(etapas.map((e) => [e.id as string, e as { nome: string; tipo: string }]))
  const iso = (d: unknown) => (d instanceof Date ? d.toISOString() : d ? String(d) : null)

  const indic = (v: any): VagaIndicador => ({ id: v.id, status: v.status, qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas, publicadaEm: iso(v.publicada_em), primeiraCandidaturaEm: iso(v.primeira_candidatura_em), prazoPreenchimento: dataStr(v.prazo_preenchimento), encerradaEm: iso(v.encerrada_em) })
  const contratacoes: ContratacaoIndicador[] = cands.filter((x) => x.status === 'contratado').map((x) => ({ vagaId: x.vaga_id, em: iso(x.fim)! }))
  const cont = (st: string[]) => vagas.filter((v) => st.includes(v.status)).length
  const ativas = vagas.filter((v) => STATUS_ATIVOS.includes(v.status))
  const candsAtivasPorVaga = new Map<string, number>()
  for (const x of cands) if (x.status === 'ativa') candsAtivasPorVaga.set(x.vaga_id, (candsAtivasPorVaga.get(x.vaga_id) ?? 0) + 1)
  const prazoDe = (v: any) => situacaoPrazo({ status: v.status, prazoPreenchimento: dataStr(v.prazo_preenchimento), qtdPosicoes: v.qtd_posicoes, posicoesPreenchidas: v.posicoes_preenchidas }, hoje)

  const tpFecha = vagas.map((v) => tempoPreenchimentoDias(indic(v), contratacoes)).filter((x): x is number => x !== null)
  const tpPrim = vagas.map((v) => tempoAtePrimeiraCandidaturaDias(indic(v))).filter((x): x is number => x !== null)
  const rotuloEtapa = (id: string) => { const e = etapaPorId.get(id); return e ? (e.tipo === 'generica' ? e.nome : ROTULO_ETAPA[e.tipo as TipoEtapa] ?? e.nome) : null }
  const porEtapa = tempoPorEtapa(movs.map((m) => ({ candidaturaId: m.candidatura_id, em: iso(m.em)!, paraEtapaId: m.para_etapa_id })), rotuloEtapa)
  // Une etapas de vagas diferentes que têm o mesmo rótulo (média ponderada por n)
  const juntas = new Map<string, { soma: number; n: number }>()
  for (const t of porEtapa) { const a = juntas.get(t.etapa) ?? { soma: 0, n: 0 }; a.soma += t.dias * t.n; a.n += t.n; juntas.set(t.etapa, a) }
  const tempoEtapas = [...juntas.entries()].map(([etapa, a]) => ({ etapa, dias: Math.round((a.soma / a.n) * 10) / 10, n: a.n }))
  const alcance = new Map<string, Set<string>>()
  for (const x of cands) alcance.set(x.id, new Set(['nova']))
  for (const m of movs) { const e = m.para_etapa_id ? etapaPorId.get(m.para_etapa_id) : null; if (e) alcance.get(m.candidatura_id)?.add(e.tipo) }
  for (const x of cands) { const e = x.etapa_id ? etapaPorId.get(x.etapa_id) : null; if (e) alcance.get(x.id)?.add(e.tipo); if (x.status === 'contratado') alcance.get(x.id)?.add('contratado') }
  const funil = funilPorTipo([...alcance.values()].map((s) => ({ tiposAlcancados: [...s] })))
  const noPrazoLista = vagas.map((v) => vagaNoPrazo(indic(v), contratacoes, hoje)).filter((x): x is boolean => x !== null)

  const agrupar = (chave: (v: any) => string | null, nome: (id: string) => string | null) => {
    const m = new Map<string, { vagas: number; ativas: number; candidaturas: number }>()
    const candPorVaga = new Map<string, number>(); for (const x of cands) candPorVaga.set(x.vaga_id, (candPorVaga.get(x.vaga_id) ?? 0) + 1)
    for (const v of vagas) {
      const k = chave(v) ?? '—'
      const a = m.get(k) ?? { vagas: 0, ativas: 0, candidaturas: 0 }
      a.vagas++; if (STATUS_ATIVOS.includes(v.status)) a.ativas++; a.candidaturas += candPorVaga.get(v.id) ?? 0
      m.set(k, a)
    }
    return [...m.entries()].map(([id, a]) => ({ id: id === '—' ? null : id, nome: id === '—' ? 'Não definido' : nome(id) ?? 'Cadastro removido', ...a })).sort((a, b) => b.vagas - a.vagas)
  }
  const mes = (d: string | null) => (d ? d.slice(0, 7) : null)
  const porMes = new Map<string, { abertas: number; contratacoes: number }>()
  for (const v of vagas) { const k = mes(dataStr(v.data_abertura)); if (k) { const a = porMes.get(k) ?? { abertas: 0, contratacoes: 0 }; a.abertas++; porMes.set(k, a) } }
  for (const x of contratacoes) { const k = mes(x.em); if (k) { const a = porMes.get(k) ?? { abertas: 0, contratacoes: 0 }; a.contratacoes++; porMes.set(k, a) } }
  const origens = new Map<string, number>(); for (const x of cands) origens.set(x.origem, (origens.get(x.origem) ?? 0) + 1)
  const candPorVaga = new Map<string, number>(); for (const x of cands) candPorVaga.set(x.vaga_id, (candPorVaga.get(x.vaga_id) ?? 0) + 1)

  return {
    filtros: { ...req.query }, geradoEm: c.agora.toISOString(),
    cards: {
      total: vagas.length, abertas: ativas.length, emAprovacao: cont(['em_aprovacao']), ajustes: cont(['ajustes']), aprovadasAguardando: cont(['aprovada']), publicadas: cont(['publicada']),
      pausadas: cont(['pausada']), emAndamento: vagas.filter((v) => v.status === 'publicada' && (candsAtivasPorVaga.get(v.id) ?? 0) > 0).length,
      proximasPrazo: vagas.filter((v) => prazoDe(v) === 'proxima').length, vencidas: vagas.filter((v) => prazoDe(v) === 'vencida').length,
      encerradas: cont(['encerrada']), canceladas: cont(['cancelada']), rascunhos: cont(['rascunho']),
      criticas: ativas.filter((v) => v.prioridade === 'critica').length,
      posicoesEmAberto: ativas.reduce((s, v) => s + Math.max(0, v.qtd_posicoes - v.posicoes_preenchidas), 0),
      candidaturasRecebidas: cands.length, contratacoes: contratacoes.length,
    },
    indicadores: {
      tempoMedioFechamentoDias: media(tpFecha), tempoMedioFechamentoN: tpFecha.length,
      tempoMedioPrimeiraCandidaturaDias: media(tpPrim), tempoMedioPrimeiraCandidaturaN: tpPrim.length,
      tempoPorEtapa: tempoEtapas.sort((a, b) => ORDEM_TIPOS.indexOf(a.etapa) - ORDEM_TIPOS.indexOf(b.etapa)),
      taxaConversao: taxaConversao(cands.length, contratacoes.length),
      noPrazo: { dentro: noPrazoLista.filter(Boolean).length, fora: noPrazoLista.filter((x) => !x).length, taxa: noPrazoLista.length ? Math.round((noPrazoLista.filter(Boolean).length / noPrazoLista.length) * 1000) / 10 : null },
    },
    funil,
    origens: [...origens.entries()].map(([origem, qtd]) => ({ origem, qtd })).sort((a, b) => b.qtd - a.qtd),
    candidaturasPorVaga: vagas.map((v) => ({ vagaId: v.id, codigo: v.codigo, titulo: v.titulo, total: candPorVaga.get(v.id) ?? 0, ativas: candsAtivasPorVaga.get(v.id) ?? 0 })).filter((x) => x.total > 0).sort((a, b) => b.total - a.total).slice(0, 10),
    distribuicao: {
      porSetor: agrupar((v) => v.setor_id, (id) => org.setor.get(id) ?? null), porUnidade: agrupar((v) => v.unidade_id, (id) => org.unidade.get(id) ?? null),
      porGestor: agrupar((v) => v.gestor_responsavel_id ?? v.gestor_solicitante_id, (id) => nomeDe(org.pessoa, id)), porRecrutador: agrupar((v) => v.recrutador_id, (id) => nomeDe(org.pessoa, id)),
    },
    evolucao: [...porMes.entries()].sort(([a], [b]) => a.localeCompare(b)).slice(-12).map(([mesRef, a]) => ({ mes: mesRef, ...a })),
    definicoes: DEFINICOES,
    semDadosDeCandidatos: cands.length === 0,
  }
}

/* ---------- processamento de alertas e publicação agendada ---------- */
async function processarAlertas(c: Ctx): Promise<Res> {
  const { db, agora } = c
  const hoje = hojeISO(agora)
  const publicadas: string[] = []
  // Publicação agendada: só publica vaga JÁ aprovada e que cumpra todos os requisitos; senão avisa.
  const agendadas = (await db.query("select * from rec_vagas where status = 'aprovada' and not arquivada and publicar_em is not null and publicar_em <= $1::date", [hoje])).rows
  for (const v of agendadas) {
    const falta = estadoParaPublicar(v, hoje)
    if (Object.keys(falta).length) {
      await avisar(db, envolvidos(v), 'vaga_agendamento', 'Publicação agendada não realizada', v.id, `agenda:${v.id}:${dataStr(v.publicar_em)}`, `${rotuloVaga(v)} — complete os campos obrigatórios.`)
      continue
    }
    await db.tx(async (t) => {
      const l = (await t.query('select * from rec_vagas where id = $1 for update', [v.id])).rows[0]
      if (l.status !== 'aprovada') return
      await t.query("update rec_vagas set status = 'publicada', publicada_em = coalesce(publicada_em, now()), versao = versao + 1, atualizado_em = now() where id = $1", [v.id])
      await evento(t, v.id, null, 'publicada_agendada', { de: 'aprovada', para: 'publicada' })
      await auditar(t, null, 'vaga', v.id, 'publicar_agendada', { codigo: v.codigo })
      await avisar(t, envolvidos(v), 'vaga_publicada', 'Vaga publicada', v.id, `vaga:${v.id}:publicada`, rotuloVaga(v))
    })
    publicadas.push(v.id)
  }
  const rhs = await idsComPapel(db, 'rh')
  let criadas = 0
  for (const a of await calcularAlertas(db, 'true', [], hoje)) {
    const dests = a.destinatarios.length ? a.destinatarios : rhs
    for (const d of dests) {
      const antes = (await db.query('select 1 from ntf_notificacoes where destinatario_id = $1 and chave = $2', [d, `${a.chave}:${d}`])).rowCount
      if (antes) continue
      await notificar(db, { destinatarioId: d, tipo: `vaga_${a.tipo}`, titulo: a.tipo === 'aprovacao_atrasada' ? 'Aprovação de vaga atrasada' : a.tipo === 'prazo_vencido' ? 'Vaga com prazo vencido' : a.tipo === 'prazo_proximo' ? 'Vaga próxima do prazo' : a.tipo === 'sem_movimentacao' ? 'Vaga sem movimentação' : 'Atenção em vaga', corpo: `${a.codigo} · ${a.titulo}`, link: a.link, chave: `${a.chave}:${d}` })
      criadas++
    }
  }
  return ok({ notificacoesCriadas: criadas, publicadasAgendadas: publicadas })
}

/* ---------- rotas ---------- */
const CAP_LER = ['vagas:ver', 'vagas:gerenciar', 'vagas:solicitar'] as const

export const rotas: Rota[] = [
  /* ===== opções e configuração ===== */
  {
    metodo: 'GET', padrao: 'recrutamento/opcoes', cap: [...CAP_LER],
    h: async ({ db, usuario: u }) => {
      const [org, cfg, gente, setoresL, cargosL, unidadesL] = await Promise.all([carregarOrg(db), lerConfig(db), pessoas(db), setores(db), cargos(db), unidades(db)])
      const gestao = u.caps.has('vagas:gerenciar')
      const recr = (await db.query("select colaborador_id from acl_funcoes where funcao = 'recrutador'")).rows.map((r) => r.colaborador_id as string)
      const ativos = gente.filter((p) => p.status !== 'encerrado')
      return ok({
        setores: setoresL.filter((s) => qualquerArea(u) || u.setoresLiderados.includes(s.id)).map((s) => ({ id: s.id, nome: s.nome })),
        todosSetores: setoresL.map((s) => ({ id: s.id, nome: s.nome })),
        unidades: unidadesL.map((x) => ({ id: x.id, nome: x.nome })),
        cargos: cargosL.map((x) => ({ id: x.id, nome: x.nome, setorId: x.setorId, nivel: x.nivel ?? null })),
        pessoas: ativos.map((p) => ({ id: p.id, nome: p.nomeSocial || p.nome, setorId: p.setorId })),
        recrutadores: ativos.filter((p) => recr.includes(p.id) || p.papel === 'rh').map((p) => ({ id: p.id, nome: p.nomeSocial || p.nome })),
        canais: cfg.canais, tipos: cfg.tipos, etapasPadrao: cfg.etapas,
        aprovadores: { papeis: ['rh', 'diretoria', 'gestor', 'admin'].map((p) => ({ chave: p, nome: PAPEL_LABEL[p as Papel] })), funcoes: Object.entries(FUNCAO_LABEL).map(([chave, nome]) => ({ chave, nome })) },
        eu: { colaboradorId: u.colaboradorId, setorPadrao: u.setoresLiderados[0] ?? null, nome: org.pessoa.get(u.colaboradorId)?.nome ?? u.nome },
      })
    },
  },
  {
    metodo: 'GET', padrao: 'recrutamento/config', cap: ['vagas:config', 'vagas:gerenciar'],
    h: async ({ db }) => ok(await lerConfig(db)),
  },
  {
    metodo: 'PUT', padrao: 'recrutamento/config/:chave', cap: 'vagas:config',
    h: async ({ db, usuario: u, params, req }) => {
      const chave = enumerado(params.chave, 'configuração', ['fluxos_aprovacao', 'etapas_padrao', 'canais', 'tipos_vaga'] as const)
      let dados: unknown
      const corpo = req.corpo?.dados
      if (chave === 'etapas_padrao') {
        const et = lista<Record<string, unknown>>(corpo, 20).map((e) => ({ nome: texto(e.nome, 'nome da etapa', { max: 80 }), tipo: enumerado(e.tipo, 'tipo da etapa', TIPOS_ETAPA) }))
        const erro = validarEtapas(et)
        if (erro) throw invalido(erro)
        dados = et
      } else if (chave === 'fluxos_aprovacao') {
        const fl = lista<Record<string, any>>(corpo, 20).map((f) => ({
          chave: texto(f.chave, 'chave do fluxo', { max: 40 }).replace(/[^\w-]/g, ''), nome: texto(f.nome, 'nome do fluxo', { max: 120 }),
          condicoes: f.condicoes && typeof f.condicoes === 'object' ? {
            ...(f.condicoes.tipos?.length ? { tipos: listaTexto(f.condicoes.tipos, 10, 30) } : {}), ...(f.condicoes.prioridades?.length ? { prioridades: listaTexto(f.condicoes.prioridades, 4, 30) } : {}),
            ...(f.condicoes.motivos?.length ? { motivos: listaTexto(f.condicoes.motivos, 4, 30) } : {}),
            ...(f.condicoes.salarioMaxAcima !== undefined && f.condicoes.salarioMaxAcima !== null && f.condicoes.salarioMaxAcima !== '' ? { salarioMaxAcima: Math.max(0, Number(f.condicoes.salarioMaxAcima) || 0) } : {}),
          } : undefined,
          passos: lista<Record<string, any>>(f.passos, 8).map((p) => ({
            rotulo: texto(p.rotulo, 'nome do passo', { max: 80 }), tipo: enumerado(p.tipo, 'tipo de aprovador', ['papel', 'funcao', 'pessoa'] as const), ref: texto(p.ref, 'aprovador', { max: 80 }),
            ...(p.prazoDias ? { prazoDias: inteiro(p.prazoDias, 'prazo (dias)', { min: 1, max: 60 }) } : {}),
          })),
        }))
        if (!fl.some((f) => f.chave === 'padrao')) throw invalido('Mantenha o fluxo "padrao": ele é usado quando nenhuma condição se aplica.')
        if (new Set(fl.map((f) => f.chave)).size !== fl.length) throw invalido('Há fluxos com a mesma chave.')
        const org = await carregarOrg(db)
        for (const f of fl) for (const p of f.passos) {
          const valido = p.tipo === 'pessoa' ? org.pessoa.has(p.ref) : p.tipo === 'papel' ? ['rh', 'diretoria', 'gestor', 'admin'].includes(p.ref) : p.ref in FUNCAO_LABEL
          if (!valido) throw invalido(`Aprovador inválido no passo "${p.rotulo}".`)
        }
        dados = fl
      } else {
        const itens = lista<Record<string, unknown>>(corpo, 30).map((x) => ({ chave: texto(x.chave, 'chave', { max: 40 }).replace(/[^\w-]/g, ''), nome: texto(x.nome, 'nome', { max: 80 }) }))
        if (!itens.length) throw invalido('Informe ao menos um item.')
        if (chave === 'tipos_vaga' && itens.some((i) => !(TIPOS_VAGA as readonly string[]).includes(i.chave))) throw invalido('Tipos de vaga aceitos: efetivo, temporário, estágio, aprendiz, contrato e outro (renomeie ou remova).')
        if (chave === 'canais' && !itens.some((i) => i.chave === 'portal')) throw invalido('O canal "portal" precisa existir.')
        dados = itens
      }
      await db.tx(async (t) => {
        await t.query('insert into rec_config (chave, dados, atualizado_por) values ($1,$2::jsonb,$3) on conflict (chave) do update set dados = excluded.dados, atualizado_em = now(), atualizado_por = excluded.atualizado_por', [chave, JSON.stringify(dados), u.colaboradorId])
        await auditar(t, u.colaboradorId, 'rec_config', chave, 'atualizar', {})
      })
      return ok({ chave, dados })
    },
  },

  /* ===== painel, alertas e pendências ===== */
  { metodo: 'GET', padrao: 'recrutamento/painel', cap: [...CAP_LER], h: async (c) => ok(await montarPainel(c)) },
  {
    metodo: 'GET', padrao: 'recrutamento/alertas', cap: [...CAP_LER],
    h: async ({ db, usuario: u, agora }) => {
      const e = escopo(u, 'v', 1)
      const itens = (await calcularAlertas(db, e.sql, e.params, hojeISO(agora))).map(({ destinatarios, chave, ...a }) => a)
      return ok({ itens })
    },
  },
  { metodo: 'POST', padrao: 'recrutamento/alertas/processar', cap: 'vagas:gerenciar', h: processarAlertas },
  {
    metodo: 'GET', padrao: 'recrutamento/aprovacoes-pendentes', cap: [...CAP_LER],
    h: async ({ db, usuario: u }) => {
      const org = await carregarOrg(db)
      const linhas = (await db.query(`select ap.*, v.codigo, v.titulo, v.prioridade from rec_vaga_aprovacoes ap join rec_vagas v on v.id = ap.vaga_id
        where v.status = 'em_aprovacao' and not v.arquivada and ap.rodada = (select max(rodada) from rec_vaga_aprovacoes x where x.vaga_id = ap.vaga_id) order by ap.vaga_id, ap.ordem`)).rows
      const porVaga = new Map<string, any[]>()
      for (const l of linhas) porVaga.set(l.vaga_id, [...(porVaga.get(l.vaga_id) ?? []), l])
      const hoje = hojeISO()
      const itens: unknown[] = []
      for (const passos of porVaga.values()) {
        const a = passoAtual(passos)
        if (!a || !podeDecidirPasso({ aprovadorTipo: a.aprovador_tipo, aprovadorRef: a.aprovador_ref }, u)) continue
        itens.push({ passoId: a.id, vagaId: a.vaga_id, codigo: a.codigo, titulo: a.titulo, prioridade: a.prioridade, rotulo: a.rotulo, prazo: dataStr(a.prazo), atrasado: !!a.prazo && dataStr(a.prazo)! < hoje, aprovador: descreverAprovador(a.aprovador_tipo, a.aprovador_ref, org) })
      }
      return ok({ itens })
    },
  },

  /* ===== lista / exportação ===== */
  {
    metodo: 'GET', padrao: 'vagas', cap: [...CAP_LER],
    h: async ({ db, usuario: u, req, agora }) => {
      const { pagina, por, offset } = paginacao(req.query, 25, 200)
      const f = filtrosVagas(req.query, u, hojeISO(agora))
      const ordem = ORDENS[req.query.ordem] ?? ORDENS.recentes
      const n = f.params.length
      const [total, linhas, org] = await Promise.all([
        db.query(`select count(*)::int as n from rec_vagas v where ${f.where}`, f.params),
        db.query(`select ${SELECT_LISTA} from rec_vagas v where ${f.where} order by ${ordem} limit $${n + 1} offset $${n + 2}`, [...f.params, por, offset]),
        carregarOrg(db),
      ])
      const resumo = (await db.query(`select v.status, count(*)::int as n from rec_vagas v where ${f.where} group by v.status`, f.params)).rows
      return ok({ itens: linhas.rows.map((r) => serializar(r, u, org)), total: total.rows[0].n, pagina, por, porStatus: Object.fromEntries(resumo.map((r) => [r.status, r.n])) })
    },
  },
  {
    metodo: 'GET', padrao: 'vagas/exportar', cap: 'vagas:gerenciar',
    h: async ({ db, usuario: u, req, agora }) => {
      const f = filtrosVagas(req.query, u, hojeISO(agora))
      const [linhas, org] = await Promise.all([db.query(`select ${SELECT_LISTA} from rec_vagas v where ${f.where} order by v.codigo limit 5000`, f.params), carregarOrg(db)])
      const rem = u.caps.has('vagas:ver_remuneracao')
      const cab = ['Código', 'Título', 'Status', 'Prioridade', 'Tipo', 'Área', 'Unidade', 'Cargo', 'Gestor responsável', 'Recrutador', 'Posições', 'Preenchidas', 'Candidaturas', 'Modalidade', 'Cidade', 'UF', 'Abertura', 'Prazo de preenchimento', ...(rem ? ['Salário mínimo', 'Salário máximo', 'Moeda'] : [])]
      const out = [cab.map(celulaCsv).join(';')]
      for (const r of linhas.rows) {
        out.push([r.codigo, r.titulo, r.status, ROTULO_PRIORIDADE[r.prioridade] ?? r.prioridade, r.tipo, org.setor.get(r.setor_id) ?? '', org.unidade.get(r.unidade_id) ?? '', org.cargo.get(r.cargo_id)?.nome ?? '',
          nomeDe(org.pessoa, r.gestor_responsavel_id ?? r.gestor_solicitante_id) ?? '', nomeDe(org.pessoa, r.recrutador_id) ?? '', r.qtd_posicoes, r.posicoes_preenchidas, r.n_cand, ROTULO_MODALIDADE[r.modalidade] ?? r.modalidade,
          r.cidade ?? '', r.estado ?? '', dataStr(r.data_abertura) ?? '', dataStr(r.prazo_preenchimento) ?? '', ...(rem ? [r.salario_min ?? '', r.salario_max ?? '', r.moeda] : [])].map(celulaCsv).join(';'))
      }
      await auditar(db, u.colaboradorId, 'vaga', null, 'exportar', { linhas: linhas.rows.length })
      return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: `vagas-${hojeISO(agora)}.csv`, dados: Buffer.from('﻿' + out.join('\r\n'), 'utf8') } }
    },
  },

  /* ===== criação / leitura / edição ===== */
  {
    metodo: 'POST', padrao: 'vagas', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, req, agora } = c
      const corpo = (req.corpo ?? {}) as Record<string, unknown>
      const cfg = await lerConfig(db)
      const org = await carregarOrg(db)
      const l = lerCampos({ ...corpo, titulo: corpo.titulo ?? '' }, u, cfg)
      if (!l.valores.titulo) throw invalido('Informe o título da vaga.', { titulo: 'Obrigatório' })
      validarRefs(l, org, u)
      if (!l.valores.setor_id && u.setoresLiderados.length === 1 && !qualquerArea(u)) l.valores.setor_id = u.setoresLiderados[0]
      if (!l.valores.gestor_solicitante_id) l.valores.gestor_solicitante_id = u.colaboradorId
      if (l.valores.cargo_id && !l.valores.senioridade) l.valores.senioridade = org.cargo.get(String(l.valores.cargo_id))?.nivel ?? null
      if (l.valores.salario_min != null && l.valores.salario_max != null && Number(l.valores.salario_max) < Number(l.valores.salario_min)) throw invalido('O salário máximo não pode ser menor que o mínimo.', { salarioMax: 'Menor que o mínimo' })
      const id = await db.tx(async (t) => {
        const { codigo, slug } = await gerarCodigoESlug(t, String(l.valores.titulo), agora)
        const vid = await inserirVaga(t, l.valores, { codigo, slug, criadoPor: u.colaboradorId })
        await criarEtapas(t, vid, cfg.etapas)
        await evento(t, vid, u.colaboradorId, 'criada', { para: 'rascunho' })
        await auditar(t, u.colaboradorId, 'vaga', vid, 'criar', { codigo })
        return vid
      })
      return ok(await montarDetalhe(db, u, id), 201)
    },
  },
  { metodo: 'GET', padrao: 'vagas/:id', cap: [...CAP_LER], h: async ({ db, usuario: u, params }) => ok(await montarDetalhe(db, u, params.id)) },
  {
    metodo: 'PUT', padrao: 'vagas/:id', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, req } = c
      const corpo = (req.corpo ?? {}) as Record<string, unknown>
      const versao = inteiro(corpo.versao, 'versão', { min: 1, max: 1_000_000 })
      const cfg = await lerConfig(db)
      const org = await carregarOrg(db)
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id, true)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        const podeEditar = q === 'solicitante' ? gestao || (ehSolicitante(v, u) && u.caps.has('vagas:solicitar')) : q === 'gestao' ? gestao : false
        if (!podeEditar) throw v.status === 'em_aprovacao' ? conflito('A vaga está em aprovação. Peça a devolução para ajustar.') : proibido('Esta vaga não pode ser editada por você neste estado.')
        if (v.versao !== versao) throw conflito('Esta vaga foi alterada por outra pessoa. Recarregue para ver a versão mais recente.')
        const l = lerCampos(corpo, u, cfg)
        validarRefs(l, org, u)
        const min = 'salario_min' in l.valores ? l.valores.salario_min : v.salario_min, max = 'salario_max' in l.valores ? l.valores.salario_max : v.salario_max
        if (min != null && max != null && Number(max) < Number(min)) throw invalido('O salário máximo não pode ser menor que o mínimo.', { salarioMax: 'Menor que o mínimo' })
        if (l.valores.cargo_id && !l.valores.senioridade && !v.senioridade) l.valores.senioridade = org.cargo.get(String(l.valores.cargo_id))?.nivel ?? null
        const cols = Object.keys(l.valores)
        const sets = cols.map((col, i) => `${col} = $${i + 3}${COLUNAS_JSON.has(col) ? '::jsonb' : ''}`)
        await t.query(`update rec_vagas set ${[...sets, 'versao = versao + 1', 'atualizado_em = now()', `atualizado_por = $${cols.length + 3}`].join(', ')} where id = $1 and versao = $2`, [v.id, versao, ...cols.map((k) => l.valores[k]), u.colaboradorId])
        if (v.status !== 'rascunho' && l.campos.length) {
          const agrupados = [...new Set(l.campos.map((k) => (CAMPOS_REMUNERACAO.concat(['moeda', 'tipoRemuneracao', 'divulgarSalario']).includes(k) ? 'remuneracao' : k)))]
          await evento(t, v.id, u.colaboradorId, 'editada', { detalhes: { campos: l.campos } })
          await auditar(t, u.colaboradorId, 'vaga', v.id, 'editar', { codigo: v.codigo, campos: agrupados })
        }
      })
      return ok(await montarDetalhe(db, u, c.params.id))
    },
  },
  {
    metodo: 'POST', padrao: 'vagas/:id/acoes/:acao', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const acao = c.params.acao
      if (acao === 'arquivar' || acao === 'desarquivar') {
        if (!c.usuario.caps.has('vagas:gerenciar')) throw proibido()
        await c.db.tx(async (t) => {
          const v = await carregar(t, c.usuario, c.params.id, true)
          if (acao === 'arquivar' && !STATUS_FINAIS.includes(v.status)) throw conflito('Só vagas encerradas ou canceladas podem ser arquivadas.')
          await t.query('update rec_vagas set arquivada = $2, atualizado_em = now() where id = $1', [v.id, acao === 'arquivar'])
          await evento(t, v.id, c.usuario.colaboradorId, acao === 'arquivar' ? 'arquivada' : 'desarquivada')
          await auditar(t, c.usuario.colaboradorId, 'vaga', v.id, acao, { codigo: v.codigo })
        })
        return ok(await montarDetalhe(c.db, c.usuario, c.params.id))
      }
      const a = enumerado(acao, 'ação', ['solicitar', 'publicar', 'pausar', 'retomar', 'encerrar', 'cancelar', 'reabrir'] as const)
      await executarAcao(c, a, (c.req.corpo ?? {}) as Record<string, unknown>)
      return ok(await montarDetalhe(c.db, c.usuario, c.params.id))
    },
  },
  {
    metodo: 'POST', padrao: 'vagas/:id/aprovacoes/:passoId/decidir', cap: [...CAP_LER],
    h: async (c) => { if (!uuid(c.params.passoId)) throw naoEncontrado('Passo não encontrado.'); await decidirPasso(c); return ok(await montarDetalhe(c.db, c.usuario, c.params.id)) },
  },
  {
    metodo: 'POST', padrao: 'vagas/:id/aprovacoes/:passoId/reatribuir', cap: [...CAP_LER],
    h: async (c) => {
      const { db, usuario: u, req } = c
      if (!uuid(c.params.passoId)) throw naoEncontrado('Passo não encontrado.')
      const tipo = enumerado(req.corpo?.tipo, 'tipo de aprovador', ['papel', 'funcao', 'pessoa'] as const)
      const ref = texto(req.corpo?.ref, 'aprovador', { max: 80 })
      const org = await carregarOrg(db)
      const valido = tipo === 'pessoa' ? org.pessoa.has(ref) && org.pessoa.get(ref)!.status !== 'encerrado' : tipo === 'papel' ? ['rh', 'diretoria', 'gestor', 'admin'].includes(ref) : ref in FUNCAO_LABEL
      if (!valido) throw invalido('Aprovador inválido.', { ref: 'Selecione um aprovador válido' })
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id, true)
        const p = (await t.query('select * from rec_vaga_aprovacoes where id = $1 and vaga_id = $2 for update', [c.params.passoId, v.id])).rows[0]
        if (!p || p.status !== 'pendente' || v.status !== 'em_aprovacao') throw conflito('Só é possível reatribuir um passo pendente de uma vaga em aprovação.')
        if (!u.caps.has('vagas:gerenciar') && !podeDecidirPasso({ aprovadorTipo: p.aprovador_tipo, aprovadorRef: p.aprovador_ref }, u)) throw proibido()
        await t.query('update rec_vaga_aprovacoes set aprovador_tipo = $2, aprovador_ref = $3 where id = $1', [p.id, tipo, ref])
        await evento(t, v.id, u.colaboradorId, 'aprovador_reatribuido', { detalhes: { passo: p.rotulo, para: descreverAprovador(tipo, ref, org) } })
        await auditar(t, u.colaboradorId, 'vaga', v.id, 'reatribuir_aprovador', { codigo: v.codigo, passo: p.rotulo })
        const atual = passoAtual((await t.query('select * from rec_vaga_aprovacoes where vaga_id = $1 and rodada = $2 order by ordem', [v.id, p.rodada])).rows)
        if (atual?.id === p.id) await avisar(t, (await resolverAprovadores(t, tipo, ref)).filter((d) => d !== u.colaboradorId), 'vaga_aprovacao', 'Vaga aguardando sua aprovação', v.id, `vaga:${v.id}:r${p.rodada}:p${p.ordem}:re:${ref}`, rotuloVaga(v))
      })
      return ok(await montarDetalhe(db, u, c.params.id))
    },
  },
  {
    metodo: 'POST', padrao: 'vagas/:id/duplicar', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, agora } = c
      const id = await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id)
        const rem = u.caps.has('vagas:ver_remuneracao')
        const cols = COLUNAS_COPIA.filter((col) => (rem || !['salario_min', 'salario_max', 'variavel', 'divulgar_salario'].includes(col)) && (u.caps.has('ats:notas_rh') || col !== 'observacoes_rh'))
        const valores: Record<string, unknown> = { titulo: `${v.titulo} (cópia)` }
        for (const col of cols) {
          if (['recrutador_id', 'gestor_solicitante_id'].includes(col)) continue
          valores[col] = COLUNAS_JSON.has(col) ? JSON.stringify(v[col]) : v[col]
        }
        valores.gestor_solicitante_id = u.colaboradorId
        if (!qualquerArea(u)) valores.setor_id = v.setor_id && u.setoresLiderados.includes(v.setor_id) ? v.setor_id : u.setoresLiderados[0] ?? null
        else valores.recrutador_id = v.recrutador_id
        const { codigo, slug } = await gerarCodigoESlug(t, String(valores.titulo), agora)
        const vid = await inserirVaga(t, valores, { codigo, slug, criadoPor: u.colaboradorId })
        const et = (await t.query('select nome, tipo from rec_vaga_etapas where vaga_id = $1 order by ordem', [v.id])).rows
        await criarEtapas(t, vid, et)
        await evento(t, vid, u.colaboradorId, 'criada', { para: 'rascunho', detalhes: { duplicadaDe: v.codigo } })
        await auditar(t, u.colaboradorId, 'vaga', vid, 'duplicar', { codigo, origem: v.codigo })
        return vid
      })
      return ok(await montarDetalhe(db, u, id), 201)
    },
  },

  /* ===== etapas seletivas ===== */
  {
    metodo: 'PUT', padrao: 'vagas/:id/etapas', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, req } = c
      const novas = lista<Record<string, unknown>>(req.corpo?.etapas, 20).map((e) => ({
        id: typeof e.id === 'string' && uuid(e.id) ? e.id : null, nome: texto(e.nome, 'nome da etapa', { max: 80 }), tipo: enumerado(e.tipo, 'tipo da etapa', TIPOS_ETAPA, 'generica'),
      }))
      const erro = validarEtapas(novas)
      if (erro) throw invalido(erro, { etapas: erro })
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id, true)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        if (!(q === 'solicitante' ? gestao || ehSolicitante(v, u) : q === 'gestao' ? gestao : false)) throw proibido('As etapas não podem ser alteradas neste estado.')
        const atuais = (await t.query('select e.id, e.nome, (select count(*)::int from rec_candidaturas c where c.etapa_id = e.id) as n from rec_vaga_etapas e where e.vaga_id = $1', [v.id])).rows
        const mantidas = new Set(novas.map((n) => n.id).filter(Boolean))
        for (const a of atuais) if (!mantidas.has(a.id)) {
          if (a.n > 0) throw conflito(`A etapa "${a.nome}" tem candidaturas e não pode ser removida. Mova os candidatos antes.`)
          await t.query('delete from rec_vaga_etapas where id = $1', [a.id])
        }
        for (let i = 0; i < novas.length; i++) {
          const n = novas[i]
          if (n.id && atuais.some((a) => a.id === n.id)) await t.query('update rec_vaga_etapas set ordem = $2, nome = $3, tipo = $4 where id = $1', [n.id, i + 1, n.nome, n.tipo])
          else await t.query('insert into rec_vaga_etapas (vaga_id, ordem, nome, tipo) values ($1,$2,$3,$4)', [v.id, i + 1, n.nome, n.tipo])
        }
        await t.query('update rec_vagas set versao = versao + 1, atualizado_em = now(), atualizado_por = $2 where id = $1', [v.id, u.colaboradorId])
        if (v.status !== 'rascunho') { await evento(t, v.id, u.colaboradorId, 'etapas_alteradas'); await auditar(t, u.colaboradorId, 'vaga', v.id, 'etapas', { codigo: v.codigo }) }
      })
      return ok(await montarDetalhe(db, u, c.params.id))
    },
  },

  /* ===== comentários ===== */
  {
    metodo: 'POST', padrao: 'vagas/:id/comentarios', cap: [...CAP_LER],
    h: async (c) => {
      const { db, usuario: u, req } = c
      const t0 = texto(req.corpo?.texto, 'comentário', { max: 2000 })
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id)
        const cid = (await t.query('insert into rec_vaga_comentarios (vaga_id, autor_id, texto) values ($1,$2,$3) returning id', [v.id, u.colaboradorId, t0])).rows[0].id
        await evento(t, v.id, u.colaboradorId, 'comentario')
        const dests = new Set(envolvidos(v, u.colaboradorId))
        if (v.status === 'em_aprovacao') {
          const atual = passoAtual((await t.query('select * from rec_vaga_aprovacoes where vaga_id = $1 and rodada = (select max(rodada) from rec_vaga_aprovacoes where vaga_id = $1) order by ordem', [v.id])).rows)
          if (atual) for (const d of await resolverAprovadores(t, atual.aprovador_tipo, atual.aprovador_ref)) if (d !== u.colaboradorId) dests.add(d)
        }
        await avisar(t, [...dests], 'vaga_comentario', 'Novo comentário na vaga', v.id, `vaga:${v.id}:com:${cid}`, rotuloVaga(v))
      })
      return ok(await montarDetalhe(db, u, c.params.id), 201)
    },
  },

  /* ===== imagem de capa ===== */
  {
    metodo: 'PUT', padrao: 'vagas/:id/imagem', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, req } = c
      const up = validarUpload(req.corpo?.arquivo, ['png', 'jpg'])
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        if (!(q === 'solicitante' ? gestao || ehSolicitante(v, u) : q === 'gestao' ? gestao : false)) throw proibido('Não é possível alterar a imagem neste estado.')
        const aid = await guardarArquivo(t, up, 'vaga_imagem', v.id, u.colaboradorId)
        if (v.imagem_arquivo_id) await t.query('delete from arq_arquivos where id = $1', [v.imagem_arquivo_id])
        await t.query('update rec_vagas set imagem_arquivo_id = $2, atualizado_em = now() where id = $1', [v.id, aid])
        await evento(t, v.id, u.colaboradorId, 'imagem_alterada')
        await auditar(t, u.colaboradorId, 'vaga', v.id, 'imagem', { arquivo: aid })
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'DELETE', padrao: 'vagas/:id/imagem', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async ({ db, usuario: u, params }) => {
      await db.tx(async (t) => {
        const v = await carregar(t, u, params.id)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        if (!(q === 'solicitante' ? gestao || ehSolicitante(v, u) : q === 'gestao' ? gestao : false)) throw proibido()
        if (!v.imagem_arquivo_id) throw naoEncontrado('Esta vaga não tem imagem.')
        await t.query('update rec_vagas set imagem_arquivo_id = null, atualizado_em = now() where id = $1', [v.id])
        await t.query('delete from arq_arquivos where id = $1', [v.imagem_arquivo_id])
        await evento(t, v.id, u.colaboradorId, 'imagem_removida')
        await auditar(t, u.colaboradorId, 'vaga', v.id, 'imagem_removida', {})
      })
      return ok({ ok: true })
    },
  },
  {
    metodo: 'GET', padrao: 'vagas/:id/imagem', cap: [...CAP_LER],
    h: async ({ db, usuario: u, params }) => {
      const v = await carregar(db, u, params.id)
      if (!v.imagem_arquivo_id) throw naoEncontrado('Esta vaga não tem imagem.')
      const r = await baixarArquivo(db, v.imagem_arquivo_id)
      if (!r?.binario) throw naoEncontrado('Imagem não encontrada.')
      return { ...r, binario: { ...r.binario, inline: true }, cabecalhos: { 'Cache-Control': 'private, max-age=60' } }
    },
  },

  /* ===== anexos ===== */
  {
    metodo: 'POST', padrao: 'vagas/:id/anexos', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async (c) => {
      const { db, usuario: u, req } = c
      const up = validarUpload(req.corpo?.arquivo, ['pdf', 'docx', 'odt', 'png', 'jpg'])
      await db.tx(async (t) => {
        const v = await carregar(t, u, c.params.id)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        if (!(q === 'solicitante' ? gestao || ehSolicitante(v, u) : q === 'gestao' ? gestao : false)) throw proibido('Não é possível anexar arquivos neste estado.')
        if ((await t.query("select count(*)::int as n from arq_arquivos where dono_tipo = 'vaga' and dono_id = $1", [v.id])).rows[0].n >= 10) throw invalido('Limite de 10 anexos por vaga.')
        const aid = await guardarArquivo(t, up, 'vaga', v.id, u.colaboradorId)
        await evento(t, v.id, u.colaboradorId, 'anexo_adicionado', { detalhes: { nome: up.nome } })
        await auditar(t, u.colaboradorId, 'vaga', v.id, 'anexar', { arquivo: aid })
      })
      return ok(await montarDetalhe(db, u, c.params.id), 201)
    },
  },
  {
    metodo: 'GET', padrao: 'vagas/:id/anexos/:arquivoId', cap: [...CAP_LER],
    h: async ({ db, usuario: u, params }) => {
      const v = await carregar(db, u, params.id)
      const dono = await db.query("select 1 from arq_arquivos where id = $1 and dono_tipo = 'vaga' and dono_id = $2", [params.arquivoId, v.id])
      if (!uuid(params.arquivoId) || !dono.rowCount) throw naoEncontrado('Arquivo não encontrado.')
      return (await baixarArquivo(db, params.arquivoId)) ?? (() => { throw naoEncontrado('Arquivo não encontrado.') })()
    },
  },
  {
    metodo: 'DELETE', padrao: 'vagas/:id/anexos/:arquivoId', cap: ['vagas:solicitar', 'vagas:gerenciar'],
    h: async ({ db, usuario: u, params }) => {
      await db.tx(async (t) => {
        const v = await carregar(t, u, params.id)
        const gestao = u.caps.has('vagas:gerenciar')
        const q = quemEdita(v.status)
        if (!(q === 'solicitante' ? gestao || ehSolicitante(v, u) : q === 'gestao' ? gestao : false)) throw proibido()
        if (!uuid(params.arquivoId)) throw naoEncontrado('Arquivo não encontrado.')
        const r = await t.query("delete from arq_arquivos where id = $1 and dono_tipo = 'vaga' and dono_id = $2", [params.arquivoId, v.id])
        if (!r.rowCount) throw naoEncontrado('Arquivo não encontrado.')
        await evento(t, v.id, u.colaboradorId, 'anexo_removido')
        await auditar(t, u.colaboradorId, 'vaga', v.id, 'remover_anexo', { arquivo: params.arquivoId })
      })
      return ok(await montarDetalhe(db, u, params.id))
    },
  },
]
