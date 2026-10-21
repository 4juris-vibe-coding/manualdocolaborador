/* ============================================================
   4JURIS Pessoas · Adaptador de API (modo VITE_DATA_SOURCE=api)
   Sessão por cookie HttpOnly (/api/login) e persistência das
   coleções da store no banco (/api/estado). A store continua sendo
   a fonte de verdade na tela; mudanças são enviadas em lote
   (coleções inteiras que mudaram) logo após cada ação.
   ============================================================ */
import { create } from 'zustand'
import { CONFIG, MODO_API } from './config'
import { useStore, DB_KEYS } from '@/lib/store'
import { toast } from '@/components/toast'

const base = CONFIG.apiUrl.replace(/\/$/, '')

async function chamar<T>(rota: string, init?: RequestInit): Promise<{ ok: boolean; status: number; dados: T & { erro?: string } }> {
  const r = await fetch(`${base}/api/${rota}`, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', ...init?.headers } })
  const dados = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, dados }
}

export type SituacaoSessao = 'carregando' | 'anonimo' | 'ok' | 'erro'
interface SyncState { sessao: SituacaoSessao; salvando: boolean; erro?: string }
export const useSync = create<SyncState>(() => ({ sessao: MODO_API ? 'carregando' : 'ok', salvando: false }))

/* ---------- sincronização store → banco ----------
   As ações da store recriam todas as coleções a cada mudança; por isso
   comparamos o CONTEÚDO (JSON) com o último estado confirmado pelo servidor. */
let enviado: Record<string, string> = {}
let timer: ReturnType<typeof setTimeout> | undefined
let ativo = false
let emVoo = false
let sujo = false

const json = (v: unknown) => JSON.stringify(v)
const fotografar = (): Record<string, string> => {
  const s = useStore.getState() as unknown as Record<string, unknown>
  return Object.fromEntries(DB_KEYS.map((k) => [k, json(s[k])]))
}

async function enviar() {
  if (!ativo || emVoo) return
  sujo = false
  const atual = fotografar()
  const chaves = DB_KEYS.filter((k) => atual[k] !== enviado[k])
  if (!chaves.length) { useSync.setState({ salvando: false }); return }
  emVoo = true
  useSync.setState({ salvando: true })
  const mudancas = Object.fromEntries(chaves.map((k) => [k, JSON.parse(atual[k])]))
  try {
    const r = await chamar('estado', { method: 'PUT', body: json({ mudancas }) })
    if (r.status === 401) { toast('Sua sessão expirou. Entre novamente.', 'danger'); ativo = false; useSync.setState({ sessao: 'anonimo', salvando: false }); useStore.setState({ sessaoId: null }); return }
    if (!r.ok) throw new Error(r.dados.erro ?? 'Falha ao salvar')
    for (const k of chaves) enviado[k] = atual[k]
    if (useSync.getState().erro) toast('Conexão restabelecida. Alterações salvas.')
    useSync.setState({ erro: undefined })
  } catch (e) {
    sujo = true
    if (!useSync.getState().erro) toast(`Não foi possível salvar: ${e instanceof Error && e.message !== 'Failed to fetch' ? e.message : 'sem conexão com o servidor'}. Tentando de novo…`, 'danger')
    useSync.setState({ erro: 'Não foi possível salvar no servidor. Tentando novamente…' })
    clearTimeout(timer); timer = setTimeout(enviar, 5000)
    return
  } finally {
    emVoo = false
  }
  if (sujo) { clearTimeout(timer); timer = setTimeout(enviar, 300) } else useSync.setState({ salvando: false })
}

let assinado = false
function ligarSync() {
  ativo = true
  if (assinado) return
  assinado = true
  useStore.subscribe(() => {
    if (!ativo) return
    sujo = true
    clearTimeout(timer); timer = setTimeout(enviar, 600)
  })
  window.addEventListener('beforeunload', (e) => {
    if (ativo && (emVoo || (sujo && DB_KEYS.some((k) => fotografar()[k] !== enviado[k])))) { e.preventDefault(); e.returnValue = '' }
  })
}

/* ---------- sessão ---------- */
async function hidratar(): Promise<boolean> {
  const r = await chamar<{ colaboradorId: string; estado: Record<string, unknown> }>('estado')
  if (!r.ok) return false
  const { estado, colaboradorId } = r.dados
  useStore.setState({ ...estado, sessaoId: colaboradorId, previewColaborador: false })
  enviado = fotografar()
  sujo = false
  ligarSync()
  return true
}

/** Chamado na abertura do app: reaproveita o cookie de sessão, se válido. */
export async function iniciarSessao(): Promise<void> {
  if (!MODO_API) return
  try {
    const ok = await hidratar()
    useSync.setState({ sessao: ok ? 'ok' : 'anonimo' })
  } catch { useSync.setState({ sessao: 'erro' }); toast('Não foi possível conectar ao servidor.', 'danger') }
}

export async function entrarComSenha(email: string, senha: string): Promise<string | null> {
  try {
    const r = await chamar('login', { method: 'POST', body: JSON.stringify({ email, senha }) })
    if (!r.ok) return r.dados.erro ?? 'Não foi possível entrar.'
    if (!(await hidratar())) return 'Login feito, mas não foi possível carregar os dados.'
    useSync.setState({ sessao: 'ok' })
    return null
  } catch { return 'Servidor indisponível. Tente novamente.' }
}

export async function pedirRedefinicaoSenha(email: string): Promise<string | null> {
  try {
    const r = await chamar('esqueci-senha', { method: 'POST', body: JSON.stringify({ email }) })
    return r.ok ? null : r.dados.erro ?? 'Não foi possível enviar o pedido.'
  } catch { return 'Servidor indisponível. Tente novamente.' }
}

export async function redefinirSenha(token: string, senha: string): Promise<string | null> {
  try {
    const r = await chamar('redefinir-senha', { method: 'POST', body: JSON.stringify({ token, senha }) })
    return r.ok ? null : r.dados.erro ?? 'Não foi possível redefinir a senha.'
  } catch { return 'Servidor indisponível. Tente novamente.' }
}

export async function sairDoServidor(): Promise<void> {
  if (!MODO_API) return
  clearTimeout(timer)
  if (ativo && !emVoo) await enviar()
  ativo = false
  useSync.setState({ sessao: 'anonimo' })
  await chamar('logout', { method: 'POST' }).catch(() => undefined)
}

/** Sai: grava o que estiver pendente, encerra a sessão no servidor e limpa a sessão local. */
export async function sairCompleto(): Promise<void> {
  await sairDoServidor()
  useStore.getState().sair()
}
