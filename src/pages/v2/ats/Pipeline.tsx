import { useMemo, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, Avatar, EmptyState, Select, SearchBox } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { Aguardar, SoComBanco, CarregandoBloco } from '@/components/v2/estados'
import { StatusBadge } from '@/components/v2/StatusBadge'
import { CadastroManualModal, ImportarModal, MotivoModal } from '@/components/v2/ats/ModaisCandidato'
import { useAtraso, useTitulo } from '@/components/v2/ats/comuns'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { ORIGENS, ROTULO_ORIGEM, ROTULO_STATUS_CANDIDATURA } from '@/domain/v2/ats'
import { cn } from '@/lib/utils'
import { numero } from '@/lib/fmt'
import { Dropdown } from '@/components/Dropdown'

interface Cartao {
  id: string; nome: string; email: string; cidade?: string; uf?: string; etapaId: string; status: string; origem: string
  diasNaEtapa: number; temCurriculo: boolean; entrevistasAgendadas: number; mediaAvaliacoes: number | null
}
interface EtapaCol { id: string; nome: string; tipo: string; candidaturas: Cartao[] }
interface PipelineDados { vaga: { id: string; codigo: string; titulo: string; status: string; qtdPosicoes: number; posicoesPreenchidas: number }; etapas: EtapaCol[]; saidas: Record<string, number>; encerradas?: Cartao[]; total: number }

const STATUS_SAIDA = [{ v: 'reprovado', r: 'Reprovar' }, { v: 'desistiu', r: 'Registrar desistência' }, { v: 'cancelada', r: 'Cancelar candidatura' }]

