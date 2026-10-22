/* Botão flutuante: a caixa de sugestões fica sempre ao alcance, em qualquer tela. */
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { SugestaoForm } from '@/components/SugestaoForm'
import { cn } from '@/lib/utils'

/** No celular/tablet, o botão sai da frente ao rolar para baixo e enquanto se digita (teclado aberto), para não cobrir
 *  o botão de envio de formulários no canto inferior; volta ao rolar para cima. */
function useSaiDaFrente() {
  const [oculto, setOculto] = useState(false)
  useEffect(() => {
    const estreito = () => window.innerWidth < 1024
    const digitando = () => { const a = document.activeElement as HTMLElement | null; return !!a && (a.matches('input:not([type=checkbox]):not([type=radio]):not([type=button]):not([type=submit]), textarea, select') || a.isContentEditable) }
    let ultimo = window.scrollY
    const rolar = () => {
      const y = window.scrollY
      if (!estreito()) setOculto(false)
      else if (y > ultimo + 6 && y > 60) setOculto(true)
      else if (y < ultimo - 6 && !digitando()) setOculto(false)
      ultimo = y
    }
    const foco = () => { if (estreito()) setOculto(digitando()) }
    const saiu = () => { setTimeout(foco, 0) } // o foco ainda não chegou ao próximo elemento no focusout
    window.addEventListener('scroll', rolar, { passive: true })
    document.addEventListener('focusin', foco)
    document.addEventListener('focusout', saiu)
    return () => { window.removeEventListener('scroll', rolar); document.removeEventListener('focusin', foco); document.removeEventListener('focusout', saiu) }
  }, [])
  return [oculto, setOculto] as const
}

export function CaixaSugestoes() {
  const [aberto, setAberto] = useState(false)
  const [oculto, setOculto] = useSaiDaFrente()
  const { pathname } = useLocation()
  if (pathname.startsWith('/canva/')) return null // não cobre o editor
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} onFocus={() => setOculto(false)} aria-label="Enviar sugestão anônima"
        className={cn(oculto && 'translate-y-[calc(100%+2rem)] opacity-0 pointer-events-none', "no-print fixed bottom-[max(1.25rem,env(safe-area-inset-bottom))] right-[max(1.25rem,env(safe-area-inset-right))] z-[90] h-12 min-w-12 pl-3.5 pr-3.5 sm:pr-4 rounded-full bg-brand text-white font-semibold text-[13px] flex items-center gap-2 shadow-sm hover:bg-brand-600 transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 duration-200")}>
        <Icon name="Lightbulb" className="h-[18px] w-[18px]" /><span className="hidden sm:inline">Sugestão</span>
      </button>
      {aberto && <SugestaoForm onClose={() => setAberto(false)} />}
    </>
  )
}
