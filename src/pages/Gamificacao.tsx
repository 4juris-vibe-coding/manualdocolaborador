import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Iniciativa, StatusIniciativa, ValorCultural } from '@/lib/types'
import { PageHeader, Card, CardHead, Avatar, Badge, Progress, Icon, Button, Field, EmptyState, Tabs, Toggle, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn, fmtDate, relTime, STATUS_INICIATIVA, firstName } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { ACAO_LABEL, progressoDesafio } from '@/domain/gamificacao'
import { Dropdown } from '@/components/Dropdown'

/** Valores da cultura (configuráveis em Cultura organizacional). */
export function useValores() {
  return useStore((x) => x.config.cultura.valores)
}
const corDe = (valores: { nome: string; cor: string }[], v: string) => valores.find((x) => x.nome === v)?.cor ?? '#0032D2'
const iconeDe = (valores: { nome: string; icone: string }[], v: string) => valores.find((x) => x.nome === v)?.icone ?? 'Star'

const COLUNAS: { key: StatusIniciativa; titulo: string; icon: string }[] = [
  { key: 'aberta', titulo: 'Abertas a voluntários', icon: 'Inbox' },
  { key: 'andamento', titulo: 'Em andamento', icon: 'Loader' },
  { key: 'revisao', titulo: 'Aguardando confirmação', icon: 'Clock' },
  { key: 'concluida', titulo: 'Concluídas', icon: 'CheckCircle2' },
]

export default function Gamificacao() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const [tab, setTab] = useState('reconhecimentos')
  const [reconhecer, setReconhecer] = useState(false)

  return (
    <>
      <PageHeader title="Reconhecimento & desafios" subtitle="Reconheça colegas, participe de desafios opcionais e contribua com iniciativas da comunidade."
        actions={<Button icon="Heart" onClick={() => setReconhecer(true)}>Reconhecer alguém</Button>} />

      <Tabs tabs={[
        { key: 'reconhecimentos', label: 'Mural de reconhecimentos' },
        { key: 'desafios', label: 'Desafios' },
        { key: 'iniciativas', label: 'Iniciativas voluntárias' },
        { key: 'regras', label: 'Como funcionam os pontos' },
      ]} active={tab} onChange={setTab} />

      {tab === 'reconhecimentos' && <Mural onReconhecer={() => setReconhecer(true)} />}
      {tab === 'desafios' && <Desafios hoje={hoje} />}
      {tab === 'iniciativas' && <Iniciativas />}
      {tab === 'regras' && <Regras />}

      {reconhecer && <ReconhecerModal onClose={() => setReconhecer(false)} excluir={user.id} />}
    </>
  )
}

