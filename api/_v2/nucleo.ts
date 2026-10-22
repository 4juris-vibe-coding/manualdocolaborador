/* ============================================================
   4JURIS Pessoas · API v2 · núcleo
   Tipos, erros HTTP, banco, roteador, autenticação e utilitários
   compartilhados pelos módulos (api/_v2/modulos/*).

   Regras:
   - TODA rota autenticada declara a capacidade exigida (`cap`) e o
     roteador a verifica no servidor. Escopo por registro (ex.: gestor
     só vê vagas da própria área) é responsabilidade do módulo, usando
     os helpers de escopo daqui.
   - Rotas `publica: true` não leem cookie algum.
   - Mutações autenticadas exigem o cabeçalho `x-requested-with: 4juris`
     (defesa contra CSRF, além de SameSite=Lax).
   ============================================================ */
import type pg from 'pg'
import { createHash, randomBytes } from 'node:crypto'
import { capacidadesDe, type Capacidade, type FuncaoAdicional } from '../../src/domain/permissions.js'
import type { Papel } from '../../src/lib/types.js'

/* ---------- banco ---------- */
export interface Consulta { rows: any[]; rowCount: number }
export interface Executor { query(sql: string, params?: unknown[]): Promise<Consulta> }
export interface Db extends Executor { tx<T>(fn: (t: Executor) => Promise<T>): Promise<T> }

export function dbDoPool(pool: pg.Pool): Db {
  return {
    async query(sql, params) { const r = await pool.query(sql, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 } },
    async tx(fn) {
      const cli = await pool.connect()
      try {
        await cli.query('begin')
        const out = await fn({ async query(sql, params) { const r = await cli.query(sql, params as unknown[]); return { rows: r.rows, rowCount: r.rowCount ?? 0 } } })
        await cli.query('commit')
        return out
      } catch (e) {
        await cli.query('rollback').catch(() => undefined)
        throw e
      } finally { cli.release() }
    },
  }
}

/* ---------- erros ---------- */
export class ErroHttp extends Error {
  constructor(public status: number, mensagem: string, public campos?: Record<string, string>) { super(mensagem) }
}
export const invalido = (m: string, campos?: Record<string, string>) => new ErroHttp(400, m, campos)
export const naoAutenticado = () => new ErroHttp(401, 'Sessão ausente ou expirada.')
export const proibido = (m = 'Você não tem permissão para esta ação.') => new ErroHttp(403, m)
export const naoEncontrado = (m = 'Registro não encontrado.') => new ErroHttp(404, m)
export const conflito = (m: string) => new ErroHttp(409, m)
export const muitasTentativas = () => new ErroHttp(429, 'Muitas tentativas. Aguarde alguns minutos.')

/* ---------- requisição / resposta ---------- */
export interface Req {
  metodo: string
  /** Segmentos depois de /api/v2/ (já decodificados). */
  caminho: string[]
  query: Record<string, string>
  corpo: any
  cookie?: string
  ip: string
  seguro: boolean
  cabecalhos: Record<string, string>
}
export interface Res {
  status: number
  corpo?: unknown
  cabecalhos?: Record<string, string>
  /** Resposta binária (download de arquivo). */
  binario?: { mime: string; nome: string; dados: Buffer; inline?: boolean }
}
export const ok = (corpo: unknown = { ok: true }, status = 200): Res => ({ status, corpo })

export interface Usuario {
  uid: string
  colaboradorId: string
  nome: string
  papel: Papel
  funcoes: FuncaoAdicional[]
  caps: Set<Capacidade>
  /** Áreas (setores) que a pessoa lidera ou gerencia. */
  setoresLiderados: string[]
}

export interface Ctx {
  db: Db
  req: Req
  params: Record<string, string>
  usuario: Usuario            // rotas públicas recebem um usuário "vazio" (ver ANONIMO)
  agora: Date
}
export type Handler = (c: Ctx) => Promise<Res>

export interface Rota {
  metodo: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  /** Ex.: 'vagas/:id/aprovacoes'. */
  padrao: string
  publica?: boolean
  /** Capacidade(s) exigida(s); basta uma delas. Sem `cap`, qualquer pessoa autenticada. */
  cap?: Capacidade | Capacidade[]
  /** Limite de requisições por IP/minuto (rotas públicas). */
  limite?: number
  h: Handler
}

export const ANONIMO: Usuario = { uid: '', colaboradorId: '', nome: '', papel: 'colaborador', funcoes: [], caps: new Set(), setoresLiderados: [] }

/* ---------- utilidades ---------- */
export const novoToken = () => randomBytes(32).toString('base64url')
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')
export const sha256 = (b: Buffer) => createHash('sha256').update(b).digest('hex')
export const hojeISO = (agora = new Date()) => agora.toISOString().slice(0, 10)

