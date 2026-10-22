import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, GET, POST, PUT, PATCH, DEL, chamar } from './teste/harness'
import { criarVaga, corpoCandidatura } from './teste/ats-fixtures'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)

let seq = 0
async function candidatar(v: { id: string }, extra: Record<string, unknown> = {}, cookie = m.c.rh1) {
  const r = await POST(m, 'ats/candidaturas', cookie, { vagaId: v.id, nome: `Pessoa ${++seq}`, email: `pessoa${seq}-${Math.random().toString(36).slice(2, 6)}@ex.com`, ...extra })
  expect(r.status).toBe(201)
  return r.json.id as string
}
const etapa = (v: { etapas: { id: string; tipo: string }[] }, tipo: string) => v.etapas.find((e) => e.tipo === tipo)!.id

describe('ATS · permissões e escopo', () => {
  it('colaborador comum não acessa o ATS', async () => {
    expect((await GET(m, 'ats/candidaturas', m.c.col1)).status).toBe(403)
    expect((await GET(m, 'ats/vagas', undefined)).status).toBe(401)
  })

  it('gestor de outra área não vê candidato (404); gestor da área vê, mas sem notas do RH', async () => {
    const v = await criarVaga(m, { setorId: 's1' })
    const id = await candidatar(v)
    await POST(m, `ats/candidaturas/${id}/notas`, m.c.rh1, { texto: 'Nota restrita do RH', visibilidade: 'rh' })
    await POST(m, `ats/candidaturas/${id}/notas`, m.c.rh1, { texto: 'Nota da banca', visibilidade: 'banca' })
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.ger2)).status).toBe(404)
    expect((await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.ger2)).status).toBe(404)
    const ok1 = await GET(m, `ats/candidaturas/${id}`, m.c.ger1)
    expect(ok1.status).toBe(200)
    const textos = ok1.json.notas.map((n: any) => n.texto)
    expect(textos).toContain('Nota da banca')
    expect(textos).not.toContain('Nota restrita do RH')
    expect(ok1.json.permissoes.gerenciar).toBe(false)
    expect(ok1.json.propostas).toEqual([])
    expect(ok1.json.comunicacoes).toEqual([])
    expect(ok1.json.consentimentos).toEqual([])
    // gestor não pode mover nem criar nota restrita
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.ger1, { etapaId: etapa(v, 'triagem') })).status).toBe(403)
    expect((await POST(m, `ats/candidaturas/${id}/notas`, m.c.ger1, { texto: 'x', visibilidade: 'rh' })).status).toBe(403)
    // lista do gestor só tem a própria área
    const outra = await criarVaga(m, { setorId: 's2', titulo: 'Vaga Comercial' })
    await candidatar(outra)
    const lista = await GET(m, 'ats/candidaturas', m.c.ger1)
    expect(lista.json.itens.every((c: any) => c.vagaId !== outra.id)).toBe(true)
    expect((await GET(m, 'ats/candidaturas', m.c.rh1, { vagaId: outra.id })).json.total).toBe(1)
  })

  it('currículo só pela rota autenticada e dentro do escopo', async () => {
    const v = await criarVaga(m, { setorId: 's1' })
    const id = await candidatar(v, { curriculo: corpoCandidatura().curriculo })
    expect((await chamar(m, 'GET', `ats/candidaturas/${id}/curriculo`)).status).toBe(401)
    expect((await GET(m, `ats/candidaturas/${id}/curriculo`, m.c.ger2)).status).toBe(404)
    expect((await GET(m, `ats/candidaturas/${id}/curriculo`, m.c.col1)).status).toBe(403)
    const ok1 = await GET(m, `ats/candidaturas/${id}/curriculo`, m.c.rec1)
    expect(ok1.status).toBe(200)
    expect(ok1.binario?.mime).toBe('application/pdf')
    expect(ok1.binario?.dados.subarray(0, 5).toString()).toBe('%PDF-')
  })

  it('pretensão e valores de proposta ficam ocultos sem vagas:ver_remuneracao', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v, { pretensao: 7500 })
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.rec1)).json.candidatura.pretensao).toBeUndefined()
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.rh1)).json.candidatura.pretensao).toBe(7500)
    // recrutador (sem ver_remuneracao) não grava pretensão nem valor
    expect((await POST(m, 'ats/candidaturas', m.c.rec1, { vagaId: v.id, nome: 'Fulano', email: 'f@ex.com', pretensao: 1000 })).status).toBe(403)
    expect((await POST(m, `ats/candidaturas/${id}/propostas`, m.c.rec1, { valor: 8000 })).status).toBe(403)
    const p = await POST(m, `ats/candidaturas/${id}/propostas`, m.c.rh1, { valor: 8000, beneficios: ['VR'] })
    expect(p.status).toBe(201)
    expect(p.json.valor).toBe(8000)
    const visto = await GET(m, `ats/candidaturas/${id}`, m.c.rec1)
    expect(visto.json.propostas[0].valor).toBeNull()
    expect(visto.json.propostas[0].valorOculto).toBe(true)
    expect(JSON.stringify(visto.json.propostas)).not.toContain('8000')
  })
})

