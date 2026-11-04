/* LGPD: retenção dos dados de candidatos (simular/aplicar, idempotente) e relatório de acessos a dados sensíveis. */
import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT } from './teste/harness'
import { criarVaga, PDF_B64 } from './teste/ats-fixtures'
import { processarRetencaoCandidatos, emailAnonimizado, NOME_ANONIMIZADO } from './lgpdRetencao'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

let seq = 0
async function candidato(vagaId: string, opts: { status?: string; mesesAtras?: number; curriculo?: boolean } = {}) {
  const r = await POST(m, 'ats/candidaturas', m.c.rh1, {
    vagaId, nome: `Fulana Retencao ${++seq}`, email: `ret${seq}-${Math.random().toString(36).slice(2, 6)}@ex.com`, telefone: '(11) 90000-0000', cidade: 'Recife', uf: 'PE',
    ...(opts.curriculo ? { curriculo: { nome: 'cv.pdf', base64: PDF_B64 } } : {}),
  })
  expect(r.status).toBe(201)
  const id = r.json.id as string, candidatoId = r.json.candidatoId as string
  if (opts.status) {
    await m.pg.query(`update rec_candidaturas set status = $2, encerrada_em = now() - ($3 || ' months')::interval, atualizado_em = now() - ($3 || ' months')::interval,
      respostas_triagem = '[{"perguntaId":"p1","texto":"Pretensão?","resposta":"Resposta pessoal"}]'::jsonb where id = $1`, [id, opts.status, String(opts.mesesAtras ?? 0)])
  }
  return { id, candidatoId }
}
async function noBanco(candidatoId: string, validoAte: string | null) {
  await m.pg.query("insert into rec_talentos (candidato_id, retencao_ate) values ($1, $2)", [candidatoId, validoAte])
  await m.pg.query("insert into rec_consentimentos (candidato_id, finalidade, base_legal, texto_versao, concedido, valido_ate) values ($1,'banco_talentos','consentimento','teste',true,$2)", [candidatoId, validoAte])
}

