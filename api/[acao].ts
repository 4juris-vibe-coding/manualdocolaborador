/* Rotas: POST /api/login · POST /api/logout · POST /api/esqueci-senha · POST /api/redefinir-senha · GET /api/convite · POST /api/cadastro
   · GET /api/sessao · GET|PUT /api/estado · GET|POST /api/usuarios · GET|POST /api/solicitacoes · GET|POST /api/convites (RH/admin) */
import type { IncomingMessage, ServerResponse } from 'node:http'
import { confereSenha, cookieLimpo, db, emitirCookie, enviarEmail, enviarEmailRedefinicao, garantirTabelasCadastro, hashSenha, hashToken, lerSessao, urlPortal } from './_lib.js'
import { randomBytes } from 'node:crypto'
import { Recusa } from './_v2/guarda.js'
import { aplicarLote, estadoPara, type Lote } from './_v2/estadoLegado.js'
import { garantirSchemaV2 } from './_v2/migrar.js'
import { dbDoPool } from './_v2/nucleo.js'

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
const cadastros = new Map<string, { n: number; ate: number }>()

const EMAIL_OK = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const conviteValido = async (token: unknown) =>
  typeof token === 'string' && !!token && !!(await db().query('select 1 from convites_cadastro where token = $1 and revogado_em is null', [token])).rowCount

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
        // Cadastro feito pelo link e ainda não aprovado: avisa em vez de "senha incorreta".
        if (!u) {
          await garantirTabelasCadastro()
          const sol = (await db().query("select senha_hash, status from solicitacoes_acesso where lower(email) = lower($1) and status <> 'aprovado' order by criado_em desc limit 1", [email.trim()])).rows[0]
          if (sol && confereSenha(senha, sol.senha_hash)) {
            return json(res, 403, { erro: sol.status === 'pendente' ? 'Seu cadastro está aguardando aprovação da equipe 4JURIS. Você receberá um aviso quando o acesso for liberado.' : 'Seu cadastro não foi aprovado. Fale com o RH da 4JURIS.' })
          }
        }
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

    if (acao === 'convite' && req.method === 'GET') {
      await garantirTabelasCadastro()
      return json(res, 200, { valido: await conviteValido(new URL(req.url ?? '/', 'http://x').searchParams.get('token')) })
    }

    if (acao === 'cadastro' && req.method === 'POST') {
      const ip = String(req.headers['x-forwarded-for'] ?? req.socket.remoteAddress ?? '?').split(',')[0]
      const c = cadastros.get(ip)
      if (c && c.n >= 10 && c.ate > Date.now()) return json(res, 429, { erro: 'Muitas tentativas. Aguarde alguns minutos.' })
      cadastros.set(ip, { n: (c && c.ate > Date.now() ? c.n : 0) + 1, ate: Date.now() + 60 * 60 * 1000 })
      await garantirTabelasCadastro()
      const { token, nome, email, senha } = await corpoJSON(req) as { token?: string; nome?: string; email?: string; senha?: string }
      if (!(await conviteValido(token))) return json(res, 400, { erro: 'Este link de cadastro não é mais válido. Peça um novo ao RH.' })
      const n = typeof nome === 'string' ? nome.trim().replace(/\s+/g, ' ') : ''
      const e = typeof email === 'string' ? email.trim().toLowerCase() : ''
      if (n.length < 3 || n.length > 120) return json(res, 400, { erro: 'Informe o nome completo.' })
      if (!EMAIL_OK.test(e) || e.length > 160) return json(res, 400, { erro: 'Informe um e-mail válido.' })
      if (typeof senha !== 'string' || senha.length < 10 || senha.length > 200) return json(res, 400, { erro: 'A senha precisa ter ao menos 10 caracteres.' })
      if ((await db().query('select 1 from usuarios where lower(email) = $1', [e])).rowCount) return json(res, 409, { erro: 'Este e-mail já tem acesso ao portal. Entre pelo login ou use "Esqueceu a senha?".' })
      if ((await db().query("select 1 from solicitacoes_acesso where lower(email) = $1 and status = 'pendente'", [e])).rowCount) return json(res, 409, { erro: 'Já existe um cadastro com este e-mail aguardando aprovação.' })
      await db().query('insert into solicitacoes_acesso (nome, email, senha_hash, convite_token) values ($1, $2, $3, $4)', [n, e, hashSenha(senha), token])
      return json(res, 200, { ok: true })
    }

    if (acao === 'logout' && req.method === 'POST') return json(res, 200, { ok: true }, { 'Set-Cookie': cookieLimpo(seguro) })

    const sessao = lerSessao(req.headers.cookie)
    if (!sessao) return json(res, 401, { erro: 'Sessão ausente ou expirada.' })
    // O usuário precisa continuar ativo no banco.
    const vivo = await db().query('select 1 from usuarios where id = $1 and ativo', [sessao.uid])
    if (!vivo.rowCount) return json(res, 401, { erro: 'Acesso desativado.' }, { 'Set-Cookie': cookieLimpo(seguro) })

    // Mutações autenticadas exigem o cabeçalho da aplicação (defesa contra CSRF, além do SameSite=Lax).
    if (req.method !== 'GET' && req.headers['x-requested-with'] !== '4juris') return json(res, 403, { erro: 'Requisição não reconhecida.' })

    if (acao === 'sessao' && req.method === 'GET') return json(res, 200, { colaboradorId: sessao.colaboradorId })

    // Acessos (logins): a administração gerencia todos; o RH, apenas de colaboradores e gestores (nunca de RH, diretoria ou admin).
    if (acao === 'usuarios' || acao === 'solicitacoes' || acao === 'convites') {
      const quem = (await db().query("select dados->>'papel' as papel from app_colaboradores where id = $1", [sessao.colaboradorId])).rows[0]
      if (quem?.papel !== 'admin' && quem?.papel !== 'rh') return json(res, 403, { erro: 'Apenas RH ou administração gerenciam acessos.' })
      const podeGerir = (papelAlvo: string) => quem.papel === 'admin' || papelAlvo === 'colaborador' || papelAlvo === 'gestor'
      if (acao !== 'usuarios') await garantirTabelasCadastro()

      // Link de cadastro: um ativo por vez; gerar um novo invalida o anterior.
      if (acao === 'convites' && req.method === 'GET') {
        const c = (await db().query('select token, criado_em from convites_cadastro where revogado_em is null order by criado_em desc limit 1')).rows[0]
        return json(res, 200, { convite: c ? { token: c.token, criadoEm: c.criado_em } : null })
      }
      if (acao === 'convites' && req.method === 'POST') {
        const { acao: op } = await corpoJSON(req) as { acao?: string }
        if (op !== 'gerar' && op !== 'revogar') return json(res, 400, { erro: 'Pedido inválido.' })
        await db().query('update convites_cadastro set revogado_em = now() where revogado_em is null')
        if (op === 'revogar') return json(res, 200, { convite: null })
        const token = randomBytes(18).toString('base64url')
        const c = (await db().query('insert into convites_cadastro (token, criado_por) values ($1, $2) returning criado_em', [token, sessao.colaboradorId])).rows[0]
        return json(res, 200, { convite: { token, criadoEm: c.criado_em } })
      }

      if (acao === 'solicitacoes' && req.method === 'GET') {
        const r = await db().query(
          "select id, nome, email, status, criado_em, decidido_em, colaborador_id from solicitacoes_acesso where status = 'pendente' or decidido_em > now() - interval '30 days' order by criado_em desc")
        return json(res, 200, { solicitacoes: r.rows.map((x) => ({ id: x.id, nome: x.nome, email: x.email, status: x.status, criadoEm: x.criado_em, decididoEm: x.decidido_em, colaboradorId: x.colaborador_id })) })
      }
      if (acao === 'solicitacoes' && req.method === 'POST') {
        const { id, acao: op, colaboradorId } = await corpoJSON(req) as { id?: string; acao?: string; colaboradorId?: string }
        if (typeof id !== 'string' || (op !== 'aprovar' && op !== 'recusar')) return json(res, 400, { erro: 'Pedido inválido.' })
        const sol = (await db().query("select id, nome, email, senha_hash from solicitacoes_acesso where id::text = $1 and status = 'pendente'", [id])).rows[0]
        if (!sol) return json(res, 404, { erro: 'Solicitação não encontrada ou já analisada.' })
        if (op === 'recusar') {
          await db().query("update solicitacoes_acesso set status = 'recusado', decidido_em = now(), decidido_por = $2 where id = $1", [sol.id, sessao.colaboradorId])
          return json(res, 200, { ok: true })
        }
        // Aprovar: o cadastro da pessoa (app_colaboradores) já foi criado pela interface com o mesmo e-mail; aqui nasce o login, com a senha que ela escolheu.
        if (typeof colaboradorId !== 'string' || !colaboradorId) return json(res, 400, { erro: 'Pessoa não informada.' })
        const pessoa = (await db().query("select dados->>'email' as email, dados->>'papel' as papel, dados->>'status' as status from app_colaboradores where id = $1", [colaboradorId])).rows[0]
        if (!pessoa?.email) return json(res, 404, { erro: 'Cadastro da pessoa não encontrado.' })
        if (String(pessoa.email).trim().toLowerCase() !== String(sol.email).toLowerCase()) return json(res, 400, { erro: 'O e-mail do cadastro não confere com o da solicitação.' })
        if (!podeGerir(pessoa.papel)) return json(res, 403, { erro: 'Apenas a administração libera acesso de RH, diretoria e administradores.' })
        if (pessoa.status === 'encerrado') return json(res, 400, { erro: 'Parceria encerrada — o acesso não pode ser liberado.' })
        if ((await db().query('select 1 from usuarios where lower(email) = lower($1) or colaborador_id = $2', [sol.email, colaboradorId])).rowCount) {
          return json(res, 409, { erro: 'Esta pessoa já tem acesso ao portal.' })
        }
        const cli = await db().connect()
        try {
          await cli.query('begin')
          await cli.query('insert into usuarios (email, senha_hash, colaborador_id, papel, ativo) values ($1, $2, $3, $4, true)', [sol.email, sol.senha_hash, colaboradorId, pessoa.papel])
          await cli.query("update solicitacoes_acesso set status = 'aprovado', decidido_em = now(), decidido_por = $2, colaborador_id = $3 where id = $1", [sol.id, sessao.colaboradorId, colaboradorId])
          await cli.query('commit')
        } catch (e) {
          await cli.query('rollback').catch(() => undefined)
          throw e
        } finally { cli.release() }
        const primeiro = String(sol.nome).split(' ')[0].replace(/[<>&"]/g, '')
        await enviarEmail(sol.email, 'Seu acesso foi liberado · Portal 4JURIS',
          `<p>Olá, ${primeiro}!</p><p>Seu cadastro foi aprovado e o acesso ao Portal 4JURIS já está liberado.</p><p><a href="${urlPortal()}/login">Entrar no portal</a> com o e-mail e a senha que você cadastrou.</p>`,
          `Acesso liberado para ${sol.email}.`).catch((e) => console.error('[e-mail] aprovação', e))
        return json(res, 200, { ok: true })
      }
      if (acao !== 'usuarios') return json(res, 405, { erro: 'Método não permitido.' })

      if (req.method === 'GET') {
        const um = new URL(req.url ?? '/', 'http://x').searchParams.get('colaboradorId')
        const r = um
          ? await db().query('select colaborador_id, ativo, ultimo_acesso from usuarios where colaborador_id = $1', [um])
          : await db().query('select colaborador_id, ativo, ultimo_acesso from usuarios')
        return json(res, 200, { acessos: r.rows.map((u) => ({ colaboradorId: u.colaborador_id, ativo: u.ativo, ultimoAcesso: u.ultimo_acesso })) })
      }

      if (req.method === 'POST') {
        const { colaboradorId, senha, ativo } = await corpoJSON(req) as { colaboradorId?: string; senha?: string; ativo?: boolean }
        if (typeof colaboradorId !== 'string' || !colaboradorId) return json(res, 400, { erro: 'Pessoa não informada.' })
        if (senha !== undefined && (typeof senha !== 'string' || senha.length < 10)) return json(res, 400, { erro: 'A senha precisa ter ao menos 10 caracteres.' })
        if (ativo !== undefined && typeof ativo !== 'boolean') return json(res, 400, { erro: 'Pedido inválido.' })
        if (ativo === false && colaboradorId === sessao.colaboradorId) return json(res, 400, { erro: 'Você não pode desativar o próprio acesso.' })

        const pessoa = (await db().query("select dados->>'email' as email, dados->>'papel' as papel, dados->>'status' as status from app_colaboradores where id = $1", [colaboradorId])).rows[0]
        if (!pessoa?.email) return json(res, 404, { erro: 'Pessoa não encontrada.' })
        if (!podeGerir(pessoa.papel)) return json(res, 403, { erro: 'Apenas a administração gerencia o acesso de RH, diretoria e administradores.' })
        if (pessoa.status === 'encerrado' && ativo !== false) return json(res, 400, { erro: 'Parceria encerrada — o acesso não pode ser liberado.' })

        const atual = (await db().query('select id from usuarios where colaborador_id = $1', [colaboradorId])).rows[0]
        const email = String(pessoa.email).trim()
        const dono = (await db().query('select colaborador_id from usuarios where lower(email) = lower($1)', [email])).rows[0]
        if (dono && dono.colaborador_id !== colaboradorId) return json(res, 409, { erro: 'Este e-mail já está em uso por outro acesso.' })

        if (atual) {
          await db().query(
            'update usuarios set email = $2, papel = $3, senha_hash = coalesce($4, senha_hash), ativo = coalesce($5, ativo) where id = $1',
            [atual.id, email, pessoa.papel, senha ? hashSenha(senha) : null, ativo ?? null])
        } else {
          if (!senha) return json(res, 400, { erro: 'Defina uma senha para criar o acesso.' })
          await db().query('insert into usuarios (email, senha_hash, colaborador_id, papel, ativo) values ($1, $2, $3, $4, $5)', [email, hashSenha(senha), colaboradorId, pessoa.papel, ativo ?? true])
        }
        return json(res, 200, { ok: true, criado: !atual })
      }
    }

    // As regras de /api/estado consultam tabelas do schema v2 (funções adicionais, histórico financeiro).
    if (acao === 'estado') await garantirSchemaV2(dbDoPool(db()))

    // Cada pessoa recebe só o que pode ver (api/_v2/guarda.ts), mais o segredo da caixa de sugestões.
    if (acao === 'estado' && req.method === 'GET') {
      const r = await estadoPara(db(), sessao.colaboradorId)
      if (!r) return json(res, 403, { erro: 'Cadastro não encontrado.' })
      return json(res, 200, { colaboradorId: sessao.colaboradorId, estado: r.estado, segredoAnonimo: r.segredo })
    }

    // Gravação por registro: regras por coleção, conflito de edição e tudo-ou-nada (api/_v2/estadoLegado.ts).
    if (acao === 'estado' && req.method === 'PUT') {
      const corpo = await corpoJSON(req) as Lote & { mudancas?: unknown }
      // Versão antiga do aplicativo (substituía coleções inteiras): não é mais aceita.
      if (corpo.mudancas !== undefined) return json(res, 409, { erro: 'O portal foi atualizado. Recarregue a página para continuar.', recarregar: true })
      const cli = await db().connect()
      try {
        await cli.query('begin')
        const r = await aplicarLote(cli, sessao.colaboradorId, corpo)
        await cli.query('commit')
        return json(res, 200, r)
      } catch (e) {
        await cli.query('rollback').catch(() => undefined)
        if (e instanceof Recusa) return json(res, e.status, { erro: e.message, ...((e as Recusa & { conflitos?: unknown }).conflitos ? { conflitos: (e as Recusa & { conflitos?: unknown }).conflitos } : {}) })
        throw e
      } finally { cli.release() }
    }

    return json(res, 404, { erro: 'Rota não encontrada.' })
  } catch (e) {
    console.error('[api]', acao, e)
    return json(res, 500, { erro: 'Erro interno do servidor.' })
  }
}
