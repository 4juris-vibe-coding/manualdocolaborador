/* ============================================================
   Notificações do servidor (ntf_notificacoes) unificadas com as da store.
   - Consulta ao abrir a sessão, a cada 60 s e ao voltar para a aba.
   - Marcar como lida só altera a tela depois que o servidor confirma.
   ============================================================ */
import { useEffect } from 'react'
import { create } from 'zustand'
import { api } from './api'
import { MODO_API } from '../config'
import { useStore } from '@/lib/store'
import { useAcesso } from './acesso'

export interface NotifServidor { id: string; tipo: string; titulo: string; corpo: string | null; link: string | null; criadaEm: string; lidaEm: string | null }
interface Estado { itens: NotifServidor[]; naoLidas: number; carregar: () => Promise<void>; marcar: (id: string) => Promise<void>; marcarTodas: () => Promise<void> }

export const useNotifV2 = create<Estado>((set, get) => ({
  itens: [],
  naoLidas: 0,
  async carregar() {
    if (!MODO_API) return
    try {
      const r = await api.get<{ itens: Array<Omit<NotifServidor, 'criadaEm' | 'lidaEm'> & { criada_em: string; lida_em: string | null }>; naoLidas: number }>('notificacoes')
      set({ naoLidas: r.naoLidas, itens: r.itens.map((n) => ({ id: n.id, tipo: n.tipo, titulo: n.titulo, corpo: n.corpo, link: n.link, criadaEm: n.criada_em, lidaEm: n.lida_em })) })
    } catch { /* mantém o que já está na tela */ }
  },
  async marcar(id) {
    try { await api.post(`notificacoes/${id}/lida`); await get().carregar() } catch { /* tenta de novo no próximo ciclo */ }
  },
  async marcarTodas() {
    try { await api.post('notificacoes/lidas'); await get().carregar() } catch { /* idem */ }
  },
}))

/** Liga a consulta periódica (chame uma vez, no layout autenticado). */
export function useSincronizarNotifV2() {
  const pronto = useAcesso((s) => s.carregado)
  const carregar = useNotifV2((s) => s.carregar)
  useEffect(() => {
    if (!MODO_API || !pronto) return
    void carregar()
    const t = setInterval(() => { if (document.visibilityState === 'visible') void carregar() }, 60_000)
    const volta = () => { if (document.visibilityState === 'visible') void carregar() }
    document.addEventListener('visibilitychange', volta)
    return () => { clearInterval(t); document.removeEventListener('visibilitychange', volta) }
  }, [pronto, carregar])
}

export interface NotifUnificada { id: string; origem: 'store' | 'servidor'; tipo: string; titulo: string; texto: string; data: string; lida: boolean; href?: string }

/** Lista única (store + servidor), mais recentes primeiro, com ações de marcar. */
export function useNotificacoesUnificadas() {
  const meId = useStore((s) => s.realUser().id)
  const doStore = useStore((s) => s.notificacoes)
  const marcarStore = useStore((s) => s.marcarNotifLida)
  const marcarTodasStore = useStore((s) => s.marcarTodasLidas)
  const srv = useNotifV2((s) => s.itens)
  const marcarSrv = useNotifV2((s) => s.marcar)
  const marcarTodasSrv = useNotifV2((s) => s.marcarTodas)

  const itens: NotifUnificada[] = [
    ...doStore.filter((n) => n.colaboradorId === meId).map((n) => ({ id: n.id, origem: 'store' as const, tipo: n.tipo, titulo: n.titulo, texto: n.texto, data: n.data, lida: n.lida, href: n.href })),
    ...srv.map((n) => ({ id: n.id, origem: 'servidor' as const, tipo: n.tipo, titulo: n.titulo, texto: n.corpo ?? '', data: n.criadaEm, lida: !!n.lidaEm, href: n.link ?? undefined })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return {
    itens,
    naoLidas: itens.filter((n) => !n.lida).length,
    marcar: (n: NotifUnificada) => (n.origem === 'servidor' ? marcarSrv(n.id) : marcarStore(n.id)),
    marcarTodas: () => { marcarTodasStore(); void marcarTodasSrv() },
  }
}
