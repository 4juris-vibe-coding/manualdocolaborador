/* Resultados de uma pesquisa: participação, eNPS, distribuições, recortes protegidos e respostas abertas. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, PageHeader, Select, StatCard, Tabela, TD, TH, useMostrarMais } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { LinhaTempo } from '@/components/v2/charts2'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { useStore } from '@/lib/store'
import { MODO_ROTULO, ROTULO_TIPO, STATUS_PESQUISA } from '@/domain/v2/pesquisaTipos'
import { destaquesDimensoes, LIMIAR_ATENCAO, LIMIAR_FORTE, type PerguntaResultado, type ResultadoPergunta, type ResultadosPesquisa } from '@/domain/v2/pesquisaCalculo'
import { PlanoAcao } from '@/components/v2/pesquisas/PlanoAcao'
import { dataBR, numero, pct } from '@/lib/fmt'

interface Dados {
  pesquisa: { id: string; titulo: string; status: string; modo: 'anonima' | 'identificada'; minGrupo: number; objetivo?: string; fim?: string; finalidade?: string; quemAcessa?: string }
  resultados: ResultadosPesquisa
  resumo: string[]
  comLinkPublico: boolean
}

function Barra({ rotulo, valor, qtd, cor = 'bg-brand' }: { rotulo: string; valor: number; qtd?: number; cor?: string }) {
  return (
    <li>
      <div className="flex justify-between text-[12.5px] mb-1 gap-3"><span className="text-ink-2">{rotulo}</span><span className="text-muted tabular-nums shrink-0">{qtd !== undefined ? `${qtd} · ` : ''}{pct(valor, 1)}</span></div>
      <div className="h-2.5 rounded-full bg-winter overflow-hidden"><div className={`h-full rounded-full ${cor}`} style={{ width: `${Math.min(100, valor)}%` }} /></div>
    </li>
  )
}

function Resultado({ r }: { r: ResultadoPergunta }) {
  if (r.tipo === 'nps') {
    const max = Math.max(1, ...r.distribuicao)
    return (
      <div>
        <div className="flex items-end gap-6 flex-wrap mb-3">
          <div><div className="text-[34px] font-extrabold tracking-tight text-ink leading-none">{r.enps ?? '—'}</div><div className="text-[12px] text-muted mt-1">eNPS (de −100 a 100)</div></div>
          <div className="text-[12.5px] text-ink-2 space-y-0.5"><div><b className="text-success">{pct(r.pctPromotores, 1)}</b> promotores (9–10)</div><div><b>{pct(r.pctNeutros, 1)}</b> neutros (7–8)</div><div><b className="text-danger">{pct(r.pctDetratores, 1)}</b> detratores (0–6)</div></div>
        </div>
        <div className="flex h-3 rounded-full overflow-hidden mb-4" role="img" aria-label={`Detratores ${r.pctDetratores}%, neutros ${r.pctNeutros}%, promotores ${r.pctPromotores}%`}>
          <div className="bg-danger" style={{ width: `${r.pctDetratores}%` }} /><div className="bg-platinum" style={{ width: `${r.pctNeutros}%` }} /><div className="bg-success" style={{ width: `${r.pctPromotores}%` }} />
        </div>
        <div className="flex items-end gap-1 h-24" aria-label="Distribuição das notas de 0 a 10">
          {r.distribuicao.map((q, i) => (
            <div key={i} className="flex-1 flex flex-col items-center justify-end h-full"><span className="text-[10.5px] text-muted mb-0.5">{q || ''}</span>
              <div className={`w-full rounded-t ${i >= 9 ? 'bg-success' : i >= 7 ? 'bg-platinum' : 'bg-danger/80'}`} style={{ height: `${(q / max) * 70}%`, minHeight: q ? 3 : 0 }} /><span className="text-[10.5px] text-muted mt-1">{i}</span></div>
          ))}
        </div>
      </div>
    )
  }
  if (r.tipo === 'numerica') return (
    <div>
      <div className="mb-3 text-[13px] text-ink-2"><span className="text-[26px] font-extrabold text-ink mr-2">{r.media ?? '—'}</span>média ({r.n} respostas)</div>
      <ul className="space-y-2">{r.distribuicao.map((d) => <Barra key={d.valor} rotulo={d.rotulo ? `${d.valor} · ${d.rotulo}` : String(d.valor)} valor={d.pct} qtd={d.qtd} />)}</ul>
    </div>
  )
  if (r.tipo === 'opcoes') return <ul className="space-y-2">{r.contagem.map((c) => <Barra key={c.opcao} rotulo={c.opcao} valor={c.pct} qtd={c.qtd} />)}</ul>
  if (r.tipo === 'ordenacao') return (
    <ol className="space-y-1.5 text-[13.5px]">{r.posicaoMedia.map((o, i) => <li key={o.opcao} className="flex gap-3"><span className="font-bold text-muted w-5">{i + 1}º</span><span className="flex-1">{o.opcao}</span><span className="text-muted">posição média {o.media}</span></li>)}</ol>
  )
  if (r.tipo === 'datas') return <ul className="text-[13px] text-ink-2 space-y-1">{r.porMes.map((m) => <li key={m.mes}>{m.mes.split('-').reverse().join('/')}: {m.qtd}</li>)}</ul>
  return <p className="text-[13px] text-muted">{r.n} respostas abertas.</p>
}

function resumoSegmento(r: ResultadoPergunta): string {
  if (r.tipo === 'nps') return `eNPS ${r.enps ?? '—'}`
  if (r.tipo === 'numerica') return `média ${r.media ?? '—'}`
  if (r.tipo === 'opcoes') { const t = [...r.contagem].sort((a, b) => b.qtd - a.qtd)[0]; return t ? `${t.opcao} (${pct(t.pct)})` : '—' }
  return '—'
}

function Segmentos({ titulo, segs }: { titulo: string; segs: NonNullable<PerguntaResultado['porSetor']> }) {
  return (
    <div className="mt-5">
      <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">{titulo}</h4>
      <Tabela minWidth={420}>
        <thead><tr><th className={TH}>Grupo</th><th className={TH}>Respostas</th><th className={TH}>Resultado</th></tr></thead>
        <tbody>{segs.map((s) => (
          <tr key={s.chave}>
            <td className={TD}>{s.rotulo}</td><td className={TD}>{s.suprimido ? '—' : s.n}</td>
            <td className={TD}>{s.suprimido || !s.resultado ? <Badge>oculto — poucas respostas</Badge> : resumoSegmento(s.resultado)}</td>
          </tr>
        ))}</tbody>
      </Tabela>
    </div>
  )
}

function Abertas({ pesquisaId, p, pode, onMudou }: { pesquisaId: string; p: PerguntaResultado; pode: boolean; onMudou: () => void }) {
  const [filtro, setFiltro] = useState('')
  const [novaTag, setNovaTag] = useState<Record<string, string>>({})
  const tags = [...new Set((p.textos ?? []).flatMap((t) => t.tags))].sort()
  const lista = (p.textos ?? []).filter((t) => !filtro || t.tags.includes(filtro))
  const mais = useMostrarMais(lista.length, 10, 20)
  async function salvar(respostaId: string, novas: string[]) {
    await executar(() => api.post(`pesquisas/${pesquisaId}/tags`, { respostaId, perguntaId: p.id, tags: novas }))
    onMudou()
  }
  if (!p.textos) return <p className="text-[13px] text-muted">{p.n} respostas abertas. O texto só é exibido quando o total de respostas atinge o mínimo e sem filtros ativos (proteção do anonimato).</p>
  return (
    <div>
      <div className="flex items-center gap-3 mb-3 flex-wrap">
        <span className="text-[13px] text-muted">{lista.length} de {p.textos.length} respostas</span>
        {tags.length > 0 && <Select label="Filtrar por marcador" value={filtro} onChange={setFiltro}><option value="">Todos os marcadores</option>{tags.map((t) => <option key={t} value={t}>{t}</option>)}</Select>}
      </div>
      <ul className="space-y-2.5">
        {lista.slice(0, mais.limite).map((t) => (
          <li key={t.respostaId} className="rounded-xl border border-line px-3.5 py-3">
            <p className="text-[13.5px] text-ink whitespace-pre-line">{t.texto}</p>
            <div className="flex flex-wrap items-center gap-1.5 mt-2">
              {t.tags.map((g) => (
                <span key={g} className="inline-flex items-center gap-1 rounded-full bg-brand-100 text-brand-700 text-[11.5px] font-semibold pl-2.5 pr-1.5 py-1">{g}
                  {pode && <button type="button" aria-label={`Remover marcador ${g}`} className="h-4 w-4 rounded-full hover:bg-brand-200" onClick={() => salvar(t.respostaId!, t.tags.filter((x) => x !== g))}>×</button>}</span>
              ))}
              {pode && (
                <form className="inline-flex" onSubmit={(e) => { e.preventDefault(); const v = (novaTag[t.respostaId!] ?? '').trim(); if (v) { void salvar(t.respostaId!, [...t.tags, v]); setNovaTag((s) => ({ ...s, [t.respostaId!]: '' })) } }}>
                  <input aria-label="Novo marcador" placeholder="+ marcador" maxLength={30} className="h-7 w-28 rounded-full border border-line bg-surface px-2.5 text-[12px] outline-none focus:border-brand" value={novaTag[t.respostaId!] ?? ''} onChange={(e) => setNovaTag((s) => ({ ...s, [t.respostaId!]: e.target.value }))} />
                </form>
              )}
            </div>
          </li>
        ))}
      </ul>
      {mais.botao}
      <p className="text-[11.5px] text-muted mt-2">Marcadores são aplicados manualmente por quem analisa. Não há resumo por IA nesta tela.</p>
    </div>
  )
}

/** Pontos fortes e pontos de atenção por dimensão: o que foi observado, separado do que ainda é hipótese. */
function Destaques({ res }: { res: ResultadosPesquisa }) {
  const d = destaquesDimensoes(res.dimensoes, res.minGrupo)
  if (!d.fortes.length && !d.atencao.length) return null
  const fmt = (m: number) => m.toLocaleString('pt-BR', { maximumFractionDigits: 2 })
  return (
    <Card>
      <CardHead title="Pontos fortes e pontos de atenção" sub={`Critério: média ≥ ${fmt(LIMIAR_FORTE)} é ponto forte; abaixo de ${fmt(LIMIAR_ATENCAO)} merece investigação (escala de 1 a 5).`} />
      <div className="p-5 grid grid-cols-1 gap-5 sm:grid-cols-2">
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-success mb-2">Pontos fortes · observado</h4>
          {d.fortes.length ? <ul className="space-y-1 text-[13.5px] text-ink-2">{d.fortes.map((x) => <li key={x.dimensao}><b className="text-ink">{x.dimensao}</b>: média {fmt(x.media)}</li>)}</ul> : <p className="text-[13px] text-muted">Nenhuma dimensão com média ≥ {fmt(LIMIAR_FORTE)}.</p>}
        </div>
        <div>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-danger mb-2">Merecem investigação · observado</h4>
          {d.atencao.length ? <ul className="space-y-1 text-[13.5px] text-ink-2">{d.atencao.map((x) => <li key={x.dimensao}><b className="text-ink">{x.dimensao}</b>: média {fmt(x.media)}</li>)}</ul> : <p className="text-[13px] text-muted">Nenhuma dimensão abaixo de {fmt(LIMIAR_ATENCAO)}.</p>}
        </div>
      </div>
      <p className="px-5 pb-4 text-[12px] text-muted">As médias mostram <b>o que</b> as pessoas responderam, não <b>por quê</b>. Trate as causas como hipóteses: converse com as equipes antes de definir a ação no plano abaixo.</p>
    </Card>
  )
}

