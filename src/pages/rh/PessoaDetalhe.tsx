import { useEffect, useState } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Contrato, Documento, TipoDocumento } from '@/lib/types'
import { PageHeader, Card, CardHead, Badge, Button, Avatar, Tabs, EmptyState, Field, Icon, Progress, Callout, Toggle } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { brl, fmtDate, STATUS_COLAB, REGIME_LABEL, cn } from '@/lib/utils'
import { hojeISO, tempoParceria, diasEntre } from '@/domain/datas'
import { progresso, RESPONSAVEL_LABEL_ADMIN, prazoItem } from '@/domain/jornada'
import { ACAO_LABEL, historico, nivelDe } from '@/domain/gamificacao'
import { GOSTOS } from '@/domain/aniversarios'
import { PAPEL_LABEL } from '@/domain/permissions'
import { ocultar } from '@/domain/validacao'
import { PessoaForm } from './PessoaForm'
import { AcessoPortal } from '@/components/AcessoPortal'
import { TIPOS_DOC } from '../Perfil'
import { STATUS_PERIODO } from '../Disponibilidade'
import { ExigenciaForm, SITUACAO_EX, validadeEx } from './Exigencias'
import { FeedbackForm, CLASS_FB } from './Feedbacks'
import { RegistroForm, CLASS_REG } from './Registros'
import { PerfilComportamentalEditor } from '../Perfil'
import { DependentesLista } from '../Perfil'
import { ESCOLARIDADE_LABEL } from '@/domain/metricas'
import { BarrasDisc } from '@/components/charts'
import { CATEGORIAS_DISC } from '@/domain/perfil'
import { TIPO_BEN } from './Beneficios'
import { Dropdown } from '@/components/Dropdown'
import { MODO_API } from '@/data/config'
import { api, ErroApi, useApi } from '@/data/v2/api'
import { ListaDocumentos } from '@/components/v2/financeiro/Documentos'
import { useTem } from '@/data/v2/acesso'
import { executar } from '@/data/v2/api'
import { recarregarEstado } from '@/data/sync'
import { BadgeContrato, dinheiro } from '@/components/v2/financeiro/comum'

const STATUS_CONTRATO: Record<Contrato['status'], { label: string; tone: string }> = {
  rascunho: { label: 'Rascunho', tone: 'neutral' }, vigente: { label: 'Vigente', tone: 'success' },
  em_renovacao: { label: 'Em renovação', tone: 'warning' }, encerrado: { label: 'Encerrado', tone: 'neutral' },
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return <div className="py-2.5 border-b border-line last:border-0"><dt className="text-[11px] font-bold uppercase tracking-wide text-muted">{label}</dt><dd className="text-[13.5px] text-ink font-medium mt-0.5 break-words">{value || '—'}</dd></div>
}

