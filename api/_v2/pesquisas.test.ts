import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, chamar } from './teste/harness'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const hoje = new Date().toISOString().slice(0, 10)
const daqui = (d: number) => new Date(Date.now() + d * 86400000).toISOString().slice(0, 10)
const TODOS = ['admin1', 'rh1', 'rec1', 'ger1', 'ger2', 'col1', 'col2', 'dir1']

beforeAll(async () => {
  m = await mundoPadrao()
  await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('col2','resp_pesquisas')")
  m.c.col2 = m.c.col2 // cookie continua válido; as capacidades vêm do banco a cada chamada
}, 60_000)

/** Cria e publica uma pesquisa pelo modelo; devolve o id. */
async function publicar(modeloChave: string, extra: Record<string, unknown> = {}, publico: unknown = { todos: true }) {
  const c = await POST(m, 'pesquisas', m.c.rh1, { modeloChave, ...extra })
  expect(c.status).toBe(201)
  const id = c.json.id as string
  const u = await PUT(m, `pesquisas/${id}`, m.c.rh1, { minGrupo: 3, fim: daqui(10), publico, ...(extra.edicao as object ?? {}) })
  expect(u.status).toBe(200)
  const p = await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
  return { id, p }
}

/** A pessoa abre o convite (gera token novo) e responde. */
async function responder(pessoa: string, respostas: Record<string, unknown>) {
  const l = await GET(m, 'pesquisas/meus-convites', m.c[pessoa])
  const conv = l.json.itens[0]
  const t = await POST(m, `pesquisas/meus-convites/${conv.conviteId}/abrir`, m.c[pessoa])
  expect(t.status).toBe(200)
  const r = await chamar(m, 'POST', `responder/${t.json.token}`, { corpo: { respostas }, ip: `9.9.9.${Math.floor(Math.random() * 200)}` })
  return { r, token: t.json.token as string }
}

