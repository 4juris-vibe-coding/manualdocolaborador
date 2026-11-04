import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, PATCH, DEL, chamar } from './teste/harness'
import { criarVaga, corpoCandidatura, PDF_B64 } from './teste/ats-fixtures'
import { hashToken } from './nucleo'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

let ipN = 0
const pub = (caminho: string, corpo?: unknown) => chamar(m, 'POST', caminho, { corpo, ip: `7.7.${Math.floor(++ipN / 200)}.${ipN % 200}` })
const etapa = (v: { etapas: { id: string; tipo: string }[] }, tipo: string) => v.etapas.find((e) => e.tipo === tipo)!.id
const PNG_B64 = Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]), Buffer.alloc(32)]).toString('base64')

async function candidatar(slug: string): Promise<{ token: string; id: string }> {
  const r = await pub(`publico/vagas/${slug}/candidaturas`, corpoCandidatura())
  expect(r.status).toBe(201)
  const token = r.json.codigoAcompanhamento as string
  const id = (await m.pg.query<{ id: string }>('select id from rec_candidaturas where token_hash = $1', [hashToken(token)])).rows[0].id
  return { token, id }
}

const FIT = (etapaId: string) => ({
  tipo: 'fit_cultural', etapaId, titulo: 'Fit com a cultura', instrucoes: 'Responda com sinceridade.',
  competencias: ['Colaboração', 'Autonomia'],
  faixas: [{ min: 0, rotulo: 'Pouca aderência' }, { min: 70, rotulo: 'Boa aderência' }],
  perguntas: [
    { id: 'p1', tipo: 'escolha', texto: 'Diante de um erro do colega, você…', obrigatoria: true, competencia: 'Colaboração', peso: 2, criterio: 'CRITERIO-SECRETO',
      alternativas: [{ id: 'a', texto: 'Ajuda a corrigir', pontos: 10 }, { id: 'b', texto: 'Ignora', pontos: 0 }] },
    { id: 'p2', tipo: 'escala', texto: 'Prefiro decidir sozinho', obrigatoria: true, competencia: 'Autonomia' },
    { id: 'p3', tipo: 'aberta', texto: 'Conte um desafio recente', obrigatoria: false },
  ],
})
const bloco = (id: string) => ({ id, afirmacoes: [
  { id: `${id}d`, texto: 'Assumo o comando', dimensao: 'D' }, { id: `${id}i`, texto: 'Converso com todos', dimensao: 'I' },
  { id: `${id}s`, texto: 'Mantenho a calma', dimensao: 'S' }, { id: `${id}c`, texto: 'Confiro os detalhes', dimensao: 'C' },
] })
const DISC = (etapaId: string) => ({
  tipo: 'disc', etapaId, titulo: 'Perfil comportamental', itens: [bloco('b1'), bloco('b2')],
  perfilRecomendado: { D: 70, I: 60, S: 40, C: 30, justificativa: 'JUSTIFICATIVA-PERFIL' },
  instrumento: { origem: 'interno', nome: 'Escolha forçada 4J', versao: '1' },
})

