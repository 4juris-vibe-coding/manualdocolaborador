import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, Icon, Button } from '@/components/ui'

export default function Cultura() {
  const s = useStore()
  const c = s.config.cultura
  return (
    <>
      <PageHeader title="Nossa cultura" subtitle={`O que move a comunidade ${s.config.geral.nomeEmpresa}.`} />
      <Card className="p-6 sm:p-10 mb-6 bg-midnight text-white tech-grid relative overflow-hidden">
        <div className="relative max-w-3xl">
          <div className="text-[12px] font-bold uppercase tracking-[.14em] text-brand-300">Propósito</div>
          <p className="text-[22px] sm:text-[28px] font-extrabold leading-snug mt-2">{c.proposito}</p>
        </div>
      </Card>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
        <Card className="p-6"><div className="flex items-center gap-2 text-brand mb-2"><Icon name="Compass" className="h-5 w-5" /><b className="text-[13px] uppercase tracking-wide">Missão</b></div><p className="text-[15px] text-ink leading-relaxed">{c.missao}</p></Card>
        <Card className="p-6"><div className="flex items-center gap-2 text-brand mb-2"><Icon name="Telescope" className="h-5 w-5" /><b className="text-[13px] uppercase tracking-wide">Visão</b></div><p className="text-[15px] text-ink leading-relaxed">{c.visao}</p></Card>
      </div>
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Nossos valores</h2>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {c.valores.map((v) => (
          <Card key={v.nome} className="p-5 hover:-translate-y-0.5 hover:shadow-sm transition">
            <span className="h-12 w-12 rounded-2xl flex items-center justify-center text-white mb-4" style={{ background: v.cor }}><Icon name={v.icone} className="h-6 w-6" /></span>
            <h3 className="text-[16px] font-bold text-ink">{v.nome}</h3>
            <p className="text-[13px] text-muted mt-1 leading-relaxed">{v.descricao}</p>
            <div className="text-[12px] text-ink-2 mt-3">{s.reconhecimentos.filter((r) => r.valor === v.nome && r.publico).length} reconhecimento(s) públicos</div>
          </Card>
        ))}
      </div>
      <div className="mt-6 flex flex-wrap gap-2"><Link to="/gamificacao"><Button icon="Heart">Reconhecer alguém por um valor</Button></Link><Link to="/manual"><Button variant="ghost" icon="BookOpen">Manual de convivência</Button></Link></div>
    </>
  )
}
