import { useEffect, useState, type ReactNode } from 'react'
import { Link, useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Avatar, Badge, Button, Callout, Card, CardHead, EmptyState, PageHeader, StatCard, Tabs } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { EditorEtapas } from '@/components/v2/vagas/EditorEtapas'
import { BadgePrazo, BadgePrioridade, BadgeStatus, ROTULO_ACAO, useAcaoVaga, useOpcoes, type AcaoMenu } from '@/components/v2/vagas/comum'
import { api, executar, lerBase64, useApi } from '@/data/v2/api'
import { ROTULO_ETAPA, ROTULO_MODALIDADE, ROTULO_MOTIVO, ROTULO_REMUNERACAO, ROTULO_TIPO } from '@/domain/v2/vagas'
import { dataBR, dataHoraBR, haQuanto, moeda } from '@/lib/fmt'
import { Dropdown } from '@/components/Dropdown'
import { documentoDaVagaInterna, ModalPdfVaga } from '@/components/v2/vagas/DocumentoVaga'

type D = Record<string, any>
const ABAS = [
  { key: 'visao', label: 'Visão geral' }, { key: 'aprovacoes', label: 'Aprovações' }, { key: 'etapas', label: 'Etapas' }, { key: 'candidaturas', label: 'Candidaturas' },
  { key: 'comentarios', label: 'Comentários' }, { key: 'anexos', label: 'Anexos' }, { key: 'historico', label: 'Histórico' },
]
const TEXTO_EVENTO: Record<string, string> = {
  criada: 'criou a vaga', editada: 'editou a vaga', aprovacao_solicitada: 'solicitou a aprovação', aprovada: 'aprovou a vaga', aprovada_automaticamente: 'aprovação automática (fluxo sem passos)',
  passo_aprovado: 'aprovou um passo', rejeitada: 'rejeitou a solicitação', ajustes_solicitados: 'pediu ajustes', devolvida: 'devolveu ao solicitante', publicada: 'publicou a vaga', publicada_agendada: 'publicação agendada executada',
  pausada: 'pausou a vaga', retomada: 'retomou a vaga', encerrada: 'encerrou a vaga', cancelada: 'cancelou a vaga', reaberta: 'reabriu a vaga', arquivada: 'arquivou a vaga', desarquivada: 'desarquivou a vaga',
  aprovador_reatribuido: 'reatribuiu um aprovador', comentario: 'comentou', anexo_adicionado: 'anexou um arquivo', anexo_removido: 'removeu um anexo', etapas_alteradas: 'alterou as etapas',
}
const CAMPO_ROTULO: Record<string, string> = { titulo: 'título', resumo: 'resumo', qtdPosicoes: 'posições', setorId: 'área', cargoId: 'cargo', modalidade: 'modalidade', textoPublico: 'texto público', canais: 'canais', prazoPreenchimento: 'prazo', encerraCandidaturasEm: 'encerramento das candidaturas', responsabilidades: 'responsabilidades', prioridade: 'prioridade' }
const STATUS_PASSO: Record<string, { rotulo: string; tom: 'success' | 'danger' | 'warning' | 'neutral' | 'brand' }> = {
  pendente: { rotulo: 'Pendente', tom: 'warning' }, aprovada: { rotulo: 'Aprovada', tom: 'success' }, rejeitada: { rotulo: 'Rejeitada', tom: 'danger' }, ajustes: { rotulo: 'Ajustes pedidos', tom: 'brand' }, cancelada: { rotulo: 'Cancelada', tom: 'neutral' }, dispensada: { rotulo: 'Dispensada', tom: 'neutral' },
}

const Info = ({ rotulo, children }: { rotulo: string; children: ReactNode }) => (
  <div className="py-2.5 border-b border-line last:border-0"><dt className="text-[11.5px] font-bold uppercase tracking-wide text-muted">{rotulo}</dt><dd className="text-[13.5px] text-ink mt-0.5 whitespace-pre-line">{children || '—'}</dd></div>
)
const Chips = ({ itens }: { itens?: string[] }) => (itens?.length ? <span className="flex flex-wrap gap-1.5">{itens.map((i) => <Badge key={i} tone="brand">{i}</Badge>)}</span> : <>—</>)

