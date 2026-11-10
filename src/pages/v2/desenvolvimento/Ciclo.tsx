/* Um ciclo (acompanhamento 30/60/90 ou AVD): etapas, formulários, devolutiva, PDI e ações. O servidor decide o que cada papel recebe. */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, Field, Icon, PageHeader, Toggle } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Drawer } from '@/components/v2/Drawer'
import { Aguardar, CarregandoBloco, SoComBanco } from '@/components/v2/estados'
import { BarraMedia, ListaAcoes, ResumoRespostas, StatusCiclo, type Acao } from '@/components/v2/desenvolvimento/comuns'
import { api, executar, useApi } from '@/data/v2/api'
import { dataBR, dataHoraBR } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import { useStore } from '@/lib/store'
import { RESPONSAVEL_ACAO, compararAvaliacoes, type Agregado, type Etapa, type NivelEscala, type Respostas, type RetratoModelo, type StatusExibido, type TipoCiclo } from '@/domain/v2/desenvolvimento'

interface FormInfo { id: string; tipo: string; rotulo: string; status: string; prazo: string; enviadoEm: string | null; motivo: string | null; respondenteId: string | null; respondenteNome: string | null; meu: boolean; nota: number | null; retrato: RetratoModelo | null; respostas: Respostas | null }
interface Detalhe {
  ciclo: {
    id: string; colaboradorId: string; colaboradorNome: string; setorNome: string | null; cargoNome: string | null; avaliadorId: string | null; avaliadorNome: string | null
    tipo: TipoCiclo; numero: number; rotulo: string; dataPrevista: string; prazo: string; etapa: Etapa; status: StatusExibido; atrasado: boolean; lideranca: boolean
    dataBase: string; motivo: string | null; avaliadorManual: boolean; etapaAntesSuspensao: Etapa | null
  }
  papel: { rh: boolean; confidencial: boolean; avaliado: boolean; lider: boolean }
  formularios: FormInfo[]
  feedbackEquipe: null | { convidados: number; respostas: number; minimo: number; pendentes: number; suprimido: boolean; sinteseLiberada: boolean; agregado?: Agregado; sintese?: string; sinteseRascunho?: string }
  devolutiva: null | { realizadaEm: string | null; rhAcompanhou: boolean; pontosFortes: string | null; aDesenvolver: string | null; dificuldades: string | null; orientacoes: string | null; feedback: string | null; percepcaoColaborador: string | null; percepcaoEm: string | null; registradaPor: string | null; registradaEm: string | null }
  pdi: null | { metas: string | null; treinamentos: string | null; indicadores: string | null; revisaoEm: string | null; registradoPor: string | null; registradoEm: string | null; revisoes: { em: string; por: string | null; texto: string }[] }
  acoes: Acao[]
  acoesAnteriores: (Acao & { rotulo: string })[]
  eventos: { em: string; quem: string; acao: string; detalhes: Record<string, unknown> }[]
  permissoes: Record<'devolutiva' | 'pdi' | 'acoes' | 'percepcao' | 'atualizarAcoes' | 'consolidar' | 'sintese' | 'encerrar' | 'reabrir' | 'cancelar' | 'suspender' | 'retomar' | 'designar' | 'dispensar' | 'revisarPdi', boolean>
  escala: NivelEscala[]; escalaPercepcao: NivelEscala[]; naRotulo: string
}

const ACAO_EVENTO: Record<string, string> = {
  ciclo_aberto: 'Ciclo aberto automaticamente', formulario_enviado: 'Formulário enviado', feedback_equipe_enviado: 'Feedback da equipe recebido', coleta_concluida: 'Formulários concluídos',
  devolutiva_salva: 'Devolutiva salva (rascunho)', devolutiva_registrada: 'Devolutiva registrada', percepcao_registrada: 'Percepção da pessoa registrada', pdi_salvo: 'PDI salvo (rascunho)',
  pdi_registrado: 'PDI registrado', acao_incluida: 'Ação incluída', acao_atualizada: 'Ação atualizada', ciclo_encerrado: 'Ciclo encerrado pelo RH', ciclo_reaberto: 'Ciclo reaberto',
  ciclo_cancelado: 'Ciclo cancelado', ciclo_cancelado_automaticamente: 'Ciclo cancelado automaticamente', ciclo_suspenso: 'Ciclo suspenso', ciclo_retomado: 'Ciclo retomado',
  avaliador_designado: 'Liderança designada pelo RH', lideranca_atualizada: 'Liderança atualizada (troca no cadastro)', formulario_dispensado: 'Formulário dispensado',
  ciclo_suspenso_afastamento: 'Ciclo suspenso automaticamente (afastamento)', ciclo_retomado_afastamento: 'Ciclo retomado automaticamente (retorno do afastamento)', pdi_revisado: 'Revisão do PDI registrada',
  consolidacao_concluida: 'Consolidação concluída', sintese_salva: 'Síntese salva', sintese_liberada: 'Síntese liberada à liderança', feedback_equipe_visualizado: 'Feedback confidencial consultado', data_base_corrigida: 'Data de admissão corrigida',
}

export default function CicloDesenvolvimento() {
  const { id = '' } = useParams()
  const r = useApi<Detalhe>(`desenvolvimento/ciclos/${id}`)
  return <SoComBanco><Aguardar r={r} linhas={5}>{(d) => <Tela d={d} recarregar={r.recarregar} />}</Aguardar></SoComBanco>
}