export default function PessoaDetalhe() {
  const { id = '' } = useParams()
  const s = useStore()
  const p = s.pessoa(id)
  const hoje = hojeISO()
  const [tab, setTab] = useState('dados')
  const [editar, setEditar] = useState(false)
  const [encerrar, setEncerrar] = useState(false)
  const [reativar, setReativar] = useState(false)
  const [excluir, setExcluir] = useState(false)
  const navigate = useNavigate()
  const podeExcluir = s.pode('admin:usuarios') && !!p && p.id !== s.realUser().id

  if (!p) return <Card><EmptyState icon="UserX" title="Pessoa não encontrada" desc="O cadastro pode ter sido removido." action={<Link to="/rh/pessoas" className="text-brand font-semibold">Voltar para a lista</Link>} /></Card>

  const st = STATUS_COLAB[p.status]
  const contratos = s.contratos.filter((k) => k.colaboradorId === id).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const docs = s.documentos.filter((d) => d.colaboradorId === id)
  const regs = s.registros.filter((r) => r.colaboradorId === id).sort((a, b) => b.data.localeCompare(a.data))
  const procs = s.processos.filter((x) => x.colaboradorId === id).sort((a, b) => b.iniciadoEm.localeCompare(a.iniciadoEm))
  const periodos = s.periodos.filter((x) => x.colaboradorId === id).sort((a, b) => b.inicio.localeCompare(a.inicio))
  const pontos = s.pontosDe(id)

  return (
    <>
      <Link to="/rh/pessoas" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-muted hover:text-ink mb-3"><Icon name="ArrowLeft" className="h-4 w-4" />Pessoas</Link>
      <PageHeader title={p.nome} subtitle={`${s.cargoNome(p.cargoId)} · ${s.setorNome(p.setorId)} · ${PAPEL_LABEL[p.papel]}`}
        eyebrow={<Badge tone={st.tone} dot>{st.label}</Badge>}
        actions={<>
          <Button variant="ghost" icon="Pencil" onClick={() => setEditar(true)}>Editar</Button>
          {p.status === 'encerrado'
            ? <Button variant="soft" icon="RotateCcw" onClick={() => setReativar(true)}>Reativar parceria</Button>
            : <Button variant="danger" icon="UserMinus" onClick={() => setEncerrar(true)}>Encerrar parceria</Button>}
          {podeExcluir && <Button variant="subtle" icon="Trash2" onClick={() => setExcluir(true)}>Excluir cadastro</Button>}
        </>} />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <Card className="p-4"><div className="text-[11.5px] text-muted">Parceria</div><div className="text-[17px] font-bold text-ink mt-1">{tempoParceria(p.dataEntrada, p.encerramento?.data ?? hoje)}</div><div className="text-[11.5px] text-muted">desde {fmtDate(p.dataEntrada)}</div></Card>
        <Card className="p-4"><div className="text-[11.5px] text-muted">Contrato atual</div><div className="text-[17px] font-bold text-ink mt-1">{contratos[0] ? brl(contratos[0].valorMensal) : '—'}</div><div className="text-[11.5px] text-muted">{contratos[0] ? STATUS_CONTRATO[contratos[0].status].label : 'sem contrato'}</div></Card>
        <Card className="p-4"><div className="text-[11.5px] text-muted">Documentos</div><div className="text-[17px] font-bold text-ink mt-1">{docs.length}</div><div className="text-[11.5px] text-muted">{docs.filter((d) => d.validade && d.validade < hoje).length} vencido(s)</div></Card>
        <Card className="p-4"><div className="text-[11.5px] text-muted">Participação</div><div className="text-[17px] font-bold text-ink mt-1">{pontos.toLocaleString('pt-BR')} pts</div><div className="text-[11.5px] text-muted">Nível {nivelDe(pontos, s.config.gamificacao.niveis).nome}</div></Card>
      </div>

      {p.encerramento && <Callout tone="neutral" icon="UserMinus" className="mb-6">Parceria encerrada em <b>{fmtDate(p.encerramento.data)}</b> · {s.motivosEncerramento.find((m) => m.id === p.encerramento!.motivoId)?.nome}{p.encerramento.observacao ? ` — ${p.encerramento.observacao}` : ''}</Callout>}

      <Tabs tabs={[
        { key: 'dados', label: 'Dados' }, { key: 'contrato', label: `Contratos (${contratos.length})` }, { key: 'documentos', label: `Documentos (${docs.length})` },
        { key: 'jornadas', label: 'Integração / encerramento' }, { key: 'registros', label: `Registros (${regs.length})` },
        { key: 'feedbacks', label: `Feedbacks (${s.feedbacks.filter((f) => f.colaboradorId === id).length})` },
        { key: 'avaliacoes', label: 'Avaliações' },
        { key: 'exigencias', label: `Exigências (${s.exigencias.filter((e) => e.colaboradorId === id).length})` },
        { key: 'beneficios', label: 'Benefícios & dependentes' }, { key: 'perfil', label: 'Perfil comportamental' },
        { key: 'historico', label: 'Histórico' }, { key: 'disponibilidade', label: 'Disponibilidade' }, { key: 'pontos', label: 'Pontos' },
      ]} active={tab} onChange={setTab} />

      {tab === 'dados' && (
        <div className="grid lg:grid-cols-3 gap-6">
          {s.pode('pessoas:gerenciar') && (
            <AcessoPortal pessoa={p} ehVoce={p.id === s.realUser().id}
              pode={s.pode('admin:usuarios') || p.papel === 'colaborador' || p.papel === 'gestor'} />
          )}
          <Card className="px-5 py-2"><dl>
            <Row label="E-mail" value={p.email} /><Row label="Telefone" value={p.telefone} /><Row label="Cidade / UF" value={p.cidade ? `${p.cidade} / ${p.uf}` : ''} />
            <Row label="Nascimento" value={p.nascimento ? fmtDate(p.nascimento) : 'Não informado'} /><Row label="Nome social" value={p.nomeSocial} />
          </dl></Card>
          <Card className="px-5 py-2"><dl>
            <Row label="Forma de contratação" value={REGIME_LABEL[p.regime]} /><Row label="Razão social" value={p.razaoSocial} /><Row label="CNPJ" value={p.cnpj} />
            {p.regime === 'autonomo' && <Row label="CPF" value={ocultar(p.cpf, 5)} />}
            <Row label="Unidade" value={s.unidades.find((u) => u.id === p.unidadeId)?.nome} />
          </dl></Card>
          <Card className="px-5 py-2"><dl>
            <Row label="Banco / PIX" value={p.pixChave ? `${p.banco ?? '—'} · PIX ${p.pixTipo}: ${ocultar(p.pixChave, 4)}` : p.banco} />
            <Row label="Emergência" value={p.emergenciaNome ? `${p.emergenciaNome} · ${p.emergenciaTelefone ?? ''}` : ''} />
            <Row label="Gostos" value={GOSTOS.filter((g) => p.preferencias?.[g.chave]).map((g) => `${g.emoji} ${p.preferencias![g.chave]}`).join(' · ') || undefined} />
            <Row label="Privacidade" value={[p.privacidade.mostrarMarcos && 'marcos visíveis', p.privacidade.aparecerEmDestaques && 'em destaques'].filter(Boolean).join(' · ') || 'Tudo oculto'} />
          </dl></Card>
          <Card className="px-5 py-2"><dl>
            <Row label="Endereço" value={p.endereco?.logradouro ? `${p.endereco.logradouro}${p.endereco.numero ? `, ${p.endereco.numero}` : ''}${p.endereco.bairro ? ` · ${p.endereco.bairro}` : ''}${p.endereco.cep ? ` · CEP ${p.endereco.cep}` : ''}` : undefined} />
            <Row label="Celular / e-mail pessoal" value={[p.celular, p.emailPessoal].filter(Boolean).join(' · ')} />
          </dl></Card>
          <Card className="px-5 py-2"><dl>
            <Row label="Escolaridade" value={p.escolaridade ? `${ESCOLARIDADE_LABEL[p.escolaridade]}${p.curso ? ` · ${p.curso}` : ''}` : undefined} />
            <Row label="Responsável direto" value={p.responsavelId ? s.nomeDe(p.responsavelId) : 'Lideranças da área'} />
          </dl></Card>
          <Card className="px-5 py-2"><dl>
            <Row label="Matrícula / código externo" value={[p.matricula, p.codigoExterno].filter(Boolean).join(' · ')} />
            <Row label="Fuso · camiseta" value={[p.fusoHorario, p.tamanhoCamisa].filter(Boolean).join(' · ')} />
          </dl></Card>
        </div>
      )}
      {tab === 'feedbacks' && <FeedbacksTab pessoaId={id} />}
      {tab === 'avaliacoes' && <AvaliacoesTab pessoaId={id} />}
      {tab === 'exigencias' && <ExigenciasTab pessoaId={id} />}
      {tab === 'beneficios' && <BeneficiosTab pessoaId={id} />}
      {tab === 'perfil' && (
        <Card className="p-5">
          {p.perfil?.consentimento ? (
            <div className="grid md:grid-cols-[280px_1fr] gap-6">
              <div><h3 className="text-[12px] font-bold uppercase text-muted mb-2">DISC ({p.perfil.fonte})</h3><BarrasDisc valores={CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: p.perfil!.disc[d.chave], cor: d.cor }))} /><p className="text-[11.5px] text-muted mt-3">Atualizado em {fmtDate(p.perfil.atualizadoEm)} · consentimento registrado</p></div>
              <PerfilComportamentalEditor pessoaId={id} />
            </div>
          ) : <><Callout tone="neutral" icon="Lock" className="mb-4">Esta pessoa não registrou perfil comportamental com consentimento. O RH só pode registrar um perfil (ex.: de assessment) se a pessoa consentir.</Callout><PerfilComportamentalEditor pessoaId={id} /></>}
        </Card>
      )}
      {tab === 'historico' && (
        <Card>
          <CardHead title="Histórico de função e valor de contrato" sub="Registrado automaticamente a cada mudança" />
          {s.historicoFuncao.filter((h) => h.colaboradorId === id).length === 0 ? <EmptyState icon="History" title="Sem mudanças registradas" /> : (
            <ol className="p-5 space-y-4">
              {s.historicoFuncao.filter((h) => h.colaboradorId === id).sort((a, b) => b.em.localeCompare(a.em)).map((h) => (
                <li key={h.id} className="flex gap-3">
                  <span className="h-8 w-8 rounded-lg bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name={h.cargoNovoId || h.cargoAnteriorId ? 'Briefcase' : 'Coins'} className="h-4 w-4" /></span>
                  <div className="text-[13px]">
                    {(h.cargoAnteriorId || h.cargoNovoId) && <div className="text-ink"><b>Função:</b> {h.cargoAnteriorId ? s.cargoNome(h.cargoAnteriorId) : '—'} → {h.cargoNovoId ? s.cargoNome(h.cargoNovoId) : '—'}</div>}
                    {(h.valorAnterior != null || h.valorNovo != null) && <div className="text-ink"><b>Valor do contrato:</b> {brl(h.valorAnterior ?? 0)} → {brl(h.valorNovo ?? 0)}</div>}
                    <div className="text-[11.5px] text-muted">{fmtDate(h.em)} · por {s.nomeDe(h.porId)}</div>
                  </div>
                </li>
              ))}
            </ol>
          )}
        </Card>
      )}

      {tab === 'contrato' && (MODO_API ? <div className="space-y-4"><SalarioV2 pessoaId={id} /><ContratosV2 pessoaId={id} /></div> : <ContratosTab pessoaId={id} contratos={contratos} />)}
      {tab === 'documentos' && (MODO_API ? <ListaDocumentos filtro={`pessoa=${id}`} vinculo={{ pessoaId: id }} podeEnviar titulo="Documentos da pessoa" /> : <DocumentosTab pessoaId={id} docs={docs} />)}
      {tab === 'jornadas' && (
        <div className="space-y-4">
          <div className="flex flex-wrap gap-2">
            {s.checklists.map((m) => <Button key={m.id} size="sm" variant="ghost" icon={m.tipo === 'integracao' ? 'Rocket' : 'DoorOpen'} onClick={() => feedback(s.iniciarJornada(id, m.id), `Processo "${m.nome}" iniciado.`)}>Iniciar: {m.nome}</Button>)}
          </div>
          {procs.length === 0 ? <Card><EmptyState icon="ListChecks" title="Nenhum processo" desc="Inicie a integração ou o encerramento usando os checklists configurados." /></Card> : procs.map((x) => {
            const pr = progresso(x)
            return (
              <Card key={x.id}>
                <CardHead title={`${x.tipo === 'integracao' ? 'Integração' : 'Encerramento'} · ${s.checklists.find((c) => c.id === x.modeloId)?.nome ?? ''}`} sub={`Iniciado em ${fmtDate(x.iniciadoEm)}${x.concluidoEm ? ` · concluído em ${fmtDate(x.concluidoEm)}` : ''}`} action={<span className="text-[13px] font-bold">{pr.percentual}%</span>} />
                <div className="px-5 pt-3"><Progress value={pr.percentual} /></div>
                <ul className="p-3 grid sm:grid-cols-2 gap-1">
                  {x.itens.map((i) => (
                    <li key={i.id}><label className="flex items-start gap-2.5 p-2 rounded-lg hover:bg-surface-2 cursor-pointer">
                      <input type="checkbox" className="h-4 w-4 mt-0.5 accent-brand" checked={i.feito} onChange={(e) => feedback(s.marcarItemJornada(x.id, i.id, e.target.checked), 'Checklist atualizado.')} />
                      <span className="text-[12.5px]"><span className={cn(i.feito && 'line-through text-muted')}>{i.titulo}</span>
                        <span className="block text-[11px] text-muted">{RESPONSAVEL_LABEL_ADMIN[i.responsavel]}{i.feito ? ` · ${fmtDate(i.feitoEm)}` : prazoItem(x, i.prazoDias) ? ` · até ${fmtDate(prazoItem(x, i.prazoDias))}` : ''}</span></span>
                    </label></li>
                  ))}
                </ul>
              </Card>
            )
          })}
        </div>
      )}
      {tab === 'registros' && <RegistrosTab pessoaId={id} />}
      {tab === 'disponibilidade' && (
        <Card>
          <CardHead title="Períodos de indisponibilidade" sub="O RH vê também as observações privadas — trate com sigilo." />
          {periodos.length === 0 ? <EmptyState icon="Palmtree" title="Nenhum período registrado" /> : (
            <ul className="divide-y divide-line">
              {periodos.map((x) => (
                <li key={x.id} className="p-4 flex items-start gap-3 flex-wrap">
                  <div className="flex-1 min-w-[220px]">
                    <div className="text-[13.5px] font-semibold text-ink">{fmtDate(x.inicio)} → {fmtDate(x.fim)} <span className="text-muted font-normal">· {diasEntre(x.inicio, x.fim) + 1} dia(s)</span></div>
                    {x.mensagemEquipe && <p className="text-[12px] text-muted">Equipe: {x.mensagemEquipe}</p>}
                    {x.observacaoPrivada && <p className="text-[12px] text-muted"><Icon name="Lock" className="h-3 w-3 inline mr-1" />{x.observacaoPrivada}</p>}
                  </div>
                  <Badge tone={STATUS_PERIODO[x.status].tone} dot>{STATUS_PERIODO[x.status].label}</Badge>
                </li>
              ))}
            </ul>
          )}
        </Card>
      )}
      {tab === 'pontos' && (
        <Card>
          <CardHead title="Histórico de pontos" sub="Para estornos e concessões, use Gestão da gamificação" />
          <ul className="divide-y divide-line">
            {historico(s.lancamentos, id).slice(0, 30).map((l) => (
              <li key={l.id} className="flex items-center gap-3 px-5 py-3"><div className="flex-1 min-w-0"><div className="text-[13px] font-semibold text-ink truncate">{l.descricao}</div><div className="text-[11.5px] text-muted">{ACAO_LABEL[l.acao]} · {fmtDate(l.criadoEm)}</div></div><span className={cn('font-bold tabular-nums', l.pontos >= 0 ? 'text-success' : 'text-danger')}>{l.pontos >= 0 ? '+' : ''}{l.pontos}</span></li>
            ))}
          </ul>
        </Card>
      )}

      {editar && <PessoaForm pessoa={p} onClose={() => setEditar(false)} />}
      {encerrar && <EncerrarModal pessoaId={id} onClose={() => setEncerrar(false)} />}
      <ConfirmModal open={excluir} onClose={() => setExcluir(false)} titulo="Excluir cadastro definitivamente?" confirmar="Excluir"
        texto={MODO_API
          ? 'Exclusão definitiva só é possível para cadastros sem contratos, documentos, notas ou pagamentos (esse histórico tem prazo de guarda). Para quem tem histórico, encerre a parceria e use a anonimização (LGPD).'
          : `${p.nome} e tudo o que está ligado a essa pessoa (contratos, documentos, reembolsos, notas, pontos, avaliações…) serão apagados. Esta ação não pode ser desfeita. Para manter o histórico, prefira encerrar a parceria.`}
        onConfirm={() => { if (feedback(s.excluirPessoa(id), 'Cadastro excluído.')) { setExcluir(false); navigate('/rh/pessoas') } }} />
      <ConfirmModal open={reativar} onClose={() => setReativar(false)} perigo={false} titulo="Reativar parceria?" confirmar="Reativar"
        texto="A pessoa volta a ter acesso à plataforma. Registre também um novo contrato, se for o caso."
        onConfirm={() => { if (feedback(s.reativarParceria(id), 'Parceria reativada.')) setReativar(false) }} />
    </>
  )
}