describe('pesquisa anônima: do rascunho aos indicadores', () => {
  let id: string
  const tokens: Record<string, string> = {}
  const notas: Record<string, number> = { admin1: 10, rh1: 9, rec1: 9, ger1: 8, ger2: 3, col1: 10, col2: 6, dir1: 9 }

  it('cria a partir de modelo, edita, reordena e publica (cria versão 1 e convites)', async () => {
    const c = await POST(m, 'pesquisas', m.c.rh1, { modeloChave: 'enps' })
    id = c.json.id
    expect(c.json.status).toBe('rascunho')
    expect(c.json.perguntas.length).toBeGreaterThanOrEqual(6)
    // não publica sem prazo
    expect((await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)).status).toBe(400)
    // reordena: coloca a última pergunta (q7) antes da q5 e q6 — as condições continuam apontando para q1 (anterior)
    const perg = c.json.perguntas as any[]
    const reord = [perg[0], perg[1], perg[2], perg[3], perg[6], perg[4], perg[5]]
    expect((await PUT(m, `pesquisas/${id}`, m.c.rh1, { perguntas: reord, minGrupo: 3, fim: daqui(10), publico: { todos: true }, config: { lembretesDias: [2, 5] } })).status).toBe(200)
    // público elegível: 8 pessoas
    const el = await POST(m, `pesquisas/${id}/elegiveis`, m.c.rh1)
    expect(el.json.total).toBe(8)
    expect((await POST(m, `pesquisas/${id}/elegiveis`, m.c.rh1, { publico: { setorIds: ['s2'] } })).json.total).toBe(2)
    const pub = await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
    expect(pub.status).toBe(200)
    expect(pub.json).toMatchObject({ status: 'aberta', versao: 1, convitesCriados: 8 })
    // e-mail: sem RESEND_API_KEY o status é honesto
    expect(pub.json.envio.email.nao_configurado).toBe(8)
    expect(pub.json.envio.email.enviada).toBe(0)
    const ntf = await GET(m, 'notificacoes', m.c.col1)
    expect(ntf.json.itens.some((n: any) => n.tipo === 'pesquisa')).toBe(true)
  })

  it('colaborador comum não administra nem vê resultados; responsável por pesquisas administra', async () => {
    expect((await GET(m, 'pesquisas', m.c.col1)).status).toBe(403)
    expect((await GET(m, `pesquisas/${id}/resultados`, m.c.col1)).status).toBe(403)
    expect((await POST(m, 'pesquisas', m.c.ger1, { titulo: 'x' })).status).toBe(403)
    expect((await GET(m, 'pesquisas', m.c.col2)).status).toBe(200) // col2 é resp_pesquisas
    expect((await GET(m, `pesquisas/${id}/resultados`, m.c.dir1)).status).toBe(200) // diretoria vê resultados
    expect((await POST(m, `pesquisas/${id}/encerrar`, m.c.dir1)).status).toBe(403) // mas não administra
  })

  it('o respondente vê o contexto necessário e a confidencialidade honesta', async () => {
    const l = await GET(m, 'pesquisas/meus-convites', m.c.col1)
    expect(l.json.itens).toHaveLength(1)
    const t = await POST(m, `pesquisas/meus-convites/${l.json.itens[0].conviteId}/abrir`, m.c.col1)
    tokens.col1 = t.json.token
    const v = await chamar(m, 'GET', `responder/${t.json.token}`)
    expect(v.status).toBe(200)
    expect(v.json).toMatchObject({ modo: 'anonima', via: 'convite', salvaProgresso: false })
    expect(v.json.confidencialidade).toMatch(/anônima/)
    expect(v.json.perguntas.length).toBeGreaterThan(0)
    expect(JSON.stringify(v.json)).not.toMatch(/col1|colaborador/i)
  })

  it('valida no servidor: obrigatória faltando e valor fora da faixa', async () => {
    const r1 = await chamar(m, 'POST', `responder/${tokens.col1}`, { corpo: { respostas: {} } })
    expect(r1.status).toBe(400)
    expect(Object.keys(r1.json.campos)).toContain('q1')
    const r2 = await chamar(m, 'POST', `responder/${tokens.col1}`, { corpo: { respostas: { q1: 11, q5: 4, q6: 4 } } })
    expect(r2.status).toBe(400)
    // token inválido
    expect((await chamar(m, 'GET', 'responder/inexistente-inexistente-123')).status).toBe(404)
  })

  it('todos respondem; o token é de uso único', async () => {
    for (const [p, n] of Object.entries(notas)) {
      const { r, token } = await responder(p, { q1: n, q5: 4, q6: 4, q2: n <= 8 ? `motivo ${p}` : '' })
      expect(r.status, p).toBe(201)
      tokens[p] = token
    }
    const dup = await chamar(m, 'POST', `responder/${tokens.col1}`, { corpo: { respostas: { q1: 1, q5: 1, q6: 1 } } })
    expect(dup.status).toBe(410)
    expect(dup.json.erro).toMatch(/já foi usado/)
    expect((await chamar(m, 'GET', `responder/${tokens.col1}`)).status).toBe(410)
    expect((await GET(m, 'pesquisas/meus-convites', m.c.col1)).json.itens).toHaveLength(0)
  })

  it('NENHUMA tabela liga a resposta à pessoa ou ao convite (varredura de colunas e linhas)', async () => {
    const cols = (await m.pg.query<{ column_name: string }>("select column_name from information_schema.columns where table_name = 'pq_respostas'")).rows.map((c) => c.column_name).sort()
    expect(cols).toEqual(['colaborador_id', 'enviada_em', 'grupo', 'id', 'itens', 'pesquisa_id', 'versao'])
    const tipoData = (await m.pg.query<{ data_type: string }>("select data_type from information_schema.columns where table_name = 'pq_respostas' and column_name = 'enviada_em'")).rows[0].data_type
    expect(tipoData).toBe('date')
    const usado = (await m.pg.query<{ data_type: string }>("select data_type from information_schema.columns where table_name = 'pq_convites' and column_name = 'usado_em'")).rows[0].data_type
    expect(usado).toBe('date')
    expect((await m.pg.query("select count(*)::int as n from pq_respostas where colaborador_id is not null")).rows[0]).toEqual({ n: 0 })
    // nenhum identificador de pessoa nem de convite aparece em qualquer coluna das tabelas de dados da resposta
    const convs = (await m.pg.query<{ id: string }>('select id from pq_convites')).rows.map((r) => r.id)
    const hashes = (await m.pg.query<{ token_hash: string }>('select token_hash from pq_convites')).rows.map((r) => r.token_hash)
    for (const tabela of ['pq_respostas', 'pq_tags', 'pq_link_marcas', 'pq_versoes']) {
      const txt = JSON.stringify((await m.pg.query(`select * from ${tabela}`)).rows)
      if (tabela !== 'pq_versoes') for (const pid of TODOS) expect(txt, `${tabela} contém ${pid}`).not.toContain(`"${pid}"`)
      for (const c of [...convs, ...hashes]) expect(txt).not.toContain(c)
    }
    // só a data no convite usado
    const datas = (await m.pg.query<{ usado_em: unknown }>("select usado_em::text as usado_em from pq_convites where status = 'usado'")).rows
    expect(datas.every((d) => /^\d{4}-\d{2}-\d{2}$/.test(String(d.usado_em)))).toBe(true)
  })

  it('lista de convites da anônima só tem números (nunca quem respondeu)', async () => {
    const c = await GET(m, `pesquisas/${id}/convites`, m.c.rh1)
    expect(c.json).toMatchObject({ modo: 'anonima', convidados: 8, pendentes: 0, respondidos: 8 })
    expect(c.json.itens).toBeUndefined()
    expect(c.json.aviso).toMatch(/nunca quem respondeu/)
    expect((await GET(m, `pesquisas/${id}/respostas-individuais`, m.c.admin1)).status).toBe(403)
  })

  it('indicadores: taxa de resposta, eNPS e proteção de grupos pequenos', async () => {
    const r = await GET(m, `pesquisas/${id}/resultados`, m.c.rh1)
    expect(r.status).toBe(200)
    const res = r.json.resultados
    expect(res.total).toBe(8)
    expect(res.taxaResposta).toBe(100)
    // promotores (9–10): admin1,rh1,rec1,col1,dir1 = 5; detratores (0–6): ger2(3), col2(6) = 2; neutro ger1(8)
    const q1 = res.perguntas.find((p: any) => p.id === 'q1').resultado
    expect(q1).toMatchObject({ n: 8, promotores: 5, neutros: 1, detratores: 2, enps: Math.round(((5 - 2) / 8) * 100) })
    expect(res.dimensoes.some((d: any) => d.dimensao)).toBe(true)
    // s2 tem 2 respostas (< mínimo 3): oculto; s1 (6) também oculto pela supressão complementar? soma dos ocultos = 2 < 3 → sim
    const seg = res.perguntas.find((p: any) => p.id === 'q1').porSetor as any[]
    expect(seg.find((s) => s.chave === 's2').suprimido).toBe(true)
    expect(seg.find((s) => s.chave === 's2').resultado).toBeNull()
    expect(seg.find((s) => s.chave === 's1').suprimido).toBe(true)
    // filtro por área pequena é bloqueado e não devolve números
    const f = await GET(m, `pesquisas/${id}/resultados`, m.c.rh1, { setorId: 's2' })
    expect(f.json.resultados.filtroBloqueado).toBeTruthy()
    expect(f.json.resultados.perguntas).toHaveLength(0)
    expect(r.json.resumo.join(' ')).toMatch(/taxa de resposta de 100%/)
    // textos abertos aparecem (total ≥ mínimo) e podem receber marcadores
    const q2 = res.perguntas.find((p: any) => p.id === 'q2')
    expect(q2.textos.length).toBeGreaterThan(0)
    const tg = await POST(m, `pesquisas/${id}/tags`, m.c.rh1, { respostaId: q2.textos[0].respostaId, perguntaId: 'q2', tags: ['Clima', 'liderança'] })
    expect(tg.status).toBe(200)
    const r2 = await GET(m, `pesquisas/${id}/resultados`, m.c.rh1)
    expect(r2.json.resultados.perguntas.find((p: any) => p.id === 'q2').textos.some((t: any) => t.tags.includes('clima'))).toBe(true)
    // CSV protegido
    const csv = await chamar(m, 'GET', `pesquisas/${id}/resultados.csv`, { cookie: m.c.rh1 })
    expect(csv.binario?.mime).toMatch(/csv/)
    expect(csv.binario!.dados.toString()).not.toContain('Área: s2')
    expect((await chamar(m, 'GET', `pesquisas/${id}/resultados.csv`, { cookie: m.c.dir1 })).status).toBe(403)
  })

  it('edição estrutural com respostas gera NOVA versão; o histórico continua interpretável', async () => {
    const d = await GET(m, `pesquisas/${id}`, m.c.rh1)
    const perg = (d.json.perguntas as any[]).map((p) => (p.id === 'q5' ? { ...p, texto: 'Sinto muito orgulho de trabalhar aqui.' } : p))
    expect((await PUT(m, `pesquisas/${id}`, m.c.rh1, { perguntas: perg })).status).toBe(200)
    const pub = await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
    expect(pub.json).toMatchObject({ versao: 2, novaVersao: true })
    const vs = (await GET(m, `pesquisas/${id}`, m.c.rh1)).json.versoes
    expect(vs.map((v: any) => v.versao)).toEqual([2, 1])
    // respostas antigas continuam na versão 1
    const n1 = (await m.pg.query("select count(*)::int as n from pq_respostas where pesquisa_id = $1 and versao = 1", [id])).rows[0].n
    expect(n1).toBe(8)
    // republicar sem mudar nada não cria outra versão
    expect((await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)).json).toMatchObject({ versao: 2, novaVersao: false })
    // q5 mudou de redação: resultado geral não soma versões diferentes
    const r = await GET(m, `pesquisas/${id}/resultados`, m.c.rh1)
    const q5 = r.json.resultados.perguntas.find((p: any) => p.id === 'q5')
    expect(q5.versoesNaoComparaveis).toEqual([1])
    expect(q5.n).toBe(0)
    expect(r.json.resultados.perguntas.find((p: any) => p.id === 'q1').versoes).toEqual([1, 2])
    // o modo não muda depois de publicada
    expect((await PUT(m, `pesquisas/${id}`, m.c.rh1, { modo: 'identificada' })).status).toBe(409)
  })

  it('pausa bloqueia o formulário; encerrar revoga e bloqueia; encerrada não edita', async () => {
    const dup = await POST(m, `pesquisas/${id}/duplicar`, m.c.rh1)
    expect(dup.json.status).toBe('rascunho')
    expect(dup.json.titulo).toMatch(/cópia/)
    expect((await POST(m, `pesquisas/${id}/pausar`, m.c.rh1)).json.status).toBe('pausada')
    const enc = await POST(m, `pesquisas/${id}/encerrar`, m.c.rh1)
    expect(enc.json.status).toBe('encerrada')
    expect((await PUT(m, `pesquisas/${id}`, m.c.rh1, { titulo: 'novo' })).status).toBe(409)
    const painel = await GET(m, 'pesquisas/painel', m.c.rh1)
    expect(painel.status).toBe(200)
    expect(painel.json.porStatus.encerrada).toBeGreaterThanOrEqual(1)
  })
})

