import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Exigencia, SituacaoExigencia, TipoExigencia } from '@/lib/types'
import { PageHeader, Card, Button, Field, Badge, EmptyState, Select, Tabela, TH, TD, IndicadorCard, SearchBox, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { BotaoImprimir } from '@/components/inputs'
import { feedback, toast } from '@/components/toast'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias, diasEntre } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { Dropdown } from '@/components/Dropdown'

export const TIPOS_EXIGENCIA: TipoExigencia[] = ['Exame exigido por cliente', 'Certificação técnica', 'Treinamento de segurança (NR)', 'Certidão', 'Registro profissional', 'Seguro de responsabilidade', 'Outro']
export const SITUACAO_EX: Record<SituacaoExigencia, { label: string; tone: string }> = { regular: { label: 'Regular', tone: 'success' }, com_ressalvas: { label: 'Com ressalvas', tone: 'warning' }, irregular: { label: 'Irregular', tone: 'danger' } }

export function validadeEx(e: Exigencia, hoje: string): { label: string; tone: string; ordem: number } {
  if (!e.validade) return { label: 'Sem validade', tone: 'neutral', ordem: 3 }
  if (e.validade < hoje) return { label: `Vencida há ${diasEntre(e.validade, hoje)} d`, tone: 'danger', ordem: 0 }
  const d = diasEntre(hoje, e.validade)
  return d <= 60 ? { label: `Vence em ${d} d`, tone: 'warning', ordem: 1 } : { label: 'Válida', tone: 'success', ordem: 2 }
}

