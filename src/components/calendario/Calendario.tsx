/* Calendário reutilizável: visões Mês, Semana, Dia (grade por hora) e Lista.
   Recebe eventos já normalizados (EventoCal) e devolve o clique para a tela abrir o detalhe dela.
   No celular: o mês fica compacto (pontinhos + lista do dia escolhido) e a semana vira dia. */
import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { Icon } from '@/components/ui'
import { cn } from '@/lib/utils'
import {
  dataDe, diasDaSemana, diasDoEvento, ehDiaInteiro, eventosDoDia, gradeMes, horaTexto, isoDia, layoutDia, minutosDoDia, moverRef, tituloPeriodo,
  type EventoCal, type Vista,
} from './logica'

export type { EventoCal, Vista } from './logica'

export interface ExtraDoDia { id: string; texto: string }
export interface PropsCalendario {
  eventos: EventoCal[]
  onAbrir?: (id: string) => void
  /** Clique num dia/horário livre (ex.: criar evento já com a data). */
  onCriar?: (dia: string, hora?: string) => void
  vistas?: Vista[]
  vistaInicial?: Vista
  refInicial?: string
  /** Hora em que a grade abre rolada (dia/semana). */
  horaFoco?: number
  /** Itens informativos por dia (ex.: aniversários), mostrados no mês e na lista. */
  extrasDoDia?: (dia: string) => ExtraDoDia[]
  legenda?: { rotulo: string; cor: string }[]
  /** Botões extras no cabeçalho (à direita das vistas). */
  acoes?: ReactNode
  rodape?: ReactNode
  textoVazio?: string
  className?: string
}

const ROTULO_VISTA: Record<Vista, { rotulo: string; icone: string }> = {
  mes: { rotulo: 'Mês', icone: 'CalendarDays' }, semana: { rotulo: 'Semana', icone: 'CalendarRange' },
  dia: { rotulo: 'Dia', icone: 'CalendarClock' }, lista: { rotulo: 'Lista', icone: 'List' },
}
const SEMANA_CURTA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']
const ALTURA_HORA = 52
const MAX_NO_MES = 3

function useCelular() {
  const consulta = '(max-width: 767px)'
  const [cel, setCel] = useState(() => typeof window !== 'undefined' && !!window.matchMedia?.(consulta).matches)
  useEffect(() => {
    const m = window.matchMedia?.(consulta)
    if (!m) return
    const f = () => setCel(m.matches)
    m.addEventListener?.('change', f)
    return () => m.removeEventListener?.('change', f)
  }, [])
  return cel
}
function useAgora() {
  const [agora, setAgora] = useState(() => new Date())
  useEffect(() => { const t = setInterval(() => setAgora(new Date()), 60_000); return () => clearInterval(t) }, [])
  return agora
}

