import { describe, it, expect, beforeAll, beforeEach } from 'vitest'
import { mundoPadrao, GET, PUT } from './teste/harness'
import { criarVaga } from './teste/ats-fixtures'
import { limparCacheAnalytics } from './modulos/analytics'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const hoje = new Date().toISOString().slice(0, 10)
const diasAtras = (n: number) => new Date(Date.now() - n * 86400000).toISOString().slice(0, 10)
const resumo = (cookie: string, q: Record<string, string> = {}) => GET(m, 'analytics/resumo', cookie, { fresh: '1', ...q })
const ind = (bloco: any, chave: string) => bloco.indicadores.find((i: any) => i.chave === chave)

async function candidato(email: string) {
  return (await m.pg.query<{ id: string }>("insert into rec_candidatos (nome, email) values ($1,$2) returning id", [email.split('@')[0], email])).rows[0].id
}
async function candidatura(vagaId: string, etapaId: string | null, status: string, origem = 'portal', fimHa = 1) {
  const c = await candidato(`${Math.random().toString(36).slice(2, 9)}@x.com`)
  return (await m.pg.query<{ id: string }>(
    `insert into rec_candidaturas (vaga_id, candidato_id, etapa_id, status, origem, criado_em, atualizado_em, encerrada_em)
     values ($1,$2,$3,$4,$5, now() - interval '20 days', now() - ($6 || ' days')::interval, case when $4 = 'ativa' then null else now() - ($6 || ' days')::interval end) returning id`,
    [vagaId, c, etapaId, status, origem, String(fimHa)])).rows[0].id
}

const PERGUNTAS = [
  { id: 'q1', tipo: 'enps', texto: 'De 0 a 10, quanto você recomendaria a 4JURIS como lugar para trabalhar?', obrigatoria: true },
  { id: 'q2', tipo: 'likert', texto: 'Confio na liderança da minha área.', obrigatoria: true, dimensao: 'Liderança' },
]

async function pesquisa(titulo: string, modo: 'anonima' | 'identificada', respostas: { setor: string; enps: number; lik: number }[], convidados: string[], min = 5) {
  const p = (await m.pg.query<{ id: string }>(
    `insert into pq_pesquisas (titulo, modo, status, inicio, fim, min_grupo, versao_atual, publicada_em, categoria)
     values ($1,$2,'encerrada', $3::date, $4::date, $5, 1, now(), 'Clima') returning id`, [titulo, modo, diasAtras(20), diasAtras(5), min])).rows[0].id
  await m.pg.query("insert into pq_versoes (pesquisa_id, versao, titulo, modo, perguntas) values ($1,1,$2,$3,$4::jsonb)", [p, titulo, modo, JSON.stringify(PERGUNTAS)])
  for (const cid of convidados) {
    await m.pg.query("insert into pq_convites (pesquisa_id, colaborador_id, token_hash, expira_em, status) values ($1,$2,$3, now() + interval '5 days', 'usado')", [p, cid, `h-${p}-${cid}`])
  }
  for (const r of respostas) {
    await m.pg.query("insert into pq_respostas (pesquisa_id, versao, enviada_em, grupo, itens, colaborador_id) values ($1,1,$2::date,$3::jsonb,$4::jsonb,$5)",
      [p, diasAtras(10), JSON.stringify({ setorId: r.setor }), JSON.stringify({ q1: r.enps, q2: r.lik }), modo === 'identificada' ? 'col1' : null])
  }
  return p
}

