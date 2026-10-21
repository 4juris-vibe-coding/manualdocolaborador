import { Button } from '@/components/ui'

export function Paginacao({ pagina, por, total, onPagina }: { pagina: number; por: number; total: number; onPagina: (p: number) => void }) {
  const paginas = Math.max(1, Math.ceil(total / por))
  if (total <= por) return null
  const de = (pagina - 1) * por + 1, ate = Math.min(total, pagina * por)
  return (
    <nav aria-label="Paginação" className="flex items-center justify-between gap-3 px-4 sm:px-5 py-3 border-t border-line text-[12.5px] text-muted flex-wrap">
      <span>{de}–{ate} de {total}</span>
      <div className="flex items-center gap-2">
        <Button size="sm" variant="ghost" icon="ChevronLeft" disabled={pagina <= 1} onClick={() => onPagina(pagina - 1)} aria-label="Página anterior" />
        <span aria-live="polite">Página {pagina} de {paginas}</span>
        <Button size="sm" variant="ghost" icon="ChevronRight" disabled={pagina >= paginas} onClick={() => onPagina(pagina + 1)} aria-label="Próxima página" />
      </div>
    </nav>
  )
}