interface PendenciasPessoa { contratosAtivos: string[]; notasEmAndamento: number; contasAbertas: number; valorAberto: number; documentosPendentes: number; reembolsosAbertos: number }

function EncerrarModal({ pessoaId, onClose }: { pessoaId: string; onClose: () => void }) {
  const s = useStore()
  const [data, setData] = useState(hojeISO())
  const [motivo, setMotivo] = useState('')
  const [obs, setObs] = useState('')
  const [checklist, setChecklist] = useState(true)
  const [encerrarContratos, setEncerrarContratos] = useState(true)
  const [pend, setPend] = useState<PendenciasPessoa | null>(null)
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (MODO_API) void api.get<PendenciasPessoa>(`financeiro/pessoas/${encodeURIComponent(pessoaId)}/pendencias`).then(setPend).catch(() => setPend(null)) }, [pessoaId])
  const confirmar = async () => {
    if (MODO_API && encerrarContratos && pend?.contratosAtivos.length) {
      if (!motivo) { toast('Selecione um motivo.', 'danger'); return }
      setEnviando(true)
      const nomeMotivo = s.motivosEncerramento.find((m) => m.id === motivo)?.nome ?? 'Encerramento da parceria'
      // Encerramento comercial de cada contrato; notas e pagamentos em aberto seguem no fluxo até a liquidação.
      for (const k of pend.contratosAtivos) {
        try { await api.post(`financeiro/contratos/${k}/encerrar`, { data, tipo: 'outro', motivo: `${nomeMotivo}${obs.trim() ? ` — ${obs.trim()}` : ''}`, confirmarPendencias: true }) }
        catch (e) { setEnviando(false); toast(`Contrato não encerrado: ${(e as ErroApi).message}`, 'danger'); return }
      }
      setEnviando(false)
    }
    if (feedback(s.encerrarParceria(pessoaId, data, motivo, obs.trim() || undefined, checklist), 'Parceria encerrada.')) onClose()
  }
  const temPend = !!pend && pend.notasEmAndamento + pend.contasAbertas + pend.reembolsosAbertos + pend.documentosPendentes > 0
  return (
    <Modal open onClose={onClose} title="Encerrar parceria" subtitle={s.nomeDe(pessoaId)}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button variant="danger" icon="UserMinus" disabled={enviando} onClick={confirmar}>{enviando ? 'Encerrando…' : 'Confirmar encerramento'}</Button></>}>
      <Callout tone="warning" icon="AlertTriangle" className="mb-4">Encerramento da relação comercial (não é rescisão trabalhista). Períodos futuros de indisponibilidade são cancelados e o acesso à plataforma é desativado. Contratos, notas, pagamentos e documentos são mantidos para auditoria.</Callout>
      {MODO_API && pend && <Callout tone={temPend ? 'warning' : 'success'} icon={temPend ? 'ListChecks' : 'CheckCircle2'} className="mb-4">
        <b>Pendências financeiras e documentais:</b> {pend.contratosAtivos.length} contrato(s) não encerrado(s) · {pend.notasEmAndamento} nota(s) em análise · {pend.contasAbertas} pagamento(s) em aberto ({dinheiro(pend.valorAberto)}) · {pend.reembolsosAbertos} reembolso(s) em aberto · {pend.documentosPendentes} documento(s) a conferir.
        {temPend && <span className="block mt-1">Elas continuam no fluxo depois do encerramento; acompanhe em Gestão de prestadores.</span>}
      </Callout>}
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Data de encerramento" required htmlFor="enc-d"><input id="enc-d" type="date" className="input" value={data} onChange={(e) => setData(e.target.value)} /></Field>
        <Field label="Motivo" required htmlFor="enc-m"><Dropdown id="enc-m" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)}><option value="">Selecione…</option>{s.motivosEncerramento.filter((m) => m.ativo).map((m) => <option key={m.id} value={m.id}>{m.nome}</option>)}</Dropdown></Field>
      </div>
      <Field label="Observação (opcional)" htmlFor="enc-o" hint="Evite registrar dados pessoais sensíveis."><textarea id="enc-o" className="input !h-auto py-2.5" rows={2} value={obs} onChange={(e) => setObs(e.target.value)} /></Field>
      <div className="space-y-2">
        <Toggle checked={checklist} onChange={setChecklist} label="Iniciar o checklist de encerramento" />
        {MODO_API && !!pend?.contratosAtivos.length && <Toggle checked={encerrarContratos} onChange={setEncerrarContratos} label={`Encerrar também ${pend.contratosAtivos.length} contrato(s) em vigor nesta data`} />}
      </div>
    </Modal>
  )
}

