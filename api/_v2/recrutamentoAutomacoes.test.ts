/* Recrutamento: nome público da etapa nos editores, e-mail automático ao entrar na etapa,
   banco de talentos → vaga, convite de entrevista com .ics e indicadores do resumo de RH. */
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { mundoPadrao, chamar, GET, POST, PUT } from './teste/harness'
import { criarVaga, corpoCandidatura } from './teste/ats-fixtures'
import { enviarEmail } from './email'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const chaveOriginal = process.env.RESEND_API_KEY
beforeAll(async () => { delete process.env.RESEND_API_KEY; m = await mundoPadrao() }, 60_000)
afterAll(() => { if (chaveOriginal !== undefined) process.env.RESEND_API_KEY = chaveOriginal })
let ipN = 0
const pub = (metodo: string, caminho: string, corpo?: unknown) => chamar(m, metodo, caminho, { corpo, ip: `7.7.7.${++ipN}` })
let seq = 0
async function candidatar(vagaId: string) {
  const r = await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId, nome: `Pessoa Auto ${++seq}`, email: `auto${seq}-${Math.random().toString(36).slice(2, 6)}@ex.com` })
  expect(r.status).toBe(201)
  return r.json.id as string
}
const corpoEtapas = (etapas: any[], extra: (e: any) => Record<string, unknown> = () => ({})) => ({ etapas: etapas.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, cor: e.cor ?? null, ...extra(e) })) })

describe('nome público da etapa', () => {
  it('kanban (ats) grava, valida, mantém quando ausente e aparece no acompanhamento do candidato', async () => {
    const v = await criarVaga(m)
    const pipe = async () => (await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)).json.etapas as any[]
    let et = await pipe()
    expect(et.every((e) => e.nomePublico === null)).toBe(true)
    // muito longo → 400
    const longo = await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, corpoEtapas(et, (e) => (e.tipo === 'triagem' ? { nomePublico: 'x'.repeat(81) } : {})))
    expect(longo.status).toBe(400)
    const r = await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, corpoEtapas(et, (e) => (e.tipo === 'triagem' ? { nomePublico: '  Conversa inicial  ' } : e.tipo === 'tecnica' ? { nomePublico: '' } : {})))
    expect(r.status).toBe(200)
    expect(r.json.etapas.find((e: any) => e.tipo === 'triagem').nomePublico).toBe('Conversa inicial')
    et = await pipe()
    expect(et.find((e) => e.tipo === 'triagem').nomePublico).toBe('Conversa inicial')
    expect(et.find((e) => e.tipo === 'tecnica').nomePublico).toBeNull()
    // renomear coluna sem mandar nomePublico (ex.: criação rápida no kanban) não apaga o nome público
    expect((await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, { etapas: et.map((e) => ({ id: e.id, nome: e.tipo === 'triagem' ? 'Triagem INTERNA-XYZ' : e.nome, tipo: e.tipo })) })).status).toBe(200)
    et = await pipe()
    expect(et.find((e) => e.tipo === 'triagem').nomePublico).toBe('Conversa inicial')

    // candidato acompanha: vê o nome público, nunca o interno
    const token = (await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())).json.codigoAcompanhamento
    const cid = (await m.pg.query<{ id: string }>('select id from rec_candidaturas where vaga_id = $1', [v.id])).rows[0].id
    expect((await POST(m, `ats/candidaturas/${cid}/mover`, m.c.rh1, { etapaId: et.find((e) => e.tipo === 'triagem').id })).status).toBe(200)
    const a = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(a.json.etapaAtual).toBe('Conversa inicial')
    expect(JSON.stringify(a.json)).not.toContain('INTERNA-XYZ')
  })

  it('editor de etapas da vaga grava, devolve no detalhe e "duplicar" copia', async () => {
    const v = await criarVaga(m)
    const det = await GET(m, `vagas/${v.id}`, m.c.rh1)
    expect(det.status).toBe(200)
    const et = det.json.etapas as any[]
    const r = await PUT(m, `vagas/${v.id}/etapas`, m.c.rh1, { etapas: et.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, nomePublico: e.tipo === 'tecnica' ? 'Desafio prático' : null })) })
    expect(r.status).toBe(200)
    expect(r.json.etapas.find((e: any) => e.tipo === 'tecnica').nomePublico).toBe('Desafio prático')
    expect(r.json.etapas.find((e: any) => e.tipo === 'triagem').nomePublico).toBeNull()
    expect((await PUT(m, `vagas/${v.id}/etapas`, m.c.rh1, { etapas: et.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, nomePublico: 'y'.repeat(81) })) })).status).toBe(400)
    const dup = await POST(m, `vagas/${v.id}/duplicar`, m.c.rh1)
    expect(dup.status).toBe(201)
    expect(dup.json.etapas.find((e: any) => e.tipo === 'tecnica').nomePublico).toBe('Desafio prático')
  })
})