function Etapas({ c }: { c: Detalhe['ciclo'] }) {
  const lista: { k: Etapa; rotulo: string }[] = c.tipo === 'acompanhamento'
    ? [{ k: 'coleta', rotulo: 'Percepções' }, { k: 'devolutiva', rotulo: 'Registro do acompanhamento' }, { k: 'concluida', rotulo: 'Concluído' }]
    : [{ k: 'coleta', rotulo: 'Formulários' }, ...(c.lideranca ? [{ k: 'consolidacao' as Etapa, rotulo: 'Consolidação' }] : []), { k: 'devolutiva', rotulo: 'Devolutiva' }, { k: 'pdi', rotulo: 'PDI' }, { k: 'encerramento', rotulo: 'Encerramento' }, { k: 'concluida', rotulo: 'Concluída' }]
  const etapa = c.etapa === 'suspensa' ? c.etapaAntesSuspensao ?? 'coleta' : c.etapa
  const atual = etapa === 'cancelada' ? -1 : lista.findIndex((x) => x.k === etapa)
  return (
    <ol className="flex gap-1.5 overflow-x-auto pb-1 mb-6" aria-label="Etapas do ciclo">
      {lista.map((e, i) => {
        const feito = i < atual || etapa === 'concluida', ativo = i === atual && etapa !== 'concluida'
        return (
          <li key={e.k} aria-current={ativo ? 'step' : undefined} className={cn('flex-1 min-w-[120px] flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold',
            ativo ? 'border-brand bg-brand-50 text-brand-700' : feito ? 'border-line bg-surface text-ink-2' : 'border-line bg-surface-2 text-muted')}>
            <span className={cn('h-5 w-5 rounded-full flex items-center justify-center text-[10.5px] shrink-0', ativo ? 'bg-brand text-white' : feito ? 'bg-success text-white' : 'bg-winter text-muted')}>{feito ? <Icon name="Check" className="h-3 w-3" /> : i + 1}</span>
            <span className="truncate">{e.rotulo}</span>
          </li>
        )
      })}
    </ol>
  )
}

