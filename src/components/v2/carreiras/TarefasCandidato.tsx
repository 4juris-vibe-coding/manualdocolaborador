/* ============================================================
   Portal de carreiras · tarefas do candidato na fase atual
   (questionários e documentos), acessadas pelo código de
   acompanhamento. Cada chamada revalida o código no servidor.
   O candidato nunca vê pontos, pesos, critérios ou perfis.
   ============================================================ */
import { useCallback, useEffect, useRef, useState } from 'react'
import { Badge, Button, Callout, Card, Field } from '@/components/ui'
import { api, ErroApi, executar, lerBase64 } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { dataBR } from '@/lib/fmt'
import { cn } from '@/lib/utils'

interface PerguntaPublica { id: string; tipo: 'aberta' | 'escolha' | 'escala'; texto: string; obrigatoria: boolean; alternativas?: { id: string; texto: string }[] }
interface ItemPublico { id: string; afirmacoes: { id: string; texto: string }[] }
interface Pendente { id: string; tipo: 'fit_cultural' | 'disc'; titulo: string; instrucoes: string | null; perguntas?: PerguntaPublica[]; itens?: ItemPublico[] }
interface ArquivoPublico { id: string; nome: string; mime: string; tamanho: number; categoria: string; enviadoPor: 'rh' | 'candidato'; criadoEm: string }
interface Tarefas {
  vaga: string
  ativa: boolean
  pendentes: Pendente[]
  respondidos: { id: string; tipo: string; titulo: string; enviadoEm: string }[]
  documentos: { solicita: boolean; instrucao: string | null; formatos: string[]; arquivos: ArquivoPublico[] }
}

const LIMITE_BYTES = 3 * 1024 * 1024
const ESCALA = [
  { v: 1, r: 'Discordo totalmente' }, { v: 2, r: 'Discordo' }, { v: 3, r: 'Neutro' }, { v: 4, r: 'Concordo' }, { v: 5, r: 'Concordo totalmente' },
]
const TEXTAREA = 'input h-auto min-h-[96px] py-2.5 leading-relaxed resize-y'
const kb = (n: number) => `${Math.max(1, Math.round(n / 1024))} KB`

export function TarefasCandidato({ codigo }: { codigo: string }) {
  const [dados, setDados] = useState<Tarefas | null>(null)
  const [erro, setErro] = useState('')
  const [carregando, setCarregando] = useState(false)
  const seq = useRef(0)

  const carregar = useCallback(async () => {
    const token = codigo.trim()
    if (!token || !MODO_API) return
    const meu = ++seq.current
    setCarregando(true); setErro('')
    try {
      const d = await api.post<Tarefas>('publico/candidaturas/tarefas', { token })
      if (meu === seq.current) setDados(d)
    } catch (e) {
      if (meu === seq.current) { setDados(null); setErro(e instanceof ErroApi ? e.message : 'Não foi possível carregar as tarefas agora.') }
    } finally { if (meu === seq.current) setCarregando(false) }
  }, [codigo])

  useEffect(() => { void carregar() }, [carregar])

  if (!codigo.trim() || !MODO_API) return null
  if (carregando && !dados) return <Card className="p-5 sm:p-6 mt-5"><p className="text-[13.5px] text-muted" aria-live="polite">Carregando tarefas…</p></Card>
  if (erro) return <Callout tone="warning" icon="AlertTriangle" className="mt-5">{erro}</Callout>
  if (!dados) return null

  const doc = dados.documentos
  const nada = !dados.pendentes.length && !dados.respondidos.length && !doc.solicita && !doc.arquivos.length
  if (nada) return null

  return (
    <section className="mt-5 space-y-5" aria-labelledby="tarefas-titulo">
      <h2 id="tarefas-titulo" className="text-[18px] font-extrabold tracking-tight text-ink">Tarefas desta fase</h2>

      {dados.pendentes.map((q) => (
        <Card key={q.id} className="p-5 sm:p-6">
          <div className="flex items-center gap-2 flex-wrap mb-1">
            <h3 className="font-bold text-ink text-[16px]">{q.titulo}</h3>
            <Badge tone="warning">Pendente</Badge>
          </div>
          {q.instrucoes && <p className="text-[13.5px] text-ink-2 whitespace-pre-line mb-3">{q.instrucoes}</p>}
          {q.tipo === 'fit_cultural'
            ? <FormFit q={q} codigo={codigo} onEnviado={carregar} />
            : <FormDisc q={q} codigo={codigo} onEnviado={carregar} />}
        </Card>
      ))}

      {dados.respondidos.length > 0 && (
        <Card className="p-5 sm:p-6">
          <h3 className="font-bold text-ink text-[15px] mb-2">Questionários respondidos</h3>
          <ul className="space-y-1.5">
            {dados.respondidos.map((r) => (
              <li key={r.id} className="text-[13.5px] flex items-center justify-between gap-2 flex-wrap">
                <span className="text-ink">{r.titulo}</span>
                <Badge tone="success">Enviado em {dataBR(String(r.enviadoEm).slice(0, 10))}</Badge>
              </li>
            ))}
          </ul>
        </Card>
      )}

      {(doc.solicita || doc.arquivos.length > 0) && <Documentos codigo={codigo} doc={doc} ativa={dados.ativa} onMudou={carregar} />}
    </section>
  )
}

