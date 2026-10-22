/* Editor visual de perguntas: adicionar, editar, duplicar, excluir e reordenar (botões acessíveis ou arrastar). */
import { useState } from 'react'
import { Badge, Button, Callout, Field, Icon, Toggle } from '@/components/ui'
import { cn } from '@/lib/utils'
import { Dropdown } from '@/components/Dropdown'
import {
  ROTULO_TIPO, TIPOS, tipoNumerico, tipoTemOpcoes, validarPergunta, validarEstrutura,
  type Operador, type PerguntaPesquisa, type TipoPergunta,
} from '@/domain/v2/pesquisaTipos'

const OPERADORES: { v: Operador; r: string }[] = [
  { v: 'igual', r: 'for igual a' }, { v: 'diferente', r: 'for diferente de' }, { v: 'maior_igual', r: 'for maior ou igual a' },
  { v: 'menor_igual', r: 'for menor ou igual a' }, { v: 'contem', r: 'contiver' }, { v: 'respondida', r: 'tiver sido respondida' },
]

function novoId(lista: PerguntaPesquisa[]): string {
  const max = lista.reduce((m, p) => { const n = /^q(\d+)$/.exec(p.id); return n ? Math.max(m, Number(n[1])) : m }, 0)
  return `q${max + 1}`
}

export function perguntaPadrao(tipo: TipoPergunta, id: string): PerguntaPesquisa {
  const p: PerguntaPesquisa = { id, tipo, texto: '', obrigatoria: tipo !== 'texto_longo' && tipo !== 'texto_curto' }
  if (tipoTemOpcoes(tipo)) p.opcoes = ['Opção 1', 'Opção 2']
  if (tipo === 'escala') p.escala = { min: 1, max: 10 }
  return p
}

interface Props { perguntas: PerguntaPesquisa[]; onChange: (p: PerguntaPesquisa[]) => void; desabilitado?: boolean }

