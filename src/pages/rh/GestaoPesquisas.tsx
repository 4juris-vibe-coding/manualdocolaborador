import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Pergunta, Pesquisa, TipoPergunta } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Badge, Select, Callout, EmptyState, BarList } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { fmtDate, uid } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { agregar, type ResultadoPergunta } from '@/domain/pesquisas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { MODO_DEMO } from '@/data/config'
import { Dropdown } from '@/components/Dropdown'

const TIPO_LABEL: Record<TipoPergunta, string> = { escala: 'Escala 1–5', enps: 'Recomendação 0–10', opcoes: 'Múltipla escolha', texto: 'Texto livre (opcional)' }
const STATUS: Record<Pesquisa['status'], { label: string; tone: string }> = { rascunho: { label: 'Rascunho', tone: 'neutral' }, aberta: { label: 'Aberta', tone: 'brand' }, encerrada: { label: 'Encerrada', tone: 'success' } }

export default function GestaoPesquisas() {
  const s = useStore()
  const [sel, setSel] = useState<string | null>(s.pesquisas[0]?.id ?? null)
  const [form, setForm] = useState<{ aberto: boolean; p?: Pesquisa }>({ aberto: false })
  const p = s.pesquisas.find((x) => x.id === sel)

  return (
    <>
      <PageHeader title="Gestão de pesquisas" subtitle="Pesquisas voluntárias e anônimas, com resultados apenas agregados." actions={<Button icon="Plus" onClick={() => setForm({ aberto: true })}>Nova pesquisa</Button>} />
      <div className="grid lg:grid-cols-[320px_1fr] gap-6">
        <Card className="self-start">
          <CardHead title="Pesquisas" />
          {s.pesquisas.length === 0 ? <EmptyState icon="ClipboardList" title="Nenhuma pesquisa" /> : (
            <ul className="divide-y divide-line">
              {s.pesquisas.map((x) => (
                <li key={x.id}><button type="button" onClick={() => setSel(x.id)} aria-current={sel === x.id} className={`w-full text-left p-4 hover:bg-surface-2 ${sel === x.id ? 'bg-brand-50' : ''}`}>
                  <div className="flex items-center gap-2"><Badge tone={STATUS[x.status].tone} dot>{STATUS[x.status].label}</Badge><span className="text-[11.5px] text-muted">{s.respostas.filter((r) => r.pesquisaId === x.id).length} resp.</span></div>
                  <div className="text-[13.5px] font-semibold text-ink mt-1.5">{x.titulo}</div>
                  <div className="text-[11.5px] text-muted">{fmtDate(x.inicio)} → {fmtDate(x.fim)}</div>
                </button></li>
              ))}
            </ul>
          )}
        </Card>
        <div className="min-w-0">{p ? <Resultados p={p} onEditar={() => setForm({ aberto: true, p })} /> : <Card><EmptyState icon="BarChart3" title="Selecione uma pesquisa" /></Card>}</div>
      </div>
      {form.aberto && <PesquisaForm p={form.p} onClose={() => setForm({ aberto: false })} onSalvo={setSel} />}
    </>
  )
}

