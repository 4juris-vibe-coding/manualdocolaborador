/* Kanban das notas fiscais (papel Financeiro, RH, administração; diretoria só vê).
   Colunas: aguardando → recebida → aprovada → paga, e recusada (devolvida).
   Mover um cartão chama o servidor, que executa as etapas do fluxo com as mesmas travas
   (nota própria, divergência com justificativa, segregação de funções). */
import { useEffect, useMemo, useRef, useState, type PointerEvent as ReactPointerEvent } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card, EmptyState, Field, Icon, PageHeader, SearchBox, Select, TD, TH, Tabela, Tabs, Toggle } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Drawer } from '@/components/v2/Drawer'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, executar, useApi } from '@/data/v2/api'
import { CampoArquivo, competenciaBR, dinheiro, useFiltros } from '@/components/v2/financeiro/comum'
import { FORMAS_PAGAMENTO, ROTULO_FORMA } from '@/domain/v2/financeiro'
import { dataBR, dataHoraBR, haQuanto } from '@/lib/fmt'
import { toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import NotasFinanceiro, { DetalheNota } from './Notas'

type Coluna = 'aguardando' | 'recebida' | 'aprovada' | 'recusada' | 'paga'
interface Cartao {
  tipo: 'nota' | 'esperada'; id: string; coluna: Coluna; pessoaId: string | null; pessoaNome: string | null; fornecedorNome: string; contratoId: string | null; contratoNumero: string | null
  valor: number | null; numero?: string; status?: string; contaId?: string | null; contaStatus?: string | null; liquido?: number | null; emissao?: string; enviadaEm?: string
  vencimento?: string | null; pagoEm?: string | null; motivoDevolucao?: string | null; divergencias?: number; reenvios?: number; gestorNome?: string | null
  cobrancas?: number; ultimaCobranca?: string | null
}
interface Quadro {
  competencia: string; prazo: string; segregacao: boolean; cartoes: Cartao[]; pessoasPendentes: number; semContrato: number; podeGerarContratos: boolean
  totais: Record<Coluna, { quantidade: number; valor: number }>
  capacidades: { mover: boolean; pagar: boolean; autorizar: boolean; disparar: boolean; registrar: boolean }
}
interface Previa {
  competencia: string; prazo: string; contagem: Record<string, number>; modelo: { assunto: string; mensagem: string }
  pessoas: { pessoaId: string; nome: string | null; contratos: string[]; pendente: boolean; devolvida: boolean; temNota: boolean }[]
  automatico: { ativo: boolean; dias: number[]; incluirDevolvidas: boolean; assunto: string; mensagem: string; atualizadoEm: string | null }
}

const COLUNAS: { chave: Coluna; titulo: string; desc: string; icone: string; tom: string }[] = [
  { chave: 'aguardando', titulo: 'Aguardando', desc: 'Contrato mensal sem nota na competência', icone: 'Hourglass', tom: 'border-t-platinum' },
  { chave: 'recebida', titulo: 'Recebida', desc: 'Em conferência e aceite', icone: 'Inbox', tom: 'border-t-warning' },
  { chave: 'aprovada', titulo: 'Aprovada', desc: 'Conta a pagar criada', icone: 'BadgeCheck', tom: 'border-t-brand' },
  { chave: 'recusada', titulo: 'Recusada', desc: 'Devolvida, aguarda reenvio', icone: 'Undo2', tom: 'border-t-danger' },
  { chave: 'paga', titulo: 'Paga', desc: 'Pagamento registrado', icone: 'Wallet', tom: 'border-t-success' },
]
/** Para onde cada coluna pode ir pelo kanban (o servidor confere de novo). */
const DESTINOS: Record<Coluna, Coluna[]> = { aguardando: ['recebida'], recebida: ['aprovada', 'paga', 'recusada'], aprovada: ['paga'], recusada: [], paga: [] }
const mesAtual = () => new Date().toISOString().slice(0, 7)

export default function KanbanNotas() {
  const f = useFiltros(['aba', 'competencia', 'q', 'nota', 'sub'])
  const comp = f.valores.competencia || mesAtual()
  const aba = f.valores.aba || 'quadro'
  const r = useApi<Quadro>(`financeiro/kanban?competencia=${comp}`)
  const [mover, setMover] = useState<{ cartao: Cartao; destino: Coluna } | null>(null)
  const [disparo, setDisparo] = useState<{ pessoas?: string[] } | null>(null)
  const [auto, setAuto] = useState(false)
  const [registrar, setRegistrar] = useState<Cartao | null>(null)
  const caps = r.dados?.capacidades

  const pedirMover = (c: Cartao, destino: Coluna) => {
    if (c.coluna === destino) return
    if (!DESTINOS[c.coluna].includes(destino)) {
      toast(c.coluna === 'aguardando' ? 'Ainda não há nota: registre a nota recebida ou cobre a pessoa.' : c.coluna === 'recusada' ? 'A nota recusada volta para "Recebida" quando o prestador reenviar a versão corrigida.' : c.coluna === 'paga' ? 'Nota já paga.' : 'Esse movimento não é permitido.', 'danger')
      return
    }
    // Aguardando → Recebida: a nota chegou por outro canal; abre o registro.
    if (c.coluna === 'aguardando') { if (r.dados?.capacidades.registrar) setRegistrar(c); else toast('Você não pode registrar notas.', 'danger'); return }
    setMover({ cartao: c, destino })
  }

  return (
    <>
      <PageHeader title="Notas fiscais" subtitle="As notas de todos: quem já mandou, quem falta e em que pé está cada uma. Arraste o cartão (no celular, toque e segure) ou use “Mover para…” para mudar a situação."
        actions={caps?.disparar && <>
          <Button variant="ghost" icon="CalendarClock" onClick={() => setAuto(true)}>Disparos automáticos</Button>
          <Button icon="Send" onClick={() => setDisparo({})}>Cobrar notas</Button>
        </>} />
      <SoComBanco>
        <Tabs tabs={[{ key: 'quadro', label: 'Kanban' }, { key: 'lista', label: 'Lista e conferência' }, { key: 'disparos', label: 'Cobranças enviadas' }]} active={aba} onChange={(k) => f.definir('aba', k === 'quadro' ? '' : k)} />
        {aba !== 'lista' && <div className="flex flex-wrap items-end gap-2.5 mb-4">
          <Field label="Competência" htmlFor="kb-comp"><input id="kb-comp" type="month" className="input w-auto" value={comp} onChange={(e) => f.definir('competencia', e.target.value)} /></Field>
          {aba === 'quadro' && <SearchBox value={f.valores.q} onChange={(v) => f.definir('q', v)} placeholder="Pessoa, empresa, contrato ou NF" />}
          {r.dados && <p className="text-[12.5px] text-muted pb-2.5">Prazo de envio: <b className="text-ink">{dataBR(r.dados.prazo)}</b>{r.dados.pessoasPendentes > 0 && <> · {r.dados.pessoasPendentes} pessoa(s) com nota pendente</>}</p>}
        </div>}
        {aba === 'quadro' && r.dados && r.dados.semContrato > 0 && (
          <Callout tone="warning" icon="FileSignature" className="mb-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span><b>{r.dados.semContrato} pessoa(s) ativa(s) sem contrato.</b> Sem contrato elas não conseguem enviar a nota nem aparecem no quadro. O contrato-base é mensal, vigente e com valor a definir.</span>
              {r.dados.podeGerarContratos && <Button size="sm" icon="FilePlus2" onClick={async () => {
                const g = await executar(() => api.post<{ contratos: number; fornecedores: number; semDocumento: { nome: string }[] }>('financeiro/contratos-base'))
                if (!g) return
                toast(`${g.contratos} contrato(s) criado(s)${g.fornecedores ? `, ${g.fornecedores} fornecedor(es)` : ''}.${g.semDocumento.length ? ` Sem CPF/CNPJ no cadastro: ${g.semDocumento.map((x) => x.nome).join(', ')}.` : ''}`)
                r.recarregar()
              }}>Gerar contratos</Button>}
            </div>
          </Callout>
        )}
        {aba === 'quadro' && <Aguardar r={r} linhas={6}>{(d) => <Quadro d={d} busca={f.valores.q} abrir={(id) => f.definir('nota', id)} mover={pedirMover} cobrar={(p) => setDisparo({ pessoas: p ? [p] : [] })} registrar={setRegistrar} />}</Aguardar>}
        {aba === 'lista' && <NotasFinanceiro embutido />}
        {aba === 'disparos' && <HistoricoDisparos comp={comp} />}
        {aba !== 'lista' && <DetalheNota id={f.valores.nota} fechar={() => f.definir('nota', '')} mudou={() => r.recarregar()} />}
        {mover && <MoverModal {...mover} segregacao={!!r.dados?.segregacao} fechar={() => setMover(null)} feito={() => { setMover(null); r.recarregar() }} />}
        {disparo && <DisparoModal comp={comp} pessoas={disparo.pessoas} fechar={() => setDisparo(null)} feito={() => { setDisparo(null); r.recarregar() }} />}
        {auto && <AutomaticoModal comp={comp} fechar={() => setAuto(false)} />}
        {registrar && <RegistrarNotaModal cartao={registrar} comp={comp} fechar={() => setRegistrar(null)} feito={() => { setRegistrar(null); r.recarregar() }} />}
      </SoComBanco>
    </>
  )
}

/** Arrasto por ponteiro (mouse, trackpad e toque): o cartão segue o ponteiro e a coluna sob ele recebe a nota.
 *  No toque, o arrasto começa com um toque longo: deslizar o dedo continua rolando a página e o quadro normalmente. */
interface Arrasto { c: Cartao; x: number; y: number; dx: number; dy: number; largura: number; ativo: boolean }
const LIMIAR = 6 // px antes de virar arrasto (um clique continua sendo clique)
const TOQUE_LONGO = 380 // ms parado antes de o cartão "descolar" no toque
/** Enquanto um arrasto por toque está ativo, o dedo não rola a página (ver o touchmove não passivo no cartão). */
let arrastoPorToque = false
const podeArrastar = (c: Cartao, caps: Quadro['capacidades']) =>
  c.tipo === 'esperada' ? caps.registrar : caps.mover && DESTINOS[c.coluna].length > 0

function Quadro({ d, busca, abrir, mover, cobrar, registrar }: {
  d: Quadro; busca: string; abrir: (id: string) => void; mover: (c: Cartao, destino: Coluna) => void; cobrar: (pessoaId: string | null) => void; registrar: (c: Cartao) => void
}) {
  const [arr, setArr] = useState<Arrasto | null>(null)
  const [sobre, setSobre] = useState<Coluna | null>(null)
  const ref = useRef<Arrasto | null>(null)
  const termo = busca.trim().toLowerCase()
  const visiveis = useMemo(() => d.cartoes.filter((c) => !termo || [c.pessoaNome, c.fornecedorNome, c.contratoNumero, c.numero].some((x) => x?.toLowerCase().includes(termo))), [d.cartoes, termo])

  const rolagem = useRef<HTMLDivElement>(null)
  const colunaEm = (x: number, y: number): Coluna | null => (document.elementFromPoint(x, y)?.closest('[data-coluna]')?.getAttribute('data-coluna') as Coluna | null) ?? null
  const iniciar = (e: ReactPointerEvent<HTMLElement>, c: Cartao) => {
    if (e.button !== 0 || !podeArrastar(c, d.capacidades) || (e.target as HTMLElement).closest('button,a,select,input')) return
    const box = e.currentTarget.getBoundingClientRect()
    ref.current = { c, x: e.clientX, y: e.clientY, dx: e.clientX - box.left, dy: e.clientY - box.top, largura: box.width, ativo: false }
    const inicio = { x: e.clientX, y: e.clientY }
    const toque = e.pointerType !== 'mouse'
    // Toque: só vira arrasto se o dedo ficar parado TOQUE_LONGO ms; antes disso, mexer o dedo é rolagem.
    const espera = toque ? setTimeout(() => {
      const a = ref.current
      if (!a) return
      arrastoPorToque = true
      navigator.vibrate?.(12)
      ref.current = { ...a, ativo: true }
      setArr(ref.current)
      setSobre(colunaEm(a.x, a.y))
    }, TOQUE_LONGO) : undefined
    const mov = (ev: PointerEvent) => {
      const a = ref.current
      if (!a) return
      if (!a.ativo) {
        if (Math.hypot(ev.clientX - inicio.x, ev.clientY - inicio.y) < LIMIAR) return
        if (toque) { fim(ev); return } // mexeu antes do toque longo: é rolagem
      }
      ev.preventDefault()
      ref.current = { ...a, x: ev.clientX, y: ev.clientY, ativo: true }
      setArr(ref.current)
      setSobre(colunaEm(ev.clientX, ev.clientY))
      // Perto das bordas, o quadro rola sozinho (no celular as outras colunas ficam fora da tela).
      const r = rolagem.current
      if (r) { const b = r.getBoundingClientRect(); if (ev.clientX < b.left + 40) r.scrollLeft -= 14; else if (ev.clientX > b.right - 40) r.scrollLeft += 14 }
    }
    const fim = (ev: PointerEvent) => {
      clearTimeout(espera)
      arrastoPorToque = false
      window.removeEventListener('pointermove', mov)
      window.removeEventListener('pointerup', fim)
      window.removeEventListener('pointercancel', fim)
      const a = ref.current
      ref.current = null
      setArr(null); setSobre(null)
      if (a?.ativo && ev.type === 'pointerup') { const col = colunaEm(ev.clientX, ev.clientY); if (col && col !== a.c.coluna) mover(a.c, col) }
    }
    window.addEventListener('pointermove', mov, { passive: false })
    window.addEventListener('pointerup', fim)
    window.addEventListener('pointercancel', fim)
  }

  return (
    // Celular: uma coluna por tela (com a próxima aparecendo) e encaixe ao rolar. A partir de md: as 5 colunas lado a lado, como antes.
    <div ref={rolagem} className={cn('overflow-x-auto overscroll-x-contain -mx-4 px-4 scroll-px-4 sm:mx-0 sm:px-0 sm:scroll-px-0 pb-2', arr ? 'select-none cursor-grabbing' : 'snap-x snap-mandatory md:snap-none')}>
      <div className="grid grid-flow-col auto-cols-[minmax(250px,84%)] sm:auto-cols-[minmax(260px,46%)] md:grid-flow-row md:auto-cols-auto md:grid-cols-5 gap-3 md:min-w-[1100px]">
        {COLUNAS.map((col) => {
          const cs = visiveis.filter((c) => c.coluna === col.chave)
          const alvoValido = !!arr && DESTINOS[arr.c.coluna].includes(col.chave)
          return (
            <section key={col.chave} aria-label={col.titulo} data-coluna={col.chave}
              className={cn('snap-start rounded-2xl bg-surface-2 border border-line border-t-4 flex flex-col min-h-[320px] transition', col.tom,
                alvoValido && 'ring-2 ring-brand/30', alvoValido && sobre === col.chave && 'ring-brand bg-brand-50', arr && !alvoValido && arr.c.coluna !== col.chave && 'opacity-60')}>
              <header className="px-3.5 pt-3 pb-2">
                <div className="flex items-center justify-between gap-2">
                  <h2 className="text-[13.5px] font-bold text-ink flex items-center gap-1.5"><Icon name={col.icone} className="h-4 w-4 text-muted" />{col.titulo}</h2>
                  <Badge>{d.totais[col.chave].quantidade}</Badge>
                </div>
                <p className="text-[11.5px] text-muted mt-0.5">{col.desc}</p>
                <p className="text-[12px] font-semibold text-ink-2 tabular-nums mt-1">{dinheiro(d.totais[col.chave].valor)}</p>
              </header>
              <div className="flex-1 px-2.5 pb-3 space-y-2">
                {cs.length === 0 && <p className={cn('text-[12px] text-muted text-center py-6 rounded-xl', alvoValido && 'border-2 border-dashed border-brand/40')}>{alvoValido ? 'Solte aqui' : 'Nada aqui.'}</p>}
                {cs.map((c) => <CartaoNota key={c.id} c={c} caps={d.capacidades} abrir={abrir} mover={mover} cobrar={cobrar} registrar={registrar}
                  arrastando={arr?.c.id === c.id} onPointerDown={(e) => iniciar(e, c)} />)}
              </div>
            </section>
          )
        })}
      </div>
      {arr && (
        <div className="fixed z-[300] pointer-events-none rotate-2 opacity-95 shadow-lg rounded-xl" style={{ left: arr.x - arr.dx, top: arr.y - arr.dy, width: arr.largura }}>
          <CartaoNota c={arr.c} caps={d.capacidades} abrir={() => undefined} mover={() => undefined} cobrar={() => undefined} registrar={() => undefined} fantasma />
        </div>
      )}
    </div>
  )
}

function CartaoNota({ c, caps, abrir, mover, cobrar, registrar, onPointerDown, arrastando, fantasma }: {
  c: Cartao; caps: Quadro['capacidades']; abrir: (id: string) => void; mover: (c: Cartao, destino: Coluna) => void; cobrar: (p: string | null) => void; registrar: (c: Cartao) => void
  onPointerDown?: (e: ReactPointerEvent<HTMLElement>) => void; arrastando?: boolean; fantasma?: boolean
}) {
  const destinos = DESTINOS[c.coluna].filter((x) => c.tipo === 'nota' || x === 'recebida')
  const arrastavel = podeArrastar(c, caps)
  // touchmove não passivo (o do React é passivo): durante o arrasto por toque, o dedo move o cartão em vez de rolar.
  const el = useRef<HTMLElement>(null)
  useEffect(() => {
    const a = el.current
    if (!a || !arrastavel || fantasma) return
    const mover = (e: TouchEvent) => { if (arrastoPorToque) e.preventDefault() }
    a.addEventListener('touchmove', mover, { passive: false })
    return () => a.removeEventListener('touchmove', mover)
  }, [arrastavel, fantasma])
  return (
    <article ref={el} onPointerDown={onPointerDown} title={arrastavel && !fantasma ? 'Arraste para outra coluna' : undefined}
      onContextMenu={arrastavel ? (e) => { if (arrastoPorToque || e.nativeEvent instanceof PointerEvent && e.nativeEvent.pointerType === 'touch') e.preventDefault() } : undefined}
      className={cn('bg-surface rounded-xl border border-line p-3 shadow-xs text-[12.5px] [-webkit-touch-callout:none]', arrastavel && 'cursor-grab hover:border-brand hover:shadow-sm', arrastando && 'opacity-30', fantasma && 'border-brand')}>
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="font-semibold text-ink truncate">{c.pessoaNome ?? 'Sem responsável'}</p>
          <p className="text-[11.5px] text-muted truncate">{c.fornecedorNome}</p>
        </div>
        {c.tipo === 'nota'
          ? <button type="button" className="text-[11.5px] font-semibold text-brand hover:underline shrink-0" onClick={() => abrir(c.id)}>NF {c.numero}</button>
          : c.contratoId && <Link className="text-[11.5px] text-muted hover:text-brand shrink-0" to={`/financeiro/contratos/${c.contratoId}`}>{c.contratoNumero}</Link>}
      </div>
      <div className="flex items-center justify-between gap-2 mt-2">
        <span className="font-semibold tabular-nums text-ink-2">{c.tipo === 'esperada' && !c.valor ? <span className="font-normal text-muted">valor a definir</span> : dinheiro(c.coluna === 'paga' ? c.liquido : c.valor)}{c.coluna === 'paga' && <span className="font-normal text-muted"> líquido</span>}</span>
        {c.tipo === 'nota' && c.contratoNumero && <span className="text-[11px] text-muted truncate">{c.contratoNumero}</span>}
      </div>
      <div className="flex flex-wrap gap-1 mt-2">
        {c.coluna === 'aguardando' && (c.cobrancas ? <Badge tone="warning">{c.cobrancas} cobrança(s) · {haQuanto(c.ultimaCobranca)}</Badge> : <Badge>Ainda não cobrado</Badge>)}
        {c.coluna === 'recebida' && <Badge tone={c.status === 'conferida' ? 'brand' : 'warning'}>{c.status === 'conferida' ? 'Conferida, falta aceite' : 'A conferir'}</Badge>}
        {!!c.divergencias && ['recebida'].includes(c.coluna) && <Badge tone="warning">{c.divergencias} divergência(s)</Badge>}
        {c.coluna === 'aprovada' && <Badge tone={c.contaStatus === 'autorizada' ? 'brand' : 'neutral'}>{c.contaStatus === 'autorizada' ? 'Pagamento autorizado' : 'Aguarda autorização'}</Badge>}
        {c.coluna === 'aprovada' && c.vencimento && <Badge>vence {dataBR(c.vencimento)}</Badge>}
        {c.coluna === 'paga' && c.pagoEm && <Badge tone="success">pago em {dataBR(c.pagoEm)}</Badge>}
        {!!c.reenvios && <Badge>{c.reenvios} reenvio(s)</Badge>}
      </div>
      {c.coluna === 'recusada' && c.motivoDevolucao && <p className="text-[11.5px] text-danger mt-2 line-clamp-2">{c.motivoDevolucao}</p>}
      {c.tipo === 'esperada' && (caps.disparar || caps.registrar) && (
        <div className="flex gap-1.5 mt-2.5">
          {caps.disparar && <Button size="sm" variant="soft" icon="Send" className="flex-1" onClick={() => cobrar(c.pessoaId)}>Cobrar</Button>}
          {caps.registrar && <Button size="sm" variant="ghost" icon="FilePlus2" className="flex-1" onClick={() => registrar(c)}>Recebi</Button>}
        </div>
      )}
      {arrastavel && !fantasma && c.tipo === 'nota' && (
        <select aria-label={`Mover a NF ${c.numero}`} className="input h-8 text-[12px] mt-2.5 w-full" value="" onChange={(e) => e.target.value && mover(c, e.target.value as Coluna)}>
          <option value="">Mover para…</option>
          {destinos.map((d) => <option key={d} value={d}>{COLUNAS.find((x) => x.chave === d)!.titulo}</option>)}
        </select>
      )}
    </article>
  )
}

/* ---------- mover ---------- */
function MoverModal({ cartao: c, destino, segregacao, fechar, feito }: { cartao: Cartao; destino: Coluna; segregacao: boolean; fechar: () => void; feito: () => void }) {
  const [motivo, setMotivo] = useState('')
  const [justificativa, setJustificativa] = useState('')
  const [data, setData] = useState(new Date().toISOString().slice(0, 10))
  const [forma, setForma] = useState('pix')
  const [referencia, setReferencia] = useState('')
  const [comprovante, setComprovante] = useState<{ nome: string; base64: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const precisaJust = !!c.divergencias && c.coluna === 'recebida' && destino !== 'recusada'
  const valido = destino === 'recusada' ? motivo.trim().length >= 5
    : (!precisaJust || justificativa.trim().length >= 10) && (destino !== 'paga' || (!!data && (!!referencia.trim() || !!comprovante)))
  const titulo = destino === 'recusada' ? 'Recusar nota fiscal' : destino === 'aprovada' ? 'Aprovar nota fiscal' : 'Marcar como paga'
  const enviar = async () => {
    setEnviando(true)
    const corpo = { destino, motivo: motivo.trim() || undefined, justificativa: justificativa.trim() || undefined, pagamento: destino === 'paga' ? { dataPagamento: data, forma, referencia: referencia.trim() || undefined, comprovante: comprovante ?? undefined } : undefined }
    const ok = await executar(() => api.post(`financeiro/notas/${c.id}/mover`, corpo),
      destino === 'recusada' ? 'Nota recusada. A pessoa foi avisada no portal para corrigir e reenviar.' : destino === 'aprovada' ? 'Nota aprovada. A conta a pagar foi criada.' : 'Pagamento registrado. A pessoa foi avisada no portal.')
    setEnviando(false)
    if (ok) feito()
  }
  return (
    <Modal open onClose={fechar} title={titulo} subtitle={`NF ${c.numero} · ${c.pessoaNome ?? c.fornecedorNome} · ${dinheiro(c.valor)}`}
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button variant={destino === 'recusada' ? 'danger' : 'primary'} disabled={!valido || enviando} onClick={enviar}>{enviando ? 'Salvando…' : titulo}</Button></>}>
      <div className="space-y-4">
        {destino === 'recusada' && <Field label="O que precisa ser corrigido" required hint="A pessoa recebe esse motivo e reenvia a nota corrigida." htmlFor="mv-motivo">
          <textarea id="mv-motivo" className="input h-28 py-2.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>}
        {destino !== 'recusada' && c.coluna === 'recebida' && <p className="text-[13px] text-ink-2">A nota será conferida e o serviço aceito em seu nome. Isso cria a conta a pagar{destino === 'paga' ? ', que em seguida é autorizada e paga' : ''}.</p>}
        {precisaJust && <Field label="Justificativa das divergências" required hint="A nota tem divergências com o contrato. Mínimo de 10 caracteres; fica no histórico." htmlFor="mv-just">
          <textarea id="mv-just" className="input h-24 py-2.5" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></Field>}
        {destino === 'paga' && <>
          {segregacao && <Callout tone="neutral" icon="ShieldCheck">Segregação de funções ligada: se foi você quem aprovou o serviço, outra pessoa precisa autorizar o pagamento.</Callout>}
          <p className="text-[13px] text-ink-2">Registre o pagamento feito no banco. O valor é o líquido (bruto menos retenções) e as retenções aplicadas por regra são marcadas como revisadas por você.</p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Field label="Data do pagamento" required htmlFor="mv-data"><input id="mv-data" type="date" className="input" value={data} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setData(e.target.value)} /></Field>
            <Field label="Forma" htmlFor="mv-forma"><select id="mv-forma" className="input" value={forma} onChange={(e) => setForma(e.target.value)}>{FORMAS_PAGAMENTO.map((x) => <option key={x} value={x}>{ROTULO_FORMA[x]}</option>)}</select></Field>
          </div>
          <Field label="Referência da transação" hint="ID do PIX, número do TED etc. Informe a referência ou anexe o comprovante." htmlFor="mv-ref"><input id="mv-ref" className="input" value={referencia} onChange={(e) => setReferencia(e.target.value)} /></Field>
          <CampoArquivo id="mv-comp" rotulo="Comprovante" valor={comprovante} onChange={setComprovante} />
        </>}
      </div>
    </Modal>
  )
}

/* ---------- registrar nota recebida por outro canal ---------- */
function RegistrarNotaModal({ cartao: c, comp, fechar, feito }: { cartao: Cartao; comp: string; fechar: () => void; feito: () => void }) {
  const [v, setV] = useState({ numero: '', valorBruto: c.valor ? String(c.valor) : '' })
  const [arquivo, setArquivo] = useState<{ nome: string; base64: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const enviar = async () => {
    setEnviando(true)
    const ok = await executar(() => api.post('financeiro/notas', { contratoId: c.contratoId, competencia: comp, ...v, valorBruto: Number(v.valorBruto.replace(',', '.')), arquivo: arquivo ?? undefined }), 'Nota registrada como recebida.')
    setEnviando(false)
    if (ok) feito()
  }
  return (
    <Modal open onClose={fechar} title="Registrar nota recebida" subtitle={`${c.pessoaNome ?? c.fornecedorNome} · ${c.contratoNumero} · ${competenciaBR(comp)}`}
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button disabled={enviando || !v.numero.trim() || !Number(v.valorBruto.replace(',', '.'))} onClick={enviar}>{enviando ? 'Enviando…' : 'Registrar'}</Button></>}>
      <p className="text-[13px] text-ink-2 mb-3">Use quando a nota chegou por outro canal (e-mail, WhatsApp). Ela entra em "Recebida" para conferência, com a data de hoje. O arquivo é opcional.</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="Número da NF" required htmlFor="rn-num"><input id="rn-num" className="input" value={v.numero} onChange={(e) => setV({ ...v, numero: e.target.value })} /></Field>
        <Field label="Valor bruto (R$)" required htmlFor="rn-val"><input id="rn-val" inputMode="decimal" className="input" value={v.valorBruto} onChange={(e) => setV({ ...v, valorBruto: e.target.value })} /></Field>
      </div>
      <div className="mt-3"><CampoArquivo id="rn-arq" rotulo="Arquivo da nota (opcional)" valor={arquivo} onChange={setArquivo} /></div>
    </Modal>
  )
}

/* ---------- disparo manual ---------- */
const VARIAVEIS = '{{nome}}, {{competencia}}, {{prazo}} e {{contratos}}'
function DisparoModal({ comp, pessoas: iniciais, fechar, feito }: { comp: string; pessoas?: string[]; fechar: () => void; feito: () => void }) {
  const p = useApi<Previa>(`financeiro/disparos/previa?competencia=${comp}`)
  const [publico, setPublico] = useState(iniciais?.length ? 'selecionados' : 'pendentes_e_devolvidas')
  const [sel, setSel] = useState<string[]>(iniciais ?? [])
  const [texto, setTexto] = useState<{ assunto: string; mensagem: string } | null>(null)
  const [enviando, setEnviando] = useState(false)
  const d = p.dados
  const t = texto ?? d?.modelo
  const qtd = !d ? 0 : publico === 'selecionados' ? sel.length : d.contagem[publico] ?? 0
  const enviar = async () => {
    if (!t) return
    setEnviando(true)
    const r = await executar(() => api.post<{ destinatarios: number }>('financeiro/disparos', { competencia: comp, publico, pessoas: sel, ...t }))
    setEnviando(false)
    if (!r) return
    toast(`Cobrança enviada no portal para ${r.destinatarios} pessoa(s).`)
    feito()
  }
  return (
    <Modal open wide onClose={fechar} title="Cobrar notas fiscais" subtitle={`Competência ${competenciaBR(comp)}${d ? ` · prazo ${dataBR(d.prazo)}` : ''}`}
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button icon="Send" disabled={enviando || !qtd || !t || t.assunto.trim().length < 3 || t.mensagem.trim().length < 10} onClick={enviar}>{enviando ? 'Enviando…' : `Enviar para ${qtd} pessoa(s)`}</Button></>}>
      <Aguardar r={p}>{(d) => (
        <div className="space-y-4">
          <Select label="Para quem" value={publico} onChange={setPublico}>
            <option value="pendentes_e_devolvidas">Não enviou ou teve a nota recusada ({d.contagem.pendentes_e_devolvidas})</option>
            <option value="pendentes">Quem ainda não enviou ({d.contagem.pendentes})</option>
            <option value="devolvidas">Nota recusada sem reenvio ({d.contagem.devolvidas})</option>
            <option value="todos">Todos com contrato mensal ({d.contagem.todos})</option>
            <option value="selecionados">Escolher pessoas</option>
          </Select>
          {publico === 'selecionados' && (
            <div className="border border-line rounded-xl max-h-56 overflow-y-auto divide-y divide-line">
              {d.pessoas.length === 0 && <p className="text-[12.5px] text-muted p-3">Ninguém com contrato mensal nesta competência.</p>}
              {d.pessoas.map((x) => (
                <label key={x.pessoaId} className="flex items-center gap-3 px-3 py-2 text-[13px] cursor-pointer hover:bg-surface-2">
                  <input type="checkbox" checked={sel.includes(x.pessoaId)} onChange={(e) => setSel(e.target.checked ? [...sel, x.pessoaId] : sel.filter((s) => s !== x.pessoaId))} />
                  <span className="flex-1 min-w-0 truncate">{x.nome}<span className="text-muted"> · {x.contratos.join(', ')}</span></span>
                  {x.devolvida ? <Badge tone="danger">Recusada</Badge> : x.pendente ? <Badge tone="warning">Não enviou</Badge> : <Badge tone="success">Enviou</Badge>}
                </label>
              ))}
            </div>
          )}
          <p className="text-[12.5px] text-muted">A cobrança chega como notificação no portal (sino e página de notificações) e leva a pessoa direto para Notas fiscais.</p>
          <Field label="Assunto" required htmlFor="dp-assunto"><input id="dp-assunto" className="input" value={t?.assunto ?? ''} onChange={(e) => setTexto({ assunto: e.target.value, mensagem: t?.mensagem ?? '' })} /></Field>
          <Field label="Mensagem" required hint={`Variáveis: ${VARIAVEIS}.`} htmlFor="dp-msg"><textarea id="dp-msg" className="input h-40 py-2.5" value={t?.mensagem ?? ''} onChange={(e) => setTexto({ assunto: t?.assunto ?? '', mensagem: e.target.value })} /></Field>
        </div>
      )}</Aguardar>
    </Modal>
  )
}