describe('questionários por etapa · fluxo completo', () => {
  it('configura, fica pendente só na etapa ligada, sem pontos/pesos, envio idempotente e RH vê a pontuação', async () => {
    const v = await criarVaga(m, { setorId: 's1' })
    const triagem = etapa(v, 'triagem')
    // colaborador não configura; gestor da área lê mas não escreve
    expect((await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.col1, FIT(triagem))).status).toBe(403)
    expect((await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.ger1, FIT(triagem))).status).toBe(403)
    // validação: competência inexistente
    const ruim = FIT(triagem); ruim.perguntas[1].competencia = 'Inexistente'
    expect((await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.rh1, ruim)).status).toBe(400)
    const qf = await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.rh1, FIT(triagem))
    expect(qf.status).toBe(201)
    const qd = await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.rec1, DISC(triagem))
    expect(qd.status).toBe(201)
    const cfg = await GET(m, `ats/vagas/${v.id}/avaliacoes-etapa`, m.c.ger1)
    expect(cfg.status).toBe(200)
    expect(cfg.json.questionarios).toHaveLength(2)
    expect(cfg.json.permissoes.gerenciar).toBe(false)
    expect((await GET(m, `ats/vagas/${v.id}/avaliacoes-etapa`, m.c.ger2)).status).toBe(404)

    const { token, id } = await candidatar(v.slug)
    // primeira etapa: nada pendente
    const t0 = await pub('publico/candidaturas/tarefas', { token })
    expect(t0.status).toBe(200)
    expect(t0.json.pendentes).toHaveLength(0)
    expect((await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token, respostas: { p1: 'a', p2: 3 } })).status).toBe(409)

    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: triagem })).status).toBe(200)
    const t1 = await pub('publico/candidaturas/tarefas', { token })
    expect(t1.json.pendentes).toHaveLength(2)
    const txt = JSON.stringify(t1.json)
    expect(txt).not.toMatch(/pontos|peso|competencia|criterio|CRITERIO-SECRETO|Colabora|JUSTIFICATIVA-PERFIL|perfilRecomendado|dimensao|faixas|Triagem/)
    const fitPub = t1.json.pendentes.find((q: any) => q.tipo === 'fit_cultural')
    expect(fitPub.perguntas[0].alternativas).toEqual([{ id: 'a', texto: 'Ajuda a corrigir' }, { id: 'b', texto: 'Ignora' }])

    // obrigatórias validadas no servidor
    const falta = await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token, respostas: { p1: 'a' } })
    expect(falta.status).toBe(400)
    expect(falta.json.campos).toHaveProperty('p2')
    // código de outro candidato não responde o questionário de outra vaga
    const outraVaga = await criarVaga(m)
    const outro = await candidatar(outraVaga.slug)
    expect((await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token: outro.token, respostas: { p1: 'a', p2: 3 } })).status).toBe(404)
    expect((await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token: 'codigo-invalido', respostas: {} })).status).toBe(404)

    const env = await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token, respostas: { p1: 'a', p2: 5, p3: 'Um projeto difícil' } })
    expect(env.status).toBe(201)
    expect((await pub(`publico/candidaturas/questionarios/${qf.json.id}/responder`, { token, respostas: { p1: 'b', p2: 1 } })).status).toBe(409)
    const discRuim = await pub(`publico/candidaturas/questionarios/${qd.json.id}/responder`, { token, respostas: { b1: { mais: 'b1d', menos: 'b1d' } } })
    expect(discRuim.status).toBe(400)
    const envD = await pub(`publico/candidaturas/questionarios/${qd.json.id}/responder`, { token, respostas: { b1: { mais: 'b1d', menos: 'b1c' }, b2: { mais: 'b2i', menos: 'b2s' } } })
    expect(envD.status).toBe(201)

    const t2 = await pub('publico/candidaturas/tarefas', { token })
    expect(t2.json.pendentes).toHaveLength(0)
    expect(t2.json.respondidos).toHaveLength(2)

    // RH é notificado (com chave, sem duplicar) e há auditoria
    expect((await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'rec1' and tipo = 'questionario_respondido'")).rowCount).toBe(2)
    expect((await m.pg.query("select 1 from aud_eventos where entidade_id = $1 and acao = 'questionario_respondido'", [id])).rowCount).toBe(2)

    const res = await GET(m, `ats/candidaturas/${id}/questionarios`, m.c.rh1)
    expect(res.status).toBe(200)
    const fit = res.json.resultados.find((r: any) => r.tipo === 'fit_cultural')
    expect(fit.fit.geral).toBe(100)
    expect(fit.fit.competencias).toEqual(expect.arrayContaining([expect.objectContaining({ competencia: 'Colaboração', nota: 100 }), expect.objectContaining({ competencia: 'Autonomia', nota: 100 })]))
    expect(fit.fit.faixa.rotulo).toBe('Boa aderência')
    expect(fit.avisoApoio).toMatch(/não substitui/)
    expect(fit.fit.respostas.find((x: any) => x.perguntaId === 'p3').resposta).toBe('Um projeto difícil')
    const disc = res.json.resultados.find((r: any) => r.tipo === 'disc')
    // n = 2: D (1−0+2)/4 = 75; I 75; S (0−1+2)/4 = 25; C 25
    expect(disc.disc.pontuacao).toEqual({ D: 75, I: 75, S: 25, C: 25 })
    // |5| + |15| + |15| + |5| = 40/4 = 10 → 90
    expect(disc.disc.compatibilidade).toMatchObject({ indice: 90, faixa: 'alta' })
    expect(disc.aviso).toMatch(/sem validação psicométrica/)
    // candidatura continua onde estava: nada é decidido automaticamente
    expect((await m.pg.query('select status, etapa_id from rec_candidaturas where id = $1', [id])).rows[0]).toMatchObject({ status: 'ativa', etapa_id: triagem })

    // observações: só quem tem notas do RH
    expect(res.json.resultados[0]).toHaveProperty('observacoesRh')
    const g = await GET(m, `ats/candidaturas/${id}/questionarios`, m.c.ger1)
    expect(g.status).toBe(200)
    expect(g.json.resultados[0]).not.toHaveProperty('observacoesRh')
    expect((await PATCH(m, `ats/questionario-respostas/${fit.id}`, m.c.ger1, { observacoesRh: 'x' })).status).toBe(403)
    expect((await PATCH(m, `ats/questionario-respostas/${fit.id}`, m.c.rh1, { observacoesRh: 'Boa conversa' })).status).toBe(200)
    expect((await GET(m, `ats/candidaturas/${id}/questionarios`, m.c.rh1)).json.resultados.find((r: any) => r.id === fit.id).observacoesRh).toBe('Boa conversa')

    // com respostas não exclui (409); editar mantém o retrato
    expect((await DEL(m, `ats/questionarios/${qf.json.id}`, m.c.rh1)).status).toBe(409)
    const ed = FIT(triagem); ed.perguntas[0].texto = 'Texto novo'
    expect((await PUT(m, `ats/questionarios/${qf.json.id}`, m.c.rh1, ed)).status).toBe(200)
    const depois = await GET(m, `ats/candidaturas/${id}/questionarios`, m.c.rh1)
    expect(depois.json.resultados.find((r: any) => r.id === fit.id).fit.respostas[0].texto).toBe('Diante de um erro do colega, você…')
  })

  it('não aceita resposta de candidatura encerrada nem fora da etapa', async () => {
    const v = await criarVaga(m)
    const tri = etapa(v, 'triagem')
    const q = await POST(m, `ats/vagas/${v.id}/questionarios`, m.c.rh1, FIT(tri))
    const { token, id } = await candidatar(v.slug)
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: tri })
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: etapa(v, 'curricular') })
    expect((await pub(`publico/candidaturas/questionarios/${q.json.id}/responder`, { token, respostas: { p1: 'a', p2: 3 } })).status).toBe(409)
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: tri })
    await pub('publico/candidaturas/desistir', { token })
    expect((await pub(`publico/candidaturas/questionarios/${q.json.id}/responder`, { token, respostas: { p1: 'a', p2: 3 } })).status).toBe(409)
    expect((await pub('publico/candidaturas/tarefas', { token })).json.pendentes).toHaveLength(0)
    // sem respostas, exclui
    expect((await DEL(m, `ats/questionarios/${q.json.id}`, m.c.rh1)).status).toBe(200)
  })
})

