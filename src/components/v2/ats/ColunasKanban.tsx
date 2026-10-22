import { useEffect, useState } from 'react'
import { Badge, Button, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Dropdown } from '@/components/Dropdown'
import { api, executar } from '@/data/v2/api'
import { CORES_ETAPA, HEX_COR_ETAPA, ROTULO_COR_ETAPA, ROTULO_ETAPA, TIPOS_ETAPA, validarEtapas, type CorEtapa, type TipoEtapa } from '@/domain/v2/vagas'
import { cn } from '@/lib/utils'

export interface ColunaEtapa { id?: string; nome: string; tipo: string; cor?: string | null; ativas?: number }

/** Cor de destaque da coluna (cinza quando não definida). */
export const hexColuna = (cor?: string | null) => HEX_COR_ETAPA[(cor as CorEtapa) ?? 'cinza'] ?? HEX_COR_ETAPA.cinza

/** Grava a lista completa de colunas da vaga. `realocar` leva as candidaturas de colunas excluídas para outra coluna. */
export function salvarColunas(vagaId: string, etapas: ColunaEtapa[], realocar: Record<string, string> = {}, ok = 'Colunas atualizadas.') {
  return executar(() => api.put(`ats/vagas/${vagaId}/etapas`, { etapas: etapas.map(({ id, nome, tipo, cor }) => ({ id, nome: nome.trim(), tipo, cor: cor || null })), realocar }), ok)
}

/** Insere uma coluna nova antes da de contratação (a última é sempre a de contratados). */
export function comColunaNova(etapas: ColunaEtapa[], nome: string, cor: string | null = null): ColunaEtapa[] {
  return [...etapas.slice(0, -1), { nome, tipo: 'generica', cor }, etapas[etapas.length - 1]]
}

export function SeletorCor({ valor, onChange, rotulo }: { valor: string | null | undefined; onChange: (c: CorEtapa) => void; rotulo: string }) {
  return (
    <div role="radiogroup" aria-label={rotulo} className="flex flex-wrap gap-1.5">
      {CORES_ETAPA.map((c) => {
        const ativo = (valor || 'cinza') === c
        return (
          <button key={c} type="button" role="radio" aria-checked={ativo} aria-label={ROTULO_COR_ETAPA[c]} title={ROTULO_COR_ETAPA[c]} onClick={() => onChange(c)}
            className={cn('w-5 h-5 rounded-full border-2 transition outline-none focus-visible:ring-2 focus-visible:ring-brand', ativo ? 'border-ink scale-110' : 'border-transparent')}
            style={{ background: HEX_COR_ETAPA[c] }} />
        )
      })}
    </div>
  )
}