beforeAll(async () => {
  m = await mundoPadrao()
  // Vagas da coorte (abertas há 15–25 dias)
  const v1 = await criarVaga(m, { titulo: 'Advogado(a) A', status: 'encerrada', setorId: 's1', qtd: 1, recrutador: 'rec1' })
  const v2 = await criarVaga(m, { titulo: 'Comercial B', status: 'publicada', setorId: 's2', qtd: 2, recrutador: 'rh1' })
  const v3 = await criarVaga(m, { titulo: 'Advogado(a) C', status: 'rascunho', setorId: 's1', qtd: 1, recrutador: 'rec1' })
  await m.pg.query("update rec_vagas set data_abertura = $2::date, publicada_em = now() - interval '25 days', primeira_candidatura_em = now() - interval '23 days', prazo_preenchimento = $3::date, posicoes_preenchidas = 1, encerrada_em = now() - interval '5 days', motivo_encerramento = 'preenchida' where id = $1",
    [v1.id, diasAtras(25), diasAtras(-10)])
  await m.pg.query("update rec_vagas set data_abertura = $2::date, publicada_em = now() - interval '15 days', primeira_candidatura_em = now() - interval '14 days', prazo_preenchimento = $3::date where id = $1", [v2.id, diasAtras(15), diasAtras(-30)])
  await m.pg.query("update rec_vagas set data_abertura = $2::date where id = $1", [v3.id, diasAtras(2)])
  const contratado = v1.etapas.find((e) => e.tipo === 'contratado')!, nova = v1.etapas.find((e) => e.tipo === 'nova')!
  const c1 = await candidatura(v1.id, contratado.id, 'contratado', 'portal', 5)
  await candidatura(v1.id, nova.id, 'reprovado', 'linkedin', 8)
  await candidatura(v2.id, v2.etapas.find((e) => e.tipo === 'nova')!.id, 'ativa', 'portal')
  await candidatura(v2.id, v2.etapas.find((e) => e.tipo === 'nova')!.id, 'ativa', 'indicacao')
  await m.pg.query("insert into rec_propostas (candidatura_id, valor, status) values ($1, 7000, 'aceita')", [c1])
  const c4 = await candidatura(v2.id, null, 'desistiu', 'portal')
  await m.pg.query("insert into rec_propostas (candidatura_id, valor, status) values ($1, 6500, 'recusada')", [c4])

  // Pesquisa anônima: 6 respostas do s1, 2 do s2 (grupo pequeno)
  await pesquisa('Clima 2026', 'anonima',
    [...[10, 9, 9, 8, 6, 10].map((e) => ({ setor: 's1', enps: e, lik: 4 })), ...[3, 4].map((e) => ({ setor: 's2', enps: e, lik: 2 }))],
    ['col1', 'ger1', 'rh1', 'admin1', 'dir1', 'rec1', 'col2', 'ger2'])
  // Pesquisa com baixa participação: 10 convidados (usa ids fictícios de pessoas existentes repetindo não é possível → 8 + ids soltos) e 1 resposta
  await pesquisa('Pulso de outubro', 'identificada', [{ setor: 's1', enps: 9, lik: 5 }], ['col1', 'ger1', 'rh1', 'admin1', 'dir1', 'rec1', 'col2', 'ger2', 'x1', 'x2'], 3)
}, 120_000)

beforeEach(() => limparCacheAnalytics())

describe('permissões', () => {
  it('RH, diretoria, administração e analista de RH veem; colaborador, gestor e recrutador não', async () => {
    for (const quem of ['rh1', 'dir1', 'admin1']) expect((await resumo(m.c[quem])).status).toBe(200)
    expect((await resumo(m.c.col1)).status).toBe(403)
    expect((await resumo(m.c.ger1)).status).toBe(403)
    expect((await resumo(m.c.rec1)).status).toBe(403)
    expect((await GET(m, 'analytics/resumo')).status).toBe(401)
    expect((await PUT(m, 'acl/funcoes/col2', m.c.admin1, { funcoes: ['analista_rh'] })).status).toBe(200)
    expect((await resumo(m.c.col2)).status).toBe(200)
  })
  it('detalhe e exportação também exigem a capacidade', async () => {
    expect((await GET(m, 'analytics/detalhe', m.c.ger1, { indicador: 'rec_vagas' })).status).toBe(403)
    expect((await GET(m, 'analytics/exportar', m.c.col1, { bloco: 'estrutura' })).status).toBe(403)
  })
})