function Tela({ d, recarregar }: { d: Detalhe; recarregar: () => void }) {
  const nav = useNavigate()
  const c = d.ciclo
  const acomp = c.tipo === 'acompanhamento'
  const [aberto, setAberto] = useState<string | null>(null)
  const [dialogo, setDialogo] = useState<null | 'cancelar' | 'suspender' | 'reabrir' | 'retomar' | 'designar' | { dispensar: string }>(null)
  const [confidencial, setConfidencial] = useState(false)
  const hoje = new Date().toISOString().slice(0, 10)
  const escalaDe = (f: FormInfo) => (f.retrato?.escala === 'percepcao' ? d.escalaPercepcao : d.escala)

  const acaoRH = (rota: string, corpo: unknown, msg: string) => executar(() => api.post(`desenvolvimento/ciclos/${c.id}/${rota}`, corpo), msg).then((ok) => { if (ok) { setDialogo(null); recarregar() } })

  return (
    <>
      <PageHeader title={`${c.rotulo} · ${c.colaboradorNome}`}
        subtitle={[c.cargoNome, c.setorNome].filter(Boolean).join(' · ') || undefined}
        eyebrow={<StatusCiclo status={c.status} atrasado={c.atrasado} />}
        actions={<>
          <Button variant="ghost" icon="ArrowLeft" onClick={() => nav(-1)}>Voltar</Button>
          <Button variant="ghost" icon="Route" onClick={() => nav(`/desenvolvimento/pessoas/${c.colaboradorId}`)}>Jornada</Button>
          {d.permissoes.encerrar && <Button icon="CheckCheck" onClick={() => acaoRH('encerrar', {}, 'Ciclo encerrado.')}>Encerrar ciclo</Button>}
        </>} />
      <Etapas c={c} />

      {c.etapa === 'suspensa' && <Callout tone="warning" icon="PauseCircle" className="mb-5">Ciclo suspenso: {c.motivo}. Os prazos não correm enquanto estiver suspenso.{c.motivo && !d.papel.avaliado && ' Se for um afastamento registrado, o ciclo volta sozinho no retorno, com os prazos estendidos.'}</Callout>}
      {c.etapa === 'cancelada' && <Callout tone="neutral" icon="Ban" className="mb-5">Ciclo cancelado: {c.motivo}. As respostas já enviadas ficam no histórico.</Callout>}
      {c.status === 'sem_lideranca' && <Callout tone="warning" icon="UserX" className="mb-5">Sem liderança definida no cadastro. {d.papel.rh ? 'Designe quem conduz este ciclo.' : 'O RH vai designar quem conduz.'}</Callout>}

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-2 space-y-6">
          {/* Formulários */}
          <Card>
            <CardHead title={acomp ? 'Percepções' : 'Formulários'} sub={`Prazo da etapa: ${dataBR(c.prazo)}`} />
            <ul className="divide-y divide-line">
              {d.formularios.map((f) => (
                <li key={f.id} className="px-5 py-3.5">
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-ink">{f.rotulo}{f.respondenteNome && <span className="text-muted font-normal"> · {f.meu ? 'você' : f.respondenteNome}</span>}</div>
                      <div className="text-[12px] text-muted">{f.status === 'enviado' ? `Enviado${f.enviadoEm ? ` em ${dataBR(f.enviadoEm)}` : ''}` : f.motivo ? f.motivo : `Prazo ${dataBR(f.prazo)}`}{f.nota !== null && f.retrato?.escala !== 'percepcao' && <> · média {String(f.nota).replace('.', ',')} (apoio)</>}</div>
                    </div>
                    <Badge tone={f.status === 'enviado' ? 'success' : f.status === 'dispensado' || f.status === 'expirado' ? 'neutral' : 'brand'} dot>
                      {{ enviado: 'Enviado', dispensado: 'Não respondido (dispensado)', expirado: 'Não respondido (prazo)', rascunho: 'Rascunho', pendente: 'Pendente' }[f.status] ?? f.status}
                    </Badge>
                    {f.meu && (f.status === 'pendente' || f.status === 'rascunho') && c.etapa === 'coleta' && <Button size="sm" icon="PenLine" onClick={() => nav(`/desenvolvimento/responder/${f.id}`)}>Responder</Button>}
                    {f.respostas && f.retrato && <Button size="sm" variant="ghost" icon={aberto === f.id ? 'ChevronUp' : 'ChevronDown'} onClick={() => setAberto(aberto === f.id ? null : f.id)}>{aberto === f.id ? 'Ocultar' : 'Ver respostas'}</Button>}
                    {d.permissoes.dispensar && (f.status === 'pendente' || f.status === 'rascunho') && <Button size="sm" variant="subtle" onClick={() => setDialogo({ dispensar: f.id })}>Dispensar</Button>}
                  </div>
                  {aberto === f.id && f.respostas && f.retrato && <div className="mt-3"><ResumoRespostas modelo={f.retrato} respostas={f.respostas} escala={escalaDe(f)} naRotulo={d.naRotulo} /></div>}
                </li>
              ))}
              {d.formularios.length === 0 && <li className="px-5 py-4 text-[13px] text-muted">Nenhum formulário visível para você neste ciclo.</li>}
            </ul>
            {!d.papel.rh && d.papel.lider && c.etapa === 'coleta' && <p className="px-5 pb-4 text-[12px] text-muted">A autoavaliação fica visível para você depois que você enviar a sua avaliação.</p>}
          </Card>

          {/* Feedback da equipe sobre a liderança */}
          {d.feedbackEquipe && (
            <Card>
              <CardHead title="Feedback da equipe sobre a liderança" sub={`${d.feedbackEquipe.respostas} de ${d.feedbackEquipe.convidados} responderam · mínimo de ${d.feedbackEquipe.minimo} para exibir resultados`}
                action={d.permissoes.sintese ? <Button size="sm" variant="soft" icon="ShieldCheck" onClick={() => setConfidencial(true)}>Abrir (confidencial)</Button> : undefined} />
              <div className="p-5 space-y-3">
                {d.feedbackEquipe.agregado ? (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-6">{d.feedbackEquipe.agregado.porCriterio.map((k) => <BarraMedia key={k.id} rotulo={k.nome} media={k.media} />)}</div>
                    {d.feedbackEquipe.sintese && <Callout tone="brand" icon="MessageSquareQuote"><b>Síntese do RH.</b> <span className="whitespace-pre-line">{d.feedbackEquipe.sintese}</span></Callout>}
                    <p className="text-[12px] text-muted">Médias de {d.feedbackEquipe.respostas} respostas (1 a 5). Respostas individuais não são exibidas.</p>
                  </>
                ) : d.feedbackEquipe.suprimido && c.etapa !== 'coleta'
                  ? <p className="text-[13px] text-muted">Menos de {d.feedbackEquipe.minimo} respostas: para proteger quem respondeu, os resultados não são exibidos neste ciclo.</p>
                  : <p className="text-[13px] text-muted">{d.feedbackEquipe.sinteseLiberada ? 'Resultados liberados.' : 'Os resultados são consolidados pelo RH e liberados como médias e uma síntese, sem respostas individuais.'}</p>}
                {d.permissoes.consolidar && <div className="pt-1"><Button icon="ArrowRight" onClick={() => acaoRH('consolidar', {}, 'Consolidação concluída. A devolutiva foi liberada.')}>Concluir consolidação</Button></div>}
              </div>
            </Card>
          )}

          {!acomp && <Comparacao d={d} />}
          <Devolutiva d={d} recarregar={recarregar} />
          {!acomp && (d.pdi || d.permissoes.pdi) && <Pdi d={d} recarregar={recarregar} />}

          {/* Ações */}
          {(d.acoes.length > 0 || d.permissoes.acoes) && (
            <Card>
              <CardHead title={acomp ? 'Ações combinadas' : 'Ações do PDI'} sub="Responsável, prazo e andamento." />
              <div className="px-5 pb-2">
                <ListaAcoes acoes={d.acoes} hoje={hoje} onAtualizado={recarregar} podeCancelar={d.papel.rh || d.papel.lider}
                  podeAtualizar={(a) => d.papel.rh || d.papel.lider || (d.papel.avaliado && (a.responsavel === 'colaborador' || a.responsavel === 'ambos'))} />
              </div>
              {d.permissoes.acoes && <NovaAcao cicloId={c.id} onCriada={recarregar} />}
            </Card>
          )}
        </div>

        <div className="space-y-6">
          <Card className="p-5">
            <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[13px]">
              <div><dt className="text-muted text-[12px]">Data prevista</dt><dd className="font-semibold">{dataBR(c.dataPrevista)}</dd></div>
              <div><dt className="text-muted text-[12px]">Prazo da etapa</dt><dd className={cn('font-semibold', c.atrasado && 'text-danger')}>{dataBR(c.prazo)}</dd></div>
              <div><dt className="text-muted text-[12px]">Início da parceria</dt><dd className="font-semibold">{dataBR(c.dataBase)}</dd></div>
              <div><dt className="text-muted text-[12px]">Conduz</dt><dd className="font-semibold">{c.avaliadorNome ?? '—'}{c.avaliadorManual && <span className="text-muted font-normal"> (designado)</span>}</dd></div>
              <div className="col-span-2"><dt className="text-muted text-[12px]">Critérios</dt><dd className="font-semibold">{acomp ? 'Acompanhamento inicial (percepção)' : c.lideranca ? 'Liderança' : 'Membros'}</dd></div>
            </dl>
            {d.papel.rh && (
              <div className="mt-5 pt-4 border-t border-line flex flex-wrap gap-2">
                {d.permissoes.designar && <Button size="sm" variant="ghost" icon="UserCog" onClick={() => setDialogo('designar')}>Designar quem conduz</Button>}
                {d.permissoes.suspender && <Button size="sm" variant="ghost" icon="PauseCircle" onClick={() => setDialogo('suspender')}>Suspender</Button>}
                {d.permissoes.retomar && <Button size="sm" variant="ghost" icon="PlayCircle" onClick={() => setDialogo('retomar')}>Retomar</Button>}
                {d.permissoes.reabrir && <Button size="sm" variant="ghost" icon="RotateCcw" onClick={() => setDialogo('reabrir')}>Reabrir</Button>}
                {d.permissoes.cancelar && <Button size="sm" variant="danger" icon="Ban" onClick={() => setDialogo('cancelar')}>Cancelar</Button>}
              </div>
            )}
          </Card>

          {d.acoesAnteriores.length > 0 && (
            <Card>
              <CardHead title="Combinados anteriores" sub="O que foi planejado nos ciclos anteriores e como ficou." />
              <ul className="divide-y divide-line">
                {d.acoesAnteriores.map((a) => (
                  <li key={a.id} className="px-5 py-2.5">
                    <div className="text-[13px] font-medium text-ink">{a.descricao}</div>
                    <div className="text-[11.5px] text-muted">{a.rotulo} · {RESPONSAVEL_ACAO[a.responsavel]}{a.prazo && ` · ${dataBR(a.prazo)}`}</div>
                    <Badge className="mt-1" tone={a.status === 'concluida' ? 'success' : a.status === 'cancelada' ? 'neutral' : a.prazo && a.prazo < hoje ? 'danger' : 'brand'}>{a.status === 'concluida' ? 'Concluída' : a.status === 'cancelada' ? 'Cancelada' : a.prazo && a.prazo < hoje ? 'Pendente (atrasada)' : 'Pendente'}</Badge>
                    {a.resultado && <p className="text-[12px] text-ink-2 mt-1">{a.resultado}</p>}
                  </li>
                ))}
              </ul>
            </Card>
          )}

          {d.papel.rh && d.eventos.length > 0 && (
            <Card>
              <CardHead title="Histórico do ciclo" sub="Quem fez o quê e quando." />
              <ul className="divide-y divide-line max-h-96 overflow-y-auto">
                {d.eventos.map((e, i) => <li key={i} className="px-5 py-2"><div className="text-[12.5px] text-ink">{ACAO_EVENTO[e.acao] ?? e.acao}</div><div className="text-[11.5px] text-muted">{dataHoraBR(e.em)} · {e.quem}</div></li>)}
              </ul>
            </Card>
          )}
        </div>
      </div>

      {confidencial && <FeedbackConfidencial cicloId={c.id} onClose={() => { setConfidencial(false); recarregar() }} />}
      <DialogoRH dialogo={dialogo} onClose={() => setDialogo(null)} colaboradorId={c.colaboradorId}
        onConfirmar={(tipo, valor) => {
          if (typeof tipo === 'object') return executar(() => api.post(`desenvolvimento/formularios/${tipo.dispensar}/dispensar`, { motivo: valor }), 'Formulário dispensado.').then((ok) => { if (ok) { setDialogo(null); recarregar() } })
          if (tipo === 'designar') return acaoRH('avaliador', { avaliadorId: valor }, 'Liderança designada.')
          if (tipo === 'retomar') return acaoRH('retomar', { prazo: valor }, 'Ciclo retomado.')
          return acaoRH(tipo, { motivo: valor }, tipo === 'cancelar' ? 'Ciclo cancelado.' : tipo === 'suspender' ? 'Ciclo suspenso.' : 'Ciclo reaberto.')
        }} />
      <p className="text-[12px] text-muted mt-6">As notas são indicadores de apoio para a conversa. Nenhum resultado gera, sozinho, decisão sobre contrato, remuneração, promoção ou desligamento. <Link to="/desenvolvimento" className="underline">Meu desenvolvimento</Link></p>
    </>
  )
}