describe('e-mail automático ao entrar na etapa', () => {
  it('etapa com aviso registra a comunicação (nao_configurado sem chave) com o nome público, nunca o interno', async () => {
    const v = await criarVaga(m)
    const et = (await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)).json.etapas as any[]
    // etapa de entrevista com nome interno "secreto" e nome público
    await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, corpoEtapas(et, (e) => (e.tipo === 'entrevista_rh' ? { nome: 'ETAPA-INTERNA-SECRETA', nomePublico: 'Bate-papo com o RH' } : {})))
    const ent = et.find((e) => e.tipo === 'entrevista_rh'), tec = et.find((e) => e.tipo === 'tecnica'), ger = et.find((e) => e.tipo === 'entrevista_gestor')
    // o modelo passa a usar {{etapa}} no assunto e no corpo
    expect((await PUT(m, 'ats/templates/atualizacao_etapa', m.c.rh1, { assunto: 'Etapa: {{etapa}}', corpo: 'Olá {{nome}}, agora você está em "{{etapa}}" na vaga {{vaga}}.' })).status).toBe(200)
    const cfg = await PUT(m, `ats/vagas/${v.id}/etapas/${ent.id}/config`, m.c.rh1, { avisarCandidato: true })
    expect(cfg.status).toBe(200)
    expect(cfg.json).toMatchObject({ avisarCandidato: true, solicitaDocumentos: false })
    await PUT(m, `ats/vagas/${v.id}/etapas/${ger.id}/config`, m.c.rh1, { avisarCandidato: true })
    const lido = (await GET(m, `ats/vagas/${v.id}/avaliacoes-etapa`, m.c.rh1)).json.etapas as any[]
    expect(lido.find((e) => e.id === ent.id).avisarCandidato).toBe(true)
    expect(lido.find((e) => e.id === tec.id).avisarCandidato).toBe(false)

    const id = await candidatar(v.id)
    const coms = async () => (await m.pg.query<any>('select template_chave, assunto, corpo, status from rec_comunicacoes where candidatura_id = $1 order by criado_em', [id])).rows
    // etapa sem aviso: nada
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: tec.id })).json.comunicacao).toBeUndefined()
    expect(await coms()).toHaveLength(0)
    // etapa com aviso: envia pelo mesmo caminho de notificarCandidato:true
    const mv = await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: ent.id })
    expect(mv.status).toBe(200)
    expect(mv.json.comunicacao).toMatchObject({ status: 'nao_configurado', automatica: true })
    const lista = await coms()
    expect(lista).toHaveLength(1)
    expect(lista[0]).toMatchObject({ template_chave: 'atualizacao_etapa', status: 'nao_configurado' })
    expect(lista[0].status).not.toBe('enviada')
    expect(lista[0].assunto).toBe('Etapa: Bate-papo com o RH')
    expect(lista[0].corpo).toContain('Bate-papo com o RH')
    expect(JSON.stringify(lista)).not.toContain('ETAPA-INTERNA-SECRETA')
    // notificarCandidato:false explícito desliga o automático
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: ger.id, notificarCandidato: false })).json.comunicacao).toBeUndefined()
    expect(await coms()).toHaveLength(1)
    // sem nome público, usa o rótulo genérico do tipo (não o nome interno "Entrevista com gestor")
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: tec.id })).status).toBe(200)
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: ger.id })).json.comunicacao.status).toBe('nao_configurado')
    const ult = (await coms()).at(-1)
    expect(ult.assunto).toBe('Etapa: Entrevista')
    expect(ult.corpo).not.toContain('Entrevista com gestor')
    // restaura o modelo para os outros testes
    await PUT(m, 'ats/templates/atualizacao_etapa', m.c.rh1, { assunto: 'Atualização da sua candidatura — {{vaga}}', corpo: 'Olá, {{nome}}! A sua candidatura à vaga "{{vaga}}" avançou.' })
  })
})

