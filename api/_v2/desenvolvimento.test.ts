/* Ciclo de desenvolvimento e AVD: ponta a ponta na API v2 (PGlite com o schema real). */
import { beforeEach, describe, expect, it } from 'vitest'
import { cookieDe, criarMundo, semear, ORG_BASE, GET, POST, PUT, PATCH, type Mundo } from './teste/harness'
import { sincronizarDesenvolvimento, hojeBR } from './modulos/desenvolvimento'
import { somarDias } from '../../src/domain/datas'
import { somarMeses, MODELOS_PADRAO, type ChaveModelo } from '../../src/domain/v2/desenvolvimento'

const hoje = hojeBR()
let m: Mundo
const c: Record<string, string> = {}

/*
  Estrutura: dir1 (diretoria) → ger1 (liderança do Jurídico, admitido há 6 meses: 1ª AVD hoje)
             ger1 → col1 (há 30 dias: acompanhamento de 30 dias), col3/col4/col5 (há 1 ano: 2ª AVD hoje)
  col1 tem menos de 60 dias na equipe: não avalia a liderança neste ciclo.
*/
async function montar() {
  m = await criarMundo()
  const pessoas = [
    ...ORG_BASE.pessoas.map((p) =>
      p.id === 'ger1' ? { ...p, dataEntrada: somarMeses(hoje, -6), responsavelId: 'dir1' }
      : p.id === 'col1' ? { ...p, dataEntrada: somarDias(hoje, -30) }
      : p),
    { id: 'col3', nome: 'Célia Três', papel: 'colaborador' as const, setorId: 's1', responsavelId: 'ger1', dataEntrada: somarMeses(hoje, -12) },
    { id: 'col4', nome: 'Caco Quatro', papel: 'colaborador' as const, setorId: 's1', responsavelId: 'ger1', dataEntrada: somarMeses(hoje, -12) },
    { id: 'col5', nome: 'Cora Cinco', papel: 'colaborador' as const, setorId: 's1', responsavelId: 'ger1', dataEntrada: somarMeses(hoje, -12) },
  ]
  await semear(m, { ...ORG_BASE, pessoas })
  for (const p of pessoas) c[p.id] = await cookieDe(m, p.id)
}
beforeEach(montar)

const q = async (sql: string, p: unknown[] = []) => (await m.pg.query<any>(sql, p)).rows
const ciclosDe = (id: string) => q("select id, tipo, marco, etapa, lideranca, avaliador_id from dsv_ciclos where colaborador_id = $1 order by data_prevista", [id])
const formsDe = (cicloId: string) => q('select id, tipo, respondente_id, status, modelo_chave, respostas from dsv_formularios where ciclo_id = $1 order by tipo, respondente_id', [cicloId])
const formDe = async (cicloId: string, tipo: string, respondente?: string) =>
  (await formsDe(cicloId)).find((f) => f.tipo === tipo && (!respondente || f.respondente_id === respondente))!

/** Respostas completas e válidas para um modelo (nota 3 em tudo, abertas preenchidas). */
function respostas(chave: ChaveModelo, nota: number | 'na' = 3, extra: Partial<{ comentario: string }> = {}) {
  const md = MODELOS_PADRAO[chave]
  return {
    notas: Object.fromEntries(md.criterios.map((k) => [k.id, nota])),
    justificativas: Object.fromEntries(md.criterios.map((k) => [k.id, 'Exemplo concreto observado no semestre.'])),
    abertas: Object.fromEntries(md.perguntas.map((p) => [p.id, extra.comentario ?? `Resposta para ${p.id}`])),
  }
}
const enviar = (formId: string, quem: string, r: unknown) => POST(m, `desenvolvimento/formularios/${formId}/enviar`, c[quem], { respostas: r })

