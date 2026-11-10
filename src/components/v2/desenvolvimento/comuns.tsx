/* Componentes do Ciclo de Desenvolvimento e AVD (telas em src/pages/v2/desenvolvimento). */
import { useState, type ReactNode } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Icon } from '@/components/ui'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { api, executar } from '@/data/v2/api'
import { dataBR } from '@/lib/fmt'
import { cn } from '@/lib/utils'
import {
  RESPONSAVEL_ACAO, STATUS_ACAO, STATUS_DSV, acaoAtrasada,
  type NivelEscala, type Nota, type Respostas, type RetratoModelo, type StatusAcao, type StatusExibido,
} from '@/domain/v2/desenvolvimento'

/** Status do ciclo + selo de atraso. */
export function StatusCiclo({ status, atrasado }: { status: StatusExibido | 'programada'; atrasado?: boolean }) {
  return (
    <span className="inline-flex flex-wrap gap-1.5">
      <StatusBadge mapa={STATUS_DSV} valor={status} />
      {atrasado && <Badge tone="danger" dot>Em atraso</Badge>}
    </span>
  )
}

/** Escolha de nível com o significado de cada nota sempre à vista (ninguém escolhe um número sem saber o que ele quer dizer). */
export function EscalaNiveis({ nome, escala, naRotulo, valor, onChange, desabilitado }: {
  nome: string; escala: NivelEscala[]; naRotulo: string; valor: Nota | undefined; onChange: (v: Nota) => void; desabilitado?: boolean
}) {
  const opcoes: { v: Nota; rotulo: string; desc?: string }[] = [...escala.map((n) => ({ v: n.valor as Nota, rotulo: n.rotulo, desc: n.descricao })), { v: 'na', rotulo: naRotulo }]
  return (
    <div role="radiogroup" aria-label={nome} className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
      {opcoes.map((o) => {
        const ativo = valor === o.v
        return (
          <button key={String(o.v)} type="button" role="radio" aria-checked={ativo} disabled={desabilitado} onClick={() => onChange(o.v)} title={o.desc}
            className={cn('rounded-xl border px-3 py-2.5 text-left transition outline-none focus-visible:ring-2 focus-visible:ring-brand disabled:opacity-60',
              ativo ? 'border-brand bg-brand-50 text-brand-700 shadow-sm' : 'border-line bg-surface hover:border-brand/60 text-ink-2')}>
            <div className="flex items-center gap-1.5">
              <span className={cn('h-6 min-w-6 px-1.5 rounded-lg text-[12px] font-bold flex items-center justify-center', ativo ? 'bg-brand text-white' : 'bg-winter text-ink')}>{o.v === 'na' ? 'N/A' : o.v}</span>
              <span className="text-[12.5px] font-semibold leading-tight">{o.rotulo}</span>
            </div>
            {o.desc && <p className="text-[11px] text-muted mt-1.5 leading-snug hidden sm:block">{o.desc}</p>}
          </button>
        )
      })}
    </div>
  )
}

/** Respostas enviadas, somente leitura. */
export function ResumoRespostas({ modelo, respostas, escala, naRotulo }: { modelo: RetratoModelo; respostas: Respostas; escala: NivelEscala[]; naRotulo: string }) {
  const rot = (n: Nota | undefined) => (n === undefined ? 'Sem resposta' : n === 'na' ? naRotulo : `${n} · ${escala.find((e) => e.valor === n)?.rotulo ?? ''}`)
  return (
    <div className="space-y-4">
      {modelo.criterios.length > 0 && (
        <ul className="divide-y divide-line rounded-xl border border-line">
          {modelo.criterios.map((k) => (
            <li key={k.id} className="px-4 py-2.5">
              <div className="flex items-start justify-between gap-3 flex-wrap">
                <span className="text-[13px] text-ink font-medium">{k.nome}</span>
                <Badge tone={respostas.notas[k.id] === 'na' || respostas.notas[k.id] === undefined ? 'neutral' : 'brand'}>{rot(respostas.notas[k.id])}</Badge>
              </div>
              {respostas.justificativas[k.id] && <p className="text-[12.5px] text-ink-2 mt-1.5 whitespace-pre-line">“{respostas.justificativas[k.id]}”</p>}
            </li>
          ))}
        </ul>
      )}
      {modelo.perguntas.map((p) => (
        <div key={p.id}>
          <div className="text-[12.5px] font-semibold text-ink">{p.texto}</div>
          <p className="text-[13px] text-ink-2 mt-1 whitespace-pre-line">{respostas.abertas[p.id] || <span className="text-muted">Sem resposta</span>}</p>
        </div>
      ))}
    </div>
  )
}

