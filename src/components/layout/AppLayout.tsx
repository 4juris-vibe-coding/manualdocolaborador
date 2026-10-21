import { useEffect, useState } from 'react'
import { Outlet, useLocation, Navigate } from 'react-router-dom'
import { Sidebar } from './Sidebar'
import { Topbar } from './Topbar'
import { useStore } from '@/lib/store'
import { itemDaRota } from '@/lib/nav'
import { can } from '@/domain/permissions'
import { MODO_DEMO, API_PENDENTE } from '@/data/config'
import { Eye, FlaskConical, AlertTriangle } from 'lucide-react'
import { CaixaSugestoes } from '@/components/CaixaSugestoes'

export function AppLayout() {
  const { pathname } = useLocation()
  const sessaoId = useStore((s) => s.sessaoId)
  const papel = useStore((s) => s.currentUser().papel)
  const preview = useStore((s) => s.previewColaborador)
  const setPreview = useStore((s) => s.setPreview)
  const [menuAberto, setMenuAberto] = useState(false)

  const real = useStore((s) => s.realUser())
  const sair = useStore((s) => s.sair)
  // Parceria encerrada (ou cadastro removido) perde o acesso.
  const sessaoInvalida = !!sessaoId && (real.id !== sessaoId || real.status === 'encerrado')

  useEffect(() => { setMenuAberto(false) }, [pathname])
  useEffect(() => { window.scrollTo(0, 0) }, [pathname])
  useEffect(() => { if (sessaoInvalida) sair() }, [sessaoInvalida, sair])

  if (!sessaoId || sessaoInvalida) return <Navigate to="/login" replace state={{ de: pathname }} />

  // Guarda de rota: sem a capacidade exigida, volta ao início.
  const item = itemDaRota(pathname)
  const bloqueado = !!item?.cap && !can(papel, item.cap)

  return (
    <div className="flex min-h-screen">
      <a href="#conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[400] focus:bg-surface focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md">
        Pular para o conteúdo
      </a>
      <Sidebar aberto={menuAberto} onFechar={() => setMenuAberto(false)} />
      <div className="flex-1 min-w-0 flex flex-col">
        <Topbar onAbrirMenu={() => setMenuAberto(true)} />
        {API_PENDENTE && (
          <div role="alert" className="bg-danger-soft text-danger px-4 sm:px-7 py-2.5 flex items-center gap-2.5 text-[12.5px] font-medium">
            <AlertTriangle className="h-4 w-4 shrink-0" />
            VITE_DATA_SOURCE=api foi configurado, mas o adaptador de API ainda não existe. A aplicação está usando dados de demonstração locais.
          </div>
        )}
        {MODO_DEMO && !API_PENDENTE && (
          <div className="bg-gold-soft text-warning-ink px-4 sm:px-7 py-2 flex items-center gap-2.5 text-[12px] font-medium border-b border-warning-line">
            <FlaskConical className="h-4 w-4 shrink-0" />
            <span><b>Modo demonstração:</b> dados fictícios, salvos apenas neste navegador. Nada é enviado a um servidor.</span>
          </div>
        )}
        {preview && (
          <div className="bg-midnight dark:bg-brand-100 text-white px-4 sm:px-7 py-2.5 flex items-center gap-3 text-[13px] animate-slide-up flex-wrap">
            <Eye className="h-[17px] w-[17px] text-brand-300 shrink-0" />
            <span className="font-medium flex-1 min-w-[200px]">Você está vendo o portal como <b>colaborador(a)</b>: só aparece o que esse perfil pode ver e fazer.</span>
            <button onClick={() => setPreview(false)} className="shrink-0 rounded-lg bg-white/10 hover:bg-white/20 transition px-3 py-1.5 font-semibold">
              Sair da visão colaborador
            </button>
          </div>
        )}
        <main id="conteudo" className="flex-1 px-4 pt-5 pb-24 sm:px-7 sm:pt-7 sm:pb-24" tabIndex={-1}>
          <div className="mx-auto max-w-[1240px] animate-fade-in" key={pathname + (preview ? '-p' : '')}>
            {bloqueado ? <Navigate to="/" replace /> : <Outlet />}
          </div>
        </main>
      </div>
      <CaixaSugestoes />
    </div>
  )
}
