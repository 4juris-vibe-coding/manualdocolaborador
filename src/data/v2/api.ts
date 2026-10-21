/* ============================================================
   4JURIS Pessoas · cliente da API v2 (/api/v2/*)
   - Cookie de sessão HttpOnly (mesma origem) + cabeçalho anti-CSRF.
   - Erros viram ErroApi (com mensagens por campo quando houver).
   - Nada é "sucesso" até o servidor confirmar.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react'
import { CONFIG } from '../config'
import { toast } from '@/components/toast'

export class ErroApi extends Error {
  constructor(public status: number, mensagem: string, public campos?: Record<string, string>) { super(mensagem) }
}

const base = () => CONFIG.apiUrl.replace(/\/$/, '') + '/api/v2/'

async function pedir<T>(metodo: string, rota: string, corpo?: unknown, sinal?: AbortSignal): Promise<T> {
  let r: Response
  try {
    r = await fetch(base() + rota.replace(/^\//, ''), {
      method: metodo,
      credentials: 'same-origin',
      signal: sinal,
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': '4juris' },
      body: corpo === undefined ? undefined : JSON.stringify(corpo),
    })
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    throw new ErroApi(0, 'Sem conexão com o servidor. Verifique sua internet e tente de novo.')
  }
  if (r.status === 204) return undefined as T
  const tipo = r.headers.get('content-type') ?? ''
  const dados = tipo.includes('json') ? await r.json().catch(() => ({})) : {}
  if (!r.ok) throw new ErroApi(r.status, dados.erro ?? (r.status === 403 ? 'Você não tem permissão para isso.' : 'Não foi possível concluir a operação.'), dados.campos)
  return dados as T
}

export const api = {
  get: <T = any>(rota: string, sinal?: AbortSignal) => pedir<T>('GET', rota, undefined, sinal),
  post: <T = any>(rota: string, corpo?: unknown) => pedir<T>('POST', rota, corpo ?? {}),
  put: <T = any>(rota: string, corpo?: unknown) => pedir<T>('PUT', rota, corpo ?? {}),
  patch: <T = any>(rota: string, corpo?: unknown) => pedir<T>('PATCH', rota, corpo ?? {}),
  del: <T = any>(rota: string) => pedir<T>('DELETE', rota),
  /** URL para download direto (arquivos privados; o cookie de sessão acompanha). */
  url: (rota: string) => base() + rota.replace(/^\//, ''),
}

/** Monta a query string ignorando valores vazios. */
export function qs(p: Record<string, string | number | boolean | undefined | null>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(p)) if (v !== undefined && v !== null && v !== '' && v !== false) u.set(k, String(v))
  const s = u.toString()
  return s ? `?${s}` : ''
}

export interface Remoto<T> { dados?: T; carregando: boolean; erro?: ErroApi; recarregar: () => void }

/** Carrega `rota` (GET) e recarrega quando a rota mudar. `null` = não carregar. Ignora respostas atrasadas. */
export function useApi<T = any>(rota: string | null): Remoto<T> {
  const [estado, setEstado] = useState<{ dados?: T; carregando: boolean; erro?: ErroApi }>({ carregando: rota !== null })
  const [versao, setVersao] = useState(0)
  const seq = useRef(0)
  useEffect(() => {
    if (rota === null) { setEstado({ carregando: false }); return }
    const meu = ++seq.current
    const ctl = new AbortController()
    setEstado((s) => ({ ...s, carregando: true, erro: undefined }))
    api.get<T>(rota, ctl.signal)
      .then((d) => { if (meu === seq.current) setEstado({ dados: d, carregando: false }) })
      .catch((e) => { if (meu === seq.current && (e as Error).name !== 'AbortError') setEstado((s) => ({ dados: s.dados, carregando: false, erro: e as ErroApi })) })
    return () => ctl.abort()
  }, [rota, versao])
  const recarregar = useCallback(() => setVersao((v) => v + 1), [])
  return { ...estado, recarregar }
}

/**
 * Executa uma mutação e mostra o resultado. Só exibe sucesso depois da confirmação do servidor.
 * Devolve o resultado, ou undefined se falhou (a mensagem de erro já foi exibida).
 */
export async function executar<T>(fn: () => Promise<T>, sucesso?: string): Promise<T | undefined> {
  try {
    const r = await fn()
    if (sucesso) toast(sucesso)
    return r
  } catch (e) {
    toast(e instanceof ErroApi ? e.message : 'Algo deu errado. Tente novamente.', 'danger')
    return undefined
  }
}

/** Lê um arquivo do navegador como base64 (sem o prefixo data:). */
export function lerBase64(f: File): Promise<{ nome: string; base64: string }> {
  return new Promise((res, rej) => {
    const r = new FileReader()
    r.onload = () => res({ nome: f.name, base64: String(r.result).split(',')[1] ?? '' })
    r.onerror = () => rej(new Error('Não foi possível ler o arquivo.'))
    r.readAsDataURL(f)
  })
}
