import { useMemo, useState } from 'react'
import { useStore, type EventoInput } from '@/lib/store'
import type { CategoriaEvento, Evento } from '@/lib/types'
import { PageHeader, Card, Badge, Button, Icon, Avatar, Field, EmptyState, Callout, Tabs, corTextoSobre } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { fmtDate, fmtDateTime, cn } from '@/lib/utils'
import { hojeISO, parseDia } from '@/domain/datas'
import { eventoVisivel, podeGerenciarEvento, areasLideradas } from '@/domain/visibilidade'
import { aniversariosDoMes } from '@/domain/aniversarios'
import { can } from '@/domain/permissions'
import { Dropdown } from '@/components/Dropdown'

export const CATEGORIAS: CategoriaEvento[] = ['Integração', 'Celebração', 'Aprendizado', 'Reunião aberta', 'Bem-estar', 'Data comemorativa']
const CAT_TONE: Record<string, string> = {
  'Integração': 'brand', 'Celebração': 'gold', 'Aprendizado': 'success', 'Reunião aberta': 'neutral', 'Bem-estar': 'warning', 'Data comemorativa': 'danger',
}
const CAT_COR: Record<string, string> = {
  'Integração': '#0032D2', 'Celebração': '#c98a12', 'Aprendizado': '#0f9d6b', 'Reunião aberta': '#3d4b56', 'Bem-estar': '#ea580c', 'Data comemorativa': '#db2777',
}
const SEMANA = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb']

