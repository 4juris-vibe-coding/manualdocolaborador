/* ============================================================
   ATS · resultados dos questionários da candidatura (fit cultural
   e DISC) com observações do RH. Apoio à decisão: nada aqui aprova
   ou reprova o candidato.
   ============================================================ */
import { useEffect, useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, Field, Progress } from '@/components/ui'
import { Aguardar } from '@/components/v2/estados'
import { api, executar, useApi } from '@/data/v2/api'
import { dataHoraBR } from '@/lib/fmt'
import { AVISO_APOIO, DIMENSOES, ROTULO_COMPAT, ROTULO_DIMENSAO, ROTULO_TIPO_PERGUNTA, ROTULO_TIPO_QUESTIONARIO, type Dimensao, type FaixaCompat } from '@/domain/v2/avaliacoesEtapa'

const TEXTAREA = 'input h-auto min-h-[84px] py-2.5 leading-relaxed resize-y'
const TOM_COMPAT: Record<FaixaCompat, string> = { alta: 'success', moderada: 'warning', baixa: 'neutral' }

export function AvaliacoesCandidato({ candidaturaId }: { candidaturaId: string }) {
  const r = useApi<any>(`ats/candidaturas/${candidaturaId}/questionarios`)
  return (
    <Aguardar r={r}>
      {(d) => (
        <div className="space-y-5">
          <Callout tone="neutral" icon="Scale">{AVISO_APOIO} As notas e a compatibilidade são referências para a conversa com o candidato; a decisão é sempre de uma pessoa.</Callout>
          {d.pendentes.length > 0 && (
            <Card className="p-5">
              <div className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Aguardando resposta do candidato</div>
              <ul className="space-y-1.5">{d.pendentes.map((p: any) => <li key={p.id} className="text-[13.5px] flex gap-2 items-center flex-wrap"><span className="text-ink">{p.titulo}</span><Badge tone="warning">{ROTULO_TIPO_QUESTIONARIO[p.tipo as 'disc']}</Badge></li>)}</ul>
              <p className="text-[12px] text-muted mt-2">O candidato responde pelo portal, com o código de acompanhamento, enquanto estiver nesta etapa.</p>
            </Card>
          )}
          {d.resultados.length === 0 && d.pendentes.length === 0 && <Card><EmptyState icon="ClipboardList" title="Nenhum questionário respondido" desc="Configure questionários por etapa na página da vaga (aba Etapas)." /></Card>}
          {d.resultados.map((x: any) => <Resultado key={x.id} x={x} podeObs={d.permissoes.observacoes} onSalvo={r.recarregar} />)}
        </div>
      )}
    </Aguardar>
  )
}

function Resultado({ x, podeObs, onSalvo }: { x: any; podeObs: boolean; onSalvo: () => void }) {
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
        <div>
          <div className="font-bold text-ink text-[15px]">{x.titulo}</div>
          <div className="text-[12px] text-muted">{ROTULO_TIPO_QUESTIONARIO[x.tipo as 'disc']} · {x.etapaNome ?? 'Etapa removida'} · respondido em {dataHoraBR(x.enviadoEm)}</div>
        </div>
        <Badge tone="neutral">Apoio à decisão</Badge>
      </div>
      {x.tipo === 'fit_cultural' ? <ResultadoFit f={x.fit} /> : <ResultadoDisc x={x} />}
      {podeObs && <Observacoes x={x} onSalvo={onSalvo} />}
    </Card>
  )
}

