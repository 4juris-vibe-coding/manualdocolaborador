import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, Avatar, EmptyState, Tabs, Field, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { SeletorPessoas } from '@/components/inputs'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { MotivoModal } from '@/components/v2/ats/ModaisCandidato'
import { ContratarModal } from '@/components/v2/ats/ContratarModal'
import { Linha, Secao, TEXTAREA, camposDoErro, useTitulo } from '@/components/v2/ats/comuns'
import { api, executar, useApi } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import { ROTULO_ORIGEM, ROTULO_STATUS_CANDIDATURA, ROTULO_STATUS_COMUNICACAO, ROTULO_STATUS_ENTREVISTA, ROTULO_STATUS_PROPOSTA } from '@/domain/v2/ats'
import { dataBR, dataHoraBR, moeda, numero } from '@/lib/fmt'
import { toast } from '@/components/toast'
import { Dropdown } from '@/components/Dropdown'

export default function CandidatoPerfil() {
  const { candidaturaId = '' } = useParams()
  const r = useApi<any>(`ats/candidaturas/${candidaturaId}`)
  useTitulo(r.dados ? `${r.dados.candidato.nome} · Candidatos` : 'Candidato')
  const [aba, setAba] = useState('resumo')
  const [motivo, setMotivo] = useState<string | null>(null)
  const d = r.dados
  const p = d?.permissoes

  async function mover(corpo: Record<string, unknown>, ok: string) {
    await executar(() => api.post(`ats/candidaturas/${candidaturaId}/mover`, { deEtapaId: d.candidatura.etapaId, ...corpo }), ok)
    r.recarregar()
  }

  return (
    <SoComBanco>
      <Link to={d ? `/recrutamento/candidatos?vaga=${d.vaga.id}` : '/recrutamento/candidatos'} className="inline-flex items-center gap-1.5 text-[13px] text-muted hover:text-ink mb-4">← Voltar ao pipeline</Link>
      <Aguardar r={r}>
        {(x) => (
          <>
            <PageHeader title={x.candidato.nome} subtitle={`${x.vaga.codigo} · ${x.vaga.titulo}`}
              eyebrow={<div className="flex items-center gap-2"><StatusBadge mapa={ROTULO_STATUS_CANDIDATURA} valor={x.candidatura.status} /><Badge tone="neutral">{x.etapas.find((e: any) => e.id === x.candidatura.etapaId)?.nome ?? '—'}</Badge></div>}
              actions={<>
                {x.candidatura.curriculo && <a className="inline-flex items-center h-10 px-4 rounded-xl border border-line text-[13.5px] font-semibold text-ink hover:bg-surface-2" href={api.url(`ats/candidaturas/${x.candidatura.id}/curriculo`)}>Baixar currículo</a>}
                {p.gerenciar && x.candidatura.status === 'ativa' && (
                  <Dropdown aria-label="Mover para etapa" className="input w-auto" value="" onChange={(e) => { const v = e.target.value; e.target.value = ''; if (v) void mover({ etapaId: v }, 'Etapa atualizada.') }}>
                    <option value="">Mover para…</option>
                    {x.etapas.filter((e: any) => e.id !== x.candidatura.etapaId && e.tipo !== 'contratado').map((e: any) => <option key={e.id} value={e.id}>{e.nome}</option>)}
                  </Dropdown>
                )}
                {p.gerenciar && x.candidatura.status === 'ativa' && <Button variant="danger" onClick={() => setMotivo('reprovado')}>Reprovar</Button>}
                {p.gerenciar && ['reprovado', 'desistiu', 'cancelada', 'encerrada'].includes(x.candidatura.status) && <Button variant="soft" onClick={() => mover({ status: 'ativa', etapaId: x.etapas[0]?.id }, 'Candidatura reativada.')}>Reativar</Button>}
              </>} />
            {x.candidato.anonimizado && <Callout tone="neutral" icon="ShieldOff" className="mb-4">Dados pessoais anonimizados (LGPD). Restam apenas registros estatísticos do processo.</Callout>}
            <Tabs active={aba} onChange={setAba} tabs={[
              { key: 'resumo', label: 'Resumo' }, { key: 'historico', label: 'Histórico' }, { key: 'entrevistas', label: `Entrevistas (${x.entrevistas.length})` },
              { key: 'avaliacoes', label: `Avaliações (${x.avaliacoes.length})` }, { key: 'notas', label: `Notas (${x.notas.length})` },
              ...(p.gerenciar ? [{ key: 'proposta', label: 'Proposta' }, { key: 'comunicacao', label: 'Comunicação' }, { key: 'privacidade', label: 'Privacidade' }] : []),
            ]} />
            {aba === 'resumo' && <Resumo x={x} recarregar={r.recarregar} />}
            {aba === 'historico' && <Historico x={x} />}
            {aba === 'entrevistas' && <Entrevistas x={x} recarregar={r.recarregar} />}
            {aba === 'avaliacoes' && <Avaliacoes x={x} recarregar={r.recarregar} />}
            {aba === 'notas' && <Notas x={x} recarregar={r.recarregar} />}
            {aba === 'proposta' && p.gerenciar && <Proposta x={x} recarregar={r.recarregar} />}
            {aba === 'comunicacao' && p.gerenciar && <Comunicacao x={x} recarregar={r.recarregar} />}
            {aba === 'privacidade' && p.gerenciar && <Privacidade x={x} recarregar={r.recarregar} />}
            <MotivoModal aberto={!!motivo} titulo="Reprovar candidatura" avisarCandidato onClose={() => setMotivo(null)}
              onConfirmar={async (m, avisar) => { await mover({ status: 'reprovado', motivo: m, notificarCandidato: avisar }, 'Candidatura encerrada.'); setMotivo(null) }} />
          </>
        )}
      </Aguardar>
    </SoComBanco>
  )
}

