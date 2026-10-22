/* ============================================================
   Dropdown no estilo 4JURIS — substitui o <select> nativo.
   Aceita os MESMOS props e filhos do <select> (<option>, <optgroup>,
   value/defaultValue, name, onChange(e), required, disabled, multiple),
   então a troca é só de tag. Para formulários não controlados, um input
   oculto carrega `name` e o valor (FormData e form.elements continuam
   funcionando); o onChange recebe um alvo com value, name, form e selectedOptions.
   Acessível: botão com aria-haspopup="listbox", lista com aria-activedescendant,
   setas/Home/End/Enter/Espaço/Esc/Tab e busca por digitação.
   ============================================================ */
import {
  Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type CSSProperties, type KeyboardEvent as KE, type ReactElement, type ReactNode,
} from 'react'
import { createPortal } from 'react-dom'
import { Icon } from '@/components/ui'
import { cn } from '@/lib/utils'
import { ehToque, travarRolagem, useFecharPeloFundo } from '@/lib/rolagem'

interface Opcao { valor: string; rotulo: ReactNode; texto: string; desabilitada: boolean; grupo?: string }

/** Texto puro de um nó (para busca e para o rótulo do botão). */
function textoDe(n: ReactNode): string {
  if (n === null || n === undefined || typeof n === 'boolean') return ''
  if (typeof n === 'string' || typeof n === 'number') return String(n)
  if (Array.isArray(n)) return n.map(textoDe).join('')
  if (isValidElement(n)) return textoDe((n.props as { children?: ReactNode }).children)
  return ''
}

function lerOpcoes(children: ReactNode, grupo?: string, out: Opcao[] = []): Opcao[] {
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return
    const el = c as ReactElement<any>
    if (el.type === 'option') {
      const rotulo = el.props.children
      out.push({ valor: String(el.props.value ?? textoDe(rotulo)), rotulo, texto: textoDe(rotulo), desabilitada: !!el.props.disabled, grupo })
    } else if (el.type === 'optgroup') {
      lerOpcoes(el.props.children, String(el.props.label ?? ''), out)
    } else if (el.props?.children !== undefined) {
      lerOpcoes(el.props.children, grupo, out) // Fragment e afins
    }
  })
  return out
}

const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase()
const BUSCA_A_PARTIR_DE = 9
/** Abaixo desta largura a lista abre como folha na base da tela (alvos grandes, longe das bordas e do teclado). */
const LARGURA_FOLHA = 640

export interface DropdownProps {
  value?: string | number | readonly string[] | null
  defaultValue?: string | number | readonly string[]
  onChange?: (e: { target: any; currentTarget: any }) => void
  name?: string
  id?: string
  className?: string
  disabled?: boolean
  required?: boolean
  multiple?: boolean
  placeholder?: string
  'aria-label'?: string
  'aria-describedby'?: string
  'aria-invalid'?: boolean | 'true' | 'false'
  title?: string
  children?: ReactNode
  /** Ignorados (compatibilidade com <select>). */
  size?: number
  autoFocus?: boolean
}

