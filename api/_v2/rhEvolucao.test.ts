import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, PATCH, DEL, chamar } from './teste/harness'
import { MODELOS_VAGA } from '../../src/domain/v2/vagaModelos'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

let ipN = 0
const pub = (metodo: string, caminho: string, corpo?: unknown) => chamar(m, metodo, caminho, { corpo, ip: `7.7.7.${++ipN}` })
const ontem = new Date(Date.now() - 86400000).toISOString().slice(0, 10)
const daqui = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)

describe('vaga · campos de divulgação (desafios, jornada, etapas do processo)', () => {
  let id: string
  let slug: string

  it('salva como rascunho a partir de um modelo, sem expor no portal', async () => {
    const mod = MODELOS_VAGA.find((x) => x.chave === 'sdr')!
    const r = await POST(m, 'vagas', m.c.rh1, {
      ...mod.campos, titulo: 'SDR Teste', modalidade: 'hibrido', regimeContratacao: 'pj',
      desafios: 'Abrir mercado em uma nova região.', jornada: 'Segunda a sexta, 9h às 18h', etapasProcesso: ['Triagem de currículo', 'Entrevista com RH', 'Entrevista com gestor'],
    })
    expect(r.status).toBe(201)
    expect(r.json.vaga.status).toBe('rascunho')
    expect(r.json.vaga.desafios).toBe('Abrir mercado em uma nova região.')
    expect(r.json.vaga.etapasProcesso).toEqual(['Triagem de currículo', 'Entrevista com RH', 'Entrevista com gestor'])
    id = r.json.vaga.id; slug = r.json.vaga.slug
    expect((await pub('GET', `publico/vagas/${slug}`)).status).toBe(404)
  })

  it('valida limites dos campos novos no servidor', async () => {
    const atual = await GET(m, `vagas/${id}`, m.c.rh1)
    const r2 = await PUT(m, `vagas/${id}`, m.c.rh1, { versao: atual.json.vaga.versao, jornada: 'x'.repeat(301) })
    expect(r2.status).toBe(400)
    // Listas seguem a regra geral do módulo: no máximo 40 itens (o excedente é descartado no servidor).
    const r = await PUT(m, `vagas/${id}`, m.c.rh1, { versao: atual.json.vaga.versao, etapasProcesso: Array.from({ length: 45 }, (_, i) => `Etapa ${i}`) })
    expect(r.status).toBe(200)
    expect(r.json.vaga.etapasProcesso).toHaveLength(40)
    const volta = await PUT(m, `vagas/${id}`, m.c.rh1, { versao: r.json.vaga.versao, etapasProcesso: ['Triagem de currículo', 'Entrevista com RH', 'Entrevista com gestor'] })
    expect(volta.status).toBe(200)
  })

  it('publicada: a página pública mostra os campos novos e nada interno', async () => {
    const p = await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    expect(p.status).toBe(200)
    const r = await pub('GET', `publico/vagas/${slug}`)
    expect(r.status).toBe(200)
    expect(r.json.desafios).toBe('Abrir mercado em uma nova região.')
    expect(r.json.jornada).toBe('Segunda a sexta, 9h às 18h')
    expect(r.json.etapasProcesso).toHaveLength(3)
    expect(r.json.atualizadaEm).toBeTruthy()
    expect(JSON.stringify(r.json)).not.toMatch(/SEGREDO|"observacoesRh"|"recrutadorId"|"gestor\w*Id"|"aprovacoes"|"salarioMin"/)
  })

  it('duplicar leva os campos novos para o rascunho copiado', async () => {
    const d = await POST(m, `vagas/${id}/duplicar`, m.c.rh1)
    expect(d.status).toBe(201)
    expect(d.json.vaga.status).toBe('rascunho')
    expect(d.json.vaga.jornada).toBe('Segunda a sexta, 9h às 18h')
    expect(d.json.vaga.etapasProcesso).toHaveLength(3)
  })

  it('encerrada: o link público passa a responder 410', async () => {
    const e = await POST(m, `vagas/${id}/acoes/encerrar`, m.c.rh1, { motivo: 'Posição preenchida' })
    expect(e.status).toBe(200)
    expect((await pub('GET', `publico/vagas/${slug}`)).status).toBe(410)
  })
})