export default function VagaDetalhe() {
  const { id = '' } = useParams()
  const [sp, setSp] = useSearchParams()
  const nav = useNavigate()
  const aba = sp.get('aba') ?? 'visao'
  const r = useApi<D>(`vagas/${id}`)
  const opcoes = useOpcoes()
  const { pedir, modal } = useAcaoVaga(() => r.recarregar())
  const [decisao, setDecisao] = useState<{ passoId: string; rotulo: string } | null>(null)
  const [reatribuir, setReatribuir] = useState<{ passoId: string; rotulo: string } | null>(null)
  const [etapas, setEtapas] = useState<{ id?: string; nome: string; tipo: string; ativas?: number }[]>([])
  const [pdf, setPdf] = useState(false)
  useEffect(() => { if (r.dados) setEtapas(r.dados.etapas) }, [r.dados])

  const d = r.dados
  const p = d?.permissoes
  const v = d?.vaga

  return (
    <>
      <SoComBanco>
        <Aguardar r={r} linhas={4}>
          {() => (
            <>
              <PageHeader title={v.titulo}
                eyebrow={<span className="flex items-center gap-2 flex-wrap"><BadgeStatus valor={v.status} /><BadgePrioridade valor={v.prioridade} /><BadgePrazo situacao={v.situacaoPrazo} /><span className="text-[12px] text-muted">{v.codigo}</span>{v.arquivada && <Badge>Arquivada</Badge>}</span>}
                subtitle={[v.setorNome, v.cargoNome, ROTULO_MODALIDADE[v.modalidade], v.cidade && `${v.cidade}${v.estado ? `/${v.estado}` : ''}`].filter(Boolean).join(' · ')}
                actions={<>
                  {p.editar && <Link to={`/recrutamento/vagas/${v.id}/editar`}><Button icon="Pencil" variant="ghost">Editar</Button></Link>}
                  {p.duplicar && <Button variant="ghost" icon="Copy" onClick={async () => { const n = await executar(() => api.post(`vagas/${v.id}/duplicar`), 'Vaga duplicada como rascunho.'); if (n) nav(`/recrutamento/vagas/${n.vaga.id}/editar`) }}>Duplicar</Button>}
                  {(p.acoes as AcaoMenu[]).map((a) => <Button key={a} icon={ROTULO_ACAO[a].icon} variant={ROTULO_ACAO[a].perigo ? 'danger' : a === 'solicitar' || a === 'publicar' ? 'primary' : 'ghost'} onClick={() => pedir(v, a)}>{ROTULO_ACAO[a].rotulo}</Button>)}
                  {p.arquivar && <Button variant="ghost" icon="Archive" onClick={() => pedir(v, 'arquivar')}>Arquivar</Button>}
                  {p.desarquivar && <Button variant="ghost" icon="ArchiveRestore" onClick={() => pedir(v, 'desarquivar')}>Desarquivar</Button>}
                </>} />

              {v.status === 'ajustes' && <Callout tone="warning" icon="MessageSquareWarning" className="mb-5">A solicitação foi devolvida para ajustes. Veja a justificativa na aba <button className="underline font-semibold" onClick={() => setSp({ aba: 'aprovacoes' })}>Aprovações</button>, edite a vaga e solicite a aprovação novamente.</Callout>}
              {p.decidir.length > 0 && <Callout tone="brand" icon="ClipboardCheck" className="mb-5">Esta vaga aguarda a sua decisão. <button className="underline font-semibold" onClick={() => setSp({ aba: 'aprovacoes' })}>Abrir aprovações</button></Callout>}

              <Divulgacao v={v} onPdf={() => setPdf(true)} />

              <Tabs tabs={ABAS} active={aba} onChange={(k) => setSp({ aba: k }, { replace: true })} />

              {aba === 'visao' && (
                <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
                  <Card><CardHead title="Informações gerais" /><dl className="px-5 pb-3">
                    <Info rotulo="Descrição resumida">{v.resumo}</Info><Info rotulo="Objetivo da posição">{v.objetivo}</Info>
                    <Info rotulo="Tipo de oportunidade">{ROTULO_TIPO[v.tipo] ?? v.tipo}</Info><Info rotulo="Motivo da abertura">{ROTULO_MOTIVO[v.motivo] ?? v.motivo}</Info>
                    <Info rotulo="Posições">{`${v.posicoesPreenchidas} preenchida(s) de ${v.qtdPosicoes}`}</Info>
                    <Info rotulo="Abertura">{dataBR(v.dataAbertura)}</Info><Info rotulo="Prazo de preenchimento">{dataBR(v.prazoPreenchimento)}</Info><Info rotulo="Início previsto">{dataBR(v.dataInicioPrevista)}</Info>
                  </dl></Card>
                  <Card><CardHead title="Estrutura e responsáveis" /><dl className="px-5 pb-3">
                    <Info rotulo="Departamento">{v.setorNome}</Info><Info rotulo="Unidade">{v.unidadeNome}</Info><Info rotulo="Equipe">{v.equipe}</Info><Info rotulo="Cargo">{v.cargoNome}</Info><Info rotulo="Senioridade">{v.senioridade}</Info>
                    <Info rotulo="Gestor(a) solicitante">{v.gestorSolicitanteNome}</Info><Info rotulo="Gestor(a) responsável">{v.gestorResponsavelNome}</Info><Info rotulo="Gestor(a) imediato(a)">{v.gestorImediatoNome}</Info><Info rotulo="Recrutador(a)">{v.recrutadorNome}</Info>
                  </dl></Card>
                  <Card><CardHead title="Local e remuneração" /><dl className="px-5 pb-3">
                    <Info rotulo="Local">{[v.cidade, v.estado, v.pais].filter(Boolean).join(', ')}</Info><Info rotulo="Modalidade">{ROTULO_MODALIDADE[v.modalidade]}</Info><Info rotulo="Viagens">{v.viagens}</Info><Info rotulo="Jornada">{v.jornada}</Info>
                    {'salarioMin' in v ? (
                      <><Info rotulo="Faixa salarial">{v.salarioMin != null || v.salarioMax != null ? `${moeda(v.salarioMin, v.moeda)} a ${moeda(v.salarioMax, v.moeda)} (${ROTULO_REMUNERACAO[v.tipoRemuneracao] ?? ''})` : ''}</Info><Info rotulo="Variável">{v.variavel}</Info><Info rotulo="Divulgar salário no portal">{v.divulgarSalario ? 'Sim' : 'Não'}</Info></>
                    ) : <Info rotulo="Faixa salarial"><span className="text-muted">Restrita ao RH</span></Info>}
                    <Info rotulo="Benefícios"><Chips itens={v.beneficios} /></Info>
                  </dl></Card>
                  <Card><CardHead title="Perfil profissional" /><dl className="px-5 pb-3">
                    <Info rotulo="Responsabilidades">{v.responsabilidades}</Info><Info rotulo="Atividades">{v.atividades}</Info><Info rotulo="Desafios da posição">{v.desafios}</Info>
                    <Info rotulo="Requisitos obrigatórios"><Chips itens={v.requisitosObrigatorios} /></Info><Info rotulo="Requisitos desejáveis"><Chips itens={v.requisitosDesejaveis} /></Info>
                    <Info rotulo="Formação">{v.formacao}</Info><Info rotulo="Experiência">{v.experiencia}</Info>
                    <Info rotulo="Competências técnicas"><Chips itens={v.competenciasTecnicas} /></Info><Info rotulo="Competências comportamentais"><Chips itens={v.competenciasComportamentais} /></Info>
                    <Info rotulo="Idiomas"><Chips itens={v.idiomas} /></Info><Info rotulo="Certificações"><Chips itens={v.certificacoes} /></Info>
                  </dl></Card>
                  <Card><CardHead title="Triagem" sub="Perguntas feitas na candidatura" />
                    {v.perguntasTriagem?.length ? <ol className="px-5 pb-4 list-decimal ml-5 space-y-1.5 text-[13.5px]">{v.perguntasTriagem.map((q: D) => <li key={q.id}>{q.texto} <span className="text-muted text-[12px]">({q.tipo === 'sim_nao' ? 'sim/não' : q.tipo === 'opcoes' ? 'múltipla escolha' : 'texto'}{q.obrigatoria ? ', obrigatória' : ''})</span></li>)}</ol> : <p className="px-5 pb-4 text-[13px] text-muted">Sem perguntas de triagem.</p>}
                  </Card>
                  <Card><CardHead title="Divulgação" /><dl className="px-5 pb-3">
                    <Info rotulo="Canais"><Chips itens={(v.canais as string[]).map((c) => opcoes.dados?.canais.find((x) => x.chave === c)?.nome ?? c)} /></Info>
                    <Info rotulo="Etapas do processo (página pública)"><Chips itens={v.etapasProcesso} /></Info><Info rotulo="Publicação agendada">{dataBR(v.publicarEm)}</Info><Info rotulo="Encerramento das candidaturas">{dataBR(v.encerraCandidaturasEm)}</Info>
                    <Info rotulo="Texto público">{v.textoPublico}</Info><Info rotulo="Critérios de encerramento">{v.criteriosEncerramento}</Info>
                    {'observacoesRh' in v && <Info rotulo="Observações do RH">{v.observacoesRh}</Info>}
                    {v.motivoEncerramento && <Info rotulo="Motivo do encerramento/cancelamento">{v.motivoEncerramento}</Info>}
                  </dl></Card>
                </div>
              )}

              {aba === 'aprovacoes' && <Aprovacoes d={d!} onDecidir={(passoId, rotulo) => setDecisao({ passoId, rotulo })} onReatribuir={(passoId, rotulo) => setReatribuir({ passoId, rotulo })} />}

              {aba === 'etapas' && (
                <Card className="p-5">
                  <EditorEtapas etapas={etapas} onChange={setEtapas} desabilitado={!p.editar}
                    onSalvar={async () => { const n = await executar(() => api.put(`vagas/${v.id}/etapas`, { etapas: etapas.map((e) => ({ id: e.id, nome: e.nome, tipo: e.tipo })) }), 'Etapas salvas.'); if (n) r.recarregar() }} />
                  {!p.editar && <p className="text-[12px] text-muted mt-3">As etapas só podem ser alteradas por quem edita a vaga.</p>}
                </Card>
              )}

              {aba === 'candidaturas' && (
                <div className="space-y-5">
                  <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                    <StatCard compacto icon="Users" value={d!.contagens.total} label="Candidaturas recebidas" />
                    <StatCard compacto icon="Activity" tone="warning" value={d!.contagens.ativas} label="Em andamento" />
                    <StatCard compacto icon="UserCheck" tone="success" value={d!.contagens.contratadas} label="Contratadas" />
                    <StatCard compacto icon="Armchair" tone="ink" value={Math.max(0, v.qtdPosicoes - v.posicoesPreenchidas)} label="Posições em aberto" />
                  </div>
                  <Card className="p-5 flex items-center justify-between gap-4 flex-wrap">
                    <div><div className="font-semibold text-ink text-[14px]">Pipeline de candidatos</div><div className="text-[12.5px] text-muted">Acompanhe e mova as candidaturas desta vaga no ATS.</div></div>
                    <Link to={`/recrutamento/candidatos?vaga=${v.id}`}><Button icon="KanbanSquare">Abrir pipeline</Button></Link>
                  </Card>
                </div>
              )}

              {aba === 'comentarios' && <Comentarios d={d!} onNovo={r.recarregar} />}
              {aba === 'anexos' && <Anexos d={d!} onMudou={r.recarregar} />}
              {aba === 'historico' && (
                <Card><CardHead title="Histórico" sub="Quem fez o quê, e quando" />
                  <ol className="divide-y divide-line">
                    {d!.eventos.map((e: D) => (
                      <li key={e.id} className="px-5 py-3 flex gap-3 items-start">
                        <Avatar nome={e.autorNome ?? 'Sistema'} size="sm" />
                        <div className="text-[13px] min-w-0">
                          <div><b className="text-ink">{e.autorNome ?? 'Sistema'}</b> {TEXTO_EVENTO[e.tipo] ?? e.tipo}
                            {e.paraStatus && <> <span className="text-muted">→</span> <BadgeStatus valor={e.paraStatus} /></>}</div>
                          {Array.isArray(e.detalhes?.campos) && e.detalhes.campos.length > 0 && <div className="text-[12px] text-muted">Campos: {e.detalhes.campos.map((c: string) => CAMPO_ROTULO[c] ?? c).join(', ')}</div>}
                          {e.detalhes?.motivo && <div className="text-[12px] text-ink-2">Motivo: {e.detalhes.motivo}</div>}
                          {e.detalhes?.passo && <div className="text-[12px] text-muted">Passo: {e.detalhes.passo}</div>}
                          <div className="text-[11.5px] text-muted" title={dataHoraBR(e.em)}>{haQuanto(e.em)}</div>
                        </div>
                      </li>
                    ))}
                  </ol>
                </Card>
              )}
            </>
          )}
        </Aguardar>
      </SoComBanco>

      {decisao && d && <ModalDecisao passo={decisao} vagaId={d.vaga.id} onClose={() => setDecisao(null)} onFeito={() => { setDecisao(null); r.recarregar() }} />}
      {reatribuir && d && <ModalReatribuir passo={reatribuir} vagaId={d.vaga.id} opcoes={opcoes.dados} onClose={() => setReatribuir(null)} onFeito={() => { setReatribuir(null); r.recarregar() }} />}
      {modal}
      {v && <ModalPdfVaga d={documentoDaVagaInterna(v, v.setorNome ?? null)} open={pdf} onClose={() => setPdf(false)} onEditar={p?.editar ? () => nav(`/recrutamento/vagas/${v.id}/editar`) : undefined} />}
    </>
  )
}

