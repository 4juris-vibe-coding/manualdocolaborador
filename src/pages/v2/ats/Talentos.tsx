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
