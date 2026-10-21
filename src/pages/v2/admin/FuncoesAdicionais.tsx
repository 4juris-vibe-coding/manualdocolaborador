import { useMemo, useState } from 'react'
import { PageHeader, Card, CardHead, Callout, SearchBox, Tabela, TH, TD, Avatar, Badge } from '@/components/ui'
import { api, executar, useApi } from '@/data/v2/api'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { PAPEL_LABEL } from '@/domain/permissions'
import type { Papel } from '@/lib/types'
import { useStore } from '@/lib/store'

interface Atribuicao { colaboradorId: string; nome: string; papel: Papel; funcoes: string[] }
interface Resposta { disponiveis: { chave: string; rotulo: string }[]; atribuicoes: Atribuicao[] }

const DESCRICAO: Record<string, string> = {
  recrutador: 'Gerencia vagas e candidatos; não vê dados fora do recrutamento.',
  analista_rh: 'Consulta vagas, cargos, estrutura e indicadores; não altera.',
  resp_pesquisas: 'Cria e acompanha pesquisas e vê resultados protegidos.',
  aprovador_financeiro: 'Pode ser designado como aprovador de orçamento nas vagas.',
}

export default function FuncoesAdicionais() {
  const r = useApi<Resposta>('acl/funcoes')
  const [busca, setBusca] = useState('')
  const [salvando, setSalvando] = useState<string | null>(null)
  const colaboradores = useStore((s) => s.colaboradores)

  const filtradas = useMemo(() => {
    const t = busca.trim().toLowerCase()
    return (r.dados?.atribuicoes ?? []).filter((a) => !t || a.nome.toLowerCase().includes(t))
  }, [r.dados, busca])

  async function alternar(a: Atribuicao, chave: string) {
    const novas = a.funcoes.includes(chave) ? a.funcoes.filter((f) => f !== chave) : [...a.funcoes, chave]
    setSalvando(a.colaboradorId)
    const ok = await executar(() => api.put(`acl/funcoes/${a.colaboradorId}`, { funcoes: novas }), 'Funções atualizadas.')
    setSalvando(null)
    if (ok) r.recarregar()
  }

  return (
    <>
      <PageHeader title="Funções adicionais" subtitle="Além do papel, algumas pessoas assumem funções específicas, como recrutar ou conduzir pesquisas." />
      <SoComBanco>
        <Callout tone="brand" icon="ShieldCheck" className="mb-5">
          As permissões valem a partir do próximo carregamento da página da pessoa e são verificadas no servidor. Toda mudança fica registrada na auditoria.
        </Callout>
        <Aguardar r={r}>
          {(d) => (
            <Card>
              <CardHead title="Quem pode o quê" sub={`${d.atribuicoes.length} pessoas ativas`} action={<SearchBox value={busca} onChange={setBusca} placeholder="Buscar pessoa…" label="Buscar pessoa" />} />
              <Tabela minWidth={760}>
                <thead>
                  <tr>
                    <th className={TH}>Pessoa</th>
                    <th className={TH}>Papel</th>
                    {d.disponiveis.map((f) => <th key={f.chave} className={TH} title={DESCRICAO[f.chave]}>{f.rotulo}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {filtradas.map((a) => {
                    const cor = colaboradores.find((c) => c.id === a.colaboradorId)?.avatarCor
                    return (
                      <tr key={a.colaboradorId}>
                        <td className={TD}><div className="flex items-center gap-3"><Avatar nome={a.nome} cor={cor} size="sm" /><span className="font-semibold text-ink">{a.nome}</span></div></td>
                        <td className={TD}><Badge tone="neutral">{PAPEL_LABEL[a.papel]}</Badge></td>
                        {d.disponiveis.map((f) => (
                          <td key={f.chave} className={TD}>
                            <label className="inline-flex items-center gap-2 cursor-pointer">
                              <input type="checkbox" className="h-4 w-4 accent-[rgb(var(--c-brand))]" checked={a.funcoes.includes(f.chave)} disabled={salvando === a.colaboradorId}
                                onChange={() => alternar(a, f.chave)} aria-label={`${f.rotulo}: ${a.nome}`} />
                            </label>
                          </td>
                        ))}
                      </tr>
                    )
                  })}
                  {filtradas.length === 0 && <tr><td className={TD} colSpan={2 + d.disponiveis.length}><p className="text-center text-muted py-6">Nenhuma pessoa encontrada.</p></td></tr>}
                </tbody>
              </Tabela>
            </Card>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