function ResultadoFit({ f }: { f: any }) {
  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-[200px_1fr] gap-5 mb-4">
        <div className="rounded-xl bg-surface-2 p-4">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted">Pontuação geral</div>
          <div className="text-[30px] font-extrabold text-ink leading-tight">{f.geral ?? '—'}{f.geral !== null && <span className="text-[14px] text-muted font-semibold"> /100</span>}</div>
          {f.faixa ? <Badge tone="brand" className="mt-1">{f.faixa.rotulo}</Badge> : <p className="text-[11.5px] text-muted mt-1">{f.temCriterios ? 'Nenhum critério atingido.' : 'Sem critérios de interpretação definidos.'}</p>}
          {f.faixa?.descricao && <p className="text-[12px] text-ink-2 mt-1.5">{f.faixa.descricao}</p>}
          <p className="text-[11.5px] text-muted mt-2">{f.pontuadas} pontuada(s) · {f.naoPontuadas} sem pontuação (lidas pelo RH)</p>
        </div>
        <div>
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted mb-2">Por competência</div>
          {f.competencias.length === 0 ? <p className="text-[13px] text-muted">Nenhuma pergunta pontuada ligada a competências.</p> : (
            <ul className="space-y-2.5">
              {f.competencias.map((c: any) => (
                <li key={c.competencia}>
                  <div className="flex justify-between text-[13px] mb-1"><span className="text-ink font-semibold">{c.competencia}</span><span className="text-ink-2">{c.nota}/100 · {c.perguntas} pergunta(s)</span></div>
                  <Progress value={c.nota} />
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
      <details className="group">
        <summary className="cursor-pointer text-[13px] font-semibold text-brand">Ver respostas ({f.respostas.length})</summary>
        <ol className="mt-3 space-y-3">
          {f.respostas.map((p: any, i: number) => (
            <li key={p.perguntaId} className="border-b border-line pb-3 last:border-0">
              <div className="text-[13px] text-muted">{i + 1}. {p.texto}</div>
              <div className="text-[13.5px] text-ink font-semibold whitespace-pre-wrap mt-0.5">{p.resposta ?? <span className="text-muted font-normal">Sem resposta</span>}</div>
              <div className="flex flex-wrap gap-1.5 mt-1.5">
                <Badge tone="neutral">{ROTULO_TIPO_PERGUNTA[p.tipo as 'aberta']}</Badge>
                {p.competencia && <Badge tone="brand">{p.competencia}</Badge>}
                {p.pontuada ? <Badge tone="neutral">Peso {p.peso}{p.pontos !== null ? ` · ${p.pontos} pts` : ''}</Badge> : <Badge tone="gold">Não pontuada</Badge>}
              </div>
              {p.criterio && <p className="text-[12px] text-muted mt-1.5"><b>Critério:</b> {p.criterio}</p>}
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}

function ResultadoDisc({ x }: { x: any }) {
  const d = x.disc
  const c = d.compatibilidade
  const perfil = d.perfilRecomendado
  return (
    <>
      {x.aviso && <Callout tone="warning" icon="AlertTriangle" className="mb-4">{x.aviso}</Callout>}
      <p className="text-[12px] text-muted mb-3">Instrumento: {x.instrumento?.nome} · versão {x.instrumento?.versao} · {d.itens} bloco(s) respondido(s)</p>
      <div className="grid grid-cols-1 md:grid-cols-[1fr_260px] gap-5">
        <ul className="space-y-3" aria-label="Pontuação por dimensão">
          {DIMENSOES.map((k: Dimensao) => (
            <li key={k}>
              <div className="flex justify-between text-[13px] mb-1">
                <span className="text-ink font-semibold">{k} · {ROTULO_DIMENSAO[k]}</span>
                <span className="text-ink-2">{d.pontuacao[k]}{perfil ? ` · recomendado ${perfil[k]}` : ''}</span>
              </div>
              <div className="relative">
                <Progress value={d.pontuacao[k]} />
                {perfil && <span aria-hidden className="absolute -top-1 h-4 w-0.5 bg-ink" style={{ left: `calc(${Math.max(0, Math.min(100, perfil[k]))}% - 1px)` }} title={`Recomendado: ${perfil[k]}`} />}
              </div>
            </li>
          ))}
          {perfil && <li className="text-[11.5px] text-muted">A marca escura indica o perfil recomendado para a vaga.</li>}
        </ul>
        <div className="rounded-xl bg-surface-2 p-4">
          {c ? (
            <>
              <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted">Compatibilidade com o perfil</div>
              <div className="text-[30px] font-extrabold text-ink leading-tight">{c.indice}<span className="text-[14px] text-muted font-semibold"> /100</span></div>
              <Badge tone={TOM_COMPAT[c.faixa as FaixaCompat]}>{ROTULO_COMPAT[c.faixa as FaixaCompat]}</Badge>
              <p className="text-[11.5px] text-muted mt-2">100 − média das diferenças por dimensão. Não aprova nem reprova.</p>
            </>
          ) : <p className="text-[13px] text-muted">Sem perfil recomendado definido para esta vaga: a compatibilidade não é calculada.</p>}
        </div>
      </div>
      {c && (
        <div className="mt-4">
          <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted mb-1.5">Justificativa</div>
          <ul className="list-disc pl-5 space-y-1 text-[13px] text-ink-2">{c.justificativa.map((t: string) => <li key={t}>{t}</li>)}</ul>
          {perfil?.justificativa && <p className="text-[13px] text-ink-2 mt-2"><b>Por que este perfil:</b> {perfil.justificativa}</p>}
        </div>
      )}
      <details className="mt-4">
        <summary className="cursor-pointer text-[13px] font-semibold text-brand">Ver escolhas do candidato</summary>
        <ol className="mt-3 space-y-2 text-[13px]">
          {d.escolhas.map((e: any, i: number) => (
            <li key={e.itemId} className="border-b border-line pb-2 last:border-0">
              <span className="text-muted">Bloco {i + 1}:</span> mais parece — <b className="text-ink">{e.mais?.texto ?? '—'}</b> ({e.mais?.dimensao ?? '—'}); menos parece — <b className="text-ink">{e.menos?.texto ?? '—'}</b> ({e.menos?.dimensao ?? '—'})
            </li>
          ))}
        </ol>
      </details>
    </>
  )
}

function Observacoes({ x, onSalvo }: { x: any; onSalvo: () => void }) {
  const [txt, setTxt] = useState(x.observacoesRh ?? '')
  useEffect(() => setTxt(x.observacoesRh ?? ''), [x.observacoesRh])
  const id = `obs-${x.id}`
  return (
    <div className="mt-5 pt-4 border-t border-line">
      <Field label="Observações do RH" htmlFor={id} hint={x.observacoesPor ? `Última edição: ${x.observacoesPor} · ${dataHoraBR(x.observacoesEm)}` : 'Visível só para quem tem acesso às notas do RH.'}>
        <textarea id={id} className={TEXTAREA} maxLength={3000} value={txt} onChange={(e) => setTxt(e.target.value)} />
      </Field>
      {txt !== (x.observacoesRh ?? '') && (
        <Button size="sm" icon="Save" onClick={async () => { if (await executar(() => api.patch(`ats/questionario-respostas/${x.id}`, { observacoesRh: txt }), 'Observações salvas.')) onSalvo() }}>Salvar observações</Button>
      )}
    </div>
  )
}