export default function Pipeline() {
  useTitulo('Candidatos · 4JURIS Pessoas')
  const [sp, setSp] = useSearchParams()
  const vagaId = sp.get('vaga')
  const vagas = useApi<{ itens: any[] }>('ats/vagas')
  const gerenciar = useTem('ats:gerenciar')

  return (
    <SoComBanco>
      <PageHeader title="Candidatos" subtitle="Acompanhe o processo seletivo de cada vaga, da candidatura à contratação."
        actions={vagaId ? <Button variant="ghost" icon="ArrowLeft" onClick={() => setSp({})}>Todas as vagas</Button> : undefined} />
      {!vagaId ? (
        <Aguardar r={vagas} vazio={(d) => d.itens.length === 0 ? (
          <Card><EmptyState icon="BriefcaseBusiness" title="Nenhuma vaga com candidaturas disponíveis" desc="Quando houver vagas aprovadas ou publicadas, elas aparecem aqui para acompanhar o processo seletivo." action={gerenciar ? <Link to="/recrutamento/vagas" className="text-brand font-semibold text-[13.5px]">Ir para as vagas</Link> : undefined} /></Card>
        ) : null}>
          {(d) => (
            <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {d.itens.map((v) => (
                <button key={v.id} onClick={() => setSp({ vaga: v.id })} className="card p-5 text-left hover:border-brand transition outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0"><div className="text-[11.5px] text-muted font-semibold">{v.codigo}</div><div className="font-bold text-ink truncate">{v.titulo}</div></div>
                    <Badge tone={v.status === 'publicada' ? 'success' : v.status === 'pausada' ? 'warning' : 'neutral'} dot>{v.status}</Badge>
                  </div>
                  <div className="mt-4 flex gap-5 text-[12.5px] text-muted">
                    <span><b className="text-ink text-[18px]">{v.ativas}</b> em andamento</span>
                    <span><b className="text-ink text-[18px]">{v.total}</b> no total</span>
                    <span><b className="text-ink text-[18px]">{v.posicoesPreenchidas}/{v.qtdPosicoes}</b> vagas preench.</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Aguardar>
      ) : <Quadro vagaId={vagaId} vagas={vagas.dados?.itens ?? []} aoTrocar={(id) => setSp({ vaga: id })} />}
    </SoComBanco>
  )
}

function Quadro({ vagaId, vagas, aoTrocar }: { vagaId: string; vagas: any[]; aoTrocar: (id: string) => void }) {
  const gerenciar = useTem('ats:gerenciar')
  const podeExportar = useTem('ats:exportar')
  const podeSalario = useTem('vagas:ver_remuneracao')
  const [busca, setBusca] = useState('')
  const [origem, setOrigem] = useState('')
  const [saidas, setSaidas] = useState(false)
  const q = useAtraso(busca)
  const r = useApi<PipelineDados>(`ats/vagas/${vagaId}/pipeline${qs({ q, origem, saidas: saidas ? 1 : undefined })}`)
  const [cadastro, setCadastro] = useState(false)
  const [importar, setImportar] = useState(false)
  const [arrastando, setArrastando] = useState<string | null>(null)
  const [sobre, setSobre] = useState<string | null>(null)
  const [motivo, setMotivo] = useState<{ c: Cartao; status: string; titulo: string } | null>(null)
  const [contratar, setContratar] = useState<{ c: Cartao; etapaId: string } | null>(null)

  const etapas = r.dados?.etapas ?? []
  const todos = useMemo(() => etapas.flatMap((e) => e.candidaturas), [etapas])

  async function mover(c: Cartao, corpo: Record<string, unknown>, ok = 'Candidatura atualizada.') {
    const res = await executar(() => api.post(`ats/candidaturas/${c.id}/mover`, { deEtapaId: c.etapaId, ...corpo }), ok)
    r.recarregar()
    return res
  }

  function pedirMover(c: Cartao, destino: string) {
    if (!destino) return
    if (STATUS_SAIDA.some((s) => s.v === destino)) { setMotivo({ c, status: destino, titulo: STATUS_SAIDA.find((s) => s.v === destino)!.r }); return }
    const et = etapas.find((e) => e.id === destino)
    if (!et || et.id === c.etapaId) return
    if (et.tipo === 'contratado') { setContratar({ c, etapaId: et.id }); return }
    void mover(c, { etapaId: et.id })
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-3 mb-5">
        <Select label="Vaga" value={vagaId} onChange={aoTrocar} className="sm:min-w-[260px]">
          {vagas.map((v) => <option key={v.id} value={v.id}>{v.codigo} · {v.titulo}</option>)}
          {!vagas.some((v) => v.id === vagaId) && <option value={vagaId}>Vaga selecionada</option>}
        </Select>
        <SearchBox value={busca} onChange={setBusca} placeholder="Buscar por nome ou e-mail" label="Buscar candidato" />
        <Select label="Origem" value={origem} onChange={setOrigem}><option value="">Todas as origens</option>{ORIGENS.map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}</Select>
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-2"><input type="checkbox" checked={saidas} onChange={(e) => setSaidas(e.target.checked)} /> Mostrar encerrados</label>
        <div className="flex gap-2 ml-auto flex-wrap">
          {podeExportar && <a className="inline-flex items-center h-9 px-3 rounded-lg border border-line text-[12.5px] font-semibold text-ink hover:bg-surface-2" href={api.url(`ats/exportar${qs({ vagaId })}`)}>Exportar CSV</a>}
          {gerenciar && <Button size="sm" variant="ghost" icon="Upload" onClick={() => setImportar(true)}>Importar CSV</Button>}
          {gerenciar && <Button size="sm" icon="UserPlus" onClick={() => setCadastro(true)}>Cadastrar candidato</Button>}
        </div>
      </div>

      {r.dados && (
        <p className="text-[12.5px] text-muted mb-4">
          <b className="text-ink">{r.dados.vaga.titulo}</b> · {numero(r.dados.total)} candidatura(s) · posições preenchidas {r.dados.vaga.posicoesPreenchidas}/{r.dados.vaga.qtdPosicoes}
          {Object.entries(r.dados.saidas).filter(([, n]) => n > 0).map(([k, n]) => <span key={k}> · {ROTULO_STATUS_CANDIDATURA[k]?.rotulo ?? k}: {n}</span>)}
        </p>
      )}

      <Aguardar r={r} linhas={4}>
        {(d) => (
          <>
            {d.total === 0 && !q && !origem && <Card className="mb-4"><EmptyState icon="Inbox" title="Nenhuma candidatura nesta vaga ainda" desc="As candidaturas enviadas pelo portal de carreiras aparecem aqui automaticamente." /></Card>}
            <div className="flex gap-3 overflow-x-auto pb-4 -mx-4 px-4 sm:mx-0 sm:px-0" role="list" aria-label="Etapas do processo seletivo">
              {d.etapas.map((e) => (
                <div key={e.id} role="listitem" aria-label={`${e.nome}: ${e.candidaturas.length} candidato(s)`}
                  onDragOver={(ev) => { if (arrastando && gerenciar) { ev.preventDefault(); setSobre(e.id) } }}
                  onDragLeave={() => setSobre((s) => (s === e.id ? null : s))}
                  onDrop={(ev) => { ev.preventDefault(); setSobre(null); const c = todos.find((x) => x.id === arrastando); setArrastando(null); if (c) pedirMover(c, e.id) }}
                  className={cn('w-[272px] shrink-0 rounded-2xl bg-surface-3 border p-2.5 transition', sobre === e.id ? 'border-brand bg-brand-50' : 'border-line')}>
                  <div className="flex items-center justify-between px-1.5 py-1.5 mb-1.5">
                    <h3 className="text-[12.5px] font-bold text-ink truncate">{e.nome}</h3>
                    <Badge tone="neutral">{e.candidaturas.length}</Badge>
                  </div>
                  <div className="space-y-2 min-h-[56px]">
                    {e.candidaturas.map((c) => (
                      <CartaoKanban key={c.id} c={c} etapas={d.etapas} gerenciar={gerenciar} podeSalario={podeSalario}
                        aoArrastar={(id) => setArrastando(id)} aoSoltar={() => { setArrastando(null); setSobre(null) }} aoMover={(dest) => pedirMover(c, dest)} />
                    ))}
                    {e.candidaturas.length === 0 && <p className="text-[12px] text-muted-2 text-center py-4">{q || origem ? 'Nenhum resultado.' : 'Vazio'}</p>}
                  </div>
                </div>
              ))}
            </div>

            {saidas && (
              <Card className="mt-2">
                <div className="px-5 py-3.5 border-b border-line font-bold text-[14px]">Candidaturas encerradas</div>
                {(d.encerradas ?? []).length === 0 ? <EmptyState icon="Archive" title="Nenhuma candidatura encerrada" /> : (
                  <ul>
                    {d.encerradas!.map((c) => (
                      <li key={c.id} className="flex items-center gap-3 px-5 py-3 border-b border-line last:border-0">
                        <Avatar nome={c.nome} size="sm" />
                        <Link to={`/recrutamento/candidatos/${c.id}`} className="font-semibold text-ink hover:text-brand flex-1 truncate">{c.nome}</Link>
                        <StatusBadge mapa={ROTULO_STATUS_CANDIDATURA} valor={c.status} />
                        {gerenciar && c.status !== 'contratado' && <Button size="sm" variant="ghost" onClick={() => mover(c, { status: 'ativa', etapaId: d.etapas[0]?.id }, 'Candidatura reativada.')}>Reativar</Button>}
                      </li>
                    ))}
                  </ul>
                )}
              </Card>
            )}
          </>
        )}
      </Aguardar>
      {!r.dados && r.carregando && <CarregandoBloco linhas={1} />}

      <CadastroManualModal vagaId={vagaId} open={cadastro} onClose={() => setCadastro(false)} onFeito={r.recarregar} podeSalario={podeSalario} />
      <ImportarModal vagaId={vagaId} open={importar} onClose={() => setImportar(false)} onFeito={r.recarregar} />
      <MotivoModal aberto={!!motivo} titulo={motivo?.titulo ?? ''} avisarCandidato={motivo?.status === 'reprovado'} onClose={() => setMotivo(null)}
        onConfirmar={async (m, avisar) => { if (motivo) { await mover(motivo.c, { status: motivo.status, motivo: m, notificarCandidato: avisar }); setMotivo(null) } }} />
      <ConfirmModal open={!!contratar} onClose={() => setContratar(null)} perigo={false} confirmar="Concluir contratação" titulo="Concluir contratação?"
        texto={<>Isto marca <b>{contratar?.c.nome}</b> como contratado(a), conta uma posição preenchida na vaga e, se for a última, encerra a vaga. Não pode ser desfeito por aqui.</>}
        onConfirm={async () => { if (contratar) { const c = contratar; setContratar(null); await mover(c.c, { etapaId: c.etapaId }, 'Contratação concluída.') } }} />
    </>
  )
}

function CartaoKanban({ c, etapas, gerenciar, podeSalario, aoArrastar, aoSoltar, aoMover }: {
  c: Cartao; etapas: EtapaCol[]; gerenciar: boolean; podeSalario: boolean
  aoArrastar: (id: string) => void; aoSoltar: () => void; aoMover: (destino: string) => void
}) {
  void podeSalario
  return (
    <article draggable={gerenciar} onDragStart={(e) => { e.dataTransfer.setData('text/plain', c.id); e.dataTransfer.effectAllowed = 'move'; aoArrastar(c.id) }} onDragEnd={aoSoltar}
      className={cn('bg-surface border border-line rounded-xl p-3 shadow-xs', gerenciar && 'cursor-grab active:cursor-grabbing')}>
      <div className="flex items-start gap-2.5">
        <Avatar nome={c.nome} size="sm" />
        <div className="min-w-0 flex-1">
          <Link to={`/recrutamento/candidatos/${c.id}`} className="block text-[13.5px] font-bold text-ink hover:text-brand truncate">{c.nome}</Link>
          <div className="text-[11.5px] text-muted truncate">{c.email}</div>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 mt-2.5 text-[11px]">
        <Badge tone="neutral">{ROTULO_ORIGEM[c.origem] ?? c.origem}</Badge>
        <span className={cn('font-medium', c.diasNaEtapa > 7 ? 'text-warning' : 'text-muted')}>{c.diasNaEtapa === 0 ? 'hoje' : `${c.diasNaEtapa} d na etapa`}</span>
        {c.mediaAvaliacoes !== null && <span className="text-ink-2 font-semibold" title="Média das avaliações (1 a 5)">★ {numero(c.mediaAvaliacoes, 1)}</span>}
        {c.entrevistasAgendadas > 0 && <span className="text-brand font-semibold">{c.entrevistasAgendadas} entrevista(s)</span>}
        {!c.temCurriculo && <span className="text-muted-2">sem currículo</span>}
      </div>
      {gerenciar && (
        <Dropdown aria-label={`Mover ${c.nome} para outra etapa`} className="mt-2.5 w-full h-8 rounded-lg border border-line bg-surface-2 text-[12px] text-ink-2 px-2"
          value="" onChange={(e) => { aoMover(e.target.value); e.target.value = '' }}>
          <option value="">Mover para…</option>
          <optgroup label="Etapas">{etapas.filter((e) => e.id !== c.etapaId).map((e) => <option key={e.id} value={e.id}>{e.nome}</option>)}</optgroup>
          <optgroup label="Encerrar">{STATUS_SAIDA.map((s) => <option key={s.v} value={s.v}>{s.r}</option>)}</optgroup>
        </Dropdown>
      )}
    </article>
  )
}
