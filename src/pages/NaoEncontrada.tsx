import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, Compass, Home } from 'lucide-react'

export default function NaoEncontrada() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  return (
    <div role="alert" className="card p-8 sm:p-12 max-w-xl mx-auto mt-6 text-center">
      <span className="mx-auto h-14 w-14 rounded-2xl bg-brand-50 text-brand flex items-center justify-center"><Compass className="h-7 w-7" /></span>
      <div className="text-[56px] leading-none font-extrabold text-brand mt-5">404</div>
      <h1 className="text-[20px] font-extrabold text-ink mt-3">Página não encontrada</h1>
      <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
        O endereço <code className="font-mono text-ink-2 break-all">{pathname}</code> não existe ou foi movido. Confira o link ou volte para o início.
      </p>
      <div className="flex gap-2 justify-center mt-6 flex-wrap">
        <button type="button" onClick={() => navigate(-1)} className="h-10 px-4 rounded-xl border border-line font-semibold text-[13.5px] text-ink hover:bg-surface-2 inline-flex items-center gap-2"><ArrowLeft className="h-4 w-4" />Voltar</button>
        <Link to="/" className="h-10 px-4 rounded-xl bg-brand text-white font-semibold text-[13.5px] hover:bg-brand-600 inline-flex items-center gap-2"><Home className="h-4 w-4" />Ir para o início</Link>
      </div>
    </div>
  )
}
