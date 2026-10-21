/* ============================================================
   4JURIS Pessoas · UI kit (Tailwind)
   ============================================================ */
import { type ReactNode, type ButtonHTMLAttributes, forwardRef } from 'react'
import { cn } from '@/lib/utils'
import { ICONES } from './icons'
import logo4juris from '@/LOGO4JURIS.jpg'

/* ---------- Ícone dinâmico por nome ---------- */
export function Icon({ name, className, 'aria-label': rotulo }: { name: string; className?: string; 'aria-label'?: string }) {
  const C = ICONES[name] ?? ICONES.Circle
  if (import.meta.env.DEV && !ICONES[name]) console.warn(`Ícone "${name}" não registrado — rode: node scripts/gerar-icones.mjs`)
  // Ícones são decorativos, a menos que recebam um rótulo.
  return rotulo ? <C className={className} role="img" aria-label={rotulo} /> : <C className={className} aria-hidden="true" />
}

/* ---------- Logo oficial 4JURIS ---------- */
export function Logo({ size = 38, className, rounded = 'rounded-xl' }: { size?: number; className?: string; rounded?: string }) {
  return (
    <img
      src={logo4juris}
      alt="4JURIS"
      width={size}
      height={size}
      className={cn('object-contain shrink-0', rounded, className)}
      style={{ height: size, width: size }}
    />
  )
}

/* ---------- Button ---------- */
type BtnVariant = 'primary' | 'ink' | 'ghost' | 'soft' | 'danger' | 'subtle'
type BtnSize = 'sm' | 'md' | 'lg' | 'icon' | 'icon-sm'

const btnVariants: Record<BtnVariant, string> = {
  primary: 'bg-brand text-white hover:bg-brand-600',
  ink: 'bg-midnight text-white hover:bg-midnight-soft dark:bg-winter dark:text-ink dark:hover:bg-platinum',
  ghost: 'bg-surface text-ink border border-line hover:bg-surface-2 hover:border-line-strong',
  soft: 'bg-brand-100 text-brand-700 hover:bg-brand-200',
  danger: 'bg-danger-soft text-danger hover:bg-danger-hover',
  subtle: 'bg-transparent text-muted hover:bg-winter hover:text-ink',
}
const btnSizes: Record<BtnSize, string> = {
  sm: 'h-9 px-3 text-[12.5px] gap-1.5 rounded-lg',
  md: 'h-10 px-4 text-[13.5px] gap-2 rounded-xl',
  lg: 'h-12 px-6 text-[14.5px] gap-2 rounded-xl',
  icon: 'h-10 w-10 rounded-xl',
  'icon-sm': 'h-9 w-9 rounded-lg',
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: BtnVariant
  size?: BtnSize
  icon?: string
  children?: ReactNode
}
export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', icon, className, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      className={cn(
        'inline-flex items-center justify-center font-semibold whitespace-nowrap transition active:translate-y-px disabled:opacity-50 disabled:pointer-events-none outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1',
        btnVariants[variant], btnSizes[size], className,
      )}
      {...props}
    >
      {icon && <Icon name={icon} className={size === 'sm' || size === 'icon-sm' ? 'h-4 w-4' : 'h-[17px] w-[17px]'} />}
      {children}
    </button>
  ),
)
Button.displayName = 'Button'

/* ---------- Badge ---------- */
const tones: Record<string, string> = {
  brand: 'bg-brand-100 text-brand-700',
  success: 'bg-success-soft text-success',
  warning: 'bg-warning-soft text-warning',
  danger: 'bg-danger-soft text-danger',
  neutral: 'bg-winter text-ink-2',
  gold: 'bg-gold-soft text-gold',
}
export function Badge({ tone = 'neutral', dot, children, className }: { tone?: string; dot?: boolean; children: ReactNode; className?: string }) {
  return (
    <span className={cn('inline-flex items-center gap-1.5 text-[11.5px] font-semibold px-2.5 py-1 rounded-full leading-none', tones[tone] ?? tones.neutral, className)}>
      {dot && <span className="h-1.5 w-1.5 rounded-full bg-current" />}
      {children}
    </span>
  )
}

