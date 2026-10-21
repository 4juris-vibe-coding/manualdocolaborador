import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, Icon, Button, EmptyState } from '@/components/ui'
import { relTime, cn } from '@/lib/utils'

const notifIcon: Record<string, { icon: string; tone: string }> = {
  aprovacao: { icon: 'CheckCircle2', tone: 'bg-success-soft text-success' },
  recusa: { icon: 'XCircle', tone: 'bg-danger-soft text-danger' },
  prazo: { icon: 'Clock', tone: 'bg-warning-soft text-warning' },
  comunicado: { icon: 'Megaphone', tone: 'bg-brand-50 text-brand' },
  evento: { icon: 'CalendarHeart', tone: 'bg-brand-50 text-brand' },
  gamificacao: { icon: 'Trophy', tone: 'bg-gold-soft text-gold' },
  pendencia: { icon: 'AlertTriangle', tone: 'bg-warning-soft text-warning' },
  disponibilidade: { icon: 'Palmtree', tone: 'bg-brand-50 text-brand' },
}

export default function Notificacoes() {
  const navigate = useNavigate()
  const todas = useStore((s) => s.notificacoes)
  const meId = useStore((s) => s.realUser().id)
  const notifs = useMemo(() => todas.filter((n) => n.colaboradorId === meId).sort((a, b) => b.data.localeCompare(a.data)), [todas, meId])
  const marcar = useStore((s) => s.marcarNotifLida)
  const marcarTodas = useStore((s) => s.marcarTodasLidas)

  return (
    <>
      <PageHeader title="Notificações" subtitle="Tudo o que aconteceu recentemente."
        actions={<Button variant="ghost" icon="CheckCheck" onClick={marcarTodas}>Marcar todas como lidas</Button>} />
      <Card>
        {notifs.length === 0 ? <EmptyState icon="BellOff" title="Sem notificações" desc="Avisos sobre comunicados, eventos, reconhecimentos e solicitações aparecem aqui." /> : (
          <div className="divide-y divide-line">
            {notifs.map((n) => {
              const cfg = notifIcon[n.tipo] ?? { icon: 'Bell', tone: 'bg-winter text-ink' }
              return (
                <button key={n.id} onClick={() => { marcar(n.id); if (n.href) navigate(n.href) }}
                  className={cn('w-full text-left flex gap-3.5 p-4 hover:bg-surface-2 transition', !n.lida && 'bg-brand-50/40')}>
                  <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', cfg.tone)}><Icon name={cfg.icon} className="h-[19px] w-[19px]" /></span>
                  <div className="flex-1 min-w-0">
                    <div className="text-[14px] font-semibold text-ink">{n.titulo}</div>
                    <div className="text-[13px] text-muted">{n.texto}</div>
                    <div className="text-[11.5px] text-muted-2 mt-0.5">{relTime(n.data)}</div>
                  </div>
                  {!n.lida && <span className="h-2 w-2 rounded-full bg-brand mt-2 shrink-0" />}
                </button>
              )
            })}
          </div>
        )}
      </Card>
    </>
  )
}