/** Link público e compartilhamento, sempre à vista. Fora do ar, explica o motivo e oferece a prévia. */
function Divulgacao({ v, onPdf }: { v: D; onPdf: () => void }) {
  const url = `${window.location.origin}/carreiras/${v.slug}`
  const noAr = v.status === 'publicada'
  const copiar = () => navigator.clipboard?.writeText(url).then(() => toast('Link copiado. Cole onde quiser divulgar.'), () => toast('Não foi possível copiar. Selecione o link e copie manualmente.', 'danger'))
  const whatsapp = `https://wa.me/?text=${encodeURIComponent(`Vaga aberta na 4JURIS: ${v.titulo}\n${url}`)}`
  const situacao: Record<string, string> = {
    rascunho: 'Rascunho: o link só funciona depois de publicar.', em_aprovacao: 'Em aprovação: o link só funciona depois de publicar.', ajustes: 'Em ajustes: o link só funciona depois de publicar.',
    aprovada: 'Aprovada: publique para ativar o link.', pausada: 'Pausada: o link mostra que a vaga não recebe candidaturas.', encerrada: 'Encerrada: o link mostra que a vaga não recebe mais candidaturas.', cancelada: 'Cancelada: o link não exibe a vaga.',
  }
  return (
    <Card className="p-4 mb-5">
      <div className="flex items-center gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <div className="text-[12px] font-bold uppercase tracking-wide text-muted">Link da vaga</div>
          {noAr
            ? <code className="block text-[13px] text-ink break-all mt-0.5">{url}</code>
            : <div className="text-[13px] text-ink-2 mt-0.5">{situacao[v.status] ?? 'O link só funciona com a vaga publicada.'}</div>}
        </div>
        <div className="flex gap-2 flex-wrap">
          {noAr && <Button size="sm" icon="Copy" onClick={copiar}>Copiar link</Button>}
          {noAr && <a href={whatsapp} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" icon="Share2">WhatsApp</Button></a>}
          {noAr && <a href={url} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" icon="ExternalLink">Abrir página</Button></a>}
          <Button size="sm" variant="ghost" icon="FileText" onClick={onPdf}>{noAr ? 'PDF' : 'Pré-visualizar / PDF'}</Button>
        </div>
      </div>
    </Card>
  )
}

function Aprovacoes({ d, onDecidir, onReatribuir }: { d: D; onDecidir: (id: string, rotulo: string) => void; onReatribuir: (id: string, rotulo: string) => void }) {
  const rodadas = [...new Set((d.aprovacoes as D[]).map((a) => a.rodada))].sort((a: number, b: number) => b - a)
  if (!rodadas.length) return <Card><EmptyState icon="ClipboardCheck" title="Sem aprovações" desc={d.vaga.status === 'rascunho' ? 'Ao solicitar a aprovação, os passos do fluxo aparecem aqui.' : 'Esta vaga não passou por aprovação.'} /></Card>
  return (
    <div className="space-y-5">
      {rodadas.map((rod: number) => (
        <Card key={rod}>
          <CardHead title={`Rodada ${rod}`} sub={rod === rodadas[0] ? 'Rodada atual' : 'Rodada anterior'} />
          <ol className="divide-y divide-line">
            {(d.aprovacoes as D[]).filter((a) => a.rodada === rod).map((a) => {
              const st = STATUS_PASSO[a.status] ?? STATUS_PASSO.pendente
              const podeDecidir = d.permissoes.decidir.includes(a.id)
              return (
                <li key={a.id} className="px-5 py-4">
                  <div className="flex items-start justify-between gap-3 flex-wrap">
                    <div className="min-w-0">
                      <div className="font-semibold text-[14px] text-ink">{a.ordem}. {a.rotulo}</div>
                      <div className="text-[12.5px] text-muted">Aprovador: {a.aprovadorNome}{a.prazo ? ` · prazo ${dataBR(a.prazo)}` : ''}</div>
                    </div>
                    <div className="flex items-center gap-2"><Badge tone={st.tom} dot>{st.rotulo}</Badge>{a.atrasado && <Badge tone="danger">Atrasada</Badge>}</div>
                  </div>
                  {a.decididoEm && <div className="text-[12.5px] text-ink-2 mt-2">{a.decididoPorNome ?? 'Alguém'} em {dataHoraBR(a.decididoEm)}{a.justificativa ? `: “${a.justificativa}”` : ''}</div>}
                  {a.status === 'pendente' && rod === rodadas[0] && (podeDecidir || d.permissoes.gerenciar) && (
                    <div className="flex gap-2 mt-3 flex-wrap">
                      {podeDecidir && <Button size="sm" icon="Check" onClick={() => onDecidir(a.id, a.rotulo)}>Decidir</Button>}
                      <Button size="sm" variant="ghost" icon="UserCog" onClick={() => onReatribuir(a.id, a.rotulo)}>Reatribuir aprovador</Button>
                    </div>
                  )}
                </li>
              )
            })}
          </ol>
        </Card>
      ))}
    </div>
  )
}

function ModalDecisao({ passo, vagaId, onClose, onFeito }: { passo: { passoId: string; rotulo: string }; vagaId: string; onClose: () => void; onFeito: () => void }) {
  const [decisao, setDecisao] = useState<'aprovar' | 'ajustes' | 'devolver' | 'rejeitar'>('aprovar')
  const [just, setJust] = useState('')
  const [env, setEnv] = useState(false)
  const precisa = decisao !== 'aprovar'
  return (
    <Modal open onClose={onClose} title={`Decidir: ${passo.rotulo}`}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button>
        <Button variant={decisao === 'rejeitar' ? 'danger' : 'primary'} disabled={env || (precisa && just.trim().length < 5)} onClick={async () => {
          setEnv(true)
          const r = await executar(() => api.post(`vagas/${vagaId}/aprovacoes/${passo.passoId}/decidir`, { decisao, justificativa: just }), 'Decisão registrada.')
          setEnv(false); if (r) onFeito()
        }}>Confirmar</Button></>}>
      <fieldset className="space-y-2 mb-4"><legend className="label">Sua decisão</legend>
        {([['aprovar', 'Aprovar'], ['ajustes', 'Solicitar ajustes'], ['devolver', 'Devolver ao solicitante'], ['rejeitar', 'Rejeitar a solicitação']] as const).map(([k, n]) => (
          <label key={k} className="flex items-center gap-2 text-[13.5px]"><input type="radio" name="decisao" checked={decisao === k} onChange={() => setDecisao(k)} />{n}</label>
        ))}
      </fieldset>
      <label className="block"><span className="label">Justificativa {precisa ? '(obrigatória)' : '(opcional)'}</span>
        <textarea className="input min-h-[100px]" maxLength={1000} value={just} onChange={(e) => setJust(e.target.value)} /></label>
      {decisao === 'rejeitar' && <Callout tone="danger" icon="AlertTriangle" className="mt-3">Rejeitar cancela a solicitação. Para só pedir correções, use “Solicitar ajustes”.</Callout>}
    </Modal>
  )
}

function ModalReatribuir({ passo, vagaId, opcoes, onClose, onFeito }: { passo: { passoId: string; rotulo: string }; vagaId: string; opcoes?: { pessoas: { id: string; nome: string }[]; aprovadores: { papeis: { chave: string; nome: string }[]; funcoes: { chave: string; nome: string }[] } }; onClose: () => void; onFeito: () => void }) {
  const [tipo, setTipo] = useState<'pessoa' | 'papel' | 'funcao'>('pessoa')
  const [ref, setRef] = useState('')
  const lista = tipo === 'pessoa' ? (opcoes?.pessoas ?? []).map((x) => ({ v: x.id, n: x.nome })) : tipo === 'papel' ? (opcoes?.aprovadores.papeis ?? []).map((x) => ({ v: x.chave, n: x.nome })) : (opcoes?.aprovadores.funcoes ?? []).map((x) => ({ v: x.chave, n: x.nome }))
  return (
    <Modal open onClose={onClose} title={`Reatribuir: ${passo.rotulo}`}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button disabled={!ref} onClick={async () => { const r = await executar(() => api.post(`vagas/${vagaId}/aprovacoes/${passo.passoId}/reatribuir`, { tipo, ref }), 'Aprovador reatribuído.'); if (r) onFeito() }}>Reatribuir</Button></>}>
      <label className="block mb-3"><span className="label">Tipo de aprovador</span>
        <Dropdown className="input" value={tipo} onChange={(e) => { setTipo(e.target.value as typeof tipo); setRef('') }}><option value="pessoa">Pessoa específica</option><option value="papel">Papel</option><option value="funcao">Função adicional</option></Dropdown></label>
      <label className="block"><span className="label">Aprovador</span>
        <Dropdown className="input" value={ref} onChange={(e) => setRef(e.target.value)}><option value="">Selecione…</option>{lista.map((o) => <option key={o.v} value={o.v}>{o.n}</option>)}</Dropdown></label>
    </Modal>
  )
}

