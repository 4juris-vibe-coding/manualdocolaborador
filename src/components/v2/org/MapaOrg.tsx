/* Mapa interativo de pessoas: cartões e conexões sobre o VisorMapa (enquadrar, ampliar, arrastar, focar). */
import { useImperativeHandle, useMemo, useRef, forwardRef } from 'react'
import { Avatar, Icon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { calcularLayout, MEDIDAS, type NoLayout } from './layoutArvore'
import { Conexoes, VisorMapa, estiloNo, type VisorHandle } from './VisorMapa'
import type { NoUI } from './tipos'
import { EtiquetasProduto, type ProdutoOrg } from './EtiquetasProduto'

export interface MapaHandle { centralizar: () => void; focar: (chave: string) => void }
interface Props {
  visiveis: { no: NoUI; nivel: number; paiChave: string | null }[]
  expandidos: Set<string>
  carregandoRamo: Set<string>
  faltaCarregar: (id: string) => boolean
  selecionado: string | null
  onSelecionar: (id: string) => void
  onAlternar: (id: string) => void
  produtos: ProdutoOrg[]
  /** Muda quando o recorte muda (filtros, expandir/recolher tudo): o mapa reenquadra. */
  chaveAjuste?: string
}

export const MapaOrg = forwardRef<MapaHandle, Props>(function MapaOrg({ visiveis, expandidos, carregandoRamo, faltaCarregar, selecionado, onSelecionar, onAlternar, produtos, chaveAjuste }, ref) {
  const visor = useRef<VisorHandle>(null)

  const layout = useMemo(() => {
    const porChave = new Map<string, NoLayout>()
    const raizes: NoLayout[] = []
    for (const v of visiveis) porChave.set(v.no.chave, { chave: v.no.chave, filhos: [] })
    for (const v of visiveis) {
      const n = porChave.get(v.no.chave)!
      if (v.paiChave && porChave.has(v.paiChave)) porChave.get(v.paiChave)!.filhos.push(n)
      else raizes.push(n)
    }
    return calcularLayout(raizes)
  }, [visiveis])
  const pos = useMemo(() => new Map(layout.nos.map((n) => [n.chave, n])), [layout])
  const porChave = useMemo(() => new Map(visiveis.map((v) => [v.no.chave, v.no])), [visiveis])

  useImperativeHandle(ref, () => ({
    centralizar: () => visor.current?.enquadrar(),
    focar: (chave: string) => { const p = pos.get(chave); if (p) visor.current?.focar({ x: p.x, y: p.y, w: MEDIDAS.largura, h: MEDIDAS.altura }) },
  }), [pos])

  return (
    <VisorMapa ref={visor} largura={layout.largura} altura={layout.altura} chaveAjuste={chaveAjuste} rotulo="Mapa do organograma">
          <Conexoes largura={layout.largura} altura={layout.altura} arestas={layout.arestas} />
          {layout.nos.map((p) => {
            const no = porChave.get(p.chave)
            if (!no) return null
            const estilo = estiloNo(p.x, p.y, MEDIDAS.largura, MEDIDAS.altura)
            if (no.tipo === 'vaga') {
              return (
                <div key={p.chave} style={estilo} className="absolute animate-scale-in rounded-xl border-2 border-dashed border-brand/50 bg-brand-50 px-3 py-2 flex flex-col justify-center">
                  <span className="text-[10px] font-bold uppercase tracking-wide text-brand-700 flex items-center gap-1"><Icon name="UserPlus" className="h-3 w-3" /> Posição vaga{no.vaga.abertas > 1 ? ` · ${no.vaga.abertas}` : ''}</span>
                  <span className="text-[13px] font-semibold text-ink truncate mt-0.5">{no.vaga.titulo}</span>
                  <span className="text-[11.5px] text-muted truncate">{[no.vaga.cargo, no.vaga.setor].filter(Boolean).join(' · ') || 'Vaga em aberto'}</span>
                </div>
              )
            }
            const c = no.pessoa
            const aberto = expandidos.has(c.id)
            const temFilhos = c.filhosNaVisao > 0 || faltaCarregar(c.id)
            return (
              <div key={p.chave} style={estilo} className="absolute animate-scale-in">
                <button
                  type="button"
                  onClick={() => onSelecionar(c.id)}
                  aria-label={`${c.apelido || c.nome}, ${c.cargo ?? 'sem função definida'}, ${c.setor ?? 'sem área'}. ${c.diretos} subordinados diretos. Abrir detalhes.`}
                  className={cn('h-full w-full text-left rounded-xl border bg-surface pl-2.5 pr-3 py-2 flex items-center gap-2.5 transition shadow-sm hover:shadow-md outline-none focus-visible:ring-2 focus-visible:ring-brand',
                    selecionado === c.id ? 'border-brand ring-2 ring-brand/30' : 'border-line', c.contexto && 'opacity-60 border-dashed')}
                  style={{ borderLeft: `4px solid ${c.setorCor ?? 'rgb(var(--c-line-strong))'}` }}
                >
                  <Avatar nome={c.nome} cor={c.avatarCor ?? undefined} size="md" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13px] font-bold text-ink truncate">{c.apelido || c.nome}</span>
                    <span className="block text-[11.5px] text-ink-2 truncate">{c.cargo ?? 'Função não definida'}</span>
                    <span className="block text-[11px] text-muted truncate">{c.setor ?? 'Sem área'}{c.diretos > 0 ? ` · ${c.diretos} direto${c.diretos > 1 ? 's' : ''}` : ''}</span>
                    <EtiquetasProduto ids={c.produtoIds} produtos={produtos} className="mt-1" />
                  </span>
                  {c.pendente && <Icon name="AlertTriangle" className="h-4 w-4 text-warning shrink-0 absolute top-2 right-2" aria-label="Cadastro com pendência" />}
                </button>
                {temFilhos && (
                  <button
                    type="button"
                    onClick={() => onAlternar(c.id)}
                    aria-expanded={aberto}
                    aria-label={`${aberto ? 'Recolher' : 'Expandir'} equipe de ${c.apelido || c.nome}`}
                    className={cn('absolute left-1/2 -bottom-3 -translate-x-1/2 h-6 min-w-6 px-1.5 rounded-full border text-[10.5px] font-bold flex items-center justify-center gap-0.5 outline-none focus-visible:ring-2 focus-visible:ring-brand transition hover:scale-110 active:scale-95',
                      aberto ? 'border-brand/40 bg-brand-50 text-brand-700' : 'border-line bg-surface text-ink-2 hover:bg-winter')}
                  >
                    {carregandoRamo.has(c.id) ? <Icon name="Loader2" className="h-3 w-3 animate-spin" /> : aberto ? <Icon name="Minus" className="h-3 w-3" /> : <>+{c.diretos || c.filhosNaVisao}</>}
                  </button>
                )}
              </div>
            )
          })}
    </VisorMapa>
  )
})
