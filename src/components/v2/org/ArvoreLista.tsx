/* Alternativa acessível e móvel ao mapa: árvore (role="tree") navegável por teclado. */
import { useEffect, useRef, useState } from 'react'
import { Avatar, Icon } from '@/components/ui'
import { cn } from '@/lib/utils'
import type { NoUI } from './tipos'
import { EtiquetasProduto, type ProdutoOrg } from './EtiquetasProduto'

interface Props {
  visiveis: { no: NoUI; nivel: number; paiChave: string | null }[]
  expandidos: Set<string>
  carregandoRamo: Set<string>
  faltaCarregar: (id: string) => boolean
  selecionado: string | null
  focoChave?: string | null
  onSelecionar: (id: string) => void
  onAlternar: (id: string) => void
  produtos: ProdutoOrg[]
}

export function ArvoreLista({ visiveis, expandidos, carregandoRamo, faltaCarregar, selecionado, focoChave, onSelecionar, onAlternar, produtos }: Props) {
  const [ativo, setAtivo] = useState<string | null>(null)
  const refs = useRef(new Map<string, HTMLDivElement>())
  const chaveAtiva = ativo && visiveis.some((v) => v.no.chave === ativo) ? ativo : visiveis[0]?.no.chave ?? null

  useEffect(() => { if (focoChave) { setAtivo(focoChave); refs.current.get(focoChave)?.scrollIntoView({ block: 'center' }) } }, [focoChave])

  const ir = (chave: string | undefined) => { if (!chave) return; setAtivo(chave); refs.current.get(chave)?.focus() }

  const teclado = (e: React.KeyboardEvent, i: number) => {
    const v = visiveis[i]
    const ehPessoa = v.no.tipo === 'pessoa'
    const id = ehPessoa ? v.no.chave : ''
    const temFilhos = ehPessoa && (v.no.tipo === 'pessoa' && (v.no.pessoa.filhosNaVisao > 0 || faltaCarregar(id)))
    switch (e.key) {
      case 'ArrowDown': ir(visiveis[i + 1]?.no.chave); break
      case 'ArrowUp': ir(visiveis[i - 1]?.no.chave); break
      case 'Home': ir(visiveis[0]?.no.chave); break
      case 'End': ir(visiveis[visiveis.length - 1]?.no.chave); break
      case 'ArrowRight':
        if (temFilhos && !expandidos.has(id)) onAlternar(id)
        else if (temFilhos) ir(visiveis[i + 1]?.paiChave === v.no.chave ? visiveis[i + 1].no.chave : undefined)
        break
      case 'ArrowLeft':
        if (temFilhos && expandidos.has(id)) onAlternar(id)
        else ir(v.paiChave ?? undefined)
        break
      case 'Enter': case ' ':
        if (ehPessoa) onSelecionar(id)
        break
      default: return
    }
    e.preventDefault()
  }

  if (!visiveis.length) return null
  return (
    <div role="tree" aria-label="Organograma em lista" className="rounded-2xl border border-line bg-surface divide-y divide-line">
      {visiveis.map((v, i) => {
        const chave = v.no.chave
        const pessoa = v.no.tipo === 'pessoa' ? v.no.pessoa : null
        const temFilhos = !!pessoa && (pessoa.filhosNaVisao > 0 || faltaCarregar(pessoa.id))
        const aberto = !!pessoa && expandidos.has(pessoa.id)
        return (
          <div
            key={chave} role="treeitem" aria-level={v.nivel + 1} aria-expanded={temFilhos ? aberto : undefined} aria-selected={pessoa ? selecionado === pessoa.id : undefined}
            ref={(el) => { if (el) refs.current.set(chave, el); else refs.current.delete(chave) }}
            tabIndex={chaveAtiva === chave ? 0 : -1}
            onFocus={() => setAtivo(chave)} onKeyDown={(e) => teclado(e, i)}
            className={cn('flex items-center gap-2 pr-3 py-2 outline-none focus-visible:bg-brand-50 focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand', pessoa && selecionado === pessoa.id && 'bg-brand-50')}
            style={{ paddingLeft: 8 + v.nivel * 20 }}
          >
            {temFilhos ? (
              <button type="button" tabIndex={-1} onClick={() => pessoa && onAlternar(pessoa.id)} aria-label={`${aberto ? 'Recolher' : 'Expandir'} equipe`} className="h-8 w-8 shrink-0 rounded-lg hover:bg-winter flex items-center justify-center text-muted">
                {pessoa && carregandoRamo.has(pessoa.id) ? <Icon name="Loader2" className="h-4 w-4 animate-spin" /> : <Icon name="ChevronRight" className={cn('h-4 w-4 transition-transform', aberto && 'rotate-90')} />}
              </button>
            ) : <span className="w-8 shrink-0" />}
            {pessoa ? (
              <button type="button" tabIndex={-1} onClick={() => onSelecionar(pessoa.id)} className={cn('flex items-center gap-3 min-w-0 flex-1 text-left', pessoa.contexto && 'opacity-60')}>
                <Avatar nome={pessoa.nome} cor={pessoa.avatarCor ?? undefined} size="sm" />
                <span className="min-w-0">
                  <span className="block text-[13.5px] font-semibold text-ink truncate">{pessoa.apelido || pessoa.nome}</span>
                  <span className="block text-[12px] text-muted truncate">{[pessoa.cargo, pessoa.setor].filter(Boolean).join(' · ') || 'Função e área não definidas'}</span>
                  <EtiquetasProduto ids={pessoa.produtoIds} produtos={produtos} className="mt-0.5" />
                </span>
                {pessoa.diretos > 0 && <span className="ml-auto text-[11.5px] text-muted shrink-0">{pessoa.diretos} direto{pessoa.diretos > 1 ? 's' : ''}</span>}
                {pessoa.pendente && <Icon name="AlertTriangle" className="h-4 w-4 text-warning shrink-0" aria-label="Cadastro com pendência" />}
              </button>
            ) : v.no.tipo === 'vaga' ? (
              <div className="flex items-center gap-3 min-w-0 flex-1 border-2 border-dashed border-brand/40 rounded-xl px-3 py-1.5 bg-brand-50">
                <Icon name="UserPlus" className="h-4 w-4 text-brand-700 shrink-0" />
                <span className="min-w-0">
                  <span className="block text-[13px] font-semibold text-ink truncate">Posição vaga · {v.no.vaga.titulo}{v.no.vaga.abertas > 1 ? ` (${v.no.vaga.abertas})` : ''}</span>
                  <span className="block text-[12px] text-muted truncate">{[v.no.vaga.cargo, v.no.vaga.setor].filter(Boolean).join(' · ') || 'Vaga em aberto'}</span>
                </span>
              </div>
            ) : null}
          </div>
        )
      })}
    </div>
  )
}
