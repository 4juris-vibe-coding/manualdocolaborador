/* ============================================================
   4JURIS Pessoas · Configuração de ambiente
   Variáveis lidas de import.meta.env (ver .env.example).
   ============================================================ */

export type FonteDados = 'demo' | 'api'

const fonte = (import.meta.env.VITE_DATA_SOURCE ?? 'demo') as string

export const CONFIG = {
  /** 'demo' = dados fictícios no navegador. 'api' = banco (Supabase) via /api, com login por senha. */
  fonteDados: (fonte === 'api' ? 'api' : 'demo') as FonteDados,
  apiUrl: (import.meta.env.VITE_API_URL ?? '') as string,
  nomeEmpresa: (import.meta.env.VITE_NOME_EMPRESA ?? '4JURIS') as string,
  emailRH: (import.meta.env.VITE_EMAIL_RH ?? 'rh@4juris.com.br') as string,
}

export const MODO_DEMO = CONFIG.fonteDados === 'demo'
export const MODO_API = CONFIG.fonteDados === 'api'
