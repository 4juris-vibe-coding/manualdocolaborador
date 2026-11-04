/* ============================================================
   Vaga · questionários e documentos por etapa do pipeline.
   O RH liga questionários (fit cultural / DISC) a uma etapa e
   define se a etapa solicita documentos do candidato. O candidato
   responde/envia pelo portal enquanto estiver naquela etapa.
   ============================================================ */
import { useEffect, useState } from 'react'
import { Badge, Button, Callout, Card, CardHead, Field, Toggle } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { Dropdown } from '@/components/Dropdown'
import { Aguardar } from '@/components/v2/estados'
import { api, executar, useApi } from '@/data/v2/api'
import {
  AVISO_APOIO, AVISO_DISC_INTERNO, AVISO_NAO_DISCRIMINACAO, DIMENSOES, ROTULO_DIMENSAO, ROTULO_TIPO_PERGUNTA, ROTULO_TIPO_QUESTIONARIO, TIPOS_PERGUNTA_FIT,
  type Dimensao, type TipoPerguntaFit, type TipoQuestionario,
} from '@/domain/v2/avaliacoesEtapa'

const TEXTAREA = 'input h-auto min-h-[72px] py-2.5 leading-relaxed resize-y'
const novoId = () => Math.random().toString(36).slice(2, 10)

interface Etapa { id: string; nome: string; tipo: string; ordem: number; solicitaDocumentos: boolean; instrucaoDocumentos: string; avisarCandidato?: boolean }
interface Alt { id: string; texto: string; pontos: string }
interface Perg { id: string; tipo: TipoPerguntaFit; texto: string; obrigatoria: boolean; alternativas: Alt[]; competencia: string; peso: string; criterio: string }
interface Afirm { id: string; texto: string; dimensao: Dimensao }
interface Bloco { id: string; afirmacoes: Afirm[] }
interface Faixa { min: string; rotulo: string; descricao: string }
interface Rascunho {
  id?: string; tipo: TipoQuestionario; etapaId: string; titulo: string; instrucoes: string; ativo: boolean
  competencias: string[]; perguntas: Perg[]; faixas: Faixa[]
  itens: Bloco[]; usarPerfil: boolean; perfil: Record<Dimensao, string>; justificativa: string
  instrumento: { origem: 'interno' | 'externo'; nome: string; versao: string }
}
interface Dados { etapas: Etapa[]; questionarios: any[]; permissoes: { gerenciar: boolean } }

const perguntaVazia = (): Perg => ({ id: novoId(), tipo: 'escala', texto: '', obrigatoria: true, alternativas: [], competencia: '', peso: '1', criterio: '' })
const blocoVazio = (): Bloco => ({ id: novoId(), afirmacoes: DIMENSOES.map((d) => ({ id: novoId(), texto: '', dimensao: d })) })
const str = (v: unknown) => (v === null || v === undefined ? '' : String(v))

function rascunhoDe(tipo: TipoQuestionario, etapaId: string, q?: any): Rascunho {
  const p = q?.perfilRecomendado
  return {
    id: q?.id, tipo, etapaId: q?.etapaId ?? etapaId, titulo: q?.titulo ?? (tipo === 'disc' ? 'Perfil comportamental' : 'Fit cultural'), instrucoes: q?.instrucoes ?? '', ativo: q?.ativo ?? true,
    competencias: q?.competencias ?? [],
    perguntas: (q?.perguntas ?? [perguntaVazia()]).map((x: any) => ({
      id: x.id, tipo: x.tipo, texto: x.texto ?? '', obrigatoria: x.obrigatoria !== false, competencia: x.competencia ?? '', peso: str(x.peso ?? 1), criterio: x.criterio ?? '',
      alternativas: (x.alternativas ?? []).map((a: any) => ({ id: a.id, texto: a.texto ?? '', pontos: str(a.pontos) })),
    })),
    faixas: (q?.faixas ?? []).map((f: any) => ({ min: str(f.min), rotulo: f.rotulo ?? '', descricao: f.descricao ?? '' })),
    itens: q?.itens?.length ? q.itens : [blocoVazio(), blocoVazio()],
    usarPerfil: !!p, perfil: { D: str(p?.D ?? 50), I: str(p?.I ?? 50), S: str(p?.S ?? 50), C: str(p?.C ?? 50) }, justificativa: p?.justificativa ?? '',
    instrumento: q?.instrumento ?? { origem: 'interno', nome: 'Instrumento interno de escolha forçada', versao: '1' },
  }
}

