import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Avatar, Badge, Progress, Icon, StatCard, EmptyState, Select, Button } from '@/components/ui'
import { fmtDate, relTime, cn } from '@/lib/utils'
import { hojeISO, tempoParceria } from '@/domain/datas'
import { ACAO_ICON, ACAO_LABEL, contarAcoes, historico, nivelDe } from '@/domain/gamificacao'
import { ReconhecerModal } from './Gamificacao'
import type { AcaoPontuavel } from '@/lib/types'

export default function Experiencia() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const pontos = s.pontosDe(user.id)
  const nivel = nivelDe(pontos, s.config.gamificacao.niveis)
  const extrato = historico(s.lancamentos, user.id)
  const minhas = s.conquistas.filter((c) => c.colaboradorId === user.id)
  const tem = new Set(minhas.map((c) => c.badgeId))
  const recebidos = s.reconhecimentos.filter((r) => r.paraId === user.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const eventos = contarAcoes(s.lancamentos, user.id, 'participacao_evento')
  const conteudos = s.progressoConteudos.filter((p) => p.colaboradorId === user.id).length
  const [filtro, setFiltro] = useState<string>('todas')
  const [reconhecer, setReconhecer] = useState(false)
  const [verTudo, setVerTudo] = useState(false)

  const lista = extrato.filter((l) => filtro === 'todas' || l.acao === filtro)
  const integracao = s.processos.find((p) => p.colaboradorId === user.id && p.tipo === 'integracao' && p.concluidoEm)
  const jornada = [
    { icon: 'Handshake', txt: 'Início da parceria com a 4JURIS', date: user.dataEntrada },
    integracao && { icon: 'Rocket', txt: 'Integração inicial concluída', date: integracao.concluidoEm! },
    ...minhas.slice().sort((a, b) => a.obtidaEm.localeCompare(b.obtidaEm)).slice(0, 3).map((c) => ({ icon: 'Award', txt: `Conquista: ${s.badges.find((b) => b.id === c.badgeId)?.nome}`, date: c.obtidaEm })),
    recebidos.length > 0 && { icon: 'Heart', txt: 'Primeiro reconhecimento recebido', date: recebidos[recebidos.length - 1].criadoEm },
  ].filter(Boolean).sort((a, b) => (a as { date: string }).date.localeCompare((b as { date: string }).date)) as { icon: string; txt: string; date: string }[]

  return (
    <>
      <PageHeader title="Minha jornada" subtitle="Sua participação na comunidade: pontos, conquistas e reconhecimentos." />

      <Card className="p-5 sm:p-8 mb-6 bg-midnight bg-gradient-to-br from-midnight to-midnight-soft text-white relative overflow-hidden tech-grid">
        <div className="relative flex items-center gap-5 sm:gap-6 flex-wrap">
          <Avatar nome={user.nome} cor={user.avatarCor} size="xl"  />
          <div className="flex-1 min-w-[220px]">
            <h2 className="text-[21px] sm:text-[22px] font-bold">{user.nomeSocial || user.nome}</h2>
            <p className="text-[#b5c0c9] text-[13.5px]">Parceria há {tempoParceria(user.dataEntrada, hoje)} · desde {fmtDate(user.dataEntrada)}</p>
            <div className="flex items-baseline gap-2 mt-4 flex-wrap">
              <span className="text-[32px] font-extrabold leading-none tabular-nums">{pontos.toLocaleString('pt-BR')}</span>
              <span className="text-[12px] text-[#9aa7b1]">pontos</span>
              <span className="ml-1 text-[11px] font-bold bg-brand rounded-full px-2.5 py-1">Nível {nivel.nivel} · {nivel.nome}</span>
            </div>
            <Progress value={nivel.progresso} className="mt-3 max-w-md bg-white/10" color="#4d6bec" />
            <div className="text-[11.5px] text-[#9aa7b1] mt-1.5">{nivel.proximoNome ? `${nivel.faltam} pts para ${nivel.proximoNome}` : 'Você chegou ao nível máximo!'}</div>
          </div>
        </div>
      </Card>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <StatCard icon="Award" tone="brand" value={`${minhas.length}/${s.badges.filter((b) => b.ativa).length}`} label="Conquistas" />
        <StatCard icon="Heart" tone="danger" value={recebidos.length} label="Reconhecimentos recebidos" />
        <StatCard icon="CalendarHeart" tone="success" value={eventos} label="Eventos com presença" />
        <StatCard icon="GraduationCap" tone="warning" value={conteudos} label="Conteúdos concluídos" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.25fr_1fr] gap-6">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="Histórico de pontos" sub="Cada ponto tem origem registrada"
              action={<Select label="Filtrar por ação" value={filtro} onChange={setFiltro} className="!h-9 !min-w-[160px] text-[12.5px]">
                <option value="todas">Todas as ações</option>
                {(Object.keys(ACAO_LABEL) as AcaoPontuavel[]).filter((a) => extrato.some((l) => l.acao === a)).map((a) => <option key={a} value={a}>{ACAO_LABEL[a]}</option>)}
              </Select>} />
            {lista.length === 0 ? <EmptyState icon="Trophy" title="Nenhum ponto ainda" desc="Participe de eventos, reconheça colegas ou conclua conteúdos para começar." /> : (
              <>
                <ul className="divide-y divide-line">
                  {(verTudo ? lista : lista.slice(0, 8)).map((l) => (
                    <li key={l.id} className="flex items-center gap-3 px-4 sm:px-5 py-3">
                      <span className="h-9 w-9 rounded-lg bg-winter text-ink-2 flex items-center justify-center shrink-0"><Icon name={ACAO_ICON[l.acao]} className="h-4 w-4" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13px] font-semibold text-ink truncate">{l.descricao}</div>
                        <div className="text-[11.5px] text-muted">{ACAO_LABEL[l.acao]} · {fmtDate(l.criadoEm)}{l.registradoPorId ? ` · registrado por ${s.nomeDe(l.registradoPorId).split(' ')[0]}` : ''}</div>
                      </div>
                      <span className={cn('text-[13.5px] font-extrabold tabular-nums', l.pontos >= 0 ? 'text-success' : 'text-danger')}>{l.pontos >= 0 ? '+' : ''}{l.pontos}</span>
                    </li>
                  ))}
                </ul>
                {lista.length > 8 && <div className="p-3 border-t border-line text-center"><Button size="sm" variant="subtle" onClick={() => setVerTudo((v) => !v)}>{verTudo ? 'Ver menos' : `Ver todos (${lista.length})`}</Button></div>}
              </>
            )}
          </Card>

          <Card>
            <CardHead title="Reconhecimentos recebidos" action={<Button size="sm" variant="soft" icon="Heart" onClick={() => setReconhecer(true)}>Reconhecer alguém</Button>} />
            {recebidos.length === 0 ? <p className="text-[13px] text-muted p-5">Quando alguém reconhecer você, aparece aqui.</p> : (
              <ul className="divide-y divide-line">
                {recebidos.slice(0, 5).map((r) => {
                  const de = s.pessoa(r.deId)
                  return (
                    <li key={r.id} className="flex gap-3 p-4">
                      <Avatar nome={de?.nome ?? '?'} cor={de?.avatarCor} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-muted"><b className="text-ink">{de?.nome}</b> · {r.valor} · {relTime(r.criadoEm)}</div>
                        <p className="text-[13.5px] text-ink-2 mt-0.5">“{r.mensagem}”</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="Conquistas" sub="Critérios visíveis — sem surpresas" />
            <ul className="p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {s.badges.filter((b) => b.ativa).map((b) => {
                const ok = tem.has(b.id)
                const atual = b.criterio.tipo === 'nivel' ? nivel.nivel : contarAcoes(s.lancamentos, user.id, b.criterio.acao)
                const meta = b.criterio.tipo === 'nivel' ? b.criterio.nivel : b.criterio.quantidade
                return (
                  <li key={b.id} className={cn('flex gap-3 p-3 rounded-xl border', ok ? 'border-line bg-surface' : 'border-dashed border-line')}>
                    <span className={cn('h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0', !ok && 'grayscale opacity-40')} style={{ background: b.cor }}><Icon name={b.icon} className="h-5 w-5" /></span>
                    <div className="min-w-0 flex-1">
                      <div className="text-[12.5px] font-bold text-ink">{b.nome} {ok && <span className="sr-only">(obtida)</span>}</div>
                      <div className="text-[11.5px] text-muted leading-snug">{b.descricao}</div>
                      {!ok && <><Progress value={(Math.min(atual, meta) / meta) * 100} className="mt-1.5 h-1.5" /><div className="text-[10.5px] text-muted mt-0.5">{Math.min(atual, meta)}/{meta}</div></>}
                    </div>
                  </li>
                )
              })}
            </ul>
          </Card>

          <Card>
            <CardHead title="Marcos da sua trajetória" />
            <ol className="p-6 pl-7">
              {jornada.map((j, i) => (
                <li key={i} className="relative pl-7 pb-5 last:pb-0">
                  {i < jornada.length - 1 && <span className="absolute left-[8px] top-5 bottom-0 w-px bg-line" />}
                  <span className="absolute left-0 top-0.5 h-[18px] w-[18px] rounded-full bg-surface border-2 border-brand" />
                  <div className="flex items-center gap-2"><Icon name={j.icon} className="h-4 w-4 text-brand" /><span className="text-[13.5px] font-semibold text-ink">{j.txt}</span></div>
                  <span className="text-[12px] text-muted">{fmtDate(j.date)}</span>
                </li>
              ))}
            </ol>
          </Card>
          <p className="text-[12px] text-muted px-1">Quer aparecer (ou não) nos destaques da comunidade? Ajuste em <Link to="/perfil" className="text-brand font-semibold">Meu perfil → Privacidade</Link>.</p>
        </div>
      </div>
      {reconhecer && <ReconhecerModal onClose={() => setReconhecer(false)} excluir={user.id} />}
    </>
  )
}