describe('recrutamento', () => {
  it('indicadores batem com o painel de vagas (mesmas definições e filtros)', async () => {
    const q = { de: diasAtras(60), ate: hoje }
    const a = await resumo(m.c.rh1, q)
    const painel = await GET(m, 'recrutamento/painel', m.c.rh1, q)
    expect(painel.status).toBe(200)
    const r = a.json.blocos.recrutamento
    expect(ind(r, 'candidaturas').valor).toBe(painel.json.cards.candidaturasRecebidas)
    expect(ind(r, 'contratacoes').valor).toBe(painel.json.cards.contratacoes)
    expect(ind(r, 'tempo_preenchimento').valor).toBe(painel.json.indicadores.tempoMedioFechamentoDias)
    expect(ind(r, 'tempo_primeira_candidatura').valor).toBe(painel.json.indicadores.tempoMedioPrimeiraCandidaturaDias)
    expect(ind(r, 'taxa_conversao').valor).toBe(painel.json.indicadores.taxaConversao)
    expect(ind(r, 'no_prazo').valor).toBe(painel.json.indicadores.noPrazo.taxa)
    expect(ind(r, 'vagas_abertas').valor).toBe(painel.json.cards.abertas)
    expect(r.funil.map((x: any) => x.alcancaram)).toEqual(painel.json.funil.map((x: any) => x.alcancaram))
  })
  it('calcula conversão de proposta, conclusão, canais e distribuição por departamento/recrutador', async () => {
    const r = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })).json.blocos.recrutamento
    expect(ind(r, 'vagas_periodo').valor).toBe(3)
    expect(ind(r, 'conversao_proposta').valor).toBe(50) // 1 aceita, 1 recusada
    expect(ind(r, 'conclusao').valor).toBe(100) // única vaga finalizada foi preenchida
    expect(ind(r, 'tempo_preenchimento').valor).toBeGreaterThan(15)
    expect(r.canais.find((x: any) => x.origem === 'portal').qtd).toBe(3)
    expect(r.porSetor.map((x: any) => x.nome).sort()).toEqual(['Comercial', 'Jurídico'])
    expect(r.porRecrutador.find((x: any) => x.nome === 'Rui Recrutador').vagas).toBe(2)
    expect(r.motivos).toEqual([{ motivo: 'Vaga preenchida', qtd: 1 }])
    expect(r.periodo).toMatch(/ a /)
  })
  it('traz o período anterior e a variação só quando há base nos dois lados', async () => {
    const r = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })).json.blocos.recrutamento
    expect(ind(r, 'vagas_periodo').anterior).toBeNull() // nada no período anterior
    expect(ind(r, 'vagas_periodo').variacao).toBeNull()
    // 20 dias: contém v2 e v3; o período anterior (39–20 dias atrás) contém só a vaga mais antiga
    const r2 = (await resumo(m.c.rh1, { de: diasAtras(19), ate: hoje })).json.blocos.recrutamento
    expect(ind(r2, 'vagas_periodo').valor).toBe(2)
    expect(ind(r2, 'vagas_periodo').anterior).toBe(1)
    expect(ind(r2, 'vagas_periodo').variacao.sentido).toBe('subiu')
  })
  it('período sem vagas: indicadores indisponíveis, sem inventar valores', async () => {
    const r = (await resumo(m.c.rh1, { de: '2020-01-01', ate: '2020-02-01' })).json.blocos.recrutamento
    expect(r.semDados).toBe(true)
    expect(r.indicadores.every((i: any) => i.valor === null && i.disponivel === false)).toBe(true)
  })
  it('filtros: área e recrutador valem para o bloco inteiro', async () => {
    const q = { de: diasAtras(60), ate: hoje }
    const s1 = (await resumo(m.c.rh1, { ...q, setor: 's1' })).json.blocos.recrutamento
    expect(ind(s1, 'vagas_periodo').valor).toBe(2)
    expect(s1.porSetor).toHaveLength(1)
    const rh = (await resumo(m.c.rh1, { ...q, recrutador: 'rh1' })).json.blocos.recrutamento
    expect(ind(rh, 'vagas_periodo').valor).toBe(1)
    expect(ind(rh, 'candidaturas').valor).toBe(3)
  })
  it('nunca expõe salário, proposta em valor, nem dados pessoais de candidatos', async () => {
    const txt = JSON.stringify((await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })).json) + JSON.stringify((await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'rec_propostas', de: diasAtras(60), ate: hoje })).json)
    expect(txt).not.toMatch(/7000|6500|salario|SEGREDO-RH|@x\.com/)
  })
})

