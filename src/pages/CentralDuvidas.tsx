import { useMemo, useState } from 'react'
import { PageHeader, Card, Badge, Icon, Button } from '@/components/ui'
import { ARTIGOS, FAQ_GROUPS, FAQ_SOON, type Artigo } from '@/lib/faq-content'
import { cn } from '@/lib/utils'

/* ---------- Detalhe do artigo ---------- */
function ArtigoDetalhe({ artigo, onBack }: { artigo: Artigo; onBack: () => void }) {
  const [openFaq, setOpenFaq] = useState<number | null>(0)
  return (
    <div className="animate-fade-in">
      <button onClick={onBack} className="inline-flex items-center gap-1.5 text-[13.5px] font-medium text-muted hover:text-ink mb-5 transition">
        <Icon name="ChevronLeft" className="h-4 w-4" /> Voltar para a Central
      </button>

      <div className="flex items-start gap-4 mb-6">
        <span className="h-[52px] w-[52px] rounded-2xl bg-brand-50 text-brand flex items-center justify-center shrink-0">
          <Icon name={artigo.icon} className="h-6 w-6" />
        </span>
        <div>
          <h2 className="text-[26px] font-bold text-ink tracking-tight">{artigo.title}</h2>
          <Badge tone="neutral" className="mt-1.5">{artigo.tag}</Badge>
        </div>
      </div>

      <div className="space-y-6 max-w-3xl">
        {/* O que é */}
        <Card className="p-6">
          <h3 className="text-[17px] font-bold text-ink mb-3">O que é</h3>
          <p className="text-[14.5px] leading-relaxed text-ink-2">{artigo.oQueE}</p>
        </Card>

        {/* Como funciona */}
        <Card className="p-6">
          <h3 className="text-[17px] font-bold text-ink mb-3">Como funciona</h3>
          <div className="space-y-2.5">
            {artigo.comoFunciona.map((p, i) => <p key={i} className="text-[14.5px] leading-relaxed text-ink-2">{p}</p>)}
          </div>
          {artigo.atividades && (
            <div className="mt-4 border border-line rounded-xl overflow-hidden">
              {artigo.atividades.map((at, i) => (
                <div key={i} className={cn('flex items-center gap-3.5 px-4 py-3', i > 0 && 'border-t border-line', at.principal && 'bg-brand-50')}>
                  <span className="text-[13px] font-bold text-brand-700 min-w-[82px] font-mono tabular-nums">{at.codigo}</span>
                  <span className="text-[13.5px] text-ink-2 flex-1">{at.nome}</span>
                  {at.principal && <Badge tone="brand">Principal</Badge>}
                </div>
              ))}
            </div>
          )}
          {artigo.link && (
            <a href={artigo.link} target="_blank" rel="noopener" className="mt-4 flex items-center gap-2.5 bg-brand-50 border border-brand-100 rounded-xl px-4 py-3 hover:bg-brand-100 transition">
              <Icon name="ExternalLink" className="h-[18px] w-[18px] text-brand shrink-0" />
              <span className="text-[13.5px] font-semibold text-brand-700">Portal para emissão: Emissor Nacional →</span>
            </a>
          )}
        </Card>

        {/* Passo a passo */}
        <Card className="p-6">
          <h3 className="text-[17px] font-bold text-ink mb-4">Passo a passo</h3>
          <ol className="space-y-4">
            {artigo.passoAPasso.map((s, i) => (
              <li key={i} className="flex gap-3.5">
                <span className="h-7 w-7 rounded-lg bg-midnight dark:bg-brand text-white text-[12.5px] font-bold flex items-center justify-center shrink-0 tabular-nums">{i + 1}</span>
                <span className="text-[14px] text-ink-2 leading-relaxed pt-0.5">{s}</span>
              </li>
            ))}
          </ol>
        </Card>

        {/* Observações */}
        <Card className="p-6">
          <h3 className="text-[17px] font-bold text-ink mb-3">Observações importantes</h3>
          <ul className="space-y-1">
            {artigo.observacoes.map((o, i) => (
              <li key={i} className="flex gap-2.5 py-2 border-t border-line first:border-0 text-[14px] text-ink-2 leading-relaxed">
                <Icon name="ShieldCheck" className="h-4 w-4 text-brand shrink-0 mt-1" /><span>{o}</span>
              </li>
            ))}
          </ul>
        </Card>

        {/* FAQ */}
        <Card className="p-6">
          <h3 className="text-[17px] font-bold text-ink mb-2">Dúvidas frequentes</h3>
          <div>
            {artigo.faq.map((f, i) => {
              const open = openFaq === i
              return (
                <div key={i} className="border-b border-line last:border-0">
                  <button onClick={() => setOpenFaq(open ? null : i)} className="w-full flex items-center justify-between gap-3 py-4 text-left">
                    <span className="text-[14.5px] font-semibold text-ink">{f.q}</span>
                    <Icon name="Plus" className={cn('h-4 w-4 text-muted shrink-0 transition-transform', open && 'rotate-45')} />
                  </button>
                  <div className={cn('grid transition-all duration-200', open ? 'grid-rows-[1fr] pb-4' : 'grid-rows-[0fr]')}>
                    <p className="overflow-hidden text-[14px] text-ink-2 leading-relaxed">{f.a}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>

        {/* Contato */}
        <Card className="p-5 flex items-center justify-between gap-4 flex-wrap bg-surface-2">
          <p className="text-[13.5px] text-muted">Não encontrou a resposta que precisava?</p>
          <a href="mailto:rh@4juris.com.br"><Button variant="ink" icon="Mail" size="sm">Falar com o RH</Button></a>
        </Card>
      </div>
    </div>
  )
}

/* ---------- Página ---------- */
export default function CentralDuvidas() {
  const [sel, setSel] = useState<string | null>(null)
  const [q, setQ] = useState('')

  const busca = useMemo(() => {
    const t = q.trim().toLowerCase()
    if (!t) return null
    return Object.values(ARTIGOS).filter((a) => `${a.title} ${a.summary} ${a.tag}`.toLowerCase().includes(t))
  }, [q])

  if (sel && ARTIGOS[sel]) {
    return (
      <>
        <PageHeader title="Central de dúvidas" subtitle="Tutoriais de parcerias, processos administrativos e da plataforma." />
        <ArtigoDetalhe artigo={ARTIGOS[sel]} onBack={() => setSel(null)} />
      </>
    )
  }

  const CardArtigo = ({ id }: { id: string }) => {
    const a = ARTIGOS[id]
    return (
      <button onClick={() => setSel(id)} className="card p-5 text-left flex flex-col gap-3.5 hover:shadow-sm hover:-translate-y-0.5 transition group">
        <span className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition">
          <Icon name={a.icon} className="h-[21px] w-[21px]" />
        </span>
        <div>
          <h3 className="text-[16px] font-bold text-ink">{a.title}</h3>
          <p className="text-[13px] text-muted mt-1 leading-relaxed">{a.summary}</p>
        </div>
        <span className="mt-auto flex items-center gap-1.5 text-[13px] font-semibold text-brand">
          Abrir tutorial <Icon name="ArrowRight" className="h-4 w-4 group-hover:translate-x-0.5 transition" />
        </span>
      </button>
    )
  }

  return (
    <>
      <PageHeader title="Central de dúvidas" subtitle="Tutoriais de parcerias, processos administrativos e da plataforma." />

      {/* Busca */}
      <div className="relative mb-8 max-w-md">
        <Icon name="Search" className="absolute left-3.5 top-1/2 -translate-y-1/2 h-[17px] w-[17px] text-muted" />
        <input className="input pl-10" placeholder="Buscar um assunto..." value={q} onChange={(e) => setQ(e.target.value)} />
      </div>

      {busca ? (
        busca.length === 0 ? (
          <Card className="p-12 text-center text-muted text-[14px]">Nenhum assunto encontrado. Tente outro termo ou fale com o RH.</Card>
        ) : (
          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {busca.map((a) => <CardArtigo key={a.id} id={a.id} />)}
          </div>
        )
      ) : (
        <div className="space-y-10">
          {FAQ_GROUPS.map((g) => (
            <div key={g.title}>
              <div className="flex items-baseline justify-between mb-4">
                <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">{g.title}</h3>
                <span className="text-[12px] text-muted tabular-nums">{g.items.length} {g.items.length > 1 ? 'artigos' : 'artigo'}</span>
              </div>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {g.items.map((id) => <CardArtigo key={id} id={id} />)}
              </div>
            </div>
          ))}

          {/* Em breve */}
          <div>
            <div className="flex items-baseline justify-between mb-4">
              <h3 className="text-[13px] font-bold uppercase tracking-wide text-muted">Em breve</h3>
              <span className="text-[12px] text-muted tabular-nums">{FAQ_SOON.length} temas planejados</span>
            </div>
            <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
              {FAQ_SOON.map((s) => (
                <div key={s.title} className="card p-5 flex flex-col gap-3.5 opacity-60">
                  <span className="h-11 w-11 rounded-xl bg-winter text-muted flex items-center justify-center"><Icon name={s.icon} className="h-[21px] w-[21px]" /></span>
                  <h3 className="text-[15px] font-bold text-ink">{s.title}</h3>
                  <Badge tone="gold" className="w-fit">Em breve</Badge>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
