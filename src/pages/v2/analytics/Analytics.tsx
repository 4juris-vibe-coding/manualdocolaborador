import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageHeader, Tabs, Button } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, qs, useApi } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import { BarraFiltros, Drilldown, FILTROS_CHAVES, type FiltrosUI } from '@/components/v2/analytics/comum'
import { Indisponiveis, Omitido, SecaoEstrutura, SecaoPesquisas, SecaoRecrutamento } from '@/components/v2/analytics/secoes'
import type { Bloco, Indicador } from '@/domain/v2/analytics'

interface Resumo {
  geradoEm: string; periodo: string; periodoAnterior: string
  blocos: Record<Bloco, any>
  indisponiveis: Indicador[]
  opcoes: { setores: { id: string; nome: string }[]; unidades: { id: string; nome: string }[] }
}

const ABAS: { key: Bloco; label: string }[] = [
  { key: 'recrutamento', label: 'Recrutamento' },
  { key: 'pesquisas', label: 'Pesquisas' },
  { key: 'estrutura', label: 'Estrutura' },
]

export default function PeopleAnalytics() {
  const [params, setParams] = useSearchParams()
  const filtros: FiltrosUI = useMemo(() => Object.fromEntries(FILTROS_CHAVES.filter((k) => params.get(k)).map((k) => [k, params.get(k)!])), [params])
  const aba = (params.get('aba') as Bloco) || 'recrutamento'
  const [detalhe, setDetalhe] = useState<{ chave: string; rotulo: string } | null>(null)
  const colaboradores = useStore((s) => s.colaboradores)

  const r = useApi<Resumo>(`analytics/resumo${qs(filtros as Record<string, string>)}`)
  const pessoas = useMemo(() => colaboradores.filter((c) => c.status !== 'encerrado').map((c) => ({ id: c.id, nome: c.nomeSocial || c.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [colaboradores])

  const mudarFiltros = (v: FiltrosUI) => {
    const p = new URLSearchParams()
    for (const k of FILTROS_CHAVES) if (v[k]) p.set(k, v[k]!)
    if (aba !== 'recrutamento') p.set('aba', aba)
    setParams(p, { replace: true })
  }
  const mudarAba = (k: string) => {
    const p = new URLSearchParams(params)
    if (k === 'recrutamento') p.delete('aba'); else p.set('aba', k)
    setParams(p, { replace: true })
  }

  const abrir = (i: Indicador) => i.detalhe && setDetalhe({ chave: i.detalhe, rotulo: i.rotulo })
  const csv = api.url(`analytics/exportar${qs({ ...filtros, bloco: aba })}`)

  return (
    <>
      <PageHeader title="People Analytics" subtitle="Recrutamento, pesquisas e estrutura da organização num só painel, com os mesmos filtros e definições explícitas."
        actions={r.dados?.blocos[aba]?.disponivel ? <a href={csv} download><Button variant="ghost" icon="Download" type="button">Exportar CSV ({ABAS.find((a) => a.key === aba)!.label.toLowerCase()})</Button></a> : undefined} />
      <SoComBanco>
        <BarraFiltros valor={filtros} onChange={mudarFiltros} opcoes={{ setores: r.dados?.opcoes.setores ?? [], unidades: r.dados?.opcoes.unidades ?? [], pessoas }} />
        <Tabs tabs={ABAS} active={aba} onChange={mudarAba} />
        <Aguardar r={r} linhas={4}>
          {(d) => {
            const b = d.blocos[aba]
            return (
              <div aria-live="polite">
                <p className="text-[12px] text-muted mb-4">Período analisado: <b className="text-ink-2">{d.periodo}</b>{aba !== 'estrutura' && <> · comparado com <b className="text-ink-2">{d.periodoAnterior}</b></>}</p>
                {!b.disponivel ? <Omitido motivo={b.motivo} /> : aba === 'recrutamento' ? <SecaoRecrutamento b={b} onDetalhe={abrir} /> : aba === 'pesquisas' ? <SecaoPesquisas b={b} onDetalhe={abrir} /> : <SecaoEstrutura b={b} onDetalhe={abrir} />}
                <Indisponiveis itens={d.indisponiveis} />
              </div>
            )
          }}
        </Aguardar>
      </SoComBanco>
      {detalhe && <Drilldown key={detalhe.chave} indicador={detalhe.chave} rotulo={detalhe.rotulo} filtros={filtros} onFechar={() => setDetalhe(null)} />}
    </>
  )
}
