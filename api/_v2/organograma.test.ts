import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST } from './teste/harness'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const ver = async (cookie: string, q?: Record<string, string>) => (await GET(m, 'organograma', cookie, q)).json
const PROIBIDAS = ['salario', 'remuneracao', 'contrato', 'cpf', 'cnpj', 'pixChave', 'banco', 'agencia', 'conta', 'nascimento', 'avaliacao', 'respostas', 'razaoSocial']
const chaves = (v: unknown, acc: string[] = []): string[] => {
  if (Array.isArray(v)) v.forEach((x) => chaves(x, acc))
  else if (v && typeof v === 'object') for (const [k, x] of Object.entries(v)) { acc.push(k); chaves(x, acc) }
  return acc
}

beforeAll(async () => {
  m = await mundoPadrao()
  // Telefone/cidade e uma pessoa que ocultou o contato; dados sensíveis só para provar que não vazam.
  await m.pg.query(`update app_colaboradores set dados = dados || '{"telefone":"11 90000-0001","cidade":"São Paulo","uf":"SP","cpf":"123","pixChave":"x","banco":"B","salario":9000,"nascimento":"1990-01-01"}'::jsonb where id = 'col1'`)
  await m.pg.query(`update app_colaboradores set dados = dados || '{"telefone":"11 90000-0002","privacidade":{"ocultarContato":true}}'::jsonb where id = 'col2'`)
}, 60_000)

describe('GET organograma', () => {
  it('exige sessão e a capacidade org:ver', async () => {
    expect((await GET(m, 'organograma')).status).toBe(401)
    expect((await GET(m, 'organograma', m.c.col1)).status).toBe(200)
  })

  it('monta a árvore pelos vínculos reais: gestores e subordinados', async () => {
    const r = await ver(m.c.col1)
    const por = Object.fromEntries(r.itens.map((p: any) => [p.id, p]))
    expect(por.col1.gestorId).toBe('ger1')
    expect(por.col2.gestorId).toBe('ger2')
    expect(por.ger1.diretos).toBe(1)
    expect(por.ger1.lidera).toBe(true)
    expect(por.col1.cargo).toBe('Advogado(a)')
    expect(por.col1.setor).toBe('Jurídico')
    expect(r.raizes).toEqual(expect.arrayContaining(['ger1', 'ger2']))
    expect(r.parcial).toBe(false)
  })

  it('colaborador não vê contato; quem tem org:ver_contato vê, respeitando quem ocultou', async () => {
    const col = await ver(m.c.col2)
    expect(col.itens.every((p: any) => p.contato === null)).toBe(true)
    const rh = await ver(m.c.rh1)
    const por = Object.fromEntries(rh.itens.map((p: any) => [p.id, p]))
    expect(por.col1.contato).toMatchObject({ email: 'col1@teste.local', telefone: '11 90000-0001', cidade: 'São Paulo' })
    expect(por.col2.contato).toBeNull() // ocultou
  })

  it('nunca expõe dados sensíveis, para nenhum papel', async () => {
    for (const k of ['col1', 'ger1', 'rh1', 'admin1', 'dir1']) {
      const r = await GET(m, 'organograma', m.c[k])
      expect(chaves(r.json).filter((c) => PROIBIDAS.includes(c)), k).toEqual([])
      expect(JSON.stringify(r.json), k).not.toMatch(/:9000[,}]|"123"|1990-01-01/)
    }
  })

  it('pessoas encerradas não aparecem no mapa e só quem gerencia pessoas as lista', async () => {
    await m.pg.query(`update app_colaboradores set dados = jsonb_set(dados, '{status}', '"encerrado"') where id = 'col2'`)
    const col = await ver(m.c.col1)
    expect(col.itens.find((p: any) => p.id === 'col2')).toBeUndefined()
    expect(col.encerradas).toEqual([])
    const rh = await ver(m.c.rh1)
    expect(rh.encerradas.map((p: any) => p.id)).toEqual(['col2'])
    await m.pg.query(`update app_colaboradores set dados = jsonb_set(dados, '{status}', '"ativo"') where id = 'col2'`)
  })

  it('filtra por área e por equipe do gestor', async () => {
    const s = await ver(m.c.col1, { setor: 's2' })
    expect(s.itens.map((p: any) => p.id).sort()).toEqual(['col2', 'ger2'].sort())
    const e = await ver(m.c.col1, { gestor: 'ger1' })
    expect(e.itens.map((p: any) => p.id).sort()).toEqual(['col1', 'ger1'])
    // recorte sem o gestor: a pessoa vira raiz do recorte, apontando o gestor que ficou de fora
    const so = (await ver(m.c.col1, { setor: 's1' })).itens.find((p: any) => p.id === 'col1')
    expect(so.gestorId).toBe('ger1')
  })

  it('posições vagas vêm das vagas reais (nada inventado) e vagas não publicadas só aparecem a quem vê vagas', async () => {
    expect((await ver(m.c.rh1)).posicoesVagas).toEqual([])
    await m.pg.query(`insert into rec_vagas (codigo, slug, titulo, setor_id, gestor_imediato_id, status, qtd_posicoes, posicoes_preenchidas)
      values ('VAG-1','a','Advogado Júnior','s1','ger1','publicada',3,1), ('VAG-2','b','Substituição confidencial','s1','ger1','aprovada',1,0),
             ('VAG-3','c','Rascunho','s1','ger1','rascunho',1,0)`)
    const rh = await ver(m.c.rh1)
    expect(rh.posicoesVagas.map((v: any) => [v.titulo, v.abertas, v.gestorId]).sort()).toEqual([['Advogado Júnior', 2, 'ger1'], ['Substituição confidencial', 1, 'ger1']])
    const col = await ver(m.c.col1)
    expect(col.posicoesVagas.map((v: any) => v.titulo)).toEqual(['Advogado Júnior'])
    expect(JSON.stringify(col)).not.toMatch(/confidencial/)
  })
})

