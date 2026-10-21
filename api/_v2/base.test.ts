import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, chamar } from './teste/harness'
import { validarEscritaLegada } from './guarda'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

describe('núcleo da API v2', () => {
  it('exige sessão nas rotas autenticadas', async () => {
    const r = await GET(m, 'eu')
    expect(r.status).toBe(401)
  })
  it('devolve papel, funções e capacidades efetivas', async () => {
    const r = await GET(m, 'eu', m.c.rec1)
    expect(r.status).toBe(200)
    expect(r.json.funcoes).toEqual(['recrutador'])
    expect(r.json.capacidades).toContain('ats:gerenciar')
    expect(r.json.capacidades).not.toContain('admin:usuarios')
    const g = await GET(m, 'eu', m.c.ger1)
    expect(g.json.setoresLiderados).toEqual(['s1'])
    expect(g.json.capacidades).toContain('vagas:solicitar')
    expect(g.json.capacidades).not.toContain('vagas:gerenciar')
  })
  it('exige o cabeçalho anti-CSRF em mutações', async () => {
    const r = await chamar(m, 'PUT', 'acl/funcoes/col1', { cookie: m.c.admin1, corpo: { funcoes: ['recrutador'] }, csrf: false })
    expect(r.status).toBe(403)
  })
  it('só a administração concede funções adicionais, e isso é auditado', async () => {
    expect((await PUT(m, 'acl/funcoes/col1', m.c.rh1, { funcoes: ['analista_rh'] })).status).toBe(403)
    expect((await PUT(m, 'acl/funcoes/col1', m.c.admin1, { funcoes: ['analista_rh'] })).status).toBe(200)
    const eu = await GET(m, 'eu', m.c.col1)
    expect(eu.json.capacidades).toContain('analytics:ver')
    const aud = await GET(m, 'auditoria', m.c.admin1, { entidade: 'acl' })
    expect(aud.json.itens.length).toBeGreaterThan(0)
    expect((await GET(m, 'auditoria', m.c.col2)).status).toBe(403)
  })
  it('notificações: leitura própria e marcação como lida', async () => {
    await m.pg.query("insert into ntf_notificacoes (destinatario_id, tipo, titulo, chave) values ('col1','teste','Olá','k1')")
    const l = await GET(m, 'notificacoes', m.c.col1)
    expect(l.json.naoLidas).toBe(1)
    expect((await GET(m, 'notificacoes', m.c.col2)).json.itens).toHaveLength(0)
    await POST(m, `notificacoes/${l.json.itens[0].id}/lida`, m.c.col2) // outra pessoa não consegue marcar
    expect((await GET(m, 'notificacoes', m.c.col1)).json.naoLidas).toBe(1)
    await POST(m, 'notificacoes/lidas', m.c.col1)
    expect((await GET(m, 'notificacoes', m.c.col1)).json.naoLidas).toBe(0)
  })
  it('404 e 405', async () => {
    expect((await GET(m, 'nao-existe', m.c.admin1)).status).toBe(404)
    expect((await chamar(m, 'DELETE', 'eu', { cookie: m.c.admin1 })).status).toBe(405)
  })
})

describe('guarda de escrita do /api/estado', () => {
  const colabs = [
    { id: 'a', papel: 'admin', setorId: 's1', cargoId: 'g1', status: 'ativo' },
    { id: 'c', papel: 'colaborador', setorId: 's1', cargoId: 'g1', status: 'ativo' },
    { id: 'd', papel: 'colaborador', setorId: 's1', cargoId: 'g1', status: 'integracao' },
  ]
  const atuais = { colaboradores: colabs, setores: [{ id: 's1' }], config: { geral: { x: 1 } }, auditoria: [{ id: 1 }] }
  const eu = { colaboradorId: 'c', papel: 'colaborador' }

  it('colaborador não vira administrador', () => {
    const novo = colabs.map((c) => (c.id === 'c' ? { ...c, papel: 'admin' } : c))
    expect(validarEscritaLegada({ colaboradores: novo }, atuais, eu)).toMatch(/papéis|estrutura/)
  })
  it('colaborador altera o próprio telefone, mas não o de outra pessoa', () => {
    const proprio = colabs.map((c) => (c.id === 'c' ? { ...c, telefone: '1' } : c))
    expect(validarEscritaLegada({ colaboradores: proprio }, atuais, eu)).toBeNull()
    const outro = colabs.map((c) => (c.id === 'a' ? { ...c, telefone: '1' } : c))
    expect(validarEscritaLegada({ colaboradores: outro }, atuais, eu)).toMatch(/próprio/)
  })
  it('permite concluir a integração de outra pessoa (integração → ativo)', () => {
    const novo = colabs.map((c) => (c.id === 'd' ? { ...c, status: 'ativo' } : c))
    expect(validarEscritaLegada({ colaboradores: novo }, atuais, eu)).toBeNull()
  })
  it('não troca a própria área nem o gestor', () => {
    const novo = colabs.map((c) => (c.id === 'c' ? { ...c, responsavelId: 'a' } : c))
    expect(validarEscritaLegada({ colaboradores: novo }, atuais, eu)).toMatch(/estrutura/)
  })
  it('estrutura, configurações e auditoria protegidas', () => {
    expect(validarEscritaLegada({ setores: [{ id: 's1', liderancaIds: ['c'] }] }, atuais, eu)).toMatch(/RH/)
    expect(validarEscritaLegada({ config: { geral: { x: 2 } } }, atuais, eu)).toMatch(/RH/)
    expect(validarEscritaLegada({ auditoria: [] }, atuais, eu)).toMatch(/auditoria/)
    expect(validarEscritaLegada({ auditoria: [{ id: 1 }, { id: 2 }] }, atuais, eu)).toBeNull()
  })
  it('RH cadastra colaborador mas só a administração concede papel elevado', () => {
    const rh = { colaboradorId: 'r', papel: 'rh' }
    expect(validarEscritaLegada({ colaboradores: [...colabs, { id: 'n', papel: 'colaborador' }] }, atuais, rh)).toBeNull()
    expect(validarEscritaLegada({ colaboradores: [...colabs, { id: 'n', papel: 'admin' }] }, atuais, rh)).toMatch(/administração/)
    const promovido = colabs.map((c) => (c.id === 'c' ? { ...c, papel: 'rh' } : c))
    expect(validarEscritaLegada({ colaboradores: promovido }, atuais, rh)).toMatch(/administração/)
    expect(validarEscritaLegada({ colaboradores: promovido }, atuais, { colaboradorId: 'a', papel: 'admin' })).toBeNull()
  })
})
