/* Integridade entre módulos (auditoria de 2026-10-22): referências de estrutura, reembolso decidido e dados salariais. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, GET, type Mundo } from './_v2/teste/harness'
import { diferenca, type OpsColecao } from '../src/domain/sincronia'

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

type Obj = Record<string, any>
async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string) {
  const cab: Record<string, string> = { 'x-forwarded-for': '10.5.0.1', 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, corpo: '', setHeader() {}, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}
async function editar(cookie: string, mudar: (e: Obj) => void) {
  const lido = await chamar('estado', 'GET', undefined, cookie)
  expect(lido.status).toBe(200)
  const estado = lido.json.estado as Obj
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
const ids = async (colecao: string) => (await m.pg.query<{ id: string }>(`select id from app_${colecao.toLowerCase()} order by ord`)).rows.map((r) => r.id)

let c: Record<string, string>
beforeEach(async () => {
  m = await criarMundo()
  await semear(m, {
    ...ORG_BASE,
    pessoas: [...ORG_BASE.pessoas, { id: 'ex1', nome: 'Ex Parceira', papel: 'colaborador' as const, setorId: 's2', cargoId: 'g3', status: 'encerrado' }],
    cargos: [...ORG_BASE.cargos,
      { id: 'g3', nome: 'Função de quem saiu', setorId: 's2', nivel: 'Pleno' },
      { id: 'g4', nome: 'Função sem uso', setorId: 's2', nivel: 'Pleno', faixaValor: { min: 1000, max: 2000, visivel: true } },
      { id: 'g5', nome: 'Função com faixa v2', setorId: 's2', nivel: 'Pleno' },
      { id: 'g6', nome: 'Função do s3', setorId: 's3', nivel: 'Pleno' }],
    setores: [...ORG_BASE.setores, { id: 's3', nome: 'Vazio', gestorId: null, liderancaIds: [], descricao: '', cor: '#000', icon: 'X', reembolsoApenasLideranca: false }],
    extras: {
      reembolsos: [{ id: 'r1', colaboradorId: 'col1', categoria: 'Deslocamento', descricao: 'Uber', valor: 50, data: '2026-10-01', status: 'pendente', criadoEm: '2026-10-01' }],
    },
  })
  await m.pg.query("insert into cg_faixas (cargo_id, minimo, maximo, vigencia_inicio, status) values ('g5', 1000, 2000, '2026-01-01', 'vigente')")
  c = {}
  for (const p of ORG_BASE.pessoas) c[p.id] = await cookieDe(m, p.id)
}, 60_000)

describe('remoção de função e departamento preserva as referências', () => {
  it('função usada por pessoa encerrada não é removida', async () => {
    const r = await editar(c.rh1, (e) => { e.cargos = e.cargos.filter((x: Obj) => x.id !== 'g3') })
    expect(r.status).toBe(409)
    expect(r.json.erro).toMatch(/pessoa/)
    expect(await ids('cargos')).toContain('g3')
  })
  it('função com faixa na Arquitetura de cargos não é removida', async () => {
    const r = await editar(c.rh1, (e) => { e.cargos = e.cargos.filter((x: Obj) => x.id !== 'g5') })
    expect(r.status).toBe(409)
    expect(r.json.erro).toMatch(/Arquitetura de cargos/)
  })
  it('função sem nenhum vínculo é removida', async () => {
    expect((await editar(c.rh1, (e) => { e.cargos = e.cargos.filter((x: Obj) => x.id !== 'g4') })).status).toBe(200)
    expect(await ids('cargos')).not.toContain('g4')
  })
  it('departamento só sai com as funções dele se nada as usa', async () => {
    // s2: tem pessoa ativa (col2), pessoa encerrada e funções em uso.
    const r = await editar(c.rh1, (e) => { e.setores = e.setores.filter((x: Obj) => x.id !== 's2'); e.cargos = e.cargos.filter((x: Obj) => x.setorId !== 's2') })
    expect(r.status).toBe(409)
    // s3: vazio, com uma função sem uso — sai junto (como removerSetor faz).
    const ok = await editar(c.rh1, (e) => { e.setores = e.setores.filter((x: Obj) => x.id !== 's3'); e.cargos = e.cargos.filter((x: Obj) => x.setorId !== 's3') })
    expect(ok.status).toBe(200)
    expect(await ids('cargos')).not.toContain('g6')
  })
  it('departamento não pode sair deixando uma função dele para trás', async () => {
    const r = await editar(c.rh1, (e) => { e.setores = e.setores.filter((x: Obj) => x.id !== 's3') })
    expect(r.status).toBe(409)
    expect(r.json.erro).toMatch(/função/)
  })
})

describe('reembolso', () => {
  it('o financeiro registra pedido de terceiro, mas sempre pendente', async () => {
    const novo = { id: 'r9', colaboradorId: 'col2', categoria: 'Deslocamento', descricao: 'Táxi', valor: 70, data: '2026-10-02', criadoEm: '2026-10-02' }
    expect((await editar(c.rh1, (e) => { e.reembolsos.push({ ...novo, status: 'aprovado', aprovadorId: 'rh1', aprovadoEm: '2026-10-02' }) })).status).toBe(403)
    expect((await editar(c.rh1, (e) => { e.reembolsos.push({ ...novo, status: 'pendente' }) })).status).toBe(200)
  })
  it('depois de aprovado, o valor não muda', async () => {
    expect((await editar(c.rh1, (e) => { Object.assign(e.reembolsos.find((x: Obj) => x.id === 'r1'), { valor: 60 }) })).status).toBe(200) // pendente: corrige
    expect((await editar(c.rh1, (e) => { Object.assign(e.reembolsos.find((x: Obj) => x.id === 'r1'), { status: 'aprovado', aprovadorId: 'rh1', aprovadoEm: '2026-10-03' }) })).status).toBe(200)
    const r = await editar(c.rh1, (e) => { Object.assign(e.reembolsos.find((x: Obj) => x.id === 'r1'), { valor: 300 }) })
    expect(r.status).toBe(403)
    expect((await m.pg.query("select dados->>'valor' v from app_reembolsos where id = 'r1'")).rows[0].v).toBe('60')
  })
})

describe('dados salariais', () => {
  it('faixa legada "visível" chega só a quem exerce a função', async () => {
    await m.pg.query(`update app_colaboradores set dados = dados || '{"cargoId":"g4"}'::jsonb where id = 'col2'`)
    const de = async (id: string) => (await chamar('estado', 'GET', undefined, c[id])).json.estado.cargos.find((x: Obj) => x.id === 'g4')
    expect((await de('col1')).faixaValor).toBeUndefined()
    expect((await de('col2')).faixaValor).toMatchObject({ min: 1000, max: 2000 })
    expect((await de('rh1')).faixaValor).toBeDefined()
  })
  it('comparativo de faixas oculta a posição em grupos pequenos para quem não vê contratos', async () => {
    await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('col1', 'analista_rh')")
    await m.pg.query(`update app_colaboradores set dados = dados || '{"cargoId":"g5"}'::jsonb where id = 'col2'`)
    await m.pg.query(`insert into app_contratos (ord, id, dados) values (0, 'k1', '{"id":"k1","colaboradorId":"col2","valorMensal":1500,"status":"vigente"}'::jsonb)`)
    const linha = async (id: string) => (await GET(m, 'cargos/faixas/comparativo', c[id])).json.cargos.find((x: Obj) => x.cargoId === 'g5')
    expect(await linha('col1')).toMatchObject({ suprimido: true, dentro: null })
    expect(await linha('rh1')).toMatchObject({ dentro: 1 })
  })
})
