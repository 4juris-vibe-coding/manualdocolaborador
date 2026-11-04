import { useEffect, useState } from 'react'
import { Badge, Button, Callout, Card, CardHead, Field, PageHeader, Tabs } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { EditorEtapas } from '@/components/v2/vagas/EditorEtapas'
import { useOpcoes } from '@/components/v2/vagas/comum'
import { api, executar, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { toast } from '@/components/toast'
import { ROTULO_PRIORIDADE, ROTULO_TIPO, TIPOS_VAGA, type FluxoAprovacao, type PassoFluxo } from '@/domain/v2/vagas'
import { Dropdown } from '@/components/Dropdown'
import { EditorPortal } from '@/components/v2/vagas/EditorPortal'
import type { PortalConfig } from '@/domain/v2/portal'

interface Privacidade { versao: string; texto: string; contato: string; retencaoMeses: number; aviso?: string }
interface Config { fluxos: FluxoAprovacao[]; etapas: { nome: string; tipo: string }[]; canais: { chave: string; nome: string }[]; tipos: { chave: string; nome: string }[]; portal: PortalConfig; privacidade?: Privacidade }
const ABAS = [{ key: 'portal', label: 'Portal de carreiras' }, { key: 'fluxos', label: 'Fluxos de aprovação' }, { key: 'etapas', label: 'Etapas padrão' }, { key: 'canais', label: 'Canais de divulgação' }, { key: 'tipos', label: 'Tipos de vaga' }, { key: 'privacidade', label: 'Privacidade (LGPD)' }]
const slug = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40)

