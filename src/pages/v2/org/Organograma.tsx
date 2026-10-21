/* Organograma inteligente: gerado dos cadastros reais (gestor imediato, área, função, unidade). */
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Callout, Card, EmptyState, PageHeader, Select, Tabs } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Drawer } from '@/components/v2/Drawer'
import { useTem } from '@/data/v2/acesso'
import { api, qs } from '@/data/v2/api'
import { ArvoreLista } from '@/components/v2/org/ArvoreLista'
import { MapaOrg, type MapaHandle } from '@/components/v2/org/MapaOrg'
import { PainelPessoa } from '@/components/v2/org/PainelPessoa'
import { AnaliseEstrutura } from '@/components/v2/org/AnaliseEstrutura'
import { QualidadeCadastros } from '@/components/v2/org/QualidadeCadastros'
import { EditorHierarquia } from '@/components/v2/org/EditorHierarquia'
import { SEM_FILTRO, useBusca, useOrganograma, type FiltrosOrg } from '@/components/v2/org/useOrganograma'
import type { ResultadoBusca, VisaoOrg } from '@/components/v2/org/tipos'
import { plural } from '@/lib/fmt'

type Visao = 'toda' | 'departamento' | 'equipe'
type ModoExibicao = 'mapa' | 'lista'

const semGestor = (d: VisaoOrg) => d.raizes.filter((id) => !d.itens.find((i) => i.id === id)?.gestorForaDaVisao).length
const telaGrande = () => typeof window !== 'undefined' && window.matchMedia?.('(min-width: 1024px)').matches