export default function Exigencias() {
  const s = useStore()
  const hoje = hojeISO()
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('')
  const [sit, setSit] = useState('')
  const [form, setForm] = useState<{ aberto: boolean; e?: Exigencia }>({ aberto: false })
  const [remover, setRemover] = useState<Exigencia | null>(null)
  const ativos = new Set(s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => c.id))
  const lista = useMemo(() => s.exigencias
    .filter((e) => !tipo || e.tipo === tipo)
    .filter((e) => !sit || (sit === 'vencidas' ? validadeEx(e, hoje).ordem === 0 : sit === 'vencendo' ? validadeEx(e, hoje).ordem === 1 : true))
    .filter((e) => !q.trim() || `${s.nomeDe(e.colaboradorId)} ${e.descricao}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => validadeEx(a, hoje).ordem - validadeEx(b, hoje).ordem || (a.validade ?? '9').localeCompare(b.validade ?? '9')), [s, tipo, sit, q, hoje])

  const exportar = () => {
    baixarArquivo(gerarCSV(lista, [
      { titulo: 'Pessoa', valor: (e) => s.nomeDe(e.colaboradorId) }, { titulo: 'Tipo', valor: (e) => e.tipo }, { titulo: 'Descrição', valor: (e) => e.descricao },
      { titulo: 'Data', valor: (e) => e.data }, { titulo: 'Validade', valor: (e) => e.validade ?? '' }, { titulo: 'Situação', valor: (e) => SITUACAO_EX[e.situacao].label }, { titulo: 'Emissor', valor: (e) => e.emissor ?? '' },
    ], [`Exigências e certificações — ${new Date().toLocaleString('pt-BR')}`]), `exigencias-${hoje}.csv`)
    toast('Lista exportada.')
  }

  return (
    <>
      <PageHeader title="Exigências & certificações" subtitle="Certificações, registros profissionais, seguros e exames exigidos por clientes — com controle de validade."
        actions={<><BotaoImprimir /><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Nova exigência</Button></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <IndicadorCard titulo="Vencidas" valor={s.exigencias.filter((e) => ativos.has(e.colaboradorId) && validadeEx(e, hoje).ordem === 0).length} icon="ShieldAlert" tone="danger" definicao="Exigências de parcerias ativas com validade anterior a hoje." fonte="Exigências e certificações" />
        <IndicadorCard titulo="Vencem em 60 dias" valor={s.exigencias.filter((e) => ativos.has(e.colaboradorId) && validadeEx(e, hoje).ordem === 1).length} icon="ShieldQuestion" tone="warning" definicao="Validade entre hoje e os próximos 60 dias." fonte="Exigências e certificações" />
        <IndicadorCard titulo="Irregulares" valor={s.exigencias.filter((e) => e.situacao === 'irregular').length} icon="ShieldX" tone="danger" definicao="Exigências marcadas como irregulares." fonte="Exigências e certificações" />
        <IndicadorCard titulo="Total" valor={s.exigencias.length} icon="ShieldCheck" definicao="Todas as exigências registradas." fonte="Exigências e certificações" />
      </div>
      <Callout tone="neutral" icon="Info" className="mb-5 no-print">Adaptação do módulo de “Saúde ocupacional” para a prestação de serviços: registra o que clientes ou a legislação da atividade exigem da empresa prestadora. Resultados de exames médicos são dados sensíveis — registre apenas a situação, nunca diagnósticos.</Callout>
      <div className="flex flex-wrap gap-3 mb-4 no-print">
        <SearchBox value={q} onChange={setQ} placeholder="Pessoa ou descrição" label="Buscar exigências" />
        <Select label="Tipo" value={tipo} onChange={setTipo}><option value="">Todos os tipos</option>{TIPOS_EXIGENCIA.map((t) => <option key={t}>{t}</option>)}</Select>
        <Select label="Validade" value={sit} onChange={setSit}><option value="">Todas</option><option value="vencidas">Vencidas</option><option value="vencendo">Vencendo em 60 dias</option></Select>
      </div>
      <Card>
        {lista.length === 0 ? <EmptyState icon="ShieldCheck" title="Nenhuma exigência no filtro" /> : (
          <Tabela minWidth={860}>
            <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Tipo</th><th className={TH}>Descrição</th><th className={TH}>Data</th><th className={TH}>Validade</th><th className={TH}>Situação</th><th className={`${TH} no-print`}></th></tr></thead>
            <tbody>
              {lista.map((e) => {
                const v = validadeEx(e, hoje)
                return (
                  <tr key={e.id}>
                    <td className={TD}><Link to={`/rh/pessoas/${e.colaboradorId}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(e.colaboradorId)}</Link></td>
                    <td className={TD}>{e.tipo}</td>
                    <td className={TD}><div className="text-ink-2">{e.descricao}</div>{(e.emissor || e.registro) && <div className="text-[11.5px] text-muted">{[e.emissor, e.registro].filter(Boolean).join(' · ')}</div>}</td>
                    <td className={TD}>{fmtDate(e.data)}</td>
                    <td className={TD}><Badge tone={v.tone} dot>{v.label}</Badge></td>
                    <td className={TD}><Badge tone={SITUACAO_EX[e.situacao].tone}>{SITUACAO_EX[e.situacao].label}</Badge></td>
                    <td className={`${TD} no-print`}><div className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, e })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(e)} /></div></td>
                  </tr>
                )
              })}
            </tbody>
          </Tabela>
        )}
      </Card>
      {form.aberto && <ExigenciaForm e={form.e} onClose={() => setForm({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover exigência?" confirmar="Remover" texto="Esta ação não pode ser desfeita."
        onConfirm={() => { if (remover && feedback(s.removerExigencia(remover.id), 'Exigência removida.')) setRemover(null) }} />
    </>
  )
}

export function ExigenciaForm({ e, onClose, pessoaFixa }: { e?: Exigencia; onClose: () => void; pessoaFixa?: string }) {
  const s = useStore()
  const docs = s.documentos.filter((d) => d.colaboradorId === (pessoaFixa ?? e?.colaboradorId))
  const salvar = (ev: React.FormEvent<HTMLFormElement>) => {
    ev.preventDefault()
    const d = Object.fromEntries(new FormData(ev.currentTarget)) as Record<string, string>
    const r = s.salvarExigencia({ colaboradorId: pessoaFixa ?? d.colaboradorId, tipo: d.tipo as TipoExigencia, descricao: d.descricao.trim(), data: d.data, validade: d.validade || undefined, situacao: d.situacao as SituacaoExigencia, emissor: d.emissor.trim() || undefined, registro: d.registro.trim() || undefined, observacoes: d.observacoes.trim() || undefined, documentoId: d.documentoId || undefined }, e?.id)
    if (feedback(r, e ? 'Exigência atualizada.' : 'Exigência registrada.')) onClose()
  }
  return (
    <Modal open onClose={onClose} wide title={e ? 'Editar exigência' : 'Nova exigência'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="exForm">Salvar</Button></>}>
      <form id="exForm" onSubmit={salvar}>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          {!pessoaFixa && <Field label="Pessoa" required htmlFor="ex-p"><Dropdown id="ex-p" name="colaboradorId" className="input" defaultValue={e?.colaboradorId ?? ''} required><option value="" disabled>Selecione…</option>{s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>}
          <Field label="Tipo" htmlFor="ex-t"><Dropdown id="ex-t" name="tipo" className="input" defaultValue={e?.tipo ?? 'Certificação técnica'}>{TIPOS_EXIGENCIA.map((t) => <option key={t}>{t}</option>)}</Dropdown></Field>
          <Field label="Descrição" required htmlFor="ex-d" className="sm:col-span-2"><input id="ex-d" name="descricao" className="input" defaultValue={e?.descricao} /></Field>
          <Field label="Data de emissão/realização" htmlFor="ex-dt"><input id="ex-dt" name="data" type="date" className="input" defaultValue={e?.data ?? hojeISO()} /></Field>
          <Field label="Validade" htmlFor="ex-v"><input id="ex-v" name="validade" type="date" className="input" defaultValue={e?.validade ?? somarDias(hojeISO(), 365)} /></Field>
          <Field label="Situação" htmlFor="ex-s"><Dropdown id="ex-s" name="situacao" className="input" defaultValue={e?.situacao ?? 'regular'}>{Object.entries(SITUACAO_EX).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Dropdown></Field>
          <Field label="Emissor / instituição" htmlFor="ex-e"><input id="ex-e" name="emissor" className="input" defaultValue={e?.emissor} /></Field>
          <Field label="Nº de registro" htmlFor="ex-r"><input id="ex-r" name="registro" className="input" defaultValue={e?.registro} /></Field>
          <Field label="Documento comprobatório" htmlFor="ex-doc"><Dropdown id="ex-doc" name="documentoId" className="input" defaultValue={e?.documentoId ?? ''}><option value="">Nenhum</option>{docs.map((d) => <option key={d.id} value={d.id}>{d.nome}</option>)}</Dropdown></Field>
        </div>
        <Field label="Observações" htmlFor="ex-o" hint="Não registre diagnósticos ou detalhes de saúde."><textarea id="ex-o" name="observacoes" rows={2} className="input !h-auto py-2.5" defaultValue={e?.observacoes} /></Field>
      </form>
    </Modal>
  )
}