function Devolutiva({ d, recarregar }: { d: Detalhe; recarregar: () => void }) {
  const c = d.ciclo
  const acomp = c.tipo === 'acompanhamento'
  const dev = d.devolutiva
  const [v, setV] = useState({
    realizadaEm: dev?.realizadaEm ?? '', rhAcompanhou: dev?.rhAcompanhou ?? false, pontosFortes: dev?.pontosFortes ?? '', aDesenvolver: dev?.aDesenvolver ?? '',
    dificuldades: dev?.dificuldades ?? '', orientacoes: dev?.orientacoes ?? '', feedback: dev?.feedback ?? '',
  })
  const [percepcao, setPercepcao] = useState(dev?.percepcaoColaborador ?? '')
  const registrada = !!dev?.registradaEm
  const podeEditar = d.permissoes.devolutiva
  if (!dev && !podeEditar) {
    if (c.etapa === 'coleta' || c.etapa === 'consolidacao') return null
    return <Card className="p-5"><p className="text-[13px] text-muted">{acomp ? 'O registro do acompanhamento ainda não foi feito.' : 'A devolutiva ainda não foi registrada.'}</p></Card>
  }
  const salvar = (concluir: boolean) => executar(() => api.put(`desenvolvimento/ciclos/${c.id}/devolutiva`, { ...v, realizadaEm: v.realizadaEm || null, concluir }),
    concluir ? (acomp ? 'Acompanhamento registrado e concluído.' : 'Devolutiva registrada. Próximo passo: o PDI.') : 'Rascunho salvo.').then((ok) => { if (ok) recarregar() })
  const campo = (k: keyof typeof v, rotulo: string, obrig = false, dica?: string) => (
    <Field label={rotulo} required={obrig} hint={dica} htmlFor={`dv-${k}`}>
      {podeEditar ? <textarea id={`dv-${k}`} rows={3} className="input" value={String(v[k] ?? '')} onChange={(e) => setV({ ...v, [k]: e.target.value })} />
        : <p className="text-[13px] text-ink-2 whitespace-pre-line">{String(v[k] || '—')}</p>}
    </Field>
  )
  return (
    <Card>
      <CardHead title={acomp ? 'Registro do acompanhamento' : 'Devolutiva'} sub={registrada ? `Registrada por ${dev?.registradaPor ?? '—'}${dev?.realizadaEm ? ` · conversa em ${dataBR(dev.realizadaEm)}` : ''}` : acomp ? 'Conversa de alinhamento entre liderança e colaborador(a).' : 'Conversa entre liderança e colaborador(a), com o RH quando necessário.'} />
      <div className="p-5">
        {podeEditar && !registrada && <Callout tone="neutral" icon="MessagesSquare" className="mb-4">Registre o que foi conversado. O objetivo é orientar e combinar próximos passos — não é um processo disciplinar.</Callout>}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Data da conversa" required htmlFor="dv-data">{podeEditar ? <input id="dv-data" type="date" className="input" value={v.realizadaEm} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setV({ ...v, realizadaEm: e.target.value })} /> : <p className="text-[13px]">{v.realizadaEm ? dataBR(v.realizadaEm) : '—'}</p>}</Field>
          {!acomp && <div className="flex items-end pb-4">{podeEditar ? <Toggle checked={v.rhAcompanhou} onChange={(x) => setV({ ...v, rhAcompanhou: x })} label="O RH acompanhou a conversa" /> : v.rhAcompanhou && <Badge>RH acompanhou</Badge>}</div>}
        </div>
        {acomp ? <>
          {campo('pontosFortes', 'Pontos positivos identificados', true)}
          {campo('dificuldades', 'Dificuldades identificadas')}
          {campo('orientacoes', 'Orientações fornecidas', true)}
        </> : <>
          {campo('pontosFortes', 'Principais pontos fortes', true)}
          {campo('aDesenvolver', 'Competências que precisam ser desenvolvidas', true)}
          {campo('feedback', 'Feedback da liderança', true, 'Com exemplos concretos. Lembre: o resultado numérico é apoio, não veredito.')}
        </>}
        {podeEditar && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" icon="Save" onClick={() => salvar(false)}>Salvar</Button>
            {c.etapa === 'devolutiva' && <Button icon="Check" onClick={() => salvar(true)}>{acomp ? 'Registrar e concluir acompanhamento' : 'Registrar devolutiva'}</Button>}
          </div>
        )}
        {acomp && podeEditar && <p className="text-[12px] text-muted mt-3">Inclua as ações combinadas (com responsável e prazo) no quadro “Ações combinadas” antes de concluir.</p>}

        {registrada && (
          <div className="mt-5 pt-4 border-t border-line">
            <h4 className="text-[13px] font-bold text-ink mb-1.5">{d.papel.avaliado ? 'Sua percepção' : `Percepção de ${c.colaboradorNome}`} sobre {acomp ? 'o acompanhamento' : 'o resultado'}</h4>
            {d.permissoes.percepcao ? (
              <>
                <textarea rows={3} className="input" aria-label="Sua percepção sobre o resultado" placeholder={acomp ? 'Como foi a conversa? Quer acrescentar algo ao que foi combinado?' : 'Como você recebeu a devolutiva? Concorda, discorda, quer acrescentar algo?'} value={percepcao} onChange={(e) => setPercepcao(e.target.value)} />
                <Button className="mt-2" size="sm" icon="Send" onClick={() => executar(() => api.put(`desenvolvimento/ciclos/${c.id}/percepcao`, { texto: percepcao }), 'Percepção registrada.').then((ok) => { if (ok) recarregar() })}>Salvar minha percepção</Button>
              </>
            ) : <p className="text-[13px] text-ink-2 whitespace-pre-line">{dev?.percepcaoColaborador || <span className="text-muted">Ainda não registrada.</span>}</p>}
          </div>
        )}
      </div>
    </Card>
  )
}