describe('pesquisas e anonimato', () => {
  it('eNPS e taxa de participação agregados; sem respostas individuais', async () => {
    const r = await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })
    const p = r.json.blocos.pesquisas
    const clima = p.pesquisas.find((x: any) => x.titulo === 'Clima 2026')
    expect(clima.respostas).toBe(8)
    expect(clima.convidados).toBe(8)
    expect(clima.taxa).toBe(100)
    // promotores: 10,9,9,10 (4 de 8); detratores: 6,3,4 (3 de 8) → (4−3)/8 = 12,5 → 13
    expect(clima.enps.valor).toBe(13)
    const txt = JSON.stringify(r.json)
    expect(txt).not.toMatch(/"itens"|colaboradorId|colaborador_id|"respostas":\s*\[/)
  })
  it('grupo pequeno é ocultado (com supressão complementar) na participação por área', async () => {
    const p = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })).json.blocos.pesquisas
    const areas = p.porArea
    const comercial = areas.find((a: any) => a.area === 'Comercial')
    expect(comercial.suprimido).toBe(true)
    expect(comercial.respostas).toBeNull()
    // Com apenas 1 grupo oculto, o menor visível também é ocultado (não dá para deduzir por subtração)
    expect(areas.filter((a: any) => a.suprimido).length).toBeGreaterThanOrEqual(2)
  })
  it('filtrar por uma área pequena bloqueia o resultado em vez de expô-lo', async () => {
    const p = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje, setor: 's2' })).json.blocos.pesquisas
    const clima = p.pesquisas.find((x: any) => x.titulo === 'Clima 2026')
    expect(clima.suprimido).toBe(true)
    expect(clima.respostas).toBeNull()
    expect(clima.enps).toBeNull()
    expect(clima.motivo).toMatch(/menos de/i)
    expect(p.filtrosIgnorados).toEqual([])
  })
  it('recrutador e gestor não se aplicam às pesquisas e isso é dito', async () => {
    const p = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje, recrutador: 'rec1', gestor: 'ger1' })).json.blocos.pesquisas
    expect(p.filtrosIgnorados).toHaveLength(2)
    expect(p.pesquisas).toHaveLength(2)
  })
  it('baixa participação é destacada; eNPS só é comparável entre perguntas idênticas', async () => {
    const p = (await resumo(m.c.rh1, { de: diasAtras(60), ate: hoje })).json.blocos.pesquisas
    expect(p.baixaAdesao.map((x: any) => x.titulo)).toEqual(['Pulso de outubro'])
    // Pesquisa identificada com 1 resposta e mínimo 3: suprimida
    expect(p.pesquisas.find((x: any) => x.titulo === 'Pulso de outubro').suprimido).toBe(true)
    expect(p.seriesEnps[0].pontos.length).toBe(1)
    expect(p.seriesEnps[0].comparavel).toBe(false)
  })
  it('detalhe de pesquisas é agregado e respeita a permissão', async () => {
    const d = await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'pq_pesquisas', de: diasAtras(60), ate: hoje })
    expect(d.status).toBe(200)
    expect(d.json.total).toBe(2)
    expect(JSON.stringify(d.json)).not.toMatch(/col1|colaborador/)
  })
})

describe('estrutura', () => {
  it('totais, pendências e posições vagas vêm do cadastro real', async () => {
    const e = (await resumo(m.c.rh1)).json.blocos.estrutura
    expect(ind(e, 'pessoas').valor).toBe(8)
    expect(e.porSetor.reduce((s: number, x: any) => s + x.qtd, 0)).toBe(8)
    expect(ind(e, 'qualidade_cadastro').valor).toBeGreaterThan(0) // várias pessoas sem gestor no cadastro de teste
    expect(ind(e, 'posicoes_vagas').valor).toBeGreaterThan(0) // vagas publicadas/aprovadas semeadas
    expect(e.mensagemEvolucao).toMatch(/histórico/i)
  })
  it('filtro por gestor considera a pessoa e sua equipe; níveis seguem a organização inteira', async () => {
    const e = (await resumo(m.c.rh1, { gestor: 'ger1' })).json.blocos.estrutura
    expect(ind(e, 'pessoas').valor).toBe(2)
    expect(e.filtrosAplicados.join(' ')).toMatch(/gestor/)
    expect(e.filtrosIgnorados.join(' ')).toMatch(/organização inteira/)
  })
  it('linha do tempo só aparece com dois retratos mensais', async () => {
    await m.pg.query("insert into org_snapshots (mes, dados) values ($1::date, $2::jsonb), ($3::date, $4::jsonb)", [
      diasAtras(70).slice(0, 7) + '-01', JSON.stringify({ ativos: 6, gestores: 2, niveis: 2, pendencias: 3, porSetor: [] }),
      diasAtras(35).slice(0, 7) + '-01', JSON.stringify({ ativos: 7, gestores: 2, niveis: 2, pendencias: 2, porSetor: [] })])
    const e = (await resumo(m.c.rh1, { de: diasAtras(120), ate: hoje })).json.blocos.estrutura
    expect(e.evolucao).toHaveLength(2)
    expect(e.evolucao[1].ativos).toBe(7)
    await m.pg.query('delete from org_snapshots')
  })
  it('detalhe de pessoas não traz contato nem valores', async () => {
    const d = await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'est_pessoas' })
    expect(d.json.total).toBe(8)
    expect(JSON.stringify(d.json)).not.toMatch(/@teste\.local|telefone|salario|cpf/i)
  })
})

