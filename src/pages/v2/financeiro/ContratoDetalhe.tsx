import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Field, PageHeader, Tabs, TD, TH, Tabela } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, ErroApi, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { BadgeContrato, BadgeNota, CampoArquivo, Info, competenciaBR, dinheiro, useMotivo } from '@/components/v2/financeiro/comum'
import { ListaDocumentos } from '@/components/v2/financeiro/Documentos'
import { ROTULO_ENCERRAMENTO, ROTULO_MODELO, ROTULO_PERIODICIDADE, ROTULO_RENOVACAO, TIPOS_ENCERRAMENTO } from '@/domain/v2/financeiro'
import { dataBR, dataHoraBR } from '@/lib/fmt'
import { BadgePrazo, type ContratoLinha } from './Contratos'

interface Detalhe {
  contrato: ContratoLinha
  papel: { prestador: boolean; gestor: boolean; financeiro: boolean; cadastrar: boolean }
  aditivos: { id: string; numero: number; tipo: string; descricao: string; vigenciaInicio: string; valorAnterior: number | null; valorNovo: number | null; fimAnterior: string | null; fimNovo: string | null; documentoId: string | null; criadoPor: string | null; criadoEm: string }[]
  notas: { id: string; numero: string; serie: string; competencia: string; valorBruto: number; status: string; enviadaEm: string }[]
  historico: { id: number; em: string; autor: string | null; acao: string; detalhes: Record<string, unknown> }[]
  pendencias: { notasEmAndamento: number; contasAbertas: number; valorAberto: number; documentosPendentes: number } | null
}
type Arq = { nome: string; base64: string } | null

const ROTULO_ACAO: Record<string, string> = {
  criado: 'Contrato criado', alterado: 'Dados alterados', ativado: 'Contrato ativado', reativado: 'Contrato reativado', suspenso: 'Contrato suspenso',
  aditivo: 'Aditivo registrado', encerrado: 'Contrato encerrado', renovado_automaticamente: 'Renovação automática',
}

