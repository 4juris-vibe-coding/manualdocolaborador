/* Etiquetas dos produtos em que a pessoa atua (4Juris, Lexfy…). Só informam: não mudam a hierarquia. */
import { cn } from '@/lib/utils'

export interface ProdutoOrg { id: string; nome: string; cor: string }

export function EtiquetasProduto({ ids, produtos, className }: { ids: string[] | undefined; produtos: ProdutoOrg[]; className?: string }) {
  const lista = produtos.filter((p) => ids?.includes(p.id))
  if (!lista.length) return null
  return (
    <span className={cn('flex gap-1 min-w-0 overflow-hidden', className)} aria-label={`Produtos: ${lista.map((p) => p.nome).join(', ')}`}>
      {lista.map((p) => (
        <span key={p.id} title={p.nome} className="shrink min-w-0 truncate rounded-full px-1.5 py-[1px] text-[10px] font-bold leading-[14px] border"
          style={{ color: p.cor, borderColor: `${p.cor}55`, backgroundColor: `${p.cor}14` }}>{p.nome}</span>
      ))}
    </span>
  )
}
