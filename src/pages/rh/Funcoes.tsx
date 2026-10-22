import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Cargo, PerfilDisc, Senioridade } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, Icon, Toggle, EmptyState, SearchBox, Select, Tabela, TH, TD, Avatar, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { TagInput, SliderBipolar, useOrdenacao, ThOrdenavel } from '@/components/inputs'
import { BarrasDisc } from '@/components/charts'
import { feedback, toast } from '@/components/toast'
import { brl, cn } from '@/lib/utils'
import { CATEGORIAS_DISC, TRACOS, DISC_NEUTRO, discDominante, tracosPadrao, compatibilidadeFuncao } from '@/domain/perfil'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { Dropdown } from '@/components/Dropdown'

const NIVEIS: Senioridade[] = ['Júnior', 'Pleno', 'Sênior', 'Especialista', 'Liderança']

export default function Funcoes() {
  const s = useStore()
  const [tab, setTab] = useState('lista')
  const [q, setQ] = useState('')
  const [area, setArea] = useState('todas')
  const [discF, setDiscF] = useState<string[]>([])
  const [form, setForm] = useState<{ aberto: boolean; c?: Cargo }>({ aberto: false })
  const [ver, setVer] = useState<Cargo | null>(null)

  const lista = useMemo(() => s.cargos
    .filter((c) => area === 'todas' || c.setorId === area)
    .filter((c) => !q.trim() || `${c.nome} ${c.codigoCBO ?? ''}`.toLowerCase().includes(q.trim().toLowerCase()))
    .filter((c) => !discF.length || (c.perfilIdeal && discF.includes(discDominante(c.perfilIdeal.disc)!.chave))), [s.cargos, area, q, discF])
  const pessoasDe = (id: string) => s.colaboradores.filter((p) => p.cargoId === id && p.status !== 'encerrado').length
  const { ordenados, ordem, onOrdenar } = useOrdenacao(lista, {
    nome: (c) => c.nome, area: (c) => s.setorNome(c.setorId), nivel: (c) => NIVEIS.indexOf(c.nivel), pessoas: (c) => pessoasDe(c.id), faixa: (c) => c.faixaValor?.min ?? 0,
  }, 'nome')

  const exportar = () => {
    baixarArquivo(gerarCSV(ordenados, [
      { titulo: 'Função', valor: (c) => c.nome }, { titulo: 'Área', valor: (c) => s.setorNome(c.setorId) }, { titulo: 'Senioridade', valor: (c) => c.nivel },
      { titulo: 'CBO', valor: (c) => c.codigoCBO ?? '' }, { titulo: 'Função superior', valor: (c) => s.cargos.find((x) => x.id === c.funcaoSuperiorId)?.nome ?? '' },
      { titulo: 'Faixa mínima', valor: (c) => c.faixaValor?.min ?? '' }, { titulo: 'Faixa máxima', valor: (c) => c.faixaValor?.max ?? '' },
      { titulo: 'Perfil dominante', valor: (c) => discDominante(c.perfilIdeal?.disc)?.label ?? '' }, { titulo: 'Habilidades', valor: (c) => (c.habilidades ?? []).join(', ') },
      { titulo: 'Pessoas', valor: (c) => pessoasDe(c.id) },
    ]), 'funcoes.csv')
    toast('Funções exportadas.')
  }

  return (
    <>
      <PageHeader title="Engenharia de funções" subtitle="Funções da prestação de serviços: atividades, habilidades, faixa de valor e perfil comportamental ideal."
        actions={<><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Nova função</Button></>} />
      <Tabs tabs={[{ key: 'lista', label: `Funções (${s.cargos.length})` }, { key: 'organograma', label: 'Organograma de funções' }]} active={tab} onChange={setTab} />

      {tab === 'lista' && (
        <div className="grid lg:grid-cols-[1fr_240px] gap-6 [&>*]:min-w-0">
          <div>
            <div className="flex flex-wrap gap-3 mb-4">
              <SearchBox value={q} onChange={setQ} placeholder="Nome ou CBO" label="Buscar funções" />
              <Select label="Área" value={area} onChange={setArea}><option value="todas">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
            </div>
            <Card>
              {ordenados.length === 0 ? <EmptyState icon="Briefcase" title="Nenhuma função encontrada" /> : (
                <Tabela minWidth={760}>
                  <thead><tr>
                    <ThOrdenavel className={TH} campo="nome" ordem={ordem} onOrdenar={onOrdenar}>Função</ThOrdenavel>
                    <th className={TH}>Perfil</th>
                    <ThOrdenavel className={TH} campo="nivel" ordem={ordem} onOrdenar={onOrdenar}>Senioridade</ThOrdenavel>
                    <th className={TH}>CBO</th>
                    <ThOrdenavel className={TH} campo="faixa" ordem={ordem} onOrdenar={onOrdenar}>Faixa de valor</ThOrdenavel>
                    <ThOrdenavel className={TH} campo="pessoas" ordem={ordem} onOrdenar={onOrdenar}>Pessoas</ThOrdenavel>
                  </tr></thead>
                  <tbody>
                    {ordenados.map((c) => {
                      const dom = discDominante(c.perfilIdeal?.disc)
                      return (
                        <tr key={c.id} className="hover:bg-brand-50/40 cursor-pointer" onClick={() => setVer(c)}>
                          <td className={TD}><div className="font-semibold text-ink">{c.nome}</div><div className="text-[11.5px] text-muted">{s.setorNome(c.setorId)}</div></td>
                          <td className={TD}>{dom ? <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold"><span className="h-2.5 w-2.5 rounded-full" style={{ background: dom.cor }} />{dom.label}</span> : <span className="text-muted">—</span>}</td>
                          <td className={TD}><Badge tone="neutral">{c.nivel}</Badge></td>
                          <td className={TD}>{c.codigoCBO ?? '—'}</td>
                          <td className={TD}>{c.faixaValor?.min != null || c.faixaValor?.max != null ? <span className="text-[12.5px]">{brl(c.faixaValor?.min ?? 0)} – {brl(c.faixaValor?.max ?? 0)}{!c.faixaValor?.visivel && <Icon name="EyeOff" className="h-3.5 w-3.5 inline ml-1.5 text-muted" aria-label="oculta para a pessoa" />}</span> : '—'}</td>
                          <td className={TD}>{pessoasDe(c.id)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </Tabela>
              )}
            </Card>
          </div>
          <Card className="p-4 self-start">
            <h3 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3">Filtros · perfil ideal</h3>
            {CATEGORIAS_DISC.map((d) => (
              <label key={d.chave} className="flex items-center gap-2.5 py-1.5 text-[13px] cursor-pointer">
                <input type="checkbox" className="h-4 w-4 accent-brand" checked={discF.includes(d.chave)} onChange={() => setDiscF((x) => (x.includes(d.chave) ? x.filter((y) => y !== d.chave) : [...x, d.chave]))} />
                <span className="h-2.5 w-2.5 rounded-full" style={{ background: d.cor }} />{d.label}
              </label>
            ))}
            {discF.length > 0 && <button type="button" className="text-[12px] text-brand font-semibold mt-2" onClick={() => setDiscF([])}>Limpar filtros</button>}
          </Card>
        </div>
      )}

      {tab === 'organograma' && <Organograma onAbrir={setVer} />}

      {ver && <FuncaoDetalhe c={s.cargos.find((x) => x.id === ver.id) ?? ver} onClose={() => setVer(null)} onEditar={() => { setForm({ aberto: true, c: ver }); setVer(null) }} />}
      {form.aberto && <FuncaoForm c={form.c} onClose={() => setForm({ aberto: false })} />}
    </>
  )
}

function Organograma({ onAbrir }: { onAbrir: (c: Cargo) => void }) {
  const s = useStore()
  const raiz = s.cargos.filter((c) => !c.funcaoSuperiorId || !s.cargos.some((x) => x.id === c.funcaoSuperiorId))
  const filhos = (id: string) => s.cargos.filter((c) => c.funcaoSuperiorId === id)
  const No = ({ c, nivel }: { c: Cargo; nivel: number }): JSX.Element => (
    <li>
      <button type="button" onClick={() => onAbrir(c)} className="w-full min-w-0 flex items-center gap-2.5 rounded-xl border border-line bg-surface px-3 py-2 hover:border-brand hover:shadow-sm transition text-left" data-nivel={nivel}>
        <span className="h-2 w-2 rounded-full shrink-0" style={{ background: s.setores.find((a) => a.id === c.setorId)?.cor }} />
        <span className="text-[13px] font-semibold text-ink truncate">{c.nome}</span>
        <span className="text-[11.5px] text-muted ml-auto shrink-0 whitespace-nowrap">{c.nivel} · {s.colaboradores.filter((p) => p.cargoId === c.id && p.status !== 'encerrado').length} pessoa(s)</span>
      </button>
      {filhos(c.id).length > 0 && <ul className="mt-2 space-y-2 border-l-2 border-dashed border-line ml-3 pl-3">{filhos(c.id).map((f) => <No key={f.id} c={f} nivel={nivel + 1} />)}</ul>}
    </li>
  )
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {s.setores.map((a) => {
        const daArea = raiz.filter((c) => c.setorId === a.id)
        if (!daArea.length) return null
        return (
          <Card key={a.id}>
            <CardHead title={a.nome} sub="Hierarquia de funções (função superior)" />
            <ul className="p-4 space-y-2">{daArea.map((c) => <No key={c.id} c={c} nivel={0} />)}</ul>
          </Card>
        )
      })}
    </div>
  )
}

function FuncaoDetalhe({ c, onClose, onEditar }: { c: Cargo; onClose: () => void; onEditar: () => void }) {
  const s = useStore()
  const [remover, setRemover] = useState(false)
  const pessoas = s.colaboradores.filter((p) => p.cargoId === c.id && p.status !== 'encerrado')
  return (
    <Modal open onClose={onClose} wide title={c.nome} subtitle={`${s.setorNome(c.setorId)} · ${c.nivel}${c.codigoCBO ? ` · CBO ${c.codigoCBO}` : ''}`}
      footer={<><Button variant="subtle" icon="Trash2" onClick={() => setRemover(true)}>Remover</Button><Link to={`/cargos/${c.id}`}><Button variant="ghost" icon="FileBadge">Ficha oficial do cargo</Button></Link><Button variant="ghost" icon="Pencil" onClick={onEditar}>Editar</Button><Button onClick={onClose}>Fechar</Button></>}>
      {c.descricao && <p className="text-[13.5px] text-ink-2 mb-4">{c.descricao}</p>}
      <div className="grid md:grid-cols-2 gap-5">
        <div>
          <h4 className="text-[11px] font-bold uppercase text-muted mb-2">Atividades</h4>
          {c.atividades ? <ul className="text-[13px] text-ink-2 space-y-1 list-disc pl-5">{c.atividades.split('\n').map((l) => l.replace(/^\s*-\s*/, '')).filter(Boolean).map((l, i) => <li key={i}>{l}</li>)}</ul> : <p className="text-[13px] text-muted">Não informadas.</p>}
          <h4 className="text-[11px] font-bold uppercase text-muted mb-2 mt-4">Habilidades</h4>
          <div className="flex flex-wrap gap-1.5">{(c.habilidades ?? []).map((h) => <Badge key={h} tone="brand">{h}</Badge>)}{!c.habilidades?.length && <span className="text-[13px] text-muted">—</span>}</div>
          {!!c.requisitos?.length && <><h4 className="text-[11px] font-bold uppercase text-muted mb-2 mt-4">Requisitos</h4><div className="flex flex-wrap gap-1.5">{c.requisitos.map((h) => <Badge key={h} tone="neutral">{h}</Badge>)}</div></>}
          <h4 className="text-[11px] font-bold uppercase text-muted mb-2 mt-4">Faixa de valor de referência</h4>
          <p className="text-[13px] text-ink">{c.faixaValor?.min != null ? `${brl(c.faixaValor.min)} – ${brl(c.faixaValor.max ?? 0)}` : '—'} {c.faixaValor && <span className="text-muted">· {c.faixaValor.visivel ? 'visível às pessoas da função' : 'restrita ao RH'}</span>}</p>
          {c.funcaoSuperiorId && <p className="text-[12.5px] text-muted mt-3">Função superior: <b className="text-ink">{s.cargos.find((x) => x.id === c.funcaoSuperiorId)?.nome}</b></p>}
        </div>
        <div>
          <h4 className="text-[11px] font-bold uppercase text-muted mb-2">Perfil comportamental ideal</h4>
          {c.perfilIdeal ? <BarrasDisc valores={CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: c.perfilIdeal!.disc[d.chave], cor: d.cor }))} /> : <p className="text-[13px] text-muted">Não definido.</p>}
          <h4 className="text-[11px] font-bold uppercase text-muted mb-2 mt-4">Pessoas nesta função ({pessoas.length})</h4>
          <ul className="space-y-1.5">
            {pessoas.map((p) => {
              const comp = c.perfilIdeal && p.perfil?.consentimento ? compatibilidadeFuncao(c.perfilIdeal, p.perfil) : null
              return (
                <li key={p.id} className="flex items-center gap-2.5 text-[13px]">
                  <Avatar nome={p.nome} cor={p.avatarCor} size="sm" className="!h-6 !w-6 !text-[9px]" />
                  <Link to={`/rh/pessoas/${p.id}`} className="flex-1 font-medium text-ink hover:text-brand">{p.nome}</Link>
                  {comp != null && <Badge tone={comp >= 75 ? 'success' : comp >= 55 ? 'gold' : 'neutral'} className="tabular-nums">{comp}% aderência</Badge>}
                </li>
              )
            })}
          </ul>
          {pessoas.some((p) => !p.perfil?.consentimento) && <p className="text-[11.5px] text-muted mt-2">A aderência só aparece para quem registrou o perfil com consentimento.</p>}
        </div>
      </div>
      <ConfirmModal open={remover} onClose={() => setRemover(false)} titulo="Remover função?" confirmar="Remover" texto="Só é possível remover funções sem pessoas ativas."
        onConfirm={() => { if (feedback(s.removeCargo(c.id), 'Função removida.')) { setRemover(false); onClose() } }} />
    </Modal>
  )
}

function FuncaoForm({ c, onClose }: { c?: Cargo; onClose: () => void }) {
  const s = useStore()
  const [aba, setAba] = useState('geral')
  const [f, setF] = useState<Omit<Cargo, 'id'>>(() => ({
    nome: c?.nome ?? '', setorId: c?.setorId ?? s.setores[0]?.id ?? '', nivel: c?.nivel ?? 'Pleno', descricao: c?.descricao ?? '',
    codigoCBO: c?.codigoCBO ?? '', funcaoSuperiorId: c?.funcaoSuperiorId, atividades: c?.atividades ?? '', habilidades: c?.habilidades ?? [], requisitos: c?.requisitos ?? [],
    responsaveisIds: c?.responsaveisIds ?? [], faixaValor: c?.faixaValor ?? { visivel: false },
    perfilIdeal: c?.perfilIdeal ?? { disc: { ...DISC_NEUTRO }, tracos: tracosPadrao() },
  }))
  const set = (p: Partial<typeof f>) => setF((x) => ({ ...x, ...p }))
  const setDisc = (k: keyof PerfilDisc, v: number) => set({ perfilIdeal: { ...f.perfilIdeal!, disc: { ...f.perfilIdeal!.disc, [k]: v } } })
  const salvar = () => {
    const r = s.salvarCargo({ ...f, codigoCBO: f.codigoCBO?.trim() || undefined, descricao: f.descricao?.trim() || undefined, atividades: f.atividades?.trim() || undefined }, c?.id)
    if (feedback(r, c ? 'Função atualizada.' : 'Função criada.')) onClose()
  }
  return (
    <Modal open onClose={onClose} wide title={c ? `Editar ${c.nome}` : 'Nova função'} footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" onClick={salvar}>Salvar</Button></>}>
      <Tabs tabs={[{ key: 'geral', label: 'Geral' }, { key: 'atividades', label: 'Atividades & habilidades' }, { key: 'valor', label: 'Faixa de valor' }, { key: 'perfil', label: 'Perfil ideal' }]} active={aba} onChange={setAba} />
      {aba === 'geral' && (
        <div className="grid sm:grid-cols-2 gap-x-4">
          <Field label="Nome" required htmlFor="fn-n"><input id="fn-n" className="input" value={f.nome} onChange={(e) => set({ nome: e.target.value })} /></Field>
          <Field label="Área" htmlFor="fn-a"><Dropdown id="fn-a" className="input" value={f.setorId} onChange={(e) => set({ setorId: e.target.value })}>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Dropdown></Field>
          <Field label="Senioridade" htmlFor="fn-s"><Dropdown id="fn-s" className="input" value={f.nivel} onChange={(e) => set({ nivel: e.target.value as Senioridade })}>{NIVEIS.map((n) => <option key={n}>{n}</option>)}</Dropdown></Field>
          <Field label="CBO (opcional)" htmlFor="fn-c" hint="Formato 0000-00"><input id="fn-c" className="input" value={f.codigoCBO} onChange={(e) => set({ codigoCBO: e.target.value })} placeholder="2124-05" /></Field>
          <Field label="Função superior" htmlFor="fn-sup"><Dropdown id="fn-sup" className="input" value={f.funcaoSuperiorId ?? ''} onChange={(e) => set({ funcaoSuperiorId: e.target.value || undefined })}><option value="">Nenhuma</option>{s.cargos.filter((x) => x.id !== c?.id).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Dropdown></Field>
          <Field label="Responsáveis pela função" htmlFor="fn-r">
            <Dropdown id="fn-r" className="input" multiple size={4} value={f.responsaveisIds} onChange={(e) => set({ responsaveisIds: [...e.target.selectedOptions].map((o) => o.value) })}>
              {s.colaboradores.filter((p) => p.status !== 'encerrado' && p.papel !== 'colaborador').map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
            </Dropdown>
          </Field>
          <Field label="Descrição" htmlFor="fn-d" className="sm:col-span-2"><textarea id="fn-d" rows={2} className="input !h-auto py-2.5" value={f.descricao} onChange={(e) => set({ descricao: e.target.value })} /></Field>
        </div>
      )}
      {aba === 'atividades' && (
        <>
          <Field label="Atividades e responsabilidades" hint="Uma por linha (comece com “- ” para marcadores)." htmlFor="fn-at"><textarea id="fn-at" rows={6} className="input !h-auto py-2.5 font-mono text-[12.5px]" value={f.atividades} onChange={(e) => set({ atividades: e.target.value })} /></Field>
          <Field label="Habilidades"><TagInput label="Habilidades" valor={f.habilidades ?? []} onChange={(v) => set({ habilidades: v })} /></Field>
          <Field label="Requisitos"><TagInput label="Requisitos" valor={f.requisitos ?? []} onChange={(v) => set({ requisitos: v })} /></Field>
        </>
      )}
      {aba === 'valor' && (
        <>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Valor mínimo (R$)" htmlFor="fn-min"><input id="fn-min" type="number" min={0} className="input" value={f.faixaValor?.min ?? ''} onChange={(e) => set({ faixaValor: { ...f.faixaValor!, min: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>
            <Field label="Valor máximo (R$)" htmlFor="fn-max"><input id="fn-max" type="number" min={0} className="input" value={f.faixaValor?.max ?? ''} onChange={(e) => set({ faixaValor: { ...f.faixaValor!, max: e.target.value === '' ? undefined : Number(e.target.value) } })} /></Field>
          </div>
          <Toggle checked={!!f.faixaValor?.visivel} onChange={(v) => set({ faixaValor: { ...f.faixaValor!, visivel: v } })} label="Visível para as pessoas desta função" />
          <Callout tone="neutral" icon="Info" className="mt-4">Faixa de referência para negociação de contratos de prestação de serviços desta função (equivale ao piso do sistema de RH).</Callout>
        </>
      )}
      {aba === 'perfil' && (
        <div className="space-y-5">
          <div>
            <h4 className="text-[12px] font-bold uppercase text-muted mb-2">Perfil DISC ideal</h4>
            <div className="grid sm:grid-cols-2 gap-x-6">{CATEGORIAS_DISC.map((d) => <SliderBipolar key={d.chave} esquerda={`${d.label}: ${f.perfilIdeal!.disc[d.chave]}`} valor={f.perfilIdeal!.disc[d.chave]} cor={d.cor} onChange={(v) => setDisc(d.chave, v)} />)}</div>
          </div>
          <div>
            <h4 className="text-[12px] font-bold uppercase text-muted mb-2">Traços comportamentais (24)</h4>
            <div className="grid sm:grid-cols-2 gap-x-6">{TRACOS.map((t) => <SliderBipolar key={t.chave} esquerda={t.esquerda} direita={t.direita} valor={f.perfilIdeal!.tracos[t.chave] ?? 50} onChange={(v) => set({ perfilIdeal: { ...f.perfilIdeal!, tracos: { ...f.perfilIdeal!.tracos, [t.chave]: v } } })} />)}</div>
          </div>
        </div>
      )}
      <p className={cn('text-[11.5px] text-muted mt-3')}>O perfil ideal orienta conversas e buscas; não deve ser usado como critério automático de decisão.</p>
    </Modal>
  )
}
