/* Plano de ação de uma pesquisa: transforma o resultado observado em ações com responsável, prazo e acompanhamento.
   Não mostra nem guarda respostas: só o problema descrito por quem analisa. */
import { useState } from 'react'
import { Badge, Button, Card, CardHead, Field } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Dropdown } from '@/components/Dropdown'
import { Aguardar } from '@/components/v2/estados'
import { api, executar, useApi } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import { dataBR } from '@/lib/fmt'

export interface AcaoPlano {
  id: string; dimensao: string | null; problema: string; acao: string; responsavelId: string | null; responsavelNome: string | null
  prazo: string | null; status: 'planejada' | 'em_andamento' | 'concluida' | 'cancelada'; indicador: string | null; conclusao: string | null; concluidaEm: string | null; atrasada: boolean
}
type Rascunho = Partial<Pick<AcaoPlano, 'dimensao' | 'problema' | 'acao' | 'responsavelId' | 'prazo' | 'status' | 'indicador' | 'conclusao'>> & { id?: string }

const STATUS: Record<AcaoPlano['status'], { rotulo: string; tom: 'neutral' | 'brand' | 'success' | 'warning' }> = {
  planejada: { rotulo: 'Planejada', tom: 'neutral' }, em_andamento: { rotulo: 'Em andamento', tom: 'brand' }, concluida: { rotulo: 'Concluída', tom: 'success' }, cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
}