/** Linha do tempo vertical. */
export interface ItemLinha { chave: string; data: string; titulo: ReactNode; desc?: ReactNode; icone: string; tom?: 'brand' | 'success' | 'warning' | 'danger' | 'neutral'; link?: string }
export function LinhaDoTempo({ itens, vazio = 'Nada registrado ainda.' }: { itens: ItemLinha[]; vazio?: string }) {
  if (!itens.length) return <p className="text-[13px] text-muted">{vazio}</p>
  const tons = { brand: 'bg-brand-100 text-brand', success: 'bg-success-soft text-success', warning: 'bg-warning-soft text-warning', danger: 'bg-danger-soft text-danger', neutral: 'bg-winter text-ink-2' }
  return (
    <ol className="relative">
      {itens.map((i, idx) => (
        <li key={i.chave} className="flex gap-3 pb-5 relative">
          {idx < itens.length - 1 && <span aria-hidden className="absolute left-[15px] top-8 bottom-0 w-px bg-line" />}
          <span className={cn('h-8 w-8 shrink-0 rounded-full flex items-center justify-center', tons[i.tom ?? 'neutral'])}><Icon name={i.icone} className="h-4 w-4" /></span>
          <div className="min-w-0 pt-0.5">
            <div className="text-[11.5px] text-muted font-semibold">{dataBR(i.data)}</div>
            <div className="text-[13.5px] font-semibold text-ink">{i.link ? <Link to={i.link} className="hover:text-brand">{i.titulo}</Link> : i.titulo}</div>
            {i.desc && <div className="text-[12.5px] text-ink-2 mt-0.5">{i.desc}</div>}
          </div>
        </li>
      ))}
    </ol>
  )
}

/** Barras agrupadas (escala 1–5) para a evolução entre avaliações. Acompanha uma tabela acessível. */
export interface SerieEvolucao { rotulo: string; valores: (number | null)[] }
export function BarrasEvolucao({ grupos, series, cores }: { grupos: string[]; series: SerieEvolucao[]; cores: string[] }) {
  if (!grupos.length) return <p className="text-[13px] text-muted">A evolução aparece a partir da primeira AVD com resultado visível para você.</p>
  return (
    <div>
      <div className="flex flex-wrap gap-3 mb-3 text-[12px]">
        {series.map((s, i) => <span key={s.rotulo} className="inline-flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-sm" style={{ background: cores[i] }} />{s.rotulo}</span>)}
      </div>
      <div className="flex items-end gap-4 sm:gap-6 h-44 border-b border-line px-1 overflow-x-auto" aria-hidden>
        {grupos.map((g, gi) => (
          <div key={g} className="flex flex-col items-center gap-1.5 min-w-[64px]">
            <div className="flex items-end gap-1 h-36">
              {series.map((s, si) => {
                const v = s.valores[gi]
                return (
                  <div key={s.rotulo} className="w-4 sm:w-5 flex flex-col items-center justify-end h-full">
                    {v !== null && <span className="text-[10px] font-bold text-ink-2 mb-0.5">{String(v).replace('.', ',')}</span>}
                    <div className="w-full rounded-t-md" style={{ height: v === null ? 2 : `${(v / 5) * 100}%`, background: v === null ? 'rgb(var(--c-line))' : cores[si] }} />
                  </div>
                )
              })}
            </div>
          </div>
        ))}
      </div>
      <div className="flex gap-4 sm:gap-6 px-1 overflow-x-auto" aria-hidden>{grupos.map((g) => <div key={g} className="min-w-[64px] text-center text-[11.5px] text-muted mt-1.5">{g}</div>)}</div>
      <table className="sr-only">
        <caption>Evolução das notas (1 a 5)</caption>
        <thead><tr><th>Avaliação</th>{series.map((s) => <th key={s.rotulo}>{s.rotulo}</th>)}</tr></thead>
        <tbody>{grupos.map((g, gi) => <tr key={g}><td>{g}</td>{series.map((s) => <td key={s.rotulo}>{s.valores[gi] ?? 'sem dado'}</td>)}</tr>)}</tbody>
      </table>
    </div>
  )
}

/** Barra horizontal de média (1–5). */
export function BarraMedia({ rotulo, media, n }: { rotulo: string; media: number | null; n?: number }) {
  return (
    <div className="py-1.5">
      <div className="flex justify-between gap-3 text-[12.5px] mb-1"><span className="text-ink">{rotulo}</span><span className="font-bold tabular-nums">{media === null ? '—' : String(media).replace('.', ',')}{n !== undefined && <span className="text-muted font-normal"> · {n}</span>}</span></div>
      <div className="h-2 rounded-full bg-winter overflow-hidden"><div className="h-full rounded-full bg-brand" style={{ width: `${media === null ? 0 : (media / 5) * 100}%` }} /></div>
    </div>
  )
}