export function exigir(c: Usuario, ...caps: Capacidade[]) {
  if (!caps.some((k) => c.caps.has(k))) throw proibido()
}
export const tem = (u: Usuario, cap: Capacidade) => u.caps.has(cap)

/** Valida um texto obrigatório com limites; devolve o valor aparado. */
export function texto(v: unknown, campo: string, { min = 1, max = 2000, obrigatorio = true }: { min?: number; max?: number; obrigatorio?: boolean } = {}): string {
  if (v === undefined || v === null || v === '') {
    if (obrigatorio) throw invalido(`Informe ${campo}.`, { [campo]: 'Obrigatório' })
    return ''
  }
  if (typeof v !== 'string') throw invalido(`${campo} inválido.`, { [campo]: 'Texto inválido' })
  const t = v.trim()
  if (t.length < min && obrigatorio) throw invalido(`Informe ${campo}.`, { [campo]: 'Obrigatório' })
  if (t.length > max) throw invalido(`${campo} muito longo (máx. ${max}).`, { [campo]: `Máx. ${max} caracteres` })
  return t
}
export function enumerado<T extends string>(v: unknown, campo: string, validos: readonly T[], padrao?: T): T {
  if ((v === undefined || v === null || v === '') && padrao) return padrao
  if (typeof v !== 'string' || !validos.includes(v as T)) throw invalido(`${campo} inválido.`, { [campo]: 'Valor inválido' })
  return v as T
}
export function inteiro(v: unknown, campo: string, { min = 0, max = 1_000_000, padrao }: { min?: number; max?: number; padrao?: number } = {}): number {
  if ((v === undefined || v === null || v === '') && padrao !== undefined) return padrao
  const n = Number(v)
  if (!Number.isInteger(n) || n < min || n > max) throw invalido(`${campo} inválido.`, { [campo]: `Entre ${min} e ${max}` })
  return n
}
export function dataISO(v: unknown, campo: string, obrigatorio = false): string | null {
  if (v === undefined || v === null || v === '') { if (obrigatorio) throw invalido(`Informe ${campo}.`, { [campo]: 'Obrigatório' }); return null }
  if (typeof v !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(v) || Number.isNaN(Date.parse(v))) throw invalido(`${campo} inválida.`, { [campo]: 'Use AAAA-MM-DD' })
  return v
}
export const email = (v: unknown, campo = 'e-mail') => {
  const t = texto(v, campo, { max: 200 }).toLowerCase()
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(t)) throw invalido('E-mail inválido.', { [campo]: 'E-mail inválido' })
  return t
}
export const lista = <T = unknown>(v: unknown, max = 200): T[] => (Array.isArray(v) ? (v.slice(0, max) as T[]) : [])
export const listaTexto = (v: unknown, max = 100, tamanho = 300): string[] =>
  lista<unknown>(v, max).map((x) => String(x ?? '').trim().slice(0, tamanho)).filter(Boolean)

/** Paginação padrão: ?pagina=1&por=25 */
export function paginacao(q: Record<string, string>, porPadrao = 25, max = 100) {
  const pagina = Math.max(1, Number(q.pagina) || 1)
  const por = Math.min(max, Math.max(1, Number(q.por) || porPadrao))
  return { pagina, por, offset: (pagina - 1) * por }
}

/* ---------- auditoria e notificações ---------- */
export async function auditar(ex: Executor, quem: string | null, entidade: string, entidadeId: string | null, acao: string, detalhes: Record<string, unknown> = {}) {
  await ex.query('insert into aud_eventos (colaborador_id, entidade, entidade_id, acao, detalhes) values ($1,$2,$3,$4,$5::jsonb)',
    [quem, entidade, entidadeId, acao, JSON.stringify(detalhes)])
}

export interface NovaNotificacao { destinatarioId: string; tipo: string; titulo: string; corpo?: string; link?: string; chave?: string }
/** Insere sem duplicar (mesma chave + destinatário). Nunca coloque dados sensíveis em título/corpo. */
export async function notificar(ex: Executor, n: NovaNotificacao) {
  await ex.query(
    'insert into ntf_notificacoes (destinatario_id, tipo, titulo, corpo, link, chave) values ($1,$2,$3,$4,$5,$6) on conflict (destinatario_id, chave) do nothing',
    [n.destinatarioId, n.tipo, n.titulo, n.corpo ?? null, n.link ?? null, n.chave ?? randomBytes(8).toString('hex')])
}

