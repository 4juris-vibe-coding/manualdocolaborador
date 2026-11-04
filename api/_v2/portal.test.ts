/* Portal de carreiras: conteúdo institucional editável pelo RH, filtros, vagas encerradas
   e linha do tempo do candidato (com nome PÚBLICO da etapa; o interno nunca sai). */
import { describe, it, expect, beforeAll } from 'vitest'
import { mundoPadrao, chamar, PUT, GET, POST } from './teste/harness'
import { criarVaga, corpoCandidatura } from './teste/ats-fixtures'
import { validarPortal } from '../../src/domain/v2/portal'
import { nomePublicoEtapa } from '../../src/domain/v2/ats'

let m: Awaited<ReturnType<typeof mundoPadrao>>
beforeAll(async () => { m = await mundoPadrao() }, 60_000)
let ipN = 0
const pub = (metodo: string, caminho: string, corpo?: unknown) => chamar(m, metodo, caminho, { corpo, ip: `9.8.7.${++ipN}` })

const CONTEUDO = {
  titulo: 'Construa sua carreira na 4JURIS', apresentacao: 'Tecnologia e direito juntos.',
  quemSomos: 'Somos a 4JURIS.', missao: 'Simplificar o jurídico.', visao: 'Ser referência.', valores: [{ nome: 'Transparência', descricao: 'Falamos claro.' }],
  cultura: 'Colaborativa.', processoSeletivo: [{ titulo: 'Inscrição' }, { titulo: 'Entrevista' }],
  redes: [{ rede: 'instagram', url: 'https://instagram.com/4juris' }, { rede: 'linkedin', url: 'https://linkedin.com/company/4juris' }],
}

describe('conteúdo institucional do portal', () => {
  it('RH configura e o público vê; quem não tem permissão não altera', async () => {
    expect((await PUT(m, 'recrutamento/config/portal', m.c.col1, { dados: CONTEUDO })).status).toBe(403)
    const r = await PUT(m, 'recrutamento/config/portal', m.c.rh1, { dados: CONTEUDO })
    expect(r.status).toBe(200)
    const p = await pub('GET', 'publico/portal')
    expect(p.json.missao).toBe('Simplificar o jurídico.')
    expect(p.json.redes).toHaveLength(2)
    expect((await GET(m, 'recrutamento/config', m.c.rh1)).json.portal.titulo).toBe(CONTEUDO.titulo)
    expect((await pub('GET', 'publico/vagas')).json.portal.quemSomos).toBe('Somos a 4JURIS.')
  })

  it('recusa links sem https, javascript: e conteúdo sem título', async () => {
    expect((await PUT(m, 'recrutamento/config/portal', m.c.rh1, { dados: { ...CONTEUDO, redes: [{ rede: 'site', url: 'javascript:alert(1)' }] } })).status).toBe(400)
    expect((await PUT(m, 'recrutamento/config/portal', m.c.rh1, { dados: { ...CONTEUDO, redes: [{ rede: 'site', url: 'http://inseguro.com' }] } })).status).toBe(400)
    expect(() => validarPortal({ apresentacao: 'x' })).toThrow(/título/)
  })
})

describe('vagas no portal', () => {
  it('filtra por nível e contratação, e lista encerradas sem oferecê-las como oportunidade', async () => {
    const a = await criarVaga(m, { titulo: 'Vaga Sênior Filtro' })
    await m.pg.query("update rec_vagas set senioridade = 'Sênior', regime_contratacao = 'pj' where id = $1", [a.id])
    await criarVaga(m, { titulo: 'Vaga Encerrada Recente', status: 'encerrada' })
    const r = await pub('GET', 'publico/vagas?senioridade=Sênior')
    expect(r.json.itens.map((i: any) => i.titulo)).toEqual(['Vaga Sênior Filtro'])
    expect(r.json.filtros.senioridades).toContain('Sênior')
    const todas = await pub('GET', 'publico/vagas')
    expect(todas.json.itens.map((i: any) => i.titulo)).not.toContain('Vaga Encerrada Recente')
    expect(todas.json.encerradas.map((i: any) => i.titulo)).toContain('Vaga Encerrada Recente')
    expect(JSON.stringify(todas.json.encerradas)).not.toMatch(/SEGREDO-RH|slug/)
  })
})

describe('linha do tempo do candidato', () => {
  it('mostra as etapas da vaga na ordem, com a atual, sem nomes internos; reflete a movimentação do RH', async () => {
    const v = await criarVaga(m)
    const token = (await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())).json.codigoAcompanhamento
    const a = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(a.json.linhaDoTempo.length).toBe(v.etapas.length - 1) // "contratado" só aparece se contratado
    expect(a.json.linhaDoTempo[0]).toMatchObject({ nome: 'Inscrição recebida', situacao: 'atual' })
    for (const e of v.etapas) if (e.nome !== nomePublicoEtapa(e.tipo) && e.tipo !== 'contratado') expect(JSON.stringify(a.json)).not.toContain(e.nome)

    // RH define um nome público para a 3ª etapa e move o candidato até ela.
    const alvo = v.etapas[2]
    await m.pg.query("update rec_vaga_etapas set nome_publico = 'Conversa com o time' where id = $1", [alvo.id])
    const cand = (await m.pg.query<any>('select id from rec_candidaturas where vaga_id = $1', [v.id])).rows[0]
    const mv = await POST(m, `ats/candidaturas/${cand.id}/mover`, m.c.rh1, { etapaId: alvo.id, deEtapaId: v.etapas[0].id })
    expect(mv.status).toBe(200)
    const b = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(b.json.etapaAtual).toBe('Conversa com o time')
    expect(b.json.linhaDoTempo.slice(0, 3).map((x: any) => x.situacao)).toEqual(['concluida', 'concluida', 'atual'])
    expect(b.json.linhaDoTempo[2].desde).toBeTruthy()
    expect(b.json.linhaDoTempo[3].situacao).toBe('futura')
  })

  it('reprovado: etapa atual marcada como encerrada e as seguintes como não realizadas, sem motivo interno', async () => {
    const v = await criarVaga(m)
    const token = (await pub('POST', `publico/vagas/${v.slug}/candidaturas`, corpoCandidatura())).json.codigoAcompanhamento
    const cand = (await m.pg.query<any>('select id from rec_candidaturas where vaga_id = $1', [v.id])).rows[0]
    await POST(m, `ats/candidaturas/${cand.id}/mover`, m.c.rh1, { status: 'reprovado', motivo: 'MOTIVO-INTERNO-XYZ', deEtapaId: v.etapas[0].id })
    const r = await pub('POST', 'publico/candidaturas/acompanhar', { token })
    expect(r.json.encerrada).toBe(true)
    expect(r.json.linhaDoTempo[0].situacao).toBe('encerrada')
    expect(r.json.linhaDoTempo[1].situacao).toBe('nao_realizada')
    expect(JSON.stringify(r.json)).not.toContain('MOTIVO-INTERNO-XYZ')
  })
})
