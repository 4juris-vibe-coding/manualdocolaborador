import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Badge, Button, Callout, Card, CardHead, EmptyState, Field, PageHeader, SearchBox, Select, TD, TH, Tabela } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Modal } from '@/components/Modal'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { Paginacao } from '@/components/v2/Paginacao'
import { api, ErroApi, executar, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { BadgeContrato, Info, dinheiro, useFiltros, useOpcoesFin } from '@/components/v2/financeiro/comum'
import { ListaDocumentos } from '@/components/v2/financeiro/Documentos'
import { ROTULO_REGIME, ROTULO_TIPO_FORNECEDOR, TIPOS_RETENCAO } from '@/domain/v2/financeiro'
import { dataBR } from '@/lib/fmt'
import type { ContratoLinha } from './Contratos'

interface Fornecedor {
  id: string; tipo: string; razaoSocial: string; nomeFantasia: string | null; documento: string | null; inscricaoMunicipal: string | null; regimeTributario: string
  municipio: string | null; uf: string | null; email: string | null; telefone: string | null; representanteId: string | null; representanteNome: string | null
  status: string; observacoes: string | null; versao: number; contratosVigentes?: number; semDadosPagamento?: boolean
  pagamento?: { origem: string; banco: string | null; agencia: string | null; conta: string | null; pixTipo: string | null; pixChave: string | null }
}
const docFmt = (d: string | null) => !d ? '—' : d.length === 14 ? d.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5') : d.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4')
const BadgeSituacao = ({ s }: { s: string }) => <Badge tone={s === 'ativo' ? 'success' : s === 'suspenso' ? 'warning' : 'neutral'} dot>{s === 'ativo' ? 'Ativo' : s === 'suspenso' ? 'Suspenso' : 'Inativo'}</Badge>

export default function Fornecedores() {
  const f = useFiltros(['q', 'status', 'pagina'])
  const op = useOpcoesFin()
  const r = useApi<{ itens: Fornecedor[]; total: number; pagina: number; por: number }>(`financeiro/fornecedores${f.consulta}`)
  const [novo, setNovo] = useState(false)
  const nav = useNavigate()
  return (
    <>
      <PageHeader title="Fornecedores" subtitle="Empresas (PJ/MEI) e autônomos contratados. A pessoa que usa o portal é a representante."
        actions={op.dados?.capacidades.cadastrar && <Button icon="Plus" onClick={() => setNovo(true)}>Novo fornecedor</Button>} />
      <SoComBanco>
        <div className="flex flex-wrap gap-2.5 mb-4">
          <SearchBox value={f.valores.q} onChange={(v) => f.definir('q', v)} placeholder="Razão social, nome fantasia ou documento" />
          <Select label="Situação" value={f.valores.status} onChange={(v) => f.definir('status', v)}><option value="">Todas</option><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></Select>
        </div>
        <Aguardar r={r} vazio={(d) => d.total ? null : <Card><EmptyState icon="Building2" title="Nenhum fornecedor" /></Card>}>
          {(d) => (
            <Card className="overflow-hidden">
              <Tabela minWidth={820} cartoes>
                <thead><tr><th className={TH}>Fornecedor</th><th className={TH}>Documento</th><th className={TH}>Regime</th><th className={TH}>Representante</th><th className={TH}>Contratos vigentes</th><th className={TH}>Situação</th></tr></thead>
                <tbody>{d.itens.map((x) => (
                  <tr key={x.id} className="hover:bg-surface-2">
                    <td className={TD}><Link to={`/financeiro/fornecedores/${x.id}`} className="font-semibold hover:text-brand">{x.razaoSocial}</Link><div className="text-[11.5px] text-muted">{ROTULO_TIPO_FORNECEDOR[x.tipo]}{x.nomeFantasia ? ` · ${x.nomeFantasia}` : ''}</div></td>
                    <td className={`${TD} tabular-nums`} data-rotulo="Documento">{docFmt(x.documento)}{!x.documento && <div><Badge tone="warning">Sem documento</Badge></div>}</td>
                    <td className={TD} data-rotulo="Regime">{ROTULO_REGIME[x.regimeTributario]}</td>
                    <td className={TD} data-rotulo="Representante">{x.representanteNome ?? '—'}</td>
                    <td className={`${TD} tabular-nums`} data-rotulo="Contratos vigentes">{x.contratosVigentes}</td>
                    <td className={TD} data-rotulo="Situação"><div className="flex flex-col items-start gap-1"><BadgeSituacao s={x.status} />{x.semDadosPagamento && <Badge tone="warning">Sem dados de pagamento</Badge>}</div></td>
                  </tr>
                ))}</tbody>
              </Tabela>
              <Paginacao pagina={d.pagina} por={d.por} total={d.total} onPagina={(p) => f.definir('pagina', String(p))} />
            </Card>
          )}
        </Aguardar>
        <FormFornecedor aberto={novo} fechar={() => setNovo(false)} pronto={(id) => { setNovo(false); nav(`/financeiro/fornecedores/${id}`) }} />
      </SoComBanco>
    </>
  )
}