describe('cronograma e geração automática', () => {
  it('gera acompanhamento de 30 dias, 1ª AVD aos 6 meses e AVD semestral; sem duplicar', async () => {
    const r = await sincronizarDesenvolvimento(m.db)
    expect(r.criados).toBe(5) // col1 (30d), ger1 (6m), col3/col4/col5 (12m)
    expect((await ciclosDe('col1')).map((x) => [x.tipo, x.marco])).toEqual([['acompanhamento', '30d']])
    expect((await ciclosDe('ger1')).map((x) => [x.tipo, x.marco, x.lideranca])).toEqual([['avd', '6m', true]])
    expect((await ciclosDe('col3')).map((x) => [x.tipo, x.marco, x.lideranca])).toEqual([['avd', '12m', false]])
    // Ninguém sem data de admissão entra; nada é criado de novo.
    expect((await sincronizarDesenvolvimento(m.db)).criados).toBe(0)
    expect((await q('select count(*)::int n from dsv_ciclos'))[0].n).toBe(5)
    // Unicidade também no banco.
    const [x] = await ciclosDe('col1')
    const dup = await m.pg.query("insert into dsv_ciclos (colaborador_id, vinculo_id, data_base, tipo, marco, numero, data_prevista, prazo) select colaborador_id, vinculo_id, data_base, tipo, marco, numero, data_prevista, prazo from dsv_ciclos where id = $1", [x.id]).catch((e) => e)
    expect(dup).toBeInstanceOf(Error)
  })

  it('formulários: membro × liderança × acompanhamento, com notificações', async () => {
    await sincronizarDesenvolvimento(m.db)
    const [acomp] = await ciclosDe('col1')
    expect((await formsDe(acomp.id)).map((f) => [f.tipo, f.respondente_id])).toEqual([['acomp_colaborador', 'col1'], ['acomp_lideranca', 'ger1']])
    const [lid] = await ciclosDe('ger1')
    const fl = await formsDe(lid.id)
    expect(fl.filter((f) => f.tipo === 'autoavaliacao')[0].modelo_chave).toBe('avd_auto_lideranca')
    expect(fl.filter((f) => f.tipo === 'lider_avalia')[0]).toMatchObject({ respondente_id: 'dir1', modelo_chave: 'avd_superior_lideranca' })
    expect(fl.filter((f) => f.tipo === 'equipe_avalia_lider').map((f) => f.respondente_id)).toEqual(['col3', 'col4', 'col5'])
    const [mem] = await ciclosDe('col3')
    expect((await formsDe(mem.id)).map((f) => f.modelo_chave)).toEqual(['avd_auto_membro', 'avd_lider_membro'])
    expect((await q("select count(*)::int n from ntf_notificacoes where destinatario_id = 'col3' and tipo = 'desenvolvimento'"))[0].n).toBe(2) // autoavaliação + feedback da liderança
    expect((await q("select count(*)::int n from ntf_notificacoes where destinatario_id = 'rh1' and chave like 'dsv-inicio:%'"))[0].n).toBe(5)
  })

  it('a área da pessoa mostra o que preencher e até quando', async () => {
    const r = await GET(m, 'desenvolvimento/meu', c.col3)
    expect(r.status).toBe(200)
    expect(r.json.pendentes.map((p: any) => p.tipo).sort()).toEqual(['autoavaliacao', 'equipe_avalia_lider'])
    expect(r.json.pendentes.every((p: any) => p.prazo >= hoje)).toBe(true)
    expect(r.json.proximos[0].marco).toBe('18m')
    const eq = await GET(m, 'desenvolvimento/equipe', c.ger1)
    // O próximo marco é o que ainda não abriu (não repete o ciclo em andamento).
    expect(eq.json.membros.find((x: any) => x.id === 'col3')).toMatchObject({ cicloAtual: { marco: '12m' }, proximo: { marco: '18m' } })
    const p = await GET(m, 'desenvolvimento/painel', c.rh1)
    expect(p.json.proximas.some((x: any) => x.pessoaId === 'col3' && x.marco === '12m')).toBe(false)
    const l = await GET(m, 'desenvolvimento/meu', c.ger1)
    expect(l.json.ehLideranca).toBe(true)
    expect(l.json.pendentes.map((p: any) => p.tipo).sort()).toEqual(['acomp_lideranca', 'autoavaliacao', 'lider_avalia', 'lider_avalia', 'lider_avalia'])
  })
})

