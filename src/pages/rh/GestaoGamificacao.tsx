import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { AcaoPontuavel, ConfigGamificacao, Desafio, LancamentoPontos, RegraPontuacao } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Toggle, Tabs, Badge, Icon, Select, SearchBox, Callout, Tabela, TH, TD, EmptyState } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { fmtDate, cn } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { ACAO_LABEL } from '@/domain/gamificacao'
import { gerarCSV, baixarArquivo } from '@/domain/csv'

const ACOES_DESAFIO: AcaoPontuavel[] = ['participacao_evento', 'reconhecimento_enviado', 'reconhecimento_recebido', 'conteudo_concluido', 'pesquisa_respondida', 'iniciativa_concluida']

export default function GestaoGamificacao() {
  const [tab, setTab] = useState('regras')
  return (
    <>
      <PageHeader title="Gestão da gamificação" subtitle="Regras transparentes, desafios opcionais e histórico auditável de pontos." />
      <Callout tone="neutral" icon="ShieldCheck" className="mb-5">Pontos não se relacionam com valores de contrato, pagamentos, descontos ou avaliação profissional. Não há pontuação negativa automática; correções usam estorno justificado.</Callout>
      <Tabs tabs={[{ key: 'regras', label: 'Regras de pontuação' }, { key: 'desafios', label: 'Desafios' }, { key: 'conquistas', label: 'Conquistas' }, { key: 'config', label: 'Níveis e limites' }, { key: 'historico', label: 'Histórico (auditoria)' }]} active={tab} onChange={setTab} />
      {tab === 'regras' && <Regras />}
      {tab === 'desafios' && <DesafiosAdmin />}
      {tab === 'conquistas' && <Conquistas />}
      {tab === 'config' && <Config />}
      {tab === 'historico' && <Historico />}
    </>
  )
}

function Regras() {
  const s = useStore()
  return (
    <Card>
      <CardHead title="Regras" sub="Alterações valem para novos lançamentos; o histórico não é recalculado." />
      <ul className="divide-y divide-line">
        {s.regras.filter((r) => r.acao !== 'ajuste_manual').map((r) => <RegraLinha key={r.id} r={r} />)}
      </ul>
    </Card>
  )
}

function RegraLinha({ r }: { r: RegraPontuacao }) {
  const s = useStore()
  const [pontos, setPontos] = useState(String(r.pontos))
  const [limite, setLimite] = useState(r.limiteMensal ? String(r.limiteMensal) : '')
  const variavel = r.acao === 'desafio_concluido' || r.acao === 'iniciativa_concluida'
  const mudou = pontos !== String(r.pontos) || limite !== (r.limiteMensal ? String(r.limiteMensal) : '')
  return (
    <li className={cn('p-4 flex flex-wrap items-center gap-3', !r.ativa && 'bg-surface-2')}>
      <div className="flex-1 min-w-[220px]"><div className="text-[13.5px] font-semibold text-ink">{r.nome}</div><div className="text-[12px] text-muted">{r.descricao}</div></div>
      {!variavel && <label className="flex items-center gap-2 text-[12px] text-muted">Pontos<input type="number" min={0} max={1000} className="input !h-9 w-20" value={pontos} onChange={(e) => setPontos(e.target.value)} /></label>}
      {variavel && <span className="text-[12px] text-muted">Pontos definidos em cada {r.acao === 'desafio_concluido' ? 'desafio' : 'iniciativa'}</span>}
      <label className="flex items-center gap-2 text-[12px] text-muted">Limite/mês<input type="number" min={1} className="input !h-9 w-20" value={limite} placeholder="—" onChange={(e) => setLimite(e.target.value)} /></label>
      {mudou && <Button size="sm" icon="Check" onClick={() => feedback(s.salvarRegra(r.id, { pontos: variavel ? r.pontos : Number(pontos), limiteMensal: limite ? Number(limite) : undefined }), 'Regra atualizada.')}>Salvar</Button>}
      <Toggle checked={r.ativa} onChange={(v) => feedback(s.salvarRegra(r.id, { ativa: v }), v ? 'Regra ativada.' : 'Regra desativada.')} label={r.ativa ? 'Ativa' : 'Inativa'} />
    </li>
  )
}

