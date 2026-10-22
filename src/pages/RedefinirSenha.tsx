import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { ArrowLeft, ArrowRight, Eye, EyeOff, Lock } from 'lucide-react'
import { Logo } from '@/components/ui'
import { toast } from '@/components/toast'
import { redefinirSenha } from '@/data/sync'

export default function RedefinirSenha() {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const token = params.get('token') ?? ''
  // Link do e-mail de boas-vindas: primeira senha, não redefinição.
  const primeira = params.has('boas-vindas')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (senha.length < 10) { setErro('A senha precisa ter ao menos 10 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return }
    setLoading(true)
    const falha = await redefinirSenha(token, senha)
    setLoading(false)
    if (falha) { setErro(falha); return }
    toast(primeira ? 'Senha criada! Agora é só entrar com o seu e-mail.' : 'Senha redefinida. Entre com a nova senha.', 'success')
    navigate('/login', { replace: true })
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-surface">
      <form onSubmit={submit} className="w-full max-w-[380px]">
        <div className="flex items-center gap-3 mb-8">
          <Logo size={42} />
          <div className="leading-none">
            <div className="text-[17px] font-extrabold text-ink tracking-tight">4JURIS</div>
            <div className="text-[11px] text-muted mt-1 font-medium">Pessoas & Comunidade</div>
          </div>
        </div>

        <h2 className="text-[25px] font-bold text-ink">{primeira ? 'Boas-vindas! Crie sua senha' : 'Criar nova senha'}</h2>
        {!token ? (
          <p className="text-[14px] text-danger mt-2">Link inválido. Peça um novo em “Esqueceu a senha?”.</p>
        ) : (
          <>
            <p className="text-muted text-[14px] mt-2 mb-6">{primeira ? 'Esta é a senha que você vai usar para entrar no portal, junto com o seu e-mail. Use ao menos 10 caracteres.' : 'Escolha uma senha com ao menos 10 caracteres.'}</p>
            <label className="label" htmlFor="nova-senha">Nova senha</label>
            <div className="relative">
              <Lock className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input id="nova-senha" className="input pl-10 pr-11" type={ver ? 'text' : 'password'} value={senha} autoComplete="new-password"
                onChange={(e) => { setSenha(e.target.value); setErro('') }} />
              <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
                className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-muted hover:text-ink flex items-center justify-center">
                {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            <label className="label mt-4" htmlFor="confirma-senha">Confirmar senha</label>
            <div className="relative">
              <Lock className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input id="confirma-senha" className="input pl-10" type={ver ? 'text' : 'password'} value={confirma} autoComplete="new-password"
                onChange={(e) => { setConfirma(e.target.value); setErro('') }} />
            </div>
            {erro && <p role="alert" className="text-[12px] text-danger font-medium mt-1.5">{erro}</p>}
            <button type="submit" disabled={loading} className="mt-5 w-full h-12 rounded-xl bg-brand text-white font-semibold text-[14.5px] hover:bg-brand-600 transition flex items-center justify-center gap-2 active:translate-y-px disabled:opacity-70">
              {loading ? 'Salvando...' : <>Salvar senha <ArrowRight className="h-[18px] w-[18px]" /></>}
            </button>
          </>
        )}
        <Link to="/login" className="mt-3 w-full h-11 rounded-xl text-muted font-semibold text-[13.5px] hover:text-ink transition flex items-center justify-center gap-2">
          <ArrowLeft className="h-4 w-4" /> Voltar ao login
        </Link>
      </form>
    </div>
  )
}