interface Salario {
  cargo: { id: string; nome: string | null; valorPadrao: number | null } | null
  contrato: { id: string; numero: string; valor: number; inicio: string; status: string } | null
  outrosContratos: number
  historico: { numero: number; vigenciaInicio: string; valorAnterior: number | null; valorNovo: number | null; motivo: string; por: string | null; em: string }[]
}

/** Salário da pessoa (valor do contrato mensal) × valor padrão da função. Pessoas da mesma função podem ter valores diferentes. */
function SalarioV2({ pessoaId }: { pessoaId: string }) {
  const r = useApi<Salario>(`pessoas/${encodeURIComponent(pessoaId)}/salario`)
  const podeAjustar = useTem('fin:cadastrar')
  const [aberto, setAberto] = useState<{ valor: string } | null>(null)
  const [vig, setVig] = useState(hojeISO())
  const [motivo, setMotivo] = useState('')
  const [ocupado, setOcupado] = useState(false)
  const d = r.dados
  if (!d) return r.erro ? <Callout tone="danger" icon="AlertTriangle">{r.erro.message}</Callout> : <Card><p className="p-5 text-[13px] text-muted">Carregando salário…</p></Card>
  const valor = d.contrato?.valor ?? 0
  const padrao = d.cargo?.valorPadrao ?? null
  const aDefinir = !!d.contrato && valor === 0
  const salvar = async () => {
    const v = Number(aberto!.valor.replace(/\./g, '').replace(',', '.'))
    setOcupado(true)
    const ok = await executar(() => api.post(`pessoas/${encodeURIComponent(pessoaId)}/salario`, { valor: v, vigenciaInicio: vig, motivo: motivo.trim() || undefined }), 'Salário atualizado.')
    setOcupado(false)
    if (ok) { setAberto(null); setMotivo(''); r.recarregar(); void recarregarEstado() }
  }
  return (
    <Card>
      <CardHead title="Salário" sub="Valor mensal desta pessoa. Começa no padrão da função e pode ser ajustado individualmente; cada ajuste fica no histórico."
        action={podeAjustar && d.contrato && <Button size="sm" icon="Pencil" onClick={() => setAberto({ valor: String(valor || padrao || '') })}>Ajustar</Button>} />
      <div className="px-5 pb-4 grid sm:grid-cols-3 gap-4">
        <div><div className="text-[11px] font-bold uppercase text-muted">Salário atual</div><div className="text-[18px] font-bold text-ink tabular-nums">{!d.contrato ? '—' : aDefinir ? 'A definir' : dinheiro(valor)}</div>{d.contrato && <div className="text-[11.5px] text-muted">Contrato {d.contrato.numero}</div>}</div>
        <div><div className="text-[11px] font-bold uppercase text-muted">Padrão da função</div><div className="text-[15px] font-semibold text-ink tabular-nums">{padrao != null ? dinheiro(padrao) : '—'}</div><div className="text-[11.5px] text-muted">{d.cargo?.nome ?? 'Sem função'}</div></div>
        <div className="text-[12.5px] text-ink-2 self-center">
          {!d.contrato ? 'Sem contrato mensal em vigor: gere o contrato-base (Financeiro › Kanban) ou cadastre um contrato.'
            : aDefinir ? (padrao == null ? 'A função ainda não tem valor padrão. Defina-o em Funções ou ajuste aqui.' : 'Será preenchido com o padrão da função.')
            : padrao == null ? 'Função sem valor padrão.'
            : valor === padrao ? 'Igual ao padrão da função.'
            : <>{valor > padrao ? 'Acima' : 'Abaixo'} do padrão em {dinheiro(Math.abs(valor - padrao))}.{podeAjustar && <> <button type="button" className="font-semibold text-brand hover:underline" onClick={() => setAberto({ valor: String(padrao) })}>Aplicar o padrão</button></>}</>}
          {d.outrosContratos > 0 && <div className="text-warning mt-1">Há {d.outrosContratos} outro(s) contrato(s) mensal(is) em vigor — o ajuste aqui fica bloqueado; use Financeiro › Contratos.</div>}
        </div>
      </div>
      {d.historico.length > 0 && (
        <ul className="border-t border-line divide-y divide-line">{d.historico.map((h) => (
          <li key={h.numero} className="px-5 py-2.5 text-[12.5px] flex flex-wrap gap-x-3"><span className="tabular-nums font-semibold">{dinheiro(h.valorAnterior ?? 0)} → {dinheiro(h.valorNovo ?? 0)}</span><span className="text-muted">a partir de {fmtDate(h.vigenciaInicio)}{h.por ? ` · ${h.por}` : ''}</span><span className="text-ink-2">{h.motivo}</span></li>
        ))}</ul>
      )}
      <Modal open={!!aberto} onClose={() => setAberto(null)} title="Ajustar salário" subtitle={aDefinir ? 'Primeira definição do valor.' : 'O valor anterior fica registrado no histórico (aditivo de valor do contrato).'}
        footer={<><Button variant="ghost" onClick={() => setAberto(null)}>Cancelar</Button><Button icon="Check" disabled={ocupado} onClick={salvar}>Salvar</Button></>}>
        {aberto && (
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Salário mensal (R$)" required htmlFor="sal-v" hint={padrao != null ? `Padrão da função: ${dinheiro(padrao)}` : undefined}><input id="sal-v" className="input" inputMode="decimal" value={aberto.valor} onChange={(e) => setAberto({ valor: e.target.value })} /></Field>
            {!aDefinir && <Field label="A partir de" required htmlFor="sal-d"><input id="sal-d" type="date" className="input" value={vig} onChange={(e) => setVig(e.target.value)} /></Field>}
            {!aDefinir && <Field label="Motivo" required htmlFor="sal-m" className="sm:col-span-2"><input id="sal-m" className="input" value={motivo} onChange={(e) => setMotivo(e.target.value)} placeholder="Ex.: promoção, reajuste anual, negociação" /></Field>}
          </div>
        )}
      </Modal>
    </Card>
  )
}

