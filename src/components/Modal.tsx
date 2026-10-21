import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import { X } from 'lucide-react'

export function Modal({
  open, onClose, title, subtitle, children, footer, wide,
}: {
  open: boolean
  onClose: () => void
  title?: ReactNode
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  wide?: boolean
}) {
  const tituloId = useId()
  const caixa = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!open) return
    const anterior = document.activeElement as HTMLElement | null
    // Foco inicial no primeiro campo (ou no próprio diálogo).
    const t = setTimeout(() => {
      const alvo = caixa.current?.querySelector<HTMLElement>('input:not([type=hidden]):not([disabled]):not(.sr-only), select, textarea, button[data-autofocus]')
      ;(alvo ?? caixa.current)?.focus()
    }, 30)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    document.addEventListener('keydown', onKey)
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = ''
      clearTimeout(t)
      anterior?.focus?.()
    }
  }, [open, onClose])

  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-[200] bg-midnight/40 backdrop-blur-sm p-4 sm:p-6 overflow-y-auto flex items-start justify-center animate-fade-in"
      onMouseDown={(e) => e.target === e.currentTarget && onClose()}
    >
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={title ? tituloId : undefined} tabIndex={-1} className={cn('bg-surface rounded-3xl shadow-lg w-full my-auto animate-scale-in outline-none', wide ? 'max-w-3xl' : 'max-w-lg')}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-6 pt-6 pb-4">
            <div>
              {title && <h2 id={tituloId} className="text-[19px] font-bold text-ink">{title}</h2>}
              {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="h-9 w-9 shrink-0 rounded-lg border border-line text-muted hover:bg-winter hover:text-ink flex items-center justify-center transition">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
        <div className="px-5 sm:px-6 pb-2 max-h-[64vh] overflow-y-auto">{children}</div>
        {footer && <div className="flex items-center justify-end gap-2.5 px-5 sm:px-6 py-4 sm:py-5 border-t border-line mt-3 flex-wrap">{footer}</div>}
      </div>
    </div>
  )
}

/** Confirmação para operações destrutivas ou irreversíveis. */
export function ConfirmModal({
  open, onClose, onConfirm, titulo, texto, confirmar = 'Confirmar', perigo = true, children,
}: {
  open: boolean; onClose: () => void; onConfirm: () => void; titulo: string; texto: ReactNode
  confirmar?: string; perigo?: boolean; children?: ReactNode
}) {
  return (
    <Modal open={open} onClose={onClose} title={titulo}
      footer={<>
        <button type="button" onClick={onClose} className="h-10 px-4 rounded-xl border border-line font-semibold text-[13.5px] text-ink hover:bg-surface-2">Cancelar</button>
        <button type="button" data-autofocus onClick={onConfirm} className={cn('h-10 px-4 rounded-xl font-semibold text-[13.5px] text-white', perigo ? 'bg-danger hover:bg-danger/90' : 'bg-brand hover:bg-brand-600')}>{confirmar}</button>
      </>}>
      <div className="text-[14px] text-ink-2 leading-relaxed">{texto}</div>
      {children}
    </Modal>
  )
}