export default function Resultados() {
  const { id = '' } = useParams()
  const setores = useStore((s) => s.setores)
  const unidades = useStore((s) => s.unidades)
  const gerencia = useTem('pesq:gerenciar')
  const exporta = useTem('pesq:exportar')
  const [setorId, setSetorId] = useState('')
  const [unidadeId, setUnidadeId] = useState('')
  const [individuais, setIndividuais] = useState(false)
  const filtros = qs({ setorId, unidadeId })
  const r = useApi<Dados>(`pesquisas/${id}/resultados${filtros}`)
  const ind = useApi<{ finalidade: string; quemAcessa: string; enunciados?: Record<string, string>; itens: { respostaId: string; nome: string; enviadaEm: string; itens: Record<string, unknown> }[] }>(individuais ? `pesquisas/${id}/respostas-individuais` : null)

  return (
    <>
      <Aguardar r={r}>
        {(d) => {
          const res = d.resultados
          return (
            <>
              <PageHeader title={d.pesquisa.titulo} subtitle={d.pesquisa.objetivo}
                eyebrow={<div className="flex gap-2 items-center"><StatusBadge mapa={STATUS_PESQUISA} valor={d.pesquisa.status} /><Badge tone={d.pesquisa.modo === 'anonima' ? 'success' : 'warning'}>{MODO_ROTULO[d.pesquisa.modo]}</Badge></div>}
                actions={<>
                  <Link to="/pesquisas-rh/lista"><Button variant="ghost" icon="ArrowLeft">Pesquisas</Button></Link>
                  {gerencia && d.pesquisa.status !== 'encerrada' && <Link to={`/pesquisas-rh/${id}`}><Button variant="ghost" icon="Settings2">Gerenciar</Button></Link>}
                  {gerencia && d.pesquisa.modo === 'identificada' && <Button variant="ghost" icon="Users" onClick={() => setIndividuais(true)}>Respostas individuais</Button>}
                  {exporta && <a href={api.url(`pesquisas/${id}/resultados.csv${filtros}`)}><Button icon="Download">Exportar CSV</Button></a>}
                </>} />
              <SoComBanco>
                <div className="space-y-6">
                  <Callout tone={d.pesquisa.modo === 'anonima' ? 'success' : 'warning'} icon={d.pesquisa.modo === 'anonima' ? 'ShieldCheck' : 'Eye'}>
                    {d.pesquisa.modo === 'anonima'
                      ? <>Pesquisa <b>anônima</b>: não há como saber quem respondeu. Grupos com menos de <b>{d.pesquisa.minGrupo}</b> respostas ficam ocultos, e filtros que identificariam pessoas são bloqueados.</>
                      : <>Pesquisa <b>identificada</b>. Finalidade: {d.pesquisa.finalidade}. Quem pode acessar: {d.pesquisa.quemAcessa}.</>}
                  </Callout>

                  <div className="flex flex-wrap gap-3 items-center">
                    <Select label="Filtrar por área" value={setorId} onChange={setSetorId}><option value="">Todas as áreas</option>{setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select>
                    <Select label="Filtrar por unidade" value={unidadeId} onChange={setUnidadeId}><option value="">Todas as unidades</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select>
                    {(setorId || unidadeId) && <Button variant="subtle" size="sm" icon="X" onClick={() => { setSetorId(''); setUnidadeId('') }}>Limpar filtros</Button>}
                  </div>

                  {res.filtroBloqueado ? <Callout tone="danger" icon="ShieldAlert"><b>Recorte bloqueado.</b> {res.filtroBloqueado}</Callout> : (
                    <>
                      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
                        <StatCard icon="MessageSquareText" tone="success" value={numero(res.total)} label="Respostas" />
                        <StatCard icon="Users" value={d.comLinkPublico ? '—' : numero(res.elegiveis)} label={d.comLinkPublico ? 'Elegíveis (link público: indisponível)' : 'Elegíveis'} />
                        <StatCard icon="Percent" tone="brand" value={res.taxaResposta === null ? '—' : pct(res.taxaResposta, 1)} label="Taxa de resposta (participação)" />
                        <StatCard icon="Gauge" tone="ink" value={res.enps?.enps ?? '—'} label={res.enps ? 'eNPS' : 'eNPS (sem pergunta eNPS)'} />
                      </div>

                      {res.suprimido ? (
                        <Card><EmptyState icon="ShieldCheck" title="Resultados protegidos" desc={`Há ${res.total} resposta(s). Os resultados só aparecem a partir de ${res.minGrupo} respostas, para proteger o anonimato.`} /></Card>
                      ) : (
                        <>
                          <Card>
                            <CardHead title="Resumo executivo" sub="Texto gerado automaticamente por regras (não é inteligência artificial)." />
                            <div className="p-5 space-y-2 text-[14px] text-ink-2">{d.resumo.map((l, i) => <p key={i}>{l}</p>)}</div>
                          </Card>

                          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                            <Card><CardHead title="Evolução das respostas" sub="Acumulado por data de envio" />
                              <div className="p-5"><LinhaTempo titulo="Respostas acumuladas" pontos={res.evolucao.map((e) => ({ rotulo: dataBR(e.data).slice(0, 5), valor: e.acumulado }))} /></div></Card>
                            <Card><CardHead title="Médias por dimensão" sub="Perguntas Likert e estrelas (escala de 1 a 5)" />
                              {res.dimensoes.length === 0 ? <p className="p-5 text-[13px] text-muted">Esta pesquisa não tem perguntas de escala agrupadas por dimensão.</p> : (
                                <ul className="p-5 space-y-2.5">{res.dimensoes.map((x) => <Barra key={x.dimensao} rotulo={`${x.dimensao} (${x.perguntas} perg.)`} valor={(x.media / 5) * 100} cor="bg-brand" />)}</ul>)}
                              {res.dimensoes.length > 0 && <div className="px-5 pb-4 text-[11.5px] text-muted">Barra = média ÷ 5. Médias: {res.dimensoes.map((x) => `${x.dimensao} ${x.media}`).join(' · ')}.</div>}
                            </Card>
                          </div>

                          <Destaques res={res} />

                          {res.porVersao.length > 1 && (
                            <Callout tone="brand" icon="GitBranch">A pesquisa teve {res.porVersao.length} versões ({res.porVersao.map((v) => `v${v.versao}: ${v.n}`).join(', ')}). Respostas só são somadas entre versões quando a pergunta continua idêntica (mesmo enunciado, tipo e escala).</Callout>
                          )}

                          {res.perguntas.map((p, i) => (
                            <Card key={p.id}>
                              <div className="px-5 pt-5">
                                <div className="text-[11.5px] font-bold uppercase tracking-wide text-muted">Pergunta {i + 1} · {ROTULO_TIPO[p.tipo]}{p.dimensao ? ` · ${p.dimensao}` : ''}</div>
                                <h3 className="text-[15.5px] font-bold text-ink mt-1">{p.texto}</h3>
                                {p.versoesNaoComparaveis.length > 0 && <p className="text-[12px] text-warning mt-1">Redação/escala alterada: respostas das versões {p.versoesNaoComparaveis.join(', ')} não foram somadas. Aqui: versão(ões) {p.versoes.join(', ')}.</p>}
                              </div>
                              <div className="p-5">
                                {p.textos !== undefined || (p.resultado?.tipo === 'texto')
                                  ? <Abertas pesquisaId={id} p={p} pode={gerencia} onMudou={r.recarregar} />
                                  : p.resultado && <Resultado r={p.resultado} />}
                                {p.porSetor && <Segmentos titulo="Por área" segs={p.porSetor} />}
                                {p.porUnidade && <Segmentos titulo="Por unidade" segs={p.porUnidade} />}
                              </div>
                            </Card>
                          ))}
                        </>
                      )}
                    </>
                  )}

                  <PlanoAcao pesquisaId={id} pode={gerencia}
                    dimensoes={[...new Set([...res.dimensoes.map((x) => x.dimensao), ...res.perguntas.map((p) => p.dimensao).filter((x): x is string => !!x)])]}
                    sugestoes={res.filtroBloqueado || res.suprimido ? [] : destaquesDimensoes(res.dimensoes, res.minGrupo).atencao} />
                </div>
              </SoComBanco>
            </>
          )
        }}
      </Aguardar>

      <Modal open={individuais} onClose={() => setIndividuais(false)} wide title="Respostas individuais" subtitle="Pesquisa identificada — cada consulta é registrada na auditoria.">
        <Aguardar r={ind}>
          {(d) => (
            <div className="pb-3">
              <p className="text-[12.5px] text-muted mb-3">Finalidade: {d.finalidade}. Acesso: {d.quemAcessa}.</p>
              {d.itens.length === 0 ? <p className="text-[13px] text-muted">Nenhuma resposta ainda.</p> : (
                <ul className="space-y-3">{d.itens.map((x) => (
                  <li key={x.respostaId} className="rounded-xl border border-line p-3.5"><div className="font-semibold text-ink text-[13.5px]">{x.nome} <span className="text-muted font-normal">· {dataBR(x.enviadaEm)}</span></div>
                    <dl className="mt-2 space-y-1 text-[12.5px]">{Object.entries(x.itens).map(([k, v]) => <div key={k} className="flex gap-2"><dt className="text-muted max-w-[55%]">{d.enunciados?.[k] ?? k}:</dt><dd className="text-ink-2 break-words">{Array.isArray(v) ? v.join(', ') : String(v)}</dd></div>)}</dl></li>
                ))}</ul>)}
            </div>
          )}
        </Aguardar>
      </Modal>
    </>
  )
}