function DesafiosAdmin() {
  const s = useStore()
  const hoje = hojeISO()
  const [form, setForm] = useState<{ aberto: boolean; d?: Desafio }>({ aberto: false })
  const [remover, setRemover] = useState<Desafio | null>(null)
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const r = s.salvarDesafio({ titulo: d.titulo.trim(), descricao: d.descricao.trim(), inicio: d.inicio, fim: d.fim, criterio: { acao: d.acao as AcaoPontuavel, meta: Number(d.meta) }, pontosBonus: Number(d.bonus) }, form.d?.id)
    if (feedback(r, 'Desafio salvo.')) setForm({ aberto: false })
  }
  return (
    <>
      <div className="flex justify-end mb-3"><Button icon="Plus" onClick={() => setForm({ aberto: true })}>Novo desafio</Button></div>
      <Card>
        <ul className="divide-y divide-line">
          {s.desafios.map((d) => {
            const status = hoje < d.inicio ? 'Em breve' : hoje > d.fim ? 'Encerrado' : 'Em andamento'
            const concl = s.lancamentos.filter((l) => l.acao === 'desafio_concluido' && l.referenciaId === d.id).length
            return (
              <li key={d.id} className="p-4 flex flex-wrap items-center gap-3">
                <div className="flex-1 min-w-[220px]"><div className="flex items-center gap-2"><span className="text-[13.5px] font-semibold text-ink">{d.titulo}</span><Badge tone={status === 'Em andamento' ? 'brand' : 'neutral'}>{status}</Badge></div>
                  <div className="text-[12px] text-muted">{fmtDate(d.inicio)} → {fmtDate(d.fim)} · {d.criterio.meta}× {ACAO_LABEL[d.criterio.acao].toLowerCase()} · bônus {d.pontosBonus}</div></div>
                <span className="text-[12.5px] text-ink-2">{d.participantes.length} participante(s) · {concl} concluíram</span>
                <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setForm({ aberto: true, d })}>Editar</Button>
                <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${d.titulo}`} onClick={() => setRemover(d)} />
              </li>
            )
          })}
        </ul>
      </Card>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover desafio?" confirmar="Remover" texto={remover ? `"${remover.titulo}" deixa de existir. Os pontos já concedidos são mantidos.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerDesafio(remover.id), 'Desafio removido.')) setRemover(null) }} />
      <Modal open={form.aberto} onClose={() => setForm({ aberto: false })} title={form.d ? 'Editar desafio' : 'Novo desafio'} subtitle="Desafios são opcionais e celebram participação positiva."
        footer={<><Button variant="ghost" onClick={() => setForm({ aberto: false })}>Cancelar</Button><Button icon="Check" type="submit" form="desForm">Salvar</Button></>}>
        {form.aberto && (
          <form id="desForm" onSubmit={salvar}>
            <Field label="Título" required htmlFor="ds-t"><input id="ds-t" name="titulo" className="input" defaultValue={form.d?.titulo} /></Field>
            <Field label="Descrição" htmlFor="ds-d"><textarea id="ds-d" name="descricao" rows={2} className="input !h-auto py-2.5" defaultValue={form.d?.descricao} /></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Início" htmlFor="ds-i"><input id="ds-i" name="inicio" type="date" className="input" defaultValue={form.d?.inicio ?? hojeISO()} /></Field>
              <Field label="Fim" htmlFor="ds-f"><input id="ds-f" name="fim" type="date" className="input" defaultValue={form.d?.fim ?? somarDias(hojeISO(), 30)} /></Field>
              <Field label="Ação que conta" htmlFor="ds-a"><select id="ds-a" name="acao" className="input" defaultValue={form.d?.criterio.acao ?? 'participacao_evento'}>{ACOES_DESAFIO.map((a) => <option key={a} value={a}>{ACAO_LABEL[a]}</option>)}</select></Field>
              <Field label="Meta (vezes)" htmlFor="ds-m"><input id="ds-m" name="meta" type="number" min={1} className="input" defaultValue={form.d?.criterio.meta ?? 2} /></Field>
              <Field label="Pontos de bônus" htmlFor="ds-b"><input id="ds-b" name="bonus" type="number" min={0} max={1000} className="input" defaultValue={form.d?.pontosBonus ?? 100} /></Field>
            </div>
          </form>
        )}
      </Modal>
    </>
  )
}

function Conquistas() {
  const s = useStore()
  return (
    <Card>
      <CardHead title="Conquistas" sub="Concedidas automaticamente quando o critério é atingido" />
      <ul className="divide-y divide-line">
        {s.badges.map((b) => (
          <li key={b.id} className="p-4 flex items-center gap-3 flex-wrap">
            <span className="h-10 w-10 rounded-full flex items-center justify-center text-white shrink-0" style={{ background: b.cor }}><Icon name={b.icon} className="h-5 w-5" /></span>
            <div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{b.nome} <Badge tone="neutral" className="ml-1">{b.raridade}</Badge></div><div className="text-[12px] text-muted">{b.descricao} · {b.criterio.tipo === 'nivel' ? `nível ${b.criterio.nivel}` : `${b.criterio.quantidade}× ${ACAO_LABEL[b.criterio.acao].toLowerCase()}`}</div></div>
            <span className="text-[12.5px] text-ink-2">{s.conquistas.filter((c) => c.badgeId === b.id).length} pessoa(s)</span>
            <Toggle checked={b.ativa} onChange={(v) => feedback(s.salvarBadge(b.id, { ativa: v }), v ? 'Conquista ativada.' : 'Conquista desativada (quem já tem mantém).')} label={b.ativa ? 'Ativa' : 'Inativa'} />
          </li>
        ))}
      </ul>
    </Card>
  )
}

