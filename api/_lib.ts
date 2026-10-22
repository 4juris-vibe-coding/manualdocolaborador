/* ============================================================
   4JURIS Pessoas · servidor (funções /api)
   Banco: PostgreSQL (Supabase) via DATABASE_URL. Sessão: cookie
   HttpOnly assinado (HMAC) com SESSION_SECRET. Sem dependências
   além do `pg`.
   ============================================================ */
import pg from 'pg'
import { createHash, createHmac, randomBytes, scryptSync, timingSafeEqual } from 'node:crypto'
import { emailBoasVindas, emailRedefinicao, type Email } from './_emailsPortal.js'

export const COLECOES = [
  'colaboradores', 'setores', 'unidades', 'cargos', 'contratos', 'documentos', 'reembolsos', 'notas', 'periodos',
  'comunicados', 'eventos', 'beneficios', 'treinamentos', 'progressoConteudos', 'badges', 'conquistas', 'regras',
  'lancamentos', 'desafios', 'reconhecimentos', 'iniciativas', 'checklists', 'processos', 'motivosEncerramento',
  'tiposRegistro', 'registros', 'objetivos', 'pesquisas', 'respostas', 'participacoes', 'parabens', 'notificacoes',
  'auditoria', 'historicoFuncao', 'dependentes', 'exigencias', 'beneficiarios', 'gruposCompetencia', 'competencias',
  'ciclos', 'participantesCiclo', 'respostasAvaliacao', 'avaliacoesInicio', 'classificacoesGrupo', 'feedbacks',
  'apresentacoes', 'sugestoes',
] as const

export const tabela = (colecao: string) => `app_${colecao.toLowerCase()}`

let pool: pg.Pool | undefined
export function db(): pg.Pool {
  if (!pool) {
    const url = process.env.DATABASE_URL
    if (!url) throw new Error('DATABASE_URL não configurada.')
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false }, max: 3 })
  }
  return pool
}

/* ---------- senha ---------- */
export function hashSenha(senha: string): string {
  const sal = randomBytes(16)
  const h = scryptSync(senha, sal, 64)
  return `scrypt$${sal.toString('hex')}$${h.toString('hex')}`
}
export function confereSenha(senha: string, guardado: string): boolean {
  const [alg, salHex, hHex] = guardado.split('$')
  if (alg !== 'scrypt' || !salHex || !hHex) return false
  const esperado = Buffer.from(hHex, 'hex')
  if (!esperado.length) return false
  const h = scryptSync(senha, Buffer.from(salHex, 'hex'), esperado.length)
  return timingSafeEqual(h, esperado)
}

/* ---------- redefinição de senha ---------- */
export const hashToken = (t: string) => createHash('sha256').update(t).digest('hex')
export const urlPortal = () => (process.env.PORTAL_URL || 'https://portaldocolaborador.somos4juris.com.br').replace(/\/$/, '')

export type EnvioEmail = { status: 'enviado' } | { status: 'nao_configurado' | 'falhou'; erro: string }

/** Envia pelo Resend (RESEND_API_KEY + RESEND_FROM). Sem a chave, só registra no log do servidor. */
export async function enviarEmail(para: string, e: Email, log: string): Promise<EnvioEmail> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) { console.warn(`[e-mail] RESEND_API_KEY ausente. ${log}`); return { status: 'nao_configurado', erro: 'O envio de e-mails não está configurado no servidor (RESEND_API_KEY).' } }
  try {
    const r = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: process.env.RESEND_FROM || '4JURIS <nao-responda@4jurismarketing.com.br>', to: [para], subject: e.assunto, html: e.html, text: e.texto }),
    })
    if (r.ok) return { status: 'enviado' }
    const detalhe = (await r.text()).slice(0, 300)
    console.error('[e-mail] Resend respondeu', r.status, detalhe)
    return { status: 'falhou', erro: `O provedor de e-mail recusou (${r.status}): ${detalhe}` }
  } catch (err) {
    return { status: 'falhou', erro: err instanceof Error ? err.message.slice(0, 200) : 'Falha de rede ao enviar.' }
  }
}

export const enviarEmailRedefinicao = (para: string, link: string) =>
  enviarEmail(para, emailRedefinicao({ link, portal: urlPortal() }), `Link de redefinição para ${para}: ${link}`)

/** Coluna com a data do último e-mail de acesso enviado (aditiva; também está em db/schema.sql). */
let colunaConvite: Promise<unknown> | undefined
export function garantirColunaConvite(ex: Pick<pg.Pool, 'query'> = db()): Promise<unknown> {
  colunaConvite ??= ex.query('alter table usuarios add column if not exists convite_enviado_em timestamptz').catch((e) => { colunaConvite = undefined; throw e })
  return colunaConvite
}

/** Validade do link de boas-vindas (criação da primeira senha). */
export const DIAS_LINK_ACESSO = 7

/**
 * Gera um link de criação de senha (mesmo fluxo de /redefinir-senha, válido por DIAS_LINK_ACESSO)
 * e envia o e-mail de boas-vindas. Um link novo invalida os anteriores da mesma pessoa.
 */
