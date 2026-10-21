import { useState } from 'react'
import { useStore } from '@/lib/store'
import type { Categoria9Box, Competencia, GrupoCompetencia, TipoAvaliacaoCompetencia } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, EmptyState, Select, Tabela, TH, TD, Toggle, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { cn } from '@/lib/utils'
import { gerarCSV, baixarArquivo } from '@/domain/csv'

export const CAT9: Record<Categoria9Box, string> = { nenhuma: 'Fora do 9 box', comportamento: 'Comportamento', desempenho: 'Desempenho' }
export const TIPO_COMP: Record<TipoAvaliacaoCompetencia, string> = { desempenho: 'Ciclos de avaliação', inicio_parceria: 'Início de parceria' }

export default function Competencias() {
  const s = useStore()
  const [tab, setTab] = useState('competencias')
  const [tipo, setTipo] = useState('')
  const [grupo, setGrupo] = useState('')
  const [form, setForm] = useState<{ aberto: boolean; c?: Competencia }>({ aberto: false })
  const [gForm, setGForm] = useState<{ aberto: boolean; g?: GrupoCompetencia }>({ aberto: false })
  const [remover, setRemover] = useState<Competencia | null>(null)
  const [verArquivados, setVerArquivados] = useState(false)

  const lista = s.competencias.filter((c) => (tab === 'arquivadas' ? !c.ativo : c.ativo)).filter((c) => !tipo || c.tipo === tipo).filter((c) => !grupo || c.grupoId === grupo)
  const gNome = (id: string) => s.gruposCompetencia.find((g) => g.id === id)?.nome ?? '—'
  const funcoesTxt = (c: Competencia) => (c.cargoIds.length ? c.cargoIds.map((id) => s.cargoNome(id)).join(', ') : 'Todas as funções')

  const exportar = () => {
    baixarArquivo(gerarCSV(s.competencias, [
      { titulo: 'Competência', valor: (c) => c.nome }, { titulo: 'Grupo', valor: (c) => gNome(c.grupoId) }, { titulo: 'Tipo', valor: (c) => TIPO_COMP[c.tipo] },
      { titulo: 'Peso', valor: (c) => c.peso }, { titulo: 'Funções', valor: funcoesTxt }, { titulo: 'Ativa', valor: (c) => (c.ativo ? 'sim' : 'não') }, { titulo: 'Descrição', valor: (c) => c.descricao ?? '' },
    ]), 'competencias.csv')
    toast('Competências exportadas.')
  }

  return (
    <>
      <PageHeader title="Competências" subtitle="O que é avaliado nos ciclos e no início de parceria, com pesos e funções."
        actions={<><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button variant="ghost" icon="FolderPlus" onClick={() => setGForm({ aberto: true })}>Novo grupo</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Nova competência</Button></>} />
      <Tabs tabs={[{ key: 'competencias', label: 'Competências' }, { key: 'grupos', label: `Grupos (${s.gruposCompetencia.filter((g) => g.ativo).length})` }, { key: 'funcoes', label: 'Por função' }, { key: 'arquivadas', label: 'Arquivadas' }]} active={tab} onChange={setTab} />

      {(tab === 'competencias' || tab === 'arquivadas') && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <Select label="Tipo" value={tipo} onChange={setTipo}><option value="">Todos os tipos</option>{Object.entries(TIPO_COMP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
            <Select label="Grupo" value={grupo} onChange={setGrupo}><option value="">Todos os grupos</option>{s.gruposCompetencia.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Select>
          </div>
          <Card>
            {lista.length === 0 ? <EmptyState icon="Layers" title="Nenhuma competência" /> : (
              <Tabela minWidth={780}>
                <thead><tr><th className={TH}>Competência</th><th className={TH}>Grupo</th><th className={TH}>Usada em</th><th className={TH}>Peso</th><th className={TH}>Funções</th><th className={TH}></th></tr></thead>
                <tbody>
                  {lista.map((c) => (
                    <tr key={c.id}>
                      <td className={TD}><div className="font-semibold text-ink">{c.nome}</div>{c.descricao && <div className="text-[11.5px] text-muted line-clamp-1">{c.descricao}</div>}</td>
                      <td className={TD}>{gNome(c.grupoId)}</td>
                      <td className={TD}><Badge tone={c.tipo === 'desempenho' ? 'brand' : 'gold'}>{TIPO_COMP[c.tipo]}</Badge></td>
                      <td className={TD}><span className="font-bold tabular-nums">{c.peso}</span></td>
                      <td className={TD}><span className="text-[12.5px] text-ink-2 line-clamp-2">{funcoesTxt(c)}</span></td>
                      <td className={TD}><div className="flex gap-1 justify-end">
                        <Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, c })} />
                        <Button size="icon-sm" variant="subtle" icon={c.ativo ? 'Archive' : 'ArchiveRestore'} aria-label={c.ativo ? 'Arquivar' : 'Reativar'} onClick={() => feedback(s.salvarCompetencia({ ...c, ativo: !c.ativo }, c.id), c.ativo ? 'Competência arquivada.' : 'Competência reativada.')} />
                        <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(c)} />
                      </div></td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Card>
        </>
      )}

      {tab === 'grupos' && (
        <>
          <div className="flex justify-end mb-3"><Toggle checked={verArquivados} onChange={setVerArquivados} label="Mostrar arquivados" /></div>
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
            {s.gruposCompetencia.filter((g) => verArquivados || g.ativo).map((g) => (
              <Card key={g.id} className={cn('p-5', !g.ativo && 'opacity-60')}>
                <div className="flex items-start justify-between gap-2"><h3 className="text-[15px] font-bold text-ink">{g.nome}</h3><Badge tone={g.categoria9box === 'nenhuma' ? 'neutral' : 'brand'}>{CAT9[g.categoria9box]}</Badge></div>
                <p className="text-[12.5px] text-muted mt-1">{s.competencias.filter((c) => c.grupoId === g.id && c.ativo).length} competência(s) ativa(s)</p>
                <div className="flex gap-2 mt-4">
                  <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setGForm({ aberto: true, g })}>Editar</Button>
                  <Button size="sm" variant="subtle" icon={g.ativo ? 'Archive' : 'ArchiveRestore'} onClick={() => feedback(s.salvarGrupoCompetencia({ ...g, ativo: !g.ativo }, g.id), g.ativo ? 'Grupo arquivado.' : 'Grupo reativado.')}>{g.ativo ? 'Arquivar' : 'Reativar'}</Button>
                  <Button size="sm" variant="subtle" icon="Trash2" onClick={() => feedback(s.removerGrupoCompetencia(g.id), 'Grupo removido.')}>Remover</Button>
                </div>
              </Card>
            ))}
          </div>
          <Callout tone="neutral" icon="Grid3x3" className="mt-5">A categoria 9 box indica se o grupo compõe o eixo de <b>desempenho</b> ou de <b>comportamento</b> nos relatórios dos ciclos.</Callout>
        </>
      )}

      {tab === 'funcoes' && (
        <div className="grid md:grid-cols-2 gap-4">
          {s.cargos.map((g) => {
            const comps = s.competencias.filter((c) => c.ativo && (c.cargoIds.includes(g.id) || c.cargoIds.length === 0))
            return (
              <Card key={g.id}>
                <CardHead title={g.nome} sub={`${s.setorNome(g.setorId)} · ${comps.length} competência(s)`} />
                <ul className="p-4 space-y-1.5">
                  {comps.map((c) => <li key={c.id} className="flex items-center gap-2 text-[13px]"><span className="flex-1 text-ink-2">{c.nome}</span><Badge tone={c.tipo === 'desempenho' ? 'brand' : 'gold'} className="!text-[10px]">{c.tipo === 'desempenho' ? 'ciclo' : 'início'}</Badge><span className="text-[11.5px] text-muted w-12 text-right">peso {c.peso}</span></li>)}
                </ul>
              </Card>
            )
          })}
        </div>
      )}

      {form.aberto && <CompetenciaForm c={form.c} onClose={() => setForm({ aberto: false })} />}
      {gForm.aberto && <GrupoForm g={gForm.g} onClose={() => setGForm({ aberto: false })} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover competência?" confirmar="Remover" texto="Competências já usadas em avaliações não podem ser removidas — arquive-as."
        onConfirm={() => { if (remover && feedback(s.removerCompetencia(remover.id), 'Competência removida.')) setRemover(null) }} />
    </>
  )
}

function CompetenciaForm({ c, onClose }: { c?: Competencia; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState<Omit<Competencia, 'id'>>(() => ({ tipo: c?.tipo ?? 'desempenho', grupoId: c?.grupoId ?? s.gruposCompetencia.find((g) => g.ativo)?.id ?? '', nome: c?.nome ?? '', descricao: c?.descricao ?? '', peso: c?.peso ?? 1, cargoIds: c?.cargoIds ?? [], ativo: c?.ativo ?? true }))
  const [todas, setTodas] = useState(!c || c.cargoIds.length === 0)
  const salvar = () => { if (feedback(s.salvarCompetencia({ ...f, nome: f.nome.trim(), cargoIds: todas ? [] : f.cargoIds }, c?.id), c ? 'Competência atualizada.' : 'Competência criada.')) onClose() }
  return (
    <Modal open onClose={onClose} wide title={c ? 'Editar competência' : 'Nova competência'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={salvar}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Nome" required htmlFor="cp-n"><input id="cp-n" className="input" value={f.nome} onChange={(e) => setF({ ...f, nome: e.target.value })} /></Field>
        <Field label="Grupo" htmlFor="cp-g"><select id="cp-g" className="input" value={f.grupoId} onChange={(e) => setF({ ...f, grupoId: e.target.value })}>{s.gruposCompetencia.filter((g) => g.ativo || g.id === f.grupoId).map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</select></Field>
        <Field label="Usada em" htmlFor="cp-t"><select id="cp-t" className="input" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value as TipoAvaliacaoCompetencia })}>{Object.entries(TIPO_COMP).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
        <Field label="Peso (1–100)" htmlFor="cp-p" hint="Influência na nota ponderada."><input id="cp-p" type="number" min={1} max={100} className="input" value={f.peso} onChange={(e) => setF({ ...f, peso: Number(e.target.value) })} /></Field>
        <Field label="Descrição" htmlFor="cp-d" className="sm:col-span-2"><textarea id="cp-d" rows={2} className="input !h-auto py-2.5" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      </div>
      <Toggle checked={todas} onChange={setTodas} label="Vale para todas as funções" />
      {!todas && (
        <div className="mt-3 grid sm:grid-cols-2 gap-1.5 max-h-48 overflow-y-auto rounded-xl border border-line p-2">
          {s.cargos.map((g) => { const on = f.cargoIds.includes(g.id); return <label key={g.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer text-[13px]', on ? 'bg-brand-50' : 'hover:bg-surface-2')}><input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => setF({ ...f, cargoIds: on ? f.cargoIds.filter((x) => x !== g.id) : [...f.cargoIds, g.id] })} />{g.nome} <span className="text-[11px] text-muted">· {s.setorNome(g.setorId)}</span></label> })}
        </div>
      )}
    </Modal>
  )
}

function GrupoForm({ g, onClose }: { g?: GrupoCompetencia; onClose: () => void }) {
  const s = useStore()
  const [nome, setNome] = useState(g?.nome ?? '')
  const [cat, setCat] = useState<Categoria9Box>(g?.categoria9box ?? 'nenhuma')
  return (
    <Modal open onClose={onClose} title={g ? 'Editar grupo' : 'Novo grupo de competências'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={() => { if (feedback(s.salvarGrupoCompetencia({ nome: nome.trim(), categoria9box: cat, ativo: g?.ativo ?? true }, g?.id), 'Grupo salvo.')) onClose() }}>Salvar</Button></>}>
      <Field label="Nome" required htmlFor="gc-n"><input id="gc-n" className="input" value={nome} onChange={(e) => setNome(e.target.value)} /></Field>
      <Field label="Categoria no 9 box" htmlFor="gc-c"><select id="gc-c" className="input" value={cat} onChange={(e) => setCat(e.target.value as Categoria9Box)}>{Object.entries(CAT9).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></Field>
    </Modal>
  )
}