/* ---------- Resumo ---------- */
function Resumo({ x, recarregar }: { x: any; recarregar: () => void }) {
  const k = x.candidato, c = x.candidatura
  const [editar, setEditar] = useState(false)
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5 lg:col-span-2">
        <Secao titulo="Contato e dados" acao={x.permissoes.gerenciar && !k.anonimizado ? <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setEditar(true)}>Revisar</Button> : undefined}>
          <dl>
            <Linha rotulo="E-mail">{k.email}</Linha><Linha rotulo="Telefone">{k.telefone}</Linha>
            <Linha rotulo="Cidade / UF">{[k.cidade, k.uf].filter(Boolean).join(' / ')}</Linha>
            <Linha rotulo="LinkedIn">{k.linkedin ? <a className="text-brand hover:underline" href={k.linkedin} target="_blank" rel="noopener noreferrer">{k.linkedin}</a> : ''}</Linha>
            <Linha rotulo="Origem">{ROTULO_ORIGEM[c.origem] ?? c.origem}</Linha>
            <Linha rotulo="Candidatura em">{dataHoraBR(c.criadoEm)}</Linha>
            <Linha rotulo="Disponibilidade">{c.disponibilidade}</Linha>
            {c.pretensao !== undefined && <Linha rotulo="Pretensão">{c.pretensao === null ? '' : moeda(c.pretensao)}</Linha>}
            <Linha rotulo="Currículo">{c.curriculo ? `${c.curriculo.nome} (${numero(c.curriculo.tamanho / 1024)} KB)` : 'Não anexado'}</Linha>
            {c.motivoSaida && <Linha rotulo="Motivo da saída">{c.motivoSaida}</Linha>}
          </dl>
        </Secao>
        {(k.resumo || k.competencias?.length > 0) && (
          <Secao titulo="Perfil (conferido pelo RH)">
            {k.resumo && <p className="text-[13.5px] text-ink-2 whitespace-pre-wrap mb-3">{k.resumo}</p>}
            <div className="flex flex-wrap gap-1.5">{(k.competencias ?? []).map((t: string) => <Badge key={t} tone="brand">{t}</Badge>)}</div>
          </Secao>
        )}
        {c.respostasTriagem?.length > 0 && (
          <Secao titulo="Respostas da triagem">
            <ul className="space-y-2">{c.respostasTriagem.map((r: any) => <li key={r.perguntaId} className="text-[13.5px]"><span className="text-muted">{r.texto}</span><br /><b className="text-ink">{r.resposta}</b></li>)}</ul>
            <p className="text-[11.5px] text-muted mt-2">As respostas apoiam a análise; a decisão é sempre de uma pessoa.</p>
          </Secao>
        )}
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <Secao titulo="Outras candidaturas desta pessoa" className="mb-0">
            {x.outrasCandidaturas.length === 0 ? <p className="text-[13px] text-muted">Nenhuma outra candidatura.</p> : (
              <ul className="space-y-2">{x.outrasCandidaturas.map((o: any) => (
                <li key={o.id} className="text-[13px] flex items-center justify-between gap-2"><Link className="text-brand hover:underline truncate" to={`/recrutamento/candidatos/${o.id}`}>{o.titulo}</Link><StatusBadge mapa={ROTULO_STATUS_CANDIDATURA} valor={o.status} dot={false} /></li>
              ))}</ul>
            )}
          </Secao>
        </Card>
        {x.talento && <Callout tone="brand" icon="Contact">No banco de talentos{x.talento.retencaoAte ? ` até ${dataBR(String(x.talento.retencaoAte).slice(0, 10))}` : ''}.</Callout>}
      </div>
      {editar && <RevisarDados k={k} onClose={() => setEditar(false)} onFeito={() => { setEditar(false); recarregar() }} />}
    </div>
  )
}

