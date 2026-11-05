/* Layout do portal público de carreiras: independente da área administrativa (sem menu, sem login).
   Cabeçalho enxuto (vagas + acompanhar candidatura). O conteúdo institucional vive na própria página da vaga. */
import { useEffect, useLayoutEffect, useState, type ReactNode } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { Button, Field, Icon, Logo } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { CONFIG, MODO_API } from '@/data/config'
import { useApi } from '@/data/v2/api'
import { aplicarTema, useTema } from '@/lib/tema'
import { PORTAL_PADRAO, ROTULO_REDE, type PortalConfig, type RedeSocial } from '@/domain/v2/portal'

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

/** Conteúdo institucional publicado pelo RH (com padrão enquanto carrega ou sem servidor). */
export function usePortal(): PortalConfig {
  const r = useApi<PortalConfig>(MODO_API ? 'publico/portal' : null)
  return r.dados ?? PORTAL_PADRAO
}

const ICONE_REDE: Record<RedeSocial['rede'], string> = { instagram: 'Instagram', linkedin: 'Linkedin', site: 'Globe', youtube: 'Youtube', facebook: 'Facebook', tiktok: 'Music2', outro: 'Link' }

export function RedesSociais({ redes, className = '', claro = false }: { redes?: RedeSocial[]; className?: string; claro?: boolean }) {
  if (!redes?.length) return null
  return (
    <ul className={`flex flex-wrap items-center gap-2 ${className}`} aria-label="Canais oficiais da 4JURIS">
      {redes.map((r) => (
        <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" title={r.rotulo || ROTULO_REDE[r.rede]} aria-label={`${r.rotulo || ROTULO_REDE[r.rede]} (abre em nova aba)`}
          className={`grid place-items-center h-10 w-10 rounded-xl border transition ${claro ? 'border-white/20 text-white hover:bg-white/10' : 'border-[#e4e8ed] text-[#3d4b56] hover:text-brand hover:border-brand-200 bg-white'}`}><Icon name={ICONE_REDE[r.rede]} className="h-4 w-4" /></a></li>
      ))}
    </ul>
  )
}

/** Campo do código de acompanhamento: leva ao acompanhamento sem pôr o código na URL. */
export function FormCodigo({ onIr, compacto = false, empilhado = false }: { onIr?: () => void; compacto?: boolean; empilhado?: boolean }) {
  const [codigo, setCodigo] = useState('')
  const [erro, setErro] = useState('')
  const navigate = useNavigate()
  const ir = () => {
    const c = codigo.trim()
    if (c.length < 20) { setErro('Confira o código: ele tem mais de 40 letras e números.'); return }
    onIr?.(); setCodigo(''); setErro('')
    navigate('/carreiras/acompanhar', { state: { codigo: c } })
  }
  return (
    <form onSubmit={(e) => { e.preventDefault(); ir() }} className={compacto ? '' : 'space-y-1'}>
      <label htmlFor="pc-cod" className={compacto ? 'sr-only' : 'label'}>Código de acompanhamento</label>
      <div className={empilhado ? 'flex flex-col gap-2' : 'flex gap-2'}>
        <input id="pc-cod" className={`input font-mono min-w-0 ${empilhado ? 'w-full' : 'flex-1'}`} autoComplete="off" autoCapitalize="none" spellCheck={false} value={codigo}
          onChange={(e) => { setCodigo(e.target.value); setErro('') }} placeholder="Cole aqui o seu código" aria-invalid={!!erro} aria-describedby={erro ? 'pc-cod-erro' : undefined} />
        <Button type="submit" icon="ArrowRight" aria-label="Acompanhar" className={empilhado ? 'w-full justify-center' : ''}>{compacto ? '' : 'Acompanhar'}</Button>
      </div>
      {erro && <p id="pc-cod-erro" role="alert" className="text-[12px] text-danger font-medium mt-1">{erro}</p>}
    </form>
  )
}

