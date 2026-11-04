/* Migração 97: corrige checklists duplicados (sem apagar) e grava a data efetiva do encerramento. */
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { criarMundo } from './teste/harness'

describe('migração 97 · ciclo de vida', () => {
  it('cancela o checklist duplicado mantendo o de maior progresso e preenche a referência; é idempotente', async () => {
    const m = await criarMundo()
    for (const t of ['app_processos', 'app_colaboradores']) await m.pg.query(`create table if not exists ${t} (ord int, id text primary key, dados jsonb, atualizado_em timestamptz)`)
    await m.pg.query(`insert into app_colaboradores values (1,'c1','{"status":"encerrado","encerramento":{"data":"2026-10-19","motivoId":"m"}}',now())`)
    await m.pg.query(`insert into app_processos values
      (1,'pA','{"colaboradorId":"c1","tipo":"encerramento","iniciadoEm":"2026-11-04","itens":[{"id":"i","feito":false}]}',now()),
      (2,'pB','{"colaboradorId":"c1","tipo":"encerramento","iniciadoEm":"2026-11-04","itens":[{"id":"i","feito":true}]}',now())`)
    const sql = readFileSync('db/v2/97-ciclo-vida.sql', 'utf8')
    await m.pg.query(sql)
    await m.pg.query(sql)
    const r = Object.fromEntries((await m.pg.query<{ id: string; dados: any }>('select id, dados from app_processos')).rows.map((x) => [x.id, x.dados]))
    expect(r.pB.canceladoEm).toBeUndefined()
    expect(r.pA.canceladoEm).toBeTruthy()
    expect(r.pA.motivoCancelamento).toMatch(/Duplicidade/)
    expect(r.pB.referencia).toBe('2026-10-19')
    expect((await m.pg.query('select count(*)::int n from app_processos')).rows[0]).toEqual({ n: 2 })
  })
})
