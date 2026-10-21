/* People Analytics · seções Recrutamento, Pesquisas e Estrutura. Só exibem o que o servidor devolveu. */
import { Badge, BarList, Callout, Card, EmptyState, Tabela, TD, TH } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import { Funil, LinhaTempo } from '@/components/v2/charts2'
import { AvisoFiltros, BlocoCard, CartaoIndicador } from './comum'
import { numero } from '@/lib/fmt'
import type { Indicador } from '@/domain/v2/analytics'

type Abrir = (i: Indicador) => void
const CORES = ['#0032D2', '#0B7A52', '#925F00', '#C02E26', '#6B4FD8', '#0E8FA3', '#8A5A44', '#4D6BEC']
const mesCurto = (m: string) => { const [a, mm] = m.split('-'); return `${mm}/${a.slice(2)}` }
const val = (v: unknown) => (v === null || v === undefined || v === '' ? '—' : typeof v === 'number' ? numero(v, Number.isInteger(v) ? 0 : 1) : String(v))

function Grade({ indicadores, anterior, onDetalhe }: { indicadores: Indicador[]; anterior?: string | null; onDetalhe: Abrir }) {
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-5 gap-4 mb-5">
      {indicadores.map((i) => <CartaoIndicador key={i.chave} i={i} periodoAnterior={anterior} onDetalhe={onDetalhe} />)}
    </div>
  )
}

function TabelaSimples({ colunas, linhas, vazio = 'Sem dados.' }: { colunas: { chave: string; rotulo: string }[]; linhas: Record<string, any>[]; vazio?: string }) {
  if (!linhas.length) return <p className="text-[13px] text-muted py-3">{vazio}</p>
  return (
    <Tabela minWidth={420}>
      <thead><tr>{colunas.map((c) => <th key={c.chave} className={TH}>{c.rotulo}</th>)}</tr></thead>
      <tbody>{linhas.map((l, i) => <tr key={i}>{colunas.map((c) => <td key={c.chave} className={TD}>{val(l[c.chave])}</td>)}</tr>)}</tbody>
    </Tabela>
  )
}

export function Omitido({ motivo }: { motivo: string }) {
  return <Card className="p-6"><EmptyState icon="Lock" title="Bloco indisponível para o seu perfil" desc={motivo} /></Card>
}

/* ---------------- Recrutamento ---------------- */
export function SecaoRecrutamento({ b, onDetalhe }: { b: any; onDetalhe: Abrir }) {
  if (b.semDados) return (
    <>
      <AvisoFiltros aplicados={b.filtrosAplicados} ignorados={b.filtrosIgnorados} />
      <Card className="p-6"><EmptyState icon="BriefcaseBusiness" title="Nenhuma vaga aberta neste período" desc="Altere o período ou os filtros. Quando houver vagas abertas, os indicadores aparecem aqui." /></Card>
    </>
  )
  const tabela = (k: string) => b.tabelas.find((t: any) => t.chave === k)
  return (
    <>
      <AvisoFiltros aplicados={b.filtrosAplicados} ignorados={b.filtrosIgnorados} />
      {b.candidatosSemDados && <Callout tone="neutral" icon="Info" className="mb-4">Ainda não há candidaturas nas vagas deste período; indicadores de funil, conversão e tempos ficam indisponíveis.</Callout>}
      <Grade indicadores={b.indicadores} anterior={b.periodoAnterior} onDetalhe={onDetalhe} />
      <div className="grid lg:grid-cols-2 gap-4">
        <BlocoCard titulo="Funil de recrutamento" periodo={b.periodo}>
          <Funil etapas={b.funil.map((f: any) => ({ rotulo: f.rotulo, valor: f.alcancaram }))} vazio="Sem candidaturas no período." />
        </BlocoCard>
        <BlocoCard titulo="Tempo médio por etapa (dias)" periodo={b.periodo}>
          <BarList itens={b.tempoPorEtapa.map((t: any) => ({ rotulo: `${t.etapa} (${t.n})`, valor: t.dias, sufixo: ' d' }))} vazio="Sem etapas concluídas para medir." />
        </BlocoCard>
        <BlocoCard titulo="Vagas abertas e contratações por mês" periodo={b.periodo}>
          <p className="text-[12px] font-semibold text-ink-2 mb-1">Vagas abertas</p>
          <LinhaTempo titulo="Vagas abertas por mês" altura={130} pontos={b.evolucao.map((e: any) => ({ rotulo: mesCurto(e.mes), valor: e.vagasAbertas }))} />
          <p className="text-[12px] font-semibold text-ink-2 mt-3 mb-1">Contratações</p>
          <LinhaTempo titulo="Contratações por mês" altura={130} cor="rgb(var(--c-success))" pontos={b.evolucao.map((e: any) => ({ rotulo: mesCurto(e.mes), valor: e.contratacoes }))} />
        </BlocoCard>
        <BlocoCard titulo="Candidaturas por canal" periodo={b.periodo}>
          <BarList itens={b.canais.map((c: any) => ({ rotulo: c.rotulo, valor: c.qtd }))} vazio="Sem candidaturas no período." />
        </BlocoCard>
        <BlocoCard titulo="Por departamento" periodo={b.periodo} className="lg:col-span-2"><TabelaSimples colunas={tabela('por_setor').colunas} linhas={tabela('por_setor').linhas} /></BlocoCard>
        <BlocoCard titulo="Por recrutador" periodo={b.periodo} className="lg:col-span-2"><TabelaSimples colunas={tabela('por_recrutador').colunas} linhas={tabela('por_recrutador').linhas} /></BlocoCard>
        <BlocoCard titulo="Motivos de encerramento" periodo={b.periodo}>
          <BarList itens={b.motivos.map((m: any) => ({ rotulo: m.motivo, valor: m.qtd }))} vazio="Nenhuma vaga encerrada ou cancelada no período." />
        </BlocoCard>
        <BlocoCard titulo="Candidaturas por vaga (10 maiores)" periodo={b.periodo}>
          <BarList itens={b.porVaga.map((v: any) => ({ rotulo: `${v.codigo} · ${v.titulo}`, valor: v.candidaturas }))} vazio="Sem candidaturas no período." />
        </BlocoCard>
      </div>
    </>
  )
}

