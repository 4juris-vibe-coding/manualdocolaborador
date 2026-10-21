/* Peças compartilhadas das telas do ATS e do portal de carreiras. */
import { useEffect, useState, type ReactNode } from 'react'
import { ErroApi } from '@/data/v2/api'
import { cn } from '@/lib/utils'

export const TEXTAREA = 'input h-auto min-h-[92px] py-2.5 leading-relaxed resize-y'

/** Define o título da aba enquanto a tela estiver aberta. */
export function useTitulo(titulo: string) {
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    return () => { document.title = antes }
  }, [titulo])
}

/** Atraso para campos de busca (evita uma requisição por tecla). */
export function useAtraso<T>(valor: T, ms = 350): T {
  const [v, setV] = useState(valor)
  useEffect(() => { const t = setTimeout(() => setV(valor), ms); return () => clearTimeout(t) }, [valor, ms])
  return v
}

/** Mensagens de erro por campo vindas do servidor (400 com `campos`). */
export function camposDoErro(e: unknown): Record<string, string> {
  return e instanceof ErroApi && e.campos ? e.campos : {}
}
export const mensagemDoErro = (e: unknown) => (e instanceof ErroApi ? e.message : 'Algo deu errado. Tente novamente.')

export function Secao({ titulo, children, acao, className }: { titulo: string; children: ReactNode; acao?: ReactNode; className?: string }) {
  return (
    <section className={cn('mb-6', className)}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted">{titulo}</h3>
        {acao}
      </div>
      {children}
    </section>
  )
}

export function Linha({ rotulo, children }: { rotulo: string; children: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 border-b border-line last:border-0 text-[13.5px]">
      <dt className="w-36 shrink-0 text-muted">{rotulo}</dt>
      <dd className="min-w-0 flex-1 text-ink break-words">{children || '—'}</dd>
    </div>
  )
}

/** Lê um arquivo de texto do navegador. */
export const lerTexto = (f: File) => f.text()
