/* Fotos de perfil: o servidor entrega só o mapa { pessoaId: versão }; cada imagem é pedida pela rota autenticada
   com ?v=<versão>, então o navegador guarda em cache e só baixa de novo quando a foto muda. */
import { create } from 'zustand'
import { api } from './api'
import { MODO_API } from '../config'

interface Fotos { versoes: Record<string, number> }
export const useFotos = create<Fotos>(() => ({ versoes: {} }))

export async function carregarFotos(): Promise<void> {
  if (!MODO_API) return
  try { useFotos.setState({ versoes: (await api.get<{ versoes: Record<string, number> }>('pessoas/fotos')).versoes }) }
  catch (e) { console.error('[fotos] falha ao carregar', e) }
}
export const limparFotos = () => useFotos.setState({ versoes: {} })

export const urlFoto = (id: string, versao: number) => api.url(`pessoas/${encodeURIComponent(id)}/foto?v=${versao}`)

/** Hook: URL da foto da pessoa, ou null quando ela não tem foto. */
export function useUrlFoto(id: string | undefined | null): string | null {
  const v = useFotos((s) => (id ? s.versoes[id] : undefined))
  return id && v ? urlFoto(id, v) : null
}

export async function enviarFoto(id: string, blob: Blob): Promise<void> {
  const base64 = await new Promise<string>((ok, erro) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1] ?? '')
    r.onerror = () => erro(r.error)
    r.readAsDataURL(blob)
  })
  const { versao } = await api.put<{ versao: number }>(`pessoas/${encodeURIComponent(id)}/foto`, { arquivo: { nome: 'foto.jpg', base64 } })
  useFotos.setState((s) => ({ versoes: { ...s.versoes, [id]: versao } }))
}

export async function removerFoto(id: string): Promise<void> {
  await api.del(`pessoas/${encodeURIComponent(id)}/foto`)
  useFotos.setState((s) => { const v = { ...s.versoes }; delete v[id]; return { versoes: v } })
}