/** Contratos da pessoa no módulo financeiro (modo com banco). */
function ContratosV2({ pessoaId }: { pessoaId: string }) {
  const r = useApi<{ itens: { id: string; numero: string; objeto: string; valor: number; inicio: string; fim: string | null; status: string; fornecedorNome: string }[] }>(`financeiro/contratos?prestador=${encodeURIComponent(pessoaId)}&por=50`)
  const lista = r.dados?.itens ?? []
  return (
    <Card>
      <CardHead title="Contratos" sub="Gerenciados em Gestão de prestadores › Contratos (aditivos, renovação, documentos e encerramento)." action={<Link to="/financeiro/contratos/novo"><Button size="sm" icon="Plus">Novo contrato</Button></Link>} />
      {r.carregando && !r.dados ? <p className="p-5 text-[13px] text-muted">Carregando…</p> : lista.length === 0 ? <EmptyState icon="FileSignature" title="Nenhum contrato" desc="Cadastre o fornecedor (empresa da pessoa) e depois o contrato." /> : (
        <ul className="divide-y divide-line">{lista.map((k) => (
          <li key={k.id} className="px-5 py-3 flex items-center gap-3 flex-wrap">
            <div className="flex-1 min-w-[200px]"><Link to={`/financeiro/contratos/${k.id}`} className="font-semibold hover:text-brand">{k.numero}</Link><div className="text-[12px] text-muted">{k.fornecedorNome} · {k.objeto}</div></div>
            <span className="tabular-nums text-[13px]">{dinheiro(k.valor)}</span><span className="text-[12px] text-muted">{fmtDate(k.inicio)} – {k.fim ? fmtDate(k.fim) : 'indeterminado'}</span><BadgeContrato valor={k.status} />
          </li>
        ))}</ul>
      )}
    </Card>
  )
}

