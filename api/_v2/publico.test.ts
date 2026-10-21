import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, chamar } from './teste/harness'
import { criarVaga, corpoCandidatura, PDF_B64 } from './teste/ats-fixtures'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

let ipN = 0
const pub = (metodo: string, caminho: string, corpo?: unknown) => chamar(m, metodo, caminho, { corpo, ip: `9.9.9.${++ipN}` })

describe('portal público · vagas', () => {
  it('lista somente vagas publicadas e dentro do prazo, sem dados internos', async () => {
    const pubV = await criarVaga(m, { titulo: 'Vaga Publicada Alfa' })
    await criarVaga(m, { titulo: 'Vaga Rascunho', status: 'rascunho' })
    await criarVaga(m, { titulo: 'Vaga Pausada', status: 'pausada' })
    await criarVaga(m, { titulo: 'Vaga Vencida', encerraEm: '2000-01-01' })
    await criarVaga(m, { titulo: 'Vaga Arquivada', arquivada: true })
    const r = await pub('GET', 'publico/vagas')
    expect(r.status).toBe(200)
    const titulos = r.json.itens.map((i: any) => i.titulo)
    expect(titulos).toContain('Vaga Publicada Alfa')
    for (const t of ['Vaga Rascunho', 'Vaga Pausada', 'Vaga Vencida', 'Vaga Arquivada']) expect(titulos).not.toContain(t)
    expect(JSON.stringify(r.json)).not.toMatch(/SEGREDO-RH|gestor|salario/i)
    expect(r.json.itens.find((i: any) => i.slug === pubV.slug).area).toBe('Jurídico')
  })

  it('busca e filtros funcionam', async () => {
    const r = await pub('GET', 'publico/vagas?q=Alfa')
    expect(r.json.itens.every((i: any) => /Alfa/.test(i.titulo))).toBe(true)
    const vazio = await pub('GET', 'publico/vagas?q=zzzinexistentezzz')
    expect(vazio.json.itens).toHaveLength(0)
    const area = await pub('GET', 'publico/vagas?area=Comercial')
    expect(area.json.itens).toHaveLength(0)
  })

  it('detalhe esconde salário (a menos que divulgado), observações do RH e eliminatórias', async () => {
    const v = await criarVaga(m, { perguntas: [{ id: 'q1', texto: 'Tem OAB?', tipo: 'sim_nao', obrigatoria: true, eliminatoria: true }] })
    const r = await pub('GET', `publico/vagas/${v.slug}`)
    expect(r.status).toBe(200)
    expect(r.json.salario).toBeNull()
    expect(JSON.stringify(r.json)).not.toMatch(/SEGREDO-RH|eliminatoria/i)
    expect(r.json.privacidade.texto.length).toBeGreaterThan(20)
    const v2 = await criarVaga(m, { divulgarSalario: true })
    expect((await pub('GET', `publico/vagas/${v2.slug}`)).json.salario).toMatchObject({ min: 5000, max: 9000 })
  })

  it('vaga pausada/encerrada responde 410 com mensagem clara; rascunho some (404)', async () => {
    const p = await criarVaga(m, { status: 'pausada' })
    const e = await criarVaga(m, { status: 'encerrada' })
    const d = await criarVaga(m, { status: 'rascunho' })
    const rp = await pub('GET', `publico/vagas/${p.slug}`)
    expect(rp.status).toBe(410)
    expect(rp.json.erro).toMatch(/pausad/i)
    expect((await pub('GET', `publico/vagas/${e.slug}`)).json.erro).toMatch(/encerrad/i)
    expect((await pub('GET', `publico/vagas/${d.slug}`)).status).toBe(404)
  })
})

