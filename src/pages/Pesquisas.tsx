import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Pesquisa } from '@/lib/types'
import { PageHeader, Card, Badge, Button, EmptyState, Callout, Icon } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { pesquisaAbertaPara, validarRespostas } from '@/domain/pesquisas'

export default function Pesquisas() {
  const s = useStore()
  const me = s.realUser()
  const hoje = hojeISO()
  const [aberta, setAberta] = useState<Pesquisa | null>(null)
  const respondi = (id: string) => s.participacoes.some((p) => p.pesquisaId === id && p.colaboradorId === me.id)
  const disponiveis = s.pesquisas.filter((p) => pesquisaAbertaPara(p, me.setorId, hoje))
  const encerradas = s.pesquisas.filter((p) => p.status === 'encerrada' && (p.setoresAlvo.length === 0 || p.setoresAlvo.includes(me.setorId)))

  return (
    <>
      <PageHeader title="Pesquisas" subtitle="Sua opinião ajuda a melhorar a experiência da comunidade. Participar é sempre voluntário." />
      <Callout tone="brand" icon="ShieldCheck" className="mb-6">
        <b>Suas respostas são anônimas.</b> Guardamos apenas que você participou (para não pedir de novo) e, separadamente, as respostas sem identificação.
        Resultados só aparecem de forma agregada e grupos com poucas respostas são ocultados.
      </Callout>

      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Abertas para você</h2>
      {disponiveis.length === 0 ? <Card className="mb-8"><EmptyState icon="MessagesSquare" title="Nenhuma pesquisa aberta" desc="Quando houver uma nova pesquisa, ela aparece aqui e nas suas pendências." /></Card> : (
        <div className="grid md:grid-cols-2 gap-4 mb-8">
          {disponiveis.map((p) => {
            const ok = respondi(p.id)
            return (
              <Card key={p.id} className="p-5 flex flex-col">
                <div className="flex items-center gap-2 mb-2">{ok ? <Badge tone="success" dot>Respondida</Badge> : <Badge tone="brand" dot>Aberta</Badge>}<span className="text-[12px] text-muted">até {fmtDate(p.fim)}</span></div>
                <h3 className="text-[15.5px] font-bold text-ink">{p.titulo}</h3>
                <p className="text-[13px] text-muted mt-1 flex-1">{p.descricao}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-[12px] text-muted">{p.perguntas.length} pergunta(s) · ~{Math.max(1, Math.round(p.perguntas.length * 0.5))} min</span>
                  {!ok && <Button size="sm" icon="PenLine" onClick={() => setAberta(p)}>Responder</Button>}
                </div>
              </Card>
            )
          })}
        </div>
      )}

      {encerradas.length > 0 && (
        <>
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Encerradas</h2>
          <Card>
            <ul className="divide-y divide-line">
              {encerradas.map((p) => (
                <li key={p.id} className="flex items-center gap-3 p-4">
                  <Icon name="CheckCircle2" className="h-5 w-5 text-muted" />
                  <div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold text-ink">{p.titulo}</div><div className="text-[12px] text-muted">{fmtDate(p.inicio)} → {fmtDate(p.fim)}</div></div>
                  {respondi(p.id) && <Badge tone="success">Você participou</Badge>}
                </li>
              ))}
            </ul>
          </Card>
        </>
      )}

      {aberta && <ResponderModal p={aberta} onClose={() => setAberta(null)} />}
    </>
  )
}

function ResponderModal({ p, onClose }: { p: Pesquisa; onClose: () => void }) {
  const s = useStore()
  const [resp, setResp] = useState<Record<string, number | string>>({})
  const set = (id: string, v: number | string) => setResp((r) => ({ ...r, [id]: v }))
  const pendente = validarRespostas(p, resp)
  const enviar = () => { if (feedback(s.responderPesquisa(p.id, resp), 'Respostas enviadas.')) onClose() }

  return (
    <Modal open onClose={onClose} wide title={p.titulo} subtitle="Anônima · perguntas de texto são opcionais"
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Send" onClick={enviar} disabled={!!pendente}>Enviar respostas</Button></>}>
      <ol className="space-y-6">
        {p.perguntas.map((q, i) => (
          <li key={q.id}>
            <fieldset>
              <legend className="text-[14px] font-semibold text-ink mb-2.5">{i + 1}. {q.texto}</legend>
              {q.tipo === 'escala' && (
                <div className="flex gap-2 flex-wrap">
                  {[1, 2, 3, 4, 5].map((n) => (
                    <button key={n} type="button" aria-pressed={resp[q.id] === n} onClick={() => set(q.id, n)}
                      className={cn('h-11 min-w-[44px] px-3 rounded-xl border text-[13px] font-bold transition', resp[q.id] === n ? 'bg-brand text-white border-brand' : 'border-line text-ink-2 hover:border-brand')}>{n}</button>
                  ))}
                  <span className="w-full text-[11.5px] text-muted">1 = discordo totalmente · 5 = concordo totalmente</span>
                </div>
              )}
              {q.tipo === 'enps' && (
                <div className="flex gap-1.5 flex-wrap">
                  {Array.from({ length: 11 }, (_, n) => (
                    <button key={n} type="button" aria-pressed={resp[q.id] === n} onClick={() => set(q.id, n)}
                      className={cn('h-10 w-10 rounded-lg border text-[13px] font-bold transition', resp[q.id] === n ? 'bg-brand text-white border-brand' : 'border-line text-ink-2 hover:border-brand')}>{n}</button>
                  ))}
                  <span className="w-full text-[11.5px] text-muted">0 = nada provável · 10 = muito provável</span>
                </div>
              )}
              {q.tipo === 'opcoes' && (
                <div className="grid sm:grid-cols-2 gap-2">
                  {(q.opcoes ?? []).map((o) => (
                    <label key={o} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer', resp[q.id] === o ? 'border-brand bg-brand-50' : 'border-line')}>
                      <input type="radio" name={q.id} className="accent-brand" checked={resp[q.id] === o} onChange={() => set(q.id, o)} />
                      <span className="text-[13px] text-ink">{o}</span>
                    </label>
                  ))}
                </div>
              )}
              {q.tipo === 'texto' && (
                <textarea aria-label={q.texto} className="input !h-auto py-2.5" rows={3} maxLength={1000} value={String(resp[q.id] ?? '')} onChange={(e) => set(q.id, e.target.value)}
                  placeholder="Evite incluir nomes ou dados que identifiquem você ou outras pessoas." />
              )}
            </fieldset>
          </li>
        ))}
      </ol>
      {pendente && <p className="text-[12px] text-muted mt-5">Para enviar: {pendente.replace('Responda: ', 'responda ')}</p>}
    </Modal>
  )
}