function Pdi({ d, recarregar }: { d: Detalhe; recarregar: () => void }) {
  const c = d.ciclo
  const p = d.pdi
  const [v, setV] = useState({ metas: p?.metas ?? '', treinamentos: p?.treinamentos ?? '', indicadores: p?.indicadores ?? '', revisaoEm: p?.revisaoEm ?? '' })
  const edita = d.permissoes.pdi
  const salvar = (registrar: boolean) => executar(() => api.put(`desenvolvimento/ciclos/${c.id}/pdi`, { ...v, revisaoEm: v.revisaoEm || null, registrar }), registrar ? 'PDI registrado. O RH vai encerrar o ciclo.' : 'PDI salvo.').then((ok) => { if (ok) recarregar() })
  const campo = (k: 'metas' | 'treinamentos' | 'indicadores', rotulo: string, obrig = false) => (
    <Field label={rotulo} required={obrig} htmlFor={`pdi-${k}`}>
      {edita ? <textarea id={`pdi-${k}`} rows={3} className="input" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} /> : <p className="text-[13px] text-ink-2 whitespace-pre-line">{v[k] || '—'}</p>}
    </Field>
  )
  return (
    <Card>
      <CardHead title="Plano de Desenvolvimento Individual (PDI)" sub={p?.registradoEm ? `Registrado por ${p.registradoPor ?? '—'} em ${dataBR(p.registradoEm)}` : 'Metas, treinamentos e ações para o próximo semestre.'} />
      <div className="p-5">
        {campo('metas', 'Metas para o próximo semestre', true)}
        {campo('treinamentos', 'Treinamentos necessários')}
        {campo('indicadores', 'Indicadores de evolução')}
        <Field label="Data prevista para revisão" required htmlFor="pdi-rev">{edita ? <input id="pdi-rev" type="date" className="input sm:max-w-[220px]" value={v.revisaoEm} onChange={(e) => setV({ ...v, revisaoEm: e.target.value })} /> : <p className="text-[13px]">{v.revisaoEm ? dataBR(v.revisaoEm) : '—'}</p>}</Field>
        {edita && (
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" icon="Save" onClick={() => salvar(false)}>Salvar</Button>
            {c.etapa === 'pdi' && <Button icon="Check" onClick={() => salvar(true)}>Registrar PDI</Button>}
          </div>
        )}
        {edita && c.etapa === 'pdi' && <p className="text-[12px] text-muted mt-3">Inclua ao menos uma ação de desenvolvimento (quadro “Ações do PDI”) antes de registrar.</p>}
        {p?.registradoEm && <RevisoesPdi d={d} recarregar={recarregar} />}
      </div>
    </Card>
  )
}

