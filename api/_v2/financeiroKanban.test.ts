/* Papel Financeiro: kanban das notas, disparos de cobrança (manuais e automáticos) e pagamento que chega ao prestador. */
import { beforeAll, describe, expect, it } from 'vitest'
import { mundoPadrao, semear, cookieDe, ORG_BASE, GET, POST, PUT } from './teste/harness'
import { somarMeses } from '../../src/domain/v2/financeiro'
import { capacidadesDe } from '../../src/domain/permissions'
import { processarAlertas } from './modulos/financeiro/painel'
import { colunaDaNota } from './modulos/financeiro/kanban'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const PDF = { nome: 'nf.pdf', base64: Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64') }
const hoje = new Date().toISOString().slice(0, 10)
const comp = hoje.slice(0, 7)
const ctr: Record<string, string> = {}
const coluna = (k: any, c: string) => k.json.cartoes.filter((x: any) => x.coluna === c)

beforeAll(async () => {
  m = await mundoPadrao()
  // Pessoa com o papel Financeiro (fora da organização base, para não mudar as contagens das outras suítes).
  await semear(m, { ...ORG_BASE, pessoas: [...ORG_BASE.pessoas, { id: 'fin1', nome: 'Fabi Financeiro', papel: 'financeiro' }] })
  for (const p of [...ORG_BASE.pessoas.map((x) => x.id), 'fin1']) m.c[p] = await cookieDe(m, p)
  const pares = [['col1', '11.222.333/0001-81', 'CT-K-1', 'ger1', 's1'], ['col2', '45.723.174/0001-10', 'CT-K-2', 'ger2', 's2']]
  for (const [pessoa, doc, numero, gestor, setor] of pares) {
    const f = await POST(m, 'financeiro/fornecedores', m.c.rh1, { tipo: 'pj', razaoSocial: `${pessoa} Serviços Ltda`, documento: doc, representanteId: pessoa, regimeTributario: 'simples_nacional' })
    expect(f.status).toBe(201)
    const k = await POST(m, 'financeiro/contratos', m.c.rh1, {
      numero, fornecedorId: f.json.id, gestorId: gestor, setorId: setor, objeto: 'Serviços', modeloRemuneracao: 'mensal_fixo', valor: 3000,
      tipoPrazo: 'determinado', inicio: `${comp}-01`, fim: somarMeses(`${comp}-01`, 12), dataAssinatura: `${comp}-01`, prazoPagamentoDias: 5,
    })
    expect(k.status).toBe(201)
    expect((await POST(m, `financeiro/contratos/${k.json.id}/ativar`, m.c.rh1)).status).toBe(200)
    ctr[pessoa] = k.json.id
  }
}, 120_000)

describe('papel Financeiro', () => {
  it('tem o ciclo completo das notas e os disparos; diretoria só vê; RH dispara mas não autoriza', () => {
    const fin = capacidadesDe('financeiro')
    for (const c of ['fin:ver', 'fin:conferir', 'fin:aprovar', 'fin:autorizar', 'fin:pagar', 'fin:disparar'] as const) expect(fin.has(c)).toBe(true)
    expect(fin.has('pessoas:gerenciar')).toBe(false)
    expect(capacidadesDe('diretoria').has('fin:disparar')).toBe(false)
    expect(capacidadesDe('rh').has('fin:disparar')).toBe(true)
    expect(capacidadesDe('rh').has('fin:autorizar')).toBe(false)
    expect(capacidadesDe('admin').has('fin:disparar')).toBe(true)
  })
  it('coluna de cada situação', () => {
    expect(colunaDaNota('recebida', null)).toBe('recebida')
    expect(colunaDaNota('conferida', null)).toBe('recebida')
    expect(colunaDaNota('aprovada', 'prevista')).toBe('aprovada')
    expect(colunaDaNota('aprovada', 'paga')).toBe('paga')
    expect(colunaDaNota('devolvida', null)).toBe('recusada')
    expect(colunaDaNota('cancelada', null)).toBeNull()
  })
})

describe('kanban e disparos', () => {
  it('financeiro, RH, administração e diretoria veem o kanban; colaborador e liderança não', async () => {
    const k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(k.status).toBe(200)
    expect(coluna(k, 'aguardando').map((x: any) => x.pessoaId).sort()).toEqual(['col1', 'col2'])
    expect(k.json.capacidades).toMatchObject({ mover: true, pagar: true, autorizar: true, disparar: true })
    for (const p of ['rh1', 'admin1', 'dir1']) expect((await GET(m, 'financeiro/kanban', m.c[p])).status).toBe(200)
    expect((await GET(m, 'financeiro/kanban', m.c.dir1)).json.capacidades.mover).toBe(false)
    for (const p of ['col1', 'ger1']) expect((await GET(m, 'financeiro/kanban', m.c[p])).status).toBe(403)
  })

  it('disparo manual: notifica quem não enviou, registra o histórico; só quem tem fin:disparar', async () => {
    const corpo = { competencia: comp, publico: 'pendentes', assunto: 'NF de {{competencia}}', mensagem: 'Oi {{nome}}, envie a nota até {{prazo}} ({{contratos}}).' }
    expect((await POST(m, 'financeiro/disparos', m.c.col1, corpo)).status).toBe(403)
    expect((await POST(m, 'financeiro/disparos', m.c.dir1, corpo)).status).toBe(403)
    const d = await POST(m, 'financeiro/disparos', m.c.fin1, corpo)
    expect(d.status).toBe(201)
    expect(d.json.destinatarios).toBe(2)
    const ntf = (await m.pg.query<{ titulo: string; corpo: string }>("select titulo, corpo from ntf_notificacoes where destinatario_id = 'col1' and chave like 'disparo:%'")).rows
    expect(ntf).toHaveLength(1)
    expect(ntf[0].corpo).toContain('Oi Caio')
    expect(ntf[0].corpo).toContain('CT-K-1')
    const sel = await POST(m, 'financeiro/disparos', m.c.rh1, { ...corpo, publico: 'selecionados', pessoas: ['col2', 'rh1'] })
    expect(sel.json.destinatarios).toBe(1) // rh1 não presta contrato: ignorado
    const hist = await GET(m, `financeiro/disparos?competencia=${comp}`, m.c.dir1)
    expect(hist.json.itens).toHaveLength(2)
    const det = await GET(m, `financeiro/disparos/${d.json.id}`, m.c.fin1)
    expect(det.json.envios.map((e: any) => e.pessoaId).sort()).toEqual(['col1', 'col2'])
    expect(det.json.envios.every((e: any) => e.lida === false)).toBe(true)
    await m.pg.query("update ntf_notificacoes set lida_em = now() where destinatario_id = 'col1' and chave like 'disparo:%'")
    expect((await GET(m, `financeiro/disparos/${d.json.id}`, m.c.fin1)).json.envios.find((e: any) => e.pessoaId === 'col1').lida).toBe(true)
    const k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(coluna(k, 'aguardando').find((x: any) => x.pessoaId === 'col2').cobrancas).toBe(2)
  })

  it('disparo automático no dia configurado, uma única vez por dia e competência', async () => {
    const cfg = (await GET(m, 'financeiro/disparos/previa', m.c.fin1)).json
    expect(cfg.automatico.ativo).toBe(true)
    const novo = { ativo: true, dias: [0, 2], incluirDevolvidas: true, assunto: cfg.automatico.assunto, mensagem: cfg.automatico.mensagem }
    expect((await PUT(m, 'financeiro/disparos-automaticos', m.c.dir1, novo)).status).toBe(403)
    expect((await PUT(m, 'financeiro/disparos-automaticos', m.c.fin1, { ...novo, dias: [40] })).status).toBe(400)
    expect((await PUT(m, 'financeiro/disparos-automaticos', m.c.fin1, novo)).json.dias).toEqual([0, 2])
    const prazo = cfg.prazo as string
    const a1 = await m.db.tx((t) => processarAlertas(t, prazo, 'teste'))
    const a2 = await m.db.tx((t) => processarAlertas(t, prazo, 'teste'))
    expect(a1.disparos).toBe(1)
    expect(a2.disparos).toBe(0)
    const auto = (await m.pg.query<{ automatico: boolean; criado_por: string; canais: string[] }>('select automatico, criado_por, canais from fin_disparos where automatico')).rows
    expect(auto).toEqual([{ automatico: true, criado_por: 'sistema', canais: ['portal'] }]) // só dentro do sistema
    // Fora dos dias escolhidos, nada é disparado.
    expect((await m.db.tx((t) => processarAlertas(t, `${comp}-${prazo.slice(8) === '01' ? '02' : '01'}`, 'teste'))).disparos).toBe(0)
  })

  it('nota recebida → aprovada → paga pelo kanban; segregação vale; o prestador é avisado', async () => {
    const nf = await POST(m, 'financeiro/notas', m.c.col1, { contratoId: ctr.col1, numero: '501', serie: '1', dataEmissao: hoje, competencia: comp, valorBruto: 3000, arquivo: PDF })
    expect(nf.status).toBe(201)
    let k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(coluna(k, 'recebida').map((x: any) => x.id)).toEqual([nf.json.id])
    expect(coluna(k, 'aguardando').map((x: any) => x.pessoaId)).toEqual(['col2'])

    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.col1, { destino: 'aprovada' })).status).toBe(403)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.ger1, { destino: 'aprovada' })).status).toBe(403)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.fin1, { destino: 'aprovada' })).status).toBe(200)
    k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(coluna(k, 'aprovada')[0]).toMatchObject({ id: nf.json.id, contaStatus: 'prevista' })

    // Quem aprovou não autoriza (segregação ligada); RH registra pagamento mas não autoriza.
    const pag = { destino: 'paga', pagamento: { forma: 'pix', referencia: 'E123PIX' } }
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.fin1, pag)).json.erro).toMatch(/segregação/)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.rh1, pag)).json.erro).toMatch(/autorizado/)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.admin1, { destino: 'paga', pagamento: { forma: 'pix' } })).status).toBe(400)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.admin1, pag)).status).toBe(200)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.admin1, pag)).status).toBe(409)
    k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(coluna(k, 'paga')[0]).toMatchObject({ id: nf.json.id, pagoEm: hoje, liquido: 3000 })
    const aviso = (await m.pg.query<{ titulo: string }>("select titulo from ntf_notificacoes where destinatario_id = 'col1' and chave like 'conta-paga:%'")).rows
    expect(aviso.map((x) => x.titulo)).toEqual(['Pagamento realizado'])
    const eu = await GET(m, 'financeiro/eu', m.c.col1)
    expect(eu.json.notas[0]).toMatchObject({ id: nf.json.id, contaStatus: 'paga' })
  })

  it('recusa exige motivo, volta para o prestador e só sai da coluna com o reenvio', async () => {
    const nf = await POST(m, 'financeiro/notas', m.c.col2, { contratoId: ctr.col2, numero: '77', serie: '', dataEmissao: hoje, competencia: comp, valorBruto: 3000, arquivo: PDF })
    expect(nf.status).toBe(201)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.fin1, { destino: 'recusada' })).status).toBe(400)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.fin1, { destino: 'recusada', motivo: 'CNPJ do tomador errado' })).status).toBe(200)
    expect((await POST(m, `financeiro/notas/${nf.json.id}/mover`, m.c.fin1, { destino: 'aprovada' })).status).toBe(409)
    const k = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(coluna(k, 'recusada')[0]).toMatchObject({ id: nf.json.id, motivoDevolucao: 'CNPJ do tomador errado' })
    const ntf = (await m.pg.query<{ titulo: string }>("select titulo from ntf_notificacoes where destinatario_id = 'col2' and chave like 'nf-dev:%'")).rows
    expect(ntf).toHaveLength(1)
    // Devolvidas entram no público de cobrança.
    const prev = await GET(m, `financeiro/disparos/previa?competencia=${comp}`, m.c.fin1)
    expect(prev.json.contagem.devolvidas).toBe(1)
  })
})

