import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Senioridade, Setor, Unidade } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, Icon, Toggle, EmptyState } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn } from '@/lib/utils'

const ICONES = ['Sparkles', 'Cpu', 'Target', 'Scale', 'Wallet', 'HeartHandshake', 'Megaphone', 'Rocket', 'Briefcase', 'Building2']
const CORES = ['#0032D2', '#0891b2', '#0f9d6b', '#7c3aed', '#c98a12', '#db2777', '#ea580c', '#122029']
const NIVEIS: Senioridade[] = ['Júnior', 'Pleno', 'Sênior', 'Especialista', 'Liderança']

export default function Estrutura() {
  const [tab, setTab] = useState('areas')
  return (
    <>
      <PageHeader title="Estrutura" subtitle="Áreas e suas lideranças, funções, unidades e listas usadas nos cadastros." />
      <Tabs tabs={[{ key: 'areas', label: 'Áreas' }, { key: 'funcoes', label: 'Funções' }, { key: 'unidades', label: 'Unidades' }, { key: 'listas', label: 'Listas' }]} active={tab} onChange={setTab} />
      {tab === 'areas' && <Areas />}
      {tab === 'funcoes' && <><div className="flex justify-end mb-3"><Link to="/rh/funcoes"><Button variant="soft" icon="Briefcase">Abrir Engenharia de funções</Button></Link></div><Funcoes /></>}
      {tab === 'unidades' && <Unidades />}
      {tab === 'listas' && <Listas />}
    </>
  )
}