function RevisarDados({ k, onClose, onFeito }: { k: any; onClose: () => void; onFeito: () => void }) {
  const [f, setF] = useState({ telefone: k.telefone ?? '', cidade: k.cidade ?? '', uf: k.uf ?? '', linkedin: k.linkedin ?? '', resumo: k.resumo ?? '', competencias: (k.competencias ?? []).join(', ') })
  const salvar = async () => {
    const ok = await executar(() => api.patch(`ats/candidatos/${k.id}`, { ...f, competencias: f.competencias.split(',').map((s: string) => s.trim()).filter(Boolean) }), 'Dados atualizados.')
    if (ok) onFeito()
  }
  return (
    <Modal open onClose={onClose} title="Revisar dados do candidato" subtitle="Informações extraídas de currículos devem ser conferidas por uma pessoa."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Telefone" htmlFor="rv-t"><input id="rv-t" className="input" value={f.telefone} onChange={(e) => setF({ ...f, telefone: e.target.value })} /></Field>
        <Field label="LinkedIn" htmlFor="rv-l"><input id="rv-l" className="input" value={f.linkedin} onChange={(e) => setF({ ...f, linkedin: e.target.value })} /></Field>
        <Field label="Cidade" htmlFor="rv-c"><input id="rv-c" className="input" value={f.cidade} onChange={(e) => setF({ ...f, cidade: e.target.value })} /></Field>
        <Field label="UF" htmlFor="rv-u"><input id="rv-u" className="input" maxLength={2} value={f.uf} onChange={(e) => setF({ ...f, uf: e.target.value.toUpperCase() })} /></Field>
      </div>
      <Field label="Competências (separe por vírgula)" htmlFor="rv-k"><input id="rv-k" className="input" value={f.competencias} onChange={(e) => setF({ ...f, competencias: e.target.value })} /></Field>
      <Field label="Resumo profissional" htmlFor="rv-r"><textarea id="rv-r" className={TEXTAREA} value={f.resumo} onChange={(e) => setF({ ...f, resumo: e.target.value })} /></Field>
    </Modal>
  )
}

/* ---------- Histórico ---------- */
function Historico({ x }: { x: any }) {
  return (
    <Card className="p-5">
      <ol className="relative border-l border-line ml-2 space-y-5">
        {[...x.movimentacoes].reverse().map((m: any, i: number) => (
          <li key={i} className="ml-5">
            <span className="absolute -left-[5px] mt-1.5 h-2.5 w-2.5 rounded-full bg-brand" />
            <div className="text-[13.5px] text-ink font-semibold">
              {m.deEtapa && m.deEtapa !== m.paraEtapa ? `${m.deEtapa} → ${m.paraEtapa}` : m.paraEtapa}
              {m.paraStatus && m.paraStatus !== m.deStatus && <span className="ml-2"><StatusBadge mapa={ROTULO_STATUS_CANDIDATURA} valor={m.paraStatus} dot={false} /></span>}
            </div>
            <div className="text-[12px] text-muted">{dataHoraBR(m.em)} · {m.porNome ?? 'Sistema'}</div>
            {m.motivo && <div className="text-[13px] text-ink-2 mt-1">{m.motivo}</div>}
          </li>
        ))}
      </ol>
    </Card>
  )
}

/* ---------- Entrevistas ---------- */
function Entrevistas({ x, recarregar }: { x: any; recarregar: () => void }) {
  const [novo, setNovo] = useState(false)
  const [reg, setReg] = useState<any | null>(null)
  const [canc, setCanc] = useState<any | null>(null)
  return (
    <div className="space-y-4">
      {x.permissoes.gerenciar && x.candidatura.status === 'ativa' && <div><Button icon="CalendarPlus" onClick={() => setNovo(true)}>Agendar entrevista</Button></div>}
      {x.entrevistas.length === 0 ? <Card><EmptyState icon="CalendarClock" title="Nenhuma entrevista" desc="Agende a primeira entrevista para esta candidatura." /></Card> :
        x.entrevistas.map((e: any) => (
          <Card key={e.id} className="p-5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div><div className="font-bold text-ink">{dataHoraBR(e.inicio)} · {e.modalidade}</div><div className="text-[12.5px] text-muted">{e.localOuLink || 'Sem local/link'} · Com {e.participantes.map((p: any) => p.nome).join(', ')}</div></div>
              <StatusBadge mapa={ROTULO_STATUS_ENTREVISTA} valor={e.status} />
            </div>
            {e.resultado && <p className="text-[13px] mt-3"><b>Resultado:</b> {e.resultado}{e.parecer ? ` — ${e.parecer}` : ''}</p>}
            {e.reagendamentos?.length > 0 && <p className="text-[12px] text-muted mt-2">{e.reagendamentos.length} alteração(ões) de agenda registrada(s).</p>}
            {e.status === 'agendada' && (x.permissoes.gerenciar || e.ehParticipante) && (
              <div className="flex gap-2 mt-3 flex-wrap">
                <Button size="sm" variant="soft" onClick={() => setReg(e)}>Registrar resultado</Button>
                {x.permissoes.gerenciar && <Button size="sm" variant="ghost" onClick={() => setCanc(e)}>Cancelar</Button>}
              </div>
            )}
          </Card>
        ))}
      {novo && <AgendarModal candidaturaId={x.candidatura.id} onClose={() => setNovo(false)} onFeito={() => { setNovo(false); recarregar() }} />}
      {reg && <ResultadoModal e={reg} onClose={() => setReg(null)} onFeito={() => { setReg(null); recarregar() }} />}
      <ConfirmModal open={!!canc} onClose={() => setCanc(null)} titulo="Cancelar entrevista?" confirmar="Cancelar entrevista" texto="Os participantes serão avisados pelas notificações do sistema."
        onConfirm={async () => { const e = canc; setCanc(null); await executar(() => api.patch(`ats/entrevistas/${e.id}`, { acao: 'cancelar', motivo: 'Cancelada pelo RH' }), 'Entrevista cancelada.'); recarregar() }} />
    </div>
  )
}

