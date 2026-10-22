import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Beneficio, TipoBeneficio } from '@/lib/types'
import { PageHeader, Card, Button, Field, Tabs, Badge, EmptyState, Select, Tabela, TH, TD, Toggle, Callout, SearchBox, Icon, IndicadorCard } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { SeletorPessoas } from '@/components/inputs'
import { feedback, toast } from '@/components/toast'
import { brl, fmtDate } from '@/lib/utils'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { Dropdown } from '@/components/Dropdown'

export const TIPO_BEN: Record<TipoBeneficio, string> = {
  plano_saude: 'Plano de saúde', plano_odontologico: 'Plano odontológico', seguro_vida: 'Seguro de vida', auxilio_educacao: 'Auxílio educação',
  bem_estar: 'Bem-estar / academia', clube_descontos: 'Clube de descontos', vale_refeicao: 'Vale-refeição', vale_alimentacao: 'Vale-alimentação',
  vale_transporte: 'Vale-transporte', auxilio_creche: 'Auxílio-creche', plr: 'PLR', outro: 'Outro',
}
/** Tipos típicos de relação de emprego — exibem alerta para validação jurídica. */
export const TIPOS_SENSIVEIS: TipoBeneficio[] = ['vale_refeicao', 'vale_alimentacao', 'vale_transporte', 'auxilio_creche', 'plr']
const PERIOD = { diario: 'Diário', semanal: 'Semanal', quinzenal: 'Quinzenal', mensal: 'Mensal', anual: 'Anual' }