describe('tokens: expiração, pesquisa pausada/encerrada', () => {
  it('convite expirado e pesquisa pausada/encerrada devolvem mensagens claras', async () => {
    const { id } = await publicar('pulso', {}, { pessoaIds: ['col1', 'col2', 'ger1'] })
    const l = await GET(m, 'pesquisas/meus-convites', m.c.col1)
    const conv = l.json.itens.find((i: any) => i.titulo.includes('pulso'))
    const t = (await POST(m, `pesquisas/meus-convites/${conv.conviteId}/abrir`, m.c.col1)).json.token
    await m.pg.query("update pq_convites set expira_em = now() - interval '1 hour' where id = $1", [conv.conviteId])
    const e = await chamar(m, 'GET', `responder/${t}`)
    expect(e.status).toBe(410)
    expect(e.json.erro).toMatch(/expirou/)
    await m.pg.query("update pq_convites set expira_em = now() + interval '1 day' where id = $1", [conv.conviteId])
    await POST(m, `pesquisas/${id}/pausar`, m.c.rh1)
    expect((await chamar(m, 'GET', `responder/${t}`)).status).toBe(403)
    await POST(m, `pesquisas/${id}/retomar`, m.c.rh1)
    expect((await chamar(m, 'GET', `responder/${t}`)).status).toBe(200)
    // fim no passado: encerra sozinha
    await m.pg.query("update pq_pesquisas set fim = current_date - 1 where id = $1", [id])
    const x = await chamar(m, 'GET', `responder/${t}`)
    expect(x.status).toBe(410)
    expect((await GET(m, `pesquisas/${id}`, m.c.rh1)).json.status).toBe('encerrada')
  })

  it('convidar novos: quem entrou depois recebe convite por ação do RH', async () => {
    const { id } = await publicar('pulso', {}, { setorIds: ['s2'] })
    expect((await GET(m, `pesquisas/${id}/convites`, m.c.rh1)).json.convidados).toBe(2)
    await m.pg.query(`insert into app_colaboradores (ord, id, dados) values (99, 'novo1', '{"id":"novo1","nome":"Nina Nova","papel":"colaborador","setorId":"s2","status":"ativo","email":"nina@teste.local"}'::jsonb)`)
    const r = await POST(m, `pesquisas/${id}/convidar-novos`, m.c.rh1)
    expect(r.json.convitesCriados).toBe(1)
    expect((await POST(m, `pesquisas/${id}/convidar-novos`, m.c.rh1)).json.convitesCriados).toBe(0)
    await m.pg.query("delete from app_colaboradores where id = 'novo1'")
  })

  it('lembretes: não repetem em 24 h e geram novo token', async () => {
    const { id } = await publicar('pulso', {}, { pessoaIds: ['col1', 'col2', 'ger1'] })
    const r1 = await POST(m, `pesquisas/${id}/lembretes`, m.c.rh1)
    expect(r1.json.total).toBe(3)
    expect(r1.json.email.nao_configurado).toBe(3)
    const r2 = await POST(m, `pesquisas/${id}/lembretes`, m.c.rh1)
    expect(r2.json.total).toBe(0)
  })
})

