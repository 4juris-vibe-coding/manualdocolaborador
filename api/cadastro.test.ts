/* Cadastro por link: a pessoa se cadastra, fica aguardando, e só entra depois da aprovação. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, type Mundo } from './_v2/teste/harness'

let m: Mundo
vi.mock('./_lib.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./_lib.js')>()
  const pool = () => {
    const d = dbPglite(m.pg)
    return { query: d.query, connect: async () => ({ query: d.query, release() {} }) }
  }
  return { ...real, db: pool, enviarEmail: async () => undefined }
})
const { default: handler } = await import('./[acao]')

let ip = 0
async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string, qs = '') {
  const cab: Record<string, string> = { 'x-forwarded-for': `10.1.0.${++ip}`, 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}${qs}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, cabecalhos: {} as Record<string, string>, corpo: '', setHeader(k: string, v: string) { this.cabecalhos[k] = v }, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}'), cookie: res.cabecalhos['Set-Cookie'] }
}

describe('cadastro por link e aprovação', () => {
  let admin: string, rh: string, col: string
  beforeEach(async () => {
    m = await criarMundo()
    await semear(m, ORG_BASE)
    admin = await cookieDe(m, 'admin1'); rh = await cookieDe(m, 'rh1'); col = await cookieDe(m, 'col1')
  })

  it('fluxo completo: link → cadastro → aguardando → aprovado → login', async () => {
    expect((await chamar('convites', 'POST', { acao: 'gerar' }, col)).status).toBe(403)
    const { json: { convite } } = await chamar('convites', 'POST', { acao: 'gerar' }, admin)
    expect(convite.token).toBeTruthy()
    expect((await chamar('convite', 'GET', undefined, undefined, `?token=${convite.token}`)).json.valido).toBe(true)

    const dados = { token: convite.token, nome: 'Nina Nova', email: 'Nina@Exemplo.com', senha: 'senha-forte-123' }
    expect((await chamar('cadastro', 'POST', dados)).status).toBe(200)
    expect((await chamar('cadastro', 'POST', dados)).json.erro).toMatch(/aguardando aprovação/)

    const pendente = await chamar('login', 'POST', { email: 'nina@exemplo.com', senha: 'senha-forte-123' })
    expect(pendente.status).toBe(403)
    expect(pendente.json.erro).toMatch(/aguardando aprovação/)
    expect((await chamar('login', 'POST', { email: 'nina@exemplo.com', senha: 'senha-errada-99' })).status).toBe(401)

    const lista = (await chamar('solicitacoes', 'GET', undefined, admin)).json.solicitacoes
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ nome: 'Nina Nova', email: 'nina@exemplo.com', status: 'pendente' })
    expect(lista[0]).not.toHaveProperty('senha_hash')

    // A interface cria o cadastro da pessoa antes de aprovar.
    await m.pg.query("insert into app_colaboradores (ord, id, dados) values (99, 'nina', $1::jsonb)", [JSON.stringify({ id: 'nina', nome: 'Nina Nova', email: 'nina@exemplo.com', papel: 'colaborador', status: 'ativo' })])
    expect((await chamar('solicitacoes', 'POST', { id: lista[0].id, acao: 'aprovar', colaboradorId: 'col2' }, admin)).json.erro).toMatch(/não confere/)
    expect((await chamar('solicitacoes', 'POST', { id: lista[0].id, acao: 'aprovar', colaboradorId: 'nina' }, rh)).status).toBe(200)
    expect((await chamar('solicitacoes', 'POST', { id: lista[0].id, acao: 'aprovar', colaboradorId: 'nina' }, rh)).status).toBe(404)

    const ok = await chamar('login', 'POST', { email: 'nina@exemplo.com', senha: 'senha-forte-123' })
    expect(ok.status).toBe(200)
    expect(ok.json.colaboradorId).toBe('nina')
    expect((await chamar('cadastro', 'POST', { ...dados, email: 'nina@exemplo.com' })).json.erro).toMatch(/já tem acesso/)
  })

  it('recusa, link revogado e RH sem poder liberar perfis de gestão', async () => {
    const { json: { convite } } = await chamar('convites', 'POST', { acao: 'gerar' }, rh)
    await chamar('cadastro', 'POST', { token: convite.token, nome: 'Rafa Recusado', email: 'rafa@x.com', senha: 'senha-forte-123' })
    await chamar('cadastro', 'POST', { token: convite.token, nome: 'Dani Diretora', email: 'dani@x.com', senha: 'senha-forte-123' })
    const [dani, rafa] = (await chamar('solicitacoes', 'GET', undefined, admin)).json.solicitacoes

    expect((await chamar('solicitacoes', 'POST', { id: rafa.id, acao: 'recusar' }, admin)).status).toBe(200)
    expect((await chamar('login', 'POST', { email: 'rafa@x.com', senha: 'senha-forte-123' })).json.erro).toMatch(/não foi aprovado/)

    await m.pg.query("insert into app_colaboradores (ord, id, dados) values (99, 'dani', $1::jsonb)", [JSON.stringify({ id: 'dani', nome: 'Dani', email: 'dani@x.com', papel: 'diretoria', status: 'ativo' })])
    expect((await chamar('solicitacoes', 'POST', { id: dani.id, acao: 'aprovar', colaboradorId: 'dani' }, rh)).status).toBe(403)
    expect((await chamar('solicitacoes', 'POST', { id: dani.id, acao: 'aprovar', colaboradorId: 'dani' }, admin)).status).toBe(200)

    // Gerar um novo link invalida o anterior; desativar deixa sem link.
    const novo = (await chamar('convites', 'POST', { acao: 'gerar' }, admin)).json.convite
    expect((await chamar('convite', 'GET', undefined, undefined, `?token=${convite.token}`)).json.valido).toBe(false)
    expect((await chamar('cadastro', 'POST', { token: convite.token, nome: 'Tarde Demais', email: 't@x.com', senha: 'senha-forte-123' })).status).toBe(400)
    expect((await chamar('convites', 'GET', undefined, admin)).json.convite.token).toBe(novo.token)
    await chamar('convites', 'POST', { acao: 'revogar' }, admin)
    expect((await chamar('convites', 'GET', undefined, admin)).json.convite).toBeNull()
  })
})