function Areas() {
  const s = useStore()
  const [form, setForm] = useState<Partial<Setor> | null>(null)
  const [remover, setRemover] = useState<Setor | null>(null)
  const pessoas = s.colaboradores.filter((c) => c.status !== 'encerrado').sort((a, b) => a.nome.localeCompare(b.nome))
  const salvar = () => {
    if (!form) return
    const r = s.salvarSetor({ nome: (form.nome ?? '').trim(), descricao: form.descricao ?? '', cor: form.cor ?? CORES[0], icon: form.icon ?? 'Building2', gestorId: form.liderancaIds?.[0] ?? null, liderancaIds: form.liderancaIds ?? [], reembolsoApenasLideranca: !!form.reembolsoApenasLideranca, unidadeId: form.unidadeId || undefined,
      localizacao: form.localizacao?.trim() || undefined, telefone: form.telefone?.trim() || undefined, ramal: form.ramal?.trim() || undefined, email: form.email?.trim() || undefined, orcamentoMensal: form.orcamentoMensal || undefined }, form.id)
    if (feedback(r, form.id ? 'Área atualizada.' : 'Área criada.')) setForm(null)
  }
  return (
    <>
      <div className="flex justify-end mb-3"><Button icon="Plus" onClick={() => setForm({ cor: CORES[0], icon: 'Building2', liderancaIds: [] })}>Nova área</Button></div>
      <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-4">
        {s.setores.map((a) => {
          const qtd = s.colaboradores.filter((c) => c.setorId === a.id && c.status !== 'encerrado').length
          return (
            <Card key={a.id} className="p-5">
              <div className="flex items-start gap-3">
                <span className="h-11 w-11 rounded-xl flex items-center justify-center text-white shrink-0" style={{ background: a.cor }}><Icon name={a.icon} className="h-5 w-5" /></span>
                <div className="flex-1 min-w-0"><h3 className="text-[15px] font-bold text-ink">{a.nome}</h3><p className="text-[12.5px] text-muted">{a.descricao}</p></div>
              </div>
              <dl className="mt-4 space-y-1.5 text-[12.5px]">
                <div className="flex gap-2"><dt className="text-muted w-24 shrink-0">Pessoas</dt><dd className="font-semibold text-ink">{qtd}</dd></div>
                <div className="flex gap-2"><dt className="text-muted w-24 shrink-0">Lideranças</dt><dd className="font-semibold text-ink">{a.liderancaIds.map((id) => s.nomeDe(id)).join(', ') || '—'}</dd></div>
                <div className="flex gap-2"><dt className="text-muted w-24 shrink-0">Unidade</dt><dd className="text-ink-2">{s.unidades.find((u) => u.id === a.unidadeId)?.nome ?? '—'}{a.localizacao ? ` · ${a.localizacao}` : ''}</dd></div>
                {(a.email || a.telefone) && <div className="flex gap-2"><dt className="text-muted w-24 shrink-0">Contato</dt><dd className="text-ink-2">{[a.email, a.telefone && `${a.telefone}${a.ramal ? ` r.${a.ramal}` : ''}`].filter(Boolean).join(' · ')}</dd></div>}
                {a.orcamentoMensal != null && <div className="flex gap-2"><dt className="text-muted w-24 shrink-0">Orçamento</dt><dd className="text-ink-2">{a.orcamentoMensal.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}/mês</dd></div>}
                {a.reembolsoApenasLideranca && <div><Badge tone="gold">Reembolsos só por lideranças</Badge></div>}
              </dl>
              <div className="flex gap-2 mt-4"><Button size="sm" variant="ghost" icon="Pencil" onClick={() => setForm({ ...a })}>Editar</Button><Button size="sm" variant="subtle" icon="Trash2" onClick={() => setRemover(a)}>Remover</Button></div>
            </Card>
          )
        })}
      </div>
      <Modal open={!!form} onClose={() => setForm(null)} wide title={form?.id ? 'Editar área' : 'Nova área'} footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button icon="Check" onClick={salvar}>Salvar</Button></>}>
        {form && (
          <>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Nome" required htmlFor="ar-n"><input id="ar-n" className="input" value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
              <Field label="Unidade" htmlFor="ar-u"><select id="ar-u" className="input" value={form.unidadeId ?? ''} onChange={(e) => setForm({ ...form, unidadeId: e.target.value })}><option value="">—</option>{s.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</select></Field>
              <Field label="Descrição" htmlFor="ar-d" className="sm:col-span-2"><input id="ar-d" className="input" value={form.descricao ?? ''} onChange={(e) => setForm({ ...form, descricao: e.target.value })} /></Field>
              <Field label="Localização" htmlFor="ar-l"><input id="ar-l" className="input" value={form.localizacao ?? ''} onChange={(e) => setForm({ ...form, localizacao: e.target.value })} placeholder="Ex.: 3º andar" /></Field>
              <Field label="E-mail da área" htmlFor="ar-e"><input id="ar-e" type="email" className="input" value={form.email ?? ''} onChange={(e) => setForm({ ...form, email: e.target.value })} /></Field>
              <div className="grid grid-cols-2 gap-3"><Field label="Telefone" htmlFor="ar-t"><input id="ar-t" className="input" value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field><Field label="Ramal" htmlFor="ar-r"><input id="ar-r" className="input" value={form.ramal ?? ''} onChange={(e) => setForm({ ...form, ramal: e.target.value })} /></Field></div>
              <Field label="Orçamento mensal de referência (R$)" htmlFor="ar-o"><input id="ar-o" type="number" min={0} className="input" value={form.orcamentoMensal ?? ''} onChange={(e) => setForm({ ...form, orcamentoMensal: e.target.value === '' ? undefined : Number(e.target.value) })} /></Field>
            </div>
            <fieldset className="mb-4"><legend className="label">Cor e ícone</legend>
              <div className="flex flex-wrap gap-2 mb-2">{CORES.map((c) => <button key={c} type="button" aria-label={`Cor ${c}`} aria-pressed={form.cor === c} onClick={() => setForm({ ...form, cor: c })} className={cn('h-8 w-8 rounded-lg ring-offset-2', form.cor === c && 'ring-2 ring-ink')} style={{ background: c }} />)}</div>
              <div className="flex flex-wrap gap-2">{ICONES.map((i) => <button key={i} type="button" aria-label={`Ícone ${i}`} aria-pressed={form.icon === i} onClick={() => setForm({ ...form, icon: i })} className={cn('h-9 w-9 rounded-lg border flex items-center justify-center', form.icon === i ? 'border-brand bg-brand-50 text-brand' : 'border-line text-ink-2')}><Icon name={i} className="h-4 w-4" /></button>)}</div>
            </fieldset>
            <fieldset className="mb-4"><legend className="label">Lideranças (coordenam projetos e veem a disponibilidade da área)</legend>
              <div className="max-h-48 overflow-y-auto rounded-xl border border-line p-2 grid sm:grid-cols-2 gap-1">
                {pessoas.map((c) => { const on = (form.liderancaIds ?? []).includes(c.id); return (
                  <label key={c.id} className={cn('flex items-center gap-2 rounded-lg px-2 py-1.5 cursor-pointer', on ? 'bg-brand-50' : 'hover:bg-surface-2')}>
                    <input type="checkbox" className="h-4 w-4 accent-brand" checked={on} onChange={() => setForm({ ...form, liderancaIds: on ? form.liderancaIds!.filter((x) => x !== c.id) : [...(form.liderancaIds ?? []), c.id] })} />
                    <span className="text-[12.5px]">{c.nome}</span>
                  </label>) })}
              </div>
              <p className="text-[11.5px] text-muted mt-1.5">Para acessar o Painel da liderança, a pessoa precisa também do papel “Liderança” (em Usuários & acessos).</p>
            </fieldset>
            <Toggle checked={!!form.reembolsoApenasLideranca} onChange={(v) => setForm({ ...form, reembolsoApenasLideranca: v })} label="Somente lideranças desta área solicitam reembolsos" />
          </>
        )}
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover área?" confirmar="Remover" texto={remover ? `"${remover.nome}" e suas funções serão removidas. Só é possível se não houver pessoas ativas na área.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerSetor(remover.id), 'Área removida.')) setRemover(null) }} />
    </>
  )
}