/* ---------- fit cultural ---------- */
function FormFit({ q, codigo, onEnviado }: { q: Pendente; codigo: string; onEnviado: () => void }) {
  const [resp, setResp] = useState<Record<string, string | number>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const perguntas = q.perguntas ?? []
  const set = (id: string, v: string | number) => { setResp((r) => ({ ...r, [id]: v })); setErros((e) => ({ ...e, [id]: '' })) }

  async function enviar() {
    const faltam: Record<string, string> = {}
    for (const p of perguntas) {
      const v = resp[p.id]
      if (p.obrigatoria && (v === undefined || (typeof v === 'string' && !v.trim()))) faltam[p.id] = 'Resposta obrigatória.'
    }
    setErros(faltam)
    if (Object.keys(faltam).length) { toast('Responda às perguntas obrigatórias.', 'danger'); return }
    setEnviando(true)
    try {
      await api.post(`publico/candidaturas/questionarios/${q.id}/responder`, { token: codigo.trim(), respostas: resp })
      toast('Respostas enviadas. Obrigado!')
      onEnviado()
    } catch (e) {
      if (e instanceof ErroApi && e.campos) setErros(e.campos)
      toast(e instanceof ErroApi ? e.message : 'Não foi possível enviar agora.', 'danger')
    } finally { setEnviando(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void enviar() }} noValidate>
      <ol className="space-y-5">
        {perguntas.map((p, i) => {
          const id = `q-${q.id}-${p.id}`
          const erro = erros[p.id]
          if (p.tipo === 'aberta') {
            return (
              <li key={p.id}>
                <Field label={`${i + 1}. ${p.texto}`} required={p.obrigatoria} htmlFor={id} erro={erro}>
                  <textarea id={id} className={TEXTAREA} maxLength={3000} value={String(resp[p.id] ?? '')} onChange={(e) => set(p.id, e.target.value)} aria-invalid={!!erro} />
                </Field>
              </li>
            )
          }
          const opcoes = p.tipo === 'escolha' ? (p.alternativas ?? []).map((a) => ({ v: a.id as string | number, r: a.texto })) : ESCALA
          return (
            <li key={p.id}>
              <fieldset aria-invalid={!!erro} aria-describedby={erro ? `${id}-erro` : undefined}>
                <legend className="label">{i + 1}. {p.texto}{p.obrigatoria && <span className="text-danger ml-0.5" aria-hidden>*</span>}{p.obrigatoria && <span className="sr-only"> (obrigatório)</span>}</legend>
                <div className={cn('grid gap-2', p.tipo === 'escala' ? 'grid-cols-1 sm:grid-cols-5' : 'grid-cols-1')}>
                  {opcoes.map((o) => {
                    const marcado = resp[p.id] === o.v
                    return (
                      <label key={String(o.v)} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 min-h-[44px] cursor-pointer text-[13.5px] transition',
                        marcado ? 'border-brand bg-brand-50 text-ink' : 'border-line hover:bg-surface-2 text-ink-2')}>
                        <input type="radio" name={id} className="accent-brand h-4 w-4 shrink-0" checked={marcado} onChange={() => set(p.id, o.v)} />
                        <span>{p.tipo === 'escala' ? <><b className="mr-1">{o.v}</b>{o.r}</> : o.r}</span>
                      </label>
                    )
                  })}
                </div>
                {erro && <p id={`${id}-erro`} className="text-[11.5px] text-danger mt-1.5 font-medium" role="alert">{erro}</p>}
              </fieldset>
            </li>
          )
        })}
      </ol>
      <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar respostas'}</Button>
      <p className="text-[11.5px] text-muted mt-2">Depois de enviadas, as respostas não podem ser alteradas.</p>
    </form>
  )
}

