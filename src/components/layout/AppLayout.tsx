import { useEffect, useState } from 'react'
import { Outlet, useLocation, useNavigate, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useStore } from '@/lib/store'
import { podeAbrir } from '@/lib/nav'
import { ehAreaDeTrabalho, ehAreaLarga, ehImersivo, useEntradaAnimada } from '@/lib/layout'
import { cn } from '@/lib/utils'
import { MODO_DEMO, MODO_API } from '@/data/config'
import { useSync, sairCompleto } from '@/data/sync'
import { useAcesso } from '@/data/v2/acesso'
import { Eye, FlaskConical, AlertTriangle } from 'lucide-react'
import { CaixaSugestoes } from '@/components/CaixaSugestoes'
import { CarregandoArea, TelaCarregamento } from '@/components/TelaCarregamento'

export function AppLayout() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const sessaoId = useStore((s) => s.sessaoId)
  const papel = useStore((s) => s.currentUser().papel)
  const preview = useStore((s) => s.previewColaborador)
  const setPreview = useStore((s) => s.setPreview)
  const [menuAberto, setMenuAberto] = useState(false)
  // Logo após o login, menu, barra do topo e conteúdo entram em sequência.
  const entrada = useEntradaAnimada()

  const real = useStore((s) => s.realUser())
  const sessaoApi = useSync((s) => s.sessao)
  const acessoCarregado = useAcesso((s) => s.carregado)
  const erroSync = useSync((s) => s.erro)
  // Parceria encerrada (ou cadastro removido) perde o acesso.
  const sessaoInvalida = !!sessaoId && (real.id !== sessaoId || real.status === 'encerrado')

  useEffect(() => { setMenuAberto(false) }, [pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { if (sessaoInvalida) void sairCompleto() }, [sessaoInvalida])

  if (MODO_API && sessaoApi === 'carregando') return <TelaCarregamento mensagem="Conferindo sua sessão…" />
  if (MODO_API && sessaoApi === 'erro') return <div role="alert" className="min-h-screen flex items-center justify-center text-danger text-[14px] px-6 text-center">Não foi possível conectar ao servidor. Recarregue a página em instantes.</div>
  if (!sessaoId || sessaoInvalida) return <Navigate to="/login" replace state={{ de: pathname }} />

  // Guarda de rota: sem a capacidade exigida, volta ao início.
  const semCapacidade = !podeAbrir(papel, pathname)
  // Capacidades vindas do servidor (funções adicionais) chegam logo após o login: não expulse antes disso.
  const aguardandoAcesso = semCapacidade && MODO_API && !acessoCarregado
  const bloqueado = semCapacidade && !aguardandoAcesso
  // Editores ocupam a largura e a altura que sobram: sem o respiro inferior (reservado ao botão flutuante) e sem o botão por cima das ferramentas.
  const areaDeTrabalho = ehAreaDeTrabalho(pathname)

  // Editor do Canva: ocupa a janela inteira (entra com uma leve expansão, como abrir um app de design).
  if (ehImersivo(pathname) && !bloqueado && !aguardandoAcesso) {
    return (
      <main id="conteudo" tabIndex={-1} className="min-h-dvh bg-midnight outline-none animate-expandir" key={pathname}>
        <Outlet />
      </main>
    )
  }

  return (
    <div className="flex min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[400] focus:bg-surface focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md">
        Pular para o conteúdo
      </a>
      <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} entrada={entrada} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onAbrirMenu={() => setMenuAberto(true)} entrada={entrada} />
        {MODO_API && erroSync && (
          <div role="alert" className="bg-danger-soft text-danger px-4 sm:px-7 py-2.5 flex items-center gap-2.5 text-[12.5px] font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            {erroSync} Não feche esta página até o aviso sumir.
          </div>
        )}
        {MODO_DEMO && (
          <div className="bg-gold-soft text-warning-ink px-4 sm:px-7 py-2 flex items-center gap-2.5 text-[12px] font-medium border-b border-warning-line">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span><b>Modo demonstração:</b> dados fictícios, salvos apenas neste navegador. Nada é enviado a um servidor.</span>
          </div>
        )}
        {preview && (
          <div className="bg-midnight dark:bg-brand-100 text-white px-4 sm:px-7 py-2.5 flex items-center gap-3 text-[13px] animate-slide-up flex-wrap">
            <Eye className="h-[17px] w-[17px] text-brand-300 shrink-0" />
            <span className="font-medium flex-1 min-w-[200px]">Você está vendo o portal como <b>colaborador(a)</b>: só aparece o que esse perfil pode ver e fazer.</span>
            <button onClick={() => { setPreview(false); navigate('/') }} className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition px-3 py-1.5 font-semibold">
              Sair da visão colaborador
            </button>
          </div>
        )}
        <main id="conteudo" className={cn('flex-1 px-4 pt-5 sm:px-7 sm:pt-7', areaDeTrabalho ? 'pb-4' : 'pb-24')} tabIndex={-1}>
          <div className={cn('mx-auto', entrada ? 'animate-entrar-baixo' : 'animate-fade-in', ehAreaLarga(pathname) ? 'max-w-[1680px]' : 'max-w-[1240px]')} key={pathname + (preview ? '-p' : '')}>
            {bloqueado ? <Navigate to="/" replace /> : aguardandoAcesso ? <CarregandoArea mensagem="Carregando suas permissões…" /> : <Outlet />}
          </div>
        </main>
      </div>
      {!areaDeTrabalho && <CaixaSugestoes />}
    </div>
  )
}
