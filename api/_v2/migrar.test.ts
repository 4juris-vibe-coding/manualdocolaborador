import { describe, it, expect } from 'vitest'
import { readdirSync, readFileSync } from 'node:fs'
import { PGlite } from '@electric-sql/pglite'
import { SCHEMA_V2 } from './schemaSql'
import { migrarSchemaV2 } from './migrar'
import { dbPglite } from './teste/harness'

describe('migração automática do schema v2', () => {
  it('schemaSql.ts está em sincronia com db/v2 (rode: node scripts/gerar-schema-v2.mjs)', () => {
    const arquivos = readdirSync('db/v2').filter((n) => n.endsWith('.sql')).sort()
    expect(SCHEMA_V2.map((a) => a.nome)).toEqual(arquivos)
    for (const a of SCHEMA_V2) expect(a.sql).toBe(readFileSync(`db/v2/${a.nome}`, 'utf8').replace(/\r\n/g, '\n'))
  })
  it('cria as tabelas num banco que só tem o schema legado, e a segunda vez não reaplica', async () => {
    const pg = new PGlite()
    await pg.exec(readFileSync('db/schema.sql', 'utf8'))
    const db = dbPglite(pg)
    const r1 = await migrarSchemaV2(db)
    expect(r1.aplicado).toBe(true)
    expect((await pg.query("select to_regclass('public.rec_vagas') as t")).rows[0]).toMatchObject({ t: 'rec_vagas' })
    const r2 = await migrarSchemaV2(db)
    expect(r2.aplicado).toBe(false)
  })
})
