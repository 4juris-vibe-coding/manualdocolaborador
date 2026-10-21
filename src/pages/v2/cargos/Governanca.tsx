import { useState } from 'react'
import { Link } from 'react-router-dom'
import { PageHeader, Card, CardHead, Button, Badge, EmptyState, Field } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { Aguardar } from '@/components/v2/estados'
import { TelaCargos, MOTIVO_DUP } from '@/components/v2/cargos/comum'
import { api, executar, useApi } from '@/data/v2/api'
import { useTem } from '@/data/v2/acesso'
import { dataBR, haQuanto } from '@/lib/fmt'

interface Resp {
  pendentes: { id: string; tipo: 'ficha' | 'faixa'; cargoId: string; cargoNome: string | null; alvoId: string | null; propostaPor: string; propostaEm: string; descricao: string | null; podeDecidir: boolean }[]
  duplicidades: { a: string; b: string; motivo: string; nomeA: string; nomeB: string }[]
  inativos: { cargoId: string; nome: string; codigo: string }[]
  revisoesPendentes: { cargoId: string; nome: string; revisadoEm: string | null }[]
  semFicha: { cargoId: string; nome: string }[]
}

export default function Governanca() {
  const r = useApi<Resp>('cargos/governanca')
  const gerencia = useTem('cargos:gerenciar')
  const [dec, setDec] = useState<{ p: Resp['pendentes'][number]; tipo: 'aprovar' | 'rejeitar'; just: string } | null>(null)

  async function decidir() {
    if (!dec) return
    const rota = dec.p.tipo === 'ficha' ? `cargos/${encodeURIComponent(dec.p.cargoId)}/ficha/decisao` : `cargos/faixas/${dec.p.alvoId}/decisao`
    if (await executar(() => api.post(rota, { decisao: dec.tipo, justificativa: dec.just }), dec.tipo === 'aprovar' ? 'Aprovado.' : 'Rejeitado.')) { setDec(null); r.recarregar() }
  }
  async function notificar() { await executar(async () => { const x = await api.post<{ notificacoes: number }>('cargos/governanca/notificar-revisoes'); return x }, 'Responsáveis notificados (sem repetir avisos do mês).') }

  return (
    <TelaCargos>
      <PageHeader title="Governança de cargos" subtitle="Aprovações pendentes, duplicidades, cargos inativos e revisões vencidas."
        actions={gerencia && <Button variant="ghost" icon="BellRing" onClick={() => void notificar()}>Notificar revisões pendentes</Button>} />
      <Aguardar r={r}>
        {(d) => (
          <div className="grid xl:grid-cols-2 gap-5">
            <Card className="xl:col-span-2">
              <CardHead title="Fila de aprovação" sub="Quem propôs a mudança não pode aprová-la (exceto a administração)." />
              {d.pendentes.length === 0 ? <EmptyState icon="CheckCircle2" title="Nada aguardando aprovação" /> : (
                <ul className="divide-y divide-line">{d.pendentes.map((p) => (
                  <li key={p.id} className="px-5 py-3 flex flex-wrap items-center gap-3">
                    <Badge tone={p.tipo === 'ficha' ? 'brand' : 'gold'}>{p.tipo === 'ficha' ? 'Ficha' : 'Faixa salarial'}</Badge>
                    <div className="min-w-0 flex-1">
                      <Link className="font-semibold text-[13.5px] text-ink hover:text-brand" to={p.tipo === 'ficha' ? `/cargos/${p.cargoId}` : '/cargos/faixas'}>{p.cargoNome ?? p.cargoId}</Link>
                      <div className="text-[12px] text-muted">Enviada {haQuanto(p.propostaEm)}{p.descricao ? ` · ${p.descricao}` : ''}</div>
                    </div>
                    {p.podeDecidir ? <div className="flex gap-2"><Button size="sm" icon="Check" onClick={() => setDec({ p, tipo: 'aprovar', just: '' })}>Aprovar</Button><Button size="sm" variant="danger" onClick={() => setDec({ p, tipo: 'rejeitar', just: '' })}>Rejeitar</Button></div>
                      : <span className="text-[12px] text-muted">Aguardando outro aprovador</span>}
                  </li>
                ))}</ul>
              )}
            </Card>

            <Card>
              <CardHead title="Possíveis duplicidades" sub="Nome ou código iguais ou muito parecidos. Confirme antes de unificar em Engenharia de funções." />
              {d.duplicidades.length === 0 ? <EmptyState icon="CopyCheck" title="Nenhuma duplicidade encontrada" /> : (
                <ul className="divide-y divide-line">{d.duplicidades.map((x) => (
                  <li key={`${x.a}-${x.b}`} className="px-5 py-3 text-[13px]">
                    <Link to={`/cargos/${x.a}`} className="font-semibold text-ink hover:text-brand">{x.nomeA}</Link> e <Link to={`/cargos/${x.b}`} className="font-semibold text-ink hover:text-brand">{x.nomeB}</Link>
                    <Badge tone="warning" className="ml-2">{MOTIVO_DUP[x.motivo] ?? x.motivo}</Badge>
                  </li>
                ))}</ul>
              )}
            </Card>

            <Card>
              <CardHead title="Revisões pendentes" sub="Fichas nunca revisadas ou revisadas há mais de 12 meses." />
              {d.revisoesPendentes.length === 0 ? <EmptyState icon="CalendarCheck" title="Nenhuma revisão vencida" /> : (
                <ul className="divide-y divide-line">{d.revisoesPendentes.map((x) => (
                  <li key={x.cargoId} className="px-5 py-3 text-[13px] flex justify-between gap-3"><Link to={`/cargos/${x.cargoId}`} className="font-semibold text-ink hover:text-brand">{x.nome}</Link><span className="text-muted">{x.revisadoEm ? `Revisada em ${dataBR(x.revisadoEm)}` : 'Nunca revisada'}</span></li>
                ))}</ul>
              )}
            </Card>

            <Card>
              <CardHead title="Cargos inativos" sub="Seguem consultáveis e vinculados ao histórico." />
              {d.inativos.length === 0 ? <EmptyState icon="Archive" title="Nenhum cargo inativo" /> : (
                <ul className="divide-y divide-line">{d.inativos.map((x) => <li key={x.cargoId} className="px-5 py-3 text-[13px]"><Link to={`/cargos/${x.cargoId}`} className="font-semibold text-ink hover:text-brand">{x.nome}</Link> <span className="text-muted">· {x.codigo}</span></li>)}</ul>
              )}
            </Card>

            <Card>
              <CardHead title="Cargos sem ficha oficial" sub={`${d.semFicha.length} cargo(s)`} />
              {d.semFicha.length === 0 ? <EmptyState icon="BadgeCheck" title="Todos os cargos têm ficha" /> : (
                <ul className="divide-y divide-line max-h-72 overflow-y-auto">{d.semFicha.map((x) => <li key={x.cargoId} className="px-5 py-3 text-[13px]"><Link to={`/cargos/${x.cargoId}`} className="font-semibold text-ink hover:text-brand">{x.nome}</Link></li>)}</ul>
              )}
            </Card>
          </div>
        )}
      </Aguardar>

      <Modal open={!!dec} onClose={() => setDec(null)} title={dec?.tipo === 'aprovar' ? 'Aprovar' : 'Rejeitar'} subtitle={dec?.p.cargoNome ?? undefined}
        footer={<><Button variant="ghost" onClick={() => setDec(null)}>Cancelar</Button><Button variant={dec?.tipo === 'rejeitar' ? 'danger' : 'primary'} disabled={dec?.tipo === 'rejeitar' && !dec.just.trim()} onClick={() => void decidir()}>{dec?.tipo === 'aprovar' ? 'Aprovar' : 'Rejeitar'}</Button></>}>
        {dec && <Field label={dec.tipo === 'rejeitar' ? 'Justificativa' : 'Comentário (opcional)'} required={dec.tipo === 'rejeitar'}><textarea className="input !h-auto py-2.5" rows={3} value={dec.just} onChange={(e) => setDec({ ...dec, just: e.target.value })} /></Field>}
      </Modal>
    </TelaCargos>
  )
}