describe('modelos de vaga', () => {
  it('todos têm título, resumo e responsabilidades, e não trazem remuneração nem benefícios inventados', () => {
    expect(MODELOS_VAGA.length).toBeGreaterThanOrEqual(8)
    expect(new Set(MODELOS_VAGA.map((x) => x.chave)).size).toBe(MODELOS_VAGA.length)
    for (const x of MODELOS_VAGA) {
      expect(x.campos.titulo.length).toBeGreaterThan(2)
      expect(x.campos.textoPublico.length).toBeGreaterThan(40)
      expect(x.campos.responsabilidades.length).toBeGreaterThan(40)
      expect(x.campos.requisitosObrigatorios.length).toBeGreaterThanOrEqual(3)
      expect(Object.keys(x.campos)).not.toContain('beneficios')
      expect(Object.keys(x.campos)).not.toContain('salarioMin')
    }
  })
})

describe('pesquisas · plano de ação', () => {
  let pesq: string
  let acao: string

  beforeAll(async () => {
    const c = await POST(m, 'pesquisas', m.c.rh1, { modeloChave: 'seguranca-psicologica' })
    expect(c.status).toBe(201)
    pesq = c.json.id
  })

  it('cria ação com responsável e prazo; responsável é notificado', async () => {
    const r = await POST(m, `pesquisas/${pesq}/acoes`, m.c.rh1, {
      dimensao: 'Resposta a erros', problema: 'Média 2,8 em "foco em aprender com erros"', acao: 'Retrospectiva quinzenal sem culpados', responsavelId: 'ger1', prazo: daqui(30), indicador: 'Média ≥ 3,5 no próximo pulso',
    })
    expect(r.status).toBe(201)
    expect(r.json.status).toBe('planejada')
    expect(r.json.responsavelNome).toBe('Gil Gestor')
    expect(r.json.atrasada).toBe(false)
    acao = r.json.id
    const n = await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'ger1' and chave like 'pq-acao-%'")
    expect(n.rows.length).toBeGreaterThan(0)
  })

  it('valida campos obrigatórios, status e responsável', async () => {
    expect((await POST(m, `pesquisas/${pesq}/acoes`, m.c.rh1, { problema: 'x' })).status).toBe(400)
    expect((await POST(m, `pesquisas/${pesq}/acoes`, m.c.rh1, { problema: 'x', acao: 'y', status: 'inventado' })).status).toBe(400)
    expect((await POST(m, `pesquisas/${pesq}/acoes`, m.c.rh1, { problema: 'x', acao: 'y', responsavelId: 'naoexiste' })).status).toBe(400)
  })

  it('marca atraso, conclui com registro e aparece no painel', async () => {
    const atrasada = await POST(m, `pesquisas/${pesq}/acoes`, m.c.rh1, { problema: 'Baixa participação', acao: 'Conversar com as lideranças', prazo: ontem })
    expect(atrasada.json.atrasada).toBe(true)
    const painel = await GET(m, 'pesquisas/painel', m.c.rh1)
    expect(painel.json.acoes.atrasadas).toBeGreaterThanOrEqual(1)
    expect(painel.json.acoes.itens[0].atrasada).toBe(true)

    const c = await PATCH(m, `pesquisas/${pesq}/acoes/${acao}`, m.c.rh1, { status: 'concluida', conclusao: 'Retrospectivas implantadas em todas as áreas.' })
    expect(c.status).toBe(200)
    expect(c.json.concluidaEm).toBeTruthy()
    const l = await GET(m, `pesquisas/${pesq}/acoes`, m.c.rh1)
    expect(l.json.itens).toHaveLength(2)
    // abertas primeiro, concluídas por último
    expect(l.json.itens[l.json.itens.length - 1].status).toBe('concluida')

    const re = await PATCH(m, `pesquisas/${pesq}/acoes/${acao}`, m.c.rh1, { status: 'em_andamento' })
    expect(re.json.concluidaEm).toBeNull()
  })

  it('só quem gerencia pesquisas altera; colaborador comum não lê', async () => {
    expect((await POST(m, `pesquisas/${pesq}/acoes`, m.c.col1, { problema: 'x', acao: 'y' })).status).toBe(403)
    expect((await GET(m, `pesquisas/${pesq}/acoes`, m.c.col1)).status).toBe(403)
    expect((await DEL(m, `pesquisas/${pesq}/acoes/${acao}`, m.c.ger1)).status).toBe(403)
  })

  it('remove a ação', async () => {
    expect((await DEL(m, `pesquisas/${pesq}/acoes/${acao}`, m.c.rh1)).status).toBe(200)
    expect((await DEL(m, `pesquisas/${pesq}/acoes/${acao}`, m.c.rh1)).status).toBe(404)
  })
})
