/* Peças compartilhadas das telas de gestão de prestadores PJ (financeiro). */
import { useCallback, useMemo, useState, type ReactNode } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Button, Field, Icon, quebraMoeda } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { api, lerBase64, useApi, type Remoto } from '@/data/v2/api'
import { toast } from '@/components/toast'
import {
  MAPA_STATUS_CONTA, MAPA_STATUS_CONTRATO, MAPA_STATUS_DOCUMENTO, MAPA_STATUS_NOTA,
} from '@/domain/v2/financeiro'
import { moeda } from '@/lib/fmt'
import { cn } from '@/lib/utils'

export const BadgeContrato = ({ valor }: { valor: string }) => <StatusBadge mapa={MAPA_STATUS_CONTRATO} valor={valor} />
export const BadgeNota = ({ valor }: { valor: string }) => <StatusBadge mapa={MAPA_STATUS_NOTA} valor={valor} />
export const BadgeConta = ({ valor }: { valor: string }) => <StatusBadge mapa={MAPA_STATUS_CONTA} valor={valor} />
export const BadgeDocumento = ({ valor }: { valor: string }) => <StatusBadge mapa={MAPA_STATUS_DOCUMENTO} valor={valor} />
export const dinheiro = (v: number | null | undefined) => (v === null || v === undefined ? '—' : moeda(v))
export const competenciaBR = (c?: string | null) => (c ? new Date(`${c}-01T00:00:00`).toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }) : '—')

export interface OpcoesFin {
  centros: { id: string; codigo: string; nome: string; setorId: string | null; ativo: boolean }[]
  fornecedores: { id: string; razaoSocial: string; documento: string | null; representanteId: string | null; status: string }[]
  pessoas: { id: string; nome: string; setorId: string }[]
  setores: { id: string; nome: string }[]
  config: { exigirSegregacao: boolean; diasAlertaContrato: number; diasAlertaPagamento: number; diasAlertaDocumento: number; diasAlertaAprovacao: number; diaLimiteEnvioNf: number; prazoPagamentoPadraoDias: number; atualizadoEm: string | null }
  capacidades: { ver: boolean; cadastrar: boolean; conferir: boolean; aprovar: boolean; pagar: boolean; autorizar: boolean; config: boolean }
}
export const useOpcoesFin = (): Remoto<OpcoesFin> => useApi<OpcoesFin>('financeiro/opcoes')

/** Filtros guardados na URL (permitem chegar aos registros por link a partir do painel). */
export function useFiltros(chaves: string[]) {
  const [sp, setSp] = useSearchParams()
  const valores = useMemo(() => Object.fromEntries(chaves.map((k) => [k, sp.get(k) ?? ''])) as Record<string, string>, [sp, chaves])
  const definir = useCallback((k: string, v: string) => setSp((a) => {
    const n = new URLSearchParams(a)
    if (v) n.set(k, v); else n.delete(k)
    if (k !== 'pagina') n.delete('pagina')
    return n
  }, { replace: true }), [setSp])
  const consulta = useMemo(() => {
    const u = new URLSearchParams()
    for (const [k, v] of Object.entries(valores)) if (v) u.set(k, v)
    const s = u.toString()
    return s ? `?${s}` : ''
  }, [valores])
  return { valores, definir, consulta }
}

/** Seletor de arquivo (PDF, PNG ou JPG até 3 MB) que entrega { nome, base64 } para a API. */
export function CampoArquivo({ rotulo, valor, onChange, obrigatorio, dica, id }: {
  rotulo: string; valor: { nome: string; base64: string } | null; onChange: (v: { nome: string; base64: string } | null) => void; obrigatorio?: boolean; dica?: string; id: string
}) {
  const [lendo, setLendo] = useState(false)
  return (
    <Field label={rotulo} required={obrigatorio} hint={dica ?? 'PDF, PNG ou JPG, até 3 MB. O conteúdo é verificado no servidor.'} htmlFor={id}>
      <label htmlFor={id} className={cn('flex items-center gap-3 border-2 border-dashed rounded-xl px-4 py-4 cursor-pointer transition focus-within:ring-2 focus-within:ring-brand',
        valor ? 'border-brand bg-brand-50' : 'border-line-strong hover:border-brand')}>
        <Icon name={valor ? 'FileCheck2' : 'UploadCloud'} className="h-6 w-6 text-brand shrink-0" />
        <span className="text-[13px] font-medium text-ink-2 truncate">{lendo ? 'Lendo arquivo…' : valor?.nome ?? 'Clique para escolher o arquivo'}</span>
        {valor && <button type="button" className="ml-auto text-[12px] text-muted hover:text-danger" onClick={(e) => { e.preventDefault(); onChange(null) }}>Remover</button>}
        <input id={id} type="file" accept="application/pdf,image/png,image/jpeg" className="sr-only" onChange={async (e) => {
          const f = e.target.files?.[0]
          e.target.value = ''
          if (!f) return
          if (f.size > 3 * 1024 * 1024) { toast('Arquivo maior que 3 MB.', 'danger'); return }
          setLendo(true)
          try { onChange(await lerBase64(f)) } catch { toast('Não foi possível ler o arquivo.', 'danger') } finally { setLendo(false) }
        }} />
      </label>
    </Field>
  )
}