describe('respostas e controle de acesso', () => {
  beforeEach(async () => { await sincronizarDesenvolvimento(m.db) })

  it('justificativa obrigatória nas notas 1, 2 e 5; enviado não muda', async () => {
    const [ciclo] = await ciclosDe('col3')
    const f = await formDe(ciclo.id, 'autoavaliacao')
    const r = respostas('avd_auto_membro')
    r.notas.qualidade = 5; r.justificativas = {}
    const e = await enviar(f.id, 'col3', r)
    expect(e.status).toBe(400)
    expect(e.json.campos).toHaveProperty('qualidade')
    expect((await PUT(m, `desenvolvimento/formularios/${f.id}`, c.col3, { respostas: r })).status).toBe(200) // rascunho
    expect((await enviar(f.id, 'col3', respostas('avd_auto_membro'))).status).toBe(200)
    expect((await enviar(f.id, 'col3', respostas('avd_auto_membro', 1))).status).toBe(409)
    expect((await PUT(m, `desenvolvimento/formularios/${f.id}`, c.col3, { respostas: r })).status).toBe(409)
    // Liderança não abre nem altera o formulário de outra pessoa.
    expect((await GET(m, `desenvolvimento/formularios/${f.id}`, c.ger1)).status).toBe(404)
    expect((await PUT(m, `desenvolvimento/formularios/${f.id}`, c.ger1, { respostas: r })).status).toBe(404)
    expect((await enviar(f.id, 'rh1', r)).status).toBe(404)
  })

  it('ninguém de fora vê o ciclo; liderança só vê a autoavaliação depois de enviar a própria', async () => {
    const [ciclo] = await ciclosDe('col3')
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.col2)).status).toBe(404)
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.col4)).status).toBe(404)
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger2)).status).toBe(404)
    await enviar((await formDe(ciclo.id, 'autoavaliacao')).id, 'col3', respostas('avd_auto_membro', 4))
    const antes = await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger1)
    expect(antes.status).toBe(200)
    expect(antes.json.formularios.find((f: any) => f.tipo === 'autoavaliacao').respostas).toBeNull()
    await enviar((await formDe(ciclo.id, 'lider_avalia')).id, 'ger1', respostas('avd_lider_membro', 3))
    const depois = await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger1)
    expect(depois.json.formularios.find((f: any) => f.tipo === 'autoavaliacao').nota).toBe(4)
    // A pessoa ainda não vê a avaliação da liderança (só depois da devolutiva).
    const eu = await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.col3)
    expect(eu.json.formularios.find((f: any) => f.tipo === 'lider_avalia').respostas).toBeNull()
    expect(eu.json.ciclo.status).toBe('aguardando_devolutiva')
    // Painel do RH é só do RH (ou de quem recebeu a função de gestão de desenvolvimento).
    expect((await GET(m, 'desenvolvimento/painel', c.ger1)).status).toBe(403)
    expect((await GET(m, 'desenvolvimento/painel', c.rec1)).status).toBe(403)
    await m.pg.query("insert into acl_funcoes (colaborador_id, funcao) values ('rec1','gestor_desenvolvimento')")
    expect((await GET(m, 'desenvolvimento/painel', await cookieDe(m, 'rec1'))).status).toBe(200)
  })
})

