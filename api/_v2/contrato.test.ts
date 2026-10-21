/* Contrato frontend ↔ API v2 e fumaça de todas as rotas GET.
   - Toda chamada `api.*(...)` / `useApi(...)` do frontend precisa casar com uma rota registrada (método + padrão).
   - Nenhuma rota GET pode responder 500 com o banco vazio ou com ids inexistentes, para nenhum papel.
   - caminhoV2 aceita tanto a URL original quanto a reescrita do vercel.json (?__caminho=...). */
import { beforeAll, describe, expect, it } from 'vitest'
import { readdirSync, readFileSync, statSync } from 'node:fs'
import { join } from 'node:path'
import { ROTAS } from './rotas'
import { caminhoV2 } from './nucleo'
import { GET, mundoPadrao } from './teste/harness'

const raiz = join(__dirname, '..', '..')
function arquivos(dir: string): string[] {
  return readdirSync(dir).flatMap((n) => {
    const p = join(dir, n)
    if (statSync(p).isDirectory()) return arquivos(p)
    return /\.tsx?$/.test(n) && !/\.test\.tsx?$/.test(n) ? [p] : []
  })
}

const METODO: Record<string, string> = { get: 'GET', post: 'POST', put: 'PUT', patch: 'PATCH', del: 'DELETE', url: 'GET' }

/** Troca cada `${...}` (com chaves aninhadas) por um marcador. */
function marcar(lit: string): string {
  let out = ''
  for (let i = 0; i < lit.length; i++) {
    if (lit[i] === '$' && lit[i + 1] === '{') {
      let n = 0, j = i + 1
      for (; j < lit.length; j++) { if (lit[j] === '{') n++; else if (lit[j] === '}' && --n === 0) break }
      out += '§'
      i = j
    } else out += lit[i]
  }
  return out
}

/** Converte o literal do frontend num caminho com `:p` no lugar das interpolações de segmento. */
function normalizar(lit: string): string[] | null {
  if (lit.endsWith('/')) return null // concatenação ('publico/vagas/' + slug ...): conferida à parte
  const semQuery = marcar(lit).split('?')[0]
    .replace(/(^|\/)§(?=\/|$)/g, '$1:p') // /${id} → /:p
    .replace(/§/g, '')                   // vagas${consulta} → vagas (query string)
  return semQuery.split('/').filter(Boolean)
}

function casa(metodo: string, partes: string[]) {
  return ROTAS.some((r) => r.metodo === metodo && r.partes.length === partes.length
    && r.partes.every((p, i) => p.startsWith(':') || partes[i] === ':p' || p === partes[i]))
}

describe('caminhoV2', () => {
  it('usa o caminho da URL quando ele chega intacto', () => {
    expect(caminhoV2(new URL('http://x/api/v2/recrutamento/opcoes?a=1'))).toEqual(['recrutamento', 'opcoes'])
    expect(caminhoV2(new URL('http://x/api/v2/cargos/a%20b/ficha'))).toEqual(['cargos', 'a b', 'ficha'])
  })
  it('usa __caminho quando a Vercel entrega a URL reescrita', () => {
    expect(caminhoV2(new URL('http://x/api/v2?__caminho=recrutamento/opcoes&a=1'))).toEqual(['recrutamento', 'opcoes'])
    expect(caminhoV2(new URL('http://x/api/v2?__caminho=eu'))).toEqual(['eu'])
    expect(caminhoV2(new URL('http://x/api/v2'))).toEqual([])
  })
})

describe('contrato frontend ↔ API v2', () => {
  it('toda chamada do frontend tem rota correspondente', () => {
    const re = /(?:\bapi\.(get|post|put|patch|del|url)\s*(?:<[^(]*?>)?\(|\buseApi\s*(?:<[^\n]*?>)?\(\s*(?:MODO_API\s*\?\s*)?)\s*([`'])((?:(?!\2)[^\n])*)\2/g
    const faltando: string[] = []
    let total = 0
    for (const f of arquivos(join(raiz, 'src'))) {
      const txt = readFileSync(f, 'utf8')
      if (!txt.includes('api.') && !txt.includes('useApi')) continue
      for (const m of txt.matchAll(re)) {
        const partes = normalizar(m[3])
        if (!partes) continue
        total++
        const metodo = METODO[m[1] ?? 'get']
        if (!casa(metodo, partes)) faltando.push(`${f.replace(raiz, '')}: ${metodo} ${m[3]}`)
      }
    }
    expect(total).toBeGreaterThan(80) // garante que a varredura está pegando as chamadas
    expect(faltando).toEqual([])
  })
})

describe('fumaça: nenhuma rota GET responde 500', () => {
  let m: Awaited<ReturnType<typeof mundoPadrao>>
  beforeAll(async () => { m = await mundoPadrao() }, 120_000)

  for (const papel of ['admin1', 'rh1', 'rec1', 'ger1', 'col1', 'dir1']) {
    it(`papel ${papel}`, async () => {
      const erros: string[] = []
      for (const r of ROTAS.filter((x) => x.metodo === 'GET')) {
        const caminho = r.partes.map((p) => (p.startsWith(':') ? 'inexistente' : p)).join('/')
        const out = await GET(m, caminho, r.publica ? undefined : m.c[papel])
        if (out.status >= 500) erros.push(`${caminho} → ${out.status} ${JSON.stringify(out.corpo)}`)
      }
      expect(erros).toEqual([])
    }, 120_000)
  }
})