export function FornecedorDetalhe() {
  const { id = '' } = useParams()
  const op = useOpcoesFin()
  const r = useApi<{ fornecedor: Fornecedor; contratos: ContratoLinha[]; regrasRetencao: { id: string; tipo: string; aliquota: number; fundamento: string; vigenciaInicio: string; vigenciaFim: string | null; ativo: boolean; criadoPor: string | null }[] }>(`financeiro/fornecedores/${id}`)
  const [editar, setEditar] = useState(false)
  const [regra, setRegra] = useState(false)
  const cap = op.dados?.capacidades
  return (
    <SoComBanco>
      <Aguardar r={r} linhas={5}>
        {(d) => {
          const x = d.fornecedor
          return (
            <>
              <PageHeader title={x.razaoSocial} subtitle={`${ROTULO_TIPO_FORNECEDOR[x.tipo]} · ${docFmt(x.documento)}`} eyebrow={<Link to="/financeiro/fornecedores" className="hover:text-brand">← Fornecedores</Link>}
                actions={cap?.cadastrar && <><Button variant="ghost" icon="Pencil" onClick={() => setEditar(true)}>Editar</Button><Link to={`/financeiro/contratos/novo?fornecedor=${x.id}`}><Button icon="FilePlus2">Novo contrato</Button></Link></>} />
              <div className="grid grid-cols-1 lg:grid-cols-[1.4fr_1fr] gap-6 mb-6">
                <Card className="p-5"><dl className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <Info rotulo="Situação"><BadgeSituacao s={x.status} /></Info>
                  <Info rotulo="Regime tributário (informado)">{ROTULO_REGIME[x.regimeTributario]}</Info>
                  <Info rotulo="Nome fantasia">{x.nomeFantasia}</Info><Info rotulo="Inscrição municipal">{x.inscricaoMunicipal}</Info>
                  <Info rotulo="Município">{x.municipio ? `${x.municipio}/${x.uf ?? ''}` : null}</Info><Info rotulo="Contato">{[x.email, x.telefone].filter(Boolean).join(' · ') || null}</Info>
                  <Info rotulo="Pessoa representante">{x.representanteNome}</Info>
                  {x.observacoes && <Info rotulo="Observações" className="sm:col-span-2">{x.observacoes}</Info>}
                </dl></Card>
                {x.pagamento && <Card className="p-5">
                  <h3 className="text-[14px] font-bold mb-3">Dados para pagamento</h3>
                  {x.pagamento.origem === 'ausente' ? <Callout tone="warning" icon="AlertTriangle">Sem dados de pagamento. Cadastre aqui ou peça à pessoa representante para completar o perfil.</Callout> : (
                    <dl className="grid gap-3">
                      <Info rotulo="Origem">{x.pagamento.origem === 'fornecedor' ? 'Cadastro da empresa' : 'Perfil da pessoa representante'}</Info>
                      <Info rotulo="PIX">{x.pagamento.pixChave ? `${x.pagamento.pixTipo ?? ''} ${x.pagamento.pixChave}` : null}</Info>
                      <Info rotulo="Conta">{x.pagamento.conta ? `Banco ${x.pagamento.banco ?? ''} · ag. ${x.pagamento.agencia ?? ''} · ${x.pagamento.conta}` : null}</Info>
                    </dl>)}
                </Card>}
              </div>
              <Card className="mb-6"><CardHead title="Contratos" />
                {d.contratos.length === 0 ? <EmptyState icon="FileSignature" title="Nenhum contrato" /> : <Tabela minWidth={640}><tbody>{d.contratos.map((k) => (
                  <tr key={k.id}><td className={TD}><Link className="font-semibold hover:text-brand" to={`/financeiro/contratos/${k.id}`}>{k.numero}</Link><div className="text-[11.5px] text-muted">{k.objeto}</div></td>
                    <td className={`${TD} tabular-nums`}>{dinheiro(k.valor)}</td><td className={TD}>{dataBR(k.inicio)} – {k.fim ? dataBR(k.fim) : 'indeterminado'}</td><td className={TD}><BadgeContrato valor={k.status} /></td></tr>
                ))}</tbody></Tabela>}
              </Card>
              {cap?.ver && <Card className="mb-6">
                <CardHead title="Regras de retenção" sub="Cadastradas por pessoa autorizada, com fundamento e vigência. Aplicadas no aceite da nota e sempre revisadas antes da autorização. Não substituem orientação contábil."
                  action={cap.pagar && <Button size="sm" icon="Plus" onClick={() => setRegra(true)}>Nova regra</Button>} />
                {d.regrasRetencao.length === 0 ? <p className="px-5 pb-5 text-[13px] text-muted">Nenhuma regra. Sem regra, nenhuma retenção é aplicada automaticamente.</p> : <Tabela minWidth={640}><tbody>{d.regrasRetencao.map((g) => (
                  <tr key={g.id}><td className={TD}><b>{g.tipo}</b> · {g.aliquota.toLocaleString('pt-BR', { maximumFractionDigits: 4 })}%</td><td className={TD}>{g.fundamento}</td>
                    <td className={TD}>{dataBR(g.vigenciaInicio)} – {g.vigenciaFim ? dataBR(g.vigenciaFim) : 'sem fim'}</td>
                    <td className={TD}>{g.ativo ? (cap.pagar ? <Button size="sm" variant="ghost" onClick={async () => { if (await executar(() => api.post(`financeiro/regras-retencao/${g.id}/desativar`), 'Regra desativada.')) r.recarregar() }}>Desativar</Button> : <Badge tone="success">Ativa</Badge>) : <Badge>Desativada</Badge>}</td></tr>
                ))}</tbody></Tabela>}
              </Card>}
              <ListaDocumentos filtro={`fornecedor=${x.id}`} vinculo={{ fornecedorId: x.id }} podeEnviar={!!cap?.cadastrar} titulo="Documentos do fornecedor" />
              <FormFornecedor aberto={editar} atual={x} fechar={() => setEditar(false)} pronto={() => { setEditar(false); r.recarregar() }} />
              <ModalRegra aberto={regra} fornecedorId={x.id} fechar={() => setRegra(false)} pronto={() => { setRegra(false); r.recarregar() }} />
            </>
          )
        }}
      </Aguardar>
    </SoComBanco>
  )
}