describe('pesquisa identificada', () => {
  it('exige finalidade e quem acessa; mostra identidade só em identificadas; progresso salvo no servidor', async () => {
    const c = await POST(m, 'pesquisas', m.c.rh1, { modeloChave: 'integracao' })
    const id = c.json.id
    expect(c.json.modo).toBe('identificada')
    await PUT(m, `pesquisas/${id}`, m.c.rh1, { minGrupo: 3, fim: daqui(7), publico: { pessoaIds: ['col1', 'col2', 'ger1'] } })
    const sem = await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
    expect(sem.status).toBe(400)
    expect(sem.json.erro).toMatch(/finalidade/)
    await PUT(m, `pesquisas/${id}`, m.c.rh1, { finalidade: 'acompanhar a integração', quemAcessa: 'RH e liderança direta' })
    expect((await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)).status).toBe(200)
    const l = await GET(m, 'pesquisas/meus-convites', m.c.col1)
    const conv = l.json.itens.find((i: any) => i.modo === 'identificada')
    const token = (await POST(m, `pesquisas/meus-convites/${conv.conviteId}/abrir`, m.c.col1)).json.token
    const v = await chamar(m, 'GET', `responder/${token}`)
    expect(v.json.salvaProgresso).toBe(true)
    expect(v.json.confidencialidade).toMatch(/IDENTIFICADA/)
    expect(v.json.confidencialidade).toMatch(/RH e liderança direta/)
    expect(v.json.confidencialidade).not.toMatch(/anônima/i)
    const sv = await chamar(m, 'PUT', `responder/${token}/progresso`, { corpo: { respostas: { q1: 4 } } })
    expect(sv.status).toBe(200)
    expect((await chamar(m, 'GET', `responder/${token}`)).json.progresso).toEqual({ q1: 4 })
    // lista nominal de convites só na identificada
    const cv = await GET(m, `pesquisas/${id}/convites`, m.c.rh1)
    expect(cv.json.itens.find((i: any) => i.colaboradorId === 'col1').status).toBe('pendente')
    const perg = v.json.perguntas as any[]
    const resp: Record<string, unknown> = {}
    for (const p of perg) {
      if (!p.obrigatoria) continue
      resp[p.id] = p.tipo === 'likert' ? 4 : p.tipo === 'escala' ? 8 : p.tipo === 'sim_nao' ? 'nao' : 'x'
    }
    const ok = await chamar(m, 'POST', `responder/${token}`, { corpo: { respostas: resp } })
    expect(ok.status).toBe(201)
    const ind = await GET(m, `pesquisas/${id}/respostas-individuais`, m.c.rh1)
    expect(ind.status).toBe(200)
    expect(ind.json.itens[0].nome).toBe('Caio Colaborador')
    expect(ind.json.finalidade).toBe('acompanhar a integração')
    const aud = await GET(m, 'auditoria', m.c.admin1, { entidade: 'pesquisa', entidade_id: id })
    expect(aud.json.itens.some((a: any) => a.acao === 'consulta_individual')).toBe(true)
    // link público só para anônimas
    expect((await POST(m, `pesquisas/${id}/link-publico`, m.c.rh1, { ativo: true })).status).toBe(400)
  })
})

