/* Jornada de desenvolvimento de uma pessoa: evolução entre AVDs, comparativo por critério e linha do tempo. */
import { Link } from 'react-router-dom'
import { Badge, Card, CardHead } from '@/components/ui'
import { Aguardar } from '@/components/v2/estados'
import { BarrasEvolucao, LinhaDoTempo, StatusCiclo, type Acao, type ItemLinha } from './comuns'
import { useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'
import { STATUS_DSV, type Marco, type StatusExibido } from '@/domain/v2/desenvolvimento'

interface CicloJ { id: string; tipo: 'acompanhamento' | 'avd'; rotulo: string; dataPrevista: string; prazo: string; etapa: string; status: StatusExibido; atrasado: boolean; concluidoEm: string | null; devolutivaEm: string | null; avaliadorNome: string | null; notaAuto: number | null; notaLideranca: number | null }
export interface JornadaDados {
  pessoa: { id: string; nome: string; setor: string | null; cargo: string | null; lideranca: string | null; ehLideranca: boolean; admissao: string | null; status: string }
  ciclos: CicloJ[]
  proximos: Marco[]
  evolucao: { cicloId: string; rotulo: string; data: string; auto: number | null; lideranca: number | null; equipe: number | null }[]
  comparativo: { id: string; nome: string; atual: number | null; anterior: number | null }[]
  mudancas: { data: string; cargo: { de: string | null; para: string | null } | null; area: { de: string | null; para: string | null } | null; lideranca: { de: string | null; para: string | null } | null }[]
  acoes: (Acao & { ciclo_id: string })[]
}

const CORES = ['rgb(var(--c-brand-300))', 'rgb(var(--c-brand))', 'rgb(var(--c-success))']

export function Jornada({ pessoaId, compacto }: { pessoaId: string; compacto?: boolean }) {
  const r = useApi<JornadaDados>(`desenvolvimento/pessoas/${pessoaId}/jornada`)
  return <Aguardar r={r} linhas={3}>{(d) => <JornadaView d={d} compacto={compacto} />}</Aguardar>
}

function JornadaView({ d, compacto }: { d: JornadaDados; compacto?: boolean }) {
  const temEquipe = d.evolucao.some((e) => e.equipe !== null)
  const series = [
    { rotulo: 'Autoavaliação', valores: d.evolucao.map((e) => e.auto) },
    { rotulo: 'Liderança', valores: d.evolucao.map((e) => e.lideranca) },
    ...(temEquipe ? [{ rotulo: 'Equipe (média)', valores: d.evolucao.map((e) => e.equipe) }] : []),
  ]
  const itens: ItemLinha[] = [
    ...(d.pessoa.admissao ? [{ chave: 'adm', data: d.pessoa.admissao, titulo: 'Início da parceria', icone: 'Flag', tom: 'brand' as const }] : []),
    ...d.ciclos.map((c) => ({
      chave: c.id, data: c.dataPrevista, link: `/desenvolvimento/ciclos/${c.id}`, icone: c.tipo === 'avd' ? 'ClipboardCheck' : 'Sprout',
      tom: (c.etapa === 'concluida' ? 'success' : c.etapa === 'cancelada' ? 'neutral' : c.atrasado ? 'danger' : 'brand') as ItemLinha['tom'],
      titulo: c.rotulo,
      desc: <span className="inline-flex flex-wrap items-center gap-2"><StatusCiclo status={c.status} atrasado={c.atrasado} />{c.devolutivaEm && <span>Devolutiva em {dataBR(c.devolutivaEm)}</span>}</span>,
    })),
    ...d.mudancas.map((m, i) => ({
      chave: `mud${i}`, data: m.data, icone: 'ArrowLeftRight', tom: 'neutral' as const,
      titulo: [m.cargo && 'Mudança de função', m.area && 'Mudança de área', m.lideranca && 'Mudança de liderança'].filter(Boolean).join(' · '),
      desc: [m.cargo && `${m.cargo.de ?? '—'} → ${m.cargo.para ?? '—'}`, m.area && `${m.area.de ?? '—'} → ${m.area.para ?? '—'}`, m.lideranca && `${m.lideranca.de ?? 'sem liderança'} → ${m.lideranca.para ?? 'sem liderança'}`].filter(Boolean).join(' · '),
    })),
    ...d.acoes.filter((a) => a.status === 'concluida' && a.concluida_em).map((a) => ({ chave: `ac${a.id}`, data: a.concluida_em!, icone: 'CheckCircle2', tom: 'success' as const, titulo: 'Ação de desenvolvimento concluída', desc: a.descricao })),
  ].sort((a, b) => b.data.localeCompare(a.data))

  return (
    <div className="space-y-6">
      {!compacto && (
        <Card className="p-5">
          <div className="flex flex-wrap gap-x-8 gap-y-2 text-[13px]">
            <div><span className="text-muted">Início da parceria</span><div className="font-semibold">{d.pessoa.admissao ? dataBR(d.pessoa.admissao) : '—'}</div></div>
            <div><span className="text-muted">Função</span><div className="font-semibold">{d.pessoa.cargo ?? '—'}</div></div>
            <div><span className="text-muted">Área</span><div className="font-semibold">{d.pessoa.setor ?? '—'}</div></div>
            <div><span className="text-muted">Liderança direta</span><div className="font-semibold">{d.pessoa.lideranca ?? '—'}</div></div>
            {d.pessoa.ehLideranca && <div className="self-end"><Badge tone="gold">Exerce liderança</Badge></div>}
          </div>
        </Card>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <CardHead title="Evolução entre avaliações" sub="Médias de 1 a 5 (indicador de apoio). A avaliação da liderança aparece depois da devolutiva." />
          <div className="p-5"><BarrasEvolucao grupos={d.evolucao.map((e) => e.rotulo)} series={series} cores={CORES} /></div>
        </Card>
        <Card>
          <CardHead title="Por critério" sub="Avaliação da liderança: última × anterior" />
          {d.comparativo.length === 0 ? <p className="p-5 text-[13px] text-muted">Disponível a partir da primeira avaliação da liderança visível para você.</p> : (
            <ul className="divide-y divide-line">
              {d.comparativo.map((k) => {
                const dif = k.atual !== null && k.anterior !== null ? k.atual - k.anterior : null
                return (
                  <li key={k.id} className="px-5 py-2 flex items-center gap-3 text-[13px]">
                    <span className="flex-1 min-w-0 text-ink">{k.nome}</span>
                    <span className="text-muted tabular-nums w-8 text-right">{k.anterior ?? '—'}</span>
                    <span className="text-muted">→</span>
                    <span className="font-bold tabular-nums w-6">{k.atual ?? '—'}</span>
                    <span className={dif === null ? 'w-10' : dif > 0 ? 'w-10 text-success font-semibold' : dif < 0 ? 'w-10 text-danger font-semibold' : 'w-10 text-muted'}>{dif === null ? '' : dif > 0 ? `+${dif}` : dif}</span>
                  </li>
                )
              })}
            </ul>
          )}
        </Card>
      </div>
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHead title="Linha do tempo" sub="Acompanhamentos, AVDs, mudanças de função/liderança e ações concluídas." />
          <div className="p-5"><LinhaDoTempo itens={itens} /></div>
        </Card>
        <Card>
          <CardHead title="Próximos marcos" sub="Calculados a partir do início da parceria." />
          {d.proximos.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem marcos futuros (parceria sem data de início ou encerrada).</p> : (
            <ul className="divide-y divide-line">
              {d.proximos.map((m) => <li key={m.marco} className="px-5 py-2.5 flex items-center justify-between gap-3"><span className="text-[13px] font-medium text-ink">{m.rotulo}</span><Badge tone={STATUS_DSV.programada.tom}>{dataBR(m.data)}</Badge></li>)}
            </ul>
          )}
          <p className="px-5 pb-4 text-[11.5px] text-muted">Cada marco abre alguns dias antes da data, com aviso para quem participa. <Link to="/desenvolvimento" className="underline">Saiba mais</Link></p>
        </Card>
      </div>
    </div>
  )
}
