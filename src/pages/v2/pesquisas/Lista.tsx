/* Lista de pesquisas com filtros, participação e ações rápidas. */
import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, Progress, SearchBox, Select, Tabela, TD, TH } from '@/components/ui'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { Paginacao } from '@/components/v2/Paginacao'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { MODO_ROTULO, STATUS_PESQUISA } from '@/domain/v2/pesquisaTipos'
import { CATEGORIAS_MODELO } from '@/domain/v2/pesquisaModelos'
import { dataBR, pct } from '@/lib/fmt'
import { useTem } from '@/data/v2/acesso'

interface Item {
  id: string; titulo: string; status: string; modo: 'anonima' | 'identificada'; categoria: string; inicio?: string; fim?: string
  convidados: number; respostas: number; pendentes: number; taxaResposta: number | null
}
interface Pagina { itens: Item[]; total: number; pagina: number; por: number }

export default function Lista() {
  const nav = useNavigate()
  const gerencia = useTem('pesq:gerenciar')
  const [status, setStatus] = useState('')
  const [categoria, setCategoria] = useState('')
  const [modo, setModo] = useState('')
  const [q, setQ] = useState('')
  const [pagina, setPagina] = useState(1)
  const r = useApi<Pagina>(`pesquisas${qs({ status, categoria, modo, q, pagina })}`)

  async function duplicar(id: string) {
    const n = await executar(() => api.post<{ id: string }>(`pesquisas/${id}/duplicar`), 'Pesquisa duplicada como rascunho.')
    if (n) nav(`/pesquisas-rh/${n.id}`)
  }
  const filtrar = (f: () => void) => { f(); setPagina(1) }

  return (
    <>
      <PageHeader title="Pesquisas" subtitle="Crie, distribua e acompanhe pesquisas organizacionais."
        actions={gerencia && <><Button variant="ghost" icon="LibraryBig" onClick={() => nav('/pesquisas-rh/modelos')}>Modelos</Button><Button icon="Plus" onClick={() => nav('/pesquisas-rh/nova')}>Nova pesquisa</Button></>} />
      <SoComBanco>
        <div className="flex flex-wrap gap-3 mb-5">
          <SearchBox value={q} onChange={(v) => filtrar(() => setQ(v))} placeholder="Buscar pesquisa…" label="Buscar pesquisa" />
          <Select label="Situação" value={status} onChange={(v) => filtrar(() => setStatus(v))}>
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_PESQUISA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </Select>
          <Select label="Categoria" value={categoria} onChange={(v) => filtrar(() => setCategoria(v))}>
            <option value="">Todas as categorias</option>
            {CATEGORIAS_MODELO.map((c) => <option key={c} value={c}>{c}</option>)}
            <option value="Personalizada">Personalizada</option>
          </Select>
          <Select label="Tipo" value={modo} onChange={(v) => filtrar(() => setModo(v))}>
            <option value="">Anônimas e identificadas</option>
            <option value="anonima">Anônimas</option>
            <option value="identificada">Identificadas</option>
          </Select>
        </div>
        <Aguardar r={r} vazio={(d) => (d.total === 0
          ? <Card><EmptyState icon="ClipboardList" title={status || categoria || modo || q ? 'Nenhuma pesquisa com esses filtros' : 'Nenhuma pesquisa ainda'}
              desc={status || categoria || modo || q ? 'Limpe os filtros para ver todas.' : 'Comece por um modelo pronto ou crie uma pesquisa do zero.'}
              action={gerencia && <Button icon="LibraryBig" onClick={() => nav('/pesquisas-rh/modelos')}>Ver modelos</Button>} /></Card>
          : null)}>
          {(d) => (
            <Card className="overflow-hidden">
              <Tabela minWidth={820}>
                <thead><tr><th className={TH}>Pesquisa</th><th className={TH}>Situação</th><th className={TH}>Período</th><th className={TH}>Participação</th><th className={TH}><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>
                  {d.itens.map((p) => (
                    <tr key={p.id}>
                      <td className={TD}>
                        <Link to={p.status === 'encerrada' || !gerencia ? `/pesquisas-rh/${p.id}/resultados` : `/pesquisas-rh/${p.id}`} className="font-semibold text-ink hover:text-brand">{p.titulo}</Link>
                        <div className="flex gap-1.5 mt-1.5"><Badge tone={p.modo === 'anonima' ? 'success' : 'warning'}>{MODO_ROTULO[p.modo]}</Badge><span className="text-[12px] text-muted self-center">{p.categoria}</span></div>
                      </td>
                      <td className={TD}><StatusBadge mapa={STATUS_PESQUISA} valor={p.status} /></td>
                      <td className={`${TD} text-[12.5px] text-muted whitespace-nowrap`}>{p.inicio ? dataBR(p.inicio) : '—'} → {p.fim ? dataBR(p.fim) : '—'}</td>
                      <td className={TD}>
                        {p.status === 'rascunho' ? <span className="text-[12.5px] text-muted">—</span> : (
                          <div className="min-w-[140px]">
                            <div className="text-[12.5px] text-ink-2 mb-1">{p.respostas} de {p.convidados} · <b>{pct(p.taxaResposta)}</b></div>
                            <Progress value={p.taxaResposta ?? 0} />
                          </div>
                        )}
                      </td>
                      <td className={`${TD} text-right whitespace-nowrap`}>
                        {p.status !== 'rascunho' && <Button size="sm" variant="ghost" icon="BarChart3" onClick={() => nav(`/pesquisas-rh/${p.id}/resultados`)}>Resultados</Button>}{' '}
                        {gerencia && <Button size="sm" variant="subtle" icon="Copy" aria-label={`Duplicar ${p.titulo}`} onClick={() => duplicar(p.id)} />}
                        {gerencia && p.status !== 'encerrada' && <Button size="sm" variant="subtle" icon="Pencil" aria-label={`Editar ${p.titulo}`} onClick={() => nav(`/pesquisas-rh/${p.id}`)} />}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={setPagina} />
            </Card>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
