/* Página pública da vaga: tudo o que o candidato precisa para decidir, numa tela só —
   a vaga, as etapas, a 4JURIS (quem somos, missão, valores, cultura) e outras oportunidades. */
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Button, EmptyState, Icon } from '@/components/ui'
import { Contenedor, PortalLayout, RedesSociais, useMeta, usePortal, ModalCodigo } from '@/components/v2/carreiras/PortalLayout'
import { CarregandoBloco, ErroBloco } from '@/components/v2/estados'
import { useApi } from '@/data/v2/api'
import { MODO_API } from '@/data/config'
import { toast } from '@/components/toast'
import { dataBR, moeda } from '@/lib/fmt'
import { CartaoVaga, Chip, localDe, rotuloRegime, ROTULO_MODALIDADE, type VagaCard } from './Carreiras'
import { documentoDaVagaPublica, ImpressaoVaga } from '@/components/v2/vagas/DocumentoVaga'

/* Endereço da sede, usado no mapa quando a vaga não informa outro. */
const ENDERECO_4JURIS = 'ITC Central Park - R. Ary Barroso, 70 - Papicu, Fortaleza - CE'

/* Funções (e não componentes) para que um campo vazio resulte em null e a seção suma junto com o título. */
const lista = (itens?: string[] | null) => (itens?.length ? <ul className="space-y-2">{itens.map((i) => <li key={i} className="flex gap-2.5 text-[14.5px] text-[#3d4b56] leading-relaxed"><Icon name="Check" className="h-4 w-4 text-brand mt-1 shrink-0" />{i}</li>)}</ul> : null)
const texto = (t?: string | null) => (t && t.trim() ? <p className="text-[14.5px] text-[#3d4b56] whitespace-pre-wrap leading-[1.75]">{t}</p> : null)
function Secao({ titulo, icone, children }: { titulo: string; icone?: string; children?: React.ReactNode }) {
  if (!children) return null
  return (
    <section className="py-7 border-b border-[#eef1f4] last:border-0">
      <h2 className="text-[18px] font-extrabold tracking-tight text-[#122029] mb-3 flex items-center gap-2">{icone && <Icon name={icone} className="h-[18px] w-[18px] text-brand" />}{titulo}</h2>
      {children}
    </section>
  )
}
function Item({ icone, rotulo, valor }: { icone: string; rotulo: string; valor?: React.ReactNode }) {
  if (!valor) return null
  return (
    <div className="flex gap-3 py-2.5">
      <span className="grid place-items-center h-8 w-8 rounded-lg bg-[#f2f5fe] text-brand shrink-0"><Icon name={icone} className="h-4 w-4" /></span>
      <div className="min-w-0"><div className="text-[11px] font-bold uppercase tracking-wider text-[#7a8590]">{rotulo}</div><div className="text-[13.5px] font-semibold text-[#122029] break-words">{valor}</div></div>
    </div>
  )
}

