import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowRight, ArrowLeft, Check, Clock, Eye, EyeOff, Lock, Mail, Sparkles, User, UserPlus, Link2Off, KeyRound } from 'lucide-react'
import { Logo } from '@/components/ui'
import { cn } from '@/lib/utils'
import { CONFIG } from '@/data/config'
import { conviteValido, enviarCadastro } from '@/data/sync'
import { useParticleNetwork } from '@/pages/Login'

/** 0–4: comprimento e variedade de caracteres. */
function forcaSenha(s: string): number {
  if (s.length < 10) return s ? 1 : 0
  const tipos = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((r) => r.test(s)).length
  return Math.min(4, 1 + (tipos >= 2 ? 1 : 0) + (tipos >= 3 ? 1 : 0) + (s.length >= 14 ? 1 : 0))
}
const FORCA = [
  { t: '', c: 'bg-line' },
  { t: 'Fraca', c: 'bg-danger' },
  { t: 'Razoável', c: 'bg-warning' },
  { t: 'Boa', c: 'bg-brand' },
  { t: 'Forte', c: 'bg-success' },
]

/** Página pública: a pessoa abre o link enviado pelo RH, preenche nome, e-mail e senha e fica aguardando a aprovação. */
export default function Cadastro() {
  const { token = '' } = useParams()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [valido, setValido] = useState<boolean | null | undefined>(undefined)
  const [nome, setNome] = useState('')
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const [confirma, setConfirma] = useState('')
  const [ver, setVer] = useState(false)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const [enviado, setEnviado] = useState(false)

  useParticleNetwork(canvasRef)
  useEffect(() => { void conviteValido(token).then(setValido) }, [token])

  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-hero > *', { y: 26, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out', delay: 0.15, clearProps: 'opacity,transform' })
    })
    return () => ctx.revert()
  }, [])
  useEffect(() => {
    if (valido === undefined) return
    const ctx = gsap.context(() => {
      gsap.from('.gsap-form > *', { y: 18, opacity: 0, duration: 0.55, stagger: 0.06, ease: 'power3.out', clearProps: 'opacity,transform' })
    })
    return () => ctx.revert()
  }, [valido, enviado])

  const forca = forcaSenha(senha)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (nome.trim().split(/\s+/).length < 2) { setErro('Informe seu nome completo (nome e sobrenome).'); return }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) { setErro('Informe um e-mail válido.'); return }
    if (senha.length < 10) { setErro('A senha precisa ter ao menos 10 caracteres.'); return }
    if (senha !== confirma) { setErro('As senhas não conferem.'); return }
    setLoading(true)
    const falha = await enviarCadastro({ token, nome: nome.trim(), email: email.trim(), senha })
    setLoading(false)
    if (falha) { setErro(falha); return }
    setEnviado(true)
  }

  const limpar = () => setErro('')

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr] bg-midnight">
      {/* -------- Painel de marca -------- */}
      <div className="relative overflow-hidden hidden lg:flex flex-col justify-between p-14 text-white tech-grid">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight/10 via-transparent to-midnight/70 pointer-events-none" />

        <div className="relative z-10 flex items-center gap-3">
          <Logo size={42} />
          <div className="leading-none">
            <div className="text-[17px] font-extrabold tracking-tight">4JURIS</div>
            <div className="text-[11px] text-[#8592a0] mt-1 font-medium">Pessoas & Comunidade</div>
          </div>
        </div>

        <div className="relative z-10 gsap-hero max-w-[460px]">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-brand-300 bg-brand/20 border border-brand/40 px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Boas-vindas
          </span>
          <h1 className="text-[42px] leading-[1.1] font-extrabold tracking-tight">
            Que bom ter você na <span className="text-brand-300">comunidade</span> 4JURIS.
          </h1>
          <p className="mt-5 text-[15.5px] leading-relaxed text-[#aab6c0] max-w-[420px]">
            Crie seu acesso ao portal em três passos. Assim que a equipe aprovar, você entra com o e-mail e a senha que escolher aqui.
          </p>
          <ol className="mt-9 space-y-3.5">
            {[
              { icon: UserPlus, t: 'Preencha seus dados e crie uma senha' },
              { icon: Clock, t: 'A equipe 4JURIS confere o cadastro' },
              { icon: KeyRound, t: 'Acesso liberado: é só entrar no portal' },
            ].map(({ icon: I, t }, i) => (
              <li key={t} className="flex items-center gap-3 text-[14px] text-[#cdd6dd]">
                <span className="h-8 w-8 rounded-lg bg-white/[.08] flex items-center justify-center text-brand-300 shrink-0"><I className="h-[17px] w-[17px]" /></span>
                <span><span className="text-[#7d8a94] font-semibold mr-1.5">{i + 1}.</span>{t}</span>
              </li>
            ))}
          </ol>
        </div>

        <div className="relative z-10 text-[13px] text-[#7d8a94]">© 2026 4JURIS Marketing · Guiando cada passo da sua trajetória.</div>
      </div>

      {/* -------- Conteúdo -------- */}
      <div className="flex items-center justify-center p-6 sm:p-10 bg-surface">
        <div className="gsap-form w-full max-w-[400px]" key={`${valido}-${enviado}`}>
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <Logo size={42} />
            <div className="leading-none">
              <div className="text-[17px] font-extrabold text-ink tracking-tight">4JURIS</div>
              <div className="text-[11px] text-muted mt-1 font-medium">Pessoas & Comunidade</div>
            </div>
          </div>

          {valido === undefined ? (
            <div className="space-y-3" aria-busy="true" aria-label="Verificando o link">
              <div className="h-8 w-56 rounded-xl bg-winter animate-pulse" />
              <div className="h-4 w-72 rounded-lg bg-winter/70 animate-pulse" />
              <div className="h-12 rounded-xl bg-winter/60 animate-pulse mt-6" />
              <div className="h-12 rounded-xl bg-winter/60 animate-pulse" />
            </div>
          ) : valido !== true ? (
            <div className="text-center">
              <span className="mx-auto mb-5 h-14 w-14 rounded-2xl bg-danger/10 text-danger flex items-center justify-center"><Link2Off className="h-7 w-7" /></span>
              <h2 className="text-[25px] font-bold text-ink">{valido === false ? 'Link expirado' : 'Não foi possível abrir o link'}</h2>
              <p className="text-muted text-[14px] mt-2 leading-relaxed">
                {valido === false
                  ? 'Este link de cadastro não está mais ativo. Peça um novo link ao RH da 4JURIS.'
                  : 'O servidor não respondeu. Verifique sua conexão e tente de novo em instantes.'}
              </p>
              <a href={`mailto:${CONFIG.emailRH}`} className="mt-6 w-full h-12 rounded-xl bg-brand text-white font-semibold text-[14.5px] hover:bg-brand-600 transition flex items-center justify-center gap-2">
                <Mail className="h-[18px] w-[18px]" /> Falar com o RH
              </a>
              <Link to="/login" className="mt-3 w-full h-11 rounded-xl text-muted font-semibold text-[13.5px] hover:text-ink transition flex items-center justify-center gap-2">
                <ArrowLeft className="h-4 w-4" /> Ir para o login
              </Link>
            </div>
          ) : enviado ? (
            <div>
              <div className="text-center">
                <span className="relative mx-auto mb-5 h-16 w-16 rounded-2xl bg-warning-soft text-warning-ink flex items-center justify-center">
                  <span className="absolute inset-0 rounded-2xl bg-warning/20 animate-ping [animation-duration:2.4s]" aria-hidden />
                  <Clock className="relative h-8 w-8" />
                </span>
                <h2 className="text-[25px] font-bold text-ink">Cadastro enviado!</h2>
                <p className="text-muted text-[14px] mt-2 leading-relaxed">
                  Obrigado, <b className="text-ink">{nome.trim().split(/\s+/)[0]}</b>. Seu acesso está <b className="text-ink">aguardando aprovação</b> da equipe 4JURIS.
                </p>
              </div>

              <ol className="mt-7 rounded-2xl border border-line bg-surface-2 p-5 space-y-4">
                {[
                  { t: 'Cadastro recebido', d: email.trim().toLowerCase(), estado: 'feito' },
                  { t: 'Análise da equipe', d: 'Estamos conferindo seus dados.', estado: 'agora' },
                  { t: 'Acesso liberado', d: 'Você poderá entrar com seu e-mail e senha.', estado: 'depois' },
                ].map((p, i, arr) => (
                  <li key={p.t} className="relative flex gap-3">
                    {i < arr.length - 1 && <span className={cn('absolute left-[13px] top-7 bottom-[-14px] w-px', p.estado === 'feito' ? 'bg-success' : 'bg-line')} aria-hidden />}
                    <span className={cn('h-7 w-7 rounded-full flex items-center justify-center shrink-0 text-[12px] font-bold',
                      p.estado === 'feito' && 'bg-success text-white',
                      p.estado === 'agora' && 'bg-warning-soft text-warning-ink ring-2 ring-warning/40',
                      p.estado === 'depois' && 'bg-winter text-muted')}>
                      {p.estado === 'feito' ? <Check className="h-4 w-4" /> : p.estado === 'agora' ? <Clock className="h-3.5 w-3.5" /> : i + 1}
                    </span>
                    <div className="min-w-0">
                      <div className={cn('text-[14px] font-semibold', p.estado === 'depois' ? 'text-muted' : 'text-ink')}>{p.t}</div>
                      <div className="text-[12.5px] text-muted truncate">{p.d}</div>
                    </div>
                  </li>
                ))}
              </ol>

              <p className="text-[12.5px] text-muted mt-5 text-center leading-relaxed">
                Quando o acesso for liberado, avisaremos no seu e-mail. Se tentar entrar antes, o login vai mostrar que o cadastro ainda está em análise.
              </p>
              <Link to="/login" className="mt-5 w-full h-12 rounded-xl border border-line text-ink font-semibold text-[14.5px] hover:bg-black/[.03] transition flex items-center justify-center gap-2">
                Ir para o login <ArrowRight className="h-[18px] w-[18px]" />
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} noValidate>
              <h2 className="text-[25px] font-bold text-ink">Crie seu acesso</h2>
              <p className="text-muted text-[14px] mt-2 mb-6">Preencha seus dados. O acesso é liberado após a aprovação da equipe.</p>

              <label className="label" htmlFor="cad-nome">Nome completo</label>
              <div className="relative">
                <User className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="cad-nome" className="input pl-10" value={nome} onChange={(e) => { setNome(e.target.value); limpar() }} autoComplete="name" placeholder="Seu nome e sobrenome" maxLength={120} />
              </div>

              <label className="label mt-4" htmlFor="cad-email">E-mail</label>
              <div className="relative">
                <Mail className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="cad-email" className="input pl-10" type="email" value={email} onChange={(e) => { setEmail(e.target.value); limpar() }} autoComplete="email" placeholder="seu@email.com.br" maxLength={160} />
              </div>
              <p className="text-[11.5px] text-muted mt-1">Será o seu login no portal.</p>

              <label className="label mt-4" htmlFor="cad-senha">Senha</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="cad-senha" className="input pl-10 pr-11" type={ver ? 'text' : 'password'} value={senha} onChange={(e) => { setSenha(e.target.value); limpar() }} autoComplete="new-password" placeholder="Mínimo de 10 caracteres" />
                <button type="button" onClick={() => setVer((v) => !v)} aria-label={ver ? 'Ocultar senha' : 'Mostrar senha'}
                  className="absolute right-2 top-1/2 -translate-y-1/2 h-8 w-8 rounded-lg text-muted hover:text-ink flex items-center justify-center">
                  {ver ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              <div className="flex items-center gap-2 mt-2" aria-live="polite">
                <div className="flex-1 grid grid-cols-4 gap-1">
                  {[1, 2, 3, 4].map((n) => <span key={n} className={cn('h-1.5 rounded-full transition-colors', n <= forca ? FORCA[forca].c : 'bg-line')} />)}
                </div>
                <span className="text-[11.5px] text-muted w-16 text-right">{senha.length < 10 && senha ? `${senha.length}/10` : FORCA[forca].t}</span>
              </div>

              <label className="label mt-3" htmlFor="cad-confirma">Confirmar senha</label>
              <div className="relative">
                <Lock className="h-4 w-4 text-muted absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                <input id="cad-confirma" className="input pl-10 pr-11" type={ver ? 'text' : 'password'} value={confirma} onChange={(e) => { setConfirma(e.target.value); limpar() }} autoComplete="new-password" placeholder="Repita a senha" />
                {confirma && confirma === senha && <Check className="h-4 w-4 text-success absolute right-3.5 top-1/2 -translate-y-1/2" aria-label="As senhas conferem" />}
              </div>

              {erro && <p role="alert" className="text-[12.5px] text-danger font-medium mt-3">{erro}</p>}

              <button type="submit" disabled={loading} className="mt-5 w-full h-12 rounded-xl bg-brand text-white font-semibold text-[14.5px] hover:bg-brand-600 transition flex items-center justify-center gap-2 active:translate-y-px disabled:opacity-70">
                {loading ? 'Enviando...' : <>Enviar cadastro <ArrowRight className="h-[18px] w-[18px]" /></>}
              </button>
              <p className="mt-5 text-center text-[12.5px] text-muted">
                Já tem acesso? <Link to="/login" className="text-brand font-semibold">Entrar</Link>
              </p>
            </form>
          )}
        </div>
      </div>
    </div>
  )
}
