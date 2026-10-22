import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, StatCard, Badge, SearchBox, Select, Tabela, TH, TD, EmptyState, Tabs, Button } from '@/components/ui'
import { Aguardar } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { TelaCargos, STATUS_FICHA, type ItemCatalogo, type Taxonomia } from '@/components/v2/cargos/comum'
import { useApi, qs } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'

interface Resp { itens: ItemCatalogo[]; total: number; pagina: number; por: number; resumo: { total: number; semFicha: number; vigentes: number; emAprovacao: number; inativos: number; revisoesPendentes: number } }

export default function Catalogo() {
  const [busca, setBusca] = useState('')
  const [familia, setFamilia] = useState('')
  const [trilha, setTrilha] = useState('')
  const [status, setStatus] = useState('')
  const [soRevisao, setSoRevisao] = useState(false)
  const [pagina, setPagina] = useState(1)
  const [visao, setVisao] = useState<'tabela' | 'familias'>('tabela')
  const gerencia = useTem('cargos:gerenciar')
  const tax = useApi<Taxonomia>('cargos/taxonomia')
  const por = visao === 'tabela' ? 20 : 100
  const r = useApi<Resp>('cargos/catalogo' + qs({ busca, familia, trilha, status, revisao: soRevisao ? 1 : undefined, pagina: visao === 'tabela' ? pagina : 1, por }))
  const filtrar = (f: () => void) => { f(); setPagina(1) }

  return (
    <TelaCargos>
      <PageHeader title="Catálogo de cargos" subtitle="Fichas oficiais, famílias, trilhas e níveis. O cadastro do cargo continua em Engenharia de funções."
        actions={<>
          {gerencia && <Link to="/cargos/familias"><Button variant="ghost" icon="FolderTree">Famílias e trilhas</Button></Link>}
          <Link to="/rh/funcoes"><Button variant="ghost" icon="Briefcase">Engenharia de funções</Button></Link>
        </>} />

      {r.dados && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <StatCard icon="Layers3" value={r.dados.resumo.total} label="Cargos cadastrados" />
          <StatCard icon="BadgeCheck" tone="success" value={r.dados.resumo.vigentes} label="Com ficha vigente" />
          <StatCard icon="FileWarning" tone="warning" value={r.dados.resumo.semFicha} label="Sem ficha oficial" />
          <StatCard icon="RefreshCw" tone="danger" value={r.dados.resumo.revisoesPendentes} label="Revisões pendentes" trend={r.dados.resumo.emAprovacao ? <Badge tone="brand">{r.dados.resumo.emAprovacao} em aprovação</Badge> : undefined} />
        </div>
      )}

      <Card>
        <div className="p-4 sm:p-5 flex flex-wrap items-center gap-3 border-b border-line">
          <SearchBox value={busca} onChange={(v) => filtrar(() => setBusca(v))} placeholder="Buscar por nome ou código…" label="Buscar cargo" />
          <Select label="Família" value={familia} onChange={(v) => filtrar(() => setFamilia(v))}>
            <option value="">Todas as famílias</option>
            {tax.dados?.familias.filter((f) => !f.paiId).map((f) => <option key={f.id} value={f.id}>{f.nome}</option>)}
          </Select>
          <Select label="Trilha" value={trilha} onChange={(v) => filtrar(() => setTrilha(v))}>
            <option value="">Todas as trilhas</option>
            {tax.dados?.trilhas.map((t) => <option key={t.id} value={t.id}>{t.nome}</option>)}
          </Select>
          <Select label="Situação da ficha" value={status} onChange={(v) => filtrar(() => setStatus(v))}>
            <option value="">Todas as situações</option>
            {Object.entries(STATUS_FICHA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}
          </Select>
          <label className="inline-flex items-center gap-2 text-[13px] text-ink-2 font-medium">
            <input type="checkbox" checked={soRevisao} onChange={(e) => filtrar(() => setSoRevisao(e.target.checked))} /> Só revisões pendentes
          </label>
        </div>
        <div className="px-4 sm:px-5 pt-4">
          <Tabs tabs={[{ key: 'tabela', label: 'Tabela' }, { key: 'familias', label: 'Por família' }]} active={visao} onChange={(k) => { setVisao(k as 'tabela' | 'familias'); setPagina(1) }} />
        </div>

        <Aguardar r={r} vazio={(d) => d.total === 0 ? <EmptyState icon="SearchX" title="Nenhum cargo encontrado" desc={d.resumo.total === 0 ? 'Cadastre cargos em Engenharia de funções para montar o catálogo.' : 'Ajuste os filtros para ver outros cargos.'} /> : null}>
          {(d) => visao === 'tabela' ? (
            <>
              <Tabela minWidth={860}>
                <thead><tr>
                  <th className={TH}>Cargo</th><th className={TH}>Código</th><th className={TH}>Família</th><th className={TH}>Trilha / nível</th>
                  <th className={TH}>Ficha</th><th className={TH}>Vagas</th><th className={TH}>Pessoas</th>
                </tr></thead>
                <tbody>
                  {d.itens.map((i) => (
                    <tr key={i.cargoId} className="hover:bg-surface-2">
                      <td className={TD}>
                        <Link to={`/cargos/${i.cargoId}`} className="font-semibold text-ink hover:text-brand">{i.nome}</Link>
                        <div className="text-[11.5px] text-muted">{i.setorNome ?? 'Sem área'}{i.nivelLegado ? ` · ${i.nivelLegado}` : ''}</div>
                      </td>
                      <td className={TD}>{i.codigo ?? '—'}</td>
                      <td className={TD}>{i.familia ?? '—'}</td>
                      <td className={TD}>{i.trilha ? `${i.trilha}${i.nivel ? ` · ${i.nivel}` : ''}` : '—'}</td>
                      <td className={TD}>
                        <div className="flex flex-wrap items-center gap-1.5">
                          <StatusBadge mapa={STATUS_FICHA} valor={i.status} />
                          {i.versaoVigente > 0 && <span className="text-[11px] text-muted">v{i.versaoVigente}</span>}
                          {i.revisaoPendente && i.status !== 'sem_ficha' && <Badge tone="warning">Revisar</Badge>}
                        </div>
                      </td>
                      <td className={TD}>{i.vagas}</td>
                      <td className={TD}>{i.pessoas}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <Paginacao pagina={pagina} por={por} total={d.total} onPagina={setPagina} />
            </>
          ) : (
            <div className="p-4 sm:p-5 grid grid-cols-1 gap-4 md:grid-cols-2 xl:grid-cols-3">
              {agrupar(d.itens).map(([fam, itens]) => (
                <Card key={fam} className="p-4">
                  <h3 className="text-[14px] font-bold text-ink mb-3 flex items-center justify-between">{fam}<Badge>{itens.length}</Badge></h3>
                  <ul className="space-y-1.5">
                    {itens.map((i) => (
                      <li key={i.cargoId} className="flex items-center justify-between gap-2 text-[13px]">
                        <Link to={`/cargos/${i.cargoId}`} className="text-ink hover:text-brand truncate">{i.nome}</Link>
                        <StatusBadge mapa={STATUS_FICHA} valor={i.status} dot={false} />
                      </li>
                    ))}
                  </ul>
                </Card>
              ))}
              {d.total > d.itens.length && <p className="text-[12.5px] text-muted md:col-span-2 xl:col-span-3">Mostrando os primeiros {d.itens.length} de {d.total}. Refine os filtros ou use a visão em tabela.</p>}
            </div>
          )}
        </Aguardar>
      </Card>
    </TelaCargos>
  )
}

function agrupar(itens: ItemCatalogo[]): [string, ItemCatalogo[]][] {
  const m = new Map<string, ItemCatalogo[]>()
  for (const i of itens) m.set(i.familia ?? 'Sem família', [...(m.get(i.familia ?? 'Sem família') ?? []), i])
  return [...m].sort(([a], [b]) => (a === 'Sem família' ? 1 : b === 'Sem família' ? -1 : a.localeCompare(b, 'pt-BR')))
}
