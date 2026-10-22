import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { CulturaOrganizacional } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Icon, BarList, Callout } from '@/components/ui'
import { feedback } from '@/components/toast'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'

const ICONES = ['Users', 'Lightbulb', 'HeartHandshake', 'Gem', 'GraduationCap', 'Rocket', 'Scale', 'Target', 'ShieldCheck', 'Sparkles', 'Handshake', 'Star']
const CORES = ['#0032D2', '#c98a12', '#db2777', '#7c3aed', '#0f9d6b', '#ea580c', '#0891b2', '#122029']

export default function CulturaRH() {
  const s = useStore()
  const [c, setC] = useState<CulturaOrganizacional>(s.config.cultura)
  const ini = somarDias(hojeISO(), -90)
  const uso = c.valores.map((v) => ({ rotulo: v.nome, valor: s.reconhecimentos.filter((r) => r.valor === v.nome && r.criadoEm.slice(0, 10) >= ini).length, cor: v.cor }))
  const setValor = (i: number, p: Partial<CulturaOrganizacional['valores'][number]>) => setC({ ...c, valores: c.valores.map((v, j) => (j === i ? { ...v, ...p } : v)) })
  return (
    <>
      <PageHeader title="Cultura organizacional" subtitle="Propósito, missão, visão e valores — usados no portal e nos reconhecimentos."
        actions={<Button icon="Check" onClick={() => feedback(s.salvarCultura(c), 'Cultura atualizada. Os reconhecimentos já usam os novos valores.')}>Salvar</Button>} />
      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6 min-w-0">
          <Card className="p-5">
            <Field label="Propósito" htmlFor="cu-p"><textarea id="cu-p" rows={2} className="input !h-auto py-2.5" value={c.proposito} onChange={(e) => setC({ ...c, proposito: e.target.value })} /></Field>
            <Field label="Missão" htmlFor="cu-m"><textarea id="cu-m" rows={2} className="input !h-auto py-2.5" value={c.missao} onChange={(e) => setC({ ...c, missao: e.target.value })} /></Field>
            <Field label="Visão" htmlFor="cu-v"><textarea id="cu-v" rows={2} className="input !h-auto py-2.5" value={c.visao} onChange={(e) => setC({ ...c, visao: e.target.value })} /></Field>
            {s.config.cultura.atualizadoEm && <p className="text-[11.5px] text-muted">Atualizado em {fmtDate(s.config.cultura.atualizadoEm)}</p>}
          </Card>
          <Card>
            <CardHead title="Valores" sub="Aparecem como opções ao reconhecer um colega" action={<Button size="sm" variant="soft" icon="Plus" onClick={() => setC({ ...c, valores: [...c.valores, { nome: '', descricao: '', icone: 'Star', cor: CORES[c.valores.length % CORES.length] }] })}>Valor</Button>} />
            <ul className="divide-y divide-line">
              {c.valores.map((v, i) => (
                <li key={i} className="p-4 grid grid-cols-1 sm:grid-cols-[auto_1fr_auto] gap-3 items-start">
                  <span className="h-11 w-11 rounded-xl flex items-center justify-center text-white" style={{ background: v.cor }}><Icon name={v.icone} className="h-5 w-5" /></span>
                  <div className="space-y-2 min-w-0">
                    <input aria-label="Nome do valor" className="input !h-9" value={v.nome} onChange={(e) => setValor(i, { nome: e.target.value })} placeholder="Nome do valor" />
                    <input aria-label="Descrição do valor" className="input !h-9" value={v.descricao} onChange={(e) => setValor(i, { descricao: e.target.value })} placeholder="O que significa na prática" />
                    <div className="flex flex-wrap gap-1.5">
                      {ICONES.map((ic) => <button key={ic} type="button" aria-label={`Ícone ${ic}`} aria-pressed={v.icone === ic} onClick={() => setValor(i, { icone: ic })} className={`h-7 w-7 rounded-lg border flex items-center justify-center ${v.icone === ic ? 'border-brand text-brand bg-brand-50' : 'border-line text-muted'}`}><Icon name={ic} className="h-3.5 w-3.5" /></button>)}
                      <span className="w-2" />
                      {CORES.map((cor) => <button key={cor} type="button" aria-label={`Cor ${cor}`} aria-pressed={v.cor === cor} onClick={() => setValor(i, { cor })} className={`h-7 w-7 rounded-lg ${v.cor === cor ? 'ring-2 ring-offset-2 ring-ink' : ''}`} style={{ background: cor }} />)}
                    </div>
                  </div>
                  <div className="flex sm:flex-col gap-1">
                    <Button size="icon-sm" variant="subtle" icon="ArrowUp" aria-label="Subir" disabled={i === 0} onClick={() => { const vs = [...c.valores]; [vs[i - 1], vs[i]] = [vs[i], vs[i - 1]]; setC({ ...c, valores: vs }) }} />
                    <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover valor" onClick={() => setC({ ...c, valores: c.valores.filter((_, j) => j !== i) })} />
                  </div>
                </li>
              ))}
            </ul>
          </Card>
        </div>
        <div className="space-y-6">
          <Card><CardHead title="Valores mais reconhecidos" sub="Últimos 90 dias" /><div className="p-5"><BarList itens={uso} vazio="Nenhum reconhecimento no período." /></div></Card>
          <Callout tone="neutral" icon="Info">Reconhecimentos antigos mantêm o nome do valor da época. Renomear um valor não altera o histórico.</Callout>
        </div>
      </div>
    </>
  )
}
