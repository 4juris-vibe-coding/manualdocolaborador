import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, DEL, chamar } from './teste/harness'

let m: Awaited<ReturnType<typeof mundoPadrao>>
let tax: any

const ins = (colecao: string, ord: number, d: any) => m.pg.query(`insert into app_${colecao} (ord, id, dados) values ($1,$2,$3::jsonb)`, [ord, d.id, JSON.stringify(d)])

beforeAll(async () => {
  m = await mundoPadrao()
  await ins('competencias', 0, { id: 'cp1', tipo: 'desempenho', grupoId: 'gc', nome: 'Comunicação', peso: 1, cargoIds: ['g1'], ativo: true })
  await ins('competencias', 1, { id: 'cp2', tipo: 'desempenho', grupoId: 'gc', nome: 'Análise jurídica', peso: 1, cargoIds: [], ativo: true })
  await ins('contratos', 0, { id: 'k1', colaboradorId: 'col1', numero: '1', objeto: 'x', modalidade: 'mensal', valorMensal: 5000, inicio: '2026-01-01', renovacaoAutomatica: false, status: 'vigente', atualizadoEm: '2026-01-01' })
  await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('col1','analista_rh')")
  tax = (await GET(m, 'cargos/taxonomia', m.c.rh1)).json
}, 60_000)

const ficha = (extra: any = {}) => ({ codigo: 'adv-pl', descricaoOficial: 'Atua na advocacia consultiva.', objetivo: 'Proteger o cliente.', responsabilidades: 'Elaborar peças.', ...extra })

describe('taxonomia', () => {
  it('cria trilhas iniciais no primeiro uso e permite CRUD de famílias e níveis', async () => {
    expect(tax.trilhas.map((t: any) => t.nome)).toEqual(['Operacional', 'Técnica', 'Especialista', 'Liderança', 'Gestão executiva'])
    const f = await POST(m, 'cargos/taxonomia/familias', m.c.rh1, { nome: 'Jurídica' })
    expect(f.status).toBe(201)
    expect((await POST(m, 'cargos/taxonomia/familias', m.c.rh1, { nome: 'jurídica' })).status).toBe(409)
    const sub = await POST(m, 'cargos/taxonomia/familias', m.c.rh1, { nome: 'Contencioso', paiId: f.json.id })
    expect(sub.status).toBe(201)
    expect((await POST(m, 'cargos/taxonomia/familias', m.c.rh1, { nome: 'Sub-sub', paiId: sub.json.id })).status).toBe(400)
    const t = tax.trilhas[1]
    const n = await POST(m, `cargos/taxonomia/trilhas/${t.id}/niveis`, m.c.rh1, { nome: 'Staff', criteriosEvolucao: 'Liderança técnica' })
    expect(n.status).toBe(201)
    expect((await PUT(m, `cargos/taxonomia/niveis/${n.json.id}`, m.c.rh1, { nome: 'Staff II', ordem: 9 })).status).toBe(200)
    expect((await DEL(m, `cargos/taxonomia/niveis/${n.json.id}`, m.c.rh1)).status).toBe(200)
  })
  it('só quem gerencia altera; gestor lê', async () => {
    expect((await POST(m, 'cargos/taxonomia/familias', m.c.ger1, { nome: 'X' })).status).toBe(403)
    expect((await GET(m, 'cargos/taxonomia', m.c.ger1)).status).toBe(200)
    expect((await GET(m, 'cargos/taxonomia', m.c.col2)).status).toBe(403)
  })
})

