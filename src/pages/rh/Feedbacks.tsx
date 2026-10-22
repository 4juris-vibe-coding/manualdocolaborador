import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { ClassificacaoFeedback, Feedback } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, EmptyState, Select, IndicadorCard, BarList, Avatar, Toggle, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { BotaoImprimir } from '@/components/inputs'
import { feedback as fb, toast } from '@/components/toast'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { areasLideradas } from '@/domain/visibilidade'
import { can } from '@/domain/permissions'
import { Dropdown } from '@/components/Dropdown'

export const CLASS_FB: Record<ClassificacaoFeedback, { label: string; tone: string; icon: string }> = {
  positivo: { label: 'Positivo', tone: 'success', icon: 'ThumbsUp' }, para_melhorar: { label: 'Para melhorar', tone: 'warning', icon: 'TrendingUp' }, neutro: { label: 'Neutro', tone: 'neutral', icon: 'Minus' },
}

export default function Feedbacks() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const veTodos = can(user.papel, 'pessoas:gerenciar')
  const minhas = new Set(areasLideradas(user, s.setores).map((a) => a.id))
  const pessoasEscopo = s.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== user.id && (veTodos || minhas.has(c.setorId) || c.responsavelId === user.id))
  const ids = new Set(pessoasEscopo.map((c) => c.id))
  const [tab, setTab] = useState('lista')
  const [pessoa, setPessoa] = useState('')
  const [classe, setClasse] = useState('')
  const [ini, setIni] = useState(somarDias(hoje, -180))
  const [fim, setFim] = useState(hoje)
  const [form, setForm] = useState<{ aberto: boolean; f?: Feedback }>({ aberto: false })
  const [remover, setRemover] = useState<Feedback | null>(null)

  const lista = useMemo(() => s.feedbacks
    .filter((f) => (veTodos ? true : ids.has(f.colaboradorId) && (f.autorId === user.id || minhas.has(s.pessoa(f.colaboradorId)?.setorId ?? ''))))
    .filter((f) => !pessoa || f.colaboradorId === pessoa).filter((f) => !classe || f.classificacao === classe).filter((f) => f.data >= ini && f.data <= fim)
    .sort((a, b) => b.data.localeCompare(a.data)), [s.feedbacks, veTodos, ids, user.id, minhas, s, pessoa, classe, ini, fim])

  const exportar = () => {
    baixarArquivo(gerarCSV(lista, [
      { titulo: 'Data', valor: (f) => f.data }, { titulo: 'Pessoa', valor: (f) => s.nomeDe(f.colaboradorId) }, { titulo: 'Classificação', valor: (f) => CLASS_FB[f.classificacao].label },
      { titulo: 'Comentário', valor: (f) => f.comentario }, { titulo: 'Autor', valor: (f) => s.nomeDe(f.autorId) }, { titulo: 'Visível à pessoa', valor: (f) => (f.visivelParaPessoa ? 'sim' : 'não') },
    ], [`Feedbacks · ${fmtDate(ini)} a ${fmtDate(fim)}`]), `feedbacks-${hoje}.csv`)
    toast('Feedbacks exportados.')
  }

  return (
    <>
      <PageHeader title="Feedbacks" subtitle={veTodos ? 'Feedbacks de alinhamento sobre as entregas de toda a comunidade.' : 'Feedbacks das pessoas das áreas que você coordena.'}
        actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })} disabled={!pessoasEscopo.length}>Novo feedback</Button></>} />
      <Callout tone="neutral" icon="MessageSquareText" className="mb-5 no-print">Feedbacks registram conversas sobre as entregas combinadas. Prefira marcá-los como visíveis à pessoa: transparência fortalece a parceria.</Callout>
      <Card className="p-4 mb-5 no-print">
        <div className="flex flex-wrap items-end gap-3">
          <div><span className="label">Pessoa</span><Select label="Pessoa" value={pessoa} onChange={setPessoa}><option value="">Todas</option>{pessoasEscopo.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></div>
          <div><span className="label">Classificação</span><Select label="Classificação" value={classe} onChange={setClasse}><option value="">Todas</option>{Object.entries(CLASS_FB).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Select></div>
          <div><label className="label" htmlFor="fb-i">De</label><input id="fb-i" type="date" className="input w-auto" value={ini} onChange={(e) => setIni(e.target.value)} /></div>
          <div><label className="label" htmlFor="fb-f">Até</label><input id="fb-f" type="date" className="input w-auto" value={fim} onChange={(e) => setFim(e.target.value)} /></div>
        </div>
      </Card>
      <Tabs tabs={[{ key: 'lista', label: `Feedbacks (${lista.length})` }, { key: 'analise', label: 'Análise' }]} active={tab} onChange={setTab} />

      {tab === 'lista' && (lista.length === 0 ? <Card><EmptyState icon="MessageSquareText" title="Nenhum feedback no filtro" /></Card> : (
        <ul className="space-y-3">
          {lista.map((f) => {
            const p = s.pessoa(f.colaboradorId)
            return (
              <li key={f.id}><Card className="p-4 sm:p-5">
                <div className="flex items-start gap-3">
                  <Avatar pessoaId={p?.id} nome={p?.nome ?? '?'} cor={p?.avatarCor} size="md" />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap"><b className="text-[14px] text-ink">{p?.nome}</b><Badge tone={CLASS_FB[f.classificacao].tone} dot>{CLASS_FB[f.classificacao].label}</Badge>{!f.visivelParaPessoa && <Badge tone="neutral">Interno</Badge>}</div>
                    <p className="text-[13.5px] text-ink-2 mt-1.5 leading-relaxed">{f.comentario}</p>
                    <div className="text-[11.5px] text-muted mt-2">{fmtDate(f.data)} · por {s.nomeDe(f.autorId)}</div>
                  </div>
                  {(f.autorId === user.id || veTodos) && <div className="flex gap-1 no-print"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, f })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(f)} /></div>}
                </div>
              </Card></li>
            )
          })}
        </ul>
      ))}

      {tab === 'analise' && (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
            <IndicadorCard titulo="Total" valor={lista.length} icon="MessageSquareText" definicao="Feedbacks no filtro." fonte="Feedbacks" />
            {(Object.keys(CLASS_FB) as ClassificacaoFeedback[]).map((k) => <IndicadorCard key={k} titulo={CLASS_FB[k].label} valor={lista.filter((f) => f.classificacao === k).length} icon={CLASS_FB[k].icon} tone={CLASS_FB[k].tone === 'neutral' ? 'ink' : CLASS_FB[k].tone} definicao={`Feedbacks classificados como ${CLASS_FB[k].label.toLowerCase()}.`} fonte="Feedbacks" />)}
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card><CardHead title="Por área" /><div className="p-5"><BarList itens={s.setores.map((a) => ({ rotulo: a.nome, valor: lista.filter((f) => s.pessoa(f.colaboradorId)?.setorId === a.id).length, cor: a.cor }))} /></div></Card>
            <Card><CardHead title="Transparência" sub="Feedbacks visíveis à própria pessoa" /><div className="p-5"><BarList itens={[{ rotulo: 'Visíveis à pessoa', valor: lista.filter((f) => f.visivelParaPessoa).length, cor: '#0f9d6b' }, { rotulo: 'Internos', valor: lista.filter((f) => !f.visivelParaPessoa).length, cor: '#97a0a9' }]} total={Math.max(1, lista.length)} /></div></Card>
          </div>
        </>
      )}

      {form.aberto && <FeedbackForm f={form.f} pessoas={pessoasEscopo} onClose={() => setForm({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover feedback?" confirmar="Remover" texto="Esta ação não pode ser desfeita."
        onConfirm={() => { if (remover && fb(s.removerFeedback(remover.id), 'Feedback removido.')) setRemover(null) }} />
    </>
  )
}

export function FeedbackForm({ f, pessoas, onClose, pessoaFixa }: { f?: Feedback; pessoas: { id: string; nome: string }[]; onClose: () => void; pessoaFixa?: string }) {
  const s = useStore()
  const [visivel, setVisivel] = useState(f?.visivelParaPessoa ?? true)
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (fb(s.salvarFeedback({ colaboradorId: pessoaFixa ?? d.colaboradorId, data: d.data, classificacao: d.classificacao as ClassificacaoFeedback, comentario: d.comentario, visivelParaPessoa: visivel }, f?.id), f ? 'Feedback atualizado.' : 'Feedback registrado.')) onClose()
  }
  return (
    <Modal open onClose={onClose} title={f ? 'Editar feedback' : 'Novo feedback'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="fbForm">Salvar</Button></>}>
      <form id="fbForm" onSubmit={salvar}>
        {!pessoaFixa && <Field label="Pessoa" required htmlFor="fb-p"><Dropdown id="fb-p" name="colaboradorId" className="input" defaultValue={f?.colaboradorId ?? ''} required><option value="" disabled>Selecione…</option>{pessoas.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Data" htmlFor="fb-d"><input id="fb-d" name="data" type="date" className="input" defaultValue={f?.data ?? hojeISO()} /></Field>
          <Field label="Classificação" htmlFor="fb-c"><Dropdown id="fb-c" name="classificacao" className="input" defaultValue={f?.classificacao ?? 'positivo'}>{Object.entries(CLASS_FB).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Dropdown></Field>
        </div>
        <Field label="Comentário" required htmlFor="fb-x" hint="Seja específico(a) sobre a entrega e o combinado."><textarea id="fb-x" name="comentario" rows={4} className="input !h-auto py-2.5" defaultValue={f?.comentario} /></Field>
        <Toggle checked={visivel} onChange={setVisivel} label={visivel ? 'Visível para a pessoa (recomendado)' : 'Interno (só RH e autor)'} />
      </form>
    </Modal>
  )
}