function AgendarModal({ candidaturaId, onClose, onFeito }: { candidaturaId: string; onClose: () => void; onFeito: () => void }) {
  const pessoas = useStore((s) => s.colaboradores).filter((c) => c.status !== 'encerrado')
  const [f, setF] = useState({ tipo: 'rh', inicio: '', fim: '', modalidade: 'online', localOuLink: '' })
  const [part, setPart] = useState<string[]>([])
  const [erros, setErros] = useState<Record<string, string>>({})
  const salvar = async () => {
    try {
      await api.post(`ats/candidaturas/${candidaturaId}/entrevistas`, { ...f, inicio: f.inicio ? new Date(f.inicio).toISOString() : '', fim: f.fim ? new Date(f.fim).toISOString() : undefined, participantes: part })
      toast('Entrevista agendada.'); onFeito()
    } catch (e) { setErros(camposDoErro(e)); toast(e instanceof Error ? e.message : 'Erro', 'danger') }
  }
  return (
    <Modal open onClose={onClose} wide title="Agendar entrevista" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar}>Agendar</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Tipo" htmlFor="ag-t"><Dropdown id="ag-t" className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{[['rh', 'RH'], ['tecnica', 'Técnica'], ['gestor', 'Gestor'], ['final', 'Final'], ['outra', 'Outra']].map(([v, l]) => <option key={v} value={v}>{l}</option>)}</Dropdown></Field>
        <Field label="Modalidade" htmlFor="ag-m"><Dropdown id="ag-m" className="input" value={f.modalidade} onChange={(e) => setF({ ...f, modalidade: e.target.value })}><option value="online">Online</option><option value="presencial">Presencial</option><option value="telefone">Telefone</option></Dropdown></Field>
        <Field label="Início" required erro={erros.inicio} htmlFor="ag-i"><input id="ag-i" type="datetime-local" className="input" value={f.inicio} onChange={(e) => setF({ ...f, inicio: e.target.value })} /></Field>
        <Field label="Fim" erro={erros.fim} htmlFor="ag-f"><input id="ag-f" type="datetime-local" className="input" value={f.fim} onChange={(e) => setF({ ...f, fim: e.target.value })} /></Field>
        <Field label="Local ou link" htmlFor="ag-l" className="sm:col-span-2"><input id="ag-l" className="input" value={f.localOuLink} onChange={(e) => setF({ ...f, localOuLink: e.target.value })} /></Field>
      </div>
      <Field label="Entrevistadores" required erro={erros.participantes}><SeletorPessoas pessoas={pessoas} selecionadas={part} onChange={setPart} altura="max-h-48" /></Field>
    </Modal>
  )
}

function ResultadoModal({ e, onClose, onFeito }: { e: any; onClose: () => void; onFeito: () => void }) {
  const [f, setF] = useState({ status: 'realizada', resultado: 'aprovado', parecer: '' })
  const salvar = async () => { if (await executar(() => api.patch(`ats/entrevistas/${e.id}`, { acao: 'registrar', ...f }), 'Resultado registrado.')) onFeito() }
  return (
    <Modal open onClose={onClose} title="Registrar resultado da entrevista" footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></>}>
      <Field label="Situação" htmlFor="rs-s"><Dropdown id="rs-s" className="input" value={f.status} onChange={(v) => setF({ ...f, status: v.target.value })}><option value="realizada">Realizada</option><option value="nao_compareceu">Candidato não compareceu</option></Dropdown></Field>
      {f.status === 'realizada' && <Field label="Resultado" htmlFor="rs-r"><Dropdown id="rs-r" className="input" value={f.resultado} onChange={(v) => setF({ ...f, resultado: v.target.value })}><option value="aprovado">Aprovado(a)</option><option value="indeciso">Indeciso</option><option value="reprovado">Reprovado(a)</option></Dropdown></Field>}
      <Field label="Parecer" htmlFor="rs-p" hint="Acesso restrito: aparece só para quem gerencia o processo e para os entrevistadores."><textarea id="rs-p" className={TEXTAREA} value={f.parecer} onChange={(v) => setF({ ...f, parecer: v.target.value })} /></Field>
    </Modal>
  )
}