function corpoDe(r: Rascunho) {
  const num = (s: string) => (s.trim() === '' ? null : Number(s.replace(',', '.')))
  const base = { etapaId: r.etapaId, titulo: r.titulo, instrucoes: r.instrucoes, ativo: r.ativo, tipo: r.tipo }
  if (r.tipo === 'fit_cultural') {
    return {
      ...base, competencias: r.competencias,
      perguntas: r.perguntas.map((p) => ({
        id: p.id, tipo: p.tipo, texto: p.texto, obrigatoria: p.obrigatoria, competencia: p.competencia || null, peso: num(p.peso) ?? 1, criterio: p.criterio || null,
        ...(p.tipo === 'escolha' ? { alternativas: p.alternativas.map((a) => ({ id: a.id, texto: a.texto, pontos: num(a.pontos) })) } : {}),
      })),
      faixas: r.faixas.map((f) => ({ min: num(f.min), rotulo: f.rotulo, descricao: f.descricao })),
    }
  }
  return {
    ...base, itens: r.itens, instrumento: r.instrumento,
    perfilRecomendado: r.usarPerfil ? { D: num(r.perfil.D), I: num(r.perfil.I), S: num(r.perfil.S), C: num(r.perfil.C), justificativa: r.justificativa } : null,
  }
}

export function AvaliacoesEtapa({ vagaId }: { vagaId: string }) {
  const r = useApi<Dados>(`ats/vagas/${vagaId}/avaliacoes-etapa`)
  const [editar, setEditar] = useState<Rascunho | null>(null)
  const [excluir, setExcluir] = useState<any | null>(null)
  return (
    <Card className="mt-5">
      <CardHead title="Questionários e documentos por etapa" sub="O candidato responde e envia arquivos pelo portal, com o código de acompanhamento, enquanto estiver na etapa." />
      <div className="p-5 pt-0">
        <Aguardar r={r}>
          {(d) => {
            const g = d.permissoes.gerenciar
            const semEtapa = d.questionarios.filter((q) => !q.etapaId || !d.etapas.some((e) => e.id === q.etapaId))
            return (
              <>
                <Callout tone="neutral" icon="Scale" className="mb-4">{AVISO_APOIO} Resultados nunca aprovam ou reprovam candidatos automaticamente.</Callout>
                {!g && <p className="text-[12.5px] text-muted mb-3">Somente quem gerencia o ATS altera esta configuração.</p>}
                <ul className="space-y-3">
                  {d.etapas.map((e) => (
                    <li key={e.id}>
                      <EtapaBloco etapa={e} vagaId={vagaId} gerenciar={g} questionarios={d.questionarios.filter((q) => q.etapaId === e.id)} onMudou={r.recarregar}
                        onNovo={(tipo) => setEditar(rascunhoDe(tipo, e.id))} onEditar={(q) => setEditar(rascunhoDe(q.tipo, e.id, q))} onExcluir={setExcluir} />
                    </li>
                  ))}
                </ul>
                {semEtapa.length > 0 && (
                  <div className="mt-4">
                    <div className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Sem etapa (etapa removida)</div>
                    <ListaQuestionarios itens={semEtapa} gerenciar={g} onEditar={(q) => setEditar(rascunhoDe(q.tipo, d.etapas[0]?.id ?? '', q))} onExcluir={setExcluir} />
                  </div>
                )}
                {editar && <EditorQuestionario vagaId={vagaId} etapas={d.etapas} inicial={editar} onClose={() => setEditar(null)} onSalvo={() => { setEditar(null); r.recarregar() }} />}
                <ConfirmModal open={!!excluir} onClose={() => setExcluir(null)} titulo="Excluir questionário?" confirmar="Excluir"
                  texto={excluir?.respostas ? 'Este questionário já tem respostas e não pode ser excluído. Desative-o na edição.' : 'O questionário deixa de existir para esta vaga.'}
                  onConfirm={async () => { const q = excluir; setExcluir(null); if (await executar(() => api.del(`ats/questionarios/${q.id}`), 'Questionário excluído.')) r.recarregar() }} />
              </>
            )
          }}
        </Aguardar>
      </div>
    </Card>
  )
}

