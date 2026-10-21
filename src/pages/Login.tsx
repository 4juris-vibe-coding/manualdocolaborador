import { useEffect, useRef, useState } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'
import gsap from 'gsap'
import { ArrowRight, ShieldCheck, Sparkles, Layers, Fingerprint, FlaskConical } from 'lucide-react'
import { Logo } from '@/components/ui'
import { toast } from '@/components/toast'
import { useStore } from '@/lib/store'
import { CONFIG, MODO_API } from '@/data/config'
import { entrarComSenha, useSync } from '@/data/sync'

/* ------------------------------------------------------------------
   Fundo tecnológico: rede de partículas reativa ao mouse (canvas)
------------------------------------------------------------------ */
function useParticleNetwork(canvasRef: React.RefObject<HTMLCanvasElement>) {
  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')!
    let raf = 0
    let w = 0, h = 0
    const mouse = { x: -9999, y: -9999 }
    const DPR = Math.min(window.devicePixelRatio || 1, 2)
    const reduzirMovimento = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

    type P = { x: number; y: number; vx: number; vy: number }
    let pts: P[] = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * DPR; canvas.height = h * DPR
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0)
      const count = Math.min(90, Math.floor((w * h) / 14000))
      pts = Array.from({ length: count }, () => ({
        x: Math.random() * w, y: Math.random() * h,
        vx: (Math.random() - 0.5) * 0.35, vy: (Math.random() - 0.5) * 0.35,
      }))
    }
    resize()
    const ro = new ResizeObserver(resize)
    ro.observe(canvas)

    const onMove = (e: MouseEvent) => {
      const rect = canvas.getBoundingClientRect()
      mouse.x = e.clientX - rect.left; mouse.y = e.clientY - rect.top
    }
    const onLeave = () => { mouse.x = -9999; mouse.y = -9999 }
    window.addEventListener('mousemove', onMove)
    canvas.addEventListener('mouseleave', onLeave)

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of pts) {
        // atração suave em direção ao mouse
        const dx = mouse.x - p.x, dy = mouse.y - p.y
        const dist = Math.hypot(dx, dy)
        if (dist < 160) {
          p.vx += (dx / dist) * 0.015
          p.vy += (dy / dist) * 0.015
        }
        p.x += p.vx; p.y += p.vy
        p.vx *= 0.985; p.vy *= 0.985
        if (p.x < 0 || p.x > w) p.vx *= -1
        if (p.y < 0 || p.y > h) p.vy *= -1
        p.x = Math.max(0, Math.min(w, p.x))
        p.y = Math.max(0, Math.min(h, p.y))
      }
      // conexões
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const a = pts[i], b = pts[j]
          const d = Math.hypot(a.x - b.x, a.y - b.y)
          if (d < 118) {
            ctx.strokeStyle = `rgba(120,150,255,${(1 - d / 118) * 0.28})`
            ctx.lineWidth = 1
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke()
          }
        }
        // linha até o mouse
        const dm = Math.hypot(pts[i].x - mouse.x, pts[i].y - mouse.y)
        if (dm < 160) {
          ctx.strokeStyle = `rgba(157,176,255,${(1 - dm / 160) * 0.5})`
          ctx.lineWidth = 1
          ctx.beginPath(); ctx.moveTo(pts[i].x, pts[i].y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke()
        }
      }
      // nós
      for (const p of pts) {
        ctx.fillStyle = 'rgba(180,200,255,.65)'
        ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill()
      }
      if (!reduzirMovimento) raf = requestAnimationFrame(draw)
    }
    draw()

    return () => {
      cancelAnimationFrame(raf)
      ro.disconnect()
      window.removeEventListener('mousemove', onMove)
      canvas.removeEventListener('mouseleave', onLeave)
    }
  }, [canvasRef])
}