describe('ficha oficial, aprovação e versões', () => {
  it('cria rascunho, valida código único e submete', async () => {
    const fam = (await GET(m, 'cargos/taxonomia', m.c.rh1)).json.familias.find((x: any) => x.nome === 'Jurídica')
    const r = await PUT(m, 'cargos/g1/ficha', m.c.rh1, ficha({ familiaId: fam.id, competenciasTecnicas: ['Direito civil'] }))
    expect(r.status).toBe(200)
    expect(r.json.ficha.codigo).toBe('ADV-PL')
    expect((await PUT(m, 'cargos/g2/ficha', m.c.rh1, ficha())).status).toBe(409) // código repetido
    expect((await PUT(m, 'cargos/g2/ficha', m.c.rh1, { descricaoOficial: 'x' })).status).toBe(200) // código gerado
    expect((await PUT(m, 'cargos/nao/ficha', m.c.rh1, ficha())).status).toBe(404)
    // submeter sem campos obrigatórios falha
    expect((await POST(m, 'cargos/g2/ficha/submeter', m.c.rh1)).status).toBe(400)
    expect((await POST(m, 'cargos/g1/ficha/submeter', m.c.rh1)).status).toBe(200)
    // editar durante aprovação é bloqueado
    expect((await PUT(m, 'cargos/g1/ficha', m.c.rh1, { objetivo: 'outro' })).status).toBe(409)
  })
  it('quem propõe não aprova (exceto admin); aprovador é notificado', async () => {
    expect((await POST(m, 'cargos/g1/ficha/decisao', m.c.rh1, { decisao: 'aprovar' })).status).toBe(403)
    expect((await POST(m, 'cargos/g1/ficha/decisao', m.c.ger1, { decisao: 'aprovar' })).status).toBe(403)
    const n = await GET(m, 'notificacoes', m.c.admin1)
    expect(n.json.itens.some((x: any) => x.titulo.includes('aguardando aprovação'))).toBe(true)
    expect((await POST(m, 'cargos/g1/ficha/decisao', m.c.admin1, { decisao: 'rejeitar' })).status).toBe(400) // justificativa
    const rej = await POST(m, 'cargos/g1/ficha/decisao', m.c.admin1, { decisao: 'rejeitar', justificativa: 'Faltam requisitos' })
    expect(rej.status).toBe(200)
    expect((await GET(m, 'cargos/g1/ficha', m.c.rh1)).json.ultimaRejeicao.justificativa).toBe('Faltam requisitos')
    await PUT(m, 'cargos/g1/ficha', m.c.rh1, { requisitosMinimos: 'OAB ativa' })
    await POST(m, 'cargos/g1/ficha/submeter', m.c.rh1)
    const ap = await POST(m, 'cargos/g1/ficha/decisao', m.c.admin1, { decisao: 'aprovar' })
    expect(ap.json.versao).toBe(1)
    const f = (await GET(m, 'cargos/g1/ficha', m.c.rh1)).json
    expect(f.ficha.status).toBe('vigente')
    expect(f.ficha.revisaoPendente).toBe(false)
  })
  it('editar ficha vigente gera nova versão sem perder a anterior e mostra diff', async () => {
    await PUT(m, 'cargos/g1/ficha', m.c.rh1, { objetivo: 'Objetivo revisado' })
    expect((await GET(m, 'cargos/g1/ficha', m.c.rh1)).json.ficha.status).toBe('rascunho')
    // versão vigente ainda alimenta o resumo
    const resumo1 = (await GET(m, 'cargos/g1/ficha-resumo', m.c.ger1)).json
    expect(resumo1.objetivo).toBe('Proteger o cliente.')
    await POST(m, 'cargos/g1/ficha/submeter', m.c.rh1)
    await POST(m, 'cargos/g1/ficha/decisao', m.c.admin1, { decisao: 'aprovar' })
    const vs = (await GET(m, 'cargos/g1/versoes', m.c.ger1)).json
    expect(vs.versoes.map((v: any) => v.versao)).toEqual([2, 1])
    const d = (await GET(m, 'cargos/g1/versoes/2', m.c.ger1)).json
    expect(d.mudancas.find((x: any) => x.campo === 'objetivo').de).toBe('Proteger o cliente.')
    expect((await GET(m, 'cargos/g1/versoes/9', m.c.ger1)).status).toBe(404)
  })
  it('ficha-resumo não contém valores nem faixa', async () => {
    const r = (await GET(m, 'cargos/g1/ficha-resumo', m.c.ger1)).json
    expect(JSON.stringify(r)).not.toMatch(/faixa|salari|"minimo"|"maximo"|valor/i)
    expect(r.aprovada).toBe(true)
    expect(r.titulo).toBe('Advogado(a)')
  })
  it('cargo inativo continua consultável e vinculável; reativa', async () => {
    expect((await POST(m, 'cargos/g1/ficha/inativar', m.c.ger1, { motivo: 'x' })).status).toBe(403)
    expect((await POST(m, 'cargos/g1/ficha/inativar', m.c.admin1, { motivo: 'Fusão de cargos' })).status).toBe(200)
    expect((await GET(m, 'cargos/g1/ficha', m.c.ger1)).json.ficha.status).toBe('inativo')
    expect((await GET(m, 'cargos/g1/ficha-resumo', m.c.ger1)).json.inativo).toBe(true)
    expect((await PUT(m, 'cargos/g1/ficha', m.c.rh1, { objetivo: 'x' })).status).toBe(409)
    const cat = (await GET(m, 'cargos/catalogo', m.c.rh1, { status: 'inativo' })).json
    expect(cat.itens.map((i: any) => i.cargoId)).toEqual(['g1'])
    expect((await POST(m, 'cargos/g1/ficha/reativar', m.c.admin1)).status).toBe(200)
    expect((await GET(m, 'cargos/g1/ficha', m.c.rh1)).json.ficha.status).toBe('vigente')
  })
  it('auditoria registra as ações', async () => {
    const a = (await GET(m, 'auditoria', m.c.admin1, { entidade: 'cargos_ficha', entidade_id: 'g1' })).json.itens.map((x: any) => x.acao)
    expect(a).toEqual(expect.arrayContaining(['criada', 'submetida', 'rejeitada', 'aprovada', 'inativada', 'reativada']))
  })
})

