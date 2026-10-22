import { type ReactNode, useEffect, useId, useRef } from 'react'
import { cn } from '@/lib/utils'
import { devolverFoco, ehToque, travarRolagem, useFecharPeloFundo } from '@/lib/rolagem'
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
  // onClose costuma vir inline (() => setX(null)) e muda a cada render da página. Se fosse dependência do efeito
  // abaixo, cada tecla digitada num formulário controlado pela página re-rodaria o efeito e jogaria o foco de volta
  // para o primeiro campo. Lido por ref, o efeito roda só ao abrir/fechar.
  const fechar = useRef(onClose)
  fechar.current = onClose
  useEffect(() => {
    if (!open) return
    const anterior = document.activeElement as HTMLElement | null
    // Foco inicial no primeiro campo (ou no próprio diálogo). Em telas de toque, focar um campo abriria o teclado
    // virtual por cima do formulário antes de a pessoa ler: lá o foco vai para o diálogo (ou para o botão marcado).
    const t = setTimeout(() => {
      const seletor = ehToque() ? 'button[data-autofocus]' : 'input:not([type=hidden]):not([disabled]):not(.sr-only), select, textarea, button[data-dropdown]:not([disabled]), button[data-autofocus]'
      const alvo = caixa.current?.querySelector<HTMLElement>(seletor)
      ;(alvo ?? caixa.current)?.focus({ preventScroll: true })
    }, 30)
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && fechar.current()
    document.addEventListener('keydown', onKey)
    const destravar = travarRolagem()
    return () => {
      document.removeEventListener('keydown', onKey)
      destravar()
      clearTimeout(t)
      devolverFoco(anterior)
    }
  }, [open])
  const fundo = useFecharPeloFundo(onClose)

  if (!open) return null
  return (
    // Celular: folha que sobe da base (ações ao alcance do polegar). A partir de sm: janela centralizada.
    <div
      className="fixed inset-0 z-[200] bg-midnight/40 backdrop-blur-sm pt-[max(12px,env(safe-area-inset-top))] sm:p-6 flex items-end sm:items-center justify-center animate-fade-in"
      {...fundo}
    >
      <div ref={caixa} role="dialog" aria-modal="true" aria-labelledby={title ? tituloId : undefined} tabIndex={-1} className={cn('bg-surface rounded-t-3xl sm:rounded-3xl shadow-lg w-full max-h-full flex flex-col animate-slide-up sm:animate-scale-in outline-none', wide ? 'sm:max-w-3xl' : 'sm:max-w-lg')}>
        {(title || subtitle) && (
          <div className="flex items-start justify-between gap-4 px-5 sm:px-6 pt-5 sm:pt-6 pb-4 shrink-0">
            <div className="min-w-0">
              {title && <h2 id={tituloId} className="text-[19px] font-bold text-ink">{title}</h2>}
              {subtitle && <p className="text-[13px] text-muted mt-1">{subtitle}</p>}
            </div>
            <button type="button" onClick={onClose} aria-label="Fechar" className="h-11 w-11 sm:h-9 sm:w-9 -mr-1 sm:mr-0 -mt-1 sm:mt-0 shrink-0 rounded-lg border border-line text-muted hover:bg-winter hover:text-ink flex items-center justify-center transition">
              <X className="h-[18px] w-[18px]" />
            </button>
          </div>
        )}
        {/* Uma única área rolável: cabeçalho e ações ficam sempre visíveis, e a janela nunca passa da altura da tela. */}
        <div className={cn('px-5 sm:px-6 pb-2 flex-1 min-h-0 overflow-y-auto overscroll-contain', !(title || subtitle) && 'pt-5 sm:pt-6', !footer && 'pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-2')}>{children}</div>
        {footer && <div className="modal-acoes flex items-center justify-end gap-2.5 px-5 sm:px-6 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:pb-4 border-t border-line mt-3 flex-wrap shrink-0">{footer}</div>}
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
        <button type="button" onClick={onClose} className="h-11 sm:h-10 px-4 rounded-xl border border-line font-semibold text-[13.5px] text-ink hover:bg-surface-2">Cancelar</button>
        <button type="button" data-autofocus onClick={onConfirm} className={cn('h-11 sm:h-10 px-4 rounded-xl font-semibold text-[13.5px] text-white', perigo ? 'bg-danger hover:bg-danger/90' : 'bg-brand hover:bg-brand-600')}>{confirmar}</button>
      </>}>
      <div className="text-[14px] text-ink-2 leading-relaxed">{texto}</div>
      {children}
    </Modal>
  )
}