function Comentarios({ d, onNovo }: { d: D; onNovo: () => void }) {
  const [t, setT] = useState('')
  return (
    <div className="space-y-4">
      <Card className="p-5">
        <label className="block"><span className="label">Novo comentário interno</span><textarea className="input min-h-[90px]" maxLength={2000} value={t} onChange={(e) => setT(e.target.value)} placeholder="Visível apenas para quem acompanha esta vaga." /></label>
        <div className="mt-3"><Button icon="Send" disabled={!t.trim()} onClick={async () => { const r = await executar(() => api.post(`vagas/${d.vaga.id}/comentarios`, { texto: t }), 'Comentário registrado.'); if (r) { setT(''); onNovo() } }}>Comentar</Button></div>
      </Card>
      {d.comentarios.length === 0 ? <Card><EmptyState icon="MessageSquare" title="Nenhum comentário" desc="Use os comentários para alinhar detalhes da vaga com quem a acompanha." /></Card> : (
        <ul className="space-y-3">{d.comentarios.map((c: D) => (
          <li key={c.id} className="card p-4 flex gap-3"><Avatar nome={c.autorNome ?? '?'} size="sm" /><div><div className="text-[13px]"><b>{c.autorNome ?? 'Pessoa removida'}</b> <span className="text-muted text-[12px]">{haQuanto(c.criadoEm)}</span></div><p className="text-[13.5px] text-ink-2 mt-1 whitespace-pre-line">{c.texto}</p></div></li>
        ))}</ul>
      )}
    </div>
  )
}