describe('ATS · pipeline e movimentação', () => {
  it('move entre etapas com histórico e auditoria; exige motivo para sair; valida etapa da vaga', async () => {
    const v = await criarVaga(m), outra = await criarVaga(m)
    const id = await candidatar(v)
    const m1 = await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: etapa(v, 'triagem') })
    expect(m1.status).toBe(200)
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: etapa(outra, 'triagem') })).status).toBe(409)
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: etapa(v, 'tecnica'), deEtapaId: etapa(v, 'nova') })).status).toBe(409) // alguém já moveu
    const semMotivo = await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'reprovado' })
    expect(semMotivo.status).toBe(400)
    const rep = await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'reprovado', motivo: 'Perfil não aderente' })
    expect(rep.status).toBe(200)
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'desistiu', motivo: 'x' })).status).toBe(409)
    const re = await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'ativa', etapaId: etapa(v, 'curricular') })
    expect(re.status).toBe(200)
    const perfil = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    expect(perfil.json.movimentacoes.map((x: any) => x.paraEtapa ?? x.paraStatus)).toEqual(['Nova candidatura', 'Triagem inicial', 'Triagem inicial', 'Análise curricular'])
    expect(perfil.json.movimentacoes.at(-2).motivo).toBe('Perfil não aderente')
    expect(perfil.json.movimentacoes[1].porNome).toBe('Rita RH')
    expect((await GET(m, 'auditoria', m.c.admin1, { entidade: 'candidatura', entidade_id: id })).json.itens.length).toBeGreaterThanOrEqual(3)
    const pipe = await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)
    expect(pipe.json.etapas.find((e: any) => e.tipo === 'curricular').candidaturas).toHaveLength(1)
  })

  it('colunas do kanban: cria, renomeia, colore, reordena e exclui realocando candidaturas', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { etapaId: etapa(v, 'triagem') })
    const atual = (await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)).json.etapas as any[]
    const semTriagem = atual.filter((e) => e.tipo !== 'triagem').map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo, cor: e.cor }))
    const novas = [...semTriagem.slice(0, -1), { nome: 'Teste prático', tipo: 'generica', cor: 'roxo' }, semTriagem.at(-1)]
    novas[1] = { ...novas[1], nome: 'Currículo', cor: 'verde' }
    // sem permissão de gestão do ATS
    expect((await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.ger1, { etapas: novas })).status).toBe(403)
    // coluna com candidatura não sai sem destino
    expect((await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, { etapas: novas })).status).toBe(409)
    // regras de estrutura e cor inválida
    expect((await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, { etapas: novas.slice(1) })).status).toBe(400)
    expect((await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, { etapas: novas.map((e, i) => (i === 1 ? { ...e, cor: 'dourado' } : e)) })).status).toBe(400)
    const triagem = etapa(v, 'triagem')
    const r = await PUT(m, `ats/vagas/${v.id}/etapas`, m.c.rh1, { etapas: novas, realocar: { [triagem]: novas[1].id } })
    expect(r.status).toBe(200)
    const pipe = (await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)).json.etapas as any[]
    expect(pipe.map((e) => e.nome)).toEqual(novas.map((e) => e.nome))
    expect(pipe[1]).toMatchObject({ nome: 'Currículo', cor: 'verde' })
    expect(pipe[1].candidaturas.map((c: any) => c.id)).toEqual([id])
    expect(pipe.at(-2)).toMatchObject({ nome: 'Teste prático', tipo: 'generica', cor: 'roxo' })
    const perfil = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    expect(perfil.json.movimentacoes.at(-1).motivo).toBe('Coluna "Triagem inicial" excluída')
  })

  it('filtros do pipeline (busca por nome) e lista paginada', async () => {
    const v = await criarVaga(m)
    await candidatar(v, { nome: 'Zélia Buscável' })
    await candidatar(v, { nome: 'Outro Nome' })
    const p = await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1, { q: 'Buscável' })
    expect(p.json.total).toBe(1)
    const l = await GET(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id, por: '1', pagina: '2' })
    expect(l.json.itens).toHaveLength(1)
    expect(l.json.total).toBe(2)
  })

  it('cadastro manual detecta duplicidade e sinaliza candidato já existente em outra vaga', async () => {
    const v1 = await criarVaga(m), v2 = await criarVaga(m)
    await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v1.id, nome: 'Rui Repetido', email: 'repetido@ex.com' })
    const dup = await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v1.id, nome: 'Rui Repetido', email: 'REPETIDO@ex.com' })
    expect(dup.status).toBe(409)
    const outra = await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v2.id, nome: 'Rui Repetido', email: 'repetido@ex.com' })
    expect(outra.status).toBe(201)
    expect(outra.json.candidatoReutilizado).toBe(true)
    expect(outra.json.outrasCandidaturas).toBe(1)
    const perfil = await GET(m, `ats/candidaturas/${outra.json.id}`, m.c.rh1)
    expect(perfil.json.outrasCandidaturas).toHaveLength(1)
  })

  it('importação em lote valida linha a linha, não grava inválidas nem duplica', async () => {
    const v = await criarVaga(m)
    await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id, nome: 'Já Existe', email: 'jaexiste@ex.com' })
    const csv = 'nome;email;telefone;uf\nAna Lima;ana.lima@ex.com;1199;SP\n;semnome@ex.com;;\nBeto;email-ruim;;\nJá Existe;jaexiste@ex.com;;\nCris;ana.lima@ex.com;;\nDora;dora@ex.com;;XX1'
    const sim = await POST(m, 'ats/candidaturas/importar', m.c.rh1, { vagaId: v.id, csv, simular: true })
    expect(sim.json.criadas).toBe(0)
    expect((await GET(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id })).json.total).toBe(1)
    const r = await POST(m, 'ats/candidaturas/importar', m.c.rh1, { vagaId: v.id, csv })
    expect(r.json.criadas).toBe(1) // só Ana: as outras 5 linhas têm problema ou já existem
    expect(r.json.erros).toHaveLength(5)
    expect(r.json.erros.map((e: any) => e.linha)).toEqual([3, 4, 5, 6, 7])
    expect(r.json.erros.find((e: any) => e.linha === 5).mensagem).toMatch(/já se candidatou/i)
    expect((await GET(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id })).json.total).toBe(2)
  })

  it('importação: cabeçalho inválido gera erro compreensível', async () => {
    const v = await criarVaga(m)
    const r = await POST(m, 'ats/candidaturas/importar', m.c.rh1, { vagaId: v.id, csv: 'coluna1,coluna2\na,b' })
    expect(r.json.erros[0].mensagem).toMatch(/cabeçalho/i)
    expect(r.json.criadas).toBe(0)
  })
})

