/* Editor embutido (apresentações e artes): hospeda um HTML de public/ num iframe e sincroniza o design (JSON) com o store.
   Protocolo (postMessage, mesma origem):
     iframe → aqui  { src:'4j-deck', type:'ready' } · { type:'save', deck } · { type:'thumb', thumb }
     aqui → iframe  { src:'4j-deck', type:'load', deck|null, titulo, template, tamanho, readonly }
   O "load" é enviado quando o iframe avisa 'ready' E quando o iframe termina de carregar: assim não depende de
   quem ficou pronto primeiro. O editor ignora o segundo envio. */
import { useCallback, useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Apresentacao } from '@/lib/types'
import { toast } from '@/components/toast'
import { modeloProntoDe } from '@/domain/apresentacoes'
import { ehArte, tamanhoDe, urlEditor } from '@/domain/canva'

const LIMITE_ESPERA_MS = 10000

export function EditorLivreApresentacao({ a, somenteLeitura, onSalvo }: { a: Apresentacao; somenteLeitura: boolean; onSalvo?: () => void }) {
  const salvarApresentacao = useStore((s) => s.salvarApresentacao)
  const frame = useRef<HTMLIFrameElement>(null)
  const [estado, setEstado] = useState<'carregando' | 'pronto' | 'falhou'>('carregando')
  const [tentativa, setTentativa] = useState(0)
  // Valores mais recentes sem reabrir o listener a cada edição.
  const atual = useRef({ a, somenteLeitura, onSalvo })
  atual.current = { a, somenteLeitura, onSalvo }

  const enviarCarga = useCallback(() => {
    const win = frame.current?.contentWindow
    if (!win) return
    const { a: ap, somenteLeitura: ro } = atual.current
    win.postMessage({ src: '4j-deck', type: 'load', deck: ap.deck ?? null, titulo: ap.titulo, template: modeloProntoDe(ap.modeloId), tamanho: ehArte(ap.modeloId) ? tamanhoDe(ap.modeloId) : undefined, readonly: ro }, window.location.origin)
  }, [])

  useEffect(() => {
    const ouvir = (e: MessageEvent) => {
      const win = frame.current?.contentWindow
      const m = e.data as { src?: string; type?: string; deck?: { titulo?: unknown }; thumb?: unknown } | null
      if (!win || e.source !== win || e.origin !== window.location.origin || m?.src !== '4j-deck') return
      const { a: ap, somenteLeitura: ro, onSalvo: ok } = atual.current
      if (m.type === 'ready') {
        enviarCarga(); setEstado('pronto')
      } else if (m.type === 'save' && !ro && m.deck) {
        const titulo = typeof m.deck.titulo === 'string' ? m.deck.titulo.trim() : ''
        const r = salvarApresentacao(ap.id, { deck: m.deck, ...(titulo.length >= 3 ? { titulo: titulo.slice(0, 80) } : {}) })
        if (!r.ok) toast(r.erro, 'danger'); else ok?.()
      } else if (m.type === 'thumb' && !ro && typeof m.thumb === 'string') {
        salvarApresentacao(ap.id, { capa: m.thumb })
      }
    }
    window.addEventListener('message', ouvir)
    return () => window.removeEventListener('message', ouvir)
  }, [salvarApresentacao, enviarCarga])

  // Se o editor não responder, mostra uma saída em vez de uma área em branco.
  useEffect(() => {
    setEstado('carregando')
    const t = window.setTimeout(() => setEstado((e) => (e === 'carregando' ? 'falhou' : e)), LIMITE_ESPERA_MS)
    return () => window.clearTimeout(t)
  }, [tentativa])

  return (
    <div className="relative">
      <iframe key={tentativa} ref={frame} src={urlEditor(a)} onLoad={enviarCarga} title={`Editor de ${a.titulo}`} allow="fullscreen; clipboard-write"
        className="block w-full rounded-2xl border border-line bg-midnight shadow-sm" style={{ height: 'max(640px, calc(100vh - 210px))' }} />
      {estado !== 'pronto' && (
        <div className="absolute inset-0 rounded-2xl bg-midnight/95 flex flex-col items-center justify-center gap-3 text-center text-white p-6" role={estado === 'falhou' ? 'alert' : 'status'}>
          {estado === 'carregando' ? (
            <p className="text-[13.5px] font-semibold">Carregando o editor…</p>
          ) : (
            <>
              <p className="text-[14px] font-bold">O editor não respondeu.</p>
              <p className="text-[12.5px] text-white/70 max-w-sm">Seu design continua salvo. Tente carregar o editor de novo; se persistir, recarregue a página (Ctrl+F5).</p>
              <button type="button" className="h-10 px-4 rounded-xl bg-brand text-white text-[13px] font-semibold" onClick={() => setTentativa((n) => n + 1)}>Tentar de novo</button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
