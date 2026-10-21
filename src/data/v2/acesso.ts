/* Capacidades da pessoa em sessão (vindas do servidor). Só moldam a interface; o servidor decide de verdade. */
import { create } from 'zustand'
import { api } from './api'
import { MODO_API } from '../config'
import { can, definirExtrasDaSessao, type Capacidade, type FuncaoAdicional } from '@/domain/permissions'
import { useStore } from '@/lib/store'

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
  } catch (e) {
    // Sem acesso v2: valem só as capacidades do papel. Marca como carregado para a guarda de rota não ficar em "Carregando…" para sempre.
    console.error('[acesso] falha ao carregar /api/v2/eu', e)
    useAcesso.setState({ carregado: true })
  }
}

export function limparAcesso() {
  definirExtrasDaSessao([])
  useAcesso.setState({ carregado: false, funcoes: [], capacidades: [], setoresLiderados: [] })
}

/** Hook: a pessoa tem a capacidade (papel + funções)? Re-renderiza quando o acesso carrega. */
export function useTem(cap: Capacidade): boolean {
  const papel = useStore((s) => s.currentUser().papel)
  return useAcesso((s) => s.capacidades.includes(cap)) || can(papel, cap)
}