describe('catálogo, uso e governança', () => {
  it('filtra, pagina e resume; mostra uso por vagas e pessoas', async () => {
    await m.pg.query("insert into rec_vagas (codigo, slug, titulo, cargo_id, setor_id, status) values ('V9','v9','Adv','g1','s1','publicada')")
    const cat = (await GET(m, 'cargos/catalogo', m.c.ger1, { busca: 'advog', por: '1' })).json
    expect(cat.total).toBe(1)
    expect(cat.itens[0]).toMatchObject({ cargoId: 'g1', vagas: 1, pessoas: 8, familia: 'Jurídica' })
    expect(cat.resumo.total).toBe(2)
    const uso = (await GET(m, 'cargos/g1/uso', m.c.ger1)).json
    expect(uso.vagas.total).toBe(1)
    expect(uso.vagas.itens).toHaveLength(0) // gestor não lista vagas
    expect((await GET(m, 'cargos/g1/uso', m.c.rh1)).json.vagas.itens).toHaveLength(1)
  })
  it('governança: pendentes, duplicidades, revisões e notificação sem repetir', async () => {
    await PUT(m, 'cargos/g2/ficha', m.c.rh1, { descricaoOficial: 'Vendas', objetivo: 'Vender', responsabilidades: 'Prospectar' })
    await POST(m, 'cargos/g2/ficha/submeter', m.c.rh1)
    const g = (await GET(m, 'cargos/governanca', m.c.admin1)).json
    expect(g.pendentes).toHaveLength(1)
    expect(g.pendentes[0].podeDecidir).toBe(true)
    expect(g.revisoesPendentes.map((x: any) => x.cargoId)).toContain('g2')
    expect((await GET(m, 'cargos/governanca', m.c.ger1)).status).toBe(403)
    await m.pg.query("update app_cargos set dados = dados || '{\"nome\":\"Advogada Pleno\"}'::jsonb where id = 'g2'")
    await m.pg.query("update app_cargos set dados = dados || '{\"nome\":\"Advogado Pleno\"}'::jsonb where id = 'g1'")
    const g2 = (await GET(m, 'cargos/governanca', m.c.admin1)).json
    expect(g2.duplicidades.length).toBeGreaterThan(0)
    const a = await POST(m, 'cargos/governanca/notificar-revisoes', m.c.rh1)
    const b = await POST(m, 'cargos/governanca/notificar-revisoes', m.c.rh1)
    expect(a.json.notificacoes).toBeGreaterThan(0)
    const n = (await GET(m, 'notificacoes', m.c.rh1)).json.itens.filter((x: any) => x.titulo.startsWith('Revisão pendente'))
    expect(new Set(n.map((x: any) => x.titulo)).size).toBe(n.length) // sem duplicatas
    expect(b.status).toBe(200)
  })
})