describe('retenção LGPD de candidatos', () => {
  it('configura o prazo, simula, aplica só nos elegíveis, apaga arquivos e é idempotente', async () => {
    // configuração (vagas:config) com validação
    expect((await PUT(m, 'recrutamento/config/privacidade', m.c.rh1, { dados: { retencaoMeses: 61, texto: 'Texto de privacidade suficientemente longo.', contato: 'dpo@ex.com', versao: 'v2' } })).status).toBe(400)
    expect((await PUT(m, 'recrutamento/config/privacidade', m.c.col1, { dados: { retencaoMeses: 6 } })).status).toBe(403)
    const cfg = await PUT(m, 'recrutamento/config/privacidade', m.c.rh1, { dados: { retencaoMeses: 6, texto: 'Texto de privacidade suficientemente longo.', contato: 'dpo@ex.com', versao: 'v2' } })
    expect(cfg.status).toBe(200)
    expect((await GET(m, 'recrutamento/config', m.c.rh1)).json.privacidade).toMatchObject({ retencaoMeses: 6, versao: 'v2', baseLegal: 'execucao_pre_contratual' })

    const v = await criarVaga(m), v2 = await criarVaga(m)
    const A = await candidato(v.id, { status: 'reprovado', mesesAtras: 8, curriculo: true })          // elegível
    const B = await candidato(v.id, { status: 'reprovado', mesesAtras: 8 })                            // tem outra ativa
    await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v2.id, nome: 'B de novo', email: (await m.pg.query<any>('select email from rec_candidatos where id = $1', [B.candidatoId])).rows[0].email })
    const C = await candidato(v.id, { status: 'desistiu', mesesAtras: 8 })                             // banco de talentos válido
    await noBanco(C.candidatoId, '2099-01-01')
    const D = await candidato(v.id, { status: 'reprovado', mesesAtras: 2, curriculo: true })          // dentro do prazo
    const E = await candidato(v.id, { status: 'encerrada', mesesAtras: 9 })                            // banco de talentos vencido
    await noBanco(E.candidatoId, '2020-01-01')
    const F = await candidato(v.id, { status: 'contratado', mesesAtras: 12 })                          // contratado: fica de fora

    // documento de etapa do candidato A (arquivo + vínculo) e questionário respondido
    const arqDoc = (await m.pg.query<{ id: string }>("insert into arq_arquivos (nome, mime, tamanho, sha256, conteudo, dono_tipo, dono_id) values ('rg.pdf','application/pdf',3,'x',decode('414243','hex'),'candidatura',$1) returning id", [A.id])).rows[0].id
    await m.pg.query("insert into rec_candidatura_documentos (candidatura_id, arquivo_id, enviado_por) values ($1,$2,'candidato')", [A.id, arqDoc])
    const q = (await m.pg.query<{ id: string }>("insert into rec_questionarios (vaga_id, tipo, titulo) values ($1,'fit_cultural','Fit') returning id", [v.id])).rows[0].id
    await m.pg.query("insert into rec_questionario_respostas (questionario_id, candidatura_id, versao, retrato, respostas) values ($1,$2,1,'{}'::jsonb,'{\"q1\":\"texto pessoal\"}'::jsonb)", [q, A.id])
    const cvA = (await m.pg.query<any>('select curriculo_arquivo_id from rec_candidaturas where id = $1', [A.id])).rows[0].curriculo_arquivo_id
    expect(cvA).toBeTruthy()

    // simular: só a administração (privacidade)
    expect((await POST(m, 'lgpd/candidatos/retencao', m.c.rh1, { simular: true })).status).toBe(403)
    const sim = await POST(m, 'lgpd/candidatos/retencao', m.c.admin1, { simular: true })
    expect(sim.status).toBe(200)
    expect(sim.json).toMatchObject({ simulacao: true, elegiveis: 2, anonimizados: 0, retencaoMeses: 6 })
    expect((await m.pg.query('select 1 from rec_candidatos where anonimizado_em is not null')).rowCount).toBe(0)
    // aplicar exige confirmação
    expect((await POST(m, 'lgpd/candidatos/retencao', m.c.admin1, { simular: false })).status).toBe(400)
    const ap = await POST(m, 'lgpd/candidatos/retencao', m.c.admin1, { simular: false, confirmar: true })
    expect(ap.status).toBe(200)
    expect(ap.json.anonimizados).toBe(2)

    const k = (await m.pg.query<any>('select * from rec_candidatos where id = $1', [A.candidatoId])).rows[0]
    expect(k).toMatchObject({ nome: NOME_ANONIMIZADO, email: emailAnonimizado(A.candidatoId), telefone: null, cidade: null, uf: null, linkedin: null })
    expect(k.anonimizado_em).toBeTruthy()
    expect((await m.pg.query('select 1 from arq_arquivos where id = any($1::uuid[])', [[cvA, arqDoc]])).rowCount).toBe(0)
    expect((await m.pg.query('select 1 from rec_candidatura_documentos where candidatura_id = $1', [A.id])).rowCount).toBe(0)
    expect((await m.pg.query('select 1 from rec_questionario_respostas where candidatura_id = $1', [A.id])).rowCount).toBe(0)
    const candA = (await m.pg.query<any>('select status, curriculo_arquivo_id, respostas_triagem from rec_candidaturas where id = $1', [A.id])).rows[0]
    expect(candA).toMatchObject({ status: 'reprovado', curriculo_arquivo_id: null, respostas_triagem: [] }) // a candidatura fica (estatística)
    expect((await m.pg.query('select 1 from rec_candidatura_movs where candidatura_id = $1', [A.id])).rowCount).toBeGreaterThan(0)
    expect((await m.pg.query<any>('select anonimizado_em from rec_candidatos where id = $1', [E.candidatoId])).rows[0].anonimizado_em).toBeTruthy()
    expect((await m.pg.query('select 1 from rec_talentos where candidato_id = $1', [E.candidatoId])).rowCount).toBe(0)
    for (const x of [B, C, D, F]) expect((await m.pg.query<any>('select anonimizado_em from rec_candidatos where id = $1', [x.candidatoId])).rows[0].anonimizado_em).toBeNull()
    expect((await m.pg.query<any>('select curriculo_arquivo_id from rec_candidaturas where id = $1', [D.id])).rows[0].curriculo_arquivo_id).toBeTruthy()

    // um evento de auditoria por candidato, sem dado pessoal
    const aud = (await m.pg.query<any>("select entidade_id, detalhes from aud_eventos where acao = 'anonimizado_retencao'")).rows
    expect(aud.map((a) => a.entidade_id).sort()).toEqual([A.candidatoId, E.candidatoId].sort())
    expect(JSON.stringify(aud)).not.toMatch(/Fulana|@ex\.com|Recife/)

    // idempotente (inclusive pela função do cron)
    expect(await processarRetencaoCandidatos(m.db)).toEqual({ anonimizados: 0 })
    expect((await POST(m, 'lgpd/candidatos/retencao', m.c.admin1, { simular: true })).json.elegiveis).toBe(0)
  })
})