/** `sugestoes`: dimensões com média baixa, oferecidas como ponto de partida (o texto é editável). */
export function PlanoAcao({ pesquisaId, pode, dimensoes, sugestoes }: { pesquisaId: string; pode: boolean; dimensoes: string[]; sugestoes: { dimensao: string; media: number }[] }) {
  const r = useApi<{ itens: AcaoPlano[] }>(`pesquisas/${pesquisaId}/acoes`)
  const pessoas = useStore((s) => s.colaboradores).filter((c) => c.status !== 'encerrado')
  const [form, setForm] = useState<Rascunho | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [remover, setRemover] = useState<AcaoPlano | null>(null)

  const itens = r.dados?.itens ?? []
  const comAcao = new Set(itens.map((a) => a.dimensao).filter(Boolean))
  const pendentes = sugestoes.filter((s) => !comAcao.has(s.dimensao))

  async function salvar() {
    if (!form) return
    const e: Record<string, string> = {}
    if (!form.problema?.trim()) e.problema = 'Descreva o que foi observado'
    if (!form.acao?.trim()) e.acao = 'Descreva a ação'
    setErros(e)
    if (Object.keys(e).length) return
    setSalvando(true)
    const corpo = { dimensao: form.dimensao ?? '', problema: form.problema, acao: form.acao, responsavelId: form.responsavelId ?? '', prazo: form.prazo ?? '', indicador: form.indicador ?? '', ...(form.id ? { status: form.status, conclusao: form.conclusao ?? '' } : {}) }
    const ok = await executar(() => (form.id ? api.patch(`pesquisas/${pesquisaId}/acoes/${form.id}`, corpo) : api.post(`pesquisas/${pesquisaId}/acoes`, corpo)), form.id ? 'Ação atualizada.' : 'Ação criada.')
    setSalvando(false)
    if (ok) { setForm(null); r.recarregar() }
  }
  async function mudarStatus(a: AcaoPlano, status: AcaoPlano['status']) {
    if (status === 'concluida') { setErros({}); setForm({ ...a, status }); return } // pede o registro de conclusão
    if (await executar(() => api.patch(`pesquisas/${pesquisaId}/acoes/${a.id}`, { status }), 'Status atualizado.')) r.recarregar()
  }

  const set = (k: keyof Rascunho, v: string) => { setForm((f) => ({ ...f, [k]: v })); setErros((x) => ({ ...x, [k]: '' })) }

  return (
    <Card>
      <CardHead title="Plano de ação" sub="Ações decorrentes desta pesquisa, com responsável e prazo."
        action={pode && <Button size="sm" icon="Plus" onClick={() => { setErros({}); setForm({ status: 'planejada' }) }}>Nova ação</Button>} />
      <div className="p-5 space-y-4">
        {pode && pendentes.length > 0 && (
          <div className="rounded-xl border border-dashed border-line p-3.5">
            <div className="text-[12.5px] text-muted mb-2">Dimensões que merecem investigação e ainda não têm ação:</div>
            <div className="flex flex-wrap gap-2">
              {pendentes.map((s) => (
                <Button key={s.dimensao} size="sm" variant="ghost" icon="Plus" onClick={() => { setErros({}); setForm({ status: 'planejada', dimensao: s.dimensao, problema: `Média ${s.media.toLocaleString('pt-BR')} de 5 em “${s.dimensao}”.` }) }}>{s.dimensao}</Button>
              ))}
            </div>
          </div>
        )}
        <Aguardar r={r} linhas={2}>
          {() => itens.length === 0
            ? <p className="text-[13px] text-muted">{pode ? 'Nenhuma ação ainda. Registre o que será feito a partir dos resultados para acompanhar até a conclusão.' : 'Nenhuma ação registrada para esta pesquisa.'}</p>
            : (
              <ul className="divide-y divide-line -my-2">
                {itens.map((a) => (
                  <li key={a.id} className="py-3">
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0 flex-1">
                        <div className="text-[14px] font-semibold text-ink">{a.acao}</div>
                        <div className="text-[12.5px] text-ink-2 mt-0.5"><span className="text-muted">Observado:</span> {a.problema}</div>
                        <div className="text-[12px] text-muted mt-1 flex flex-wrap gap-x-3 gap-y-0.5">
                          {a.dimensao && <span>Dimensão: {a.dimensao}</span>}
                          <span>Responsável: {a.responsavelNome ?? 'não definido'}</span>
                          <span>Prazo: {a.prazo ? dataBR(a.prazo) : 'sem prazo'}</span>
                          {a.indicador && <span>Acompanhamento: {a.indicador}</span>}
                        </div>
                        {a.status === 'concluida' && a.conclusao && <div className="text-[12.5px] text-ink-2 mt-1"><span className="text-muted">Conclusão{a.concluidaEm ? ` (${dataBR(a.concluidaEm)})` : ''}:</span> {a.conclusao}</div>}
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        {a.atrasada && <Badge tone="danger">Atrasada</Badge>}
                        {pode ? (
                          <Dropdown aria-label="Status da ação" className="input h-8 py-0 text-[12.5px] w-auto" value={a.status} onChange={(e) => void mudarStatus(a, e.target.value as AcaoPlano['status'])}>
                            {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
                          </Dropdown>
                        ) : <Badge tone={STATUS[a.status].tom}>{STATUS[a.status].rotulo}</Badge>}
                        {pode && <Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar ação" onClick={() => { setErros({}); setForm({ ...a }) }} />}
                        {pode && <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover ação" onClick={() => setRemover(a)} />}
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            )}
        </Aguardar>
      </div>

      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar ação' : 'Nova ação'}
        subtitle="Descreva o resultado observado e a ação. A causa ainda é hipótese: confirme com a equipe antes de concluir."
        footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button icon="Check" disabled={salvando} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button></>}>
        {form && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Dimensão ou pergunta relacionada" htmlFor="pa-dim" className="sm:col-span-2">
              <input id="pa-dim" className="input" list="pa-dims" maxLength={120} value={form.dimensao ?? ''} onChange={(e) => set('dimensao', e.target.value)} />
              <datalist id="pa-dims">{dimensoes.map((d) => <option key={d} value={d} />)}</datalist>
            </Field>
            <Field label="Resultado observado" required erro={erros.problema} htmlFor="pa-prob" className="sm:col-span-2">
              <textarea id="pa-prob" className="input" rows={2} maxLength={1000} value={form.problema ?? ''} onChange={(e) => set('problema', e.target.value)} aria-invalid={!!erros.problema} />
            </Field>
            <Field label="Ação proposta" required erro={erros.acao} htmlFor="pa-acao" className="sm:col-span-2">
              <textarea id="pa-acao" className="input" rows={2} maxLength={1000} value={form.acao ?? ''} onChange={(e) => set('acao', e.target.value)} aria-invalid={!!erros.acao} />
            </Field>
            <Field label="Responsável" htmlFor="pa-resp">
              <Dropdown id="pa-resp" className="input" value={form.responsavelId ?? ''} onChange={(e) => set('responsavelId', e.target.value)}>
                <option value="">Não definido</option>
                {pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
              </Dropdown>
            </Field>
            <Field label="Prazo" htmlFor="pa-prazo">
              <input id="pa-prazo" type="date" className="input" value={form.prazo ?? ''} onChange={(e) => set('prazo', e.target.value)} />
            </Field>
            <Field label="Como acompanhar" hint="Ex.: média ≥ 3,5 nesta dimensão na próxima pesquisa" htmlFor="pa-ind" className="sm:col-span-2">
              <input id="pa-ind" className="input" maxLength={300} value={form.indicador ?? ''} onChange={(e) => set('indicador', e.target.value)} />
            </Field>
            {form.id && (
              <Field label="Status" htmlFor="pa-status">
                <Dropdown id="pa-status" className="input" value={form.status ?? 'planejada'} onChange={(e) => set('status', e.target.value)}>
                  {Object.entries(STATUS).map(([k, s]) => <option key={k} value={k}>{s.rotulo}</option>)}
                </Dropdown>
              </Field>
            )}
            {form.id && form.status === 'concluida' && (
              <Field label="Registro de conclusão" hint="O que foi feito e qual foi o efeito percebido." htmlFor="pa-conc" className="sm:col-span-2">
                <textarea id="pa-conc" className="input" rows={3} maxLength={2000} value={form.conclusao ?? ''} onChange={(e) => set('conclusao', e.target.value)} />
              </Field>
            )}
          </div>
        )}
      </Modal>

      <Modal open={!!remover} onClose={() => setRemover(null)} title="Remover ação?" subtitle={remover?.acao}
        footer={<><Button variant="ghost" onClick={() => setRemover(null)}>Cancelar</Button><Button variant="danger" icon="Trash2" onClick={async () => {
          if (remover && await executar(() => api.del(`pesquisas/${pesquisaId}/acoes/${remover.id}`), 'Ação removida.')) { setRemover(null); r.recarregar() }
        }}>Remover</Button></>}>
        <p className="text-[13.5px] text-ink-2 pb-2">A ação some do plano. Se ela só deixou de fazer sentido, prefira mudar o status para <b>Cancelada</b> e manter o histórico.</p>
      </Modal>
    </Card>
  )
}
