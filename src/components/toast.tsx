import { create } from 'zustand'
import { CheckCircle2, AlertTriangle, Info } from 'lucide-react'
import { uid } from '@/lib/utils'

type ToastType = 'success' | 'danger' | 'info'
interface Toast { id: string; type: ToastType; msg: string }

interface ToastState {
  toasts: Toast[]
  push: (msg: string, type?: ToastType) => void
  remove: (id: string) => void
}

export const useToast = create<ToastState>((set) => ({
  toasts: [],
  push: (msg, type = 'success') => {
    const id = uid('t')
    set((s) => ({ toasts: [...s.toasts, { id, msg, type }] }))
    setTimeout(() => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })), type === "danger" ? 5000 : 3500)
  },
  remove: (id) => set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) })),
}))

/** Helper para chamar fora de componentes: toast('...') */
export const toast = (msg: string, type: ToastType = 'success') => useToast.getState().push(msg, type)

const icons = { success: CheckCircle2, danger: AlertTriangle, info: Info }
const accent = { success: 'text-[#4ade9b]', danger: 'text-[#ff8a82]', info: 'text-brand-300' }

export function ToastHost() {
  const toasts = useToast((s) => s.toasts)
  return (
    <div className="fixed top-[76px] right-4 left-4 sm:left-auto z-[300] flex flex-col items-end gap-2.5 pointer-events-none" role="status" aria-live="polite">
      {toasts.map((t) => {
        const I = icons[t.type]
        return (
          <div key={t.id} className="flex items-center gap-3 bg-midnight text-white px-4 py-3 rounded-xl shadow-md text-[13.5px] font-medium min-w-[260px] max-w-sm animate-slide-up">
            <I className={`h-[19px] w-[19px] shrink-0 ${accent[t.type]}`} />
            <span>{t.msg}</span>
          </div>
        )
      })}
    </div>
  )
}

/** Converte o resultado de uma ação da camada de dados em feedback visível. Retorna true se deu certo. */
export function feedback(r: { ok: true; info?: string; avisos?: string[] } | { ok: false; erro: string }, sucesso: string): boolean {
  if (!r.ok) { toast(r.erro, 'danger'); return false }
  toast(r.info ? `${sucesso} ${r.info}` : sucesso)
  r.avisos?.forEach((a) => toast(a, 'info'))
  return true
}
