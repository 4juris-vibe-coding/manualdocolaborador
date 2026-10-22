import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card, EmptyState, Field, PageHeader, SearchBox, Select, TD, TH, Tabela, Tabs } from '@/components/ui'
import { Drawer } from '@/components/v2/Drawer'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { api, executar, useApi } from '@/data/v2/api'
import { AVISO_INTEGRACOES, BadgeConta, BadgeNota, Info, LinkArquivo, competenciaBR, dinheiro, useFiltros, useMotivo, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { MAPA_STATUS_NOTA } from '@/domain/v2/financeiro'
import { dataBR, dataHoraBR } from '@/lib/fmt'

export interface NotaLinha {
  id: string; contratoId: string | null; contratoNumero: string | null; fornecedorNome: string; prestadorNome: string | null; gestorNome: string | null
  numero: string; serie: string; dataEmissao: string; competencia: string; valorBruto: number; descricao: string | null; vencimento: string | null; status: string
  divergencias: { codigo: string; mensagem: string }[]; justificativaDivergencia: string | null; temArquivo: boolean; enviadaPor: string | null; enviadaEm: string
  conferidaPor: string | null; conferidaEm: string | null; aprovadaPor: string | null; aprovadaEm: string | null; devolvidaPor: string | null; motivoDevolucao: string | null
  canceladaPor: string | null; motivoCancelamento: string | null; reenvios: number; legado: boolean; contaId: string | null; contaStatus: string | null
}
const ROTULO_HIST: Record<string, string> = { enviada: 'Enviada', conferida: 'Conferida', devolvida: 'Devolvida', reenviada: 'Reenviada', aprovada: 'Serviço aceito', cancelada: 'Cancelada' }

/** `embutido`: dentro da tela de notas do financeiro (aba Lista), sem o próprio cabeçalho. */
export default function NotasFinanceiro({ embutido = false }: { embutido?: boolean }) {
  // Embutida, a sub-aba usa outro parâmetro: `aba` é da tela que a contém.
  const ABA = embutido ? 'sub' : 'aba'
  const f = useFiltros(['aba', 'sub', 'q', 'status', 'competencia', 'fornecedor', 'divergencia', 'pendentes', 'nota', 'pagina'])
  const op = useOpcoesFin()
  const aba = f.valores[ABA] || (f.valores.pendentes ? 'pendentes' : 'todas')
  const consulta = (() => { const u = new URLSearchParams(f.consulta.slice(1)); u.delete('aba'); u.delete('sub'); u.delete('nota'); if (aba === 'pendentes') u.set('pendentes', '1'); else u.delete('pendentes'); const s = u.toString(); return s ? `?${s}` : '' })()
  const r = useApi<{ itens: NotaLinha[]; total: number; pagina: number; por: number; porStatus: Record<string, number> }>(aba === 'esperadas' ? null : `financeiro/notas${consulta}`)
  const esp = useApi<{ competencia: string; itens: { contratoId: string; contratoNumero: string; fornecedorNome: string; prestadorNome: string | null; valor: number }[] }>(aba === 'esperadas' && op.dados?.capacidades.ver ? `financeiro/notas/esperadas${f.valores.competencia ? `?competencia=${f.valores.competencia}` : ''}` : null)
  return (
    <>
      {!embutido && <PageHeader title="Notas fiscais de serviço" subtitle="Recebimento, conferência documental, aceite do serviço e geração da conta a pagar." />}
      <SoComBanco>
        <Callout tone="neutral" icon="Info" className="mb-4">{AVISO_INTEGRACOES}</Callout>
        <Tabs tabs={[{ key: 'pendentes', label: 'Minhas pendências' }, { key: 'todas', label: 'Todas' }, ...(op.dados?.capacidades.ver && !embutido ? [{ key: 'esperadas', label: 'Esperadas e não recebidas' }] : [])]}
          active={aba} onChange={(k) => f.definir(ABA, k)} />
        <div className="flex flex-wrap gap-2.5 mb-4">
          {aba !== 'esperadas' && <SearchBox value={f.valores.q} onChange={(v) => f.definir('q', v)} placeholder="Número, fornecedor ou contrato" />}
          {aba === 'todas' && <Select label="Situação" value={f.valores.status} onChange={(v) => f.definir('status', v)}><option value="">Todas</option>{Object.entries(MAPA_STATUS_NOTA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}</Select>}
          <input type="month" aria-label="Competência" className="input w-auto" value={f.valores.competencia} onChange={(e) => f.definir('competencia', e.target.value)} />
          {aba !== 'esperadas' && op.dados?.capacidades.ver && <Select label="Fornecedor" value={f.valores.fornecedor} onChange={(v) => f.definir('fornecedor', v)}><option value="">Todos os fornecedores</option>{op.dados.fornecedores.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}</Select>}
          {aba === 'todas' && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.valores.divergencia === '1'} onChange={(e) => f.definir('divergencia', e.target.checked ? '1' : '')} /> Só com divergência</label>}
        </div>

        {aba === 'esperadas' ? (
          <Aguardar r={esp} vazio={(d) => d.itens.length ? null : <Card><EmptyState icon="CheckCircle2" title="Todas as notas esperadas foram recebidas" /></Card>}>
            {(d) => <Card><Tabela minWidth={600}><caption className="text-left px-5 pt-4 text-[13px] text-muted capitalize">Competência {competenciaBR(d.competencia)}: contratos mensais vigentes sem nota recebida.</caption>
              <tbody>{d.itens.map((x) => <tr key={x.contratoId}><td className={TD}><Link className="font-semibold hover:text-brand" to={`/financeiro/contratos/${x.contratoId}`}>{x.contratoNumero}</Link></td><td className={TD}>{x.fornecedorNome}<div className="text-[11.5px] text-muted">{x.prestadorNome}</div></td><td className={`${TD} tabular-nums`}>{dinheiro(x.valor)}</td></tr>)}</tbody></Tabela></Card>}
          </Aguardar>
        ) : (
          <Aguardar r={r} linhas={5} vazio={(d) => d.total ? null : <Card><EmptyState icon="FileText" title={aba === 'pendentes' ? 'Nada aguardando você' : 'Nenhuma nota encontrada'} /></Card>}>
            {(d) => (
              <Card className="overflow-hidden">
                <Tabela minWidth={900} cartoes>
                  <thead><tr><th className={TH}>Nota</th><th className={TH}>Fornecedor / contrato</th><th className={TH}>Competência</th><th className={TH}>Valor bruto</th><th className={TH}>Situação</th><th className={TH}>Pagamento</th></tr></thead>
                  <tbody>{d.itens.map((n) => (
                    <tr key={n.id} className="hover:bg-surface-2 cursor-pointer" onClick={() => f.definir('nota', n.id)}>
                      <td className={TD}><button className="font-semibold text-ink hover:text-brand text-left" onClick={(e) => { e.stopPropagation(); f.definir('nota', n.id) }}>{n.numero}{n.serie ? `/${n.serie}` : ''}</button><div className="text-[11.5px] text-muted">emitida {dataBR(n.dataEmissao)}{n.reenvios ? ` · ${n.reenvios} reenvio(s)` : ''}</div></td>
                      <td className={TD} data-rotulo="Fornecedor / contrato">{n.fornecedorNome}<div className="text-[11.5px] text-muted">{n.contratoNumero ?? 'sem contrato (importada)'}</div></td>
                      <td className={`${TD} capitalize`} data-rotulo="Competência">{competenciaBR(n.competencia)}</td>
                      <td className={`${TD} tabular-nums`} data-rotulo="Valor bruto">{dinheiro(n.valorBruto)}</td>
                      <td className={TD} data-rotulo="Situação"><div className="flex flex-col items-start gap-1"><BadgeNota valor={n.status} />{n.divergencias.length > 0 && ['recebida', 'conferida'].includes(n.status) && <Badge tone="warning">{n.divergencias.length} divergência(s)</Badge>}</div></td>
                      <td className={TD} data-rotulo="Pagamento">{n.contaStatus ? <BadgeConta valor={n.contaStatus} /> : '—'}</td>
                    </tr>
                  ))}</tbody>
                </Tabela>
                <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={(p) => f.definir('pagina', String(p))} />
              </Card>
            )}
          </Aguardar>
        )}
        <DetalheNota id={f.valores.nota} fechar={() => f.definir('nota', '')} mudou={() => r.recarregar()} />
      </SoComBanco>
    </>
  )
}

export function DetalheNota({ id, fechar, mudou }: { id: string; fechar: () => void; mudou: () => void }) {
  const r = useApi<{ nota: NotaLinha; acoes: { conferir: boolean; aceitar: boolean; reenviar: boolean; cancelar: boolean }; historico: { id: number; em: string; autor: string | null; acao: string; detalhes: Record<string, unknown> }[] }>(id ? `financeiro/notas/${id}` : null)
  const [justificativa, setJustificativa] = useState('')
  const motivo = useMotivo()
  // Uma ação por vez: o aceite cria a conta a pagar, então um clique duplo não pode disparar duas chamadas.
  const [ocupado, setOcupado] = useState(false)
  const agir = async (rota: string, corpo: unknown, msg: string) => {
    if (ocupado) return
    setOcupado(true)
    try { if (await executar(() => api.post(`financeiro/notas/${id}/${rota}`, corpo), msg)) { r.recarregar(); mudou() } } finally { setOcupado(false) }
  }
  const n = r.dados?.nota
  const a = r.dados?.acoes
  return (
    <Drawer open={!!id} onClose={fechar} titulo={n ? `NF ${n.numero}${n.serie ? `/${n.serie}` : ''}` : 'Nota fiscal'} subtitulo={n && `${n.fornecedorNome} · ${competenciaBR(n.competencia)}`}
      rodape={n && a && <fieldset disabled={ocupado} className="contents">
        {a.cancelar && <Button variant="ghost" onClick={async () => { const m = await motivo.pedir('Cancelar nota fiscal', 'A conta a pagar ligada (se houver e não paga) também é cancelada.', 'Cancelar nota'); if (m) agir('cancelar', { motivo: m }, 'Nota cancelada.') }}>Cancelar nota</Button>}
        {a.conferir && <><Button variant="ghost" onClick={async () => { const m = await motivo.pedir('Devolver para correção', 'A pessoa que enviou será avisada e poderá reenviar.', 'Devolver'); if (m) agir('conferir', { decisao: 'devolver', motivo: m }, 'Nota devolvida.') }}>Devolver</Button>
          <Button icon="CheckCheck" onClick={() => agir('conferir', { decisao: 'conferir' }, 'Nota conferida. Segue para o aceite do serviço.')}>Conferir documento</Button></>}
        {a.aceitar && <><Button variant="ghost" onClick={async () => { const m = await motivo.pedir('Devolver para correção', 'Explique o que precisa ser corrigido no serviço ou na nota.', 'Devolver'); if (m) agir('aceite', { decisao: 'devolver', motivo: m }, 'Nota devolvida.') }}>Devolver</Button>
          <Button icon="BadgeCheck" disabled={n.divergencias.length > 0 && justificativa.trim().length < 10} onClick={() => agir('aceite', { decisao: 'aprovar', justificativa: justificativa || undefined }, 'Serviço aceito. A conta a pagar foi criada.')}>Aceitar serviço</Button></>}
      </fieldset>}>
      {r.carregando && !n ? <p className="text-muted text-[13px]">Carregando…</p> : n && (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><BadgeNota valor={n.status} />{n.contaStatus && <BadgeConta valor={n.contaStatus} />}{n.legado && <Badge>Importada do controle anterior</Badge>}</div>
          {n.divergencias.length > 0 && <Callout tone="warning" icon="AlertTriangle"><b>Divergências em relação ao contrato:</b><ul className="list-disc ml-5 mt-1">{n.divergencias.map((d) => <li key={d.codigo}>{d.mensagem}</li>)}</ul>
            {n.justificativaDivergencia && <p className="mt-2"><b>Justificativa do aceite:</b> {n.justificativaDivergencia}</p>}</Callout>}
          {n.status === 'devolvida' && n.motivoDevolucao && <Callout tone="danger" icon="Undo2">Devolvida por {n.devolvidaPor}: {n.motivoDevolucao}</Callout>}
          <dl className="grid grid-cols-2 gap-4">
            <Info rotulo="Valor bruto">{dinheiro(n.valorBruto)}</Info><Info rotulo="Emissão">{dataBR(n.dataEmissao)}</Info>
            <Info rotulo="Contrato">{n.contratoId ? <Link className="text-brand hover:underline" to={`/financeiro/contratos/${n.contratoId}`}>{n.contratoNumero}</Link> : '—'}</Info>
            <Info rotulo="Gestor(a) do aceite">{n.gestorNome ?? 'RH / financeiro'}</Info>
            <Info rotulo="Vencimento informado">{dataBR(n.vencimento)}</Info><Info rotulo="Prestador">{n.prestadorNome}</Info>
            {n.descricao && <Info rotulo="Descrição" className="col-span-2">{n.descricao}</Info>}
          </dl>
          {n.temArquivo ? <LinkArquivo rota={`financeiro/notas/${n.id}/arquivo`}>Abrir arquivo da nota</LinkArquivo> : <p className="text-[12.5px] text-muted">Sem arquivo (registro importado).</p>}
          {n.contaId && <Link to={`/financeiro/contas?conta=${n.contaId}`} className="block text-[13px] font-semibold text-brand hover:underline">Ver conta a pagar →</Link>}
          {a?.aceitar && n.divergencias.length > 0 && <Field label="Justificativa para aceitar com divergência" required hint="Mínimo de 10 caracteres. Fica no histórico." htmlFor="nf-just">
            <textarea id="nf-just" className="input h-24 py-2.5" value={justificativa} onChange={(e) => setJustificativa(e.target.value)} /></Field>}
          <div>
            <h3 className="text-[13px] font-bold mb-2">Histórico</h3>
            <ol className="space-y-2">{r.dados?.historico.map((h) => (
              <li key={h.id} className="text-[12.5px]"><b>{ROTULO_HIST[h.acao] ?? h.acao}</b> · {h.autor ?? 'Sistema'} · <span className="text-muted">{dataHoraBR(h.em)}</span>{typeof h.detalhes?.motivo === 'string' && <div className="text-muted">“{h.detalhes.motivo}”</div>}</li>
            ))}</ol>
          </div>
        </div>
      )}
      {motivo.modal}
    </Drawer>
  )
}