describe('ATS · entrevistas e avaliações', () => {
  it('agenda, reagenda com histórico, registra resultado e notifica participantes', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const ini = new Date(Date.now() + 2 * 86400_000).toISOString()
    const e = await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { tipo: 'gestor', inicio: ini, modalidade: 'online', localOuLink: 'https://meet.exemplo/abc', participantes: ['ger1'] })
    expect(e.status).toBe(201)
    expect((await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: ini, participantes: ['inexistente'] })).status).toBe(400)
    expect((await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: ini, participantes: [] })).status).toBe(400)
    expect((await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'ger1' and tipo = 'entrevista_agendada'")).rowCount).toBe(1)
    // gestor participante enxerga a candidatura e a entrevista; outro gestor não
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.ger1)).status).toBe(200)
    expect((await GET(m, 'ats/entrevistas', m.c.ger1)).json.itens).toHaveLength(1)
    expect((await GET(m, 'ats/entrevistas', m.c.ger2)).json.itens).toHaveLength(0)
    const novo = new Date(Date.now() + 3 * 86400_000).toISOString()
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.ger1, { acao: 'reagendar', inicio: novo, motivo: 'x' })).status).toBe(403) // só quem gerencia
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.rh1, { acao: 'reagendar', inicio: novo })).status).toBe(400) // motivo
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.rh1, { acao: 'reagendar', inicio: novo, motivo: 'Conflito de agenda' })).status).toBe(200)
    const reg = await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.ger1, { acao: 'registrar', status: 'realizada', resultado: 'aprovado', parecer: 'Ótima conversa' })
    expect(reg.status).toBe(200)
    const perfil = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    expect(perfil.json.entrevistas[0]).toMatchObject({ status: 'realizada', resultado: 'aprovado' })
    expect(perfil.json.entrevistas[0].reagendamentos).toHaveLength(1)
    const canc = await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: ini, participantes: ['ger1'] })
    expect((await PATCH(m, `ats/entrevistas/${canc.json.id}`, m.c.rh1, { acao: 'cancelar', motivo: 'Candidato indisponível' })).status).toBe(200)
  })

  it('entrevistador(a) sem acesso ao ATS vê e registra só as entrevistas de que participa', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const ini = new Date(Date.now() + 2 * 86400_000).toISOString()
    const e = await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: ini, participantes: ['col2'] })
    expect(e.status).toBe(201)
    const lista = await GET(m, 'ats/entrevistas', m.c.col2)
    expect(lista.status).toBe(200)
    expect(lista.json.itens.map((x: any) => x.id)).toEqual([e.json.id])
    expect((await GET(m, 'ats/entrevistas', m.c.col1)).json.itens).toHaveLength(0)
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.col1, { acao: 'registrar', status: 'realizada', resultado: 'aprovado' })).status).toBe(404)
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.col2, { acao: 'cancelar', motivo: 'x' })).status).toBe(403)
    expect((await PATCH(m, `ats/entrevistas/${e.json.id}`, m.c.col2, { acao: 'registrar', status: 'realizada', resultado: 'aprovado', parecer: 'Bom' })).status).toBe(200)
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.col1)).status).toBe(403) // perfil do candidato segue restrito ao ATS
  })

  it('alertas: entrevista passada vira "parecer pendente" e notifica sem duplicar', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const passado = new Date(Date.now() - 3600_000).toISOString()
    await POST(m, `ats/candidaturas/${id}/entrevistas`, m.c.rh1, { inicio: passado, participantes: ['ger1'] })
    const pend = await GET(m, 'ats/entrevistas', m.c.rh1, { pendentes: '1' })
    expect(pend.json.itens.some((x: any) => x.parecerPendente)).toBe(true)
    await POST(m, 'ats/alertas/processar', m.c.rh1)
    await POST(m, 'ats/alertas/processar', m.c.rh1)
    expect((await m.pg.query("select 1 from ntf_notificacoes where destinatario_id = 'ger1' and tipo = 'parecer_pendente'")).rowCount).toBe(1)
  })

  it('avaliações: valida notas, cada avaliador vê só a sua, RH compara avaliadores', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const modelos = await GET(m, 'ats/modelos-avaliacao', m.c.rh1)
    const modelo = modelos.json.itens[0]
    expect(modelo.criterios.length).toBeGreaterThan(2)
    const notasBoas = Object.fromEntries(modelo.criterios.map((c: any) => [c.id, 5]))
    expect((await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.rh1, { modeloId: modelo.id, notas: { comunicacao: 9 } })).status).toBe(400)
    expect((await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.rh1, { modeloId: modelo.id, notas: { inexistente: 3 } })).status).toBe(400)
    const a1 = await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.rh1, { modeloId: modelo.id, notas: notasBoas, recomendacao: 'avancar', parecer: 'Excelente' })
    expect(a1.json.media).toBe(5)
    const a2 = await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.ger1, { modeloId: modelo.id, notas: Object.fromEntries(modelo.criterios.map((c: any) => [c.id, 3])), recomendacao: 'manter' })
    expect(a2.status).toBe(201)
    // reenviar substitui a anterior do mesmo avaliador
    expect((await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.ger1, { modeloId: modelo.id, notas: Object.fromEntries(modelo.criterios.map((c: any) => [c.id, 4])) })).status).toBe(200)
    const gestorVe = await GET(m, `ats/candidaturas/${id}`, m.c.ger1)
    expect(gestorVe.json.avaliacoes).toHaveLength(1)
    expect(gestorVe.json.comparativo).toBeUndefined()
    const rhVe = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    expect(rhVe.json.avaliacoes).toHaveLength(2)
    expect(rhVe.json.comparativo.mediaGeral).toBe(4.5)
    expect(rhVe.json.comparativo.divergencia).toBe(1)
    // colaborador sem papel de avaliador não avalia
    expect((await POST(m, `ats/candidaturas/${id}/avaliacoes`, m.c.col1, { notas: { a: 3 } })).status).toBe(403)
    // média aparece no cartão (RH)
    const pipe = await GET(m, `ats/vagas/${v.id}/pipeline`, m.c.rh1)
    expect(pipe.json.etapas[0].candidaturas[0].mediaAvaliacoes).toBe(4.5)
  })
})