export async function enviarBoasVindas(u: { id: string; email: string; nome: string }): Promise<EnvioEmail> {
  const token = randomBytes(32).toString('base64url')
  await db().query('delete from redefinicoes_senha where usuario_id = $1', [u.id])
  await db().query(`insert into redefinicoes_senha (token_hash, usuario_id, expira_em) values ($1, $2, now() + interval '${DIAS_LINK_ACESSO} days')`, [hashToken(token), u.id])
  const link = `${urlPortal()}/redefinir-senha?token=${token}&boas-vindas=1`
  return enviarEmail(u.email, emailBoasVindas({ nome: u.nome, email: u.email, link, portal: urlPortal(), validadeDias: DIAS_LINK_ACESSO }), `Link de acesso para ${u.email}: ${link}`)
}

/* ---------- cadastro por link (solicitações de acesso) ----------
   Mesmo SQL de db/schema.sql; criado aqui também para funcionar mesmo antes de rodar o db:setup. */
const SQL_CADASTRO = `
create table if not exists convites_cadastro (
  token text primary key,
  criado_por text not null,
  criado_em timestamptz not null default now(),
  revogado_em timestamptz
);
alter table convites_cadastro enable row level security;
create table if not exists solicitacoes_acesso (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  email text not null,
  senha_hash text not null,
  status text not null default 'pendente' check (status in ('pendente', 'aprovado', 'recusado')),
  convite_token text,
  colaborador_id text,
  criado_em timestamptz not null default now(),
  decidido_em timestamptz,
  decidido_por text
);
create unique index if not exists solicitacoes_pendente_email_uk on solicitacoes_acesso (lower(email)) where status = 'pendente';
alter table solicitacoes_acesso enable row level security;`
let tabelasCadastro: Promise<unknown> | undefined
export function garantirTabelasCadastro(ex: Pick<pg.Pool, 'query'> = db()): Promise<unknown> {
  tabelasCadastro ??= ex.query(SQL_CADASTRO).catch((e) => { tabelasCadastro = undefined; throw e })
  return tabelasCadastro
}

/* ---------- sessão (cookie assinado) ---------- */
const COOKIE = 'sessao4juris'
const DURACAO_S = 60 * 60 * 12

function segredo(): string {
  const s = process.env.SESSION_SECRET
  if (!s || s.length < 32) throw new Error('SESSION_SECRET ausente ou curta (mín. 32 caracteres).')
  return s
}
const assinar = (dado: string) => createHmac('sha256', segredo()).update(dado).digest('base64url')

export interface Sessao { uid: string; colaboradorId: string; exp: number }

export function emitirCookie(s: Omit<Sessao, 'exp'>, seguro: boolean): string {
  const corpo = Buffer.from(JSON.stringify({ ...s, exp: Math.floor(Date.now() / 1000) + DURACAO_S })).toString('base64url')
  return `${COOKIE}=${corpo}.${assinar(corpo)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${DURACAO_S}${seguro ? '; Secure' : ''}`
}
export const cookieLimpo = (seguro: boolean) => `${COOKIE}=; Path=/; HttpOnly; SameSite=Lax; Max-Age=0${seguro ? '; Secure' : ''}`

export function lerSessao(cookieHeader: string | undefined): Sessao | null {
  const bruto = cookieHeader?.split(';').map((p) => p.trim()).find((p) => p.startsWith(`${COOKIE}=`))?.slice(COOKIE.length + 1)
  if (!bruto) return null
  const [corpo, sig] = bruto.split('.')
  if (!corpo || !sig) return null
  const a = Buffer.from(sig), b = Buffer.from(assinar(corpo))
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null
  try {
    const s = JSON.parse(Buffer.from(corpo, 'base64url').toString()) as Sessao
    return s.exp > Date.now() / 1000 ? s : null
  } catch { return null }
}

/* ---------- estado ---------- */
export type Estado = Record<string, unknown>

/** Substitui, numa transação, as coleções recebidas (cada uma por inteiro). Só para o db:setup (carga inicial);
    a interface grava por registro, com regras de permissão (api/_v2/estadoLegado.ts). */
export async function gravarColecoes(mudancas: Estado): Promise<string[]> {
  const gravadas: string[] = []
  const cli = await db().connect()
  try {
    await cli.query('begin')
    for (const [nome, valor] of Object.entries(mudancas)) {
      if (nome === 'config') {
        if (!valor || typeof valor !== 'object' || Array.isArray(valor)) throw new Error('config inválida')
        await cli.query('delete from app_config')
        for (const [k, v] of Object.entries(valor as Record<string, unknown>)) {
          await cli.query('insert into app_config (chave, dados) values ($1, $2::jsonb)', [k, JSON.stringify(v)])
        }
        gravadas.push(nome)
        continue
      }
      if (!(COLECOES as readonly string[]).includes(nome)) throw new Error(`Coleção desconhecida: ${nome}`)
      if (!Array.isArray(valor)) throw new Error(`Coleção ${nome} deve ser uma lista`)
      const t = tabela(nome)
      await cli.query(`delete from ${t}`)
      if (valor.length) {
        await cli.query(
          `insert into ${t} (ord, id, dados)
           select (e.n - 1)::int, e.v->>'id', e.v from jsonb_array_elements($1::jsonb) with ordinality as e(v, n)`,
          [JSON.stringify(valor)],
        )
      }
      gravadas.push(nome)
    }
    await cli.query('commit')
  } catch (e) {
    await cli.query('rollback').catch(() => undefined)
    throw e
  } finally {
    cli.release()
  }
  return gravadas
}