export default function ContratoDetalhe() {
  const { id = '' } = useParams()
  const r = useApi<Detalhe>(`financeiro/contratos/${id}`)
  const [aba, setAba] = useState('dados')
  const [aditivo, setAditivo] = useState(false)
  const [encerrar, setEncerrar] = useState(false)
  const motivo = useMotivo()

  const acao = async (rota: string, msg: string, corpo?: unknown) => { if (await executar(() => api.post(`financeiro/contratos/${id}/${rota}`, corpo), msg)) r.recarregar() }

  return (
    <SoComBanco>
      <Aguardar r={r} linhas={6}>
        {(d) => {
          const k = d.contrato
          const pode = d.papel.cadastrar && k.status !== 'encerrado'
          return (
            <>
              <PageHeader title={`Contrato ${k.numero}`} subtitle={`${k.fornecedorNome}${k.prestadorNome ? ` · ${k.prestadorNome}` : ''}`}
                eyebrow={<Link to="/financeiro/contratos" className="hover:text-brand">← Contratos</Link>}
                actions={pode && <>
                  <Link to={`/financeiro/contratos/${id}/editar`}><Button variant="ghost" icon="Pencil">Editar</Button></Link>
                  {(k.status === 'rascunho' || k.status === 'suspenso') && <Button icon="CheckCircle2" onClick={() => acao('ativar', k.status === 'suspenso' ? 'Contrato reativado.' : 'Contrato ativado.')}>{k.status === 'suspenso' ? 'Reativar' : 'Ativar'}</Button>}
                  {k.status === 'vigente' && <Button variant="ghost" icon="PauseCircle" onClick={async () => { const m = await motivo.pedir('Suspender contrato', 'Suspensão temporária dos serviços. Notas já enviadas seguem no fluxo.', 'Suspender', false); if (m) acao('suspender', 'Contrato suspenso.', { motivo: m }) }}>Suspender</Button>}
                  {k.status !== 'rascunho' && <Button variant="ghost" icon="FilePlus2" onClick={() => setAditivo(true)}>Aditivo</Button>}
                  <Button variant="danger" icon="FileX2" onClick={() => setEncerrar(true)}>Encerrar</Button>
                </>} />
              <div className="flex flex-wrap items-center gap-2 mb-4"><BadgeContrato valor={k.status} /><BadgePrazo s={k.situacaoPrazo} />
                {d.pendencias && d.pendencias.notasEmAndamento + d.pendencias.contasAbertas > 0 && <Badge tone="warning">{d.pendencias.notasEmAndamento} nota(s) em análise · {d.pendencias.contasAbertas} pagamento(s) em aberto</Badge>}
                {k.status === 'rascunho' && !k.dataAssinatura && <Badge tone="warning">Informe a data de assinatura para ativar</Badge>}
              </div>
              <Tabs tabs={[{ key: 'dados', label: 'Dados' }, { key: 'aditivos', label: `Aditivos (${d.aditivos.length})` }, { key: 'documentos', label: 'Documentos' }, { key: 'notas', label: `Notas (${d.notas.length})` }, ...(d.historico.length ? [{ key: 'historico', label: 'Histórico' }] : [])]} active={aba} onChange={setAba} />

              {aba === 'dados' && (
                <Card className="p-5 sm:p-6">
                  <dl className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    <Info rotulo="Objeto">{k.objeto}</Info>
                    <Info rotulo="Modelo de remuneração">{ROTULO_MODELO[k.modeloRemuneracao]} · {dinheiro(k.valor)}</Info>
                    <Info rotulo="Faturamento">{ROTULO_PERIODICIDADE[k.periodicidadeFaturamento]}{k.prazoPagamentoDias != null ? ` · pagamento em ${k.prazoPagamentoDias} dias após o aceite` : ''}</Info>
                    <Info rotulo="Vigência">{dataBR(k.inicio)} – {k.fim ? dataBR(k.fim) : 'prazo indeterminado'}</Info>
                    <Info rotulo="Assinatura">{k.dataAssinatura ? dataBR(k.dataAssinatura) : 'Não informada'}</Info>
                    <Info rotulo="Renovação">{ROTULO_RENOVACAO[k.renovacao]}{k.renovacao === 'automatica' ? ` (${k.renovacaoMeses} meses)` : ''} · aviso {k.avisoRenovacaoDias} dias antes</Info>
                    <Info rotulo="Gestor(a) do contrato">{k.gestorNome ?? 'Não definido (aceite pelo RH/financeiro)'}</Info>
                    <Info rotulo="Área">{k.setorNome}</Info>
                    <Info rotulo="Centro de custo">{k.centroCustoNome}</Info>
                    <Info rotulo="Fornecedor">{d.papel.financeiro ? <Link className="text-brand hover:underline" to={`/financeiro/fornecedores/${k.fornecedorId}`}>{k.fornecedorNome}</Link> : k.fornecedorNome}{k.fornecedorDocumento ? ` · ${k.fornecedorDocumento}` : ''}</Info>
                    {k.status === 'encerrado' && <Info rotulo="Encerramento">{dataBR(k.encerradoEm)} · {ROTULO_ENCERRAMENTO[k.encerramentoTipo ?? ''] ?? k.encerramentoTipo} — {k.encerramentoMotivo}</Info>}
                  </dl>
                  {k.escopo && <div className="mt-5"><Info rotulo="Escopo"><p className="whitespace-pre-line">{k.escopo}</p></Info></div>}
                  {(k.obrigacoesContratada || k.obrigacoesContratante) && <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mt-5">
                    <Info rotulo="Obrigações da contratada"><p className="whitespace-pre-line">{k.obrigacoesContratada}</p></Info>
                    <Info rotulo="Obrigações da contratante"><p className="whitespace-pre-line">{k.obrigacoesContratante}</p></Info>
                  </div>}
                  {k.observacoes && d.papel.financeiro && <div className="mt-5"><Info rotulo="Observações administrativas"><p className="whitespace-pre-line">{k.observacoes}</p></Info></div>}
                  <p className="text-[11.5px] text-muted mt-6">Contrato comercial de prestação de serviços. O encerramento é comercial (fim do contrato), não uma rescisão trabalhista.</p>
                </Card>
              )}

              {aba === 'aditivos' && (
                <Card>
                  {d.aditivos.length === 0 ? <EmptyState icon="FilePlus2" title="Nenhum aditivo" desc="Mudanças de valor, prazo ou escopo de contrato em vigor ficam registradas aqui." /> : (
                    <Tabela minWidth={720}>
                      <thead><tr><th className={TH}>Nº</th><th className={TH}>Tipo</th><th className={TH}>Mudança</th><th className={TH}>Vigência</th><th className={TH}>Registrado por</th></tr></thead>
                      <tbody>{d.aditivos.map((a) => (
                        <tr key={a.id}><td className={TD}>{a.numero}</td><td className={TD}>{a.tipo.replace('_', ' ')}</td>
                          <td className={TD}><div>{a.descricao}</div><div className="text-[11.5px] text-muted">{a.valorNovo != null && `Valor ${dinheiro(a.valorAnterior)} → ${dinheiro(a.valorNovo)}. `}{a.fimNovo && `Término ${dataBR(a.fimAnterior) || 'indeterminado'} → ${dataBR(a.fimNovo)}.`}</div></td>
                          <td className={TD}>{dataBR(a.vigenciaInicio)}</td><td className={TD}>{a.criadoPor ?? '—'}<div className="text-[11.5px] text-muted">{dataHoraBR(a.criadoEm)}</div></td></tr>
                      ))}</tbody>
                    </Tabela>
                  )}
                </Card>
              )}

              {aba === 'documentos' && <ListaDocumentos filtro={`contrato=${id}`} vinculo={{ contratoId: id, fornecedorId: k.fornecedorId }} podeEnviar={d.papel.cadastrar || d.papel.prestador} titulo="Documentos do contrato" />}

              {aba === 'notas' && (
                <Card>
                  {d.notas.length === 0 ? <EmptyState icon="FileText" title="Nenhuma nota fiscal neste contrato" /> : (
                    <Tabela minWidth={620}>
                      <thead><tr><th className={TH}>Nota</th><th className={TH}>Competência</th><th className={TH}>Valor</th><th className={TH}>Situação</th></tr></thead>
                      <tbody>{d.notas.map((n) => (
                        <tr key={n.id}><td className={TD}><Link className="font-semibold hover:text-brand" to={`/financeiro/notas?nota=${n.id}`}>{n.numero}{n.serie ? `/${n.serie}` : ''}</Link></td>
                          <td className={`${TD} capitalize`}>{competenciaBR(n.competencia)}</td><td className={`${TD} tabular-nums`}>{dinheiro(n.valorBruto)}</td><td className={TD}><BadgeNota valor={n.status} /></td></tr>
                      ))}</tbody>
                    </Tabela>
                  )}
                </Card>
              )}

              {aba === 'historico' && (
                <Card><CardHead title="Histórico do contrato" sub="Trilha de auditoria: quem fez o quê e quando." />
                  <ul className="divide-y divide-line">{d.historico.map((h) => (
                    <li key={h.id} className="px-5 py-3 text-[13px]"><b>{ROTULO_ACAO[h.acao] ?? h.acao}</b> · {h.autor ?? 'Sistema'} · <span className="text-muted">{dataHoraBR(h.em)}</span>
                      {h.detalhes && Object.keys(h.detalhes).length > 0 && <div className="text-[11.5px] text-muted mt-0.5 break-all">{Object.entries(h.detalhes).filter(([, v]) => v !== null && v !== undefined && !(Array.isArray(v) && !v.length)).map(([c, v]) => `${c}: ${typeof v === 'object' ? JSON.stringify(v) : String(v)}`).join(' · ')}</div>}</li>
                  ))}</ul>
                </Card>
              )}

              <ModalAditivo aberto={aditivo} fechar={() => setAditivo(false)} contratoId={id} pronto={() => { setAditivo(false); r.recarregar() }} />
              <ModalEncerrar aberto={encerrar} fechar={() => setEncerrar(false)} contrato={k} pronto={() => { setEncerrar(false); r.recarregar() }} />
              {motivo.modal}
            </>
          )
        }}
      </Aguardar>
    </SoComBanco>
  )
}

