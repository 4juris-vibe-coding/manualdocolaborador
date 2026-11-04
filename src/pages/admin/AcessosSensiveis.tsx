/* ============================================================
   Administração · relatório de acessos a dados sensíveis
   Quem baixou currículos e documentos de candidatos, leu notas
   restritas ao RH, exportou candidaturas ou baixou documentos
   financeiros — e quando. Mostra o registro acessado (identificação),
   nunca o conteúdo. Fonte: GET /api/v2/auditoria/sensiveis
   (capacidade admin:auditoria). Cada exportação CSV também é auditada.
   ============================================================ */
import { useMemo, useState } from 'react'
import { Badge, Button, Callout, Card, EmptyState, PageHeader, Select, Tabela, TD, TH } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { api, qs, useApi } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import { dataHoraBR } from '@/lib/fmt'

interface Item {
  id: number; em: string; colaboradorId: string | null; colaboradorNome: string; tipo: string; tipoRotulo: string
  entidade: string; entidadeRotulo: string; entidadeId: string | null; registro: string
}
interface Resposta { itens: Item[]; total: number; pagina: number; por: number; tipos: { chave: string; rotulo: string }[]; entidades: { chave: string; rotulo: string }[] }

const TOM_ENTIDADE: Record<string, 'brand' | 'warning' | 'neutral'> = { candidatura: 'brand', documento: 'warning', nota_fiscal: 'warning' }

export default function AcessosSensiveis() {
  const [de, setDe] = useState('')
  const [ate, setAte] = useState('')
  const [pessoa, setPessoa] = useState('')
  const [tipo, setTipo] = useState('')
  const [entidade, setEntidade] = useState('')
  const [pagina, setPagina] = useState(1)
  const filtros = { de, ate, colaboradorId: pessoa, tipo, entidade }
  const r = useApi<Resposta>(`auditoria/sensiveis${qs({ ...filtros, pagina, por: 50 })}`)
  const colaboradores = useStore((s) => s.colaboradores)
  const gente = useMemo(() => colaboradores.map((c) => ({ id: c.id, nome: c.nomeSocial || c.nome })).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')), [colaboradores])
  const mudar = (f: (v: string) => void) => (v: string) => { f(v); setPagina(1) }
  const filtrando = !!(de || ate || pessoa || tipo || entidade)

  return (
    <>
      <PageHeader title="Acessos a dados sensíveis" subtitle="Quem acessou currículos, documentos, notas restritas e exportações — e quando."
        actions={<a href={api.url(`auditoria/sensiveis${qs({ ...filtros, formato: 'csv' })}`)} download><Button variant="ghost" icon="Download" type="button">Exportar CSV</Button></a>} />
      <SoComBanco>
        <Callout tone="brand" icon="ShieldCheck" className="mb-5">
          O relatório identifica o registro acessado, mas nunca mostra o conteúdo (arquivo, nota ou documento). Use-o para responder a pedidos de titulares e para revisar acessos fora do esperado.
        </Callout>
        <div className="flex flex-wrap items-end gap-3 mb-4">
          <label className="text-[12px] text-muted">De<input type="date" className="input mt-0.5" value={de} onChange={(e) => mudar(setDe)(e.target.value)} aria-label="Data inicial" /></label>
          <label className="text-[12px] text-muted">Até<input type="date" className="input mt-0.5" value={ate} onChange={(e) => mudar(setAte)(e.target.value)} aria-label="Data final" /></label>
          <Select label="Pessoa que acessou" value={pessoa} onChange={mudar(setPessoa)}>
            <option value="">Todas as pessoas</option>
            {gente.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
          </Select>
          <Select label="Tipo de acesso" value={tipo} onChange={mudar(setTipo)}>
            <option value="">Todos os tipos</option>
            {(r.dados?.tipos ?? []).map((t) => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
          </Select>
          <Select label="Entidade" value={entidade} onChange={mudar(setEntidade)}>
            <option value="">Todas as entidades</option>
            {(r.dados?.entidades ?? []).map((t) => <option key={t.chave} value={t.chave}>{t.rotulo}</option>)}
          </Select>
          {filtrando && <Button variant="ghost" size="sm" icon="X" onClick={() => { setDe(''); setAte(''); setPessoa(''); setTipo(''); setEntidade(''); setPagina(1) }}>Limpar filtros</Button>}
        </div>
        <Aguardar r={r}>
          {(d) => (
            <Card>
              {d.itens.length === 0 ? (
                <EmptyState icon="ScrollText" title={filtrando ? 'Nenhum acesso com esses filtros' : 'Nenhum acesso registrado'} desc={filtrando ? 'Ajuste o período ou os filtros.' : 'Os downloads e leituras de dados sensíveis aparecem aqui assim que acontecem.'} />
              ) : (
                <Tabela minWidth={820}>
                  <thead><tr><th className={TH}>Quando</th><th className={TH}>Quem acessou</th><th className={TH}>Tipo de acesso</th><th className={TH}>Registro</th></tr></thead>
                  <tbody>
                    {d.itens.map((i) => (
                      <tr key={i.id}>
                        <td className={TD}><span className="tabular-nums whitespace-nowrap">{dataHoraBR(i.em)}</span></td>
                        <td className={TD}><span className="font-semibold text-ink">{i.colaboradorNome}</span></td>
                        <td className={TD}>{i.tipoRotulo}</td>
                        <td className={TD}>
                          <Badge tone={TOM_ENTIDADE[i.entidade] ?? 'neutral'}>{i.entidadeRotulo}</Badge>
                          <div className="text-[13px] text-ink-2 mt-1">{i.registro}</div>
                          {i.entidadeId && <div className="text-[11px] text-muted font-mono truncate max-w-[260px]" title={i.entidadeId}>{i.entidadeId}</div>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
              <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
            </Card>
          )}
        </Aguardar>
        <p className="text-[12px] text-muted mt-3">Horários no fuso do seu navegador. A exportação CSV traz até 5.000 linhas, em UTC, e fica registrada na auditoria.</p>
      </SoComBanco>
    </>
  )
}
