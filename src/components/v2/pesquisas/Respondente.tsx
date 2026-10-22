/* Experiência de quem responde: introdução, uma pergunta por tela, progresso, validação e confirmação.
   Usada na página pública /responder/:token e na pré-visualização do construtor. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Callout, Card, Icon, Logo, Progress } from '@/components/ui'
import { CampoPergunta } from './CampoPergunta'
import { paginasDeResposta, perguntasVisiveis, validarRespostas, type PerguntaPesquisa, type Respostas } from '@/domain/v2/pesquisaTipos'

export interface DadosResposta {
  pesquisaId?: string
  titulo: string
  intro?: string | null
  objetivo?: string | null
  confidencialidade: string
  tempoMin: number
  prazo?: string | null
  perguntas: PerguntaPesquisa[]
  barraProgresso: boolean
  salvaProgresso: boolean
  modo: 'anonima' | 'identificada'
  via: 'convite' | 'link'
  progresso?: Respostas
}

export interface ResultadoEnvio { ok: boolean; erro?: string; campos?: Record<string, string>; mensagemFinal?: string }

interface Props {
  dados: DadosResposta
  /** Pré-visualização: nada é enviado nem salvo. */
  previa?: boolean
  onEnviar?: (respostas: Respostas) => Promise<ResultadoEnvio>
  /** Pesquisa identificada: salva o progresso no servidor ao avançar. */
  onProgresso?: (respostas: Respostas) => void
  /** Chave para guardar o progresso APENAS neste navegador (pesquisas anônimas). */
  chaveLocal?: string
}

const vazio = (v: unknown) => v === undefined || v === null || (typeof v === 'string' && !v.trim()) || (Array.isArray(v) && !v.length)