describe('estruturas grandes: carga progressiva', () => {
  it('acima do limite devolve só os primeiros níveis e o ramo vem sob demanda', async () => {
    const g = await mundoPadrao()
    const itens = Array.from({ length: 320 }, (_, i) => ({ id: `x${i}`, nome: `Pessoa ${String(i).padStart(3, '0')}`, status: 'ativo', papel: 'colaborador', setorId: 's1', cargoId: 'g1', responsavelId: i === 0 ? null : i < 6 ? 'x0' : `x${(i % 5) + 1}`, email: `x${i}@t.l` }))
    for (let i = 0; i < itens.length; i++) await g.pg.query('insert into app_colaboradores (ord, id, dados) values ($1,$2,$3::jsonb)', [100 + i, itens[i].id, JSON.stringify(itens[i])])
    const r = (await GET(g, 'organograma', g.c.rh1)).json
    expect(r.parcial).toBe(true)
    expect(r.itens.length).toBeLessThan(r.total)
    const x1 = r.itens.find((p: any) => p.id === 'x1')
    expect(x1.diretos).toBeGreaterThan(0)
    expect(r.itens.some((p: any) => p.gestorId === 'x1')).toBe(false) // nível 3 ainda não veio
    const ramo = (await GET(g, 'organograma/ramo/x1', g.c.rh1)).json
    expect(ramo.itens.length).toBe(x1.diretos)
    expect(ramo.itens.every((p: any) => p.gestorId === 'x1')).toBe(true)
    expect((await GET(g, 'organograma/ramo/nao-existe', g.c.rh1)).status).toBe(404)
  }, 60_000)
})

describe('busca por pessoa', () => {
  it('acha ignorando acentos e devolve o caminho de gestores', async () => {
    const r = (await GET(m, 'organograma/busca', m.c.col1, { q: 'caio' })).json
    expect(r.itens[0]).toMatchObject({ id: 'col1', caminho: ['ger1'] })
    expect((await GET(m, 'organograma/busca', m.c.col1, { q: 'x' })).json.itens).toEqual([])
  })
})

