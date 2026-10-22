import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Objetivo } from '@/lib/types'
import { PageHeader, Card, Button, Field, Badge, EmptyState, Select, Tabela, TH, TD, Progress, SearchBox, IndicadorCard } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { useOrdenacao, ThOrdenavel, BotaoImprimir } from '@/components/inputs'
import { feedback, toast } from '@/components/toast'
import { mesLabel } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { Dropdown } from '@/components/Dropdown'

export default function Metas() {
  const s = useStore()
  const [mes, setMes] = useState(hojeISO().slice(0, 7))
  const [area, setArea] = useState('')
  const [q, setQ] = useState('')
  const [form, setForm] = useState<{ aberto: boolean; o?: Objetivo }>({ aberto: false })
  const [remover, setRemover] = useState<Objetivo | null>(null)
  const lista = s.objetivos.filter((o) => (!mes || o.periodo === mes) && (!area || o.setorId === area) && (!q.trim() || `${o.titulo} ${o.codigo ?? ''}`.toLowerCase().includes(q.trim().toLowerCase())))
  const pct = (o: Objetivo) => Math.round((o.atual / o.meta) * 100)
  const { ordenados, ordem, onOrdenar } = useOrdenacao(lista, { codigo: (o) => o.codigo ?? '', titulo: (o) => o.titulo, area: (o) => s.setorNome(o.setorId), pct }, 'codigo')
  const atingidas = lista.filter((o) => pct(o) >= 100).length

  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (feedback(s.salvarObjetivo({ codigo: d.codigo.trim() || undefined, titulo: d.titulo.trim(), descricao: d.descricao.trim(), setorId: d.setorId, periodo: d.periodo, meta: Number(d.meta), atual: Number(d.atual || 0), unidadeMedida: d.unidade.trim() || 'unid.', responsavelId: d.responsavelId || undefined }, form.o?.id), 'Meta salva.')) setForm({ aberto: false })
  }
  const exportar = () => {
    baixarArquivo(gerarCSV(ordenados, [
      { titulo: 'Código', valor: (o) => o.codigo ?? '' }, { titulo: 'Meta', valor: (o) => o.titulo }, { titulo: 'Descrição', valor: (o) => o.descricao }, { titulo: 'Área', valor: (o) => s.setorNome(o.setorId) },
      { titulo: 'Mês', valor: (o) => o.periodo }, { titulo: 'Valor da meta', valor: (o) => o.meta }, { titulo: 'Realizado', valor: (o) => o.atual }, { titulo: 'Unidade', valor: (o) => o.unidadeMedida }, { titulo: '% atingido', valor: pct },
    ]), `metas-${mes || 'todas'}.csv`)
    toast('Metas exportadas.')
  }

  return (
    <>
      <PageHeader title="Metas" subtitle="Metas das áreas e dos projetos — resultados de negócio, não de jornada individual."
        actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Nova meta</Button></>} />
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4 mb-6">
        <IndicadorCard titulo="Metas no filtro" valor={lista.length} icon="Target" definicao="Metas cadastradas para o mês e área selecionados." fonte="Cadastro de metas" />
        <IndicadorCard titulo="Atingidas" valor={atingidas} icon="BadgeCheck" tone="success" definicao="Metas com realizado ≥ valor da meta." fonte="Cadastro de metas" />
        <IndicadorCard titulo="Atingimento médio" valor={`${lista.length ? Math.round(lista.reduce((a, o) => a + Math.min(150, pct(o)), 0) / lista.length) : 0}%`} icon="Gauge" tone="ink" definicao="Média do percentual atingido (limitado a 150% por meta)." fonte="Cadastro de metas" />
      </div>
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        <SearchBox value={q} onChange={setQ} placeholder="Meta ou código" label="Buscar metas" />
        <div><label className="sr-only" htmlFor="mt-m">Mês</label><input id="mt-m" type="month" className="input w-auto" value={mes} onChange={(e) => setMes(e.target.value)} /></div>
        <Select label="Área" value={area} onChange={setArea}><option value="">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
        {mes && <Button variant="subtle" size="sm" onClick={() => setMes('')}>Todos os meses</Button>}
      </div>
      <Card>
        {ordenados.length === 0 ? <EmptyState icon="Target" title="Nenhuma meta" desc={mes ? `Nada cadastrado para ${mesLabel(mes)}.` : undefined} /> : (
          <Tabela minWidth={820}>
            <thead><tr>
              <ThOrdenavel className={TH} campo="codigo" ordem={ordem} onOrdenar={onOrdenar}>Código</ThOrdenavel>
              <ThOrdenavel className={TH} campo="titulo" ordem={ordem} onOrdenar={onOrdenar}>Meta</ThOrdenavel>
              <ThOrdenavel className={TH} campo="area" ordem={ordem} onOrdenar={onOrdenar}>Área</ThOrdenavel>
              <th className={TH}>Mês</th>
              <ThOrdenavel className={TH} campo="pct" ordem={ordem} onOrdenar={onOrdenar}>Atingimento</ThOrdenavel>
              <th className={`${TH} no-print`}></th>
            </tr></thead>
            <tbody>
              {ordenados.map((o) => (
                <tr key={o.id}>
                  <td className={TD}><Badge tone="neutral">{o.codigo ?? '—'}</Badge></td>
                  <td className={TD}><div className="font-semibold text-ink">{o.titulo}</div><div className="text-[11.5px] text-muted">{o.descricao}</div></td>
                  <td className={TD}>{s.setorNome(o.setorId)}</td>
                  <td className={TD}><span className="capitalize">{mesLabel(o.periodo)}</span></td>
                  <td className={TD}><div className="w-40"><div className="flex justify-between text-[12px] mb-1"><span>{o.atual.toLocaleString('pt-BR')} / {o.meta.toLocaleString('pt-BR')} {o.unidadeMedida}</span><b>{pct(o)}%</b></div><Progress value={pct(o)} color={pct(o) >= 100 ? '#0f9d6b' : undefined} /></div></td>
                  <td className={`${TD} no-print`}><div className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, o })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(o)} /></div></td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
      </Card>
      <Modal open={form.aberto} onClose={() => setForm({ aberto: false })} title={form.o ? 'Editar meta' : 'Nova meta'} footer={<><Button variant="ghost" onClick={() => setForm({ aberto: false })}>Cancelar</Button><Button icon="Check" type="submit" form="metaForm">Salvar</Button></>}>
        {form.aberto && (
          <form id="metaForm" onSubmit={salvar}>
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr] gap-x-4">
              <Field label="Código" htmlFor="mt-c"><input id="mt-c" name="codigo" className="input" defaultValue={form.o?.codigo} placeholder="OBJ-001" /></Field>
              <Field label="Nome da meta" required htmlFor="mt-t"><input id="mt-t" name="titulo" className="input" defaultValue={form.o?.titulo} required /></Field>
            </div>
            <Field label="Descrição" required htmlFor="mt-d"><textarea id="mt-d" name="descricao" rows={2} className="input !h-auto py-2.5" defaultValue={form.o?.descricao} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Área" htmlFor="mt-a"><Dropdown id="mt-a" name="setorId" className="input" defaultValue={form.o?.setorId}>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Dropdown></Field>
              <Field label="Mês/ano" htmlFor="mt-p"><input id="mt-p" name="periodo" type="month" className="input" defaultValue={form.o?.periodo ?? (mes || hojeISO().slice(0, 7))} /></Field>
              <Field label="Valor da meta" required htmlFor="mt-v"><input id="mt-v" name="meta" type="number" min={0} step="any" className="input" defaultValue={form.o?.meta} /></Field>
              <Field label="Realizado" htmlFor="mt-r"><input id="mt-r" name="atual" type="number" min={0} step="any" className="input" defaultValue={form.o?.atual ?? 0} /></Field>
              <Field label="Unidade" htmlFor="mt-u"><input id="mt-u" name="unidade" className="input" defaultValue={form.o?.unidadeMedida} placeholder="R$, leads, %" /></Field>
              <Field label="Ponto focal" htmlFor="mt-pf"><Dropdown id="mt-pf" name="responsavelId" className="input" defaultValue={form.o?.responsavelId ?? ''}><option value="">—</option>{s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>
            </div>
          </form>
        )}
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover meta?" confirmar="Remover" texto={remover ? `"${remover.titulo}" será removida.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerObjetivo(remover.id), 'Meta removida.')) setRemover(null) }} />
    </>
  )
}