/* ---------- Avaliações ---------- */
function Avaliacoes({ x, recarregar }: { x: any; recarregar: () => void }) {
  const modelos = useApi<{ itens: any[] }>(x.permissoes.avaliar ? 'ats/modelos-avaliacao' : null)
  const [notas, setNotas] = useState<Record<string, number>>({})
  const [rec, setRec] = useState('')
  const [parecer, setParecer] = useState('')
  const modelo = modelos.dados?.itens[0]
  const salvar = async () => {
    const r = await executar(() => api.post(`ats/candidaturas/${x.candidatura.id}/avaliacoes`, { modeloId: modelo?.id, notas, recomendacao: rec || undefined, parecer }), 'Avaliação registrada.')
    if (r) { setNotas({}); setParecer(''); recarregar() }
  }
  const nomeCrit = (id: string) => modelo?.criterios.find((c: any) => c.id === id)?.nome ?? id
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      {x.permissoes.avaliar && (
        <Card className="p-5">
          <h3 className="font-bold text-ink mb-1">Sua avaliação</h3>
          <p className="text-[12.5px] text-muted mb-4">Notas de 1 (fraco) a 5 (excelente). Reenviar substitui a sua avaliação anterior.</p>
          <Aguardar r={modelos} linhas={2}>
            {() => (
              <>
                {modelo?.criterios.map((c: any) => (
                  <fieldset key={c.id} className="mb-3"><legend className="label">{c.nome}</legend>
                    <div className="flex gap-1.5">{[1, 2, 3, 4, 5].map((n) => (
                      <label key={n} className={`h-9 w-9 rounded-lg border flex items-center justify-center text-[13px] font-semibold cursor-pointer focus-within:ring-2 focus-within:ring-brand ${notas[c.id] === n ? 'bg-brand text-white border-brand' : 'border-line text-ink-2 hover:bg-surface-2'}`}>
                        <input type="radio" className="sr-only" name={`n-${c.id}`} checked={notas[c.id] === n} onChange={() => setNotas({ ...notas, [c.id]: n })} />{n}
                      </label>))}</div>
                  </fieldset>
                ))}
                <Field label="Recomendação" htmlFor="av-rec"><Dropdown id="av-rec" className="input" value={rec} onChange={(e) => setRec(e.target.value)}><option value="">Sem recomendação</option><option value="avancar">Avançar</option><option value="manter">Manter em análise</option><option value="nao_avancar">Não avançar</option></Dropdown></Field>
                <Field label="Parecer" htmlFor="av-par"><textarea id="av-par" className={TEXTAREA} value={parecer} onChange={(e) => setParecer(e.target.value)} /></Field>
                <Button onClick={salvar} disabled={Object.keys(notas).length === 0}>Registrar avaliação</Button>
              </>
            )}
          </Aguardar>
        </Card>
      )}
      <div className="space-y-4">
        {x.comparativo && (
          <Card className="p-5">
            <h3 className="font-bold text-ink mb-2">Comparativo entre avaliadores</h3>
            <p className="text-[13px] text-ink-2">Média geral <b>{numero(x.comparativo.mediaGeral, 2)}</b> · divergência entre avaliadores <b>{numero(x.comparativo.divergencia, 2)}</b></p>
            <ul className="mt-2 text-[12.5px] text-muted">{Object.entries(x.comparativo.porCriterio).map(([k, v]) => <li key={k}>{nomeCrit(k)}: {numero(v as number, 2)}</li>)}</ul>
          </Card>
        )}
        {x.avaliacoes.length === 0 ? <Card><EmptyState icon="Star" title="Sem avaliações" desc="As avaliações registradas aparecem aqui (visíveis só a quem as fez e ao RH)." /></Card> :
          x.avaliacoes.map((a: any) => (
            <Card key={a.id} className="p-5">
              <div className="flex justify-between gap-2"><b className="text-ink">{a.avaliadorNome}</b><span className="text-[13px] font-semibold">★ {a.media === null ? '—' : numero(a.media, 2)}</span></div>
              <div className="text-[12px] text-muted">{dataHoraBR(a.criadoEm)}{a.recomendacao ? ` · ${a.recomendacao.replace('_', ' ')}` : ''}</div>
              {a.parecer && <p className="text-[13px] text-ink-2 mt-2 whitespace-pre-wrap">{a.parecer}</p>}
            </Card>
          ))}
      </div>
    </div>
  )
}

/* ---------- Notas ---------- */
function Notas({ x, recarregar }: { x: any; recarregar: () => void }) {
  const [texto, setTexto] = useState('')
  const [vis, setVis] = useState(x.permissoes.notasRh ? 'rh' : 'banca')
  const salvar = async () => { if (await executar(() => api.post(`ats/candidaturas/${x.candidatura.id}/notas`, { texto, visibilidade: vis }), 'Nota registrada.')) { setTexto(''); recarregar() } }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <Field label="Nova nota interna" htmlFor="nt-t"><textarea id="nt-t" className={TEXTAREA} value={texto} onChange={(e) => setTexto(e.target.value)} /></Field>
        {x.permissoes.notasRh && <Field label="Quem pode ler" htmlFor="nt-v"><Dropdown id="nt-v" className="input" value={vis} onChange={(e) => setVis(e.target.value)}><option value="rh">Somente RH e recrutadores</option><option value="banca">RH, recrutadores e gestor/entrevistadores da vaga</option></Dropdown></Field>}
        <Button onClick={salvar} disabled={!texto.trim()}>Registrar nota</Button>
      </Card>
      <div className="space-y-3">
        {x.notas.length === 0 ? <Card><EmptyState icon="StickyNote" title="Nenhuma nota" /></Card> : x.notas.map((n: any) => (
          <Card key={n.id} className="p-4"><div className="flex justify-between text-[12px] text-muted"><b className="text-ink">{n.autorNome}</b><span>{dataHoraBR(n.criadoEm)}</span></div><p className="text-[13.5px] text-ink-2 mt-1.5 whitespace-pre-wrap">{n.texto}</p>
            <Badge tone={n.visibilidade === 'rh' ? 'warning' : 'neutral'} className="mt-2">{n.visibilidade === 'rh' ? 'Restrita ao RH' : 'Equipe da vaga'}</Badge></Card>
        ))}
      </div>
    </div>
  )
}