describe('feedback da equipe sobre a liderança (confidencial)', () => {
  beforeEach(async () => { await sincronizarDesenvolvimento(m.db) })

  it('respostas sem respondente; mínimo para exibir; liderança só vê médias e a síntese liberada; acesso do RH registrado', async () => {
    const [ciclo] = await ciclosDe('ger1')
    const col = Object.keys((await q("select column_name from information_schema.columns where table_name = 'dsv_respostas_equipe'")).reduce((o: any, r: any) => ({ ...o, [r.column_name]: 1 }), {}))
    expect(col.sort()).toEqual(['ciclo_id', 'data', 'id', 'modelo_versao', 'respostas'])
    const aviso = await GET(m, `desenvolvimento/formularios/${(await formDe(ciclo.id, 'equipe_avalia_lider', 'col3')).id}`, c.col3)
    expect(aviso.json.confidencial).toBe(true)
    expect(aviso.json.avisoConfidencialidade).toMatch(/não prometemos anonimato absoluto/)

    for (const quem of ['col3', 'col4']) expect((await enviar((await formDe(ciclo.id, 'equipe_avalia_lider', quem)).id, quem, respostas('avd_equipe_lideranca', 4, { comentario: `texto de ${quem}` }))).status).toBe(200)
    // O formulário não guarda o conteúdo; a tabela de respostas não guarda quem respondeu.
    expect((await formDe(ciclo.id, 'equipe_avalia_lider', 'col3')).respostas).toBeNull()
    expect((await q('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [ciclo.id]))[0].n).toBe(2)

    // A liderança não acessa o feedback detalhado; o RH acessa, abaixo do mínimo nada aparece.
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}/feedback-equipe`, c.ger1)).status).toBe(403)
    const rh2 = await GET(m, `desenvolvimento/ciclos/${ciclo.id}/feedback-equipe`, c.rh1)
    expect(rh2.json.agregado).toMatchObject({ n: 2, suprimido: true })
    expect(rh2.json.comentarios).toEqual([])
    expect((await PUT(m, `desenvolvimento/ciclos/${ciclo.id}/sintese`, c.rh1, { texto: 'Síntese', liberar: true })).status).toBe(409)

    await enviar((await formDe(ciclo.id, 'equipe_avalia_lider', 'col5')).id, 'col5', respostas('avd_equipe_lideranca', 5, { comentario: 'texto de col5' }))
    const rh3 = await GET(m, `desenvolvimento/ciclos/${ciclo.id}/feedback-equipe`, c.rh1)
    expect(rh3.json.agregado).toMatchObject({ n: 3, suprimido: false })
    expect(rh3.json.comentarios[0].respostas.sort()).toEqual(['texto de col3', 'texto de col4', 'texto de col5'])
    expect((await q("select count(*)::int n from aud_eventos where entidade = 'dsv_ciclo' and acao = 'feedback_equipe_visualizado' and colaborador_id = 'rh1'"))[0].n).toBe(2)

    // Antes de liberar, a liderança vê só a contagem.
    const antes = await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger1)
    expect(antes.json.feedbackEquipe).toMatchObject({ convidados: 3, respostas: 3, sinteseLiberada: false })
    expect(antes.json.feedbackEquipe.agregado).toBeUndefined()
    expect(antes.json.formularios.some((f: any) => f.tipo === 'equipe_avalia_lider')).toBe(false)
    expect((await PUT(m, `desenvolvimento/ciclos/${ciclo.id}/sintese`, c.ger1, { texto: 'x', liberar: true })).status).toBe(403)
    expect((await PUT(m, `desenvolvimento/ciclos/${ciclo.id}/sintese`, c.rh1, { texto: 'A equipe reconhece a disponibilidade; pede mais clareza nas prioridades.', liberar: true })).status).toBe(200)
    const depois = await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger1)
    expect(depois.json.feedbackEquipe.agregado.media).toBe(4.3)
    expect(depois.json.feedbackEquipe.sintese).toMatch(/clareza/)
    expect(JSON.stringify(depois.json)).not.toMatch(/texto de col/)
    // Superior (quem conduz a devolutiva da liderança) também não vê comentários.
    expect(JSON.stringify((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.dir1)).json)).not.toMatch(/texto de col/)
  })
})

describe('fluxo completo da AVD: devolutiva, PDI e encerramento', () => {
  beforeEach(async () => { await sincronizarDesenvolvimento(m.db) })

  it('não conclui com etapas pendentes; PDI com ações; RH encerra; histórico preservado', async () => {
    const [ciclo] = await ciclosDe('col3')
    const id = ciclo.id
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/devolutiva`, c.ger1, { concluir: true })).status).toBe(409) // coleta em aberto
    expect((await POST(m, `desenvolvimento/ciclos/${id}/encerrar`, c.rh1)).status).toBe(409)
    await enviar((await formDe(id, 'autoavaliacao')).id, 'col3', respostas('avd_auto_membro', 4))
    await enviar((await formDe(id, 'lider_avalia')).id, 'ger1', respostas('avd_lider_membro', 3))
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/devolutiva`, c.col3, { concluir: true })).status).toBe(403)
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/devolutiva`, c.ger1, { concluir: true, realizadaEm: hoje, pontosFortes: 'Entregas consistentes' })).status).toBe(400)
    const dev = await PUT(m, `desenvolvimento/ciclos/${id}/devolutiva`, c.ger1, { concluir: true, realizadaEm: hoje, pontosFortes: 'Entregas consistentes', aDesenvolver: 'Comunicação', feedback: 'Seguir assim, com alinhamentos semanais.' })
    expect(dev.json.etapa).toBe('pdi')
    // Agora a pessoa vê a avaliação da liderança e registra a própria percepção.
    const eu = await GET(m, `desenvolvimento/ciclos/${id}`, c.col3)
    expect(eu.json.formularios.find((f: any) => f.tipo === 'lider_avalia').nota).toBe(3)
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/percepcao`, c.col3, { texto: 'Concordo; quero melhorar a comunicação.' })).status).toBe(200)
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/percepcao`, c.ger1, { texto: 'x' })).status).toBe(403)

    expect((await PUT(m, `desenvolvimento/ciclos/${id}/pdi`, c.ger1, { registrar: true, metas: 'Conduzir 2 reuniões com cliente', revisaoEm: somarDias(hoje, 90) })).status).toBe(400) // sem ações
    const acao = await POST(m, `desenvolvimento/ciclos/${id}/acoes`, c.ger1, { competencia: 'Comunicação', descricao: 'Treinamento e alinhamentos periódicos', responsavel: 'ambos', prazo: somarDias(hoje, 60) })
    expect(acao.status).toBe(201)
    expect((await POST(m, `desenvolvimento/ciclos/${id}/acoes`, c.col3, { descricao: 'x' })).status).toBe(403)
    expect((await PUT(m, `desenvolvimento/ciclos/${id}/pdi`, c.ger1, { registrar: true, metas: 'Conduzir 2 reuniões com cliente', revisaoEm: somarDias(hoje, 90) })).json.etapa).toBe('encerramento')

    // A pessoa atualiza o andamento das próprias ações, mas não cancela; outras pessoas nem enxergam.
    expect((await PATCH(m, `desenvolvimento/acoes/${acao.json.id}`, c.col3, { status: 'em_andamento', resultado: 'Inscrita no treinamento' })).status).toBe(200)
    expect((await PATCH(m, `desenvolvimento/acoes/${acao.json.id}`, c.col3, { status: 'cancelada' })).status).toBe(403)
    expect((await PATCH(m, `desenvolvimento/acoes/${acao.json.id}`, c.col4, { status: 'concluida' })).status).toBe(404)

    expect((await POST(m, `desenvolvimento/ciclos/${id}/encerrar`, c.ger1)).status).toBe(403)
    expect((await POST(m, `desenvolvimento/ciclos/${id}/encerrar`, c.rh1)).status).toBe(200)
    const fim = await GET(m, `desenvolvimento/ciclos/${id}`, c.rh1)
    expect(fim.json.ciclo.status).toBe('concluida')
    expect(fim.json.eventos.map((e: any) => e.acao)).toEqual(expect.arrayContaining(['ciclo_aberto', 'formulario_enviado', 'devolutiva_registrada', 'pdi_registrado', 'ciclo_encerrado']))
    // Reabrir exige justificativa.
    expect((await POST(m, `desenvolvimento/ciclos/${id}/reabrir`, c.rh1, { motivo: 'curto' })).status).toBe(400)

    // A jornada mostra a evolução e o PDI.
    const j = await GET(m, 'desenvolvimento/pessoas/col3/jornada', c.col3)
    expect(j.status).toBe(200)
    expect(j.json.evolucao[0]).toMatchObject({ auto: 4, lideranca: 3 })
    expect(j.json.acoes[0]).toMatchObject({ status: 'em_andamento' })
    expect((await GET(m, 'desenvolvimento/pessoas/col3/jornada', c.col4)).status).toBe(404)
  })

  it('acompanhamento: as duas percepções e o registro com ações combinadas concluem o marco', async () => {
    const [ciclo] = await ciclosDe('col1')
    await enviar((await formDe(ciclo.id, 'acomp_colaborador')).id, 'col1', respostas('acomp_colaborador', 4))
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.col1)).json.ciclo.status).toBe('aguardando_lideranca')
    await enviar((await formDe(ciclo.id, 'acomp_lideranca')).id, 'ger1', respostas('acomp_lideranca', 3))
    expect((await GET(m, `desenvolvimento/ciclos/${ciclo.id}`, c.ger1)).json.ciclo.status).toBe('aguardando_registro')
    expect((await POST(m, `desenvolvimento/ciclos/${ciclo.id}/acoes`, c.ger1, { descricao: 'Sombra no atendimento de 3 clientes', responsavel: 'ambos', prazo: somarDias(hoje, 20) })).status).toBe(201)
    const r = await PUT(m, `desenvolvimento/ciclos/${ciclo.id}/devolutiva`, c.ger1, { concluir: true, realizadaEm: hoje, pontosFortes: 'Curiosa e organizada', dificuldades: 'Ferramentas internas', orientacoes: 'Pedir ajuda cedo' })
    expect(r.json.etapa).toBe('concluida')
  })
})

