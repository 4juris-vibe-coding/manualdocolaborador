/* Construtor de pesquisas: cabeçalho, perguntas, público, distribuição e ciclo de vida. */
import { useEffect, useMemo, useState } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Field, PageHeader, Tabs, Toggle } from '@/components/ui'
import { ConfirmModal, Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { EditorPerguntas } from '@/components/v2/pesquisas/EditorPerguntas'
import { EditorPublico } from '@/components/v2/pesquisas/EditorPublico'
import { Respondente } from '@/components/v2/pesquisas/Respondente'
import { api, executar, useApi } from '@/data/v2/api'
import { MODOS_AJUDA } from '@/components/v2/pesquisas/textos'
import { CATEGORIAS_MODELO, MODELOS } from '@/domain/v2/pesquisaModelos'
import {
  MODO_ROTULO, STATUS_PESQUISA, tempoEstimadoMin, textoConfidencialidade, validarEstrutura,
  type CriteriosPublico, type PerguntaPesquisa,
} from '@/domain/v2/pesquisaTipos'
import { dataBR, hojeISO } from '@/lib/fmt'
import { Dropdown } from '@/components/Dropdown'

interface Pesquisa {
  id: string; titulo: string; descricao?: string; objetivo?: string; categoria: string; modo: 'anonima' | 'identificada'; status: string
  inicio?: string; fim?: string; minGrupo: number; publico: CriteriosPublico; intro?: string; mensagemFinal?: string
  finalidade?: string; quemAcessa?: string; config: { barraProgresso?: boolean; lembretesDias?: number[] }
  perguntas: PerguntaPesquisa[]; versaoAtual: number; linkPublicoAtivo: boolean; atualizadoEm: string
  convidados: number; pendentes: number; respostas: number; taxaResposta: number | null
  versoes: { versao: number; titulo: string; publicadaEm: string; perguntas: number }[]
  historico: { id: number; em: string; tipo: string; detalhes: Record<string, unknown> }[]
}
interface ResumoEnvio { internas: number; email: { enviada: number; falhou: number; nao_configurado: number }; emailConfigurado: boolean }

/* ---------- início: pesquisa nova ---------- */
function NovaPesquisa() {
  const nav = useNavigate()
  const [qs] = useSearchParams()
  const [titulo, setTitulo] = useState('')
  const [modo, setModo] = useState<'anonima' | 'identificada'>('anonima')
  const [modelo, setModelo] = useState(qs.get('modelo') ?? '')
  const [criando, setCriando] = useState(false)
  const m = MODELOS.find((x) => x.chave === modelo)
  useEffect(() => { if (m) setModo(m.modoSugerido) }, [modelo])
  async function criar() {
    setCriando(true)
    const r = await executar(() => api.post<{ id: string }>('pesquisas', { titulo: titulo.trim() || m?.titulo, modo, modeloChave: modelo || undefined }))
    setCriando(false)
    if (r) nav(`/pesquisas-rh/${r.id}`, { replace: true })
  }
  return (
    <>
      <PageHeader title="Nova pesquisa" subtitle="Comece de um modelo pronto ou de uma pesquisa em branco." />
      <SoComBanco>
        <Card className="p-6 max-w-2xl">
          <Field label="Modelo" hint="Você poderá editar tudo depois.">
            <Dropdown className="input" value={modelo} onChange={(e) => setModelo(e.target.value)}>
              <option value="">Em branco (sem perguntas)</option>
              {CATEGORIAS_MODELO.map((c) => <optgroup key={c} label={c}>{MODELOS.filter((x) => x.categoria === c && x.perguntas.length).map((x) => <option key={x.chave} value={x.chave}>{x.titulo}</option>)}</optgroup>)}
            </Dropdown>
          </Field>
          {m && <Callout tone="brand" icon="Info" className="mb-4">{m.objetivo} <b>{m.perguntas.length} perguntas</b> · ~{m.tempoMin} min.</Callout>}
          <Field label="Título" hint={m ? 'Deixe em branco para usar o título do modelo.' : undefined} required={!m}>
            <input className="input" value={titulo} maxLength={160} onChange={(e) => setTitulo(e.target.value)} placeholder={m?.titulo ?? 'Ex.: Clima organizacional 2026'} />
          </Field>
          <Field label="Tipo de pesquisa">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(['anonima', 'identificada'] as const).map((k) => (
                <label key={k} className={`rounded-xl border p-3.5 cursor-pointer ${modo === k ? 'border-brand bg-brand-50' : 'border-line'}`}>
                  <input type="radio" name="modo" className="mr-2 accent-[rgb(var(--c-brand))]" checked={modo === k} onChange={() => setModo(k)} />
                  <b className="text-[14px]">{MODO_ROTULO[k]}</b>
                  <p className="text-[12.5px] text-muted mt-1">{MODOS_AJUDA[k]}</p>
                </label>
              ))}
            </div>
          </Field>
          <div className="flex justify-end gap-2 mt-2">
            <Button variant="ghost" onClick={() => nav('/pesquisas-rh/lista')}>Cancelar</Button>
            <Button icon="ArrowRight" disabled={criando || (!titulo.trim() && !m)} onClick={criar}>{criando ? 'Criando…' : 'Criar e continuar'}</Button>
          </div>
        </Card>
      </SoComBanco>
    </>
  )
}

