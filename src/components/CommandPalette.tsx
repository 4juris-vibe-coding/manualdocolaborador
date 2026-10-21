/* Paleta de comandos (Ctrl/⌘+K): páginas, pessoas, eventos e comunicados — respeitando permissões. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { flatNav } from '@/lib/nav'
import { Icon, Avatar } from '@/components/ui'
import { cn } from '@/lib/utils'
import { can } from '@/domain/permissions'
import { comunicadoVisivel, eventoVisivel } from '@/domain/visibilidade'
import { useTema } from '@/lib/tema'

interface Item { id: string; grupo: string; titulo: string; sub?: string; icon?: string; pessoa?: { nome: string; cor: string }; acao: () => void }

const norm = (t: string) => t.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '')

export function CommandPalette({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const navigate = useNavigate()
  const s = useStore()
  const user = s.currentUser()
  const definirTema = useTema((x) => x.definir)
  const [q, setQ] = useState('')
  const [sel, setSel] = useState(0)
  const input = useRef<HTMLInputElement>(null)
  const lista = useRef<HTMLUListElement>(null)

  useEffect(() => { if (aberto) { setQ(''); setSel(0); setTimeout(() => input.current?.focus(), 20) } }, [aberto])

  const itens = useMemo<Item[]>(() => {
    const ir = (to: string) => () => { navigate(to); onFechar() }
    const paginas: Item[] = flatNav().filter((i) => !i.cap || can(user.papel, i.cap)).map((i) => ({ id: 'p' + i.to, grupo: 'Páginas', titulo: i.label, sub: i.desc, icon: i.icon, acao: ir(i.to) }))
    const verPessoas = can(user.papel, 'pessoas:gerenciar')
    const pessoas: Item[] = s.colaboradores.filter((c) => c.status !== 'encerrado' || verPessoas).map((c) => ({
      id: 'c' + c.id, grupo: 'Pessoas', titulo: c.nomeSocial || c.nome, sub: `${s.cargoNome(c.cargoId)} · ${s.setorNome(c.setorId)}`, pessoa: { nome: c.nome, cor: c.avatarCor },
      acao: verPessoas ? ir(`/rh/pessoas/${c.id}`) : ir('/gamificacao'),
    }))
    const eventos: Item[] = s.eventos.filter((e) => eventoVisivel(e, user)).map((e) => ({ id: 'e' + e.id, grupo: 'Eventos', titulo: e.titulo, sub: `${e.inicio.slice(0, 10).split('-').reverse().join('/')} · ${e.local}`, icon: 'CalendarHeart', acao: ir('/eventos') }))
    const comunicados: Item[] = s.comunicados.filter((m) => comunicadoVisivel(m, user)).map((m) => ({ id: 'm' + m.id, grupo: 'Comunicados', titulo: m.titulo, sub: m.resumo, icon: 'Megaphone', acao: ir('/comunicados') }))
    const acoes: Item[] = [
      { id: 'a-periodo', grupo: 'Ações', titulo: 'Registrar período de indisponibilidade', icon: 'Palmtree', acao: ir('/disponibilidade') },
      { id: 'a-reconhecer', grupo: 'Ações', titulo: 'Reconhecer alguém', icon: 'Heart', acao: ir('/gamificacao') },
      { id: 'a-claro', grupo: 'Ações', titulo: 'Tema claro', icon: 'Sun', acao: () => { definirTema('claro'); onFechar() } },
      { id: 'a-escuro', grupo: 'Ações', titulo: 'Tema escuro', icon: 'Moon', acao: () => { definirTema('escuro'); onFechar() } },
      { id: 'a-sistema', grupo: 'Ações', titulo: 'Tema do sistema', icon: 'Monitor', acao: () => { definirTema('sistema'); onFechar() } },
    ]
    return [...acoes, ...paginas, ...pessoas, ...eventos, ...comunicados]
  }, [s, user, navigate, onFechar, definirTema])

  const filtrados = useMemo(() => {
    const t = norm(q.trim())
    if (!t) return itens.filter((i) => i.grupo === 'Páginas' || i.grupo === 'Ações').slice(0, 12)
    return itens.filter((i) => norm(`${i.titulo} ${i.sub ?? ''}`).includes(t)).slice(0, 30)
  }, [itens, q])

  useEffect(() => { setSel(0) }, [q])
  useEffect(() => { lista.current?.querySelector(`[data-i="${sel}"]`)?.scrollIntoView({ block: 'nearest' }) }, [sel])

  if (!aberto) return null
  let grupoAnterior = ''
  return (
    <div className="fixed inset-0 z-[250] bg-midnight/50 backdrop-blur-sm flex items-start justify-center p-4 pt-[12vh] animate-fade-in" onMouseDown={(e) => e.target === e.currentTarget && onFechar()}>
      <div role="dialog" aria-modal="true" aria-label="Busca rápida" className="w-full max-w-xl bg-surface rounded-2xl shadow-lg border border-line overflow-hidden animate-scale-in">
        <div className="flex items-center gap-3 px-4 border-b border-line">
          <Icon name="Search" className="h-5 w-5 text-muted" />
          <input ref={input} value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar páginas, pessoas, eventos…" aria-label="Buscar"
            className="flex-1 h-14 bg-transparent outline-none text-[15px] text-ink placeholder:text-muted-2"
            onKeyDown={(e) => {
              if (e.key === 'ArrowDown') { e.preventDefault(); setSel((x) => Math.min(filtrados.length - 1, x + 1)) }
              if (e.key === 'ArrowUp') { e.preventDefault(); setSel((x) => Math.max(0, x - 1)) }
              if (e.key === 'Enter') filtrados[sel]?.acao()
              if (e.key === 'Escape') onFechar()
            }} />
          <kbd className="text-[11px] text-muted border border-line rounded-md px-1.5 py-0.5">Esc</kbd>
        </div>
        <ul ref={lista} role="listbox" className="max-h-[56vh] overflow-y-auto py-2">
          {filtrados.length === 0 && <li className="px-5 py-8 text-center text-[13px] text-muted">Nada encontrado para “{q}”.</li>}
          {filtrados.map((it, i) => {
            const cabecalho = it.grupo !== grupoAnterior
            grupoAnterior = it.grupo
            return (
              <li key={it.id} role="option" aria-selected={i === sel}>
                {cabecalho && <div className="px-4 pt-2 pb-1 text-[10.5px] font-bold uppercase tracking-wider text-muted">{it.grupo}</div>}
                <button type="button" data-i={i} onMouseEnter={() => setSel(i)} onClick={it.acao}
                  className={cn('w-full flex items-center gap-3 px-4 py-2.5 text-left', i === sel ? 'bg-brand-50' : '')}>
                  {it.pessoa ? <Avatar nome={it.pessoa.nome} cor={it.pessoa.cor} size="sm" className="!h-7 !w-7 !text-[10px]" />
                    : <span className="h-7 w-7 rounded-lg bg-winter text-ink-2 flex items-center justify-center shrink-0"><Icon name={it.icon ?? 'Circle'} className="h-4 w-4" /></span>}
                  <span className="min-w-0 flex-1">
                    <span className="block text-[13.5px] font-semibold text-ink truncate">{it.titulo}</span>
                    {it.sub && <span className="block text-[12px] text-muted truncate">{it.sub}</span>}
                  </span>
                  {i === sel && <Icon name="CornerDownLeft" className="h-4 w-4 text-muted" />}
                </button>
              </li>
            )
          })}
        </ul>
        <div className="flex items-center gap-4 px-4 py-2.5 border-t border-line text-[11px] text-muted">
          <span><kbd className="font-sans">↑↓</kbd> navegar</span><span><kbd className="font-sans">Enter</kbd> abrir</span><span className="ml-auto">Ctrl + K</span>
        </div>
      </div>
    </div>
  )
}
