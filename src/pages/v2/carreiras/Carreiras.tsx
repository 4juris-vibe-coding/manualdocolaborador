import { ROTULO_REGIME_CONTRATACAO } from '@/domain/v2/vagas'
import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, Icon, SearchBox, Select } from '@/components/ui'
import { Contenedor, PortalLayout, useMeta } from '@/components/v2/carreiras/PortalLayout'
import { CarregandoBloco, ErroBloco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { useAtraso } from '@/components/v2/ats/comuns'
import { qs, useApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { dataBR } from '@/lib/fmt'

export const ROTULO_MODALIDADE: Record<string, string> = { presencial: 'Presencial', hibrido: 'Híbrido', remoto: 'Remoto' }

export default function Carreiras() {
  useMeta('Vagas abertas · 4JURIS Carreiras', 'Conheça as oportunidades abertas na 4JURIS e envie a sua candidatura.')
  const [busca, setBusca] = useState('')
  const [area, setArea] = useState('')
  const [cidade, setCidade] = useState('')
  const [modalidade, setModalidade] = useState('')
  const [tipo, setTipo] = useState('')
  const [pagina, setPagina] = useState(1)
  const q = useAtraso(busca)
  const r = useApi<any>(MODO_API ? `publico/vagas${qs({ q, area, cidade: cidade.split('/')[0], modalidade, tipo, pagina })}` : null)
  const portal = r.dados?.portal
  const f = r.dados?.filtros
  const temFiltro = !!(q || area || cidade || modalidade || tipo)
  const limpar = () => { setBusca(''); setArea(''); setCidade(''); setModalidade(''); setTipo(''); setPagina(1) }

  return (
    <PortalLayout>
      <section className="bg-midnight text-white">
        <Contenedor className="py-10 sm:py-14">
          <h1 className="text-[28px] sm:text-[36px] font-extrabold tracking-tight">{portal?.titulo ?? 'Trabalhe na 4JURIS'}</h1>
          <p className="mt-3 max-w-2xl text-[15px] text-[#c5d0d8]">{portal?.apresentacao ?? 'Conheça as oportunidades abertas e envie a sua candidatura.'}</p>
        </Contenedor>
      </section>

      <Contenedor className="py-6 sm:py-8">
        {!MODO_API ? (
          <Card><EmptyState icon="DatabaseZap" title="Portal indisponível neste modo" desc="O portal de carreiras depende do servidor conectado." /></Card>
        ) : (
          <>
            <form role="search" aria-label="Filtrar vagas" onSubmit={(e) => e.preventDefault()} className="flex flex-wrap gap-3 mb-6">
              <SearchBox value={busca} onChange={(v) => { setBusca(v); setPagina(1) }} placeholder="Busque por cargo ou palavra-chave" label="Buscar vagas" />
              <Select label="Área" value={area} onChange={(v) => { setArea(v); setPagina(1) }}><option value="">Todas as áreas</option>{(f?.areas ?? []).map((a: string) => <option key={a}>{a}</option>)}</Select>
              <Select label="Localidade" value={cidade} onChange={(v) => { setCidade(v); setPagina(1) }}><option value="">Todas as cidades</option>{(f?.cidades ?? []).map((a: string) => <option key={a}>{a}</option>)}</Select>
              <Select label="Modalidade" value={modalidade} onChange={(v) => { setModalidade(v); setPagina(1) }}><option value="">Presencial, híbrido ou remoto</option>{(f?.modalidades ?? []).map((m: string) => <option key={m} value={m}>{ROTULO_MODALIDADE[m] ?? m}</option>)}</Select>
              <Select label="Tipo de oportunidade" value={tipo} onChange={(v) => { setTipo(v); setPagina(1) }}><option value="">Todos os tipos</option>{(f?.tipos ?? []).map((t: any) => <option key={t.valor} value={t.valor}>{t.rotulo}</option>)}</Select>
              {temFiltro && <Button type="button" variant="subtle" onClick={limpar}>Limpar filtros</Button>}
            </form>

            {r.erro && !r.dados ? <ErroBloco mensagem="Não conseguimos carregar as vagas agora. Tente novamente em instantes." onTentar={r.recarregar} /> :
              r.carregando && !r.dados ? <CarregandoBloco linhas={4} /> :
              r.dados && r.dados.itens.length === 0 ? (
                <Card><EmptyState icon="SearchX" title={temFiltro ? 'Nenhuma vaga encontrada' : 'Nenhuma vaga aberta no momento'}
                  desc={temFiltro ? 'Tente outros termos ou remova alguns filtros.' : 'Volte em breve: novas oportunidades são publicadas com frequência.'}
                  action={temFiltro ? <Button variant="ghost" onClick={limpar}>Limpar filtros</Button> : undefined} /></Card>
              ) : (
                <>
                  <p className="text-[13px] text-muted mb-3" aria-live="polite">{r.dados?.total} vaga(s) encontrada(s)</p>
                  <ul className="space-y-3">
                    {r.dados?.itens.map((v: any) => (
                      <li key={v.slug}>
                        <Link to={`/carreiras/${v.slug}`} className="card p-5 flex flex-wrap items-center justify-between gap-4 hover:border-brand transition outline-none focus-visible:ring-2 focus-visible:ring-brand">
                          {v.imagemUrl && <img src={v.imagemUrl} alt="" loading="lazy" className="h-20 w-32 rounded-xl object-cover shrink-0 bg-winter hidden sm:block" />}
                          <div className="min-w-0 flex-1">
                            <h2 className="text-[17px] font-bold text-ink">{v.titulo}</h2>
                            {v.resumo && <p className="text-[13.5px] text-muted mt-1 line-clamp-2">{v.resumo}</p>}
                            <div className="flex flex-wrap items-center gap-2 mt-3 text-[12.5px] text-ink-2">
                              {v.area && <Badge tone="brand">{v.area}</Badge>}
                              <Badge tone="neutral">{v.tipoRotulo}</Badge>{v.regimeContratacao && v.regimeContratacao !== 'nao_informado' && <Badge tone="neutral">{ROTULO_REGIME_CONTRATACAO[v.regimeContratacao]}</Badge>}
                              <Badge tone="neutral">{ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade}</Badge>
                              {(v.cidade || v.estado) && <span className="inline-flex items-center gap-1"><Icon name="MapPin" className="h-3.5 w-3.5" />{[v.cidade, v.estado].filter(Boolean).join('/')}</span>}
                            </div>
                          </div>
                          <div className="text-right text-[12px] text-muted shrink-0">
                            {v.publicadaEm && <div>Publicada em {dataBR(v.publicadaEm)}</div>}
                            {v.encerraEm && <div>Até {dataBR(v.encerraEm)}</div>}
                            <span className="inline-flex items-center gap-1 text-brand font-semibold text-[13px] mt-2">Ver vaga <Icon name="ArrowRight" className="h-4 w-4" /></span>
                          </div>
                        </Link>
                      </li>
                    ))}
                  </ul>
                  <Card className="mt-4"><Paginacao pagina={pagina} por={r.dados?.por ?? 12} total={r.dados?.total ?? 0} onPagina={setPagina} /></Card>
                </>
              )}
          </>
        )}
      </Contenedor>
    </PortalLayout>
  )
}