export function ModalCodigo({ open, onClose }: { open: boolean; onClose: () => void }) {
  return (
    <Modal open={open} onClose={onClose} title="Acompanhar candidatura" subtitle="Use o código que você recebeu ao se candidatar.">
      <FormCodigo onIr={onClose} />
      <p className="text-[12.5px] text-muted mt-3">O código é pessoal. Ele mostra só a situação da sua candidatura, nunca dados de outras pessoas.</p>
    </Modal>
  )
}

export function PortalLayout({ children, largura = 'max-w-6xl' }: { children: ReactNode; largura?: string }) {
  const portal = usePortal()
  const [codigo, setCodigo] = useState(false)
  const { pathname } = useLocation()
  const naCentral = pathname === '/carreiras'
  // Candidatos com o sistema em modo escuro viam texto claro sobre fundo branco: o portal é sempre claro.
  // Ao sair (ex.: voltar para a área interna), reaplica a preferência salva.
  useLayoutEffect(() => {
    document.documentElement.classList.remove('dark')
    return () => aplicarTema(useTema.getState().tema)
  }, [])
  return (
    <div className="min-h-screen flex flex-col bg-white text-[#122029]">
      <a href="#portal-conteudo" className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-[400] focus:bg-white focus:px-4 focus:py-2 focus:rounded-xl focus:shadow-md">Pular para o conteúdo</a>
      <header className="sticky top-0 z-40 bg-white/95 backdrop-blur border-b border-[#eef1f4]">
        <div className={`mx-auto ${largura} px-4 sm:px-6 h-16 flex items-center justify-between gap-3`}>
          <Link to="/carreiras" className="flex items-center gap-2.5 shrink-0 outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-lg" aria-label="4JURIS Carreiras: vagas abertas">
            <Logo size={34} />
            <span className="font-extrabold tracking-tight text-[16px]">{CONFIG.nomeEmpresa} <span className="font-medium text-[#58636e]">Carreiras</span></span>
          </Link>
          <nav aria-label="Portal de carreiras" className="flex items-center gap-1.5">
            <Link to="/carreiras" aria-current={naCentral ? 'page' : undefined}
              className={`hidden sm:inline-flex items-center h-10 px-3.5 rounded-xl text-[13.5px] font-semibold transition ${naCentral ? 'text-brand bg-[#f2f5fe]' : 'text-[#3d4b56] hover:text-brand'}`}>Vagas abertas</Link>
            <button type="button" onClick={() => setCodigo(true)}
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-xl border border-[#d3d9df] text-[13.5px] font-semibold text-[#122029] hover:border-brand hover:text-brand transition whitespace-nowrap">
              <Icon name="KeyRound" className="h-4 w-4" /><span className="hidden sm:inline">Acompanhar candidatura</span><span className="sm:hidden">Meu código</span>
            </button>
          </nav>
        </div>
      </header>
      <main id="portal-conteudo" className="flex-1" tabIndex={-1}>{children}</main>
      <footer className="border-t border-[#eef1f4] bg-[#fafbfd]">
        <div className={`mx-auto ${largura} px-4 sm:px-6 py-8 flex flex-col md:flex-row md:items-center justify-between gap-5 text-[12.5px] text-[#58636e]`}>
          <div className="flex items-center gap-3">
            <Logo size={28} />
            <div className="max-w-xl">© {new Date().getFullYear()} {CONFIG.nomeEmpresa} · Trabalhe conosco. Usamos os dados das candidaturas apenas no processo seletivo, conforme o aviso de privacidade do formulário.{portal.contatoEmail && <> Dúvidas: <a className="text-brand font-semibold" href={`mailto:${portal.contatoEmail}`}>{portal.contatoEmail}</a>.</>}</div>
          </div>
          <RedesSociais redes={portal.redes} />
        </div>
      </footer>
      <ModalCodigo open={codigo} onClose={() => setCodigo(false)} />
    </div>
  )
}

export function Contenedor({ children, className = '', largura = 'max-w-6xl' }: { children: ReactNode; className?: string; largura?: string }) {
  return <div className={`mx-auto ${largura} px-4 sm:px-6 ${className}`}>{children}</div>
}