function ModalAditivo({ aberto, fechar, contratoId, pronto }: { aberto: boolean; fechar: () => void; contratoId: string; pronto: () => void }) {
  const [f, setF] = useState({ tipo: 'valor', descricao: '', vigenciaInicio: '', valorNovo: '', fimNovo: '' })
  const [doc, setDoc] = useState<Arq>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const salvar = async () => {
    try {
      await api.post(`financeiro/contratos/${contratoId}/aditivos`, { ...f, valorNovo: f.valorNovo.replace(',', '.'), documento: doc ?? undefined })
      toast('Aditivo registrado.'); setF({ tipo: 'valor', descricao: '', vigenciaInicio: '', valorNovo: '', fimNovo: '' }); setDoc(null); pronto()
    } catch (e) { setErros((e as ErroApi).campos ?? {}); toast((e as ErroApi).message, 'danger') }
  }
  const valor = f.tipo === 'valor' || f.tipo === 'valor_prazo', prazo = f.tipo === 'prazo' || f.tipo === 'valor_prazo'
  return (
    <Modal open={aberto} onClose={fechar} title="Registrar aditivo" subtitle="O contrato é atualizado e o valor/prazo anterior fica no histórico."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Registrar</Button></>}>
      <Field label="Tipo"><Dropdown aria-label="Tipo de aditivo" className="w-full" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        <option value="valor">Valor</option><option value="prazo">Prazo</option><option value="valor_prazo">Valor e prazo</option><option value="escopo">Escopo</option><option value="outro">Outro</option></Dropdown></Field>
      <Field label="Descrição" required erro={erros.descricao} htmlFor="ad-desc"><textarea id="ad-desc" className="input h-20 py-2.5" value={f.descricao} onChange={(e) => setF({ ...f, descricao: e.target.value })} /></Field>
      <Field label="Vale a partir de" required erro={erros.vigenciaInicio} htmlFor="ad-vig"><input id="ad-vig" type="date" className="input" value={f.vigenciaInicio} onChange={(e) => setF({ ...f, vigenciaInicio: e.target.value })} /></Field>
      {valor && <Field label="Novo valor" required erro={erros['novo valor'] ?? erros.valorNovo} htmlFor="ad-val"><input id="ad-val" className="input" inputMode="decimal" value={f.valorNovo} onChange={(e) => setF({ ...f, valorNovo: e.target.value })} /></Field>}
      {prazo && <Field label="Novo término" required erro={erros['novo término'] ?? erros.fimNovo} htmlFor="ad-fim"><input id="ad-fim" type="date" className="input" value={f.fimNovo} onChange={(e) => setF({ ...f, fimNovo: e.target.value })} /></Field>}
      <CampoArquivo id="ad-doc" rotulo="Aditivo assinado (opcional)" valor={doc} onChange={setDoc} />
    </Modal>
  )
}

