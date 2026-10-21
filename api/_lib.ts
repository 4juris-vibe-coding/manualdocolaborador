/* ============================================================
   4JURIS Pessoas · servidor (funções /api)
   Banco: PostgreSQL (Supabase) via DATABASE_URL. Sessão: cookie
   HttpOnly assinado (HMAC) com SESSION_SECRET. Sem dependências
   além do `pg`.
   ============================================================ */
import pg from 'pg'
import { createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'

export const COLECOES = [
  'colaboradores', 'setores', 'unidades', 'cargos', 'contratos', 'documentos', 'reembolsos', 'notas', 'periodos',
  'comunicados', 'eventos', 'beneficios', 'treinamentos', 'progressoConteudos', 'badges', 'conquistas', 'regras',
  'lancamentos', 'desafios', 'reconhecimentos', 'iniciativas', 'checklists', 'processos', 'motivosEncerramento',
  'tiposRegistro', 'registros', 'objetivos', 'pesquisas', 'respostas', 'participacoes', 'parabens', 'notificacoes',
  'auditoria', 'historicoFuncao', 'dependentes', 'exigencias', 'beneficiarios', 'gruposCompetencia', 'competencias',
  'ciclos', 'participantesCiclo', 'respostasAvaliacao', 'avaliacoesInicio', 'classificacoesGrupo', 'feedbacks',
  'apresentacoes', 'sugestoes',
] as const

export const tabela = (colecao: string) => `app_${colecao.toLowerCase()}`

let pool: pg.Pool | undefined
export function db(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada.')
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 })
  }
  return pool
}

/* ---------- senha ---------- */
export function hashSenha(senha: string): string {
  const sal = randomBytes(16)
  const h = scryptSync(senha, sal, 64)
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`
}
export function confereSenha(senha: string, guardado: string): boolean {
  const [alg, salHex, hHex] = guardado.split('$')
  if (alg !== 'scrypt' || !salHex || !hHex) return false
  const esperado = Buffer.from(hHex, 'hex')
  if (!esperado.length) return false
  const h = scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length)
  return timingSafeEqual(h, esperado)
}

/* ---------- sessão (cookie assinado) ---------- */
const COOKIE = 'sessao4juris'
const DURACAO_S = 60 * 60 * 12

function segredo(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente ou curta (mín. 32 caracteres).')
  return s
}
const assinar = (dado: string) => createHmac('sha256', segredo()).update(dado).digest('base64url')

export interface Sessao { uid: string; colaboradorId: string; exp: number }

export function emitirCookie(s: Omit<Sessao, 'exp'>, seguro: boolean): string {
  const corpo = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + DURACAO_S })).toString('base64url')
  return `${COOKIE}=${corpo}.${assinar(corpo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACAO_S}${seguro ? '; Secure' : ''}`
}
export const cookieLimpo = (seguro: boolean) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro ? '; Secure' : ''}`

export function lerSessao(cookieHeader: string | undefined): Sessao | null {
  const bruto = cookieHeader?.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!bruto) return null
  const [corpo, sig] = bruto.split('.')
  if (!corpo || !sig) return null
  const a = Buffer.from(sig), b = Buffer.from(assinar(corpo))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as Sessao
    return s.exp > Date.now() / 1000 ? s : null
  } catch { return null }
}

/* ---------- estado ---------- */
export type Estado = Record<string, unknown>

export async function carregarEstado(): Promise<Estado> {
  const out: Estado = Object.fromEntries(COLECOES.map((c) => [c, [] as unknown[]]))
  const p = db()
  // Uma única ida ao banco para todas as coleções.
  const sql = COLECOES.map((c) => `select '${c}'::text as c, ord, dados from ${tabela(c)}`).join(' union all ') + ' order by c, ord'
  for (const r of (await p.query(sql)).rows) (out[r.c] as unknown[]).push(r.dados)
  const cfg = await p.query('select chave, dados from app_config')
  out.config = Object.fromEntries(cfg.rows.map((r) => [r.chave, r.dados]))
  return out
}

/** Substitui, numa transação, as coleções recebidas (cada uma por inteiro). */
export async function gravarColecoes(mudancas: Estado): Promise<string[]> {
  const gravadas: string[] = []
  const cli = await db().connect()
  try {
    await cli.query('begin')
    for (const [nome, valor] of Object.entries(mudancas)) {
      if (nome === 'config') {
        if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('config inválida')
        await cli.query('delete from app_config')
        for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
          await cli.query('insert into app_config (chave, dados) values ($1, $2::jsonb)', [k, JSON.stringify(v)])
        }
        gravadas.push(nome)
        continue
      }
      if (!(COLECOES as readonly string[]).includes(nome)) throw new Error(`Coleção desconhecida: ${nome}`)
      if (!Array.isArray(valor)) throw new Error(`Coleção ${nome} deve ser uma lista`)
      const t = tabela(nome)
      await cli.query(`delete from ${t}`)
      if (valor.length) {
        await cli.query(
          `insert into ${t} (ord, id, dados)
           select (e.n - 1)::int, e.v->>'id', e.v from jsonb_array_elements($1::jsonb) with ordinality as e(v, n)`,
          [JSON.stringify(valor)],
        )
      }
      gravadas.push(nome)
    }
    await cli.query('commit')
  } catch (e) {
    await cli.query('rollback').catch(() => undefined)
    throw e
  } finally {
    cli.release()
  }
  return gravadas
}
