/* Peças compartilhadas das telas de vagas: tipos, filtros na URL, badges, menu de ações. */
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Link, useSearchParams } from 'react-router-dom'
import { Badge, Button, Callout, Icon, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { StatusBadge, type MapaStatus } from '@/components/v2/StatusBadge'
import { api, executar, useApi, type Remoto } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { MAPA_STATUS_VAGA, ROTULO_PRIORIDADE, proximoStatus, quemEdita, type AcaoVaga, type StatusVaga } from '@/domain/v2/vagas'
import { cn } from '@/lib/utils'
import { dataBR } from '@/lib/fmt'

export const MAPA = MAPA_STATUS_VAGA as unknown as MapaStatus
export const BadgeStatus = ({ valor }: { valor: string }) => <StatusBadge mapa={MAPA} valor={valor} />
export const BadgePrioridade = ({ valor }: { valor: string }) =>
  valor === 'normal' ? null : <Badge tone={valor === 'critica' ? 'danger' : valor === 'alta' ? 'warning' : 'neutral'}>{ROTULO_PRIORIDADE[valor] ?? valor}</Badge>
export const BadgePrazo = ({ situacao }: { situacao?: string | null }) =>
  situacao === 'vencida' ? <Badge tone="danger" dot>Prazo vencido</Badge> : situacao === 'proxima' ? <Badge tone="warning" dot>Prazo próximo</Badge> : null

export interface VagaLinha {
  id: string; codigo: string; slug: string; titulo: string; status: StatusVaga; prioridade: string; tipo: string; qtdPosicoes: number; posicoesPreenchidas: number
  setorId?: string | null; setorNome?: string | null; unidadeNome?: string | null; cargoNome?: string | null; gestorSolicitanteId?: string | null; gestorSolicitanteNome?: string | null
  gestorResponsavelNome?: string | null; recrutadorNome?: string | null; modalidade: string; cidade?: string | null; estado?: string | null
  dataAbertura?: string | null; prazoPreenchimento?: string | null; encerraCandidaturasEm?: string | null; situacaoPrazo?: string | null; arquivada?: boolean; atualizadoEm?: string
  candidaturas?: { total: number; ativas: number; contratadas: number }; criadoPor?: string; salarioMin?: number | null; salarioMax?: number | null
}
export interface Opcoes {
  setores: { id: string; nome: string }[]; todosSetores: { id: string; nome: string }[]; unidades: { id: string; nome: string }[]
  cargos: { id: string; nome: string; setorId: string; nivel: string | null }[]; pessoas: { id: string; nome: string; setorId: string }[]
  recrutadores: { id: string; nome: string }[]; canais: { chave: string; nome: string }[]; tipos: { chave: string; nome: string }[]
  etapasPadrao: { nome: string; tipo: string }[]; aprovadores: { papeis: { chave: string; nome: string }[]; funcoes: { chave: string; nome: string }[] }
  eu: { colaboradorId: string; setorPadrao: string | null; nome: string }
}
export const useOpcoes = (): Remoto<Opcoes> => useApi<Opcoes>('recrutamento/opcoes')

/** Passos de aprovação que cabem à pessoa (RH, gestor, diretoria, aprovação financeira…). Some quando não há nenhum. */
export function AprovacoesPendentes() {
  const r = useApi<{ itens: { passoId: string; vagaId: string; codigo: string; titulo: string; rotulo: string; prazo: string | null; atrasado: boolean }[] }>('recrutamento/aprovacoes-pendentes')
  const itens = r.dados?.itens ?? []
  if (!itens.length) return null
  return (
    <Callout tone="warning" icon="Hourglass" className="mb-5">
      <b>{itens.length} aprovação(ões) aguardando você:</b>
      <ul className="mt-1.5 space-y-1">
        {itens.map((p) => (
          <li key={p.passoId}><Link className="underline font-semibold" to={`/recrutamento/vagas/${p.vagaId}?aba=aprovacoes`}>{p.codigo} · {p.titulo}</Link> — {p.rotulo}{p.prazo ? ` (prazo ${dataBR(p.prazo)})` : ''}{p.atrasado && <Badge tone="danger" className="ml-2">Atrasada</Badge>}</li>
        ))}
      </ul>
    </Callout>
  )
}

/* ---------- filtros guardados na URL (permitem drilldown por link) ---------- */
export const CHAVES_FILTRO = ['q', 'status', 'setor', 'unidade', 'recrutador', 'gestor', 'modalidade', 'prioridade', 'tipo', 'de', 'ate', 'prazo', 'criticas', 'arquivadas'] as const
export function useFiltrosUrl(extras: string[] = []) {
  const [sp, setSp] = useSearchParams()
  const chaves = useMemo(() => [...CHAVES_FILTRO, ...extras], [extras])
  const valores = useMemo(() => Object.fromEntries(chaves.map((k) => [k, sp.get(k) ?? ''])) as Record<string, string>, [sp, chaves])
  const definir = useCallback((k: string, v: string) => {
    setSp((atual) => { const n = new URLSearchParams(atual); if (v) n.set(k, v); else n.delete(k); if (k !== 'pagina') n.delete('pagina'); return n }, { replace: true })
  }, [setSp])
  const limpar = useCallback(() => setSp((atual) => { const n = new URLSearchParams(); for (const k of extras) if (atual.get(k)) n.set(k, atual.get(k)!); return n }, { replace: true }), [setSp, extras])
  const ativos = CHAVES_FILTRO.filter((k) => valores[k] && k !== 'arquivadas').length
  return { valores, definir, limpar, ativos }
}
export const queryDe = (v: Record<string, string>) => {
  const u = new URLSearchParams()
  for (const [k, x] of Object.entries(v)) if (x) u.set(k, x)
  const s = u.toString()
  return s ? `?${s}` : ''
}

/** Filtros secundários: ficam recolhidos em "Mais filtros" (abrem sozinhos quando algum está ativo). */
const FILTROS_SECUNDARIOS = ['de', 'ate', 'unidade', 'recrutador', 'gestor', 'modalidade', 'prioridade'] as const

export function BarraFiltros({ valores, definir, limpar, ativos, opcoes, comBusca = true, comStatus = true }: {
  valores: Record<string, string>; definir: (k: string, v: string) => void; limpar: () => void; ativos: number; opcoes?: Opcoes; comBusca?: boolean; comStatus?: boolean
}) {
  const todos = opcoes?.todosSetores ?? []
  const secundariosAtivos = FILTROS_SECUNDARIOS.filter((k) => valores[k]).length
  const [mais, setMais] = useState(secundariosAtivos > 0)
  const abertos = mais
  const campo = 'block min-w-0'
  return (
    <div className="card p-4 mb-5" role="search" aria-label="Filtros de vagas">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-[minmax(0,1.4fr)_repeat(3,minmax(0,1fr))_auto] gap-3 items-end">
        {comBusca && (
          <label className={campo}><span className="label">Buscar</span>
            <input type="search" className="input" placeholder="Título, código ou cidade" value={valores.q} onChange={(e) => definir('q', e.target.value)} /></label>
        )}
        {comStatus && (
          <div className={campo}><span className="label">Situação</span>
            <Select label="Situação" className="w-full" value={valores.status} onChange={(v) => definir('status', v)}>
              <option value="">Todas</option>
              {(Object.keys(MAPA_STATUS_VAGA) as StatusVaga[]).map((s) => <option key={s} value={s}>{MAPA_STATUS_VAGA[s].rotulo}</option>)}
              <option value="em_aprovacao,ajustes,aprovada,publicada,pausada">Em aberto (qualquer etapa)</option>
            </Select></div>
        )}
        <div className={campo}><span className="label">Departamento</span>
          <Select label="Departamento" className="w-full" value={valores.setor} onChange={(v) => definir('setor', v)}><option value="">Todos</option>{todos.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select></div>
        <div className={campo}><span className="label">Prazo</span>
          <Select label="Prazo" className="w-full" value={valores.prazo} onChange={(v) => definir('prazo', v)}>
            <option value="">Qualquer</option><option value="proxima">Próximo do prazo (7 dias)</option><option value="vencida">Prazo vencido</option></Select></div>
        <div className="flex items-center gap-2 sm:col-span-2 lg:col-span-1">
          <Button variant={abertos ? 'soft' : 'ghost'} icon="SlidersHorizontal" aria-expanded={abertos} aria-controls="filtros-vagas-mais" onClick={() => setMais(!abertos)}>
            Mais filtros{secundariosAtivos > 0 && <span className="ml-0.5 rounded-full bg-brand text-white text-[10.5px] px-1.5 py-0.5 leading-none">{secundariosAtivos}</span>}
          </Button>
        </div>
      </div>
      {abertos && (
        <div id="filtros-vagas-mais" className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mt-3 pt-3 border-t border-line">
          <label className={campo}><span className="label">Abertas de</span><input type="date" className="input" value={valores.de} onChange={(e) => definir('de', e.target.value)} /></label>
          <label className={campo}><span className="label">até</span><input type="date" className="input" value={valores.ate} onChange={(e) => definir('ate', e.target.value)} /></label>
          <div className={campo}><span className="label">Unidade</span>
            <Select label="Unidade" className="w-full" value={valores.unidade} onChange={(v) => definir('unidade', v)}><option value="">Todas</option>{(opcoes?.unidades ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select></div>
          <div className={campo}><span className="label">Recrutador(a)</span>
            <Select label="Recrutador" className="w-full" value={valores.recrutador} onChange={(v) => definir('recrutador', v)}><option value="">Todos</option>{(opcoes?.recrutadores ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select></div>
          <div className={campo}><span className="label">Gestor(a)</span>
            <Select label="Gestor" className="w-full" value={valores.gestor} onChange={(v) => definir('gestor', v)}><option value="">Todos</option>{(opcoes?.pessoas ?? []).map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}</Select></div>
          <div className={campo}><span className="label">Modalidade</span>
            <Select label="Modalidade" className="w-full" value={valores.modalidade} onChange={(v) => definir('modalidade', v)}>
              <option value="">Todas</option><option value="presencial">Presencial</option><option value="hibrido">Híbrido</option><option value="remoto">Remoto</option></Select></div>
          <div className={campo}><span className="label">Prioridade</span>
            <Select label="Prioridade" className="w-full" value={valores.prioridade} onChange={(v) => definir('prioridade', v)}>
              <option value="">Todas</option>{Object.entries(ROTULO_PRIORIDADE).map(([k, n]) => <option key={k} value={k}>{n}</option>)}</Select></div>
        </div>
      )}
      {ativos > 0 && <div className="mt-3 flex items-center gap-2 flex-wrap text-[12.5px] text-muted"><span>{ativos} filtro{ativos > 1 ? 's' : ''} ativo{ativos > 1 ? 's' : ''}</span><Button size="sm" variant="subtle" icon="FilterX" onClick={() => { limpar(); setMais(false) }}>Limpar filtros</Button></div>}
    </div>
  )
}

/* ---------- ações ---------- */
export type AcaoMenu = AcaoVaga | 'arquivar' | 'desarquivar'
export const ROTULO_ACAO: Record<AcaoMenu, { rotulo: string; icon: string; sucesso: string; motivo?: boolean; perigo?: boolean }> = {
  solicitar: { rotulo: 'Solicitar aprovação', icon: 'Send', sucesso: 'Solicitação enviada para aprovação.' },
  publicar: { rotulo: 'Publicar vaga', icon: 'Globe', sucesso: 'Vaga publicada no portal de carreiras.' },
  pausar: { rotulo: 'Pausar', icon: 'Pause', sucesso: 'Vaga pausada.' },
  retomar: { rotulo: 'Retomar', icon: 'Play', sucesso: 'Vaga retomada.' },
  encerrar: { rotulo: 'Encerrar', icon: 'CircleCheck', sucesso: 'Vaga encerrada.', motivo: true },
  cancelar: { rotulo: 'Cancelar', icon: 'Ban', sucesso: 'Vaga cancelada.', motivo: true, perigo: true },
  reabrir: { rotulo: 'Reabrir', icon: 'RotateCcw', sucesso: 'Vaga reaberta.' },
  arquivar: { rotulo: 'Arquivar', icon: 'Archive', sucesso: 'Vaga arquivada.' },
  desarquivar: { rotulo: 'Desarquivar', icon: 'ArchiveRestore', sucesso: 'Vaga desarquivada.' },
}

/** Executa uma ação de ciclo de vida (pede o motivo quando necessário). Devolve o modal a renderizar e a função `pedir`. */
export function useAcaoVaga(onFeito: (acao: AcaoMenu, resposta: any) => void) {
  const [pendente, setPendente] = useState<{ id: string; titulo: string; acao: AcaoMenu } | null>(null)
  const [motivo, setMotivo] = useState('')
  const [enviando, setEnviando] = useState(false)
  const rodar = async (id: string, acao: AcaoMenu, corpo: Record<string, unknown> = {}) => {
    setEnviando(true)
    const r = await executar(() => api.post(`vagas/${id}/acoes/${acao}`, corpo), ROTULO_ACAO[acao].sucesso)
    setEnviando(false)
    if (r) { setPendente(null); setMotivo(''); onFeito(acao, r) }
  }
  const pedir = (v: { id: string; titulo: string }, acao: AcaoMenu) => {
    if (ROTULO_ACAO[acao].motivo) { setMotivo(''); setPendente({ id: v.id, titulo: v.titulo, acao }) } else void rodar(v.id, acao)
  }
  const modal = (
    <Modal open={!!pendente} onClose={() => setPendente(null)} title={pendente ? `${ROTULO_ACAO[pendente.acao].rotulo}: ${pendente.titulo}` : ''}
      footer={<>
        <Button variant="ghost" onClick={() => setPendente(null)}>Voltar</Button>
        <Button variant={pendente && ROTULO_ACAO[pendente.acao].perigo ? 'danger' : 'primary'} disabled={enviando || motivo.trim().length < 3} onClick={() => pendente && rodar(pendente.id, pendente.acao, { motivo })}>
          {pendente ? ROTULO_ACAO[pendente.acao].rotulo : ''}
        </Button>
      </>}>
      <label className="block"><span className="label">Motivo (obrigatório)</span>
        <textarea className="input min-h-[96px]" value={motivo} maxLength={500} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: posição preenchida internamente" /></label>
      <p className="text-[12px] text-muted mt-2">O motivo fica registrado no histórico da vaga.</p>
    </Modal>
  )
  return { pedir, modal }
}

/** Ações disponíveis para a linha da lista, a partir do estado e das capacidades (o servidor confirma a permissão). */
export function acoesDaLinha(v: VagaLinha, gestao: boolean, euId: string): { acoes: AcaoMenu[]; editar: boolean } {
  const q = quemEdita(v.status)
  const sol = v.gestorSolicitanteId === euId || v.criadoPor === euId
  const editar = q === 'solicitante' ? gestao || sol : q === 'gestao' ? gestao : false
  const acoes: AcaoMenu[] = []
  const add = (a: AcaoVaga) => { if (proximoStatus(v.status, a)) acoes.push(a) }
  // Sem aprovação: do rascunho a vaga vai direto ao ar (quem criou também pode publicar).
  if (gestao || (sol && ['rascunho', 'ajustes'].includes(v.status))) add('publicar')
  if (gestao) { add('pausar'); add('retomar'); add('encerrar'); add('reabrir') }
  if (gestao || (sol && ['rascunho', 'em_aprovacao', 'ajustes'].includes(v.status))) add('cancelar')
  if (gestao && ['encerrada', 'cancelada'].includes(v.status)) acoes.push(v.arquivada ? 'desarquivar' : 'arquivar')
  return { acoes, editar }
}

/**
 * Menu de ações (⋯). A lista abre num portal com posição fixa: dentro de tabelas e quadros com rolagem horizontal
 * (overflow-x: auto também liga a rolagem vertical) ela não é cortada nem cria barra de rolagem dentro da tabela.
 */
export function Menu({ rotulo, children }: { rotulo: string; children: (fechar: () => void) => ReactNode }) {
  const [aberto, setAberto] = useState(false)
  const [pos, setPos] = useState<{ top?: number; bottom?: number; right: number } | null>(null)
  const botao = useRef<HTMLButtonElement>(null)
  const lista = useRef<HTMLDivElement>(null)
  const fechar = useCallback(() => setAberto(false), [])
  const posicionar = useCallback(() => {
    const r = botao.current?.getBoundingClientRect()
    if (!r) return
    const right = Math.max(8, window.innerWidth - r.right)
    // Abre para cima quando falta espaço abaixo do botão.
    const abaixo = window.innerHeight - r.bottom
    setPos(abaixo < 300 && r.top > abaixo ? { bottom: window.innerHeight - r.top + 6, right } : { top: r.bottom + 6, right })
  }, [])
  useEffect(() => {
    if (!aberto) return
    posicionar()
    const fora = (e: MouseEvent) => { const t = e.target as Node; if (!lista.current?.contains(t) && !botao.current?.contains(t)) setAberto(false) }
    const teclas = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { setAberto(false); botao.current?.focus(); return }
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return
      const itens = [...(lista.current?.querySelectorAll<HTMLElement>('[role="menuitem"]') ?? [])]
      if (!itens.length) return
      e.preventDefault()
      const i = itens.indexOf(document.activeElement as HTMLElement)
      itens[(i + (e.key === 'ArrowDown' ? 1 : -1) + itens.length) % itens.length].focus()
    }
    // Rolar a página ou a tabela desloca o botão: fecha em vez de deixar a lista flutuando longe dele.
    const rolou = (e: Event) => { if (!lista.current?.contains(e.target as Node)) setAberto(false) }
    document.addEventListener('mousedown', fora); document.addEventListener('keydown', teclas)
    window.addEventListener('scroll', rolou, true); window.addEventListener('resize', fechar)
    return () => {
      document.removeEventListener('mousedown', fora); document.removeEventListener('keydown', teclas)
      window.removeEventListener('scroll', rolou, true); window.removeEventListener('resize', fechar)
    }
  }, [aberto, posicionar, fechar])
  return (
    <div className="relative inline-block">
      <button ref={botao} type="button" aria-haspopup="menu" aria-expanded={aberto} aria-label={rotulo} onClick={() => setAberto((a) => !a)}
        className={cn('h-9 w-9 rounded-lg border text-muted hover:bg-winter hover:text-ink flex items-center justify-center outline-none focus-visible:ring-2 focus-visible:ring-brand transition', aberto ? 'border-line-strong bg-winter text-ink' : 'border-line')}>
        <Icon name="MoreHorizontal" className="h-[18px] w-[18px]" />
      </button>
      {aberto && pos && createPortal(
        <div ref={lista} role="menu" aria-label={rotulo} style={{ position: 'fixed', ...pos }}
          className="z-[150] min-w-[210px] max-h-[min(420px,calc(100vh-24px))] overflow-y-auto rounded-xl border border-line bg-surface shadow-lg p-1.5 animate-scale-in">
          {children(fechar)}
        </div>,
        document.body,
      )}
    </div>
  )
}
export const ItemMenu = ({ icon, children, onClick, perigo, to }: { icon: string; children: ReactNode; onClick?: () => void; perigo?: boolean; to?: string }) => {
  const cls = cn('w-full flex items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-left outline-none focus-visible:bg-winter', perigo ? 'text-danger hover:bg-danger-soft' : 'text-ink hover:bg-winter')
  return to
    ? <a role="menuitem" href={to} className={cls} onClick={(e) => { if (e.metaKey || e.ctrlKey) return; e.preventDefault(); onClick?.() }}><Icon name={icon} className="h-4 w-4" />{children}</a>
    : <button type="button" role="menuitem" className={cls} onClick={onClick}><Icon name={icon} className="h-4 w-4" />{children}</button>
}

export function useSouGestao() { return useTem('vagas:gerenciar') }
