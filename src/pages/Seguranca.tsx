import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Button, Tabs, SearchBox, Select, EmptyState, Callout, Field, Icon, Tabela, TH, TD } from '@/components/ui'
import { ConfirmModal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { fmtDateTime } from '@/lib/utils'
import { hojeISO } from '@/domain/datas'
import { gerarCSV, baixarArquivo } from '@/domain/csv'
import { exportarDadosTitular } from '@/domain/lgpd'

const MEDIDAS = [
  'Minimização: sem CTPS, PIS, raça, estado civil, dependentes ou dados de saúde; nascimento é opcional.',
  'Aniversário exibido apenas com dia e mês, e só para quem optou.',
  'Liderança não acessa documentos, contratos, valores, dados bancários ou observações privadas.',
  'Pesquisas anônimas: resposta e participação ficam em registros separados; grupos com menos de 3 respostas são suprimidos.',
  'Dados bancários mascarados por padrão; exportações não incluem dados bancários.',
  'Auditoria das ações administrativas, sem registrar conteúdo sensível.',
  'Exportação dos dados do titular (JSON) e anonimização após o encerramento da parceria.',
  'Sem senhas armazenadas no cliente; autenticação real deve vir de um provedor de identidade.',
]
const PENDENTES = [
  'Definir as bases legais e a política de retenção por tipo de dado (contratos, NFs e registros têm prazos legais próprios).',
  'Validar com o jurídico os textos de disponibilidade, vantagens e gamificação, em função do modelo de prestação de serviços.',
  'Revisar o fluxo de cadastro facial de acesso ao prédio (biometria é dado sensível) — fora desta plataforma.',
  'Implementar autorização no servidor (RLS/API) e storage privado com URLs assinadas para documentos.',
  'Designar encarregado(a) de dados e publicar o aviso de privacidade.',
]

export default function Seguranca() {
  const s = useStore()
  const [tab, setTab] = useState('auditoria')
  const [q, setQ] = useState('')
  const [entidade, setEntidade] = useState('todas')
  const [pessoa, setPessoa] = useState('')
  const [anonimizar, setAnonimizar] = useState(false)
  const entidades = [...new Set(s.auditoria.map((a) => a.entidade))].sort()
  const logs = useMemo(() => s.auditoria
    .filter((a) => entidade === 'todas' || a.entidade === entidade)
    .filter((a) => !q.trim() || `${a.resumo} ${a.acao} ${s.nomeDe(a.atorId)}`.toLowerCase().includes(q.trim().toLowerCase())), [s, q, entidade])
  const alvo = s.pessoa(pessoa)

  const exportarLog = () => {
    baixarArquivo(gerarCSV(logs, [
      { titulo: 'Quando', valor: (a) => a.em }, { titulo: 'Quem', valor: (a) => s.nomeDe(a.atorId) }, { titulo: 'Ação', valor: (a) => a.acao },
      { titulo: 'Entidade', valor: (a) => a.entidade }, { titulo: 'ID', valor: (a) => a.entidadeId }, { titulo: 'Resumo', valor: (a) => a.resumo },
    ], [`Auditoria — gerado em ${new Date().toLocaleString('pt-BR')}`]), `auditoria-${hojeISO()}.csv`)
    toast('Auditoria exportada.')
  }

  return (
    <>
      <PageHeader title="Privacidade & auditoria" subtitle="Histórico de ações administrativas e atendimento aos direitos dos titulares (LGPD)." />
      <Tabs tabs={[{ key: 'auditoria', label: `Auditoria (${s.auditoria.length})` }, { key: 'titular', label: 'Direitos do titular' }, { key: 'medidas', label: 'Medidas e pendências' }]} active={tab} onChange={setTab} />

      {tab === 'auditoria' && (
        <>
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchBox value={q} onChange={setQ} placeholder="Ação, pessoa ou resumo" label="Buscar na auditoria" />
            <Select label="Entidade" value={entidade} onChange={setEntidade}><option value="todas">Todas as entidades</option>{entidades.map((e) => <option key={e}>{e}</option>)}</Select>
            <Button variant="ghost" icon="Download" className="ml-auto" onClick={exportarLog}>Exportar</Button>
          </div>
          <Card>
            {logs.length === 0 ? <EmptyState icon="ScrollText" title="Nenhum registro" desc="As ações administrativas feitas nesta sessão de demonstração aparecem aqui (cadastros, papéis, eventos, pontos, privacidade…)." /> : (
              <Tabela minWidth={720}>
                <thead><tr><th className={TH}>Quando</th><th className={TH}>Quem</th><th className={TH}>Ação</th><th className={TH}>Resumo</th></tr></thead>
                <tbody>{logs.slice(0, 300).map((a) => <tr key={a.id}><td className={TD}>{fmtDateTime(a.em)}</td><td className={TD}>{s.nomeDe(a.atorId)}</td><td className={TD}><code className="text-[11.5px] bg-surface-2 rounded px-1.5 py-0.5">{a.acao}</code></td><td className={TD}>{a.resumo}</td></tr>)}</tbody>
              </Tabela>
            )}
          </Card>
          <p className="text-[11.5px] text-muted mt-3">Os registros guardam quem fez, o quê e quando — nunca senhas, documentos ou valores bancários. Na demonstração, ficam limitados aos 500 mais recentes.</p>
        </>
      )}

      {tab === 'titular' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6">
            <h3 className="text-[15px] font-bold text-ink mb-4">Atender a uma solicitação</h3>
            <Field label="Titular" htmlFor="tt-p"><select id="tt-p" className="input" value={pessoa} onChange={(e) => setPessoa(e.target.value)}><option value="">Selecione…</option>{s.colaboradores.map((c) => <option key={c.id} value={c.id}>{c.nome}{c.status === 'encerrado' ? ' (encerrada)' : ''}</option>)}</select></Field>
            <div className="flex flex-wrap gap-2">
              <Button variant="ghost" icon="Download" disabled={!alvo} onClick={() => { if (!alvo) return; baixarArquivo(JSON.stringify(exportarDadosTitular(s, alvo.id), null, 2), `dados-titular-${alvo.id}.json`, 'application/json'); toast('Cópia dos dados gerada.') }}>Exportar dados (JSON)</Button>
              <Button variant="danger" icon="UserX" disabled={!alvo || alvo.status !== 'encerrado'} onClick={() => setAnonimizar(true)}>Anonimizar</Button>
            </div>
            {alvo && alvo.status !== 'encerrado' && <p className="text-[12px] text-muted mt-3">A anonimização só está disponível após o encerramento da parceria.</p>}
          </Card>
          <Callout tone="neutral" icon="Info">
            <b>O que a anonimização faz:</b> remove nome, contatos, nascimento, dados bancários, documentos, mensagens e observações; mantém registros contratuais e financeiros
            (contratos, notas fiscais, reembolsos) e números agregados, que podem ter obrigação legal de guarda. Confirme o prazo com o jurídico antes de usar.
          </Callout>
        </div>
      )}

      {tab === 'medidas' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card><CardHead title="Medidas implementadas" /><ul className="p-5 space-y-2.5">{MEDIDAS.map((m) => <li key={m} className="flex gap-2.5 text-[13px] text-ink-2"><Icon name="CheckCircle2" className="h-4 w-4 text-success shrink-0 mt-0.5" />{m}</li>)}</ul></Card>
          <Card><CardHead title="Pendências antes da produção" sub="Exigem validação jurídica ou de segurança" /><ul className="p-5 space-y-2.5">{PENDENTES.map((m) => <li key={m} className="flex gap-2.5 text-[13px] text-ink-2"><Icon name="AlertTriangle" className="h-4 w-4 text-warning shrink-0 mt-0.5" />{m}</li>)}</ul></Card>
        </div>
      )}

      <ConfirmModal open={anonimizar} onClose={() => setAnonimizar(false)} titulo="Anonimizar dados pessoais?" confirmar="Anonimizar definitivamente"
        texto={alvo ? `Os dados pessoais de ${alvo.nome} serão removidos de forma irreversível. Registros contratuais e financeiros serão mantidos.` : ''}
        onConfirm={() => { if (alvo && feedback(s.anonimizarPessoa(alvo.id), 'Dados anonimizados.')) { setAnonimizar(false); setPessoa('') } }} />
    </>
  )
}