function Resultados({ p, onEditar }: { p: Pesquisa; onEditar: () => void }) {
  const s = useStore()
  const [setor, setSetor] = useState('')
  const res = agregar(p, s.respostas, setor || undefined)
  const convidados = s.colaboradores.filter((c) => c.status !== 'encerrado' && (p.setoresAlvo.length === 0 || p.setoresAlvo.includes(c.setorId))).length
  const participacoes = s.participacoes.filter((x) => x.pesquisaId === p.id).length
  const [excluir, setExcluir] = useState(false)
  const mudarStatus = (status: Pesquisa['status']) => feedback(s.salvarPesquisa({ ...p, status }, p.id), status === 'aberta' ? 'Pesquisa aberta.' : 'Pesquisa encerrada.')

  const exportar = () => {
    const linhas = p.perguntas.map((q) => ({ q, r: res.porPergunta[q.id] }))
    baixarArquivo(gerarCSV(linhas, [
      { titulo: 'Pergunta', valor: (l) => l.q.texto }, { titulo: 'Tipo', valor: (l) => TIPO_LABEL[l.q.tipo] },
      { titulo: 'Resultado agregado', valor: (l) => resumo(l.r) }, { titulo: 'Respostas', valor: (l) => l.r?.n ?? 'suprimido' },
    ], [`Pesquisa: ${p.titulo}`, `Recorte: ${setor ? s.setorNome(setor) : 'todas as áreas'}`, `Gerado em ${new Date().toLocaleString('pt-BR')}`, `Grupos com menos de ${p.minimoRespostas} respostas são suprimidos. Textos livres não são exportados.`, ...(MODO_DEMO ? ['Dados fictícios de demonstração'] : [])]), `pesquisa-${p.id}.csv`)
    toast('Resultados agregados exportados.')
  }

  return (
    <div className="space-y-6">
      <ConfirmModal open={excluir} onClose={() => setExcluir(false)} titulo="Excluir pesquisa?" confirmar="Excluir" texto={`"${p.titulo}" será apagada junto com todas as respostas recebidas. Esta ação não pode ser desfeita.`}
        onConfirm={() => { if (feedback(s.excluirPesquisa(p.id), 'Pesquisa excluída.')) setExcluir(false) }} />
      <Card className="p-5">
        <div className="flex items-start justify-between gap-3 flex-wrap">
          <div className="min-w-0"><Badge tone={STATUS[p.status].tone} dot>{STATUS[p.status].label}</Badge><h2 className="text-[17px] font-bold text-ink mt-2">{p.titulo}</h2><p className="text-[13px] text-muted mt-0.5">{p.descricao}</p></div>
          <div className="flex gap-2 flex-wrap">
            <Button size="sm" variant="ghost" icon="Pencil" onClick={onEditar}>Editar</Button>
            {p.status !== 'aberta' && <Button size="sm" variant="soft" icon="Play" onClick={() => mudarStatus('aberta')}>Abrir</Button>}
            {p.status === 'aberta' && <Button size="sm" variant="ghost" icon="Square" onClick={() => mudarStatus('encerrada')}>Encerrar</Button>}
            <Button size="sm" variant="ghost" icon="Download" onClick={exportar}>Exportar</Button>
            <Button size="sm" variant="subtle" icon="Trash2" onClick={() => setExcluir(true)}>Excluir</Button>
          </div>
        </div>
        <div className="grid sm:grid-cols-3 gap-4 mt-5">
          <div><div className="text-[11.5px] text-muted">Taxa de resposta</div><div className="text-[22px] font-extrabold text-ink">{convidados ? Math.round((participacoes / convidados) * 100) : 0}%</div><div className="text-[11.5px] text-muted">{participacoes} de {convidados} convidados</div></div>
          <div><div className="text-[11.5px] text-muted">Período</div><div className="text-[14px] font-semibold text-ink mt-1">{fmtDate(p.inicio)} → {fmtDate(p.fim)}</div></div>
          <div><label className="text-[11.5px] text-muted block" htmlFor="rs-a">Recorte por área</label><Select id="rs-a" label="Recorte por área" value={setor} onChange={setSetor} className="mt-1"><option value="">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></div>
        </div>
      </Card>

      {res.suprimido ? (
        <Callout tone="warning" icon="EyeOff">Este recorte tem <b>{res.total}</b> resposta(s), abaixo do mínimo de {p.minimoRespostas}. Os resultados ficam ocultos para proteger o anonimato.</Callout>
      ) : (
        p.perguntas.map((q, i) => {
          const r = res.porPergunta[q.id]
          return (
            <Card key={q.id}>
              <CardHead title={`${i + 1}. ${q.texto}`} sub={`${TIPO_LABEL[q.tipo]}${r ? ` · ${r.n} resposta(s)` : ''}`} />
              <div className="p-5">
                {!r && <p className="text-[13px] text-muted">Textos livres não são exibidos em recortes por área, para evitar identificação.</p>}
                {r?.tipo === 'escala' && <><div className="text-[26px] font-extrabold text-ink">{r.media.toLocaleString('pt-BR')}<span className="text-[14px] text-muted"> / 5</span></div><div className="mt-3"><BarList itens={r.distribuicao.map((n, k) => ({ rotulo: `Nota ${k + 1}`, valor: n }))} total={Math.max(1, r.n)} /></div></>}
                {r?.tipo === 'enps' && <><div className="text-[26px] font-extrabold text-ink">{r.enps > 0 ? '+' : ''}{r.enps}</div><p className="text-[12px] text-muted mb-3">eNPS = % promotores (9–10) − % detratores (0–6)</p><BarList itens={[{ rotulo: 'Promotores', valor: r.promotores, cor: '#0f9d6b' }, { rotulo: 'Neutros', valor: r.neutros, cor: '#97a0a9' }, { rotulo: 'Detratores', valor: r.detratores, cor: '#d8433b' }]} total={Math.max(1, r.n)} /></>}
                {r?.tipo === 'opcoes' && <BarList itens={r.contagem.map((c) => ({ rotulo: c.opcao, valor: c.qtd }))} total={Math.max(1, r.n)} />}
                {r?.tipo === 'texto' && (r.textos.length === 0 ? <p className="text-[13px] text-muted">Sem comentários.</p> : <ul className="space-y-2">{r.textos.map((t, k) => <li key={k} className="text-[13px] text-ink-2 bg-surface-2 rounded-xl px-3.5 py-2.5">“{t}”</li>)}</ul>)}
              </div>
            </Card>
          )
        })
      )}
      <p className="text-[11.5px] text-muted">Resultados descritivos de pesquisa voluntária; não use para avaliar pessoas individualmente.</p>
    </div>
  )
}