/* ---------- DISC (escolha forçada) ---------- */
function FormDisc({ q, codigo, onEnviado }: { q: Pendente; codigo: string; onEnviado: () => void }) {
  const [resp, setResp] = useState<Record<string, { mais?: string; menos?: string }>>({})
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const itens = q.itens ?? []

  function marcar(item: string, lado: 'mais' | 'menos', afirmacao: string) {
    setResp((r) => {
      const atual = { ...(r[item] ?? {}) }
      atual[lado] = afirmacao
      const outro = lado === 'mais' ? 'menos' : 'mais'
      if (atual[outro] === afirmacao) delete atual[outro]
      return { ...r, [item]: atual }
    })
    setErros((e) => ({ ...e, [item]: '' }))
  }

  async function enviar() {
    const faltam: Record<string, string> = {}
    for (const it of itens) if (!resp[it.id]?.mais || !resp[it.id]?.menos) faltam[it.id] = 'Marque a que mais e a que menos parece com você.'
    setErros(faltam)
    if (Object.keys(faltam).length) { toast('Complete todos os blocos.', 'danger'); return }
    setEnviando(true)
    try {
      await api.post(`publico/candidaturas/questionarios/${q.id}/responder`, { token: codigo.trim(), respostas: resp })
      toast('Respostas enviadas. Obrigado!')
      onEnviado()
    } catch (e) {
      if (e instanceof ErroApi && e.campos) setErros(e.campos)
      toast(e instanceof ErroApi ? e.message : 'Não foi possível enviar agora.', 'danger')
    } finally { setEnviando(false) }
  }

  return (
    <form onSubmit={(e) => { e.preventDefault(); void enviar() }} noValidate>
      <p className="text-[13px] text-muted mb-4">Em cada bloco, marque a afirmação que <b className="text-ink">mais</b> parece com você e a que <b className="text-ink">menos</b> parece. Não há respostas certas ou erradas.</p>
      <ol className="space-y-5">
        {itens.map((it, i) => {
          const erro = erros[it.id]
          const r = resp[it.id] ?? {}
          return (
            <li key={it.id}>
              <fieldset className={cn('rounded-xl border p-3 sm:p-4', erro ? 'border-danger' : 'border-line')} aria-describedby={erro ? `d-${q.id}-${it.id}-erro` : undefined}>
                <legend className="px-1 text-[12px] font-bold uppercase tracking-wide text-muted">Bloco {i + 1} de {itens.length}</legend>
                <div className="hidden sm:grid grid-cols-[1fr_72px_72px] gap-2 text-[11.5px] font-bold uppercase tracking-wide text-muted mb-1" aria-hidden>
                  <span /> <span className="text-center">Mais</span><span className="text-center">Menos</span>
                </div>
                <ul className="divide-y divide-line">
                  {it.afirmacoes.map((a) => {
                    const nome = `d-${q.id}-${it.id}`
                    return (
                      <li key={a.id} className="py-2 grid grid-cols-1 sm:grid-cols-[1fr_72px_72px] gap-2 items-center">
                        <span className="text-[13.5px] text-ink" id={`${nome}-${a.id}`}>{a.texto}</span>
                        <div className="grid grid-cols-2 sm:contents gap-2">
                          {(['mais', 'menos'] as const).map((lado) => {
                            const marcado = r[lado] === a.id
                            return (
                              <label key={lado} className={cn('flex items-center justify-center gap-2 rounded-lg border min-h-[44px] cursor-pointer text-[12.5px] font-semibold transition',
                                marcado ? (lado === 'mais' ? 'border-brand bg-brand text-white' : 'border-ink-2 bg-ink-2 text-white') : 'border-line text-ink-2 hover:bg-surface-2')}>
                                <input type="radio" className="sr-only" name={`${nome}-${lado}`} checked={marcado} onChange={() => marcar(it.id, lado, a.id)}
                                  aria-label={`${lado === 'mais' ? 'Mais' : 'Menos'} parece comigo: ${a.texto}`} />
                                <span className="sm:hidden">{lado === 'mais' ? 'Mais parece' : 'Menos parece'}</span>
                                <span className="hidden sm:inline" aria-hidden>{marcado ? '●' : '○'}</span>
                              </label>
                            )
                          })}
                        </div>
                      </li>
                    )
                  })}
                </ul>
                {erro && <p id={`d-${q.id}-${it.id}-erro`} className="text-[11.5px] text-danger mt-1.5 font-medium" role="alert">{erro}</p>}
              </fieldset>
            </li>
          )
        })}
      </ol>
      <Button type="submit" className="mt-5 w-full sm:w-auto" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar respostas'}</Button>
      <p className="text-[11.5px] text-muted mt-2">Depois de enviadas, as respostas não podem ser alteradas.</p>
    </form>
  )
}

