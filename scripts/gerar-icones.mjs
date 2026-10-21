// Gera src/components/icons.ts apenas com os ícones lucide referenciados no código.
// Uso: node scripts/gerar-icones.mjs  (rode de novo ao usar um ícone novo por nome)
import { readFileSync, writeFileSync, readdirSync, statSync } from 'node:fs'
import { join } from 'node:path'
import * as lucide from 'lucide-react'

const exportados = new Set(Object.keys(lucide).filter((k) => /^[A-Z]/.test(k) && !k.endsWith('Icon') && !k.startsWith('Lucide')))
const arquivos = []
const varrer = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); statSync(p).isDirectory() ? varrer(p) : /\.(ts|tsx)$/.test(f) && !p.endsWith('icons.ts') && arquivos.push(p) })
varrer('src')

const usados = new Set()
for (const f of arquivos) {
  const txt = readFileSync(f, 'utf8')
  for (const m of txt.matchAll(/['"`]([A-Z][A-Za-z0-9]*)['"`]/g)) if (exportados.has(m[1])) usados.add(m[1])
}
usados.add('Circle')
const nomes = [...usados].sort()
writeFileSync('src/components/icons.ts',
`/* Gerado por scripts/gerar-icones.mjs — não edite à mão.
   Registro explícito evita empacotar os ~1.500 ícones do lucide. */
import {
${nomes.map((n) => `  ${n},`).join('\n')}
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export const ICONES: Record<string, LucideIcon> = {
${nomes.map((n) => `  ${n},`).join('\n')}
}
`)
console.log(`${nomes.length} ícones registrados`)