function ListaQuestionarios({ itens, gerenciar, onEditar, onExcluir }: { itens: any[]; gerenciar: boolean; onEditar: (q: any) => void; onExcluir: (q: any) => void }) {
  return (
    <ul className="space-y-2">
      {itens.map((q) => (
        <li key={q.id} className="flex items-center justify-between gap-3 flex-wrap rounded-xl border border-line px-3 py-2.5">
          <div className="min-w-0">
            <div className="text-[13.5px] font-semibold text-ink">{q.titulo}</div>
            <div className="flex flex-wrap gap-1.5 mt-1">
              <Badge tone="brand">{ROTULO_TIPO_QUESTIONARIO[q.tipo as TipoQuestionario]}</Badge>
              {!q.ativo && <Badge tone="neutral">Desativado</Badge>}
              <Badge tone="neutral">{q.respostas} {q.respostas === 1 ? 'resposta' : 'respostas'}</Badge>
              {q.tipo === 'disc' && !q.perfilRecomendado && <Badge tone="warning">Sem perfil recomendado</Badge>}
            </div>
          </div>
          {gerenciar && (
            <div className="flex gap-1.5">
              <Button size="sm" variant="ghost" icon="Pencil" onClick={() => onEditar(q)}>Editar</Button>
              <Button size="sm" variant="subtle" icon="Trash2" aria-label={`Excluir ${q.titulo}`} onClick={() => onExcluir(q)} />
            </div>
          )}
        </li>
      ))}
    </ul>
  )
}

function EtapaBloco({ etapa, vagaId, gerenciar, questionarios, onMudou, onNovo, onEditar, onExcluir }: {
  etapa: Etapa; vagaId: string; gerenciar: boolean; questionarios: any[]; onMudou: () => void
  onNovo: (t: TipoQuestionario) => void; onEditar: (q: any) => void; onExcluir: (q: any) => void
}) {
  const [solicita, setSolicita] = useState(etapa.solicitaDocumentos)
  const [instrucao, setInstrucao] = useState(etapa.instrucaoDocumentos)
  const [avisar, setAvisar] = useState(!!etapa.avisarCandidato)
  useEffect(() => { setSolicita(etapa.solicitaDocumentos); setInstrucao(etapa.instrucaoDocumentos); setAvisar(!!etapa.avisarCandidato) }, [etapa.solicitaDocumentos, etapa.instrucaoDocumentos, etapa.avisarCandidato])
  const mudou = solicita !== etapa.solicitaDocumentos || instrucao !== etapa.instrucaoDocumentos || avisar !== !!etapa.avisarCandidato
  const idInstr = `instr-${etapa.id}`
  return (
    <div className="rounded-2xl border border-line p-4">
      <div className="flex items-center justify-between gap-2 flex-wrap mb-3">
        <div className="font-bold text-ink text-[14px]">{etapa.ordem}. {etapa.nome}</div>
        {gerenciar && (
          <div className="flex gap-1.5 flex-wrap">
            <Button size="sm" variant="soft" icon="Plus" onClick={() => onNovo('fit_cultural')}>Fit cultural</Button>
            <Button size="sm" variant="soft" icon="Plus" onClick={() => onNovo('disc')}>DISC</Button>
          </div>
        )}
      </div>
      {questionarios.length > 0 ? <ListaQuestionarios itens={questionarios} gerenciar={gerenciar} onEditar={onEditar} onExcluir={onExcluir} /> : <p className="text-[12.5px] text-muted">Nenhum questionário nesta etapa.</p>}
      <div className="mt-3 pt-3 border-t border-line">
        <Toggle checked={solicita} disabled={!gerenciar} onChange={setSolicita} label="Solicita documentos do candidato" />
        {solicita && (
          <Field label="Instrução para o candidato" htmlFor={idInstr} className="mt-3 mb-2" hint="Ex.: Envie RG e comprovante de residência em PDF.">
            <input id={idInstr} className="input" maxLength={500} value={instrucao} disabled={!gerenciar} onChange={(e) => setInstrucao(e.target.value)} />
          </Field>
        )}
        {etapa.ordem > 1 && (
          <div className="mt-3">
            <Toggle checked={avisar} disabled={!gerenciar} onChange={setAvisar} label="Avisar o candidato por e-mail ao entrar nesta etapa" />
            <p className="text-[11.5px] text-muted mt-1">Usa o modelo “Atualização de etapa”. O e-mail mostra só o nome para o candidato da etapa, nunca o nome interno. Sem e-mail configurado no servidor, fica registrado como não enviado.</p>
          </div>
        )}
        {gerenciar && mudou && (
          <Button size="sm" className="mt-2" icon="Save" onClick={async () => {
            const ok = await executar(() => api.put(`ats/vagas/${vagaId}/etapas/${etapa.id}/config`, { solicitaDocumentos: solicita, instrucaoDocumentos: instrucao, avisarCandidato: avisar }), 'Etapa atualizada.')
            if (ok) onMudou()
          }}>Salvar</Button>
        )}
      </div>
    </div>
  )
}

