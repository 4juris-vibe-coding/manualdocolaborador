import { Badge, Button } from '@/components/ui'
import { ROTULO_ETAPA, TIPOS_ETAPA } from '@/domain/v2/vagas'
import { Dropdown } from '@/components/Dropdown'

/* ---------- editor de etapas (compartilhado com o detalhe) ---------- */
export function EditorEtapas({ etapas, onChange, onSalvar, desabilitado, erro }: {
  etapas: { id?: string; nome: string; tipo: string; ativas?: number }[]; onChange: (e: { id?: string; nome: string; tipo: string; ativas?: number }[]) => void; onSalvar: () => void; desabilitado: boolean; erro?: string
}) {
  const mover = (i: number, d: number) => { const n = [...etapas]; const j = i + d; if (j < 1 || j >= n.length - 1 || i < 1 || i >= n.length - 1) return;[n[i], n[j]] = [n[j], n[i]]; onChange(n) }
  return (
    <div>
      <p className="text-[12.5px] text-muted mb-3">A primeira etapa recebe as novas candidaturas e a última é a contratação. Entre elas você pode adicionar, renomear e reordenar.</p>
      {erro && <p role="alert" className="text-[12px] text-danger mb-2">{erro}</p>}
      <ol className="space-y-2">
        {etapas.map((e, i) => {
          const fixa = i === 0 || i === etapas.length - 1
          return (
            <li key={e.id ?? `n${i}`} className="flex items-center gap-2 flex-wrap">
              <span className="w-6 text-center text-[12px] font-bold text-muted">{i + 1}</span>
              <input aria-label={`Nome da etapa ${i + 1}`} className="input flex-1 min-w-[180px]" maxLength={80} value={e.nome} disabled={desabilitado} onChange={(ev) => onChange(etapas.map((x, j) => (j === i ? { ...x, nome: ev.target.value } : x)))} />
              {fixa ? <Badge>{ROTULO_ETAPA[e.tipo as keyof typeof ROTULO_ETAPA] ?? e.tipo}</Badge> : (
                <Dropdown aria-label={`Tipo da etapa ${i + 1}`} className="input w-auto" value={e.tipo} disabled={desabilitado} onChange={(ev) => onChange(etapas.map((x, j) => (j === i ? { ...x, tipo: ev.target.value } : x)))}>
                  {TIPOS_ETAPA.filter((t) => t !== 'nova' && t !== 'contratado').map((t) => <option key={t} value={t}>{ROTULO_ETAPA[t]}</option>)}
                </Dropdown>
              )}
              {!!e.ativas && <Badge tone="brand">{e.ativas} candidato(s)</Badge>}
              {!fixa && <>
                <Button size="icon-sm" variant="ghost" icon="ChevronUp" aria-label="Subir etapa" disabled={desabilitado || i === 1} onClick={() => mover(i, -1)} />
                <Button size="icon-sm" variant="ghost" icon="ChevronDown" aria-label="Descer etapa" disabled={desabilitado || i === etapas.length - 2} onClick={() => mover(i, 1)} />
                <Button size="icon-sm" variant="danger" icon="Trash2" aria-label={`Remover etapa ${e.nome || i + 1}`} disabled={desabilitado} onClick={() => onChange(etapas.filter((_, j) => j !== i))} />
              </>}
            </li>
          )
        })}
      </ol>
      <div className="flex gap-2 mt-3">
        <Button variant="ghost" icon="Plus" disabled={desabilitado || etapas.length >= 20} onClick={() => onChange([...etapas.slice(0, -1), { nome: `Nova etapa ${etapas.length - 1}`, tipo: 'generica' }, etapas[etapas.length - 1]])}>Adicionar etapa</Button>
        <Button icon="Save" disabled={desabilitado} onClick={onSalvar}>Salvar etapas</Button>
      </div>
    </div>
  )
}
