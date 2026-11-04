import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Badge, Button, EmptyState, SearchBox, Field, Callout } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { useAtraso, useTitulo } from '@/components/v2/ats/comuns'
import { api, executar, qs, useApi } from '@/data/v2/api'
import { dataBR, dataHoraBR } from '@/lib/fmt'
import { Dropdown } from '@/components/Dropdown'

export default function Talentos() {
  useTitulo('Banco de talentos · 4JURIS Pessoas')
  const [busca, setBusca] = useState('')
  const [tag, setTag] = useState('')
  const [pagina, setPagina] = useState(1)
  const q = useAtraso(busca)
  const r = useApi<{ itens: any[]; total: number; por: number }>(`ats/talentos${qs({ q, tag, pagina })}`)
  const [contato, setContato] = useState<any | null>(null)
  const [remover, setRemover] = useState<any | null>(null)
  const [adicionar, setAdicionar] = useState<any | null>(null)

  return (
    <SoComBanco>
      <PageHeader title="Banco de talentos" subtitle="Pessoas que autorizaram o uso dos dados para processos futuros." />
      <Callout tone="brand" icon="ShieldCheck" className="mb-5">
        Entrar no banco de talentos exige autorização específica da pessoa para uso futuro. Cada registro tem prazo de retenção; vencido o prazo, o contato deve ser renovado ou os dados removidos.
        Para incluir alguém, abra o perfil da candidatura e use a aba <b>Privacidade</b>.
      </Callout>
      <div className="flex flex-wrap gap-3 mb-4">
        <SearchBox value={busca} onChange={(v) => { setBusca(v); setPagina(1) }} placeholder="Buscar por nome, e-mail ou observação" label="Buscar no banco de talentos" />
        <input aria-label="Filtrar por competência ou tag" className="input w-full sm:w-56" placeholder="Filtrar por tag exata" value={tag} onChange={(e) => { setTag(e.target.value); setPagina(1) }} />
      </div>
      <Aguardar r={r} vazio={(d) => d.itens.length === 0 ? <Card><EmptyState icon="Contact" title={q || tag ? 'Nenhum resultado' : 'Banco de talentos vazio'} desc={q || tag ? 'Ajuste os filtros.' : 'Quando candidatos autorizarem, eles aparecem aqui.'} /></Card> : null}>
        {(d) => (
          <Card>
            <ul>
              {d.itens.map((t) => (
                <li key={t.candidatoId} className="px-5 py-4 border-b border-line last:border-0">
                  <div className="flex flex-wrap justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold text-ink">{t.nome}</div>
                      <div className="text-[12.5px] text-muted">{t.email}{t.telefone ? ` · ${t.telefone}` : ''}{t.cidade ? ` · ${t.cidade}/${t.uf ?? ''}` : ''}</div>
                      <div className="flex flex-wrap gap-1.5 mt-2">{[...(t.tags ?? []), ...(t.areas ?? [])].map((x: string) => <Badge key={x} tone="brand">{x}</Badge>)}</div>
                      {t.observacao && <p className="text-[13px] text-ink-2 mt-2">{t.observacao}</p>}
                    </div>
                    <div className="text-right text-[12px] text-muted shrink-0">
                      <div>Guardar até {dataBR(t.retencaoAte)} {t.retencaoVencida && <Badge tone="danger">Prazo vencido</Badge>}</div>
                      <div>Último contato: {t.ultimoContatoEm ? dataHoraBR(t.ultimoContatoEm) : 'nunca'}</div>
                      <div className="flex gap-2 justify-end mt-2">
                        <Button size="sm" icon="UserPlus" onClick={() => setAdicionar(t)}>Adicionar a uma vaga</Button>
                        <Button size="sm" variant="soft" onClick={() => setContato(t)}>Registrar contato</Button>
                        <Button size="sm" variant="ghost" onClick={() => setRemover(t)}>Remover</Button>
                      </div>
                    </div>
                  </div>
                  {(t.historicoContato ?? []).length > 0 && <p className="text-[11.5px] text-muted mt-2">{t.historicoContato.length} contato(s) registrado(s).</p>}
                </li>
              ))}
            </ul>
            <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
          </Card>
        )}
      </Aguardar>
      <p className="text-[12px] text-muted mt-4">Precisa incluir alguém? <Link className="text-brand" to="/recrutamento/candidatos">Abra o candidato no pipeline</Link> e use a aba Privacidade.</p>
      {contato && <Contato t={contato} onClose={() => setContato(null)} onFeito={() => { setContato(null); r.recarregar() }} />}
      {adicionar && <AdicionarAVaga t={adicionar} onClose={() => setAdicionar(null)} />}
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover do banco de talentos?" confirmar="Remover" texto="A autorização para uso futuro será marcada como revogada. As candidaturas anteriores permanecem."
        onConfirm={async () => { const t = remover; setRemover(null); await executar(() => api.del(`ats/talentos/${t.candidatoId}`), 'Removido do banco de talentos.'); r.recarregar() }} />
    </SoComBanco>
  )
}

