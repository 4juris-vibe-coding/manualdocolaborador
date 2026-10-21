/* Indicador de etapas para formulários longos (navegável por teclado). */
import { cn } from '@/lib/utils'
import { Icon } from '@/components/ui'

export function Stepper({ etapas, atual, onIr, erros = [] }: { etapas: string[]; atual: number; onIr: (i: number) => void; erros?: number[] }) {
  return (
    <ol className="flex gap-1.5 overflow-x-auto pb-1 mb-6" aria-label="Etapas do formulário">
      {etapas.map((e, i) => {
        const feito = i < atual, ativo = i === atual, comErro = erros.includes(i)
        return (
          <li key={e} className="flex-1 min-w-[120px]">
            <button type="button" onClick={() => onIr(i)} aria-current={ativo ? 'step' : undefined}
              className={cn('w-full flex items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12.5px] font-semibold transition outline-none focus-visible:ring-2 focus-visible:ring-brand',
                ativo ? 'border-brand bg-brand-50 text-brand-700' : comErro ? 'border-danger/40 bg-danger-soft text-danger' : feito ? 'border-line bg-surface text-ink-2' : 'border-line bg-surface-2 text-muted')}>
              <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10.5px] shrink-0', ativo ? 'bg-brand text-white' : feito ? 'bg-success text-white' : 'bg-winter text-muted')}>
                {feito && !comErro ? <Icon name="Check" className="h-3 w-3" /> : i + 1}
              </span>
              <span className="truncate">{e}</span>
            </button>
          </li>
        )
      })}
    </ol>
  )
}
