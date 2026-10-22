/* Relatórios de pessoas: Métricas, Rotatividade e Encerramentos numa só tela (abas), em vez de três itens de menu. */
import { lazy, Suspense } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Tabs } from '@/components/ui'
import { CarregandoBloco } from '@/components/v2/estados'

const Metricas = lazy(() => import('./Metricas'))
const Rotatividade = lazy(() => import('./Rotatividade'))
const Encerramentos = lazy(() => import('./Encerramentos'))

const ABAS = [
  { key: 'perfil', label: 'Perfil da comunidade', C: Metricas },
  { key: 'rotatividade', label: 'Rotatividade', C: Rotatividade },
  { key: 'encerramentos', label: 'Encerramentos', C: Encerramentos },
]

export default function Relatorios() {
  const [sp, setSp] = useSearchParams()
  const aba = ABAS.find((a) => a.key === sp.get('aba')) ?? ABAS[0]
  return (
    <>
      <Tabs tabs={ABAS.map(({ key, label }) => ({ key, label }))} active={aba.key} onChange={(k) => setSp(k === ABAS[0].key ? {} : { aba: k }, { replace: true })} />
      <Suspense fallback={<CarregandoBloco linhas={6} />}><aba.C /></Suspense>
    </>
  )
}