describe('documentos por candidatura e etapa', () => {
  it('RH anexa interno e visível; candidato só vê o visível; envio do candidato só na etapa que solicita', async () => {
    const v = await criarVaga(m, { setorId: 's1' })
    const tri = etapa(v, 'triagem'), tec = etapa(v, 'tecnica')
    const { token, id } = await candidatar(v.slug)
    const outro = await candidatar((await criarVaga(m)).slug)

    const interno = await POST(m, `ats/candidaturas/${id}/documentos`, m.c.rh1, { etapaId: tri, categoria: 'avaliacao', arquivo: { nome: 'parecer.pdf', base64: PDF_B64 } })
    expect(interno.status).toBe(201)
    const visivel = await POST(m, `ats/candidaturas/${id}/documentos`, m.c.rh1, { etapaId: tri, categoria: 'documento', visivelCandidato: true, arquivo: { nome: 'orientacoes.pdf', base64: PDF_B64 } })
    expect(visivel.status).toBe(201)
    // tipo inválido (magic bytes) e permissão
    expect((await POST(m, `ats/candidaturas/${id}/documentos`, m.c.rh1, { arquivo: { nome: 'x.pdf', base64: Buffer.from('não é pdf de verdade').toString('base64') } })).status).toBe(400)
    expect((await POST(m, `ats/candidaturas/${id}/documentos`, m.c.ger1, { arquivo: { nome: 'x.pdf', base64: PDF_B64 } })).status).toBe(403)

    const lista = await GET(m, `ats/candidaturas/${id}/documentos`, m.c.ger1)
    expect(lista.status).toBe(200)
    expect(lista.json.documentos).toHaveLength(2)
    expect((await GET(m, `ats/candidaturas/${id}/documentos`, m.c.ger2)).status).toBe(404)
    const baixado = await GET(m, `ats/candidaturas/${id}/documentos/${interno.json.id}/arquivo`, m.c.rh1)
    expect(baixado.binario?.dados.subarray(0, 5).toString()).toBe('%PDF-')

    const t = await pub('publico/candidaturas/tarefas', { token })
    expect(t.json.documentos.arquivos.map((a: any) => a.id)).toEqual([visivel.json.id])
    expect(t.json.documentos.solicita).toBe(false)
    expect((await pub(`publico/candidaturas/documentos/${interno.json.id}/arquivo`, { token })).status).toBe(404)
    const dl = await pub(`publico/candidaturas/documentos/${visivel.json.id}/arquivo`, { token })
    expect(dl.status).toBe(200)
    expect(dl.binario?.mime).toBe('application/pdf')
    // código de outro candidato não acessa
    expect((await pub(`publico/candidaturas/documentos/${visivel.json.id}/arquivo`, { token: outro.token })).status).toBe(404)
    expect((await pub('publico/candidaturas/tarefas', { token: outro.token })).json.documentos.arquivos).toHaveLength(0)

    // fora de etapa que solicita: recusado
    expect((await pub('publico/candidaturas/documentos', { token, arquivo: { nome: 'rg.png', base64: PNG_B64 } })).status).toBe(409)
    expect((await PUT(m, `ats/vagas/${v.id}/etapas/${tec}/config`, m.c.rh1, { solicitaDocumentos: true })).status).toBe(400)
    expect((await PUT(m, `ats/vagas/${v.id}/etapas/${tec}/config`, m.c.ger1, { solicitaDocumentos: true, instrucaoDocumentos: 'x' })).status).toBe(403)
    expect((await PUT(m, `ats/vagas/${v.id}/etapas/${tec}/config`, m.c.rh1, { solicitaDocumentos: true, instrucaoDocumentos: 'Envie o teste resolvido em PDF.' })).status).toBe(200)
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: tec })
    const t2 = await pub('publico/candidaturas/tarefas', { token })
    expect(t2.json.documentos).toMatchObject({ solicita: true, instrucao: 'Envie o teste resolvido em PDF.' })
    expect((await pub('publico/candidaturas/documentos', { token, arquivo: { nome: 'teste.exe', base64: Buffer.from('MZ executável qualquer').toString('base64') } })).status).toBe(400)
    const env = await pub('publico/candidaturas/documentos', { token, arquivo: { nome: 'teste.png', base64: PNG_B64 } })
    expect(env.status).toBe(201)
    const row = (await m.pg.query<any>('select * from rec_candidatura_documentos where id = $1', [env.json.id])).rows[0]
    expect(row).toMatchObject({ enviado_por: 'candidato', visivel_candidato: true, etapa_id: tec, colaborador_id: null })
    expect((await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'rec1' and tipo = 'documento_candidato'")).rowCount).toBe(1)
    // o outro candidato (em outra etapa/vaga) não envia
    expect((await pub('publico/candidaturas/documentos', { token: outro.token, arquivo: { nome: 'a.png', base64: PNG_B64 } })).status).toBe(409)

    // RH muda visibilidade e exclui
    expect((await PATCH(m, `ats/candidaturas/${id}/documentos/${visivel.json.id}`, m.c.rh1, { visivelCandidato: false })).status).toBe(200)
    expect((await pub('publico/candidaturas/tarefas', { token })).json.documentos.arquivos.map((a: any) => a.id)).toEqual([env.json.id])
    expect((await DEL(m, `ats/candidaturas/${id}/documentos/${interno.json.id}`, m.c.rh1)).status).toBe(200)
    expect((await m.pg.query('select 1 from rec_candidatura_documentos where id = $1', [interno.json.id])).rowCount).toBe(0)
    expect((await GET(m, `ats/candidaturas/${id}/documentos`, m.c.rh1)).json.documentos).toHaveLength(2)
  })
})
