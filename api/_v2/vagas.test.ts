import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, DEL, chamar } from './teste/harness'

let m: Awaited<ReturnType<typeof mundoPadrao>>
const amanha = () => new Date(Date.now() + 30 * 86400000).toISOString().slice(0, 10)

const corpoVaga = (extra: Record<string, unknown> = {}) => ({
  titulo: 'Advogado(a) Trabalhista', setorId: 's1', cargoId: 'g1', qtdPosicoes: 2, modalidade: 'remoto', responsabilidades: 'Conduzir contencioso.',
  resumo: 'Atuação no contencioso trabalhista.', textoPublico: 'Venha trabalhar conosco.', canais: ['portal'], encerraCandidaturasEm: amanha(),
  motivo: 'expansao', prioridade: 'normal', tipo: 'efetivo', salarioMin: 8000, salarioMax: 12000, observacoesRh: 'Verba aprovada no ciclo.', ...extra,
})

async function criar(cookie: string, extra: Record<string, unknown> = {}) {
  const r = await POST(m, 'vagas', cookie, corpoVaga(extra))
  expect(r.status).toBe(201)
  return r.json
}
/** Cria, solicita e aprova (RH) até o estado "aprovada". */
async function criarAprovada(extra: Record<string, unknown> = {}) {
  const d = await criar(m.c.rh1, extra)
  const id = d.vaga.id as string
  const s = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.rh1)
  expect(s.status).toBe(200)
  if (s.json.vaga.status === 'em_aprovacao') {
    const passo = s.json.aprovacoes.find((p: any) => p.status === 'pendente')
    const a = await POST(m, `vagas/${id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'aprovar' })
    expect(a.status).toBe(200)
  }
  return id
}

beforeAll(async () => { m = await mundoPadrao() }, 60_000)

describe('vagas · ciclo de vida', () => {
  it('cria rascunho com código, slug e etapas padrão; só o título é obrigatório', async () => {
    const r = await POST(m, 'vagas', m.c.rh1, { titulo: 'Rascunho rápido' })
    expect(r.status).toBe(201)
    expect(r.json.vaga.status).toBe('rascunho')
    expect(r.json.vaga.codigo).toMatch(/^VAG-\d{4}-\d{4}$/)
    expect(r.json.vaga.slug).toMatch(/^rascunho-rapido-/)
    expect(r.json.etapas.length).toBeGreaterThanOrEqual(2)
    expect(r.json.etapas[0].tipo).toBe('nova')
    expect((await POST(m, 'vagas', m.c.rh1, {})).status).toBe(400)
  })

  it('edita com controle de versão e rejeita edição concorrente', async () => {
    const d = await criar(m.c.rh1)
    const id = d.vaga.id
    const e1 = await PUT(m, `vagas/${id}`, m.c.rh1, { versao: d.vaga.versao, titulo: 'Advogado Sênior' })
    expect(e1.status).toBe(200)
    expect(e1.json.vaga.titulo).toBe('Advogado Sênior')
    expect(e1.json.vaga.versao).toBe(d.vaga.versao + 1)
    const e2 = await PUT(m, `vagas/${id}`, m.c.rh1, { versao: d.vaga.versao, titulo: 'Outro' })
    expect(e2.status).toBe(409)
  })

  it('valida referências do cadastro e salário', async () => {
    expect((await POST(m, 'vagas', m.c.rh1, corpoVaga({ setorId: 'inexistente' }))).status).toBe(400)
    expect((await POST(m, 'vagas', m.c.rh1, corpoVaga({ cargoId: 'nada' }))).status).toBe(400)
    expect((await POST(m, 'vagas', m.c.rh1, corpoVaga({ salarioMin: 9000, salarioMax: 1000 }))).status).toBe(400)
    expect((await POST(m, 'vagas', m.c.rh1, corpoVaga({ modalidade: 'voando' }))).status).toBe(400)
    expect((await POST(m, 'vagas', m.c.rh1, corpoVaga({ recrutadorId: 'fantasma' }))).status).toBe(400)
  })

  it('fluxo completo: solicitar → aprovar → publicar → pausar → retomar → encerrar → reabrir', async () => {
    const d = await criar(m.c.rh1)
    const id = d.vaga.id
    const sol = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.rh1)
    expect(sol.json.vaga.status).toBe('em_aprovacao')
    expect(sol.json.aprovacoes).toHaveLength(1)
    const passo = sol.json.aprovacoes[0]
    expect(passo.status).toBe('pendente')
    // em aprovação não edita
    expect((await PUT(m, `vagas/${id}`, m.c.rh1, { versao: sol.json.vaga.versao, titulo: 'x' })).status).toBe(409)
    const ap = await POST(m, `vagas/${id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'aprovar' })
    expect(ap.json.vaga.status).toBe('aprovada')
    const pub = await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    expect(pub.json.vaga.status).toBe('publicada')
    expect(pub.json.vaga.publicadaEm).toBeTruthy()
    expect((await POST(m, `vagas/${id}/acoes/pausar`, m.c.rh1, { motivo: 'Aguardando orçamento' })).json.vaga.status).toBe('pausada')
    expect((await POST(m, `vagas/${id}/acoes/retomar`, m.c.rh1)).json.vaga.status).toBe('publicada')
    expect((await POST(m, `vagas/${id}/acoes/encerrar`, m.c.rh1, {})).status).toBe(400) // motivo obrigatório
    const enc = await POST(m, `vagas/${id}/acoes/encerrar`, m.c.rh1, { motivo: 'Contratação concluída' })
    expect(enc.json.vaga.status).toBe('encerrada')
    expect(enc.json.vaga.motivoEncerramento).toBe('Contratação concluída')
    expect((await POST(m, `vagas/${id}/acoes/reabrir`, m.c.rh1)).json.vaga.status).toBe('aprovada')
    const tipos = (await GET(m, `vagas/${id}`, m.c.rh1)).json.eventos.map((e: any) => e.tipo)
    for (const t of ['criada', 'aprovacao_solicitada', 'aprovada', 'publicada', 'pausada', 'retomada', 'encerrada', 'reaberta']) expect(tipos).toContain(t)
  })

  it('vaga não aprovada NUNCA é publicada', async () => {
    const d = await criar(m.c.rh1)
    const id = d.vaga.id
    for (const [passo, esperado] of [['rascunho', 409]] as const) expect((await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)).status).toBe(esperado)
    await POST(m, `vagas/${id}/acoes/solicitar`, m.c.rh1)
    expect((await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)).status).toBe(409) // em aprovação
    expect((await GET(m, `vagas/${id}`, m.c.rh1)).json.vaga.status).toBe('em_aprovacao')
  })

  it('publicar exige campos mínimos e data de encerramento futura', async () => {
    const d = await criar(m.c.rh1, { encerraCandidaturasEm: '2020-01-01', canais: [] })
    const id = d.vaga.id
    const s = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.rh1)
    await POST(m, `vagas/${id}/aprovacoes/${s.json.aprovacoes[0].id}/decidir`, m.c.rh1, { decisao: 'aprovar' })
    const pub = await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    expect(pub.status).toBe(400)
    expect(pub.json.campos.encerraCandidaturasEm).toBeTruthy()
    expect(pub.json.campos.canais).toBeTruthy()
  })

  it('transições inválidas retornam 409', async () => {
    const d = await criar(m.c.rh1)
    for (const a of ['pausar', 'retomar', 'encerrar', 'reabrir']) expect((await POST(m, `vagas/${d.vaga.id}/acoes/${a}`, m.c.rh1, { motivo: 'xxx' })).status).toBe(409)
    expect((await POST(m, `vagas/${d.vaga.id}/acoes/voar`, m.c.rh1)).status).toBe(400)
  })

  it('solicitar exige os campos obrigatórios', async () => {
    const r = await POST(m, 'vagas', m.c.rh1, { titulo: 'Incompleta' })
    const s = await POST(m, `vagas/${r.json.vaga.id}/acoes/solicitar`, m.c.rh1)
    expect(s.status).toBe(400)
    expect(Object.keys(s.json.campos)).toEqual(expect.arrayContaining(['setorId', 'responsabilidades']))
  })
})