describe('matriz de competências', () => {
  it('grava, lê, valida e aponta cobertura', async () => {
    const r = await PUT(m, 'cargos/g1/matriz', m.c.rh1, { itens: [{ competenciaId: 'cp2', nivelEsperado: 4, obrigatoria: true, criterio: 'Peças sem retrabalho' }] })
    expect(r.status).toBe(200)
    expect((await PUT(m, 'cargos/g1/matriz', m.c.rh1, { itens: [{ competenciaId: 'cp2', nivelEsperado: 6 }] })).status).toBe(400)
    expect((await PUT(m, 'cargos/g1/matriz', m.c.rh1, { itens: [{ competenciaId: 'zzz', nivelEsperado: 3 }] })).status).toBe(400)
    expect((await PUT(m, 'cargos/g1/matriz', m.c.ger1, { itens: [] })).status).toBe(403)
    const g = (await GET(m, 'cargos/g1/matriz', m.c.ger1)).json
    expect(g.itens[0]).toMatchObject({ competenciaId: 'cp2', nivelEsperado: 4, nome: 'Análise jurídica' })
    const mat = (await GET(m, 'cargos/matriz', m.c.ger1)).json
    expect(mat.entradas).toHaveLength(1)
    expect(mat.cobertura.semMatriz).toContain('g2')
    expect(mat.cobertura.ausentesDaMatriz).toEqual([{ cargoId: 'g1', competenciaId: 'cp1' }]) // atribuída na tela legada, ausente da matriz
  })
})

