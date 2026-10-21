/* Rotas: POST /api/login · POST /api/logout · POST /api/esqueci-senha · POST /api/redefinir-senha · GET /api/sessao · GET|PUT /api/estado */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { carregarEstado, confereSenha, cookieLimpo, db, emitirCookie, enviarEmailRedefinicao, gravarColecoes, hashSenha, hashToken, lerSessao, urlPortal } from './_lib.js'
import { randomBytes } from 'node:crypto'
import { validarEscritaLegada } from './_v2/guarda.js'

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
      const u = (await db().query('select id from usuarios where lower(email) = lower($1) and ativo', [email.trim()])).rows[0]
      if (u) {
        const token = randomBytes(32).toString('base64url')
        await db().query('delete from redefinicoes_senha where usuario_id = $1', [u.id])
        await db().query("insert into redefinicoes_senha (token_hash, usuario_id, expira_em) values ($1, $2, now() + interval '1 hour')", [hashToken(token), u.id])
        await enviarEmailRedefinicao(email.trim(), `${urlPortal()}/redefinir-senha?token=${token}`)
      }
      // Resposta sempre igual, exista ou não o e-mail, para não revelar quem tem conta.
      return json(res, 200, { ok: true })
    }

    if (acao === 'redefinir-senha' && req.method === 'POST') {
      const { token, senha } = await corpoJSON(req) as { token?: string; senha?: string }
      if (typeof token !== 'string' || typeof senha !== 'string' || !token) return json(res, 400, { erro: 'Link inválido.' })
      if (senha.length < 10) return json(res, 400, { erro: 'A senha precisa ter ao menos 10 caracteres.' })
      const r = await db().query(
        'update redefinicoes_senha set usado_em = now() where token_hash = $1 and usado_em is null and expira_em > now() returning usuario_id',
        [hashToken(token)])
      if (!r.rowCount) return json(res, 400, { erro: 'Link inválido ou expirado. Peça um novo.' })
      await db().query('update usuarios set senha_hash = $2 where id = $1', [r.rows[0].usuario_id, hashSenha(senha)])
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
      // O servidor confere o que a pessoa pode alterar (o papel vem do cadastro, não do cliente).
      const atuais = await carregarEstado()
      const eu = (atuais.colaboradores as { id: string; papel: string }[]).find((c) => c.id === sessao.colaboradorId)
      if (!eu) return json(res, 403, { erro: 'Cadastro não encontrado.' })
      const recusa = validarEscritaLegada(mudancas, atuais as { colaboradores: Record<string, unknown>[] }, { colaboradorId: eu.id, papel: eu.papel })
      if (recusa) return json(res, 403, { erro: recusa })
      return json(res, 200, { gravadas: await gravarColecoes(mudancas) })
    }

    return json(res, 404, { erro: 'Rota não encontrada.' })
  } catch (e) {
    console.error('[api]', acao, e)
    return json(res, 500, { erro: 'Erro interno do servidor.' })
  }
}