describe('vagas · aprovações', () => {
  it('rejeitar exige justificativa e cancela a vaga; notifica o solicitante', async () => {
    const d = await criar(m.c.ger1)
    const id = d.vaga.id
    const s = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.ger1)
    expect(s.status).toBe(200)
    const passo = s.json.aprovacoes[0]
    expect((await POST(m, `vagas/${id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'rejeitar' })).status).toBe(400)
    const rj = await POST(m, `vagas/${id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'rejeitar', justificativa: 'Sem orçamento neste trimestre.' })
    expect(rj.json.vaga.status).toBe('cancelada')
    const n = await GET(m, 'notificacoes', m.c.ger1)
    expect(n.json.itens.some((x: any) => x.tipo === 'vaga_rejeitada')).toBe(true)
    const aud = await GET(m, 'auditoria', m.c.admin1, { entidade: 'vaga', entidade_id: id })
    expect(aud.json.itens.map((x: any) => x.acao)).toEqual(expect.arrayContaining(['solicitar_aprovacao', 'aprovacao_rejeitar']))
  })

  it('pedir ajustes devolve ao solicitante, que edita e solicita de novo (nova rodada)', async () => {
    const d = await criar(m.c.ger1)
    const id = d.vaga.id
    const s = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.ger1)
    const aj = await POST(m, `vagas/${id}/aprovacoes/${s.json.aprovacoes[0].id}/decidir`, m.c.rh1, { decisao: 'ajustes', justificativa: 'Detalhar as responsabilidades.' })
    expect(aj.json.vaga.status).toBe('ajustes')
    expect((await GET(m, 'notificacoes', m.c.ger1)).json.itens.some((x: any) => x.tipo === 'vaga_ajustes')).toBe(true)
    const ed = await PUT(m, `vagas/${id}`, m.c.ger1, { versao: aj.json.vaga.versao, responsabilidades: 'Mais detalhes aqui.' })
    expect(ed.status).toBe(200)
    const s2 = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.ger1)
    expect(s2.json.vaga.status).toBe('em_aprovacao')
    expect(Math.max(...s2.json.aprovacoes.map((p: any) => p.rodada))).toBe(2)
  })

  it('só o aprovador designado decide; gestor não aprova a própria solicitação', async () => {
    const d = await criar(m.c.ger1)
    const s = await POST(m, `vagas/${d.vaga.id}/acoes/solicitar`, m.c.ger1)
    const passo = s.json.aprovacoes[0]
    expect((await POST(m, `vagas/${d.vaga.id}/aprovacoes/${passo.id}/decidir`, m.c.ger1, { decisao: 'aprovar' })).status).toBe(403)
    expect((await POST(m, `vagas/${d.vaga.id}/aprovacoes/${passo.id}/decidir`, m.c.col1, { decisao: 'aprovar' })).status).toBe(403)
    expect((await POST(m, `vagas/${d.vaga.id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'aprovar' })).status).toBe(200)
    expect((await POST(m, `vagas/${d.vaga.id}/aprovacoes/${passo.id}/decidir`, m.c.rh1, { decisao: 'aprovar' })).status).toBe(409) // já decidido
  })

  it('fluxo crítico tem 3 passos em ordem; reatribuição e função financeira', async () => {
    const d = await criar(m.c.rh1, { prioridade: 'critica' })
    const id = d.vaga.id
    const s = await POST(m, `vagas/${id}/acoes/solicitar`, m.c.rh1)
    expect(s.json.aprovacoes).toHaveLength(3)
    const [p1, p2, p3] = s.json.aprovacoes
    // fora de ordem não vale
    expect((await POST(m, `vagas/${id}/aprovacoes/${p3.id}/decidir`, m.c.dir1, { decisao: 'aprovar' })).status).toBe(409)
    await POST(m, `vagas/${id}/aprovacoes/${p1.id}/decidir`, m.c.rh1, { decisao: 'aprovar' })
    // passo 2 exige a função de aprovação financeira: reatribui para a diretoria e a diretoria decide
    expect((await POST(m, `vagas/${id}/aprovacoes/${p2.id}/decidir`, m.c.dir1, { decisao: 'aprovar' })).status).toBe(403)
    const re = await POST(m, `vagas/${id}/aprovacoes/${p2.id}/reatribuir`, m.c.rh1, { tipo: 'pessoa', ref: 'dir1' })
    expect(re.status).toBe(200)
    expect((await POST(m, `vagas/${id}/aprovacoes/${p2.id}/decidir`, m.c.dir1, { decisao: 'aprovar' })).status).toBe(200)
    const fim = await POST(m, `vagas/${id}/aprovacoes/${p3.id}/decidir`, m.c.dir1, { decisao: 'aprovar' })
    expect(fim.json.vaga.status).toBe('aprovada')
    expect((await POST(m, `vagas/${id}/aprovacoes/${p1.id}/reatribuir`, m.c.rh1, { tipo: 'pessoa', ref: 'x' })).status).toBe(400)
  })

  it('fluxo sem passos aprova automaticamente', async () => {
    const adm = await PUT(m, 'recrutamento/config/fluxos_aprovacao', m.c.admin1, { dados: [{ chave: 'padrao', nome: 'Sem aprovação', passos: [] }] })
    expect(adm.status).toBe(200)
    const d = await criar(m.c.rh1)
    const s = await POST(m, `vagas/${d.vaga.id}/acoes/solicitar`, m.c.rh1)
    expect(s.json.vaga.status).toBe('aprovada')
    expect((await POST(m, `vagas/${d.vaga.id}/acoes/publicar`, m.c.rh1)).json.vaga.status).toBe('publicada')
    // restaura o padrão
    await PUT(m, 'recrutamento/config/fluxos_aprovacao', m.c.admin1, { dados: [
      { chave: 'padrao', nome: 'Análise do RH', passos: [{ rotulo: 'Análise do RH', tipo: 'papel', ref: 'rh', prazoDias: 3 }] },
      { chave: 'critica', nome: 'Crítica', condicoes: { prioridades: ['critica'] }, passos: [
        { rotulo: 'Análise do RH', tipo: 'papel', ref: 'rh', prazoDias: 3 }, { rotulo: 'Aprovação do orçamento', tipo: 'funcao', ref: 'aprovador_financeiro', prazoDias: 3 }, { rotulo: 'Aprovação da diretoria', tipo: 'papel', ref: 'diretoria', prazoDias: 5 }] },
    ] })
  })

  it('configuração do fluxo exige capacidade e valida os aprovadores', async () => {
    expect((await PUT(m, 'recrutamento/config/fluxos_aprovacao', m.c.ger1, { dados: [] })).status).toBe(403)
    expect((await PUT(m, 'recrutamento/config/fluxos_aprovacao', m.c.rh1, { dados: [{ chave: 'x', nome: 'x', passos: [] }] })).status).toBe(400) // falta padrao
    expect((await PUT(m, 'recrutamento/config/fluxos_aprovacao', m.c.rh1, { dados: [{ chave: 'padrao', nome: 'p', passos: [{ rotulo: 'a', tipo: 'pessoa', ref: 'ninguem' }] }] })).status).toBe(400)
    expect((await PUT(m, 'recrutamento/config/etapas_padrao', m.c.rh1, { dados: [{ nome: 'A', tipo: 'triagem' }, { nome: 'B', tipo: 'contratado' }] })).status).toBe(400)
  })
})

describe('vagas · permissões e escopo', () => {
  it('gestor vê só vagas da própria área e nunca salário nem observações do RH', async () => {
    const minha = await criar(m.c.rh1, { titulo: 'Vaga do Jurídico', setorId: 's1' })
    const alheia = await criar(m.c.rh1, { titulo: 'Vaga do Comercial', setorId: 's2' })
    const lista = await GET(m, 'vagas', m.c.ger1, { por: '200' })
    const ids = lista.json.itens.map((v: any) => v.id)
    expect(ids).toContain(minha.vaga.id)
    expect(ids).not.toContain(alheia.vaga.id)
    expect((await GET(m, `vagas/${alheia.vaga.id}`, m.c.ger1)).status).toBe(404)
    const det = await GET(m, `vagas/${minha.vaga.id}`, m.c.ger1)
    expect(det.status).toBe(200)
    expect(det.json.vaga).not.toHaveProperty('salarioMin')
    expect(det.json.vaga).not.toHaveProperty('salarioMax')
    expect(det.json.vaga).not.toHaveProperty('observacoesRh')
    expect(JSON.stringify(det.json)).not.toContain('Verba aprovada')
    const rh = await GET(m, `vagas/${minha.vaga.id}`, m.c.rh1)
    expect(Number(rh.json.vaga.salarioMax)).toBe(12000)
    expect(rh.json.vaga.observacoesRh).toBe('Verba aprovada no ciclo.')
  })

  it('RH e recrutador veem todas; colaborador comum não acessa o módulo', async () => {
    expect((await GET(m, 'vagas', m.c.rec1)).json.total).toBeGreaterThan(0)
    expect((await GET(m, 'vagas', m.c.rh1)).json.total).toBeGreaterThan(0)
    expect((await GET(m, 'vagas', m.c.col1)).status).toBe(403)
    expect((await POST(m, 'vagas', m.c.col1, { titulo: 'x' })).status).toBe(403)
    expect((await GET(m, 'vagas', undefined)).status).toBe(401)
  })

  it('recrutador não vê salário (sem vagas:ver_remuneracao) e salário enviado por ele é ignorado', async () => {
    const d = await criar(m.c.rec1, { salarioMin: 1, salarioMax: 2, observacoesRh: 'nota do recrutador' })
    expect(d.vaga).not.toHaveProperty('salarioMax')
    const rh = await GET(m, `vagas/${d.vaga.id}`, m.c.rh1)
    expect(rh.json.vaga.salarioMax).toBeNull()
    expect(rh.json.vaga.observacoesRh).toBe('nota do recrutador')
  })

  it('gestor só abre vaga para área que lidera e não define recrutador', async () => {
    expect((await POST(m, 'vagas', m.c.ger1, corpoVaga({ setorId: 's2' }))).status).toBe(403)
    const ok1 = await POST(m, 'vagas', m.c.ger1, corpoVaga({ recrutadorId: 'rec1' }))
    expect(ok1.status).toBe(201)
    expect(ok1.json.vaga.recrutadorId).toBeNull()
    expect(ok1.json.vaga.gestorSolicitanteId).toBe('ger1')
  })

  it('gestor não publica nem encerra; solicitante pode cancelar a própria solicitação', async () => {
    const id = await criarAprovada({ setorId: 's1' })
    expect((await POST(m, `vagas/${id}/acoes/publicar`, m.c.ger1)).status).toBe(403)
    const d = await criar(m.c.ger1)
    expect((await POST(m, `vagas/${d.vaga.id}/acoes/cancelar`, m.c.ger1, { motivo: 'Desisti da vaga' })).json.vaga.status).toBe('cancelada')
  })

  it('o aprovador da diretoria enxerga a vaga e, sem salário, as permissões refletem isso', async () => {
    const d = await criar(m.c.rh1, { prioridade: 'critica', setorId: 's2' })
    await POST(m, `vagas/${d.vaga.id}/acoes/solicitar`, m.c.rh1)
    const pend = await GET(m, 'recrutamento/aprovacoes-pendentes', m.c.rh1)
    expect(pend.json.itens.some((i: any) => i.vagaId === d.vaga.id)).toBe(true)
    expect((await GET(m, 'recrutamento/aprovacoes-pendentes', m.c.dir1)).json.itens.some((i: any) => i.vagaId === d.vaga.id)).toBe(false)
  })
})

describe('vagas · duplicar, etapas, comentários, anexos, exportação', () => {
  it('duplicar copia o conteúdo mas não identificadores, status, aprovações nem histórico', async () => {
    const id = await criarAprovada()
    await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    const orig = (await GET(m, `vagas/${id}`, m.c.rh1)).json
    const dup = await POST(m, `vagas/${id}/duplicar`, m.c.rh1)
    expect(dup.status).toBe(201)
    const v = dup.json.vaga
    expect(v.id).not.toBe(id)
    expect(v.codigo).not.toBe(orig.vaga.codigo)
    expect(v.slug).not.toBe(orig.vaga.slug)
    expect(v.status).toBe('rascunho')
    expect(v.titulo).toBe(`${orig.vaga.titulo} (cópia)`)
    expect(v.publicadaEm).toBeNull()
    expect(v.encerraCandidaturasEm).toBeNull()
    expect(v.responsabilidades).toBe(orig.vaga.responsabilidades)
    expect(dup.json.aprovacoes).toHaveLength(0)
    expect(dup.json.eventos.map((e: any) => e.tipo)).toEqual(['criada'])
    expect(dup.json.etapas.map((e: any) => e.nome)).toEqual(orig.etapas.map((e: any) => e.nome))
    expect(dup.json.etapas[0].id).not.toBe(orig.etapas[0].id)
    expect(dup.json.contagens.total).toBe(0)
    // gestor duplicando não leva o salário
    const mine = await criar(m.c.rh1, { setorId: 's1' })
    const g = await POST(m, `vagas/${mine.vaga.id}/duplicar`, m.c.ger1)
    expect(g.status).toBe(201)
    const gv = (await GET(m, `vagas/${g.json.vaga.id}`, m.c.rh1)).json.vaga
    expect(gv.salarioMax).toBeNull()
  })

  it('etapas: reordena, renomeia e protege etapas com candidaturas', async () => {
    const d = await criar(m.c.rh1)
    const id = d.vaga.id
    const et = d.etapas
    const novas = [et[0], { nome: 'Teste prático', tipo: 'generica' }, ...et.slice(1)].map((e: any) => ({ id: e.id, nome: e.nome, tipo: e.tipo }))
    const r = await PUT(m, `vagas/${id}/etapas`, m.c.rh1, { etapas: novas })
    expect(r.status).toBe(200)
    expect(r.json.etapas.map((e: any) => e.nome)).toContain('Teste prático')
    expect(r.json.etapas[1].nome).toBe('Teste prático')
    expect((await PUT(m, `vagas/${id}/etapas`, m.c.rh1, { etapas: [{ nome: 'x', tipo: 'triagem' }, { nome: 'y', tipo: 'contratado' }] })).status).toBe(400)
    // etapa com candidatura não pode ser removida
    const cand = (await m.pg.query("insert into rec_candidatos (nome, email) values ('Zé', 'ze@x.com') returning id")).rows[0].id
    const etapaTriagem = r.json.etapas.find((e: any) => e.tipo === 'triagem').id
    await m.pg.query('insert into rec_candidaturas (vaga_id, candidato_id, etapa_id) values ($1,$2,$3)', [id, cand, etapaTriagem])
    const sem = r.json.etapas.filter((e: any) => e.id !== etapaTriagem).map((e: any) => ({ id: e.id, nome: e.nome, tipo: e.tipo }))
    expect((await PUT(m, `vagas/${id}/etapas`, m.c.rh1, { etapas: sem })).status).toBe(409)
    expect((await GET(m, `vagas/${id}`, m.c.rh1)).json.contagens.total).toBe(1)
  })

  it('comentários internos notificam os envolvidos uma vez; anexos validam o tipo e exigem acesso', async () => {
    const d = await criar(m.c.ger1)
    const id = d.vaga.id
    const c1 = await POST(m, `vagas/${id}/comentarios`, m.c.rh1, { texto: 'Precisamos alinhar o perfil.' })
    expect(c1.status).toBe(201)
    expect(c1.json.comentarios).toHaveLength(1)
    expect((await GET(m, 'notificacoes', m.c.ger1)).json.itens.filter((n: any) => n.tipo === 'vaga_comentario')).toHaveLength(1)
    expect((await POST(m, `vagas/${id}/comentarios`, m.c.rh1, { texto: '' })).status).toBe(400)
    expect((await POST(m, `vagas/${id}/comentarios`, m.c.ger2, { texto: 'intruso' })).status).toBe(404)

    const pdf = Buffer.from('%PDF-1.4\n1 0 obj<<>>endobj\ntrailer<<>>\n%%EOF').toString('base64')
    const up = await POST(m, `vagas/${id}/anexos`, m.c.ger1, { arquivo: { nome: 'descricao.pdf', base64: pdf } })
    expect(up.status).toBe(201)
    expect(up.json.anexos).toHaveLength(1)
    const fake = Buffer.from('MZ\x90\x00 executavel disfarçado').toString('base64')
    expect((await POST(m, `vagas/${id}/anexos`, m.c.ger1, { arquivo: { nome: 'x.pdf', base64: fake } })).status).toBe(400)
    const aid = up.json.anexos[0].id
    const dl = await GET(m, `vagas/${id}/anexos/${aid}`, m.c.ger1)
    expect(dl.status).toBe(200)
    expect(dl.binario?.mime).toBe('application/pdf')
    expect((await GET(m, `vagas/${id}/anexos/${aid}`, m.c.ger2)).status).toBe(404)
    expect((await GET(m, `vagas/${id}/anexos/${aid}`)).status).toBe(401)
    expect((await DEL(m, `vagas/${id}/anexos/${aid}`, m.c.ger1)).json.anexos).toHaveLength(0)
  })

  it('exportação CSV: só gestão, sem salário para quem não pode, células protegidas', async () => {
    await criar(m.c.rh1, { titulo: '=HYPERLINK("http://x")' })
    expect((await GET(m, 'vagas/exportar', m.c.ger1)).status).toBe(403)
    const rh = await GET(m, 'vagas/exportar', m.c.rh1)
    const csv = rh.binario!.dados.toString('utf8')
    expect(csv).toContain('Salário mínimo')
    expect(csv).toContain("'=HYPERLINK")
    const rec = await GET(m, 'vagas/exportar', m.c.rec1)
    expect(rec.binario!.dados.toString('utf8')).not.toContain('Salário')
  })

  it('arquivar só vagas finalizadas e escondê-las da lista padrão', async () => {
    const d = await criar(m.c.rh1, { titulo: 'Para arquivar' })
    expect((await POST(m, `vagas/${d.vaga.id}/acoes/arquivar`, m.c.rh1)).status).toBe(409)
    await POST(m, `vagas/${d.vaga.id}/acoes/cancelar`, m.c.rh1, { motivo: 'Não será mais aberta' })
    expect((await POST(m, `vagas/${d.vaga.id}/acoes/arquivar`, m.c.rh1)).json.vaga.arquivada).toBe(true)
    const padrao = (await GET(m, 'vagas', m.c.rh1, { q: 'Para arquivar' })).json
    expect(padrao.total).toBe(0)
    expect((await GET(m, 'vagas', m.c.rh1, { q: 'Para arquivar', arquivadas: '1' })).json.total).toBe(1)
  })
})

describe('vagas · lista, painel e alertas', () => {
  it('filtros da lista e paginação', async () => {
    const todas = (await GET(m, 'vagas', m.c.rh1, { por: '5', pagina: '1' })).json
    expect(todas.itens.length).toBeLessThanOrEqual(5)
    expect(todas.total).toBeGreaterThan(5)
    const so = (await GET(m, 'vagas', m.c.rh1, { status: 'publicada', por: '200' })).json
    expect(so.itens.every((v: any) => v.status === 'publicada')).toBe(true)
    const q = (await GET(m, 'vagas', m.c.rh1, { q: 'Comercial' })).json
    expect(q.itens.every((v: any) => /comercial/i.test(v.titulo))).toBe(true)
    expect((await GET(m, 'vagas', m.c.rh1, { setor: 's2', por: '200' })).json.itens.every((v: any) => v.setorId === 's2')).toBe(true)
  })

  it('painel: contagens consistentes com a lista, filtros aplicados, sem inventar dados de candidatos', async () => {
    const p = (await GET(m, 'recrutamento/painel', m.c.rh1)).json
    const lista = (await GET(m, 'vagas', m.c.rh1, { por: '200' })).json
    expect(p.cards.total).toBe(lista.total)
    expect(p.cards.publicadas).toBe(lista.porStatus.publicada ?? 0)
    expect(p.cards.emAprovacao).toBe(lista.porStatus.em_aprovacao ?? 0)
    const fil = (await GET(m, 'recrutamento/painel', m.c.rh1, { setor: 's2' })).json
    const listaS2 = (await GET(m, 'vagas', m.c.rh1, { setor: 's2', por: '200' })).json
    expect(fil.cards.total).toBe(listaS2.total)
    expect(fil.cards.total).toBeLessThan(p.cards.total)
    // sem candidatos reais: tempos e conversão ficam nulos em vez de inventados
    expect(fil.cards.candidaturasRecebidas).toBe(0)
    expect(fil.indicadores.tempoMedioFechamentoDias).toBeNull()
    expect(fil.indicadores.tempoMedioPrimeiraCandidaturaDias).toBeNull()
    expect(fil.indicadores.taxaConversao).toBeNull()
    expect(fil.funil).toEqual([])
    expect(fil.semDadosDeCandidatos).toBe(true)
    expect(p.definicoes.tempoPreenchimento).toBeTruthy()
    // gestor vê o painel só da própria área
    const g = (await GET(m, 'recrutamento/painel', m.c.ger1)).json
    expect(g.cards.total).toBeLessThan(p.cards.total)
    expect((await GET(m, 'recrutamento/painel', m.c.col1)).status).toBe(403)
  })

  it('painel calcula tempos e funil quando há candidaturas e movimentações', async () => {
    const id = await criarAprovada({ titulo: 'Vaga com candidatos', qtdPosicoes: 1 })
    await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    await m.pg.query("update rec_vagas set publicada_em = now() - interval '10 days', primeira_candidatura_em = now() - interval '8 days' where id = $1", [id])
    const et = (await m.pg.query('select id, tipo from rec_vaga_etapas where vaga_id = $1 order by ordem', [id])).rows
    const nova = et.find((e) => e.tipo === 'nova').id, tri = et.find((e) => e.tipo === 'triagem').id, con = et.find((e) => e.tipo === 'contratado').id
    const cand = (await m.pg.query("insert into rec_candidatos (nome, email) values ('Ana', 'ana@x.com') returning id")).rows[0].id
    const ca = (await m.pg.query("insert into rec_candidaturas (vaga_id, candidato_id, etapa_id, status, origem, encerrada_em) values ($1,$2,$3,'contratado','portal', now() - interval '1 day') returning id", [id, cand, con])).rows[0].id
    await m.pg.query("insert into rec_candidatura_movs (candidatura_id, em, para_etapa_id) values ($1, now() - interval '9 days', $2), ($1, now() - interval '5 days', $3), ($1, now() - interval '1 day', $4)", [ca, nova, tri, con])
    const p = (await GET(m, 'recrutamento/painel', m.c.rh1, { q: '' })).json
    expect(p.cards.candidaturasRecebidas).toBeGreaterThanOrEqual(1)
    expect(p.cards.contratacoes).toBeGreaterThanOrEqual(1)
    expect(p.indicadores.tempoMedioFechamentoDias).toBeCloseTo(9, 0)
    expect(p.indicadores.tempoMedioPrimeiraCandidaturaDias).toBeCloseTo(2, 0)
    const tri_ = p.indicadores.tempoPorEtapa.find((x: any) => x.etapa === 'Nova candidatura')
    expect(tri_.dias).toBeCloseTo(4, 0)
    expect(p.funil.map((f: any) => f.tipo)).toEqual(expect.arrayContaining(['nova', 'triagem', 'contratado']))
    expect(p.indicadores.taxaConversao).toBeGreaterThan(0)
    expect(p.candidaturasPorVaga[0].codigo).toBeTruthy()
  })

  it('alertas: prazo vencido, sem movimentação e aprovação atrasada; processamento é idempotente', async () => {
    const id = await criarAprovada({ titulo: 'Vaga atrasada' })
    await POST(m, `vagas/${id}/acoes/publicar`, m.c.rh1)
    await m.pg.query("update rec_vagas set prazo_preenchimento = current_date - 3, atualizado_em = now() - interval '30 days' where id = $1", [id])
    await m.pg.query("update rec_vaga_eventos set em = now() - interval '30 days' where vaga_id = $1", [id])
    const lista = (await GET(m, 'recrutamento/alertas', m.c.rh1)).json.itens.filter((a: any) => a.vagaId === id).map((a: any) => a.tipo)
    expect(lista).toEqual(expect.arrayContaining(['prazo_vencido', 'sem_movimentacao']))

    const pend = await criar(m.c.ger1, { titulo: 'Aprovação atrasada' })
    await POST(m, `vagas/${pend.vaga.id}/acoes/solicitar`, m.c.ger1)
    await m.pg.query("update rec_vaga_aprovacoes set prazo = current_date - 2 where vaga_id = $1", [pend.vaga.id])
    expect((await GET(m, 'recrutamento/alertas', m.c.rh1)).json.itens.some((a: any) => a.vagaId === pend.vaga.id && a.tipo === 'aprovacao_atrasada')).toBe(true)

    expect((await POST(m, 'recrutamento/alertas/processar', m.c.ger1)).status).toBe(403)
    const p1 = await POST(m, 'recrutamento/alertas/processar', m.c.rh1)
    expect(p1.json.notificacoesCriadas).toBeGreaterThan(0)
    const p2 = await POST(m, 'recrutamento/alertas/processar', m.c.rh1)
    expect(p2.json.notificacoesCriadas).toBe(0)
  })

  it('publicação agendada só publica vaga aprovada e completa', async () => {
    const ok1 = await criarAprovada({ titulo: 'Agendada ok' })
    const hoje = new Date().toISOString().slice(0, 10)
    await m.pg.query('update rec_vagas set publicar_em = $2::date where id = $1', [ok1, hoje])
    const naoAprovada = await criar(m.c.rh1, { titulo: 'Agendada sem aprovação' })
    await m.pg.query('update rec_vagas set publicar_em = $2::date where id = $1', [naoAprovada.vaga.id, hoje])
    const incompleta = await criarAprovada({ titulo: 'Agendada incompleta', canais: [] })
    await m.pg.query('update rec_vagas set publicar_em = $2::date where id = $1', [incompleta, hoje])
    const r = await POST(m, 'recrutamento/alertas/processar', m.c.rh1)
    expect(r.json.publicadasAgendadas).toContain(ok1)
    expect(r.json.publicadasAgendadas).not.toContain(incompleta)
    expect((await GET(m, `vagas/${ok1}`, m.c.rh1)).json.vaga.status).toBe('publicada')
    expect((await GET(m, `vagas/${naoAprovada.vaga.id}`, m.c.rh1)).json.vaga.status).toBe('rascunho')
    expect((await GET(m, `vagas/${incompleta}`, m.c.rh1)).json.vaga.status).toBe('aprovada')
  })

  it('opções do formulário respeitam o escopo do gestor', async () => {
    const g = (await GET(m, 'recrutamento/opcoes', m.c.ger1)).json
    expect(g.setores.map((s: any) => s.id)).toEqual(['s1'])
    const rh = (await GET(m, 'recrutamento/opcoes', m.c.rh1)).json
    expect(rh.setores.length).toBe(2)
    expect(rh.recrutadores.map((r: any) => r.id)).toEqual(expect.arrayContaining(['rec1', 'rh1']))
    expect((await chamar(m, 'GET', 'recrutamento/opcoes', { cookie: m.c.col1 })).status).toBe(403)
  })
})