export default function Login() {
  const navigate = useNavigate()
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const brandRef = useRef<HTMLDivElement>(null)
  const heroRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const location = useLocation()
  const pessoas = useStore((s) => s.colaboradores)
  const entrar = useStore((s) => s.entrar)
  const [email, setEmail] = useState('')
  const [senha, setSenha] = useState('')
  const sessao = useSync((s) => s.sessao)
  const [erro, setErro] = useState('')
  const [loading, setLoading] = useState(false)
  const destino = (location.state as { de?: string } | null)?.de ?? '/'

  useParticleNetwork(canvasRef)

  // Entrada + brilho seguindo o cursor + parallax
  useEffect(() => {
    const ctx = gsap.context(() => {
      gsap.from('.gsap-hero > *', { y: 26, opacity: 0, duration: 0.7, stagger: 0.09, ease: 'power3.out', delay: 0.15 })
      gsap.from('.gsap-form > *', { y: 18, opacity: 0, duration: 0.6, stagger: 0.07, ease: 'power3.out', delay: 0.35 })
      gsap.from('.gsap-point', { x: -14, opacity: 0, duration: 0.5, stagger: 0.1, ease: 'power2.out', delay: 0.7 })
    })

    const xHero = gsap.quickTo(heroRef.current, 'x', { duration: 1, ease: 'power3' })
    const yHero = gsap.quickTo(heroRef.current, 'y', { duration: 1, ease: 'power3' })

    const onMove = (e: MouseEvent) => {
      const el = brandRef.current
      if (!el) return
      const r = el.getBoundingClientRect()
      const mx = e.clientX - r.left, my = e.clientY - r.top
      const cx = (mx / r.width - 0.5), cy = (my / r.height - 0.5)
      xHero(cx * -22); yHero(cy * -22)
    }
    window.addEventListener('mousemove', onMove)
    return () => { window.removeEventListener('mousemove', onMove); ctx.revert() }
  }, [])

  const acessar = (id: string) => {
    setLoading(true)
    entrar(id)
    setTimeout(() => navigate(destino === '/login' ? '/' : destino, { replace: true }), 250)
  }

  // Já existe sessão válida (cookie): vai direto ao portal.
  useEffect(() => { if (MODO_API && sessao === 'ok') navigate(destino === '/login' ? '/' : destino, { replace: true }) }, [sessao, destino, navigate])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!email.trim()) { setErro('Informe o e-mail.'); return }
    if (MODO_API) {
      if (!senha) { setErro('Informe a senha.'); return }
      setLoading(true)
      const falha = await entrarComSenha(email.trim(), senha)
      if (falha) { setLoading(false); setErro(falha); toast(falha, 'danger'); return }
      navigate(destino === '/login' ? '/' : destino, { replace: true })
      return
    }
    const p = pessoas.find((c) => c.email.toLowerCase() === email.trim().toLowerCase())
    if (!p) { setErro('E-mail não encontrado.'); return }
    if (p.status === 'encerrado') { setErro('Esta parceria foi encerrada — o acesso está desativado.'); return }
    acessar(p.id)
  }

  return (
    <div className="min-h-screen grid lg:grid-cols-[1.05fr_.95fr] bg-midnight">
      {/* -------- Painel de marca (tecnológico) -------- */}
      <div ref={brandRef} className="relative overflow-hidden hidden lg:flex flex-col justify-between p-14 text-white tech-grid">
        <canvas ref={canvasRef} className="absolute inset-0 h-full w-full" />
        <div className="absolute inset-0 bg-gradient-to-b from-midnight/10 via-transparent to-midnight/70 pointer-events-none" />

        {/* topo */}
        <div className="relative z-10 flex items-center gap-3">
          <Logo size={42} />
          <div className="leading-none">
            <div className="text-[17px] font-extrabold tracking-tight">4JURIS</div>
            <div className="text-[11px] text-[#8592a0] mt-1 font-medium">Pessoas & Comunidade</div>
          </div>
        </div>

        {/* hero */}
        <div ref={heroRef} className="relative z-10 gsap-hero max-w-[460px]">
          <span className="inline-flex items-center gap-2 text-[12px] font-semibold tracking-wide uppercase text-brand-300 bg-brand/20 border border-brand/40 px-3 py-1.5 rounded-full mb-6">
            <Sparkles className="h-3.5 w-3.5" /> Ecossistema 4JURIS
          </span>
          <h1 className="text-[42px] leading-[1.1] font-extrabold tracking-tight">
            Inovação que transforma, <span className="text-brand-300">pessoas</span> que conectam.
          </h1>
          <p className="mt-5 text-[15.5px] leading-relaxed text-[#aab6c0] max-w-[420px]">
            O portal da comunidade 4JURIS — comunicação, agenda, reconhecimento e as rotinas da sua parceria em um só lugar.
          </p>

          <div className="mt-9 space-y-3.5">
            {[
              { icon: Layers, t: 'Tudo do seu dia a dia em um só portal' },
              { icon: ShieldCheck, t: 'Acessos e dados protegidos por papel' },
              { icon: Fingerprint, t: 'Experiência gamificada e personalizada' },
            ].map(({ icon: I, t }) => (
              <div key={t} className="gsap-point flex items-center gap-3 text-[14px] text-[#cdd6dd]">
                <span className="h-8 w-8 rounded-lg bg-white/[.08] flex items-center justify-center text-brand-300 shrink-0">
                  <I className="h-[17px] w-[17px]" />
                </span>
                {t}
              </div>
            ))}
          </div>
        </div>

        <div className="relative z-10 text-[13px] text-[#7d8a94]">© 2026 4JURIS Marketing · Guiando cada passo da sua trajetória.</div>
      </div>

      {/* -------- Formulário -------- */}
      <div ref={formRef} className="flex items-center justify-center p-6 sm:p-10 bg-surface">
        <form onSubmit={submit} className="gsap-form w-full max-w-[380px]">
          <div className="flex lg:hidden items-center gap-3 mb-8">
            <Logo size={42} />
            <div className="leading-none">
              <div className="text-[17px] font-extrabold text-ink tracking-tight">4JURIS</div>
              <div className="text-[11px] text-muted mt-1 font-medium">Pessoas & Comunidade</div>
            </div>
          </div>

          <h2 className="text-[25px] font-bold text-ink">Acesse sua conta</h2>
          <p className="text-muted text-[14px] mt-2 mb-6">Bem-vindo(a) de volta.</p>

          {!MODO_API && (
            <div className="mb-6 text-[12.5px] text-warning-ink bg-gold-soft border border-warning-line rounded-xl px-3.5 py-3 leading-relaxed flex gap-2.5">
              <FlaskConical className="h-4 w-4 shrink-0 mt-0.5" />
              <span><b>Ambiente de demonstração.</b> Não há senha nem servidor: informe o e-mail de um dos dados fictícios.</span>
            </div>
          )}

          <label className="label" htmlFor="login-email">E-mail</label>
          <input id="login-email" className="input" type="email" value={email} onChange={(e) => { setEmail(e.target.value); setErro('') }}
            autoComplete="username" placeholder="seu@email.com.br" aria-invalid={!!erro} aria-describedby={erro ? 'login-erro' : undefined} />
          {MODO_API && (
            <>
              <label className="label mt-4" htmlFor="login-senha">Senha</label>
              <input id="login-senha" className="input" type="password" value={senha} onChange={(e) => { setSenha(e.target.value); setErro('') }}
                autoComplete="current-password" aria-invalid={!!erro} aria-describedby={erro ? 'login-erro' : undefined} />
            </>
          )}
          {erro && <p id="login-erro" role="alert" className="text-[12px] text-danger font-medium mt-1.5">{erro}</p>}

          <button type="submit" disabled={loading} className="mt-5 w-full h-12 rounded-xl bg-brand text-white font-semibold text-[14.5px] hover:bg-brand-600 transition flex items-center justify-center gap-2 active:translate-y-px">
            {loading ? 'Entrando...' : <>Entrar <ArrowRight className="h-[18px] w-[18px]" /></>}
          </button>

          <p className="mt-6 text-center text-[12.5px] text-muted">
            Problemas para acessar? Fale com o <a href={`mailto:${CONFIG.emailRH}`} className="text-brand font-semibold">RH da 4JURIS</a>.
          </p>
        </form>
      </div>
    </div>
  )
}