export function Dropdown({
  value, defaultValue, onChange, name, id, className, disabled, required, multiple, placeholder, children, title,
  'aria-label': ariaLabel, 'aria-describedby': ariaDescribedby, 'aria-invalid': ariaInvalid, autoFocus,
}: DropdownProps) {
  const opcoes = useMemo(() => lerOpcoes(children), [children])
  const controlado = value !== undefined
  const normal = (v: DropdownProps['value']): string[] => (v === undefined || v === null ? [] : Array.isArray(v) ? v.map(String) : [String(v)])
  const [interno, setInterno] = useState<string[]>(() => {
    const d = normal(defaultValue)
    // <select> sem valor mostra a primeira opção: replicamos para formulários não controlados.
    return d.length || multiple ? d : opcoes.length ? [opcoes[0].valor] : []
  })
  const sel = controlado ? normal(value) : interno

  const [aberto, setAberto] = useState(false)
  const [ativo, setAtivo] = useState(-1)
  const [busca, setBusca] = useState('')
  const [pos, setPos] = useState<CSSProperties>({})
  const [folha, setFolha] = useState(false)
  const folhaRef = useRef(false)
  folhaRef.current = folha
  // Tipo do último ponteiro no botão: mouse abre no mousedown (como o <select>); toque abre no click.
  const ponteiro = useRef<string>('mouse')
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const oculto = useRef<HTMLInputElement>(null)
  const campoBusca = useRef<HTMLInputElement>(null)
  const digitado = useRef({ txt: '', ate: 0 })
  const uid = useId()
  const listaId = `${uid}-lista`

  const comBusca = opcoes.length >= BUSCA_A_PARTIR_DE
  const visiveis = useMemo(() => {
    const q = semAcento(busca.trim())
    return q ? opcoes.filter((o) => semAcento(o.texto).includes(q)) : opcoes
  }, [opcoes, busca])

  const atual = opcoes.find((o) => o.valor === sel[0])
  const rotuloBotao: ReactNode = multiple
    ? (sel.length ? opcoes.filter((o) => sel.includes(o.valor)).map((o) => o.texto).join(', ') : '')
    : atual?.rotulo
  const vazio = multiple ? sel.length === 0 : !atual || atual.valor === ''

  const posicionar = useCallback(() => {
    if (folhaRef.current) { setPos({ left: 0, right: 0, bottom: 0, maxHeight: 'min(75vh, 75dvh)' }); return }
    const b = botao.current?.getBoundingClientRect()
    if (!b) return
    const alturaMax = 320
    const abaixo = window.innerHeight - b.bottom
    const paraCima = abaixo < Math.min(alturaMax, 220) && b.top > abaixo
    const largura = Math.max(b.width, 200)
    const left = Math.min(Math.max(8, b.left), window.innerWidth - largura - 8)
    setPos(paraCima
      ? { left, width: largura, bottom: window.innerHeight - b.top + 6, maxHeight: Math.min(alturaMax, b.top - 12) }
      : { left, width: largura, top: b.bottom + 6, maxHeight: Math.min(alturaMax, abaixo - 12) })
  }, [])

  const abrir = (v: boolean | ((a: boolean) => boolean)) => {
    const novo = typeof v === 'function' ? v(aberto) : v
    if (novo && !aberto) { const f = window.innerWidth < LARGURA_FOLHA; folhaRef.current = f; setFolha(f) }
    setAberto(novo)
  }
  useEffect(() => (aberto && folha ? travarRolagem() : undefined), [aberto, folha])
  const fundoFolha = useFecharPeloFundo(() => { setAberto(false) })

  useLayoutEffect(() => {
    if (!aberto) return
    posicionar()
    const q = requestAnimationFrame(posicionar) // o layout pode mudar logo após abrir (ex.: erro de validação de outro campo)
    return () => cancelAnimationFrame(q)
  }, [aberto, posicionar])
  useEffect(() => {
    if (!aberto) return
    const fora = (e: MouseEvent) => {
      if (folhaRef.current) return // na folha, quem fecha é o fundo (no click, sem clique fantasma)
      const t = e.target as Node
      if (!botao.current?.contains(t) && !lista.current?.contains(t)) setAberto(false)
    }
    const mover = (e: Event) => { if (!folhaRef.current && !lista.current?.contains(e.target as Node)) posicionar() }
    document.addEventListener('mousedown', fora)
    window.addEventListener('scroll', mover, true)
    window.addEventListener('resize', posicionar)
    return () => { document.removeEventListener('mousedown', fora); window.removeEventListener('scroll', mover, true); window.removeEventListener('resize', posicionar) }
  }, [aberto, posicionar])

  // Ao abrir: destaca a opção escolhida e foca a busca (quando houver).
  useEffect(() => {
    if (!aberto) { setBusca(''); return }
    setAtivo(Math.max(0, visiveis.findIndex((o) => o.valor === sel[0])))
    // Em tela de toque, focar a busca abriria o teclado por cima da lista: a pessoa toca na busca se quiser.
    if (comBusca && !ehToque()) setTimeout(() => campoBusca.current?.focus(), 0)
  }, [aberto]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { if (aberto && busca) setAtivo(visiveis.findIndex((o) => !o.desabilitada)) }, [busca]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (!aberto || ativo < 0) return
    lista.current?.querySelector(`[data-i="${ativo}"]`)?.scrollIntoView({ block: 'nearest' })
  }, [ativo, aberto])

  const emitir = (novos: string[]) => {
    if (!controlado) setInterno(novos)
    const el = oculto.current
    if (el) el.value = novos[0] ?? ''
    if (!onChange) return
    // Imita o <select> no evento: value, name, form (form.elements) e selectedOptions.
    const alvo = { value: novos[0] ?? '', name: name ?? '', form: el?.form ?? null, selectedOptions: novos.map((v) => ({ value: v })) }
    onChange({ target: alvo, currentTarget: alvo })
  }

  const escolher = (o: Opcao | undefined) => {
    if (!o || o.desabilitada) return
    if (multiple) { emitir(sel.includes(o.valor) ? sel.filter((v) => v !== o.valor) : [...sel, o.valor]); return }
    if (o.valor !== sel[0]) emitir([o.valor])
    setAberto(false)
    botao.current?.focus({ preventScroll: true })
  }

  const passo = (de: number, dir: 1 | -1) => {
    for (let i = de + dir; i >= 0 && i < visiveis.length; i += dir) if (!visiveis[i].desabilitada) return i
    return de
  }

  const teclado = (e: KE) => {
    if (disabled) return
    const k = e.key
    if (!aberto) {
      if (['ArrowDown', 'ArrowUp', 'Enter', ' '].includes(k)) { e.preventDefault(); abrir(true) }
      else if (k.length === 1 && !e.ctrlKey && !e.metaKey && !multiple) {
        // Digitação com a lista fechada troca a opção, como no <select>.
        const d = digitado.current
        d.txt = Date.now() < d.ate ? d.txt + k.toLowerCase() : k.toLowerCase(); d.ate = Date.now() + 700
        const o = opcoes.find((x) => !x.desabilitada && semAcento(x.texto).startsWith(semAcento(d.txt)))
        if (o && o.valor !== sel[0]) emitir([o.valor])
      }
      return
    }
    if (k === 'Escape') { e.preventDefault(); e.stopPropagation(); setAberto(false); botao.current?.focus() }
    else if (k === 'Tab') setAberto(false)
    else if (k === 'ArrowDown') { e.preventDefault(); setAtivo((a) => passo(a, 1)) }
    else if (k === 'ArrowUp') { e.preventDefault(); setAtivo((a) => passo(a, -1)) }
    else if (k === 'Home') { e.preventDefault(); setAtivo(passo(-1, 1)) }
    else if (k === 'End') { e.preventDefault(); setAtivo(passo(visiveis.length, -1)) }
    else if (k === 'Enter' || (k === ' ' && !comBusca)) { e.preventDefault(); escolher(visiveis[ativo]) }
  }

  // Agrupa as opções visíveis mantendo a ordem (cabeçalho quando muda o grupo).
  let grupoAnterior: string | undefined
  const itens = visiveis.map((o, i) => {
    const cab = o.grupo && o.grupo !== grupoAnterior
    grupoAnterior = o.grupo
    const marcado = sel.includes(o.valor)
    return (
      <div key={`${o.grupo ?? ''}|${o.valor}|${i}`}>
        {cab && <div role="presentation" className="px-3 pt-2.5 pb-1 text-[10.5px] font-bold uppercase tracking-[.08em] text-muted-2">{o.grupo}</div>}
        <div
          id={`${uid}-o${i}`} data-i={i} role="option" aria-selected={marcado} aria-disabled={o.desabilitada || undefined}
          onMouseEnter={() => !o.desabilitada && setAtivo(i)}
          onMouseDown={(e) => e.preventDefault()}
          onClick={() => escolher(o)}
          className={cn(
            'flex items-center gap-2.5 rounded-lg px-3 cursor-pointer select-none',
            folha ? 'min-h-[48px] py-2.5 text-[15px]' : 'py-2 text-[13px]',
            o.desabilitada ? 'text-muted-2 cursor-not-allowed' : 'text-ink',
            i === ativo && !o.desabilitada && 'bg-brand-50 text-brand-700',
            marcado && 'font-semibold',
          )}
        >
          {multiple && (
            <span className={cn('h-4 w-4 shrink-0 rounded border flex items-center justify-center', marcado ? 'bg-brand border-brand text-white' : 'border-line-strong')}>
              {marcado && <Icon name="Check" className="h-3 w-3" />}
            </span>
          )}
          <span className={cn('flex-1 min-w-0', o.valor === '' && !multiple && 'text-muted')}>{o.rotulo || ' '}</span>
          {!multiple && marcado && o.valor !== '' && <Icon name="Check" className="h-4 w-4 shrink-0 text-brand" />}
        </div>
      </div>
    )
  })

  return (
    <>
      <button
        ref={botao} id={id} type="button" data-dropdown disabled={disabled} title={title} autoFocus={autoFocus}
        role="combobox" aria-haspopup="listbox" aria-expanded={aberto} aria-controls={aberto ? listaId : undefined}
        aria-label={ariaLabel} aria-describedby={ariaDescribedby} aria-invalid={ariaInvalid} aria-required={required || undefined}
        aria-activedescendant={aberto && ativo >= 0 ? `${uid}-o${ativo}` : undefined}
        // Abre no mousedown, como o <select> nativo: se o blur de outro campo mostrar um erro e deslocar o layout,
        // o mouseup cai fora do botão e o click nunca aconteceria. O click só trata o vindo do <label> (detail 0).
        // No toque, os eventos de mouse chegam todos juntos no fim do toque: abrir no click evita que a lista abra e
        // a camada de fundo receba o mesmo toque (abre e fecha de uma vez).
        onPointerDown={(e) => { ponteiro.current = e.pointerType }}
        onMouseDown={(e) => { if (e.button !== 0 || disabled || ponteiro.current !== 'mouse') return; e.preventDefault(); botao.current?.focus(); abrir((a) => !a) }}
        onClick={(e) => { if ((e.detail === 0 || ponteiro.current !== 'mouse') && !disabled) abrir((a) => !a); ponteiro.current = 'mouse' }} onKeyDown={teclado}
        className={cn(
          'input flex items-center justify-between gap-2 text-left cursor-pointer',
          'hover:border-brand-300 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:border-line-strong',
          aberto && 'border-brand ring-1 ring-brand',
          className,
        )}
      >
        <span className={cn('truncate min-w-0', vazio && 'text-muted')}>{vazio ? (placeholder ?? (rotuloBotao || 'Selecione…')) : rotuloBotao}</span>
        <Icon name="ChevronDown" className={cn('h-4 w-4 shrink-0 text-muted transition-transform duration-200', aberto && 'rotate-180 text-brand')} />
      </button>
      <input
        ref={oculto} name={name} value={multiple ? sel.join(',') : sel[0] ?? ''} required={required} onChange={() => undefined}
        tabIndex={-1} aria-hidden className="sr-only" onInvalid={() => botao.current?.focus()}
      />
      {aberto && createPortal(
        <>
          {folha && <div className="fixed inset-0 z-[499] bg-midnight/40 animate-fade-in" {...fundoFolha} />}
        <div
          ref={lista} style={{ position: 'fixed', ...pos }} onKeyDown={teclado}
          className={cn('z-[500] flex flex-col border border-line bg-surface shadow-lg overflow-hidden',
            folha ? 'rounded-t-2xl animate-slide-up pb-[env(safe-area-inset-bottom)]' : 'rounded-xl animate-scale-in origin-top')}
        >
          {folha && (
            <div className="flex items-center justify-between gap-3 pl-4 pr-2 py-1.5 border-b border-line shrink-0">
              <span className="text-[14px] font-bold text-ink truncate">{ariaLabel ?? placeholder ?? 'Selecione'}</span>
              <button type="button" onClick={() => { setAberto(false); botao.current?.focus({ preventScroll: true }) }} className="h-11 px-3 rounded-xl text-[14px] font-semibold text-brand shrink-0">
                {multiple ? 'Concluir' : 'Fechar'}
              </button>
            </div>
          )}
          {comBusca && (
            <div className="p-2 border-b border-line">
              <div className="relative">
                <Icon name="Search" className="h-4 w-4 text-muted absolute left-2.5 top-1/2 -translate-y-1/2" />
                <input
                  ref={campoBusca} value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Buscar…" aria-label="Buscar opção"
                  aria-controls={listaId} aria-activedescendant={ativo >= 0 ? `${uid}-o${ativo}` : undefined}
                  type="search" enterKeyHint="search" autoComplete="off"
                  className={cn('w-full pl-8 pr-3 rounded-lg bg-surface-2 text-[13px] text-ink placeholder:text-muted-2 outline-none focus:ring-1 focus:ring-brand', folha ? 'h-11' : 'h-9')}
                />
              </div>
            </div>
          )}
          <div id={listaId} role="listbox" aria-multiselectable={multiple || undefined} aria-label={ariaLabel} className="overflow-y-auto p-1.5 overscroll-contain">
            {itens.length ? itens : <div className="px-3 py-2.5 text-[13px] text-muted">Nenhuma opção encontrada.</div>}
          </div>
        </div>
        </>,
        document.body,
      )}
    </>
  )
}
