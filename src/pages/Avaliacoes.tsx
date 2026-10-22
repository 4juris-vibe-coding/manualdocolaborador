import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { AvaliacaoInicio, ParticipanteCiclo } from '@/lib/types'
import { PageHeader, Card, CardHead, Badge, Button, EmptyState, Field, Tabs, Callout, Avatar, Icon } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { EscalaNotas } from '@/components/inputs'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { hojeISO, diasEntre } from '@/domain/datas'
import { competenciasDe, rotulos, ROTULOS_ESCALA } from '@/domain/avaliacoes'
import { ResultadoIndividualCard } from './rh/Avaliacoes'

export default function Avaliacoes() {
  const s = useStore()
  const me = s.realUser()
  const hoje = hojeISO()
  const [tab, setTab] = useState('responder')
  const [ciclo, setCiclo] = useState<ParticipanteCiclo | null>(null)
  const [inicio, setInicio] = useState<AvaliacaoInicio | null>(null)
  const [resultado, setResultado] = useState('')

  const meusPares = s.participantesCiclo.filter((p) => p.avaliadorId === me.id)
  const pendentesCiclo = meusPares.filter((p) => {
    const c = s.ciclos.find((x) => x.id === p.cicloId)
    return c?.status === 'ativo' && hoje >= c.abertura && hoje <= c.encerramento && !s.respostasAvaliacao.some((r) => r.participanteId === p.id)
  })
  const respondidosCiclo = meusPares.filter((p) => s.respostasAvaliacao.some((r) => r.participanteId === p.id))
  const pendentesInicio = s.avaliacoesInicio.filter((a) => a.avaliadorId === me.id && a.status === 'pendente' && a.expiraEm >= hoje)
  // Resultados próprios: só de ciclos encerrados (evita leitura parcial durante o ciclo).
  const meusCiclos = s.ciclos.filter((c) => c.status === 'encerrado' && s.participantesCiclo.some((p) => p.cicloId === c.id && p.avaliadoId === me.id))
  const total = pendentesCiclo.length + pendentesInicio.length

  return (
    <>
      <PageHeader title="Avaliações" subtitle="Avaliações que você precisa responder e os resultados dos ciclos encerrados sobre você." />
      <Tabs tabs={[{ key: 'responder', label: `Para responder${total ? ` (${total})` : ''}` }, { key: 'respondidas', label: 'Já respondidas' }, { key: 'resultados', label: 'Meus resultados' }]} active={tab} onChange={setTab} />

      {tab === 'responder' && (total === 0 ? <Card><EmptyState icon="ClipboardCheck" title="Nada para responder agora" desc="Quando um ciclo for aberto para você, ele aparece aqui e nas suas notificações." /></Card> : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {pendentesCiclo.map((p) => {
            const c = s.ciclos.find((x) => x.id === p.cicloId)!
            const avaliado = s.pessoa(p.avaliadoId)!
            return (
              <Card key={p.id} className="p-5">
                <div className="flex items-center gap-3">
                  <Avatar pessoaId={avaliado.id} nome={avaliado.nome} cor={avaliado.avatarCor} size="md" />
                  <div className="flex-1 min-w-0"><div className="text-[14px] font-semibold text-ink">{p.avaliadorId === p.avaliadoId ? 'Autoavaliação' : avaliado.nome}</div><div className="text-[12px] text-muted">{c.nome}</div></div>
                  <Badge tone="warning">até {fmtDate(c.encerramento, { day: '2-digit', month: 'short' })}</Badge>
                </div>
                <Button className="mt-4 w-full" icon="PenLine" onClick={() => setCiclo(p)}>Responder</Button>
              </Card>
            )
          })}
          {pendentesInicio.map((a) => {
            const avaliado = s.pessoa(a.avaliadoId)!
            return (
              <Card key={a.id} className="p-5">
                <div className="flex items-center gap-3">
                  <Avatar pessoaId={avaliado.id} nome={avaliado.nome} cor={avaliado.avatarCor} size="md" />
                  <div className="flex-1 min-w-0"><div className="text-[14px] font-semibold text-ink">{avaliado.nome}</div><div className="text-[12px] text-muted">Início de parceria · marco de {a.marcoDias} dias</div></div>
                  <Badge tone="warning">{diasEntre(hoje, a.expiraEm)} dia(s)</Badge>
                </div>
                <Button className="mt-4 w-full" icon="Sprout" onClick={() => setInicio(a)}>Responder</Button>
              </Card>
            )
          })}
        </div>
      ))}

      {tab === 'respondidas' && (
        <Card>
          {respondidosCiclo.length === 0 && !s.avaliacoesInicio.some((a) => a.avaliadorId === me.id && a.status === 'respondida') ? <EmptyState icon="History" title="Nenhuma resposta ainda" /> : (
            <ul className="divide-y divide-line">
              {respondidosCiclo.map((p) => <li key={p.id} className="flex items-center gap-3 p-4"><Icon name="CheckCircle2" className="h-5 w-5 text-success" /><span className="flex-1 text-[13.5px] text-ink">{p.avaliadorId === p.avaliadoId ? 'Autoavaliação' : s.nomeDe(p.avaliadoId)} · <span className="text-muted">{s.ciclos.find((c) => c.id === p.cicloId)?.nome}</span></span><span className="text-[12px] text-muted">{fmtDate(s.respostasAvaliacao.find((r) => r.participanteId === p.id)?.respondidaEm)}</span></li>)}
              {s.avaliacoesInicio.filter((a) => a.avaliadorId === me.id && a.status === 'respondida').map((a) => <li key={a.id} className="flex items-center gap-3 p-4"><Icon name="CheckCircle2" className="h-5 w-5 text-success" /><span className="flex-1 text-[13.5px] text-ink">{s.nomeDe(a.avaliadoId)} · <span className="text-muted">início de parceria ({a.marcoDias} dias)</span></span><span className="text-[12px] text-muted">{fmtDate(a.respondidaEm)}</span></li>)}
            </ul>
          )}
        </Card>
      )}

      {tab === 'resultados' && (meusCiclos.length === 0 ? <Card><EmptyState icon="BarChart3" title="Nenhum resultado disponível" desc="Os resultados aparecem quando um ciclo em que você foi avaliado(a) é encerrado." /></Card> : (
        <>
          <div className="flex flex-wrap gap-2 mb-4">{meusCiclos.map((c) => <button key={c.id} type="button" aria-pressed={resultado === c.id} onClick={() => setResultado(c.id)} className={cn('chip', resultado === c.id && 'chip-active')}>{c.nome}</button>)}</div>
          {resultado ? <ResultadoIndividualCard c={meusCiclos.find((c) => c.id === resultado)!} avaliadoId={me.id} /> : <Card><EmptyState icon="MousePointerClick" title="Escolha um ciclo" /></Card>}
          <Callout tone="neutral" icon="Info" className="mt-5">Os comentários são exibidos sem identificar quem avaliou. Use o resultado para conversar com sua liderança sobre as próximas entregas.</Callout>
        </>
      ))}

      {ciclo && <ResponderCicloModal p={ciclo} onClose={() => setCiclo(null)} />}
      {inicio && <ResponderInicioModal a={inicio} onClose={() => setInicio(null)} />}
    </>
  )
}