describe('mudanças de liderança, admissão e encerramento', () => {
  beforeEach(async () => { await sincronizarDesenvolvimento(m.db) })
  const mudar = (id: string, patch: Record<string, unknown>) => m.pg.query('update app_colaboradores set dados = dados || $2::jsonb where id = $1', [id, JSON.stringify(patch)])

  it('troca de liderança passa os pendentes à nova liderança e preserva o que já foi enviado', async () => {
    const [c3] = await ciclosDe('col3')
    const [c4] = await ciclosDe('col4')
    await enviar((await formDe(c4.id, 'lider_avalia')).id, 'ger1', respostas('avd_lider_membro', 4))
    await mudar('col3', { responsavelId: 'ger2' })
    await mudar('col4', { responsavelId: 'ger2' })
    await sincronizarDesenvolvimento(m.db)
    expect((await formDe(c3.id, 'lider_avalia')).respondente_id).toBe('ger2')
    expect((await ciclosDe('col3'))[0].avaliador_id).toBe('ger2')
    // Enviado por ger1 fica com ger1 (histórico); as próximas etapas passam para ger2.
    expect((await formDe(c4.id, 'lider_avalia')).respondente_id).toBe('ger1')
    expect((await ciclosDe('col4'))[0].avaliador_id).toBe('ger2')
    // col3 saiu da equipe de ger1: o feedback pendente sobre ger1 é dispensado (não conta como resposta).
    const [lid] = await ciclosDe('ger1')
    expect((await formDe(lid.id, 'equipe_avalia_lider', 'col3')).status).toBe('dispensado')
    expect((await GET(m, `desenvolvimento/ciclos/${c3.id}`, c.ger1)).status).toBe(404)
    expect((await GET(m, `desenvolvimento/ciclos/${c3.id}`, c.ger2)).status).toBe(200)
  })

  it('RH designa quem conduz e a rotina respeita a designação', async () => {
    const [c3] = await ciclosDe('col3')
    expect((await POST(m, `desenvolvimento/ciclos/${c3.id}/avaliador`, c.rh1, { avaliadorId: 'col3' })).status).toBe(400)
    expect((await POST(m, `desenvolvimento/ciclos/${c3.id}/avaliador`, c.rh1, { avaliadorId: 'ger2' })).status).toBe(200)
    await sincronizarDesenvolvimento(m.db)
    expect((await formDe(c3.id, 'lider_avalia')).respondente_id).toBe('ger2')
  })

  it('correção da data de admissão reprograma ciclos sem respostas e preserva os respondidos', async () => {
    await mudar('col1', { dataEntrada: somarDias(hoje, -10) })
    await sincronizarDesenvolvimento(m.db)
    expect(await ciclosDe('col1')).toEqual([]) // o de 30 dias volta na data certa
    const [c3] = await ciclosDe('col3')
    await enviar((await formDe(c3.id, 'autoavaliacao')).id, 'col3', respostas('avd_auto_membro'))
    await mudar('col3', { dataEntrada: somarMeses(hoje, -11) })
    await sincronizarDesenvolvimento(m.db)
    expect((await ciclosDe('col3')).map((x) => x.marco)).toEqual(['12m'])
    expect((await formDe(c3.id, 'autoavaliacao')).status).toBe('enviado')
  })

  it('encerramento da parceria cancela os ciclos abertos sem apagar respostas', async () => {
    const [c4] = await ciclosDe('col4')
    await enviar((await formDe(c4.id, 'autoavaliacao')).id, 'col4', respostas('avd_auto_membro'))
    await mudar('col4', { status: 'encerrado', encerramento: { data: hoje, motivoId: 'm1' } })
    await sincronizarDesenvolvimento(m.db)
    expect((await ciclosDe('col4'))[0].etapa).toBe('cancelada')
    expect((await formDe(c4.id, 'autoavaliacao')).status).toBe('enviado')
    expect((await formDe(c4.id, 'lider_avalia')).status).toBe('dispensado')
  })
})

