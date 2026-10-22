import { useState } from 'react'
import { PageHeader, Card, CardHead, Button, Field, Badge, EmptyState, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { Aguardar } from '@/components/v2/estados'
import { TelaCargos, type Familia, type Nivel, type Taxonomia, type Trilha } from '@/components/v2/cargos/comum'
import { api, executar, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'

type Edicao =
  | { tipo: 'familia'; id?: string; paiId?: string; nome: string; descricao: string; ativa: boolean }
  | { tipo: 'trilha'; id?: string; nome: string; descricao: string; ativa: boolean }
  | { tipo: 'nivel'; id?: string; trilhaId: string; nome: string; ordem?: number; criteriosEvolucao: string; requisitos: string }

export default function Familias() {
  const r = useApi<Taxonomia>('cargos/taxonomia')
  const gerencia = useTem('cargos:gerenciar')
  const [ed, setEd] = useState<Edicao | null>(null)
  const [exc, setExc] = useState<{ rota: string; nome: string } | null>(null)

  async function salvar() {
    if (!ed) return
    const corpo = { ...ed }
    let rota = '', metodo: 'post' | 'put' = ed.id ? 'put' : 'post'
    if (ed.tipo === 'familia') rota = ed.id ? `cargos/taxonomia/familias/${ed.id}` : 'cargos/taxonomia/familias'
    if (ed.tipo === 'trilha') rota = ed.id ? `cargos/taxonomia/trilhas/${ed.id}` : 'cargos/taxonomia/trilhas'
    if (ed.tipo === 'nivel') rota = ed.id ? `cargos/taxonomia/niveis/${ed.id}` : `cargos/taxonomia/trilhas/${ed.trilhaId}/niveis`
    if (await executar(() => api[metodo](rota, corpo), 'Salvo.')) { setEd(null); r.recarregar() }
  }
  async function excluir() {
    if (!exc) return
    if (await executar(() => api.del(exc.rota), 'Excluído.')) { setExc(null); r.recarregar() }
  }

  return (
    <TelaCargos>
      <PageHeader title="Famílias, trilhas e níveis" subtitle="Estrutura de carreira da empresa. Os exemplos iniciais são editáveis e podem ser trocados por qualquer modelo."
        actions={gerencia && <><Button icon="FolderPlus" onClick={() => setEd({ tipo: 'familia', nome: '', descricao: '', ativa: true })}>Nova família</Button><Button variant="ghost" icon="Route" onClick={() => setEd({ tipo: 'trilha', nome: '', descricao: '', ativa: true })}>Nova trilha</Button></>} />
      <Aguardar r={r}>
        {(d) => (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-5">
            <Card>
              <CardHead title="Famílias ocupacionais" sub="Com subfamílias (um nível de profundidade)." />
              {d.familias.length === 0 ? <EmptyState icon="FolderTree" title="Nenhuma família ainda" desc={gerencia ? 'Crie a primeira família, como Jurídica ou Comercial.' : 'O RH ainda não cadastrou famílias.'} /> : (
                <ul className="divide-y divide-line">
                  {d.familias.filter((f) => !f.paiId).map((f) => (
                    <li key={f.id} className="px-5 py-3">
                      <LinhaFamilia f={f} gerencia={gerencia} onEditar={() => setEd({ tipo: 'familia', id: f.id, nome: f.nome, descricao: f.descricao ?? '', ativa: f.ativa })}
                        onSub={() => setEd({ tipo: 'familia', paiId: f.id, nome: '', descricao: '', ativa: true })} onExcluir={() => setExc({ rota: `cargos/taxonomia/familias/${f.id}`, nome: f.nome })} />
                      <ul className="ml-5 mt-1 border-l border-line pl-4 space-y-1">
                        {d.familias.filter((s) => s.paiId === f.id).map((s) => (
                          <li key={s.id}><LinhaFamilia f={s} gerencia={gerencia} onEditar={() => setEd({ tipo: 'familia', id: s.id, nome: s.nome, descricao: s.descricao ?? '', ativa: s.ativa })} onExcluir={() => setExc({ rota: `cargos/taxonomia/familias/${s.id}`, nome: s.nome })} /></li>
                        ))}
                      </ul>
                    </li>
                  ))}
                </ul>
              )}
            </Card>
            <div className="space-y-5">
              {d.trilhas.map((t) => <CartaoTrilha key={t.id} t={t} gerencia={gerencia}
                onEditar={() => setEd({ tipo: 'trilha', id: t.id, nome: t.nome, descricao: t.descricao ?? '', ativa: t.ativa })}
                onNivel={(n) => setEd(n ? { tipo: 'nivel', id: n.id, trilhaId: t.id, nome: n.nome, ordem: n.ordem, criteriosEvolucao: n.criteriosEvolucao ?? '', requisitos: n.requisitos ?? '' } : { tipo: 'nivel', trilhaId: t.id, nome: '', criteriosEvolucao: '', requisitos: '' })}
                onExcluirNivel={(n) => setExc({ rota: `cargos/taxonomia/niveis/${n.id}`, nome: n.nome })} />)}
            </div>
          </div>
        )}
      </Aguardar>

      <Modal open={!!ed} onClose={() => setEd(null)} title={ed ? `${ed.id ? 'Editar' : 'Nova'} ${ed.tipo === 'familia' ? (ed.paiId ? 'subfamília' : 'família') : ed.tipo}` : ''}
        footer={<><Button variant="ghost" onClick={() => setEd(null)}>Cancelar</Button><Button disabled={!ed?.nome.trim()} onClick={() => void salvar()}>Salvar</Button></>}>
        {ed && (
          <form onSubmit={(e) => { e.preventDefault(); void salvar() }}>
            <Field label="Nome" required htmlFor="tx-n"><input id="tx-n" className="input" value={ed.nome} onChange={(e) => setEd({ ...ed, nome: e.target.value } as Edicao)} /></Field>
            {ed.tipo !== 'nivel' && <Field label="Descrição" htmlFor="tx-d"><textarea id="tx-d" rows={2} className="input !h-auto py-2.5" value={ed.descricao} onChange={(e) => setEd({ ...ed, descricao: e.target.value })} /></Field>}
            {ed.tipo === 'nivel' && <>
              <Field label="Critérios de evolução" htmlFor="tx-c" hint="O que a pessoa precisa demonstrar para evoluir a este nível."><textarea id="tx-c" rows={3} className="input !h-auto py-2.5" value={ed.criteriosEvolucao} onChange={(e) => setEd({ ...ed, criteriosEvolucao: e.target.value })} /></Field>
              <Field label="Requisitos do nível" htmlFor="tx-r"><textarea id="tx-r" rows={3} className="input !h-auto py-2.5" value={ed.requisitos} onChange={(e) => setEd({ ...ed, requisitos: e.target.value })} /></Field>
            </>}
            {ed.id && ed.tipo !== 'nivel' && <label className="inline-flex items-center gap-2 text-[13px]"><input type="checkbox" checked={ed.ativa} onChange={(e) => setEd({ ...ed, ativa: e.target.checked })} /> Ativa</label>}
          </form>
        )}
      </Modal>
      <ConfirmModal open={!!exc} onClose={() => setExc(null)} onConfirm={() => void excluir()} titulo="Excluir" confirmar="Excluir"
        texto={<>Excluir <b>{exc?.nome}</b>? Se houver cargos, faixas ou subfamílias ligados, o servidor recusará (desative em vez de excluir).</>} />
      {gerencia && <Callout tone="neutral" icon="Info" className="mt-5">Cargos novos continuam sendo cadastrados em Engenharia de funções; aqui você define família, trilha e nível da ficha oficial de cada um.</Callout>}
    </TelaCargos>
  )
}

function LinhaFamilia({ f, gerencia, onEditar, onSub, onExcluir }: { f: Familia; gerencia: boolean; onEditar: () => void; onSub?: () => void; onExcluir: () => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="font-semibold text-[13.5px] text-ink">{f.nome}</span>
      {!f.ativa && <Badge>Inativa</Badge>}
      <Badge tone="brand">{f.cargos} cargo{f.cargos === 1 ? '' : 's'}</Badge>
      {gerencia && <span className="ml-auto flex gap-1">
        {onSub && <Button size="icon-sm" variant="subtle" icon="Plus" aria-label={`Adicionar subfamília em ${f.nome}`} onClick={onSub} />}
        <Button size="icon-sm" variant="subtle" icon="Pencil" aria-label={`Editar ${f.nome}`} onClick={onEditar} />
        <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir ${f.nome}`} onClick={onExcluir} />
      </span>}
    </div>
  )
}

function CartaoTrilha({ t, gerencia, onEditar, onNivel, onExcluirNivel }: { t: Trilha; gerencia: boolean; onEditar: () => void; onNivel: (n?: Nivel) => void; onExcluirNivel: (n: Nivel) => void }) {
  return (
    <Card>
      <CardHead title={<span className="flex items-center gap-2">{t.nome}{!t.ativa && <Badge>Inativa</Badge>}</span>} sub={t.descricao ?? undefined}
        action={gerencia && <div className="flex gap-1"><Button size="sm" variant="ghost" icon="Plus" onClick={() => onNivel()}>Nível</Button><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label={`Editar trilha ${t.nome}`} onClick={onEditar} /></div>} />
      {t.niveis.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem níveis nesta trilha.</p> : (
        <ol className="divide-y divide-line">
          {t.niveis.map((n) => (
            <li key={n.id} className="px-5 py-3 flex items-start gap-3">
              <span className="h-6 w-6 rounded-full bg-brand-100 text-brand-700 text-[11px] font-bold flex items-center justify-center shrink-0 mt-0.5">{n.ordem}</span>
              <div className="min-w-0 flex-1">
                <div className="font-semibold text-[13.5px] text-ink">{n.nome} <span className="text-muted font-normal text-[12px]">· {n.cargos} cargo{n.cargos === 1 ? '' : 's'}</span></div>
                {n.criteriosEvolucao && <p className="text-[12.5px] text-muted mt-0.5">Evolução: {n.criteriosEvolucao}</p>}
              </div>
              {gerencia && <span className="flex gap-1"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label={`Editar nível ${n.nome}`} onClick={() => onNivel(n)} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Excluir nível ${n.nome}`} onClick={() => onExcluirNivel(n)} /></span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}
