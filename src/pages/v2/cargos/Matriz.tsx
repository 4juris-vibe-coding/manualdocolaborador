import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, Button, Field, Badge, EmptyState, SearchBox, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Aguardar } from '@/components/v2/estados'
import { TelaCargos } from '@/components/v2/cargos/comum'
import { api, executar, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { cn } from '@/lib/utils'

interface Entrada { cargoId: string; competenciaId: string; nivelEsperado: number; obrigatoria: boolean; criterio: string | null }
interface Resp {
  cargos: { id: string; nome: string; pessoas: number }[]
  competencias: { id: string; nome: string }[]
  entradas: Entrada[]
  cobertura: { semMatriz: string[]; ausentesDaMatriz: { cargoId: string; competenciaId: string }[] }
}
const TOM = ['', 'bg-brand-50 text-brand-700', 'bg-brand-100 text-brand-700', 'bg-brand-200 text-brand-800', 'bg-brand-400 text-white', 'bg-brand text-white']

export default function Matriz() {
  const r = useApi<Resp>('cargos/matriz')
  const gerencia = useTem('cargos:gerenciar')
  const [busca, setBusca] = useState('')
  const [soLacunas, setSoLacunas] = useState(false)
  const [cel, setCel] = useState<{ cargoId: string; competenciaId: string; nivel: number; obrigatoria: boolean; criterio: string } | null>(null)

  const mapa = useMemo(() => new Map((r.dados?.entradas ?? []).map((e) => [`${e.cargoId}|${e.competenciaId}`, e])), [r.dados])
  const ausentes = useMemo(() => new Set((r.dados?.cobertura.ausentesDaMatriz ?? []).map((a) => `${a.cargoId}|${a.competenciaId}`)), [r.dados])

  async function salvar(remover = false) {
    if (!cel || !r.dados) return
    const itens = r.dados.entradas.filter((e) => e.cargoId === cel.cargoId && e.competenciaId !== cel.competenciaId)
      .map((e) => ({ competenciaId: e.competenciaId, nivelEsperado: e.nivelEsperado, obrigatoria: e.obrigatoria, criterio: e.criterio }))
    if (!remover) itens.push({ competenciaId: cel.competenciaId, nivelEsperado: cel.nivel, obrigatoria: cel.obrigatoria, criterio: cel.criterio })
    if (await executar(() => api.put(`cargos/${encodeURIComponent(cel.cargoId)}/matriz`, { itens }), 'Matriz atualizada.')) { setCel(null); r.recarregar() }
  }

  return (
    <TelaCargos>
      <PageHeader title="Matriz de competências" subtitle="Nível esperado de cada competência por cargo (1 a 5). Base para avaliações, capacitação e planejamento de carreira." />
      <Aguardar r={r} vazio={(d) => d.cargos.length === 0 ? <Card><EmptyState icon="Grid3x3" title="Sem cargos" desc="Cadastre cargos em Engenharia de funções." /></Card> : d.competencias.length === 0 ? <Card><EmptyState icon="Layers" title="Sem competências cadastradas" desc="Cadastre competências em Desenvolvimento → Competências para montar a matriz." action={<Link to="/rh/competencias"><Button>Ir para Competências</Button></Link>} /></Card> : null}>
        {(d) => {
          const cargos = d.cargos.filter((c) => c.nome.toLowerCase().includes(busca.toLowerCase())
            && (!soLacunas || d.cobertura.semMatriz.includes(c.id) || d.cobertura.ausentesDaMatriz.some((a) => a.cargoId === c.id)))
          return (
            <>
              {(d.cobertura.semMatriz.length > 0 || d.cobertura.ausentesDaMatriz.length > 0) && (
                <Callout tone="warning" icon="AlertTriangle" className="mb-4">
                  <b>{d.cobertura.semMatriz.length}</b> cargo(s) sem nenhuma competência na matriz e <b>{d.cobertura.ausentesDaMatriz.length}</b> competência(s) atribuída(s) ao cargo na tela de Competências, mas sem nível esperado aqui (células tracejadas).
                </Callout>
              )}
              <div className="flex flex-wrap items-center gap-3 mb-4">
                <SearchBox value={busca} onChange={setBusca} placeholder="Filtrar cargos…" label="Filtrar cargos" />
                <label className="inline-flex items-center gap-2 text-[13px] text-ink-2 font-medium"><input type="checkbox" checked={soLacunas} onChange={(e) => setSoLacunas(e.target.checked)} /> Só cargos com lacunas</label>
              </div>
              <Card>
                <div className="overflow-auto max-h-[70vh]">
                  <table className="text-[12.5px] border-separate border-spacing-0">
                    <caption className="sr-only">Matriz de competências por cargo</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="sticky left-0 top-0 z-20 bg-surface-2 border-b border-r border-line px-4 py-3 text-left min-w-[200px]">Cargo</th>
                        {d.competencias.map((c) => <th scope="col" key={c.id} className="sticky top-0 z-10 bg-surface-2 border-b border-line px-3 py-3 text-left font-semibold text-ink min-w-[120px] max-w-[160px]">{c.nome}</th>)}
                      </tr>
                    </thead>
                    <tbody>
                      {cargos.map((cg) => (
                        <tr key={cg.id}>
                          <th scope="row" className="sticky left-0 z-10 bg-surface border-b border-r border-line px-4 py-2.5 text-left font-semibold text-ink">
                            <Link to={`/cargos/${cg.id}`} className="hover:text-brand">{cg.nome}</Link>
                            {d.cobertura.semMatriz.includes(cg.id) && <Badge tone="warning" className="ml-2">Sem matriz</Badge>}
                          </th>
                          {d.competencias.map((c) => {
                            const e = mapa.get(`${cg.id}|${c.id}`)
                            const falta = ausentes.has(`${cg.id}|${c.id}`)
                            const conteudo = e ? (
                              <span className={cn('inline-flex items-center justify-center h-7 min-w-[34px] rounded-lg font-bold px-1.5', TOM[e.nivelEsperado])} title={`Nível ${e.nivelEsperado}${e.obrigatoria ? ' · obrigatória' : ' · desejável'}${e.criterio ? ` · ${e.criterio}` : ''}`}>{e.nivelEsperado}{!e.obrigatoria && <span className="ml-0.5 font-normal opacity-80" aria-label="desejável">*</span>}</span>
                            ) : falta ? <span className="inline-flex items-center justify-center h-7 min-w-[34px] rounded-lg border border-dashed border-warning-line text-warning" title="Atribuída ao cargo, sem nível esperado">?</span>
                              : <span className="text-muted-2">—</span>
                            return (
                              <td key={c.id} className="border-b border-line px-3 py-2 text-center">
                                {gerencia ? (
                                  <button type="button" className="rounded-lg outline-none focus-visible:ring-2 focus-visible:ring-brand" aria-label={`${cg.nome}, ${c.nome}: ${e ? `nível ${e.nivelEsperado}` : 'sem nível'}. Editar`}
                                    onClick={() => setCel({ cargoId: cg.id, competenciaId: c.id, nivel: e?.nivelEsperado ?? 3, obrigatoria: e?.obrigatoria ?? true, criterio: e?.criterio ?? '' })}>{conteudo}</button>
                                ) : conteudo}
                              </td>
                            )
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {cargos.length === 0 && <EmptyState icon="SearchX" title="Nenhum cargo corresponde ao filtro" />}
                <p className="px-5 py-3 text-[12px] text-muted border-t border-line">Nível 1 = básico · 5 = referência. “*” = desejável. “?” = competência atribuída ao cargo na tela legada, ainda sem nível esperado. A comparação com os níveis reais das pessoas (lacunas individuais) depende dos resultados dos ciclos de avaliação e não é calculada aqui.</p>
              </Card>
            </>
          )
        }}
      </Aguardar>

      <Modal open={!!cel} onClose={() => setCel(null)} title="Nível esperado"
        subtitle={cel && r.dados ? `${r.dados.cargos.find((c) => c.id === cel.cargoId)?.nome} · ${r.dados.competencias.find((c) => c.id === cel.competenciaId)?.nome}` : undefined}
        footer={<>
          {cel && mapa.has(`${cel.cargoId}|${cel.competenciaId}`) && <Button variant="danger" className="mr-auto" onClick={() => void salvar(true)}>Remover da matriz</Button>}
          <Button variant="ghost" onClick={() => setCel(null)}>Cancelar</Button><Button onClick={() => void salvar()}>Salvar</Button></>}>
        {cel && (
          <form onSubmit={(e) => { e.preventDefault(); void salvar() }}>
            <Field label="Nível esperado (1 a 5)" htmlFor="mx-n"><select id="mx-n" className="input" value={cel.nivel} onChange={(e) => setCel({ ...cel, nivel: Number(e.target.value) })}>{[1, 2, 3, 4, 5].map((n) => <option key={n} value={n}>{n}</option>)}</select></Field>
            <Field label="Tipo" htmlFor="mx-o"><select id="mx-o" className="input" value={cel.obrigatoria ? 's' : 'n'} onChange={(e) => setCel({ ...cel, obrigatoria: e.target.value === 's' })}><option value="s">Obrigatória</option><option value="n">Desejável</option></select></Field>
            <Field label="Critério de avaliação" htmlFor="mx-c"><textarea id="mx-c" rows={3} className="input !h-auto py-2.5" value={cel.criterio} onChange={(e) => setCel({ ...cel, criterio: e.target.value })} /></Field>
          </form>
        )}
      </Modal>
    </TelaCargos>
  )
}