function ResponderCicloModal({ p, onClose }: { p: ParticipanteCiclo; onClose: () => void }) {
  const s = useStore()
  const c = s.ciclos.find((x) => x.id === p.cicloId)!
  const avaliado = s.pessoa(p.avaliadoId)!
  const comps = competenciasDe(avaliado, s.competencias, 'desempenho')
  const rs = rotulos(c)
  const [notas, setNotas] = useState<Record<string, number>>({})
  const [coment, setComent] = useState<Record<string, string>>({})
  const [geral, setGeral] = useState('')
  const faltam = comps.filter((x) => !notas[x.id]).length
  return (
    <Modal open onClose={onClose} wide title={p.avaliadorId === p.avaliadoId ? 'Autoavaliação' : `Avaliar ${avaliado.nome}`} subtitle={`${c.nome} · escala ${ROTULOS_ESCALA[c.rotuloEscala].titulo.toLowerCase()} (${c.niveisEscala} níveis)`}
      footer={<><span className="text-[12px] text-muted mr-auto">{faltam ? `${faltam} competência(s) sem nota` : 'Tudo respondido'}</span><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Send" disabled={faltam > 0} onClick={() => { if (feedback(s.responderAvaliacao(p.id, notas, coment, geral), 'Avaliação enviada. Obrigado!')) onClose() }}>Enviar</Button></>}>
      {comps.length === 0 ? <EmptyState icon="Layers" title="Nenhuma competência configurada para esta função" desc="Peça ao RH para cadastrar competências do tipo “Ciclos de avaliação”." /> : (
        <ol className="space-y-6">
          {comps.map((comp, i) => (
            <li key={comp.id}>
              <div className="text-[14px] font-semibold text-ink">{i + 1}. {comp.nome}</div>
              {comp.descricao && <p className="text-[12.5px] text-muted mb-2">{comp.descricao}</p>}
              <EscalaNotas nome={comp.nome} niveis={c.niveisEscala} rotulos={rs} valor={notas[comp.id]} onChange={(v) => setNotas({ ...notas, [comp.id]: v })} />
              {c.comentarioCompetenciaMostrar && <textarea aria-label={`Comentário sobre ${comp.nome}`} className="input !h-auto py-2 mt-2" rows={2} placeholder={c.comentarioCompetenciaObrigatorio ? 'Comentário (obrigatório)' : 'Comentário (opcional)'} value={coment[comp.id] ?? ''} onChange={(e) => setComent({ ...coment, [comp.id]: e.target.value })} />}
            </li>
          ))}
        </ol>
      )}
      <Field label={`Comentário geral${c.comentarioGeralObrigatorio ? ' (obrigatório)' : ''}`} htmlFor="av-g" className="mt-6"><textarea id="av-g" rows={3} className="input !h-auto py-2.5" value={geral} onChange={(e) => setGeral(e.target.value)} placeholder="Destaques, combinados para o próximo período…" /></Field>
    </Modal>
  )
}

export function ResponderInicioModal({ a, onClose }: { a: AvaliacaoInicio; onClose: () => void }) {
  const s = useStore()
  const avaliado = s.pessoa(a.avaliadoId)!
  const comps = competenciasDe(avaliado, s.competencias, 'inicio_parceria')
  const rs = ROTULOS_ESCALA.desempenho.r5
  const [notas, setNotas] = useState<Record<string, number>>({})
  const [coment, setComent] = useState('')
  const [cont, setCont] = useState<'seguir' | 'ajustar' | 'revisar'>('seguir')
  return (
    <Modal open onClose={onClose} wide title={`Início de parceria · ${avaliado.nome}`} subtitle={`Marco de ${a.marcoDias} dias · responder até ${fmtDate(a.expiraEm)}`}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Send" disabled={comps.some((c) => !notas[c.id])} onClick={() => { if (feedback(s.responderAvaliacaoInicio(a.id, notas, coment, cont), 'Avaliação registrada.')) onClose() }}>Enviar</Button></>}>
      <ol className="space-y-5">
        {comps.map((comp, i) => (
          <li key={comp.id}>
            <div className="text-[14px] font-semibold text-ink">{i + 1}. {comp.nome}</div>
            {comp.descricao && <p className="text-[12.5px] text-muted mb-2">{comp.descricao}</p>}
            <EscalaNotas nome={comp.nome} niveis={5} rotulos={rs} valor={notas[comp.id]} onChange={(v) => setNotas({ ...notas, [comp.id]: v })} />
          </li>
        ))}
      </ol>
      <fieldset className="mt-6"><legend className="label">Encaminhamento</legend>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
          {([['seguir', 'Seguir como combinado', 'ThumbsUp'], ['ajustar', 'Ajustar combinados', 'SlidersHorizontal'], ['revisar', 'Conversa com o RH', 'MessageCircleWarning']] as const).map(([k, t, ic]) => (
            <button key={k} type="button" aria-pressed={cont === k} onClick={() => setCont(k)} className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold', cont === k ? 'border-brand bg-brand-50 text-brand' : 'border-line text-ink-2')}><Icon name={ic} className="h-4 w-4" />{t}</button>
          ))}
        </div>
      </fieldset>
      <Field label="Comentário" htmlFor="ai-c" className="mt-4"><textarea id="ai-c" rows={3} className="input !h-auto py-2.5" value={coment} onChange={(e) => setComent(e.target.value)} /></Field>
      <p className="text-[11.5px] text-muted">“Conversa com o RH” avisa o RH para apoiar o alinhamento. Nenhuma ação contratual é disparada automaticamente.</p>
    </Modal>
  )
}