export default function Eventos() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const podeCriar = can(user.papel, 'eventos:gerenciar') || (can(user.papel, 'eventos:gerenciar_area') && areasLideradas(user, s.setores).length > 0)

  const [vista, setVista] = useState<'lista' | 'mes'>('lista')
  const [quando, setQuando] = useState<'proximos' | 'passados'>('proximos')
  const [cats, setCats] = useState<string[]>([])
  const [soMeus, setSoMeus] = useState(false)
  const [mesRef, setMesRef] = useState(() => hoje.slice(0, 7))
  const [aberto, setAberto] = useState<string | null>(null)
  const [form, setForm] = useState<{ aberto: boolean; evento?: Evento }>({ aberto: false })

  const visiveis = useMemo(() => s.eventos.filter((e) => eventoVisivel(e, user)), [s.eventos, user])
  const filtrados = visiveis
    .filter((e) => !cats.length || cats.includes(e.categoria))
    .filter((e) => !soMeus || e.confirmados.includes(user.id) || e.interessados.includes(user.id) || e.organizadorId === user.id)

  const lista = filtrados
    .filter((e) => (quando === 'proximos' ? e.inicio.slice(0, 10) >= hoje : e.inicio.slice(0, 10) < hoje))
    .sort((a, b) => (quando === 'proximos' ? a.inicio.localeCompare(b.inicio) : b.inicio.localeCompare(a.inicio)))

  const evAberto = s.eventos.find((e) => e.id === aberto) ?? null

  return (
    <>
      <PageHeader title="Agenda & eventos" subtitle="Encontros, aprendizados e celebrações da comunidade. A participação é sempre opcional."
        actions={podeCriar && <Button icon="Plus" onClick={() => setForm({ aberto: true })}>Criar evento</Button>} />

      <div className="flex flex-wrap items-center gap-2 mb-5">
        <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="group" aria-label="Modo de visualização">
          {(['lista', 'mes'] as const).map((v) => (
            <button key={v} type="button" aria-pressed={vista === v} onClick={() => setVista(v)}
              className={cn('h-8 px-3 rounded-lg text-[12.5px] font-semibold flex items-center gap-1.5 transition', vista === v ? 'bg-ink text-surface' : 'text-ink-2 hover:bg-surface-2')}>
              <Icon name={v === 'lista' ? 'List' : 'CalendarDays'} className="h-4 w-4" />{v === 'lista' ? 'Lista' : 'Mês'}
            </button>
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filtrar por categoria">
          {CATEGORIAS.map((c) => {
            const on = cats.includes(c)
            return (
              <button key={c} type="button" aria-pressed={on} onClick={() => setCats((x) => (on ? x.filter((y) => y !== c) : [...x, c]))}
                className={cn('chip', on && 'chip-active')}>
                <span className="h-2 w-2 rounded-full" style={{ background: CAT_COR[c] }} aria-hidden />{c}
              </button>
            )
          })}
        </div>
        <label className="flex items-center gap-2 text-[12.5px] text-ink-2 ml-auto cursor-pointer select-none">
          <input type="checkbox" checked={soMeus} onChange={(e) => setSoMeus(e.target.checked)} className="h-4 w-4 accent-brand" /> Só os meus
        </label>
      </div>

      {vista === 'lista' && (
        <>
          <Tabs tabs={[{ key: 'proximos', label: 'Próximos' }, { key: 'passados', label: 'Já aconteceram' }]} active={quando} onChange={(k) => setQuando(k as 'proximos' | 'passados')} />
          {lista.length === 0 ? (
            <Card><EmptyState icon="CalendarX2" title="Nenhum evento encontrado" desc={cats.length || soMeus ? 'Ajuste os filtros para ver mais eventos.' : quando === 'proximos' ? 'Ainda não há eventos agendados.' : 'Nenhum evento passado.'} /></Card>
          ) : (
            <div className="grid lg:grid-cols-2 gap-4">
              {lista.map((e) => <EventoCard key={e.id} e={e} onAbrir={() => setAberto(e.id)} />)}
            </div>
          )}
        </>
      )}

      {vista === 'mes' && <Calendario mesRef={mesRef} setMesRef={setMesRef} eventos={filtrados} onAbrir={setAberto} />}

      {evAberto && <EventoDetalhe e={evAberto} onClose={() => setAberto(null)} onEditar={() => { setForm({ aberto: true, evento: evAberto }); setAberto(null) }} />}
      {form.aberto && <EventoForm evento={form.evento} onClose={() => setForm({ aberto: false })} />}
    </>
  )
}

function EventoCard({ e, onAbrir }: { e: Evento; onAbrir: () => void }) {
  const s = useStore()
  const me = s.realUser().id
  const d = new Date(e.inicio)
  const cancelado = e.status === 'cancelado'
  const vou = e.confirmados.includes(me)
  const talvez = e.interessados.includes(me)
  return (
    <Card className={cn('p-4 sm:p-5 flex gap-4', cancelado && 'opacity-70')}>
      <div className={cn('h-16 w-16 rounded-2xl flex flex-col items-center justify-center shrink-0 leading-none', cancelado ? 'bg-winter text-muted line-through' : 'bg-midnight text-white dark:bg-brand-100 dark:text-brand-700')}>
        <span className="text-[22px] font-extrabold">{d.getDate()}</span>
        <span className="text-[10px] font-bold uppercase mt-0.5">{d.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')}</span>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-1 flex-wrap">
          <Badge tone={CAT_TONE[e.categoria]}>{e.categoria}</Badge>
          {cancelado && <Badge tone="danger" dot>Cancelado</Badge>}
          {e.visibilidade === 'setores' && <Badge tone="neutral"><Icon name="Building2" className="h-3 w-3" />{e.setoresAlvo.map((id) => s.setorNome(id)).join(', ')}</Badge>}
        </div>
        <button type="button" onClick={onAbrir} className="text-left text-[15.5px] font-bold text-ink hover:text-brand transition outline-none focus-visible:underline">{e.titulo}</button>
        {cancelado ? <p className="text-[12.5px] text-danger mt-1">{e.motivoCancelamento}</p> : e.descricao && <p className="text-[13px] text-muted mt-1 line-clamp-2">{e.descricao}</p>}
        <div className="flex items-center gap-3 mt-2.5 text-[12px] text-muted flex-wrap">
          <span className="flex items-center gap-1"><Icon name="Clock" className="h-3.5 w-3.5" />{fmtDateTime(e.inicio)}</span>
          <span className="flex items-center gap-1"><Icon name={e.link ? 'Video' : 'MapPin'} className="h-3.5 w-3.5" />{e.local}</span>
        </div>
        <div className="flex items-center justify-between mt-3 gap-2 flex-wrap">
          <span className="text-[12px] text-muted">{e.confirmados.length} confirmaram{e.capacidade ? ` · ${e.capacidade} vagas` : ''}</span>
          {!cancelado && e.inicio.slice(0, 10) >= hojeISO() ? (
            <div className="flex gap-1.5">
              <Button size="sm" variant={vou ? 'primary' : 'ghost'} icon={vou ? 'Check' : undefined} aria-pressed={vou}
                onClick={() => feedback(s.responderEvento(e.id, vou ? null : 'vou'), vou ? 'Confirmação removida.' : 'Presença confirmada! 🎉')}>Vou</Button>
              <Button size="sm" variant={talvez ? 'soft' : 'ghost'} aria-pressed={talvez}
                onClick={() => feedback(s.responderEvento(e.id, talvez ? null : 'talvez'), talvez ? 'Interesse removido.' : 'Marcado como interesse.')}>Talvez</Button>
            </div>
          ) : (
            <Button size="sm" variant="subtle" onClick={onAbrir}>Detalhes</Button>
          )}
        </div>
      </div>
    </Card>
  )
}

function Calendario({ mesRef, setMesRef, eventos, onAbrir }: { mesRef: string; setMesRef: (m: string) => void; eventos: Evento[]; onAbrir: (id: string) => void }) {
  const s = useStore()
  const hoje = hojeISO()
  const [ano, mes] = mesRef.split('-').map(Number)
  const primeiro = new Date(ano, mes - 1, 1)
  const diasNoMes = new Date(ano, mes, 0).getDate()
  const offset = primeiro.getDay()
  const celulas = Array.from({ length: Math.ceil((offset + diasNoMes) / 7) * 7 }, (_, i) => i - offset + 1)
  const niver = aniversariosDoMes(s.colaboradores, mes - 1)
  const mover = (delta: number) => { const d = new Date(ano, mes - 1 + delta, 1); setMesRef(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`) }
  const iso = (dia: number) => `${mesRef}-${String(dia).padStart(2, '0')}`

  return (
    <Card className="overflow-hidden">
      <div className="flex items-center justify-between px-4 sm:px-5 py-3 border-b border-line">
        <Button size="icon-sm" variant="ghost" icon="ChevronLeft" aria-label="Mês anterior" onClick={() => mover(-1)} />
        <h2 className="text-[15px] font-bold text-ink capitalize">{primeiro.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}</h2>
        <Button size="icon-sm" variant="ghost" icon="ChevronRight" aria-label="Próximo mês" onClick={() => mover(1)} />
      </div>
      {/* Grade (telas médias+) */}
      <div className="hidden md:grid grid-cols-7">
        {SEMANA.map((d) => <div key={d} className="text-[11px] font-bold uppercase text-muted text-center py-2 border-b border-line bg-surface-2">{d}</div>)}
        {celulas.map((dia, i) => {
          const valido = dia >= 1 && dia <= diasNoMes
          const evs = valido ? eventos.filter((e) => e.inicio.slice(0, 10) === iso(dia)) : []
          const nv = valido ? niver.filter((n) => n.dia === dia) : []
          return (
            <div key={i} className={cn('min-h-[104px] border-b border-r border-line p-1.5', !valido && 'bg-surface-2/60', valido && iso(dia) === hoje && 'bg-brand-50/60')}>
              {valido && (
                <>
                  <div className={cn('text-[12px] font-bold mb-1 h-6 w-6 rounded-full flex items-center justify-center', iso(dia) === hoje ? 'bg-brand text-white' : 'text-ink-2')}>{dia}</div>
                  <div className="space-y-1">
                    {evs.map((e) => (
                      <button key={e.id} type="button" onClick={() => onAbrir(e.id)} title={e.titulo}
                        className={cn('w-full text-left text-[11px] font-semibold rounded-md px-1.5 py-1 truncate', e.status === 'cancelado' && 'line-through opacity-60')}
                        style={{ background: CAT_COR[e.categoria], color: corTextoSobre(CAT_COR[e.categoria]) }}>
                        {e.inicio.slice(11, 16)} {e.titulo}
                      </button>
                    ))}
                    {nv.map((n) => <div key={n.pessoa.id} className="text-[11px] text-ink-2 truncate">🎂 {n.pessoa.nome.split(' ')[0]}</div>)}
                  </div>
                </>
              )}
            </div>
          )
        })}
      </div>
      {/* Agenda do mês (celular) */}
      <ul className="md:hidden divide-y divide-line">
        {Array.from({ length: diasNoMes }, (_, i) => i + 1).filter((dia) => eventos.some((e) => e.inicio.slice(0, 10) === iso(dia)) || niver.some((n) => n.dia === dia)).map((dia) => (
          <li key={dia} className="flex gap-3 p-3">
            <div className={cn('h-10 w-10 rounded-xl flex flex-col items-center justify-center shrink-0 text-[14px] font-extrabold', iso(dia) === hoje ? 'bg-brand text-white' : 'bg-winter text-ink')}>{dia}</div>
            <div className="flex-1 min-w-0 space-y-1">
              {eventos.filter((e) => e.inicio.slice(0, 10) === iso(dia)).map((e) => (
                <button key={e.id} type="button" onClick={() => onAbrir(e.id)} className="block text-left text-[13px] font-semibold text-ink">
                  <span className="inline-block h-2 w-2 rounded-full mr-1.5" style={{ background: CAT_COR[e.categoria] }} />{e.inicio.slice(11, 16)} · {e.titulo}{e.status === 'cancelado' && ' (cancelado)'}
                </button>
              ))}
              {niver.filter((n) => n.dia === dia).map((n) => <div key={n.pessoa.id} className="text-[12.5px] text-ink-2">🎂 Aniversário de {n.pessoa.nome.split(' ')[0]}</div>)}
            </div>
          </li>
        ))}
        {!eventos.some((e) => e.inicio.startsWith(mesRef)) && !niver.length && <li className="p-5 text-[13px] text-muted">Nada agendado neste mês.</li>}
      </ul>
      <div className="px-4 py-2.5 text-[11.5px] text-muted border-t border-line">🎂 Aniversários aparecem apenas para quem optou por compartilhar (dia e mês).</div>
    </Card>
  )
}

function EventoDetalhe({ e, onClose, onEditar }: { e: Evento; onClose: () => void; onEditar: () => void }) {
  const s = useStore()
  const user = s.currentUser()
  const gerencia = podeGerenciarEvento(e, user, s.setores)
  const hoje = hojeISO()
  const futuro = e.inicio.slice(0, 10) >= hoje
  const comecou = e.inicio.slice(0, 10) <= hoje
  const [cancelando, setCancelando] = useState(false)
  const [excluindo, setExcluindo] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [presencaAberta, setPresencaAberta] = useState(false)
  const [presentes, setPresentes] = useState<string[]>(e.presencas)
  const vou = e.confirmados.includes(user.id)
  const convidados = s.colaboradores.filter((c) => c.status !== 'encerrado' && (e.visibilidade === 'todos' || e.setoresAlvo.includes(c.setorId)))
    .sort((a, b) => (e.confirmados.includes(b.id) ? 1 : 0) - (e.confirmados.includes(a.id) ? 1 : 0) || a.nome.localeCompare(b.nome))

  return (
    <>
    <Modal open onClose={onClose} wide title={e.titulo} subtitle={`${fmtDateTime(e.inicio)}${e.fim ? ` até ${e.fim.slice(11, 16)}` : ''} · ${e.local}`}
      footer={<>
        {gerencia && e.status === 'agendado' && !cancelando && !presencaAberta && (
          <>
            <Button variant="subtle" icon="Ban" onClick={() => setCancelando(true)}>Cancelar evento</Button>
            <Button variant="ghost" icon="Pencil" onClick={onEditar}>Editar</Button>
            {comecou && <Button variant="soft" icon="ClipboardCheck" onClick={() => setPresencaAberta(true)}>Registrar presença</Button>}
          </>
        )}
        {gerencia && !cancelando && !presencaAberta && <Button variant="subtle" icon="Trash2" onClick={() => setExcluindo(true)}>Excluir</Button>}
        {cancelando && <>
          <Button variant="ghost" onClick={() => setCancelando(false)}>Voltar</Button>
          <Button variant="danger" icon="Ban" onClick={() => { if (feedback(s.cancelarEvento(e.id, motivo), 'Evento cancelado.')) onClose() }}>Confirmar cancelamento</Button>
        </>}
        {presencaAberta && <>
          <Button variant="ghost" onClick={() => setPresencaAberta(false)}>Voltar</Button>
          <Button icon="Check" onClick={() => { if (feedback(s.registrarPresencas(e.id, presentes), 'Presenças registradas.')) setPresencaAberta(false) }}>Salvar presenças ({presentes.length})</Button>
        </>}
        {!cancelando && !presencaAberta && futuro && e.status === 'agendado' && (
          <Button icon={vou ? 'Check' : 'Plus'} variant={vou ? 'soft' : 'primary'} onClick={() => feedback(s.responderEvento(e.id, vou ? null : 'vou'), vou ? 'Confirmação removida.' : 'Presença confirmada! 🎉')}>{vou ? 'Confirmado' : 'Vou participar'}</Button>
        )}
      </>}>
      <div className="flex items-center gap-2 mb-4 flex-wrap">
        <Badge tone={CAT_TONE[e.categoria]}>{e.categoria}</Badge>
        {e.status === 'cancelado' ? <Badge tone="danger" dot>Cancelado</Badge> : <Badge tone="neutral">Participação opcional</Badge>}
        {e.visibilidade === 'setores' && <Badge tone="neutral">Para: {e.setoresAlvo.map((id) => s.setorNome(id)).join(', ')}</Badge>}
      </div>
      {e.status === 'cancelado' && <Callout tone="danger" icon="Ban" className="mb-4"><b>Motivo do cancelamento:</b> {e.motivoCancelamento}</Callout>}
      {e.descricao && <p className="text-[14px] text-ink-2 leading-relaxed whitespace-pre-line mb-4">{e.descricao}</p>}
      <dl className="grid sm:grid-cols-2 gap-3 text-[13px] mb-2">
        <div><dt className="text-[11px] font-bold uppercase text-muted">Organização</dt><dd className="font-semibold text-ink mt-0.5">{s.nomeDe(e.organizadorId)}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase text-muted">Local</dt><dd className="font-semibold text-ink mt-0.5">{e.local}{e.link && <> · <a href={e.link} target="_blank" rel="noreferrer noopener" className="text-brand underline">abrir link</a></>}</dd></div>
        <div><dt className="text-[11px] font-bold uppercase text-muted">Confirmações</dt><dd className="font-semibold text-ink mt-0.5">{e.confirmados.length}{e.capacidade ? ` de ${e.capacidade} vagas` : ''} · {e.interessados.length} com interesse</dd></div>
        {!futuro && e.status === 'agendado' && <div><dt className="text-[11px] font-bold uppercase text-muted">Presenças registradas</dt><dd className="font-semibold text-ink mt-0.5">{e.presencas.length}</dd></div>}
      </dl>

      {cancelando && (
        <Field label="Motivo do cancelamento" required hint="Será enviado a quem confirmou ou demonstrou interesse." htmlFor="mot-canc" className="mt-4">
          <textarea id="mot-canc" className="input !h-auto py-2.5" rows={2} value={motivo} onChange={(ev) => setMotivo(ev.target.value)} placeholder="Ex.: Remarcado para a próxima semana." />
        </Field>
      )}

      {presencaAberta && (
        <div className="mt-4">
          <p className="text-[12.5px] text-muted mb-2">Marque quem participou. Cada pessoa recebe os pontos de participação uma única vez por evento.</p>
          <div className="rounded-xl border border-line p-2 space-y-1">
            {convidados.map((c) => (
              <label key={c.id} className={cn('flex items-center gap-2.5 rounded-lg px-2.5 py-2 cursor-pointer', presentes.includes(c.id) ? 'bg-brand-50' : 'hover:bg-surface-2')}>
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={presentes.includes(c.id)} onChange={() => setPresentes((p) => (p.includes(c.id) ? p.filter((x) => x !== c.id) : [...p, c.id]))} />
                <span className="text-[13px] font-medium text-ink flex-1">{c.nome}</span>
                {e.confirmados.includes(c.id) && <Badge tone="success">confirmou</Badge>}
              </label>
            ))}
          </div>
        </div>
      )}

      {gerencia && !presencaAberta && e.confirmados.length > 0 && (
        <div className="mt-4">
          <div className="text-[11px] font-bold uppercase text-muted mb-2">Quem confirmou (visível para a organização)</div>
          <div className="flex flex-wrap gap-2">
            {e.confirmados.map((id) => { const c = s.pessoa(id); return c ? <span key={id} className="inline-flex items-center gap-1.5 text-[12px] bg-surface-2 border border-line rounded-full pl-1 pr-2.5 py-0.5"><Avatar nome={c.nome} cor={c.avatarCor} size="sm" className="!h-5 !w-5 !text-[8px]" />{c.nome}</span> : null })}
          </div>
        </div>
      )}
    </Modal>
    <ConfirmModal open={excluindo} onClose={() => setExcluindo(false)} titulo="Excluir evento?" confirmar="Excluir"
      texto={`"${e.titulo}" será apagado para todas as pessoas. Para só avisar o cancelamento, use "Cancelar evento".`}
      onConfirm={() => { if (feedback(s.excluirEvento(e.id), 'Evento excluído.')) { setExcluindo(false); onClose() } }} />
    </>
  )
}

function EventoForm({ evento, onClose }: { evento?: Evento; onClose: () => void }) {
  const s = useStore()
  const user = s.currentUser()
  const somenteArea = !can(user.papel, 'eventos:gerenciar')
  const minhasAreas = areasLideradas(user, s.setores)
  const [f, setF] = useState(() => ({
    titulo: evento?.titulo ?? '', descricao: evento?.descricao ?? '', categoria: (evento?.categoria ?? 'Reunião aberta') as CategoriaEvento,
    data: evento?.inicio.slice(0, 10) ?? hojeISO(), hora: evento?.inicio.slice(11, 16) ?? '10:00', horaFim: evento?.fim?.slice(11, 16) ?? '',
    local: evento?.local ?? '', link: evento?.link ?? '', capacidade: evento?.capacidade ? String(evento.capacidade) : '',
    visibilidade: (somenteArea ? 'setores' : evento?.visibilidade ?? 'todos') as 'todos' | 'setores',
    setoresAlvo: evento?.setoresAlvo ?? (somenteArea ? minhasAreas.map((a) => a.id).slice(0, 1) : []),
  }))
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const areasDisponiveis = somenteArea ? minhasAreas : s.setores

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault()
    const input: EventoInput = {
      titulo: f.titulo.trim(), descricao: f.descricao.trim(), categoria: f.categoria,
      inicio: `${f.data}T${f.hora}:00`, fim: f.horaFim ? `${f.data}T${f.horaFim}:00` : undefined,
      local: f.local.trim() || (f.link ? 'Online' : 'A definir'), link: f.link.trim() || undefined,
      capacidade: f.capacidade ? Number(f.capacidade) : undefined,
      visibilidade: f.visibilidade, setoresAlvo: f.visibilidade === 'setores' ? f.setoresAlvo : [],
    }
    if (feedback(s.salvarEvento(input, evento?.id), evento ? 'Evento atualizado. Quem confirmou foi avisado.' : 'Evento publicado na agenda! 🎉')) onClose()
  }

  return (
    <Modal open onClose={onClose} wide title={evento ? 'Editar evento' : 'Criar evento'} subtitle="Eventos são abertos e de participação opcional."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="evtForm">{evento ? 'Salvar' : 'Publicar evento'}</Button></>}>
      <form id="evtForm" onSubmit={salvar} noValidate>
        <Field label="Título" required htmlFor="ev-t"><input id="ev-t" className="input" value={f.titulo} onChange={(e) => set({ titulo: e.target.value })} placeholder="Ex.: Town Hall trimestral" maxLength={120} /></Field>
        <Field label="Descrição" htmlFor="ev-d"><textarea id="ev-d" className="input !h-auto py-2.5" rows={3} value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Categoria" htmlFor="ev-c">
            <Dropdown id="ev-c" className="input" value={f.categoria} onChange={(e) => set({ categoria: e.target.value as CategoriaEvento })}>{CATEGORIAS.map((c) => <option key={c}>{c}</option>)}</Dropdown>
          </Field>
          <Field label="Data" required htmlFor="ev-dt"><input id="ev-dt" type="date" className="input" value={f.data} onChange={(e) => set({ data: e.target.value })} /></Field>
          <Field label="Início" required htmlFor="ev-h"><input id="ev-h" type="time" className="input" value={f.hora} onChange={(e) => set({ hora: e.target.value })} /></Field>
          <Field label="Término (opcional)" htmlFor="ev-hf"><input id="ev-hf" type="time" className="input" value={f.horaFim} onChange={(e) => set({ horaFim: e.target.value })} /></Field>
          <Field label="Local" htmlFor="ev-l"><input id="ev-l" className="input" value={f.local} onChange={(e) => set({ local: e.target.value })} placeholder="Ex.: Sede ou Online" /></Field>
          <Field label="Link (opcional)" htmlFor="ev-k"><input id="ev-k" type="url" className="input" value={f.link} onChange={(e) => set({ link: e.target.value })} placeholder="https://" /></Field>
          <Field label="Vagas (opcional)" htmlFor="ev-v"><input id="ev-v" type="number" min={1} className="input" value={f.capacidade} onChange={(e) => set({ capacidade: e.target.value })} /></Field>
          <Field label="Quem vê o evento" htmlFor="ev-vis" hint={somenteArea ? 'Lideranças publicam eventos para as próprias áreas.' : undefined}>
            <Dropdown id="ev-vis" className="input" value={f.visibilidade} disabled={somenteArea} onChange={(e) => set({ visibilidade: e.target.value as 'todos' | 'setores' })}>
              <option value="todos">Toda a comunidade</option><option value="setores">Áreas específicas</option>
            </Dropdown>
          </Field>
        </div>
        {f.visibilidade === 'setores' && (
          <fieldset className="mb-4 grid sm:grid-cols-2 gap-2">
            <legend className="label">Áreas</legend>
            {areasDisponiveis.map((a) => (
              <label key={a.id} className={cn('flex items-center gap-2.5 rounded-xl border px-3 py-2.5 cursor-pointer', f.setoresAlvo.includes(a.id) ? 'border-brand bg-brand-50' : 'border-line')}>
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={f.setoresAlvo.includes(a.id)} onChange={() => set({ setoresAlvo: f.setoresAlvo.includes(a.id) ? f.setoresAlvo.filter((x) => x !== a.id) : [...f.setoresAlvo, a.id] })} />
                <span className="text-[13px] font-medium text-ink">{a.nome}</span>
              </label>
            ))}
          </fieldset>
        )}
        {f.data < hojeISO() && <Callout tone="warning" icon="History">A data escolhida já passou — use isso apenas para registrar eventos que aconteceram.</Callout>}
        <p className="text-[11.5px] text-muted mt-2">Datas no formato do seu navegador. {fmtDate(f.data) !== '—' && `Evento em ${parseDia(f.data).toLocaleDateString('pt-BR', { weekday: 'long' })}.`}</p>
      </form>
    </Modal>
  )
}
