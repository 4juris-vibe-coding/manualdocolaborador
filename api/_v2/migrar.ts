/* ============================================================
   API v2 · migração automática do schema v2
   O SQL (db/v2/*.sql) é aditivo e idempotente. Na primeira requisição de
   cada instância comparamos o hash do SQL embutido com o registrado em
   app_meta('schema_v2'); se mudou, aplicamos tudo sob um lock de
   aconselhamento (só uma instância migra por vez) e gravamos o novo hash.
   ============================================================ */
import { createHash } from 'node:crypto'
import { SCHEMA_V2 } from './schemaSql.js'
import type { Db, Executor } from './nucleo.js'

export const hashSchemaV2 = () => createHash('sha256').update(SCHEMA_V2.map((a) => a.nome + '\n' + a.sql).join('\n--\n')).digest('hex')

/** Roda numa transação com lock de transação (seguro com pool: o lock solta no commit/rollback). */
export async function migrarSchemaV2(db: Db): Promise<{ aplicado: boolean; hash: string }> {
  const hash = hashSchemaV2()
  const atual = async (ex: Executor) => (await ex.query("select valor->>'hash' as h from app_meta where chave = 'schema_v2'")).rows[0]?.h
  if ((await atual(db)) === hash) return { aplicado: false, hash }
  return db.tx(async (t) => {
    await t.query('select pg_advisory_xact_lock(727272)')
    if ((await atual(t)) === hash) return { aplicado: false, hash } // outra instância já migrou enquanto esperávamos
    for (const a of SCHEMA_V2) await t.query(a.sql)
    await t.query("insert into app_meta (chave, valor) values ('schema_v2', $1::jsonb) on conflict (chave) do update set valor = excluded.valor", [JSON.stringify({ hash, em: new Date().toISOString() })])
    return { aplicado: true, hash }
  })
}

let pronto: Promise<void> | undefined
/** Garante o schema uma vez por instância; se falhar, tenta de novo na próxima requisição. */
export function garantirSchemaV2(db: Db): Promise<void> {
  pronto ??= migrarSchemaV2(db).then(() => undefined).catch((e) => { pronto = undefined; throw e })
  return pronto
}