/** Fundo suave na cor do evento (funciona no tema claro e escuro). */
const tinta = (cor: string, alfa = '24') => (/^#[0-9a-f]{6}$/i.test(cor) ? `${cor}${alfa}` : cor)

export function Calendario({
  eventos, onAbrir, onCriar, vistas = ['mes', 'semana', 'dia', 'lista'], vistaInicial = 'mes', refInicial, horaFoco = 8,
  extrasDoDia, legenda, acoes, rodape, textoVazio = 'Nada agendado neste período.', className,
}: PropsCalendario) {
  const hoje = isoDia(new Date())
  const [vista, setVista] = useState<Vista>(vistas.includes(vistaInicial) ? vistaInicial : vistas[0])
  const [ref, setRef] = useState(refInicial ?? hoje)
  const celular = useCelular()
  // No celular a semana não cabe: mostra o dia.
  const efetiva: Vista = celular && vista === 'semana' ? 'dia' : vista
  const abrirDia = (dia: string) => { setRef(dia); if (vistas.includes('dia')) setVista('dia') }

  return (
    <section className={cn('bg-surface border border-line rounded-2xl shadow-xs overflow-hidden', className)} aria-label="Calendário">
      <header className="flex flex-wrap items-center gap-2 px-3 sm:px-4 py-3 border-b border-line">
        <div className="flex items-center gap-1">
          <button type="button" onClick={() => setRef(hoje)} className="h-9 px-3 rounded-lg border border-line text-[12.5px] font-semibold text-ink hover:bg-surface-2 transition outline-none focus-visible:ring-2 focus-visible:ring-brand">Hoje</button>
          <button type="button" aria-label="Período anterior" onClick={() => setRef((r) => moverRef(r, efetiva, -1))} className="h-9 w-9 rounded-lg text-ink-2 hover:bg-surface-2 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand"><Icon name="ChevronLeft" className="h-[18px] w-[18px]" /></button>
          <button type="button" aria-label="Próximo período" onClick={() => setRef((r) => moverRef(r, efetiva, 1))} className="h-9 w-9 rounded-lg text-ink-2 hover:bg-surface-2 flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand"><Icon name="ChevronRight" className="h-[18px] w-[18px]" /></button>
        </div>
        <h2 className="text-[15.5px] sm:text-[17px] font-bold text-ink tracking-tight mr-auto" aria-live="polite">{tituloPeriodo(ref, efetiva === 'lista' ? 'mes' : efetiva)}</h2>
        {vistas.length > 1 && (
          <div className="inline-flex rounded-xl bg-surface-2 border border-line p-0.5" role="group" aria-label="Visualização do calendário">
            {vistas.map((v) => (
              <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)}
                className={cn('h-8 px-2.5 sm:px-3 rounded-[10px] text-[12.5px] font-semibold flex items-center gap-1.5 transition outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  vista === v ? 'bg-surface text-ink shadow-xs' : 'text-muted hover:text-ink', v === 'semana' && 'hidden md:flex')}>
                <Icon name={ROTULO_VISTA[v].icone} className="h-4 w-4" /><span className="hidden sm:inline">{ROTULO_VISTA[v].rotulo}</span>
              </button>
            ))}
          </div>
        )}
        {acoes}
      </header>

      {efetiva === 'mes' && (celular
        ? <MesCompacto refDia={ref} hoje={hoje} eventos={eventos} extrasDoDia={extrasDoDia} onAbrir={onAbrir} onEscolher={setRef} />
        : <Mes refDia={ref} hoje={hoje} eventos={eventos} extrasDoDia={extrasDoDia} onAbrir={onAbrir} onMais={abrirDia} onCriar={onCriar} />)}
      {(efetiva === 'semana' || efetiva === 'dia') && (
        <GradeHoras dias={efetiva === 'semana' ? diasDaSemana(ref) : [ref]} hoje={hoje} eventos={eventos} onAbrir={onAbrir} onCriar={onCriar} horaFoco={horaFoco}
          onCabecalho={efetiva === 'semana' ? abrirDia : undefined} />
      )}
      {efetiva === 'lista' && <Lista refDia={ref} hoje={hoje} eventos={eventos} extrasDoDia={extrasDoDia} onAbrir={onAbrir} textoVazio={textoVazio} />}

      {(legenda?.length || rodape) && (
        <footer className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2.5 border-t border-line text-[11.5px] text-muted">
          {legenda?.map((l) => <span key={l.rotulo} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full" style={{ background: l.cor }} aria-hidden />{l.rotulo}</span>)}
          {rodape && <span className="sm:ml-auto">{rodape}</span>}
        </footer>
      )}
    </section>
  )
}

/* ---------- Mês ---------- */
function ChipEvento({ e, onAbrir }: { e: EventoCal; onAbrir?: (id: string) => void; dia?: string }) {
  // Dia inteiro ou vários dias: faixa colorida; com horário: ponto + hora.
  const [ini, fim] = diasDoEvento(e)
  const inteiro = ehDiaInteiro(e) || ini !== fim
  return (
    <button type="button" onClick={(ev) => { ev.stopPropagation(); onAbrir?.(e.id) }} title={`${e.titulo}${e.subtitulo ? ` · ${e.subtitulo}` : ''}`}
      className={cn('w-full flex items-center gap-1.5 text-left text-[11.5px] leading-tight rounded-md px-1.5 py-[3px] truncate transition hover:brightness-95 outline-none focus-visible:ring-2 focus-visible:ring-brand',
        e.cancelado && 'line-through opacity-60')}
      style={inteiro ? { background: tinta(e.cor, '2e'), boxShadow: `inset 3px 0 0 ${e.cor}` } : undefined}>
      {!inteiro && <span className="h-2 w-2 rounded-full shrink-0" style={{ background: e.cor }} aria-hidden />}
      {!inteiro && <span className="text-muted tabular-nums shrink-0">{horaTexto(e.inicio)}</span>}
      <span className="font-semibold text-ink truncate">{e.titulo}</span>
    </button>
  )
}

function Mes({ refDia, hoje, eventos, extrasDoDia, onAbrir, onMais, onCriar }: {
  refDia: string; hoje: string; eventos: EventoCal[]; extrasDoDia?: (d: string) => ExtraDoDia[]; onAbrir?: (id: string) => void; onMais: (d: string) => void; onCriar?: (d: string) => void
}) {
  const ref = dataDe(refDia)
  const mes = ref.getMonth()
  const dias = useMemo(() => gradeMes(ref.getFullYear(), mes + 1), [ref.getFullYear(), mes]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="grid grid-cols-7" role="grid" aria-label="Mês">
      {SEMANA_CURTA.map((d) => <div key={d} role="columnheader" className="text-[10.5px] font-bold uppercase tracking-wider text-muted text-center py-2 border-b border-line bg-surface-2/70">{d}</div>)}
      {dias.map((dia, i) => {
        const fora = dataDe(dia).getMonth() !== mes
        const evs = eventosDoDia(eventos, dia)
        const extras = extrasDoDia?.(dia) ?? []
        const itens = evs.length + extras.length
        const visiveis = itens > MAX_NO_MES ? MAX_NO_MES - 1 : MAX_NO_MES
        const ehHoje = dia === hoje
        const fimDeSemana = i % 7 === 0 || i % 7 === 6
        return (
          <div key={dia} role="gridcell" aria-label={dataDe(dia).toLocaleDateString('pt-BR', { day: 'numeric', month: 'long' })}
            onDoubleClick={onCriar ? () => onCriar(dia) : undefined}
            className={cn('group relative min-h-[118px] border-b border-r border-line p-1.5 flex flex-col gap-1 transition-colors',
              (i + 1) % 7 === 0 && 'border-r-0', fora ? 'bg-surface-2/50' : fimDeSemana ? 'bg-surface-2/25' : '', ehHoje && 'bg-brand-50/50')}>
            <div className="flex items-center justify-between">
              <button type="button" onClick={() => onMais(dia)} aria-label={`Abrir o dia ${dataDe(dia).getDate()}`}
                className={cn('h-7 min-w-7 px-1 rounded-full text-[12.5px] font-bold flex items-center justify-center transition outline-none focus-visible:ring-2 focus-visible:ring-brand',
                  ehHoje ? 'bg-brand text-white shadow-sm' : fora ? 'text-muted/70 hover:bg-surface-2' : 'text-ink-2 hover:bg-surface-2')}>{dataDe(dia).getDate()}</button>
              {onCriar && <button type="button" onClick={() => onCriar(dia)} aria-label="Criar neste dia"
                className="h-6 w-6 rounded-md text-muted opacity-0 group-hover:opacity-100 focus-visible:opacity-100 hover:bg-surface-2 hover:text-brand flex items-center justify-center transition outline-none focus-visible:ring-2 focus-visible:ring-brand"><Icon name="Plus" className="h-3.5 w-3.5" /></button>}
            </div>
            <div className={cn('space-y-[3px] min-w-0', fora && 'opacity-60')}>
              {evs.slice(0, visiveis).map((e) => <ChipEvento key={e.id} e={e} dia={dia} onAbrir={onAbrir} />)}
              {extras.slice(0, Math.max(0, visiveis - evs.length)).map((x) => <div key={x.id} className="text-[11.5px] text-ink-2 truncate px-1.5">{x.texto}</div>)}
              {itens > visiveis && <button type="button" onClick={() => onMais(dia)} className="text-[11.5px] font-semibold text-brand hover:underline px-1.5 outline-none focus-visible:underline">+{itens - visiveis} mais</button>}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function MesCompacto({ refDia, hoje, eventos, extrasDoDia, onAbrir, onEscolher }: {
  refDia: string; hoje: string; eventos: EventoCal[]; extrasDoDia?: (d: string) => ExtraDoDia[]; onAbrir?: (id: string) => void; onEscolher: (d: string) => void
}) {
  const ref = dataDe(refDia)
  const mes = ref.getMonth()
  const dias = gradeMes(ref.getFullYear(), mes + 1)
  const doDia = eventosDoDia(eventos, refDia)
  const extras = extrasDoDia?.(refDia) ?? []
  return (
    <>
      <div className="grid grid-cols-7 px-2 pt-2 pb-3 border-b border-line">
        {SEMANA_CURTA.map((d) => <div key={d} className="text-[10px] font-bold uppercase text-muted text-center pb-1.5">{d.slice(0, 1)}</div>)}
        {dias.map((dia) => {
          const evs = eventosDoDia(eventos, dia)
          const sel = dia === refDia
          const fora = dataDe(dia).getMonth() !== mes
          return (
            <button key={dia} type="button" onClick={() => onEscolher(dia)} aria-pressed={sel} aria-label={`${dataDe(dia).getDate()}${evs.length ? `, ${evs.length} item(ns)` : ''}`}
              className="flex flex-col items-center gap-0.5 py-1 outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg">
              <span className={cn('h-8 w-8 rounded-full text-[13px] font-semibold flex items-center justify-center transition',
                sel ? 'bg-ink text-surface' : dia === hoje ? 'bg-brand text-white' : fora ? 'text-muted/60' : 'text-ink')}>{dataDe(dia).getDate()}</span>
              <span className="flex gap-0.5 h-1.5">{evs.slice(0, 3).map((e) => <span key={e.id} className="h-1.5 w-1.5 rounded-full" style={{ background: e.cor }} />)}{!evs.length && (extrasDoDia?.(dia).length ?? 0) > 0 && <span className="h-1.5 w-1.5 rounded-full bg-gold" />}</span>
            </button>
          )
        })}
      </div>
      <div className="p-3">
        <p className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">{dataDe(refDia).toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' })}</p>
        {!doDia.length && !extras.length ? <p className="text-[13px] text-muted py-3">Nada neste dia.</p> : (
          <ul className="space-y-2">
            {doDia.map((e) => <li key={e.id}><LinhaEvento e={e} onAbrir={onAbrir} /></li>)}
            {extras.map((x) => <li key={x.id} className="text-[13px] text-ink-2 px-1">{x.texto}</li>)}
          </ul>
        )}
      </div>
    </>
  )
}

/* ---------- Semana / Dia ---------- */
function GradeHoras({ dias, hoje, eventos, onAbrir, onCriar, horaFoco, onCabecalho }: {
  dias: string[]; hoje: string; eventos: EventoCal[]; onAbrir?: (id: string) => void; onCriar?: (d: string, h?: string) => void; horaFoco: number; onCabecalho?: (d: string) => void
}) {
  const rolagem = useRef<HTMLDivElement>(null)
  const agora = useAgora()
  const umDia = dias.length === 1
  useEffect(() => { if (rolagem.current) rolagem.current.scrollTop = Math.max(0, horaFoco * ALTURA_HORA - 8) }, [horaFoco, umDia])
  const colunas = `56px repeat(${dias.length}, minmax(0, 1fr))`
  const inteiros = dias.map((d) => eventosDoDia(eventos, d).filter(ehDiaInteiro))
  const temInteiros = inteiros.some((l) => l.length)

  return (
    <div>
      {/* Cabeçalho com os dias */}
      <div className="grid border-b border-line bg-surface-2/60" style={{ gridTemplateColumns: colunas }}>
        <div />
        {dias.map((d) => {
          const dt = dataDe(d)
          const ehHoje = d === hoje
          const conteudo = <>
            <span className={cn('text-[10.5px] font-bold uppercase tracking-wider', ehHoje ? 'text-brand' : 'text-muted')}>{dt.toLocaleDateString('pt-BR', { weekday: umDia ? 'long' : 'short' }).replace('.', '')}</span>
            <span className={cn('mt-0.5 h-8 min-w-8 px-1.5 rounded-full text-[17px] font-bold flex items-center justify-center', ehHoje ? 'bg-brand text-white' : 'text-ink')}>{dt.getDate()}</span>
          </>
          return onCabecalho
            ? <button key={d} type="button" onClick={() => onCabecalho(d)} aria-label={`Abrir ${dt.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric' })}`} className="py-2 flex flex-col items-center border-l border-line hover:bg-surface-2 transition outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-brand">{conteudo}</button>
            : <div key={d} className={cn('py-2 flex flex-col border-l border-line', umDia ? 'items-start px-3' : 'items-center')}>{conteudo}</div>
        })}
      </div>
      {/* Faixa de eventos de dia inteiro */}
      {temInteiros && (
        <div className="grid border-b border-line" style={{ gridTemplateColumns: colunas }}>
          <div className="text-[10px] text-muted text-right pr-2 pt-1.5">dia todo</div>
          {inteiros.map((lista, i) => (
            <div key={dias[i]} className="border-l border-line p-1 space-y-[3px] min-w-0">
              {lista.map((e) => <ChipEvento key={e.id} e={{ ...e, diaInteiro: true }} dia={dias[i]} onAbrir={onAbrir} />)}
            </div>
          ))}
        </div>
      )}
      {/* Grade de horas */}
      <div ref={rolagem} className="relative overflow-y-auto max-h-[620px] overscroll-contain">
        <div className="grid relative" style={{ gridTemplateColumns: colunas, height: 24 * ALTURA_HORA }}>
          <div className="relative">
            {Array.from({ length: 24 }, (_, h) => (
              <span key={h} className="absolute right-2 -translate-y-1/2 text-[10.5px] text-muted tabular-nums" style={{ top: h * ALTURA_HORA }}>{h ? `${String(h).padStart(2, '0')}:00` : ''}</span>
            ))}
          </div>
          {dias.map((d) => {
            const pos = layoutDia(eventosDoDia(eventos, d), d)
            const ehHoje = d === hoje
            return (
              <div key={d} className={cn('relative border-l border-line', ehHoje && 'bg-brand-50/30')}
                onClick={onCriar ? (ev) => {
                  if (ev.target !== ev.currentTarget) return
                  const y = ev.nativeEvent.offsetY
                  const h = Math.min(23, Math.floor(y / ALTURA_HORA))
                  onCriar(d, `${String(h).padStart(2, '0')}:00`)
                } : undefined}>
                {Array.from({ length: 24 }, (_, h) => <div key={h} className="absolute inset-x-0 border-t border-line/70 pointer-events-none" style={{ top: h * ALTURA_HORA }} />)}
                {Array.from({ length: 24 }, (_, h) => <div key={`m${h}`} className="absolute inset-x-0 border-t border-dashed border-line/40 pointer-events-none" style={{ top: h * ALTURA_HORA + ALTURA_HORA / 2 }} />)}
                {pos.map(({ evento: e, inicioMin, fimMin, coluna, colunas: n }) => {
                  const altura = Math.max(((fimMin - inicioMin) / 60) * ALTURA_HORA - 2, 20)
                  const curto = altura < 40
                  return (
                    <button key={e.id} type="button" onClick={() => onAbrir?.(e.id)} title={`${e.titulo} · ${horaTexto(e.inicio)}${e.fim ? `–${horaTexto(e.fim)}` : ''}`}
                      className={cn('absolute rounded-lg text-left overflow-hidden px-2 py-1 border-l-[3px] shadow-xs hover:shadow-md hover:z-10 transition outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:z-10',
                        e.cancelado && 'opacity-55 line-through')}
                      style={{ top: (inicioMin / 60) * ALTURA_HORA + 1, height: altura, left: `calc(${(coluna / n) * 100}% + 2px)`, width: `calc(${100 / n}% - 4px)`, background: tinta(e.cor, '26'), borderLeftColor: e.cor }}>
                      <span className={cn('block font-semibold text-ink leading-tight', curto ? 'text-[11px] truncate' : 'text-[12px] line-clamp-2')}>
                        {curto && <span className="tabular-nums text-muted font-medium mr-1">{horaTexto(e.inicio)}</span>}{e.titulo}
                      </span>
                      {!curto && <span className="block text-[11px] text-ink-2 tabular-nums mt-0.5">{horaTexto(e.inicio)}{e.fim ? ` – ${horaTexto(e.fim)}` : ''}</span>}
                      {!curto && umDia && e.subtitulo && <span className="block text-[11px] text-muted truncate">{e.subtitulo}</span>}
                    </button>
                  )
                })}
                {ehHoje && (
                  <div className="absolute inset-x-0 z-20 pointer-events-none flex items-center" style={{ top: (minutosDoDia(agora) / 60) * ALTURA_HORA }} aria-hidden>
                    <span className="h-2.5 w-2.5 -ml-[5px] rounded-full bg-danger" /><span className="flex-1 h-[2px] bg-danger" />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

/* ---------- Lista ---------- */
function LinhaEvento({ e, onAbrir }: { e: EventoCal; onAbrir?: (id: string) => void }) {
  return (
    <button type="button" onClick={() => onAbrir?.(e.id)}
      className={cn('w-full flex items-stretch gap-3 text-left rounded-xl border border-line bg-surface hover:border-brand/40 hover:shadow-xs transition p-2.5 outline-none focus-visible:ring-2 focus-visible:ring-brand', e.cancelado && 'opacity-60')}>
      <span className="w-1 rounded-full shrink-0" style={{ background: e.cor }} aria-hidden />
      <span className="w-[74px] shrink-0 text-[12px] text-ink-2 tabular-nums pt-0.5">{ehDiaInteiro(e) ? 'Dia todo' : <>{horaTexto(e.inicio)}{e.fim && <span className="block text-muted">{horaTexto(e.fim)}</span>}</>}</span>
      <span className="min-w-0 flex-1">
        <span className={cn('block text-[13.5px] font-semibold text-ink truncate', e.cancelado && 'line-through')}>{e.titulo}</span>
        {e.subtitulo && <span className="block text-[12px] text-muted truncate">{e.subtitulo}</span>}
      </span>
    </button>
  )
}

function Lista({ refDia, hoje, eventos, extrasDoDia, onAbrir, textoVazio }: {
  refDia: string; hoje: string; eventos: EventoCal[]; extrasDoDia?: (d: string) => ExtraDoDia[]; onAbrir?: (id: string) => void; textoVazio: string
}) {
  const ref = dataDe(refDia)
  const dias = gradeMes(ref.getFullYear(), ref.getMonth() + 1).filter((d) => dataDe(d).getMonth() === ref.getMonth())
  const comItens = dias.map((d) => ({ d, evs: eventosDoDia(eventos, d), extras: extrasDoDia?.(d) ?? [] })).filter((x) => x.evs.length || x.extras.length)
  if (!comItens.length) return <p className="text-[13px] text-muted text-center py-12">{textoVazio}</p>
  return (
    <ol className="divide-y divide-line">
      {comItens.map(({ d, evs, extras }) => {
        const dt = dataDe(d)
        const ehHoje = d === hoje
        return (
          <li key={d} className={cn('flex gap-3 sm:gap-4 px-3 sm:px-4 py-3', d < hoje && 'opacity-75')}>
            <div className={cn('h-12 w-12 rounded-2xl flex flex-col items-center justify-center shrink-0 leading-none', ehHoje ? 'bg-brand text-white' : 'bg-surface-2 text-ink border border-line')}>
              <span className="text-[17px] font-extrabold">{dt.getDate()}</span>
              <span className="text-[9.5px] font-bold uppercase mt-0.5">{dt.toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '')}</span>
            </div>
            <div className="flex-1 min-w-0 space-y-1.5">
              {evs.map((e) => <LinhaEvento key={e.id} e={e} onAbrir={onAbrir} />)}
              {extras.map((x) => <div key={x.id} className="text-[12.5px] text-ink-2 px-1">{x.texto}</div>)}
            </div>
          </li>
        )
      })}
    </ol>
  )
}
