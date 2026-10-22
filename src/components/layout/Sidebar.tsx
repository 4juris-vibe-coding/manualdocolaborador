import { useEffect, useRef, useState } from 'react'
import { Link, NavLink, useLocation } from 'react-router-dom'
import { NAV, grupoDaRota, permitido, ultimosVisiveis } from '@/lib/nav'
import { useStore } from '@/lib/store'
import { Avatar, Icon, Logo } from '@/components/ui'
import { cn, podeVerReembolsosView } from '@/lib/utils'
import { can, PAPEL_LABEL } from '@/domain/permissions'
import { useAcesso } from '@/data/v2/acesso'
import { travarRolagem, devolverFoco } from '@/lib/rolagem'
import { useConta } from './Topbar'
import { ChevronDown, Eye, EyeOff, LogOut, PanelLeftClose, PanelLeftOpen, X } from 'lucide-react'

/** Cada área do menu: primeiro o que a pessoa usa como colaborador(a), depois as ferramentas de cada função. */
const AREAS: Record<string, { rotulo: string; icone: string; cor: string }> = {
  pessoal: { rotulo: 'Meu espaço', icone: 'UserCircle', cor: 'text-[#9fb3c0]' },
  lideranca: { rotulo: 'Liderança', icone: 'UserCog', cor: 'text-[#f2c94c]' },
  financeiro: { rotulo: 'Financeiro', icone: 'Landmark', cor: 'text-[#6fcf97]' },
  rh: { rotulo: 'RH & Pessoas', icone: 'Users', cor: 'text-brand-300' },
  admin: { rotulo: 'Administração', icone: 'ShieldCheck', cor: 'text-[#eb8c8c]' },
}
const CHAVE = '4juris_menu_fechados'
// Item que é prefixo de outro item do menu (ex.: /financeiro e /financeiro/contas) só fica ativo na rota exata,
// senão os dois acendem juntos.
const ITENS_MENU = NAV.flatMap((g) => g.items.map((i) => i.to))
const SO_EXATO = new Set(ITENS_MENU.filter((to) => to === '/' || ITENS_MENU.some((o) => o.startsWith(to + '/'))))
const ativoEm = (to: string, pathname: string) => to === pathname || (!SO_EXATO.has(to) && pathname.startsWith(to + '/'))

const lerFechados = (): string[] => {
  try { return JSON.parse(localStorage.getItem(CHAVE) ?? 'null') ?? ['Conhecimento', 'Desenvolvimento', 'Engajamento & benefícios', 'Estrutura & cargos'] } catch { return [] }
}