/* ---------- regra automática ---------- */
function AutomaticoModal({ comp, fechar }: { comp: string; fechar: () => void }) {
  const p = useApi<Previa>(`financeiro/disparos/previa?competencia=${comp}`)
  const [v, setV] = useState<(Previa['automatico'] & { diasTexto: string }) | null>(null)
  const [salvando, setSalvando] = useState(false)
  const atual = v ?? (p.dados ? { ...p.dados.automatico, diasTexto: p.dados.automatico.dias.join(', ') } : null)
  const dias = (atual?.diasTexto ?? '').split(/[,;\s]+/).filter(Boolean).map(Number)
  const diasOk = dias.every((x) => Number.isInteger(x) && x >= -20 && x <= 15)
  const descreve = (x: number) => (x === 0 ? 'no dia do prazo' : x < 0 ? `${-x} dia(s) antes` : `${x} dia(s) depois`)
  const salvar = async () => {
    if (!atual) return
    setSalvando(true)
    const ok = await executar(() => api.put('financeiro/disparos-automaticos', { ...atual, dias }), 'Disparos automáticos salvos.')
    setSalvando(false)
    if (ok) fechar()
  }
  return (
    <Modal open wide onClose={fechar} title="Disparos automáticos" subtitle="O sistema cobra sozinho quem ainda não enviou a nota, todo mês."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button disabled={salvando || !atual || !diasOk || (atual.ativo && !dias.length)} onClick={salvar}>{salvando ? 'Salvando…' : 'Salvar'}</Button></>}>
      <Aguardar r={p}>{(d) => atual && (
        <div className="space-y-4">
          <Toggle checked={atual.ativo} onChange={(x) => setV({ ...atual, ativo: x })} label="Cobrar automaticamente" />
          <Field label="Quando cobrar (dias em relação ao prazo)" hint={`Negativo = antes, 0 = no dia, positivo = depois. Ex.: -5, -1, 0, 3. Prazo atual: dia ${d.prazo.slice(8)} de cada mês.`} erro={diasOk ? undefined : 'Use números entre -20 e 15.'} htmlFor="au-dias">
            <input id="au-dias" className="input" value={atual.diasTexto} onChange={(e) => setV({ ...atual, diasTexto: e.target.value })} />
          </Field>
          {diasOk && dias.length > 0 && <p className="text-[12.5px] text-muted -mt-2">Cobra {dias.sort((a, b) => a - b).map(descreve).join(', ')}.</p>}
          <Toggle checked={atual.incluirDevolvidas} onChange={(x) => setV({ ...atual, incluirDevolvidas: x })} label="Cobrar quem teve a nota recusada" />
          <Field label="Assunto" required htmlFor="au-assunto"><input id="au-assunto" className="input" value={atual.assunto} onChange={(e) => setV({ ...atual, assunto: e.target.value })} /></Field>
          <Field label="Mensagem" required hint={`Variáveis: ${VARIAVEIS}.`} htmlFor="au-msg"><textarea id="au-msg" className="input h-40 py-2.5" value={atual.mensagem} onChange={(e) => setV({ ...atual, mensagem: e.target.value })} /></Field>
          <p className="text-[12px] text-muted">Roda pelo agendador diário e chega como notificação no portal. Cada lembrete sai uma única vez por competência e fica no histórico de disparos.</p>
        </div>
      )}</Aguardar>
    </Modal>
  )
}