function FormFornecedor({ aberto, fechar, pronto, atual }: { aberto: boolean; fechar: () => void; pronto: (id: string) => void; atual?: Fornecedor }) {
  const op = useOpcoesFin()
  const ini = () => ({
    tipo: atual?.tipo ?? 'pj', razaoSocial: atual?.razaoSocial ?? '', nomeFantasia: atual?.nomeFantasia ?? '', documento: atual?.documento ?? '', inscricaoMunicipal: atual?.inscricaoMunicipal ?? '',
    regimeTributario: atual?.regimeTributario ?? 'nao_informado', municipio: atual?.municipio ?? '', uf: atual?.uf ?? '', email: atual?.email ?? '', telefone: atual?.telefone ?? '',
    representanteId: atual?.representanteId ?? '', status: atual?.status ?? 'ativo', observacoes: atual?.observacoes ?? '',
    banco: atual?.pagamento?.origem === 'fornecedor' ? atual.pagamento.banco ?? '' : '', agencia: atual?.pagamento?.origem === 'fornecedor' ? atual.pagamento.agencia ?? '' : '',
    conta: atual?.pagamento?.origem === 'fornecedor' ? atual.pagamento.conta ?? '' : '', pixTipo: atual?.pagamento?.origem === 'fornecedor' ? atual.pagamento.pixTipo ?? '' : '',
    pixChave: atual?.pagamento?.origem === 'fornecedor' ? atual.pagamento.pixChave ?? '' : '',
  })
  const [f, setF] = useState(ini)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [aberturaAnterior, setAberturaAnterior] = useState(false)
  if (aberto !== aberturaAnterior) { setAberturaAnterior(aberto); if (aberto) { setF(ini()); setErros({}) } }
  const c = (k: keyof ReturnType<typeof ini>, rot: string, extra: Record<string, unknown> = {}) => (
    <Field label={rot} htmlFor={`fo-${k}`} erro={erros[k]}><input id={`fo-${k}`} className="input" value={f[k]} onChange={(e) => setF({ ...f, [k]: e.target.value })} {...extra} /></Field>
  )
  const salvar = async () => {
    try {
      if (atual) { await api.put(`financeiro/fornecedores/${atual.id}`, { ...f, versao: atual.versao }); toast('Fornecedor atualizado.'); pronto(atual.id) }
      else { const r = await api.post<{ id: string }>('financeiro/fornecedores', f); toast('Fornecedor cadastrado.'); pronto(r.id) }
    } catch (e) { setErros((e as ErroApi).campos ?? {}); toast((e as ErroApi).message, 'danger') }
  }
  return (
    <Modal open={aberto} onClose={fechar} wide title={atual ? 'Editar fornecedor' : 'Novo fornecedor'} subtitle="Colete só o necessário para contratar e pagar."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></>}>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
        <Field label="Tipo"><Dropdown aria-label="Tipo" className="w-full" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{Object.entries(ROTULO_TIPO_FORNECEDOR).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Dropdown></Field>
        {c('razaoSocial', f.tipo === 'pf' ? 'Nome completo' : 'Razão social')}
        {c('documento', f.tipo === 'pf' ? 'CPF' : 'CNPJ', { inputMode: 'numeric' })}
        {f.tipo !== 'pf' && c('nomeFantasia', 'Nome fantasia')}
        {c('inscricaoMunicipal', 'Inscrição municipal')}
        <Field label="Regime tributário (informado)" hint="Informativo; não aplica cálculos sozinho."><Dropdown aria-label="Regime" className="w-full" value={f.regimeTributario} onChange={(e) => setF({ ...f, regimeTributario: e.target.value })}>{Object.entries(ROTULO_REGIME).map(([v, r]) => <option key={v} value={v}>{r}</option>)}</Dropdown></Field>
        {c('municipio', 'Município')}{c('uf', 'UF', { maxLength: 2 })}{c('email', 'E-mail', { type: 'email' })}{c('telefone', 'Telefone')}
        <Field label="Pessoa representante (portal)"><Dropdown aria-label="Representante" className="w-full" value={f.representanteId} onChange={(e) => setF({ ...f, representanteId: e.target.value })}>
          <option value="">Nenhuma</option>{op.dados?.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}</Dropdown></Field>
        <Field label="Situação"><Dropdown aria-label="Situação" className="w-full" value={f.status} onChange={(e) => setF({ ...f, status: e.target.value })}><option value="ativo">Ativo</option><option value="suspenso">Suspenso</option><option value="inativo">Inativo</option></Dropdown></Field>
      </div>
      <h3 className="text-[13px] font-bold mt-2 mb-2">Dados de pagamento da empresa <span className="font-normal text-muted">(vazios = usa os do perfil da pessoa representante)</span></h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">{c('pixTipo', 'Tipo de chave PIX')}{c('pixChave', 'Chave PIX')}{c('banco', 'Banco')}{c('agencia', 'Agência')}{c('conta', 'Conta')}</div>
      <Field label="Observações" htmlFor="fo-obs"><textarea id="fo-obs" className="input h-20 py-2.5" value={f.observacoes} onChange={(e) => setF({ ...f, observacoes: e.target.value })} /></Field>
    </Modal>
  )
}

