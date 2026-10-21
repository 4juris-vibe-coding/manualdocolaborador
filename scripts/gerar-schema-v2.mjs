// Embute db/v2/*.sql em api/_v2/schemaSql.ts, para a função serverless aplicar o schema sozinha
// (arquivos .sql não são empacotados com a função). Rode: node scripts/gerar-schema-v2.mjs
// O teste api/_v2/migrar.test.ts falha se este arquivo ficar desatualizado.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs'

const arquivos = readdirSync('db/v2').filter((n) => n.endsWith('.sql')).sort()
const itens = arquivos.map((n) => ({ nome: n, sql: readFileSync(`db/v2/${n}`, 'utf8').replace(/\r\n/g, '\n') }))
writeFileSync('api/_v2/schemaSql.ts',
`/* GERADO por scripts/gerar-schema-v2.mjs a partir de db/v2/*.sql — não edite à mão. */
export const SCHEMA_V2: { nome: string; sql: string }[] = ${JSON.stringify(itens, null, 2)}
`)
console.log(`schemaSql.ts: ${itens.length} arquivos`)
