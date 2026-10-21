/* Rotas: /api/v2/* — módulos de recrutamento, pesquisas, cargos, organograma e analytics. Ver docs/V2.md
   Na Vercel, o vercel.json reescreve /api/v2/<caminho> para esta função com ?__caminho=<caminho>
   (catch-all em arquivo, [...x].ts, só casava um segmento e devolvia 404 para o resto). */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { db as pool, lerSessao } from '../_lib.js'
import { caminhoV2, dbDoPool, despachar, type Req } from '../_v2/nucleo.js'
import { ROTAS } from '../_v2/rotas.js'
import { garantirSchemaV2 } from '../_v2/migrar.js'

async function lerCorpo(req: IncomingMessage & { body?: unknown }): Promise<unknown> {
  if (req.body !== undefined && req.body !== null && typeof req.body === 'object') return req.body
  const partes: Buffer[] = []
  let tam = 0
  for await (const p of req) {
    tam += (p as Buffer).length
    if (tam > 4.4 * 1024 * 1024) throw new Error('Corpo muito grande')
    partes.push(p as Buffer)
  }
  const txt = Buffer.concat(partes).toString()
  return txt ? JSON.parse(txt) : {}
}

export default async function handler(req: IncomingMessage & { body?: unknown }, res: ServerResponse) {
  const url = new URL(req.url ?? '/', 'http://x')
  const caminho = caminhoV2(url)
  url.searchParams.delete('__caminho')
  const cabecalhos: Record<string, string> = {}
  for (const [k, v] of Object.entries(req.headers)) if (typeof v === 'string') cabecalhos[k] = v
  let corpo: unknown = {}
  try { corpo = req.method === 'GET' || req.method === 'DELETE' ? {} : await lerCorpo(req) }
  catch { res.statusCode = 400; res.setHeader('Content-Type', 'application/json'); return void res.end('{"erro":"Corpo inválido."}') }

  const r: Req = {
    metodo: String(req.method ?? 'GET').toUpperCase(),
    caminho,
    query: Object.fromEntries(url.searchParams),
    corpo,
    cookie: req.headers.cookie,
    ip: String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?').split(',')[0].trim(),
    seguro: (req.headers['x-forwarded-proto'] ?? 'http') === 'https',
    cabecalhos,
  }
  const db = dbDoPool(pool())
  try { await garantirSchemaV2(db) }
  catch (e) {
    console.error('[api/v2] migração do schema falhou:', e instanceof Error ? e.message : e)
    res.statusCode = 503; res.setHeader('Content-Type', 'application/json; charset=utf-8')
    return void res.end('{"erro":"Banco de dados indisponível ou em atualização. Tente novamente em instantes."}')
  }
  const out = await despachar({ db, rotas: ROTAS, lerSessao }, r)
  res.statusCode = out.status
  res.setHeader('Cache-Control', 'no-store')
  res.setHeader('X-Content-Type-Options', 'nosniff')
  for (const [k, v] of Object.entries(out.cabecalhos ?? {})) res.setHeader(k, v)
  if (out.binario) {
    res.setHeader('Content-Type', out.binario.mime)
    res.setHeader('Content-Disposition', `${out.binario.inline ? 'inline' : 'attachment'}; filename="${out.binario.nome.replace(/"/g, '')}"`)
    return void res.end(out.binario.dados)
  }
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(JSON.stringify(out.corpo ?? {}))
}