/** Revisões (check-ins) do PDI: o que foi visto em cada conversa e a próxima data. */
function RevisoesPdi({ d, recarregar }: { d: Detalhe; recarregar: () => void }) {
  const p = d.pdi!
  const [aberto, setAberto] = useState(false)
  const [v, setV] = useState({ texto: '', proximaRevisao: '' })
  const salvar = () => executar(() => api.post(`desenvolvimento/ciclos/${d.ciclo.id}/pdi/revisao`, { texto: v.texto, proximaRevisao: v.proximaRevisao || null }), 'Revisão registrada.')
    .then((ok) => { if (ok) { setV({ texto: '', proximaRevisao: '' }); setAberto(false); recarregar() } })
  return (
    <div className="mt-5 pt-4 border-t border-line">
      <div className="flex items-center gap-3 flex-wrap mb-2">
        <h4 className="text-[13px] font-bold text-ink flex-1">Revisões do PDI</h4>
        {p.revisaoEm && <Badge tone={p.revisaoEm < new Date().toISOString().slice(0, 10) ? 'danger' : 'brand'} dot>Próxima revisão: {dataBR(p.revisaoEm)}</Badge>}
      </div>
      {p.revisoes.length === 0 ? <p className="text-[12.5px] text-muted">Nenhuma revisão registrada ainda. Use a data combinada para conversar sobre metas e ações e registre aqui o que foi visto.</p> : (
        <ul className="space-y-2">
          {p.revisoes.map((r, i) => <li key={i} className="rounded-lg bg-surface-2 px-3 py-2"><div className="text-[11.5px] text-muted">{dataBR(r.em)} · {r.por ?? '—'}</div><p className="text-[13px] text-ink-2 whitespace-pre-line">{r.texto}</p></li>)}
        </ul>
      )}
      {d.permissoes.revisarPdi && (aberto ? (
        <div className="mt-3">
          <Field label="O que foi revisado" required hint="Andamento das metas e ações, ajustes combinados." htmlFor="rv-texto"><textarea id="rv-texto" rows={3} className="input" value={v.texto} onChange={(e) => setV({ ...v, texto: e.target.value })} /></Field>
          <Field label="Próxima revisão" hint="Opcional. Sem data, os lembretes param." htmlFor="rv-data"><input id="rv-data" type="date" className="input sm:max-w-[220px]" value={v.proximaRevisao} onChange={(e) => setV({ ...v, proximaRevisao: e.target.value })} /></Field>
          <div className="flex gap-2"><Button size="sm" icon="Check" onClick={salvar} disabled={v.texto.trim().length < 10}>Registrar revisão</Button><Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button></div>
        </div>
      ) : <Button className="mt-3" size="sm" variant="soft" icon="CalendarCheck" onClick={() => setAberto(true)}>Registrar revisão</Button>)}
    </div>
  )
}

