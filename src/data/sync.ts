/* ============================================================
   4JURIS Pessoas · Adaptador de API (modo VITE_DATA_SOURCE=api)
   Sessão por cookie HttpOnly (/api/login) e persistência das
   coleções da store no banco (/api/estado). O servidor entrega só
   o que a pessoa pode ver; mudanças são enviadas logo após cada
   ação como operações por registro (src/domain/sincronia.ts), com o
   hash da versão vista. Se o servidor recusar (permissão) ou houver
   edição concorrente, a tela é recarregada com a versão do banco.
   ============================================================ */
import { create } from 'zustand'
import { CONFIG, MODO_API } from './config'
import { useStore, DB_KEYS } from '@/lib/store'
import { toast } from '@/components/toast'
import { carregarAcesso, limparAcesso } from './v2/acesso'
import { diferenca, hashRegistro, type OpsColecao } from '@/domain/sincronia'
import { definirSegredoAnonimo } from '@/domain/anonimato'

const base = CONFIG.apiUrl.replace(/\/$/, '')

async function chamar<T>(rota: string, init?: RequestInit): Promise<{ ok: boolean; status: number; dados: T & { erro?: string } }> {
  const r = await fetch(`${base}/api/${rota}`, { credentials: 'same-origin', ...init, headers: { 'Content-Type': 'application/json', 'X-Requested-With': '4juris', ...init?.headers } })
  const dados = await r.json().catch(() => ({}))
  return { ok: r.ok, status: r.status, dados }
}

export type SituacaoSessao = 'carregando' | 'anonimo' | 'ok' | 'erro'
interface SyncState { sessao: SituacaoSessao; salvando: boolean; erro?: string }
export const useSync = create<SyncState>(() => ({ sessao: MODO_API ? 'carregando' : 'ok', salvando: false }))

/* ---------- sincronização store → banco ----------
   As ações da store recriam as coleções a cada mudança; por isso
   comparamos o CONTEÚDO com a última versão confirmada pelo servidor
   (`enviado`) e mandamos só os registros que mudaram. */
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

/** Monta o lote de operações (registros alterados por coleção + configuração inteira). */
function montarLote(atual: Record<string, string>, chaves: string[]) {
  const ops: Record<string, OpsColecao> = {}
  let config: { base: string | null; dados: unknown } | undefined
  for (const k of chaves) {
    if (k === 'config') { config = { base: hashRegistro(JSON.parse(enviado[k] ?? 'null')), dados: JSON.parse(atual[k]) }; continue }
    const d = diferenca(k, JSON.parse(enviado[k] ?? '[]'), JSON.parse(atual[k]))
    if (d) ops[k] = d
  }
  return { ops, ...(config ? { config } : {}) }
}

