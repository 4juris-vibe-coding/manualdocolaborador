/* Aviso no Início: formulários do ciclo de desenvolvimento a responder e conversas a conduzir. Só com o banco conectado. */
import { Link } from 'react-router-dom'
import { Icon } from '@/components/ui'
import { MODO_API } from '@/data/config'
import { useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'

export function AvisoDesenvolvimento() {
  const r = useApi<{ formularios: number; atrasados: number; proximoPrazo: string | null; conversas: number }>(MODO_API ? 'desenvolvimento/pendencias' : null)
  const d = r.dados
  if (!d || (!d.formularios && !d.conversas)) return null
  const partes = [
    d.formularios ? `${d.formularios} formulário(s) para responder${d.proximoPrazo ? ` (próximo prazo ${dataBR(d.proximoPrazo)})` : ''}` : '',
    d.conversas ? `${d.conversas} devolutiva(s)/PDI para conduzir` : '',
  ].filter(Boolean)
  return (
    <Link to={d.formularios ? '/desenvolvimento' : '/lideranca/desenvolvimento'} className="card p-4 mb-6 flex items-center gap-3 hover:shadow-sm transition">
      <span className="h-10 w-10 shrink-0 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><Icon name="Sprout" className="h-5 w-5" /></span>
      <div className="flex-1 min-w-0 text-[13.5px] text-ink">
        <b>Seu desenvolvimento:</b> {partes.join(' · ')}.{d.atrasados > 0 && <span className="text-danger font-semibold"> {d.atrasados} com prazo vencido.</span>}
      </div>
      <span className="text-[12.5px] font-semibold text-brand shrink-0">Abrir →</span>
    </Link>
  )
}