describe('faixas salariais', () => {
  const faixa = (x: any = {}) => ({ cargoId: 'g1', minimo: 4000, referencia: 5000, maximo: 6000, vigenciaInicio: '2026-01-01', ...x })
  let id1: string

  it('gestor, recrutador e colaborador nunca recebem valores; analista de RH recebe', async () => {
    expect((await GET(m, 'cargos/faixas', m.c.ger1)).status).toBe(403)
    expect((await GET(m, 'cargos/faixas', m.c.rec1)).status).toBe(403)
    expect((await GET(m, 'cargos/faixas', m.c.col2)).status).toBe(403)
    expect((await GET(m, 'cargos/faixas', m.c.col1)).status).toBe(200) // analista_rh
    expect((await POST(m, 'cargos/faixas', m.c.col1, faixa())).status).toBe(403) // analista não gerencia
    const ficha = (await GET(m, 'cargos/g1/ficha', m.c.ger1)).json
    expect(JSON.stringify(ficha)).not.toContain('faixaValor')
  })
  it('valida valores e impede vigência sobreposta no mesmo escopo', async () => {
    expect((await POST(m, 'cargos/faixas', m.c.rh1, faixa({ minimo: 9000 }))).status).toBe(400)
    expect((await POST(m, 'cargos/faixas', m.c.rh1, faixa({ referencia: 9999 }))).status).toBe(400)
    const a = await POST(m, 'cargos/faixas', m.c.rh1, faixa())
    expect(a.status).toBe(201); id1 = a.json.id
    await POST(m, `cargos/faixas/${id1}/submeter`, m.c.rh1)
    // sobreposição com a faixa em aprovação
    expect((await POST(m, 'cargos/faixas', m.c.rh1, faixa({ vigenciaInicio: '2026-06-01' }))).status).toBe(409)
    // escopo diferente (unidade) pode coexistir
    expect((await POST(m, 'cargos/faixas', m.c.rh1, faixa({ unidadeId: 'u1', vigenciaInicio: '2026-06-01' }))).status).toBe(201)
    expect((await POST(m, 'cargos/faixas', m.c.rh1, faixa({ unidadeId: 'inexistente' }))).status).toBe(400)
  })
  it('aprovação (não pelo proponente) torna vigente; revisão encerra a anterior', async () => {
    expect((await POST(m, `cargos/faixas/${id1}/decisao`, m.c.rh1, { decisao: 'aprovar' })).status).toBe(403)
    expect((await POST(m, `cargos/faixas/${id1}/decisao`, m.c.admin1, { decisao: 'aprovar' })).status).toBe(200)
    expect((await PUT(m, `cargos/faixas/${id1}`, m.c.rh1, faixa())).status).toBe(409) // vigente não se edita
    const rev = await POST(m, `cargos/faixas/${id1}/revisar`, m.c.rh1, { minimo: 4500, referencia: 5500, maximo: 6500, vigenciaInicio: '2026-07-01' })
    expect(rev.status).toBe(201)
    await POST(m, `cargos/faixas/${rev.json.id}/submeter`, m.c.rh1)
    expect((await POST(m, `cargos/faixas/${rev.json.id}/decisao`, m.c.admin1, { decisao: 'aprovar' })).status).toBe(200)
    const lista = (await GET(m, 'cargos/faixas', m.c.rh1, { cargoId: 'g1' })).json.itens
    const antiga = lista.find((x: any) => x.id === id1)
    expect(antiga).toMatchObject({ status: 'encerrada', vigenciaFim: '2026-06-30' })
    const h = (await GET(m, `cargos/faixas/${rev.json.id}/historico`, m.c.rh1)).json.itens
    expect(h.map((x: any) => x.id)).toEqual([rev.json.id, id1])
  })
  it('comparativo é agregado, sem valores, e detalhe só com permissão de contratos', async () => {
    const r = await chamar(m, 'GET', 'cargos/faixas/comparativo', { cookie: m.c.rh1, query: { detalhe: '1' } })
    expect(r.status).toBe(200)
    const g1 = r.json.cargos.find((x: any) => x.cargoId === 'g1')
    // hoje (data real do teste) a faixa nova pode ou não estar vigente; o total classificado deve cobrir as 8 pessoas do cargo
    expect(g1.abaixo + g1.dentro + g1.acima + g1.semFaixa + g1.semContrato + g1.moedaDiferente).toBe(8)
    expect(r.json.ressalva).toMatch(/apoio/)
    expect(JSON.stringify(r.json)).not.toMatch(/5000|valorMensal/)
    const an = await chamar(m, 'GET', 'cargos/faixas/comparativo', { cookie: m.c.col1, query: { detalhe: '1' } })
    expect(an.status).toBe(200)
    expect(an.json.pessoas).toBeUndefined() // analista sem pessoas:ver_contratos
    expect((await GET(m, 'cargos/faixas/comparativo', m.c.ger1)).status).toBe(403)
  })
  it('rascunho pode ser excluído; vigente não', async () => {
    const d = await POST(m, 'cargos/faixas', m.c.rh1, faixa({ cargoId: 'g2', vigenciaInicio: '2027-01-01' }))
    expect((await DEL(m, `cargos/faixas/${d.json.id}`, m.c.rh1)).status).toBe(200)
    expect((await DEL(m, `cargos/faixas/${id1}`, m.c.rh1)).status).toBe(409)
  })
})
