import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, SearchBox, Select, Tabela, TH, TD, Badge, EmptyState, Callout } from '@/components/ui'
import { useApi, qs, api } from '@/data/v2/api'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { dataBR } from '@/lib/fmt'

interface Item { id: string; nome: string; email: string; vagaTitulo: string; vagaCodigo: string; etapaNome: string | null; status: string; origem: string; criadoEm: string; temCurriculo: boolean }
interface Resposta { itens: Item[]; total: number; pagina: number; por: number }

const ORIGENS: Record<string, string> = { portal: 'Portal', indicacao: 'Indicação', linkedin: 'LinkedIn', manual: 'Cadastro manual', importacao: 'Importação', banco_talentos: 'Banco de talentos', outro: 'Outro' }

/** Currículos recebidos: todos ficam guardados com segurança no banco e só abrem por aqui, com login. */
export default function Curriculos() {
  const [q, setQ] = useState('')
  const [origem, setOrigem] = useState('')
  const [pagina, setPagina] = useState(1)
  const r = useApi<Resposta>(`ats/candidaturas${qs({ q, origem, pagina, por: 25 })}`)
  const lista = r.dados?.itens.filter((i) => i.temCurriculo) ?? []

  return (
    <>
      <PageHeader title="Currículos" subtitle="Todos os currículos recebidos nas vagas, guardados com acesso restrito." />
      <SoComBanco>
        <Callout tone="brand" icon="ShieldCheck" className="mb-5">
          Os arquivos ficam armazenados no banco de dados e só são abertos por pessoas autorizadas (cada download é registrado). Não existe link público para currículos.
        </Callout>
        <div className="flex flex-wrap gap-3 mb-4">
          <SearchBox value={q} onChange={(v) => { setQ(v); setPagina(1) }} placeholder="Buscar por nome ou e-mail…" label="Buscar candidato" />
          <Select label="Origem" value={origem} onChange={(v) => { setOrigem(v); setPagina(1) }}>
            <option value="">Todas as origens</option>
            {Object.entries(ORIGENS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Select>
        </div>
        <Aguardar r={r}>
          {(d) => (
            <Card>
              {lista.length === 0 ? (
                <EmptyState icon="FileText" title={q || origem ? 'Nenhum currículo encontrado' : 'Nenhum currículo ainda'} desc={q || origem ? 'Tente outros termos.' : 'Os currículos enviados pelo portal ou anexados manualmente aparecem aqui.'} />
              ) : (
                <Tabela minWidth={760}>
                  <thead><tr><th className={TH}>Candidato</th><th className={TH}>Vaga</th><th className={TH}>Etapa</th><th className={TH}>Origem</th><th className={TH}>Recebido em</th><th className={TH}>Currículo</th></tr></thead>
                  <tbody>
                    {lista.map((c) => (
                      <tr key={c.id}>
                        <td className={TD}><Link to={`/recrutamento/candidatos/${c.id}`} className="font-semibold text-ink hover:text-brand">{c.nome}</Link><div className="text-[12px] text-muted">{c.email}</div></td>
                        <td className={TD}>{c.vagaTitulo}<div className="text-[12px] text-muted">{c.vagaCodigo}</div></td>
                        <td className={TD}>{c.status === 'ativa' ? (c.etapaNome ?? '—') : <Badge tone="neutral">{c.status}</Badge>}</td>
                        <td className={TD}>{ORIGENS[c.origem] ?? c.origem}</td>
                        <td className={TD}>{dataBR(c.criadoEm)}</td>
                        <td className={TD}><a className="text-brand font-semibold hover:underline" href={api.url(`ats/candidaturas/${c.id}/curriculo`)}>Baixar</a></td>
                      </tr>
                    ))}
                  </tbody>
                </Tabela>
              )}
              <Paginacao pagina={pagina} por={d.por} total={d.total} onPagina={setPagina} />
            </Card>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