function resumo(r: ResultadoPergunta | null) {
  if (!r) return 'suprimido'
  if (r.tipo === 'escala') return `média ${r.media}`
  if (r.tipo === 'enps') return `eNPS ${r.enps}`
  if (r.tipo === 'opcoes') return r.contagem.map((c) => `${c.opcao}: ${c.qtd}`).join(' | ')
  return `${r.n} comentário(s) — não exportados`
}

function PesquisaForm({ p, onClose, onSalvo }: { p?: Pesquisa; onClose: () => void; onSalvo: (id: string) => void }) {
  const s = useStore()
  const travada = !!p && s.respostas.some((r) => r.pesquisaId === p.id)
  const [f, setF] = useState(() => ({
    titulo: p?.titulo ?? '', descricao: p?.descricao ?? '', inicio: p?.inicio ?? hojeISO(), fim: p?.fim ?? somarDias(hojeISO(), 14),
    status: p?.status ?? 'rascunho' as Pesquisa['status'], setoresAlvo: p?.setoresAlvo ?? [] as string[], minimoRespostas: p?.minimoRespostas ?? 3,
    perguntas: p?.perguntas ?? [{ id: uid('pq'), texto: '', tipo: 'escala' as TipoPergunta }] as Pergunta[],
  }))
  const updQ = (id: string, patch: Partial<Pergunta>) => setF((x) => ({ ...x, perguntas: x.perguntas.map((q) => (q.id === id ? { ...q, ...patch } : q)) }))
  const salvar = () => {
    const r = s.salvarPesquisa({ ...f, titulo: f.titulo.trim(), perguntas: f.perguntas.map((q) => ({ ...q, texto: q.texto.trim(), opcoes: q.tipo === 'opcoes' ? (q.opcoes ?? []).map((o) => o.trim()).filter(Boolean) : undefined })) }, p?.id)
    if (feedback(r, 'Pesquisa salva.')) { if (!p) onSalvo(useStore.getState().pesquisas[0].id); onClose() }
  }
  return (
    <Modal open onClose={onClose} wide title={p ? 'Editar pesquisa' : 'Nova pesquisa'} subtitle="Respostas são anônimas. Evite perguntas que identifiquem pessoas."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={salvar}>Salvar</Button></>}>
      <Field label="Título" required htmlFor="pq-t"><input id="pq-t" className="input" value={f.titulo} onChange={(e) => setF({ ...f, titulo: e.target.value })} /></Field>
      <Field label="Descrição" htmlFor="pq-d"><input id="pq-d" className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      <div className="grid sm:grid-cols-4 gap-3">
        <Field label="Início" htmlFor="pq-i"><input id="pq-i" type="date" className="input" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
        <Field label="Fim" htmlFor="pq-f"><input id="pq-f" type="date" className="input" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
        <Field label="Situação" htmlFor="pq-s"><Dropdown id="pq-s" className="input" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as Pesquisa['status'] })}><option value="rascunho">Rascunho</option><option value="aberta">Aberta</option><option value="encerrada">Encerrada</option></Dropdown></Field>
        <Field label="Mínimo p/ exibir" htmlFor="pq-m" hint="3 ou mais"><input id="pq-m" type="number" min={3} className="input" value={f.minimoRespostas} onChange={(e) => setF({ ...f, minimoRespostas: Number(e.target.value) })} /></Field>
      </div>
      <fieldset className="mb-4">
        <legend className="label">Áreas convidadas (nenhuma = todas)</legend>
        <div className="flex flex-wrap gap-1.5">{s.setores.map((a) => { const on = f.setoresAlvo.includes(a.id); return <button key={a.id} type="button" aria-pressed={on} onClick={() => setF({ ...f, setoresAlvo: on ? f.setoresAlvo.filter((x) => x !== a.id) : [...f.setoresAlvo, a.id] })} className={`chip ${on ? 'chip-active' : ''}`}>{a.nome}</button> })}</div>
      </fieldset>
      {travada && <Callout tone="warning" icon="Lock" className="mb-3">Esta pesquisa já recebeu respostas: as perguntas não podem ser alteradas.</Callout>}
      <fieldset disabled={travada}>
        <legend className="label">Perguntas</legend>
        <ol className="space-y-3">
          {f.perguntas.map((q, i) => (
            <li key={q.id} className="rounded-xl border border-line p-3">
              <div className="grid sm:grid-cols-[1fr_190px_auto] gap-2">
                <input aria-label={`Pergunta ${i + 1}`} className="input" value={q.texto} onChange={(e) => updQ(q.id, { texto: e.target.value })} placeholder={`Pergunta ${i + 1}`} />
                <Dropdown aria-label="Tipo de resposta" className="input" value={q.tipo} onChange={(e) => updQ(q.id, { tipo: e.target.value as TipoPergunta, opcoes: e.target.value === 'opcoes' ? ['', ''] : undefined })}>{(Object.keys(TIPO_LABEL) as TipoPergunta[]).map((t) => <option key={t} value={t}>{TIPO_LABEL[t]}</option>)}</Dropdown>
                <Button size="icon-sm" variant="subtle" icon="X" aria-label="Remover pergunta" disabled={f.perguntas.length <= 1} onClick={() => setF({ ...f, perguntas: f.perguntas.filter((x) => x.id !== q.id) })} />
              </div>
              {q.tipo === 'opcoes' && (
                <div className="mt-2 grid sm:grid-cols-2 gap-2">
                  {(q.opcoes ?? []).map((o, k) => <input key={k} aria-label={`Opção ${k + 1}`} className="input" value={o} placeholder={`Opção ${k + 1}`} onChange={(e) => updQ(q.id, { opcoes: (q.opcoes ?? []).map((x, j) => (j === k ? e.target.value : x)) })} />)}
                  <Button size="sm" variant="subtle" icon="Plus" onClick={() => updQ(q.id, { opcoes: [...(q.opcoes ?? []), ''] })}>Opção</Button>
                </div>
              )}
            </li>
          ))}
        </ol>
        <Button size="sm" variant="soft" icon="Plus" className="mt-3" onClick={() => setF({ ...f, perguntas: [...f.perguntas, { id: uid('pq'), texto: '', tipo: 'escala' }] })}>Adicionar pergunta</Button>
      </fieldset>
    </Modal>
  )
}
