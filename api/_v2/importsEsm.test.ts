/* Regressão: as funções da Vercel rodam em ESM puro (Node), onde import relativo sem ".js" quebra
   com ERR_MODULE_NOT_FOUND e derruba /api/v2/* inteiro (500). O Vite/Vitest toleram a falta, então só este teste pega. */
import { describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'

const raiz = join(__dirname, '..', '..')
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivos(p)
    return /\.ts$/.test(n) && !/\.test\.ts$/.test(n) && !p.includes(join('api', '_v2', 'teste')) ? [p] : []
  })
}

describe('imports relativos do servidor (ESM)', () => {
  it('api/ e src/domain/ usam sempre a extensão .js', () => {
    const ruins: string[] = []
    for (const f of [...arquivos(join(raiz, 'api')), ...arquivos(join(raiz, 'src', 'domain'))]) {
      const txt = readFileSync(f, 'utf8')
      for (const m of txt.matchAll(/(?:from|import\()\s*['"](\.{1,2}\/[^'"]*)['"]/g)) {
        if (!/\.(js|json)$/.test(m[1])) ruins.push(`${f.replace(raiz, '')}: ${m[1]}`)
      }
    }
    expect(ruins).toEqual([])
  })
})