async function enviar() {
  if (!ativo || emVoo) return
  sujo = false
  const atual = fotografar()
  const chaves = DB_KEYS.filter((k) => atual[k] !== enviado[k])
  if (!chaves.length) { useSync.setState({ salvando: false }); return }
  emVoo = true
  useSync.setState({ salvando: true })
  try {
    const r = await chamar<{ recarregar?: boolean }>('estado', { method: 'PUT', body: json(montarLote(atual, chaves)) })
    if (r.status === 401) { toast('Sua sessão expirou. Entre novamente.', 'danger'); ativo = false; useSync.setState({ sessao: 'anonimo', salvando: false }); useStore.setState({ sessaoId: null }); return }
    if (r.status === 409 && r.dados.recarregar) { window.location.reload(); return }
    if (r.status === 400 || r.status === 403 || r.status === 409) {
      // Recusa definitiva (permissão, dado inválido ou conflito): não adianta repetir. Volta ao que está no banco.
      toast(`Não foi salvo: ${r.dados.erro ?? 'operação recusada pelo servidor'}`, 'danger')
      useSync.setState({ erro: undefined })
      emVoo = false
      await hidratar()
      useSync.setState({ salvando: false })
      return
    }
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
  const r = await chamar<{ colaboradorId: string; estado: Record<string, unknown>; segredoAnonimo?: string }>('estado')
  if (!r.ok) return false
  const { estado, colaboradorId, segredoAnonimo } = r.dados
  definirSegredoAnonimo(segredoAnonimo ?? '')
  useStore.setState({ ...estado, sessaoId: colaboradorId, previewColaborador: false })
  enviado = fotografar()
  sujo = false
  ligarSync()
  void carregarAcesso()
  return true
}

/** Recarrega as coleções do servidor (depois de uma ação do servidor que altera dados das telas antigas). */
export async function recarregarEstado(): Promise<void> {
  if (!MODO_API || !ativo) return
  await salvarAgora()
  await hidratar()
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

/** Envia já o que estiver pendente na store e espera confirmar (para ações que dependem do cadastro estar no servidor). */
export async function salvarAgora(): Promise<boolean> {
  for (let i = 0; i < 20; i++) {
    clearTimeout(timer)
    if (emVoo) { await new Promise((r) => setTimeout(r, 250)); continue }
    await enviar()
    const atual = fotografar()
    if (DB_KEYS.every((k) => atual[k] === enviado[k])) return true
  }
  return false
}

/* ---------- acessos (logins) — somente administração ---------- */
export interface AcessoUsuario { colaboradorId: string; ativo: boolean; ultimoAcesso: string | null }

export async function listarAcessos(colaboradorId?: string): Promise<AcessoUsuario[]> {
  const r = await chamar<{ acessos: AcessoUsuario[] }>(colaboradorId ? `usuarios?colaboradorId=${encodeURIComponent(colaboradorId)}` : 'usuarios')
  return r.ok ? r.dados.acessos : []
}

/** Cria o acesso (precisa de senha), redefine a senha e/ou ativa/desativa. Devolve a mensagem de erro, ou null. */
export async function salvarAcesso(colaboradorId: string, dados: { senha?: string; ativo?: boolean }): Promise<string | null> {
  try {
    const r = await chamar('usuarios', { method: 'POST', body: JSON.stringify({ colaboradorId, ...dados }) })
    return r.ok ? null : r.dados.erro ?? 'Não foi possível salvar o acesso.'
  } catch { return 'Servidor indisponível. Tente novamente.' }
}

/* ---------- cadastro por link (público) e aprovação (RH/admin) ---------- */
export interface Convite { token: string; criadoEm: string }
export interface Solicitacao { id: string; nome: string; email: string; status: 'pendente' | 'aprovado' | 'recusado'; criadoEm: string; decididoEm: string | null; colaboradorId: string | null }

export const linkCadastro = (token: string) => `${window.location.origin}/cadastro/${token}`

export async function conviteValido(token: string): Promise<boolean | null> {
  try {
    const r = await chamar<{ valido: boolean }>(`convite?token=${encodeURIComponent(token)}`)
    return r.ok ? r.dados.valido : null
  } catch { return null }
}

export async function enviarCadastro(dados: { token: string; nome: string; email: string; senha: string }): Promise<string | null> {
  try {
    const r = await chamar('cadastro', { method: 'POST', body: JSON.stringify(dados) })
    return r.ok ? null : r.dados.erro ?? 'Não foi possível enviar o cadastro.'
  } catch { return 'Servidor indisponível. Tente novamente.' }
}

export async function lerConvite(): Promise<Convite | null> {
  const r = await chamar<{ convite: Convite | null }>('convites')
  return r.ok ? r.dados.convite : null
}

export async function alterarConvite(acao: 'gerar' | 'revogar'): Promise<{ convite: Convite | null; erro?: string }> {
  try {
    const r = await chamar<{ convite: Convite | null }>('convites', { method: 'POST', body: JSON.stringify({ acao }) })
    return r.ok ? { convite: r.dados.convite } : { convite: null, erro: r.dados.erro ?? 'Não foi possível alterar o link.' }
  } catch { return { convite: null, erro: 'Servidor indisponível. Tente novamente.' } }
}

export async function listarSolicitacoes(): Promise<Solicitacao[]> {
  const r = await chamar<{ solicitacoes: Solicitacao[] }>('solicitacoes')
  return r.ok ? r.dados.solicitacoes : []
}

export async function decidirSolicitacao(id: string, acao: 'aprovar' | 'recusar', colaboradorId?: string): Promise<string | null> {
  try {
    const r = await chamar('solicitacoes', { method: 'POST', body: JSON.stringify({ id, acao, colaboradorId }) })
    return r.ok ? null : r.dados.erro ?? 'Não foi possível concluir.'
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
  definirSegredoAnonimo('')
  limparAcesso()
  useSync.setState({ sessao: 'anonimo' })
  await chamar('logout', { method: 'POST' }).catch(() => undefined)
}

/** Sai: grava o que estiver pendente, encerra a sessão no servidor e limpa a sessão local. */
export async function sairCompleto(): Promise<void> {
  await sairDoServidor()
  useStore.getState().sair()
}
