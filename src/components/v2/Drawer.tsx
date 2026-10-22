/* Painel lateral (detalhes de registro) com foco preso, Esc para fechar e rolagem própria. */
import { type ReactNode, useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { cn } from '@/lib/utils'

export function Drawer({ open, onClose, titulo, subtitulo, children, rodape, largura = 'max-w-xl' }: {
  open: boolean; onClose: () => void; titulo: ReactNode; subtitulo?: ReactNode; children: ReactNode; rodape?: ReactNode; largura?: string
}) {
  const id = useId()
  const caixa = useRef<HTMLDivElement>(null)
  // Por ref, como no Modal: onClose inline mudaria a cada render e o efeito roubaria o foco de quem está digitando.
  const fechar = useRef(onClose)
  fechar.current = onClose
  useEffect(() => {
    if (!open) return
    const anterior = document.activeElement as HTMLElement | null
    const t = setTimeout(() => caixa.current?.focus(), 30)
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') fechar.current()
      if (e.key === 'Tab' && caixa.current) {
        const f = [...caixa.current.querySelectorAll<HTMLElement>('a[href],button:not([disabled]),input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])')]
        if (!f.length) return
        const primeiro = f[0], ultimo = f[f.length - 1]
        if (e.shiftKey && document.activeElement === primeiro) { e.preventDefault(); ultimo.focus() }
        else if (!e.shiftKey && document.activeElement === ultimo) { e.preventDefault(); primeiro.focus() }
      }
    }
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => { document.removeEventListener('keydown', onKey); document.body.style.overflow = ''; clearTimeout(t); anterior?.focus?.() }
  }, [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[180] bg-midnight/40 backdrop-blur-sm animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={id} tabIndex={-1}
        className={cn('absolute inset-y-0 right-0 w-full bg-surface shadow-lg flex flex-col outline-none animate-fade-in', largura)}>
        <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 pb-4 border-b border-line">
          <div className="min-w-0">
            <h2 id={id} className="text-[18px] font-bold text-ink truncate">{titulo}</h2>
            {subtitulo && <div className="text-[13px] text-muted mt-1">{subtitulo}</div>}
          </div>
          <button type="button" onClick={onClose} aria-label="Fechar painel" className="h-9 w-9 shrink-0 rounded-lg border border-line text-muted hover:bg-winter hover:text-ink flex items-center justify-center transition">
            <X className="h-[18px] w-[18px]" />
          </button>
        </div>
        <div className="flex-1 overflow-y-auto px-5 sm:px-6 py-5">{children}</div>
        {rodape && <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 border-t border-line flex-wrap">{rodape}</div>}
      </div>
    </div>
  )
}
