/* ============================================================
   4JURIS Pessoas · Camadas por cima da página (modal, painel, menu)
   Trava a rolagem do fundo com contador: um modal aberto sobre um
   painel não destrava a página ao fechar. Fechar pelo fundo só vale
   quando o toque/clique COMEÇOU no fundo e terminou nele, e acontece
   no `click`: o toque é consumido pelo fundo e não "atravessa" para
   o botão que estava atrás (clique fantasma em telas de toque).
   ============================================================ */
import { useRef, type MouseEvent, type PointerEvent } from 'react'

let travas = 0
let anterior = ''

/** Trava a rolagem do documento enquanto houver camadas abertas. Devolve a função que destrava. */
export function travarRolagem(): () => void {
  if (travas++ === 0) {
    anterior = document.body.style.overflow
    document.body.style.overflow = 'hidden'
  }
  let solto = false
  return () => {
    if (solto) return
    solto = true
    if (--travas === 0) document.body.style.overflow = anterior
  }
}

/** Props para o fundo escurecido de uma camada: fecha só com toque/clique iniciado e terminado no próprio fundo. */
export function useFecharPeloFundo(fechar: () => void) {
  const comecouNoFundo = useRef(false)
  const ref = useRef(fechar)
  ref.current = fechar
  return {
    onPointerDown: (e: PointerEvent<HTMLElement>) => { comecouNoFundo.current = e.target === e.currentTarget },
    onClick: (e: MouseEvent<HTMLElement>) => {
      if (comecouNoFundo.current && e.target === e.currentTarget) ref.current()
      comecouNoFundo.current = false
    },
  }
}

/** Telas de toque (sem mouse): não abrimos o teclado virtual sozinhos nem dependemos de hover. */
export const ehToque = () => typeof window !== 'undefined' && !!window.matchMedia?.('(hover: none) and (pointer: coarse)').matches

/** Devolve o foco sem rolar a página até o elemento (evita o "pulo" ao fechar um modal no celular). */
export function devolverFoco(el: HTMLElement | null) {
  try { el?.focus?.({ preventScroll: true }) } catch { /* elemento saiu da página */ }
}
