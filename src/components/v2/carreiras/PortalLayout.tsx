/* Layout do portal público de carreiras: independente da área administrativa (sem menu, sem login). */
import { useEffect, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Logo } from '@/components/ui'
import { CONFIG } from '@/data/config'

export function useMeta(titulo: string, descricao?: string) {
  useEffect(() => {
    const antes = document.title
    document.title = titulo
    let tag = document.querySelector<HTMLMetaElement>('meta[name="description"]')
    const criada = !tag
    if (!tag) { tag = document.createElement('meta'); tag.name = 'description'; document.head.appendChild(tag) }
    const descAntes = tag.content
    if (descricao) tag.content = descricao.slice(0, 160)
    return () => { document.title = antes; if (tag) { if (criada) tag.remove(); else tag.content = descAntes } }
  }, [titulo, descricao])
}

export function PortalLayout({ children, largura = 'max-w-5xl' }: { children: ReactNode; largura?: string }) {
  return (
    <div className="min-h-screen flex flex-col bg-surface-3 text-ink">
      <a href="#portal-conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[400] focus:bg-surface focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md">Pular para o conteúdo</a>
      <header className="bg-midnight text-white">
        <div className={`mx-auto ${largura} px-4 sm:px-6 h-16 flex items-center justify-between gap-4`}>
          <Link to="/carreiras" className="flex items-center gap-3 outline-none focus-visible:ring-2 focus-visible:ring-brand-300 rounded-lg">
            <Logo size={34} />
            <span className="font-extrabold tracking-tight text-[16px]">{CONFIG.nomeEmpresa} <span className="font-medium text-[#9fb0bb]">Carreiras</span></span>
          </Link>
          <nav aria-label="Portal de carreiras" className="flex items-center gap-1 text-[13.5px] font-medium">
            <Link to="/carreiras" className="px-3 py-2 rounded-lg hover:bg-white/10">Vagas</Link>
            <Link to="/carreiras/acompanhar" className="px-3 py-2 rounded-lg hover:bg-white/10">Acompanhar candidatura</Link>
          </nav>
        </div>
      </header>
      <main id="portal-conteudo" className="flex-1" tabIndex={-1}>{children}</main>
      <footer className="border-t border-line bg-surface">
        <div className={`mx-auto ${largura} px-4 sm:px-6 py-6 text-[12.5px] text-muted`}>
          © {new Date().getFullYear()} {CONFIG.nomeEmpresa}. Tratamos os dados das candidaturas apenas para o processo seletivo, conforme o aviso de privacidade mostrado no formulário.
        </div>
      </footer>
    </div>
  )
}

export function Contenedor({ children, className = '', largura = 'max-w-5xl' }: { children: ReactNode; className?: string; largura?: string }) {
  return <div className={`mx-auto ${largura} px-4 sm:px-6 ${className}`}>{children}</div>
}