function ModalEncerrar({ aberto, fechar, contrato, pronto }: { aberto: boolean; fechar: () => void; contrato: ContratoLinha; pronto: () => void }) {
  const [f, setF] = useState({ data: new Date().toISOString().slice(0, 10), tipo: 'termino_prazo', motivo: '' })
  const [doc, setDoc] = useState<Arq>(null)
  const [pend, setPend] = useState<Detalhe['pendencias']>(null)
  const enviar = async (confirmar = false) => {
    try {
      await api.post(`financeiro/contratos/${contrato.id}/encerrar`, { ...f, documento: doc ?? undefined, confirmarPendencias: confirmar })
      toast('Contrato encerrado. O histórico contratual e financeiro foi mantido.'); setPend(null); pronto()
    } catch (e) {
      const x = e as ErroApi
      if (x.status === 409 && /Confirme/.test(x.message)) {
        const p = await api.get<NonNullable<Detalhe['pendencias']>>(`financeiro/contratos/${contrato.id}/pendencias`).catch(() => null)
        setPend(p)
      } else toast(x.message, 'danger')
    }
  }
  return (
    <Modal open={aberto} onClose={fechar} title={`Encerrar contrato ${contrato.numero}`} subtitle="Encerramento comercial (fim do contrato de prestação de serviços). Nada é apagado."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button>{pend ? <Button variant="danger" onClick={() => enviar(true)}>Encerrar mesmo assim</Button> : <Button variant="danger" onClick={() => enviar(false)}>Encerrar</Button>}</>}>
      {pend && <Callout tone="warning" icon="AlertTriangle" className="mb-4">Há pendências: {pend.notasEmAndamento} nota(s) em análise, {pend.contasAbertas} pagamento(s) em aberto ({dinheiro(pend.valorAberto)}) e {pend.documentosPendentes} documento(s) a conferir. Elas continuam no fluxo até a conclusão.</Callout>}
      <Field label="Data do encerramento" required htmlFor="enc-data"><input id="enc-data" type="date" className="input" value={f.data} onChange={(e) => setF({ ...f, data: e.target.value })} /></Field>
      <Field label="Tipo"><Dropdown aria-label="Tipo de encerramento" className="w-full" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>
        {TIPOS_ENCERRAMENTO.map((t) => <option key={t} value={t}>{ROTULO_ENCERRAMENTO[t]}</option>)}</Dropdown></Field>
      <Field label="Motivo" required htmlFor="enc-mot"><textarea id="enc-mot" className="input h-20 py-2.5" value={f.motivo} onChange={(e) => setF({ ...f, motivo: e.target.value })} /></Field>
      <CampoArquivo id="enc-doc" rotulo="Termo de encerramento/distrato (opcional)" valor={doc} onChange={setDoc} />
    </Modal>
  )
}
