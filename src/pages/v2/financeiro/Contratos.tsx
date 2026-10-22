import { Link } from 'react-router-dom'
import { Badge, Button, Card, EmptyState, PageHeader, SearchBox, Select, TD, TH, Tabela } from '@/components/ui'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { useApi } from '@/data/v2/api'
import { BadgeContrato, dinheiro, useFiltros, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { ROTULO_MODELO } from '@/domain/v2/financeiro'
import { dataBR } from '@/lib/fmt'

export interface ContratoLinha {
  id: string; numero: string; fornecedorId: string; fornecedorNome: string; fornecedorDocumento: string | null; prestadorId: string | null; prestadorNome: string | null
  gestorId: string | null; gestorNome: string | null; setorId: string | null; setorNome: string | null; centroCustoId: string | null; centroCustoNome: string | null
  objeto: string; escopo: string | null; modeloRemuneracao: string; valor: number; periodicidadeFaturamento: string; prazoPagamentoDias: number | null; tipoPrazo: string
  dataAssinatura: string | null; inicio: string; fim: string | null; renovacao: string; renovacaoMeses: number; avisoRenovacaoDias: number
  obrigacoesContratada: string | null; obrigacoesContratante: string | null; observacoes: string | null; status: string; situacaoPrazo: string
  encerradoEm: string | null; encerramentoTipo: string | null; encerramentoMotivo: string | null; versao: number
}

export const BadgePrazo = ({ s }: { s: string }) =>
  s === 'vencido' ? <Badge tone="danger" dot>Vencido</Badge> : s === 'a_vencer' ? <Badge tone="warning" dot>A vencer</Badge> : s === 'sem_prazo' ? <Badge>Prazo indeterminado</Badge> : null

const CHAVES = ['q', 'status', 'fornecedor', 'centro', 'prazo', 'dias', 'ordem', 'pagina']

export default function Contratos() {
  const f = useFiltros(CHAVES)
  const op = useOpcoesFin()
  const r = useApi<{ itens: ContratoLinha[]; total: number; pagina: number; por: number }>(`financeiro/contratos${f.consulta}`)
  const podeCadastrar = op.dados?.capacidades.cadastrar
  return (
    <>
      <PageHeader title="Contratos de prestação de serviços" subtitle="Contratos comerciais com fornecedores PJ: vigência, valor, renovação, aditivos e encerramento."
        actions={podeCadastrar && <Link to="/financeiro/contratos/novo"><Button icon="Plus">Novo contrato</Button></Link>} />
      <SoComBanco>
        <div className="flex flex-wrap gap-2.5 mb-4">
          <SearchBox value={f.valores.q} onChange={(v) => f.definir('q', v)} placeholder="Número, objeto ou fornecedor" />
          <Select label="Situação" value={f.valores.status} onChange={(v) => f.definir('status', v)}>
            <option value="">Todas as situações</option><option value="rascunho">Rascunho</option><option value="vigente">Vigente</option><option value="suspenso">Suspenso</option><option value="encerrado">Encerrado</option>
          </Select>
          <Select label="Prazo" value={f.valores.prazo} onChange={(v) => f.definir('prazo', v)}>
            <option value="">Qualquer prazo</option><option value="a_vencer">Vencem em 60 dias</option><option value="vencido">Vencidos sem regularização</option>
          </Select>
          {op.dados?.capacidades.ver && <Select label="Fornecedor" value={f.valores.fornecedor} onChange={(v) => f.definir('fornecedor', v)}>
            <option value="">Todos os fornecedores</option>{op.dados.fornecedores.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}
          </Select>}
          <Select label="Ordenar" value={f.valores.ordem} onChange={(v) => f.definir('ordem', v)}>
            <option value="">Atualização recente</option><option value="fim">Término mais próximo</option><option value="valor">Maior valor</option>
          </Select>
        </div>
        <Aguardar r={r} linhas={5} vazio={(d) => d.total ? null : <Card><EmptyState icon="FileSignature" title="Nenhum contrato encontrado" desc={podeCadastrar ? 'Cadastre o fornecedor e depois o contrato.' : undefined} /></Card>}>
          {(d) => (
            <Card className="overflow-hidden">
              <Tabela minWidth={960}>
                <caption className="sr-only">Contratos</caption>
                <thead><tr><th className={TH}>Contrato</th><th className={TH}>Fornecedor / prestador</th><th className={TH}>Valor</th><th className={TH}>Vigência</th><th className={TH}>Gestor(a)</th><th className={TH}>Situação</th></tr></thead>
                <tbody>
                  {d.itens.map((k) => (
                    <tr key={k.id} className="hover:bg-surface-2">
                      <td className={TD}><Link to={`/financeiro/contratos/${k.id}`} className="font-semibold text-ink hover:text-brand">{k.numero}</Link><div className="text-[11.5px] text-muted line-clamp-1">{k.objeto}</div></td>
                      <td className={TD}><div>{k.fornecedorNome}</div><div className="text-[11.5px] text-muted">{k.prestadorNome ?? 'Sem prestador vinculado'}</div></td>
                      <td className={`${TD} tabular-nums`}>{dinheiro(k.valor)}<div className="text-[11.5px] text-muted">{ROTULO_MODELO[k.modeloRemuneracao]}</div></td>
                      <td className={TD}>{dataBR(k.inicio)} – {k.fim ? dataBR(k.fim) : 'indeterminado'}</td>
                      <td className={TD}>{k.gestorNome ?? '—'}</td>
                      <td className={TD}><div className="flex flex-col items-start gap-1"><BadgeContrato valor={k.status} /><BadgePrazo s={k.situacaoPrazo} /></div></td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
              <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={(p) => f.definir('pagina', String(p))} />
            </Card>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