describe('relatório de acessos a dados sensíveis', () => {
  it('lista o download de currículo e a leitura de notas do RH; filtra, exporta CSV; colaborador e RH sem auditoria não acessam', async () => {
    const v = await criarVaga(m)
    const c = await candidato(v.id, { curriculo: true })
    const dl = await GET(m, `ats/candidaturas/${c.id}/curriculo`, m.c.rh1)
    expect(dl.status).toBe(200)
    expect(dl.binario).toBeTruthy()
    await POST(m, `ats/candidaturas/${c.id}/notas`, m.c.rh1, { texto: 'NOTA-RH-CONFIDENCIAL', visibilidade: 'rh' })
    expect((await GET(m, `ats/candidaturas/${c.id}`, m.c.rh1)).status).toBe(200)

    expect((await GET(m, 'auditoria/sensiveis', m.c.col1)).status).toBe(403)
    expect((await GET(m, 'auditoria/sensiveis', m.c.rh1)).status).toBe(403)
    const r = await GET(m, 'auditoria/sensiveis', m.c.admin1, { colaboradorId: 'rh1' })
    expect(r.status).toBe(200)
    const cv = r.json.itens.find((i: any) => i.tipo === 'download_curriculo' && i.entidadeId === c.id)
    expect(cv).toMatchObject({ colaboradorNome: 'Rita RH', entidade: 'candidatura', tipoRotulo: 'Download de currículo' })
    expect(cv.registro).toContain('VAG-T-')
    expect(r.json.itens.some((i: any) => i.tipo === 'ver_notas_rh' && i.entidadeId === c.id)).toBe(true)
    expect(JSON.stringify(r.json)).not.toContain('NOTA-RH-CONFIDENCIAL')
    expect(JSON.stringify(r.json)).not.toContain(PDF_B64)
    // filtros
    const so = await GET(m, 'auditoria/sensiveis', m.c.admin1, { tipo: 'download_curriculo', entidade: 'candidatura' })
    expect(so.json.itens.every((i: any) => i.tipo === 'download_curriculo')).toBe(true)
    expect(so.json.total).toBeGreaterThanOrEqual(1)
    const hoje = new Date().toISOString().slice(0, 10)
    expect((await GET(m, 'auditoria/sensiveis', m.c.admin1, { de: '2000-01-01', ate: '2000-01-02' })).json.total).toBe(0)
    expect((await GET(m, 'auditoria/sensiveis', m.c.admin1, { de: hoje, ate: hoje, tipo: 'download_curriculo' })).json.total).toBeGreaterThanOrEqual(1)
    expect((await GET(m, 'auditoria/sensiveis', m.c.admin1, { tipo: 'inexistente' })).status).toBe(400)
    expect((await GET(m, 'auditoria/sensiveis', m.c.admin1, { colaboradorId: 'col1' })).json.total).toBe(0)
    // paginação
    const p1 = await GET(m, 'auditoria/sensiveis', m.c.admin1, { por: '1', pagina: '1' })
    expect(p1.json.itens).toHaveLength(1)
    expect(p1.json.total).toBeGreaterThanOrEqual(2)
    // CSV (e a própria exportação fica auditada)
    const csv = await GET(m, 'auditoria/sensiveis', m.c.admin1, { formato: 'csv', colaboradorId: 'rh1' })
    expect(csv.binario?.mime).toMatch(/text\/csv/)
    const texto = csv.binario!.dados.toString('utf8')
    expect(texto).toContain('Download de currículo')
    expect(texto).toContain('Rita RH')
    expect((await m.pg.query("select 1 from aud_eventos where acao = 'relatorio_sensiveis_exportado' and colaborador_id = 'admin1'")).rowCount).toBe(1)
  })
})