/* ---------- documentos ---------- */
async function baixar(codigo: string, a: ArquivoPublico) {
  try {
    // POST (o código vai no corpo, nunca na URL): rota `publico/candidaturas/documentos/:id/arquivo`.
    const r = await fetch(api.url('publico/candidaturas/documentos/') + encodeURIComponent(a.id) + '/arquivo', {
      method: 'POST', credentials: 'omit',
      headers: { 'Content-Type': 'application/json', 'X-Requested-With': '4juris' },
      body: JSON.stringify({ token: codigo.trim() }),
    })
    if (!r.ok) {
      const d = await r.json().catch(() => ({}))
      throw new Error(d.erro ?? 'Não foi possível baixar o arquivo.')
    }
    const url = URL.createObjectURL(await r.blob())
    const link = document.createElement('a')
    link.href = url; link.download = a.nome
    document.body.appendChild(link); link.click(); link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 10_000)
  } catch (e) {
    toast(e instanceof Error ? e.message : 'Não foi possível baixar o arquivo.', 'danger')
  }
}

function Documentos({ codigo, doc, ativa, onMudou }: { codigo: string; doc: Tarefas['documentos']; ativa: boolean; onMudou: () => void }) {
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [observacao, setObservacao] = useState('')
  const [erro, setErro] = useState('')
  const [enviando, setEnviando] = useState(false)
  const input = useRef<HTMLInputElement>(null)
  const podeEnviar = ativa && doc.solicita

  async function enviar() {
    if (!arquivo) { setErro('Escolha um arquivo.'); return }
    if (arquivo.size > LIMITE_BYTES) { setErro('Arquivo maior que 3 MB.'); return }
    setEnviando(true); setErro('')
    const ok = await executar(async () => api.post('publico/candidaturas/documentos', { token: codigo.trim(), arquivo: await lerBase64(arquivo), observacao: observacao.trim() || undefined }), 'Arquivo enviado.')
    setEnviando(false)
    if (ok) { setArquivo(null); setObservacao(''); if (input.current) input.current.value = ''; onMudou() }
  }

  return (
    <Card className="p-5 sm:p-6">
      <h3 className="font-bold text-ink text-[15px] mb-1">Documentos</h3>
      {podeEnviar && (
        <>
          {doc.instrucao && <Callout tone="brand" icon="Paperclip" className="mb-4">{doc.instrucao}</Callout>}
          <form onSubmit={(e) => { e.preventDefault(); void enviar() }}>
            <Field label="Arquivo" htmlFor="tc-arquivo" erro={erro} hint={`Formatos: ${doc.formatos.join(', ')} · até 3 MB`}>
              <input id="tc-arquivo" ref={input} type="file" className="block w-full text-[13px]" accept=".pdf,.doc,.docx,.odt,.png,.jpg,.jpeg"
                onChange={(e) => { setArquivo(e.target.files?.[0] ?? null); setErro('') }} aria-invalid={!!erro} />
            </Field>
            <Field label="Observação (opcional)" htmlFor="tc-obs">
              <input id="tc-obs" className="input" maxLength={300} value={observacao} onChange={(e) => setObservacao(e.target.value)} />
            </Field>
            <Button type="submit" icon="Upload" className="w-full sm:w-auto" disabled={enviando || !arquivo}>{enviando ? 'Enviando…' : 'Enviar arquivo'}</Button>
          </form>
        </>
      )}
      {doc.arquivos.length > 0 && (
        <ul className={cn('divide-y divide-line', podeEnviar && 'mt-5 border-t border-line')}>
          {doc.arquivos.map((a) => (
            <li key={a.id} className="py-2.5 flex items-center justify-between gap-3 flex-wrap">
              <div className="min-w-0">
                <div className="text-[13.5px] text-ink font-semibold truncate">{a.nome}</div>
                <div className="text-[12px] text-muted">{a.enviadoPor === 'candidato' ? 'Enviado por você' : 'Enviado pela empresa'} · {dataBR(String(a.criadoEm).slice(0, 10))} · {kb(a.tamanho)}</div>
              </div>
              <Button size="sm" variant="ghost" icon="Download" onClick={() => void baixar(codigo, a)} aria-label={`Baixar ${a.nome}`}>Baixar</Button>
            </li>
          ))}
        </ul>
      )}
    </Card>
  )
}