function Funcoes() {
  const s = useStore()
  const [novo, setNovo] = useState<Record<string, { nome: string; nivel: Senioridade }>>({})
  return (
    <div className="grid md:grid-cols-2 gap-4">
      {s.setores.map((a) => {
        const f = novo[a.id] ?? { nome: '', nivel: 'Pleno' as Senioridade }
        const funcoes = s.cargos.filter((g) => g.setorId === a.id)
        return (
          <Card key={a.id}>
            <CardHead title={a.nome} sub={`${funcoes.length} função(ões)`} />
            <ul className="divide-y divide-line">
              {funcoes.map((g) => (
                <li key={g.id} className="flex items-center gap-3 px-5 py-2.5">
                  <span className="flex-1 text-[13.5px] text-ink">{g.nome}</span><Badge tone="neutral">{g.nivel}</Badge>
                  <span className="text-[11.5px] text-muted">{s.colaboradores.filter((c) => c.cargoId === g.id && c.status !== 'encerrado').length} pessoa(s)</span>
                  <Button size="icon-sm" variant="subtle" icon="X" aria-label={`Remover ${g.nome}`} onClick={() => feedback(s.removeCargo(g.id), 'Função removida.')} />
                </li>
              ))}
            </ul>
            <form className="flex gap-2 p-4 border-t border-line" onSubmit={(e) => { e.preventDefault(); if (feedback(s.addCargo({ nome: f.nome, setorId: a.id, nivel: f.nivel }), 'Função adicionada.')) setNovo({ ...novo, [a.id]: { nome: '', nivel: 'Pleno' } }) }}>
              <input aria-label={`Nova função em ${a.nome}`} className="input flex-1" placeholder="Nova função" value={f.nome} onChange={(e) => setNovo({ ...novo, [a.id]: { ...f, nome: e.target.value } })} />
              <select aria-label="Senioridade" className="input w-32" value={f.nivel} onChange={(e) => setNovo({ ...novo, [a.id]: { ...f, nivel: e.target.value as Senioridade } })}>{NIVEIS.map((n) => <option key={n}>{n}</option>)}</select>
              <Button type="submit" icon="Plus" size="icon" aria-label="Adicionar função" />
            </form>
          </Card>
        )
      })}
    </div>
  )
}