export default function ConfigRecrutamento() {
  const r = useApi<Config>('recrutamento/config')
  const opcoes = useOpcoes()
  const edita = useTem('vagas:config')
  const [aba, setAba] = useState('portal')
  return (
    <>
      <PageHeader title="Configurar recrutamento" subtitle="Conteúdo do portal de carreiras, fluxos de aprovação, etapas padrão, canais e tipos de vaga. As mudanças valem para as próximas vagas." eyebrow={<Badge tone="brand">Recrutamento</Badge>} />
      <SoComBanco>
        {!edita && <Callout tone="neutral" icon="Lock" className="mb-5">Você pode consultar as configurações, mas só quem administra o recrutamento pode alterá-las.</Callout>}
        <Tabs tabs={ABAS} active={aba} onChange={setAba} />
        <Aguardar r={r}>
          {(c) => (
            <>
              {aba === 'portal' && <EditorPortal inicial={c.portal} edita={edita} onSalvo={r.recarregar} />}
              {aba === 'fluxos' && <Fluxos inicial={c.fluxos} edita={edita} opcoes={opcoes.dados} onSalvo={r.recarregar} />}
              {aba === 'etapas' && <EtapasPadrao inicial={c.etapas} edita={edita} onSalvo={r.recarregar} />}
              {aba === 'canais' && <ListaNomeada chave="canais" titulo="Canais de divulgação" inicial={c.canais} edita={edita} onSalvo={r.recarregar} fixo="portal" />}
              {aba === 'tipos' && <ListaNomeada chave="tipos_vaga" titulo="Tipos de vaga" inicial={c.tipos} edita={edita} onSalvo={r.recarregar} fixaChaves />}
              {aba === 'privacidade' && c.privacidade && <PrivacidadeLgpd inicial={c.privacidade} edita={edita} onSalvo={r.recarregar} />}
            </>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}

function Fluxos({ inicial, edita, opcoes, onSalvo }: { inicial: FluxoAprovacao[]; edita: boolean; opcoes?: ReturnType<typeof useOpcoes>['dados']; onSalvo: () => void }) {
  const [fluxos, setFluxos] = useState<FluxoAprovacao[]>(inicial)
  useEffect(() => setFluxos(inicial), [inicial])
  const att = (i: number, p: Partial<FluxoAprovacao>) => setFluxos(fluxos.map((f, j) => (j === i ? { ...f, ...p } : f)))
  const attPasso = (i: number, k: number, p: Partial<PassoFluxo>) => att(i, { passos: fluxos[i].passos.map((x, j) => (j === k ? { ...x, ...p } : x)) })
  const refs = (tipo: string) => tipo === 'pessoa' ? (opcoes?.pessoas ?? []).map((x) => ({ v: x.id, n: x.nome })) : tipo === 'papel' ? (opcoes?.aprovadores.papeis ?? []).map((x) => ({ v: x.chave, n: x.nome })) : (opcoes?.aprovadores.funcoes ?? []).map((x) => ({ v: x.chave, n: x.nome }))
  const alternar = (lista: string[] | undefined, v: string) => { const a = lista ?? []; return a.includes(v) ? a.filter((x) => x !== v) : [...a, v] }
  return (
    <div className="space-y-5">
      <Callout tone="brand" icon="Info">Cada vaga usa o primeiro fluxo (que não seja o “padrão”) cujas condições todas se aplicam; se nenhum se aplicar, usa o <b>padrão</b>. Um fluxo sem passos aprova a solicitação automaticamente. Os passos acontecem em sequência.</Callout>
      {fluxos.map((f, i) => (
        <Card key={f.chave + i}>
          <CardHead title={f.nome || 'Novo fluxo'} sub={f.chave === 'padrao' ? 'Fluxo padrão (usado quando nenhuma condição se aplica)' : `Chave: ${f.chave}`}
            action={edita && f.chave !== 'padrao' ? <Button size="sm" variant="danger" icon="Trash2" onClick={() => setFluxos(fluxos.filter((_, j) => j !== i))}>Remover</Button> : undefined} />
          <div className="p-5 space-y-4">
            <Field label="Nome do fluxo" htmlFor={`fn-${i}`}><input id={`fn-${i}`} className="input" disabled={!edita} value={f.nome} maxLength={120} onChange={(e) => att(i, { nome: e.target.value })} /></Field>
            {f.chave !== 'padrao' && (
              <fieldset className="rounded-xl border border-line p-3">
                <legend className="px-1 text-[12px] font-bold uppercase tracking-wide text-muted">Condições (todas precisam se aplicar)</legend>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2"><span className="text-[12.5px] font-semibold">Prioridade:</span>
                  {Object.entries(ROTULO_PRIORIDADE).map(([k, n]) => <label key={k} className="inline-flex items-center gap-1.5 text-[13px]"><input type="checkbox" disabled={!edita} checked={!!f.condicoes?.prioridades?.includes(k)} onChange={() => att(i, { condicoes: { ...f.condicoes, prioridades: alternar(f.condicoes?.prioridades, k) } })} />{n}</label>)}</div>
                <div className="flex flex-wrap gap-x-6 gap-y-2 mb-2"><span className="text-[12.5px] font-semibold">Tipo:</span>
                  {TIPOS_VAGA.map((k) => <label key={k} className="inline-flex items-center gap-1.5 text-[13px]"><input type="checkbox" disabled={!edita} checked={!!f.condicoes?.tipos?.includes(k)} onChange={() => att(i, { condicoes: { ...f.condicoes, tipos: alternar(f.condicoes?.tipos, k) } })} />{ROTULO_TIPO[k]}</label>)}</div>
                <label className="inline-flex items-center gap-2 text-[13px]">Salário máximo acima de
                  <input type="number" min={0} className="input w-36" disabled={!edita} value={f.condicoes?.salarioMaxAcima ?? ''} onChange={(e) => att(i, { condicoes: { ...f.condicoes, salarioMaxAcima: e.target.value === '' ? undefined : Number(e.target.value) } })} /></label>
              </fieldset>
            )}
            <div>
              <div className="label">Passos de aprovação</div>
              {f.passos.length === 0 && <p className="text-[13px] text-muted mb-2">Sem passos: a solicitação é aprovada automaticamente.</p>}
              <ol className="space-y-2">
                {f.passos.map((p, k) => (
                  <li key={k} className="grid grid-cols-1 md:grid-cols-[1.4fr_1fr_1.4fr_90px_auto] gap-2 items-end">
                    <label><span className="text-[11.5px] text-muted">Nome do passo</span><input className="input" disabled={!edita} value={p.rotulo} maxLength={80} onChange={(e) => attPasso(i, k, { rotulo: e.target.value })} /></label>
                    <label><span className="text-[11.5px] text-muted">Tipo</span><Dropdown className="input" disabled={!edita} value={p.tipo} onChange={(e) => attPasso(i, k, { tipo: e.target.value as PassoFluxo['tipo'], ref: '' })}><option value="papel">Papel</option><option value="funcao">Função adicional</option><option value="pessoa">Pessoa</option></Dropdown></label>
                    <label><span className="text-[11.5px] text-muted">Aprovador</span><Dropdown className="input" disabled={!edita} value={p.ref} onChange={(e) => attPasso(i, k, { ref: e.target.value })}><option value="">Selecione…</option>{refs(p.tipo).map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}</Dropdown></label>
                    <label><span className="text-[11.5px] text-muted">Prazo (dias)</span><input type="number" min={1} max={60} className="input" disabled={!edita} value={p.prazoDias ?? ''} onChange={(e) => attPasso(i, k, { prazoDias: e.target.value ? Number(e.target.value) : undefined })} /></label>
                    {edita && <Button size="icon-sm" variant="danger" icon="Trash2" aria-label={`Remover passo ${p.rotulo}`} onClick={() => att(i, { passos: f.passos.filter((_, j) => j !== k) })} />}
                  </li>
                ))}
              </ol>
              {edita && f.passos.length < 8 && <Button className="mt-3" size="sm" variant="ghost" icon="Plus" onClick={() => att(i, { passos: [...f.passos, { rotulo: `Passo ${f.passos.length + 1}`, tipo: 'papel', ref: 'rh', prazoDias: 3 }] })}>Adicionar passo</Button>}
            </div>
          </div>
        </Card>
      ))}
      {edita && (
        <div className="flex gap-2 flex-wrap">
          <Button variant="ghost" icon="Plus" onClick={() => { const n = fluxos.length; setFluxos([...fluxos, { chave: `fluxo_${n}_${Date.now().toString(36).slice(-3)}`, nome: `Novo fluxo ${n}`, passos: [{ rotulo: 'Análise do RH', tipo: 'papel', ref: 'rh', prazoDias: 3 }], condicoes: { prioridades: ['alta'] } }]) }}>Adicionar fluxo</Button>
          <Button icon="Save" onClick={async () => { const x = await executar(() => api.put('recrutamento/config/fluxos_aprovacao', { dados: fluxos }), 'Fluxos salvos.'); if (x) onSalvo() }}>Salvar fluxos</Button>
        </div>
      )}
    </div>
  )
}

function EtapasPadrao({ inicial, edita, onSalvo }: { inicial: { nome: string; tipo: string }[]; edita: boolean; onSalvo: () => void }) {
  const [et, setEt] = useState<{ id?: string; nome: string; tipo: string }[]>(inicial)
  useEffect(() => setEt(inicial), [inicial])
  return (
    <Card className="p-5">
      <p className="text-[13px] text-muted mb-4">Estas etapas são copiadas para cada nova vaga, que depois pode personalizá-las. Vagas já criadas não são alteradas.</p>
      <EditorEtapas etapas={et} onChange={setEt} desabilitado={!edita} onSalvar={async () => { const x = await executar(() => api.put('recrutamento/config/etapas_padrao', { dados: et.map((e) => ({ nome: e.nome, tipo: e.tipo })) }), 'Etapas padrão salvas.'); if (x) onSalvo() }} />
    </Card>
  )
}

function ListaNomeada({ chave, titulo, inicial, edita, onSalvo, fixo, fixaChaves }: { chave: string; titulo: string; inicial: { chave: string; nome: string }[]; edita: boolean; onSalvo: () => void; fixo?: string; fixaChaves?: boolean }) {
  const [itens, setItens] = useState(inicial)
  useEffect(() => setItens(inicial), [inicial])
  return (
    <Card className="p-5">
      <h2 className="text-[15px] font-bold text-ink mb-3">{titulo}</h2>
      {fixaChaves && <p className="text-[12.5px] text-muted mb-3">Os tipos têm significado próprio no sistema; aqui você pode renomear os nomes exibidos.</p>}
      <ul className="space-y-2">
        {itens.map((x, i) => (
          <li key={x.chave + i} className="flex gap-2 items-center">
            <input aria-label={`Nome de ${x.chave}`} className="input flex-1" maxLength={80} disabled={!edita} value={x.nome} onChange={(e) => setItens(itens.map((y, j) => (j === i ? { ...y, nome: e.target.value, chave: !fixaChaves && !inicial.some((z) => z.chave === y.chave) ? slug(e.target.value) || y.chave : y.chave } : y)))} />
            <code className="text-[11.5px] text-muted w-28 truncate">{x.chave}</code>
            {edita && !fixaChaves && x.chave !== fixo && <Button size="icon-sm" variant="danger" icon="Trash2" aria-label={`Remover ${x.nome}`} onClick={() => setItens(itens.filter((_, j) => j !== i))} />}
          </li>
        ))}
      </ul>
      {edita && (
        <div className="flex gap-2 mt-4">
          {!fixaChaves && <Button variant="ghost" icon="Plus" onClick={() => setItens([...itens, { chave: `novo_${itens.length}`, nome: '' }])}>Adicionar</Button>}
          <Button icon="Save" disabled={itens.some((i) => !i.nome.trim())} onClick={async () => { const x = await executar(() => api.put(`recrutamento/config/${chave}`, { dados: itens }), 'Configuração salva.'); if (x) onSalvo() }}>Salvar</Button>
        </div>
      )}
    </Card>
  )
}

/* ---------- Privacidade (LGPD): aviso do portal e retenção dos dados de candidatos ---------- */
const TEXTAREA_PRIV = 'input h-auto min-h-[120px] py-2.5 leading-relaxed resize-y'

function PrivacidadeLgpd({ inicial, edita, onSalvo }: { inicial: Privacidade; edita: boolean; onSalvo: () => void }) {
  const [p, setP] = useState(inicial)
  useEffect(() => setP(inicial), [inicial])
  const aplica = useTem('admin:privacidade')
  const [sim, setSim] = useState<{ elegiveis: number; retencaoMeses: number; limite: string } | null>(null)
  const [confirmar, setConfirmar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const meses = Number(p.retencaoMeses)
  const mesesOk = Number.isInteger(meses) && meses >= 1 && meses <= 60

  async function simular() {
    setOcupado(true)
    const r = await executar(() => api.post<{ elegiveis: number; retencaoMeses: number; limite: string }>('lgpd/candidatos/retencao', { simular: true }))
    setOcupado(false)
    if (r) setSim(r)
  }
  async function aplicar() {
    setConfirmar(false); setOcupado(true)
    const r = await executar(() => api.post<{ anonimizados: number }>('lgpd/candidatos/retencao', { simular: false, confirmar: true }))
    setOcupado(false)
    if (r) { setSim(null); toast(`${r.anonimizados} candidato(s) anonimizado(s).`) }
  }

  return (
    <div className="space-y-5">
      <Card>
        <CardHead title="Aviso de privacidade e retenção" sub="Texto mostrado no formulário de candidatura e prazo de guarda dos dados depois do fim do processo." />
        <div className="p-5">
          {inicial.aviso && <Callout tone="warning" icon="Scale" className="mb-4">{inicial.aviso}</Callout>}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
            <Field label="Prazo de retenção (meses)" htmlFor="pv-m" required hint="De 1 a 60. Conta a partir do encerramento da última candidatura." erro={mesesOk ? undefined : 'Entre 1 e 60'}>
              <input id="pv-m" type="number" min={1} max={60} className="input" disabled={!edita} value={String(p.retencaoMeses)} onChange={(e) => setP({ ...p, retencaoMeses: e.target.value === '' ? ('' as unknown as number) : Number(e.target.value) })} />
            </Field>
            <Field label="Canal de contato do titular" htmlFor="pv-c" required><input id="pv-c" className="input" maxLength={200} disabled={!edita} value={p.contato} onChange={(e) => setP({ ...p, contato: e.target.value })} /></Field>
            <Field label="Versão do texto" htmlFor="pv-v" required hint="Mude a versão ao alterar o texto: cada consentimento guarda a versão aceita."><input id="pv-v" className="input" maxLength={40} disabled={!edita} value={p.versao} onChange={(e) => setP({ ...p, versao: e.target.value })} /></Field>
          </div>
          <Field label="Texto do aviso" htmlFor="pv-t" required><textarea id="pv-t" className={TEXTAREA_PRIV} maxLength={4000} disabled={!edita} value={p.texto} onChange={(e) => setP({ ...p, texto: e.target.value })} /></Field>
          {edita && <Button icon="Save" disabled={!mesesOk || !p.texto.trim() || !p.contato.trim() || !p.versao.trim()} onClick={async () => {
            const x = await executar(() => api.put('recrutamento/config/privacidade', { dados: { retencaoMeses: meses, texto: p.texto, contato: p.contato, versao: p.versao } }), 'Privacidade salva.')
            if (x) onSalvo()
          }}>Salvar</Button>}
        </div>
      </Card>
      <Card>
        <CardHead title="Aplicar a retenção" sub="Anonimiza quem terminou o processo há mais tempo que o prazo e não está no banco de talentos com autorização vigente." />
        <div className="p-5">
          <ul className="text-[12.5px] text-ink-2 list-disc ml-5 space-y-1 mb-4">
            <li>Ficam de fora: candidaturas em andamento, pessoas contratadas e quem está no banco de talentos com autorização válida.</li>
            <li>Apaga currículos, documentos, respostas de triagem e de questionários; troca nome, e-mail e contatos por marcadores.</li>
            <li>Mantém as candidaturas e as movimentações (sem dados pessoais) para os indicadores. A ação não pode ser desfeita.</li>
            <li>Também roda automaticamente uma vez por dia.</li>
          </ul>
          {!aplica ? <p className="text-[12.5px] text-muted">Somente a administração (privacidade) simula e aplica a retenção.</p> : (
            <>
              <div className="flex flex-wrap gap-2">
                <Button variant="soft" icon="Search" disabled={ocupado} onClick={() => void simular()}>Simular</Button>
                <Button variant="danger" icon="Eraser" disabled={ocupado} onClick={() => setConfirmar(true)}>Aplicar agora</Button>
              </div>
              {sim && <p role="status" className="text-[13px] text-ink mt-3"><b>{sim.elegiveis}</b> candidato(s) seriam anonimizados hoje (prazo de {sim.retencaoMeses} meses; processos encerrados antes de {new Date(sim.limite).toLocaleDateString('pt-BR')}).</p>}
            </>
          )}
        </div>
      </Card>
      <ConfirmModal open={confirmar} onClose={() => setConfirmar(false)} titulo="Aplicar a retenção agora?" confirmar="Anonimizar"
        texto="Os candidatos elegíveis serão anonimizados e os arquivos deles apagados. Não é possível desfazer." onConfirm={() => void aplicar()} />
    </div>
  )
}
