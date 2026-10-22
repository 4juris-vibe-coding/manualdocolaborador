/* ============================================================
   4JURIS Pessoas · Utilidades de layout
   Áreas de trabalho (editores, mapas) ocupam a altura que sobra na
   janela, para que a página e a área não disputem a rolagem.
   ============================================================ */
import { useEffect, useState, type RefObject } from 'react'

/** Editores em tela cheia (como um app de design): sem menu lateral nem barra do portal; a página traz a própria barra. */
export const ehImersivo = (pathname: string) => /^\/canva\/[^/]+\/?$/.test(pathname)
/** Rotas cujo conteúdo é uma área de trabalho de altura da janela (sem respiro inferior nem botão flutuante por cima). */
export const ehAreaDeTrabalho = (pathname: string) => ehImersivo(pathname) || /^\/assistente\/?$/.test(pathname)
/** Áreas de trabalho que também aproveitam a largura toda (editores com painéis laterais). */
export const ehAreaLarga = (pathname: string) => ehImersivo(pathname)

/**
 * Altura (px) que vai do topo do elemento até o fim da janela, descontando `folga`.
 * Com a página no topo, o elemento termina exatamente no rodapé da janela: nada abaixo dele empurra a rolagem.
 * O topo é medido em coordenadas do documento, então rolar a página não altera o valor.
 */
export function useAlturaDisponivel(ref: RefObject<HTMLElement>, { min = 480, folga = 16 }: { min?: number; folga?: number } = {}) {
  const [altura, setAltura] = useState<number | null>(null)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const medir = () => {
      const topo = el.getBoundingClientRect().top + window.scrollY
      setAltura(Math.max(min, Math.floor(window.innerHeight - topo - folga)))
    }
    medir()
    window.addEventListener('resize', medir)
    // Avisos que aparecem/somem acima do elemento (modo demonstração, erro de sincronização) mudam o topo.
    const ro = new ResizeObserver(medir)
    ro.observe(document.body)
    return () => { window.removeEventListener('resize', medir); ro.disconnect() }
  }, [ref, min, folga])
  return altura
}

/* ---------- Entrada no sistema (login → visão geral) ---------- */
const CHAVE_ENTRADA = '4juris_entrada'
/** Marca que a próxima abertura do portal vem de um login: a casca do sistema entra animada. */
export function marcarEntrada() { try { sessionStorage.setItem(CHAVE_ENTRADA, '1') } catch { /* sem armazenamento: só não anima */ } }
/** Verdadeiro durante a animação de entrada que segue o login (lido uma vez e descartado). */
export function useEntradaAnimada(duracaoMs = 1100) {
  const [ativa, setAtiva] = useState(() => {
    try { const v = sessionStorage.getItem(CHAVE_ENTRADA) === '1'; sessionStorage.removeItem(CHAVE_ENTRADA); return v } catch { return false }
  })
  useEffect(() => { if (!ativa) return; const t = setTimeout(() => setAtiva(false), duracaoMs); return () => clearTimeout(t) }, [ativa, duracaoMs])
  return ativa
}