function ContratosTab({ pessoaId, contratos }: { pessoaId: string; contratos: Contrato[] }) {
  const s = useStore()
  const [form, setForm] = useState<{ aberto: boolean; k?: Contrato }>({ aberto: false })
  const [remover, setRemover] = useState<Contrato | null>(null)
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const r = s.salvarContrato({
      colaboradorId: pessoaId, numero: d.numero.trim(), objeto: d.objeto.trim(), modalidade: d.modalidade as Contrato['modalidade'],
      valorMensal: Number(String(d.valor).replace(/\./g, '').replace(',', '.')), inicio: d.inicio, fim: d.fim || undefined,
      renovacaoAutomatica: d.renovacao === 'on', status: d.status as Contrato['status'], observacoes: d.observacoes.trim() || undefined,
    }, form.k?.id)
    if (feedback(r, 'Contrato salvo.')) setForm({ aberto: false })
  }
  return (
    <>
      <div className="flex justify-end mb-3"><Button size="sm" icon="FilePlus2" onClick={() => setForm({ aberto: true })}>Registrar contrato</Button></div>
      {contratos.length === 0 ? <Card><EmptyState icon="FileSignature" title="Nenhum contrato registrado" /></Card> : (
        <div className="grid md:grid-cols-2 gap-4">
          {contratos.map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex items-start justify-between gap-2"><div><div className="text-[12px] text-muted">{k.numero}</div><h3 className="text-[14.5px] font-bold text-ink mt-0.5">{k.objeto}</h3></div><Badge tone={STATUS_CONTRATO[k.status].tone} dot>{STATUS_CONTRATO[k.status].label}</Badge></div>
              <dl className="grid grid-cols-2 gap-3 mt-4 text-[13px]">
                <div><dt className="text-[11px] text-muted font-bold uppercase">Valor de referência</dt><dd className="font-semibold">{brl(k.valorMensal)}{k.modalidade === 'mensal' ? '/mês' : ' (projeto)'}</dd></div>
                <div><dt className="text-[11px] text-muted font-bold uppercase">Vigência</dt><dd className="font-semibold">{fmtDate(k.inicio)} → {k.fim ? fmtDate(k.fim) : 'indeterminado'}</dd></div>
              </dl>
              {k.observacoes && <p className="text-[12px] text-muted mt-3">{k.observacoes}</p>}
              <div className="flex gap-2 mt-4">
                <Button size="sm" variant="ghost" icon="Pencil" onClick={() => setForm({ aberto: true, k })}>Editar</Button>
                <Button size="sm" variant="subtle" icon="Trash2" onClick={() => setRemover(k)}>Remover</Button>
              </div>
            </Card>
          ))}
        </div>
      )}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover contrato?" confirmar="Remover" texto={remover ? `O contrato ${remover.numero} será removido definitivamente (fica na auditoria).` : ''}
        onConfirm={() => { if (remover && feedback(s.removerContrato(remover.id), 'Contrato removido.')) setRemover(null) }} />
      <Modal open={form.aberto} onClose={() => setForm({ aberto: false })} wide title={form.k ? 'Editar contrato' : 'Registrar contrato'} subtitle="Metadados do contrato. O documento assinado vai em Documentos."
        footer={<><Button variant="ghost" onClick={() => setForm({ aberto: false })}>Cancelar</Button><Button icon="Check" type="submit" form="ctrForm">Salvar</Button></>}>
        {form.aberto && (
          <form id="ctrForm" onSubmit={salvar}>
            <div className="grid sm:grid-cols-2 gap-x-4">
              <Field label="Número" htmlFor="k-n"><input id="k-n" name="numero" className="input" defaultValue={form.k?.numero ?? `CPS-${new Date().getFullYear()}-`} /></Field>
              <Field label="Situação" htmlFor="k-s"><Dropdown id="k-s" name="status" className="input" defaultValue={form.k?.status ?? 'vigente'}>{Object.entries(STATUS_CONTRATO).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</Dropdown></Field>
              <Field label="Objeto" required htmlFor="k-o" className="sm:col-span-2"><input id="k-o" name="objeto" className="input" defaultValue={form.k?.objeto} /></Field>
              <Field label="Modalidade" htmlFor="k-m"><Dropdown id="k-m" name="modalidade" className="input" defaultValue={form.k?.modalidade ?? 'mensal'}><option value="mensal">Valor mensal fixo</option><option value="por-projeto">Por projeto</option></Dropdown></Field>
              <Field label="Valor de referência (R$)" required htmlFor="k-v"><input id="k-v" name="valor" className="input" inputMode="decimal" defaultValue={form.k?.valorMensal ?? ''} /></Field>
              <Field label="Início" required htmlFor="k-i"><input id="k-i" name="inicio" type="date" className="input" defaultValue={form.k?.inicio ?? hojeISO()} /></Field>
              <Field label="Término (opcional)" htmlFor="k-f"><input id="k-f" name="fim" type="date" className="input" defaultValue={form.k?.fim} /></Field>
            </div>
            <label className="flex items-center gap-2 text-[13px] text-ink-2 mb-4"><input type="checkbox" name="renovacao" className="h-4 w-4 accent-brand" defaultChecked={form.k?.renovacaoAutomatica} /> Renovação automática</label>
            <Field label="Observações" htmlFor="k-ob"><textarea id="k-ob" name="observacoes" rows={2} className="input !h-auto py-2.5" defaultValue={form.k?.observacoes} /></Field>
          </form>
        )}
      </Modal>
    </>
  )
}

