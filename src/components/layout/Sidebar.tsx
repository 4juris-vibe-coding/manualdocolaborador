import { useEffect, useState } from 'react'
import { NavLink, useLocation } from 'react-router-dom'
import { NAV, grupoDaRota, permitido, ultimosVisiveis } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { Icon, Logo } from '@/components/ui'
import { cn, podeVerReembolsosView } from '@/lib/utils'
import { can } from '@/domain/permissions'
import { useAcesso } from '@/data/v2/acesso'
import { ChevronDown, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'

const AREA_ROTULO: Record<string, string> = { lideranca: 'Liderança', rh: 'Administração de pessoas', admin: 'Plataforma' }
const CHAVE = '4juris_menu_fechados'
const lerFechados = (): string[] => {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') ?? ['Conhecimento', 'Desenvolvimento & performance', 'Engajamento & benefícios', 'Relatórios', 'Configurações'] } catch { return [] }
}

export function Sidebar({ aberto, onFechar }: { aberto: boolean; onFechar: () => void }) {
  const { pathname } = useLocation()
  const collapsedPref = useStore((s) => s.sidebarCollapsed)
  const toggle = useStore((s) => s.toggleSidebar)
  const user = useStore((s) => s.currentUser())
  const setores = useStore((s) => s.setores)
  const preview = useStore((s) => s.previewColaborador)
  const verReemb = podeVerReembolsosView(user, setores, preview)
  useAcesso((s) => s.carregado) // re-renderiza o menu quando as capacidades do servidor chegam
  const collapsed = collapsedPref && !aberto
  const [fechados, setFechados] = useState<string[]>(lerFechados)

  // O grupo da página atual fica sempre aberto.
  const atual = grupoDaRota(pathname, user.papel)?.title
  useEffect(() => { if (atual && fechados.includes(atual)) setFechados((f) => f.filter((x) => x !== atual)) }, [atual])
  useEffect(() => { try { localStorage.setItem(CHAVE, JSON.stringify(fechados)) } catch { /* sem armazenamento */ } }, [fechados])
  const alternar = (t: string) => setFechados((f) => (f.includes(t) ? f.filter((x) => x !== t) : [...f, t]))

  let ultimaArea = 'pessoal'
  const ultimoVisivel = ultimosVisiveis(user.papel)

  return (
    <>
      {aberto && <div className="fixed inset-0 z-[60] bg-midnight/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onFechar} aria-hidden />}
      <aside
        aria-label="Menu principal"
        className={cn(
          'shrink-0 bg-midnight text-[#aeb9c1] flex flex-col h-screen z-[70] transition-[width,transform] duration-300 border-r border-white/[.04]',
          'fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:translate-x-0',
          aberto ? 'translate-x-0 w-[284px] shadow-lg' : '-translate-x-full',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[268px]',
        )}
      >
        <div className={cn('flex items-center gap-3 px-5 h-[68px] shrink-0', collapsed && 'justify-center px-0')}>
          <Logo size={38} />
          {!collapsed && (
            <div className="leading-none flex-1">
              <div className="text-[16px] font-extrabold text-white tracking-tight">4JURIS</div>
              <div className="text-[10.5px] text-[#8b98a2] mt-1 font-medium tracking-wide">Pessoas & Comunidade</div>
            </div>
          )}
          <button onClick={onFechar} className="lg:hidden h-9 w-9 rounded-lg hover:bg-white/10 flex items-center justify-center" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden px-3 pb-4 pt-1 [scrollbar-color:rgba(255,255,255,.12)_transparent]">
          {NAV.map((group) => {
            const items = group.items
              .filter((i) => permitido(user.papel, i) && ultimoVisivel.get(i.to) === i)
              .filter((i) => i.to !== '/reembolsos' || verReemb)
            if (!items.length) return null
            const novaArea = group.area !== 'pessoal' && group.area !== ultimaArea
            ultimaArea = group.area
            const fechado = !collapsed && fechados.includes(group.title)
            const temAtivo = items.some((i) => i.to === pathname || (i.to !== '/' && i.to !== '/rh' && pathname.startsWith(i.to + '/')))
            return (
              <div key={group.title} className="mt-3 first:mt-1">
                {novaArea && !collapsed && (
                  <div className="mx-3 mb-2 mt-5 pt-4 border-t border-white/[.08] text-[10px] font-bold tracking-[.1em] uppercase text-brand-300/80">
                    {AREA_ROTULO[group.area]}
                  </div>
                )}
                {!collapsed && !(novaArea && AREA_ROTULO[group.area] === group.title) && (
                  <button type="button" onClick={() => alternar(group.title)} aria-expanded={!fechado}
                    className="w-full flex items-center justify-between text-[10.5px] font-bold tracking-[.08em] uppercase text-[#7d8a94] hover:text-[#c5cfd6] px-3 py-1.5 rounded-lg transition">
                    <span className="flex items-center gap-2">{group.title}{fechado && temAtivo && <span className="h-1.5 w-1.5 rounded-full bg-brand-300" />}</span>
                    <ChevronDown className={cn('h-3.5 w-3.5 transition-transform', fechado && '-rotate-90')} />
                  </button>
                )}
                {collapsed && <div className="h-px bg-white/5 mx-2 my-2" />}
                <div className={cn('grid transition-[grid-template-rows] duration-200', fechado ? 'grid-rows-[0fr]' : 'grid-rows-[1fr]')}>
                  <div className="overflow-hidden">
                    {items.map((item) => (
                      <NavLink
                        key={item.to}
                        to={item.to}
                        end={item.to === '/' || item.to === '/rh' || item.to === '/admin'}
                        title={collapsed ? item.label : undefined}
                        tabIndex={fechado ? -1 : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-xl px-3 py-2 mb-0.5 text-[13.5px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
                            collapsed && 'justify-center px-0 py-2.5',
                            isActive ? 'bg-brand text-white' : 'text-[#b8c2c9] hover:bg-white/[.06] hover:text-white',
                          )
                        }
                      >
                        <Icon name={item.icon} className="h-[18px] w-[18px] shrink-0" />
                        {!collapsed && <span className="truncate">{item.label}</span>}
                        {collapsed && (
                          <span className="pointer-events-none absolute left-full ml-3 whitespace-nowrap rounded-lg bg-midnight-soft px-2.5 py-1.5 text-xs text-white opacity-0 shadow-md transition group-hover:opacity-100 z-50 border border-white/10">
                            {item.label}
                          </span>
                        )}
                      </NavLink>
                    ))}
                  </div>
                </div>
              </div>
            )
          })}
        </nav>

        <div className="p-3 border-t border-white/[.08] hidden lg:block">
          <button
            onClick={toggle}
            className={cn('flex items-center gap-3 w-full rounded-xl px-3 py-2.5 text-[13px] font-medium text-[#b8c2c9] hover:bg-white/[.06] hover:text-white transition', collapsed && 'justify-center px-0')}
            title={collapsed ? 'Expandir menu' : 'Minimizar menu'}
            aria-label={collapsed ? 'Expandir menu' : 'Minimizar menu'}
          >
            {collapsed ? <PanelLeftOpen className="h-[19px] w-[19px]" /> : <PanelLeftClose className="h-[19px] w-[19px]" />}
            {!collapsed && <span>Minimizar</span>}
          </button>
        </div>
      </aside>
    </>
  )
}