/* ---------------- Pesquisas ---------------- */
export function SecaoPesquisas({ b, onDetalhe }: { b: any; onDetalhe: Abrir }) {
  const tabela = (k: string) => b.tabelas.find((t: any) => t.chave === k)
  return (
    <>
      <AvisoFiltros aplicados={b.filtrosAplicados} ignorados={b.filtrosIgnorados} />
      <Callout tone="brand" icon="ShieldCheck" className="mb-4">{b.avisoAnonimato}</Callout>
      {b.semDados ? (
        <Card className="p-6"><EmptyState icon="ClipboardList" title="Nenhuma pesquisa iniciada neste período" desc="Pesquisas publicadas aparecem aqui com participação, eNPS e resultados protegidos." /></Card>
      ) : (
        <>
          <Grade indicadores={b.indicadores} anterior={b.periodoAnterior} onDetalhe={onDetalhe} />
          {b.baixaAdesao.length > 0 && (
            <Callout tone="warning" icon="AlertTriangle" className="mb-4">
              Baixa participação em: {b.baixaAdesao.map((x: any) => `${x.titulo} (${numero(x.taxa ?? 0, 1)}%)`).join('; ')}. A taxa mede participação, não satisfação.
            </Callout>
          )}
          <div className="grid lg:grid-cols-2 gap-4">
            <BlocoCard titulo="Evolução do eNPS" periodo={b.periodo} className="lg:col-span-2">
              {b.seriesEnps.length === 0 ? <p className="text-[13px] text-muted py-3">Nenhuma pesquisa do período tem eNPS com respostas suficientes para exibir.</p> : b.seriesEnps.map((s: any, i: number) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-[12px] text-muted mb-1">Pergunta: “{s.pergunta}”</p>
                  {s.comparavel
                    ? <LinhaTempo titulo={`eNPS ao longo das pesquisas: ${s.pergunta}`} formato={(v) => numero(v)} pontos={s.pontos.map((p: any) => ({ rotulo: `${p.titulo.slice(0, 14)}`, valor: p.enps }))} />
                    : <p className="text-[13px] text-ink-2">Há apenas uma pesquisa com esta pergunta ({s.pontos[0].titulo}: eNPS {s.pontos[0].enps}, {s.pontos[0].n} respostas). A evolução aparece quando houver outra pesquisa com a <b>mesma pergunta</b>.</p>}
                </div>
              ))}
            </BlocoCard>
            <BlocoCard titulo="Pesquisas do período" periodo={b.periodo} className="lg:col-span-2">
              <TabelaSimples colunas={tabela('pesquisas').colunas} linhas={tabela('pesquisas').linhas} />
            </BlocoCard>
            <BlocoCard titulo="Resultados por dimensão (média de 1 a 5)" periodo={b.periodo}>
              {b.dimensoes.length === 0 ? <p className="text-[13px] text-muted py-3">Sem escalas Likert/estrelas com respostas suficientes.</p> : b.dimensoes.map((d: any, i: number) => (
                <div key={i} className="mb-3 last:mb-0">
                  <p className="text-[12.5px] font-semibold text-ink mb-1">{d.dimensao}</p>
                  {d.comparavel
                    ? <LinhaTempo titulo={`Média de ${d.dimensao}`} altura={110} formato={(v) => numero(v, 2)} pontos={d.pontos.map((p: any) => ({ rotulo: p.titulo.slice(0, 12), valor: p.media }))} />
                    : <BarList itens={d.pontos.map((p: any) => ({ rotulo: `${p.titulo} (${p.n})`, valor: p.media }))} total={5} />}
                </div>
              ))}
              <p className="text-[11.5px] text-muted mt-2">Dimensões só são comparadas entre pesquisas quando têm exatamente as mesmas perguntas.</p>
            </BlocoCard>
            <BlocoCard titulo="Participação por área" periodo={b.periodo}>
              {b.porArea.length === 0 ? <p className="text-[13px] text-muted py-3">{b.filtrosAplicados.some((f: string) => f === 'área' || f === 'unidade') ? 'Detalhe por área indisponível quando há filtro de área ou unidade.' : 'Sem pesquisas com convite individual no período.'}</p> : (
                <Tabela minWidth={380}>
                  <thead><tr><th className={TH}>Área</th><th className={TH}>Convidados</th><th className={TH}>Respostas</th><th className={TH}>Participação</th></tr></thead>
                  <tbody>{b.porArea.map((a: any) => (
                    <tr key={a.chave}>
                      <td className={TD}>{a.area}</td><td className={TD}>{a.convidados}</td>
                      <td className={TD}>{a.suprimido ? <Badge tone="neutral">Oculto: grupo pequeno</Badge> : a.respostas}</td>
                      <td className={TD}>{a.suprimido || a.taxa === null ? '—' : `${numero(a.taxa, 1)}%`}</td>
                    </tr>
                  ))}</tbody>
                </Tabela>
              )}
            </BlocoCard>
          </div>
        </>
      )}
    </>
  )
}

