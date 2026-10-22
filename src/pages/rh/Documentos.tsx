import { useState } from 'react'
import { DocumentosRepo } from '@/pages/v2/financeiro/Outros'
import { MODO_API } from '@/data/config'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, Badge, Button, EmptyState, Tabs, SearchBox, Select, Tabela, TH, TD, IndicadorCard } from '@/components/ui'
import { toast } from '@/components/toast'
import { fmtDate } from '@/lib/utils'
import { hojeISO, somarDias, diasEntre } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { TIPOS_DOC } from '../Perfil'

/** Com banco, a tela é o módulo de gestão de prestadores (servidor); esta versão atende o modo demonstração. */
export default function Documentos() {
  if (MODO_API) return <DocumentosRepo />
  return <DocumentosDemo />
}

function DocumentosDemo() {
  const s = useStore()
  const hoje = hojeISO()
  const lim = somarDias(hoje, 60)
  const [aba, setAba] = useState('atencao')
  const [q, setQ] = useState('')
  const [tipo, setTipo] = useState('todos')

  const situacao = (v?: string) => (!v ? 'sem' : v < hoje ? 'vencido' : v <= lim ? 'vencendo' : 'valido')
  const ativos = new Set(s.colaboradores.filter((c) => c.status !== 'encerrado').map((c) => c.id))
  const semContrato = s.colaboradores.filter((c) => c.status !== 'encerrado' && !s.documentos.some((d) => d.colaboradorId === c.id && d.tipo === 'Contrato'))
  const docs = s.documentos
    .filter((d) => aba === 'todos' || (ativos.has(d.colaboradorId) && ['vencido', 'vencendo'].includes(situacao(d.validade))))
    .filter((d) => tipo === 'todos' || d.tipo === tipo)
    .filter((d) => !q.trim() || `${d.nome} ${s.nomeDe(d.colaboradorId)}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => (a.validade ?? '9999').localeCompare(b.validade ?? '9999'))

  const exportar = () => {
    baixarArquivo(gerarCSV(docs, [
      { titulo: 'Pessoa', valor: (d) => s.nomeDe(d.colaboradorId) }, { titulo: 'Documento', valor: (d) => d.nome }, { titulo: 'Tipo', valor: (d) => d.tipo },
      { titulo: 'Data', valor: (d) => d.data }, { titulo: 'Validade', valor: (d) => d.validade ?? '' }, { titulo: 'Situação', valor: (d) => situacao(d.validade) },
    ], [`Documentos — gerado em ${new Date().toLocaleString('pt-BR')}`, `Filtro: ${aba}; tipo=${tipo}`]), `documentos-${hoje}.csv`)
    toast('Lista exportada.')
  }

  return (
    <>
      <PageHeader title="Documentos" subtitle="Validades, pendências e documentos de cada parceria." actions={<Button variant="ghost" icon="Download" onClick={exportar}>Exportar lista</Button>} />
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <IndicadorCard titulo="Vencidos" valor={s.documentos.filter((d) => ativos.has(d.colaboradorId) && situacao(d.validade) === 'vencido').length} icon="FileX2" tone="danger" definicao="Documentos de parcerias ativas com validade anterior a hoje." fonte="Metadados de documentos" />
        <IndicadorCard titulo="Vencem em 60 dias" valor={s.documentos.filter((d) => ativos.has(d.colaboradorId) && situacao(d.validade) === 'vencendo').length} icon="FileClock" tone="warning" definicao="Validade entre hoje e os próximos 60 dias." fonte="Metadados de documentos" />
        <IndicadorCard titulo="Sem contrato anexado" valor={semContrato.length} icon="FileQuestion" tone="ink" definicao="Parcerias ativas sem documento do tipo “Contrato”." fonte="Metadados de documentos" />
        <IndicadorCard titulo="Total de documentos" valor={s.documentos.length} icon="Files" definicao="Todos os documentos registrados." fonte="Metadados de documentos" />
      </div>

      <Tabs tabs={[{ key: 'atencao', label: 'Pedem atenção' }, { key: 'todos', label: 'Todos' }, { key: 'sem', label: `Sem contrato (${semContrato.length})` }]} active={aba} onChange={setAba} />

      {aba === 'sem' ? (
        <Card>{semContrato.length === 0 ? <EmptyState icon="CheckCircle2" title="Todas as parcerias ativas têm contrato anexado" /> : (
          <ul className="divide-y divide-line">{semContrato.map((c) => <li key={c.id} className="flex items-center justify-between p-4"><span className="text-[13.5px] font-semibold text-ink">{c.nome}</span><Link to={`/rh/pessoas/${c.id}`} className="text-[12.5px] font-semibold text-brand">Abrir cadastro →</Link></li>)}</ul>
        )}</Card>
      ) : (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchBox value={q} onChange={setQ} placeholder="Documento ou pessoa" label="Buscar documentos" />
            <Select label="Tipo" value={tipo} onChange={setTipo}><option value="todos">Todos os tipos</option>{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</Select>
          </div>
          <Card>
            {docs.length === 0 ? <EmptyState icon="FileCheck2" title={aba === 'atencao' ? 'Nenhum documento pedindo atenção' : 'Nenhum documento encontrado'} /> : (
              <Tabela minWidth={720}>
                <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Documento</th><th className={TH}>Tipo</th><th className={TH}>Validade</th><th className={TH}>Situação</th></tr></thead>
                <tbody>
                  {docs.map((d) => {
                    const st = situacao(d.validade)
                    return (
                      <tr key={d.id} className="hover:bg-brand-50/40">
                        <td className={TD}><Link to={`/rh/pessoas/${d.colaboradorId}`} className="font-semibold text-ink hover:text-brand">{s.nomeDe(d.colaboradorId)}</Link></td>
                        <td className={TD}>{d.nome}</td><td className={TD}>{d.tipo}</td><td className={TD}>{fmtDate(d.validade)}</td>
                        <td className={TD}>{st === 'vencido' ? <Badge tone="danger" dot>Vencido há {diasEntre(d.validade!, hoje)} d</Badge> : st === 'vencendo' ? <Badge tone="warning" dot>Vence em {diasEntre(hoje, d.validade!)} d</Badge> : st === 'valido' ? <Badge tone="success" dot>Válido</Badge> : <span className="text-muted text-[12px]">Sem validade</span>}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </Tabela>
            )}
          </Card>
        </>
      )}
    </>
  )
}