/* ---------- editor ---------- */
function EditorQuestionario({ vagaId, etapas, inicial, onClose, onSalvo }: { vagaId: string; etapas: Etapa[]; inicial: Rascunho; onClose: () => void; onSalvo: () => void }) {
  const [r, setR] = useState<Rascunho>(inicial)
  const [salvando, setSalvando] = useState(false)
  const up = (p: Partial<Rascunho>) => setR((x) => ({ ...x, ...p }))

  async function salvar() {
    setSalvando(true)
    const corpo = corpoDe(r)
    const ok = await executar(() => (r.id ? api.put(`ats/questionarios/${r.id}`, corpo) : api.post(`ats/vagas/${vagaId}/questionarios`, corpo)), 'Questionário salvo.')
    setSalvando(false)
    if (ok) onSalvo()
  }

  return (
    <Modal open onClose={onClose} wide title={`${r.id ? 'Editar' : 'Novo'} questionário · ${ROTULO_TIPO_QUESTIONARIO[r.tipo]}`}
      footer={<>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button onClick={() => void salvar()} disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
      </>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Título" required htmlFor="qe-titulo"><input id="qe-titulo" className="input" maxLength={120} value={r.titulo} onChange={(e) => up({ titulo: e.target.value })} /></Field>
        <Field label="Etapa" required htmlFor="qe-etapa">
          <Dropdown id="qe-etapa" className="input" value={r.etapaId} onChange={(e) => up({ etapaId: e.target.value })}>
            {etapas.map((e) => <option key={e.id} value={e.id}>{e.ordem}. {e.nome}</option>)}
          </Dropdown>
        </Field>
      </div>
      <Field label="Instruções ao candidato" htmlFor="qe-instr"><textarea id="qe-instr" className={TEXTAREA} maxLength={1000} value={r.instrucoes} onChange={(e) => up({ instrucoes: e.target.value })} /></Field>
      <div className="mb-4"><Toggle checked={r.ativo} onChange={(v) => up({ ativo: v })} label="Disponível para o candidato quando estiver nesta etapa" /></div>
      {r.tipo === 'fit_cultural' ? <EditorFit r={r} up={up} /> : <EditorDisc r={r} up={up} />}
    </Modal>
  )
}

function EditorFit({ r, up }: { r: Rascunho; up: (p: Partial<Rascunho>) => void }) {
  const [novaComp, setNovaComp] = useState('')
  const setP = (i: number, p: Partial<Perg>) => up({ perguntas: r.perguntas.map((x, j) => (j === i ? { ...x, ...p } : x)) })
  return (
    <>
      <Callout tone="warning" icon="ShieldAlert" className="mb-4"><b>Sem discriminação.</b> {AVISO_NAO_DISCRIMINACAO}</Callout>

      <div className="mb-5">
        <div className="label">Competências avaliadas</div>
        <div className="flex flex-wrap gap-1.5 mb-2">
          {r.competencias.length === 0 && <span className="text-[12.5px] text-muted">Nenhuma. Sem competência, a pergunta entra só na nota geral.</span>}
          {r.competencias.map((c) => (
            <span key={c} className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 text-[12px] font-semibold pl-2.5 pr-1 py-0.5">
              {c}
              <button type="button" className="rounded-full px-1 hover:bg-brand-200" aria-label={`Remover ${c}`}
                onClick={() => up({ competencias: r.competencias.filter((x) => x !== c), perguntas: r.perguntas.map((p) => (p.competencia === c ? { ...p, competencia: '' } : p)) })}>×</button>
            </span>
          ))}
        </div>
        <form className="flex gap-2" onSubmit={(e) => { e.preventDefault(); const t = novaComp.trim(); if (t && !r.competencias.includes(t) && r.competencias.length < 12) up({ competencias: [...r.competencias, t] }); setNovaComp('') }}>
          <input aria-label="Nova competência" className="input" maxLength={60} placeholder="Ex.: Colaboração" value={novaComp} onChange={(e) => setNovaComp(e.target.value)} />
          <Button type="submit" variant="ghost" icon="Plus">Adicionar</Button>
        </form>
      </div>

      <div className="label">Perguntas</div>
      <ol className="space-y-3 mb-3">
        {r.perguntas.map((p, i) => {
          const pid = `qp-${p.id}`
          return (
            <li key={p.id} className="rounded-xl border border-line p-3">
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Pergunta {i + 1}</span>
                <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover pergunta ${i + 1}`} disabled={r.perguntas.length <= 1} onClick={() => up({ perguntas: r.perguntas.filter((_, j) => j !== i) })} />
              </div>
              <Field label="Texto da pergunta" htmlFor={`${pid}-t`}><input id={`${pid}-t`} className="input" maxLength={500} value={p.texto} onChange={(e) => setP(i, { texto: e.target.value })} /></Field>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
                <Field label="Tipo" htmlFor={`${pid}-tipo`}>
                  <Dropdown id={`${pid}-tipo`} className="input" value={p.tipo} onChange={(e) => {
                    const tipo = e.target.value as TipoPerguntaFit
                    setP(i, { tipo, alternativas: tipo === 'escolha' && !p.alternativas.length ? [{ id: novoId(), texto: '', pontos: '' }, { id: novoId(), texto: '', pontos: '' }] : p.alternativas })
                  }}>
                    {TIPOS_PERGUNTA_FIT.map((t) => <option key={t} value={t}>{ROTULO_TIPO_PERGUNTA[t]}</option>)}
                  </Dropdown>
                </Field>
                <Field label="Competência" htmlFor={`${pid}-comp`}>
                  <Dropdown id={`${pid}-comp`} className="input" value={p.competencia} disabled={p.tipo === 'aberta'} onChange={(e) => setP(i, { competencia: e.target.value })}>
                    <option value="">Nenhuma (nota geral)</option>
                    {r.competencias.map((c) => <option key={c} value={c}>{c}</option>)}
                  </Dropdown>
                </Field>
                <Field label="Peso (1 a 5)" htmlFor={`${pid}-peso`}><input id={`${pid}-peso`} className="input" type="number" min={1} max={5} step={1} value={p.peso} disabled={p.tipo === 'aberta'} onChange={(e) => setP(i, { peso: e.target.value })} /></Field>
              </div>
              {p.tipo === 'aberta' && <p className="text-[12px] text-muted -mt-2 mb-3">Resposta aberta não é pontuada: o RH lê e avalia.</p>}
              {p.tipo === 'escala' && <p className="text-[12px] text-muted -mt-2 mb-3">Escala de 1 (discordo totalmente) a 5 (concordo totalmente); 5 vale a nota máxima.</p>}
              {p.tipo === 'escolha' && (
                <fieldset className="mb-3">
                  <legend className="label">Alternativas <span className="font-normal text-muted">(pontos de 0 a 100; deixe em branco para não pontuar)</span></legend>
                  <ul className="space-y-2">
                    {p.alternativas.map((a, k) => (
                      <li key={a.id} className="flex gap-2">
                        <input aria-label={`Alternativa ${k + 1}`} className="input" maxLength={200} value={a.texto} onChange={(e) => setP(i, { alternativas: p.alternativas.map((x, j) => (j === k ? { ...x, texto: e.target.value } : x)) })} />
                        <input aria-label={`Pontos da alternativa ${k + 1}`} className="input w-24" type="number" min={0} max={100} placeholder="Pontos" value={a.pontos} onChange={(e) => setP(i, { alternativas: p.alternativas.map((x, j) => (j === k ? { ...x, pontos: e.target.value } : x)) })} />
                        <Button size="icon-sm" variant="subtle" icon="X" aria-label={`Remover alternativa ${k + 1}`} disabled={p.alternativas.length <= 2} onClick={() => setP(i, { alternativas: p.alternativas.filter((_, j) => j !== k) })} />
                      </li>
                    ))}
                  </ul>
                  {p.alternativas.length < 8 && <Button size="sm" variant="ghost" icon="Plus" className="mt-2" onClick={() => setP(i, { alternativas: [...p.alternativas, { id: novoId(), texto: '', pontos: '' }] })}>Alternativa</Button>}
                </fieldset>
              )}
              <Field label="Justificativa / critério (interno, o candidato não vê)" htmlFor={`${pid}-crit`} hint="Por que a pergunta se relaciona com o trabalho e como avaliar a resposta.">
                <textarea id={`${pid}-crit`} className={TEXTAREA} maxLength={1000} value={p.criterio} onChange={(e) => setP(i, { criterio: e.target.value })} />
              </Field>
              <Toggle checked={p.obrigatoria} onChange={(v) => setP(i, { obrigatoria: v })} label="Resposta obrigatória" />
            </li>
          )
        })}
      </ol>
      {r.perguntas.length < 40 && <Button variant="ghost" icon="Plus" onClick={() => up({ perguntas: [...r.perguntas, perguntaVazia()] })}>Adicionar pergunta</Button>}

      <div className="mt-6">
        <div className="label">Critérios de interpretação da nota geral (opcional)</div>
        <p className="text-[12px] text-muted mb-2">Sem critérios, o resultado mostra só as notas, sem faixa. Vale a faixa com a maior nota mínima atingida.</p>
        <ul className="space-y-2">
          {r.faixas.map((f, i) => (
            <li key={i} className="grid grid-cols-[88px_1fr_auto] sm:grid-cols-[88px_1fr_1.4fr_auto] gap-2">
              <input aria-label={`Nota mínima do critério ${i + 1}`} className="input" type="number" min={0} max={100} placeholder="Mín." value={f.min} onChange={(e) => up({ faixas: r.faixas.map((x, j) => (j === i ? { ...x, min: e.target.value } : x)) })} />
              <input aria-label={`Rótulo do critério ${i + 1}`} className="input" maxLength={60} placeholder="Rótulo" value={f.rotulo} onChange={(e) => up({ faixas: r.faixas.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)) })} />
              <input aria-label={`Descrição do critério ${i + 1}`} className="input hidden sm:block" maxLength={300} placeholder="Descrição (opcional)" value={f.descricao} onChange={(e) => up({ faixas: r.faixas.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} />
              <Button size="icon-sm" variant="subtle" icon="X" aria-label={`Remover critério ${i + 1}`} onClick={() => up({ faixas: r.faixas.filter((_, j) => j !== i) })} />
            </li>
          ))}
        </ul>
        {r.faixas.length < 6 && <Button size="sm" variant="ghost" icon="Plus" className="mt-2" onClick={() => up({ faixas: [...r.faixas, { min: '', rotulo: '', descricao: '' }] })}>Critério</Button>}
      </div>
    </>
  )
}

function EditorDisc({ r, up }: { r: Rascunho; up: (p: Partial<Rascunho>) => void }) {
  const setA = (b: number, k: number, p: Partial<Afirm>) =>
    up({ itens: r.itens.map((it, i) => (i === b ? { ...it, afirmacoes: it.afirmacoes.map((a, j) => (j === k ? { ...a, ...p } : a)) } : it)) })
  return (
    <>
      {r.instrumento.origem === 'interno' && <Callout tone="warning" icon="AlertTriangle" className="mb-4">{AVISO_DISC_INTERNO}</Callout>}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-3">
        <Field label="Origem do instrumento" htmlFor="qd-origem">
          <Dropdown id="qd-origem" className="input" value={r.instrumento.origem} onChange={(e) => up({ instrumento: { ...r.instrumento, origem: e.target.value as 'interno' | 'externo' } })}>
            <option value="interno">Interno (configurado pelo RH)</option>
            <option value="externo">Externo (instrumento licenciado)</option>
          </Dropdown>
        </Field>
        <Field label="Nome do instrumento" htmlFor="qd-nome"><input id="qd-nome" className="input" maxLength={120} value={r.instrumento.nome} onChange={(e) => up({ instrumento: { ...r.instrumento, nome: e.target.value } })} /></Field>
        <Field label="Versão" htmlFor="qd-versao"><input id="qd-versao" className="input" maxLength={20} value={r.instrumento.versao} onChange={(e) => up({ instrumento: { ...r.instrumento, versao: e.target.value } })} /></Field>
      </div>
      {r.instrumento.origem === 'externo' && <p className="text-[12px] text-muted -mt-2 mb-4">A integração automática com provedores não está disponível: os blocos abaixo continuam sendo os apresentados ao candidato.</p>}

      <div className="label">Blocos de afirmações</div>
      <p className="text-[12px] text-muted mb-2">Cada bloco tem 4 afirmações, uma para cada dimensão. O candidato marca a que mais e a que menos parece com ele. A dimensão não aparece para o candidato.</p>
      <ol className="space-y-3 mb-3">
        {r.itens.map((it, b) => (
          <li key={it.id} className="rounded-xl border border-line p-3">
            <div className="flex items-center justify-between gap-2 mb-2">
              <span className="text-[12px] font-bold uppercase tracking-wide text-muted">Bloco {b + 1}</span>
              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover bloco ${b + 1}`} disabled={r.itens.length <= 2} onClick={() => up({ itens: r.itens.filter((_, j) => j !== b) })} />
            </div>
            <ul className="space-y-2">
              {it.afirmacoes.map((a, k) => (
                <li key={a.id} className="grid grid-cols-[1fr_120px] sm:grid-cols-[1fr_160px] gap-2">
                  <input aria-label={`Bloco ${b + 1}, afirmação ${k + 1}`} className="input" maxLength={200} value={a.texto} onChange={(e) => setA(b, k, { texto: e.target.value })} />
                  <Dropdown aria-label={`Dimensão da afirmação ${k + 1} do bloco ${b + 1}`} className="input" value={a.dimensao} onChange={(e) => setA(b, k, { dimensao: e.target.value as Dimensao })}>
                    {DIMENSOES.map((d) => <option key={d} value={d}>{d} · {ROTULO_DIMENSAO[d]}</option>)}
                  </Dropdown>
                </li>
              ))}
            </ul>
          </li>
        ))}
      </ol>
      {r.itens.length < 30 && <Button variant="ghost" icon="Plus" onClick={() => up({ itens: [...r.itens, blocoVazio()] })}>Adicionar bloco</Button>}

      <div className="mt-6">
        <Toggle checked={r.usarPerfil} onChange={(v) => up({ usarPerfil: v })} label="Definir perfil recomendado para a vaga" />
        {r.usarPerfil && (
          <div className="mt-3">
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {DIMENSOES.map((d) => (
                <Field key={d} label={`${d} · ${ROTULO_DIMENSAO[d]}`} htmlFor={`qd-perfil-${d}`} className="mb-2">
                  <input id={`qd-perfil-${d}`} className="input" type="number" min={0} max={100} value={r.perfil[d]} onChange={(e) => up({ perfil: { ...r.perfil, [d]: e.target.value } })} />
                </Field>
              ))}
            </div>
            <Field label="Justificativa do perfil" htmlFor="qd-just" hint="Explique por que este perfil ajuda nas atividades da vaga.">
              <textarea id="qd-just" className={TEXTAREA} maxLength={1000} value={r.justificativa} onChange={(e) => up({ justificativa: e.target.value })} />
            </Field>
            <p className="text-[12px] text-muted">Compatibilidade = 100 − média das diferenças por dimensão (alta ≥ 75; moderada 50–74; baixa &lt; 50). Serve de referência; nunca aprova ou reprova sozinha.</p>
          </div>
        )}
      </div>
    </>
  )
}

