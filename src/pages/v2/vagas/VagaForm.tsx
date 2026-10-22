import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, Field, PageHeader, Toggle } from '@/components/ui'
import { TagInput } from '@/components/inputs'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Stepper } from '@/components/v2/Stepper'
import { BadgeStatus, useOpcoes, type Opcoes } from '@/components/v2/vagas/comum'
import { EditorEtapas } from '@/components/v2/vagas/EditorEtapas'
import { ImagemVaga } from '@/components/v2/vagas/ImagemVaga'
import { ErroApi, api, executar, lerBase64, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { toast } from '@/components/toast'
import { REGIMES_CONTRATACAO, ROTULO_REGIME_CONTRATACAO, SOBRE_4JURIS_PADRAO,
  MODALIDADES_VAGA, MOEDAS, MOTIVOS_VAGA, PRIORIDADES_VAGA, ROTULO_ETAPA, ROTULO_MODALIDADE, ROTULO_MOTIVO, ROTULO_PRIORIDADE, ROTULO_REMUNERACAO, TIPOS_ETAPA, TIPOS_REMUNERACAO, camposFaltantes,
} from '@/domain/v2/vagas'
import { hojeISO } from '@/lib/fmt'
import { Dropdown } from '@/components/Dropdown'

const PASSOS = ['Informações gerais', 'Estrutura', 'Local e remuneração', 'Perfil profissional', 'Triagem', 'Divulgação', 'Revisão']
const PASSO_DO_CAMPO: Record<string, number> = {
  titulo: 0, qtdPosicoes: 0, setorId: 1, modalidade: 2, cidade: 2, salarioMax: 2, salarioMin: 2, responsabilidades: 3, perguntasTriagem: 4, textoPublico: 5, canais: 5, encerraCandidaturasEm: 5, etapas: 5,
}
const CHAVE_LOCAL = 'vaga_rascunho_nao_salvo_v1'

type Form = Record<string, any>
const LISTAS = ['beneficios', 'requisitosObrigatorios', 'requisitosDesejaveis', 'competenciasTecnicas', 'competenciasComportamentais', 'idiomas', 'certificacoes', 'criteriosAvaliacao', 'documentosNecessarios', 'canais']
const TEXTOS = ['titulo', 'resumo', 'objetivo', 'tipo', 'regimeContratacao', 'motivo', 'prioridade', 'setorId', 'unidadeId', 'cargoId', 'senioridade', 'equipe', 'gestorSolicitanteId', 'gestorResponsavelId', 'gestorImediatoId', 'recrutadorId',
  'pais', 'estado', 'cidade', 'endereco', 'modalidade', 'viagens', 'moeda', 'tipoRemuneracao', 'variavel', 'responsabilidades', 'atividades', 'formacao', 'experiencia', 'sobreEmpresa', 'textoPublico', 'mensagemConfirmacao', 'criteriosEncerramento',
  'dataAbertura', 'prazoPreenchimento', 'dataInicioPrevista', 'publicarEm', 'encerraCandidaturasEm', 'observacoesRh']
const NUMEROS = ['salarioMin', 'salarioMax']

const formDaVaga = (v: Form): Form => {
  const f: Form = {}
  for (const k of TEXTOS) f[k] = v[k] ?? ''
  for (const k of NUMEROS) f[k] = v[k] ?? ''
  for (const k of LISTAS) f[k] = Array.isArray(v[k]) ? v[k] : []
  f.qtdPosicoes = v.qtdPosicoes ?? 1
  f.divulgarSalario = !!v.divulgarSalario
  f.perguntasTriagem = Array.isArray(v.perguntasTriagem) ? v.perguntasTriagem : []
  return f
}
const FORM_NOVO: Form = {
  ...formDaVaga({}), tipo: 'efetivo', regimeContratacao: 'pj', motivo: 'expansao', prioridade: 'normal', modalidade: 'presencial', moeda: 'BRL', tipoRemuneracao: 'mensal', pais: 'Brasil', dataAbertura: hojeISO(), canais: ['portal'], sobreEmpresa: SOBRE_4JURIS_PADRAO,
}
function payload(f: Form, verRem: boolean): Form {
  const p: Form = {}
  for (const k of TEXTOS) if (f[k] !== undefined) p[k] = f[k] === '' ? null : f[k]
  p.titulo = f.titulo
  for (const k of LISTAS) p[k] = f[k]
  p.qtdPosicoes = Number(f.qtdPosicoes) || 1
  // Pergunta recém-adicionada, ainda sem texto, fica só na tela até ser preenchida (senão o salvamento automático falha).
  p.perguntasTriagem = (f.perguntasTriagem ?? []).filter((q: Form) => String(q.texto ?? '').trim())
  if (verRem) { for (const k of NUMEROS) p[k] = f[k] === '' || f[k] === null ? null : Number(f[k]); p.divulgarSalario = !!f.divulgarSalario } else { for (const k of ['moeda', 'tipoRemuneracao', 'variavel']) delete p[k] }
  for (const k of ['tipo', 'motivo', 'prioridade', 'modalidade']) if (!p[k]) delete p[k]
  return p
}

export default function VagaForm() {
  const { id: idRota } = useParams()
  const nav = useNavigate()
  const opcoes = useOpcoes()
  const verRem = useTem('vagas:ver_remuneracao')
  const gestao = useTem('vagas:gerenciar')
  const notasRh = useTem('ats:notas_rh')
  const detalhe = useApi<Form>(idRota ? `vagas/${idRota}` : null)
  const [id, setId] = useState<string | undefined>(idRota)
  const [form, setForm] = useState<Form>(FORM_NOVO)
  const [versao, setVersao] = useState(1)
  const [status, setStatus] = useState('rascunho')
  const [passo, setPasso] = useState(0)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [estado, setEstado] = useState<'limpo' | 'sujo' | 'salvando' | 'salvo' | 'erro'>('limpo')
  const [salvoEm, setSalvoEm] = useState<Date | null>(null)
  const [etapas, setEtapas] = useState<{ id?: string; nome: string; tipo: string; ativas?: number }[]>([])
  const [anexos, setAnexos] = useState<{ id: string; nome: string; tamanho: number }[]>([])
  const [editavel, setEditavel] = useState(true)
  const [recuperavel, setRecuperavel] = useState<Form | null>(null)
  const [enviando, setEnviando] = useState(false)
  const iniciado = useRef(false)
  const emVoo = useRef(false)
  const refazer = useRef(false)
  const dirty = useRef(false)

  const aplicarDetalhe = useCallback((d: Form) => {
    setId(d.vaga.id); setVersao(d.vaga.versao); setStatus(d.vaga.status)
    setEtapas(d.etapas.map((e: Form) => ({ id: e.id, nome: e.nome, tipo: e.tipo, ativas: e.ativas })))
    setAnexos(d.anexos)
    setEditavel(!!d.permissoes.editar)
  }, [])

  useEffect(() => {
    if (iniciado.current || !detalhe.dados) return
    iniciado.current = true
    setForm(formDaVaga(detalhe.dados.vaga)); aplicarDetalhe(detalhe.dados)
  }, [detalhe.dados, aplicarDetalhe])

  // Vaga nova: padrões vindos do cadastro + rascunho local não salvo
  useEffect(() => {
    if (idRota || iniciado.current || !opcoes.dados) return
    iniciado.current = true
    setForm((f) => ({ ...f, setorId: opcoes.dados!.setores.length === 1 ? opcoes.dados!.setores[0].id : f.setorId, gestorSolicitanteId: opcoes.dados!.eu.colaboradorId }))
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
    if (!String(form.titulo ?? '').trim()) { if (!silencioso) { setErros({ titulo: 'Informe o título da vaga' }); setPasso(0); toast('Informe o título para salvar.', 'danger') } return null }
    if (emVoo.current) { refazer.current = true; if (!silencioso) toast('Salvando alterações… tente de novo em instantes.'); return null }
    emVoo.current = true; setEstado('salvando')
    try {
      const d = id ? await api.put(`vagas/${id}`, { ...payload(form, verRem), versao }) : await api.post('vagas', payload(form, verRem))
      aplicarDetalhe(d)
      if (!id) { try { localStorage.removeItem(CHAVE_LOCAL) } catch { /* ignora */ } window.history.replaceState(null, '', `/recrutamento/vagas/${d.vaga.id}/editar`) }
      dirty.current = false; setEstado('salvo'); setSalvoEm(new Date()); setErros({})
      if (!silencioso) toast('Rascunho salvo.')
      return d.vaga.id as string
    } catch (e) {
      setEstado('erro')
      if (e instanceof ErroApi) {
        if (e.campos) { setErros(e.campos); const p = Object.keys(e.campos).map((k) => PASSO_DO_CAMPO[k]).filter((x) => x !== undefined); if (p.length && !silencioso) setPasso(Math.min(...p)) }
        if (!silencioso || e.status === 409) toast(e.message, 'danger')
      }
      return null
    } finally {
      emVoo.current = false
      if (refazer.current) { refazer.current = false; setTimeout(() => void salvar(true), 50) }
    }
  }, [form, id, versao, verRem, editavel, aplicarDetalhe])

  // Salvamento automático (2,5 s depois da última alteração)
  useEffect(() => {
    if (estado !== 'sujo' || !editavel) return
    const t = setTimeout(() => void salvar(true), 2500)
    return () => clearTimeout(t)
  }, [form, estado, editavel, salvar])
  useEffect(() => {
    const aviso = (e: BeforeUnloadEvent) => { if (dirty.current) { e.preventDefault(); e.returnValue = '' } }
    window.addEventListener('beforeunload', aviso)
    return () => window.removeEventListener('beforeunload', aviso)
  }, [])

  const faltas = useMemo(() => camposFaltantes({ ...form, qtdPosicoes: Number(form.qtdPosicoes) }, 'solicitar', hojeISO()), [form])
  const faltasPublicar = useMemo(() => camposFaltantes({ ...form, qtdPosicoes: Number(form.qtdPosicoes) }, 'publicar', hojeISO()), [form])
  const passosComErro = useMemo(() => [...new Set(Object.keys(erros).map((k) => PASSO_DO_CAMPO[k]).filter((x) => x !== undefined))], [erros])

  const solicitar = async () => {
    setEnviando(true)
    // Não silencioso: se o salvamento falhar, a pessoa vê o motivo do servidor e o passo com erro.
    const alvo = await salvar(false)
    if (!alvo) { setEnviando(false); return }
    try {
      await api.post(`vagas/${alvo}/acoes/solicitar`)
      toast('Solicitação enviada para aprovação.')
      nav(`/recrutamento/vagas/${alvo}`)
    } catch (e) {
      if (e instanceof ErroApi) { if (e.campos) { setErros(e.campos); const p = Object.keys(e.campos).map((k) => PASSO_DO_CAMPO[k]).filter((x) => x !== undefined); if (p.length) setPasso(Math.min(...p)) } toast(e.message, 'danger') }
    } finally { setEnviando(false) }
  }

  const salvarEtapas = async () => {
    if (!id) { toast('Salve o rascunho antes de configurar as etapas.', 'danger'); return }
    const d = await executar(() => api.put(`vagas/${id}/etapas`, { etapas: etapas.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo })) }), 'Etapas salvas.')
    if (d) { setEtapas(d.etapas.map((e: Form) => ({ id: e.id, nome: e.nome, tipo: e.tipo, ativas: e.ativas }))); setVersao(d.vaga.versao) }
  }
  const enviarAnexo = async (arq: File | undefined) => {
    if (!arq || !id) return
    const d = await executar(async () => api.post(`vagas/${id}/anexos`, { arquivo: await lerBase64(arq) }), 'Arquivo anexado.')
    if (d) { setAnexos(d.anexos); setVersao(d.vaga.versao) }
  }
  const removerAnexo = async (aid: string) => {
    const d = await executar(() => api.del(`vagas/${id}/anexos/${aid}`), 'Anexo removido.')
    if (d) setAnexos(d.anexos)
  }

  const op: Opcoes | undefined = opcoes.dados
  const E = (k: string) => erros[k]
  const txt = (k: string, label: string, p: { required?: boolean; hint?: string; type?: string; max?: number; placeholder?: string; area?: boolean; rows?: number } = {}) => (
    <Field label={label} required={p.required} hint={p.hint} erro={E(k)} htmlFor={`f-${k}`}>
      {p.area
        ? <textarea id={`f-${k}`} className="input min-h-[110px]" rows={p.rows ?? 4} maxLength={p.max} placeholder={p.placeholder} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel} />
        : <input id={`f-${k}`} type={p.type ?? 'text'} className="input" maxLength={p.max} placeholder={p.placeholder} value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel} />}
    </Field>
  )
  const sel = (k: string, label: string, opts: { v: string; n: string }[], p: { vazio?: string; required?: boolean; hint?: string } = {}) => (
    <Field label={label} required={p.required} hint={p.hint} erro={E(k)} htmlFor={`f-${k}`}>
      <Dropdown id={`f-${k}`} className="input" value={form[k] ?? ''} onChange={(e) => set(k, e.target.value)} aria-invalid={!!E(k)} disabled={!editavel}>
        {p.vazio !== undefined && <option value="">{p.vazio}</option>}
        {opts.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}
      </Dropdown>
    </Field>
  )
  const tags = (k: string, label: string, placeholder?: string) => (
    <Field label={label} htmlFor={`f-${k}`} erro={E(k)}><TagInput label={label} valor={form[k] ?? []} onChange={(v) => set(k, v)} placeholder={placeholder} /></Field>
  )

  const cargosDaArea = (op?.cargos ?? []).filter((c) => !form.setorId || c.setorId === form.setorId)
  const cargosOutros = (op?.cargos ?? []).filter((c) => form.setorId && c.setorId !== form.setorId)
  const pessoas = (op?.pessoas ?? []).map((p) => ({ v: p.id, n: p.nome }))

  const passoConteudo = [
    /* 0 */ <div key="0" className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
      <div className="md:col-span-2">{txt('titulo', 'Título da vaga', { required: true, max: 200, placeholder: 'Ex.: Advogado(a) trabalhista' })}</div>
      <div className="md:col-span-2">{txt('resumo', 'Descrição resumida', { area: true, rows: 3, max: 600, hint: 'Aparece na lista de vagas. Até 600 caracteres.' })}</div>
      <div className="md:col-span-2">{txt('objetivo', 'Objetivo da posição', { area: true, rows: 3, max: 2000 })}</div>
      {sel('tipo', 'Tipo de oportunidade', op?.tipos.map((t) => ({ v: t.chave, n: t.nome })) ?? [])}
      {sel('regimeContratacao', 'Forma de contratação', REGIMES_CONTRATACAO.map((r) => ({ v: r, n: ROTULO_REGIME_CONTRATACAO[r] })))}
      {sel('motivo', 'Motivo da abertura', MOTIVOS_VAGA.map((m) => ({ v: m, n: ROTULO_MOTIVO[m] })))}
      <Field label="Quantidade de posições" required erro={E('qtdPosicoes')} htmlFor="f-qtd"><input id="f-qtd" type="number" min={1} max={500} className="input" value={form.qtdPosicoes} onChange={(e) => set('qtdPosicoes', e.target.value)} disabled={!editavel} /></Field>
      {sel('prioridade', 'Prioridade', PRIORIDADES_VAGA.map((p) => ({ v: p, n: ROTULO_PRIORIDADE[p] })), { hint: 'Vagas críticas passam por um fluxo de aprovação mais completo.' })}
      {txt('dataAbertura', 'Data de abertura', { type: 'date' })}
      {txt('prazoPreenchimento', 'Prazo desejado para preenchimento', { type: 'date' })}
      {txt('dataInicioPrevista', 'Data prevista de início', { type: 'date' })}
    </div>,
    /* 1 */ <div key="1" className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
      {sel('setorId', 'Departamento (área)', (op?.setores ?? []).map((s) => ({ v: s.id, n: s.nome })), { required: true, vazio: 'Selecione…', hint: gestao ? undefined : 'Você solicita vagas apenas para as áreas que lidera.' })}
      {sel('unidadeId', 'Unidade', (op?.unidades ?? []).map((s) => ({ v: s.id, n: s.nome })), { vazio: 'Não definida' })}
      {txt('equipe', 'Equipe', { max: 120, placeholder: 'Ex.: Contencioso' })}
      <Field label="Cargo (catálogo)" htmlFor="f-cargoId" erro={E('cargoId')} hint="Vem do cadastro de cargos: não é criado um novo aqui.">
        <Dropdown id="f-cargoId" className="input" value={form.cargoId ?? ''} disabled={!editavel} onChange={(e) => { const c = op?.cargos.find((x) => x.id === e.target.value); set('cargoId', e.target.value); if (c?.nivel && !form.senioridade) set('senioridade', c.nivel) }}>
          <option value="">Não definido</option>
          {cargosDaArea.length > 0 && <optgroup label={form.setorId ? 'Cargos da área' : 'Cargos'}>{cargosDaArea.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.nivel ? ` · ${c.nivel}` : ''}</option>)}</optgroup>}
          {cargosOutros.length > 0 && <optgroup label="Cargos de outras áreas">{cargosOutros.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.nivel ? ` · ${c.nivel}` : ''}</option>)}</optgroup>}
        </Dropdown>
      </Field>
      {txt('senioridade', 'Nível ou senioridade', { max: 60, placeholder: 'Júnior, Pleno, Sênior…' })}
      {sel('gestorSolicitanteId', 'Gestor(a) solicitante', pessoas, { vazio: 'Não definido' })}
      {sel('gestorResponsavelId', 'Gestor(a) responsável', pessoas, { vazio: 'Não definido' })}
      {sel('gestorImediatoId', 'Gestor(a) imediato(a) da posição', pessoas, { vazio: 'Não definido', hint: 'Quem a pessoa contratada reportará. Usado no organograma.' })}
      {gestao && sel('recrutadorId', 'Recrutador(a) responsável', (op?.recrutadores ?? []).map((p) => ({ v: p.id, n: p.nome })), { vazio: 'Não atribuído' })}
    </div>,
    /* 2 */ <div key="2">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        {txt('pais', 'País', { max: 80 })}{txt('estado', 'Estado', { max: 80, placeholder: 'CE' })}{txt('cidade', 'Cidade', { max: 120 })}
        <div className="md:col-span-2">{txt('endereco', 'Endereço do local de trabalho', { max: 300, placeholder: 'Ex.: ITC Central Park - R. Ary Barroso, 70 - Papicu, Fortaleza - CE', hint: 'Aparece em "Localização" na página pública da vaga.' })}</div>
        {sel('modalidade', 'Modalidade', MODALIDADES_VAGA.map((m) => ({ v: m, n: ROTULO_MODALIDADE[m] })), { required: true })}
        <div className="md:col-span-2">{txt('viagens', 'Disponibilidade para viagens / requisitos de localização', { max: 300 })}</div>
      </div>
      <h3 className="text-[14px] font-bold text-ink mt-3 mb-3">Remuneração e benefícios</h3>
      {verRem ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
          <Field label="Salário mínimo" erro={E('salarioMin')} htmlFor="f-smin"><input id="f-smin" type="number" min={0} step="0.01" className="input" value={form.salarioMin} onChange={(e) => set('salarioMin', e.target.value)} disabled={!editavel} /></Field>
          <Field label="Salário máximo" erro={E('salarioMax')} htmlFor="f-smax"><input id="f-smax" type="number" min={0} step="0.01" className="input" value={form.salarioMax} onChange={(e) => set('salarioMax', e.target.value)} disabled={!editavel} /></Field>
          {sel('tipoRemuneracao', 'Tipo de remuneração', TIPOS_REMUNERACAO.map((t) => ({ v: t, n: ROTULO_REMUNERACAO[t] })))}
          {sel('moeda', 'Moeda', MOEDAS.map((m) => ({ v: m, n: m })))}
          <div className="md:col-span-2">{txt('variavel', 'Bônus ou remuneração variável', { max: 300 })}</div>
          <div className="md:col-span-2 mb-4"><Toggle checked={!!form.divulgarSalario} onChange={(v) => set('divulgarSalario', v)} disabled={!editavel} label="Divulgar a faixa salarial no portal de carreiras" /></div>
        </div>
      ) : <Callout tone="neutral" icon="Lock" className="mb-4">A remuneração é definida pelo RH, que tem permissão para ver e editar a faixa salarial da vaga.</Callout>}
      <div className="md:col-span-2">{tags('beneficios', 'Benefícios e vantagens', 'Ex.: Wellhub (Gympass)')}</div>
    </div>,
    /* 3 */ <div key="3" className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
      <div className="md:col-span-2">{txt('responsabilidades', 'Principais responsabilidades', { area: true, rows: 5, max: 6000, required: true })}</div>
      <div className="md:col-span-2">{txt('atividades', 'Atividades do dia a dia', { area: true, rows: 4, max: 6000 })}</div>
      {tags('requisitosObrigatorios', 'Requisitos obrigatórios')}{tags('requisitosDesejaveis', 'Requisitos desejáveis')}
      {txt('formacao', 'Formação acadêmica', { max: 600 })}{txt('experiencia', 'Experiência necessária', { max: 600 })}
      {tags('competenciasTecnicas', 'Competências técnicas')}{tags('competenciasComportamentais', 'Competências comportamentais')}
      {tags('idiomas', 'Idiomas', 'Ex.: Inglês avançado')}{tags('certificacoes', 'Certificações')}
      {tags('criteriosAvaliacao', 'Critérios de avaliação')}{tags('documentosNecessarios', 'Documentos necessários')}
    </div>,
    /* 4 */ <Triagem key="4" valor={form.perguntasTriagem} onChange={(v) => set('perguntasTriagem', v)} desabilitado={!editavel} />,
    /* 5 */ <div key="5">
      <Field label="Canais de divulgação" required erro={E('canais')}>
        <div className="flex flex-wrap gap-2">
          {(op?.canais ?? []).map((c) => {
            const on = (form.canais as string[]).includes(c.chave)
            return <label key={c.chave} className={`inline-flex items-center gap-2 rounded-xl border px-3 py-2 text-[13px] cursor-pointer ${on ? 'border-brand bg-brand-50 text-brand-700' : 'border-line'}`}>
              <input type="checkbox" checked={on} disabled={!editavel} onChange={() => set('canais', on ? form.canais.filter((x: string) => x !== c.chave) : [...form.canais, c.chave])} />{c.nome}</label>
          })}
        </div>
      </Field>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-5">
        {txt('publicarEm', 'Publicação agendada para', { type: 'date', hint: 'Só publica se a vaga já estiver aprovada e completa.' })}
        {txt('encerraCandidaturasEm', 'Encerramento das candidaturas', { type: 'date', required: true })}
        <div className="md:col-span-2">{id ? <ImagemVaga vagaId={id} editavel={editavel} temInicial={!!(detalhe.dados as any)?.vaga?.temImagem} /> : <Callout tone="neutral" icon="Info">Depois que o rascunho for salvo (ao preencher o título), você poderá enviar uma imagem de capa.</Callout>}</div>
        <div className="md:col-span-2">{txt('sobreEmpresa', 'Sobre a empresa', { area: true, rows: 5, max: 4000, hint: 'Aparece no topo da página pública da vaga, em "Sobre a 4JURIS".' })}</div>
        <div className="md:col-span-2">{txt('textoPublico', 'Sobre a oportunidade (texto público)', { area: true, rows: 6, max: 8000, hint: 'É o que a pessoa candidata lê no portal. Não inclua dados internos nem sigilosos.' })}</div>
        <div className="md:col-span-2">{txt('mensagemConfirmacao', 'Mensagem de confirmação da candidatura', { area: true, rows: 2, max: 1000 })}</div>
        <div className="md:col-span-2">{txt('criteriosEncerramento', 'Critérios de encerramento e preenchimento', { area: true, rows: 2, max: 1000 })}</div>
        {notasRh && <div className="md:col-span-2">{txt('observacoesRh', 'Observações restritas ao RH', { area: true, rows: 3, max: 4000, hint: 'Visíveis só para quem trabalha com recrutamento.' })}</div>}
      </div>
      <h3 className="text-[14px] font-bold text-ink mt-2 mb-1">Etapas do processo seletivo</h3>
      {id ? <EditorEtapas etapas={etapas} onChange={(e) => { setEtapas(e) }} onSalvar={salvarEtapas} desabilitado={!editavel} erro={E('etapas')} /> : <Callout tone="neutral" icon="Info">O rascunho é salvo automaticamente ao preencher o título. Depois disso você poderá personalizar as etapas.</Callout>}
    </div>,
    /* 6 */ <div key="6" className="space-y-4">
      <Callout tone={Object.keys(faltas).length ? 'warning' : 'success'} icon={Object.keys(faltas).length ? 'AlertTriangle' : 'CircleCheck'}>
        {Object.keys(faltas).length ? <><b>Faltam informações para solicitar a aprovação:</b><ul className="list-disc ml-5 mt-1">{Object.entries(faltas).map(([k, m]) => <li key={k}><button type="button" className="underline" onClick={() => setPasso(PASSO_DO_CAMPO[k] ?? 0)}>{m}</button></li>)}</ul></> : 'Tudo certo para solicitar a aprovação.'}
      </Callout>
      {Object.keys(faltasPublicar).filter((k) => !(k in faltas)).length > 0 && (
        <Callout tone="neutral" icon="Info"><b>Para publicar depois de aprovada</b> ainda será preciso preencher: {Object.values(faltasPublicar).filter((m) => !Object.values(faltas).includes(m)).join('; ')}.</Callout>
      )}
      <Card>
        <CardHead title="Anexos" sub="PDF, DOCX, ODT, PNG ou JPG · até 3 MB cada · máx. 10" />
        <div className="p-5">
          {!id ? <p className="text-[13px] text-muted">Salve o rascunho para anexar arquivos.</p> : (
            <>
              <ul className="space-y-2 mb-3">
                {anexos.length === 0 && <li className="text-[13px] text-muted">Nenhum anexo.</li>}
                {anexos.map((a) => (
                  <li key={a.id} className="flex items-center justify-between gap-3 text-[13px]">
                    <a className="text-brand font-semibold hover:underline truncate" href={api.url(`vagas/${id}/anexos/${a.id}`)}>{a.nome}</a>
                    <span className="text-muted shrink-0">{Math.max(1, Math.round(a.tamanho / 1024))} KB {editavel && <button type="button" className="ml-2 text-danger font-semibold" onClick={() => removerAnexo(a.id)}>Remover</button>}</span>
                  </li>
                ))}
              </ul>
              {editavel && <label className="inline-flex"><span className="sr-only">Anexar arquivo</span><input type="file" accept=".pdf,.docx,.odt,.png,.jpg,.jpeg" className="text-[13px]" onChange={(e) => { void enviarAnexo(e.target.files?.[0]); e.target.value = '' }} /></label>}
            </>
          )}
        </div>
      </Card>
    </div>,
  ]

  const indicador = estado === 'salvando' ? 'Salvando…' : estado === 'erro' ? 'Não foi possível salvar' : estado === 'sujo' ? 'Alterações ainda não salvas' : salvoEm ? `Salvo às ${salvoEm.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })}` : id ? 'Tudo salvo' : 'Rascunho novo'

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
      <Stepper etapas={PASSOS} atual={passo} onIr={setPasso} erros={passosComErro} />
      <Card className="p-5 sm:p-6">{passoConteudo[passo]}</Card>
      <div className="flex items-center justify-between gap-3 flex-wrap mt-5">
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon="ChevronLeft" disabled={passo === 0} onClick={() => setPasso(passo - 1)}>Voltar</Button>
          {passo < PASSOS.length - 1 && <Button variant="ghost" onClick={() => setPasso(passo + 1)}>Avançar</Button>}
          <span className="text-[12px] text-muted ml-2" role="status" aria-live="polite">{indicador}</span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="ghost" icon="Save" disabled={!editavel || estado === 'salvando'} onClick={() => void salvar(false)}>Salvar rascunho</Button>
          {passo === PASSOS.length - 1 && (status === 'rascunho' || status === 'ajustes') && editavel && (
            <Button icon="Send" disabled={enviando || Object.keys(faltas).length > 0} onClick={solicitar}>{status === 'ajustes' ? 'Reenviar para aprovação' : 'Solicitar aprovação'}</Button>
          )}
        </div>
      </div>
    </>
  )

  return (
    <>
      <PageHeader title={idRota ? 'Editar vaga' : gestao ? 'Nova vaga' : 'Solicitar vaga'} subtitle="Preencha por etapas. O rascunho é salvo automaticamente no servidor."
        eyebrow={id ? <BadgeStatus valor={status} /> : <Badge tone="brand">Recrutamento</Badge>}
        actions={<Link to={id ? `/recrutamento/vagas/${id}` : '/recrutamento/vagas'}><Button variant="ghost" icon="X">Fechar</Button></Link>} />
      <SoComBanco>
        {idRota ? <Aguardar r={detalhe}>{() => corpo}</Aguardar> : <Aguardar r={opcoes}>{() => corpo}</Aguardar>}
      </SoComBanco>
    </>
  )
}

