/* ============================================================
   4juris Canva · formatos de arte e tipos de design
   ------------------------------------------------------------
   Um "design" é uma Apresentacao do store. O tipo vem do modeloId:
     "arte:<L>x<A>"          → arte de composição livre (public/4juris-canva-arte.html)
     "editor-livre[:modelo]" → apresentação no editor de layouts (public/4jurisday-apresentacao.html)
     qualquer outro          → apresentação por formulário (modelos de campos)
   Mantenha os formatos iguais ao PRESETS do HTML da arte.
   ============================================================ */
import type { Apresentacao } from '@/lib/types'
import { ehEditorLivre } from './apresentacoes.js'

export interface FormatoArte { id: string; nome: string; desc: string; w: number; h: number; icone: string }

export const FORMATOS_ARTE: FormatoArte[] = [
  { id: '1x1', nome: 'Post quadrado', desc: '1:1 · 1080×1080', w: 1080, h: 1080, icone: 'Square' },
  { id: '4x5', nome: 'Post retrato', desc: '4:5 · 1080×1350', w: 1080, h: 1350, icone: 'Image' },
  { id: '9x16', nome: 'Story / Reels', desc: '9:16 · 1080×1920', w: 1080, h: 1920, icone: 'Smartphone' },
  { id: '16x9', nome: 'Arte horizontal', desc: '16:9 · 1920×1080', w: 1920, h: 1080, icone: 'Monitor' },
  { id: '3x1', nome: 'Banner', desc: '3:1 · 1800×600', w: 1800, h: 600, icone: 'LayoutTemplate' },
  { id: 'a4', nome: 'A4 retrato', desc: '210×297 mm · 1240×1754', w: 1240, h: 1754, icone: 'FileText' },
]

export const TAMANHO_MIN = 100
export const TAMANHO_MAX = 5000

export const ehArte = (modeloId: string) => modeloId.startsWith('arte:')
export const modeloIdArte = (w: number, h: number) => `arte:${Math.round(w)}x${Math.round(h)}`
export function tamanhoDe(modeloId: string): { w: number; h: number } {
  const m = /^arte:(\d+)x(\d+)$/.exec(modeloId)
  return m ? { w: +m[1], h: +m[2] } : { w: 1080, h: 1080 }
}

export type TipoDesign = 'arte' | 'apresentacao'
export const tipoDeDesign = (a: Pick<Apresentacao, 'modeloId'>): TipoDesign => (ehArte(a.modeloId) ? 'arte' : 'apresentacao')
/** O design vive num HTML embutido (iframe), e não nos campos do store? */
export const ehEmbutido = (a: Pick<Apresentacao, 'modeloId'>) => ehArte(a.modeloId) || ehEditorLivre(a.modeloId)
export const urlEditor = (a: Pick<Apresentacao, 'modeloId'>) => `${import.meta.env.BASE_URL}${ehArte(a.modeloId) ? '4juris-canva-arte' : '4jurisday-apresentacao'}.html?embed=1`