function Contato({ t, onClose, onFeito }: { t: any; onClose: () => void; onFeito: () => void }) {
  const [f, setF] = useState({ canal: 'e-mail', nota: '' })
  return (
    <Modal open onClose={onClose} title="Registrar contato" subtitle={t.nome}
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={async () => { if (await executar(() => api.post(`ats/talentos/${t.candidatoId}/contatos`, f), 'Contato registrado.')) onFeito() }}>Salvar</Button></>}>
      <Field label="Canal" htmlFor="ct-c"><Dropdown id="ct-c" className="input" value={f.canal} onChange={(e) => setF({ ...f, canal: e.target.value })}><option>e-mail</option><option>telefone</option><option>WhatsApp</option><option>LinkedIn</option><option>presencial</option></Dropdown></Field>
      <Field label="Anotação" htmlFor="ct-n"><input id="ct-n" className="input" value={f.nota} onChange={(e) => setF({ ...f, nota: e.target.value })} /></Field>
    </Modal>
  )
}

/** Vagas que recebem candidaturas pelo RH (a vaga encerrada ou ainda em aprovação não aparece). */
const STATUS_RECEBE = ['aprovada', 'publicada', 'pausada']

function AdicionarAVaga({ t, onClose }: { t: any; onClose: () => void }) {
  const vagas = useApi<{ itens: { id: string; codigo: string; titulo: string; status: string }[] }>('ats/vagas')
  const [vagaId, setVagaId] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [feito, setFeito] = useState<{ id: string; vagaId: string; vagaTitulo: string } | null>(null)
  const abertas = (vagas.dados?.itens ?? []).filter((v) => STATUS_RECEBE.includes(v.status))
  const autorizacaoVencida = !!t.retencaoVencida || (!!t.consentimentoAte && String(t.consentimentoAte) < new Date().toISOString().slice(0, 10))
  async function confirmar() {
    setEnviando(true)
    const r = await executar(() => api.post<{ id: string; vagaId: string; vagaTitulo: string }>(`ats/talentos/${t.candidatoId}/candidatar`, { vagaId }), 'Candidatura criada.')
    setEnviando(false)
    if (r) setFeito(r)
  }
  return (
    <Modal open onClose={onClose} title="Adicionar a uma vaga" subtitle={t.nome}
      footer={feito ? <Button onClick={onClose}>Fechar</Button> : <>
        <Button variant="ghost" onClick={onClose}>Cancelar</Button>
        <Button icon="UserPlus" disabled={!vagaId || enviando} onClick={() => void confirmar()}>{enviando ? 'Adicionando…' : 'Adicionar'}</Button>
      </>}>
      {feito ? (
        <Callout tone="success" icon="CheckCircle2">
          {t.nome} entrou na primeira etapa de <b>{feito.vagaTitulo}</b>.{' '}
          <Link className="text-brand font-semibold" to={`/recrutamento/candidatos?vaga=${feito.vagaId}`}>Abrir o pipeline</Link>{' · '}
          <Link className="text-brand font-semibold" to={`/recrutamento/candidatos/${feito.id}`}>Ver candidatura</Link>
        </Callout>
      ) : (
        <>
          {autorizacaoVencida && <Callout tone="warning" icon="AlertTriangle" className="mb-3">A autorização desta pessoa parece vencida. O servidor só aceita com consentimento vigente para o banco de talentos.</Callout>}
          <Aguardar r={vagas}>
            {() => abertas.length === 0 ? <p className="text-[13px] text-muted">Nenhuma vaga aprovada, publicada ou pausada que você possa gerenciar.</p> : (
              <Field label="Vaga" htmlFor="tv-v" required hint="A candidatura entra na primeira etapa, com origem “Banco de talentos”.">
                <Dropdown id="tv-v" className="input" value={vagaId} onChange={(e) => setVagaId(e.target.value)}>
                  <option value="">Escolha a vaga…</option>
                  {abertas.map((v) => <option key={v.id} value={v.id}>{v.codigo} · {v.titulo}{v.status !== 'publicada' ? ` (${v.status})` : ''}</option>)}
                </Dropdown>
              </Field>
            )}
          </Aguardar>
        </>
      )}
    </Modal>
  )
}