/** Ações de desenvolvimento (PDI/acompanhamento) com atualização de andamento. */
export interface Acao { id: string; origem: string; competencia: string | null; descricao: string; responsavel: keyof typeof RESPONSAVEL_ACAO; prazo: string | null; indicador?: string | null; status: StatusAcao; resultado: string | null; concluida_em?: string | null }
export function ListaAcoes({ acoes, hoje, podeAtualizar, podeCancelar, onAtualizado, vazio = 'Nenhuma ação registrada.' }: {
  acoes: Acao[]; hoje: string; podeAtualizar: (a: Acao) => boolean; podeCancelar?: boolean; onAtualizado: () => void; vazio?: string
}) {
  const [editando, setEditando] = useState<string | null>(null)
  const [resultado, setResultado] = useState('')
  if (!acoes.length) return <p className="text-[13px] text-muted">{vazio}</p>
  async function mudar(a: Acao, status: StatusAcao, res?: string) {
    const ok = await executar(() => api.patch(`desenvolvimento/acoes/${a.id}`, { status, ...(res !== undefined ? { resultado: res } : {}) }), 'Ação atualizada.')
    if (ok) { setEditando(null); onAtualizado() }
  }
  return (
    <ul className="divide-y divide-line">
      {acoes.map((a) => {
        const atrasada = acaoAtrasada(a, hoje)
        return (
          <li key={a.id} className="py-3">
            <div className="flex items-start gap-3 flex-wrap">
              <div className="min-w-0 flex-1">
                <div className="text-[13.5px] font-semibold text-ink">{a.descricao}</div>
                <div className="text-[12px] text-muted mt-0.5">
                  {a.competencia && <>{a.competencia} · </>}{RESPONSAVEL_ACAO[a.responsavel]}{a.prazo && <> · prazo {dataBR(a.prazo)}</>}
                  {a.indicador && <> · indicador: {a.indicador}</>}
                </div>
                {a.resultado && <p className="text-[12.5px] text-ink-2 mt-1">Resultado: {a.resultado}</p>}
              </div>
              <span className="flex gap-1.5 flex-wrap"><StatusBadge mapa={STATUS_ACAO} valor={a.status} />{atrasada && <Badge tone="danger">Atrasada</Badge>}</span>
            </div>
            {podeAtualizar(a) && a.status !== 'cancelada' && (
              editando === a.id ? (
                <div className="mt-2.5 flex flex-col sm:flex-row gap-2">
                  <input className="input flex-1" aria-label="Resultado alcançado" placeholder="O que foi feito / resultado alcançado" value={resultado} onChange={(e) => setResultado(e.target.value)} />
                  <Button size="sm" icon="Check" onClick={() => mudar(a, 'concluida', resultado)}>Concluir</Button>
                  <Button size="sm" variant="ghost" onClick={() => setEditando(null)}>Voltar</Button>
                </div>
              ) : (
                <div className="mt-2 flex gap-2 flex-wrap">
                  {a.status === 'planejada' && <Button size="sm" variant="soft" icon="Play" onClick={() => mudar(a, 'em_andamento')}>Iniciar</Button>}
                  {a.status !== 'concluida' && <Button size="sm" variant="soft" icon="CheckCircle2" onClick={() => { setResultado(a.resultado ?? ''); setEditando(a.id) }}>Registrar conclusão</Button>}
                  {a.status === 'concluida' && <Button size="sm" variant="ghost" icon="RotateCcw" onClick={() => mudar(a, 'em_andamento')}>Reabrir</Button>}
                  {podeCancelar && a.status !== 'concluida' && <Button size="sm" variant="ghost" icon="X" onClick={() => mudar(a, 'cancelada')}>Cancelar ação</Button>}
                </div>
              )
            )}
          </li>
        )
      })}
    </ul>
  )
}

/** Quem vê cada formulário (transparência antes de responder). */
export const QUEM_VE: Record<string, string> = {
  acomp_colaborador: 'Suas respostas são vistas por você, pela sua liderança direta e pelo RH. Elas orientam a conversa de acompanhamento — não são uma nota nem uma classificação.',
  acomp_lideranca: 'Sua percepção é vista por você e pelo RH. A pessoa acompanhada vê o registro do acompanhamento que vocês combinarem na conversa.',
  autoavaliacao: 'Sua autoavaliação é vista por você, pelo RH e pela sua liderança direta — ela só tem acesso depois de enviar a avaliação dela, para não ser influenciada.',
  lider_avalia: 'Sua avaliação é vista por você e pelo RH. A pessoa avaliada tem acesso depois da devolutiva. Justifique com exemplos e situações concretas.',
}
