/* Gestão de prestadores PJ: contrato → nota → conferência → aceite → conta → retenções → autorização → pagamento → conciliação. */
import { beforeAll, describe, expect, it } from 'vitest'
import { mundoPadrao, GET, POST, PUT, DEL, chamar } from './teste/harness'
import { calcularRetencao, divergenciasNota, liquido, somarMeses, vencimentoConta } from '../../src/domain/v2/financeiro'
import { processarAlertas } from './modulos/financeiro/painel'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const PDF = { nome: 'nf.pdf', base64: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64') }
const hoje = new Date().toISOString().slice(0, 10)
const comp = hoje.slice(0, 7)
let fornId = '', ctrId = ''

beforeAll(async () => {
  m = await mundoPadrao()
  // Funções financeiras: analista (rec1) e autorizador (dir1 tem fin:ver; ganha fin:autorizar pela função).
  await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('dir1','autorizador_pagamentos'), ('rec1','analista_financeiro')")
  const f = await POST(m, 'financeiro/fornecedores', m.c.rh1, { tipo: 'pj', razaoSocial: 'Caio Serviços Jurídicos Ltda', documento: '11.222.333/0001-81', representanteId: 'col1', regimeTributario: 'simples_nacional' })
  expect(f.status).toBe(201)
  fornId = f.json.id
  const k = await POST(m, 'financeiro/contratos', m.c.rh1, {
    numero: 'CT-2026-001', fornecedorId: fornId, gestorId: 'ger1', setorId: 's1', objeto: 'Assessoria jurídica', modeloRemuneracao: 'mensal_fixo', valor: 5000,
    tipoPrazo: 'determinado', inicio: `${comp}-01`, fim: somarMeses(`${comp}-01`, 12), dataAssinatura: `${comp}-01`, prazoPagamentoDias: 5,
  })
  expect(k.status).toBe(201)
  ctrId = k.json.id
}, 120_000)

describe('regras puras', () => {
  it('retenção: meio para cima na 2ª casa, em inteiros', () => {
    expect(calcularRetencao(5000, 1.5)).toBe(75)
    expect(calcularRetencao(333.33, 4.65)).toBe(15.5) // 15,499845 → 15,50
    expect(calcularRetencao(0.01, 50)).toBe(0.01) // 0,005 → 0,01
    expect(calcularRetencao(100, 0.0001)).toBe(0)
    expect(liquido(5000, [75, 15.5])).toBe(4909.5)
  })
  it('divergências e vencimento', () => {
    const k = { status: 'vigente', inicio: '2026-01-01', fim: '2026-12-31', valor: 5000, modeloRemuneracao: 'mensal_fixo', fornecedorId: 'f' }
    expect(divergenciasNota({ valorBruto: 5000, competencia: '2026-05', dataEmissao: '2026-05-30', fornecedorId: 'f' }, k, 0)).toEqual([])
    expect(divergenciasNota({ valorBruto: 5100, competencia: '2027-01', dataEmissao: '2027-01-30', fornecedorId: 'f' }, k, 1).map((d) => d.codigo)).toEqual(['valor_diferente', 'fora_da_vigencia', 'competencia_repetida'])
    expect(vencimentoConta('2026-05-10', 5, null, 10)).toBe('2026-05-15')
    expect(vencimentoConta('2026-05-10', null, '2026-05-01', 10)).toBe('2026-05-10')
    expect(somarMeses('2026-01-31', 1)).toBe('2026-02-28')
  })
})

describe('contratos', () => {
  it('ativar exige assinatura; vigente muda valor só por aditivo; legado espelhado', async () => {
    const d = await GET(m, `financeiro/contratos/${ctrId}`, m.c.rh1)
    expect(d.json.contrato.status).toBe('rascunho')
    expect((await POST(m, `financeiro/contratos/${ctrId}/ativar`, m.c.col1)).status).toBe(403)
    expect((await POST(m, `financeiro/contratos/${ctrId}/ativar`, m.c.rh1)).status).toBe(200)
    const v = (await GET(m, `financeiro/contratos/${ctrId}`, m.c.rh1)).json.contrato
    const tentativa = await PUT(m, `financeiro/contratos/${ctrId}`, m.c.rh1, { ...v, valor: 6000, versao: v.versao })
    expect(tentativa.status).toBe(409)
    expect(tentativa.json.erro).toMatch(/aditivo/)
    // O espelho legado (telas antigas) acompanha.
    const leg = (await m.pg.query<{ dados: any }>("select dados from app_contratos where id = $1", [ctrId])).rows[0].dados
    expect(leg).toMatchObject({ colaboradorId: 'col1', valorMensal: 5000, status: 'vigente' })
  })

  it('escopo: prestador e gestor veem; outra área não; colaborador não lista tudo', async () => {
    expect((await GET(m, `financeiro/contratos/${ctrId}`, m.c.col1)).status).toBe(200)
    expect((await GET(m, `financeiro/contratos/${ctrId}`, m.c.ger1)).status).toBe(200)
    expect((await GET(m, `financeiro/contratos/${ctrId}`, m.c.ger2)).status).toBe(404)
    expect((await GET(m, `financeiro/contratos/${ctrId}`, m.c.col2)).status).toBe(404)
    expect((await GET(m, 'financeiro/contratos', m.c.col2)).json.total).toBe(0)
    expect((await GET(m, 'financeiro/fornecedores', m.c.col1)).status).toBe(403)
    expect((await GET(m, 'financeiro/painel', m.c.ger1)).status).toBe(403)
  })
})

describe('nota fiscal → pagamento', () => {
  let notaId = '', contaId = ''

  it('prestador envia com arquivo; duplicada e sem arquivo são recusadas; outro não envia', async () => {
    const corpo = { contratoId: ctrId, numero: '123', serie: '1', dataEmissao: hoje, competencia: comp, valorBruto: 5000, arquivo: PDF }
    expect((await POST(m, 'financeiro/notas', m.c.col1, { ...corpo, arquivo: undefined })).status).toBe(400)
    expect((await POST(m, 'financeiro/notas', m.c.col1, { ...corpo, arquivo: { nome: 'x.pdf', base64: Buffer.from('não é pdf').toString('base64') } })).status).toBe(400)
    expect((await POST(m, 'financeiro/notas', m.c.col2, corpo)).status).toBe(403)
    const r = await POST(m, 'financeiro/notas', m.c.col1, corpo)
    expect(r.status).toBe(201)
    notaId = r.json.id
    expect((await POST(m, 'financeiro/notas', m.c.col1, corpo)).status).toBe(409)
    const det = await GET(m, `financeiro/notas/${notaId}`, m.c.col1)
    expect(det.json.nota.divergencias).toEqual([])
    expect(det.json.acoes.conferir).toBe(false)
    expect((await GET(m, `financeiro/notas/${notaId}/arquivo`, m.c.col2)).status).toBe(404)
    expect((await GET(m, `financeiro/notas/${notaId}/arquivo`, m.c.col1)).status).toBe(200)
  })

  it('aceite antes da conferência é recusado; prestador não confere a própria; devolução e reenvio', async () => {
    expect((await POST(m, `financeiro/notas/${notaId}/aceite`, m.c.ger1, { decisao: 'aprovar' })).status).toBe(409)
    expect((await POST(m, `financeiro/notas/${notaId}/conferir`, m.c.col1, { decisao: 'conferir' })).status).toBe(403)
    expect((await POST(m, `financeiro/notas/${notaId}/conferir`, m.c.rec1, { decisao: 'devolver' })).status).toBe(400)
    expect((await POST(m, `financeiro/notas/${notaId}/conferir`, m.c.rec1, { decisao: 'devolver', motivo: 'Descrição do serviço incompleta.' })).status).toBe(200)
    const re = await POST(m, `financeiro/notas/${notaId}/reenviar`, m.c.col1, { numero: '124', serie: '1', dataEmissao: hoje, competencia: comp, valorBruto: 5100, arquivo: PDF })
    expect(re.status).toBe(200)
    const det = (await GET(m, `financeiro/notas/${notaId}`, m.c.rh1)).json
    expect(det.nota.status).toBe('recebida')
    expect(det.nota.reenvios).toBe(1)
    expect(det.nota.divergencias.map((d: any) => d.codigo)).toContain('valor_diferente')
    expect(det.historico.map((h: any) => h.acao)).toEqual(expect.arrayContaining(['enviada', 'devolvida', 'reenviada']))
  })

  it('gestor de outra área não aceita; divergência exige justificativa; aceite cria uma conta com retenção da regra', async () => {
    await POST(m, `financeiro/fornecedores/${fornId}/regras-retencao`, m.c.rh1, { tipo: 'ISS', aliquota: 2, fundamento: 'Lei complementar municipal (exemplo de teste)', vigenciaInicio: `${comp}-01` })
    expect((await POST(m, `financeiro/notas/${notaId}/conferir`, m.c.rec1, { decisao: 'conferir' })).status).toBe(200)
    expect((await POST(m, `financeiro/notas/${notaId}/aceite`, m.c.ger2, { decisao: 'aprovar' })).status).toBe(403)
    expect((await POST(m, `financeiro/notas/${notaId}/aceite`, m.c.ger1, { decisao: 'aprovar' })).status).toBe(400)
    const a = await POST(m, `financeiro/notas/${notaId}/aceite`, m.c.ger1, { decisao: 'aprovar', justificativa: 'Horas extras de projeto aprovadas por e-mail.' })
    expect(a.status).toBe(200)
    contaId = a.json.contaId
    expect((await POST(m, `financeiro/notas/${notaId}/aceite`, m.c.ger1, { decisao: 'aprovar', justificativa: 'Repetindo o aceite agora.' })).status).toBe(409)
    const c = (await GET(m, `financeiro/contas/${contaId}`, m.c.rh1)).json
    expect(c.conta).toMatchObject({ valorBruto: 5100, valorRetencoes: 102, valorLiquido: 4998, status: 'prevista' })
    expect(c.retencoes[0]).toMatchObject({ tipo: 'ISS', origem: 'regra', revisadoPor: null })
    expect(c.acoes.autorizar).toBe(false)
    expect(c.bloqueios.join(' ')).toMatch(/revisão/)
  })

  it('autorização: retenção revisada, segregação e beneficiário bloqueados', async () => {
    expect((await POST(m, `financeiro/contas/${contaId}/autorizar`, m.c.dir1)).status).toBe(409)
    const c = (await GET(m, `financeiro/contas/${contaId}`, m.c.rh1)).json
    expect((await POST(m, `financeiro/contas/${contaId}/retencoes/${c.retencoes[0].id}/revisar`, m.c.col1)).status).toBe(403)
    expect((await POST(m, `financeiro/contas/${contaId}/retencoes/${c.retencoes[0].id}/revisar`, m.c.rh1)).status).toBe(200)
    // RH tem fin:aprovar mas não fin:autorizar.
    expect((await POST(m, `financeiro/contas/${contaId}/autorizar`, m.c.rh1)).status).toBe(403)
    // Pagamento antes da autorização é recusado.
    expect((await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rec1, { dataPagamento: hoje, forma: 'pix', referencia: 'E2E123', valorPago: 4998 })).status).toBe(409)
    expect((await POST(m, `financeiro/contas/${contaId}/autorizar`, m.c.dir1)).status).toBe(200)
  })

  it('pagamento manual: valor igual ao líquido, sem data futura, uma única vez; conciliação por outra pessoa', async () => {
    const amanha = new Date(Date.now() + 2 * 86400000).toISOString().slice(0, 10)
    expect((await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rec1, { dataPagamento: amanha, forma: 'pix', referencia: 'E2E123', valorPago: 4998 })).status).toBe(400)
    expect((await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rec1, { dataPagamento: hoje, forma: 'pix', referencia: 'E2E123', valorPago: 5100 })).status).toBe(400)
    expect((await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rec1, { dataPagamento: hoje, forma: 'pix', valorPago: 4998 })).status).toBe(400)
    // Em produção a segunda requisição concorrente espera o "for update" e cai no 409; o PGlite do teste tem uma só conexão, então é sequencial.
    const p1 = await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rec1, { dataPagamento: hoje, forma: 'pix', referencia: 'E2E123', valorPago: 4998 })
    const p2 = await POST(m, `financeiro/contas/${contaId}/pagamento`, m.c.rh1, { dataPagamento: hoje, forma: 'pix', referencia: 'E2E999', valorPago: 4998 })
    await expect(m.pg.query("insert into fin_pagamentos (conta_id, data_pagamento, forma, valor_pago, registrado_por) values ($1, current_date, 'pix', 1, 'x')", [contaId])).rejects.toThrow()
    expect([p1.status, p2.status].sort()).toEqual([200, 409])
    expect((await m.pg.query('select count(*)::int as n from fin_pagamentos where conta_id = $1', [contaId])).rows[0]).toEqual({ n: 1 })
    const quemPagou = p1.status === 200 ? 'rec1' : 'rh1'
    const outro = quemPagou === 'rec1' ? 'rh1' : 'rec1'
    expect((await POST(m, `financeiro/contas/${contaId}/conciliar`, m.c[quemPagou])).status).toBe(403)
    expect((await POST(m, `financeiro/contas/${contaId}/conciliar`, m.c[outro])).status).toBe(200)
    // Nota paga não pode ser cancelada.
    expect((await POST(m, `financeiro/notas/${notaId}/cancelar`, m.c.rh1, { motivo: 'Teste de cancelamento.' })).status).toBe(409)
  })

  it('prestador vê o pagamento com retenções; painel e agenda refletem os dados', async () => {
    const eu = (await GET(m, 'financeiro/eu', m.c.col1)).json
    expect(eu.pagamentos[0]).toMatchObject({ status: 'paga', valorLiquido: 4998 })
    expect(eu.pagamentos[0].retencoes).toEqual([{ tipo: 'ISS', valor: 102 }])
    const p = (await GET(m, 'financeiro/painel', m.c.dir1)).json
    expect(p.financeiro.pago.valor).toBe(4998)
    expect(p.financeiro.faturado.valor).toBe(5100)
    expect(p.contratos.ativos.valor).toBe(1)
    expect(p.financeiro.pago.definicao).toBeTruthy()
    // Folha: contrato de 5.000 quitado pelo bruto (o líquido 4.998 fica à parte, por causa da retenção).
    expect(p.folha).toMatchObject({ competencia: comp, total: 5000, pago: 5000, restante: 0, pagoLiquido: 4998, pessoas: 1, quitadas: 1 })
    expect(p.folha.itens[0]).toMatchObject({ contratoId: ctrId, situacao: 'pago', restante: 0 })
    expect((await GET(m, 'financeiro/agenda', m.c.rh1)).status).toBe(200)
    const csv = await GET(m, 'financeiro/contas/exportar', m.c.rh1)
    expect(csv.binario?.dados.toString('utf8')).toContain('4998,00')
  })

  it('financeiro registra como recebida sem arquivo; emissão vira a data do envio', async () => {
    const r = await POST(m, 'financeiro/notas', m.c.rh1, { contratoId: ctrId, numero: '125', competencia: comp, valorBruto: 5000 })
    expect(r.status).toBe(201)
    const det = (await GET(m, `financeiro/notas/${r.json.id}`, m.c.rh1)).json
    expect(det.nota.temArquivo).toBe(false)
    expect(det.nota.dataEmissao).toBe(hoje)
    expect((await GET(m, `financeiro/notas/${r.json.id}/arquivo`, m.c.rh1)).status).toBe(404)
  })

  it('prestador envia só o arquivo: número fica S/N e o valor vem do contrato mensal fixo', async () => {
    const corpo = { contratoId: ctrId, competencia: comp, arquivo: PDF }
    const r = await POST(m, 'financeiro/notas', m.c.col1, corpo)
    expect(r.status).toBe(201)
    const n = (await GET(m, `financeiro/notas/${r.json.id}`, m.c.rh1)).json.nota
    expect(n.numero).toBe('S/N')
    expect(n.valorBruto).toBe(5000)
    expect(n.dataEmissao).toBe(hoje)
    // Sem número não há como acusar duplicidade: a conferência lê o documento.
    expect((await POST(m, 'financeiro/notas', m.c.col1, corpo)).status).toBe(201)
  })
})