function DocumentosTab({ pessoaId, docs }: { pessoaId: string; docs: Documento[] }) {
  const s = useStore()
  const hoje = hojeISO()
  const [novo, setNovo] = useState(false)
  const [remover, setRemover] = useState<Documento | null>(null)
  const enviar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const arq = fd.get('arquivo') as File | null
    if (!arq?.name) { toast('Selecione um arquivo.', 'danger'); return }
    const r = s.adicionarDocumento({ colaboradorId: pessoaId, nome: String(fd.get('nome') || arq.name), tipo: fd.get('tipo') as TipoDocumento, data: hojeISO(), validade: (fd.get('validade') as string) || undefined, tamanho: `${Math.max(1, Math.round(arq.size / 1024))} KB`, confidencial: fd.get('confidencial') === 'on' })
    if (feedback(r, 'Documento registrado.')) setNovo(false)
  }
  return (
    <Card>
      <CardHead title="Documentos" sub="Visíveis à pessoa e ao RH" action={<Button size="sm" icon="Upload" onClick={() => setNovo(true)}>Adicionar</Button>} />
      {docs.length === 0 ? <EmptyState icon="FolderOpen" title="Nenhum documento" /> : (
        <ul className="divide-y divide-line">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-3 px-5 py-3 flex-wrap sm:flex-nowrap">
              <Icon name={d.confidencial ? 'FileLock2' : 'FileText'} className="h-5 w-5 text-brand shrink-0" />
              <div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{d.nome}</div><div className="text-[12px] text-muted">{d.tipo} · {fmtDate(d.data)} · {d.tamanho}{d.enviadoPorId ? ` · enviado por ${s.nomeDe(d.enviadoPorId).split(' ')[0]}` : ''}</div></div>
              {d.validade && <Badge tone={d.validade < hoje ? 'danger' : 'success'} dot>{d.validade < hoje ? 'Vencido' : 'Válido'} · {fmtDate(d.validade)}</Badge>}
              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${d.nome}`} onClick={() => setRemover(d)} />
            </li>
          ))}
        </ul>
      )}
      <Modal open={novo} onClose={() => setNovo(false)} title="Adicionar documento" footer={<><Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button><Button icon="Upload" type="submit" form="docRh">Salvar</Button></>}>
        <form id="docRh" onSubmit={enviar}>
          <Field label="Arquivo" required htmlFor="dr-a"><input id="dr-a" name="arquivo" type="file" className="input py-2" accept=".pdf,image/*" /></Field>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Tipo" htmlFor="dr-t"><Dropdown id="dr-t" name="tipo" className="input">{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</Dropdown></Field>
            <Field label="Validade" htmlFor="dr-v"><input id="dr-v" name="validade" type="date" className="input" /></Field>
          </div>
          <Field label="Nome de exibição" htmlFor="dr-n"><input id="dr-n" name="nome" className="input" /></Field>
          <label className="flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" name="confidencial" defaultChecked className="h-4 w-4 accent-brand" /> Confidencial</label>
        </form>
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover documento?" confirmar="Remover" texto={remover ? `"${remover.nome}" será removido definitivamente.` : ''}
        onConfirm={() => { if (remover && feedback(s.removerDocumento(remover.id), 'Documento removido.')) setRemover(null) }} />
    </Card>
  )
}

function RegistrosTab({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const regs = s.registros.filter((r) => r.colaboradorId === pessoaId).sort((a, b) => b.data.localeCompare(a.data))
  const [novo, setNovo] = useState(false)
  const [remover, setRemover] = useState<string | null>(null)
  return (
    <Card>
      <CardHead title="Registros administrativos" sub="Visíveis somente ao RH · use para alinhamentos contratuais e atualizações" action={<Button size="sm" icon="Plus" onClick={() => setNovo(true)}>Novo registro</Button>} />
      {regs.length === 0 ? <EmptyState icon="NotebookPen" title="Nenhum registro" /> : (
        <ul className="divide-y divide-line">
          {regs.map((r) => (
            <li key={r.id} className="flex items-start gap-3 px-5 py-3.5">
              <div className="flex-1 min-w-0"><div className="flex items-center gap-2 flex-wrap"><Badge tone="neutral">{s.tiposRegistro.find((t) => t.id === r.tipoId)?.nome ?? 'Registro'}</Badge><Badge tone={CLASS_REG[r.classificacao ?? 'neutro'].tone} dot>{CLASS_REG[r.classificacao ?? 'neutro'].label}</Badge><span className="text-[12px] text-muted">{fmtDate(r.data)} · por {s.nomeDe(r.autorId)}</span></div><p className="text-[13.5px] text-ink-2 mt-1.5">{r.descricao}</p></div>
              <Button size="icon-sm" variant="subtle" icon="Trash2" aria-label="Remover registro" onClick={() => setRemover(r.id)} />
            </li>
          ))}
        </ul>
      )}
      {novo && <RegistroForm pessoaFixa={pessoaId} onClose={() => setNovo(false)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover registro?" confirmar="Remover" texto="O registro será removido definitivamente (a remoção fica na auditoria)."
        onConfirm={() => { if (remover && feedback(s.removerRegistro(remover), 'Registro removido.')) setRemover(null) }} />
    </Card>
  )
}

function FeedbacksTab({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const [novo, setNovo] = useState(false)
  const lista = s.feedbacks.filter((f) => f.colaboradorId === pessoaId).sort((a, b) => b.data.localeCompare(a.data))
  return (
    <Card>
      <CardHead title="Feedbacks" action={<Button size="sm" icon="Plus" onClick={() => setNovo(true)}>Novo feedback</Button>} />
      {lista.length === 0 ? <EmptyState icon="MessageSquareText" title="Nenhum feedback" /> : (
        <ul className="divide-y divide-line">{lista.map((f) => <li key={f.id} className="px-5 py-3.5"><div className="flex items-center gap-2 flex-wrap"><Badge tone={CLASS_FB[f.classificacao].tone} dot>{CLASS_FB[f.classificacao].label}</Badge>{!f.visivelParaPessoa && <Badge tone="neutral">Interno</Badge>}<span className="text-[12px] text-muted">{fmtDate(f.data)} · por {s.nomeDe(f.autorId)}</span></div><p className="text-[13.5px] text-ink-2 mt-1.5">{f.comentario}</p></li>)}</ul>
      )}
      {novo && <FeedbackForm pessoaFixa={pessoaId} pessoas={[]} onClose={() => setNovo(false)} />}
    </Card>
  )
}

function AvaliacoesTab({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const inicio = s.avaliacoesInicio.filter((a) => a.avaliadoId === pessoaId).sort((a, b) => a.marcoDias - b.marcoDias)
  const ciclos = s.ciclos.filter((c) => s.participantesCiclo.some((p) => p.cicloId === c.id && p.avaliadoId === pessoaId))
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHead title="Início de parceria" />
        {inicio.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhuma avaliação de início gerada.</p> : (
          <ul className="divide-y divide-line">{inicio.map((a) => <li key={a.id} className="flex items-center gap-3 px-5 py-3"><Badge tone="brand">{a.marcoDias} dias</Badge><span className="flex-1 text-[13px] text-ink-2">por {a.avaliadorId ? s.nomeDe(a.avaliadorId) : '—'} · até {fmtDate(a.expiraEm)}</span>{a.status === 'respondida' ? <Badge tone="success" dot>Nota {a.nota ?? '—'}</Badge> : a.status === 'expirada' ? <Badge tone="danger" dot>Expirada</Badge> : <Badge tone="warning" dot>Pendente</Badge>}</li>)}</ul>
        )}
      </Card>
      <Card>
        <CardHead title="Ciclos de avaliação" sub="Detalhes em Ciclos de avaliação → Relatórios individuais" />
        {ciclos.length === 0 ? <p className="p-5 text-[13px] text-muted">Não participa de ciclos.</p> : (
          <ul className="divide-y divide-line">{ciclos.map((c) => {
            const pars = s.participantesCiclo.filter((p) => p.cicloId === c.id && p.avaliadoId === pessoaId)
            const resp = pars.filter((p) => s.respostasAvaliacao.some((r) => r.participanteId === p.id)).length
            return <li key={c.id} className="flex items-center gap-3 px-5 py-3"><span className="flex-1 text-[13px] font-semibold text-ink">{c.nome}</span><span className="text-[12px] text-muted">{resp}/{pars.length} respondidas</span><Link to="/rh/avaliacoes" className="text-[12.5px] font-semibold text-brand">Abrir</Link></li>
          })}</ul>
        )}
      </Card>
    </div>
  )
}

function ExigenciasTab({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const hoje = hojeISO()
  const [novo, setNovo] = useState(false)
  const lista = s.exigencias.filter((e) => e.colaboradorId === pessoaId)
  return (
    <Card>
      <CardHead title="Exigências & certificações" action={<Button size="sm" icon="Plus" onClick={() => setNovo(true)}>Nova exigência</Button>} />
      {lista.length === 0 ? <EmptyState icon="ShieldCheck" title="Nenhuma exigência registrada" /> : (
        <ul className="divide-y divide-line">{lista.map((e) => { const v = validadeEx(e, hoje); return <li key={e.id} className="flex items-center gap-3 px-5 py-3 flex-wrap"><div className="flex-1 min-w-[200px]"><div className="text-[13.5px] font-semibold text-ink">{e.descricao}</div><div className="text-[12px] text-muted">{e.tipo}{e.emissor ? ` · ${e.emissor}` : ''}</div></div><Badge tone={SITUACAO_EX[e.situacao].tone}>{SITUACAO_EX[e.situacao].label}</Badge><Badge tone={v.tone} dot>{v.label}</Badge></li> })}</ul>
      )}
      {novo && <ExigenciaForm pessoaFixa={pessoaId} onClose={() => setNovo(false)} />}
    </Card>
  )
}

function BeneficiosTab({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const vinc = s.beneficiarios.filter((v) => v.colaboradorId === pessoaId)
  return (
    <div className="grid lg:grid-cols-2 gap-6">
      <Card>
        <CardHead title="Benefícios vinculados" action={<Link to="/rh/beneficios" className="text-[12.5px] font-semibold text-brand">Gerenciar</Link>} />
        {vinc.length === 0 ? <p className="p-5 text-[13px] text-muted">Nenhum benefício vinculado.</p> : (
          <ul className="divide-y divide-line">{vinc.map((v) => { const b = s.beneficios.find((x) => x.id === v.beneficioId); return <li key={v.id} className="flex items-center gap-3 px-5 py-3"><Icon name={b?.icon ?? 'Gift'} className="h-5 w-5 text-brand" /><div className="flex-1"><div className="text-[13.5px] font-semibold text-ink">{b?.nome}</div><div className="text-[12px] text-muted">{b?.tipo ? TIPO_BEN[b.tipo] : ''} · desde {fmtDate(v.desde)}{v.dependentesIds.length ? ` · +${v.dependentesIds.length} dependente(s)` : ''}</div></div><Button size="sm" variant="subtle" onClick={() => feedback(s.desvincularBeneficiario(v.id), 'Vínculo removido.')}>Desvincular</Button></li> })}</ul>
        )}
      </Card>
      <Card><CardHead title="Dependentes" /><DependentesLista pessoaId={pessoaId} /></Card>
    </div>
  )
}