describe('link público (anônima)', () => {
  it('uma resposta por navegador, sem identidade; desativar bloqueia', async () => {
    const c = await POST(m, 'pesquisas', m.c.rh1, { modeloChave: 'pulso' })
    const id = c.json.id
    await PUT(m, `pesquisas/${id}`, m.c.rh1, { minGrupo: 3, fim: daqui(5), publico: { pessoaIds: ['col1'] } })
    await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
    const lk = await POST(m, `pesquisas/${id}/link-publico`, m.c.rh1, { ativo: true })
    expect(lk.status).toBe(200)
    const tok = lk.json.token as string
    const v = await chamar(m, 'GET', `responder/${tok}`)
    expect(v.json.via).toBe('link')
    expect(v.json.confidencialidade).toMatch(/link público/)
    const marca = 'navegador-' + 'a'.repeat(20)
    const corpo = { respostas: { q1: 7, q2: 4, q3: 4, q4: 4, q5: 4 }, marca }
    const r1 = await chamar(m, 'POST', `responder/${tok}`, { corpo, ip: '8.8.8.1' })
    expect(r1.status).toBe(201)
    expect((await chamar(m, 'POST', `responder/${tok}`, { corpo, ip: '8.8.8.2' })).status).toBe(409)
    expect((await chamar(m, 'POST', `responder/${tok}`, { corpo: { respostas: corpo.respostas }, ip: '8.8.8.3' })).status).toBe(400) // sem marca
    expect((await m.pg.query("select colaborador_id from pq_respostas where pesquisa_id = $1", [id])).rows[0].colaborador_id).toBeNull()
    await POST(m, `pesquisas/${id}/link-publico`, m.c.rh1, { ativo: false })
    expect((await chamar(m, 'GET', `responder/${tok}`)).status).toBe(404)
  })

  it('limite por IP no endpoint público', async () => {
    let ultimo = 0
    for (let i = 0; i < 70; i++) ultimo = (await chamar(m, 'GET', 'responder/token-qualquer-token-qualquer-1', { ip: '7.7.7.7' })).status
    expect(ultimo).toBe(429)
  })
})