export function EditorPerguntas({ perguntas, onChange, desabilitado }: Props) {
  const [aberta, setAberta] = useState<string | null>(perguntas.length === 1 ? perguntas[0].id : null)
  const [novoTipo, setNovoTipo] = useState<TipoPergunta>('likert')
  const [arrastando, setArrastando] = useState<number | null>(null)
  const erroGeral = perguntas.length ? validarEstrutura(perguntas) : null

  const atualizar = (i: number, patch: Partial<PerguntaPesquisa>) => onChange(perguntas.map((p, k) => (k === i ? { ...p, ...patch } : p)))
  const mover = (de: number, para: number) => {
    if (para < 0 || para >= perguntas.length || de === para) return
    const l = [...perguntas]; const [x] = l.splice(de, 1); l.splice(para, 0, x); onChange(l)
  }
  const excluir = (i: number) => {
    const id = perguntas[i].id
    // Quem dependia desta pergunta perde a condição (não há mais a que apontar).
    onChange(perguntas.filter((_, k) => k !== i).map((p) => (p.condicao?.perguntaId === id ? { ...p, condicao: undefined } : p)))
  }
  const duplicar = (i: number) => {
    const copia: PerguntaPesquisa = { ...JSON.parse(JSON.stringify(perguntas[i])), id: novoId(perguntas), condicao: undefined }
    const l = [...perguntas]; l.splice(i + 1, 0, copia); onChange(l); setAberta(copia.id)
  }
  const adicionar = () => { const p = perguntaPadrao(novoTipo, novoId(perguntas)); onChange([...perguntas, p]); setAberta(p.id) }
  const mudarTipo = (i: number, tipo: TipoPergunta) => {
    const base = perguntaPadrao(tipo, perguntas[i].id)
    atualizar(i, { tipo, opcoes: tipoTemOpcoes(tipo) ? perguntas[i].opcoes?.length ? perguntas[i].opcoes : base.opcoes : undefined, escala: base.escala })
  }

  return (
    <div className="space-y-3">
      {erroGeral && <Callout tone="warning" icon="AlertTriangle">{erroGeral}</Callout>}
      <datalist id="secoes-pesquisa">{[...new Set(perguntas.map((x) => x.secao).filter(Boolean))].map((x) => <option key={x} value={x} />)}</datalist>
      {perguntas.length === 0 && <div className="rounded-2xl border border-dashed border-line-strong py-10 text-center text-[13.5px] text-muted">Nenhuma pergunta ainda. Escolha um tipo abaixo e clique em “Adicionar pergunta”.</div>}
      <ol className="space-y-3">
        {perguntas.map((p, i) => {
          const erro = validarPergunta(p)
          const anteriores = perguntas.slice(0, i)
          const origem = p.condicao ? anteriores.find((a) => a.id === p.condicao!.perguntaId) : undefined
          const expandida = aberta === p.id
          return (
            <li key={p.id} draggable={!desabilitado && arrastando !== null ? true : undefined}
              onDragOver={(e) => { if (arrastando !== null) e.preventDefault() }}
              onDrop={() => { if (arrastando !== null) mover(arrastando, i); setArrastando(null) }}
              className={cn('rounded-2xl border bg-surface', expandida ? 'border-brand/50 shadow-sm' : 'border-line', erro && 'border-danger/40')}>
              <div className="flex items-center gap-2 px-3 py-2.5">
                <span draggable={!desabilitado} onDragStart={() => setArrastando(i)} onDragEnd={() => setArrastando(null)} title="Arraste para reordenar" aria-hidden
                  className="cursor-grab text-muted-2 hover:text-ink p-1"><Icon name="GripVertical" className="h-4 w-4" /></span>
                <span className="h-6 w-6 rounded-full bg-winter text-[12px] font-bold text-muted flex items-center justify-center shrink-0">{i + 1}</span>
                <button type="button" className="flex-1 min-w-0 text-left" aria-expanded={expandida} onClick={() => setAberta(expandida ? null : p.id)}>
                  <div className="text-[14px] font-semibold text-ink truncate">{p.texto || <span className="text-muted italic">Pergunta sem enunciado</span>}</div>
                  <div className="flex gap-1.5 mt-1 flex-wrap"><Badge>{ROTULO_TIPO[p.tipo]}</Badge>{p.obrigatoria ? <Badge tone="brand">Obrigatória</Badge> : <Badge>Opcional</Badge>}{p.condicao && <Badge tone="gold">Condicional</Badge>}{erro && <Badge tone="danger">Revisar</Badge>}</div>
                </button>
                {!desabilitado && (
                  <div className="flex shrink-0">
                    <Button size="icon-sm" variant="subtle" icon="ChevronUp" aria-label={`Subir pergunta ${i + 1}`} disabled={i === 0} onClick={() => mover(i, i - 1)} />
                    <Button size="icon-sm" variant="subtle" icon="ChevronDown" aria-label={`Descer pergunta ${i + 1}`} disabled={i === perguntas.length - 1} onClick={() => mover(i, i + 1)} />
                    <Button size="icon-sm" variant="subtle" icon="Copy" aria-label={`Duplicar pergunta ${i + 1}`} onClick={() => duplicar(i)} />
                    <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir pergunta ${i + 1}`} onClick={() => excluir(i)} />
                  </div>
                )}
              </div>
              {expandida && (
                <fieldset disabled={desabilitado} className="border-0 px-4 sm:px-5 pb-5 pt-1 border-t border-line">
                  <div className="grid gap-x-4 sm:grid-cols-[1fr_220px] pt-4">
                    <Field label="Enunciado" required erro={erro && !p.texto.trim() ? erro : undefined}>
                      <input className="input" value={p.texto} maxLength={500} onChange={(e) => atualizar(i, { texto: e.target.value })} />
                    </Field>
                    <Field label="Tipo de resposta">
                      <Dropdown className="input" value={p.tipo} onChange={(e) => mudarTipo(i, e.target.value as TipoPergunta)}>
                        {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>)}
                      </Dropdown>
                    </Field>
                  </div>
                  <Field label="Texto de apoio (opcional)"><input className="input" value={p.descricao ?? ''} maxLength={500} onChange={(e) => atualizar(i, { descricao: e.target.value || undefined })} /></Field>

                  {tipoTemOpcoes(p.tipo) && (
                    <Field label={p.tipo === 'ordenacao' ? 'Itens a ordenar' : 'Alternativas'} hint="Mínimo de 2, sem repetições." erro={erro && (p.opcoes ?? []).length >= 0 && /altern/i.test(erro) ? erro : undefined}>
                      <ul className="space-y-2">
                        {(p.opcoes ?? []).map((o, k) => (
                          <li key={k} className="flex gap-2">
                            <input aria-label={`Alternativa ${k + 1}`} className="input" value={o} maxLength={200} onChange={(e) => atualizar(i, { opcoes: (p.opcoes ?? []).map((x, j) => (j === k ? e.target.value : x)) })} />
                            <Button size="icon-sm" variant="subtle" icon="X" aria-label={`Remover alternativa ${k + 1}`} disabled={(p.opcoes ?? []).length <= 2} onClick={() => atualizar(i, { opcoes: (p.opcoes ?? []).filter((_, j) => j !== k) })} />
                          </li>
                        ))}
                      </ul>
                      <Button size="sm" variant="ghost" icon="Plus" className="mt-2" disabled={(p.opcoes ?? []).length >= 20} onClick={() => atualizar(i, { opcoes: [...(p.opcoes ?? []), `Opção ${(p.opcoes ?? []).length + 1}`] })}>Adicionar alternativa</Button>
                    </Field>
                  )}

                  {p.tipo === 'escala' && (
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4">
                      <Field label="Início"><input type="number" className="input" value={p.escala?.min ?? 1} onChange={(e) => atualizar(i, { escala: { ...p.escala!, min: Number(e.target.value) } })} /></Field>
                      <Field label="Fim"><input type="number" className="input" value={p.escala?.max ?? 10} onChange={(e) => atualizar(i, { escala: { ...p.escala!, max: Number(e.target.value) } })} /></Field>
                      <Field label="Rótulo do início"><input className="input" maxLength={60} value={p.escala?.rotuloMin ?? ''} onChange={(e) => atualizar(i, { escala: { ...p.escala!, rotuloMin: e.target.value || undefined } })} /></Field>
                      <Field label="Rótulo do fim"><input className="input" maxLength={60} value={p.escala?.rotuloMax ?? ''} onChange={(e) => atualizar(i, { escala: { ...p.escala!, rotuloMax: e.target.value || undefined } })} /></Field>
                    </div>
                  )}
                  {erro && p.tipo === 'escala' && /escala/i.test(erro) && <p className="text-[11.5px] text-danger -mt-2 mb-3" role="alert">{erro}</p>}

                  <div className="grid gap-x-4 sm:grid-cols-2">
                    <Field label="Dimensão de análise (opcional)" hint="Agrupa perguntas parecidas nos resultados, ex.: Liderança.">
                      <input className="input" maxLength={60} value={p.dimensao ?? ''} onChange={(e) => atualizar(i, { dimensao: e.target.value || undefined })} />
                    </Field>
                    <Field label="Seção (opcional)" hint="Perguntas seguidas com a mesma seção aparecem juntas numa página.">
                      <input className="input" maxLength={80} list="secoes-pesquisa" value={p.secao ?? ''} onChange={(e) => atualizar(i, { secao: e.target.value || undefined })} />
                    </Field>
                    <div className="mb-4 sm:col-span-2"><Toggle checked={p.obrigatoria} onChange={(v) => atualizar(i, { obrigatoria: v })} label="Resposta obrigatória" /></div>
                  </div>

                  <div className="rounded-xl bg-surface-2 border border-line p-3.5">
                    <div className="flex items-center justify-between gap-3 flex-wrap">
                      <div className="text-[13px] font-semibold text-ink">Lógica condicional</div>
                      {i === 0
                        ? <span className="text-[12px] text-muted">A primeira pergunta sempre aparece.</span>
                        : !p.condicao
                          ? <Button size="sm" variant="ghost" icon="GitBranch" onClick={() => atualizar(i, { condicao: { perguntaId: anteriores[anteriores.length - 1].id, operador: 'respondida' } })}>Mostrar só se…</Button>
                          : <Button size="sm" variant="subtle" icon="X" onClick={() => atualizar(i, { condicao: undefined })}>Remover condição</Button>}
                    </div>
                    {p.condicao && (
                      <div className="grid gap-2 mt-3 sm:grid-cols-[1fr_190px_1fr] items-end">
                        <Field label="Mostrar se a pergunta" className="!mb-0">
                          <Dropdown className="input" value={p.condicao.perguntaId} onChange={(e) => atualizar(i, { condicao: { ...p.condicao!, perguntaId: e.target.value, valor: undefined } })}>
                            {!origem && <option value={p.condicao.perguntaId}>(pergunta indisponível)</option>}
                            {anteriores.map((a, k) => <option key={a.id} value={a.id}>{k + 1}. {a.texto.slice(0, 50) || 'sem enunciado'}</option>)}
                          </Dropdown>
                        </Field>
                        <Field label="Condição" className="!mb-0">
                          <Dropdown className="input" value={p.condicao.operador} onChange={(e) => atualizar(i, { condicao: { ...p.condicao!, operador: e.target.value as Operador } })}>
                            {OPERADORES.map((o) => <option key={o.v} value={o.v}>{o.r}</option>)}
                          </Dropdown>
                        </Field>
                        {p.condicao.operador !== 'respondida' && (
                          <Field label="Valor" className="!mb-0">
                            {origem && (origem.tipo === 'sim_nao' || tipoTemOpcoes(origem.tipo))
                              ? <Dropdown className="input" value={String(p.condicao.valor ?? '')} onChange={(e) => atualizar(i, { condicao: { ...p.condicao!, valor: e.target.value } })}>
                                  <option value="">Escolha…</option>
                                  {origem.tipo === 'sim_nao' ? <><option value="sim">Sim</option><option value="nao">Não</option></> : (origem.opcoes ?? []).map((o) => <option key={o} value={o}>{o}</option>)}
                                </Dropdown>
                              : <input className="input" type={origem && tipoNumerico(origem.tipo) ? 'number' : 'text'} value={String(p.condicao.valor ?? '')}
                                  onChange={(e) => atualizar(i, { condicao: { ...p.condicao!, valor: origem && tipoNumerico(origem.tipo) && e.target.value !== '' ? Number(e.target.value) : e.target.value } })} />}
                          </Field>
                        )}
                      </div>
                    )}
                    {p.condicao && !origem && <p className="text-[12px] text-danger mt-2" role="alert">A condição precisa depender de uma pergunta anterior. Escolha outra ou mova esta pergunta para depois dela.</p>}
                  </div>
                </fieldset>
              )}
            </li>
          )
        })}
      </ol>
      {!desabilitado && (
        <div className="flex flex-wrap gap-2 items-center pt-1">
          <Dropdown aria-label="Tipo da nova pergunta" className="input w-auto min-w-[200px]" value={novoTipo} onChange={(e) => setNovoTipo(e.target.value as TipoPergunta)}>
            {TIPOS.map((t) => <option key={t.tipo} value={t.tipo}>{t.rotulo}</option>)}
          </Dropdown>
          <Button icon="Plus" onClick={adicionar}>Adicionar pergunta</Button>
          <span className="text-[12px] text-muted">{TIPOS.find((t) => t.tipo === novoTipo)?.desc}</span>
        </div>
      )}
    </div>
  )
}
