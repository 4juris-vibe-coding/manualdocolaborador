import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, Field, PageHeader } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { BadgeStatus, useOpcoes } from '@/components/v2/vagas/comum'
import { ErroApi, api, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { toast } from '@/components/toast'
import { MODALIDADES_VAGA, REGIMES_CONTRATACAO, ROTULO_MODALIDADE, ROTULO_REGIME_CONTRATACAO, SOBRE_4JURIS_PADRAO } from '@/domain/v2/vagas'
import { Dropdown } from '@/components/Dropdown'

const CHAVE_LOCAL = 'vaga_rascunho_nao_salvo_v2'
/** Rótulos curtos para o select de contrato (o rótulo completo continua na página pública). */
const ROTULO_CONTRATO: Record<string, string> = { pj: 'PJ', mei: 'MEI', autonomo: 'Autônomo', clt: 'CLT', estagio: 'Estágio', temporario: 'Temporário', nao_informado: 'Não informar' }
const MAX_ITEM = 200
const MAX_ITENS = 40

type Form = Record<string, any>
/** Campos de texto da vaga que o formulário edita. Os demais campos da vaga (de vagas antigas) ficam como estão. */
const TEXTOS = ['titulo', 'modalidade', 'regimeContratacao', 'sobreEmpresa', 'textoPublico', 'responsabilidades', 'endereco'] as const
/** Listas editadas como texto, um item por linha. */
const LISTAS = { requisitos: 'requisitosObrigatorios', vantagens: 'beneficios' } as const

const linhas = (t: string) => String(t ?? '').split('\n').map((l) => l.replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').trim()).filter(Boolean)

const formDaVaga = (v: Form): Form => {
  const f: Form = {}
  for (const k of TEXTOS) f[k] = v[k] ?? ''
  for (const [campo, col] of Object.entries(LISTAS)) f[campo] = Array.isArray(v[col]) ? v[col].join('\n') : ''
  return f
}
const FORM_NOVO: Form = { ...formDaVaga({}), modalidade: 'presencial', regimeContratacao: 'pj', sobreEmpresa: SOBRE_4JURIS_PADRAO }

function payload(f: Form): Form {
  const p: Form = {}
  for (const k of TEXTOS) p[k] = String(f[k] ?? '').trim() || null
  p.titulo = String(f.titulo ?? '').trim()
  for (const [campo, col] of Object.entries(LISTAS)) p[col] = linhas(f[campo])
  if (!p.modalidade) delete p.modalidade
  return p
}

/** Erros que dá para apontar antes de enviar (o servidor confere de novo). */
function validar(f: Form, paraPublicar: boolean): Record<string, string> {
  const e: Record<string, string> = {}
  if (!String(f.titulo ?? '').trim()) e.titulo = 'Informe o nome da vaga'
  for (const campo of Object.keys(LISTAS)) {
    const itens = linhas(f[campo])
    if (itens.length > MAX_ITENS) e[campo] = `No máximo ${MAX_ITENS} itens`
    else if (itens.some((i) => i.length > MAX_ITEM)) e[campo] = `Cada linha pode ter até ${MAX_ITEM} caracteres`
  }
  if (paraPublicar) {
    if (!f.modalidade) e.modalidade = 'Informe o modelo de trabalho'
    if (!String(f.textoPublico ?? '').trim() && !String(f.responsabilidades ?? '').trim()) e.textoPublico = 'Descreva a oportunidade ou as responsabilidades'
  }
  return e
}
/** Erros do servidor vêm com o nome do campo da API; aqui viram o campo do formulário. */
const campoDoForm = (k: string) => (k === 'requisitosObrigatorios' ? 'requisitos' : k === 'beneficios' ? 'vantagens' : k)

export default function VagaForm() {
  const { id: idRota } = useParams()
  const nav = useNavigate()
  const opcoes = useOpcoes()
  const gestao = useTem('vagas:gerenciar')
  const detalhe = useApi<Form>(idRota ? `vagas/${idRota}` : null)
  const [id, setId] = useState<string | undefined>(idRota)
  const [form, setForm] = useState<Form>(FORM_NOVO)
  const [versao, setVersao] = useState(1)
  const [status, setStatus] = useState('rascunho')
  const [acoes, setAcoes] = useState<string[]>([])
  const [erros, setErros] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<'limpo' | 'sujo' | 'salvando' | 'salvo' | 'erro'>('limpo')
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  const [editavel, setEditavel] = useState(true)
  const [recuperavel, setRecuperavel] = useState<Form | null>(null)
  const [publicando, setPublicando] = useState(false)
  const iniciado = useRef(false)
  const emVoo = useRef(false)
  const refazer = useRef(false)
  const dirty = useRef(false)

  const aplicarDetalhe = useCallback((d: Form) => {
    setId(d.vaga.id); setVersao(d.vaga.versao); setStatus(d.vaga.status)
    setAcoes(d.permissoes.acoes ?? [])
    setEditavel(!!d.permissoes.editar)
  }, [])

  useEffect(() => {
    if (iniciado.current || !detalhe.dados) return
    iniciado.current = true
    setForm(formDaVaga(detalhe.dados.vaga)); aplicarDetalhe(detalhe.dados)
  }, [detalhe.dados, aplicarDetalhe])

  // Vaga nova: rascunho local não salvo
  useEffect(() => {
    if (idRota || iniciado.current || !opcoes.dados) return
    iniciado.current = true
    try { const bruto = localStorage.getItem(CHAVE_LOCAL); if (bruto) setRecuperavel(JSON.parse(bruto)) } catch { /* sem armazenamento */ }
  }, [idRota, opcoes.dados])

  const set = (k: string, v: unknown) => { dirty.current = true; setForm((f) => ({ ...f, [k]: v })); setEstado('sujo'); setErros((e) => { if (!e[k]) return e; const { [k]: _, ...resto } = e; return resto }) }

  // Cópia local enquanto a vaga ainda não existe no servidor (protege contra fechar a aba).
  useEffect(() => {
    if (id || !dirty.current) return
    try { localStorage.setItem(CHAVE_LOCAL, JSON.stringify(form)) } catch { /* ignora */ }
  }, [form, id])

  const salvar = useCallback(async (silencioso = false): Promise<string | null> => {
    if (!editavel) return null
    const e = validar(form, false)
    if (Object.keys(e).length) { if (!silencioso) { setErros(e); toast(Object.values(e)[0], 'danger') } return null }
    if (emVoo.current) { refazer.current = true; if (!silencioso) toast('Salvando alterações… tente de novo em instantes.'); return null }
    emVoo.current = true; setEstado('salvando')
    try {
      const d = id ? await api.put(`vagas/${id}`, { ...payload(form), versao }) : await api.post('vagas', payload(form))
      aplicarDetalhe(d)
      if (!id) { try { localStorage.removeItem(CHAVE_LOCAL) } catch { /* ignora */ } window.history.replaceState(null, '', `/recrutamento/vagas/${d.vaga.id}/editar`) }
      dirty.current = false; setEstado('salvo'); setSalvoEm(new Date()); setErros({})
      if (!silencioso) toast(d.vaga.status === 'rascunho' ? 'Rascunho salvo.' : 'Alterações salvas.')
      return d.vaga.id as string
    } catch (err) {
      setEstado('erro')
      if (err instanceof ErroApi) {
        if (err.campos) setErros(Object.fromEntries(Object.entries(err.campos).map(([k, m]) => [campoDoForm(k), m])))
        if (!silencioso || err.status === 409) toast(err.message, 'danger')
      }
      return null
    } finally {
      emVoo.current = false
      if (refazer.current) { refazer.current = false; setTimeout(() => void salvar(true), 50) }
    }
  }, [form, id, versao, editavel, aplicarDetalhe])

  // Salvamento automático só no rascunho (numa vaga no ar, cada tecla iria direto para o portal).
  useEffect(() => {
    if (estado !== 'sujo' || !editavel || status !== 'rascunho') return
    const t = setTimeout(() => void salvar(true), 2500)
    return () => clearTimeout(t)
  }, [form, estado, editavel, status, salvar])
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  const podePublicar = !id || acoes.includes('publicar')
  const publicar = async () => {
    const e = validar(form, true)
    if (Object.keys(e).length) { setErros(e); toast(Object.values(e)[0], 'danger'); return }
    setPublicando(true)
    // Não silencioso: se o salvamento falhar, a pessoa vê o motivo do servidor.
    const alvo = await salvar(false)
    if (!alvo) { setPublicando(false); return }
    try {
      await api.post(`vagas/${alvo}/acoes/publicar`)
      toast('Vaga publicada no portal de carreiras.')
      nav(`/recrutamento/vagas/${alvo}`)
    } catch (err) {
      if (err instanceof ErroApi) { if (err.campos) setErros(Object.fromEntries(Object.entries(err.campos).map(([k, m]) => [campoDoForm(k), m]))); toast(err.message, 'danger') }
    } finally { setPublicando(false) }
  }

  const E = (k: string) => erros[k]
  const txt = (k: string, label: string, p: { required?: boolean; hint?: string; max?: number; placeholder?: string; area?: boolean; rows?: number } = {}) => (
    <Field label={label} required={p.required} hint={p.hint} erro={E(k)} htmlFor={`f-${k}`}>
      {p.area
        ? <textarea id={`f-${k}`} className="input min-h-[110px]" rows={p.rows ?? 4} maxLength={p.max} placeholder={p.placeholder} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel} />
        : <input id={`f-${k}`} className="input" maxLength={p.max} placeholder={p.placeholder} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel} />}
    </Field>
  )
  const sel = (k: string, label: string, opts: { v: string; n: string }[], p: { required?: boolean } = {}) => (
    <Field label={label} required={p.required} erro={E(k)} htmlFor={`f-${k}`}>
      <Dropdown id={`f-${k}`} className="input" value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel}>
        {opts.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}
      </Dropdown>
    </Field>
  )
  const lista = (k: keyof typeof LISTAS, label: string, placeholder: string) => {
    const n = linhas(form[k]).length
    return txt(k, label, { area: true, rows: 7, placeholder, hint: `Um item por linha${n ? ` · ${n} ${n === 1 ? 'item' : 'itens'}` : ''}. Marcadores como "-" ou "•" no início são ignorados.` })
  }

  const indicador = estado === 'salvando' ? 'Salvando…' : estado === 'erro' ? 'Não foi possível salvar' : estado === 'sujo' ? 'Alterações ainda não salvas' : salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : id ? 'Tudo salvo' : 'Rascunho novo'
  const noAr = status === 'publicada' || status === 'pausada'

  const corpo = (
    <>
      {recuperavel && !id && (
        <Callout tone="brand" icon="History" className="mb-5">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <span>Encontramos um rascunho que você não chegou a salvar{recuperavel.titulo ? `: “${recuperavel.titulo}”` : ''}.</span>
            <span className="flex gap-2">
              <Button size="sm" onClick={() => { dirty.current = true; setForm({ ...FORM_NOVO, ...recuperavel }); setEstado('sujo'); setRecuperavel(null) }}>Recuperar</Button>
              <Button size="sm" variant="ghost" onClick={() => { try { localStorage.removeItem(CHAVE_LOCAL) } catch { /* ignora */ } setRecuperavel(null) }}>Descartar</Button>
            </span>
          </div>
        </Callout>
      )}
      {!editavel && id && <Callout tone="warning" icon="Lock" className="mb-5">Esta vaga não pode ser editada por você no estado atual. <Link className="underline font-semibold" to={`/recrutamento/vagas/${id}`}>Abrir a vaga</Link></Callout>}
      {noAr && editavel && <Callout tone="neutral" icon="Globe" className="mb-5">Esta vaga está no portal de carreiras. As alterações aparecem lá assim que você salvar.</Callout>}

      <Card className="p-5 sm:p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
          <div className="md:col-span-2">{txt('titulo', 'Vaga', { required: true, max: 200, placeholder: 'Ex.: SDR Pleno' })}</div>
          {sel('modalidade', 'Modelo de trabalho', MODALIDADES_VAGA.map((m) => ({ v: m, n: m === 'presencial' ? '100% presencial' : ROTULO_MODALIDADE[m] })), { required: true })}
          {sel('regimeContratacao', 'Contrato', REGIMES_CONTRATACAO.map((r) => ({ v: r, n: ROTULO_CONTRATO[r] ?? ROTULO_REGIME_CONTRATACAO[r] })))}
          <div className="md:col-span-2">{txt('sobreEmpresa', 'Sobre a 4JURIS', { area: true, rows: 5, max: 4000, hint: 'Já vem preenchido com o texto padrão. Ajuste se quiser.' })}</div>
          <div className="md:col-span-2">{txt('textoPublico', 'Sobre a oportunidade', { area: true, rows: 6, max: 8000, required: true, placeholder: 'Buscamos um(a)… Você será responsável por…' })}</div>
          <div className="md:col-span-2">{txt('responsabilidades', 'Responsabilidades', { area: true, rows: 6, max: 6000, placeholder: 'Prospecção e abordagem: contato inicial com leads…\nQualificação de leads: análise de perfil…', hint: 'Escreva como quiser: as quebras de linha são mantidas na página da vaga.' })}</div>
          <div className="md:col-span-2">{lista('requisitos', 'Requisitos', 'Experiência como SDR, Social Seller ou Inside Sales.\nExcelente comunicação escrita e verbal.')}</div>
          <div className="md:col-span-2">{lista('vantagens', 'Vantagens', 'Ajuda de custo de R$ 680,00\nWellhub (Gympass)\nDay off de aniversário')}</div>
          <div className="md:col-span-2">{txt('endereco', 'Localização', { max: 300, placeholder: 'ITC Central Park - R. Ary Barroso, 70 - Papicu, Fortaleza - CE' })}</div>
        </div>
      </Card>

      <div className="flex items-center justify-between gap-3 flex-wrap mt-5">
        <span className="text-[12px] text-muted" role="status" aria-live="polite">{indicador}</span>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon="Save" disabled={!editavel || estado === 'salvando'} onClick={() => void salvar(false)}>{status === 'rascunho' ? 'Salvar rascunho' : 'Salvar alterações'}</Button>
          {editavel && podePublicar && !noAr && (
            <Button icon="Globe" disabled={publicando || estado === 'salvando'} onClick={publicar}>{publicando ? 'Publicando…' : 'Publicar vaga'}</Button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <PageHeader title={idRota ? 'Editar vaga' : 'Nova vaga'} subtitle={gestao || !id ? 'Preencha e publique: a vaga vai direto para o portal de carreiras.' : undefined}
        eyebrow={id ? <BadgeStatus valor={status} /> : <Badge tone="brand">Recrutamento</Badge>}
        actions={<Link to={id ? `/recrutamento/vagas/${id}` : '/recrutamento/vagas'}><Button variant="ghost" icon="X">Fechar</Button></Link>} />
      <SoComBanco>
        {idRota ? <Aguardar r={detalhe}>{() => corpo}</Aguardar> : <Aguardar r={opcoes}>{() => corpo}</Aguardar>}
      </SoComBanco>
    </>
  )
}
