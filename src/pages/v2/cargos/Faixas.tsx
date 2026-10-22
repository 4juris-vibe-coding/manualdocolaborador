import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Tabela, TH, TD, EmptyState, Select, Badge } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { Aguardar } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { TelaCargos, STATUS_FAIXA, AvisoFaixas, type Taxonomia } from '@/components/v2/cargos/comum'
import { api, executar, useApi, qs, ErroApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { useStore } from '@/lib/store'
import { dataBR, moeda } from '@/lib/fmt'
import { toast } from '@/components/toast'
import { Dropdown } from '@/components/Dropdown'

interface Faixa { id: string; cargoId: string; cargoNome: string; nivelId: string | null; nivelNome: string | null; unidadeId: string | null; criterio: string | null; minimo: number; referencia: number | null; maximo: number; moeda: string; vigenciaInicio: string; vigenciaFim: string | null; status: string; situacao: string; revisaoDe: string | null }
interface Form { id?: string; revisaoDe?: string; cargoId: string; nivelId: string; unidadeId: string; criterio: string; minimo: string; referencia: string; maximo: string; moeda: string; vigenciaInicio: string; vigenciaFim: string }
const VAZIO: Form = { cargoId: '', nivelId: '', unidadeId: '', criterio: '', minimo: '', referencia: '', maximo: '', moeda: 'BRL', vigenciaInicio: '', vigenciaFim: '' }

export default function Faixas() {
  const [aba, setAba] = useState('faixas')
  const pode = useTem('cargos:ver_faixas')
  const gerencia = useTem('cargos:gerenciar')
  return (
    <TelaCargos>
      <PageHeader title="Faixas salariais" subtitle="Acesso restrito. Faixas por cargo, nível ou unidade, com vigência, histórico de revisões e aprovação." actions={<Link to="/cargos/governanca"><Button variant="ghost" icon="ShieldCheck">Fila de aprovação</Button></Link>} />
      {!pode ? <Card><EmptyState icon="Lock" title="Sem permissão" desc="Faixas salariais são restritas a perfis autorizados." /></Card> : (
        <>
          <Tabs tabs={[{ key: 'faixas', label: 'Faixas' }, { key: 'comparativo', label: 'Posição das remunerações (agregado)' }]} active={aba} onChange={setAba} />
          {aba === 'faixas' ? <Lista gerencia={gerencia} /> : <Comparativo />}
        </>
      )}
    </TelaCargos>
  )
}

function Lista({ gerencia }: { gerencia: boolean }) {
  const [status, setStatus] = useState('')
  const [pagina, setPagina] = useState(1)
  const r = useApi<{ itens: Faixa[]; total: number; por: number; ressalva: string }>('cargos/faixas' + qs({ status, pagina, por: 25 }))
  const aprova = useTem('cargos:aprovar')
  const tax = useApi<Taxonomia>('cargos/taxonomia')
  const cat = useApi<{ itens: { cargoId: string; nome: string }[] }>('cargos/catalogo?por=100')
  const unidades = useStore((s) => s.unidades)
  const [f, setF] = useState<Form | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [dec, setDec] = useState<{ id: string; tipo: 'aprovar' | 'rejeitar'; just: string } | null>(null)
  const [hist, setHist] = useState<string | null>(null)
  const [exc, setExc] = useState<Faixa | null>(null)
  const niveis = tax.dados?.trilhas.flatMap((t) => t.niveis.map((n) => ({ ...n, trilha: t.nome }))) ?? []

  async function salvar() {
    if (!f) return
    setErros({})
    const corpo = { ...f, nivelId: f.nivelId || null, unidadeId: f.unidadeId || null, referencia: f.referencia === '' ? null : Number(f.referencia), minimo: Number(f.minimo), maximo: Number(f.maximo), vigenciaFim: f.vigenciaFim || null }
    const rota = f.id ? `cargos/faixas/${f.id}` : f.revisaoDe ? `cargos/faixas/${f.revisaoDe}/revisar` : 'cargos/faixas'
    try {
      await (f.id ? api.put(rota, corpo) : api.post(rota, corpo))
      toast('Faixa salva como rascunho.'); setF(null); r.recarregar()
    } catch (e) { if (e instanceof ErroApi) { setErros(e.campos ?? {}); toast(e.message, 'danger') } else toast('Não foi possível salvar.', 'danger') }
  }
  const submeter = async (x: Faixa) => { if (await executar(() => api.post(`cargos/faixas/${x.id}/submeter`), 'Enviada para aprovação.')) r.recarregar() }
  async function decidir() {
    if (!dec) return
    if (await executar(() => api.post(`cargos/faixas/${dec.id}/decisao`, { decisao: dec.tipo, justificativa: dec.just }), dec.tipo === 'aprovar' ? 'Faixa aprovada.' : 'Faixa rejeitada.')) { setDec(null); r.recarregar() }
  }
  async function excluir() { if (exc && (await executar(() => api.del(`cargos/faixas/${exc.id}`), 'Faixa excluída.'))) { setExc(null); r.recarregar() } }
  const num = (k: 'minimo' | 'referencia' | 'maximo', label: string, obrig = true) => f && (
    <Field label={label} required={obrig} htmlFor={`fx-${k}`} erro={erros[k]}><input id={`fx-${k}`} type="number" min="0" step="0.01" className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} /></Field>
  )

  return (
    <>
      <Card>
        <CardHead title="Faixas cadastradas" action={<div className="flex gap-2 flex-wrap">
          <Select label="Situação" value={status} onChange={(v) => { setStatus(v); setPagina(1) }}><option value="">Todas</option>{Object.entries(STATUS_FAIXA).filter(([k]) => k !== 'futura').map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</Select>
          {gerencia && <Button icon="Plus" onClick={() => setF({ ...VAZIO })}>Nova faixa</Button>}
        </div>} />
        <Aguardar r={r} vazio={(d) => d.total === 0 ? <EmptyState icon="Coins" title="Nenhuma faixa cadastrada" desc={gerencia ? 'Crie a primeira faixa e envie para aprovação.' : undefined} /> : null}>
          {(d) => (
            <>
              <AvisoFaixas texto={d.ressalva} />
              <Tabela minWidth={900}>
                <thead><tr><th className={TH}>Cargo / escopo</th><th className={TH}>Mínimo</th><th className={TH}>Ref.</th><th className={TH}>Máximo</th><th className={TH}>Vigência</th><th className={TH}>Situação</th><th className={TH}><span className="sr-only">Ações</span></th></tr></thead>
                <tbody>{d.itens.map((x) => (
                  <tr key={x.id}>
                    <td className={TD}><Link to={`/cargos/${x.cargoId}`} className="font-semibold text-ink hover:text-brand">{x.cargoNome}</Link><div className="text-[11.5px] text-muted">{[x.nivelNome, x.unidadeId && unidades.find((u) => u.id === x.unidadeId)?.nome, x.criterio].filter(Boolean).join(' · ') || 'Cargo inteiro'}</div></td>
                    <td className={TD}>{moeda(x.minimo, x.moeda)}</td><td className={TD}>{moeda(x.referencia, x.moeda)}</td><td className={TD}>{moeda(x.maximo, x.moeda)}</td>
                    <td className={TD}>{dataBR(x.vigenciaInicio)} → {x.vigenciaFim ? dataBR(x.vigenciaFim) : 'aberta'}</td>
                    <td className={TD}><StatusBadge mapa={STATUS_FAIXA} valor={x.situacao} /></td>
                    <td className={TD}>
                      <div className="flex gap-1 flex-wrap justify-end">
                        {x.revisaoDe && <Button size="sm" variant="subtle" icon="History" onClick={() => setHist(x.id)}>Histórico</Button>}
                        {!x.revisaoDe && x.status === 'vigente' && <Button size="sm" variant="subtle" icon="History" onClick={() => setHist(x.id)}>Histórico</Button>}
                        {gerencia && (x.status === 'rascunho' || x.status === 'rejeitada') && <>
                          <Button size="sm" variant="ghost" onClick={() => setF({ id: x.id, revisaoDe: x.revisaoDe ?? undefined, cargoId: x.cargoId, nivelId: x.nivelId ?? '', unidadeId: x.unidadeId ?? '', criterio: x.criterio ?? '', minimo: String(x.minimo), referencia: x.referencia == null ? '' : String(x.referencia), maximo: String(x.maximo), moeda: x.moeda, vigenciaInicio: x.vigenciaInicio, vigenciaFim: x.vigenciaFim ?? '' })}>Editar</Button>
                          <Button size="sm" variant="soft" onClick={() => void submeter(x)}>Enviar</Button>
                          <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Excluir faixa" onClick={() => setExc(x)} />
                        </>}
                        {gerencia && x.status === 'vigente' && <Button size="sm" variant="ghost" icon="GitBranchPlus" onClick={() => setF({ ...VAZIO, revisaoDe: x.id, cargoId: x.cargoId, nivelId: x.nivelId ?? '', unidadeId: x.unidadeId ?? '', criterio: x.criterio ?? '', minimo: String(x.minimo), referencia: x.referencia == null ? '' : String(x.referencia), maximo: String(x.maximo), moeda: x.moeda })}>Revisar</Button>}
                        {aprova && x.status === 'em_aprovacao' && <><Button size="sm" icon="Check" onClick={() => setDec({ id: x.id, tipo: 'aprovar', just: '' })}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => setDec({ id: x.id, tipo: 'rejeitar', just: '' })}>Rejeitar</Button></>}
                      </div>
                    </td>
                  </tr>
                ))}</tbody>
              </Tabela>
              <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
            </>
          )}
        </Aguardar>
      </Card>

      <Modal wide open={!!f} onClose={() => setF(null)} title={f?.id ? 'Editar faixa' : f?.revisaoDe ? 'Revisar faixa vigente' : 'Nova faixa salarial'}
        subtitle={f?.revisaoDe ? 'A faixa atual será encerrada na véspera da nova vigência, se a revisão for aprovada.' : 'Fica em rascunho até ser enviada e aprovada por outra pessoa.'}
        footer={<><Button variant="ghost" onClick={() => setF(null)}>Cancelar</Button><Button onClick={() => void salvar()}>Salvar rascunho</Button></>}>
        {f && (
          <form className="grid grid-cols-1 sm:grid-cols-2 gap-x-4" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
            <Field label="Cargo" required htmlFor="fx-c" erro={erros.cargoId} className="sm:col-span-2">
              <Dropdown id="fx-c" className="input" disabled={!!f.id || !!f.revisaoDe} value={f.cargoId} onChange={(e) => setF({ ...f, cargoId: e.target.value })}><option value="">Escolha…</option>{cat.dados?.itens.map((c) => <option key={c.cargoId} value={c.cargoId}>{c.nome}</option>)}</Dropdown>
            </Field>
            <Field label="Nível (opcional)" htmlFor="fx-n" erro={erros.nivelId}><Dropdown id="fx-n" className="input" value={f.nivelId} onChange={(e) => setF({ ...f, nivelId: e.target.value })}><option value="">Todos</option>{niveis.map((n) => <option key={n.id} value={n.id}>{n.trilha} · {n.nome}</option>)}</Dropdown></Field>
            <Field label="Unidade (opcional)" htmlFor="fx-u" erro={erros.unidadeId}><Dropdown id="fx-u" className="input" value={f.unidadeId} onChange={(e) => setF({ ...f, unidadeId: e.target.value })}><option value="">Todas</option>{unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Dropdown></Field>
            <Field label="Critério (opcional)" htmlFor="fx-k" hint="Ex.: capital, interior." className="sm:col-span-2"><input id="fx-k" className="input" value={f.criterio} onChange={(e) => setF({ ...f, criterio: e.target.value })} /></Field>
            {num('minimo', 'Mínimo')}{num('referencia', 'Referência (ponto médio)', false)}{num('maximo', 'Máximo')}
            <Field label="Moeda" required htmlFor="fx-m" erro={erros.moeda}><input id="fx-m" className="input" maxLength={3} value={f.moeda} onChange={(e) => setF({ ...f, moeda: e.target.value.toUpperCase() })} /></Field>
            <Field label="Início da vigência" required htmlFor="fx-i" erro={erros.vigenciaInicio}><input id="fx-i" type="date" className="input" value={f.vigenciaInicio} onChange={(e) => setF({ ...f, vigenciaInicio: e.target.value })} /></Field>
            <Field label="Fim da vigência" htmlFor="fx-f" erro={erros.vigenciaFim} hint="Em branco = em aberto."><input id="fx-f" type="date" className="input" value={f.vigenciaFim} onChange={(e) => setF({ ...f, vigenciaFim: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
      <Modal open={!!dec} onClose={() => setDec(null)} title={dec?.tipo === 'aprovar' ? 'Aprovar faixa' : 'Rejeitar faixa'}
        footer={<><Button variant="ghost" onClick={() => setDec(null)}>Cancelar</Button><Button variant={dec?.tipo === 'rejeitar' ? 'danger' : 'primary'} disabled={dec?.tipo === 'rejeitar' && !dec.just.trim()} onClick={() => void decidir()}>{dec?.tipo === 'aprovar' ? 'Aprovar' : 'Rejeitar'}</Button></>}>
        {dec && <Field label={dec.tipo === 'rejeitar' ? 'Justificativa' : 'Comentário (opcional)'} required={dec.tipo === 'rejeitar'}><textarea className="input !h-auto py-2.5" rows={3} value={dec.just} onChange={(e) => setDec({ ...dec, just: e.target.value })} /></Field>}
      </Modal>
      <Historico id={hist} onFechar={() => setHist(null)} />
      <ConfirmModal open={!!exc} onClose={() => setExc(null)} onConfirm={() => void excluir()} titulo="Excluir faixa" confirmar="Excluir" texto="Excluir este rascunho? Faixas já vigentes ou encerradas nunca são excluídas." />
    </>
  )
}

function Historico({ id, onFechar }: { id: string | null; onFechar: () => void }) {
  const r = useApi<{ itens: Faixa[] }>(id ? `cargos/faixas/${id}/historico` : null)
  return (
    <Modal open={!!id} onClose={onFechar} title="Histórico de revisões" subtitle="Da mais recente para a mais antiga.">
      <Aguardar r={r}>
        {(d) => (
          <ol className="space-y-3 pb-3">{d.itens.map((x) => (
            <li key={x.id} className="border border-line rounded-xl p-3 text-[13px]">
              <div className="flex items-center justify-between gap-2"><span className="font-semibold text-ink">{moeda(x.minimo, x.moeda)} – {moeda(x.maximo, x.moeda)}</span><StatusBadge mapa={STATUS_FAIXA} valor={x.situacao} /></div>
              <div className="text-muted mt-1">Vigência {dataBR(x.vigenciaInicio)} → {x.vigenciaFim ? dataBR(x.vigenciaFim) : 'aberta'}</div>
            </li>
          ))}</ol>
        )}
      </Aguardar>
    </Modal>
  )
}

function Comparativo() {
  const r = useApi<{ referencia: string; ressalva: string; cargos: { cargoId: string; cargoNome: string; abaixo: number | null; dentro: number | null; acima: number | null; suprimido?: boolean; semFaixa: number; semContrato: number; moedaDiferente: number }[]; minGrupo?: number }>('cargos/faixas/comparativo')
  return (
    <Card>
      <CardHead title="Contratos vigentes em relação à faixa" sub="Somente contagens por cargo; nenhum valor individual é exibido." />
      <Aguardar r={r} vazio={(d) => d.cargos.length === 0 ? <EmptyState icon="Scale" title="Nada para comparar" desc="Cadastre faixas vigentes e contratos para ver a distribuição." /> : null}>
        {(d) => (
          <>
            <AvisoFaixas texto={d.ressalva} />
            <Tabela minWidth={720}>
              <thead><tr><th className={TH}>Cargo</th><th className={TH}>Abaixo</th><th className={TH}>Dentro</th><th className={TH}>Acima</th><th className={TH}>Sem faixa vigente</th><th className={TH}>Sem contrato</th><th className={TH}>Outra moeda</th></tr></thead>
              <tbody>{d.cargos.map((c) => (
                <tr key={c.cargoId}><td className={TD}><Link to={`/cargos/${c.cargoId}`} className="font-semibold text-ink hover:text-brand">{c.cargoNome}</Link></td>
                  {c.suprimido
                    ? <td className={TD} colSpan={3}><span className="text-muted">Oculto: menos de {d.minGrupo ?? 5} contratos</span></td>
                    : <><td className={TD}>{c.abaixo ? <Badge tone="warning">{c.abaixo}</Badge> : 0}</td><td className={TD}>{c.dentro}</td><td className={TD}>{c.acima ? <Badge tone="warning">{c.acima}</Badge> : 0}</td></>}
                  <td className={TD}>{c.semFaixa}</td><td className={TD}>{c.semContrato}</td><td className={TD}>{c.moedaDiferente}</td></tr>
              ))}</tbody>
            </Tabela>
            <p className="px-5 py-3 text-[12px] text-muted">Referência: {dataBR(d.referencia)}. Considera contratos vigentes em reais e a faixa do cargo (sem nível/critério) mais específica para a unidade da pessoa.</p>
          </>
        )}
      </Aguardar>
    </Card>
  )
}