/** Autoavaliação × avaliação da liderança, por critério: ponto de partida para a devolutiva (maiores diferenças primeiro). */
function Comparacao({ d }: { d: Detalhe }) {
  const lider = d.formularios.find((f) => f.tipo === 'lider_avalia' && f.respostas && f.retrato)
  const auto = d.formularios.find((f) => f.tipo === 'autoavaliacao' && f.respostas && f.retrato)
  const [todos, setTodos] = useState(false)
  if (!lider || !auto || d.ciclo.etapa === 'coleta') return null
  const itens = compararAvaliacoes({ modelo: lider.retrato!, respostas: lider.respostas! }, { modelo: auto.retrato!, respostas: auto.respostas! })
  const destaque = itens.filter((x) => x.conversar)
  const lista = todos ? itens : itens.slice(0, Math.max(5, destaque.length))
  return (
    <Card>
      <CardHead title="Autoavaliação × liderança" sub={destaque.length ? `${destaque.length} critério(s) com diferença de 2 pontos ou mais: bons temas para começar a conversa.` : 'Percepções próximas em todos os critérios.'} />
      <ul className="divide-y divide-line">
        {lista.map((k) => (
          <li key={k.id} className="px-5 py-2 flex items-center gap-3 text-[13px]">
            <span className="flex-1 min-w-0"><span className="text-ink">{k.nome}</span><span className="block text-[11.5px] text-muted">{k.dimensao}</span></span>
            <span className="tabular-nums w-14 text-right"><span className="text-[11px] text-muted block leading-none">auto</span>{k.auto ?? '—'}</span>
            <span className="tabular-nums w-16 text-right"><span className="text-[11px] text-muted block leading-none">liderança</span><b>{k.lideranca ?? '—'}</b></span>
            <span className={cn('w-24 text-right', k.conversar ? 'text-warning font-semibold' : 'text-muted')}>{k.diferenca === null ? '' : k.conversar ? `${k.diferenca > 0 ? '+' : ''}${k.diferenca} · conversar` : `${k.diferenca > 0 ? '+' : ''}${k.diferenca}`}</span>
          </li>
        ))}
      </ul>
      {itens.length > lista.length && <div className="px-5 py-3"><Button size="sm" variant="ghost" onClick={() => setTodos(true)}>Ver todos os {itens.length} critérios</Button></div>}
      <p className="px-5 pb-4 text-[11.5px] text-muted">Notas de 1 a 5. A diferença é liderança − autoavaliação.</p>
    </Card>
  )
}

function NovaAcao({ cicloId, onCriada }: { cicloId: string; onCriada: () => void }) {
  const vazio = { competencia: '', descricao: '', responsavel: 'colaborador', prazo: '', indicador: '' }
  const [v, setV] = useState(vazio)
  const [aberto, setAberto] = useState(false)
  if (!aberto) return <div className="px-5 pb-5"><Button size="sm" variant="soft" icon="Plus" onClick={() => setAberto(true)}>Incluir ação</Button></div>
  return (
    <div className="px-5 pb-5 pt-2 border-t border-line">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Competência" htmlFor="na-comp"><input id="na-comp" className="input" placeholder="Ex.: Comunicação" value={v.competencia} onChange={(e) => setV({ ...v, competencia: e.target.value })} /></Field>
        <Field label="Responsável" htmlFor="na-resp">
          <select id="na-resp" className="input" value={v.responsavel} onChange={(e) => setV({ ...v, responsavel: e.target.value })}>
            {Object.entries(RESPONSAVEL_ACAO).map(([k, r]) => <option key={k} value={k}>{r}</option>)}
          </select>
        </Field>
      </div>
      <Field label="Ação de desenvolvimento" required htmlFor="na-desc"><input id="na-desc" className="input" placeholder="Ex.: Participar de treinamento e fazer alinhamentos quinzenais" value={v.descricao} onChange={(e) => setV({ ...v, descricao: e.target.value })} /></Field>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Prazo" htmlFor="na-prazo"><input id="na-prazo" type="date" className="input" value={v.prazo} onChange={(e) => setV({ ...v, prazo: e.target.value })} /></Field>
        <Field label="Indicador de evolução" htmlFor="na-ind"><input id="na-ind" className="input" placeholder="Como saber que evoluiu?" value={v.indicador} onChange={(e) => setV({ ...v, indicador: e.target.value })} /></Field>
      </div>
      <div className="flex gap-2">
        <Button size="sm" icon="Check" onClick={() => executar(() => api.post(`desenvolvimento/ciclos/${cicloId}/acoes`, { ...v, prazo: v.prazo || null }), 'Ação incluída.').then((ok) => { if (ok) { setV(vazio); setAberto(false); onCriada() } })}>Salvar ação</Button>
        <Button size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </div>
  )
}

