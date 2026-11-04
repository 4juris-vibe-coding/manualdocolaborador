/* Alertas & pendências do RH: tudo o que pede ação, numa lista só (domain/alertasRH).
   A rotina diária do servidor também transforma os avisos de atenção/críticos em notificações. */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, Badge, Button, EmptyState, Icon, Select, Callout } from '@/components/ui'
import { CorrigirEncerramentoModal } from '@/components/rh/CicloVida'
import { toast } from '@/components/toast'
import { hojeISO } from '@/domain/datas'
import { alertasRH, ROTULO_TIPO_ALERTA, type AlertaRH, type Severidade, type TipoAlerta } from '@/domain/alertasRH'
import { useAtualizacaoAutomatica } from '@/data/sync'
import { MODO_API } from '@/data/config'
import { api, executar } from '@/data/v2/api'
import { fmtDate } from '@/lib/utils'

const SEV: Record<Severidade, { rotulo: string; tom: string; icone: string }> = {
  critico: { rotulo: 'Crítico', tom: 'danger', icone: 'AlertOctagon' },
  atencao: { rotulo: 'Atenção', tom: 'warning', icone: 'AlertTriangle' },
  info: { rotulo: 'Informativo', tom: 'brand', icone: 'PartyPopper' },
}
const ICONE: Record<TipoAlerta, string> = {
  aniversario_parceria: 'Cake', marco_inicio: 'Flag', contrato_vencendo: 'FileClock', contrato_vencido: 'FileX', documento_vencendo: 'FileClock', documento_vencido: 'FileX',
  exigencia_vencendo: 'BadgeAlert', exigencia_vencida: 'BadgeAlert', checklist_atrasado: 'ListTodo', encerramento_agendado: 'CalendarClock',
  encerramento_sem_classificacao: 'Tags', cadastro_pendente: 'UserCog', contrato_pessoa_encerrada: 'FileWarning',
}
const CHAVE_DISPENSADOS = '4juris_alertas_dispensados'
const lerDispensados = (): Record<string, string> => { try { return JSON.parse(localStorage.getItem(CHAVE_DISPENSADOS) ?? '{}') } catch { return {} } }

