/* Aba Qualidade: pendências de cadastro da estrutura, com atalho para corrigir. */
import { Link } from 'react-router-dom'
import { useApi } from '@/data/v2/api'
import { Aguardar } from '@/components/v2/estados'
import { Badge, Button, Callout, Card, CardHead, EmptyState } from '@/components/ui'
import type { AnaliseOrg } from './tipos'

const GRUPOS: { titulo: string; tipos: string[]; tom: string }[] = [
  { titulo: 'Referências inválidas', tipos: ['gestor_inexistente', 'gestor_inativo', 'auto_gestor', 'ciclo'], tom: 'danger' },
  { titulo: 'Sem gestor definido', tipos: ['sem_gestor'], tom: 'warning' },
  { titulo: 'Áreas', tipos: ['setor_sem_gestor', 'setor_inexistente', 'sem_setor'], tom: 'warning' },
  { titulo: 'Funções', tipos: ['sem_cargo'], tom: 'neutral' },
]

export function QualidadeCadastros({ podeEditar, onCorrigir }: { podeEditar: boolean; onCorrigir: (pessoaId: string) => void }) {
  const r = useApi<AnaliseOrg>('organograma/analise')
  return (
    <Aguardar r={r}>
      {(d) => {
        if (!d.pendencias.length) return <Card><EmptyState icon="CheckCircle2" title="Nenhuma pendência de cadastro" desc="Todos os vínculos hierárquicos, áreas e funções estão preenchidos e consistentes." /></Card>
        return (
          <div className="space-y-5">
            <Callout tone="neutral" icon="Info">São <b>pendências de cadastro</b>, não erros de estrutura. Elas só indicam informação ausente ou inconsistente nos cadastros.</Callout>
            {GRUPOS.map((g) => {
              const itens = d.pendencias.filter((p) => g.tipos.includes(p.tipo))
              if (!itens.length) return null
              return (
                <Card key={g.titulo}>
                  <CardHead title={g.titulo} sub={`${itens.length} pendência${itens.length > 1 ? 's' : ''}`} />
                  <ul className="divide-y divide-line">
                    {itens.map((p, n) => (
                      <li key={p.tipo + (p.pessoaId ?? p.setorId ?? '') + n} className="px-5 py-3 flex items-center gap-3 flex-wrap">
                        <div className="min-w-0 flex-1">
                          <div className="text-[13.5px] font-semibold text-ink">{p.pessoa ?? p.setor ?? '—'}</div>
                          <div className="text-[12.5px] text-muted">{p.rotulo}{p.ciclo ? `: ${p.ciclo.join(' → ')} → …` : ''}{p.detalhe ? ` · ${p.detalhe}` : ''}</div>
                        </div>
                        <Badge tone={g.tom}>{p.rotulo}</Badge>
                        {p.pessoaId && podeEditar && ['sem_gestor', 'gestor_inexistente', 'gestor_inativo', 'auto_gestor', 'ciclo'].includes(p.tipo) &&
                          <Button size="sm" variant="ghost" icon="Pencil" onClick={() => onCorrigir(p.pessoaId!)}>Corrigir gestor</Button>}
                        {p.pessoaId && podeEditar && ['sem_setor', 'sem_cargo', 'setor_inexistente'].includes(p.tipo) &&
                          <Link to={`/rh/pessoas/${p.pessoaId}`} className="text-[13px] font-semibold text-brand hover:underline">Abrir cadastro</Link>}
                        {!p.pessoaId && p.setorId && podeEditar && <Link to="/rh/estrutura" className="text-[13px] font-semibold text-brand hover:underline">Definir gestor da área</Link>}
                      </li>
                    ))}
                  </ul>
                </Card>
              )
            })}
          </div>
        )
      }}
    </Aguardar>
  )
}
