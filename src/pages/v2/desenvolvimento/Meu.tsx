/* Meu desenvolvimento: o que preencher (e até quando), próximos marcos, PDI e histórico. Também a jornada de outra pessoa (/desenvolvimento/pessoas/:id). */
import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Icon, PageHeader, Tabs } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { ListaAcoes, StatusCiclo, type Acao } from '@/components/v2/desenvolvimento/comuns'
import { Jornada } from '@/components/v2/desenvolvimento/Jornada'
import { useApi } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'
import { useStore } from '@/lib/store'
import type { Marco, StatusExibido, TipoFormulario } from '@/domain/v2/desenvolvimento'

export interface LinhaCiclo { id: string; colaboradorId: string; colaboradorNome: string; avaliadorNome: string | null; tipo: 'acompanhamento' | 'avd'; marco: string; rotulo: string; dataPrevista: string; prazo: string; etapa: string; status: StatusExibido; atrasado: boolean; lideranca: boolean; setorNome: string | null; cargoNome: string | null }
interface Meu {
  hoje: string; admissao: string | null; ehLideranca: boolean; tamanhoEquipe: number; lideranca: string | null
  pendentes: { id: string; tipo: TipoFormulario; rotulo: string; status: string; prazo: string; atrasado: boolean; marco: string; sobre: string; confidencial: boolean }[]
  ciclos: LinhaCiclo[]; tarefas: LinhaCiclo[]; acoes: Acao[]; proximos: Marco[]; minimoEquipe: number
}

