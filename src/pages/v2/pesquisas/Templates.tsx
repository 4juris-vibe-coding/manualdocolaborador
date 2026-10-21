/* Biblioteca de modelos de pesquisa: ver, ler o objetivo e as perguntas, e criar uma cópia personalizável. */
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Badge, Button, Callout, Card, EmptyState, Icon, PageHeader, SearchBox, Tabs } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { CATEGORIAS_MODELO, MODELOS, type ModeloPesquisa } from '@/domain/v2/pesquisaModelos'
import { ROTULO_TIPO } from '@/domain/v2/pesquisaTipos'
import { api, executar } from '@/data/v2/api'
import { SoComBanco } from '@/components/v2/estados'

export default function Templates() {
  const nav = useNavigate()
  const [cat, setCat] = useState('todas')
  const [q, setQ] = useState('')
  const [ver, setVer] = useState<ModeloPesquisa | null>(null)
  const [criando, setCriando] = useState(false)

  const lista = useMemo(() => MODELOS.filter((m) =>
    (cat === 'todas' || m.categoria === cat) &&
    (!q || `${m.titulo} ${m.objetivo} ${m.categoria}`.toLowerCase().includes(q.toLowerCase()))), [cat, q])

  async function usar(m: ModeloPesquisa) {
    setCriando(true)
    const r = await executar(() => api.post<{ id: string }>('pesquisas', { modeloChave: m.chave }))
    setCriando(false)
    if (r) nav(`/pesquisas-rh/${r.id}`)
  }

  return (
    <>
      <PageHeader title="Biblioteca de modelos" subtitle="Escolha um modelo, leia o objetivo e as perguntas, e personalize uma cópia antes de publicar."
        actions={<Button icon="Plus" onClick={() => nav('/pesquisas-rh/nova')}>Pesquisa em branco</Button>} />
      <SoComBanco>
        <Tabs active={cat} onChange={setCat} tabs={[{ key: 'todas', label: 'Todos' }, ...CATEGORIAS_MODELO.map((c) => ({ key: c, label: c }))]} />
        <div className="mb-5"><SearchBox value={q} onChange={setQ} placeholder="Buscar modelo…" label="Buscar modelo" /></div>
        {!lista.length
          ? <Card><EmptyState icon="SearchX" title="Nenhum modelo encontrado" desc="Tente outra busca ou categoria." /></Card>
          : (
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
              {lista.map((m) => (
                <Card key={m.chave} className="p-5 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <Badge tone="brand">{m.categoria}</Badge>
                    <Badge tone={m.modoSugerido === 'anonima' ? 'success' : 'warning'}>{m.modoSugerido === 'anonima' ? 'Anônima' : 'Identificada'}</Badge>
                  </div>
                  <h3 className="text-[15.5px] font-bold text-ink leading-snug">{m.titulo}</h3>
                  <p className="text-[13px] text-muted mt-2 flex-1">{m.objetivo}</p>
                  <div className="flex items-center gap-4 text-[12px] text-muted mt-4">
                    <span className="flex items-center gap-1"><Icon name="ListChecks" className="h-3.5 w-3.5" /> {m.perguntas.length} perguntas</span>
                    <span className="flex items-center gap-1"><Icon name="Clock" className="h-3.5 w-3.5" /> ~{m.tempoMin} min</span>
                  </div>
                  <div className="flex gap-2 mt-4">
                    <Button size="sm" variant="ghost" icon="Eye" onClick={() => setVer(m)}>Ver modelo</Button>
                    <Button size="sm" icon="Copy" disabled={criando} onClick={() => usar(m)}>Usar</Button>
                  </div>
                </Card>
              ))}
            </div>
          )}
      </SoComBanco>

      <Modal open={!!ver} onClose={() => setVer(null)} wide title={ver?.titulo} subtitle={ver ? `${ver.categoria} · ${ver.perguntas.length} perguntas · ~${ver.tempoMin} min` : undefined}
        footer={ver && <><Button variant="ghost" onClick={() => setVer(null)}>Fechar</Button><Button icon="Copy" disabled={criando} onClick={() => usar(ver)}>Usar este modelo</Button></>}>
        {ver && (
          <div className="space-y-4 pb-2">
            <div><h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Objetivo</h4><p className="text-[14px] text-ink-2">{ver.objetivo}</p></div>
            {ver.intro && <div><h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-1">Texto de abertura</h4><p className="text-[14px] text-ink-2">{ver.intro}</p></div>}
            <Callout tone={ver.modoSugerido === 'anonima' ? 'success' : 'warning'} icon={ver.modoSugerido === 'anonima' ? 'ShieldCheck' : 'Eye'}>
              {ver.modoSugerido === 'anonima'
                ? 'Modelo sugerido como ANÔNIMO: as respostas não são gravadas com o nome de quem respondeu.'
                : 'Modelo sugerido como IDENTIFICADO: as respostas ficam ligadas à pessoa. Ao publicar, você informará a finalidade e quem poderá acessá-las.'}
            </Callout>
            <div>
              <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Perguntas</h4>
              {ver.perguntas.length === 0 ? <p className="text-[13px] text-muted">Este modelo começa vazio: você monta as perguntas.</p> : (
                <ol className="space-y-2">
                  {ver.perguntas.map((p, i) => (
                    <li key={p.id} className="flex gap-3 rounded-xl border border-line px-3.5 py-2.5 text-[13.5px]">
                      <span className="font-bold text-muted w-5 shrink-0">{i + 1}</span>
                      <div className="min-w-0">
                        <div className="text-ink">{p.texto}{p.condicao && <span className="ml-2 text-[11px] text-brand font-semibold">condicional</span>}</div>
                        <div className="text-[11.5px] text-muted mt-0.5">{ROTULO_TIPO[p.tipo]}{p.obrigatoria ? ' · obrigatória' : ' · opcional'}{p.opcoes ? ` · ${p.opcoes.length} alternativas` : ''}</div>
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        )}
      </Modal>
    </>
  )
}
