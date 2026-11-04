/* Retenção nos primeiros N dias: por área (todos os inícios de parceria) e por recrutador/vaga
   (contratações concluídas no ATS). Indicador de qualidade da contratação e da integração. */
import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { Card, CardHead, Select, Tabela, TH, TD, Badge, EmptyState } from '@/components/ui'
import { MODO_API } from '@/data/config'
import { qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { hojeISO } from '@/domain/datas'
import { retencaoPorArea } from '@/domain/vinculos'

interface LinhaGrupo { grupo: string; contratacoes: number; base: number; retidos: number; emObservacao: number; semCadastro: number; taxa: number | null }
interface Resposta { porRecrutador: LinhaGrupo[]; porVaga: LinhaGrupo[]; definicao: string }
const pct = (v: number | null) => (v == null ? '—' : `${v.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`)
const tom = (v: number | null) => (v == null ? 'neutral' : v >= 85 ? 'success' : v >= 70 ? 'brand' : 'warning')

export function RetencaoInicial({ de, ate }: { de: string; ate: string }) {
  const s = useStore()
  const hoje = hojeISO()
  const [dias, setDias] = useState('90')
  const [visao, setVisao] = useState<'area' | 'recrutador' | 'vaga'>('area')
  const temAnalytics = useTem('analytics:ver')
  const temPainel = useTem('rh:painel')
  const podeAts = temAnalytics || temPainel
  const r = useApi<Resposta>(MODO_API && podeAts && visao !== 'area' ? `rh/retencao-contratacoes${qs({ de, ate, dias })}` : null)
  const porArea = useMemo(() => retencaoPorArea(s.colaboradores, de, ate, hoje, Number(dias), s.historicoFuncao)
    .map((x) => ({ grupo: s.setorNome(x.setorId), contratacoes: x.base + x.emObservacao, base: x.base, retidos: x.retidos, emObservacao: x.emObservacao, semCadastro: 0, taxa: x.taxa }))
    .sort((a, b) => b.contratacoes - a.contratacoes), [s.colaboradores, s.historicoFuncao, de, ate, hoje, dias]) // eslint-disable-line react-hooks/exhaustive-deps
  const linhas: LinhaGrupo[] = visao === 'area' ? porArea : visao === 'recrutador' ? r.dados?.porRecrutador ?? [] : r.dados?.porVaga ?? []
  const total = linhas.reduce((a, x) => ({ base: a.base + x.base, retidos: a.retidos + x.retidos }), { base: 0, retidos: 0 })
  return (
    <Card className="mb-5">
      <CardHead title={`Retenção nos primeiros ${dias} dias`} sub={visao === 'area' ? 'Inícios de parceria no período, pela área na data de início.' : r.dados?.definicao ?? 'Contratações concluídas pelo recrutamento.'}
        action={<div className="flex flex-wrap gap-2">
          <Select label="Agrupar por" value={visao} onChange={(v) => setVisao(v as typeof visao)}><option value="area">Área</option>{MODO_API && <option value="recrutador">Recrutador</option>}{MODO_API && <option value="vaga">Vaga</option>}</Select>
          <Select label="Prazo" value={dias} onChange={setDias}>{['30', '60', '90', '180'].map((d) => <option key={d} value={d}>{d} dias</option>)}</Select>
        </div>} />
      {visao !== 'area' && r.carregando && !r.dados ? <div className="p-5 text-[13px] text-muted">Carregando…</div> : linhas.length === 0 ? <EmptyState icon="UserCheck" title="Sem contratações no período" /> : (
        <Tabela minWidth={640}>
          <thead><tr>{[visao === 'area' ? 'Área' : visao === 'recrutador' ? 'Recrutador' : 'Vaga', 'Contratações', 'Já completaram o prazo', 'Seguiam ativas', 'Em observação', 'Retenção'].map((h) => <th key={h} className={TH}>{h}</th>)}</tr></thead>
          <tbody>
            {linhas.map((x) => (
              <tr key={x.grupo}>
                <td className={TD}><b className="text-ink">{x.grupo}</b>{x.semCadastro > 0 && <div className="text-[11px] text-muted">{x.semCadastro} sem cadastro correspondente</div>}</td>
                <td className={TD}>{x.contratacoes}</td><td className={TD}>{x.base}</td><td className={TD}>{x.retidos}</td><td className={TD}>{x.emObservacao}</td>
                <td className={TD}><Badge tone={tom(x.taxa)}>{pct(x.taxa)}</Badge></td>
              </tr>
            ))}
            <tr><td className={TD}><b>Total</b></td><td className={TD} colSpan={4}>{total.base} com prazo completo</td><td className={TD}><b>{pct(total.base ? Math.round((total.retidos / total.base) * 1000) / 10 : null)}</b></td></tr>
          </tbody>
        </Tabela>
      )}
    </Card>
  )
}