/* ---------------- Estrutura ---------------- */
export function SecaoEstrutura({ b, onDetalhe }: { b: any; onDetalhe: Abrir }) {
  const tabela = (k: string) => b.tabelas.find((t: any) => t.chave === k)
  return (
    <>
      <AvisoFiltros aplicados={b.filtrosAplicados} ignorados={b.filtrosIgnorados} />
      <Callout tone="neutral" icon="Info" className="mb-4">Retrato da situação atual do cadastro. Os números descrevem a estrutura; muitos ou poucos níveis não significam, por si só, uma estrutura boa ou ruim.</Callout>
      {b.semDados ? <Card className="p-6"><EmptyState icon="Users" title="Nenhuma pessoa ativa neste recorte" desc="Ajuste os filtros de área, unidade ou gestor." /></Card> : (
        <>
          <Grade indicadores={b.indicadores} onDetalhe={onDetalhe} />
          <div className="grid lg:grid-cols-2 gap-4">
            <BlocoCard titulo="Pessoas por departamento"><BarList itens={b.porSetor.map((x: any) => ({ rotulo: x.nome, valor: x.qtd }))} /></BlocoCard>
            <BlocoCard titulo="Pessoas por unidade"><DonutChart titulo="Pessoas por unidade" dados={b.porUnidade.map((x: any, i: number) => ({ rotulo: x.nome, valor: x.qtd, cor: CORES[i % CORES.length] }))} /></BlocoCard>
            <BlocoCard titulo="Pessoas por função"><BarList itens={b.porCargo.slice(0, 10).map((x: any) => ({ rotulo: x.nome, valor: x.qtd }))} /></BlocoCard>
            <BlocoCard titulo="Pessoas por senioridade"><DonutChart titulo="Pessoas por senioridade" dados={b.porSenioridade.map((x: any, i: number) => ({ rotulo: x.nome, valor: x.qtd, cor: CORES[i % CORES.length] }))} /></BlocoCard>
            <BlocoCard titulo="Níveis hierárquicos (organização inteira)"><BarList itens={b.porNivelHierarquico.map((x: any) => ({ rotulo: `Nível ${x.nivel}`, valor: x.qtd }))} /></BlocoCard>
            <BlocoCard titulo="Posições vagas por área"><BarList itens={b.posicoesVagas.porSetor.map((x: any) => ({ rotulo: x.nome, valor: x.qtd }))} vazio="Nenhuma posição vaga registrada." /></BlocoCard>
            <BlocoCard titulo="Maiores equipes (subordinados diretos)" className="lg:col-span-2"><TabelaSimples colunas={tabela('equipes').colunas} linhas={tabela('equipes').linhas.slice(0, 15)} vazio="Nenhum gestor com equipe cadastrada." /></BlocoCard>
            <BlocoCard titulo="Evolução da estrutura" className="lg:col-span-2">
              {b.evolucao
                ? <><p className="text-[12px] font-semibold text-ink-2 mb-1">Pessoas ativas (retrato mensal)</p><LinhaTempo titulo="Pessoas ativas por mês" altura={130} pontos={b.evolucao.map((e: any) => ({ rotulo: mesCurto(e.mes), valor: e.ativos }))} /></>
                : <p className="text-[13px] text-muted py-3">{b.mensagemEvolucao}</p>}
            </BlocoCard>
          </div>
        </>
      )}
    </>
  )
}

export function Indisponiveis({ itens }: { itens: Indicador[] }) {
  return (
    <details className="mt-6 group">
      <summary className="cursor-pointer text-[13px] font-semibold text-ink-2 hover:text-ink select-none">Indicadores que este painel não calcula ({itens.length})</summary>
      <div className="grid sm:grid-cols-2 gap-3 mt-3">
        {itens.map((i) => (
          <Card key={i.chave} className="p-4">
            <div className="text-[13px] font-bold text-ink">{i.rotulo} <Badge tone="neutral">Indisponível</Badge></div>
            <p className="text-[12.5px] text-muted mt-1.5 leading-snug">{i.dependencia}</p>
          </Card>
        ))}
      </div>
    </details>
  )
}