describe('indisponíveis, detalhe e cache', () => {
  it('declara o que não pode medir, com a dependência', async () => {
    const r = (await resumo(m.c.rh1)).json
    expect(r.indisponiveis.map((i: any) => i.chave)).toEqual(expect.arrayContaining(['rotatividade', 'absenteismo', 'folha', 'desempenho']))
    expect(r.indisponiveis.every((i: any) => i.disponivel === false && i.valor === null && i.dependencia)).toBe(true)
  })
  it('drilldown é paginado e o recorte do indicador bate com o número exibido', async () => {
    const q = { de: diasAtras(60), ate: hoje }
    const d = await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'rec_vagas', por: '2', ...q })
    expect(d.json.total).toBe(3)
    expect(d.json.itens).toHaveLength(2)
    const p2 = await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'rec_vagas', por: '2', pagina: '2', ...q })
    expect(p2.json.itens).toHaveLength(1)
    const ab = await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'rec_vagas_abertas', ...q })
    expect(ab.json.total).toBe(ind((await resumo(m.c.rh1, q)).json.blocos.recrutamento, 'vagas_abertas').valor)
    expect((await GET(m, 'analytics/detalhe', m.c.rh1, { indicador: 'qualquer' })).status).toBe(400)
  })
  it('o motivo de encerramento em texto livre só aparece para quem gerencia vagas', async () => {
    const q = { indicador: 'rec_encerradas', de: diasAtras(60), ate: hoje }
    const rh = await GET(m, 'analytics/detalhe', m.c.rh1, q)
    expect(rh.json.itens[0].motivo).toBe('preenchida')
    const analista = await GET(m, 'analytics/detalhe', m.c.col2, q) // analista de RH (função adicional)
    expect(analista.status).toBe(200)
    expect(analista.json.itens[0].motivo).toBeNull()
  })
  it('cache de 60 s: segunda chamada igual vem do cache; fresh=1 recalcula', async () => {
    const q = { de: diasAtras(60), ate: hoje }
    const a = await GET(m, 'analytics/resumo', m.c.rh1, q)
    const b = await GET(m, 'analytics/resumo', m.c.rh1, q)
    expect(a.json.doCache).toBe(false)
    expect(b.json.doCache).toBe(true)
    const c = await GET(m, 'analytics/resumo', m.c.rh1, { ...q, fresh: '1' })
    expect(c.json.doCache).toBe(false)
    // outro usuário não reaproveita o cache de quem tem outro escopo
    const d = await GET(m, 'analytics/resumo', m.c.dir1, q)
    expect(d.json.doCache).toBe(false)
  })
  it('valida os filtros', async () => {
    expect((await resumo(m.c.rh1, { setor: "s1'; drop table x;--" })).status).toBe(400)
  })
})

describe('exportação CSV', () => {
  it('exporta o bloco com cabeçalho, definições e auditoria', async () => {
    const r = await GET(m, 'analytics/exportar', m.c.rh1, { bloco: 'recrutamento', de: diasAtras(60), ate: hoje, fresh: '1' })
    expect(r.status).toBe(200)
    const csv = r.binario!.dados.toString('utf8')
    expect(csv).toMatch(/People Analytics;recrutamento/)
    expect(csv).toMatch(/Tempo de preenchimento/)
    expect(csv).toMatch(/FUNIL DE RECRUTAMENTO/)
    const aud = await m.pg.query("select 1 from aud_eventos where entidade = 'analytics' and acao = 'exportar'")
    expect(aud.rows.length).toBeGreaterThan(0)
  })
  it('CSV de pesquisas mantém a ocultação de grupos pequenos', async () => {
    const r = await GET(m, 'analytics/exportar', m.c.rh1, { bloco: 'pesquisas', de: diasAtras(60), ate: hoje, fresh: '1' })
    const csv = r.binario!.dados.toString('utf8')
    expect(csv).toMatch(/Oculto \(grupo pequeno\)/)
    expect(csv).not.toMatch(/col1|colaborador/)
  })
  it('bloco inválido é recusado', async () => {
    expect((await GET(m, 'analytics/exportar', m.c.rh1, { bloco: 'folha' })).status).toBe(400)
  })
})