function Config() {
  const s = useStore()
  const [c, setC] = useState<ConfigGamificacao>(s.config.gamificacao)
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card className="p-5">
        <h3 className="text-[15px] font-bold text-ink mb-4">Níveis</h3>
        <ul className="space-y-2">
          {c.niveis.map((n, i) => (
            <li key={n.nivel} className="grid grid-cols-[40px_1fr_110px_auto] gap-2 items-center">
              <span className="text-[13px] font-bold text-muted">Nv {n.nivel}</span>
              <input aria-label={`Nome do nível ${n.nivel}`} className="input" value={n.nome} onChange={(e) => setC({ ...c, niveis: c.niveis.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} />
              <input aria-label={`Pontos mínimos do nível ${n.nivel}`} type="number" min={0} className="input" value={n.minimo} disabled={i === 0} onChange={(e) => setC({ ...c, niveis: c.niveis.map((x, j) => (j === i ? { ...x, minimo: Number(e.target.value) } : x)) })} />
              <Button size="icon-sm" variant="subtle" icon="X" aria-label="Remover nível" disabled={c.niveis.length <= 1 || i === 0} onClick={() => setC({ ...c, niveis: c.niveis.filter((_, j) => j !== i).map((x, j) => ({ ...x, nivel: j + 1 })) })} />
            </li>
          ))}
        </ul>
        <Button size="sm" variant="soft" icon="Plus" className="mt-3" onClick={() => setC({ ...c, niveis: [...c.niveis, { nivel: c.niveis.length + 1, nome: 'Novo nível', minimo: (c.niveis[c.niveis.length - 1]?.minimo ?? 0) + 1000 }] })}>Adicionar nível</Button>
      </Card>
      <Card className="p-5">
        <h3 className="text-[15px] font-bold text-ink mb-4">Limites e destaques</h3>
        <Field label="Reconhecimentos enviados por pessoa/mês" htmlFor="cf-r"><input id="cf-r" type="number" min={1} className="input" value={c.limiteReconhecimentosEnviadosMes} onChange={(e) => setC({ ...c, limiteReconhecimentosEnviadosMes: Number(e.target.value) })} /></Field>
        <Field label="Pontos máximos por iniciativa" htmlFor="cf-i"><input id="cf-i" type="number" min={0} className="input" value={c.pontosMaximosIniciativa} onChange={(e) => setC({ ...c, pontosMaximosIniciativa: Number(e.target.value) })} /></Field>
        <Toggle checked={c.destaquesAtivos} onChange={(v) => setC({ ...c, destaquesAtivos: v })} label="Exibir destaques do mês (somente quem optou)" />
        <div className="mt-6"><Button icon="Check" onClick={() => feedback(s.salvarConfigGamificacao(c), 'Configuração salva.')}>Salvar configuração</Button></div>
      </Card>
    </div>
  )
}

function Historico() {
  const s = useStore()
  const [q, setQ] = useState('')
  const [acao, setAcao] = useState('todas')
  const [estornar, setEstornar] = useState<LancamentoPontos | null>(null)
  const [conceder, setConceder] = useState(false)
  const [motivo, setMotivo] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [pts, setPts] = useState('50')
  const lista = useMemo(() => s.lancamentos
    .filter((l) => acao === 'todas' || l.acao === acao)
    .filter((l) => !q.trim() || `${s.nomeDe(l.colaboradorId)} ${l.descricao}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => b.criadoEm.localeCompare(a.criadoEm)), [s, q, acao])
  const estornados = new Set(s.lancamentos.filter((l) => l.referenciaId.startsWith('estorno:')).map((l) => l.referenciaId.slice(8)))

  const exportar = () => {
    baixarArquivo(gerarCSV(lista, [
      { titulo: 'Data', valor: (l) => l.criadoEm }, { titulo: 'Pessoa', valor: (l) => s.nomeDe(l.colaboradorId) }, { titulo: 'Ação', valor: (l) => ACAO_LABEL[l.acao] },
      { titulo: 'Descrição', valor: (l) => l.descricao }, { titulo: 'Pontos', valor: (l) => l.pontos }, { titulo: 'Registrado por', valor: (l) => (l.registradoPorId ? s.nomeDe(l.registradoPorId) : 'automático') },
    ], [`Histórico de pontos — gerado em ${new Date().toLocaleString('pt-BR')}`]), `historico-pontos-${hojeISO()}.csv`)
    toast('Histórico exportado.')
  }

  return (
    <>
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchBox value={q} onChange={setQ} placeholder="Pessoa ou descrição" label="Buscar lançamentos" />
        <Select label="Ação" value={acao} onChange={setAcao}><option value="todas">Todas as ações</option>{(Object.keys(ACAO_LABEL) as AcaoPontuavel[]).map((a) => <option key={a} value={a}>{ACAO_LABEL[a]}</option>)}</Select>
        <div className="ml-auto flex gap-2"><Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button><Button variant="soft" icon="Plus" onClick={() => { setConceder(true); setMotivo('') }}>Concessão manual</Button></div>
      </div>
      <Card>
        {lista.length === 0 ? <EmptyState icon="Trophy" title="Nenhum lançamento" /> : (
          <Tabela minWidth={780}>
            <thead><tr><th className={TH}>Data</th><th className={TH}>Pessoa</th><th className={TH}>Origem</th><th className={TH}>Pontos</th><th className={TH}>Registrado por</th><th className={TH}></th></tr></thead>
            <tbody>
              {lista.slice(0, 200).map((l) => (
                <tr key={l.id}>
                  <td className={TD}>{fmtDate(l.criadoEm)}</td>
                  <td className={TD}><span className="font-semibold text-ink">{s.nomeDe(l.colaboradorId)}</span></td>
                  <td className={TD}><div className="text-ink-2">{l.descricao}</div><div className="text-[11.5px] text-muted">{ACAO_LABEL[l.acao]}</div></td>
                  <td className={cn(TD, 'font-bold tabular-nums', l.pontos >= 0 ? 'text-success' : 'text-danger')}>{l.pontos >= 0 ? '+' : ''}{l.pontos}</td>
                  <td className={TD}>{l.registradoPorId ? s.nomeDe(l.registradoPorId) : <span className="text-muted">automático</span>}</td>
                  <td className={TD}>{l.pontos > 0 && !estornados.has(l.id) ? <Button size="sm" variant="subtle" onClick={() => { setEstornar(l); setMotivo('') }}>Estornar</Button> : estornados.has(l.id) ? <Badge tone="neutral">estornado</Badge> : null}</td>
                </tr>
              ))}
            </tbody>
          </Tabela>
        )}
        {lista.length > 200 && <p className="text-[12px] text-muted p-3">Mostrando 200 de {lista.length}. Use os filtros ou exporte.</p>}
      </Card>

      <Modal open={!!estornar} onClose={() => setEstornar(null)} title="Estornar lançamento" subtitle={estornar ? `${s.nomeDe(estornar.colaboradorId)} · ${estornar.descricao} · +${estornar.pontos}` : ''}
        footer={<><Button variant="ghost" onClick={() => setEstornar(null)}>Cancelar</Button><Button variant="danger" onClick={() => { if (estornar && feedback(s.estornarLancamento(estornar.id, motivo), 'Lançamento estornado.')) setEstornar(null) }}>Estornar</Button></>}>
        <p className="text-[13px] text-ink-2 mb-3">Use apenas para corrigir lançamentos indevidos (ex.: presença registrada por engano). O estorno fica registrado no histórico da pessoa.</p>
        <Field label="Justificativa" required htmlFor="es-m"><textarea id="es-m" rows={2} className="input !h-auto py-2.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>
      </Modal>
      <Modal open={conceder} onClose={() => setConceder(false)} title="Concessão manual de pontos" subtitle="Para situações não cobertas pelas regras. Fica registrada com justificativa."
        footer={<><Button variant="ghost" onClick={() => setConceder(false)}>Cancelar</Button><Button icon="Check" onClick={() => { if (!pessoa) { feedback({ ok: false, erro: 'Escolha a pessoa.' }, ''); return } if (feedback(s.concederPontos(pessoa, Number(pts), motivo), 'Pontos concedidos.')) setConceder(false) }}>Conceder</Button></>}>
        <div className="grid grid-cols-[1fr_110px] gap-3">
          <Field label="Pessoa" required htmlFor="cp-p"><select id="cp-p" className="input" value={pessoa} onChange={(e) => setPessoa(e.target.value)}><option value="">Selecione…</option>{s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</select></Field>
          <Field label="Pontos" htmlFor="cp-n"><input id="cp-n" type="number" min={1} max={500} className="input" value={pts} onChange={(e) => setPts(e.target.value)} /></Field>
        </div>
        <Field label="Justificativa" required htmlFor="cp-m"><textarea id="cp-m" rows={2} className="input !h-auto py-2.5" value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>
      </Modal>
    </>
  )
}