describe('banco de talentos → vaga', () => {
  it('cria a candidatura na primeira etapa com origem banco_talentos; 409 se repetir, vaga encerrada ou autorização revogada', async () => {
    const vA = await criarVaga(m), vB = await criarVaga(m, { titulo: 'Vaga destino' }), vEnc = await criarVaga(m, { status: 'encerrada' }), vC = await criarVaga(m, { titulo: 'Outra vaga' })
    const c0 = await candidatar(vA.id)
    const cid = (await m.pg.query<{ candidato_id: string }>('select candidato_id from rec_candidaturas where id = $1', [c0])).rows[0].candidato_id
    // fora do banco de talentos: 404
    expect((await POST(m, `ats/talentos/${cid}/candidatar`, m.c.rh1, { vagaId: vB.id })).status).toBe(404)
    expect((await POST(m, 'ats/talentos', m.c.rh1, { candidatoId: cid, confirmaAutorizacao: true, comoAutorizou: 'Formulário assinado', retencaoMeses: 12 })).status).toBe(201)
    // sem permissão
    expect((await POST(m, `ats/talentos/${cid}/candidatar`, m.c.ger1, { vagaId: vB.id })).status).toBe(403)
    const r = await POST(m, `ats/talentos/${cid}/candidatar`, m.c.rh1, { vagaId: vB.id })
    expect(r.status).toBe(201)
    const c = (await m.pg.query<any>('select origem, etapa_id, status from rec_candidaturas where id = $1', [r.json.id])).rows[0]
    expect(c).toMatchObject({ origem: 'banco_talentos', status: 'ativa', etapa_id: vB.etapas[0].id })
    expect((await m.pg.query('select 1 from rec_candidatura_movs where candidatura_id = $1', [r.json.id])).rowCount).toBe(1)
    expect((await m.pg.query("select 1 from aud_eventos where entidade = 'candidatura' and entidade_id = $1 and acao = 'talento_adicionado_vaga'", [r.json.id])).rowCount).toBe(1)
    // de novo na mesma vaga
    expect((await POST(m, `ats/talentos/${cid}/candidatar`, m.c.rh1, { vagaId: vB.id })).status).toBe(409)
    // vaga encerrada
    const enc = await POST(m, `ats/talentos/${cid}/candidatar`, m.c.rh1, { vagaId: vEnc.id })
    expect(enc.status).toBe(409)
    expect(enc.json.erro).toMatch(/encerrada/)
    // autorização revogada
    await m.pg.query("update rec_consentimentos set revogado_em = now() where candidato_id = $1 and finalidade = 'banco_talentos'", [cid])
    const rev = await POST(m, `ats/talentos/${cid}/candidatar`, m.c.rh1, { vagaId: vC.id })
    expect(rev.status).toBe(409)
    expect(rev.json.erro).toMatch(/revogada ou venceu/)
  })
})

describe('convite de entrevista com .ics', () => {
  it('agendar com enviarConvite registra o convite sem simular envio', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v.id)
    const r = await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: '2026-12-01T13:00:00.000Z', fim: '2026-12-01T14:00:00.000Z', modalidade: 'online', localOuLink: 'https://meet.example.com/x', participantes: ['ger1'], enviarConvite: true })
    expect(r.status).toBe(201)
    expect(r.json.comunicacao.status).toBe('nao_configurado')
    const com = (await m.pg.query<any>("select corpo, status from rec_comunicacoes where candidatura_id = $1 and template_chave = 'convite_entrevista'", [id])).rows
    expect(com).toHaveLength(1)
    expect(com[0].corpo).toContain('https://meet.example.com/x')
    expect(com[0].corpo).toMatch(/2026/)
    // sem enviarConvite: nenhuma comunicação
    const r2 = await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: '2026-12-02T13:00:00.000Z', participantes: ['ger1'] })
    expect(r2.json.comunicacao).toBeUndefined()
  })

  it('o envio ao Resend leva o anexo em base64 só quando há anexo', async () => {
    process.env.RESEND_API_KEY = 'chave-de-teste'
    try {
      const corpos: any[] = []
      const fetchImpl = (async (_url: string, init: { body: string }) => { corpos.push(JSON.parse(init.body)); return new Response('{}', { status: 200 }) }) as unknown as typeof fetch
      const ics = 'BEGIN:VCALENDAR\r\nEND:VCALENDAR\r\n'
      expect((await enviarEmail('a@ex.com', 'Assunto', 'Corpo', { fetchImpl, anexos: [{ nome: 'entrevista.ics', conteudo: ics, tipo: 'text/calendar' }] })).status).toBe('enviada')
      expect(corpos[0].attachments).toHaveLength(1)
      expect(corpos[0].attachments[0].filename).toBe('entrevista.ics')
      expect(Buffer.from(corpos[0].attachments[0].content, 'base64').toString('utf8')).toBe(ics)
      await enviarEmail('a@ex.com', 'Assunto', 'Corpo', { fetchImpl })
      expect('attachments' in corpos[1]).toBe(false)
    } finally { delete process.env.RESEND_API_KEY }
  })
})

describe('resumo de recrutamento (painel de RH)', () => {
  it('inclui a origem dos contratados (agregado) e as vagas encerradas no período', async () => {
    const v = await criarVaga(m, { titulo: 'Vaga para contratar', qtd: 1 })
    const id = await candidatar(v.id)
    const contratado = v.etapas.find((e) => e.tipo === 'contratado')!.id
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: contratado })).status).toBe(200)
    const r = await GET(m, `analytics/resumo?fresh=1`, m.c.rh1)
    expect(r.status).toBe(200)
    const b = r.json.blocos.recrutamento
    expect(b.disponivel).toBe(true)
    const contr = b.indicadores.find((i: any) => i.chave === 'contratacoes').valor
    expect(b.origensContratados.reduce((s: number, o: any) => s + o.qtd, 0)).toBe(contr)
    expect(b.origensContratados.find((o: any) => o.origem === 'manual').qtd).toBeGreaterThanOrEqual(1)
    expect(JSON.stringify(b.origensContratados)).not.toMatch(/Pessoa Auto/)
    expect(b.vagasEncerradas).toBeGreaterThanOrEqual(1) // a vaga preenchida encerrou hoje
    expect((await GET(m, 'analytics/resumo', m.c.col1)).status).toBe(403)
  })
})
