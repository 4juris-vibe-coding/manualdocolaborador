import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { Card, CardHead, Badge, Avatar, Progress, Icon, EmptyState } from '@/components/ui'
import { brl, fmtDate, fmtDateTime, firstName, cn } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { nivelDe, progressoDesafio } from '@/domain/gamificacao'
import { celebracoesDoDia } from '@/domain/aniversarios'
import { comunicadoVisivel, eventoVisivel } from '@/domain/visibilidade'
import { pesquisaAbertaPara } from '@/domain/pesquisas'
import { podeVerReembolsosView } from '@/lib/utils'

/** Saudação pela hora local: madrugada (0h–5h), dia (5h–12h), tarde (12h–18h) e noite. */
function saudacao(h = new Date().getHours()): string {
  if (h < 5) return 'Boa madrugada'
  if (h < 12) return 'Bom dia'
  if (h < 18) return 'Boa tarde'
  return 'Boa noite'
}

export default function Dashboard() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const pontos = s.pontosDe(user.id)
  const nivel = nivelDe(pontos, s.config.gamificacao.niveis)
  const mesAtual = hoje.slice(0, 7)

  /* ---------- Pendências reais do usuário ---------- */
  const minhaNota = s.notas.find((n) => n.colaboradorId === user.id && n.competencia === mesAtual)
  const minhaJornada = s.processos.find((p) => p.colaboradorId === user.id && p.tipo === 'integracao' && !p.concluidoEm)
  const meusItensJornada = minhaJornada?.itens.filter((i) => !i.feito && i.responsavel === 'pessoa').length ?? 0
  const pesquisasPendentes = s.pesquisas.filter((p) => pesquisaAbertaPara(p, user.setorId, hoje) && !s.participacoes.some((x) => x.pesquisaId === p.id && x.colaboradorId === user.id))
  const docsVencendo = s.documentos.filter((d) => d.colaboradorId === user.id && d.validade && d.validade <= somarDias(hoje, 30))
  const importantes = s.comunicados.filter((m) => m.importante && comunicadoVisivel(m, user) && !m.lidoPor.includes(user.id))
  const reembPend = s.reembolsos.filter((r) => r.colaboradorId === user.id && r.status === 'pendente')
  const avaliacoesPendentes = s.participantesCiclo.filter((p) => p.avaliadorId === user.id && !s.respostasAvaliacao.some((r) => r.participanteId === p.id) && s.ciclos.some((c) => c.id === p.cicloId && c.status === 'ativo' && hoje >= c.abertura && hoje <= c.encerramento)).length
    + s.avaliacoesInicio.filter((a) => a.avaliadorId === user.id && a.status === 'pendente' && a.expiraEm >= hoje).length

  const pendencias = [
    minhaNota?.status === 'aguardando' && { icon: 'FileText', txt: `Enviar a nota fiscal do mês (${brl(minhaNota.valor)}) até ${fmtDate(minhaNota.prazo, { day: '2-digit', month: 'short' })}`, to: '/notas', tone: 'warning' },
    meusItensJornada > 0 && { icon: 'Rocket', txt: `${meusItensJornada} passo(s) da sua integração para concluir`, to: '/onboarding', tone: 'brand' },
    ...importantes.map((m) => ({ icon: 'Megaphone', txt: `Comunicado importante: ${m.titulo}`, to: '/comunicados', tone: 'brand' })),
    ...docsVencendo.map((d) => ({ icon: 'FileWarning', txt: `${d.nome}: ${d.validade! < hoje ? 'vencido' : 'vence'} em ${fmtDate(d.validade)} — envie uma versão atualizada`, to: '/perfil', tone: 'warning' })),
    ...pesquisasPendentes.map((p) => ({ icon: 'MessagesSquare', txt: `Pesquisa voluntária aberta: ${p.titulo}`, to: '/pesquisas', tone: 'neutral' })),
    avaliacoesPendentes > 0 && { icon: 'ClipboardCheck', txt: `${avaliacoesPendentes} avaliação(ões) para responder`, to: '/avaliacoes', tone: 'brand' },
  ].filter(Boolean) as { icon: string; txt: string; to: string; tone: 'warning' | 'brand' | 'neutral' }[]

  const comunicados = [...s.comunicados].filter((m) => comunicadoVisivel(m, user))
    .sort((a, b) => (b.fixado ? 1 : 0) - (a.fixado ? 1 : 0) || b.data.localeCompare(a.data)).slice(0, 3)
  const proximos = s.eventos.filter((e) => e.status === 'agendado' && e.inicio.slice(0, 10) >= hoje && eventoVisivel(e, user))
    .sort((a, b) => a.inicio.localeCompare(b.inicio)).slice(0, 3)
  const celebracoes = celebracoesDoDia(s.colaboradores, hoje)
  const limite = somarDias(hoje, 14)
  const foraDaArea = s.periodos.filter((p) => p.status !== 'cancelado' && p.colaboradorId !== user.id && p.inicio <= limite && p.fim >= hoje && s.pessoa(p.colaboradorId)?.setorId === user.setorId)
  const meusDesafios = s.desafios.map((d) => ({ d, p: progressoDesafio(d, s.lancamentos, user.id, hoje) })).filter(({ p }) => p.participando && p.status === 'ativo')

  const atalhos = [
    { icon: 'Palmtree', label: 'Registrar indisponibilidade', to: '/disponibilidade' },
    { icon: 'FileText', label: 'Enviar NF', to: '/notas' },
    podeVerReembolsosView(user, s.setores, s.previewColaborador) && { icon: 'ReceiptText', label: 'Pedir reembolso', to: '/reembolsos' },
    { icon: 'Heart', label: 'Reconhecer alguém', to: '/gamificacao' },
    { icon: 'CalendarHeart', label: 'Agenda', to: '/eventos' },
    { icon: 'Bot', label: 'Tirar dúvida', to: '/assistente' },
  ].filter(Boolean) as { icon: string; label: string; to: string }[]

  return (
    <>
      <div className="rounded-3xl bg-midnight text-white p-5 sm:p-7 mb-6 relative overflow-hidden tech-grid dark:border dark:border-line-strong">
        <div className="relative flex items-center justify-between gap-6 flex-wrap">
          <div className="min-w-0">
            <div className="text-[13px] text-[#9aa7b1] font-medium capitalize">{new Date().toLocaleDateString('pt-BR', { weekday: 'long', day: '2-digit', month: 'long' })}</div>
            <h1 className="text-[24px] sm:text-[26px] font-extrabold tracking-tight mt-1">{saudacao()}, {firstName(user.nomeSocial || user.nome)} 👋</h1>
            <p className="text-[#b5c0c9] text-[14px] mt-1.5 max-w-md">
              {pendencias.length ? `Você tem ${pendencias.length} item(ns) que pedem atenção.` : 'Tudo em dia por aqui.'}
              {proximos.length > 0 && ` Próximo evento: ${proximos[0].titulo}.`}
            </p>
          </div>
          <Link to="/experiencia" className="bg-white/[.07] hover:bg-white/[.12] transition border border-white/10 rounded-2xl p-4 min-w-[210px] w-full sm:w-auto">
            <div className="flex items-center justify-between mb-2">
              <span className="text-[12px] text-[#b5c0c9] font-medium">Nível {nivel.nivel} · {nivel.nome}</span>
            </div>
            <div className="flex items-baseline gap-1.5">
              <span className="text-[24px] font-extrabold tabular-nums">{pontos.toLocaleString('pt-BR')}</span>
              <span className="text-[12px] text-[#9aa7b1]">pontos</span>
            </div>
            <Progress value={nivel.progresso} className="mt-2.5 bg-white/10" color="#4d6bec" />
            <div className="text-[11px] text-[#9aa7b1] mt-1.5">{nivel.proximoNome ? `${nivel.faltam} pts para ${nivel.proximoNome}` : 'Nível máximo alcançado'}</div>
          </Link>
        </div>
      </div>

      {celebracoes.length > 0 && (
        <Link to="/aniversarios" className="card p-4 mb-6 flex items-center gap-3 hover:shadow-sm transition bg-gradient-to-r from-gold-soft to-surface">
          <span className="text-[24px]" aria-hidden>🎉</span>
          <div className="flex-1 min-w-0 text-[13.5px] text-ink">
            <b>Hoje é dia de celebrar:</b>{' '}
            {celebracoes.map((c) => `${firstName(c.pessoa.nome)} (${c.tipo === 'aniversario' ? 'aniversário' : `${c.anos} ano(s) de parceria`})`).join(', ')}
          </div>
          <span className="text-[12.5px] font-semibold text-brand shrink-0">Enviar mensagem →</span>
        </Link>
      )}

      <nav aria-label="Atalhos" className="grid grid-cols-3 sm:grid-cols-[repeat(auto-fit,minmax(112px,1fr))] gap-3 mb-6">
        {atalhos.map((a) => (
          <Link key={a.to} to={a.to} className="card p-3 sm:p-4 flex flex-col items-center gap-2.5 text-center hover:shadow-sm hover:-translate-y-0.5 transition group">
            <span className="h-10 w-10 sm:h-11 sm:w-11 rounded-xl bg-brand-50 text-brand flex items-center justify-center group-hover:bg-brand group-hover:text-white transition">
              <Icon name={a.icon} className="h-5 w-5" />
            </span>
            <span className="text-[11.5px] font-semibold text-ink-2 leading-tight">{a.label}</span>
          </Link>
        ))}
      </nav>

      <div className="grid grid-cols-1 lg:grid-cols-[1.5fr_1fr] gap-6">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="O que pede sua atenção" sub="Gerado a partir das suas notas, integração, documentos e comunicados" action={<Badge tone={pendencias.length ? 'warning' : 'success'} dot>{pendencias.length ? `${pendencias.length} item(ns)` : 'Tudo em dia'}</Badge>} />
            <div className="p-3">
              {pendencias.length === 0 && <p className="text-[13.5px] text-muted px-3 py-4">Nenhuma pendência no momento. 🎉</p>}
              {pendencias.map((p, i) => (
                <Link key={i} to={p.to} className="flex items-center gap-3 p-3 rounded-xl hover:bg-surface-2 transition">
                  <span className={cn('h-10 w-10 rounded-xl flex items-center justify-center shrink-0', p.tone === 'warning' ? 'bg-warning-soft text-warning' : p.tone === 'brand' ? 'bg-brand-50 text-brand' : 'bg-winter text-ink-2')}>
                    <Icon name={p.icon} className="h-[19px] w-[19px]" />
                  </span>
                  <span className="text-[13.5px] font-medium text-ink flex-1">{p.txt}</span>
                  <Icon name="ChevronRight" className="h-4 w-4 text-muted-2" />
                </Link>
              ))}
              {reembPend.length > 0 && (
                <p className="text-[12px] text-muted px-3 pt-2">Para acompanhar: {reembPend.length} reembolso(s) aguardando análise.</p>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title="Comunicados recentes" action={<Link to="/comunicados" className="text-[13px] font-semibold text-brand hover:underline">Ver todos</Link>} />
            {comunicados.length === 0 ? <EmptyState icon="Megaphone" title="Nenhum comunicado" desc="Quando houver novidades para você, elas aparecem aqui." /> : (
              <div className="divide-y divide-line">
                {comunicados.map((m) => (
                  <Link key={m.id} to="/comunicados" className="flex gap-3.5 p-4 hover:bg-surface-2 transition">
                    <span className="h-10 w-10 rounded-xl bg-winter text-ink flex items-center justify-center shrink-0"><Icon name="Megaphone" className="h-[18px] w-[18px]" /></span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        {m.importante && <Badge tone="danger">Importante</Badge>}
                        {m.fixado && <Badge tone="brand">Fixado</Badge>}
                        <Badge tone="neutral">{m.categoria}</Badge>
                        {!m.lidoPor.includes(user.id) && <span className="text-[11px] font-semibold text-brand">● não lido</span>}
                      </div>
                      <div className="text-[14px] font-semibold text-ink mt-1.5">{m.titulo}</div>
                      <div className="text-[12.5px] text-muted line-clamp-1 mt-0.5">{m.resumo}</div>
                    </div>
                  </Link>
                ))}
              </div>
            )}
          </Card>
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="Próximos eventos" action={<Link to="/eventos" className="text-[13px] font-semibold text-brand hover:underline">Agenda</Link>} />
            <div className="p-4 space-y-1">
              {proximos.length === 0 && <p className="text-[13px] text-muted p-2">Nenhum evento agendado para você.</p>}
              {proximos.map((e) => {
                const d = new Date(e.inicio)
                const vou = e.confirmados.includes(user.id)
                return (
                  <Link key={e.id} to="/eventos" className="flex gap-3 p-2.5 rounded-xl hover:bg-surface-2 transition">
                    <div className="h-11 w-11 rounded-xl bg-brand-50 text-brand flex flex-col items-center justify-center shrink-0 leading-none">
                      <span className="text-[15px] font-extrabold">{d.getDate()}</span>
                      <span className="text-[9px] font-bold uppercase">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{e.titulo}</div>
                      <div className="text-[12px] text-muted">{fmtDateTime(e.inicio)}</div>
                    </div>
                    {vou && <Badge tone="success">Vou</Badge>}
                  </Link>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead title="Disponibilidade da sua área" sub="Próximos 14 dias" action={<Link to="/disponibilidade" className="text-[13px] font-semibold text-brand hover:underline">Ver agenda</Link>} />
            <div className="p-4 space-y-2">
              {foraDaArea.length === 0 && <p className="text-[13px] text-muted">Ninguém da sua área registrou indisponibilidade nesse período.</p>}
              {foraDaArea.map((p) => {
                const c = s.pessoa(p.colaboradorId)!
                return (
                  <div key={p.id} className="flex items-center gap-3">
                    <Avatar pessoaId={c.id} nome={c.nome} cor={c.avatarCor} size="sm" />
                    <div className="flex-1 min-w-0">
                      <div className="text-[13px] font-semibold text-ink truncate">{c.nome}</div>
                      <div className="text-[11.5px] text-muted">{fmtDate(p.inicio, { day: '2-digit', month: 'short' })} → {fmtDate(p.fim, { day: '2-digit', month: 'short' })}</div>
                    </div>
                  </div>
                )
              })}
            </div>
          </Card>

          <Card>
            <CardHead title="Seus desafios" action={<Link to="/gamificacao" className="text-[13px] font-semibold text-brand hover:underline">Ver</Link>} />
            <div className="p-4 space-y-3.5">
              {meusDesafios.length === 0 && <p className="text-[13px] text-muted">Você não está participando de desafios. A participação é opcional — veja os disponíveis em Reconhecimento.</p>}
              {meusDesafios.map(({ d, p }) => (
                <div key={d.id}>
                  <div className="flex items-center justify-between mb-1.5 gap-2">
                    <span className="text-[12.5px] font-semibold text-ink">{d.titulo}</span>
                    {p.concluido ? <Badge tone="success" dot>Concluído</Badge> : <span className="text-[11.5px] font-bold text-brand">+{d.pontosBonus}</span>}
                  </div>
                  <Progress value={p.percentual} />
                  <div className="text-[11px] text-muted mt-1">{p.atual}/{p.meta} · até {fmtDate(d.fim, { day: '2-digit', month: 'short' })}</div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}