describe('atrasos e pendências', () => {
  beforeEach(async () => { await sincronizarDesenvolvimento(m.db) })

  it('atraso aparece no painel e notifica; falta de resposta da equipe expira sem virar nota', async () => {
    const [lid] = await ciclosDe('ger1')
    await enviar((await formDe(lid.id, 'autoavaliacao')).id, 'ger1', respostas('avd_auto_lideranca'))
    await enviar((await formDe(lid.id, 'lider_avalia')).id, 'dir1', respostas('avd_superior_lideranca'))
    await enviar((await formDe(lid.id, 'equipe_avalia_lider', 'col3')).id, 'col3', respostas('avd_equipe_lideranca'))
    expect((await ciclosDe('ger1'))[0].etapa).toBe('coleta') // equipe ainda no prazo
    await m.pg.query("update dsv_ciclos set prazo = $2 where id = $1", [lid.id, somarDias(hoje, -1)])
    await m.pg.query("update dsv_formularios set prazo = $2 where ciclo_id = $1", [lid.id, somarDias(hoje, -1)])
    const [c5] = await ciclosDe('col5')
    await m.pg.query("update dsv_ciclos set prazo = $2 where id = $1", [c5.id, somarDias(hoje, -2)])
    await m.pg.query("update dsv_formularios set prazo = $2 where ciclo_id = $1", [c5.id, somarDias(hoje, -2)])
    const p = await GET(m, 'desenvolvimento/painel', c.rh1)
    expect(p.status).toBe(200)
    expect(p.json.indicadores.atrasados).toBeGreaterThanOrEqual(1)
    expect(p.json.indicadores.elegiveis).toBe(5)
    expect(p.json.atencao.some((x: any) => x.id === c5.id && x.atrasado)).toBe(true)
    // Feedback da equipe fechou no prazo: os não respondidos expiram, a contagem não muda e o ciclo segue para consolidação.
    expect((await ciclosDe('ger1'))[0].etapa).toBe('consolidacao')
    expect((await formDe(lid.id, 'equipe_avalia_lider', 'col4')).status).toBe('expirado')
    expect((await q('select count(*)::int n from dsv_respostas_equipe where ciclo_id = $1', [lid.id]))[0].n).toBe(1)
    expect((await q("select count(*)::int n from ntf_notificacoes where destinatario_id = 'col5' and chave like 'dsv-atraso:%'"))[0].n).toBeGreaterThanOrEqual(1)
    // RH dispensa um formulário (afastamento): não é avaliação negativa e o ciclo pode seguir.
    const auto5 = await formDe(c5.id, 'autoavaliacao')
    expect((await POST(m, `desenvolvimento/formularios/${auto5.id}/dispensar`, c.rh1, { motivo: 'Afastamento por saúde no período' })).status).toBe(200)
    expect((await formDe(c5.id, 'autoavaliacao')).status).toBe('dispensado')
    // Lista com filtros e exportação (sem dados do feedback da equipe).
    const l = await GET(m, 'desenvolvimento/ciclos?situacao=atrasados', c.rh1)
    expect(l.json.itens.length).toBeGreaterThanOrEqual(1)
    const csv = await GET(m, 'desenvolvimento/exportar', c.rh1)
    expect(csv.binario?.nome).toMatch(/\.csv$/)
    expect(csv.binario!.dados.toString('utf8')).not.toMatch(/equipe/i)
  })

  it('suspender (afastamento) e retomar com novo prazo', async () => {
    const [c5] = await ciclosDe('col5')
    expect((await POST(m, `desenvolvimento/ciclos/${c5.id}/suspender`, c.rh1, { motivo: 'Afastamento informado ao RH' })).status).toBe(200)
    expect((await GET(m, `desenvolvimento/ciclos/${c5.id}`, c.col5)).json.ciclo).toMatchObject({ status: 'suspensa', atrasado: false })
    expect((await POST(m, `desenvolvimento/ciclos/${c5.id}/retomar`, c.rh1, { prazo: somarDias(hoje, 15) })).status).toBe(200)
    expect((await GET(m, `desenvolvimento/ciclos/${c5.id}`, c.col5)).json.ciclo.prazo).toBe(somarDias(hoje, 15))
  })

  it('modelos versionados: ciclos abertos mantêm a versão que receberam', async () => {
    const cfg = await GET(m, 'desenvolvimento/config', c.rh1)
    const md = cfg.json.modelos.find((x: any) => x.chave === 'avd_lider_membro')
    const r = await PUT(m, 'desenvolvimento/modelos/avd_lider_membro', c.rh1, { ...md, criterios: [...md.criterios, { id: 'novo', nome: 'Atendimento ao cliente', dimensao: 'Entregas', peso: 2 }] })
    expect(r.json).toMatchObject({ versao: 2 })
    const [c3] = await ciclosDe('col3')
    expect((await q("select modelo_versao from dsv_formularios where ciclo_id = $1 and tipo = 'lider_avalia'", [c3.id]))[0].modelo_versao).toBe(1)
    expect((await PUT(m, 'desenvolvimento/modelos/avd_lider_membro', c.ger1, md)).status).toBe(403)
    expect((await PUT(m, 'desenvolvimento/config', c.rh1, { feedbackLideranca: { minRespostas: 4, minDiasNaEquipe: 30 } })).json.config.feedbackLideranca.minRespostas).toBe(4)
  })
})
