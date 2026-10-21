/* ============================================================
   Harness de testes da API v2: banco PostgreSQL em memória (PGlite)
   com o MESMO schema de produção, sessão assinada e despacho
   idêntico ao da função serverless. Só é importado por testes.
   ============================================================ */
import { PGlite } from '@electric-sql/pglite'
import { readdirSync, readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { despachar, type Db, type Executor, type Req, type Res } from '../nucleo.js'
import { ROTAS } from '../rotas.js'
import { COLECOES, emitirCookie, lerSessao, tabela } from '../../_lib.js'

process.env.SESSION_SECRET ??= 'segredo-de-teste-com-mais-de-trinta-e-dois-caracteres!!'

const raiz = (p: string) => fileURLToPath(new URL(`../../../${p}`, import.meta.url))

export function dbPglite(pg: PGlite): Db {
  const exec: Executor = {
    async query(sql, params) {
      // Sem parâmetros pode ser um script com vários comandos (como no pg): usa exec.
      if (params === undefined) { const rs = await pg.exec(sql); const u = rs[rs.length - 1]; return { rows: (u?.rows ?? []) as any[], rowCount: u?.rows?.length || (u?.affectedRows ?? 0) } }
      const r = await pg.query(sql, params as unknown[])
      return { rows: r.rows as any[], rowCount: r.rows.length || (r.affectedRows ?? 0) }
    },
  }
  return {
    ...exec,
    async tx(fn) {
      await pg.query('begin')
      try { const out = await fn(exec); await pg.query('commit'); return out }
      catch (e) { await pg.query('rollback'); throw e }
    },
  }
}

export interface Mundo { pg: PGlite; db: Db }

/** Cria o banco com o schema legado + todos os arquivos db/v2/*.sql. */
export async function criarMundo(): Promise<Mundo> {
  const pg = new PGlite()
  await pg.exec(readFileSync(raiz('db/schema.sql'), 'utf8'))
  for (const f of readdirSync(raiz('db/v2')).filter((n) => n.endsWith('.sql')).sort()) await pg.exec(readFileSync(raiz(`db/v2/${f}`), 'utf8'))
  return { pg, db: dbPglite(pg) }
}

export type Papel = 'colaborador' | 'gestor' | 'rh' | 'diretoria' | 'admin'
export interface PessoaSemente {
  id: string; nome: string; papel: Papel; setorId?: string; cargoId?: string; responsavelId?: string; status?: string; email?: string
  [k: string]: unknown
}

export async function semear(m: Mundo, dados: { pessoas?: PessoaSemente[]; setores?: any[]; cargos?: any[]; unidades?: any[]; extras?: Record<string, any[]> }) {
  const grava = async (colecao: string, itens: any[]) => {
    await m.pg.query(`delete from ${tabela(colecao)}`)
    for (let i = 0; i < itens.length; i++) await m.pg.query(`insert into ${tabela(colecao)} (ord, id, dados) values ($1,$2,$3::jsonb)`, [i, itens[i].id, JSON.stringify(itens[i])])
  }
  const gente = (dados.pessoas ?? []).map((p) => ({
    status: 'ativo', email: `${p.id}@teste.local`, setorId: 's1', cargoId: 'g1', telefone: '', avatarCor: '#888', regime: 'PJ', ...p,
  }))
  await grava('colaboradores', gente)
  if (dados.setores) await grava('setores', dados.setores)
  if (dados.cargos) await grava('cargos', dados.cargos)
  if (dados.unidades) await grava('unidades', dados.unidades)
  for (const [k, v] of Object.entries(dados.extras ?? {})) if ((COLECOES as readonly string[]).includes(k)) await grava(k, v)
  // Um usuário de login por pessoa (o cookie é emitido sem passar por senha).
  for (const p of gente) {
    await m.pg.query("insert into usuarios (id, email, senha_hash, colaborador_id, papel) values (gen_random_uuid(), $1, 'x', $2, 'x') on conflict do nothing", [p.email, p.id])
  }
}

/** Cookie de sessão válido para a pessoa (precisa ter sido semeada). */
export async function cookieDe(m: Mundo, colaboradorId: string): Promise<string> {
  const r = await m.pg.query<{ id: string }>('select id from usuarios where colaborador_id = $1', [colaboradorId])
  if (!r.rows[0]) throw new Error(`Pessoa não semeada: ${colaboradorId}`)
  return emitirCookie({ uid: r.rows[0].id, colaboradorId }, false).split(';')[0]
}

export interface Chamada { corpo?: unknown; cookie?: string; query?: Record<string, string>; ip?: string; csrf?: boolean }

/** Executa uma rota como a função serverless faria. `caminho` sem o prefixo /api/v2. */
export async function chamar(m: Mundo, metodo: string, caminho: string, c: Chamada = {}): Promise<Res & { json: any }> {
  const [path, qs] = caminho.split('?')
  const req: Req = {
    metodo,
    caminho: path.split('/').filter(Boolean),
    query: { ...Object.fromEntries(new URLSearchParams(qs ?? '')), ...(c.query ?? {}) },
    corpo: c.corpo ?? {},
    cookie: c.cookie,
    ip: c.ip ?? '10.0.0.1',
    seguro: false,
    cabecalhos: c.csrf === false ? {} : { 'x-requested-with': '4juris' },
  }
  const out = await despachar({ db: m.db, rotas: ROTAS, lerSessao }, req)
  return Object.assign(out, { json: out.corpo as any })
}

export const GET = (m: Mundo, caminho: string, cookie?: string, query?: Record<string, string>) => chamar(m, 'GET', caminho, { cookie, query })
export const POST = (m: Mundo, caminho: string, cookie: string | undefined, corpo?: unknown) => chamar(m, 'POST', caminho, { cookie, corpo })
export const PUT = (m: Mundo, caminho: string, cookie: string | undefined, corpo?: unknown) => chamar(m, 'PUT', caminho, { cookie, corpo })
export const PATCH = (m: Mundo, caminho: string, cookie: string | undefined, corpo?: unknown) => chamar(m, 'PATCH', caminho, { cookie, corpo })
export const DEL = (m: Mundo, caminho: string, cookie: string | undefined) => chamar(m, 'DELETE', caminho, { cookie })

/** Organização mínima para os testes: duas áreas, três funções, pessoas de todos os papéis. */
export const ORG_BASE = {
  pessoas: [
    { id: 'admin1', nome: 'Ana Admin', papel: 'admin' as const },
    { id: 'rh1', nome: 'Rita RH', papel: 'rh' as const },
    { id: 'rec1', nome: 'Rui Recrutador', papel: 'colaborador' as const },
    { id: 'ger1', nome: 'Gil Gestor', papel: 'gestor' as const, setorId: 's1' },
    { id: 'ger2', nome: 'Gabi Gestora', papel: 'gestor' as const, setorId: 's2' },
    { id: 'col1', nome: 'Caio Colaborador', papel: 'colaborador' as const, setorId: 's1', responsavelId: 'ger1' },
    { id: 'col2', nome: 'Duda Colaboradora', papel: 'colaborador' as const, setorId: 's2', responsavelId: 'ger2' },
    { id: 'dir1', nome: 'Davi Diretor', papel: 'diretoria' as const },
  ],
  setores: [
    { id: 's1', nome: 'Jurídico', gestorId: 'ger1', liderancaIds: ['ger1'], descricao: '', cor: '#123', icon: 'Scale', reembolsoApenasLideranca: false },
    { id: 's2', nome: 'Comercial', gestorId: 'ger2', liderancaIds: ['ger2'], descricao: '', cor: '#321', icon: 'Briefcase', reembolsoApenasLideranca: false },
  ],
  cargos: [
    { id: 'g1', nome: 'Advogado(a)', setorId: 's1', nivel: 'Pleno' },
    { id: 'g2', nome: 'Executivo(a) de contas', setorId: 's2', nivel: 'Sênior' },
  ],
  unidades: [{ id: 'u1', nome: 'Matriz' }],
}

/** Cria o mundo já com a organização base e a função de recrutador para `rec1`. */
export async function mundoPadrao(): Promise<Mundo & { c: Record<string, string> }> {
  const m = await criarMundo()
  await semear(m, ORG_BASE)
  await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('rec1','recrutador')")
  const c: Record<string, string> = {}
  for (const p of ORG_BASE.pessoas) c[p.id] = await cookieDe(m, p.id)
  return Object.assign(m, { c })
}
