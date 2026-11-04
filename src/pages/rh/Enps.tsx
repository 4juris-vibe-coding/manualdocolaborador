/* eNPS · satisfação e recomendação. Usa os resultados AGREGADOS da Central de pesquisas
   (anonimato e supressão de grupos pequenos aplicados no servidor). Nada individual chega aqui. */
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardHead, Badge, Button, Callout, Icon, Select, Tabela, TH, TD, EmptyState } from '@/components/ui'
import { SoComBanco, Aguardar } from '@/components/v2/estados'
import { LinhasMensais } from '@/components/rh/GraficosMensais'
import { qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { hojeISO, somarDias } from '@/domain/datas'

interface PontoEnps { pesquisaId: string; titulo: string; data: string; enps: number; n: number; promotores: number; neutros: number; detratores: number; pctPromotores: number; pctNeutros: number; pctDetratores: number; convidados: number; taxa: number | null }
interface Serie { pergunta: string; comparavel: boolean; pontos: PontoEnps[] }
interface Bloco { disponivel: boolean; motivo?: string; seriesEnps?: Serie[]; pesquisas?: { id: string; titulo: string; status: string; inicio: string | null; fim: string | null; convidados: number; respostas: number | null; taxa: number | null; enps: (Omit<PontoEnps, 'pesquisaId' | 'titulo' | 'data' | 'enps' | 'convidados' | 'taxa'> & { valor: number }) | null; suprimido: boolean; motivo?: string }[]; avisoAnonimato?: string }

const fmt = (n: number) => n.toLocaleString('pt-BR', { maximumFractionDigits: 1 })
const faixa = (v: number) => (v >= 50 ? { r: 'Excelente', t: 'success' } : v >= 10 ? { r: 'Bom', t: 'brand' } : v >= -10 ? { r: 'Neutro', t: 'neutral' } : { r: 'Crítico', t: 'warning' })
const COR = { promotor: 'var(--viz-1)', neutro: 'rgb(var(--c-platinum))', detrator: 'var(--viz-2)' }

export default function Enps() {
  const hoje = hojeISO()
  const [janela, setJanela] = useState('365')
  const de = somarDias(hoje, -Number(janela))
  const r = useApi<{ blocos: Record<string, Bloco> }>(`analytics/resumo${qs({ de, ate: hoje })}`)
  const gerencia = useTem('pesq:gerenciar')
  return (
    <SoComBanco>
      <PageHeader title="eNPS" subtitle="Quanto as pessoas recomendariam a 4JURIS como lugar para trabalhar. Escala de 0 a 10."
        actions={gerencia ? <Link to="/pesquisas-rh/modelos"><Button icon="Plus">Nova pesquisa eNPS</Button></Link> : undefined} />
      <div className="flex flex-wrap items-end gap-3 mb-5">
        <Select label="Período" value={janela} onChange={setJanela}><option value="180">Últimos 6 meses</option><option value="365">Últimos 12 meses</option><option value="730">Últimos 24 meses</option><option value="1825">Últimos 5 anos</option></Select>
        <Link to="/pesquisas-rh/lista" className="text-[13px] font-semibold text-brand hover:underline mb-2">Ver todas as pesquisas e a adesão →</Link>
      </div>
      <Aguardar r={r}>{(d) => <Conteudo b={d.blocos.pesquisas} />}</Aguardar>
    </SoComBanco>
  )
}

function Conteudo({ b }: { b?: Bloco }) {
  const [serieIdx, setSerieIdx] = useState(0)
  const [sel, setSel] = useState<string | null>(null)
  if (!b || !b.disponivel) return <Card><EmptyState icon="Lock" title="Sem acesso aos resultados de pesquisas" desc={b?.motivo ?? 'Peça ao RH a permissão de ver resultados de pesquisas.'} /></Card>
  const series = b.seriesEnps ?? []
  const comEnps = (b.pesquisas ?? []).filter((p) => p.enps)
  if (!comEnps.length) return (
    <Card><EmptyState icon="Smile" title="Nenhuma pesquisa com eNPS no período" desc="Crie uma pesquisa a partir do modelo eNPS na Central de pesquisas. Os resultados aparecem quando houver respostas suficientes para preservar o anonimato." /></Card>
  )
  const ultima = comEnps[comEnps.length - 1]
  const anterior = comEnps[comEnps.length - 2]
  const e = ultima.enps!
  const delta = anterior?.enps ? Math.round((e.valor - anterior.enps.valor) * 10) / 10 : null
  const f = faixa(e.valor)
  const serie = series[serieIdx]
  return (
    <>
      <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-2">Pesquisa mais recente · {ultima.titulo}</h2>
      <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-5">
        <Card className="p-4 col-span-2 lg:col-span-1">
          <div className="text-[11.5px] text-muted">eNPS</div>
          <div className="text-[30px] font-extrabold text-ink leading-tight">{e.valor > 0 ? '+' : ''}{fmt(e.valor)}</div>
          <Badge tone={f.t}>{f.r}</Badge>
          {delta != null && <div className={`text-[11.5px] font-semibold mt-1 ${delta > 0 ? 'text-success' : delta < 0 ? 'text-danger' : 'text-muted'}`}>{delta > 0 ? '+' : ''}{fmt(delta)} pts vs pesquisa anterior</div>}
        </Card>
        <Grupo rotulo="Promotores (9–10)" n={e.promotores} pct={e.pctPromotores} cor={COR.promotor} />
        <Grupo rotulo="Neutros (7–8)" n={e.neutros} pct={e.pctNeutros} cor={COR.neutro} />
        <Grupo rotulo="Detratores (0–6)" n={e.detratores} pct={e.pctDetratores} cor={COR.detrator} />
        <Card className="p-4"><div className="text-[11.5px] text-muted">Adesão</div><div className="text-[22px] font-extrabold text-ink">{ultima.taxa != null ? `${fmt(ultima.taxa)}%` : '—'}</div><div className="text-[11.5px] text-muted">{e.n} resposta(s){ultima.convidados ? ` de ${ultima.convidados} convidados` : ''}</div></Card>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-5 mb-5">
        <Card>
          <CardHead title="Evolução do eNPS" sub={serie?.comparavel ? 'Só pesquisas com a mesma pergunta (redação e escala idênticas) são comparadas.' : 'É preciso ao menos duas pesquisas com a mesma pergunta para comparar.'}
            action={series.length > 1 ? <Select label="Pergunta" value={String(serieIdx)} onChange={(v) => setSerieIdx(Number(v))}>{series.map((s, i) => <option key={i} value={i}>{s.pergunta.slice(0, 60)}</option>)}</Select> : undefined} />
          <div className="p-4">{serie && serie.pontos.length ? (
            <LinhasMensais titulo="eNPS por pesquisa" meses={serie.pontos.map((p, i, a) => { const m = (p.data || '').slice(0, 7); return a.slice(0, i).some((x) => (x.data || '').slice(0, 7) === m) ? `${m}~${i}` : m })} selecionado={sel} onSelecionar={setSel}
              formato={(v) => `${v > 0 ? '+' : ''}${fmt(v)}`} series={[{ nome: 'eNPS', cor: 'var(--viz-1)', valores: serie.pontos.map((p) => p.enps) }]} />
          ) : <EmptyState icon="LineChart" title="Sem série comparável" />}</div>
        </Card>
        <Card>
          <CardHead title="Composição por pesquisa" sub="Promotores, neutros e detratores (% das respostas)." />
          <ul className="p-5 space-y-3">
            <li className="flex flex-wrap gap-4 text-[12px] text-ink-2" aria-label="Legenda">{(['promotor', 'neutro', 'detrator'] as const).map((k) => <span key={k} className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: COR[k] }} />{k === 'promotor' ? 'Promotores' : k === 'neutro' ? 'Neutros' : 'Detratores'}</span>)}</li>
            {comEnps.slice().reverse().map((p) => (
              <li key={p.id}>
                <div className="flex justify-between text-[12.5px] mb-1"><span className="font-semibold text-ink truncate">{p.titulo}</span><span className="text-ink-2">eNPS {p.enps!.valor > 0 ? '+' : ''}{fmt(p.enps!.valor)} · {p.enps!.n} resp.</span></div>
                <div className="flex h-3 rounded-full overflow-hidden gap-[2px] bg-surface" role="img" aria-label={`${p.titulo}: ${fmt(p.enps!.pctPromotores)}% promotores, ${fmt(p.enps!.pctNeutros)}% neutros, ${fmt(p.enps!.pctDetratores)}% detratores`}>
                  {[[p.enps!.pctPromotores, COR.promotor], [p.enps!.pctNeutros, COR.neutro], [p.enps!.pctDetratores, COR.detrator]].map(([v, c], i) => Number(v) > 0 && <span key={i} title={`${fmt(Number(v))}%`} style={{ width: `${v}%`, background: String(c) }} />)}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      </div>

      <Card className="mb-5">
        <CardHead title="Histórico de pesquisas" sub="Clique no título para ver o resultado completo." />
        <Tabela minWidth={820}>
          <thead><tr>{['Pesquisa', 'Período', 'Situação', 'Convidados', 'Respostas', 'Adesão', 'Promotores', 'Neutros', 'Detratores', 'eNPS'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>{(b.pesquisas ?? []).slice().reverse().map((p) => (
            <tr key={p.id}>
              <td className={TD}><Link to={`/pesquisas-rh/${p.id}/resultados`} className="font-semibold text-ink hover:text-brand">{p.titulo}</Link></td>
              <td className={TD}>{[p.inicio, p.fim].filter(Boolean).map((x) => x!.split('-').reverse().join('/')).join(' a ') || '—'}</td>
              <td className={TD}><Badge tone="neutral">{p.status}</Badge></td>
              <td className={TD}>{p.convidados || '—'}</td><td className={TD}>{p.respostas ?? 'oculto'}</td><td className={TD}>{p.taxa != null ? `${fmt(p.taxa)}%` : '—'}</td>
              <td className={TD}>{p.enps ? `${p.enps.promotores} (${fmt(p.enps.pctPromotores)}%)` : '—'}</td>
              <td className={TD}>{p.enps ? `${p.enps.neutros} (${fmt(p.enps.pctNeutros)}%)` : '—'}</td>
              <td className={TD}>{p.enps ? `${p.enps.detratores} (${fmt(p.enps.pctDetratores)}%)` : '—'}</td>
              <td className={TD}><b>{p.enps ? `${p.enps.valor > 0 ? '+' : ''}${fmt(p.enps.valor)}` : p.suprimido ? 'oculto' : '—'}</b></td>
            </tr>
          ))}</tbody>
        </Tabela>
      </Card>

      <Card className="p-5">
        <h3 className="text-[14px] font-bold text-ink flex items-center gap-2"><Icon name="Sigma" className="h-4 w-4" />Metodologia e anonimato</h3>
        <ul className="mt-2 space-y-1.5 text-[13px] text-ink-2 list-disc pl-5">
          <li>Pergunta: “Em uma escala de 0 a 10, o quanto você recomendaria a 4JURIS como lugar para trabalhar?”. <b>Detratores</b>: 0 a 6 · <b>Neutros</b>: 7 e 8 · <b>Promotores</b>: 9 e 10.</li>
          <li><b>eNPS = % de promotores − % de detratores</b>, de −100 a +100.</li>
          <li>Faixas de leitura usadas aqui: −100 a −11 crítico · −10 a +9 neutro · +10 a +49 bom · +50 a +100 excelente.</li>
          <li>{b.avisoAnonimato ?? 'Somente resultados agregados.'} Em pesquisas anônimas, a resposta não guarda quem respondeu nem a hora: nem o RH nem a administração conseguem identificar participantes.</li>
          <li>Adesão = respostas ÷ convidados (pesquisas com convite individual). Pesquisas por link público não têm adesão calculável.</li>
        </ul>
      </Card>
      <Callout tone="neutral" icon="Info" className="mt-5">Para criar uma pesquisa eNPS, definir o período de respostas, convidar pessoas e acompanhar a adesão, use a <Link to="/pesquisas-rh" className="font-semibold text-brand">Central de pesquisas</Link> (modelo “eNPS”).</Callout>
    </>
  )
}

function Grupo({ rotulo, n, pct, cor }: { rotulo: string; n: number; pct: number; cor: string }) {
  return (
    <Card className="p-4">
      <div className="text-[11.5px] text-muted flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: cor }} />{rotulo}</div>
      <div className="text-[22px] font-extrabold text-ink">{n}</div>
      <div className="text-[11.5px] text-muted">{fmt(pct)}% das respostas</div>
    </Card>
  )
}