describe('encerramento, renovação automática e alertas', () => {
  it('encerramento comercial com pendências exige confirmação e não apaga histórico', async () => {
    const k2 = await POST(m, 'financeiro/contratos', m.c.rh1, { numero: 'CT-2', fornecedorId: fornId, objeto: 'Pareceres', valor: 1000, tipoPrazo: 'indeterminado', inicio: `${comp}-01`, dataAssinatura: `${comp}-01` })
    await POST(m, `financeiro/contratos/${k2.json.id}/ativar`, m.c.rh1)
    await POST(m, 'financeiro/notas', m.c.col1, { contratoId: k2.json.id, numero: '900', dataEmissao: hoje, competencia: comp, valorBruto: 1000, arquivo: PDF })
    const r1 = await POST(m, `financeiro/contratos/${k2.json.id}/encerrar`, m.c.rh1, { data: hoje, tipo: 'distrato', motivo: 'Acordo entre as partes.' })
    expect(r1.status).toBe(409)
    expect(r1.json.pendencias.notasEmAndamento).toBe(1)
    const r2 = await POST(m, `financeiro/contratos/${k2.json.id}/encerrar`, m.c.rh1, { data: hoje, tipo: 'distrato', motivo: 'Acordo entre as partes.', confirmarPendencias: true })
    expect(r2.status).toBe(200)
    expect((await GET(m, `financeiro/notas?contrato=${k2.json.id}`, m.c.rh1)).json.total).toBe(1)
  })

  it('renovação automática gera aditivo uma vez; alertas não duplicam', async () => {
    const r = await POST(m, 'financeiro/contratos', m.c.rh1, { numero: 'CT-AUTO', fornecedorId: fornId, objeto: 'Suporte', valor: 800, tipoPrazo: 'determinado', inicio: '2025-01-01', fim: '2025-12-31', renovacao: 'automatica', renovacaoMeses: 12, dataAssinatura: '2025-01-01' })
    await POST(m, `financeiro/contratos/${r.json.id}/ativar`, m.c.rh1)
    const a1 = await m.db.tx((t) => processarAlertas(t, hoje, 'teste'))
    expect(a1.renovacoes).toBe(1)
    const a2 = await m.db.tx((t) => processarAlertas(t, hoje, 'teste'))
    expect(a2.renovacoes).toBe(0)
    expect(a2.notificacoes).toBe(0)
    const d = (await GET(m, `financeiro/contratos/${r.json.id}`, m.c.rh1)).json
    expect(d.contrato.fim >= hoje).toBe(true)
    expect(d.aditivos[0].tipo).toBe('renovacao_automatica')
  })

  it('agendador exige CRON_SECRET', async () => {
    delete process.env.CRON_SECRET
    expect((await chamar(m, 'GET', 'financeiro/cron/alertas')).status).toBe(403)
    process.env.CRON_SECRET = 'segredo-do-agendador-123456'
    expect((await chamar(m, 'GET', 'financeiro/cron/alertas', { csrf: false })).status).toBe(403)
    const cab = await import('./nucleo')
    const ok = await cab.despachar({ db: m.db, rotas: (await import('./rotas')).ROTAS, lerSessao: () => null },
      { metodo: 'GET', caminho: ['financeiro', 'cron', 'alertas'], query: {}, corpo: {}, ip: '1.1.1.1', seguro: true, cabecalhos: { authorization: 'Bearer segredo-do-agendador-123456' } })
    expect(ok.status).toBe(200)
  })

  it('documento: envio próprio, conferência por outra pessoa, download restrito', async () => {
    const r = await POST(m, 'financeiro/documentos', m.c.col1, { categoria: 'certidao', titulo: 'Certidão negativa', validade: '2030-01-01', arquivo: PDF })
    expect(r.status).toBe(201)
    expect((await POST(m, 'financeiro/documentos', m.c.col1, { categoria: 'certidao', titulo: 'X', pessoaId: 'col2', arquivo: PDF })).status).toBe(403)
    expect((await GET(m, `financeiro/documentos/${r.json.id}/arquivo`, m.c.col2)).status).toBe(404)
    expect((await GET(m, `financeiro/documentos/${r.json.id}/arquivo`, m.c.ger1)).status).toBe(404)
    expect((await POST(m, `financeiro/documentos/${r.json.id}/conferir`, m.c.rh1, { decisao: 'valido' })).status).toBe(200)
    expect((await m.pg.query("select dados from app_documentos where id = $1", [r.json.id])).rows).toHaveLength(1)
    expect((await GET(m, 'financeiro/documentos', m.c.col2)).json.total).toBe(0)
  })

  it('remove retenção manual só antes da autorização', async () => {
    const c = await POST(m, 'financeiro/contas', m.c.rh1, { fornecedorId: fornId, descricao: 'Despesa de viagem acordada', valorBruto: 300, vencimento: hoje })
    expect(c.status).toBe(201)
    const r = await POST(m, `financeiro/contas/${c.json.id}/retencoes`, m.c.rh1, { tipo: 'IRRF', baseCalculo: 300, aliquota: 1.5, fundamento: 'Orientação contábil registrada (teste).' })
    expect(r.status).toBe(201)
    expect((await GET(m, `financeiro/contas/${c.json.id}`, m.c.rh1)).json.conta.valorRetencoes).toBe(4.5)
    expect((await DEL(m, `financeiro/contas/${c.json.id}/retencoes/${r.json.id}`, m.c.rh1)).status).toBe(200)
  })
})
