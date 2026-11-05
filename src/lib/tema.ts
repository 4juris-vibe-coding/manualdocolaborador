/* Tema claro/escuro (preferência por navegador; padrão = sistema). */
import { create } from 'zustand'

export type Tema = 'claro' | 'escuro' | 'sistema'
const CHAVE = '4juris_tema'

function ler(): Tema {
  try { const t = localStorage.getItem(CHAVE); return t === 'claro' || t === 'escuro' ? t : 'sistema' } catch { return 'sistema' }
}

/** Portal público de carreiras: sempre no tema claro (as páginas usam cores fixas da marca, pensadas para fundo branco). */
export const temaFixoClaro = () => typeof location !== 'undefined' && /^\/carreiras(\/|$)/.test(location.pathname)

export function aplicarTema(t: Tema) {
  const escuro = !temaFixoClaro() && (t === 'escuro' || (t === 'sistema' && window.matchMedia?.('(prefers-color-scheme: dark)').matches))
  document.documentElement.classList.toggle('dark', !!escuro)
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', escuro ? '#0e1418' : '#122029')
}

export const useTema = create<{ tema: Tema; definir: (t: Tema) => void }>((set) => ({
  tema: ler(),
  definir: (t) => {
    try { localStorage.setItem(CHAVE, t) } catch { /* modo privado */ }
    aplicarTema(t)
    set({ tema: t })
  },
}))

// Acompanha a preferência do sistema quando o tema é "sistema".
if (typeof window !== 'undefined') {
  aplicarTema(ler())
  window.matchMedia?.('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (useTema.getState().tema === 'sistema') aplicarTema('sistema') })
}