describe('portal público · candidatura', () => {
  it('cria candidatura real na vaga certa, aparece no ATS, guarda só o hash do token e registra consentimento', async () => {
    const v = await criarVaga(m, { perguntas: [{ id: 'q1', texto: 'Tem OAB?', tipo: 'sim_nao', obrigatoria: true }] })
    const outra = await criarVaga(m)
    const corpo = corpoCandidatura({ respostas: { q1: 'sim' }, bancoTalentos: true, origem: 'linkedin' })
    const r = await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpo)
    expect(r.status).toBe(201)
    const token = r.json.codigoAcompanhamento as string
    expect(token.length).toBeGreaterThan(30)

    const c = (await m.pg.query<any>('select * from rec_candidaturas where vaga_id = $1', [v.id])).rows
    expect(c).toHaveLength(1)
    expect(c[0].etapa_id).toBe(v.etapas[0].id)
    expect(c[0].origem).toBe('linkedin')
    expect(c[0].token_hash).not.toBe(token)
    expect(c[0].token_hash).toHaveLength(64)
    expect(c[0].respostas_triagem[0]).toMatchObject({ perguntaId: 'q1', resposta: 'sim' })
    expect((await m.pg.query('select 1 from rec_candidaturas where vaga_id = $1', [outra.id])).rowCount).toBe(0)
    expect((await m.pg.query("select 1 from rec_consentimentos where candidatura_id = $1 and finalidade = 'processo_seletivo' and concedido", [c[0].id])).rowCount).toBe(1)
    expect((await m.pg.query("select 1 from rec_talentos t join rec_candidaturas c on c.candidato_id = t.candidato_id where c.id = $1", [c[0].id])).rowCount).toBe(1)
    // arquivo guardado no banco, não em URL pública
    expect((await m.pg.query('select tamanho from arq_arquivos where id = $1', [c[0].curriculo_arquivo_id])).rows[0].tamanho).toBeGreaterThan(10)
    // e-mail sem provedor configurado: nunca "enviada"
    const com = (await m.pg.query<any>("select status, corpo from rec_comunicacoes where candidatura_id = $1", [c[0].id])).rows[0]
    expect(com.status).toBe('nao_configurado')
    expect(com.corpo).not.toContain(token)
    expect(r.json.confirmacaoPorEmail).toBe('nao_enviada')
    // notifica o recrutador
    expect((await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'rec1' and tipo = 'candidatura_nova'")).rowCount).toBeGreaterThan(0)

    // aparece no pipeline da vaga correta, na primeira etapa
    const pipe = await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)
    expect(pipe.status).toBe(200)
    expect(pipe.json.etapas[0].candidaturas).toHaveLength(1)
    expect(pipe.json.etapas[0].candidaturas[0].nome).toBe('Maria Candidata')
  })

  it('recusa vaga pausada, encerrada e fora do prazo', async () => {
    for (const o of [{ status: 'pausada' }, { status: 'encerrada' }, { status: 'rascunho' }, { encerraEm: '2000-01-01' }]) {
      const v = await criarVaga(m, o)
      const r = await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())
      expect([404, 410]).toContain(r.status)
      expect((await m.pg.query('select 1 from rec_candidaturas where vaga_id = $1', [v.id])).rowCount).toBe(0)
    }
  })

  it('detecta duplicidade (mesmo e-mail na mesma vaga) e reutiliza o candidato em outra vaga', async () => {
    const v1 = await criarVaga(m), v2 = await criarVaga(m)
    const corpo = corpoCandidatura({ email: 'dup@exemplo.com' })
    expect((await pub('POST', `publico/vagas/${v1.slug}/candidaturas`, corpo)).status).toBe(201)
    const dup = await pub('POST', `publico/vagas/${v1.slug}/candidaturas`, { ...corpo, email: 'DUP@exemplo.com' })
    expect(dup.status).toBe(409)
    expect(dup.json.erro).toMatch(/já existe/i)
    expect((await pub('POST', `publico/vagas/${v2.slug}/candidaturas`, corpo)).status).toBe(201)
    expect((await m.pg.query("select 1 from rec_candidatos where lower(email) = 'dup@exemplo.com'")).rowCount).toBe(1)
    expect((await m.pg.query("select 1 from rec_candidaturas c join rec_candidatos k on k.id = c.candidato_id where k.email = 'dup@exemplo.com'")).rowCount).toBe(2)
  })

  it('valida campos, privacidade, triagem obrigatória e currículo', async () => {
    const v = await criarVaga(m, { perguntas: [{ id: 'q1', texto: 'Tem OAB?', tipo: 'sim_nao', obrigatoria: true }] })
    const url = `publico/vagas/${v.slug}/candidaturas`
    const semConsent = await pub('POST', url, corpoCandidatura({ consentimento: false, respostas: { q1: 'sim' } }))
    expect(semConsent.status).toBe(400)
    expect(semConsent.json.campos.consentimento).toBeTruthy()
    const semTriagem = await pub('POST', url, corpoCandidatura())
    expect(semTriagem.status).toBe(400)
    expect(semTriagem.json.campos.pergunta_q1).toBeTruthy()
    const emailRuim = await pub('POST', url, corpoCandidatura({ email: 'nao-e-email', respostas: { q1: 'sim' } }))
    expect(emailRuim.json.campos.email).toBeTruthy()
    const txt = await pub('POST', url, corpoCandidatura({ respostas: { q1: 'sim' }, curriculo: { nome: 'x.pdf', base64: Buffer.from('isto não é um pdf de verdade').toString('base64') } }))
    expect(txt.status).toBe(400)
    expect(txt.json.campos.curriculo).toMatch(/Formatos aceitos/)
    const exe = await pub('POST', url, corpoCandidatura({ respostas: { q1: 'sim' }, curriculo: { nome: 'x.pdf', base64: Buffer.from('MZ\x90\x00\x03\x00\x00\x00 programa').toString('base64') } }))
    expect(exe.status).toBe(400)
    const grande = Buffer.concat([Buffer.from('%PDF-1.4\n'), Buffer.alloc(3.2 * 1024 * 1024, 65)]).toString('base64')
    const g = await pub('POST', url, corpoCandidatura({ respostas: { q1: 'sim' }, curriculo: { nome: 'x.pdf', base64: grande } }))
    expect(g.status).toBe(400)
    expect(g.json.erro).toMatch(/3 MB/)
    expect((await m.pg.query('select 1 from rec_candidaturas where vaga_id = $1', [v.id])).rowCount).toBe(0)
  })

  it('isca anti-robô: campo "website" preenchido não grava nada', async () => {
    const v = await criarVaga(m)
    const r = await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura({ website: 'http://spam' }))
    expect(r.status).toBe(201)
    expect(r.json.codigoAcompanhamento).toBeUndefined()
    expect((await m.pg.query('select 1 from rec_candidaturas where vaga_id = $1', [v.id])).rowCount).toBe(0)
  })

  it('limita tentativas por IP', async () => {
    const v = await criarVaga(m)
    const ip = '8.8.8.8'
    let ultimo = 0
    for (let i = 0; i < 8; i++) ultimo = (await chamar(m, 'POST', `publico/vagas/${v.slug}/candidaturas`, { corpo: corpoCandidatura({ nome: 'x' }), ip })).status
    expect(ultimo).toBe(429)
  })
})

