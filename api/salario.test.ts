/* Salário individual × valor padrão da função: o padrão preenche quem está "a definir"; cada pessoa pode ter o próprio valor. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, GET, POST, type Mundo } from './_v2/teste/harness'
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
  const cab: Record<string, string> = { 'x-forwarded-for': '10.6.0.1', 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, corpo: '', setHeader() {}, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}
async function editar(cookie: string, mudar: (e: Obj) => void) {
  const lido = await chamar('estado', 'GET', undefined, cookie)
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
const valorDe = async (pessoa: string) => Number((await m.pg.query('select valor from fin_contratos where prestador_id = $1', [pessoa])).rows[0]?.valor)

let c: Record<string, string>
beforeEach(async () => {
  m = await criarMundo()
  await semear(m, {
    ...ORG_BASE,
    // col1 e col2 na mesma função (g1, padrão 5000); ger2 em g2 (sem padrão). CPF só para gerar o fornecedor do contrato-base.
    pessoas: ORG_BASE.pessoas.map((p, i) => ({ ...p, regime: 'autonomo', cpf: String(10000000000 + i), ...(p.id === 'ger2' ? { cargoId: 'g2' } : {}) })),
    cargos: [{ ...ORG_BASE.cargos[0], valorPadrao: 5000 }, ORG_BASE.cargos[1]],
  })
  c = {}
  for (const p of ORG_BASE.pessoas) c[p.id] = await cookieDe(m, p.id)
  expect((await POST(m, 'financeiro/contratos-base', c.rh1)).status).toBe(200)
}, 60_000)

describe('salário × padrão da função', () => {
  it('o contrato-base nasce com o padrão da função; função sem padrão fica "a definir"', async () => {
    expect(await valorDe('col1')).toBe(5000)
    expect(await valorDe('col2')).toBe(5000)
    expect(await valorDe('ger2')).toBe(0)
  })

  it('ganhar uma função com padrão preenche o salário "a definir"; trocar de função não mexe em valor já definido', async () => {
    await m.pg.query("update fin_contratos set valor = 0 where prestador_id = 'rec1'")
    await m.pg.query(`update app_colaboradores set dados = dados || '{"cargoId":"g2"}'::jsonb where id = 'rec1'`)
    expect((await editar(c.rh1, (e) => { e.colaboradores.find((p: Obj) => p.id === 'rec1').cargoId = 'g1' })).status).toBe(200)
    expect(await valorDe('rec1')).toBe(5000)
    // col1 já tem 5000; ir para g2 (sem padrão) não zera nem troca.
    expect((await editar(c.rh1, (e) => { e.colaboradores.find((p: Obj) => p.id === 'col1').cargoId = 'g2' })).status).toBe(200)
    expect(await valorDe('col1')).toBe(5000)
  })

  it('definir o padrão da função preenche só quem está "a definir"', async () => {
    await m.pg.query(`update app_colaboradores set dados = dados || '{"cargoId":"g2"}'::jsonb where id in ('col1', 'col2')`)
    await m.pg.query("update fin_contratos set valor = 0 where prestador_id = 'col1'")
    await m.pg.query("update fin_contratos set valor = 7000 where prestador_id = 'col2'")
    expect((await editar(c.rh1, (e) => { e.cargos.find((x: Obj) => x.id === 'g2').valorPadrao = 6000 })).status).toBe(200)
    expect(await valorDe('col1')).toBe(6000)
    expect(await valorDe('col2')).toBe(7000) // valor individual preservado
  })

  it('cada pessoa tem o próprio valor: ajuste na ficha vira aditivo com histórico', async () => {
    const sem = await POST(m, 'pessoas/col2/salario', c.rh1, { valor: 6500, vigenciaInicio: '2026-11-01' })
    expect(sem.status).toBe(400) // valor já definido: motivo obrigatório
    expect((await POST(m, 'pessoas/col2/salario', c.rh1, { valor: 6500, vigenciaInicio: '2026-11-01', motivo: 'Negociação individual' })).status).toBe(200)
    expect(await valorDe('col2')).toBe(6500)
    expect(await valorDe('col1')).toBe(5000) // mesma função, valor diferente
    const s = (await GET(m, 'pessoas/col2/salario', c.rh1)).json
    expect(s).toMatchObject({ cargo: { id: 'g1', valorPadrao: 5000 }, contrato: { valor: 6500 } })
    expect(s.historico[0]).toMatchObject({ valorAnterior: 5000, valorNovo: 6500, motivo: 'Negociação individual', vigenciaInicio: '2026-11-01' })
    // O espelho lido pelas telas antigas acompanha.
    expect(Number((await m.pg.query("select dados->>'valorMensal' v from app_contratos where dados->>'colaboradorId' = 'col2'")).rows[0].v)).toBe(6500)
  })

  it('primeira definição de quem está "a definir" não exige motivo', async () => {
    expect(await valorDe('ger2')).toBe(0)
    expect((await POST(m, 'pessoas/ger2/salario', c.rh1, { valor: 9000 })).status).toBe(200)
    expect(await valorDe('ger2')).toBe(9000)
  })

  it('salário e padrão são restritos', async () => {
    expect((await POST(m, 'pessoas/col2/salario', c.ger1, { valor: 1, motivo: 'tentativa' })).status).toBe(403)
    expect((await GET(m, 'pessoas/col2/salario', c.col1)).status).toBe(403)
    const cargo = async (id: string) => (await chamar('estado', 'GET', undefined, c[id])).json.estado.cargos.find((x: Obj) => x.id === 'g1')
    expect((await cargo('col1')).valorPadrao).toBeUndefined()
    expect((await cargo('rh1')).valorPadrao).toBe(5000)
  })
})