function Unidades() {
  const s = useStore()
  const [form, setForm] = useState<Partial<Unidade> | null>(null)
  return (
    <>
      <div className="flex justify-end mb-3"><Button icon="Plus" onClick={() => setForm({})}>Nova unidade</Button></div>
      <Card>
        {s.unidades.length === 0 ? <EmptyState icon="MapPin" title="Nenhuma unidade" /> : (
          <ul className="divide-y divide-line">
            {s.unidades.map((u) => (
              <li key={u.id} className="flex items-center gap-3 p-4">
                <Icon name="MapPin" className="h-5 w-5 text-brand" />
                <div className="flex-1 min-w-0"><div className="text-[13.5px] font-semibold text-ink">{u.nome}</div><div className="text-[12px] text-muted">{[u.endereco, u.telefone].filter(Boolean).join(' · ') || '—'}</div></div>
                <span className="text-[12px] text-muted">{s.colaboradores.filter((c) => c.unidadeId === u.id && c.status !== 'encerrado').length} pessoa(s)</span>
                <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setForm({ ...u })}>Editar</Button>
                <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${u.nome}`} onClick={() => feedback(s.removerUnidade(u.id), 'Unidade removida.')} />
              </li>
            ))}
          </ul>
        )}
      </Card>
      <Modal open={!!form} onClose={() => setForm(null)} title={form?.id ? 'Editar unidade' : 'Nova unidade'} footer={<><Button variant="ghost" onClick={() => setForm(null)}>Cancelar</Button><Button icon="Check" onClick={() => { if (form && feedback(s.salvarUnidade({ nome: (form.nome ?? '').trim(), endereco: form.endereco, telefone: form.telefone }, form.id), 'Unidade salva.')) setForm(null) }}>Salvar</Button></>}>
        {form && <>
          <Field label="Nome" required htmlFor="un-n"><input id="un-n" className="input" value={form.nome ?? ''} onChange={(e) => setForm({ ...form, nome: e.target.value })} /></Field>
          <Field label="Endereço" htmlFor="un-e"><input id="un-e" className="input" value={form.endereco ?? ''} onChange={(e) => setForm({ ...form, endereco: e.target.value })} /></Field>
          <Field label="Telefone" htmlFor="un-t"><input id="un-t" className="input" value={form.telefone ?? ''} onChange={(e) => setForm({ ...form, telefone: e.target.value })} /></Field>
        </>}
      </Modal>
    </>
  )
}

function Listas() {
  const s = useStore()
  const [motivo, setMotivo] = useState('')
  const [tipo, setTipo] = useState('')
  return (
    <div className="grid md:grid-cols-2 gap-6">
      <Card>
        <CardHead title="Motivos de encerramento" sub="Usados ao encerrar uma parceria" />
        <ul className="divide-y divide-line">{s.motivosEncerramento.map((m) => <li key={m.id} className="flex items-center justify-between px-5 py-2.5"><span className={cn('text-[13.5px]', !m.ativo && 'text-muted line-through')}>{m.nome}</span><Toggle checked={m.ativo} onChange={(v) => feedback(s.salvarMotivo({ nome: m.nome, ativo: v }, m.id), 'Lista atualizada.')} /></li>)}</ul>
        <form className="flex gap-2 p-4 border-t border-line" onSubmit={(e) => { e.preventDefault(); if (feedback(s.salvarMotivo({ nome: motivo.trim(), ativo: true }), 'Motivo adicionado.')) setMotivo('') }}>
          <input aria-label="Novo motivo" className="input flex-1" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Novo motivo" /><Button type="submit" size="icon" icon="Plus" aria-label="Adicionar motivo" />
        </form>
      </Card>
      <Card>
        <CardHead title="Tipos de registro administrativo" sub="Classificam os registros feitos pelo RH" />
        <ul className="divide-y divide-line">{s.tiposRegistro.map((t) => <li key={t.id} className="flex items-center justify-between px-5 py-2.5"><span className={cn('text-[13.5px]', !t.ativo && 'text-muted line-through')}>{t.nome}</span><Toggle checked={t.ativo} onChange={(v) => feedback(s.salvarTipoRegistro({ nome: t.nome, ativo: v }, t.id), 'Lista atualizada.')} /></li>)}</ul>
        <form className="flex gap-2 p-4 border-t border-line" onSubmit={(e) => { e.preventDefault(); if (feedback(s.salvarTipoRegistro({ nome: tipo.trim(), ativo: true }), 'Tipo adicionado.')) setTipo('') }}>
          <input aria-label="Novo tipo de registro" className="input flex-1" value={tipo} onChange={(e) => setTipo(e.target.value)} placeholder="Novo tipo" /><Button type="submit" size="icon" icon="Plus" aria-label="Adicionar tipo" />
        </form>
        <p className="text-[11.5px] text-muted px-5 pb-4">Tipos disciplinares (advertência, suspensão) não fazem parte do modelo de prestação de serviços e foram retirados.</p>
      </Card>
    </div>
  )
}
