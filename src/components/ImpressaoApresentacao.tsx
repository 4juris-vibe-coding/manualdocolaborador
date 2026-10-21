/* Exportar para PDF: imprime todos os slides, um por página (use "Salvar como PDF" no diálogo do navegador). */
import { createPortal } from 'react-dom'
import { useEffect } from 'react'
import type { SlideInstancia, TemaApresentacao } from '@/lib/types'
import type { ModeloApresentacao } from '@/domain/apresentacoes'
import { SlideConteudo, LARGURA, ALTURA } from './SlideView'

// 297 mm × 167 mm ≈ 16:9. Escala do slide (1280 px) para a largura da página (297 mm ≈ 1122 px).
const ESCALA = 1122.5 / LARGURA

export function ImpressaoApresentacao({ slides, modelo, tema, titulo, onFim }: { slides: SlideInstancia[]; modelo: ModeloApresentacao; tema: TemaApresentacao; titulo: string; onFim: () => void }) {
  useEffect(() => {
    const estilo = document.createElement('style')
    estilo.textContent = `
      @page { size: 297mm 167mm; margin: 0 }
      @media print {
        html, body { background: #fff !important; }
        body.imprimindo-deck #root { display: none !important; }
        body.imprimindo-deck #deck-print { display: block !important; }
        #deck-print .pagina { width: 297mm; height: 167mm; overflow: hidden; page-break-after: always; break-after: page; position: relative; }
        #deck-print .pagina:last-child { page-break-after: auto; break-after: auto; }
        #deck-print * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      }
      #deck-print { display: none; }`
    document.head.appendChild(estilo)
    document.body.classList.add('imprimindo-deck')
    const tituloAntes = document.title
    document.title = titulo
    const fim = () => onFim()
    window.addEventListener('afterprint', fim)
    const t = setTimeout(() => window.print(), 350)
    return () => { clearTimeout(t); window.removeEventListener('afterprint', fim); document.body.classList.remove('imprimindo-deck'); document.title = tituloAntes; estilo.remove() }
  }, [onFim, titulo])

  return createPortal(
    <div id="deck-print" aria-hidden>
      {slides.map((s, i) => (
        <div key={s.id} className="pagina">
          <div style={{ width: LARGURA, height: ALTURA, transform: `scale(${ESCALA})`, transformOrigin: 'top left' }}>
            <SlideConteudo slide={s} modelo={modelo} tema={tema} numero={i + 1} total={slides.length} />
          </div>
        </div>
      ))}
    </div>,
    document.body,
  )
}