describe('ATS · proposta e contratação', () => {
  it('aceite conclui a contratação, atualiza posições e encerra a vaga como "preenchida" com evento no histórico', async () => {
    const v = await criarVaga(m, { qtd: 1 })
    const id = await candidatar(v)
    const outro = await candidatar(v)
    const p = await POST(m, `ats/candidaturas/${id}/propostas`, m.c.rh1, { valor: 8000 })
    expect((await POST(m, `ats/candidaturas/${id}/propostas`, m.c.rh1, { valor: 9000 })).status).toBe(409) // já há uma em aberto
    const pid = p.json.id
    expect((await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'aceitar' })).status).toBe(409) // precisa enviar antes
    expect((await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'enviar' })).status).toBe(200)
    expect((await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'negociar', valor: 8500, nota: 'Contraproposta' })).status).toBe(200)
    const ac = await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'aceitar' })
    expect(ac.status).toBe(200)
    expect(ac.json.contratado).toBe(true)
    expect(ac.json.vagaEncerrada).toBe(true)
    const vaga = (await m.pg.query<any>('select status, posicoes_preenchidas, motivo_encerramento, encerrada_em from rec_vagas where id = $1', [v.id])).rows[0]
    expect(vaga).toMatchObject({ status: 'encerrada', posicoes_preenchidas: 1, motivo_encerramento: 'preenchida' })
    expect(vaga.encerrada_em).toBeTruthy()
    expect((await m.pg.query("select 1 from rec_vaga_eventos where vaga_id = $1 and tipo = 'status' and para_status = 'encerrada'", [v.id])).rowCount).toBe(1)
    const perfil = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    expect(perfil.json.candidatura.status).toBe('contratado')
    expect(perfil.json.propostas[0].status).toBe('aceita')
    expect(perfil.json.propostas[0].historico.map((h: any) => h.tipo)).toEqual(['enviada', 'negociacao', 'aceita'])
    // contratado não volta atrás nem é contratado de novo; vaga cheia não aceita outra contratação
    expect((await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'cancelada', motivo: 'x' })).status).toBe(409)
    expect((await POST(m, `ats/candidaturas/${outro}/mover`, m.c.rh1, { etapaId: etapa(v, 'contratado') })).status).toBe(409)
  })

  it('mover para a etapa "Contratado" também conclui; vaga com 2 posições segue publicada após a 1ª', async () => {
    const v = await criarVaga(m, { qtd: 2 })
    const a = await candidatar(v), b = await candidatar(v)
    const r = await POST(m, `ats/candidaturas/${a}/mover`, m.c.rh1, { etapaId: etapa(v, 'contratado') })
    expect(r.json).toMatchObject({ status: 'contratado', vagaEncerrada: false })
    expect((await m.pg.query<any>('select status, posicoes_preenchidas from rec_vagas where id = $1', [v.id])).rows[0]).toMatchObject({ status: 'publicada', posicoes_preenchidas: 1 })
    const r2 = await POST(m, `ats/candidaturas/${b}/mover`, m.c.rh1, { etapaId: etapa(v, 'contratado') })
    expect(r2.json.vagaEncerrada).toBe(true)
  })

  it('recusa registra o motivo e mantém a vaga intacta', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const pid = (await POST(m, `ats/candidaturas/${id}/propostas`, m.c.rh1, { valor: 6000 })).json.id
    await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'enviar' })
    expect((await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'recusar', motivo: 'Salário abaixo do esperado' })).status).toBe(200)
    expect((await PATCH(m, `ats/propostas/${pid}`, m.c.rh1, { acao: 'aceitar' })).status).toBe(409)
    expect((await m.pg.query<any>('select posicoes_preenchidas from rec_vagas where id = $1', [v.id])).rows[0].posicoes_preenchidas).toBe(0)
    expect((await GET(m, `ats/candidaturas/${id}`, m.c.rh1)).json.propostas[0].motivoRecusa).toBe('Salário abaixo do esperado')
  })
})