describe('portal público · acompanhamento', () => {
  it('mostra status amigável sem notas, avaliações nem nomes internos de etapas', async () => {
    const v = await criarVaga(m)
    const r = await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())
    const token = r.json.codigoAcompanhamento
    const cand = (await m.pg.query<any>('select id from rec_candidaturas where vaga_id = $1', [v.id])).rows[0]
    await m.pg.query("insert into rec_candidatura_notas (candidatura_id, autor_id, texto, visibilidade) values ($1,'rh1','NOTA-INTERNA-SECRETA','rh')", [cand.id])
    await m.pg.query("insert into rec_avaliacoes (candidatura_id, avaliador_id, notas, parecer) values ($1,'rh1','{\"a\":1}'::jsonb,'AVALIACAO-SECRETA')", [cand.id])
    const a = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(a.status).toBe(200)
    expect(a.json.situacao).toBe('Candidatura recebida')
    expect(JSON.stringify(a.json)).not.toMatch(/SECRETA|Triagem|avali/i)
    expect((await pub('POST', 'publico/candidaturas/acompanhar', { token: 'codigo-errado-123' })).status).toBe(404)
    expect((await pub('POST', 'publico/candidaturas/acompanhar', {})).status).toBe(400)
  })

  it('o candidato pode desistir pelo código', async () => {
    const v = await criarVaga(m)
    const token = (await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())).json.codigoAcompanhamento
    expect((await pub('POST', 'publico/candidaturas/desistir', { token })).status).toBe(200)
    const a = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(a.json.podeDesistir).toBe(false)
    expect((await pub('POST', 'publico/candidaturas/desistir', { token })).status).toBe(409)
  })
})

describe('rotas públicas não leem cookie de sessão', () => {
  it('mesmo logado, o resultado do portal é o mesmo (sem dados internos)', async () => {
    await criarVaga(m, { titulo: 'Vaga Logado' })
    const r = await chamar(m, 'GET', 'publico/vagas', { cookie: m.c.rh1, ip: '7.7.7.7' })
    expect(JSON.stringify(r.json)).not.toMatch(/SEGREDO-RH/)
  })
  it('PDF_B64 é um PDF válido para os testes', () => { expect(Buffer.from(PDF_B64, 'base64').subarray(0, 5).toString()).toBe('%PDF-') })
})