describe('contratos-base', () => {
  it('cria contrato mensal vigente com valor a definir para quem não tem; idempotente; valor 0 não gera divergência', async () => {
    // rec1, ger1 etc. não têm contrato; criamos CPF para uma pessoa nova sem fornecedor.
    await m.pg.query(`insert into app_colaboradores (ord, id, dados) values (99, 'novo1', $1::jsonb)`, [JSON.stringify({ id: 'novo1', nome: 'Nina Nova', papel: 'colaborador', status: 'ativo', regime: 'autonomo', cpf: '529.982.247-25', setorId: 's1', responsavelId: 'ger1', dataEntrada: `${comp}-05`, email: 'novo1@teste.local' })])
    const prev = await GET(m, 'financeiro/contratos-base', m.c.fin1)
    expect(prev.json.pessoas.map((p: any) => p.pessoaId)).toContain('novo1')
    expect(prev.json.semDocumento.map((p: any) => p.pessoaId)).toContain('rh1') // sem CPF/CNPJ no cadastro
    expect((await POST(m, 'financeiro/contratos-base', m.c.dir1)).status).toBe(403)
    const g = await POST(m, 'financeiro/contratos-base', m.c.fin1)
    expect(g.status).toBe(200)
    expect(g.json.contratos).toBe(1)
    expect(g.json.fornecedores).toBe(1)
    expect((await POST(m, 'financeiro/contratos-base', m.c.fin1)).json.contratos).toBe(0)
    const k = (await m.pg.query<any>("select id, status, valor::float8 as valor, inicio::text as inicio, gestor_id, numero from fin_contratos where prestador_id = 'novo1'")).rows[0]
    expect(k).toMatchObject({ status: 'vigente', valor: 0, inicio: `${comp}-01`, gestor_id: 'ger1' })
    expect(k.numero).toMatch(/^PS-\d{4}-001$/)
    const kb = await GET(m, `financeiro/kanban?competencia=${comp}`, m.c.fin1)
    expect(kb.json.cartoes.find((x: any) => x.pessoaId === 'novo1')).toMatchObject({ coluna: 'aguardando', valor: 0 })
    // O valor é definido uma vez sem aditivo.
    const d = (await GET(m, `financeiro/contratos/${k.id}`, m.c.rh1)).json.contrato
    expect((await PUT(m, `financeiro/contratos/${k.id}`, m.c.rh1, { ...d, valor: 2500, versao: d.versao })).status).toBe(200)
    const d2 = (await GET(m, `financeiro/contratos/${k.id}`, m.c.rh1)).json.contrato
    expect((await PUT(m, `financeiro/contratos/${k.id}`, m.c.rh1, { ...d2, valor: 2600, versao: d2.versao })).status).toBe(409)
  })
})
