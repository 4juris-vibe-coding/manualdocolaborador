/* Editor livre: hospeda public/4jurisday-apresentacao.html num iframe e sincroniza o deck (JSON) com o store.
   Protocolo (postMessage, mesma origem):
     iframe → aqui  { src:'4j-deck', type:'ready' } · { src:'4j-deck', type:'save', deck }
     aqui → iframe  { src:'4j-deck', type:'load', deck|null, titulo, readonly } */
import { useEffect, useRef } from 'react'
import { useStore } from '@/lib/store'
import type { Apresentacao } from '@/lib/types'
import { toast } from '@/components/toast'

const URL_EDITOR = `${import.meta.env.BASE_URL}4jurisday-apresentacao.html?embed=1`

export function EditorLivreApresentacao({ a, somenteLeitura, onSalvo }: { a: Apresentacao; somenteLeitura: boolean; onSalvo?: () => void }) {
  const salvarApresentacao = useStore((s) => s.salvarApresentacao)
  const frame = useRef<HTMLIFrameElement>(null)
  // Valores mais recentes sem reabrir o listener a cada edição.
  const atual = useRef({ a, somenteLeitura, onSalvo })
  atual.current = { a, somenteLeitura, onSalvo }

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      const win = frame.current?.contentWindow
      const m = e.data as { src?: string; type?: string; deck?: { titulo?: unknown } } | null
      if (!win || e.source !== win || e.origin !== window.location.origin || m?.src !== '4j-deck') return
      const { a: ap, somenteLeitura: ro, onSalvo: ok } = atual.current
      if (m.type === 'ready') {
        win.postMessage({ src: '4j-deck', type: 'load', deck: ap.deck ?? null, titulo: ap.titulo, readonly: ro }, window.location.origin)
      } else if (m.type === 'save' && !ro && m.deck) {
        const titulo = typeof m.deck.titulo === 'string' ? m.deck.titulo.trim() : ''
        const r = salvarApresentacao(ap.id, { deck: m.deck, ...(titulo.length >= 3 ? { titulo: titulo.slice(0, 80) } : {}) })
        if (!r.ok) toast(r.erro, 'danger'); else ok?.()
      }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [salvarApresentacao])

  return (
    <iframe ref={frame} src={URL_EDITOR} title={`Editor da apresentação ${a.titulo}`} allow="fullscreen; clipboard-write"
      className="block w-full rounded-2xl border border-line bg-midnight shadow-sm" style={{ height: 'max(640px, calc(100vh - 210px))' }} />
  )
}