/** Editor das colunas do kanban de uma vaga: criar, renomear, colorir, reordenar e excluir (realocando candidaturas). */
export function EditarColunasModal({ vagaId, etapas, open, onClose, onFeito, focoId }: {
  vagaId: string; etapas: ColunaEtapa[]; open: boolean; onClose: () => void; onFeito: () => void; focoId?: string | null
}) {
  const [lista, setLista] = useState<ColunaEtapa[]>([])
  const [destinos, setDestinos] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)

  useEffect(() => { if (open) { setLista(etapas.map((e) => ({ ...e }))); setDestinos({}) } }, [open, etapas])

  const removidas = etapas.filter((e) => e.id && !lista.some((l) => l.id === e.id))
  const mantidas = lista.filter((l) => l.id)
  const erro = lista.length ? validarEtapas(lista.map((l) => ({ nome: l.nome.trim(), tipo: l.tipo }))) : null

  const alterar = (i: number, p: Partial<ColunaEtapa>) => setLista((l) => l.map((x, j) => (j === i ? { ...x, ...p } : x)))
  const mover = (i: number, d: number) => setLista((l) => {
    const j = i + d
    if (i < 1 || j < 1 || i >= l.length - 1 || j >= l.length - 1) return l
    const n = [...l]; [n[i], n[j]] = [n[j], n[i]]; return n
  })
  function excluir(i: number) {
    const alvo = lista[i]
    setLista((l) => l.filter((_, j) => j !== i))
    if (alvo.id) {
      // destino padrão: a coluna anterior que continua existindo
      const anterior = lista.slice(0, i).reverse().find((x) => x.id)
      if (anterior?.id) setDestinos((d) => ({ ...d, [alvo.id!]: anterior.id! }))
    }
  }
  const desfazer = (e: ColunaEtapa) => {
    const pos = etapas.findIndex((x) => x.id === e.id)
    setLista((l) => { const n = [...l]; n.splice(Math.min(Math.max(pos, 1), n.length - 1), 0, { ...e }); return n })
  }

  async function salvar() {
    if (erro) return
    setSalvando(true)
    const realocar: Record<string, string> = {}
    for (const r of removidas) { const d = destinos[r.id!]; if (d && mantidas.some((m) => m.id === d)) realocar[r.id!] = d }
    const res = await salvarColunas(vagaId, lista, realocar)
    setSalvando(false)
    if (res) { onFeito(); onClose() }
  }

  return (
    <Modal open={open} onClose={onClose} wide title="Editar colunas do kanban" subtitle="As colunas valem só para esta vaga. A primeira recebe as novas candidaturas e a última conclui a contratação."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Save" onClick={salvar} disabled={salvando || !!erro}>{salvando ? 'Salvando…' : 'Salvar colunas'}</Button></>}>
      {erro && <p role="alert" className="text-[12.5px] text-danger mb-3">{erro}</p>}
      <ol className="space-y-2.5">
        {lista.map((e, i) => {
          const fixa = i === 0 || i === lista.length - 1
          return (
            <li key={e.id ?? `nova-${i}`} className={cn('rounded-xl border bg-surface p-3', focoId && e.id === focoId ? 'border-brand' : 'border-line')} style={{ borderLeft: `4px solid ${hexColuna(e.cor)}` }}>
              <div className="flex items-center gap-2 flex-wrap">
                <span className="w-5 text-center text-[12px] font-bold text-muted">{i + 1}</span>
                <input aria-label={`Nome da coluna ${i + 1}`} className="input flex-1 min-w-[160px]" maxLength={80} value={e.nome} autoFocus={!!focoId && e.id === focoId}
                  onChange={(ev) => alterar(i, { nome: ev.target.value })} />
                {fixa ? <Badge>{i === 0 ? 'Entrada' : 'Contratação'}</Badge> : (
                  <Dropdown aria-label={`Tipo da coluna ${i + 1}`} className="input w-auto" value={e.tipo} onChange={(ev) => alterar(i, { tipo: ev.target.value })}>
                    {TIPOS_ETAPA.filter((t) => t !== 'nova' && t !== 'contratado').map((t) => <option key={t} value={t}>{t === 'generica' ? 'Personalizada' : ROTULO_ETAPA[t as TipoEtapa]}</option>)}
                  </Dropdown>
                )}
                {!!e.ativas && <Badge tone="brand">{e.ativas} candidato(s)</Badge>}
                {!fixa && <>
                  <Button size="icon-sm" variant="ghost" icon="ChevronUp" aria-label={`Mover ${e.nome || 'coluna'} para a esquerda`} disabled={i === 1} onClick={() => mover(i, -1)} />
                  <Button size="icon-sm" variant="ghost" icon="ChevronDown" aria-label={`Mover ${e.nome || 'coluna'} para a direita`} disabled={i === lista.length - 2} onClick={() => mover(i, 1)} />
                  <Button size="icon-sm" variant="danger" icon="Trash2" aria-label={`Excluir coluna ${e.nome || i + 1}`} onClick={() => excluir(i)} />
                </>}
              </div>
              <div className="mt-2.5 pl-7"><SeletorCor rotulo={`Cor da coluna ${e.nome || i + 1}`} valor={e.cor} onChange={(c) => alterar(i, { cor: c })} /></div>
            </li>
          )
        })}
      </ol>
      <Button className="mt-3" variant="ghost" icon="Plus" disabled={lista.length >= 20} onClick={() => setLista((l) => comColunaNova(l, `Nova coluna ${l.length - 1}`))}>Adicionar coluna</Button>

      {removidas.length > 0 && (
        <div className="mt-5">
          <Callout tone="warning" icon="AlertTriangle">Ao salvar, as colunas abaixo serão excluídas. Candidaturas que estiverem nelas vão para a coluna escolhida.</Callout>
          <ul className="mt-3 space-y-2">
            {removidas.map((r) => (
              <li key={r.id} className="flex items-center gap-2 flex-wrap text-[13px]">
                <span className="font-semibold text-ink line-through decoration-danger">{r.nome}</span>
                {!!r.ativas && <Badge tone="warning">{r.ativas} candidato(s)</Badge>}
                <span className="text-muted">→</span>
                <Dropdown aria-label={`Destino das candidaturas de ${r.nome}`} className="input w-auto" value={destinos[r.id!] ?? ''} onChange={(ev) => setDestinos((d) => ({ ...d, [r.id!]: ev.target.value }))}>
                  <option value="">Escolha a coluna…</option>
                  {mantidas.map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}
                </Dropdown>
                <Button size="sm" variant="ghost" icon="Undo2" onClick={() => desfazer(r)}>Manter</Button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </Modal>
  )
}
