import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card, EmptyState, Field, PageHeader, SearchBox, Select, TD, TH, Tabela } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Modal } from '@/components/Modal'
import { Drawer } from '@/components/v2/Drawer'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { api, ErroApi, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { AVISO_INTEGRACOES, BadgeConta, CampoArquivo, Info, LinkArquivo, dinheiro, useFiltros, useMotivo, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { MAPA_STATUS_CONTA, ROTULO_FORMA, TIPOS_RETENCAO, calcularRetencao } from '@/domain/v2/financeiro'
import { dataBR, dataHoraBR } from '@/lib/fmt'

export interface ContaLinha {
  id: string; origem: string; notaId: string | null; notaNumero: string | null; reembolsoId: string | null; contratoId: string | null; contratoNumero: string | null
  fornecedorNome: string | null; pessoaNome: string | null; centroCusto: string | null; descricao: string; competencia: string | null; valorBruto: number; valorRetencoes: number; valorLiquido: number
  vencimento: string; status: string; atrasada: boolean; autorizadaPor: string | null; autorizadaEm: string | null; conciliadaPor: string | null; conciliadaEm: string | null
  canceladaPor: string | null; motivoCancelamento: string | null; versao: number
  pagamento: { data: string; forma: string; referencia: string | null; valorPago: number; comprovanteId: string | null; meio: string; registradoPor: string | null; registradoEm: string; observacoes: string | null } | null
}
type Arq = { nome: string; base64: string } | null

export default function Contas() {
  const f = useFiltros(['q', 'status', 'fornecedor', 'centro', 'de', 'ate', 'atrasadas', 'conciliar', 'conta', 'pagina'])
  const op = useOpcoesFin()
  const consulta = (() => { const u = new URLSearchParams(f.consulta.slice(1)); u.delete('conta'); const s = u.toString(); return s ? `?${s}` : '' })()
  const r = useApi<{ itens: ContaLinha[]; total: number; pagina: number; por: number; somas: { bruto: number; liquido: number } }>(`financeiro/contas${consulta}`)
  const [avulsa, setAvulsa] = useState(false)
  return (
    <>
      <PageHeader title="Contas a pagar" subtitle="Obrigações com prestadores: previstas → autorizadas → pagas (registro manual) → conciliadas."
        actions={<>
          <a href={api.url(`financeiro/contas/exportar${consulta}`)} className="inline-flex items-center gap-2 h-10 px-4 rounded-xl text-[13.5px] font-semibold border border-line bg-surface hover:bg-surface-2">Exportar CSV</a>
          {op.dados?.capacidades.pagar && <Button icon="Plus" onClick={() => setAvulsa(true)}>Conta avulsa</Button>}
        </>} />
      <SoComBanco>
        <Callout tone="neutral" icon="Info" className="mb-4">{AVISO_INTEGRACOES} Folha de pagamento CLT não é tratada aqui.</Callout>
        <div className="flex flex-wrap gap-2.5 mb-4">
          <SearchBox value={f.valores.q} onChange={(v) => f.definir('q', v)} placeholder="Descrição ou fornecedor" />
          <Select label="Situação" value={f.valores.status} onChange={(v) => f.definir('status', v)}><option value="">Todas</option>{Object.entries(MAPA_STATUS_CONTA).map(([k, v]) => <option key={k} value={k}>{v.rotulo}</option>)}<option value="prevista,autorizada">Em aberto</option></Select>
          {op.dados && <Select label="Fornecedor" value={f.valores.fornecedor} onChange={(v) => f.definir('fornecedor', v)}><option value="">Todos os fornecedores</option>{op.dados.fornecedores.map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}</Select>}
          {op.dados && <Select label="Centro de custo" value={f.valores.centro} onChange={(v) => f.definir('centro', v)}><option value="">Todos os centros</option>{op.dados.centros.map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Select>}
          <input type="date" aria-label="Vencimento de" className="input w-auto" value={f.valores.de} onChange={(e) => f.definir('de', e.target.value)} />
          <input type="date" aria-label="Vencimento até" className="input w-auto" value={f.valores.ate} onChange={(e) => f.definir('ate', e.target.value)} />
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.valores.atrasadas === '1'} onChange={(e) => f.definir('atrasadas', e.target.checked ? '1' : '')} /> Só vencidas</label>
          <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={f.valores.conciliar === '1'} onChange={(e) => f.definir('conciliar', e.target.checked ? '1' : '')} /> A conciliar</label>
        </div>
        <Aguardar r={r} linhas={5} vazio={(d) => d.total ? null : <Card><EmptyState icon="Wallet" title="Nenhuma conta encontrada" /></Card>}>
          {(d) => (
            <Card className="overflow-hidden">
              <div className="px-5 py-3 text-[12.5px] text-muted border-b border-line">{d.total} conta(s) · bruto {dinheiro(d.somas.bruto)} · líquido {dinheiro(d.somas.liquido)}</div>
              <Tabela minWidth={940}>
                <thead><tr><th className={TH}>Descrição</th><th className={TH}>Beneficiário</th><th className={TH}>Vencimento</th><th className={TH}>Bruto</th><th className={TH}>Retenções</th><th className={TH}>Líquido</th><th className={TH}>Situação</th></tr></thead>
                <tbody>{d.itens.map((c) => (
                  <tr key={c.id} className="hover:bg-surface-2 cursor-pointer" onClick={() => f.definir('conta', c.id)}>
                    <td className={TD}><button className="font-semibold text-left hover:text-brand" onClick={(e) => { e.stopPropagation(); f.definir('conta', c.id) }}>{c.descricao}</button><div className="text-[11.5px] text-muted">{c.origem === 'nota_fiscal' ? 'Nota fiscal' : c.origem === 'reembolso' ? 'Reembolso' : 'Avulsa'}{c.centroCusto ? ` · ${c.centroCusto}` : ''}</div></td>
                    <td className={TD}>{c.fornecedorNome ?? c.pessoaNome}</td>
                    <td className={TD}>{dataBR(c.vencimento)}{c.atrasada && <div><Badge tone="danger" dot>Vencida</Badge></div>}</td>
                    <td className={`${TD} tabular-nums`}>{dinheiro(c.valorBruto)}</td><td className={`${TD} tabular-nums`}>{dinheiro(c.valorRetencoes)}</td><td className={`${TD} tabular-nums font-semibold`}>{dinheiro(c.valorLiquido)}</td>
                    <td className={TD}><div className="flex flex-col items-start gap-1"><BadgeConta valor={c.status} />{c.status === 'paga' && !c.conciliadaEm && <Badge>A conciliar</Badge>}</div></td>
                  </tr>
                ))}</tbody>
              </Tabela>
              <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={(p) => f.definir('pagina', String(p))} />
            </Card>
          )}
        </Aguardar>
        <DetalheConta id={f.valores.conta} fechar={() => f.definir('conta', '')} mudou={() => r.recarregar()} />
        <ModalAvulsa aberto={avulsa} fechar={() => setAvulsa(false)} pronto={() => { setAvulsa(false); r.recarregar() }} />
      </SoComBanco>
    </>
  )
}

interface DetalheResp {
  conta: ContaLinha
  destino: { origem: string; banco: string | null; agencia: string | null; conta: string | null; pixTipo: string | null; pixChave: string | null } | null
  retencoes: { id: string; tipo: string; descricao: string | null; baseCalculo: number; aliquota: number | null; valor: number; fundamento: string; origem: string; registradoPor: string | null; revisadoPor: string | null; revisadoEm: string | null }[]
  avisoRetencoes: string
  acoes: Partial<Record<'retencoes' | 'autorizar' | 'desautorizar' | 'pagar' | 'conciliar' | 'cancelar', boolean>>
  bloqueios: string[]
}

function DetalheConta({ id, fechar, mudou }: { id: string; fechar: () => void; mudou: () => void }) {
  const r = useApi<DetalheResp>(id ? `financeiro/contas/${id}` : null)
  const [ret, setRet] = useState(false)
  const [pagar, setPagar] = useState(false)
  const motivo = useMotivo()
  const agir = async (rota: string, corpo: unknown, msg: string) => { if (await executar(() => api.post(`financeiro/contas/${id}/${rota}`, corpo), msg)) { r.recarregar(); mudou() } }
  const d = r.dados, c = d?.conta, a = d?.acoes ?? {}
  return (
    <Drawer open={!!id} onClose={fechar} titulo={c?.descricao ?? 'Conta a pagar'} subtitulo={c && `${c.fornecedorNome ?? c.pessoaNome} · vence ${dataBR(c.vencimento)}`} largura="max-w-2xl"
      rodape={c && <>
        {a.cancelar && <Button variant="ghost" onClick={async () => { const m = await motivo.pedir('Cancelar conta', 'A conta deixa de ser cobrada. Fica no histórico.', 'Cancelar conta'); if (m) agir('cancelar', { motivo: m }, 'Conta cancelada.') }}>Cancelar</Button>}
        {a.desautorizar && <Button variant="ghost" onClick={async () => { const m = await motivo.pedir('Revogar autorização', 'A conta volta para "prevista" e precisa de nova autorização.', 'Revogar', false); if (m) agir('desautorizar', { motivo: m }, 'Autorização revogada.') }}>Revogar autorização</Button>}
        {a.autorizar && <Button icon="ShieldCheck" onClick={() => agir('autorizar', { versao: c.versao }, 'Pagamento autorizado.')}>Autorizar pagamento</Button>}
        {a.pagar && <Button icon="Banknote" onClick={() => setPagar(true)}>Registrar pagamento</Button>}
        {a.conciliar && <Button icon="CheckCheck" onClick={() => agir('conciliar', {}, 'Pagamento conciliado.')}>Conciliar</Button>}
      </>}>
      {!c ? <p className="text-muted text-[13px]">Carregando…</p> : (
        <div className="space-y-5">
          <div className="flex flex-wrap gap-2"><BadgeConta valor={c.status} />{c.atrasada && <Badge tone="danger" dot>Vencida</Badge>}{c.conciliadaEm && <Badge tone="success">Conciliada</Badge>}</div>
          {d!.bloqueios.length > 0 && <Callout tone="warning" icon="AlertTriangle"><ul className="list-disc ml-5">{d!.bloqueios.map((b) => <li key={b}>{b}</li>)}</ul></Callout>}
          <dl className="grid grid-cols-3 gap-4">
            <Info rotulo="Bruto">{dinheiro(c.valorBruto)}</Info><Info rotulo="Retenções">{dinheiro(c.valorRetencoes)}</Info><Info rotulo="Líquido a pagar"><b>{dinheiro(c.valorLiquido)}</b></Info>
            <Info rotulo="Origem">{c.notaId ? <Link className="text-brand hover:underline" to={`/financeiro/notas?nota=${c.notaId}`}>NF {c.notaNumero}</Link> : c.origem === 'reembolso' ? 'Reembolso aprovado' : 'Conta avulsa'}</Info>
            <Info rotulo="Contrato">{c.contratoId ? <Link className="text-brand hover:underline" to={`/financeiro/contratos/${c.contratoId}`}>{c.contratoNumero}</Link> : '—'}</Info>
            <Info rotulo="Centro de custo">{c.centroCusto}</Info>
            {c.autorizadaPor && <Info rotulo="Autorizada por" className="col-span-3">{c.autorizadaPor} em {dataHoraBR(c.autorizadaEm)}</Info>}
            {c.motivoCancelamento && <Info rotulo="Cancelamento" className="col-span-3">{c.canceladaPor}: {c.motivoCancelamento}</Info>}
          </dl>
          {d!.destino && <div className="rounded-xl border border-line p-4"><h3 className="text-[13px] font-bold mb-2">Destino do pagamento</h3>
            {d!.destino.origem === 'ausente' ? <p className="text-[13px] text-danger">Sem dados de pagamento cadastrados.</p> : <p className="text-[13px]">{d!.destino.pixChave ? `PIX (${d!.destino.pixTipo ?? 'chave'}): ${d!.destino.pixChave}` : ''}{d!.destino.conta ? ` · Banco ${d!.destino.banco ?? ''} ag. ${d!.destino.agencia ?? ''} conta ${d!.destino.conta}` : ''}<span className="block text-[11.5px] text-muted mt-1">Fonte: {d!.destino.origem === 'fornecedor' ? 'cadastro do fornecedor' : 'perfil da pessoa'}</span></p>}</div>}
          <div>
            <div className="flex items-center justify-between mb-2"><h3 className="text-[13px] font-bold">Retenções</h3>{a.retencoes && <Button size="sm" variant="soft" icon="Plus" onClick={() => setRet(true)}>Registrar retenção</Button>}</div>
            <p className="text-[11.5px] text-muted mb-2">{d!.avisoRetencoes}</p>
            {d!.retencoes.length === 0 ? <p className="text-[13px] text-muted">Nenhuma retenção registrada.</p> : (
              <ul className="space-y-2">{d!.retencoes.map((x) => (
                <li key={x.id} className="rounded-xl border border-line p-3 text-[13px]">
                  <div className="flex justify-between gap-2"><b>{x.tipo} · {dinheiro(x.valor)}</b><span className="text-muted">{x.aliquota != null ? `${x.aliquota}% sobre ${dinheiro(x.baseCalculo)}` : `base ${dinheiro(x.baseCalculo)}`}</span></div>
                  <div className="text-[12px] text-muted mt-0.5">Fundamento: {x.fundamento}</div>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap text-[12px]">
                    <span>{x.origem === 'regra' ? 'Aplicada por regra do fornecedor' : `Registrada por ${x.registradoPor}`}</span>
                    {x.revisadoPor ? <Badge tone="success">Revisada por {x.revisadoPor}</Badge> : <Badge tone="warning">Aguarda revisão</Badge>}
                    {a.retencoes && !x.revisadoPor && <Button size="sm" variant="soft" onClick={() => agir(`retencoes/${x.id}/revisar`, {}, 'Retenção revisada.')}>Confirmar revisão</Button>}
                    {a.retencoes && <Button size="sm" variant="subtle" onClick={async () => { if (await executar(() => api.del(`financeiro/contas/${id}/retencoes/${x.id}`), 'Retenção removida.')) { r.recarregar(); mudou() } }}>Remover</Button>}
                  </div>
                </li>
              ))}</ul>
            )}
          </div>
          {c.pagamento && <div className="rounded-xl border border-success-line bg-success-soft p-4 text-[13px]">
            <h3 className="font-bold mb-1">Pagamento registrado (registro manual)</h3>
            <p>{dataBR(c.pagamento.data)} · {ROTULO_FORMA[c.pagamento.forma] ?? c.pagamento.forma} · {dinheiro(c.pagamento.valorPago)}{c.pagamento.referencia ? ` · ref. ${c.pagamento.referencia}` : ''}</p>
            <p className="text-[12px] mt-1">Registrado por {c.pagamento.registradoPor ?? '—'} em {dataHoraBR(c.pagamento.registradoEm)}{c.pagamento.meio === 'importado' ? ' (importado do controle anterior)' : ''}</p>
            {c.pagamento.comprovanteId && <div className="mt-2"><LinkArquivo rota={`financeiro/documentos/${c.pagamento.comprovanteId}/arquivo`}>Abrir comprovante</LinkArquivo></div>}
            {c.conciliadaEm && <p className="text-[12px] mt-1">Conciliado por {c.conciliadaPor} em {dataHoraBR(c.conciliadaEm)}</p>}
          </div>}
        </div>
      )}
      {c && <ModalRetencao aberto={ret} conta={c} fechar={() => setRet(false)} pronto={() => { setRet(false); r.recarregar(); mudou() }} />}
      {c && <ModalPagamento aberto={pagar} conta={c} fechar={() => setPagar(false)} pronto={() => { setPagar(false); r.recarregar(); mudou() }} />}
      {motivo.modal}
    </Drawer>
  )
}

function ModalRetencao({ aberto, conta, fechar, pronto }: { aberto: boolean; conta: ContaLinha; fechar: () => void; pronto: () => void }) {
  const [f, setF] = useState({ tipo: 'IRRF', baseCalculo: String(conta.valorBruto), aliquota: '', valor: '', fundamento: '', descricao: '' })
  const n = (s: string) => Number(s.replace(',', '.'))
  const previa = f.aliquota && Number.isFinite(n(f.aliquota)) && Number.isFinite(n(f.baseCalculo)) ? calcularRetencao(n(f.baseCalculo), n(f.aliquota)) : null
  const salvar = async () => {
    if (await executar(() => api.post(`financeiro/contas/${conta.id}/retencoes`, { ...f, baseCalculo: f.baseCalculo.replace(',', '.'), aliquota: f.aliquota ? f.aliquota.replace(',', '.') : undefined, valor: f.aliquota ? undefined : f.valor.replace(',', '.') }), 'Retenção registrada.')) pronto()
  }
  return (
    <Modal open={aberto} onClose={fechar} title="Registrar retenção" subtitle="Informe a alíquota (o valor é calculado com arredondamento comercial) ou o valor apurado, sempre com o fundamento."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Registrar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tributo"><Dropdown aria-label="Tributo" className="w-full" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS_RETENCAO.map((t) => <option key={t} value={t}>{t}</option>)}</Dropdown></Field>
        <Field label="Base de cálculo" htmlFor="rt-base"><input id="rt-base" className="input" inputMode="decimal" value={f.baseCalculo} onChange={(e) => setF({ ...f, baseCalculo: e.target.value })} /></Field>
        <Field label="Alíquota (%)" hint={previa != null ? `Valor: ${dinheiro(previa)}` : 'Ou deixe vazio e informe o valor.'} htmlFor="rt-al"><input id="rt-al" className="input" inputMode="decimal" value={f.aliquota} onChange={(e) => setF({ ...f, aliquota: e.target.value })} /></Field>
        {!f.aliquota && <Field label="Valor apurado" htmlFor="rt-val"><input id="rt-val" className="input" inputMode="decimal" value={f.valor} onChange={(e) => setF({ ...f, valor: e.target.value })} /></Field>}
      </div>
      <Field label="Fundamento" required htmlFor="rt-fund"><textarea id="rt-fund" className="input h-20 py-2.5" value={f.fundamento} onChange={(e) => setF({ ...f, fundamento: e.target.value })} /></Field>
    </Modal>
  )
}

function ModalPagamento({ aberto, conta, fechar, pronto }: { aberto: boolean; conta: ContaLinha; fechar: () => void; pronto: () => void }) {
  const [f, setF] = useState({ dataPagamento: new Date().toISOString().slice(0, 10), forma: 'pix', referencia: '', valorPago: conta.valorLiquido.toFixed(2), observacoes: '' })
  const [comp, setComp] = useState<Arq>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const salvar = async () => {
    try { await api.post(`financeiro/contas/${conta.id}/pagamento`, { ...f, valorPago: f.valorPago.replace(',', '.'), comprovante: comp ?? undefined }); toast('Pagamento registrado.'); pronto() }
    catch (e) { setErros((e as ErroApi).campos ?? {}); toast((e as ErroApi).message, 'danger') }
  }
  return (
    <Modal open={aberto} onClose={fechar} title="Registrar pagamento efetuado" subtitle="O sistema não faz transferências: registre aqui o pagamento já feito no banco, com a referência e/ou o comprovante."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Registrar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Data do pagamento" required erro={erros['data do pagamento']} htmlFor="pg-data"><input id="pg-data" type="date" className="input" value={f.dataPagamento} max={new Date().toISOString().slice(0, 10)} onChange={(e) => setF({ ...f, dataPagamento: e.target.value })} /></Field>
        <Field label="Forma"><Dropdown aria-label="Forma" className="w-full" value={f.forma} onChange={(e) => setF({ ...f, forma: e.target.value })}>{Object.entries(ROTULO_FORMA).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Dropdown></Field>
        <Field label="Valor pago" required hint={`Deve ser igual ao líquido autorizado (${dinheiro(conta.valorLiquido)}).`} erro={erros['valor pago'] ?? erros.valorPago} htmlFor="pg-val"><input id="pg-val" className="input" inputMode="decimal" value={f.valorPago} onChange={(e) => setF({ ...f, valorPago: e.target.value })} /></Field>
        <Field label="Referência da transação" hint="ID do PIX (E2E), número do comprovante…" erro={erros.referencia} htmlFor="pg-ref"><input id="pg-ref" className="input" value={f.referencia} onChange={(e) => setF({ ...f, referencia: e.target.value })} /></Field>
      </div>
      <CampoArquivo id="pg-comp" rotulo="Comprovante" valor={comp} onChange={setComp} dica="Obrigatório se não houver referência. PDF, PNG ou JPG até 3 MB." />
      <Field label="Observações" htmlFor="pg-obs"><textarea id="pg-obs" className="input h-16 py-2.5" value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
    </Modal>
  )
}

function ModalAvulsa({ aberto, fechar, pronto }: { aberto: boolean; fechar: () => void; pronto: () => void }) {
  const op = useOpcoesFin()
  const [f, setF] = useState({ fornecedorId: '', descricao: '', valorBruto: '', vencimento: '', centroCustoId: '', competencia: '' })
  const [doc, setDoc] = useState<Arq>(null)
  const salvar = async () => { if (await executar(() => api.post('financeiro/contas', { ...f, valorBruto: f.valorBruto.replace(',', '.'), documento: doc ?? undefined }), 'Conta criada. Ela precisa de autorização antes do pagamento.')) pronto() }
  return (
    <Modal open={aberto} onClose={fechar} title="Conta avulsa" subtitle="Para despesas acordadas fora de nota de serviço (ex.: deslocamento previsto em contrato). Também passa por autorização."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Criar</Button></>}>
      <Field label="Fornecedor" required><Dropdown aria-label="Fornecedor" className="w-full" value={f.fornecedorId} onChange={(e) => setF({ ...f, fornecedorId: e.target.value })}>
        <option value="">Selecione</option>{op.dados?.fornecedores.filter((x) => x.status !== 'inativo').map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}</Dropdown></Field>
      <Field label="Descrição" required htmlFor="av-desc"><input id="av-desc" className="input" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Valor bruto" required htmlFor="av-val"><input id="av-val" className="input" inputMode="decimal" value={f.valorBruto} onChange={(e) => setF({ ...f, valorBruto: e.target.value })} /></Field>
        <Field label="Vencimento" required htmlFor="av-venc"><input id="av-venc" type="date" className="input" value={f.vencimento} onChange={(e) => setF({ ...f, vencimento: e.target.value })} /></Field>
      </div>
      <Field label="Centro de custo"><Dropdown aria-label="Centro de custo" className="w-full" value={f.centroCustoId} onChange={(e) => setF({ ...f, centroCustoId: e.target.value })}><option value="">—</option>{op.dados?.centros.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}</Dropdown></Field>
      <CampoArquivo id="av-doc" rotulo="Documento de suporte (opcional)" valor={doc} onChange={setDoc} />
    </Modal>
  )
}