function Anexos({ d, onMudou }: { d: D; onMudou: () => void }) {
  const pode = d.permissoes.anexar
  return (
    <Card>
      <CardHead title="Anexos" sub="PDF, DOCX, ODT, PNG ou JPG · até 3 MB" />
      <div className="p-5">
        {d.anexos.length === 0 ? <p className="text-[13px] text-muted mb-3">Nenhum anexo.</p> : (
          <ul className="space-y-2 mb-4">{d.anexos.map((a: D) => (
            <li key={a.id} className="flex items-center justify-between gap-3 text-[13.5px]">
              <a className="text-brand font-semibold hover:underline truncate" href={api.url(`vagas/${d.vaga.id}/anexos/${a.id}`)}>{a.nome}</a>
              <span className="text-muted text-[12px] shrink-0">{a.criadoPorNome ?? ''} · {Math.max(1, Math.round(a.tamanho / 1024))} KB{pode && <button type="button" className="ml-3 text-danger font-semibold" onClick={async () => { const r = await executar(() => api.del(`vagas/${d.vaga.id}/anexos/${a.id}`), 'Anexo removido.'); if (r) onMudou() }}>Remover</button>}</span>
            </li>))}</ul>
        )}
        {pode ? <label className="inline-flex flex-col gap-1"><span className="label">Adicionar arquivo</span><input type="file" accept=".pdf,.docx,.odt,.png,.jpg,.jpeg" className="text-[13px]" onChange={async (e) => {
          const f = e.target.files?.[0]; e.target.value = ''
          if (!f) return
          const r = await executar(async () => api.post(`vagas/${d.vaga.id}/anexos`, { arquivo: await lerBase64(f) }), 'Arquivo anexado.')
          if (r) onMudou()
        }} /></label> : <p className="text-[12px] text-muted">Os anexos não podem ser alterados neste estado.</p>}
      </div>
    </Card>
  )
}