/* ---------- histórico ---------- */
interface DisparoLinha { id: string; competencia: string; rotuloPublico: string; assunto: string; destinatarios: number; automatico: boolean; criadoPor: string | null; criadoEm: string }
function HistoricoDisparos({ comp }: { comp: string }) {
  const r = useApi<{ itens: DisparoLinha[] }>(`financeiro/disparos?competencia=${comp}`)
  const [aberto, setAberto] = useState('')
  const det = useApi<{ disparo: DisparoLinha & { mensagem: string }; envios: { pessoaId: string; nome: string | null; contratos: string[]; lida: boolean }[] }>(aberto ? `financeiro/disparos/${aberto}` : null)
  return (
    <>
      <Aguardar r={r} vazio={(d) => d.itens.length ? null : <Card><EmptyState icon="Send" title="Nenhuma cobrança nesta competência" desc="Use “Cobrar notas” ou ligue os disparos automáticos." /></Card>}>
        {(d) => <Card className="overflow-hidden"><Tabela minWidth={760}>
          <thead><tr><th className={TH}>Quando</th><th className={TH}>Assunto</th><th className={TH}>Público</th><th className={TH}>Pessoas</th><th className={TH}>Por</th></tr></thead>
          <tbody>{d.itens.map((x) => (
            <tr key={x.id} className="hover:bg-surface-2 cursor-pointer" onClick={() => setAberto(x.id)}>
              <td className={TD}>{dataHoraBR(x.criadoEm)}</td>
              <td className={TD}><button type="button" className="font-semibold text-left hover:text-brand" onClick={(e) => { e.stopPropagation(); setAberto(x.id) }}>{x.assunto}</button></td>
              <td className={TD}>{x.rotuloPublico}</td>
              <td className={`${TD} tabular-nums`}>{x.destinatarios}</td>
              <td className={TD}>{x.automatico ? <Badge tone="brand">Automático</Badge> : x.criadoPor}</td>
            </tr>
          ))}</tbody>
        </Tabela></Card>}
      </Aguardar>
      <Drawer open={!!aberto} onClose={() => setAberto('')} titulo={det.dados?.disparo.assunto ?? 'Disparo'} subtitulo={det.dados && `${det.dados.disparo.rotuloPublico} · ${dataHoraBR(det.dados.disparo.criadoEm)}`}>
        {det.dados && <div className="space-y-4">
          <pre className="whitespace-pre-wrap text-[12.5px] bg-surface-2 rounded-xl p-3 font-sans">{det.dados.disparo.mensagem}</pre>
          <ul className="divide-y divide-line">{det.dados.envios.map((e) => (
            <li key={e.pessoaId} className="py-2 flex items-center justify-between gap-3 text-[13px]">
              <span className="min-w-0"><b>{e.nome}</b><span className="block text-[11.5px] text-muted truncate">{e.contratos.join(', ')}</span></span>
              {e.lida ? <Badge tone="success">Lida</Badge> : <Badge>Não lida</Badge>}
            </li>
          ))}</ul>
        </div>}
      </Drawer>
    </>
  )
}