/* ---------- distribuição ---------- */
interface Convites { modo: string; convidados: number; pendentes: number; respondidos: number; emailConfigurado: boolean; email: Record<string, number>; aviso?: string; itens?: { conviteId: string; nome: string; status: string; respondidoEm?: string; emailStatus?: string; lembretes: number }[] }

function EnvioResumo({ e }: { e: ResumoEnvio | null | undefined }) {
  if (!e) return null
  return (
    <Callout tone={e.email.falhou ? 'danger' : e.emailConfigurado ? 'success' : 'warning'} icon="Mail" className="mt-3">
      Notificações internas criadas: <b>{e.internas}</b>. E-mails enviados: <b>{e.email.enviada}</b>
      {e.email.falhou > 0 && <>; falharam: <b>{e.email.falhou}</b></>}
      {e.email.nao_configurado > 0 && <>; <b>não enviados</b> porque o e-mail não está configurado no servidor (RESEND_API_KEY): {e.email.nao_configurado}</>}.
    </Callout>
  )
}

function Distribuicao({ p, recarregar }: { p: Pesquisa; recarregar: () => void }) {
  const c = useApi<Convites>(p.versaoAtual > 0 ? `pesquisas/${p.id}/convites` : null)
  const [envio, setEnvio] = useState<ResumoEnvio | null>()
  const [link, setLink] = useState<{ url: string; regras: string } | null>(null)
  const [ocupado, setOcupado] = useState(false)
  if (p.versaoAtual === 0) return <Card><EmptyState icon="Send" title="Ainda não publicada" desc="Depois de publicar, aqui você acompanha convites, envia lembretes e gera o link público (pesquisas anônimas)." /></Card>
  const agir = async (fn: () => Promise<any>, ok: string, aoFim?: (r: any) => void) => {
    setOcupado(true); const r = await executar(fn, ok); setOcupado(false)
    if (r) { aoFim?.(r); c.recarregar(); recarregar() }
  }
  return (
    <div className="space-y-5">
      <Aguardar r={c}>
        {(d) => (
          <>
            {!d.emailConfigurado && <Callout tone="warning" icon="MailWarning">O envio de e-mail <b>não está configurado</b> neste servidor (RESEND_API_KEY). Os convites chegam como notificação interna e na página “Pesquisas” de cada pessoa; nenhum e-mail é enviado.</Callout>}
            <div className="grid grid-cols-3 gap-4">
              <Card className="p-4"><div className="text-[26px] font-extrabold text-ink">{d.convidados}</div><div className="text-[12.5px] text-muted">convidadas</div></Card>
              <Card className="p-4"><div className="text-[26px] font-extrabold text-success">{d.respondidos}</div><div className="text-[12.5px] text-muted">responderam</div></Card>
              <Card className="p-4"><div className="text-[26px] font-extrabold text-warning">{d.pendentes}</div><div className="text-[12.5px] text-muted">pendentes</div></Card>
            </div>
            {d.aviso && <Callout tone="success" icon="ShieldCheck">{d.aviso}</Callout>}
            <div className="flex flex-wrap gap-2">
              {['aberta', 'agendada', 'pausada'].includes(p.status) && <Button icon="UserPlus" variant="ghost" disabled={ocupado} onClick={() => agir(() => api.post(`pesquisas/${p.id}/convidar-novos`), 'Verificação concluída.', (r) => setEnvio({ ...(r.envio ?? { internas: 0, email: { enviada: 0, falhou: 0, nao_configurado: 0 }, emailConfigurado: d.emailConfigurado }) }))}>Convidar novos elegíveis</Button>}
              {p.status === 'aberta' && <Button icon="BellRing" variant="ghost" disabled={ocupado || d.pendentes === 0} onClick={() => agir(() => api.post(`pesquisas/${p.id}/lembretes`), 'Lembretes processados.', (r) => setEnvio({ internas: r.internas, email: r.email, emailConfigurado: r.emailConfigurado }))}>Enviar lembrete aos pendentes</Button>}
            </div>
            <EnvioResumo e={envio} />
            <p className="text-[12px] text-muted">Lembretes: no máximo um por pessoa a cada 24 h; cada lembrete gera um link novo (o anterior deixa de valer).</p>
            {d.itens && (
              <Card>
                <CardHead title="Convites nominais" sub="Pesquisa identificada" />
                <ul className="divide-y divide-line">{d.itens.map((i) => (
                  <li key={i.conviteId} className="px-5 py-2.5 flex items-center gap-3 text-[13.5px]"><span className="flex-1">{i.nome}</span>
                    {i.emailStatus && <span className="text-[11.5px] text-muted">e-mail: {i.emailStatus === 'enviada' ? 'enviado' : i.emailStatus === 'falhou' ? 'falhou' : 'não configurado'}</span>}
                    <Badge tone={i.status === 'usado' ? 'success' : i.status === 'pendente' ? 'warning' : 'neutral'}>{i.status === 'usado' ? `respondeu ${dataBR(i.respondidoEm)}` : i.status === 'pendente' ? 'pendente' : 'encerrado'}</Badge></li>
                ))}</ul>
              </Card>
            )}
          </>
        )}
      </Aguardar>

      {p.modo === 'anonima' && p.status !== 'encerrada' && (
        <Card className="p-5">
          <h3 className="text-[14px] font-bold text-ink">Link público (opcional)</h3>
          <p className="text-[12.5px] text-muted mt-1 mb-3">Para quem não tem acesso à plataforma. Qualquer pessoa com o link pode responder; ninguém é identificado, e a taxa de resposta deixa de ser calculada.</p>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" variant="ghost" icon="Link2" disabled={ocupado} onClick={() => agir(() => api.post(`pesquisas/${p.id}/link-publico`, { ativo: true }), 'Link público gerado.', (r) => setLink({ url: r.url, regras: r.regras }))}>{p.linkPublicoAtivo ? 'Gerar novo link (invalida o atual)' : 'Gerar link público'}</Button>
            {p.linkPublicoAtivo && <Button size="sm" variant="danger" icon="Link2Off" disabled={ocupado} onClick={() => agir(() => api.post(`pesquisas/${p.id}/link-publico`, { ativo: false }), 'Link público desativado.', () => setLink(null))}>Desativar</Button>}
          </div>
          {link && (
            <div className="mt-3">
              <div className="flex gap-2"><input readOnly aria-label="Link público" className="input" value={link.url} onFocus={(e) => e.currentTarget.select()} />
                <Button size="sm" icon="Copy" onClick={() => { void navigator.clipboard?.writeText(link.url).then(() => executar(async () => true, 'Link copiado.')) }}>Copiar</Button></div>
              <p className="text-[12px] text-muted mt-2">Copie agora: por segurança o link não fica visível depois. {link.regras}</p>
            </div>
          )}
          {p.linkPublicoAtivo && !link && <p className="text-[12.5px] text-success mt-3">Há um link público ativo. Gere um novo se precisar copiá-lo outra vez.</p>}
        </Card>
      )}
    </div>
  )
}

