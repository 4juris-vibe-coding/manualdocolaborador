import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { ClassificacaoRegistro, RegistroAdministrativo } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, EmptyState, Select, Tabela, TH, TD, IndicadorCard, BarList } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { BotaoImprimir } from '@/components/inputs'
import { feedback, toast } from '@/components/toast'
import { brl, fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { Dropdown } from '@/components/Dropdown'

export const CLASS_REG: Record<ClassificacaoRegistro, { label: string; tone: string }> = {
  positivo: { label: 'Positivo', tone: 'success' }, negativo: { label: 'Negativo', tone: 'danger' }, neutro: { label: 'Neutro', tone: 'neutral' },
}

export default function Registros() {
  const s = useStore()
  const hoje = hojeISO()
  const [tab, setTab] = useState('lista')
  const [pessoa, setPessoa] = useState('')
  const [tipo, setTipo] = useState('')
  const [classe, setClasse] = useState('')
  const [ini, setIni] = useState(somarDias(hoje, -365))
  const [fim, setFim] = useState(hoje)
  const [form, setForm] = useState<{ aberto: boolean; r?: RegistroAdministrativo }>({ aberto: false })
  const [remover, setRemover] = useState<RegistroAdministrativo | null>(null)

  const lista = useMemo(() => s.registros
    .filter((r) => !pessoa || r.colaboradorId === pessoa).filter((r) => !tipo || r.tipoId === tipo)
    .filter((r) => !classe || (r.classificacao ?? 'neutro') === classe).filter((r) => r.data >= ini && r.data <= fim)
    .sort((a, b) => b.data.localeCompare(a.data)), [s.registros, pessoa, tipo, classe, ini, fim])
  const tipoNome = (id: string) => s.tiposRegistro.find((t) => t.id === id)?.nome ?? '—'

  const exportar = () => {
    baixarArquivo(gerarCSV(lista, [
      { titulo: 'Data', valor: (r) => r.data }, { titulo: 'Pessoa', valor: (r) => s.nomeDe(r.colaboradorId) }, { titulo: 'Tipo', valor: (r) => tipoNome(r.tipoId) },
      { titulo: 'Classificação', valor: (r) => CLASS_REG[r.classificacao ?? 'neutro'].label }, { titulo: 'Valor/quantidade', valor: (r) => r.quantidade ?? '' },
      { titulo: 'Descrição', valor: (r) => r.descricao }, { titulo: 'Autor', valor: (r) => s.nomeDe(r.autorId) }, { titulo: 'Criado em', valor: (r) => r.criadoEm },
    ], [`Registros administrativos · ${fmtDate(ini)} a ${fmtDate(fim)}`, `Gerado em ${new Date().toLocaleString('pt-BR')}`]), `registros-${hoje}.csv`)
    toast('Registros exportados.')
  }

  return (
    <>
      <PageHeader title="Registros administrativos" subtitle="Alinhamentos contratuais, atualizações e ocorrências — visíveis somente ao RH."
        actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Novo registro</Button></>} />
      <Card className="p-4 mb-5 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="label">Pessoa</span><Select label="Pessoa" value={pessoa} onChange={setPessoa}><option value="">Todas</option>{s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></div>
          <div><span className="label">Tipo</span><Select label="Tipo" value={tipo} onChange={setTipo}><option value="">Todos</option>{s.tiposRegistro.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</Select></div>
          <div><span className="label">Classificação</span><Select label="Classificação" value={classe} onChange={setClasse}><option value="">Todas</option>{Object.entries(CLASS_REG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
          <div><label className="label" htmlFor="rg-i">De</label><input id="rg-i" type="date" className="input w-auto" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div><label className="label" htmlFor="rg-f">Até</label><input id="rg-f" type="date" className="input w-auto" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </div>
      </Card>
      <Tabs tabs={[{ key: 'lista', label: `Registros (${lista.length})` }, { key: 'analise', label: 'Análise' }]} active={tab} onChange={setTab} />

      {tab === 'lista' && (
        <Card>
          {lista.length === 0 ? <EmptyState icon="NotebookPen" title="Nenhum registro no filtro" /> : (
            <Tabela minWidth={820}>
              <thead><tr><th className={TH}>Data</th><th className={TH}>Pessoa</th><th className={TH}>Tipo</th><th className={TH}>Classificação</th><th className={TH}>Descrição</th><th className={TH}>Autor</th><th className={`${TH} no-print`}></th></tr></thead>
              <tbody>
                {lista.map((r) => (
                  <tr key={r.id}>
                    <td className={TD}>{fmtDate(r.data)}</td>
                    <td className={TD}><Link to={`/rh/pessoas/${r.colaboradorId}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(r.colaboradorId)}</Link></td>
                    <td className={TD}>{tipoNome(r.tipoId)}</td>
                    <td className={TD}><Badge tone={CLASS_REG[r.classificacao ?? 'neutro'].tone} dot>{CLASS_REG[r.classificacao ?? 'neutro'].label}</Badge></td>
                    <td className={TD}><span className="line-clamp-2 text-ink-2">{r.descricao}</span>{r.quantidade != null && <span className="text-[11.5px] text-muted">Valor/qtd: {r.quantidade.toLocaleString('pt-BR')}</span>}</td>
                    <td className={TD}>{s.nomeDe(r.autorId)}</td>
                    <td className={`${TD} no-print`}><div className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, r })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(r)} /></div></td>
                  </tr>
                ))}
              </tbody>
            </Tabela>
          )}
        </Card>
      )}

      {tab === 'analise' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <IndicadorCard titulo="Total" valor={lista.length} icon="NotebookPen" definicao="Registros no filtro aplicado." fonte="Registros administrativos" />
            {(Object.keys(CLASS_REG) as ClassificacaoRegistro[]).map((k) => (
              <IndicadorCard key={k} titulo={CLASS_REG[k].label} valor={lista.filter((r) => (r.classificacao ?? 'neutro') === k).length} icon={k === 'positivo' ? 'ThumbsUp' : k === 'negativo' ? 'ThumbsDown' : 'Minus'} tone={k === 'positivo' ? 'success' : k === 'negativo' ? 'danger' : 'ink'} definicao={`Registros classificados como ${CLASS_REG[k].label.toLowerCase()}.`} fonte="Registros administrativos" />
            ))}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHead title="Por tipo" /><div className="p-5"><BarList itens={s.tiposRegistro.map((t) => ({ rotulo: t.nome, valor: lista.filter((r) => r.tipoId === t.id).length }))} /></div></Card>
            <Card><CardHead title="Por área" /><div className="p-5"><BarList itens={s.setores.map((a) => ({ rotulo: a.nome, valor: lista.filter((r) => s.pessoa(r.colaboradorId)?.setorId === a.id).length, cor: a.cor }))} /></div></Card>
          </div>
        </>
      )}

      {form.aberto && <RegistroForm r={form.r} onClose={() => setForm({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover registro?" confirmar="Remover" texto="A remoção fica registrada na auditoria."
        onConfirm={() => { if (remover && feedback(s.removerRegistro(remover.id), 'Registro removido.')) setRemover(null) }} />
    </>
  )
}

export function RegistroForm({ r, onClose, pessoaFixa }: { r?: RegistroAdministrativo; onClose: () => void; pessoaFixa?: string }) {
  const s = useStore()
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const res = s.salvarRegistro({ colaboradorId: pessoaFixa ?? d.colaboradorId, tipoId: d.tipoId, data: d.data, classificacao: d.classificacao as ClassificacaoRegistro, quantidade: d.quantidade ? Number(d.quantidade) : undefined, descricao: d.descricao.trim() }, r?.id)
    if (feedback(res, r ? 'Registro atualizado.' : 'Registro salvo.')) onClose()
  }
  return (
    <Modal open onClose={onClose} title={r ? 'Editar registro' : 'Novo registro administrativo'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="regAdmForm">Salvar</Button></>}>
      <form id="regAdmForm" onSubmit={salvar}>
        {!pessoaFixa && <Field label="Pessoa" required htmlFor="ra-p"><Dropdown id="ra-p" name="colaboradorId" className="input" defaultValue={r?.colaboradorId ?? ''} required><option value="" disabled>Selecione…</option>{s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Tipo" htmlFor="ra-t"><Dropdown id="ra-t" name="tipoId" className="input" defaultValue={r?.tipoId}>{s.tiposRegistro.filter((t) => t.ativo || t.id === r?.tipoId).map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}</Dropdown></Field>
          <Field label="Data" htmlFor="ra-d"><input id="ra-d" name="data" type="date" className="input" defaultValue={r?.data ?? hojeISO()} /></Field>
          <Field label="Classificação" htmlFor="ra-c"><Dropdown id="ra-c" name="classificacao" className="input" defaultValue={r?.classificacao ?? 'neutro'}>{Object.entries(CLASS_REG).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Dropdown></Field>
          <Field label="Valor ou quantidade (opcional)" htmlFor="ra-q" hint={`Ex.: valor de um aditivo (${brl(1500)})`}><input id="ra-q" name="quantidade" type="number" step="any" min={0} className="input" defaultValue={r?.quantidade} /></Field>
        </div>
        <Field label="Descrição" required htmlFor="ra-x" hint="Fatos objetivos. Não inclua dados de saúde ou outros dados sensíveis."><textarea id="ra-x" name="descricao" rows={3} className="input !h-auto py-2.5" defaultValue={r?.descricao} /></Field>
      </form>
    </Modal>
  )
}
