/* Aba Análise: indicadores de estrutura com dados reais (descrevem; não julgam a estrutura). */
import { useApi } from '@/data/v2/api'
import { Aguardar } from '@/components/v2/estados'
import { LinhaTempo } from '@/components/v2/charts2'
import { BarList, Callout, Card, CardHead, EmptyState, StatCard, TD, TH, Tabela } from '@/components/ui'
import { DonutChart } from '@/components/charts'
import { numero } from '@/lib/fmt'
import type { AnaliseOrg, ItemContagem } from './tipos'

const CORES = ['#0032D2', '#0f9d6b', '#c98a12', '#7c3aed', '#0891b2', '#db2777', '#ea580c', '#122029']
const barras = (itens: ItemContagem[], max = 8) => itens.slice(0, max).map((i, n) => ({ rotulo: i.nome, valor: i.qtd, cor: CORES[n % CORES.length] }))

function Bloco({ titulo, sub, children }: { titulo: string; sub?: string; children: React.ReactNode }) {
  return <Card><CardHead title={titulo} sub={sub} /><div className="p-5">{children}</div></Card>
}

export function AnaliseEstrutura() {
  const r = useApi<AnaliseOrg>('organograma/analise')
  return (
    <Aguardar r={r} vazio={(d) => (d.indicadores.totalAtivos === 0
      ? <Card><EmptyState icon="Users" title="Ainda não há pessoas ativas cadastradas" desc="Cadastre pessoas em RH → Pessoas & contratos para ver a análise da estrutura." /></Card> : null)}>
      {(d) => {
        const i = d.indicadores
        return (
          <div className="space-y-6">
            <Callout tone="neutral" icon="Info">
              Estes números <b>descrevem</b> a estrutura cadastrada. Muitos ou poucos níveis, ou equipes grandes ou pequenas, não indicam por si só que algo esteja certo ou errado: dependem da estratégia da empresa.
            </Callout>
            <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
              <StatCard icon="Users" value={numero(i.totalAtivos)} label="Pessoas ativas" />
              <StatCard icon="UserCog" tone="ink" value={numero(i.gestores)} label="Pessoas com equipe" />
              <StatCard icon="Network" tone="success" value={numero(i.niveisHierarquicos)} label="Níveis hierárquicos" />
              <StatCard icon="Users2" tone="warning" value={i.tamanhoMedioEquipe === null ? '—' : numero(i.tamanhoMedioEquipe, 1)} label="Média de subordinados diretos" />
              <StatCard icon="UserPlus" tone="brand" value={numero(i.posicoesVagas.total)} label="Posições vagas registradas" />
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              <Bloco titulo="Pessoas por departamento" sub="Pessoas ativas por área cadastrada">
                <div className="flex flex-col sm:flex-row items-center gap-6">
                  <DonutChart titulo="Pessoas por departamento" centro={numero(i.totalAtivos)} dados={i.porSetor.map((s, n) => ({ rotulo: s.nome, valor: s.qtd, cor: CORES[n % CORES.length] }))} />
                  <div className="flex-1 w-full"><BarList itens={barras(i.porSetor)} total={i.totalAtivos} /></div>
                </div>
              </Bloco>
              <Bloco titulo="Pessoas por nível hierárquico" sub="1º nível = topo da estrutura (pessoas sem gestor acima, com equipe)">
                <BarList itens={i.porNivelHierarquico.map((n) => ({ rotulo: `${n.nivel}º nível`, valor: n.qtd }))} total={i.totalAtivos} vazio="Nenhum vínculo hierárquico cadastrado ainda." />
              </Bloco>
              <Bloco titulo="Distribuição por unidade"><BarList itens={barras(i.porUnidade)} total={i.totalAtivos} /></Bloco>
              <Bloco titulo="Distribuição por função e senioridade" sub="Senioridade vem do cadastro da função">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
                  <div><div className="text-[12px] font-bold text-muted mb-2">Funções</div><BarList itens={barras(i.porCargo, 6)} total={i.totalAtivos} /></div>
                  <div><div className="text-[12px] font-bold text-muted mb-2">Senioridade</div><BarList itens={barras(i.porSenioridade, 6)} total={i.totalAtivos} /></div>
                </div>
              </Bloco>
            </div>

            <Card>
              <CardHead title="Subordinados por gestor" sub="Quem tem equipe cadastrada, com subordinados diretos e total na linha abaixo" />
              {i.equipes.length === 0
                ? <EmptyState icon="Users" title="Nenhum gestor imediato cadastrado" desc="Defina o gestor imediato das pessoas para ver as equipes." />
                : <Tabela minWidth={420}><thead><tr><th className={TH}>Gestor</th><th className={`${TH} text-right`}>Diretos</th><th className={`${TH} text-right`}>No total</th></tr></thead>
                  <tbody>{i.equipes.slice(0, 20).map((e) => <tr key={e.id}><td className={TD}>{e.nome}</td><td className={`${TD} text-right tabular-nums`}>{e.diretos}</td><td className={`${TD} text-right tabular-nums`}>{e.totais}</td></tr>)}</tbody></Tabela>}
            </Card>

            <Bloco titulo="Evolução da estrutura" sub="Retratos mensais da estrutura">
              {d.evolucao
                ? <LinhaTempo titulo="Pessoas ativas por mês" pontos={d.evolucao.map((e) => ({ rotulo: e.mes.slice(0, 7), valor: e.dados.ativos }))} />
                : <p className="text-[13.5px] text-muted">{d.mensagemEvolucao} Retratos registrados: {d.retratos}.</p>}
            </Bloco>

            <Bloco titulo="Indicadores não disponíveis" sub="Não são calculados porque dependem de dados que a plataforma não possui">
              <ul className="text-[13px] text-ink-2 space-y-1.5 list-disc pl-5">
                {i.indisponiveis.map((x) => <li key={x.indicador}><b>{x.indicador}:</b> {x.dependencia}</li>)}
              </ul>
            </Bloco>
          </div>
        )
      }}
    </Aguardar>
  )
}