/* ---------- página ---------- */
const ABAS = [{ key: 'geral', label: 'Geral' }, { key: 'perguntas', label: 'Perguntas' }, { key: 'publico', label: 'Público' }, { key: 'distribuicao', label: 'Distribuição' }, { key: 'historico', label: 'Histórico' }]

function Editor({ id }: { id: string }) {
  const nav = useNavigate()
  const r = useApi<Pesquisa>(`pesquisas/${id}`)
  const [aba, setAba] = useState('geral')
  const [f, setF] = useState<Pesquisa | null>(null)
  const [sujo, setSujo] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [previa, setPrevia] = useState(false)
  const [confirmar, setConfirmar] = useState<null | 'encerrar' | 'publicar'>(null)
  const [resumoPub, setResumoPub] = useState<{ versao: number; convitesCriados: number; novaVersao: boolean; envio: ResumoEnvio | null } | null>(null)

  useEffect(() => { if (r.dados && (!f || (!sujo && r.dados.atualizadoEm !== f.atualizadoEm) || r.dados.id !== f.id)) setF(r.dados) }, [r.dados])
  const alterar = (patch: Partial<Pesquisa>) => { setF((x) => (x ? { ...x, ...patch } : x)); setSujo(true) }

  const encerrada = f?.status === 'encerrada'
  const erroEstrutura = useMemo(() => (f ? validarEstrutura(f.perguntas) : null), [f?.perguntas])

  async function salvar(silencioso = false): Promise<boolean> {
    if (!f) return false
    setSalvando(true)
    const body = { titulo: f.titulo, descricao: f.descricao ?? '', objetivo: f.objetivo ?? '', categoria: f.categoria, modo: f.modo, inicio: f.inicio || null, fim: f.fim || null, minGrupo: f.minGrupo, publico: f.publico, intro: f.intro ?? '', mensagemFinal: f.mensagemFinal ?? '', finalidade: f.finalidade ?? '', quemAcessa: f.quemAcessa ?? '', config: f.config, perguntas: f.perguntas }
    const out = await executar(() => api.put<Pesquisa>(`pesquisas/${id}`, body), silencioso ? undefined : 'Alterações salvas.')
    setSalvando(false)
    if (!out) return false
    setSujo(false); r.recarregar()
    return true
  }

  async function publicar() {
    setConfirmar(null)
    if (!(await salvar(true))) return
    const out = await executar(() => api.post<any>(`pesquisas/${id}/publicar`))
    if (out) { setResumoPub({ versao: out.versao, convitesCriados: out.convitesCriados, novaVersao: out.novaVersao, envio: out.envio }); r.recarregar() }
  }
  const mudar = async (acao: 'pausar' | 'retomar' | 'encerrar', msg: string) => {
    if (sujo && !(await salvar(true))) return
    if (await executar(() => api.post(`pesquisas/${id}/${acao}`), msg)) r.recarregar()
  }
  const duplicar = async () => { const n = await executar(() => api.post<{ id: string }>(`pesquisas/${id}/duplicar`), 'Pesquisa duplicada como rascunho.'); if (n) nav(`/pesquisas-rh/${n.id}`) }

  if (!f) return <Aguardar r={r}>{() => null}</Aguardar>
  const dadosPrevia = {
    titulo: f.titulo, intro: f.intro, objetivo: f.objetivo, tempoMin: tempoEstimadoMin(f.perguntas), prazo: f.fim, perguntas: f.perguntas,
    barraProgresso: f.config.barraProgresso !== false, salvaProgresso: false, modo: f.modo, via: 'convite' as const,
    confidencialidade: textoConfidencialidade(f.modo, 'convite', f.minGrupo, f.finalidade, f.quemAcessa),
  }
  const publicada = f.versaoAtual > 0
  const rotuloPublicar = !publicada ? 'Publicar' : 'Publicar alterações'

  return (
    <>
      <PageHeader title={f.titulo || 'Pesquisa sem título'}
        eyebrow={<div className="flex items-center gap-2"><StatusBadge mapa={STATUS_PESQUISA} valor={f.status} /><Badge tone={f.modo === 'anonima' ? 'success' : 'warning'}>{MODO_ROTULO[f.modo]}</Badge>{f.versaoAtual > 0 && <Badge>versão {f.versaoAtual}</Badge>}{sujo && <Badge tone="gold">alterações não salvas</Badge>}</div>}
        actions={<>
          <Link to="/pesquisas-rh/lista"><Button variant="ghost" icon="ArrowLeft">Voltar</Button></Link>
          <Button variant="ghost" icon="Eye" onClick={() => setPrevia(true)} disabled={!f.perguntas.length}>Pré-visualizar</Button>
          <Button variant="ghost" icon="Copy" onClick={duplicar}>Duplicar</Button>
          {f.versaoAtual > 0 && <Link to={`/pesquisas-rh/${id}/resultados`}><Button variant="ghost" icon="BarChart3">Resultados</Button></Link>}
          {!encerrada && <Button variant="ghost" icon="Save" disabled={salvando || !sujo} onClick={() => salvar()}>{salvando ? 'Salvando…' : 'Salvar'}</Button>}
          {f.status === 'aberta' && <Button variant="ghost" icon="Pause" onClick={() => mudar('pausar', 'Pesquisa pausada.')}>Pausar</Button>}
          {f.status === 'pausada' && <Button variant="ghost" icon="Play" onClick={() => mudar('retomar', 'Pesquisa retomada.')}>Retomar</Button>}
          {['aberta', 'pausada', 'agendada'].includes(f.status) && <Button variant="danger" icon="Square" onClick={() => setConfirmar('encerrar')}>Encerrar coleta</Button>}
          {!encerrada && <Button icon="Rocket" onClick={() => setConfirmar('publicar')} disabled={salvando}>{rotuloPublicar}</Button>}
        </>} />
      <SoComBanco>
        {encerrada && <Callout tone="neutral" icon="Lock" className="mb-5">Pesquisa encerrada: não pode mais ser alterada. Use “Duplicar” para reaplicar.</Callout>}
        <Tabs tabs={ABAS} active={aba} onChange={setAba} />

        {aba === 'geral' && (
          <fieldset disabled={encerrada} className="border-0 p-0 m-0 grid grid-cols-1 gap-x-6 lg:grid-cols-2">
            <div>
              <Field label="Título" required><input className="input" maxLength={160} value={f.titulo} onChange={(e) => alterar({ titulo: e.target.value })} /></Field>
              <Field label="Descrição interna"><textarea className="input min-h-[80px] py-2" value={f.descricao ?? ''} onChange={(e) => alterar({ descricao: e.target.value })} /></Field>
              <Field label="Objetivo" hint="Aparece para quem vai responder (“por que estamos perguntando”)."><textarea className="input min-h-[80px] py-2" value={f.objetivo ?? ''} onChange={(e) => alterar({ objetivo: e.target.value })} /></Field>
              <Field label="Categoria"><input className="input" list="cats" value={f.categoria} onChange={(e) => alterar({ categoria: e.target.value })} /><datalist id="cats">{CATEGORIAS_MODELO.map((c) => <option key={c} value={c} />)}</datalist></Field>
              <div className="grid grid-cols-2 gap-4">
                <Field label="Início" hint="Vazio = hoje."><input type="date" className="input" value={f.inicio ?? ''} onChange={(e) => alterar({ inicio: e.target.value })} /></Field>
                <Field label="Término" required hint="O último dia para responder."><input type="date" className="input" min={hojeISO()} value={f.fim ?? ''} onChange={(e) => alterar({ fim: e.target.value })} /></Field>
              </div>
            </div>
            <div>
              <Field label="Tipo de pesquisa" hint={publicada ? 'Não pode mudar depois da primeira publicação.' : undefined}>
                <Dropdown className="input" disabled={publicada} value={f.modo} onChange={(e) => alterar({ modo: e.target.value as 'anonima' | 'identificada' })}>
                  <option value="anonima">Anônima</option><option value="identificada">Identificada</option>
                </Dropdown>
              </Field>
              <Callout tone={f.modo === 'anonima' ? 'success' : 'warning'} icon={f.modo === 'anonima' ? 'ShieldCheck' : 'Eye'} className="mb-4">{MODOS_AJUDA[f.modo]}</Callout>
              {f.modo === 'anonima' ? (
                <Field label="Mínimo de respostas por grupo" hint="Grupos (área, unidade) com menos respostas que isso são ocultados. Mínimo 3; recomendado 5 ou mais, conforme a política de privacidade da empresa.">
                  <input type="number" min={3} max={50} className="input w-28" value={f.minGrupo} onChange={(e) => alterar({ minGrupo: Number(e.target.value) })} />
                </Field>
              ) : (
                <>
                  <Field label="Finalidade do tratamento" required hint="Para que as respostas serão usadas. Será exibida a quem responde."><textarea className="input min-h-[70px] py-2" value={f.finalidade ?? ''} onChange={(e) => alterar({ finalidade: e.target.value })} /></Field>
                  <Field label="Quem poderá ver as respostas individuais" required><input className="input" value={f.quemAcessa ?? ''} onChange={(e) => alterar({ quemAcessa: e.target.value })} placeholder="Ex.: equipe de RH e a liderança direta" /></Field>
                </>
              )}
              <Field label="Texto de abertura"><textarea className="input min-h-[80px] py-2" value={f.intro ?? ''} onChange={(e) => alterar({ intro: e.target.value })} /></Field>
              <Field label="Mensagem de conclusão"><textarea className="input min-h-[70px] py-2" value={f.mensagemFinal ?? ''} onChange={(e) => alterar({ mensagemFinal: e.target.value })} /></Field>
              <div className="mb-4"><Toggle checked={f.config.barraProgresso !== false} onChange={(v) => alterar({ config: { ...f.config, barraProgresso: v } })} label="Mostrar barra de progresso" /></div>
              <Field label="Lembretes automáticos" hint="Dias antes do término, separados por vírgula (ex.: 5, 2). São processados quando o RH abre o painel ou usa a automação; não há agendador próprio.">
                <input className="input" value={(f.config.lembretesDias ?? []).join(', ')} onChange={(e) => alterar({ config: { ...f.config, lembretesDias: e.target.value.split(/[,\s]+/).map(Number).filter((n) => Number.isInteger(n) && n >= 0) } })} />
              </Field>
            </div>
          </fieldset>
        )}

        {aba === 'perguntas' && (
          <>
            {publicada && !encerrada && <Callout tone="brand" icon="GitBranch" className="mb-4">Esta pesquisa já foi publicada (versão {f.versaoAtual}). Alterações nas perguntas entram em vigor ao clicar em <b>Publicar alterações</b>, criando uma <b>nova versão</b>; respostas anteriores continuam ligadas à versão em que foram dadas.</Callout>}
            <EditorPerguntas perguntas={f.perguntas} onChange={(p) => alterar({ perguntas: p })} desabilitado={encerrada} />
          </>
        )}

        {aba === 'publico' && <EditorPublico pesquisaId={id} publico={f.publico} onChange={(p) => alterar({ publico: p })} desabilitado={encerrada} />}
        {aba === 'distribuicao' && <Distribuicao p={f} recarregar={r.recarregar} />}
        {aba === 'historico' && (
          <Card>
            <CardHead title="Histórico de alterações" sub="Quem fez o quê e quando." />
            {f.historico.length === 0 ? <p className="p-5 text-[13px] text-muted">Sem eventos.</p> : (
              <ul className="divide-y divide-line">{f.historico.map((h) => <li key={h.id} className="px-5 py-2.5 text-[13px] flex gap-3"><span className="text-muted w-36 shrink-0">{new Date(h.em).toLocaleString('pt-BR')}</span><span className="text-ink">{h.tipo.replace(/_/g, ' ')}</span></li>)}</ul>
            )}
            {f.versoes.length > 0 && <div className="px-5 pb-4 pt-2 text-[12.5px] text-muted border-t border-line">Versões: {f.versoes.map((v) => `v${v.versao} (${v.perguntas} perguntas, ${dataBR(v.publicadaEm)})`).join(' · ')}</div>}
          </Card>
        )}
      </SoComBanco>

      <ConfirmModal open={confirmar === 'encerrar'} onClose={() => setConfirmar(null)} titulo="Encerrar a coleta?" confirmar="Encerrar"
        texto="Os links deixam de funcionar e a pesquisa não poderá mais ser alterada nem reaberta. Os resultados continuam disponíveis." onConfirm={() => { setConfirmar(null); void mudar('encerrar', 'Coleta encerrada.') }} />
      <ConfirmModal open={confirmar === 'publicar'} onClose={() => setConfirmar(null)} perigo={false} titulo={publicada ? 'Publicar alterações?' : 'Publicar pesquisa?'} confirmar="Publicar" onConfirm={publicar}
        texto={erroEstrutura ? <span className="text-danger">{erroEstrutura}</span> : publicada
          ? 'Se as perguntas ou textos mudaram, será criada uma nova versão. Os convites já emitidos continuam valendo.'
          : f.modo === 'identificada' ? 'Esta pesquisa é IDENTIFICADA: as respostas ficarão ligadas às pessoas. Convites serão criados e as pessoas serão notificadas.' : 'Serão criados convites individuais para o público elegível e as pessoas serão notificadas. Você poderá acompanhar sem ver quem respondeu.'} />

      <Modal open={!!resumoPub} onClose={() => setResumoPub(null)} title="Publicada" footer={<Button onClick={() => { setResumoPub(null); setAba('distribuicao') }}>Ver distribuição</Button>}>
        {resumoPub && <div className="pb-3 text-[14px] text-ink-2">
          <p>Versão <b>{resumoPub.versao}</b> no ar{resumoPub.novaVersao ? ' (nova versão criada)' : ''}.</p>
          {resumoPub.convitesCriados > 0 && <p className="mt-1">Convites criados: <b>{resumoPub.convitesCriados}</b>.</p>}
          <EnvioResumo e={resumoPub.envio} />
        </div>}
      </Modal>

      {previa && (
        <div className="fixed inset-0 z-[250] overflow-y-auto bg-surface-3">
          <button type="button" onClick={() => setPrevia(false)} className="fixed top-3 right-3 z-[260] h-10 px-4 rounded-xl bg-midnight text-white text-[13px] font-semibold shadow-md">Fechar pré-visualização</button>
          <Respondente dados={dadosPrevia} previa />
        </div>
      )}
    </>
  )
}

export default function Construtor() {
  const { id } = useParams()
  return id ? <Editor id={id} key={id} /> : <NovaPesquisa />
}