/** Feedback confidencial da equipe: só RH/autorizados. Cada abertura fica registrada. */
function FeedbackConfidencial({ cicloId, onClose }: { cicloId: string; onClose: () => void }) {
  const r = useApi<{ minimo: number; agregado: Agregado; comentarios: { id: string; texto: string; respostas: string[] }[]; evidencias: { id: string; nome: string; textos: string[] }[]; sintese: { texto: string; liberada_em: string | null } | null }>(`desenvolvimento/ciclos/${cicloId}/feedback-equipe`)
  const [texto, setTexto] = useState<string | null>(null)
  const d = r.dados
  const valor = texto ?? d?.sintese?.texto ?? ''
  const salvar = (liberar: boolean) => executar(() => api.put(`desenvolvimento/ciclos/${cicloId}/sintese`, { texto: valor, liberar }), liberar ? 'Síntese liberada à liderança.' : 'Síntese salva.').then((ok) => { if (ok) r.recarregar() })
  return (
    <Drawer open onClose={onClose} titulo="Feedback da equipe (confidencial)" subtitulo="Acesso restrito e registrado. Respostas não identificam quem respondeu." largura="max-w-2xl"
      rodape={d && !d.agregado.suprimido ? <>
        <Button variant="ghost" icon="Save" onClick={() => salvar(false)}>Salvar síntese</Button>
        {!d.sintese?.liberada_em && <Button icon="Send" onClick={() => salvar(true)}>Liberar à liderança</Button>}
      </> : undefined}>
      {!d ? <CarregandoBloco /> : d.agregado.suprimido ? (
        <Callout tone="neutral" icon="ShieldCheck">{d.agregado.n} resposta(s) — abaixo do mínimo de {d.minimo}. Para proteger quem respondeu, nada é exibido e não é possível liberar resultados.</Callout>
      ) : (
        <div className="space-y-6">
          <section>
            <h3 className="text-[13px] font-bold text-ink mb-2">Médias por critério ({d.agregado.n} respostas)</h3>
            {d.agregado.porCriterio.map((k) => <BarraMedia key={k.id} rotulo={k.nome} media={k.media} n={k.n} />)}
          </section>
          {d.comentarios.filter((x) => x.respostas.length).map((p) => (
            <section key={p.id}>
              <h3 className="text-[13px] font-bold text-ink mb-2">{p.texto}</h3>
              <ul className="space-y-1.5">{p.respostas.map((t, i) => <li key={i} className="text-[13px] text-ink-2 bg-surface-2 rounded-lg px-3 py-2 whitespace-pre-line">{t}</li>)}</ul>
            </section>
          ))}
          {d.evidencias.length > 0 && (
            <section>
              <h3 className="text-[13px] font-bold text-ink mb-2">Exemplos citados</h3>
              {d.evidencias.map((e) => <div key={e.id} className="mb-2"><div className="text-[12px] font-semibold text-muted">{e.nome}</div><ul className="space-y-1">{e.textos.map((t, i) => <li key={i} className="text-[12.5px] text-ink-2">• {t}</li>)}</ul></div>)}
            </section>
          )}
          <section>
            <Field label="Síntese para a liderança" hint="Transforme o feedback em orientações construtivas. Não cite trechos que possam identificar quem respondeu." htmlFor="sintese">
              <textarea id="sintese" rows={6} className="input" value={valor} onChange={(e) => setTexto(e.target.value)} />
            </Field>
            {d.sintese?.liberada_em && <Badge tone="success" dot>Liberada em {dataBR(d.sintese.liberada_em)}</Badge>}
          </section>
        </div>
      )}
    </Drawer>
  )
}

type Dialogo = null | 'cancelar' | 'suspender' | 'reabrir' | 'retomar' | 'designar' | { dispensar: string }
function DialogoRH({ dialogo, onClose, onConfirmar, colaboradorId }: { dialogo: Dialogo; onClose: () => void; onConfirmar: (d: Exclude<Dialogo, null>, valor: string) => void; colaboradorId: string }) {
  const [valor, setValor] = useState('')
  const pessoas = useStore((s) => s.colaboradores)
  if (!dialogo) return null
  const cfg = typeof dialogo === 'object'
    ? { titulo: 'Dispensar formulário', rotulo: 'Justificativa (ex.: afastamento)', botao: 'Dispensar', desc: 'O formulário fica registrado como "não respondido". Isso não é uma avaliação negativa.' }
    : {
      cancelar: { titulo: 'Cancelar ciclo', rotulo: 'Justificativa', botao: 'Cancelar ciclo', desc: 'As respostas já enviadas ficam no histórico. O marco não será gerado de novo.' },
      suspender: { titulo: 'Suspender ciclo', rotulo: 'Justificativa (ex.: afastamento)', botao: 'Suspender', desc: 'Os prazos param de correr até a retomada.' },
      reabrir: { titulo: 'Reabrir ciclo', rotulo: 'Justificativa', botao: 'Reabrir', desc: 'O ciclo volta para a devolutiva.' },
      retomar: { titulo: 'Retomar ciclo', rotulo: 'Novo prazo', botao: 'Retomar', desc: 'O ciclo volta à etapa em que estava, com o novo prazo.' },
      designar: { titulo: 'Designar quem conduz', rotulo: 'Pessoa', botao: 'Designar', desc: 'Formulários da liderança ainda não enviados passam para esta pessoa. A rotina automática passa a respeitar a designação.' },
    }[dialogo]
  const fechar = () => { setValor(''); onClose() }
  return (
    <Modal open onClose={fechar} title={cfg.titulo}
      footer={<><Button variant="ghost" onClick={fechar}>Voltar</Button><Button onClick={() => onConfirmar(dialogo, valor)} disabled={!valor.trim()}>{cfg.botao}</Button></>}>
      <p className="text-[13px] text-ink-2 mb-4">{cfg.desc}</p>
      <Field label={cfg.rotulo} required htmlFor="dlg-valor">
        {dialogo === 'retomar' ? <input id="dlg-valor" type="date" className="input" value={valor} onChange={(e) => setValor(e.target.value)} />
          : dialogo === 'designar' ? (
            <select id="dlg-valor" className="input" value={valor} onChange={(e) => setValor(e.target.value)}>
              <option value="">Escolha…</option>
              {pessoas.filter((p) => p.status !== 'encerrado' && p.status !== 'pendente' && p.id !== colaboradorId).sort((a, b) => a.nome.localeCompare(b.nome)).map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </select>
          ) : <textarea id="dlg-valor" rows={3} className="input" value={valor} onChange={(e) => setValor(e.target.value)} placeholder="Mínimo de 10 caracteres" />}
      </Field>
    </Modal>
  )
}
