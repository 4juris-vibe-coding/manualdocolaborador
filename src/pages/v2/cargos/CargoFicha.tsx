import { useEffect, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { PageHeader, Card, CardHead, Button, Field, Tabs, Badge, Callout, EmptyState, Tabela, TH, TD, Select } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { TagInput } from '@/components/inputs'
import { Aguardar } from '@/components/v2/estados'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { TelaCargos, STATUS_FICHA, STATUS_FAIXA, type Taxonomia } from '@/components/v2/cargos/comum'
import { api, executar, useApi, ErroApi } from '@/data/v2/api'
import { dataBR, dataHoraBR, moeda } from '@/lib/fmt'
import { toast } from '@/components/toast'
import { Dropdown } from '@/components/Dropdown'
import { BotaoImportarPdf } from '@/components/v2/vagas/ImportarPdf'
import { normalizar } from '@/domain/v2/cargos'
import type { FichaImportada } from '@/domain/v2/cargoImportado'

interface Ficha {
  codigo: string | null; familiaId: string | null; subfamiliaId: string | null; area: string | null; trilhaId: string | null; nivelId: string | null
  cargoReferenciaId: string | null; descricaoOficial: string | null; objetivo: string | null; responsabilidades: string | null; entregas: string | null
  requisitosMinimos: string | null; formacao: string | null; experiencia: string | null; competenciasTecnicas: string[]; competenciasComportamentais: string[]
  conhecimentos: string[]; certificacoes: string[]; kpis: string[]; vigenciaInicio: string | null; aprovadores: string[]
  status?: string; versaoVigente?: number; revisadoEm?: string | null; atualizadoEm?: string; revisaoPendente?: boolean
}
interface Resp {
  cargo: { id: string; nome: string; setorId: string; nivel?: string; faixaValor?: { min?: number; max?: number } }
  ficha: Ficha | null
  solicitacaoPendente: { propostaPor: string; propostaEm: string; descricao?: string } | null
  ultimaRejeicao: { justificativa?: string; decididoEm: string } | null
  permissoes: { editar: boolean; decidir: boolean; inativar: boolean; verFaixas: boolean; cancelarSubmissao: boolean; propostaPorMim: boolean }
}

const VAZIA: Ficha = {
  codigo: '', familiaId: null, subfamiliaId: null, area: '', trilhaId: null, nivelId: null, cargoReferenciaId: null, descricaoOficial: '', objetivo: '',
  responsabilidades: '', entregas: '', requisitosMinimos: '', formacao: '', experiencia: '', competenciasTecnicas: [], competenciasComportamentais: [],
  conhecimentos: [], certificacoes: [], kpis: [], vigenciaInicio: null, aprovadores: [],
}

export default function CargoFicha() {
  const { cargoId = '' } = useParams()
  const r = useApi<Resp>(`cargos/${encodeURIComponent(cargoId)}/ficha`)
  const [aba, setAba] = useState('ficha')
  const verFaixas = !!r.dados?.permissoes.verFaixas
  const abas = [{ key: 'ficha', label: 'Ficha oficial' }, { key: 'competencias', label: 'Competências' }, ...(verFaixas ? [{ key: 'faixa', label: 'Faixa salarial' }] : []), { key: 'versoes', label: 'Versões e histórico' }, { key: 'vinculos', label: 'Vagas e pessoas' }]

  return (
    <TelaCargos>
      <Aguardar r={r}>
        {(d) => (
          <>
            <PageHeader
              eyebrow={<Link to="/cargos" className="text-[12.5px] text-brand font-semibold">← Catálogo de cargos</Link>}
              title={d.cargo.nome}
              subtitle={d.ficha ? `${d.ficha.codigo ?? ''} · ${d.ficha.versaoVigente ? `versão vigente v${d.ficha.versaoVigente}` : 'ainda sem versão aprovada'}` : 'Este cargo ainda não tem ficha oficial.'}
              actions={<>
                {d.ficha && <StatusBadge mapa={STATUS_FICHA} valor={d.ficha.status} />}
                <Link to="/rh/funcoes"><Button variant="ghost" icon="Briefcase">Dados do cargo (funções)</Button></Link>
              </>} />
            {d.ficha?.status === 'inativo' && <Callout tone="warning" icon="Archive" className="mb-4">Cargo inativo: permanece no histórico de vagas e posições que o usaram, mas não deve ser usado em novas vagas.</Callout>}
            <Tabs tabs={abas} active={aba} onChange={setAba} />
            {aba === 'ficha' && <AbaFicha d={d} cargoId={cargoId} recarregar={r.recarregar} />}
            {aba === 'competencias' && <AbaCompetencias cargoId={cargoId} podeEditar={d.permissoes.editar} />}
            {aba === 'faixa' && verFaixas && <AbaFaixa cargoId={cargoId} />}
            {aba === 'versoes' && <AbaVersoes cargoId={cargoId} />}
            {aba === 'vinculos' && <AbaVinculos cargoId={cargoId} />}
          </>
        )}
      </Aguardar>
    </TelaCargos>
  )
}

/* ---------- ficha ---------- */
function AbaFicha({ d, cargoId, recarregar }: { d: Resp; cargoId: string; recarregar: () => void }) {
  const tax = useApi<Taxonomia>('cargos/taxonomia')
  const cat = useApi<{ itens: { cargoId: string; nome: string }[] }>('cargos/catalogo?por=100')
  const [f, setF] = useState<Ficha>({ ...VAZIA, ...(d.ficha ?? {}) })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const [decisao, setDecisao] = useState<null | 'aprovar' | 'rejeitar'>(null)
  const [justificativa, setJustificativa] = useState('')
  const [inativando, setInativando] = useState(false)
  const [motivo, setMotivo] = useState('')
  useEffect(() => { setF({ ...VAZIA, ...(d.ficha ?? {}) }) }, [d.ficha])

  const editavel = d.permissoes.editar && d.ficha?.status !== 'inativo'
  const set = (p: Partial<Ficha>) => setF((x) => ({ ...x, ...p }))
  const subfamilias = tax.dados?.familias.filter((x) => x.paiId && x.paiId === f.familiaId) ?? []
  const niveis = tax.dados?.trilhas.find((t) => t.id === f.trilhaId)?.niveis ?? []

  async function salvar(): Promise<boolean> {
    setSalvando(true); setErros({})
    try {
      await api.put(`cargos/${encodeURIComponent(cargoId)}/ficha`, f)
      toast('Ficha salva.')
      recarregar()
      return true
    } catch (e) {
      if (e instanceof ErroApi) { setErros(e.campos ?? {}); toast(e.message, 'danger') } else toast('Não foi possível salvar.', 'danger')
      return false
    } finally { setSalvando(false) }
  }
  async function submeter() {
    if (!(await salvar())) return
    if (await executar(() => api.post(`cargos/${encodeURIComponent(cargoId)}/ficha/submeter`), 'Ficha enviada para aprovação.')) recarregar()
  }
  async function decidir() {
    if (!decisao) return
    if (await executar(() => api.post(`cargos/${encodeURIComponent(cargoId)}/ficha/decisao`, { decisao, justificativa }), decisao === 'aprovar' ? 'Ficha aprovada e versionada.' : 'Ficha devolvida ao rascunho.')) { setDecisao(null); setJustificativa(''); recarregar() }
  }
  /** Preenche a ficha com o que veio do PDF. Campo vazio no PDF mantém o valor atual; nada é salvo até a pessoa salvar. */
  function importar(p: FichaImportada) {
    const mesmo = (a: string, b: string) => !!a && !!b && normalizar(a) === normalizar(b)
    const familias = tax.dados?.familias ?? []
    const familia = familias.find((x) => !x.paiId && mesmo(x.nome, p.familia))
    const sub = familias.find((x) => x.paiId && mesmo(x.nome, p.familia))
    const nivel = tax.dados?.trilhas.flatMap((t) => t.niveis.map((n) => ({ ...n, trilhaId: t.id }))).find((n) => mesmo(n.nome, p.nivel))
    const textos = (['codigo', 'area', 'descricaoOficial', 'objetivo', 'responsabilidades', 'entregas', 'requisitosMinimos', 'formacao', 'experiencia'] as const)
      .filter((k) => p[k]).map((k) => [k, p[k]])
    const listas = (['competenciasTecnicas', 'competenciasComportamentais', 'conhecimentos', 'certificacoes', 'kpis'] as const)
      .filter((k) => p[k].length).map((k) => [k, p[k]])
    set({
      ...Object.fromEntries([...textos, ...listas]),
      ...(p.vigenciaInicio ? { vigenciaInicio: p.vigenciaInicio } : {}),
      ...(familia ? { familiaId: familia.id, subfamiliaId: null } : sub ? { familiaId: sub.paiId!, subfamiliaId: sub.id } : {}),
      ...(nivel ? { trilhaId: nivel.trilhaId, nivelId: nivel.id } : {}),
    })
    setErros({})
    const n = textos.length + listas.length
    if (p.nome && !mesmo(p.nome, d.cargo.nome)) toast(`${n} campos preenchidos, mas o PDF parece ser do cargo "${p.nome}". Confira antes de salvar.`, 'info')
    else toast(`${n} campos preenchidos a partir do PDF. Revise e salve o rascunho.`)
  }
  const acao = async (rota: string, ok: string) => { if (await executar(() => api.post(`cargos/${encodeURIComponent(cargoId)}/ficha/${rota}`), ok)) recarregar() }
  async function inativar() {
    if (await executar(() => api.post(`cargos/${encodeURIComponent(cargoId)}/ficha/inativar`, { motivo }), 'Cargo inativado.')) { setInativando(false); setMotivo(''); recarregar() }
  }

  const campo = (k: keyof Ficha, label: string, linhas = 3, hint?: string) => (
    <Field label={label} htmlFor={`f-${k}`} hint={hint} erro={erros[k]} className="sm:col-span-2">
      <textarea id={`f-${k}`} rows={linhas} className="input !h-auto py-2.5" disabled={!editavel} value={(f[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value } as Partial<Ficha>)} />
    </Field>
  )
  const tags = (k: 'competenciasTecnicas' | 'competenciasComportamentais' | 'conhecimentos' | 'certificacoes' | 'kpis', label: string) => (
    <Field label={label} className="sm:col-span-2">
      {editavel ? <TagInput label={label} valor={f[k]} onChange={(v) => set({ [k]: v } as Partial<Ficha>)} />
        : <div className="flex flex-wrap gap-1.5">{f[k].length ? f[k].map((t) => <Badge key={t}>{t}</Badge>) : <span className="text-muted text-[13px]">—</span>}</div>}
    </Field>
  )

  return (
    <div className="space-y-5">
      {d.solicitacaoPendente && (
        <Callout tone="brand" icon="Hourglass">
          Ficha em aprovação desde {dataBR(d.solicitacaoPendente.propostaEm)}.{d.solicitacaoPendente.descricao ? ` Nota: ${d.solicitacaoPendente.descricao}` : ''}
          <div className="mt-3 flex gap-2 flex-wrap">
            {d.permissoes.decidir && <><Button size="sm" icon="Check" onClick={() => setDecisao('aprovar')}>Aprovar</Button><Button size="sm" variant="danger" icon="X" onClick={() => setDecisao('rejeitar')}>Rejeitar</Button></>}
            {d.permissoes.cancelarSubmissao && <Button size="sm" variant="ghost" onClick={() => acao('cancelar-submissao', 'Submissão cancelada.')}>Cancelar submissão</Button>}
            {!d.permissoes.decidir && <span className="text-[12.5px]">{d.permissoes.propostaPorMim ? 'Quem propôs a mudança não pode aprová-la; aguarde outro aprovador.' : 'Aguardando a decisão de um aprovador de cargos.'}</span>}
          </div>
        </Callout>
      )}
      {d.ultimaRejeicao && d.ficha?.status === 'rascunho' && <Callout tone="warning" icon="MessageSquareWarning">Última submissão devolvida: {d.ultimaRejeicao.justificativa || 'sem justificativa'}.</Callout>}
      {!d.ficha && !d.permissoes.editar && <Card><EmptyState icon="FileQuestion" title="Sem ficha oficial" desc="Este cargo ainda não tem ficha. O RH pode criá-la." /></Card>}

      {(d.ficha || d.permissoes.editar) && (
        <Card>
          <CardHead title="Ficha oficial" sub={d.ficha ? `Atualizada em ${dataHoraBR(d.ficha.atualizadoEm)}` : 'Preencha e salve para criar o rascunho.'}
            action={editavel ? <BotaoImportarPdf<FichaImportada> size="sm" rota={`cargos/${encodeURIComponent(cargoId)}/ficha/importar`} rotulo="Importar descrição (PDF)" aoImportar={importar} /> : undefined} />
          <form className="p-5 grid grid-cols-1 sm:grid-cols-2 gap-x-5" onSubmit={(e) => { e.preventDefault(); void salvar() }}>
            <Field label="Código" htmlFor="f-cod" erro={erros.codigo} hint="Único. Em branco, gera automaticamente."><input id="f-cod" className="input" disabled={!editavel} value={f.codigo ?? ''} onChange={(e) => set({ codigo: e.target.value })} /></Field>
            <Field label="Área" htmlFor="f-area"><input id="f-area" className="input" disabled={!editavel} value={f.area ?? ''} onChange={(e) => set({ area: e.target.value })} /></Field>
            <Field label="Família" htmlFor="f-fam" erro={erros.familiaId}>
              <Select id="f-fam" disabled={!editavel} label="Família" className="w-full" value={f.familiaId ?? ''} onChange={(v) => set({ familiaId: v || null, subfamiliaId: null })}>
                <option value="">—</option>{tax.dados?.familias.filter((x) => !x.paiId).map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </Select>
            </Field>
            <Field label="Subfamília" htmlFor="f-sub" erro={erros.subfamiliaId}>
              <Select id="f-sub" disabled={!editavel} label="Subfamília" className="w-full" value={f.subfamiliaId ?? ''} onChange={(v) => set({ subfamiliaId: v || null })}>
                <option value="">—</option>{subfamilias.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </Select>
            </Field>
            <Field label="Trilha de carreira" htmlFor="f-tri">
              <Select id="f-tri" disabled={!editavel} label="Trilha" className="w-full" value={f.trilhaId ?? ''} onChange={(v) => set({ trilhaId: v || null, nivelId: null })}>
                <option value="">—</option>{tax.dados?.trilhas.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </Select>
            </Field>
            <Field label="Nível" htmlFor="f-niv" erro={erros.nivelId}>
              <Select id="f-niv" disabled={!editavel} label="Nível" className="w-full" value={f.nivelId ?? ''} onChange={(v) => set({ nivelId: v || null })}>
                <option value="">—</option>{niveis.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
              </Select>
            </Field>
            <Field label="Cargo de referência" htmlFor="f-ref" erro={erros.cargoReferenciaId} hint="Cargo-base para comparação ou evolução.">
              <Select id="f-ref" disabled={!editavel} label="Cargo de referência" className="w-full" value={f.cargoReferenciaId ?? ''} onChange={(v) => set({ cargoReferenciaId: v || null })}>
                <option value="">—</option>{cat.dados?.itens.filter((x) => x.cargoId !== cargoId).map((x) => <option key={x.cargoId} value={x.cargoId}>{x.nome}</option>)}
              </Select>
            </Field>
            <Field label="Início da vigência" htmlFor="f-vig" erro={erros.vigenciaInicio}><input id="f-vig" type="date" className="input" disabled={!editavel} value={f.vigenciaInicio ?? ''} onChange={(e) => set({ vigenciaInicio: e.target.value || null })} /></Field>
            {campo('descricaoOficial', 'Descrição oficial', 3, 'Obrigatória para submeter à aprovação.')}
            {campo('objetivo', 'Objetivo do cargo', 2, 'Obrigatório para submeter.')}
            {campo('responsabilidades', 'Responsabilidades', 5, 'Obrigatórias para submeter. Uma por linha.')}
            {campo('entregas', 'Principais entregas', 3)}
            {campo('requisitosMinimos', 'Requisitos mínimos', 3)}
            {campo('formacao', 'Formação', 2)}
            {campo('experiencia', 'Experiência', 2)}
            {tags('competenciasTecnicas', 'Competências técnicas')}
            {tags('competenciasComportamentais', 'Competências comportamentais')}
            {tags('conhecimentos', 'Conhecimentos necessários')}
            {tags('certificacoes', 'Certificações')}
            {tags('kpis', 'Indicadores de desempenho relacionados')}
            {editavel && (
              <div className="sm:col-span-2 flex flex-wrap gap-2.5 pt-2">
                <Button type="submit" disabled={salvando} icon="Save">{salvando ? 'Salvando…' : 'Salvar rascunho'}</Button>
                {(d.ficha?.status ?? 'rascunho') === 'rascunho' && <Button variant="soft" icon="Send" disabled={salvando} onClick={() => void submeter()}>Salvar e enviar para aprovação</Button>}
                {d.ficha && d.ficha.status !== 'em_aprovacao' && <Button variant="ghost" icon="CheckCheck" onClick={() => acao('revisar', 'Ficha marcada como revisada.')}>Marcar como revisada</Button>}
              </div>
            )}
          </form>
          {d.permissoes.inativar && d.ficha && (
            <div className="px-5 pb-5">
              {d.ficha.status === 'inativo'
                ? <Button variant="ghost" icon="ArchiveRestore" onClick={() => acao('reativar', 'Cargo reativado.')}>Reativar cargo</Button>
                : <Button variant="danger" icon="Archive" onClick={() => setInativando(true)}>Inativar cargo</Button>}
            </div>
          )}
        </Card>
      )}

      <Modal open={!!decisao} onClose={() => setDecisao(null)} title={decisao === 'aprovar' ? 'Aprovar ficha' : 'Rejeitar ficha'}
        subtitle={decisao === 'aprovar' ? 'Será criada uma nova versão imutável da ficha.' : 'A ficha volta para rascunho com a sua justificativa.'}
        footer={<><Button variant="ghost" onClick={() => setDecisao(null)}>Cancelar</Button><Button variant={decisao === 'rejeitar' ? 'danger' : 'primary'} onClick={() => void decidir()}>{decisao === 'aprovar' ? 'Aprovar' : 'Rejeitar'}</Button></>}>
        <Field label={decisao === 'rejeitar' ? 'Justificativa' : 'Comentário (opcional)'} required={decisao === 'rejeitar'}>
          <textarea className="input !h-auto py-2.5" rows={3} value={justificativa} onChange={(e) => setJustificativa(e.target.value)} />
        </Field>
      </Modal>
      <Modal open={inativando} onClose={() => setInativando(false)} title="Inativar cargo" subtitle="O cargo continua no histórico de vagas e posições antigas."
        footer={<><Button variant="ghost" onClick={() => setInativando(false)}>Cancelar</Button><Button variant="danger" disabled={!motivo.trim()} onClick={() => void inativar()}>Inativar</Button></>}>
        <Field label="Motivo" required><textarea className="input !h-auto py-2.5" rows={3} value={motivo} onChange={(e) => setMotivo(e.target.value)} /></Field>
      </Modal>
    </div>
  )
}

/* ---------- competências ---------- */
interface ItemMatriz { competenciaId: string; nivelEsperado: number; obrigatoria: boolean; criterio: string | null; nome?: string }
function AbaCompetencias({ cargoId, podeEditar }: { cargoId: string; podeEditar: boolean }) {
  const atual = useApi<{ itens: ItemMatriz[] }>(`cargos/${encodeURIComponent(cargoId)}/matriz`)
  const todas = useApi<{ competencias: { id: string; nome: string }[] }>(podeEditar ? `cargos/matriz?cargoId=${encodeURIComponent(cargoId)}` : null)
  const [itens, setItens] = useState<ItemMatriz[]>([])
  useEffect(() => { if (atual.dados) setItens(atual.dados.itens) }, [atual.dados])
  const livres = (todas.dados?.competencias ?? []).filter((c) => !itens.some((i) => i.competenciaId === c.id))
  const mudar = (id: string, p: Partial<ItemMatriz>) => setItens((l) => l.map((i) => (i.competenciaId === id ? { ...i, ...p } : i)))
  async function salvar() {
    if (await executar(() => api.put(`cargos/${encodeURIComponent(cargoId)}/matriz`, { itens }), 'Matriz do cargo salva.')) atual.recarregar()
  }
  return (
    <Card>
      <CardHead title="Competências esperadas" sub="Nível esperado de 1 (básico) a 5 (referência). A visão de todos os cargos está em Matriz de competências." action={<Link to="/cargos/matriz"><Button size="sm" variant="ghost">Ver matriz completa</Button></Link>} />
      <Aguardar r={atual} vazio={() => itens.length === 0 && !podeEditar ? <EmptyState icon="Layers" title="Sem competências definidas" desc="Este cargo ainda não tem competências na matriz." /> : null}>
        {() => (
          <div className="p-5 space-y-3">
            {itens.length === 0 && <p className="text-[13px] text-muted">Nenhuma competência definida ainda.</p>}
            {itens.map((i) => (
              <div key={i.competenciaId} className="grid grid-cols-1 gap-3 sm:grid-cols-[1.4fr_120px_130px_1.6fr_auto] items-end border border-line rounded-xl p-3">
                <div><div className="label">Competência</div><div className="text-[13.5px] font-semibold text-ink py-2">{i.nome ?? todas.dados?.competencias.find((c) => c.id === i.competenciaId)?.nome ?? i.competenciaId}</div></div>
                <Field label="Nível" className="!mb-0"><Dropdown aria-label="Nível esperado" className="input" disabled={!podeEditar} value={i.nivelEsperado} onChange={(e) => mudar(i.competenciaId, { nivelEsperado: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</Dropdown></Field>
                <Field label="Tipo" className="!mb-0"><Dropdown aria-label="Obrigatória ou desejável" className="input" disabled={!podeEditar} value={i.obrigatoria ? 's' : 'n'} onChange={(e) => mudar(i.competenciaId, { obrigatoria: e.target.value === 's' })}><option value="s">Obrigatória</option><option value="n">Desejável</option></Dropdown></Field>
                <Field label="Critério de avaliação" className="!mb-0"><input className="input" disabled={!podeEditar} value={i.criterio ?? ''} onChange={(e) => mudar(i.competenciaId, { criterio: e.target.value })} /></Field>
                {podeEditar && <Button variant="subtle" size="icon-sm" icon="Trash2" aria-label="Remover competência" onClick={() => setItens((l) => l.filter((x) => x.competenciaId !== i.competenciaId))} />}
              </div>
            ))}
            {podeEditar && (
              <div className="flex flex-wrap items-center gap-3 pt-2">
                <Select label="Adicionar competência" value="" onChange={(v) => v && setItens((l) => [...l, { competenciaId: v, nivelEsperado: 3, obrigatoria: true, criterio: '' }])}>
                  <option value="">+ Adicionar competência…</option>{livres.map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}
                </Select>
                <Button icon="Save" onClick={() => void salvar()}>Salvar matriz do cargo</Button>
              </div>
            )}
          </div>
        )}
      </Aguardar>
    </Card>
  )
}

/* ---------- faixa ---------- */
function AbaFaixa({ cargoId }: { cargoId: string }) {
  const r = useApi<{ itens: { id: string; minimo: number; referencia: number | null; maximo: number; moeda: string; vigenciaInicio: string; vigenciaFim: string | null; situacao: string; nivelNome: string | null; criterio: string | null }[]; ressalva: string }>(`cargos/faixas?cargoId=${encodeURIComponent(cargoId)}`)
  return (
    <Card>
      <CardHead title="Faixas salariais do cargo" sub="Acesso restrito. Criação e aprovação em Faixas salariais." action={<Link to="/cargos/faixas"><Button size="sm" variant="ghost">Gerenciar faixas</Button></Link>} />
      <Aguardar r={r} vazio={(d) => d.itens.length === 0 ? <EmptyState icon="Coins" title="Nenhuma faixa cadastrada" desc="Cadastre uma faixa em Faixas salariais." /> : null}>
        {(d) => (
          <>
            <Tabela minWidth={640}>
              <thead><tr><th className={TH}>Escopo</th><th className={TH}>Mínimo</th><th className={TH}>Referência</th><th className={TH}>Máximo</th><th className={TH}>Vigência</th><th className={TH}>Situação</th></tr></thead>
              <tbody>{d.itens.map((x) => (
                <tr key={x.id}><td className={TD}>{[x.nivelNome, x.criterio].filter(Boolean).join(' · ') || 'Cargo inteiro'}</td><td className={TD}>{moeda(x.minimo, x.moeda)}</td><td className={TD}>{moeda(x.referencia, x.moeda)}</td><td className={TD}>{moeda(x.maximo, x.moeda)}</td>
                  <td className={TD}>{dataBR(x.vigenciaInicio)} → {x.vigenciaFim ? dataBR(x.vigenciaFim) : 'em aberto'}</td><td className={TD}><StatusBadge mapa={STATUS_FAIXA} valor={x.situacao} /></td></tr>
              ))}</tbody>
            </Tabela>
            <p className="px-5 py-3 text-[12px] text-muted">{d.ressalva}</p>
          </>
        )}
      </Aguardar>
    </Card>
  )
}

/* ---------- versões ---------- */
function AbaVersoes({ cargoId }: { cargoId: string }) {
  const r = useApi<{ versoes: { versao: number; aprovadaEm: string; aprovadaPor: string; propostaPor: string }[]; solicitacoes: { status: string; propostaEm: string; decididoEm: string | null; justificativa: string | null }[] }>(`cargos/${encodeURIComponent(cargoId)}/versoes`)
  const [ver, setVer] = useState<number | null>(null)
  const det = useApi<{ versao: number; dados: Record<string, unknown>; contra: number | null; mudancas: { campo: string; de: unknown; para: unknown }[] }>(ver ? `cargos/${encodeURIComponent(cargoId)}/versoes/${ver}` : null)
  const fmt = (v: unknown) => (Array.isArray(v) ? v.join(', ') : v == null || v === '' ? '—' : String(v))
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
      <Card>
        <CardHead title="Versões aprovadas" sub="Cada aprovação gera um retrato imutável da ficha." />
        <Aguardar r={r} vazio={(d) => d.versoes.length === 0 ? <EmptyState icon="History" title="Nenhuma versão aprovada" desc="A primeira aprovação cria a versão 1." /> : null}>
          {(d) => (
            <ul className="divide-y divide-line">
              {d.versoes.map((v) => (
                <li key={v.versao} className="px-5 py-3 flex items-center justify-between gap-3">
                  <div><div className="font-semibold text-[13.5px] text-ink">Versão {v.versao}</div><div className="text-[12px] text-muted">Aprovada em {dataHoraBR(v.aprovadaEm)}</div></div>
                  <Button size="sm" variant={ver === v.versao ? 'soft' : 'ghost'} onClick={() => setVer(v.versao)}>Ver mudanças</Button>
                </li>
              ))}
            </ul>
          )}
        </Aguardar>
      </Card>
      <Card>
        <CardHead title={ver ? `Mudanças da v${ver}` : 'Detalhe da versão'} sub={det.dados?.contra ? `Comparação com a v${det.dados.contra}` : undefined} />
        {!ver ? <EmptyState icon="GitCompare" title="Escolha uma versão" desc="Veja o que mudou em relação à versão anterior." /> : (
          <Aguardar r={det}>
            {(d) => d.mudancas.length === 0 ? <p className="p-5 text-[13px] text-muted">{d.contra ? 'Sem diferenças em relação à versão anterior.' : 'Primeira versão: sem versão anterior para comparar.'}</p> : (
              <ul className="divide-y divide-line">{d.mudancas.map((m) => (
                <li key={m.campo} className="px-5 py-3 text-[13px]"><div className="font-semibold text-ink">{m.campo}</div><div className="text-muted line-through">{fmt(m.de)}</div><div className="text-ink">{fmt(m.para)}</div></li>
              ))}</ul>
            )}
          </Aguardar>
        )}
      </Card>
      {r.dados && r.dados.solicitacoes.length > 0 && (
        <Card className="lg:col-span-2">
          <CardHead title="Solicitações" sub="Submissões e decisões." />
          <ul className="divide-y divide-line">{r.dados.solicitacoes.map((s, i) => (
            <li key={i} className="px-5 py-3 text-[13px] flex flex-wrap gap-x-4 gap-y-1"><Badge tone={s.status === 'aprovada' ? 'success' : s.status === 'rejeitada' ? 'danger' : 'neutral'}>{s.status}</Badge><span>Enviada em {dataHoraBR(s.propostaEm)}</span>{s.justificativa && <span className="text-muted">“{s.justificativa}”</span>}</li>
          ))}</ul>
        </Card>
      )}
    </div>
  )
}

/* ---------- vínculos ---------- */
function AbaVinculos({ cargoId }: { cargoId: string }) {
  const r = useApi<{ vagas: { total: number; abertas: number; itens: { id: string; codigo: string; titulo: string; status: string }[] }; pessoas: { total: number; ativas: number; itens: { id: string; nome: string }[] } }>(`cargos/${encodeURIComponent(cargoId)}/uso`)
  return (
    <Aguardar r={r}>
      {(d) => (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Card>
            <CardHead title="Vagas" sub={`${d.vagas.total} no total · ${d.vagas.abertas} em andamento`} />
            {d.vagas.itens.length === 0 ? <EmptyState icon="BriefcaseBusiness" title={d.vagas.total ? 'Lista restrita ao recrutamento' : 'Nenhuma vaga com este cargo'} /> : (
              <ul className="divide-y divide-line">{d.vagas.itens.map((v) => <li key={v.id} className="px-5 py-3 text-[13px]"><Link className="font-semibold text-ink hover:text-brand" to={`/recrutamento/vagas/${v.id}`}>{v.titulo}</Link><span className="text-muted"> · {v.codigo} · {v.status}</span></li>)}</ul>
            )}
          </Card>
          <Card>
            <CardHead title="Pessoas neste cargo" sub={`${d.pessoas.ativas} ativas`} />
            {d.pessoas.itens.length === 0 ? <EmptyState icon="Users" title="Ninguém ocupa este cargo" /> : (
              <ul className="divide-y divide-line">{d.pessoas.itens.map((p) => <li key={p.id} className="px-5 py-3 text-[13px] text-ink">{p.nome}</li>)}</ul>
            )}
          </Card>
        </div>
      )}
    </Aguardar>
  )
}