function ModalRegra({ aberto, fechar, pronto, fornecedorId }: { aberto: boolean; fechar: () => void; pronto: () => void; fornecedorId: string }) {
  const [f, setF] = useState({ tipo: 'ISS', aliquota: '', fundamento: '', vigenciaInicio: '', vigenciaFim: '' })
  const salvar = async () => {
    if (await executar(() => api.post(`financeiro/fornecedores/${fornecedorId}/regras-retencao`, { ...f, aliquota: f.aliquota.replace(',', '.') }), 'Regra cadastrada.')) { setF({ tipo: 'ISS', aliquota: '', fundamento: '', vigenciaInicio: '', vigenciaFim: '' }); pronto() }
  }
  return (
    <Modal open={aberto} onClose={fechar} title="Nova regra de retenção" subtitle="Informe a alíquota e o fundamento (norma ou orientação contábil). Nenhuma alíquota é pré-definida pelo sistema."
      footer={<><Button variant="ghost" onClick={fechar}>Cancelar</Button><Button onClick={salvar}>Salvar</Button></>}>
      <div className="grid grid-cols-2 gap-3">
        <Field label="Tributo"><Dropdown aria-label="Tributo" className="w-full" value={f.tipo} onChange={(e) => setF({ ...f, tipo: e.target.value })}>{TIPOS_RETENCAO.map((t) => <option key={t} value={t}>{t}</option>)}</Dropdown></Field>
        <Field label="Alíquota (%)" required htmlFor="rg-al"><input id="rg-al" className="input" inputMode="decimal" value={f.aliquota} onChange={(e) => setF({ ...f, aliquota: e.target.value })} /></Field>
        <Field label="Vigência a partir de" required htmlFor="rg-ini"><input id="rg-ini" type="date" className="input" value={f.vigenciaInicio} onChange={(e) => setF({ ...f, vigenciaInicio: e.target.value })} /></Field>
        <Field label="Até (opcional)" htmlFor="rg-fim"><input id="rg-fim" type="date" className="input" value={f.vigenciaFim} onChange={(e) => setF({ ...f, vigenciaFim: e.target.value })} /></Field>
      </div>
      <Field label="Fundamento" required hint="Ex.: norma municipal, instrução normativa ou parecer do contador, com data." htmlFor="rg-fund"><textarea id="rg-fund" className="input h-20 py-2.5" value={f.fundamento} onChange={(e) => setF({ ...f, fundamento: e.target.value })} /></Field>
    </Modal>
  )
}
