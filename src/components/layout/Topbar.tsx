import { sairCompleto } from '@/data/sync'
import { useNotificacoesUnificadas, useSincronizarNotifV2 } from '@/data/v2/notificacoes'
import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate, Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { itemDaRota, grupoDaRota } from '@/lib/nav'
import { CommandPalette } from '@/components/CommandPalette'
import { useTema } from '@/lib/tema'
import { Avatar, Icon } from '@/components/ui'
import { relTime, cn } from '@/lib/utils'
import { PAPEL_LABEL } from '@/domain/permissions'
import { useAcesso } from '@/data/v2/acesso'
import { nivelDe } from '@/domain/gamificacao'
import { Bell, Search, LogOut, Trophy, Eye, EyeOff, Menu, Sun, Moon, Monitor } from 'lucide-react'

const notifIcon: Record<string, string> = {
  aprovacao: 'CheckCircle2', recusa: 'XCircle', prazo: 'Clock', comunicado: 'Megaphone',
  evento: 'CalendarHeart', gamificacao: 'Trophy', pendencia: 'AlertTriangle', disponibilidade: 'Palmtree',
}

/** Ações da conta (tema, visão de colaborador, sair): no desktop ficam na barra do topo; no celular, no rodapé do menu. */
export function useConta() {
  const navigate = useNavigate()
  const real = useStore((s) => s.realUser())
  const preview = useStore((s) => s.previewColaborador)
  const setPreview = useStore((s) => s.setPreview)
  const tema = useTema((x) => x.tema)
  const definirTema = useTema((x) => x.definir)
  const proximoTema = tema === 'claro' ? 'escuro' : tema === 'escuro' ? 'sistema' : 'claro'
  const TemaIcon = tema === 'claro' ? Sun : tema === 'escuro' ? Moon : Monitor
  // Quem tem algo além da área pessoal (papel de gestão ou função adicional) pode conferir o portal como colaborador.
  const temFuncoes = useAcesso((x) => x.funcoes.length > 0)
  const podeAlternar = preview || real.papel !== 'colaborador' || temFuncoes
  return {
    tema, proximoTema, TemaIcon, trocarTema: () => definirTema(proximoTema),
    preview, podeAlternar, alternarVisao: () => { setPreview(!preview); navigate('/') },
    sair: () => { void sairCompleto().then(() => navigate('/login')) },
  }
}