export default function VagaPublica() {
  const { slug = '' } = useParams()
  const r = useApi<any>(MODO_API ? `publico/vagas/${slug}` : null)
  const outras = useApi<{ itens: VagaCard[] }>(MODO_API ? 'publico/vagas?por=7' : null)
  const portal = usePortal()
  const v = r.dados
  const [pdf, setPdf] = useState(false)
  const [codigo, setCodigo] = useState(false)
  useMeta(v ? `${v.titulo} · 4JURIS Carreiras` : 'Vaga · 4JURIS Carreiras', v?.resumo ?? undefined)
  const candidatar = v ? `/carreiras/${v.slug}/candidatar${window.location.search}` : '#'

  async function compartilhar() {
    const url = window.location.href
    try {
      if (navigator.share) { await navigator.share({ title: v.titulo, url }); return }
      await navigator.clipboard.writeText(url)
      toast('Link da vaga copiado.')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') toast('Não foi possível copiar. Copie o endereço da barra do navegador.', 'danger')
    }
  }

  if (!MODO_API) return <PortalLayout><Contenedor className="py-10"><EmptyState icon="DatabaseZap" title="Portal indisponível neste modo" desc="O portal de carreiras depende do servidor conectado." /></Contenedor></PortalLayout>
  if (r.carregando && !v) return <PortalLayout><Contenedor className="py-10"><CarregandoBloco linhas={5} /></Contenedor></PortalLayout>
  if (r.erro || !v) return (
    <PortalLayout><Contenedor className="py-10" largura="max-w-3xl">
      {r.erro?.status === 410 ? <EmptyState icon="CircleSlash" title="Esta vaga não recebe mais candidaturas" desc={r.erro.message} action={<Link to="/carreiras"><Button>Ver vagas abertas</Button></Link>} />
        : r.erro?.status === 404 ? <EmptyState icon="SearchX" title="Vaga não encontrada" desc="O link pode estar incorreto ou a vaga já foi encerrada." action={<Link to="/carreiras"><Button>Ver vagas abertas</Button></Link>} />
          : <ErroBloco mensagem="Não conseguimos carregar esta vaga agora." onTentar={r.recarregar} />}
    </Contenedor></PortalLayout>
  )

  const local = localDe(v)
  const regime = rotuloRegime(v.regimeContratacao)
  const salario = v.salario && (v.salario.min || v.salario.max)
    ? `${v.salario.min ? moeda(v.salario.min, v.salario.moeda) : ''}${v.salario.min && v.salario.max ? ' a ' : ''}${v.salario.max ? moeda(v.salario.max, v.salario.moeda) : ''}${v.salario.tipo ? ` (${v.salario.tipo})` : ''}` : null
  const etapas: { titulo: string; descricao?: string }[] = v.etapasProcesso?.length ? (v.etapasProcesso as string[]).map((t) => ({ titulo: t })) : (portal.processoSeletivo ?? [])
  const sobre = v.sobreEmpresa || portal.quemSomos
  const enderecoMapa = v.endereco?.trim() || ENDERECO_4JURIS
  const outrasVagas =(outras.dados?.itens ?? []).filter((x) => x.slug !== v.slug).slice(0, 4)

  return (
    <PortalLayout>
      {/* Cabeçalho da vaga */}
      <div className="border-b border-[#eef1f4] bg-gradient-to-b from-[#f5f7ff] to-white">
        <Contenedor className="pt-6 pb-8 sm:pb-10">
          <Link to="/carreiras" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#58636e] hover:text-brand"><Icon name="ArrowLeft" className="h-4 w-4" />Todas as vagas</Link>
          <div className="mt-5 text-[12px] font-bold uppercase tracking-[0.14em] text-brand">Vaga aberta · 4JURIS{v.area ? ` · ${v.area}` : ''}</div>
          <h1 className="mt-2 text-[30px] sm:text-[44px] leading-[1.05] font-extrabold tracking-tight text-[#122029] max-w-4xl">{v.titulo}</h1>
          <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-[14px] text-[#3d4b56]">
            {local && <span className="inline-flex items-center gap-1.5"><Icon name="MapPin" className="h-4 w-4 text-[#7a8590]" />{local}</span>}
            <span className="inline-flex items-center gap-1.5"><Icon name="Building2" className="h-4 w-4 text-[#7a8590]" />{ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade}</span>
            {regime && <span className="inline-flex items-center gap-1.5"><Icon name="BriefcaseBusiness" className="h-4 w-4 text-[#7a8590]" />{regime}</span>}
            {v.senioridade && <span className="inline-flex items-center gap-1.5"><Icon name="TrendingUp" className="h-4 w-4 text-[#7a8590]" />{v.senioridade}</span>}
            {v.jornada && v.jornada.length <= 40 && <span className="inline-flex items-center gap-1.5"><Icon name="Clock" className="h-4 w-4 text-[#7a8590]" />{v.jornada}</span>}
          </div>
          <div className="mt-6 flex flex-col sm:flex-row sm:flex-wrap gap-2.5">
            <Link to={candidatar} className="sm:w-auto"><Button size="lg" icon="Send" className="w-full sm:w-auto justify-center">Candidatar-me</Button></Link>
            <div className="grid grid-cols-3 sm:flex gap-2.5">
              <Button size="lg" variant="ghost" icon="KeyRound" onClick={() => setCodigo(true)} className="justify-center px-3 sm:px-6"><span className="hidden sm:inline">Já me candidatei</span><span className="sm:hidden">Meu código</span></Button>
              <Button size="lg" variant="ghost" icon="Share2" onClick={compartilhar} className="justify-center px-3 sm:px-6">Compartilhar</Button>
              <Button size="lg" variant="subtle" icon="Download" onClick={() => setPdf(true)} className="justify-center px-3 sm:px-6">PDF</Button>
            </div>
          </div>
        </Contenedor>
      </div>

      <Contenedor className="py-6 sm:py-8">
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_340px] gap-8 lg:gap-12 items-start">
          {/* Conteúdo */}
          <article className="min-w-0">
            {v.imagemUrl && <img src={v.imagemUrl} alt="" className="w-full max-h-80 rounded-2xl object-cover mb-2 bg-[#e9ecec]" />}
            <Secao titulo="Sobre a vaga" icone="FileText">{texto(v.descricao || v.resumo)}</Secao>
            <Secao titulo="Responsabilidades" icone="ListChecks">{texto(v.responsabilidades)}</Secao>
            <Secao titulo="O dia a dia" icone="CalendarDays">{texto(v.atividades)}</Secao>
            <Secao titulo="Desafios da posição" icone="Target">{texto(v.desafios)}</Secao>
            <Secao titulo="Requisitos" icone="BadgeCheck">{lista(v.requisitosObrigatorios)}</Secao>
            <Secao titulo="Diferenciais" icone="Star">{lista(v.requisitosDesejaveis)}</Secao>
            <Secao titulo="Formação e experiência" icone="GraduationCap">{(v.formacao || v.experiencia) ? <div className="space-y-3">{texto(v.formacao)}{texto(v.experiencia)}</div> : null}</Secao>
            <Secao titulo="Idiomas" icone="Languages">{lista(v.idiomas)}</Secao>
            <Secao titulo="Certificações" icone="Award">{lista(v.certificacoes)}</Secao>
            <Secao titulo="O que oferecemos" icone="Gift">{v.beneficios?.length ? <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">{(v.beneficios as string[]).map((b) => <li key={b} className="flex items-center gap-2.5 rounded-xl border border-[#e4e8ed] bg-[#fafbfd] px-3.5 py-2.5 text-[13.5px] font-semibold text-[#122029]"><Icon name="Sparkle" className="h-4 w-4 text-brand shrink-0" />{b}</li>)}</ul> : null}</Secao>
            <Secao titulo="Jornada" icone="Clock">{v.jornada && v.jornada.length > 40 ? texto(v.jornada) : null}</Secao>
            <Secao titulo="Viagens" icone="Plane">{texto(v.viagens)}</Secao>
            <Secao titulo="Documentos que poderemos pedir" icone="FolderOpen">{lista(v.documentosNecessarios)}</Secao>

            {/* Etapas do processo */}
            {etapas.length > 0 && (
              <section className="py-7 border-b border-[#eef1f4]">
                <h2 className="text-[18px] font-extrabold tracking-tight text-[#122029] mb-1 flex items-center gap-2"><Icon name="Route" className="h-[18px] w-[18px] text-brand" />Etapas do processo seletivo</h2>
                <p className="text-[13px] text-[#58636e] mb-4">Você recebe um código ao se candidatar e acompanha cada etapa por ele.</p>
                <ol className="relative">
                  {etapas.map((e, i) => (
                    <li key={i} className="relative flex gap-4 pb-5 last:pb-0">
                      {i < etapas.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-0.5 bg-[#dbe3fb]" />}
                      <span className="relative z-[1] grid place-items-center h-8 w-8 rounded-full bg-brand text-white text-[13px] font-extrabold shrink-0">{i + 1}</span>
                      <div className="pt-1"><b className="text-[14.5px] text-[#122029]">{e.titulo}</b>{e.descricao && <p className="text-[13px] text-[#58636e] mt-0.5">{e.descricao}</p>}</div>
                    </li>
                  ))}
                </ol>
              </section>
            )}

            {/* A 4JURIS */}
            {(sobre || portal.missao || portal.visao || portal.valores?.length || portal.cultura || portal.comoTrabalhar) && (
              <section className="py-8">
                <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand">Quem somos</span>
                <h2 className="text-[24px] font-extrabold tracking-tight text-[#122029] mt-1 mb-3">Trabalhar na 4JURIS</h2>
                {texto(sobre)}
                {(portal.missao || portal.visao) && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-5">
                    {portal.missao && <div className="rounded-2xl bg-[#f2f5fe] p-5"><div className="text-[11.5px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5"><Icon name="Target" className="h-3.5 w-3.5" />Missão</div><p className="text-[14px] text-[#122029] mt-1.5 leading-relaxed">{portal.missao}</p></div>}
                    {portal.visao && <div className="rounded-2xl bg-[#f2f5fe] p-5"><div className="text-[11.5px] font-bold uppercase tracking-wider text-brand flex items-center gap-1.5"><Icon name="Telescope" className="h-3.5 w-3.5" />Visão</div><p className="text-[14px] text-[#122029] mt-1.5 leading-relaxed">{portal.visao}</p></div>}
                  </div>
                )}
                {!!portal.valores?.length && (
                  <div className="mt-6">
                    <h3 className="text-[15px] font-extrabold text-[#122029] mb-3">Nossos valores</h3>
                    <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">{portal.valores.map((x) => (
                      <li key={x.nome} className="rounded-2xl border border-[#e4e8ed] p-4"><b className="text-[14px] text-[#122029] flex items-center gap-2"><Icon name="Heart" className="h-4 w-4 text-brand" />{x.nome}</b>{x.descricao && <p className="text-[13px] text-[#58636e] mt-1">{x.descricao}</p>}</li>
                    ))}</ul>
                  </div>
                )}
                {portal.cultura && <div className="mt-6"><h3 className="text-[15px] font-extrabold text-[#122029] mb-2">Nossa cultura</h3>{texto(portal.cultura)}</div>}
                {portal.comoTrabalhar && <div className="mt-6"><h3 className="text-[15px] font-extrabold text-[#122029] mb-2">Como é o dia a dia aqui</h3>{texto(portal.comoTrabalhar)}</div>}
                {!!portal.diferenciais?.length && <ul className="flex flex-wrap gap-2 mt-5">{portal.diferenciais.map((d) => <li key={d}><Chip className="bg-[#f2f5fe] text-brand">{d}</Chip></li>)}</ul>}
                {!!portal.redes?.length && <div className="mt-6 flex flex-wrap items-center gap-3"><span className="text-[13px] font-semibold text-[#58636e]">Acompanhe a 4JURIS:</span><RedesSociais redes={portal.redes} /></div>}
              </section>
            )}

            {/* Como chegar */}
            <section className="py-8 border-t border-[#eef1f4]">
              <span className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-brand">Onde estamos</span>
              <h2 className="text-[24px] font-extrabold tracking-tight text-[#122029] mt-1 mb-2">Como chegar</h2>
              <p className="text-[14.5px] text-[#3d4b56] flex items-start gap-2 mb-4"><Icon name="MapPin" className="h-4 w-4 text-brand mt-1 shrink-0" />{enderecoMapa}</p>
              <div className="overflow-hidden rounded-2xl border border-[#e4e8ed] bg-[#e9ecec]">
                <iframe
                  title="Mapa da 4JURIS"
                  src={`https://www.google.com/maps?q=${encodeURIComponent(enderecoMapa)}&output=embed`}
                  className="block w-full h-[280px] sm:h-[360px] border-0"
                  loading="lazy"
                  referrerPolicy="no-referrer-when-downgrade"
                  allowFullScreen
                />
              </div>
              <a href={`https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(enderecoMapa)}`} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1.5 text-[13.5px] font-bold text-brand hover:underline"><Icon name="Navigation" className="h-4 w-4" />Traçar rota no Google Maps</a>
            </section>
          </article>

          {/* Resumo fixo */}
          <aside className="order-first lg:order-none lg:sticky lg:top-24 space-y-4">
            <div className="rounded-2xl border border-[#e4e8ed] bg-white p-5 shadow-[0_16px_40px_-28px_rgba(18,32,41,.45)]">
              <div className="text-[11.5px] font-bold uppercase tracking-[0.14em] text-[#7a8590] mb-1">Resumo da vaga</div>
              <div className="divide-y divide-[#f0f2f5]">
                <Item icone="MapPin" rotulo="Localização" valor={local} />
                <Item icone="Building2" rotulo="Modelo de trabalho" valor={ROTULO_MODALIDADE[v.modalidade] ?? v.modalidade} />
                <Item icone="BriefcaseBusiness" rotulo="Contratação" valor={regime ?? v.tipoRotulo} />
                <Item icone="TrendingUp" rotulo="Nível" valor={v.senioridade} />
                <Item icone="Clock" rotulo="Jornada" valor={v.jornada && v.jornada.length <= 40 ? v.jornada : null} />
                <Item icone="Users" rotulo="Posições" valor={v.posicoes ? `${v.posicoes} ${v.posicoes === 1 ? 'vaga' : 'vagas'}` : null} />
                <Item icone="Wallet" rotulo="Remuneração" valor={salario} />
                <Item icone="CalendarDays" rotulo="Publicada em" valor={v.publicadaEm ? dataBR(v.publicadaEm) : null} />
                <Item icone="CalendarClock" rotulo="Inscrições até" valor={v.encerraEm ? dataBR(v.encerraEm) : 'Enquanto a vaga estiver aberta'} />
                <Item icone="Navigation" rotulo="Endereço" valor={v.endereco} />
              </div>
              <Link to={candidatar} className="block mt-4"><Button size="lg" icon="Send" className="w-full justify-center">Candidatar-me</Button></Link>
              <button type="button" onClick={compartilhar} className="mt-2 w-full inline-flex items-center justify-center gap-1.5 h-10 rounded-xl text-[13px] font-semibold text-[#3d4b56] hover:text-brand"><Icon name="Share2" className="h-4 w-4" />Compartilhar esta vaga</button>
            </div>
            <div className="rounded-2xl bg-[#f2f5fe] p-5 text-[13px] text-[#3d4b56]">
              <b className="flex items-center gap-2 text-[#122029] mb-1"><Icon name="ShieldCheck" className="h-4 w-4 text-brand" />Processo transparente</b>
              Ao se candidatar, você recebe um código para acompanhar as etapas. Seus dados são usados só neste processo seletivo.
            </div>
          </aside>
        </div>

        {/* Outras vagas */}
        {outrasVagas.length > 0 && (
          <section className="mt-12" aria-labelledby="outras-titulo">
            <div className="flex items-end justify-between gap-3 mb-4">
              <h2 id="outras-titulo" className="text-[22px] font-extrabold tracking-tight text-[#122029]">Outras vagas abertas</h2>
              <Link to="/carreiras" className="text-[13.5px] font-bold text-brand inline-flex items-center gap-1">Ver todas <Icon name="ArrowRight" className="h-4 w-4" /></Link>
            </div>
            <ul className="grid grid-cols-1 md:grid-cols-2 gap-4">{outrasVagas.map((x) => <li key={x.slug}><CartaoVaga v={x} compacto /></li>)}</ul>
          </section>
        )}

        {/* Chamada final */}
        <section className="mt-12 mb-24 lg:mb-12 rounded-3xl bg-[#0b1530] text-white p-7 sm:p-10 flex flex-col md:flex-row md:items-center justify-between gap-6 overflow-hidden relative">
          <div aria-hidden className="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-[#0032D2]/40 blur-2xl" />
          <div className="relative">
            <h2 className="text-[24px] sm:text-[30px] font-extrabold tracking-tight">Pronto para fazer parte da 4JURIS?</h2>
            <p className="text-[14.5px] text-[#c5d0e6] mt-2 max-w-xl">A candidatura leva poucos minutos. Você recebe um código para acompanhar cada etapa do processo.</p>
          </div>
          <div className="relative flex flex-col sm:flex-row gap-2.5 shrink-0">
            <Link to={candidatar}><Button size="lg" icon="Send" className="w-full justify-center whitespace-nowrap">Candidatar-me a esta vaga</Button></Link>
            <button type="button" onClick={compartilhar} className="inline-flex items-center justify-center gap-1.5 h-12 px-5 rounded-xl border border-white/25 text-[14px] font-semibold hover:bg-white/10 whitespace-nowrap"><Icon name="Share2" className="h-4 w-4" />Indicar a alguém</button>
          </div>
        </section>
      </Contenedor>

      {/* Celular: candidatura sempre à mão */}
      <div className="lg:hidden fixed inset-x-0 bottom-0 z-30 border-t border-[#e4e8ed] bg-white/95 backdrop-blur px-4 py-3 pb-[max(12px,env(safe-area-inset-bottom))] flex items-center gap-3">
        <div className="min-w-0 flex-1"><div className="text-[13px] font-bold text-[#122029] truncate">{v.titulo}</div><div className="text-[11.5px] text-[#58636e] truncate">{[local, ROTULO_MODALIDADE[v.modalidade], regime].filter(Boolean).join(' · ')}</div></div>
        <Link to={candidatar}><Button icon="Send">Candidatar-me</Button></Link>
      </div>

      {pdf && <ImpressaoVaga d={documentoDaVagaPublica(v)} onFim={() => setPdf(false)} />}
      <ModalCodigo open={codigo} onClose={() => setCodigo(false)} />
    </PortalLayout>
  )
}