export function Respondente({ dados, previa, onEnviar, onProgresso, chaveLocal }: Props) {
  const [respostas, setRespostas] = useState<Respostas>(() => {
    if (dados.progresso && Object.keys(dados.progresso).length) return dados.progresso
    if (chaveLocal) { try { return JSON.parse(localStorage.getItem(chaveLocal) ?? '{}') } catch { /* sem armazenamento */ } }
    return {}
  })
  const [idx, setIdx] = useState(-1) // -1 = introdução
  const [erro, setErro] = useState<string>()
  const [errosCampo, setErrosCampo] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [final, setFinal] = useState<string | null>(null)
  const topo = useRef<HTMLHeadingElement>(null)

  const visiveis = useMemo(() => perguntasVisiveis(dados.perguntas, respostas), [dados.perguntas, respostas])
  const paginas = useMemo(() => paginasDeResposta(visiveis), [visiveis])
  const pagina = idx >= 0 ? paginas[Math.min(idx, paginas.length - 1)] : undefined
  const ultima = idx >= paginas.length - 1
  const porPagina = paginas.some((pg) => pg.perguntas.length > 1)
  const paginaDe = (perguntaId: string) => paginas.findIndex((pg) => pg.perguntas.some((q) => q.id === perguntaId))

  useEffect(() => { topo.current?.focus() }, [idx, final])
  useEffect(() => {
    if (!chaveLocal || previa || final) return
    try { localStorage.setItem(chaveLocal, JSON.stringify(respostas)) } catch { /* sem armazenamento */ }
  }, [respostas, chaveLocal, previa, final])

  const mudar = (id: string, v: Respostas[string]) => { setRespostas((r) => ({ ...r, [id]: v })); setErro(undefined); setErrosCampo((e) => { if (!e[id]) return e; const { [id]: _, ...resto } = e; return resto }) }

  /** Valida todas as perguntas da página atual; os erros aparecem junto de cada pergunta. */
  function validarAtual(): boolean {
    if (!pagina) return true
    const e: Record<string, string> = {}
    for (const q of pagina.perguntas) {
      const v = respostas[q.id]
      if (vazio(v)) { if (q.obrigatoria) e[q.id] = 'Esta pergunta é obrigatória.'; continue }
      const r = validarRespostas([{ ...q, condicao: undefined }], { [q.id]: v })
      if (r.erros[q.id]) e[q.id] = r.erros[q.id]
    }
    setErrosCampo(e)
    const n = Object.keys(e).length
    if (n) { setErro(pagina.perguntas.length > 1 ? `Revise ${n === 1 ? 'a pergunta indicada' : `as ${n} perguntas indicadas`}.` : Object.values(e)[0]); return false }
    return true
  }

  function avancar() {
    if (!validarAtual()) return
    if (dados.salvaProgresso && !previa) onProgresso?.(respostas)
    setIdx((i) => i + 1)
  }

  async function enviar() {
    if (!validarAtual()) return
    const { erros, limpas } = validarRespostas(dados.perguntas, respostas)
    const primeiroErro = visiveis.find((p) => erros[p.id])
    if (primeiroErro) { setIdx(paginaDe(primeiroErro.id)); setErrosCampo(erros); setErro(erros[primeiroErro.id]); return }
    if (previa) { setErro('Pré-visualização: nada foi enviado.'); return }
    setEnviando(true)
    try {
      const r = await onEnviar!(limpas)
      if (r.ok) { setFinal(r.mensagemFinal || 'Obrigado por responder!'); if (chaveLocal) { try { localStorage.removeItem(chaveLocal) } catch { /* ok */ } } }
      else {
        const q = r.campos ? visiveis.find((p) => r.campos![p.id]) : undefined
        if (q) { setIdx(paginaDe(q.id)); setErrosCampo(r.campos!) }
        setErro(q ? r.campos![q.id] : r.erro ?? 'Não foi possível enviar. Tente novamente.')
      }
    } finally { setEnviando(false) }
  }

  const casca = (children: React.ReactNode) => (
    <div className="min-h-screen bg-surface-3">
      <header className="border-b border-line bg-surface">
        <div className="mx-auto max-w-2xl px-4 h-14 flex items-center gap-3"><Logo size={30} /><span className="font-extrabold text-ink tracking-tight">4JURIS</span>
          {previa && <span className="ml-auto text-[12px] font-semibold text-warning bg-warning-soft px-2.5 py-1 rounded-full">Pré-visualização</span>}</div>
      </header>
      <main className="mx-auto max-w-2xl px-4 py-6 sm:py-10">{children}</main>
    </div>
  )

  if (final !== null) {
    return casca(
      <Card className="p-6 sm:p-10 text-center">
        <div className="h-14 w-14 rounded-2xl bg-success-soft text-success flex items-center justify-center mx-auto mb-4"><Icon name="CheckCircle2" className="h-7 w-7" /></div>
        <h1 ref={topo} tabIndex={-1} className="text-[22px] font-bold text-ink outline-none">Resposta enviada</h1>
        <p className="text-[14.5px] text-ink-2 mt-3 whitespace-pre-line">{final}</p>
        <p className="text-[12.5px] text-muted mt-6">Você já pode fechar esta página.</p>
      </Card>,
    )
  }

  if (idx < 0) {
    return casca(
      <Card className="p-6 sm:p-9">
        <h1 ref={topo} tabIndex={-1} className="text-[22px] sm:text-[26px] font-bold text-ink tracking-tight outline-none">{dados.titulo}</h1>
        {dados.intro && <p className="text-[14.5px] text-ink-2 mt-3 whitespace-pre-line">{dados.intro}</p>}
        {dados.objetivo && <div className="mt-5"><h2 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Por que estamos perguntando</h2><p className="text-[14px] text-ink-2">{dados.objetivo}</p></div>}
        <ul className="mt-5 flex flex-wrap gap-x-5 gap-y-1.5 text-[13px] text-muted">
          <li className="flex items-center gap-1.5"><Icon name="Clock" className="h-4 w-4" /> cerca de {dados.tempoMin} min</li>
          <li className="flex items-center gap-1.5"><Icon name="ListChecks" className="h-4 w-4" /> {visiveis.length} {visiveis.length === 1 ? 'pergunta' : 'perguntas'}{visiveis.length !== dados.perguntas.length ? ' (podem aparecer outras conforme suas respostas)' : ''}</li>
          {dados.prazo && <li className="flex items-center gap-1.5"><Icon name="CalendarClock" className="h-4 w-4" /> até {dados.prazo.split('-').reverse().join('/')}</li>}
        </ul>
        <Callout tone={dados.modo === 'identificada' ? 'warning' : 'brand'} icon={dados.modo === 'identificada' ? 'Eye' : 'ShieldCheck'} className="mt-6">
          <b>{dados.modo === 'identificada' ? 'Pesquisa identificada' : 'Confidencialidade'}</b>
          <p className="mt-1">{dados.confidencialidade}</p>
        </Callout>
        <div className="mt-7 flex justify-end">
          <Button size="lg" icon="ArrowRight" onClick={() => setIdx(0)} disabled={!dados.perguntas.length}>{Object.keys(respostas).length ? 'Continuar' : 'Começar'}</Button>
        </div>
      </Card>,
    )
  }

  const pct = ((idx + 1) / Math.max(1, paginas.length)) * 100
  const rotuloEtapa = `${porPagina ? 'Página' : 'Pergunta'} ${idx + 1} de ${paginas.length}`
  const umaSo = pagina?.perguntas.length === 1
  return casca(
    <Card className="p-5 sm:p-8">
      {dados.barraProgresso && paginas.length > 1 && (
        <div className="mb-6" aria-label={rotuloEtapa}>
          <div className="flex justify-between text-[12px] text-muted mb-1.5"><span>{rotuloEtapa}</span><span>{Math.round(pct)}%</span></div>
          <Progress value={pct} />
        </div>
      )}
      {pagina?.secao && !umaSo && <h2 ref={topo} tabIndex={-1} className="text-[13px] font-bold uppercase tracking-wide text-brand mb-5 outline-none">{pagina.secao}</h2>}
      {pagina && (
        <div className={umaSo ? '' : 'space-y-8'}>
          {pagina.perguntas.map((q, k) => (
            <fieldset key={q.id} className="border-0 p-0 m-0 min-w-0" aria-invalid={!!errosCampo[q.id]}>
              <legend className="w-full">
                {pagina.secao && umaSo && <div className="text-[12px] font-bold uppercase tracking-wide text-brand mb-2">{pagina.secao}</div>}
                {/* O foco vai para o título da seção (se houver) ou para a primeira pergunta. */}
                <h2 ref={k === 0 && (umaSo || !pagina.secao) ? topo : undefined} tabIndex={-1} className={`${umaSo ? 'text-[18px] sm:text-[20px]' : 'text-[16px] sm:text-[17px]'} font-bold text-ink leading-snug outline-none`}>{q.texto}{q.obrigatoria && <span className="text-danger ml-1" aria-hidden>*</span>}</h2>
                {q.descricao && <p className="text-[13px] text-muted mt-1.5">{q.descricao}</p>}
                {!q.obrigatoria && <p className="text-[12px] text-muted mt-1">Opcional</p>}
              </legend>
              <div className={umaSo ? 'mt-5' : 'mt-3'}><CampoPergunta pergunta={q} valor={respostas[q.id]} onChange={(v) => mudar(q.id, v)} /></div>
              {!umaSo && errosCampo[q.id] && <p className="text-[12.5px] text-danger font-medium mt-2">{errosCampo[q.id]}</p>}
            </fieldset>
          ))}
        </div>
      )}
      {erro && <p role="alert" className="text-[13px] text-danger font-medium mt-4">{erro}</p>}
      <div className="mt-8 flex items-center justify-between gap-3">
        <Button variant="ghost" icon="ArrowLeft" onClick={() => { setErro(undefined); setErrosCampo({}); setIdx((i) => i - 1) }}>Voltar</Button>
        {ultima
          ? <Button size="lg" icon="Send" onClick={enviar} disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar respostas'}</Button>
          : <Button size="lg" icon="ArrowRight" onClick={avancar}>Próxima</Button>}
      </div>
      {!previa && dados.modo === 'anonima' && chaveLocal && <p className="text-[11.5px] text-muted mt-5">Seu progresso fica guardado apenas neste navegador, não no servidor.</p>}
      {!previa && dados.salvaProgresso && <p className="text-[11.5px] text-muted mt-5">Seu progresso é salvo ao avançar; você pode voltar pelo mesmo link.</p>}
    </Card>,
  )
}