describe('análise, validação e snapshots', () => {
  it('a análise é restrita a RH/admin/analytics', async () => {
    expect((await GET(m, 'organograma/analise', m.c.col1)).status).toBe(403)
    expect((await GET(m, 'organograma/analise', m.c.ger1)).status).toBe(403)
    expect((await GET(m, 'organograma/analise', m.c.rh1)).status).toBe(200)
    expect((await GET(m, 'organograma/analise', m.c.dir1)).status).toBe(200) // diretoria tem analytics:ver
  })

  it('traz indicadores reais, pendências nomeadas e diz que ainda não há histórico', async () => {
    const r = (await GET(m, 'organograma/analise', m.c.rh1)).json
    expect(r.indicadores.totalAtivos).toBe(8)
    expect(r.indicadores.porSetor.find((s: any) => s.nome === 'Jurídico').qtd).toBeGreaterThan(0)
    expect(r.pendencias.some((p: any) => p.tipo === 'sem_gestor' && p.pessoa)).toBe(true)
    expect(r.evolucao).toBeNull()
    expect(r.mensagemEvolucao).toMatch(/histórico/)
    expect(r.retratos).toBe(1) // retrato do mês criado na primeira leitura
  })

  it('snapshot manual substitui o do mês, é auditado, e dois meses habilitam a linha do tempo', async () => {
    expect((await POST(m, 'organograma/snapshot', m.c.col1)).status).toBe(403)
    expect((await POST(m, 'organograma/snapshot', m.c.rh1)).status).toBe(200)
    const aud = await GET(m, 'auditoria', m.c.admin1, { entidade: 'organograma' })
    expect(aud.json.itens.length).toBe(1)
    await m.pg.query(`insert into org_snapshots (mes, dados) values ('2020-01-01', '{"ativos":3,"gestores":1,"niveis":2,"pendencias":0,"porSetor":[]}')`)
    const r = (await GET(m, 'organograma/analise', m.c.rh1)).json
    expect(r.evolucao.length).toBe(2)
    expect(r.mensagemEvolucao).toBeNull()
  })

  it('valida a troca de gestor: ciclo, auto-gestão, inativo; só quem edita', async () => {
    const v = (corpo: unknown, cookie = m.c.rh1) => POST(m, 'organograma/validar-mudanca', cookie, corpo)
    expect((await v({ pessoaId: 'col1', novoGestorId: 'ger2' }, m.c.col1)).status).toBe(403)
    const ok1 = (await v({ pessoaId: 'col1', novoGestorId: 'ger2' })).json
    expect(ok1).toMatchObject({ ok: true, erros: [], pessoa: 'Caio Colaborador', novoGestor: 'Gabi Gestora', gestorAtual: 'Gil Gestor' })
    expect(ok1.avisos[0]).toMatch(/outra área/)
    expect((await v({ pessoaId: 'col1', novoGestorId: 'col1' })).json.erros[0]).toMatch(/si mesma/)
    expect((await v({ pessoaId: 'ger1', novoGestorId: 'col1' })).json.erros[0]).toMatch(/ciclo/) // col1 já responde a ger1
    expect((await v({ pessoaId: 'col1', novoGestorId: 'fantasma' })).json.ok).toBe(false)
    expect((await v({})).status).toBe(400)
  })

  it('a API não escreve nas coleções legadas', async () => {
    const antes = (await m.pg.query("select dados from app_colaboradores where id = 'col1'")).rows[0].dados
    await POST(m, 'organograma/validar-mudanca', m.c.rh1, { pessoaId: 'col1', novoGestorId: 'ger2' })
    expect((await m.pg.query("select dados from app_colaboradores where id = 'col1'")).rows[0].dados).toEqual(antes)
  })
})