/* ---------- Proposta ---------- */
function Proposta({ x, recarregar }: { x: any; recarregar: () => void }) {
  const [novo, setNovo] = useState(false)
  const [f, setF] = useState({ valor: '', dataInicioPrevista: '', beneficios: '' })
  const [neg, setNeg] = useState<any | null>(null)
  const [valorNeg, setValorNeg] = useState('')
  const [recusa, setRecusa] = useState<any | null>(null)
  const [motivoRec, setMotivoRec] = useState('')
  const [aceitar, setAceitar] = useState<any | null>(null)
  const ver = x.permissoes.verRemuneracao
  const aberta = x.propostas.some((p: any) => ['rascunho', 'enviada', 'negociacao'].includes(p.status))
  const acao = async (p: any, corpo: Record<string, unknown>, ok: string) => { const r = await executar(() => api.patch(`ats/propostas/${p.id}`, corpo), ok); recarregar(); return !!r }
  return (
    <div className="space-y-4">
      {!ver && <Callout tone="neutral" icon="EyeOff">Você acompanha o andamento das propostas, mas os valores e benefícios ficam restritos a quem tem permissão de remuneração.</Callout>}
      {x.candidatura.status === 'ativa' && !aberta && <div><Button icon="FilePlus2" onClick={() => setNovo(true)}>Nova proposta</Button></div>}
      {x.propostas.length === 0 ? <Card><EmptyState icon="FileSignature" title="Nenhuma proposta" /></Card> : x.propostas.map((p: any) => (
        <Card key={p.id} className="p-5">
          <div className="flex flex-wrap items-center justify-between gap-2"><div className="font-bold text-ink">{p.valorOculto ? 'Valor restrito' : moeda(p.valor, p.moeda)} <span className="text-muted font-normal text-[13px]">· início previsto {dataBR(p.dataInicioPrevista ? String(p.dataInicioPrevista).slice(0, 10) : null)}</span></div><StatusBadge mapa={ROTULO_STATUS_PROPOSTA} valor={p.status} /></div>
          {p.motivoRecusa && <p className="text-[13px] mt-2"><b>Motivo da recusa:</b> {p.motivoRecusa}</p>}
          <ol className="mt-3 text-[12.5px] text-muted space-y-1">{p.historico.map((h: any, i: number) => <li key={i}>{dataHoraBR(h.em)} — {h.tipo}{h.valor ? ` (${moeda(h.valor)})` : ''}{h.nota ? `: ${h.nota}` : ''}</li>)}</ol>
          {['rascunho', 'enviada', 'negociacao'].includes(p.status) && (
            <div className="flex flex-wrap gap-2 mt-4">
              {p.status === 'rascunho' && <Button size="sm" onClick={() => acao(p, { acao: 'enviar' }, 'Proposta marcada como enviada.')}>Marcar como enviada</Button>}
              {p.status !== 'rascunho' && <><Button size="sm" variant="soft" onClick={() => { setNeg(p); setValorNeg('') }}>Registrar negociação</Button><Button size="sm" onClick={() => setAceitar(p)}>Candidato aceitou</Button><Button size="sm" variant="danger" onClick={() => { setRecusa(p); setMotivoRec('') }}>Candidato recusou</Button></>}
              <Button size="sm" variant="ghost" onClick={() => acao(p, { acao: 'cancelar' }, 'Proposta cancelada.')}>Cancelar proposta</Button>
            </div>
          )}
        </Card>
      ))}
      <Modal open={novo} onClose={() => setNovo(false)} title="Nova proposta" footer={<><Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button>
        <Button onClick={async () => { if (await executar(() => api.post(`ats/candidaturas/${x.candidatura.id}/propostas`, { valor: f.valor || undefined, dataInicioPrevista: f.dataInicioPrevista || undefined, beneficios: f.beneficios.split(',').map((s) => s.trim()).filter(Boolean) }), 'Proposta criada.')) { setNovo(false); recarregar() } }}>Criar rascunho</Button></>}>
        {ver && <Field label="Valor (R$)" htmlFor="pp-v"><input id="pp-v" type="number" min={0} className="input" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>}
        <Field label="Início previsto" htmlFor="pp-d"><input id="pp-d" type="date" className="input" value={f.dataInicioPrevista} onChange={(e) => setF({ ...f, dataInicioPrevista: e.target.value })} /></Field>
        <Field label="Benefícios (separe por vírgula)" htmlFor="pp-b"><input id="pp-b" className="input" value={f.beneficios} onChange={(e) => setF({ ...f, beneficios: e.target.value })} /></Field>
      </Modal>
      <Modal open={!!neg} onClose={() => setNeg(null)} title="Registrar negociação" footer={<><Button variant="ghost" onClick={() => setNeg(null)}>Cancelar</Button><Button onClick={async () => { const p = neg; setNeg(null); await acao(p, { acao: 'negociar', valor: ver && valorNeg ? valorNeg : undefined, nota: 'Contraproposta registrada' }, 'Negociação registrada.') }}>Registrar</Button></>}>
        {ver ? <Field label="Novo valor (R$)" htmlFor="ng-v"><input id="ng-v" type="number" min={0} className="input" value={valorNeg} onChange={(e) => setValorNeg(e.target.value)} /></Field> : <p className="text-[13px] text-muted">Será registrada uma rodada de negociação (sem valores).</p>}
      </Modal>
      <Modal open={!!recusa} onClose={() => setRecusa(null)} title="Proposta recusada" footer={<><Button variant="ghost" onClick={() => setRecusa(null)}>Voltar</Button><Button variant="danger" onClick={async () => { const p = recusa; setRecusa(null); await acao(p, { acao: 'recusar', motivo: motivoRec }, 'Recusa registrada.') }}>Registrar recusa</Button></>}>
        <Field label="Motivo (se informado pelo candidato)" htmlFor="rc-m"><textarea id="rc-m" className={TEXTAREA} value={motivoRec} onChange={(e) => setMotivoRec(e.target.value)} /></Field>
      </Modal>
      <ContratarModal open={!!aceitar} onClose={() => setAceitar(null)} titulo="Registrar aceite e concluir contratação?" pessoa={x.candidato}
        texto="A candidatura passa a “Contratado(a)”, a vaga conta uma posição preenchida e, se esta for a última posição, a vaga é encerrada. Essa ação não pode ser desfeita por aqui."
        onContratar={() => acao(aceitar, { acao: 'aceitar' }, 'Contratação concluída.')} />
    </div>
  )
}