/* ---------- perguntas de triagem ---------- */
function Triagem({ valor, onChange, desabilitado }: { valor: Form[]; onChange: (v: Form[]) => void; desabilitado: boolean }) {
  const atualizar = (i: number, p: Form) => onChange(valor.map((q, j) => (j === i ? { ...q, ...p } : q)))
  const mover = (i: number, d: number) => { const n = [...valor]; const j = i + d; if (j < 0 || j >= n.length) return;[n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  return (
    <div>
      <p className="text-[13px] text-muted mb-4">Perguntas que a pessoa candidata responde ao se inscrever. Use com moderação e somente para o que for necessário ao processo.</p>
      {valor.length === 0 && <p className="text-[13px] text-muted mb-3">Nenhuma pergunta de triagem.</p>}
      <ul className="space-y-3">
        {valor.map((q, i) => (
          <li key={q.id ?? i} className="rounded-2xl border border-line p-4">
            <div className="grid grid-cols-1 md:grid-cols-[1fr_180px] gap-3">
              <Field label={`Pergunta ${i + 1}`} htmlFor={`q-${i}`}><input id={`q-${i}`} className="input" maxLength={300} value={q.texto ?? ''} disabled={desabilitado} onChange={(e) => atualizar(i, { texto: e.target.value })} /></Field>
              <Field label="Tipo de resposta" htmlFor={`qt-${i}`}>
                <Dropdown id={`qt-${i}`} className="input" value={q.tipo ?? 'texto'} disabled={desabilitado} onChange={(e) => atualizar(i, { tipo: e.target.value })}>
                  <option value="texto">Texto livre</option><option value="sim_nao">Sim ou não</option><option value="opcoes">Múltipla escolha</option>
                </Dropdown>
              </Field>
            </div>
            {q.tipo === 'opcoes' && <Field label="Opções" htmlFor={`qo-${i}`}><TagInput label="Opções da pergunta" valor={q.opcoes ?? []} onChange={(o) => atualizar(i, { opcoes: o })} placeholder="Digite uma opção e pressione Enter" /></Field>}
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div className="flex gap-5 flex-wrap">
                <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!q.obrigatoria} disabled={desabilitado} onChange={(e) => atualizar(i, { obrigatoria: e.target.checked })} />Obrigatória</label>
                <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={!!q.eliminatoria} disabled={desabilitado} onChange={(e) => atualizar(i, { eliminatoria: e.target.checked })} />Sinalizar resposta para análise humana</label>
              </div>
              <div className="flex gap-1.5">
                <Button size="icon-sm" variant="ghost" icon="ChevronUp" aria-label="Mover para cima" disabled={desabilitado || i === 0} onClick={() => mover(i, -1)} />
                <Button size="icon-sm" variant="ghost" icon="ChevronDown" aria-label="Mover para baixo" disabled={desabilitado || i === valor.length - 1} onClick={() => mover(i, 1)} />
                <Button size="icon-sm" variant="danger" icon="Trash2" aria-label={`Remover pergunta ${i + 1}`} disabled={desabilitado} onClick={() => onChange(valor.filter((_, j) => j !== i))} />
              </div>
            </div>
          </li>
        ))}
      </ul>
      <Button className="mt-4" variant="ghost" icon="Plus" disabled={desabilitado || valor.length >= 20} onClick={() => onChange([...valor, { texto: '', tipo: 'texto', obrigatoria: false, eliminatoria: false }])}>Adicionar pergunta</Button>
    </div>
  )
}
