import { existsSync, readFileSync } from 'node:fs'

/** Carrega .env.local / .env para process.env (sem sobrescrever o que já existe). */
export function carregaEnv(raiz = process.cwd()) {
  for (const f of ['.env.local', '.env']) {
    const caminho = `${raiz}/${f}`
    if (!existsSync(caminho)) continue
    for (const linha of readFileSync(caminho, 'utf8').split(/\r?\n/)) {
      const m = linha.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
      if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^(['"])(.*)\1$/, '$2')
    }
  }
}