function Mural({ onReconhecer }: { onReconhecer: () => void }) {
  const s = useStore()
  const valores = useValores()
  const corValor = (v: string) => corDe(valores, v)
  const iconValor = (v: string) => iconeDe(valores, v)
  const me = s.realUser()
  const mes = hojeISO().slice(0, 7)
  const [filtro, setFiltro] = useState<'todos' | 'meus'>('todos')
  const lista = s.reconhecimentos
    .filter((r) => r.publico || r.deId === me.id || r.paraId === me.id)
    .filter((r) => filtro === 'todos' || r.deId === me.id || r.paraId === me.id)
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const enviadosMes = s.reconhecimentos.filter((r) => r.deId === me.id && r.criadoEm.slice(0, 7) === mes).length
  const limite = s.config.gamificacao.limiteReconhecimentosEnviadosMes

  // Destaques: somente quem optou por aparecer; foco em reconhecimentos recebidos no mês.
  const destaques = useMemo(() => {
    if (!s.config.gamificacao.destaquesAtivos) return []
    const cont = new Map<string, number>()
    s.reconhecimentos.filter((r) => r.publico && r.criadoEm.slice(0, 7) === mes).forEach((r) => cont.set(r.paraId, (cont.get(r.paraId) ?? 0) + 1))
    return [...cont.entries()].map(([id, n]) => ({ p: s.pessoa(id), n }))
      .filter((x) => x.p && x.p.privacidade.aparecerEmDestaques && x.p.status !== 'encerrado')
      .sort((a, b) => b.n - a.n).slice(0, 5)
  }, [s, mes])

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6">
      <div className="min-w-0">
        <div className="flex items-center gap-2 mb-4">
          {(['todos', 'meus'] as const).map((f) => (
            <button key={f} type="button" aria-pressed={filtro === f} onClick={() => setFiltro(f)} className={cn('chip', filtro === f && 'chip-active')}>{f === 'todos' ? 'Todos' : 'Envolvendo você'}</button>
          ))}
        </div>
        {lista.length === 0 ? <Card><EmptyState icon="Heart" title="Nenhum reconhecimento ainda" desc="Que tal começar reconhecendo alguém que te ajudou?" action={<Button icon="Heart" onClick={onReconhecer}>Reconhecer</Button>} /></Card> : (
          <ul className="space-y-3">
            {lista.map((r) => {
              const de = s.pessoa(r.deId), para = s.pessoa(r.paraId)
              return (
                <li key={r.id}>
                  <Card className="p-4 sm:p-5">
                    <div className="flex items-start gap-3">
                      <span className="h-10 w-10 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: corValor(r.valor) }}><Icon name={iconValor(r.valor)} className="h-5 w-5" /></span>
                      <div className="flex-1 min-w-0">
                        <div className="text-[13.5px] text-ink">
                          <b>{de?.nome ?? '—'}</b> reconheceu <b>{para?.nome ?? '—'}</b> por <span className="inline-flex items-center gap-1 font-bold text-ink"><span className="h-2 w-2 rounded-full" style={{ background: corValor(r.valor) }} aria-hidden />{r.valor}</span>
                        </div>
                        <p className="text-[13.5px] text-ink-2 mt-1.5 leading-relaxed">“{r.mensagem}”</p>
                        <div className="flex items-center gap-2 mt-2 text-[11.5px] text-muted">
                          {relTime(r.criadoEm)}
                          {!r.publico && <Badge tone="neutral"><Icon name="Lock" className="h-3 w-3" />Privado</Badge>}
                        </div>
                      </div>
                    </div>
                  </Card>
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <div className="space-y-6 min-w-0">
        <Card className="p-5 bg-midnight text-white tech-grid relative overflow-hidden">
          <div className="relative">
            <div className="text-[13px] text-[#b5c0c9]">Você reconheceu neste mês</div>
            <div className="text-[30px] font-extrabold mt-1 tabular-nums">{enviadosMes}<span className="text-[15px] text-[#9aa7b1] font-semibold"> / {limite}</span></div>
            <p className="text-[12.5px] text-[#b5c0c9] mt-1">O limite mensal mantém os reconhecimentos genuínos.</p>
            <Button className="mt-4" icon="Heart" onClick={onReconhecer} disabled={enviadosMes >= limite}>Reconhecer alguém</Button>
          </div>
        </Card>
        {s.config.gamificacao.destaquesAtivos && (
          <Card>
            <CardHead title="Destaques do mês" sub="Mais reconhecidos publicamente · só aparece quem optou" />
            <div className="p-3">
              {destaques.length === 0 && <p className="text-[13px] text-muted p-2">Ainda sem destaques neste mês.</p>}
              {destaques.map(({ p, n }) => (
                <div key={p!.id} className="flex items-center gap-3 p-2.5">
                  <Avatar nome={p!.nome} cor={p!.avatarCor} size="sm" />
                  <div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink truncate">{p!.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(p!.setorId)}</div></div>
                  <Badge tone="brand"><Icon name="Heart" className="h-3 w-3" />{n}</Badge>
                </div>
              ))}
            </div>
            <div className="px-5 pb-4 text-[11.5px] text-muted">Destaques celebram a colaboração e não são avaliação de desempenho. Você controla sua participação em Meu perfil → Privacidade.</div>
          </Card>
        )}
      </div>
    </div>
  )
}

export function ReconhecerModal({ onClose, excluir, paraInicial }: { onClose: () => void; excluir: string; paraInicial?: string }) {
  const s = useStore()
  const VALORES = useValores()
  const [para, setPara] = useState(paraInicial ?? '')
  const [valor, setValor] = useState<ValorCultural>(VALORES[0]?.nome ?? '')
  const [msg, setMsg] = useState('')
  const [publico, setPublico] = useState(true)
  const pessoas = s.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== excluir).sort((a, b) => a.nome.localeCompare(b.nome))
  const enviar = () => {
    if (!para) { feedback({ ok: false, erro: 'Escolha quem você quer reconhecer.' }, ''); return }
    if (feedback(s.reconhecer(para, valor, msg, publico), `Reconhecimento enviado para ${firstName(s.nomeDe(para))}! 💙`)) onClose()
  }
  return (
    <Modal open onClose={onClose} title="Reconhecer alguém" subtitle="Agradeça uma ajuda, destaque uma atitude ou celebre um resultado."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Send" onClick={enviar}>Enviar reconhecimento</Button></>}>
      <Field label="Quem você quer reconhecer?" required htmlFor="rc-para">
        <Dropdown id="rc-para" className="input" value={para} onChange={(e) => setPara(e.target.value)}>
          <option value="">Selecione…</option>
          {pessoas.map((c) => <option key={c.id} value={c.id}>{c.nome} · {s.setorNome(c.setorId)}</option>)}
        </Dropdown>
      </Field>
      <fieldset className="mb-4">
        <legend className="label">Valor demonstrado</legend>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {VALORES.map((v) => (
            <button key={v.nome} type="button" aria-pressed={valor === v.nome} onClick={() => setValor(v.nome)} title={v.descricao}
              className={cn('flex items-center gap-2 rounded-xl border px-3 py-2.5 text-[12.5px] font-semibold transition', valor === v.nome ? 'border-brand bg-brand-50 text-brand' : 'border-line text-ink-2 hover:border-line-strong')}>
              <Icon name={v.icone} className="h-4 w-4" />{v.nome}
            </button>
          ))}
        </div>
      </fieldset>
      <Field label="Mensagem" required hint={`Entre 10 e 400 caracteres · ${msg.length}/400`} htmlFor="rc-msg">
        <textarea id="rc-msg" className="input !h-auto py-2.5" rows={3} maxLength={400} value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="Conte o que a pessoa fez e por que fez diferença." />
      </Field>
      <Toggle checked={publico} onChange={setPublico} label={publico ? 'Público no mural da comunidade' : 'Privado (só vocês dois veem)'} />
    </Modal>
  )
}

function Desafios({ hoje }: { hoje: string }) {
  const s = useStore()
  const me = s.realUser().id
  const lista = [...s.desafios].sort((a, b) => b.fim.localeCompare(a.fim))
  if (!lista.length) return <Card><EmptyState icon="Flag" title="Nenhum desafio no momento" desc="O RH publica desafios temáticos de tempos em tempos." /></Card>
  return (
    <>
      <Callout tone="neutral" icon="Info" className="mb-5">Desafios são opcionais. Ações feitas dentro do período contam para o progresso — inclusive as anteriores à sua inscrição.</Callout>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {lista.map((d) => {
          const p = progressoDesafio(d, s.lancamentos, me, hoje)
          return (
            <Card key={d.id} className={cn('p-5', p.concluido && 'border-success/40')}>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge tone={p.status === 'ativo' ? 'brand' : p.status === 'futuro' ? 'gold' : 'neutral'}>{p.status === 'ativo' ? 'Em andamento' : p.status === 'futuro' ? 'Em breve' : 'Encerrado'}</Badge>
                    {p.concluido && <Badge tone="success" dot>Você concluiu</Badge>}
                  </div>
                  <h3 className="text-[15px] font-bold text-ink">{d.titulo}</h3>
                  <p className="text-[13px] text-muted mt-1">{d.descricao}</p>
                </div>
                <span className="text-[14px] font-extrabold text-brand shrink-0">+{d.pontosBonus}</span>
              </div>
              <div className="text-[12px] text-muted mt-3">{fmtDate(d.inicio)} → {fmtDate(d.fim)} · Critério: {d.criterio.meta}× {ACAO_LABEL[d.criterio.acao].toLowerCase()} · {d.participantes.length} participante(s)</div>
              {p.participando && (
                <div className="mt-3">
                  <Progress value={p.percentual} color={p.concluido ? '#0f9d6b' : undefined} />
                  <div className="text-[11.5px] text-muted mt-1">{p.atual} de {p.meta}</div>
                </div>
              )}
              {p.status !== 'encerrado' && !p.concluido && (
                <Button size="sm" className="mt-4" variant={p.participando ? 'ghost' : 'primary'} icon={p.participando ? 'LogOut' : 'Flag'}
                  onClick={() => feedback(s.participarDesafio(d.id, !p.participando), p.participando ? 'Você saiu do desafio.' : 'Você está participando! 🚩')}>
                  {p.participando ? 'Sair do desafio' : 'Participar'}
                </Button>
              )}
            </Card>
          )
        })}
      </div>
    </>
  )
}

function Iniciativas() {
  const s = useStore()
  const user = s.currentUser()
  const podeGerenciar = s.pode('iniciativas:gerenciar')
  const max = s.config.gamificacao.pontosMaximosIniciativa
  const [nova, setNova] = useState(false)
  const [contrib, setContrib] = useState<Iniciativa | null>(null)
  const [texto, setTexto] = useState('')
  const [remover, setRemover] = useState<Iniciativa | null>(null)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<StatusIniciativa | null>(null)
  const dragged = s.iniciativas.find((x) => x.id === arrastando)
  // Quem pode mover o cartão arrastado: abertas por qualquer pessoa; em andamento só por quem é voluntário(a).
  const podeArrastar = (t: Iniciativa) => t.status === 'aberta' || (t.status === 'andamento' && t.voluntarioId === user.id)
  const soltar = (destino: StatusIniciativa) => {
    setSobre(null)
    const t = dragged
    setArrastando(null)
    if (!t || t.status === destino) return
    if (destino === 'andamento' && t.status === 'aberta') feedback(s.assumirIniciativa(t.id), 'Iniciativa assumida! Ela agora está com você. 💪')
    else if (destino === 'aberta' && t.status === 'andamento') feedback(s.desistirIniciativa(t.id), 'Iniciativa devolvida ao quadro.')
    else if (destino === 'revisao' && t.status === 'andamento' && t.voluntarioId === user.id) { setContrib(t); setTexto('') }
    else if (destino === 'revisao' && t.status === 'aberta') feedback({ ok: false, erro: 'Assuma a iniciativa primeiro (arraste para "Em andamento").' }, '')
    else feedback({ ok: false, erro: destino === 'concluida' ? 'A conclusão é confirmada pela organização, depois do seu relato.' : 'Esse movimento não é permitido.' }, '')
  }

  const criar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (feedback(s.addIniciativa({ titulo: d.titulo.trim(), descricao: d.descricao.trim(), pontos: Number(d.pontos) || 0, prazo: d.prazo || undefined }), 'Iniciativa publicada. 🎯')) setNova(false)
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <p className="text-[12.5px] text-muted w-full hidden toque:flex items-center gap-1.5"><Icon name="Hand" className="h-4 w-4 text-brand" />Use os botões de cada cartão: <b className="text-ink-2">Quero contribuir</b> para assumir e <b className="text-ink-2">Concluí</b> para contar como foi.</p>
        <p className="text-[12.5px] text-muted w-full flex toque:hidden items-center gap-1.5"><Icon name="MousePointerClick" className="h-4 w-4 text-brand" />Arraste uma iniciativa de <b className="text-ink-2">Abertas</b> para <b className="text-ink-2">Em andamento</b> para assumi-la para você. Para concluir, arraste para <b className="text-ink-2">Aguardando confirmação</b> e conte como foi.</p>
        <p className="text-[13px] text-muted flex-1 min-w-[240px]">Iniciativas são contribuições <b className="text-ink-2">voluntárias</b> para a comunidade (não são tarefas dos projetos). Ao concluir, a organização confirma e os pontos são lançados.</p>
        {podeGerenciar && <Button icon="Plus" onClick={() => setNova(true)}>Nova iniciativa</Button>}
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
        {COLUNAS.map((col) => {
          const cards = s.iniciativas.filter((t) => t.status === col.key)
          return (
            <section key={col.key} aria-label={col.titulo}
              onDragOver={(e) => { e.preventDefault(); setSobre(col.key) }}
              onDragLeave={() => setSobre((c) => (c === col.key ? null : c))}
              onDrop={() => soltar(col.key)}
              className={cn('rounded-2xl border bg-surface-2 min-h-[200px] transition', sobre === col.key ? 'border-brand bg-brand-50' : 'border-line')}>
              <div className="flex items-center gap-2 px-4 py-3 border-b border-line">
                <Icon name={col.icon} className="h-[17px] w-[17px] text-muted" />
                <h3 className="text-[13px] font-bold text-ink">{col.titulo}</h3>
                <span className="ml-auto text-[11.5px] font-bold text-muted bg-winter rounded-full px-2 py-0.5">{cards.length}</span>
              </div>
              <div className="p-3 space-y-3">
                {cards.length === 0 && <p className="text-[12px] text-muted-2 text-center py-6">Nada por aqui.</p>}
                {cards.map((t) => {
                  const mine = t.voluntarioId === user.id
                  return (
                    <article key={t.id}
                      draggable={podeArrastar(t)}
                      onDragStart={() => setArrastando(t.id)}
                      onDragEnd={() => { setArrastando(null); setSobre(null) }}
                      className={cn('rounded-xl border border-line bg-surface p-3.5 shadow-xs transition', podeArrastar(t) && 'cursor-grab active:cursor-grabbing hover:border-brand', arrastando === t.id && 'opacity-40')}>
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="text-[13.5px] font-bold text-ink leading-snug">{t.titulo}</h4>
                        <span className="text-[12px] font-extrabold text-brand shrink-0 bg-brand-50 rounded-lg px-2 py-0.5">+{t.pontos}</span>
                      </div>
                      {t.descricao && <p className="text-[12px] text-muted mt-1.5 line-clamp-3">{t.descricao}</p>}
                      {t.prazo && <div className="text-[11.5px] text-muted mt-2"><Icon name="CalendarClock" className="h-3.5 w-3.5 inline mr-1" />Até {fmtDate(t.prazo)}</div>}
                      {t.voluntarioId && <div className="flex items-center gap-2 mt-2.5 text-[11.5px] text-muted"><Avatar nome={s.nomeDe(t.voluntarioId)} cor={s.pessoa(t.voluntarioId)?.avatarCor} size="sm" className="!h-6 !w-6 !text-[9px]" />{mine ? 'Você' : s.nomeDe(t.voluntarioId)}</div>}
                      {t.entrega && <p className="text-[11.5px] text-ink-2 mt-2 bg-surface-2 rounded-lg px-2.5 py-1.5">{t.entrega}</p>}

                      {col.key === 'aberta' && <Button size="sm" variant="soft" icon="Hand" className="w-full mt-3" onClick={() => feedback(s.assumirIniciativa(t.id), 'Obrigado por se voluntariar! 💪')}>Quero contribuir</Button>}
                      {col.key === 'andamento' && mine && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="ghost" className="flex-1" onClick={() => feedback(s.desistirIniciativa(t.id), 'Iniciativa devolvida ao quadro.')}>Desistir</Button>
                          <Button size="sm" icon="Send" className="flex-1" onClick={() => { setContrib(t); setTexto('') }}>Concluí</Button>
                        </div>
                      )}
                      {col.key === 'revisao' && podeGerenciar && !mine && (
                        <div className="flex gap-2 mt-3">
                          <Button size="sm" variant="ghost" className="flex-1" onClick={() => feedback(s.devolverIniciativa(t.id), 'Devolvida para ajustes.')}>Devolver</Button>
                          <Button size="sm" icon="Check" className="flex-1" onClick={() => feedback(s.confirmarIniciativa(t.id), 'Contribuição confirmada!')}>Confirmar</Button>
                        </div>
                      )}
                      {col.key === 'revisao' && mine && <div className="text-[11.5px] text-warning bg-warning-soft rounded-lg px-2.5 py-1.5 mt-3">Aguardando confirmação da organização</div>}
                      {col.key === 'concluida' && <div className="text-[11.5px] text-success bg-success-soft rounded-lg px-2.5 py-1.5 mt-3">Confirmada{t.confirmadaPor ? ` por ${s.nomeDe(t.confirmadaPor).split(' ')[0]}` : ''}</div>}
                      {podeGerenciar && col.key === 'aberta' && (
                        <button type="button" onClick={() => setRemover(t)} className="text-[11px] text-muted hover:text-danger mt-2 inline-flex items-center gap-1"><Icon name="Trash2" className="h-3 w-3" /> Remover</button>
                      )}
                    </article>
                  )
                })}
              </div>
            </section>
          )
        })}
      </div>

      <Modal open={nova} onClose={() => setNova(false)} title="Nova iniciativa voluntária" subtitle="Uma contribuição aberta à comunidade, sem relação com entregas contratuais."
        footer={<><Button variant="ghost" onClick={() => setNova(false)}>Cancelar</Button><Button icon="Check" type="submit" form="iniForm">Publicar</Button></>}>
        <form id="iniForm" onSubmit={criar}>
          <Field label="Título" required htmlFor="in-t"><input id="in-t" name="titulo" className="input" required maxLength={120} placeholder="Ex.: Organizar uma roda de leitura" /></Field>
          <Field label="Descrição" htmlFor="in-d"><textarea id="in-d" name="descricao" className="input !h-auto py-2.5" rows={3} /></Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Pontos" required hint={`Máximo ${max}`} htmlFor="in-p"><input id="in-p" name="pontos" type="number" min={0} max={max} defaultValue={100} className="input" /></Field>
            <Field label="Prazo sugerido" htmlFor="in-pz"><input id="in-pz" name="prazo" type="date" className="input" /></Field>
          </div>
        </form>
      </Modal>

      <Modal open={!!contrib} onClose={() => setContrib(null)} title="Contar como foi" subtitle={contrib?.titulo}
        footer={<><Button variant="ghost" onClick={() => setContrib(null)}>Cancelar</Button><Button icon="Send" onClick={() => { if (contrib && feedback(s.enviarContribuicao(contrib.id, texto), 'Enviado para confirmação!')) setContrib(null) }}>Enviar</Button></>}>
        <Field label="Relato ou link" required hint="Uma frase ou um link basta — não é preciso anexar foto ou vídeo." htmlFor="in-e">
          <textarea id="in-e" className="input !h-auto py-2.5" rows={3} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Field>
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover iniciativa?" confirmar="Remover" texto={remover ? `"${remover.titulo}" será removida do quadro.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerIniciativa(remover.id), 'Iniciativa removida.')) setRemover(null) }} />
    </>
  )
}

function Regras() {
  const s = useStore()
  const cfg = s.config.gamificacao
  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
      <Card>
        <CardHead title="Regras de pontuação" sub="Definidas pelo RH. Cada ação pontua uma única vez por referência." />
        <ul className="divide-y divide-line">
          {s.regras.filter((r) => r.acao !== 'ajuste_manual').map((r) => (
            <li key={r.id} className={cn('flex items-center gap-3 p-4', !r.ativa && 'opacity-50')}>
              <div className="flex-1 min-w-0">
                <div className="text-[13.5px] font-semibold text-ink">{r.nome}{!r.ativa && ' (desativada)'}</div>
                <div className="text-[12px] text-muted">{r.descricao}{r.limiteMensal ? ` Limite: ${r.limiteMensal}/mês.` : ''}</div>
              </div>
              <span className="text-[13px] font-extrabold text-brand shrink-0">{r.acao === 'desafio_concluido' || r.acao === 'iniciativa_concluida' ? 'variável' : `+${r.pontos}`}</span>
            </li>
          ))}
        </ul>
      </Card>
      <div className="space-y-6">
        <Card>
          <CardHead title="Níveis" sub="Uma forma leve de acompanhar sua participação" />
          <ul className="p-4 space-y-2">
            {cfg.niveis.map((n) => (
              <li key={n.nivel} className="flex items-center gap-3 text-[13px]">
                <span className="h-7 w-7 rounded-full bg-brand-50 text-brand font-bold flex items-center justify-center text-[12px]">{n.nivel}</span>
                <span className="font-semibold text-ink flex-1">{n.nome}</span>
                <span className="text-muted tabular-nums">{n.minimo.toLocaleString('pt-BR')}+ pts</span>
              </li>
            ))}
          </ul>
        </Card>
        <Callout tone="neutral" icon="ShieldCheck">
          <b>Combinados da gamificação:</b> pontos e níveis não têm relação com valores de contrato, pagamentos, descontos ou avaliação profissional.
          Não existe pontuação negativa por ausência, tempo conectado ou velocidade de resposta. Todo lançamento fica no seu histórico, em Minha jornada.
        </Callout>
      </div>
    </div>
  )
}
