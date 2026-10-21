import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Badge, Progress, Icon, EmptyState, Callout } from '@/components/ui'
import { feedback } from '@/components/toast'
import { cn, fmtDate } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { progresso, prazoItem, RESPONSAVEL_LABEL } from '@/domain/jornada'

export default function Onboarding() {
  const s = useStore()
  const me = s.currentUser()
  const hoje = hojeISO()
  const processos = s.processos.filter((p) => p.colaboradorId === me.id && p.tipo === 'integracao').sort((a, b) => b.iniciadoEm.localeCompare(a.iniciadoEm))
  const atual = processos[0]
  const recomendados = s.treinamentos.filter((t) => t.recomendado)
  const concluidos = new Set(s.progressoConteudos.filter((p) => p.colaboradorId === me.id).map((p) => p.treinamentoId))

  return (
    <>
      <PageHeader title="Minha integração" subtitle="Os primeiros passos na comunidade 4JURIS, com quem faz o quê e quando." />
      {!atual ? (
        <Card className="mb-6"><EmptyState icon="Rocket" title="Nenhum processo de integração" desc="Quando o RH iniciar sua integração, os passos aparecem aqui. Enquanto isso, explore os conteúdos recomendados abaixo." /></Card>
      ) : (
        renderAtual(atual.id)
      )}

      <Card>
        <CardHead title="Conteúdos recomendados para começar" action={<Link to="/conteudos" className="text-[13px] font-semibold text-brand hover:underline">Ver todos</Link>} />
        <ul className="divide-y divide-line">
          {recomendados.map((t) => (
            <li key={t.id} className="flex items-center gap-3 p-4">
              <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', concluidos.has(t.id) ? 'bg-success-soft text-success' : 'bg-brand-50 text-brand')}><Icon name={concluidos.has(t.id) ? 'CheckCircle2' : 'GraduationCap'} className="h-5 w-5" /></span>
              <div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold text-ink">{t.titulo}</div><div className="text-[12px] text-muted">{t.duracaoMin} min · {t.modulos} módulos</div></div>
              {concluidos.has(t.id) ? <Badge tone="success">Concluído</Badge> : <Link to="/conteudos" className="text-[12.5px] font-semibold text-brand">Acessar</Link>}
            </li>
          ))}
        </ul>
      </Card>
    </>
  )

  // Função de renderização (não é componente: evita remontagem a cada render).
  function renderAtual(id: string) {
    const p = s.processos.find((x) => x.id === id)!
    const pr = progresso(p)
    const grupos = (['pessoa', 'lideranca', 'rh'] as const).map((r) => ({ r, itens: p.itens.filter((i) => i.responsavel === r) })).filter((g) => g.itens.length)
    return (
      <Card className="mb-6">
        <div className="p-5 sm:p-6 border-b border-line">
          <div className="flex items-center justify-between gap-3 flex-wrap">
            <div>
              <div className="flex items-center gap-2">{p.concluidoEm ? <Badge tone="success" dot>Concluída em {fmtDate(p.concluidoEm)}</Badge> : <Badge tone="brand" dot>Em andamento desde {fmtDate(p.iniciadoEm)}</Badge>}</div>
              <h2 className="text-[17px] font-bold text-ink mt-2">{s.checklists.find((c) => c.id === p.modeloId)?.nome ?? 'Integração'}</h2>
            </div>
            <div className="text-right"><div className="text-[26px] font-extrabold text-ink leading-none">{pr.percentual}%</div><div className="text-[12px] text-muted">{pr.feitos} de {pr.total} passos</div></div>
          </div>
          <Progress value={pr.percentual} className="mt-4" />
        </div>
        {grupos.map((g) => (
          <div key={g.r} className="border-b border-line last:border-0">
            <h3 className="px-5 sm:px-6 pt-4 text-[12px] font-bold uppercase tracking-wide text-muted">{g.r === 'pessoa' ? 'Com você' : `Com ${RESPONSAVEL_LABEL[g.r]}`}</h3>
            <ul className="p-2 sm:p-3">
              {g.itens.map((i) => {
                const prazo = prazoItem(p, i.prazoDias)
                const atrasado = !i.feito && prazo && prazo < hoje
                const meu = g.r === 'pessoa'
                return (
                  <li key={i.id}>
                    <label className={cn('flex items-start gap-3 p-3 rounded-xl', meu ? 'cursor-pointer hover:bg-surface-2' : 'cursor-default')}>
                      <input type="checkbox" className="h-[18px] w-[18px] mt-0.5 accent-brand" checked={i.feito} disabled={!meu}
                        onChange={(e) => feedback(s.marcarItemJornada(p.id, i.id, e.target.checked), e.target.checked ? 'Passo concluído!' : 'Passo reaberto.')} />
                      <span className="flex-1 min-w-0">
                        <span className={cn('block text-[13.5px] font-medium', i.feito ? 'text-muted line-through' : 'text-ink')}>{i.titulo}</span>
                        <span className="block text-[11.5px] text-muted mt-0.5">
                          {i.feito ? `Concluído em ${fmtDate(i.feitoEm)}` : prazo ? `Sugestão: até ${fmtDate(prazo)}` : 'Sem prazo sugerido'}
                          {!meu && !i.feito && ' · aguardando'}
                        </span>
                      </span>
                      {atrasado && <Badge tone="warning">Prazo sugerido passou</Badge>}
                    </label>
                  </li>
                )
              })}
            </ul>
          </div>
        ))}
        {!p.concluidoEm && <div className="p-4"><Callout tone="neutral" icon="Info">Os prazos são sugestões para organizar a chegada, não obrigações. Dúvidas? Use o Assistente ou fale com o RH.</Callout></div>}
      </Card>
    )
  }
}