/* ---------- Comunicação ---------- */
function Comunicacao({ x, recarregar }: { x: any; recarregar: () => void }) {
  const t = useApi<{ itens: any[] }>('ats/templates')
  const [chave, setChave] = useState('')
  const [enviando, setEnviando] = useState(false)
  async function enviar() {
    setEnviando(true)
    const r = await executar(() => api.post(`ats/candidaturas/${x.candidatura.id}/comunicacoes`, { templateChave: chave }))
    setEnviando(false)
    if (!r) return
    if (r.status === 'enviada') toast('Mensagem enviada.')
    else if (r.status === 'nao_configurado') toast('Mensagem registrada, mas NÃO enviada: o e-mail não está configurado no servidor.', 'info')
    else toast(`Mensagem registrada, mas o envio falhou: ${r.erro ?? 'erro desconhecido'}.`, 'danger')
    recarregar()
  }
  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
      <Card className="p-5">
        <Field label="Enviar mensagem a partir de um modelo" htmlFor="cm-t">
          <Dropdown id="cm-t" className="input" value={chave} onChange={(e) => setChave(e.target.value)}><option value="">Escolha um modelo…</option>{(t.dados?.itens ?? []).map((i) => <option key={i.chave} value={i.chave}>{i.nome}</option>)}</Dropdown>
        </Field>
        <Button onClick={enviar} disabled={!chave || enviando}>{enviando ? 'Enviando…' : 'Enviar'}</Button>
        <p className="text-[11.5px] text-muted mt-3">O status só aparece como “Enviada” depois da confirmação do provedor de e-mail. Edite os modelos em Comunicação.</p>
      </Card>
      <div className="lg:col-span-2 space-y-3">
        {x.comunicacoes.length === 0 ? <Card><EmptyState icon="Mail" title="Nenhuma mensagem" /></Card> : x.comunicacoes.map((m: any) => (
          <Card key={m.id} className="p-4">
            <div className="flex justify-between gap-2"><b className="text-ink text-[13.5px]">{m.assunto}</b><StatusBadge mapa={ROTULO_STATUS_COMUNICACAO} valor={m.status} /></div>
            <div className="text-[12px] text-muted">{dataHoraBR(m.criadoEm)}</div>
            {m.erro && <p className="text-[12.5px] text-danger mt-1">{m.erro}</p>}
            <p className="text-[13px] text-ink-2 mt-2 whitespace-pre-wrap line-clamp-4">{m.corpo}</p>
          </Card>
        ))}
      </div>
    </div>
  )
}