describe('pesquisa condicional respeitada no servidor', () => {
  it('resposta a pergunta oculta é descartada', async () => {
    const c = await POST(m, 'pesquisas', m.c.rh1, { titulo: 'Condicional', modo: 'anonima' })
    const id = c.json.id
    const perguntas = [
      { id: 'a', tipo: 'sim_nao', texto: 'Participou do evento?', obrigatoria: true },
      { id: 'b', tipo: 'estrelas', texto: 'Nota do evento', obrigatoria: true, condicao: { perguntaId: 'a', operador: 'igual', valor: 'sim' } },
    ]
    await PUT(m, `pesquisas/${id}`, m.c.rh1, { perguntas, minGrupo: 3, fim: daqui(3), publico: { pessoaIds: ['col1', 'col2', 'ger1'] } })
    await POST(m, `pesquisas/${id}/publicar`, m.c.rh1)
    const l = await GET(m, 'pesquisas/meus-convites', m.c.col1)
    const conv = l.json.itens.find((i: any) => i.titulo === 'Condicional')
    const token = (await POST(m, `pesquisas/meus-convites/${conv.conviteId}/abrir`, m.c.col1)).json.token
    const r = await chamar(m, 'POST', `responder/${token}`, { corpo: { respostas: { a: 'nao', b: 5 } } })
    expect(r.status).toBe(201)
    expect((await m.pg.query('select itens from pq_respostas where pesquisa_id = $1', [id])).rows[0].itens).toEqual({ a: 'nao' })
  })
})
