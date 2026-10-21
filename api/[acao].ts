/* Rotas: POST /api/login · POST /api/logout · GET /api/sessao · GET|PUT /api/estado */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { carregarEstado, confereSenha, cookieLimpo, db, emitirCookie, gravarColecoes, lerSessao } from './_lib.js'

type Req = IncomingMessage & { query?: Record<string, string | string[] | undefined>; body?: unknown }

const json = (res: ServerResponse, status: number, corpo: unknown, extra: Record<string, string> = {}) => {
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.setHeader('Cache-Control', 'no-store')
  for (const [k, v] of Object.entries(extra)) res.setHeader(k, v)
  res.end(JSON.stringify(corpo))
}

async function corpoJSON(req: Req): Promise<Record<string, unknown>> {
  if (req.body && typeof req.body === 'object') return req.body as Record<string, unknown>
  const partes: Buffer[] = []
  let tam = 0
  for await (const p of req) {
    tam += (p as Buffer).length
    if (tam > 20 * 1024 * 1024) throw new Error('Corpo muito grande')
    partes.push(p as Buffer)
  }
  const txt = Buffer.concat(partes).toString()
  return txt ? JSON.parse(txt) : {}
}

// Freio simples contra tentativas em sequência (por instância do servidor).
const falhas = new Map<string, { n: number; ate: number }>()

export default async function handler(req: Req, res: ServerResponse) {
  const q = req.query?.acao
  const acao = String((Array.isArray(q) ? q[0] : q) ?? new URL(req.url ?? '/', 'http://x').pathname.split('/').pop())
  const seguro = (req.headers['x-forwarded-proto'] ?? 'http') === 'https'
  try {
    if (acao === 'login' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?').split(',')[0]
      const f = falhas.get(ip)
      if (f && f.n >= 5 && f.ate > Date.now()) return json(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' })
      const { email, senha } = await corpoJSON(req) as { email?: string; senha?: string }
      if (typeof email !== 'string' || typeof senha !== 'string' || !email || !senha) return json(res, 400, { erro: 'Informe e-mail e senha.' })
      const r = await db().query('select id, senha_hash, colaborador_id from usuarios where lower(email) = lower($1) and ativo', [email.trim()])
      const u = r.rows[0]
      // Mesmo custo de cálculo com ou sem usuário, para não revelar se o e-mail existe.
      const ok = confereSenha(senha, u?.senha_hash ?? 'scrypt$00$00') && !!u
      if (!ok) {
        falhas.set(ip, { n: (f?.n ?? 0) + 1, ate: Date.now() + 10 * 60 * 1000 })
        return json(res, 401, { erro: 'E-mail ou senha incorretos.' })
      }
      falhas.delete(ip)
      await db().query('update usuarios set ultimo_acesso = now() where id = $1', [u.id])
      return json(res, 200, { colaboradorId: u.colaborador_id }, { 'Set-Cookie': emitirCookie({ uid: u.id, colaboradorId: u.colaborador_id }, seguro) })
    }

    if (acao === 'esqueci-senha' && req.method === 'POST') {
      const { email } = await corpoJSON(req) as { email?: string }
      if (typeof email !== 'string' || !email.trim()) return json(res, 400, { erro: 'Informe o e-mail.' })
      // TODO(Resend): gerar token de redefinição e enviar o e-mail aqui.
      // Resposta sempre igual, exista ou não o e-mail, para não revelar quem tem conta.
      return json(res, 200, { ok: true })
    }

    if (acao === 'logout' && req.method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': cookieLimpo(seguro) })

    const sessao = lerSessao(req.headers.cookie)
    if (!sessao) return json(res, 401, { erro: 'Sessão ausente ou expirada.' })
    // O usuário precisa continuar ativo no banco.
    const vivo = await db().query('select 1 from usuarios where id = $1 and ativo', [sessao.uid])
    if (!vivo.rowCount) return json(res, 401, { erro: 'Acesso desativado.' }, { 'Set-Cookie': cookieLimpo(seguro) })

    if (acao === 'sessao' && req.method === 'GET') return json(res, 200, { colaboradorId: sessao.colaboradorId })

    if (acao === 'estado' && req.method === 'GET') return json(res, 200, { colaboradorId: sessao.colaboradorId, estado: await carregarEstado() })

    if (acao === 'estado' && req.method === 'PUT') {
      const { mudancas } = await corpoJSON(req) as { mudancas?: Record<string, unknown> }
      if (!mudancas || typeof mudancas !== 'object') return json(res, 400, { erro: 'Corpo inválido.' })
      return json(res, 200, { gravadas: await gravarColecoes(mudancas) })
    }

    return json(res, 404, { erro: 'Rota não encontrada.' })
  } catch (e) {
    console.error('[api]', acao, e)
    return json(res, 500, { erro: 'Erro interno do servidor.' })
  }
}