/** Cartões de formulários a responder (usados no Início e em Meu desenvolvimento). */
export function CartoesPendentes({ itens }: { itens: Meu['pendentes'] }) {
  const nav = useNavigate()
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
      {itens.map((p) => (
        <Card key={p.id} className="p-5 flex flex-col">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            {p.atrasado ? <Badge tone="danger" dot>Prazo vencido</Badge> : <Badge tone="brand" dot>{p.status === 'rascunho' ? 'Rascunho salvo' : 'Para você responder'}</Badge>}
            {p.confidencial && <Badge tone="gold">Confidencial</Badge>}
          </div>
          <h3 className="text-[15px] font-bold text-ink">{p.rotulo}</h3>
          <p className="text-[12.5px] text-muted mt-0.5">{p.marco} · {p.confidencial ? 'sobre sua liderança direta' : p.sobre === 'Você' ? 'sobre você' : `sobre ${p.sobre}`}</p>
          <div className="mt-auto pt-4 flex items-center justify-between gap-3">
            <span className="text-[12.5px] text-ink-2">até <b>{dataBR(p.prazo)}</b></span>
            <Button size="sm" icon="PenLine" onClick={() => nav(`/desenvolvimento/responder/${p.id}`)}>{p.status === 'rascunho' ? 'Continuar' : 'Responder'}</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

export default function MeuDesenvolvimento() {
  const eu = useStore((s) => s.currentUser().id)
  const [tab, setTab] = useState('agora')
  const r = useApi<Meu>('desenvolvimento/meu')
  return (
    <>
      <PageHeader title="Meu desenvolvimento" subtitle="Acompanhamentos, avaliações de desempenho e seu plano de desenvolvimento." />
      <SoComBanco>
        <Aguardar r={r} linhas={4}>
          {(d) => (
            <>
              <Tabs tabs={[{ key: 'agora', label: 'Agora' }, { key: 'jornada', label: 'Minha jornada' }]} active={tab} onChange={setTab} />
              {tab === 'agora' ? <Agora d={d} recarregar={r.recarregar} /> : <Jornada pessoaId={eu} />}
            </>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}

function Agora({ d, recarregar }: { d: Meu; recarregar: () => void }) {
  const nav = useNavigate()
  const aberto = d.ciclos.find((c) => !['concluida', 'cancelada'].includes(c.etapa))
  return (
    <div className="space-y-8">
      <Callout tone="brand" icon="Sprout">
        Aqui você acompanha seu desenvolvimento na 4JURIS: conversas nos primeiros <b>30, 60 e 90 dias</b> e, a partir dos <b>6 meses</b>, uma avaliação de desempenho a cada semestre — com sua autoavaliação, a visão da liderança, uma conversa de devolutiva e um plano de desenvolvimento. É um espaço de diálogo, não um processo disciplinar.
      </Callout>

      <section aria-label="Para você preencher">
        <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Para você preencher</h2>
        {d.pendentes.length ? <CartoesPendentes itens={d.pendentes} /> : <Card><EmptyState icon="CheckCircle2" title="Nada pendente agora" desc={d.proximos[0] ? `Seu próximo marco: ${d.proximos[0].rotulo.toLowerCase()} em ${dataBR(d.proximos[0].data)}. Você recebe um aviso quando abrir.` : 'Quando houver um formulário para você, ele aparece aqui e nas notificações.'} /></Card>}
      </section>

      {(d.ehLideranca || d.tarefas.length > 0) && (
        <section aria-label="Como liderança">
          <h2 className="text-[13px] font-bold uppercase tracking-wide text-muted mb-3">Como liderança</h2>
          <Card className="p-5 flex items-center gap-4 flex-wrap">
            <div className="h-10 w-10 rounded-xl bg-brand-100 text-brand flex items-center justify-center"><Icon name="UsersRound" className="h-5 w-5" /></div>
            <div className="flex-1 min-w-[200px]">
              <div className="text-[14px] font-bold text-ink">Desenvolvimento da sua equipe</div>
              <div className="text-[12.5px] text-muted">{d.tarefas.length ? `${d.tarefas.length} devolutiva(s)/PDI aguardando você.` : `${d.tamanhoEquipe} pessoa(s) na sua equipe direta.`} Lá você também vê o feedback consolidado sobre a sua liderança.</div>
            </div>
            <Button icon="ArrowRight" onClick={() => nav('/lideranca/desenvolvimento')}>Abrir</Button>
          </Card>
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <CardHead title="Meu PDI e ações de desenvolvimento" sub="Atualize o andamento das ações que são suas." />
          <div className="px-5 pb-2">
            <ListaAcoes acoes={d.acoes} hoje={d.hoje} onAtualizado={recarregar} podeAtualizar={(a) => a.responsavel === 'colaborador' || a.responsavel === 'ambos'}
              vazio="Sem ações em andamento. Elas aparecem depois dos acompanhamentos e das devolutivas." />
          </div>
        </Card>
        <Card>
          <CardHead title="Próximos marcos" sub={d.admissao ? `Início da parceria em ${dataBR(d.admissao)}` : undefined} />
          {aberto && (
            <Link to={`/desenvolvimento/ciclos/${aberto.id}`} className="block px-5 py-3 border-b border-line hover:bg-surface-2">
              <div className="text-[13px] font-semibold text-ink">{aberto.rotulo} <span className="text-muted font-normal">· em andamento</span></div>
              <div className="mt-1"><StatusCiclo status={aberto.status} atrasado={aberto.atrasado} /></div>
            </Link>
          )}
          <ul className="divide-y divide-line">
            {d.proximos.map((m) => <li key={m.marco} className="px-5 py-2.5 flex items-center justify-between gap-3"><span className="text-[13px] text-ink">{m.rotulo}</span><span className="text-[12.5px] text-muted">{dataBR(m.data)}</span></li>)}
            {!d.proximos.length && !aberto && <li className="px-5 py-3 text-[13px] text-muted">Sem data de início da parceria cadastrada. Fale com o RH.</li>}
          </ul>
        </Card>
      </div>

      <Card>
        <CardHead title="Histórico" sub="Acompanhamentos e avaliações com resultados e devolutivas." />
        {d.ciclos.length === 0 ? <p className="p-5 text-[13px] text-muted">Seu primeiro acompanhamento aparece aqui quando abrir.</p> : (
          <ul className="divide-y divide-line">
            {d.ciclos.map((c) => (
              <li key={c.id}>
                <Link to={`/desenvolvimento/ciclos/${c.id}`} className="px-5 py-3 flex items-center gap-3 flex-wrap hover:bg-surface-2">
                  <Icon name={c.tipo === 'avd' ? 'ClipboardCheck' : 'Sprout'} className="h-4 w-4 text-muted" />
                  <span className="flex-1 min-w-[160px]"><span className="text-[13.5px] font-semibold text-ink">{c.rotulo}</span><span className="block text-[12px] text-muted">{dataBR(c.dataPrevista)}{c.avaliadorNome && ` · com ${c.avaliadorNome}`}</span></span>
                  <StatusCiclo status={c.status} atrasado={c.atrasado} />
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  )
}

/** /desenvolvimento/pessoas/:id — jornada de uma pessoa (RH, a própria pessoa ou a liderança; o servidor decide). */
export function JornadaPessoa() {
  const { id = '' } = useParams()
  const nav = useNavigate()
  const nome = useStore((s) => s.colaboradores.find((p) => p.id === id)?.nome)
  return (
    <>
      <PageHeader title={nome ? `Jornada de ${nome}` : 'Jornada de desenvolvimento'} subtitle="Evolução, avaliações, devolutivas, PDI e mudanças relevantes."
        actions={<Button variant="ghost" icon="ArrowLeft" onClick={() => nav(-1)}>Voltar</Button>} />
      <SoComBanco><Jornada pessoaId={id} /></SoComBanco>
    </>
  )
}
