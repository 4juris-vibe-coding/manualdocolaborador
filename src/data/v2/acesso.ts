/* Capacidades da pessoa em sessão (vindas do servidor). Só moldam a interface; o servidor decide de verdade. */
import { create } from 'zustand'
import { api } from './api'
import { MODO_API } from '../config'
import { definirExtrasDaSessao, type Capacidade, type FuncaoAdicional } from '@/domain/permissions'

interface Acesso {
  carregado: boolean
  funcoes: FuncaoAdicional[]
  capacidades: Capacidade[]
  setoresLiderados: string[]
}
export const useAcesso = create<Acesso>(() => ({ carregado: false, funcoes: [], capacidades: [], setoresLiderados: [] }))

export async function carregarAcesso(): Promise<void> {
  if (!MODO_API) return
  try {
    const eu = await api.get<{ funcoes: FuncaoAdicional[]; capacidades: Capacidade[]; setoresLiderados: string[] }>('eu')
    definirExtrasDaSessao(eu.capacidades)
    useAcesso.setState({ carregado: true, funcoes: eu.funcoes, capacidades: eu.capacidades, setoresLiderados: eu.setoresLiderados })
  } catch { /* sem acesso v2: menus novos ficam ocultos */ }
}

export function limparAcesso() {
  definirExtrasDaSessao([])
  useAcesso.setState({ carregado: false, funcoes: [], capacidades: [], setoresLiderados: [] })
}

/** Hook: a pessoa tem a capacidade (papel + funções)? Re-renderiza quando o acesso carrega. */
export function useTem(cap: Capacidade): boolean {
  return useAcesso((s) => s.capacidades.includes(cap))
}
