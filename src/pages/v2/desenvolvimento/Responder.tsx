/* Responder um formulário do ciclo de desenvolvimento, em etapas: orientação → critérios por dimensão → perguntas → revisão. */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, Field, PageHeader } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Stepper } from '@/components/v2/Stepper'
import { EscalaNiveis, QUEM_VE, ResumoRespostas } from '@/components/v2/desenvolvimento/comuns'
import { api, ErroApi, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { dataBR } from '@/lib/fmt'
import { errosDeEnvio, type NivelEscala, type Nota, type Respostas, type RetratoModelo, type TipoFormulario } from '@/domain/v2/desenvolvimento'

interface FormResp {
  id: string; tipo: TipoFormulario; rotulo: string; status: string; prazo: string; atrasado: boolean; editavel: boolean; motivo: string | null
  confidencial: boolean; avisoConfidencialidade: string | null
  ciclo: { id: string; tipo: string; rotulo: string; dataPrevista: string }
  sobre: { id: string; nome: string; voce: boolean }
  modelo: RetratoModelo; escala: NivelEscala[]; naRotulo: string; naDescricao: string; justificativaObrigatoria: number[]
  respostas: Respostas; enviadoEm: string | null
}

export default function ResponderDesenvolvimento() {
  const { id = '' } = useParams()
  const r = useApi<FormResp>(`desenvolvimento/formularios/${id}`)
  return (
    <SoComBanco>
      <Aguardar r={r} linhas={4}>{(f) => <Formulario key={f.id + f.status} f={f} />}</Aguardar>
    </SoComBanco>
  )
}

function Formulario({ f }: { f: FormResp }) {
  const nav = useNavigate()
  const [resp, setResp] = useState<Respostas>(f.respostas)
  const [passo, setPasso] = useState(0)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [confirmar, setConfirmar] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const sujo = useRef(false)

  const dimensoes = useMemo(() => [...new Set(f.modelo.criterios.map((k) => k.dimensao))], [f.modelo])
  const etapas = ['Antes de começar', ...dimensoes, ...(f.modelo.perguntas.length ? ['Perguntas abertas'] : []), 'Revisão e envio']
  const ultimo = etapas.length - 1
  const titulo = f.sobre.voce ? f.modelo.titulo : `${f.modelo.titulo} · ${f.sobre.nome}`

  // Rascunho salvo ao trocar de etapa e a cada 20 s com alterações (nada se perde se a pessoa sair no meio).
  async function salvar(silencioso = true) {
    if (!f.editavel || !sujo.current) return true
    setSalvando(true)
    try { await api.put(`desenvolvimento/formularios/${f.id}`, { respostas: resp }); sujo.current = false; if (!silencioso) toast('Rascunho salvo.'); return true }
    catch (e) { toast(e instanceof ErroApi ? e.message : 'Não foi possível salvar o rascunho.', 'danger'); return false }
    finally { setSalvando(false) }
  }
  useEffect(() => { const t = setInterval(() => void salvar(), 20_000); return () => clearInterval(t) }) // eslint-disable-line react-hooks/exhaustive-deps

  const mudar = (fn: (r: Respostas) => Respostas) => { sujo.current = true; setResp((r) => fn(r)) }
  const ir = (i: number) => { void salvar(); setPasso(Math.max(0, Math.min(ultimo, i))); window.scrollTo({ top: 0, behavior: 'smooth' }) }

  const locais = errosDeEnvio(resp, f.modelo, { justificativaObrigatoria: f.justificativaObrigatoria })
  const etapaDoItem = (itemId: string) => {
    const k = f.modelo.criterios.find((x) => x.id === itemId)
    return k ? 1 + dimensoes.indexOf(k.dimensao) : dimensoes.length + 1
  }
  const etapasComErro = [...new Set(Object.keys(erros).map(etapaDoItem))]

  async function enviar() {
    setConfirmar(false)
    if (Object.keys(locais).length) { setErros(locais); ir(etapaDoItem(Object.keys(locais)[0])); toast('Revise os itens indicados antes de enviar.', 'danger'); return }
    try {
      await api.post(`desenvolvimento/formularios/${f.id}/enviar`, { respostas: resp })
      toast(f.confidencial ? 'Obrigado! Seu feedback foi registrado.' : 'Respostas enviadas. Obrigado!')
      sujo.current = false
      nav('/desenvolvimento')
    } catch (e) {
      if (e instanceof ErroApi && e.campos) { setErros(e.campos); ir(etapaDoItem(Object.keys(e.campos)[0])) }
      toast(e instanceof ErroApi ? e.message : 'Não foi possível enviar.', 'danger')
    }
  }

  if (!f.editavel) {
    return (
      <>
        <PageHeader title={titulo} subtitle={f.ciclo.rotulo} eyebrow={<Badge tone={f.status === 'enviado' ? 'success' : 'neutral'} dot>{f.status === 'enviado' ? 'Enviado' : f.status === 'dispensado' ? 'Dispensado' : f.status === 'expirado' ? 'Prazo encerrado' : 'Indisponível'}</Badge>}
          actions={<Button variant="ghost" icon="ArrowLeft" onClick={() => nav('/desenvolvimento')}>Meu desenvolvimento</Button>} />
        {f.status === 'enviado' && !f.confidencial && (
          <Card><CardHead title="Suas respostas" sub={f.enviadoEm ? `Enviadas em ${dataBR(f.enviadoEm)}. Respostas enviadas não podem ser alteradas.` : undefined} />
            <div className="p-5"><ResumoRespostas modelo={f.modelo} respostas={f.respostas} escala={f.escala} naRotulo={f.naRotulo} /></div></Card>
        )}
        {f.status === 'enviado' && f.confidencial && <Callout tone="success" icon="ShieldCheck">Seu feedback foi registrado. Para proteger a confidencialidade, o conteúdo não fica ligado ao seu nome e não pode ser reaberto.</Callout>}
        {f.status !== 'enviado' && <Callout tone="neutral" icon="Info">{f.motivo ? `Este formulário não aceita mais respostas: ${f.motivo}.` : 'Este formulário não aceita mais respostas.'} Não responder não é tratado como avaliação negativa.</Callout>}
      </>
    )
  }

  const dimAtual = passo >= 1 && passo <= dimensoes.length ? dimensoes[passo - 1] : null
  return (
    <>
      <PageHeader title={titulo} subtitle={`${f.ciclo.rotulo} · responda até ${dataBR(f.prazo)}`}
        eyebrow={<span className="inline-flex gap-1.5">{f.confidencial && <Badge tone="gold" dot>Confidencial</Badge>}{f.atrasado ? <Badge tone="danger" dot>Prazo vencido — ainda dá para responder</Badge> : <Badge tone="brand" dot>{f.status === 'rascunho' ? 'Rascunho salvo' : 'Aguardando sua resposta'}</Badge>}</span>}
        actions={<><Button variant="ghost" icon="Save" disabled={salvando} onClick={() => { sujo.current = true; void salvar(false) }}>Salvar rascunho</Button><Button variant="ghost" icon="ArrowLeft" onClick={async () => { await salvar(); nav('/desenvolvimento') }}>Sair</Button></>} />
      <Stepper etapas={etapas} atual={passo} onIr={ir} erros={etapasComErro} />

      {passo === 0 && (
        <div className="space-y-4 max-w-3xl">
          <Card className="p-5 sm:p-6">
            <p className="text-[14px] text-ink leading-relaxed">{f.modelo.descricao}</p>
            <div className="mt-4">
              {f.confidencial
                ? <Callout tone="brand" icon="ShieldCheck"><b>Como suas respostas são usadas.</b> {f.avisoConfidencialidade}</Callout>
                : <Callout tone="neutral" icon="Eye"><b>Quem vê.</b> {QUEM_VE[f.tipo]}</Callout>}
            </div>
            <p className="text-[12.5px] text-muted mt-4">O resultado é um apoio para a conversa de desenvolvimento. Nenhuma nota gera, sozinha, decisão sobre contrato, remuneração ou desligamento.</p>
          </Card>
          <Card>
            <CardHead title="O que cada nível significa" sub={f.modelo.escala === 'percepcao' ? 'Escala de percepção do momento — não é classificação de desempenho.' : f.justificativaObrigatoria.length ? `Nos níveis ${f.justificativaObrigatoria.join(', ')}, descreva um exemplo ou evidência.` : undefined} />
            <ul className="divide-y divide-line">
              {f.escala.map((n) => <li key={n.valor} className="px-5 py-2.5 flex gap-3"><span className="h-6 w-6 shrink-0 rounded-lg bg-brand-100 text-brand text-[12px] font-bold flex items-center justify-center">{n.valor}</span><div><div className="text-[13px] font-semibold text-ink">{n.rotulo}</div><div className="text-[12.5px] text-muted">{n.descricao}</div></div></li>)}
              <li className="px-5 py-2.5 flex gap-3"><span className="h-6 px-1.5 shrink-0 rounded-lg bg-winter text-ink text-[11px] font-bold flex items-center justify-center">N/A</span><div><div className="text-[13px] font-semibold text-ink">{f.naRotulo}</div><div className="text-[12.5px] text-muted">{f.naDescricao}</div></div></li>
            </ul>
          </Card>
        </div>
      )}

      {dimAtual && (
        <div className="space-y-4 max-w-4xl">
          {f.modelo.criterios.filter((k) => k.dimensao === dimAtual).map((k) => {
            const nota = resp.notas[k.id]
            const exige = f.modelo.escala === 'avd' && typeof nota === 'number' && f.justificativaObrigatoria.includes(nota)
            return (
              <Card key={k.id} className="p-5">
                <div className="flex items-start justify-between gap-3 mb-3">
                  <div>
                    <h3 className="text-[14.5px] font-bold text-ink">{k.nome}</h3>
                    {k.descricao && <p className="text-[12.5px] text-muted mt-0.5">{k.descricao}</p>}
                  </div>
                </div>
                <EscalaNiveis nome={k.nome} escala={f.escala} naRotulo={f.naRotulo} valor={nota} onChange={(v: Nota) => { mudar((r) => ({ ...r, notas: { ...r.notas, [k.id]: v } })); setErros((e) => { const { [k.id]: _x, ...rest } = e; return rest }) }} />
                {(exige || resp.justificativas[k.id] || f.modelo.escala === 'avd') && nota !== undefined && nota !== 'na' && (
                  <Field label={exige ? 'Exemplo ou evidência (obrigatório neste nível)' : 'Exemplo ou evidência (opcional)'} htmlFor={`j-${k.id}`} erro={erros[k.id]} className="mt-3 mb-0">
                    <textarea id={`j-${k.id}`} rows={2} className="input" placeholder="Descreva uma situação concreta que sustenta o nível escolhido." value={resp.justificativas[k.id] ?? ''}
                      onChange={(e) => mudar((r) => ({ ...r, justificativas: { ...r.justificativas, [k.id]: e.target.value } }))} />
                  </Field>
                )}
                {erros[k.id] && nota === undefined && <p className="text-[12px] text-danger mt-2" role="alert">{erros[k.id]}</p>}
              </Card>
            )
          })}
        </div>
      )}

      {passo === dimensoes.length + 1 && f.modelo.perguntas.length > 0 && passo < ultimo && (
        <Card className="p-5 sm:p-6 max-w-3xl space-y-1">
          {f.modelo.perguntas.map((p) => (
            <Field key={p.id} label={p.texto} required={p.obrigatoria} hint={p.ajuda} htmlFor={`p-${p.id}`} erro={erros[p.id]}>
              <textarea id={`p-${p.id}`} rows={3} className="input" value={resp.abertas[p.id] ?? ''} onChange={(e) => { mudar((r) => ({ ...r, abertas: { ...r.abertas, [p.id]: e.target.value } })); setErros((x) => { const { [p.id]: _y, ...rest } = x; return rest }) }} />
            </Field>
          ))}
          {f.confidencial && <p className="text-[12px] text-muted">Evite detalhes que identifiquem você ou outras pessoas. Foque em comportamentos e no que ajudaria a liderança a evoluir.</p>}
        </Card>
      )}

      {passo === ultimo && (
        <div className="space-y-4 max-w-3xl">
          {Object.keys(locais).length > 0
            ? <Callout tone="warning" icon="AlertTriangle">Faltam {Object.keys(locais).length} item(ns) para enviar. Use as etapas acima para completar — elas ficam marcadas quando há pendência.</Callout>
            : <Callout tone="success" icon="CheckCircle2">Tudo preenchido. Revise e envie quando estiver pronta(o). Depois do envio, as respostas não podem ser alteradas.</Callout>}
          <Card><CardHead title="Revisão" sub={f.confidencial ? 'Seu feedback não ficará ligado ao seu nome.' : undefined} /><div className="p-5"><ResumoRespostas modelo={f.modelo} respostas={resp} escala={f.escala} naRotulo={f.naRotulo} /></div></Card>
        </div>
      )}

      <div className="flex justify-between gap-3 mt-6 max-w-4xl">
        <Button variant="ghost" icon="ArrowLeft" disabled={passo === 0} onClick={() => ir(passo - 1)}>Anterior</Button>
        {passo < ultimo
          ? <Button icon="ArrowRight" onClick={() => ir(passo + 1)}>Continuar</Button>
          : <Button icon="Send" onClick={() => { if (Object.keys(locais).length) { setErros(locais); ir(etapaDoItem(Object.keys(locais)[0])); return } setConfirmar(true) }}>Enviar respostas</Button>}
      </div>
      <p className="text-[12px] text-muted mt-4"><Link to="/desenvolvimento" className="underline">Voltar para meu desenvolvimento</Link> — o rascunho fica salvo.</p>
      <ConfirmModal open={confirmar} onClose={() => setConfirmar(false)} onConfirm={enviar} titulo="Enviar respostas?" perigo={false}
        texto={f.confidencial ? 'Depois do envio, o conteúdo não fica ligado ao seu nome e não pode ser reaberto nem alterado.' : 'Depois do envio, as respostas não podem ser alteradas — nem por você, nem pela liderança, nem pelo RH.'}
        confirmar="Enviar" />
    </>
  )
}