/* ---------- Card ---------- */
export function Card({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={cn('card', className)}>{children}</div>
}
export function CardHead({ title, sub, action }: { title: ReactNode; sub?: ReactNode; action?: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 px-5 py-4 border-b border-line">
      <div>
        <h3 className="text-[15px] font-bold text-ink">{title}</h3>
        {sub && <p className="text-xs text-muted mt-0.5">{sub}</p>}
      </div>
      {action}
    </div>
  )
}

/* ---------- Avatar ---------- */
const avSizes: Record<string, string> = { sm: 'h-8 w-8 text-[11px]', md: 'h-10 w-10 text-[13px]', lg: 'h-14 w-14 text-[19px]', xl: 'h-20 w-20 text-[27px]' }
/** Escolhe texto claro ou escuro conforme a luminância do fundo (contraste WCAG). */
export function corTextoSobre(hex: string): string {
  const m = hex.replace('#', '').match(/^([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i)
  if (!m) return '#ffffff'
  const f = (v: string) => { const c = parseInt(v, 16) / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  const L = 0.2126 * f(m[1]) + 0.7152 * f(m[2]) + 0.0722 * f(m[3])
  return (1.05 / (L + 0.05)) >= 4.5 ? '#ffffff' : '#122029'
}

export function Avatar({ nome, cor, size = 'md', className }: { nome: string; cor?: string; size?: keyof typeof avSizes; className?: string }) {
  const p = nome.trim().split(/\s+/)
  const ini = ((p[0]?.[0] || '') + (p.length > 1 ? p[p.length - 1][0] : '')).toUpperCase()
  const fundo = cor ?? '#0032D2'
  return (
    <div aria-hidden className={cn('flex items-center justify-center rounded-full font-bold shrink-0', avSizes[size], className)} style={{ background: fundo, color: corTextoSobre(fundo) }}>
      {ini}
    </div>
  )
}

/* ---------- ProgressBar ---------- */
export function Progress({ value, className, barClassName, color }: { value: number; className?: string; barClassName?: string; color?: string }) {
  return (
    <div className={cn('h-2 rounded-full overflow-hidden', !/(^|\s)bg-/.test(className ?? '') && 'bg-winter', className)}>
      <div className={cn('h-full rounded-full bg-brand transition-all duration-500', barClassName)} style={{ width: `${Math.min(100, Math.max(0, value))}%`, background: color }} />
    </div>
  )
}

/* ---------- StatCard ---------- */
export function StatCard({ icon, tone = 'brand', value, label, trend }: { icon: string; tone?: string; value: ReactNode; label: string; trend?: ReactNode }) {
  const iconTones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand', success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning', ink: 'bg-winter text-ink', danger: 'bg-danger-soft text-danger',
  }
  return (
    <Card className="p-5 relative overflow-hidden">
      {trend && <div className="absolute top-5 right-5 text-[11.5px] font-bold">{trend}</div>}
      <div className={cn('h-11 w-11 rounded-xl flex items-center justify-center mb-4', iconTones[tone])}>
        <Icon name={icon} className="h-[21px] w-[21px]" />
      </div>
      <div className="text-[28px] font-extrabold tracking-tight text-ink leading-none">{value}</div>
      <div className="text-[12.5px] text-muted mt-2 font-medium">{label}</div>
    </Card>
  )
}

/* ---------- PageHeader ---------- */
export function PageHeader({ title, subtitle, actions, eyebrow }: { title: string; subtitle?: string; actions?: ReactNode; eyebrow?: ReactNode }) {
  return (
    <div className="flex items-end justify-between gap-4 flex-wrap mb-6">
      <div className="min-w-0">
        {eyebrow && <div className="mb-1.5">{eyebrow}</div>}
        <h1 className="text-[21px] sm:text-[23px] font-bold text-ink tracking-tight">{title}</h1>
        {subtitle && <p className="text-[13.5px] text-muted mt-1">{subtitle}</p>}
      </div>
      {actions && <div className="flex gap-2.5 flex-wrap">{actions}</div>}
    </div>
  )
}

/* ---------- EmptyState ---------- */
export function EmptyState({ icon = 'Inbox', title, desc, action }: { icon?: string; title: string; desc?: string; action?: ReactNode }) {
  return (
    <div className="text-center py-16 px-6">
      <div className="h-14 w-14 rounded-2xl bg-winter flex items-center justify-center mx-auto mb-4">
        <Icon name={icon} className="h-6 w-6 text-muted-2" />
      </div>
      <h3 className="text-base font-bold text-ink mb-1.5">{title}</h3>
      {desc && <p className="text-[13.5px] text-muted max-w-sm mx-auto mb-4">{desc}</p>}
      {action}
    </div>
  )
}

/* ---------- Field ---------- */
export function Field({ label, required, hint, erro, htmlFor, children, className }: { label: string; required?: boolean; hint?: string; erro?: string; htmlFor?: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn('mb-4', className)}>
      <label className="label" htmlFor={htmlFor}>{label}{required && <span className="text-danger ml-0.5" aria-hidden>*</span>}{required && <span className="sr-only"> (obrigatório)</span>}</label>
      {children}
      {erro ? <p className="text-[11.5px] text-danger mt-1.5 font-medium" role="alert">{erro}</p> : hint && <p className="text-[11.5px] text-muted mt-1.5">{hint}</p>}
    </div>
  )
}

/* ---------- Tabs ---------- */
export function Tabs({ tabs, active, onChange }: { tabs: { key: string; label: string }[]; active: string; onChange: (k: string) => void }) {
  return (
    <div role="tablist" className="flex gap-1 border-b border-line mb-6 overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
      {tabs.map((t) => (
        <button
          key={t.key}
          type="button"
          role="tab"
          aria-selected={active === t.key}
          onClick={() => onChange(t.key)}
          className={cn('px-3.5 py-3 text-[13.5px] font-semibold border-b-2 -mb-px transition whitespace-nowrap outline-none focus-visible:bg-brand-50 rounded-t-lg',
            active === t.key ? 'text-brand border-brand' : 'text-muted border-transparent hover:text-ink')}
        >
          {t.label}
        </button>
      ))}
    </div>
  )
}

/* ---------- Toggle ---------- */
export function Toggle({ checked, onChange, label, disabled }: { checked: boolean; onChange: (v: boolean) => void; label?: string; disabled?: boolean }) {
  return (
    <label className={cn('inline-flex items-center gap-2.5 select-none', disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer')}>
      <span className={cn('relative w-10 h-[23px] rounded-full transition shrink-0 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-brand', checked ? 'bg-brand' : 'bg-platinum')}>
        <span className={cn('absolute top-[3px] left-[3px] h-[17px] w-[17px] rounded-full bg-white shadow-xs transition-transform', checked && 'translate-x-[17px]')} />
        <input type="checkbox" role="switch" className="sr-only" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} />
      </span>
      {label && <span className="text-[13px] text-ink-2 font-medium">{label}</span>}
    </label>
  )
}

/* ---------- Indicador com definição e fonte ---------- */
export function IndicadorCard({ titulo, valor, definicao, fonte, detalhe, icon = 'BarChart3', tone = 'brand' }: {
  titulo: string; valor: ReactNode; definicao: string; fonte: string; detalhe?: string; icon?: string; tone?: string
}) {
  const iconTones: Record<string, string> = {
    brand: 'bg-brand-100 text-brand', success: 'bg-success-soft text-success',
    warning: 'bg-warning-soft text-warning', ink: 'bg-winter text-ink', danger: 'bg-danger-soft text-danger',
  }
  return (
    <Card className="p-4 sm:p-5 flex flex-col">
      <div className="flex items-start justify-between gap-2">
        <div className={cn('h-10 w-10 rounded-xl flex items-center justify-center', iconTones[tone])}>
          <Icon name={icon} className="h-5 w-5" />
        </div>
        <details className="relative">
          <summary className="list-none cursor-pointer h-7 w-7 rounded-lg text-muted hover:bg-winter hover:text-ink flex items-center justify-center [&::-webkit-details-marker]:hidden" aria-label={`Como é calculado: ${titulo}`}>
            <Icon name="Info" className="h-4 w-4" />
          </summary>
          <div className="absolute right-0 top-8 z-20 w-64 rounded-xl bg-midnight text-white p-3 text-[12px] leading-relaxed shadow-lg dark:bg-winter dark:border dark:border-line-strong">
            <p>{definicao}</p>
            <p className="mt-2 text-[#aab6c0]"><b className="text-white">Fonte:</b> {fonte}</p>
          </div>
        </details>
      </div>
      <div className="text-[26px] font-extrabold tracking-tight text-ink leading-none mt-3 tabular-nums">{valor}</div>
      <div className="text-[12.5px] text-ink-2 mt-1.5 font-semibold">{titulo}</div>
      {detalhe && <div className="text-[11.5px] text-muted mt-0.5">{detalhe}</div>}
    </Card>
  )
}

/* ---------- Barras horizontais (legíveis em telas pequenas) ---------- */
export function BarList({ itens, total, vazio = 'Sem dados no período.' }: { itens: { rotulo: string; valor: number; cor?: string; sufixo?: string }[]; total?: number; vazio?: string }) {
  const max = total ?? Math.max(1, ...itens.map((i) => i.valor))
  if (!itens.length || itens.every((i) => i.valor === 0)) return <p className="text-[13px] text-muted py-3">{vazio}</p>
  return (
    <ul className="space-y-3">
      {itens.map((i) => (
        <li key={i.rotulo}>
          <div className="flex items-center justify-between mb-1 text-[12.5px]">
            <span className="font-semibold text-ink truncate pr-2">{i.rotulo}</span>
            <span className="font-bold text-ink-2 tabular-nums">{i.valor.toLocaleString('pt-BR')}{i.sufixo ?? ''}</span>
          </div>
          <Progress value={(i.valor / max) * 100} color={i.cor} />
        </li>
      ))}
    </ul>
  )
}

/* ---------- Colunas mensais (com rótulo acessível) ---------- */
export function ColunasMensais({ dados, rotulo }: { dados: { mes: string; qtd: number }[]; rotulo: string }) {
  const max = Math.max(1, ...dados.map((d) => d.qtd))
  const nomeMes = (m: string) => new Date(m + '-01T00:00:00').toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')
  return (
    <figure>
      <div className="flex items-end gap-2 h-36" role="img" aria-label={`${rotulo}: ${dados.map((d) => `${nomeMes(d.mes)} ${d.qtd}`).join(', ')}`}>
        {dados.map((d) => (
          <div key={d.mes} className="flex-1 flex flex-col items-center justify-end h-full gap-1">
            <span className="text-[11px] font-bold text-ink-2 tabular-nums">{d.qtd}</span>
            <div className="w-full max-w-[38px] rounded-t-lg bg-brand transition-all" style={{ height: `${Math.max(3, (d.qtd / max) * 100)}%` }} />
          </div>
        ))}
      </div>
      <div className="flex gap-2 mt-1.5" aria-hidden>
        {dados.map((d) => <span key={d.mes} className="flex-1 text-center text-[10.5px] text-muted capitalize">{nomeMes(d.mes)}</span>)}
      </div>
      <figcaption className="sr-only">{rotulo}</figcaption>
    </figure>
  )
}

/* ---------- Aviso / callout ---------- */
export function Callout({ tone = 'brand', icon = 'Info', children, className }: { tone?: 'brand' | 'warning' | 'success' | 'danger' | 'neutral'; icon?: string; children: ReactNode; className?: string }) {
  const t: Record<string, string> = {
    brand: 'bg-brand-50 border-brand-100 text-brand-700',
    warning: 'bg-warning-soft border-warning-line text-warning-ink',
    success: 'bg-success-soft border-success/20 text-success-ink',
    danger: 'bg-danger-soft border-danger/20 text-danger-ink',
    neutral: 'bg-surface-2 border-line text-ink-2',
  }
  return (
    <div className={cn('rounded-2xl border p-4 flex gap-3 text-[13px] leading-relaxed', t[tone], className)}>
      <Icon name={icon} className="h-5 w-5 shrink-0 mt-px" />
      <div className="min-w-0 flex-1">{children}</div>
    </div>
  )
}

/* ---------- Select nativo com rótulo acessível ---------- */
export function Select({ value, onChange, children, className, label, id, disabled }: { value: string; onChange: (v: string) => void; children: ReactNode; className?: string; label: string; id?: string; disabled?: boolean }) {
  return (
    <select aria-label={label} id={id} disabled={disabled} className={cn('input w-full sm:w-auto sm:min-w-[150px]', className)} value={value} onChange={(e) => onChange(e.target.value)}>
      {children}
    </select>
  )
}

/* ---------- Busca com rótulo ---------- */
export function SearchBox({ value, onChange, placeholder = 'Buscar…', label = 'Buscar' }: { value: string; onChange: (v: string) => void; placeholder?: string; label?: string }) {
  return (
    <div className="relative flex-1 min-w-[200px] sm:max-w-sm">
      <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-muted pointer-events-none" />
      <input type="search" aria-label={label} className="input pl-10" placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} />
    </div>
  )
}

/* ---------- Tabela responsiva ---------- */
export function Tabela({ children, minWidth = 680 }: { children: ReactNode; minWidth?: number }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-[13.5px]" style={{ minWidth }}>{children}</table>
    </div>
  )
}
export const TH = 'text-left text-[11px] font-bold uppercase tracking-wide text-muted bg-surface-2 border-b border-line px-4 sm:px-5 py-3'
export const TD = 'px-4 sm:px-5 py-3 border-b border-line align-middle'
