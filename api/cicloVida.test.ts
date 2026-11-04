/* Ciclo de vida no SERVIDOR (/api/estado): o RH não consegue, nem por requisição manual,
   apagar o histórico de movimentações, gravar períodos incoerentes ou duplicar o checklist
   de encerramento; e a pessoa encerrada recebe a mensagem cordial no login. */
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { criarMundo, cookieDe, dbPglite, semear, ORG_BASE, type Mundo } from './_v2/teste/harness'
import { diferenca, type OpsColecao } from '../src/domain/sincronia'
import { hashSenha } from './_lib'

let m: Mundo
vi.mock('./_lib.js', async (importOriginal) => {
  const real = await importOriginal<typeof import('./_lib.js')>()
  const pool = () => {
    const d = dbPglite(m.pg)
    return { query: d.query, connect: async () => ({ query: d.query, release() {} }) }
  }
  return { ...real, db: pool, enviarEmail: async () => undefined }
})
const { default: handler, MSG_PARCERIA_ENCERRADA } = await import('./[acao]')

type Obj = Record<string, any>
async function chamar(acao: string, metodo: string, corpo?: unknown, cookie?: string) {
  const cab: Record<string, string> = { 'x-forwarded-for': '10.7.0.1', 'x-requested-with': '4juris' }
  if (cookie) cab.cookie = cookie
  const req = { method: metodo, url: `/api/${acao}`, headers: cab, socket: {}, query: { acao }, body: corpo ?? {} }
  const res = { statusCode: 0, corpo: '', setHeader() {}, end(c: string) { this.corpo = c } }
  await handler(req as never, res as never)
  return { status: res.statusCode, json: JSON.parse(res.corpo || '{}') }
}
async function editar(cookie: string, mudar: (e: Obj) => void) {
  const { estado } = (await chamar('estado', 'GET', undefined, cookie)).json as { estado: Obj }
  const antes = JSON.parse(JSON.stringify(estado))
  mudar(estado)
  const ops: Record<string, OpsColecao> = {}
  for (const k of Object.keys(estado)) { if (k === 'config') continue; const d = diferenca(k, antes[k] ?? [], estado[k] ?? []); if (d) ops[k] = d }
  return chamar('estado', 'PUT', { ops }, cookie)
}
const pessoa = (e: Obj, id: string) => (e.colaboradores as Obj[]).find((c) => c.id === id)!
const ENC = { data: '2026-10-15', motivoId: 'm1', iniciativa: 'empresa' }
const encerrarComHistorico = (e: Obj) => {
  const c = pessoa(e, 'col1')
  Object.assign(c, {
    status: 'encerrado', encerramento: ENC,
    dataEntrada: '2026-01-05', vinculos: [{ id: 'v1', inicio: '2026-01-05', fim: ENC.data, motivoId: 'm1', iniciativa: 'empresa' }],
    movimentacoes: [{ id: 'mv1', tipo: 'encerramento', em: '2026-11-04T10:00:00Z', vinculoId: 'v1', dataEfetiva: ENC.data }],
  })
}

let rh: string
beforeEach(async () => {
  m = await criarMundo()
  await semear(m, ORG_BASE)
  rh = await cookieDe(m, 'rh1')
})

