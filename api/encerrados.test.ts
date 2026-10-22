/* Parceria encerrada perde o acesso em todos os caminhos (login, /api/estado e API v2), mesmo com o login ainda ativo. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, GET, type Mundo } from './_v2/teste/harness'
import { hashSenha } from './_lib'

let m: Mundo
vi.mock('./_lib.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./_lib.js')>()
  const pool = () => {
    const d = dbPglite(m.pg)
    return { query: d.query, connect: async () => ({ query: d.query, release() {} }) }
  }
  return { ...real, db: pool }
})
const { default: handler } = await import('./[acao]')

async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string) {
  const cab: Record<string, string> = { 'x-forwarded-for': '10.4.0.1', 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, corpo: '', setHeader() {}, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}
const encerrar = (id: string) => m.pg.query(`update app_colaboradores set dados = dados || '{"status":"encerrado","encerramento":{"data":"2026-10-01","motivoId":"m1"}}'::jsonb where id = $1`, [id])

let cookie: string
beforeEach(async () => {
  m = await criarMundo()
  await semear(m, ORG_BASE)
  cookie = await cookieDe(m, 'ger1')
  await m.pg.query("update usuarios set senha_hash = $1 where colaborador_id = 'ger1'", [hashSenha('senha-forte-123')])
})

describe('parceria encerrada', () => {
  it('antes do encerramento, entra e lê o estado', async () => {
    expect((await chamar('login', 'POST', { email: 'ger1@teste.local', senha: 'senha-forte-123' })).status).toBe(200)
    expect((await chamar('estado', 'GET', undefined, cookie)).status).toBe(200)
  })

  it('depois do encerramento, o login é recusado', async () => {
    await encerrar('ger1')
    const r = await chamar('login', 'POST', { email: 'ger1@teste.local', senha: 'senha-forte-123' })
    expect(r.status).toBe(403)
    expect(r.json.erro).toMatch(/encerrada/)
  })

  it('a sessão aberta perde o acesso ao /api/estado e à API v2', async () => {
    await encerrar('ger1')
    expect((await chamar('estado', 'GET', undefined, cookie)).status).toBe(401)
    expect((await chamar('estado', 'PUT', { ops: {} }, cookie)).status).toBe(401)
    expect((await chamar('usuarios', 'GET', undefined, cookie)).status).toBe(401)
    expect((await GET(m, 'eu', cookie)).status).toBe(401)
  })

  it('reativar a parceria devolve o acesso', async () => {
    await encerrar('ger1')
    await m.pg.query(`update app_colaboradores set dados = (dados - 'encerramento') || '{"status":"ativo"}'::jsonb where id = 'ger1'`)
    expect((await chamar('estado', 'GET', undefined, cookie)).status).toBe(200)
  })
})
