/* Repositório de documentos, configuração financeira e telas do prestador (minhas notas, contratos e documentos). */
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Field, PageHeader, Select, TD, TH, Tabela, Toggle } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, ErroApi, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { recarregarEstado } from '@/data/sync'
import { useStore } from '@/lib/store'
import { AVISO_INTEGRACOES, BadgeConta, BadgeContrato, BadgeNota, CampoArquivo, competenciaBR, dinheiro, useFiltros, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { ListaDocumentos } from '@/components/v2/financeiro/Documentos'
import { ROTULO_MODELO } from '@/domain/v2/financeiro'
import { dataBR } from '@/lib/fmt'
import type { NotaLinha } from './Notas'
import type { ContaLinha } from './Contas'

/* ---------- repositório (RH/financeiro) ---------- */
export function DocumentosRepo() {
  const f = useFiltros(['status', 'validade', 'dias', 'categoria'])
  const filtro = new URLSearchParams(Object.entries(f.valores).filter(([, v]) => v)).toString()
  return (
    <>
      <PageHeader title="Documentos" subtitle="Contratos assinados, aditivos, cadastrais, certidões e demais documentos, com conferência e validade." />
      <SoComBanco>
        <div className="flex flex-wrap gap-2.5 mb-4">
          <Select label="Situação" value={f.valores.status} onChange={(v) => f.definir('status', v)}><option value="">Vigentes (sem substituídos)</option><option value="pendente">Aguardando conferência</option><option value="valido">Válidos</option><option value="rejeitado">Recusados</option><option value="substituido">Substituídos</option></Select>
          <Select label="Validade" value={f.valores.validade} onChange={(v) => f.definir('validade', v)}><option value="">Qualquer validade</option><option value="vencendo">Vencem em 30 dias</option><option value="vencidos">Vencidos</option></Select>
        </div>
        <ListaDocumentos key={filtro} filtro={filtro} vinculo={{}} podeEnviar={false} mostrarTitular titulo="Todos os documentos" />
        <p className="text-[12px] text-muted mt-3">Para enviar um documento, abra a pessoa, o fornecedor ou o contrato. Documentos financeiros e contratuais não são excluídos: a versão anterior fica como "substituída" para fins de guarda.</p>
      </SoComBanco>
    </>
  )
}

/* ---------- configuração ---------- */
export function ConfigFinanceiro() {
  const op = useOpcoesFin()
  const [c, setC] = useState<Record<string, string | boolean> | null>(null)
  const [cc, setCc] = useState({ codigo: '', nome: '', setorId: '' })
  useEffect(() => { if (op.dados && !c) setC({ exigirSegregacao: op.dados.config.exigirSegregacao, diasAlertaContrato: String(op.dados.config.diasAlertaContrato), diasAlertaPagamento: String(op.dados.config.diasAlertaPagamento), diasAlertaDocumento: String(op.dados.config.diasAlertaDocumento), diasAlertaAprovacao: String(op.dados.config.diasAlertaAprovacao), diaLimiteEnvioNf: String(op.dados.config.diaLimiteEnvioNf), prazoPagamentoPadraoDias: String(op.dados.config.prazoPagamentoPadraoDias) }) }, [op.dados, c])
  const num = (k: string, rot: string, dica?: string) => <Field label={rot} hint={dica} htmlFor={`cfg-${k}`}><input id={`cfg-${k}`} type="number" className="input" value={String(c?.[k] ?? '')} disabled={!op.dados?.capacidades.config} onChange={(e) => setC({ ...c!, [k]: e.target.value })} /></Field>
  return (
    <>
      <PageHeader title="Configurações financeiras" subtitle="Segregação de funções, prazos de alerta e centros de custo." />
      <SoComBanco>
        <Aguardar r={op}>
          {(o) => (
            <div className="grid lg:grid-cols-2 gap-6">
              <Card className="p-5">
                <h2 className="text-[15px] font-bold mb-3">Regras e alertas</h2>
                {!o.capacidades.config && <Callout tone="neutral" icon="Lock" className="mb-3">Somente a administração altera estas regras.</Callout>}
                {c && <>
                  <div className="mb-4"><Toggle checked={!!c.exigirSegregacao} disabled={!o.capacidades.config} onChange={(v) => setC({ ...c, exigirSegregacao: v })} label="Exigir segregação de funções" />
                    <p className="text-[12px] text-muted mt-1 ml-12">Quem aceita o serviço não autoriza o pagamento; quem registra o pagamento não concilia. Desligue só se a equipe for pequena demais (a decisão fica auditada).</p></div>
                  <div className="grid grid-cols-2 gap-x-3">
                    {num('diaLimiteEnvioNf', 'Dia limite para envio da NF', 'Lembrete ao prestador 5 dias antes.')}
                    {num('prazoPagamentoPadraoDias', 'Prazo padrão de pagamento (dias)', 'Após o aceite, quando o contrato não define.')}
                    {num('diasAlertaContrato', 'Alertar término de contrato (dias)')}
                    {num('diasAlertaPagamento', 'Alertar vencimento de pagamento (dias)')}
                    {num('diasAlertaDocumento', 'Alertar validade de documento (dias)')}
                    {num('diasAlertaAprovacao', 'Alertar nota parada (dias)')}
                  </div>
                  {o.capacidades.config && <Button onClick={async () => { if (await executar(() => api.put('financeiro/config', c), 'Configurações salvas.')) op.recarregar() }}>Salvar</Button>}
                </>}
              </Card>
              <Card>
                <CardHead title="Centros de custo" />
                <Tabela minWidth={420}><tbody>{o.centros.map((x) => (
                  <tr key={x.id}><td className={TD}><b>{x.codigo}</b> · {x.nome}</td><td className={TD}>{x.ativo ? <Badge tone="success">Ativo</Badge> : <Badge>Inativo</Badge>}</td>
                    <td className={TD}>{o.capacidades.cadastrar && <Button size="sm" variant="ghost" onClick={async () => { if (await executar(() => api.put(`financeiro/centros-custo/${x.id}`, { nome: x.nome, setorId: x.setorId, ativo: !x.ativo }), x.ativo ? 'Centro desativado.' : 'Centro reativado.')) op.recarregar() }}>{x.ativo ? 'Desativar' : 'Reativar'}</Button>}</td></tr>
                ))}</tbody></Tabela>
                {o.capacidades.cadastrar && <div className="p-5 border-t border-line grid sm:grid-cols-[110px_1fr_auto] gap-2 items-end">
                  <Field label="Código" className="mb-0" htmlFor="cc-cod"><input id="cc-cod" className="input" value={cc.codigo} onChange={(e) => setCc({ ...cc, codigo: e.target.value })} /></Field>
                  <Field label="Nome" className="mb-0" htmlFor="cc-nome"><input id="cc-nome" className="input" value={cc.nome} onChange={(e) => setCc({ ...cc, nome: e.target.value })} /></Field>
                  <Button onClick={async () => { if (await executar(() => api.post('financeiro/centros-custo', cc), 'Centro de custo criado.')) { setCc({ codigo: '', nome: '', setorId: '' }); op.recarregar() } }}>Adicionar</Button>
                </div>}
              </Card>
            </div>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}

/* ---------- prestador ---------- */
interface Eu {
  competencia: string; prazoEnvio: string
  contratos: { id: string; numero: string; objeto: string; fornecedorNome: string; modeloRemuneracao: string; valor: number; inicio: string; fim: string | null; status: string; renovacao: string; gestorNome: string | null; periodicidade: string }[]
  notas: NotaLinha[]
  pagamentos: (ContaLinha & { retencoes: { tipo: string; valor: number }[] })[]
  pendenciasDoMes: { contratoId: string; contratoNumero: string; valor: number }[]
  totais: { recebidoNoAno: number }
}

export function MinhasNotas() {
  const r = useApi<Eu>('financeiro/eu')
  const [envio, setEnvio] = useState<{ contratoId?: string; reenviar?: NotaLinha } | null>(null)
  const geral = useStore((s) => s.config.geral)
  return (
    <>
      <PageHeader title="Minhas notas fiscais" subtitle="Envie a nota de serviço com o arquivo e acompanhe conferência, aceite e pagamento."
        actions={<><a href="https://www.nfse.gov.br/EmissorNacional" target="_blank" rel="noopener"><Button variant="ghost" icon="ExternalLink">Emissor Nacional</Button></a>
          <Button icon="Upload" onClick={() => setEnvio({})}>Enviar nota</Button></>} />
      <SoComBanco>
        <Aguardar r={r} linhas={4}>
          {(d) => (
            <>
              {d.pendenciasDoMes.length > 0 && <Callout tone="warning" icon="CalendarClock" className="mb-5">
                <b>Nota de {competenciaBR(d.competencia)} pendente</b> — envie até {dataBR(d.prazoEnvio)}:
                <ul className="mt-1">{d.pendenciasDoMes.map((p) => <li key={p.contratoId}>Contrato {p.contratoNumero} · {dinheiro(p.valor)} <button className="underline font-semibold ml-1" onClick={() => setEnvio({ contratoId: p.contratoId })}>Enviar agora</button></li>)}</ul>
              </Callout>}
              {d.contratos.length === 0 && <Callout tone="neutral" icon="Info" className="mb-5">Nenhum contrato vinculado a você ainda. Fale com o RH.</Callout>}
              <Callout tone="neutral" icon="Info" className="mb-5">Tomador: <b>{geral.razaoSocialTomador}</b> · CNPJ {geral.cnpjTomador}. Dúvidas sobre a atividade ou retenções: {geral.emailFinanceiro}.</Callout>
              <Card className="mb-6"><CardHead title="Notas enviadas" />
                {d.notas.length === 0 ? <EmptyState icon="FileText" title="Nenhuma nota enviada" /> : <Tabela minWidth={720}>
                  <thead><tr><th className={TH}>Nota</th><th className={TH}>Competência</th><th className={TH}>Valor</th><th className={TH}>Situação</th><th className={TH}><span className="sr-only">Ações</span></th></tr></thead>
                  <tbody>{d.notas.map((n) => (
                    <tr key={n.id}><td className={TD}><b>{n.numero}{n.serie ? `/${n.serie}` : ''}</b><div className="text-[11.5px] text-muted">contrato {n.contratoNumero}</div></td><td className={`${TD} capitalize`}>{competenciaBR(n.competencia)}</td>
                      <td className={`${TD} tabular-nums`}>{dinheiro(n.valorBruto)}</td>
                      <td className={TD}><div className="flex flex-col items-start gap-1"><BadgeNota valor={n.status} />{n.contaStatus && <BadgeConta valor={n.contaStatus} />}{n.motivoDevolucao && n.status === 'devolvida' && <span className="text-[11.5px] text-danger">{n.motivoDevolucao}</span>}</div></td>
                      <td className={TD}>{n.status === 'devolvida' && <Button size="sm" onClick={() => setEnvio({ reenviar: n })}>Corrigir e reenviar</Button>}</td></tr>
                  ))}</tbody></Tabela>}
              </Card>
              <Card><CardHead title="Pagamentos" sub={`Recebido no ano: ${dinheiro(d.totais.recebidoNoAno)}. Retenções aplicadas aparecem aqui, com o tipo e o valor.`} />
                {d.pagamentos.length === 0 ? <EmptyState icon="Wallet" title="Nenhum pagamento ainda" /> : <Tabela minWidth={720}>
                  <thead><tr><th className={TH}>Referente a</th><th className={TH}>Bruto</th><th className={TH}>Retenções</th><th className={TH}>Líquido</th><th className={TH}>Situação</th></tr></thead>
                  <tbody>{d.pagamentos.map((p) => (
                    <tr key={p.id}><td className={TD}>{p.descricao}<div className="text-[11.5px] text-muted">vence {dataBR(p.vencimento)}</div></td><td className={`${TD} tabular-nums`}>{dinheiro(p.valorBruto)}</td>
                      <td className={TD}>{p.retencoes.length ? p.retencoes.map((x) => `${x.tipo} ${dinheiro(x.valor)}`).join(' · ') : '—'}</td><td className={`${TD} tabular-nums font-semibold`}>{dinheiro(p.valorLiquido)}</td>
                      <td className={TD}><BadgeConta valor={p.status} />{p.pagamento && <div className="text-[11.5px] text-muted">pago em {dataBR(p.pagamento.data)}</div>}</td></tr>
                  ))}</tbody></Tabela>}
              </Card>
              <ModalEnviarNota aberto={!!envio} contratos={d.contratos.filter((k) => k.status !== 'rascunho')} inicial={envio} fechar={() => setEnvio(null)} pronto={() => { setEnvio(null); r.recarregar() }} />
            </>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}

function ModalEnviarNota({ aberto, contratos, inicial, fechar, pronto }: { aberto: boolean; contratos: Eu['contratos']; inicial: { contratoId?: string; reenviar?: NotaLinha } | null; fechar: () => void; pronto: () => void }) {
  const mes = new Date().toISOString().slice(0, 7)
  const base = () => {
    const n = inicial?.reenviar
    const k = contratos.find((x) => x.id === (inicial?.contratoId ?? n?.contratoId)) ?? contratos.find((x) => x.status === 'vigente')
    return { contratoId: k?.id ?? '', numero: n?.numero ?? '', serie: n?.serie ?? '', dataEmissao: n?.dataEmissao ?? new Date().toISOString().slice(0, 10), competencia: n?.competencia ?? mes, valorBruto: n ? String(n.valorBruto) : k && k.modeloRemuneracao === 'mensal_fixo' ? String(k.valor) : '', descricao: n?.descricao ?? '', vencimento: n?.vencimento ?? '' }
  }
  const [f, setF] = useState(base)
  const [arq, setArq] = useState<{ nome: string; base64: string } | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const [aberturaAnterior, setAberturaAnterior] = useState(false)
  if (aberto !== aberturaAnterior) { setAberturaAnterior(aberto); if (aberto) { setF(base()); setArq(null); setErros({}) } }
  const k = contratos.find((x) => x.id === f.contratoId)
  const salvar = async () => {
    setEnviando(true)
    try {
      const corpo = { ...f, valorBruto: f.valorBruto.replace(',', '.'), arquivo: arq }
      if (inicial?.reenviar) await api.post(`financeiro/notas/${inicial.reenviar.id}/reenviar`, corpo)
      else await api.post('financeiro/notas', corpo)
      toast(inicial?.reenviar ? 'Nota corrigida e reenviada para conferência.' : 'Nota enviada. Você será avisado(a) da conferência e do pagamento.')
      pronto()
    } catch (e) { setErros((e as ErroApi).campos ?? {}); toast((e as ErroApi).message, 'danger') } finally { setEnviando(false) }
  }
  const campo = (c: keyof ReturnType<typeof base>, rot: string, extra: Record<string, unknown> = {}, obrig = true) => (
    <Field label={rot} required={obrig} erro={erros[c] ?? erros[rot.toLowerCase()]} htmlFor={`nf-${c}`}><input id={`nf-${c}`} className="input" value={f[c]} onChange={(e) => setF({ ...f, [c]: e.target.value })} {...extra} /></Field>
  )
  return (
    <Modal open={aberto} onClose={fechar} title={inicial?.reenviar ? `Corrigir nota ${inicial.reenviar.numero}` : 'Enviar nota fiscal'} subtitle="Os dados precisam ser iguais aos da nota emitida. O arquivo é verificado no servidor."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button disabled={!arq || !f.contratoId || enviando} onClick={salvar}>{enviando ? 'Enviando…' : 'Enviar'}</Button></>}>
      {inicial?.reenviar?.motivoDevolucao && <Callout tone="danger" icon="Undo2" className="mb-3">Motivo da devolução: {inicial.reenviar.motivoDevolucao}</Callout>}
      {!inicial?.reenviar && <Field label="Contrato" required><Dropdown aria-label="Contrato" className="w-full" value={f.contratoId} onChange={(e) => {
        const kk = contratos.find((x) => x.id === e.target.value)
        setF({ ...f, contratoId: e.target.value, valorBruto: kk?.modeloRemuneracao === 'mensal_fixo' ? String(kk.valor) : f.valorBruto })
      }}>{contratos.map((x) => <option key={x.id} value={x.id}>{x.numero} · {x.objeto}</option>)}</Dropdown></Field>}
      {k && <p className="text-[12px] text-muted -mt-2 mb-3">{ROTULO_MODELO[k.modeloRemuneracao]}: {dinheiro(k.valor)}. Valor diferente do contrato vai para análise com justificativa.</p>}
      <div className="grid grid-cols-2 gap-x-3">
        {campo('numero', 'Número da nota')}{campo('serie', 'Série', {}, false)}
        {campo('dataEmissao', 'Data de emissão', { type: 'date' })}
        <Field label="Competência (mês do serviço)" required htmlFor="nf-comp" erro={erros['competência']}><input id="nf-comp" type="month" className="input" value={f.competencia} onChange={(e) => setF({ ...f, competencia: e.target.value })} /></Field>
        {campo('valorBruto', 'Valor bruto', { inputMode: 'decimal' })}
        {campo('vencimento', 'Vencimento (se constar na nota)', { type: 'date' }, false)}
      </div>
      <Field label="Descrição do serviço" htmlFor="nf-desc"><textarea id="nf-desc" className="input h-16 py-2.5" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      <CampoArquivo id="nf-arq" rotulo="Arquivo da nota (PDF)" obrigatorio valor={arq} onChange={setArq} />
      <p className="text-[11.5px] text-muted">{AVISO_INTEGRACOES}</p>
    </Modal>
  )
}

export function MeusContratos() {
  const r = useApi<Eu>('financeiro/eu')
  return (
    <>
      <PageHeader title="Meus contratos" subtitle="Contratos de prestação de serviços em que você é a parte contratada." />
      <SoComBanco>
        <Aguardar r={r} vazio={(d) => d.contratos.length ? null : <Card><EmptyState icon="FileSignature" title="Nenhum contrato vinculado" desc="Se você presta serviços, fale com o RH para vincular o contrato." /></Card>}>
          {(d) => <div className="grid md:grid-cols-2 gap-4">{d.contratos.map((k) => (
            <Card key={k.id} className="p-5">
              <div className="flex items-start justify-between gap-2"><Link to={`/financeiro/contratos/${k.id}`} className="text-[15px] font-bold hover:text-brand">{k.numero}</Link><BadgeContrato valor={k.status} /></div>
              <p className="text-[13px] text-ink-2 mt-1">{k.objeto}</p>
              <dl className="grid grid-cols-2 gap-3 mt-3 text-[13px]">
                <div><dt className="text-muted text-[11.5px]">{ROTULO_MODELO[k.modeloRemuneracao]}</dt><dd className="font-semibold">{dinheiro(k.valor)}</dd></div>
                <div><dt className="text-muted text-[11.5px]">Vigência</dt><dd>{dataBR(k.inicio)} – {k.fim ? dataBR(k.fim) : 'indeterminado'}</dd></div>
                <div><dt className="text-muted text-[11.5px]">Contratada</dt><dd>{k.fornecedorNome}</dd></div>
                <div><dt className="text-muted text-[11.5px]">Gestor(a)</dt><dd>{k.gestorNome ?? '—'}</dd></div>
              </dl>
            </Card>
          ))}</div>}
        </Aguardar>
      </SoComBanco>
    </>
  )
}

export function MeusDocumentos() {
  const eu = useStore((s) => s.sessaoId) ?? ''
  return (
    <>
      <PageHeader title="Meus documentos" subtitle="Envie e acompanhe seus documentos. Só você e a equipe de conferência acessam os arquivos." />
      <SoComBanco><ListaDocumentos filtro={`pessoa=${eu}`} vinculo={{ pessoaId: eu }} podeEnviar titulo="Documentos" /></SoComBanco>
    </>
  )
}

/** Reembolso aprovado → conta a pagar (usado na tela de reembolsos do RH). */
export function BotaoReembolsoParaContas({ reembolsoId, pronto }: { reembolsoId: string; pronto?: () => void }) {
  const [aberto, setAberto] = useState(false)
  const [venc, setVenc] = useState(new Date(Date.now() + 5 * 86400000).toISOString().slice(0, 10))
  return (
    <>
      <Button size="sm" variant="soft" icon="Wallet" onClick={() => setAberto(true)}>Enviar a contas a pagar</Button>
      <Modal open={aberto} onClose={() => setAberto(false)} title="Enviar reembolso para contas a pagar" subtitle="O pagamento passa por autorização e registro com comprovante. O pedido fica “em pagamento”."
        footer={<><Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button><Button onClick={async () => {
          try { await api.post('financeiro/contas/de-reembolso', { reembolsoId, vencimento: venc }); toast('Reembolso enviado para contas a pagar.'); setAberto(false); await recarregarEstado(); pronto?.() }
          catch (e) { toast((e as ErroApi).message, 'danger') }
        }}>Enviar</Button></>}>
        <Field label="Vencimento" htmlFor="re-venc"><input id="re-venc" type="date" className="input" value={venc} onChange={(e) => setVenc(e.target.value)} /></Field>
      </Modal>
    </>
  )
}