describe('ATS · banco de talentos, comunicação, LGPD, exportação', () => {
  it('banco de talentos exige autorização específica e registra prazo de retenção e contatos', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const cid = (await GET(m, `ats/candidaturas/${id}`, m.c.rh1)).json.candidato.id
    const sem = await POST(m, 'ats/talentos', m.c.rh1, { candidatoId: cid })
    expect(sem.status).toBe(400)
    expect(sem.json.campos.confirmaAutorizacao).toBeTruthy()
    expect((await POST(m, 'ats/talentos', m.c.rh1, { candidatoId: cid, confirmaAutorizacao: true })).status).toBe(400) // falta dizer como autorizou
    const ok1 = await POST(m, 'ats/talentos', m.c.rh1, { candidatoId: cid, confirmaAutorizacao: true, comoAutorizou: 'Resposta por e-mail em 10/10', tags: ['direito civil'], areas: ['Jurídico'], retencaoMeses: 6 })
    expect(ok1.status).toBe(201)
    expect((await m.pg.query("select 1 from rec_consentimentos where candidato_id = $1 and finalidade = 'banco_talentos' and concedido", [cid])).rowCount).toBe(1)
    const busca = await GET(m, 'ats/talentos', m.c.rh1, { tag: 'direito civil' })
    expect(busca.json.total).toBe(1)
    expect(busca.json.itens[0].retencaoVencida).toBe(false)
    expect((await POST(m, `ats/talentos/${cid}/contatos`, m.c.rh1, { canal: 'e-mail', nota: 'Convite enviado' })).status).toBe(200)
    expect((await GET(m, 'ats/talentos', m.c.rh1)).json.itens[0].historicoContato).toHaveLength(1)
    expect((await GET(m, 'ats/talentos', m.c.ger1)).status).toBe(403)
    expect((await DEL(m, `ats/talentos/${cid}`, m.c.rh1)).status).toBe(200)
    expect((await GET(m, 'ats/talentos', m.c.rh1)).json.total).toBe(0)
    expect((await m.pg.query("select revogado_em from rec_consentimentos where candidato_id = $1 and finalidade = 'banco_talentos'", [cid])).rows[0].revogado_em).toBeTruthy()
  })

  it('comunicação: sem provedor de e-mail fica "nao_configurado" e entra na lista de pendências', async () => {
    delete process.env.RESEND_API_KEY
    const v = await criarVaga(m)
    const id = await candidatar(v)
    const t = await GET(m, 'ats/templates', m.c.rh1)
    expect(t.json.itens.map((x: any) => x.chave)).toContain('convite_entrevista')
    expect((await PUT(m, 'ats/templates/acompanhamento', m.c.rh1, { assunto: 'Oi {{nome}}', corpo: 'Seguimos analisando "{{vaga}}".' })).status).toBe(200)
    const r = await POST(m, `ats/candidaturas/${id}/comunicacoes`, m.c.rh1, { templateChave: 'acompanhamento' })
    expect(r.status).toBe(201)
    expect(r.json.status).toBe('nao_configurado')
    const lista = await GET(m, 'ats/comunicacoes', m.c.rh1, { status: 'nao_configurado' })
    expect(lista.json.itens.some((x: any) => x.id === r.json.id)).toBe(true)
    expect(lista.json.pendentes).toBeGreaterThan(0)
    const salvo = (await m.pg.query<any>('select assunto, corpo from rec_comunicacoes where id = $1', [r.json.id])).rows[0]
    expect(salvo.assunto).toMatch(/^Oi Pessoa/)
    expect(salvo.corpo).toContain('Advogado(a) Pleno')
    expect((await POST(m, `ats/comunicacoes/${r.json.id}/enviar`, m.c.rh1)).json.status).toBe('nao_configurado')
    expect((await POST(m, `ats/candidaturas/${id}/comunicacoes`, m.c.ger1, { templateChave: 'acompanhamento' })).status).toBe(403)
  })

  it('anonimização apaga dados pessoais e currículo, mantém a estatística; só RH/admin; bloqueia se houver processo ativo', async () => {
    const v = await criarVaga(m)
    const id = await candidatar(v, { nome: 'Pessoa Anonimizável', email: 'anon@ex.com', telefone: '11 9', curriculo: corpoCandidatura().curriculo })
    await POST(m, `ats/candidaturas/${id}/notas`, m.c.rh1, { texto: 'Informação pessoal na nota', visibilidade: 'banca' })
    const perfil = await GET(m, `ats/candidaturas/${id}`, m.c.rh1)
    const cid = perfil.json.candidato.id
    expect((await POST(m, `ats/candidatos/${cid}/anonimizar`, m.c.rec1, { confirmar: true })).status).toBe(403)
    expect((await POST(m, `ats/candidatos/${cid}/anonimizar`, m.c.rh1, { confirmar: true })).status).toBe(409) // ainda ativa
    await POST(m, `ats/candidaturas/${id}/mover`, m.c.rh1, { status: 'cancelada', motivo: 'Pedido do titular' })
    expect((await POST(m, `ats/candidatos/${cid}/anonimizar`, m.c.rh1, {})).status).toBe(400)
    expect((await POST(m, `ats/candidatos/${cid}/anonimizar`, m.c.rh1, { confirmar: true })).status).toBe(200)
    const k = (await m.pg.query<any>('select * from rec_candidatos where id = $1', [cid])).rows[0]
    expect(k.nome).toBe('Candidato anonimizado')
    expect(k.email).toMatch(/invalid$/)
    expect(k.telefone).toBeNull()
    expect((await m.pg.query('select 1 from arq_arquivos where dono_id = $1', [id])).rowCount).toBe(0)
    const c = (await m.pg.query<any>('select status, curriculo_arquivo_id from rec_candidaturas where id = $1', [id])).rows[0]
    expect(c).toMatchObject({ status: 'cancelada', curriculo_arquivo_id: null })
    expect((await m.pg.query("select 1 from rec_candidatura_notas where candidatura_id = $1 and texto like '%pessoal%'", [id])).rowCount).toBe(0)
    // o mesmo e-mail pode voltar a se candidatar (novo cadastro)
    expect((await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id, nome: 'Nova Pessoa', email: 'anon@ex.com' })).status).toBe(201)
  })

  it('exportação CSV: exige permissão, neutraliza fórmulas e omite pretensão sem permissão salarial', async () => {
    const v = await criarVaga(m, { titulo: 'Vaga Export' })
    await candidatar(v, { nome: '=HYPERLINK("http://x")', pretensao: 1234 })
    expect((await chamar(m, 'GET', 'ats/exportar', { cookie: m.c.ger1, query: { vagaId: v.id } })).status).toBe(403)
    const rh = await chamar(m, 'GET', 'ats/exportar', { cookie: m.c.rh1, query: { vagaId: v.id } })
    const csvRh = rh.binario!.dados.toString('utf8')
    expect(csvRh).toContain("'=HYPERLINK")
    expect(csvRh).toContain('Pretensão')
    const rec = await chamar(m, 'GET', 'ats/exportar', { cookie: m.c.rec1, query: { vagaId: v.id } })
    expect(rec.binario!.dados.toString('utf8')).not.toContain('Pretensão')
    expect(rec.binario!.mime).toContain('text/csv')
  })

  it('arquivo inválido no cadastro manual é recusado', async () => {
    const v = await criarVaga(m)
    const r = await POST(m, 'ats/candidaturas', m.c.rh1, { vagaId: v.id, nome: 'Fulano Arq', email: 'arq@ex.com', curriculo: { nome: 'a.exe', base64: Buffer.from('MZ-programa-nao-permitido').toString('base64') } })
    expect(r.status).toBe(400)
    expect((await m.pg.query("select 1 from rec_candidatos where email = 'arq@ex.com'")).rowCount).toBe(0)
  })
})
