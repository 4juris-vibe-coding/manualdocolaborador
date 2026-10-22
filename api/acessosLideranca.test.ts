/* Liderança cria acessos: cadastra colaboradores e cria/envia o login só nas áreas que lidera. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, type Mundo } from './_v2/teste/harness'
import { diferenca, type OpsColecao } from '../src/domain/sincronia'

let m: Mundo
vi.mock('./_lib.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./_lib.js')>()
  const pool = () => {
    const d = dbPglite(m.pg)
    return { query: d.query, connect: async () => ({ query: d.query, release() {} }) }
  }
  return { ...real, db: pool, enviarEmail: async () => ({ status: 'enviado' }), enviarBoasVindas: async () => ({ status: 'enviado' }) }
})
const { default: handler } = await import('./[acao]')

type Obj = Record<string, any>
async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string) {
  const cab: Record<string, string> = { 'x-forwarded-for': '10.3.0.1', 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, cabecalhos: {} as Record<string, string>, corpo: '', setHeader(k: string, v: string) { this.cabecalhos[k] = v }, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}
/** Lê o estado, aplica a mudança e envia só as diferenças (como o navegador). */
async function editar(cookie: string, mudar: (e: Obj) => void) {
  const lido = await chamar('estado', 'GET', undefined, cookie)
  expect(lido.status, JSON.stringify(lido.json)).toBe(200)
  const { estado } = lido.json as { estado: Obj }
  const antes = JSON.parse(JSON.stringify(estado))
  mudar(estado)
  const ops: Record<string, OpsColecao> = {}
  for (const k of Object.keys(estado)) {
    if (k === 'config') continue
    const d = diferenca(k, antes[k], estado[k])
    if (d) ops[k] = d
  }
  return chamar('estado', 'PUT', { ops }, cookie)
}
const pessoa = (id: string, extra: Obj = {}) => ({ id, nome: 'Nova Pessoa', email: `${id}@teste.local`, papel: 'colaborador', setorId: 's1', cargoId: 'g1', status: 'integracao',
  dataEntrada: '2026-10-22', regime: 'autonomo', telefone: '', cidade: '', uf: '', avatarCor: '#888', responsavelId: 'ger1',
  privacidade: { mostrarAniversario: false, mostrarMarcos: true, aparecerEmDestaques: false }, ...extra })

let c: Record<string, string>
beforeEach(async () => {
  m = await criarMundo()
  const pessoas = [...ORG_BASE.pessoas, { id: 'fin1', nome: 'Fabi Financeiro', papel: 'financeiro' as const }]
  await semear(m, { ...ORG_BASE, pessoas })
  c = {}
  for (const p of pessoas) c[p.id] = await cookieDe(m, p.id)
  // col1 ainda sem login (o harness cria um login por pessoa).
  await m.pg.query("delete from usuarios where colaborador_id = 'col1'")
})

describe('liderança cria acessos da equipe', () => {
  it('envia acesso só para colaboradores das áreas que lidera', async () => {
    const ok = await chamar('enviar-acesso', 'POST', { colaboradorIds: ['col1'] }, c.ger1)
    expect(ok.status).toBe(200)
    expect(ok.json.resultados[0]).toMatchObject({ colaboradorId: 'col1', status: 'enviado' })
    expect((await m.pg.query("select 1 from usuarios where colaborador_id = 'col1'")).rows.length).toBe(1)
    expect((await chamar('enviar-acesso', 'POST', { colaboradorIds: ['col2'] }, c.ger1)).status).toBe(403)
    expect((await chamar('enviar-acesso', 'POST', { colaboradorIds: ['rh1'] }, c.ger1)).status).toBe(403)
    // Colaborador sem liderança não gerencia acessos; solicitações e link de cadastro seguem só com RH/admin.
    expect((await chamar('enviar-acesso', 'POST', { colaboradorIds: ['col1'] }, c.col2)).status).toBe(403)
    expect((await chamar('convites', 'GET', undefined, c.ger1)).status).toBe(403)
    expect((await chamar('solicitacoes', 'GET', undefined, c.ger1)).status).toBe(403)
  })

  it('lista, cria, desativa e reativa só dentro da equipe', async () => {
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'col1', senha: 'senha-forte-123' }, c.ger1)).json).toMatchObject({ ok: true, criado: true })
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'col2', senha: 'senha-forte-123' }, c.ger1)).status).toBe(403)
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'ger2', ativo: false }, c.ger1)).status).toBe(403)
    const lista = (await chamar('usuarios', 'GET', undefined, c.ger1)).json.acessos as { colaboradorId: string }[]
    // Só colaboradores de s1 (col1 e rec1); nada de s2, de gestores ou de outros papéis.
    expect(lista.map((a) => a.colaboradorId).sort()).toEqual(['col1', 'rec1'])
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'col1', ativo: false }, c.ger1)).status).toBe(200)
    expect((await m.pg.query("select ativo from usuarios where colaborador_id = 'col1'")).rows[0].ativo).toBe(false)
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'col1', ativo: true }, c.ger1)).status).toBe(200)
    // RH continua gerenciando colaboradores e gestores; o papel financeiro é só da administração.
    expect((await chamar('usuarios', 'GET', undefined, c.rh1)).json.acessos.length).toBeGreaterThan(1)
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'fin1', ativo: false }, c.rh1)).status).toBe(403)
    expect((await chamar('usuarios', 'POST', { colaboradorId: 'fin1', ativo: false }, c.admin1)).status).toBe(200)
  })

  it('cadastra colaborador na própria área; outra área, outro papel ou dado sensível são recusados', async () => {
    const r = await editar(c.ger1, (e) => { e.colaboradores.push(pessoa('novo1')) })
    expect(r.status).toBe(200)
    expect((await m.pg.query("select dados->>'setorId' as s from app_colaboradores where id = 'novo1'")).rows[0].s).toBe('s1')
    expect((await editar(c.ger1, (e) => { e.colaboradores.push(pessoa('novo2', { setorId: 's2', cargoId: 'g2' })) })).status).toBe(403)
    expect((await editar(c.ger1, (e) => { e.colaboradores.push(pessoa('novo3', { papel: 'gestor' })) })).status).toBe(403)
    expect((await editar(c.ger1, (e) => { e.colaboradores.push(pessoa('novo4', { banco: '341', conta: '1-2' })) })).status).toBe(403)
    expect((await editar(c.rec1, (e) => { e.colaboradores.push(pessoa('novo5')) })).status).toBe(403)
    // E depois envia o acesso de quem cadastrou.
    expect((await chamar('enviar-acesso', 'POST', { colaboradorIds: ['novo1'] }, c.ger1)).json.resultados[0].status).toBe('enviado')
  })
})