/* ---------- Privacidade ---------- */
function Privacidade({ x, recarregar }: { x: any; recarregar: () => void }) {
  const podeAnonimizar = useStore((s) => s.currentUser().papel === 'rh' || s.currentUser().papel === 'admin')
  const [anon, setAnon] = useState(false)
  const [tal, setTal] = useState(false)
  const [f, setF] = useState({ comoAutorizou: '', tags: '', areas: '', retencaoMeses: '12' })
  const emTalentos = !!x.talento
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card className="p-5">
        <h3 className="font-bold text-ink mb-3">Consentimentos e base legal</h3>
        {x.consentimentos.length === 0 ? <p className="text-[13px] text-muted">Nenhum registro de consentimento/base legal. Candidaturas cadastradas manualmente exigem confirmação conforme a política da empresa.</p> : (
          <ul className="space-y-2.5">{x.consentimentos.map((c: any) => (
            <li key={c.id} className="text-[13px] border-b border-line pb-2 last:border-0">
              <b className="text-ink">{c.finalidade.replace('_', ' ')}</b> · {c.baseLegal.replace(/_/g, ' ')} · {c.concedido ? 'concedido' : 'não concedido'}{c.revogadoEm ? ' (revogado)' : ''}
              <div className="text-[12px] text-muted">{dataHoraBR(c.registradoEm)} · texto v. {String(c.textoVersao).slice(0, 80)}{c.validoAte ? ` · válido até ${dataBR(String(c.validoAte).slice(0, 10))}` : ''}</div>
            </li>))}</ul>
        )}
      </Card>
      <div className="space-y-5">
        <Card className="p-5">
          <h3 className="font-bold text-ink mb-1">Banco de talentos</h3>
          {emTalentos ? <p className="text-[13px] text-ink-2">Esta pessoa já está no banco de talentos. Gerencie em <Link className="text-brand" to="/recrutamento/talentos">Banco de talentos</Link>.</p> : (
            <><p className="text-[12.5px] text-muted mb-3">A inclusão exige autorização específica da pessoa para uso futuro dos dados. Candidatar-se a uma vaga não autoriza isso por si só.</p>
              <Button variant="soft" icon="Contact" onClick={() => setTal(true)} disabled={x.candidato.anonimizado}>Incluir no banco de talentos</Button></>
          )}
        </Card>
        {podeAnonimizar && !x.candidato.anonimizado && (
          <Card className="p-5">
            <h3 className="font-bold text-ink mb-1">Direitos do titular (LGPD)</h3>
            <p className="text-[12.5px] text-muted mb-3">Anonimizar apaga dados pessoais, currículo e textos livres, mantendo apenas estatísticas do processo. É irreversível e exige que não haja processos em andamento.</p>
            <Button variant="danger" icon="ShieldOff" onClick={() => setAnon(true)}>Anonimizar candidato</Button>
          </Card>
        )}
      </div>
      <Modal open={tal} onClose={() => setTal(false)} title="Incluir no banco de talentos" footer={<><Button variant="ghost" onClick={() => setTal(false)}>Cancelar</Button>
        <Button onClick={async () => { if (await executar(() => api.post('ats/talentos', { candidatoId: x.candidato.id, confirmaAutorizacao: true, comoAutorizou: f.comoAutorizou, tags: f.tags.split(',').map((s) => s.trim()).filter(Boolean), areas: f.areas.split(',').map((s) => s.trim()).filter(Boolean), retencaoMeses: Number(f.retencaoMeses) }), 'Incluído no banco de talentos.')) { setTal(false); recarregar() } }} disabled={!f.comoAutorizou.trim()}>Confirmar inclusão</Button></>}>
        <Field label="Como a pessoa autorizou o uso futuro dos dados?" required hint="Ex.: marcou a opção no formulário; respondeu e-mail em 10/10." htmlFor="tl-a"><textarea id="tl-a" className={TEXTAREA} value={f.comoAutorizou} onChange={(e) => setF({ ...f, comoAutorizou: e.target.value })} /></Field>
        <Field label="Tags (vírgula)" htmlFor="tl-t"><input id="tl-t" className="input" value={f.tags} onChange={(e) => setF({ ...f, tags: e.target.value })} /></Field>
        <Field label="Áreas de interesse (vírgula)" htmlFor="tl-ar"><input id="tl-ar" className="input" value={f.areas} onChange={(e) => setF({ ...f, areas: e.target.value })} /></Field>
        <Field label="Guardar por (meses)" htmlFor="tl-r"><input id="tl-r" type="number" min={1} max={60} className="input" value={f.retencaoMeses} onChange={(e) => setF({ ...f, retencaoMeses: e.target.value })} /></Field>
      </Modal>
      <ConfirmModal open={anon} onClose={() => setAnon(false)} titulo="Anonimizar este candidato?" confirmar="Anonimizar definitivamente"
        texto="Nome, contatos, currículo, respostas e textos livres serão apagados. Esta ação é irreversível."
        onConfirm={async () => { setAnon(false); if (await executar(() => api.post(`ats/candidatos/${x.candidato.id}/anonimizar`, { confirmar: true }), 'Candidato anonimizado.')) recarregar() }} />
    </div>
  )
}