export function Sidebar({ aberto, onFechar, entrada }: { aberto: boolean; onFechar: () => void; entrada?: boolean }) {
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

  // Menu aberto como gaveta (celular/tablet): trava a rolagem do fundo, leva o foco para dentro, fecha com Esc e
  // com o botão "voltar" do navegador (uma entrada no histórico representa o menu aberto).
  const painel = useRef<HTMLElement>(null)
  const fechar = useRef(onFechar)
  fechar.current = onFechar
  const continuaAberto = useRef(false)
  useEffect(() => {
    if (!aberto) return
    continuaAberto.current = true
    const anterior = document.activeElement as HTMLElement | null
    const destravar = travarRolagem()
    const t = setTimeout(() => painel.current?.querySelector<HTMLElement>('a[aria-current="page"], nav a')?.focus({ preventScroll: true }), 60)
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') fechar.current() }
    let peloVoltar = false
    const voltar = () => { peloVoltar = true; fechar.current() }
    if (!history.state?.menuAberto) history.pushState({ ...history.state, menuAberto: true }, '')
    window.addEventListener('popstate', voltar)
    document.addEventListener('keydown', esc)
    return () => {
      clearTimeout(t)
      destravar()
      document.removeEventListener('keydown', esc)
      window.removeEventListener('popstate', voltar)
      // Fechou pelo X, pelo fundo ou pelo Esc: tira a entrada do menu do histórico. (Ao navegar por um item, o
      // NavLink usa `replace` e a entrada já foi trocada pela nova página.) Adiado para o caso de o efeito rodar de
      // novo em seguida (StrictMode): aí o menu continua aberto e a entrada fica.
      continuaAberto.current = false
      setTimeout(() => { if (!continuaAberto.current && !peloVoltar && history.state?.menuAberto) history.back() }, 0)
      devolverFoco(anterior)
    }
  }, [aberto])

  let ultimaArea = ''
  // Só mostra o rótulo "Meu espaço" quando a pessoa também tem alguma área de função.
  const temFuncao = NAV.some((g) => g.area !== 'pessoal' && g.items.some((i) => permitido(user.papel, i)))
  const ultimoVisivel = ultimosVisiveis(user.papel)

  return (
    <>
      {aberto && <div className="fixed inset-0 z-[60] bg-midnight/60 backdrop-blur-sm lg:hidden animate-fade-in" onClick={onFechar} aria-hidden />}
      <aside
        ref={painel}
        aria-label="Menu principal"
        className={cn(
          'shrink-0 bg-midnight text-[#aeb9c1] flex flex-col h-screen h-dvh z-[70] transition-[width,transform,visibility] duration-300 border-r border-white/[.04]',
          'fixed inset-y-0 left-0 lg:sticky lg:top-0 lg:translate-x-0',
          aberto ? 'translate-x-0 w-[min(300px,calc(100vw-3rem))] shadow-lg' : '-translate-x-full invisible lg:visible',
          collapsed ? 'lg:w-[76px]' : 'lg:w-[268px]',
          // Só no desktop: no celular o menu fica fora da tela e a animação o traria de volta.
          entrada && 'lg:animate-entrar-esq',
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
          <button onClick={onFechar} className="lg:hidden h-11 w-11 -mr-2 rounded-xl hover:bg-white/10 flex items-center justify-center" aria-label="Fechar menu">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto overflow-x-hidden overscroll-contain px-3 pb-4 pt-1 [scrollbar-color:rgba(255,255,255,.12)_transparent]">
          {NAV.map((group) => {
            const items = group.items
              .filter((i) => permitido(user.papel, i) && ultimoVisivel.get(i.to) === i)
              .filter((i) => i.to !== '/reembolsos' || verReemb)
            if (!items.length) return null
            const novaArea = group.area !== ultimaArea && (group.area !== 'pessoal' || temFuncao)
            ultimaArea = group.area
            const fechado = !collapsed && fechados.includes(group.title)
            const temAtivo = items.some((i) => ativoEm(i.to, pathname))
            return (
              <div key={group.title} className="mt-3 first:mt-1">
                {novaArea && !collapsed && (
                  <div className={cn('mx-1 mb-2 flex items-center gap-2 px-2 py-1.5 rounded-lg bg-white/[.04] text-[10.5px] font-bold tracking-[.1em] uppercase',
                    AREAS[group.area].cor, group.area === 'pessoal' ? 'mt-1' : 'mt-6')}>
                    <Icon name={AREAS[group.area].icone} className="h-3.5 w-3.5" />{AREAS[group.area].rotulo}
                  </div>
                )}
                {novaArea && collapsed && group.area !== 'pessoal' && <div className="h-px bg-white/15 mx-2 my-3" />}
                {!collapsed && !(novaArea && AREAS[group.area]?.rotulo === group.title) && (
                  <button type="button" onClick={() => alternar(group.title)} aria-expanded={!fechado}
                    className="w-full flex items-center justify-between text-[10.5px] font-bold tracking-[.08em] uppercase text-[#7d8a94] hover:text-[#c5cfd6] px-3 py-2.5 lg:py-1.5 rounded-lg transition">
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
                        end={SO_EXATO.has(item.to)}
                        replace={aberto}
                        title={collapsed ? item.label : undefined}
                        tabIndex={fechado ? -1 : undefined}
                        className={({ isActive }) =>
                          cn(
                            'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 lg:py-2 mb-0.5 text-[14px] lg:text-[13.5px] font-medium transition outline-none focus-visible:ring-2 focus-visible:ring-brand-300',
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

        {aberto && <RodapeConta />}
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

/** Conta no rodapé do menu-gaveta: no celular, tema, visão de colaborador e sair saem da barra do topo e ficam aqui. */
function RodapeConta() {
  const user = useStore((s) => s.currentUser())
  const { tema, proximoTema, TemaIcon, trocarTema, preview, podeAlternar, alternarVisao, sair } = useConta()
  const botao = 'h-11 flex-1 min-w-0 rounded-xl bg-white/[.06] hover:bg-white/[.1] text-[#d5dde3] text-[12.5px] font-semibold flex items-center justify-center gap-2 transition'
  return (
    <div className="lg:hidden shrink-0 border-t border-white/[.08] p-3 pb-[max(.75rem,env(safe-area-inset-bottom))] space-y-2.5">
      <Link to="/perfil" replace className="flex items-center gap-3 rounded-xl px-2 py-1.5 hover:bg-white/[.06]">
        <Avatar pessoaId={user.id} nome={user.nome} cor={user.avatarCor} size="sm" />
        <span className="min-w-0 leading-tight">
          <span className="block text-[13.5px] font-bold text-white truncate">{user.nome}</span>
          <span className="block text-[11.5px] text-[#8b98a2]">{PAPEL_LABEL[user.papel]} · Meu perfil</span>
        </span>
      </Link>
      <div className="flex gap-2">
        <button type="button" onClick={trocarTema} className={botao} aria-label={`Tema: ${tema}. Mudar para ${proximoTema}`}>
          <TemaIcon className="h-[18px] w-[18px] shrink-0" /><span className="truncate capitalize">{tema}</span>
        </button>
        {podeAlternar && (
          <button type="button" onClick={alternarVisao} className={botao} aria-label={preview ? 'Sair da visão de colaborador' : 'Ver como colaborador'}>
            {preview ? <EyeOff className="h-[18px] w-[18px] shrink-0" /> : <Eye className="h-[18px] w-[18px] shrink-0" />}<span className="truncate">{preview ? 'Sair da visão' : 'Visão colab.'}</span>
          </button>
        )}
        <button type="button" onClick={sair} className={cn(botao, 'hover:bg-danger/30 hover:text-white')} aria-label="Sair">
          <LogOut className="h-[18px] w-[18px] shrink-0" /><span className="truncate">Sair</span>
        </button>
      </div>
    </div>
  )
}
