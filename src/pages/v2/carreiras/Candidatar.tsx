import { useEffect, useRef, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Button, Callout, Card, EmptyState, Field, Icon } from '@/components/ui'
import { Contenedor, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { CarregandoBloco, ErroBloco } from '@/components/v2/estados'
import { TEXTAREA, camposDoErro, mensagemDoErro } from '@/components/v2/ats/comuns'
import { api, lerBase64, useApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { ORIGENS_PUBLICAS } from '@/domain/v2/ats'
import { Dropdown } from '@/components/Dropdown'

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/
const EXT = /\.(pdf|docx?|odt)$/i

interface Rascunho { nome: string; email: string; telefone: string; cidade: string; uf: string; linkedin: string; pretensao: string; disponibilidade: string; respostas: Record<string, string>; bancoTalentos: boolean }
const VAZIO: Rascunho = { nome: '', email: '', telefone: '', cidade: '', uf: '', linkedin: '', pretensao: '', disponibilidade: '', respostas: {}, bancoTalentos: false }

const tamanho = (b: number) => (b < 1024 * 1024 ? `${Math.max(1, Math.round(b / 1024))} KB` : `${(b / 1024 / 1024).toFixed(1).replace('.', ',')} MB`)

/** Área de envio do currículo: clicar ou arrastar o arquivo; mostra nome, tamanho e permite trocar/remover. */
function EnvioCurriculo({ arquivo, erro, onEscolher, attrs }: { arquivo: File | null; erro?: string; onEscolher: (a: File | null) => void; attrs: Record<string, unknown> }) {
  const input = useRef<HTMLInputElement>(null)
  const [sobre, setSobre] = useState(false)
  const pdf = arquivo && /\.pdf$/i.test(arquivo.name)
  const soltar = (e: React.DragEvent) => { e.preventDefault(); setSobre(false); const a = e.dataTransfer.files?.[0]; if (a) onEscolher(a) }
  const campo = <input ref={input} id="cand-cv" type="file" accept=".pdf,.doc,.docx,.odt" className="sr-only" onChange={(e) => { onEscolher(e.target.files?.[0] ?? null); e.target.value = '' }} {...attrs} />
  if (arquivo) return (
    <div className={`flex items-center gap-3 rounded-2xl border p-3.5 sm:p-4 bg-[#f5fbf8] ${erro ? 'border-danger' : 'border-[#bfe6d5]'}`}>
      {campo}
      <span className={`grid place-items-center h-11 w-11 rounded-xl shrink-0 text-white text-[10.5px] font-extrabold tracking-wide ${pdf ? 'bg-[#c02e26]' : 'bg-brand'}`} aria-hidden>{(arquivo.name.split('.').pop() ?? '').toUpperCase().slice(0, 4)}</span>
      <div className="min-w-0 flex-1">
        <div className="text-[14px] font-semibold text-[#122029] truncate" title={arquivo.name}>{arquivo.name}</div>
        <div className="text-[12.5px] text-[#3d4b56] flex items-center gap-1.5"><Icon name="CheckCircle2" className="h-3.5 w-3.5 text-[#0b7a52]" />{tamanho(arquivo.size)} · pronto para enviar</div>
      </div>
      <button type="button" onClick={() => input.current?.click()} className="h-9 px-3 rounded-lg text-[13px] font-semibold text-brand hover:bg-[#e7ecfd]">Trocar</button>
      <button type="button" onClick={() => onEscolher(null)} aria-label="Remover arquivo" className="grid place-items-center h-9 w-9 rounded-lg text-[#3d4b56] hover:bg-[#fbe6e5] hover:text-[#c02e26]"><Icon name="X" className="h-4 w-4" /></button>
    </div>
  )
  return (
    <label htmlFor="cand-cv" onDragOver={(e) => { e.preventDefault(); setSobre(true) }} onDragLeave={() => setSobre(false)} onDrop={soltar}
      className={`group flex flex-col items-center justify-center text-center gap-2 rounded-2xl border-2 border-dashed px-5 py-8 cursor-pointer transition focus-within:ring-2 focus-within:ring-brand focus-within:ring-offset-2
        ${sobre ? 'border-brand bg-[#eef2ff]' : erro ? 'border-danger bg-[#fdf3f2]' : 'border-[#c9d5fb] bg-[#f7f9ff] hover:border-brand hover:bg-[#f2f5fe]'}`}>
      {campo}
      <span className="grid place-items-center h-12 w-12 rounded-2xl bg-white text-brand shadow-sm border border-[#dbe3fb] transition group-hover:scale-105" aria-hidden><Icon name="UploadCloud" className="h-6 w-6" /></span>
      <span className="text-[14.5px] font-bold text-[#122029]">{sobre ? 'Solte o arquivo aqui' : <>Arraste o seu currículo ou <span className="text-brand underline underline-offset-2">escolha um arquivo</span></>}</span>
      <span className="text-[12.5px] text-[#3d4b56]">PDF, DOC, DOCX ou ODT · até 3 MB</span>
    </label>
  )
}

export default function Candidatar() {
  const { slug = '' } = useParams()
  const [sp] = useSearchParams()
  const r = useApi<any>(MODO_API ? `publico/vagas/${slug}` : null)
  const v = r.dados
  useMeta(v ? `Candidatura: ${v.titulo} · 4JURIS Carreiras` : 'Candidatura · 4JURIS Carreiras')
  const chave = `4juris_candidatura_${slug}`

  // O rascunho (sem o arquivo) sobrevive a recarregamentos e a falhas de envio.
  const [f, setF] = useState<Rascunho>(() => { try { return { ...VAZIO, ...JSON.parse(sessionStorage.getItem(chave) ?? '{}') } } catch { return VAZIO } })
  useEffect(() => { try { sessionStorage.setItem(chave, JSON.stringify(f)) } catch { /* sem armazenamento */ } }, [f, chave])
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [consent, setConsent] = useState(false)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [falha, setFalha] = useState('')
  const [feito, setFeito] = useState<{ codigo: string; mensagem: string; email: string } | null>(null)
  const topo = useRef<HTMLDivElement>(null)
  const set = <K extends keyof Rascunho>(k: K, val: Rascunho[K]) => setF((x) => ({ ...x, [k]: val }))

  function validar(): Record<string, string> {
    const e: Record<string, string> = {}
    if (f.nome.trim().length < 3) e.nome = 'Informe seu nome completo.'
    if (!EMAIL.test(f.email.trim())) e.email = 'Informe um e-mail válido.'
    if (f.telefone.replace(/\D/g, '').length < 8) e.telefone = 'Informe um telefone com DDD.'
    if (f.uf && !/^[A-Za-z]{2}$/.test(f.uf)) e.uf = 'Use a sigla com 2 letras.'
    if (f.linkedin && !/^https?:\/\//i.test(f.linkedin)) e.linkedin = 'Cole o link completo, começando com https://'
    if (!arquivo) e.curriculo = 'Anexe seu currículo.'
    else if (!EXT.test(arquivo.name)) e.curriculo = 'Formatos aceitos: PDF, DOC, DOCX ou ODT.'
    else if (arquivo.size > 3 * 1024 * 1024) e.curriculo = 'O arquivo deve ter no máximo 3 MB.'
    for (const p of v?.perguntas ?? []) if (p.obrigatoria && !(f.respostas[p.id] ?? '').trim()) e[`pergunta_${p.id}`] = 'Resposta obrigatória.'
    if (!consent) e.consentimento = 'Confirme que leu o aviso de privacidade.'
    return e
  }

  async function enviar(ev: React.FormEvent) {
    ev.preventDefault()
    setFalha('')
    const e = validar()
    setErros(e)
    if (Object.keys(e).length) {
      toast('Corrija os campos destacados.', 'danger')
      setTimeout(() => document.querySelector<HTMLElement>('[data-erro="true"]')?.focus(), 30)
      return
    }
    setEnviando(true)
    try {
      const curriculo = await lerBase64(arquivo!)
      const origemUrl = sp.get('origem') ?? ''
      const r2 = await api.post('publico/vagas/' + slug + '/candidaturas', {
        ...f, nome: f.nome.trim(), email: f.email.trim(), pretensao: f.pretensao || undefined, curriculo, consentimento: true,
        origem: (ORIGENS_PUBLICAS as readonly string[]).includes(origemUrl) ? origemUrl : undefined,
        website: (document.getElementById('cand-website') as HTMLInputElement | null)?.value ?? '',
      })
      try { sessionStorage.removeItem(chave) } catch { /* ok */ }
      setFeito({ codigo: r2.codigoAcompanhamento, mensagem: r2.mensagem, email: r2.confirmacaoPorEmail })
      topo.current?.scrollIntoView({ behavior: 'smooth' })
    } catch (err) {
      const campos = camposDoErro(err)
      setErros(campos)
      setFalha(mensagemDoErro(err)) // os dados digitados continuam na tela
    } finally { setEnviando(false) }
  }

  const cls = (k: string) => `input ${erros[k] ? 'border-danger' : ''}`
  const ar = (k: string) => ({ 'aria-invalid': !!erros[k], 'data-erro': erros[k] ? 'true' : undefined, 'aria-describedby': erros[k] ? `${k}-erro` : undefined })

  return (
    <PortalLayout>
      <Contenedor className="py-6 sm:py-8" largura="max-w-3xl">
        <div ref={topo} />
        <Link to={`/carreiras/${slug}`} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink mb-4">← Voltar para a vaga</Link>
        {r.carregando && !v ? <CarregandoBloco linhas={3} /> :
          r.erro?.status === 410 ? <Card><EmptyState icon="CircleSlash" title="Candidaturas encerradas" desc={r.erro.message} action={<Link to="/carreiras" className="text-brand font-semibold text-[13.5px]">Ver outras vagas</Link>} /></Card> :
          r.erro?.status === 404 ? <Card><EmptyState icon="SearchX" title="Vaga não encontrada" action={<Link to="/carreiras" className="text-brand font-semibold text-[13.5px]">Ver vagas abertas</Link>} /></Card> :
          r.erro ? <ErroBloco mensagem="Não conseguimos carregar o formulário agora." onTentar={r.recarregar} /> :
          feito ? (
            <Card className="p-6 sm:p-8 text-center">
              <div className="h-14 w-14 rounded-2xl bg-success-soft text-success flex items-center justify-center mx-auto mb-4"><Icon name="CheckCircle2" className="h-7 w-7" /></div>
              <h1 className="text-[22px] font-extrabold text-ink">Candidatura enviada!</h1>
              <p className="text-[14px] text-ink-2 mt-2 max-w-md mx-auto">{feito.mensagem}</p>
              <div className="mt-6 text-left max-w-md mx-auto">
                <Callout tone="warning" icon="KeyRound">
                  <b>Guarde este código de acompanhamento.</b> Ele aparece só agora e não pode ser recuperado depois.
                  <div className="mt-2 flex gap-2"><code className="flex-1 break-all bg-surface rounded-lg px-3 py-2 text-[12.5px] border border-line select-all">{feito.codigo}</code>
                    <Button size="sm" variant="ghost" onClick={async () => { try { await navigator.clipboard.writeText(feito.codigo); toast('Código copiado.') } catch { toast('Selecione e copie o código manualmente.', 'danger') } }}>Copiar</Button></div>
                </Callout>
                <p className="text-[12.5px] text-muted mt-3">{feito.email === 'enviada' ? 'Enviamos uma confirmação para o seu e-mail.' : 'Não foi possível enviar o e-mail de confirmação agora; por isso, guarde o código acima.'}</p>
              </div>
              <div className="flex gap-3 justify-center mt-6 flex-wrap">
                <Link to={`/carreiras/acompanhar?codigo=${encodeURIComponent(feito.codigo)}`}><Button>Acompanhar candidatura</Button></Link>
                <Link to="/carreiras"><Button variant="ghost">Ver outras vagas</Button></Link>
              </div>
            </Card>
          ) : v && (
            <form onSubmit={enviar} noValidate aria-label={`Candidatura para ${v.titulo}`}>
              <h1 className="text-[24px] font-extrabold tracking-tight text-ink">Candidatura: {v.titulo}</h1>
              <p className="text-[13.5px] text-muted mt-1 mb-6">Campos com * são obrigatórios. Seus dados ficam salvos neste navegador até o envio, caso algo falhe.</p>

              {falha && <Callout tone="danger" icon="AlertTriangle" className="mb-5"><div role="alert"><b>Não foi possível enviar.</b> {falha} Seus dados continuam preenchidos; revise e tente de novo.</div></Callout>}

              <Card className="p-5 sm:p-6 mb-5">
                <h2 className="font-bold text-ink mb-4">Seus dados</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <Field label="Nome completo" required erro={erros.nome} htmlFor="cand-nome" className="sm:col-span-2"><input id="cand-nome" autoComplete="name" className={cls('nome')} value={f.nome} onChange={(e) => set('nome', e.target.value)} {...ar('nome')} /></Field>
                  <Field label="E-mail" required erro={erros.email} htmlFor="cand-email"><input id="cand-email" type="email" autoComplete="email" className={cls('email')} value={f.email} onChange={(e) => set('email', e.target.value)} {...ar('email')} /></Field>
                  <Field label="Telefone / WhatsApp" required erro={erros.telefone} htmlFor="cand-tel"><input id="cand-tel" type="tel" autoComplete="tel" className={cls('telefone')} value={f.telefone} onChange={(e) => set('telefone', e.target.value)} {...ar('telefone')} /></Field>
                  <Field label="Cidade" htmlFor="cand-cid"><input id="cand-cid" autoComplete="address-level2" className="input" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} /></Field>
                  <Field label="UF" erro={erros.uf} htmlFor="cand-uf"><input id="cand-uf" maxLength={2} className={cls('uf')} value={f.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} {...ar('uf')} /></Field>
                  <Field label="LinkedIn (opcional)" erro={erros.linkedin} htmlFor="cand-li" className="sm:col-span-2"><input id="cand-li" type="url" placeholder="https://www.linkedin.com/in/…" className={cls('linkedin')} value={f.linkedin} onChange={(e) => set('linkedin', e.target.value)} {...ar('linkedin')} /></Field>
                  <Field label="Pretensão salarial (opcional, R$)" erro={erros.pretensao} htmlFor="cand-pre"><input id="cand-pre" type="number" min={0} inputMode="numeric" className={cls('pretensao')} value={f.pretensao} onChange={(e) => set('pretensao', e.target.value)} {...ar('pretensao')} /></Field>
                  <Field label="Disponibilidade para início (opcional)" htmlFor="cand-disp"><input id="cand-disp" className="input" placeholder="Ex.: imediata, 30 dias" value={f.disponibilidade} onChange={(e) => set('disponibilidade', e.target.value)} /></Field>
                </div>
                <div className="mt-1">
                  <div className="label">Currículo <span className="text-danger">*</span></div>
                  <EnvioCurriculo arquivo={arquivo} erro={erros.curriculo} onEscolher={(a) => { setArquivo(a); setErros(({ curriculo: _, ...x }) => x) }} attrs={ar('curriculo')} />
                  {erros.curriculo && <p id="curriculo-erro" role="alert" className="text-[11.5px] text-danger mt-1.5 font-medium">{erros.curriculo}</p>}
                </div>
              </Card>

              {(v.perguntas ?? []).length > 0 && (
                <Card className="p-5 sm:p-6 mb-5">
                  <h2 className="font-bold text-ink mb-4">Perguntas da vaga</h2>
                  {v.perguntas.map((p: any) => {
                    const k = `pergunta_${p.id}`, id = `cand-${k}`
                    return (
                      <Field key={p.id} label={p.texto} required={p.obrigatoria} erro={erros[k]} htmlFor={id}>
                        {p.tipo === 'sim_nao' ? (
                          <Dropdown id={id} className={cls(k)} value={f.respostas[p.id] ?? ''} onChange={(e) => set('respostas', { ...f.respostas, [p.id]: e.target.value })} {...ar(k)}><option value="">Selecione…</option><option value="sim">Sim</option><option value="nao">Não</option></Dropdown>
                        ) : p.tipo === 'opcoes' ? (
                          <Dropdown id={id} className={cls(k)} value={f.respostas[p.id] ?? ''} onChange={(e) => set('respostas', { ...f.respostas, [p.id]: e.target.value })} {...ar(k)}><option value="">Selecione…</option>{(p.opcoes ?? []).map((o: string) => <option key={o}>{o}</option>)}</Dropdown>
                        ) : (
                          <textarea id={id} className={`${TEXTAREA} ${erros[k] ? 'border-danger' : ''}`} value={f.respostas[p.id] ?? ''} onChange={(e) => set('respostas', { ...f.respostas, [p.id]: e.target.value })} {...ar(k)} />
                        )}
                      </Field>
                    )
                  })}
                </Card>
              )}

              <Card className="p-5 sm:p-6 mb-5">
                <h2 className="font-bold text-ink mb-2">Privacidade</h2>
                <div className="text-[13px] text-ink-2 leading-relaxed bg-surface-2 border border-line rounded-xl p-4" aria-label="Aviso de privacidade">
                  {v.privacidade.texto}
                  <p className="mt-2 text-muted">Contato para exercer seus direitos: <b>{v.privacidade.contato}</b> · Versão do aviso: {v.privacidade.versao}</p>
                </div>
                <label className="flex items-start gap-2.5 mt-4 text-[13.5px] text-ink cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={consent} onChange={(e) => setConsent(e.target.checked)} {...ar('consentimento')} />
                  <span>Li o aviso de privacidade e estou ciente de como meus dados serão tratados neste processo seletivo. *</span>
                </label>
                {erros.consentimento && <p id="consentimento-erro" role="alert" className="text-[11.5px] text-danger mt-1.5 font-medium">{erros.consentimento}</p>}
                <label className="flex items-start gap-2.5 mt-3 text-[13.5px] text-ink-2 cursor-pointer">
                  <input type="checkbox" className="mt-1" checked={f.bancoTalentos} onChange={(e) => set('bancoTalentos', e.target.checked)} />
                  <span>Opcional: autorizo que meus dados sejam mantidos no banco de talentos para futuras oportunidades. Posso revogar a qualquer momento.</span>
                </label>
                {/* Isca contra robôs: pessoas não veem nem preenchem. */}
                <div aria-hidden="true" style={{ position: 'absolute', left: '-9999px', height: 0, overflow: 'hidden' }}>
                  <label htmlFor="cand-website">Não preencha este campo</label><input id="cand-website" tabIndex={-1} autoComplete="off" defaultValue="" />
                </div>
              </Card>

              <div className="flex flex-wrap gap-3 items-center">
                <Button type="submit" size="lg" icon="Send" disabled={enviando}>{enviando ? 'Enviando…' : 'Enviar candidatura'}</Button>
                <Link to={`/carreiras/${slug}`} className="text-[13.5px] text-muted hover:text-ink">Cancelar</Link>
              </div>
            </form>
          )}
      </Contenedor>
    </PortalLayout>
  )
}