function MapaTab() {
  const [params, setParams] = useSearchParams()
  const [visao, setVisao] = useState<Visao>('toda')
  const [filtros, setFiltros] = useState<FiltrosOrg>(SEM_FILTRO)
  const [modo, setModo] = useState<ModoExibicao>(telaGrande() ? 'mapa' : 'lista')
  const [selecionado, setSelecionado] = useState<string | null>(null)
  const [foco, setFoco] = useState<string | null>(null)
  const [texto, setTexto] = useState('')
  const mapa = useRef<MapaHandle>(null)

  const o = useOrganograma(filtros)
  const { resultados, buscando } = useBusca(texto)
  const dados = o.base.dados

  const mudarVisao = (v: Visao) => {
    setVisao(v)
    setFiltros((f) => ({ ...f, setor: v === 'departamento' ? f.setor : '', gestor: v === 'equipe' ? f.gestor : '' }))
  }

  const abrirPessoa = async (r: Pick<ResultadoBusca, 'id' | 'caminho'>) => {
    await o.revelar(r.caminho)
    setSelecionado(r.id)
    setFoco(r.id)
    setTexto('')
    setTimeout(() => mapa.current?.focar(r.id), 80)
  }

  // Link direto (?pessoa=ID), usado pela aba Qualidade: encontra a pessoa e abre o painel.
  const alvo = params.get('pessoa')
  useEffect(() => {
    if (!alvo || !dados) return
    api.get<{ itens: ResultadoBusca[] }>(`organograma/busca${qs({ id: alvo })}`)
      .then((r) => { if (r.itens[0]) void abrirPessoa(r.itens[0]) })
      .catch(() => undefined)
      .finally(() => setParams((p) => { p.delete('pessoa'); return p }, { replace: true }))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [alvo, !!dados])

  const sel = selecionado ? o.pessoas.get(selecionado) : undefined
  const temFiltro = !!(filtros.setor || filtros.unidade || filtros.gestor)
  const lista = useMemo(() => o.visiveis, [o.visiveis])

  return (
    <SoComBanco>
      <Aguardar r={o.base} vazio={(d) => (d.total === 0 && !temFiltro
        ? <Card><EmptyState icon="Network" title="Ainda não há pessoas para montar o organograma" desc="Cadastre pessoas e defina o gestor imediato de cada uma em RH → Pessoas & contratos." /></Card> : null)}>
        {(d) => (
          <div className="space-y-4">
            <Card className="p-4">
              <div className="flex flex-wrap items-end gap-3">
                <div className="flex-1 min-w-[220px] relative">
                  <label className="label" htmlFor="org-busca">Buscar pessoa</label>
                  <input id="org-busca" type="search" className="input" placeholder="Digite o nome…" value={texto} onChange={(e) => setTexto(e.target.value)} autoComplete="off"
                    aria-expanded={texto.trim().length >= 2} aria-controls="org-resultados" />
                  {texto.trim().length >= 2 && (
                    <ul id="org-resultados" className="absolute z-20 left-0 right-0 top-full mt-1 bg-surface border border-line rounded-xl shadow-md max-h-72 overflow-auto">
                      {buscando && <li className="px-4 py-3 text-[13px] text-muted">Buscando…</li>}
                      {!buscando && resultados.length === 0 && <li className="px-4 py-3 text-[13px] text-muted">Ninguém encontrado com esse nome.</li>}
                      {resultados.map((r) => (
                        <li key={r.id}><button type="button" className="w-full text-left px-4 py-2.5 hover:bg-winter" onClick={() => void abrirPessoa(r)}>
                          <span className="block text-[13.5px] font-semibold text-ink">{r.nome}</span>
                          <span className="block text-[12px] text-muted">{[r.cargo, r.setor].filter(Boolean).join(' · ')}</span></button></li>
                      ))}
                    </ul>
                  )}
                </div>
                <div>
                  <span className="label" id="org-visao-rotulo">Visão</span>
                  <div role="group" aria-labelledby="org-visao-rotulo" className="inline-flex rounded-xl border border-line overflow-hidden">
                    {([['toda', 'Toda a organização'], ['departamento', 'Departamento'], ['equipe', 'Equipe']] as const).map(([k, rot]) => (
                      <button key={k} type="button" aria-pressed={visao === k} onClick={() => mudarVisao(k)}
                        className={`h-10 px-3.5 text-[12.5px] font-semibold transition ${visao === k ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-winter'}`}>{rot}</button>
                    ))}
                  </div>
                </div>
                {visao === 'departamento' && (
                  <div><label className="label" htmlFor="org-f-area">Departamento</label>
                    <Select id="org-f-area" label="Departamento" value={filtros.setor} onChange={(v) => setFiltros((f) => ({ ...f, setor: v }))}>
                      <option value="">Escolha…</option>{d.areas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select></div>
                )}
                {visao === 'equipe' && (
                  <div><label className="label" htmlFor="org-f-eq">Equipe de</label>
                    <Select id="org-f-eq" label="Equipe de" value={filtros.gestor} onChange={(v) => setFiltros((f) => ({ ...f, gestor: v }))}>
                      <option value="">Escolha…</option>{d.gestores.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Select></div>
                )}
                {d.unidades.length > 0 && (
                  <div><label className="label" htmlFor="org-f-un">Unidade</label>
                    <Select id="org-f-un" label="Unidade" value={filtros.unidade} onChange={(v) => setFiltros((f) => ({ ...f, unidade: v }))}>
                      <option value="">Todas</option>{d.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Select></div>
                )}
                {temFiltro && <Button variant="subtle" icon="X" onClick={() => { setFiltros(SEM_FILTRO); setVisao('toda') }}>Limpar filtros</Button>}
              </div>
              <div className="flex items-center justify-between gap-3 flex-wrap mt-3 pt-3 border-t border-line">
                <p className="text-[12.5px] text-muted" aria-live="polite">
                  {plural(d.total, 'pessoa', 'pessoas')}{temFiltro ? ' no recorte' : ''}
                  {d.parcial ? ' · mostrando os primeiros níveis; expanda uma equipe para carregar o restante' : ''}
                  {d.encerradas.length > 0 ? ` · ${plural(d.encerradas.length, 'parceria encerrada fora do mapa', 'parcerias encerradas fora do mapa')}` : ''}
                </p>
                <div className="flex gap-2 flex-wrap">
                  <Button size="sm" variant="ghost" icon="ChevronsDown" onClick={o.expandirTudo} disabled={d.parcial}>Expandir tudo</Button>
                  <Button size="sm" variant="ghost" icon="ChevronsUp" onClick={o.recolherTudo}>Recolher tudo</Button>
                  <div role="group" aria-label="Forma de exibição" className="inline-flex rounded-lg border border-line overflow-hidden">
                    <button type="button" aria-pressed={modo === 'mapa'} onClick={() => setModo('mapa')} className={`h-9 px-3 text-[12.5px] font-semibold ${modo === 'mapa' ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-winter'}`}>Mapa</button>
                    <button type="button" aria-pressed={modo === 'lista'} onClick={() => setModo('lista')} className={`h-9 px-3 text-[12.5px] font-semibold ${modo === 'lista' ? 'bg-brand text-white' : 'bg-surface text-ink-2 hover:bg-winter'}`}>Lista</button>
                  </div>
                </div>
              </div>
            </Card>

            {/* Com filtro, quem tem gestor fora do recorte também vira raiz: só conta quem de fato não tem gestor. */}
            {d.podeEditar && semGestor(d) > 1 && (
              <Callout tone="warning" icon="Network">
                <b>{semGestor(d)} pessoas estão no topo, sem gestor definido.</b> Para ver o organograma completo (CEO no topo e linhas até cada equipe), defina a quem cada pessoa responde.{' '}
                <Link className="underline font-semibold" to="/organograma?aba=hierarquia">Montar hierarquia</Link>
              </Callout>
            )}

            {lista.length === 0 ? (
              <Card><EmptyState icon="SearchX" title="Nada para mostrar neste recorte"
                desc={visao !== 'toda' && !filtros.setor && !filtros.gestor ? 'Escolha um departamento ou uma equipe.' : 'Nenhuma pessoa ativa corresponde aos filtros.'}
                action={temFiltro ? <Button variant="ghost" onClick={() => { setFiltros(SEM_FILTRO); setVisao('toda') }}>Limpar filtros</Button> : undefined} /></Card>
            ) : modo === 'mapa' ? (
              <MapaOrg ref={mapa} visiveis={lista} expandidos={o.expandidos} carregandoRamo={o.carregandoRamo} faltaCarregar={o.faltaCarregar}
                selecionado={selecionado} onSelecionar={setSelecionado} onAlternar={(id) => void o.alternar(id)} />
            ) : (
              <ArvoreLista visiveis={lista} expandidos={o.expandidos} carregandoRamo={o.carregandoRamo} faltaCarregar={o.faltaCarregar}
                selecionado={selecionado} focoChave={foco} onSelecionar={setSelecionado} onAlternar={(id) => void o.alternar(id)} />
            )}

            {o.vagasSemGestor.length > 0 && (
              <Callout tone="brand" icon="UserPlus">
                <b>Posições vagas sem gestor imediato definido:</b>
                <ul className="mt-1.5 list-disc pl-5 space-y-0.5">
                  {o.vagasSemGestor.map((v) => <li key={v.vagaId}>{v.titulo}{v.abertas > 1 ? ` (${v.abertas})` : ''}{v.setor ? ` · ${v.setor}` : ''}</li>)}
                </ul>
              </Callout>
            )}

            <Drawer open={!!sel} onClose={() => setSelecionado(null)} titulo={sel ? sel.apelido || sel.nome : ''} subtitulo={sel ? [sel.cargo, sel.setor].filter(Boolean).join(' · ') : undefined}>
              {sel && (
                <PainelPessoa pessoa={sel} pessoas={o.pessoas} filhosDe={o.filhosDe} podeEditar={d.podeEditar} podeVerPerfilCompleto={d.podeVerPerfilCompleto}
                  onSelecionar={(id) => { setSelecionado(id); setFoco(id); mapa.current?.focar(id) }} onAtualizar={o.recarregar} />
              )}
            </Drawer>
          </div>
        )}
      </Aguardar>
    </SoComBanco>
  )
}

export default function Organograma() {
  const podeEditar = useTem('org:editar')
  const podeVerAnalytics = useTem('analytics:ver')
  const podeAnalisar = podeEditar || podeVerAnalytics
  const [params, setParams] = useSearchParams()
  const aba = podeAnalisar || podeEditar ? params.get('aba') ?? 'mapa' : 'mapa'
  const abas = [{ key: 'mapa', label: 'Mapa' }, ...(podeEditar ? [{ key: 'hierarquia', label: 'Montar hierarquia' }] : []), ...(podeAnalisar ? [{ key: 'analise', label: 'Análise' }, { key: 'qualidade', label: 'Qualidade dos cadastros' }] : [])]
  const irPara = (k: string) => setParams((p) => { k === 'mapa' ? p.delete('aba') : p.set('aba', k); return p })

  return (
    <>
      <PageHeader title="Organograma" subtitle="Gerado a partir dos cadastros reais: gestor imediato, área, função e unidade." />
      {abas.length > 1 && <Tabs tabs={abas} active={aba} onChange={irPara} />}
      {aba === 'mapa' && <MapaTab />}
      {aba === 'hierarquia' && podeEditar && <SoComBanco><EditorHierarquia onSalvo={() => irPara('mapa')} /></SoComBanco>}
      {aba === 'analise' && <SoComBanco><AnaliseEstrutura /></SoComBanco>}
      {aba === 'qualidade' && <SoComBanco><QualidadeCadastros podeEditar={podeEditar} onCorrigir={(id) => setParams({ pessoa: id })} /></SoComBanco>}
    </>
  )
}