/* ---------- organização (fonte da verdade: coleções legadas em JSONB) ---------- */
export interface PessoaOrg {
  id: string; nome: string; nomeSocial?: string; email: string; papel: Papel; setorId: string; cargoId: string; unidadeId?: string; produtoIds?: string[]
  status: string; responsavelId?: string; topoOrganizacao?: boolean; dataEntrada?: string; avatarCor?: string; cidade?: string; uf?: string; telefone?: string
  privacidade?: Record<string, unknown>
}
export interface SetorOrg { id: string; nome: string; gestorId: string | null; liderancaIds: string[]; unidadeId?: string; cor?: string; icon?: string; paiId?: string | null }
export interface CargoOrg { id: string; nome: string; setorId: string; nivel?: string; funcaoSuperiorId?: string; descricao?: string; faixaValor?: { min?: number; max?: number; visivel: boolean }; [k: string]: unknown }
export interface UnidadeOrg { id: string; nome: string }

async function colecao<T>(ex: Executor, nome: 'colaboradores' | 'setores' | 'cargos' | 'unidades' | 'competencias' | 'gruposCompetencia'): Promise<T[]> {
  const r = await ex.query(`select dados from app_${nome.toLowerCase()} order by ord`)
  return r.rows.map((x) => x.dados as T)
}
export const pessoas = (ex: Executor) => colecao<PessoaOrg>(ex, 'colaboradores')
export const setores = (ex: Executor) => colecao<SetorOrg>(ex, 'setores')
export const cargos = (ex: Executor) => colecao<CargoOrg>(ex, 'cargos')
export const unidades = (ex: Executor) => colecao<UnidadeOrg>(ex, 'unidades')
export const competenciasLegado = (ex: Executor) => colecao<{ id: string; nome: string; grupoId?: string; [k: string]: unknown }>(ex, 'competencias')

export async function pessoaPorId(ex: Executor, id: string): Promise<PessoaOrg | null> {
  const r = await ex.query('select dados from app_colaboradores where id = $1 limit 1', [id])
  return (r.rows[0]?.dados as PessoaOrg) ?? null
}

/** Pessoas com determinada função adicional ou papel (para notificar / designar). */
export async function idsComFuncao(ex: Executor, funcao: FuncaoAdicional): Promise<string[]> {
  // Como idsComPapel: quem teve a parceria encerrada não recebe tarefas nem avisos.
  return (await ex.query(`select f.colaborador_id from acl_funcoes f join app_colaboradores c on c.id = f.colaborador_id
    where f.funcao = $1 and coalesce(c.dados->>'status', '') <> 'encerrado'`, [funcao])).rows.map((r) => r.colaborador_id)
}
export async function idsComPapel(ex: Executor, ...papeis: Papel[]): Promise<string[]> {
  return (await ex.query("select id from app_colaboradores where dados->>'papel' = any($1) and coalesce(dados->>'status','') <> 'encerrado'", [papeis])).rows.map((r) => r.id)
}

/** Carrega a pessoa autenticada, suas funções e as áreas que lidera. */
export async function montarUsuario(ex: Executor, uid: string, colaboradorId: string): Promise<Usuario | null> {
  const vivo = await ex.query('select 1 from usuarios where id = $1 and ativo', [uid])
  if (!vivo.rowCount) return null
  const p = await pessoaPorId(ex, colaboradorId)
  if (!p || p.status === 'encerrado') return null
  const funcoes = (await ex.query('select funcao from acl_funcoes where colaborador_id = $1', [colaboradorId])).rows.map((r) => r.funcao as FuncaoAdicional)
  const setoresLiderados = (await ex.query(
    "select id from app_setores where dados->>'gestorId' = $1 or dados->'liderancaIds' ? $1", [colaboradorId])).rows.map((r) => r.id as string)
  return { uid, colaboradorId, nome: p.nome, papel: p.papel, funcoes, caps: capacidadesDe(p.papel, funcoes), setoresLiderados }
}

/* ---------- limite de tentativas (compartilhado entre instâncias via banco) ---------- */
export async function limitar(ex: Executor, chave: string, max: number, janelaSeg = 60, agora = Date.now()) {
  const janela = Math.floor(agora / 1000 / janelaSeg)
  const r = await ex.query(
    'insert into lim_tentativas (chave, janela, n) values ($1,$2,1) on conflict (chave, janela) do update set n = lim_tentativas.n + 1 returning n',
    [chave, janela])
  if (r.rows[0].n > max) throw muitasTentativas()
  // limpeza oportunista de janelas antigas
  if (Math.random() < 0.02) await ex.query('delete from lim_tentativas where janela < $1', [janela - 120]).catch(() => undefined)
}

/* ---------- roteador ---------- */
interface RotaCompilada extends Rota { partes: string[] }
export function compilar(rotas: Rota[]): RotaCompilada[] {
  return rotas.map((r) => ({ ...r, partes: r.padrao.split('/').filter(Boolean) }))
}
function casar(r: RotaCompilada, caminho: string[]): Record<string, string> | null {
  if (r.partes.length !== caminho.length) return null
  const params: Record<string, string> = {}
  for (let i = 0; i < r.partes.length; i++) {
    const p = r.partes[i]
    if (p.startsWith(':')) params[p.slice(1)] = caminho[i]
    else if (p !== caminho[i]) return null
  }
  return params
}

