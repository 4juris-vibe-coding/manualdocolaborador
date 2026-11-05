/* Central de vagas da 4JURIS: todas as oportunidades abertas, com busca e filtros.
   O conteúdo institucional completo fica na página de cada vaga (o candidato decide lá). */
import { ROTULO_REGIME_CONTRATACAO } from '@/domain/v2/vagas'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Button, EmptyState, Icon } from '@/components/ui'
import { Contenedor, FormCodigo, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { CarregandoBloco, ErroBloco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { useAtraso } from '@/components/v2/ats/comuns'
import { Dropdown } from '@/components/Dropdown'
import { qs, useApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { dataBR } from '@/lib/fmt'
import { portalEfetivo, type PortalConfig } from '@/domain/v2/portal'

export const ROTULO_MODALIDADE: Record<string, string> = { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' }
const COR_MODALIDADE: Record<string, string> = { presencial: 'bg-[#eef2ff] text-[#0032D2]', hibrido: 'bg-[#f3eefe] text-[#6d28d9]', remoto: 'bg-[#e8f7f0] text-[#0b7a52]' }
const NOVA_DIAS = 10

export interface VagaCard {
  slug: string; titulo: string; resumo?: string | null; area?: string | null; tipoRotulo?: string; regimeContratacao?: string | null; modalidade: string
  cidade?: string | null; estado?: string | null; senioridade?: string | null; publicadaEm?: string | null; encerraEm?: string | null; posicoes?: number; jornada?: string | null; imagemUrl?: string | null
}

export function Chip({ children, className = 'bg-[#f2f4f7] text-[#3d4b56]', icone }: { children: React.ReactNode; className?: string; icone?: string }) {
  return <span className={`inline-flex items-center gap-1 h-7 px-2.5 rounded-full text-[12px] font-semibold ${className}`}>{icone && <Icon name={icone} className="h-3.5 w-3.5" />}{children}</span>
}

export const rotuloRegime = (r?: string | null) => (r && r !== 'nao_informado' ? (ROTULO_REGIME_CONTRATACAO as Record<string, string>)[r] ?? r : null)
export const localDe = (v: Pick<VagaCard, 'cidade' | 'estado' | 'modalidade'>) => [v.cidade, v.estado].filter(Boolean).join(', ') || (v.modalidade === 'remoto' ? 'Remoto' : null)
const recente = (d?: string | null) => !!d && (Date.now() - Date.parse(d.slice(0, 10))) / 86400000 <= NOVA_DIAS

/** Card de vaga (central e "outras vagas" na página da vaga). */
export function CartaoVaga({ v, compacto = false }: { v: VagaCard; compacto?: boolean }) {
  const local = localDe(v)
  const regime = rotuloRegime(v.regimeContratacao)
  return (
    <Link to={`/carreiras/${v.slug}`} className="group block rounded-2xl border border-[#e4e8ed] bg-white p-5 sm:p-6 hover:border-brand hover:shadow-[0_12px_32px_-16px_rgba(0,50,210,.35)] transition outline-none focus-visible:ring-2 focus-visible:ring-brand">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          {v.area && <div className="text-[11.5px] font-bold uppercase tracking-wider text-brand mb-1">{v.area}</div>}
          <h3 className="text-[17px] sm:text-[18px] font-extrabold tracking-tight text-[#122029] group-hover:text-brand">{v.titulo}</h3>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-[12.5px] text-[#58636e]">
            {local && <span className="inline-flex items-center gap-1"><Icon name="MapPin" className="h-3.5 w-3.5" />{local}</span>}
            {!!v.posicoes && <span className="inline-flex items-center gap-1"><Icon name="Users" className="h-3.5 w-3.5" />{v.posicoes} {v.posicoes === 1 ? 'posição' : 'posições'}</span>}
          </div>
        </div>
        <div className="text-right shrink-0">
          {recente(v.publicadaEm) && <span className="inline-flex items-center h-6 px-2 rounded-full bg-[#e8f7f0] text-[#0b7a52] text-[11px] font-bold mb-1">Nova</span>}
          {v.publicadaEm && <div className="text-[11.5px] text-[#5f6b76]">Publicada em {dataBR(v.publicadaEm)}</div>}
        </div>
      </div>
      <div className="flex flex-wrap gap-1.5 mt-3">
        <Chip className={COR_MODALIDADE[v.modalidade] ?? undefined}>{ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade}</Chip>
        {regime && <Chip>{regime}</Chip>}
        {v.senioridade && <Chip>{v.senioridade}</Chip>}
        {v.jornada && v.jornada.length <= 24 && <Chip icone="Clock">{v.jornada}</Chip>}
      </div>
      {!compacto && v.resumo && <p className="text-[13.5px] text-[#3d4b56] mt-3 leading-relaxed line-clamp-2">{v.resumo}</p>}
      <div className="flex items-center justify-between mt-4 pt-3 border-t border-[#f0f2f5] text-[12px] text-[#5f6b76]">
        <span>{v.encerraEm ? `Inscrições até ${dataBR(v.encerraEm)}` : 'Inscrições abertas'}</span>
        <span className="inline-flex items-center gap-1 text-brand font-bold text-[13px]">Ver vaga <Icon name="ArrowRight" className="h-4 w-4 transition group-hover:translate-x-0.5" /></span>
      </div>
    </Link>
  )
}

function Filtro({ id, rotulo, valor, onChange, children }: { id: string; rotulo: string; valor: string; onChange: (v: string) => void; children: React.ReactNode }) {
  return (
    <div className="min-w-0">
      <label htmlFor={id} className="block text-[12px] font-bold text-[#3d4b56] mb-1">{rotulo}</label>
      <Dropdown id={id} className="input w-full" value={valor} onChange={(e) => onChange(e.target.value)}>{children}</Dropdown>
    </div>
  )
}

export default function Carreiras() {
  useMeta('Vagas abertas · 4JURIS Carreiras', 'Conheça as oportunidades abertas na 4JURIS e envie a sua candidatura.')
  const [busca, setBusca] = useState('')
  const [area, setArea] = useState('')
  const [cidade, setCidade] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [tipo, setTipo] = useState('')
  const [regime, setRegime] = useState('')
  const [senioridade, setSenioridade] = useState('')
  const [pagina, setPagina] = useState(1)
  const [abrirFiltros, setAbrirFiltros] = useState(false)
  const q = useAtraso(busca)
  const r = useApi<any>(MODO_API ? `publico/vagas${qs({ q, area, cidade: cidade.split('/')[0], modalidade, tipo, regime, senioridade, pagina })}` : null)
  const portal: PortalConfig = portalEfetivo(r.dados?.portal)
  const f = r.dados?.filtros
  const temFiltro = !!(q || area || cidade || modalidade || tipo || regime || senioridade)
  const limpar = () => { setBusca(''); setArea(''); setCidade(''); setModalidade(''); setTipo(''); setRegime(''); setSenioridade(''); setPagina(1) }
  const set = (fn: (v: string) => void) => (v: string) => { fn(v); setPagina(1) }
  const total: number = r.dados?.total ?? 0
  const etapas = (portal.processoSeletivo ?? []).slice(0, 5)

  return (
    <PortalLayout>
      <Contenedor className="pt-6 sm:pt-8">
        {/* Apresentação */}
        <section className="relative overflow-hidden rounded-3xl border border-[#e3e9fb] bg-gradient-to-br from-[#f2f5fe] via-white to-[#eef3ff] p-6 sm:p-10">
          <div aria-hidden className="pointer-events-none absolute -right-20 -top-24 h-72 w-72 rounded-full bg-[#0032D2]/[0.06]" />
          <div aria-hidden className="pointer-events-none absolute right-40 -bottom-28 h-56 w-56 rounded-full bg-[#0032D2]/[0.04]" />
          <div className="relative grid grid-cols-1 lg:grid-cols-[1fr_360px] gap-8 items-center">
            <div>
              <span className="inline-flex items-center gap-1.5 h-7 px-3 rounded-full bg-white border border-[#dbe3fb] text-brand text-[12px] font-bold"><Icon name="Sparkles" className="h-3.5 w-3.5" />Vagas abertas</span>
              <h1 className="mt-4 text-[30px] sm:text-[42px] leading-[1.08] font-extrabold tracking-tight max-w-2xl">{portal.titulo}</h1>
              <p className="mt-4 max-w-2xl text-[15.5px] leading-relaxed text-[#3d4b56]">{portal.apresentacao}</p>
              {r.dados && (
                <div className="mt-6 flex flex-wrap gap-6 text-[13px] text-[#58636e]">
                  <div><b className="block text-[26px] font-extrabold text-[#122029] leading-none">{total}</b>{total === 1 ? 'vaga aberta' : 'vagas abertas'}</div>
                  {!!f?.areas?.length && <div><b className="block text-[26px] font-extrabold text-[#122029] leading-none">{f.areas.length}</b>{f.areas.length === 1 ? 'área' : 'áreas'}</div>}
                </div>
              )}
            </div>
            {/* No celular o cabeçalho já tem "Meu código": o cartão some para as vagas aparecerem antes. */}
            <div className="hidden sm:block rounded-2xl bg-white border border-[#e4e8ed] shadow-[0_16px_40px_-24px_rgba(18,32,41,.35)] p-5">
              <div className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wider text-brand"><Icon name="KeyRound" className="h-3.5 w-3.5" />Já se candidatou?</div>
              <p className="text-[13.5px] text-[#3d4b56] mt-1.5 mb-3">Acompanhe em que etapa está o seu processo com o código que você recebeu.</p>
              <FormCodigo empilhado />
            </div>
          </div>
        </section>

        {/* Filtros */}
        <section aria-label="Filtrar vagas" className="mt-5 rounded-2xl border border-[#e4e8ed] bg-white p-4 sm:p-5">
          {!MODO_API ? <EmptyState icon="DatabaseZap" title="Portal indisponível neste modo" desc="O portal de carreiras depende do servidor conectado." /> : (
            <form role="search" onSubmit={(e) => e.preventDefault()} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))] gap-3 items-end">
              <div className="sm:col-span-2 lg:col-span-1">
                <label htmlFor="cv-busca" className="block text-[12px] font-bold text-[#3d4b56] mb-1">Buscar</label>
                <div className="flex gap-2">
                  <div className="relative flex-1 min-w-0"><Icon name="Search" className="h-4 w-4 text-[#5f6b76] absolute left-3.5 top-1/2 -translate-y-1/2" />
                    <input id="cv-busca" type="search" className="input pl-10 w-full" placeholder="Cargo, área ou palavra-chave" value={busca} onChange={(e) => set(setBusca)(e.target.value)} /></div>
                  {/* Celular: os filtros ficam recolhidos para a lista de vagas aparecer logo. */}
                  <button type="button" onClick={() => setAbrirFiltros((x) => !x)} aria-expanded={abrirFiltros} aria-controls="cv-filtros"
                    className="sm:hidden inline-flex items-center gap-1.5 h-[46px] px-3.5 rounded-xl border border-[#d3d9df] text-[13px] font-semibold shrink-0">
                    <Icon name="SlidersHorizontal" className="h-4 w-4" />Filtros{[area, cidade, modalidade, tipo, regime, senioridade].filter(Boolean).length ? ` (${[area, cidade, modalidade, tipo, regime, senioridade].filter(Boolean).length})` : ''}
                  </button>
                </div>
              </div>
              <div id="cv-filtros" className={`${abrirFiltros ? 'grid' : 'hidden'} sm:contents grid-cols-1 gap-3`}>
              <Filtro id="cv-area" rotulo="Área" valor={area} onChange={set(setArea)}><option value="">Todas</option>{(f?.areas ?? []).map((a: string) => <option key={a}>{a}</option>)}</Filtro>
              <Filtro id="cv-mod" rotulo="Modelo de trabalho" valor={modalidade} onChange={set(setModalidade)}><option value="">Todos</option>{(f?.modalidades ?? []).map((m: string) => <option key={m} value={m}>{ROTULO_MODALIDADE[m] ?? m}</option>)}</Filtro>
              <Filtro id="cv-reg" rotulo="Contratação" valor={regime} onChange={set(setRegime)}><option value="">Todas</option>{(f?.regimes ?? []).map((m: string) => <option key={m} value={m}>{rotuloRegime(m)}</option>)}</Filtro>
              <Filtro id="cv-loc" rotulo="Localização" valor={cidade} onChange={set(setCidade)}><option value="">Todas</option>{(f?.cidades ?? []).map((a: string) => <option key={a}>{a}</option>)}</Filtro>
              <Filtro id="cv-niv" rotulo="Nível" valor={senioridade} onChange={set(setSenioridade)}><option value="">Todos</option>{(f?.senioridades ?? []).map((m: string) => <option key={m}>{m}</option>)}</Filtro>
              <Filtro id="cv-tipo" rotulo="Tipo de oportunidade" valor={tipo} onChange={set(setTipo)}><option value="">Todos</option>{(f?.tipos ?? []).map((t: any) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}</Filtro>
              <div className="flex items-end h-full">{temFiltro && <Button type="button" variant="subtle" icon="X" onClick={limpar}>Limpar filtros</Button>}</div>
              </div>
            </form>
          )}
        </section>

        {/* Lista */}
        {MODO_API && (
          <section id="vagas" className="mt-6" aria-labelledby="vagas-titulo">
            <div className="flex items-end justify-between gap-3 mb-3">
              <h2 id="vagas-titulo" className="text-[13.5px] text-[#58636e]" aria-live="polite">{r.dados ? `${total} ${total === 1 ? 'vaga encontrada' : 'vagas encontradas'}${temFiltro ? ' com os filtros' : ''}` : 'Carregando vagas…'}</h2>
              <span className="text-[12px] text-[#5f6b76]">Mais recentes primeiro</span>
            </div>
            {r.erro && !r.dados ? <ErroBloco mensagem="Não conseguimos carregar as vagas agora. Tente novamente em instantes." onTentar={r.recarregar} /> :
              r.carregando && !r.dados ? <CarregandoBloco linhas={4} /> :
              r.dados && r.dados.itens.length === 0 ? (
                <div className="rounded-2xl border border-dashed border-[#d3d9df] bg-[#fafbfd]">
                  <EmptyState icon="SearchX" title={temFiltro ? 'Nenhuma vaga com esses filtros' : 'Nenhuma vaga aberta no momento'}
                    desc={temFiltro ? 'Tente outros termos ou remova alguns filtros.' : 'Novas oportunidades são publicadas com frequência. Volte em breve.'}
                    action={temFiltro ? <Button variant="ghost" onClick={limpar}>Limpar filtros</Button> : undefined} />
                </div>
              ) : (
                <>
                  <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{(r.dados?.itens as VagaCard[]).map((v) => <li key={v.slug}><CartaoVaga v={v} /></li>)}</ul>
                  {total > (r.dados?.por ?? 12) && <div className="mt-4 rounded-2xl border border-[#e4e8ed]"><Paginacao pagina={pagina} por={r.dados?.por ?? 12} total={total} onPagina={setPagina} /></div>}
                </>
              )}
            {!!r.dados?.encerradas?.length && (
              <div className="mt-8">
                <h3 className="text-[12px] font-bold uppercase tracking-wider text-[#5f6b76] mb-2">Encerradas recentemente</h3>
                <ul className="rounded-2xl border border-[#e4e8ed] divide-y divide-[#f0f2f5] bg-white">
                  {r.dados.encerradas.map((v: any, i: number) => <li key={i} className="flex flex-wrap items-center justify-between gap-2 px-5 py-3 text-[13.5px]"><span className="text-[#58636e]">{v.titulo}{v.area ? ` · ${v.area}` : ''}</span><span className="text-[12px] text-[#5f6b76]">Inscrições encerradas</span></li>)}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* Como funciona */}
        {etapas.length > 0 && (
          <section aria-labelledby="proc-titulo" className="mt-12 mb-12 rounded-3xl bg-[#0b1530] text-white p-6 sm:p-10">
            <div className="grid grid-cols-1 lg:grid-cols-[320px_1fr] gap-8">
              <div>
                <span className="text-[11.5px] font-bold uppercase tracking-wider text-[#9fb4ff]">Processo seletivo</span>
                <h2 id="proc-titulo" className="text-[24px] sm:text-[28px] font-extrabold tracking-tight mt-2">Como funciona</h2>
                <p className="text-[14px] text-[#c5d0e6] mt-2">Transparência do primeiro clique ao resultado. Cada vaga mostra as próprias etapas, e você acompanha tudo com o seu código.</p>
              </div>
              <ol className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3">
                {etapas.map((e, i) => (
                  <li key={e.titulo} className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
                    <span className="grid place-items-center h-8 w-8 rounded-full bg-[#0032D2] text-white text-[13px] font-extrabold">{i + 1}</span>
                    <b className="block mt-3 text-[14.5px]">{e.titulo}</b>
                    {e.descricao && <p className="text-[12.5px] text-[#c5d0e6] mt-1">{e.descricao}</p>}
                  </li>
                ))}
              </ol>
            </div>
          </section>
        )}
      </Contenedor>
    </PortalLayout>
  )
}
