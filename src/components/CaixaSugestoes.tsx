/* Botão flutuante: a caixa de sugestões fica sempre ao alcance, em qualquer tela. */
import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { SugestaoForm } from '@/components/SugestaoForm'

export function CaixaSugestoes() {
  const [aberto, setAberto] = useState(false)
  const { pathname } = useLocation()
  if (pathname.startsWith('/canva/')) return null // não cobre o editor
  return (
    <>
      <button type="button" onClick={() => setAberto(true)} aria-label="Enviar sugestão anônima"
        className="no-print fixed bottom-5 right-5 z-[90] h-12 pl-3.5 pr-4 rounded-full bg-brand text-white font-semibold text-[13px] flex items-center gap-2 shadow-sm hover:bg-brand-600 transition focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">
        <Icon name="Lightbulb" className="h-[18px] w-[18px]" /><span className="hidden sm:inline">Sugestão</span>
      </button>
      {aberto && <SugestaoForm onClose={() => setAberto(false)} />}
    </>
  )
}