export default function BeneficiosRH() {
  const s = useStore()
  const [tab, setTab] = useState('cadastro')
  const [form, setForm] = useState<{ aberto: boolean; b?: Beneficio }>({ aberto: false })
  const [remover, setRemover] = useState<Beneficio | null>(null)
  const [vincular, setVincular] = useState(false)
  const [q, setQ] = useState('')
  const valorTxt = (b: Beneficio) => b.valor == null ? '—' : b.aplicadoComo === 'percentual_contrato' ? `${b.valor}% do contrato` : brl(b.valor)
  const custoMensal = s.beneficiarios.reduce((a, v) => { const b = s.beneficios.find((x) => x.id === v.beneficioId); return a + (b?.aplicadoComo !== 'percentual_contrato' && b?.periodicidade === 'mensal' ? (b.valor ?? 0) * (1 + v.dependentesIds.length) : 0) }, 0)

  const vinculos = useMemo(() => s.beneficiarios.filter((v) => !q.trim() || `${s.nomeDe(v.colaboradorId)} ${s.beneficios.find((b) => b.id === v.beneficioId)?.nome}`.toLowerCase().includes(q.trim().toLowerCase())), [s, q])

  const exportar = () => {
    if (tab === 'cadastro') baixarArquivo(gerarCSV(s.beneficios, [{ titulo: 'Benefício', valor: (b) => b.nome }, { titulo: 'Tipo', valor: (b) => (b.tipo ? TIPO_BEN[b.tipo] : '') }, { titulo: 'Fornecedor', valor: (b) => b.fornecedor ?? '' }, { titulo: 'Valor', valor: valorTxt }, { titulo: 'Periodicidade', valor: (b) => (b.periodicidade ? PERIOD[b.periodicidade] : '') }, { titulo: 'Coparticipação', valor: (b) => (b.coparticipacao != null ? `${b.coparticipacao}${b.opcaoCoparticipacao === 'percentual' ? '%' : ' R$'}` : '') }, { titulo: 'Beneficiários', valor: (b) => s.beneficiarios.filter((v) => v.beneficioId === b.id).length }]), 'beneficios.csv')
    else baixarArquivo(gerarCSV(vinculos, [{ titulo: 'Pessoa', valor: (v) => s.nomeDe(v.colaboradorId) }, { titulo: 'Benefício', valor: (v) => s.beneficios.find((b) => b.id === v.beneficioId)?.nome ?? '' }, { titulo: 'Desde', valor: (v) => v.desde }, { titulo: 'Dependentes', valor: (v) => v.dependentesIds.map((d) => s.dependentes.find((x) => x.id === d)?.nome).join(', ') }]), 'beneficiarios.csv')
    toast('Exportado.')
  }

  return (
    <>
      <PageHeader title="Benefícios" subtitle="Parcerias e benefícios de adesão opcional, beneficiários e dependentes."
        actions={<><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button variant="ghost" icon="UsersRound" onClick={() => setVincular(true)}>Vincular pessoas</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Novo benefício</Button></>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <IndicadorCard titulo="Benefícios ativos" valor={s.beneficios.filter((b) => b.ativo !== false).length} icon="HeartHandshake" definicao="Benefícios e parcerias cadastrados e ativos." fonte="Cadastro de benefícios" />
        <IndicadorCard titulo="Vínculos" valor={s.beneficiarios.length} icon="Link" tone="success" definicao="Pessoas vinculadas a benefícios (um vínculo por pessoa e benefício)." fonte="Beneficiários" />
        <IndicadorCard titulo="Dependentes" valor={s.dependentes.length} icon="Users" tone="ink" definicao="Dependentes cadastrados pelas pessoas ou pelo RH." fonte="Dependentes" />
        <IndicadorCard titulo="Custo mensal estimado" valor={brl(custoMensal)} icon="Wallet" tone="warning" definicao="Soma dos valores mensais em reais × (titular + dependentes vinculados). Não considera percentuais nem coparticipação." fonte="Cadastro de benefícios + beneficiários" />
      </div>
      <Tabs tabs={[{ key: 'cadastro', label: 'Cadastro de benefícios' }, { key: 'beneficiarios', label: `Beneficiários (${s.beneficiarios.length})` }, { key: 'dependentes', label: `Dependentes (${s.dependentes.length})` }]} active={tab} onChange={setTab} />

      {tab === 'cadastro' && (
        <Card>
          <Tabela minWidth={860}>
            <thead><tr><th className={TH}>Benefício</th><th className={TH}>Tipo</th><th className={TH}>Valor</th><th className={TH}>Periodicidade</th><th className={TH}>Coparticipação</th><th className={TH}>Beneficiários</th><th className={TH}></th></tr></thead>
            <tbody>
              {s.beneficios.map((b) => (
                <tr key={b.id} className={b.ativo === false ? 'opacity-60' : ''}>
                  <td className={TD}><div className="flex items-center gap-2.5"><span className="h-9 w-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name={b.icon} className="h-4 w-4" /></span><div><div className="font-semibold text-ink">{b.nome}</div><div className="text-[11.5px] text-muted">{b.fornecedor ?? b.categoria}</div></div></div></td>
                  <td className={TD}>{b.tipo ? TIPO_BEN[b.tipo] : '—'}{b.tipo && TIPOS_SENSIVEIS.includes(b.tipo) && <Icon name="AlertTriangle" className="h-3.5 w-3.5 text-warning inline ml-1" aria-label="tipo sensível — validar com jurídico" />}</td>
                  <td className={TD}>{valorTxt(b)}</td>
                  <td className={TD}>{b.periodicidade ? PERIOD[b.periodicidade] : '—'}</td>
                  <td className={TD}>{b.coparticipacao != null ? `${b.coparticipacao}${b.opcaoCoparticipacao === 'percentual' ? '%' : ` (${brl(b.coparticipacao)})`}` : '—'}</td>
                  <td className={TD}>{s.beneficiarios.filter((v) => v.beneficioId === b.id).length}</td>
                  <td className={TD}><div className="flex gap-1 justify-end"><Button size="icon-sm" variant="subtle" icon="Pencil" aria-label="Editar" onClick={() => setForm({ aberto: true, b })} /><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover" onClick={() => setRemover(b)} /></div></td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        </Card>
      )}

      {tab === 'beneficiarios' && (
        <>
          <div className="flex gap-3 mb-4"><SearchBox value={q} onChange={setQ} placeholder="Pessoa ou benefício" label="Buscar beneficiários" /></div>
          <Card>
            {vinculos.length === 0 ? <EmptyState icon="Link" title="Nenhum vínculo" action={<Button icon="UsersRound" onClick={() => setVincular(true)}>Vincular pessoas</Button>} /> : (
              <Tabela minWidth={720}>
                <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Benefício</th><th className={TH}>Desde</th><th className={TH}>Dependentes</th><th className={TH}></th></tr></thead>
                <tbody>
                  {vinculos.map((v) => (
                    <tr key={v.id}>
                      <td className={TD}><Link to={`/rh/pessoas/${v.colaboradorId}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(v.colaboradorId)}</Link></td>
                      <td className={TD}>{s.beneficios.find((b) => b.id === v.beneficioId)?.nome}</td>
                      <td className={TD}>{fmtDate(v.desde)}</td>
                      <td className={TD}>{v.dependentesIds.length ? v.dependentesIds.map((d) => s.dependentes.find((x) => x.id === d)?.nome).join(', ') : '—'}</td>
                      <td className={TD}><Button size="sm" variant="subtle" icon="Unlink" onClick={() => feedback(s.desvincularBeneficiario(v.id), 'Vínculo removido.')}>Desvincular</Button></td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            )}
          </Card>
        </>
      )}

      {tab === 'dependentes' && (
        <Card>
          {s.dependentes.length === 0 ? <EmptyState icon="Users" title="Nenhum dependente" desc="As próprias pessoas podem cadastrar dependentes em Meu perfil." /> : (
            <Tabela minWidth={600}>
              <thead><tr><th className={TH}>Dependente</th><th className={TH}>Parentesco</th><th className={TH}>Titular</th><th className={TH}>Nascimento</th><th className={TH}>Benefícios</th></tr></thead>
              <tbody>{s.dependentes.map((d) => <tr key={d.id}><td className={TD}>{d.nome}</td><td className={TD}>{d.parentesco}</td><td className={TD}><Link to={`/rh/pessoas/${d.colaboradorId}`} className="text-ink hover:text-brand font-semibold">{s.nomeDe(d.colaboradorId)}</Link></td><td className={TD}>{fmtDate(d.nascimento)}</td><td className={TD}>{s.beneficiarios.filter((v) => v.dependentesIds.includes(d.id)).map((v) => s.beneficios.find((b) => b.id === v.beneficioId)?.nome).join(', ') || '—'}</td></tr>)}</tbody>
            </Tabela>
          )}
        </Card>
      )}

      {form.aberto && <BeneficioForm b={form.b} onClose={() => setForm({ aberto: false })} />}
      {vincular && <VincularModal onClose={() => setVincular(false)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover benefício?" confirmar="Remover" texto="Só é possível remover benefícios sem pessoas vinculadas."
        onConfirm={() => { if (remover && feedback(s.removerBeneficio(remover.id), 'Benefício removido.')) setRemover(null) }} />
    </>
  )
}

function BeneficioForm({ b, onClose }: { b?: Beneficio; onClose: () => void }) {
  const s = useStore()
  const [f, setF] = useState<Omit<Beneficio, 'id'>>(() => ({
    nome: b?.nome ?? '', categoria: b?.categoria ?? 'Bem-estar', descricao: b?.descricao ?? '', icon: b?.icon ?? 'Gift', elegibilidade: b?.elegibilidade ?? 'Adesão opcional.', comoUsar: b?.comoUsar ?? '',
    tipo: b?.tipo ?? 'outro', fornecedor: b?.fornecedor ?? '', valor: b?.valor ?? 0, aplicadoComo: b?.aplicadoComo ?? 'reais', periodicidade: b?.periodicidade ?? 'mensal',
    coparticipacao: b?.coparticipacao, opcaoCoparticipacao: b?.opcaoCoparticipacao ?? 'percentual', permiteDependentes: b?.permiteDependentes ?? false, ativo: b?.ativo ?? true,
  }))
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  return (
    <Modal open onClose={onClose} wide title={b ? 'Editar benefício' : 'Novo benefício'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={() => { if (feedback(s.salvarBeneficio({ ...f, nome: f.nome.trim() }, b?.id), 'Benefício salvo.')) onClose() }}>Salvar</Button></>}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Nome" required htmlFor="bn-n"><input id="bn-n" className="input" value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
        <Field label="Tipo" htmlFor="bn-t"><Dropdown id="bn-t" className="input" value={f.tipo} onChange={(e) => set({ tipo: e.target.value as TipoBeneficio })}>{Object.entries(TIPO_BEN).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
        <Field label="Fornecedor" htmlFor="bn-f"><input id="bn-f" className="input" value={f.fornecedor} onChange={(e) => set({ fornecedor: e.target.value })} /></Field>
        <Field label="Categoria no portal" htmlFor="bn-c"><Dropdown id="bn-c" className="input" value={f.categoria} onChange={(e) => set({ categoria: e.target.value as Beneficio['categoria'] })}>{['Bem-estar', 'Saúde', 'Educação', 'Desconto'].map((c) => <option key={c}>{c}</option>)}</Dropdown></Field>
        <Field label="Valor do benefício" htmlFor="bn-v"><input id="bn-v" type="number" min={0} step="any" className="input" value={f.valor ?? ''} onChange={(e) => set({ valor: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
        <Field label="Aplicado como" htmlFor="bn-a"><Dropdown id="bn-a" className="input" value={f.aplicadoComo} onChange={(e) => set({ aplicadoComo: e.target.value as Beneficio['aplicadoComo'] })}><option value="reais">Em reais</option><option value="percentual_contrato">% do valor do contrato</option></Dropdown></Field>
        <Field label="Periodicidade" htmlFor="bn-p"><Dropdown id="bn-p" className="input" value={f.periodicidade} onChange={(e) => set({ periodicidade: e.target.value as Beneficio['periodicidade'] })}>{Object.entries(PERIOD).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
        <div className="grid grid-cols-[1fr_130px] gap-2">
          <Field label="Coparticipação" htmlFor="bn-co"><input id="bn-co" type="number" min={0} step="any" className="input" value={f.coparticipacao ?? ''} onChange={(e) => set({ coparticipacao: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
          <Field label="Como" htmlFor="bn-oc"><Dropdown id="bn-oc" className="input" value={f.opcaoCoparticipacao} onChange={(e) => set({ opcaoCoparticipacao: e.target.value as Beneficio['opcaoCoparticipacao'] })}><option value="percentual">%</option><option value="valor_fixo">R$ fixo</option></Dropdown></Field>
        </div>
        <Field label="Descrição (portal)" htmlFor="bn-d" className="sm:col-span-2"><input id="bn-d" className="input" value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
        <Field label="Elegibilidade" htmlFor="bn-e"><input id="bn-e" className="input" value={f.elegibilidade} onChange={(e) => set({ elegibilidade: e.target.value })} /></Field>
        <Field label="Como usar" htmlFor="bn-u"><input id="bn-u" className="input" value={f.comoUsar} onChange={(e) => set({ comoUsar: e.target.value })} /></Field>
      </div>
      <div className="flex flex-wrap gap-6 mb-3"><Toggle checked={!!f.permiteDependentes} onChange={(v) => set({ permiteDependentes: v })} label="Permite dependentes" /><Toggle checked={f.ativo !== false} onChange={(v) => set({ ativo: v })} label="Ativo" /></div>
      {f.tipo && TIPOS_SENSIVEIS.includes(f.tipo) && <Callout tone="warning" icon="Scale">“{TIPO_BEN[f.tipo]}” é típico de relação de emprego. Para prestadores PJ, valide com o jurídico antes de oferecer — pode ser interpretado como indício de vínculo.</Callout>}
    </Modal>
  )
}

function VincularModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [beneficio, setBeneficio] = useState(s.beneficios.find((b) => b.ativo !== false)?.id ?? '')
  const [area, setArea] = useState('')
  const [funcao, setFuncao] = useState('')
  const [sel, setSel] = useState<string[]>([])
  const [deps, setDeps] = useState<Record<string, string[]>>({})
  const b = s.beneficios.find((x) => x.id === beneficio)
  const pessoas = s.colaboradores.filter((c) => c.status !== 'encerrado' && (!area || c.setorId === area) && (!funcao || c.cargoId === funcao) && !s.beneficiarios.some((v) => v.beneficioId === beneficio && v.colaboradorId === c.id))
  return (
    <Modal open onClose={onClose} wide title="Vincular pessoas a um benefício" subtitle="Vínculo individual ou em lote (por área e função). Vínculos já existentes são ignorados."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Link" disabled={!sel.length} onClick={() => { if (feedback(s.vincularBeneficiarios(beneficio, sel, deps), 'Vínculos criados.')) onClose() }}>Vincular {sel.length || ''}</Button></>}>
      <div className="grid sm:grid-cols-3 gap-3 mb-4">
        <Field label="Benefício" htmlFor="vb-b"><Dropdown id="vb-b" className="input" value={beneficio} onChange={(e) => { setBeneficio(e.target.value); setSel([]) }}>{s.beneficios.filter((x) => x.ativo !== false).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Dropdown></Field>
        <Field label="Área" htmlFor="vb-a"><Dropdown id="vb-a" className="input" value={area} onChange={(e) => setArea(e.target.value)}><option value="">Todas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Dropdown></Field>
        <Field label="Função" htmlFor="vb-f"><Dropdown id="vb-f" className="input" value={funcao} onChange={(e) => setFuncao(e.target.value)}><option value="">Todas</option>{s.cargos.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Dropdown></Field>
      </div>
      <SeletorPessoas pessoas={pessoas} selecionadas={sel} onChange={setSel} extra={(c) => b?.permiteDependentes ? (
        <span className="flex gap-1" onClick={(e) => e.stopPropagation()}>
          {s.dependentes.filter((d) => d.colaboradorId === c.id).map((d) => { const on = (deps[c.id] ?? []).includes(d.id); return <button key={d.id} type="button" onClick={(e) => { e.preventDefault(); setDeps({ ...deps, [c.id]: on ? deps[c.id].filter((x) => x !== d.id) : [...(deps[c.id] ?? []), d.id] }) }} className={`text-[10.5px] rounded-full px-2 py-0.5 border ${on ? 'bg-brand text-white border-brand' : 'border-line text-muted'}`}>+ {d.nome.split(' ')[0]}</button> })}
        </span>) : null} />
      {b?.tipo && TIPOS_SENSIVEIS.includes(b.tipo) && <Callout tone="warning" icon="Scale" className="mt-3">Tipo de benefício sensível para o modelo PJ — valide com o jurídico.</Callout>}
    </Modal>
  )
}