export default function Alertas() {
  const s = useStore()
  useAtualizacaoAutomatica()
  const hoje = hojeISO()
  const [sev, setSev] = useState<'todos' | Severidade>('todos')
  const [tipo, setTipo] = useState<'todos' | TipoAlerta>('todos')
  const [antecedencia, setAntecedencia] = useState('30')
  const [dispensados, setDispensados] = useState<Record<string, string>>(lerDispensados)
  const [verDispensados, setVerDispensados] = useState(false)
  const [classificar, setClassificar] = useState<string | null>(null)
  const todos = useMemo(() => alertasRH({ colaboradores: s.colaboradores, contratos: s.contratos, documentos: s.documentos, exigencias: s.exigencias, processos: s.processos },
    hoje, { diasAniversario: Number(antecedencia), diasDocumento: Number(antecedencia), diasContrato: Math.max(60, Number(antecedencia)) }), [s.colaboradores, s.contratos, s.documentos, s.exigencias, s.processos, hoje, antecedencia])
  const visiveis = todos.filter((a) => (verDispensados ? !!dispensados[a.chave] : !dispensados[a.chave]) && (sev === 'todos' || a.severidade === sev) && (tipo === 'todos' || a.tipo === tipo))
  const cont = (x: Severidade) => todos.filter((a) => a.severidade === x && !dispensados[a.chave]).length
  const semClass = todos.filter((a) => a.tipo === 'encerramento_sem_classificacao')
  const dispensar = (a: AlertaRH, sim: boolean) => {
    const n = { ...dispensados }
    if (sim) n[a.chave] = hoje; else delete n[a.chave]
    setDispensados(n)
    try { localStorage.setItem(CHAVE_DISPENSADOS, JSON.stringify(n)) } catch { /* sem armazenamento: vale só nesta sessão */ }
  }
  const tiposPresentes = [...new Set(todos.map((a) => a.tipo))]
  const pessoaClass = classificar ? s.pessoa(classificar) : undefined

  return (
    <>
      <PageHeader title="Alertas & pendências" subtitle="Vencimentos, marcos, checklists atrasados e encerramentos — o que pede ação do RH, em ordem de prioridade."
        actions={MODO_API ? <Button variant="ghost" icon="RefreshCw" onClick={() => void executar(() => api.post<{ encerramentos: { aplicados: string[] } }>('rh/rotinas/executar', {}), 'Rotina executada: encerramentos agendados aplicados e notificações geradas.')}>Executar rotina agora</Button> : undefined} />

      <div className="grid grid-cols-3 gap-3 mb-5">
        {(['critico', 'atencao', 'info'] as const).map((x) => (
          <button key={x} type="button" onClick={() => setSev(sev === x ? 'todos' : x)} aria-pressed={sev === x} className={`card p-4 text-left transition ${sev === x ? 'border-brand ring-2 ring-brand-100' : 'hover:border-brand-200'}`}>
            <div className="flex items-center gap-2 text-[12px] text-muted"><Icon name={SEV[x].icone} className="h-4 w-4" />{SEV[x].rotulo}</div>
            <div className="text-[24px] font-extrabold text-ink">{cont(x)}</div>
          </button>
        ))}
      </div>

      {semClass.length > 0 && (
        <Callout tone="warning" icon="Tags" className="mb-5">
          <b>{semClass.length} encerramento(s) sem iniciativa classificada.</b> Eles ficam fora do turnover involuntário. Classifique abaixo: só o RH sabe se foi iniciativa da 4JURIS, da pessoa, acordo ou término de escopo.
        </Callout>
      )}

      <div className="flex flex-wrap items-end gap-3 mb-4">
        <Select label="Tipo" value={tipo} onChange={(v) => setTipo(v as typeof tipo)}><option value="todos">Todos os tipos</option>{tiposPresentes.map((t) => <option key={t} value={t}>{ROTULO_TIPO_ALERTA[t]}</option>)}</Select>
        <Select label="Antecedência" value={antecedencia} onChange={setAntecedencia}><option value="7">7 dias</option><option value="15">15 dias</option><option value="30">30 dias</option><option value="60">60 dias</option></Select>
        <label className="inline-flex items-center gap-2 text-[13px] text-ink-2 mb-2"><input type="checkbox" checked={verDispensados} onChange={(e) => setVerDispensados(e.target.checked)} />Ver dispensados ({Object.keys(dispensados).filter((k) => todos.some((a) => a.chave === k)).length})</label>
      </div>

      {visiveis.length === 0 ? <Card><EmptyState icon="CheckCircle2" title={verDispensados ? 'Nada dispensado' : 'Tudo em dia'} desc={verDispensados ? '' : 'Nenhuma pendência com os filtros atuais.'} /></Card> : (
        <Card>
          <ul className="divide-y divide-line">
            {visiveis.map((a) => (
              <li key={a.chave} className="flex flex-wrap items-start gap-3 px-5 py-4">
                <span className={`grid place-items-center h-9 w-9 rounded-xl shrink-0 ${a.severidade === 'critico' ? 'bg-danger-soft text-danger' : a.severidade === 'atencao' ? 'bg-warning-soft text-warning-ink' : 'bg-brand-50 text-brand'}`}><Icon name={ICONE[a.tipo]} className="h-[18px] w-[18px]" /></span>
                <div className="flex-1 min-w-[220px]">
                  <div className="flex flex-wrap items-center gap-2"><span className="text-[14px] font-semibold text-ink">{a.titulo}</span><Badge tone={SEV[a.severidade].tom}>{SEV[a.severidade].rotulo}</Badge></div>
                  <div className="text-[12.5px] text-muted mt-0.5">{a.descricao}</div>
                  <div className="text-[11.5px] text-muted-2 mt-0.5">{ROTULO_TIPO_ALERTA[a.tipo]} · {fmtDate(a.data)}</div>
                </div>
                <div className="flex flex-wrap gap-2">
                  {a.tipo === 'encerramento_sem_classificacao' && a.pessoaId && <Button size="sm" icon="Tags" onClick={() => setClassificar(a.pessoaId!)}>Classificar</Button>}
                  <Link to={a.link}><Button size="sm" variant="ghost" icon="ArrowRight">Abrir</Button></Link>
                  {a.tipo !== 'encerramento_sem_classificacao' && <Button size="sm" variant="subtle" icon={dispensados[a.chave] ? 'Undo2' : 'EyeOff'} onClick={() => { dispensar(a, !dispensados[a.chave]); if (!dispensados[a.chave]) toast('Alerta dispensado neste navegador.') }}>{dispensados[a.chave] ? 'Restaurar' : 'Dispensar'}</Button>}
                </div>
              </li>
            ))}
          </ul>
        </Card>
      )}
      <p className="text-[11.5px] text-muted mt-3">Dispensar esconde o alerta só para você, neste navegador. A causa continua no cadastro e o alerta volta se a situação mudar (ex.: nova data). Encerramentos sem classificação não podem ser dispensados.</p>
      {pessoaClass?.encerramento && <CorrigirEncerramentoModal pessoa={pessoaClass} onClose={() => setClassificar(null)} />}
    </>
  )
}
