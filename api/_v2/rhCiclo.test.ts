/* Rotinas do RH: encerramento agendado aplicado no dia (servidor), bloqueio no login antes da rotina, alertas notificados uma vez. */
import { describe, expect, it, beforeEach } from 'vitest'
import { criarMundo, semear, ORG_BASE, chamar, type Mundo } from './teste/harness'
import { aplicarEncerramentosAgendados, notificarAlertasRH, hojeBR } from './modulos/rhCiclo'

let m: Mundo
beforeEach(async () => { m = await criarMundo(); await semear(m, ORG_BASE) })
const dados = async (id: string) => (await m.pg.query<any>('select dados from app_colaboradores where id = $1', [id])).rows[0].dados
const agendar = (id: string, data: string, extra: Record<string, unknown> = {}) => m.pg.query(
  `update app_colaboradores set dados = dados || jsonb_build_object('dataEntrada','2026-01-05','encerramentoAgendado', $2::jsonb) where id = $1`,
  [id, JSON.stringify({ data, motivoId: 'm1', iniciativa: 'empresa', porId: 'rh1', registradoEm: '2026-11-01T10:00:00Z', ...extra })])
const db = () => m.db

describe('encerramento agendado', () => {
  it('não aplica antes da data; aplica no dia com data efetiva, histórico, liderança removida e checklist', async () => {
    const hoje = hojeBR()
    await m.pg.query(`insert into app_checklists (ord, id, dados) values (0, 'ck-enc', '{"id":"ck-enc","nome":"Encerramento","tipo":"encerramento","itens":[{"id":"i1","titulo":"Devolver equipamento","responsavel":"rh"}]}'::jsonb) on conflict do nothing`)
    await agendar('ger1', '2099-01-01')
    expect((await aplicarEncerramentosAgendados(db())).aplicados).toEqual([])
    expect((await dados('ger1')).status).not.toBe('encerrado')

    await agendar('ger1', hoje, { iniciarChecklist: true })
    const r = await aplicarEncerramentosAgendados(db())
    expect(r.aplicados).toEqual(['ger1'])
    const d = await dados('ger1')
    expect(d.status).toBe('encerrado')
    expect(d.encerramento).toMatchObject({ data: hoje, iniciativa: 'empresa', porId: 'rh1' })
    expect(d.encerramentoAgendado).toBeUndefined()
    expect(d.vinculos.at(-1).fim).toBe(hoje)
    expect(d.movimentacoes.at(-1).tipo).toBe('encerramento')
    const setor = (await m.pg.query<any>("select dados from app_setores where id = 's1'")).rows[0].dados
    expect(setor.gestorId).toBeNull()
    expect(setor.liderancaIds).not.toContain('ger1')
    const procs = (await m.pg.query<any>("select dados from app_processos where dados->>'colaboradorId' = 'ger1'")).rows.map((x) => x.dados)
    expect(procs).toHaveLength(1)
    expect(procs[0]).toMatchObject({ tipo: 'encerramento', referencia: hoje })
    // Idempotente
    expect((await aplicarEncerramentosAgendados(db())).aplicados).toEqual([])
  })

  it('a API v2 recusa a sessão de quem tem agendamento vencido, mesmo antes da rotina', async () => {
    await agendar('col1', hojeBR())
    const { cookieDe } = await import('./teste/harness')
    const ck = await cookieDe(m, 'col1')
    expect((await chamar(m, 'GET', 'eu', { cookie: ck })).status).toBe(401)
  })
})

describe('alertas do RH', () => {
  it('notifica RH e administração uma única vez por alerta', async () => {
    await m.pg.query(`update app_colaboradores set dados = dados || '{"status":"encerrado","encerramento":{"data":"2026-10-01","motivoId":"m1"}}'::jsonb where id = 'col2'`)
    const a = await notificarAlertasRH(db())
    expect(a.notificados).toBeGreaterThan(0)
    const n1 = (await m.pg.query<any>("select count(*)::int n from ntf_notificacoes where chave like 'rh-alerta:semclass:col2%'")).rows[0].n
    expect(n1).toBeGreaterThanOrEqual(2) // rh1 e admin1
    await notificarAlertasRH(db())
    expect((await m.pg.query<any>("select count(*)::int n from ntf_notificacoes where chave like 'rh-alerta:semclass:col2%'")).rows[0].n).toBe(n1)
  })
})

describe('pesquisa de desligamento', () => {
  const criar = async (modelo: string | null, status = 'aberta') => (await m.pg.query<{ id: string }>(
    "insert into pq_pesquisas (titulo, modelo_chave, status, modo, inicio, fim, versao_atual) values ('Saída', $1, $2, 'identificada', current_date, current_date + 120, 1) returning id", [modelo, status])).rows[0].id
  it('RH convida a pessoa que sai; não duplica; recusa pesquisa de outro modelo e quem não é RH', async () => {
    const { cookieDe, POST } = await import('./teste/harness')
    const rh = await cookieDe(m, 'rh1'), col = await cookieDe(m, 'col2')
    const id = await criar('desligamento')
    const r = await POST(m, `pesquisas/${id}/convidar-pessoa`, rh, { colaboradorId: 'col1' })
    expect(r.status).toBe(200)
    expect(r.json.convitesCriados).toBe(1)
    expect(r.json.envio.email.nao_configurado + r.json.envio.email.enviada + r.json.envio.email.falhou).toBe(1)
    expect((await POST(m, `pesquisas/${id}/convidar-pessoa`, rh, { colaboradorId: 'col1' })).status).toBe(409)
    expect((await POST(m, `pesquisas/${await criar('clima')}/convidar-pessoa`, rh, { colaboradorId: 'col1' })).status).toBe(400)
    expect((await POST(m, `pesquisas/${id}/convidar-pessoa`, col, { colaboradorId: 'col1' })).status).toBe(403)
  })
  it('no encerramento agendado, o convite sai no dia, junto com a aplicação', async () => {
    const id = await criar('desligamento')
    await agendar('col1', hojeBR(), { pesquisaDesligamentoId: id })
    await aplicarEncerramentosAgendados(db())
    expect((await m.pg.query<any>("select count(*)::int n from pq_convites where pesquisa_id = $1 and colaborador_id = 'col1'", [id])).rows[0].n).toBe(1)
  })
})