/** Abre um arquivo privado (download autenticado) em nova aba. */
export function LinkArquivo({ rota, children = 'Abrir arquivo' }: { rota: string; children?: ReactNode }) {
  return (
    <a href={api.url(rota)} target="_blank" rel="noopener" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline">
      <Icon name="ExternalLink" className="h-3.5 w-3.5" />{children}
    </a>
  )
}

/** Pede um motivo antes de ações sensíveis (devolver, cancelar, suspender…). */
export function useMotivo() {
  const [pedido, setPedido] = useState<{ titulo: string; texto: string; confirmar: string; perigo?: boolean; resolver: (m: string | null) => void } | null>(null)
  const [motivo, setMotivo] = useState('')
  const pedir = (titulo: string, texto: string, confirmar = 'Confirmar', perigo = true) =>
    new Promise<string | null>((resolver) => { setMotivo(''); setPedido({ titulo, texto, confirmar, perigo, resolver }) })
  const fechar = (v: string | null) => { pedido?.resolver(v); setPedido(null) }
  const modal = (
    <Modal open={!!pedido} onClose={() => fechar(null)} title={pedido?.titulo}
      footer={<><Button variant="ghost" onClick={() => fechar(null)}>Cancelar</Button>
        <Button variant={pedido?.perigo ? 'danger' : 'primary'} disabled={motivo.trim().length < 5} onClick={() => fechar(motivo.trim())}>{pedido?.confirmar}</Button></>}>
      <p className="text-[13.5px] text-ink-2 mb-3">{pedido?.texto}</p>
      <Field label="Motivo" required hint="Mínimo de 5 caracteres. Fica registrado no histórico." htmlFor="motivo-acao">
        <textarea id="motivo-acao" className="input h-28 py-2.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} />
      </Field>
    </Modal>
  )
  return { pedir, modal }
}

export function Info({ rotulo, children, className }: { rotulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <dt className="text-[11.5px] font-semibold text-muted uppercase tracking-wide">{rotulo}</dt>
      <dd className="text-[13.5px] text-ink mt-0.5 break-words">{children ?? '—'}</dd>
    </div>
  )
}

/** Valor com explicação (fórmula) e link para os registros. */
export function Indicador({ titulo, valor, definicao, link, tom = 'neutral' }: { titulo: string; valor: ReactNode; definicao: string; link?: string; tom?: 'neutral' | 'warning' | 'danger' | 'success' }) {
  const corpo = (
    <div className={cn('card p-4 h-full transition', link && 'hover:border-brand')}>
      <div className="text-[12px] font-semibold text-muted">{titulo}</div>
      <div className={cn('text-[clamp(17px,5.2vw,22px)] sm:text-[22px] font-bold tabular-nums mt-1 leading-tight [overflow-wrap:anywhere]', tom === 'danger' ? 'text-danger' : tom === 'warning' ? 'text-warning' : tom === 'success' ? 'text-success' : 'text-ink')}>{quebraMoeda(valor)}</div>
      <p className="text-[11.5px] text-muted mt-1.5 leading-snug" title={definicao}>{definicao}</p>
    </div>
  )
  return link ? <Link to={link} className="block outline-none focus-visible:ring-2 focus-visible:ring-brand rounded-2xl">{corpo}</Link> : corpo
}

export const AVISO_INTEGRACOES = 'Sem integração bancária, com a prefeitura ou com a Receita: pagamentos são registros manuais com comprovante, e a conferência de notas é interna (não valida a nota junto ao órgão emissor).'