export function Topbar({ onAbrirMenu, entrada }: { onAbrirMenu: () => void; entrada?: boolean }) {
  const location = useLocation()
  const navigate = useNavigate()
  const user = useStore((s) => s.currentUser())
  const niveis = useStore((s) => s.config.gamificacao.niveis)
  useSincronizarNotifV2()
  const { itens: notifs, naoLidas, marcar: marcarNotif, marcarTodas: marcarTodasLidas } = useNotificacoesUnificadas()
  const [openBell, setOpenBell] = useState(false)
  const [paleta, setPaleta] = useState(false)
  const { tema, proximoTema, TemaIcon, trocarTema, preview, podeAlternar, alternarVisao, sair } = useConta()
  const sino = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setPaleta((v) => !v) } }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  // Painel de notificações: fecha ao tocar/clicar fora ou com Esc. (Uma camada `fixed` aqui dentro ficaria presa à
  // altura do cabeçalho, que tem backdrop-filter, e o toque fora atravessaria para a página.)
  useEffect(() => {
    if (!openBell) return
    const fora = (e: PointerEvent) => { if (!sino.current?.contains(e.target as Node)) setOpenBell(false) }
    const esc = (e: KeyboardEvent) => { if (e.key === 'Escape') setOpenBell(false) }
    document.addEventListener('pointerdown', fora)
    document.addEventListener('keydown', esc)
    return () => { document.removeEventListener('pointerdown', fora); document.removeEventListener('keydown', esc) }
  }, [openBell])

  const pontos = useStore((s) => s.pontosDe(user.id))
  const nivel = nivelDe(pontos, niveis)

  const current = itemDaRota(location.pathname, user.papel)
  const grupo = grupoDaRota(location.pathname, user.papel)
  const title = current?.label ?? '4JURIS Pessoas'
  const detalhe = current && !current.oculto && location.pathname !== current.to

  return (
    <header className={cn('h-[64px] sm:h-[68px] shrink-0 bg-surface-3/85 backdrop-blur border-b border-line sticky top-0 z-40 flex items-center gap-3 sm:gap-4 px-4 sm:px-7', entrada && 'animate-entrar-cima')}>
      <button onClick={onAbrirMenu} className="lg:hidden h-10 w-10 -ml-1 rounded-xl border border-line bg-surface flex items-center justify-center text-ink-2" aria-label="Abrir menu">
        <Menu className="h-5 w-5" />
      </button>
      <div className="min-w-0 flex-1 md:flex-initial">
        <nav aria-label="Você está em" className="hidden sm:flex items-center gap-1.5 text-[11.5px] text-muted font-medium truncate">
          <span>{grupo?.title ?? 'Portal 4JURIS'}</span>
          {detalhe && <><span aria-hidden>›</span><Link to={current!.to} className="hover:text-ink">{current!.label}</Link></>}
        </nav>
        <div className="text-[16px] sm:text-[17px] font-bold text-ink leading-tight truncate">{detalhe ? 'Detalhes' : title}</div>
      </div>

      <button type="button" onClick={() => setPaleta(true)} className="hidden md:flex flex-1 min-w-0 max-w-md ml-2 items-center gap-3 h-11 px-3.5 rounded-xl border border-line-strong bg-surface text-[13.5px] text-muted-2 hover:border-brand transition whitespace-nowrap">
        <Search className="h-[17px] w-[17px] text-muted" />
        <span className="flex-1 text-left truncate">Buscar páginas, pessoas, eventos…</span>
        <kbd className="hidden lg:inline text-[11px] text-muted border border-line rounded-md px-1.5 py-0.5 font-sans whitespace-nowrap">Ctrl K</kbd>
      </button>
      <CommandPalette aberto={paleta} onFechar={() => setPaleta(false)} />

      <div className="flex items-center gap-2 ml-auto shrink-0">
        <button type="button" onClick={() => setPaleta(true)} aria-label="Buscar" className="md:hidden h-10 w-10 rounded-xl border border-line bg-surface text-ink-2 flex items-center justify-center"><Search className="h-[18px] w-[18px]" /></button>
        <button type="button" onClick={trocarTema} aria-label={`Tema: ${tema}. Mudar para ${proximoTema}`} title={`Tema: ${tema} (clique para ${proximoTema})`}
          className="hidden sm:flex h-10 w-10 rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink items-center justify-center transition">
          <TemaIcon className="h-[18px] w-[18px]" />
        </button>
        {podeAlternar && (
          <button
            onClick={alternarVisao}
            title={preview ? 'Sair da visão de colaborador' : 'Ver o portal como colaborador'}
            aria-label={preview ? 'Sair da visão de colaborador' : 'Ver como colaborador'}
            className={cn('hidden sm:flex items-center gap-2 h-10 px-2.5 sm:px-3 rounded-xl font-semibold text-[12.5px] border transition whitespace-nowrap shrink-0',
              preview ? 'bg-midnight text-white border-ink hover:bg-midnight-soft dark:bg-brand dark:border-brand' : 'bg-surface text-ink-2 border-line hover:bg-surface-2 hover:text-ink')}
          >
            {preview ? <EyeOff className="h-[17px] w-[17px]" /> : <Eye className="h-[17px] w-[17px]" />}
            <span className="hidden xl:inline">{preview ? 'Sair da visão' : 'Ver como colaborador'}</span>
          </button>
        )}

        <Link to="/experiencia" className="hidden sm:flex items-center gap-2 h-10 px-3 rounded-xl bg-brand-50 border border-brand-100 text-brand-700 font-bold text-[13px] hover:bg-brand-100 transition whitespace-nowrap shrink-0" title={`Nível ${nivel.nivel} · ${nivel.nome}`}>
          <Trophy className="h-[17px] w-[17px]" />
          {pontos.toLocaleString('pt-BR')}
          <span className="sr-only">pontos</span>
          <span className="text-[10.5px] font-semibold bg-brand text-white rounded-full px-1.5 py-0.5">Nv {nivel.nivel}</span>
        </Link>

        <div className="sm:relative" ref={sino}>
          <button
            onClick={() => setOpenBell((v) => !v)}
            aria-label={`Notificações${naoLidas ? ` (${naoLidas} não lidas)` : ''}`}
            aria-expanded={openBell}
            className="relative h-10 w-10 rounded-xl border border-line bg-surface text-ink-2 hover:bg-surface-2 hover:text-ink flex items-center justify-center transition"
          >
            <Bell className="h-[19px] w-[19px]" />
            {naoLidas > 0 && <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 rounded-full bg-danger text-white text-[10px] font-bold flex items-center justify-center ring-2 ring-surface-3">{naoLidas > 9 ? '9+' : naoLidas}</span>}
          </button>

          {openBell && (
            <>
              {/* Celular: o painel ocupa a largura (ancorado no cabeçalho); a partir de sm: sob o sino. */}
              <div className="absolute left-3 right-3 top-full mt-1 sm:left-auto sm:right-0 sm:top-auto sm:mt-2 sm:w-[340px] bg-surface rounded-2xl shadow-lg border border-line z-50 animate-scale-in overflow-hidden">
                <div className="flex items-center justify-between px-4 py-3 border-b border-line">
                  <b className="text-[14px] text-ink">Notificações</b>
                  {naoLidas > 0 && <button onClick={marcarTodasLidas} className="text-[12px] font-semibold text-brand hover:underline">Marcar todas como lidas</button>}
                </div>
                <div className="max-h-[min(360px,calc(100dvh-180px))] overflow-y-auto overscroll-contain">
                  {notifs.length === 0 && <p className="text-[13px] text-muted p-5 text-center">Nenhuma notificação por enquanto.</p>}
                  {notifs.slice(0, 6).map((n) => (
                    <button
                      key={n.origem + n.id}
                      onClick={() => { void marcarNotif(n); setOpenBell(false); if (n.href) navigate(n.href) }}
                      className={cn('w-full text-left flex gap-3 px-4 py-3 border-b border-line/70 hover:bg-surface-2 transition', !n.lida && 'bg-brand-50/50')}
                    >
                      <div className="h-8 w-8 shrink-0 rounded-lg bg-winter flex items-center justify-center text-ink-2">
                        <Icon name={notifIcon[n.tipo] ?? 'Bell'} className="h-4 w-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{n.titulo}{!n.lida && <span className="sr-only"> (não lida)</span>}</div>
                        <div className="text-[12px] text-muted line-clamp-2">{n.texto}</div>
                        <div className="text-[11px] text-muted-2 mt-0.5">{relTime(n.data)}</div>
                      </div>
                    </button>
                  ))}
                </div>
                <Link to="/notificacoes" onClick={() => setOpenBell(false)} className="block text-center py-3 text-[13px] font-semibold text-brand hover:bg-surface-2 transition">
                  Ver todas
                </Link>
              </div>
            </>
          )}
        </div>

        <Link to="/perfil" className="flex items-center gap-2.5 pl-1 pr-1 sm:pr-3 h-10 rounded-xl hover:bg-winter transition" aria-label="Meu perfil">
          <Avatar nome={user.nome} cor={user.avatarCor} size="sm" />
          <div className="hidden xl:block leading-tight whitespace-nowrap">
            <div className="text-[12.5px] font-bold text-ink">{user.nome.split(' ')[0]}</div>
            <div className="text-[10.5px] text-muted">{PAPEL_LABEL[user.papel]}</div>
          </div>
        </Link>

        <button onClick={sair} title="Sair" aria-label="Sair" className="hidden sm:flex h-10 w-10 rounded-xl border border-line bg-surface text-muted hover:bg-danger-soft hover:text-danger items-center justify-center transition">
          <LogOut className="h-[18px] w-[18px]" />
        </button>
      </div>
    </header>
  )
}