/**
 * Segmentos depois de /api/v2/. Usa o caminho da URL quando ele chega intacto (dev local, Vercel que preserva a URL)
 * e, se não, o `__caminho` injetado pela reescrita do vercel.json.
 */
export function caminhoV2(url: URL): string[] {
  const doPath = url.pathname.replace(/^\/api\/v2\/?/, '').split('/').filter(Boolean)
  if (doPath.length && url.pathname.startsWith('/api/v2/')) {
    try { return doPath.map((s) => decodeURIComponent(s)) } catch { return doPath }
  }
  return (url.searchParams.get('__caminho') ?? '').split('/').filter(Boolean)
}

export interface Dependencias {
  db: Db
  rotas: RotaCompilada[]
  /** Lê o cookie de sessão; devolve null se inválido. Injetado para facilitar testes. */
  lerSessao: (cookie: string | undefined) => { uid: string; colaboradorId: string } | null
  agora?: () => Date
}

export async function despachar(dep: Dependencias, req: Req): Promise<Res> {
  try {
    const agora = dep.agora?.() ?? new Date()
    let achada: { r: RotaCompilada; params: Record<string, string> } | null = null
    let caminhoExiste = false
    for (const r of dep.rotas) {
      const params = casar(r, req.caminho)
      if (!params) continue
      caminhoExiste = true
      if (r.metodo === req.metodo) { achada = { r, params }; break }
    }
    if (!achada) return { status: caminhoExiste ? 405 : 404, corpo: { erro: caminhoExiste ? 'Método não permitido.' : 'Rota não encontrada.' } }
    const { r, params } = achada

    let usuario = ANONIMO
    if (r.publica) {
      await limitar(dep.db, `${req.ip}|${r.metodo}|${r.padrao}`, r.limite ?? (r.metodo === 'GET' ? 120 : 20))
    } else {
      const s = dep.lerSessao(req.cookie)
      if (!s) throw naoAutenticado()
      if (r.metodo !== 'GET' && req.cabecalhos['x-requested-with'] !== '4juris') throw proibido('Requisição não reconhecida.')
      const u = await montarUsuario(dep.db, s.uid, s.colaboradorId)
      if (!u) throw naoAutenticado()
      usuario = u
      if (r.cap) {
        const caps = Array.isArray(r.cap) ? r.cap : [r.cap]
        if (!caps.some((k) => u.caps.has(k))) throw proibido()
      }
    }
    return await r.h({ db: dep.db, req, params, usuario, agora })
  } catch (e) {
    if (e instanceof ErroHttp) return { status: e.status, corpo: { erro: e.message, ...(e.campos ? { campos: e.campos } : {}) } }
    console.error('[api/v2]', req.metodo, req.caminho.join('/'), e instanceof Error ? e.message : e)
    return { status: 500, corpo: { erro: 'Erro interno do servidor.' } }
  }
}

/* ---------- convenções de saída ---------- */
const paraCamelChave = (k: string) => k.replace(/_([a-z0-9])/g, (_, c: string) => c.toUpperCase())
/** snake_case → camelCase nas chaves de primeiro nível (jsonb interno fica como está). A API v2 responde sempre em camelCase. */
export const camel = <T extends Record<string, unknown>>(linha: T): Record<string, unknown> =>
  Object.fromEntries(Object.entries(linha).map(([k, v]) => [paraCamelChave(k), v]))

/**
 * Escopo de vagas por registro. RH e recrutadores (`vagas:gerenciar`) e analista de RH veem todas; gestores veem
 * as que solicitaram/lideram/criaram ou da(s) própria(s) área(s). `alias` = alias de rec_vagas na consulta;
 * `proximoParam` = número do próximo $n livre. Devolve o fragmento SQL e os parâmetros a anexar.
 */
/** RH não se limita por área: quem gerencia vagas e o(a) analista de RH veem e solicitam vagas de qualquer área. */
export const qualquerArea = (u: Usuario) => u.caps.has('vagas:gerenciar') || u.funcoes.includes('analista_rh')

export function escopoVagas(u: Usuario, alias = 'v', proximoParam = 1): { sql: string; params: unknown[] } {
  if (qualquerArea(u)) return { sql: 'true', params: [] }
  const p = proximoParam
  const a = alias
  return {
    sql: `(${a}.gestor_solicitante_id = $${p} or ${a}.gestor_responsavel_id = $${p} or ${a}.gestor_imediato_id = $${p} or ${a}.criado_por = $${p} or ${a}.recrutador_id = $${p} or ${a}.setor_id = any($${p + 1}::text[]))`,
    params: [u.colaboradorId, u.setoresLiderados],
  }
}