describe('ciclo de vida no servidor', () => {
  it('aceita o encerramento coerente e preserva a data efetiva em edições posteriores', async () => {
    const r0 = await editar(rh, encerrarComHistorico)
    expect(r0.json.erro ?? r0.status).toBe(200)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').telefone = '11999990000' })).status).toBe(200)
    const { estado } = (await chamar('estado', 'GET', undefined, rh)).json
    expect(pessoa(estado, 'col1').encerramento.data).toBe('2026-10-15')
  })

  it('recusa apagar ou reescrever o histórico de movimentações', async () => {
    await editar(rh, encerrarComHistorico)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').movimentacoes = [] })).status).toBe(409)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').movimentacoes[0].dataEfetiva = '2026-11-04' })).status).toBe(409)
  })

  it('recusa data de encerramento divergente do período e períodos sobrepostos', async () => {
    await editar(rh, encerrarComHistorico)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').encerramento.data = '2026-11-04' })).status).toBe(400)
    const r = await editar(rh, (e) => {
      const c = pessoa(e, 'col1')
      c.status = 'ativo'; delete c.encerramento
      c.vinculos.push({ id: 'v2', inicio: '2026-10-01' })
      c.movimentacoes.push({ id: 'mv2', tipo: 'novo_vinculo', em: '2026-11-04T11:00:00Z', vinculoId: 'v2', dataEfetiva: '2026-10-01' })
    })
    expect(r.status).toBe(400)
  })

  it('reabrir a parceria sem registrar a movimentação é recusado', async () => {
    await editar(rh, encerrarComHistorico)
    const r = await editar(rh, (e) => { const c = pessoa(e, 'col1'); c.status = 'ativo'; delete c.encerramento; delete c.vinculos[0].fim })
    expect(r.status).toBe(400)
  })

  it('não permite dois checklists do mesmo tipo em andamento para a mesma pessoa', async () => {
    const proc = (id: string) => ({ id, colaboradorId: 'col1', modeloId: 'ck', tipo: 'encerramento', iniciadoEm: '2026-11-04', itens: [] })
    expect((await editar(rh, (e) => { e.processos = [...(e.processos ?? []), proc('pj1')] })).status).toBe(200)
    expect((await editar(rh, (e) => { e.processos = [...e.processos, proc('pj2')] })).status).toBe(409)
    // Cancelado não conta: pode iniciar outro.
    expect((await editar(rh, (e) => { e.processos[0].canceladoEm = '2026-11-04' })).status).toBe(200)
    expect((await editar(rh, (e) => { e.processos = [...e.processos, proc('pj3')] })).status).toBe(200)
  })

  it('colaborador não altera a própria situação nem os períodos', async () => {
    const col = await cookieDe(m, 'col1')
    expect((await editar(col, (e) => { pessoa(e, 'col1').vinculos = [{ id: 'x', inicio: '2020-01-01' }] })).status).toBe(403)
  })

  it('login da pessoa encerrada recebe a mensagem cordial, sem motivo interno', async () => {
    await m.pg.query("update usuarios set senha_hash = $1 where colaborador_id = 'col1'", [hashSenha('senha-forte-123')])
    await editar(rh, encerrarComHistorico)
    const r = await chamar('login', 'POST', { email: 'col1@teste.local', senha: 'senha-forte-123' })
    expect(r.status).toBe(403)
    expect(r.json.codigo).toBe('parceria_encerrada')
    expect(r.json.erro).toBe(MSG_PARCERIA_ENCERRADA)
    expect(r.json.erro).not.toMatch(/contratante|motivo/i)
    // Senha errada não revela a situação.
    const e = await chamar('login', 'POST', { email: 'col1@teste.local', senha: 'errada-123456' })
    expect(e.json.codigo).toBeUndefined()
  })

  it('histórico de movimentação: o RH acrescenta, mas não altera nem apaga; a diretoria lê sem valores de contrato', async () => {
    const h = { id: 'hf1', colaboradorId: 'col1', em: '2026-11-04T10:00:00Z', porId: 'rh1', dataEfetiva: '2026-11-01', setorAnteriorId: 's1', setorNovoId: 's2', valorAnterior: 5000, valorNovo: 6000 }
    expect((await editar(rh, (e) => { e.historicoFuncao = [h, ...(e.historicoFuncao ?? [])] })).status).toBe(200)
    expect((await editar(rh, (e) => { e.historicoFuncao[0].dataEfetiva = '2026-01-01' })).status).toBe(409)
    expect((await editar(rh, (e) => { e.historicoFuncao = e.historicoFuncao.filter((x: Obj) => x.id !== 'hf1') })).status).toBe(403)
    const dir = await cookieDe(m, 'dir1')
    const { estado } = (await chamar('estado', 'GET', undefined, dir)).json
    const visto = (estado.historicoFuncao as Obj[]).find((x) => x.id === 'hf1')
    expect(visto).toMatchObject({ setorNovoId: 's2', dataEfetiva: '2026-11-01' })
    expect(visto?.valorNovo).toBeUndefined()
  })

  it('agendamento de encerramento: só o RH agenda, e com dados válidos', async () => {
    const col = await cookieDe(m, 'col1')
    const ag = { data: '2099-01-01', motivoId: 'm1', iniciativa: 'empresa', porId: 'rh1', registradoEm: '2026-11-04T10:00:00Z' }
    expect((await editar(col, (e) => { pessoa(e, 'col1').encerramentoAgendado = ag })).status).toBe(403)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').encerramentoAgendado = { ...ag, iniciativa: 'qualquer' } })).status).toBe(403)
    expect((await editar(rh, (e) => { pessoa(e, 'col1').encerramentoAgendado = ag })).status).toBe(200)
  })
})
