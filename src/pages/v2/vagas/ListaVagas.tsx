import { useMemo } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, TD, TH, Tabela, Tabs } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import {
  AprovacoesPendentes, BadgePrazo, BadgePrioridade, BadgeStatus, BarraFiltros, ItemMenu, Menu, ROTULO_ACAO, acoesDaLinha, queryDe, useAcaoVaga, useFiltrosUrl, useOpcoes, useSouGestao, type VagaLinha,
} from '@/components/v2/vagas/comum'
import { api, executar, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { useStore } from '@/lib/store'
import { MAPA_STATUS_VAGA, STATUS_VAGA, ROTULO_MODALIDADE } from '@/domain/v2/vagas'
import { dataBR } from '@/lib/fmt'

const EXTRAS = ['pagina', 'ordem', 'visao']
/** Colunas do antigo fluxo de aprovação: só aparecem enquanto houver vaga nelas. */
const ETAPAS_APROVACAO: string[] = ['em_aprovacao', 'ajustes', 'aprovada']
interface Resposta { itens: VagaLinha[]; total: number; pagina: number; por: number; porStatus: Record<string, number> }

export default function ListaVagas() {
  const f = useFiltrosUrl(EXTRAS)
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const opcoes = useOpcoes()
  const gestao = useSouGestao()
  const solicita = useTem('vagas:solicitar')
  const euId = useStore((s) => s.sessaoId) ?? ''
  const visao = sp.get('visao') === 'kanban' ? 'kanban' : 'lista'
  const pagina = Number(sp.get('pagina')) || 1
  const por = visao === 'kanban' ? 200 : 20
  const consulta = useMemo(() => queryDe({ ...f.valores, por: String(por), pagina: String(pagina) }), [f.valores, por, pagina])
  const r = useApi<Resposta>(`vagas${consulta}`)
  const { pedir, modal } = useAcaoVaga(() => r.recarregar())
  const mudar = (k: string, v: string) => setSp((a) => { const n = new URLSearchParams(a); v ? n.set(k, v) : n.delete(k); if (k !== 'pagina') n.delete('pagina'); return n }, { replace: true })
  const { pagina: _p, ordem: _o, visao: _v, ...filtrosExport } = f.valores
  void _p; void _o; void _v

  const menu = (v: VagaLinha) => {
    const { acoes, editar } = acoesDaLinha(v, gestao, euId)
    return (
      <Menu rotulo={`Ações da vaga ${v.titulo}`}>
        {(fechar) => (
          <>
            <ItemMenu icon="Eye" to={`/recrutamento/vagas/${v.id}`} onClick={() => nav(`/recrutamento/vagas/${v.id}`)}>Visualizar</ItemMenu>
            {editar && <ItemMenu icon="Pencil" onClick={() => nav(`/recrutamento/vagas/${v.id}/editar`)}>Editar</ItemMenu>}
            {(gestao || solicita) && <ItemMenu icon="Copy" onClick={async () => { fechar(); const d = await executar(() => api.post(`vagas/${v.id}/duplicar`), 'Vaga duplicada como rascunho.'); if (d) nav(`/recrutamento/vagas/${d.vaga.id}/editar`) }}>Duplicar</ItemMenu>}
            {v.status === 'em_aprovacao' && <ItemMenu icon="ClipboardCheck" onClick={() => nav(`/recrutamento/vagas/${v.id}?aba=aprovacoes`)}>Aprovações e decisão</ItemMenu>}
            {acoes.map((a) => <ItemMenu key={a} icon={ROTULO_ACAO[a].icon} perigo={ROTULO_ACAO[a].perigo} onClick={() => { fechar(); pedir(v, a) }}>{ROTULO_ACAO[a].rotulo}</ItemMenu>)}
            <ItemMenu icon="Users" onClick={() => nav(`/recrutamento/candidatos?vaga=${v.id}`)}>Candidaturas</ItemMenu>
            <ItemMenu icon="History" onClick={() => nav(`/recrutamento/vagas/${v.id}?aba=historico`)}>Histórico</ItemMenu>
          </>
        )}
      </Menu>
    )
  }

  return (
    <>
      <PageHeader title={gestao ? 'Vagas' : solicita ? 'Vagas da minha área' : 'Vagas e aprovações'}
        subtitle={gestao ? 'Todas as vagas do ciclo de recrutamento.' : solicita ? 'Solicite vagas e acompanhe a aprovação e os candidatos.' : 'Vagas que você acompanha ou precisa aprovar.'}
        actions={<>
          {gestao && <a href={api.url(`vagas/exportar${queryDe(filtrosExport)}`)} download className="inline-flex items-center justify-center gap-2 h-10 px-4 rounded-xl text-[13.5px] font-semibold border border-line bg-surface text-ink hover:bg-surface-2 hover:border-line-strong outline-none focus-visible:ring-2 focus-visible:ring-brand">Exportar CSV</a>}
          {solicita && <Link to="/recrutamento/vagas/nova"><Button icon="Plus">{gestao ? 'Nova vaga' : 'Solicitar vaga'}</Button></Link>}
        </>} />
      <SoComBanco>
        <AprovacoesPendentes />
        <BarraFiltros {...f} opcoes={opcoes.dados} />
        <div className="flex items-end justify-between gap-x-3 gap-y-2 flex-wrap mb-4 border-b border-line">
          <Tabs className="mb-0 border-b-0" tabs={[{ key: 'lista', label: 'Lista' }, { key: 'kanban', label: 'Kanban por situação' }]} active={visao} onChange={(k) => mudar('visao', k === 'kanban' ? 'kanban' : '')} />
          <label className="flex items-center gap-2 text-[12.5px] text-muted pb-3 cursor-pointer">
            <input type="checkbox" checked={f.valores.arquivadas === '1'} onChange={(e) => f.definir('arquivadas', e.target.checked ? '1' : '')} /> Ver arquivadas
          </label>
        </div>

        <Aguardar r={r} linhas={5} vazio={(d) => d.total === 0 ? (
          <Card><EmptyState icon="Briefcase" title={f.ativos ? 'Nenhuma vaga com esses filtros' : 'Nenhuma vaga ainda'} desc={f.ativos ? 'Tente remover algum filtro.' : 'Crie a primeira vaga para iniciar o processo seletivo.'}
            action={f.ativos ? <Button variant="ghost" onClick={f.limpar}>Limpar filtros</Button> : solicita ? <Link to="/recrutamento/vagas/nova"><Button icon="Plus">Criar vaga</Button></Link> : undefined} /></Card>
        ) : null}>
          {(d) => visao === 'lista' ? (
            <Card className="overflow-hidden">
              <Tabela minWidth={980}>
                <caption className="sr-only">Lista de vagas</caption>
                <thead><tr>
                  <th className={TH} scope="col">Vaga</th><th className={TH} scope="col">Área e cargo</th><th className={TH} scope="col">Responsáveis</th>
                  <th className={TH} scope="col">Posições</th><th className={TH} scope="col">Candidaturas</th><th className={TH} scope="col">Situação</th>
                  <th className={TH} scope="col">Prazo</th><th className={TH} scope="col"><span className="sr-only">Ações</span></th>
                </tr></thead>
                <tbody>
                  {d.itens.map((v) => (
                    <tr key={v.id} className="hover:bg-surface-2">
                      <td className={TD}>
                        <Link to={`/recrutamento/vagas/${v.id}`} className="font-semibold text-ink hover:text-brand outline-none focus-visible:underline">{v.titulo}</Link>
                        <div className="text-[11.5px] text-muted mt-0.5 flex items-center gap-1.5 flex-wrap">{v.codigo} · {ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade}{v.cidade ? ` · ${v.cidade}` : ''} <BadgePrioridade valor={v.prioridade} /></div>
                      </td>
                      <td className={TD}><div>{v.setorNome ?? '—'}</div><div className="text-[11.5px] text-muted">{v.cargoNome ?? 'Cargo não definido'}</div></td>
                      <td className={TD}><div>{v.gestorResponsavelNome ?? v.gestorSolicitanteNome ?? '—'}</div><div className="text-[11.5px] text-muted">Recrutador(a): {v.recrutadorNome ?? 'não atribuído'}</div></td>
                      <td className={`${TD} tabular-nums`}>{v.posicoesPreenchidas}/{v.qtdPosicoes}</td>
                      <td className={`${TD} tabular-nums`}>{v.candidaturas ? <Link className="hover:text-brand" to={`/recrutamento/candidatos?vaga=${v.id}`}>{v.candidaturas.total} <span className="text-muted">({v.candidaturas.ativas} ativas)</span></Link> : '—'}</td>
                      <td className={TD}><div className="flex flex-col items-start gap-1"><BadgeStatus valor={v.status} /><BadgePrazo situacao={v.situacaoPrazo} />{v.arquivada && <Badge>Arquivada</Badge>}</div></td>
                      <td className={TD}><div>{dataBR(v.prazoPreenchimento)}</div><div className="text-[11.5px] text-muted">Aberta em {dataBR(v.dataAbertura)}</div></td>
                      <td className={TD}>{menu(v)}</td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={(p) => mudar('pagina', String(p))} />
            </Card>
          ) : (
            <div>
              <p className="text-[12px] text-muted mb-3">Para publicar, pausar ou encerrar uma vaga, use o menu <b>⋯</b> de cada cartão. {d.total > d.itens.length && 'Exibindo as 200 mais recentes: use os filtros para refinar.'}</p>
              <div className="flex gap-3 overflow-x-auto pb-3 -mx-4 px-4 sm:mx-0 sm:px-0" role="list" aria-label="Vagas por situação">
                {STATUS_VAGA.filter((s) => !ETAPAS_APROVACAO.includes(s) || d.porStatus[s]).map((s) => {
                  const col = d.itens.filter((v) => v.status === s)
                  return (
                    <section key={s} role="listitem" aria-label={MAPA_STATUS_VAGA[s].rotulo} className="w-[270px] shrink-0 rounded-2xl bg-surface-3 border border-line p-2.5">
                      <header className="flex items-center justify-between px-1.5 py-1.5 mb-1"><BadgeStatus valor={s} /><span className="text-[12px] font-bold text-muted tabular-nums">{d.porStatus[s] ?? 0}</span></header>
                      <div className="space-y-2 min-h-[60px]">
                        {col.length === 0 && <p className="text-[12px] text-muted px-2 py-3">Nenhuma vaga.</p>}
                        {col.map((v) => (
                          <article key={v.id} className="card p-3">
                            <div className="flex items-start justify-between gap-2">
                              <Link to={`/recrutamento/vagas/${v.id}`} className="text-[13px] font-semibold text-ink hover:text-brand leading-snug outline-none focus-visible:underline">{v.titulo}</Link>
                              {menu(v)}
                            </div>
                            <div className="text-[11.5px] text-muted mt-1">{v.codigo} · {v.setorNome ?? 'Sem área'}</div>
                            <div className="flex items-center gap-1.5 flex-wrap mt-2"><BadgePrioridade valor={v.prioridade} /><BadgePrazo situacao={v.situacaoPrazo} /></div>
                            <div className="flex justify-between text-[11.5px] text-ink-2 mt-2"><span>{v.posicoesPreenchidas}/{v.qtdPosicoes} posições</span><span>{v.candidaturas?.total ?? 0} cand.</span></div>
                          </article>
                        ))}
                      </div>
                    </section>
                  )
                })}
              </div>
            </div>
          )}
        </Aguardar>
      </SoComBanco>
      {modal}
    </>
  )
}
