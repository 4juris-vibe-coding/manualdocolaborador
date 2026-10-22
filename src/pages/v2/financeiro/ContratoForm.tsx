import { useEffect, useState, type FormEvent } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import { Button, Callout, Card, Field, PageHeader } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { Aguardar, SoComBanco } from '@/components/v2/estados'
import { api, ErroApi, useApi } from '@/data/v2/api'
import { toast } from '@/components/toast'
import { useOpcoesFin } from '@/components/v2/financeiro/comum'
import { ROTULO_MODELO, ROTULO_PERIODICIDADE, ROTULO_RENOVACAO, ROTULO_VALOR_MODELO } from '@/domain/v2/financeiro'
import type { ContratoLinha } from './Contratos'

type Form = Record<string, string>
const VAZIO: Form = {
  numero: '', fornecedorId: '', prestadorId: '', gestorId: '', setorId: '', centroCustoId: '', objeto: '', escopo: '', modeloRemuneracao: 'mensal_fixo', valor: '',
  periodicidadeFaturamento: 'mensal', prazoPagamentoDias: '', tipoPrazo: 'determinado', dataAssinatura: '', inicio: '', fim: '', renovacao: 'manual', renovacaoMeses: '12',
  avisoRenovacaoDias: '30', obrigacoesContratada: '', obrigacoesContratante: '', observacoes: '',
}

export default function ContratoForm() {
  const { id } = useParams()
  const [sp] = useSearchParams()
  const nav = useNavigate()
  const op = useOpcoesFin()
  const atual = useApi<{ contrato: ContratoLinha }>(id ? `financeiro/contratos/${id}` : null)
  const [f, setF] = useState<Form>({ ...VAZIO, fornecedorId: sp.get('fornecedor') ?? '' })
  const [erros, setErros] = useState<Record<string, string>>({})
  const [salvando, setSalvando] = useState(false)
  const k = atual.dados?.contrato
  const emVigor = !!k && k.status !== 'rascunho'

  useEffect(() => {
    if (!k) return
    setF(Object.fromEntries(Object.keys(VAZIO).map((c) => [c, (k as unknown as Record<string, unknown>)[c] == null ? '' : String((k as unknown as Record<string, unknown>)[c])])))
  }, [k])

  const set = (c: string) => (v: string) => setF((x) => ({ ...x, [c]: v }))
  const inp = (c: string, extra: Record<string, unknown> = {}) => ({ id: `c-${c}`, className: 'input', value: f[c], onChange: (e: { target: { value: string } }) => set(c)(e.target.value), 'aria-invalid': !!erros[c], ...extra })

  const enviar = async (e: FormEvent) => {
    e.preventDefault()
    setSalvando(true)
    setErros({})
    const corpo = { ...f, valor: f.valor.replace(',', '.'), ...(k ? { versao: k.versao } : {}) }
    try {
      if (id) { await api.put(`financeiro/contratos/${id}`, corpo); toast('Contrato atualizado.'); nav(`/financeiro/contratos/${id}`) }
      else { const r = await api.post<{ id: string }>('financeiro/contratos', corpo); toast('Contrato criado como rascunho. Ative-o quando estiver assinado.'); nav(`/financeiro/contratos/${r.id}`) }
    } catch (err) {
      const x = err as ErroApi
      setErros(x.campos ?? {})
      toast(x.message ?? 'Não foi possível salvar.', 'danger')
    } finally { setSalvando(false) }
  }

  const d = op.dados
  const fornecedorSel = d?.fornecedores.find((x) => x.id === f.fornecedorId)
  return (
    <>
      <PageHeader title={id ? `Editar contrato ${k?.numero ?? ''}` : 'Novo contrato'} subtitle="Contrato comercial de prestação de serviços. As cláusulas jurídicas ficam no documento assinado, validado por profissional competente." />
      <SoComBanco>
        <Aguardar r={op}>
          {(o) => (
            <form onSubmit={enviar} noValidate>
              {emVigor && <Callout tone="warning" icon="Lock" className="mb-4">Contrato em vigor: valor, vigência, modelo e fornecedor mudam por <b>aditivo</b> (na ficha do contrato), para manter o histórico.</Callout>}
              <Card className="p-5 sm:p-6 mb-4">
                <h2 className="text-[15px] font-bold mb-4">Partes e responsáveis</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
                  <Field label="Número do contrato" required erro={erros.numero} htmlFor="c-numero"><input {...inp('numero')} maxLength={60} /></Field>
                  <Field label="Fornecedor (contratada)" required erro={erros.fornecedorId}>
                    <Dropdown aria-label="Fornecedor" className="w-full" value={f.fornecedorId} disabled={emVigor} onChange={(e) => {
                      const forn = o.fornecedores.find((x) => x.id === e.target.value)
                      setF((x) => ({ ...x, fornecedorId: e.target.value, prestadorId: x.prestadorId || forn?.representanteId || '' }))
                    }}>
                      <option value="">Selecione</option>{o.fornecedores.filter((x) => x.status !== 'inativo').map((x) => <option key={x.id} value={x.id}>{x.razaoSocial}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Pessoa que presta o serviço" hint={fornecedorSel?.representanteId ? 'Por padrão, a pessoa representante do fornecedor.' : 'Quem envia as notas pelo portal.'} erro={erros.prestadorId}>
                    <Dropdown aria-label="Prestador" className="w-full" value={f.prestadorId} onChange={(e) => set('prestadorId')(e.target.value)}>
                      <option value="">Nenhuma</option>{o.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Gestor(a) do contrato" hint="Responsável interno pelo relacionamento e pelo aceite dos serviços." erro={erros.gestorId}>
                    <Dropdown aria-label="Gestor" className="w-full" value={f.gestorId} onChange={(e) => set('gestorId')(e.target.value)}>
                      <option value="">Definir depois</option>{o.pessoas.map((p) => <option key={p.id} value={p.id}>{p.nome}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Área atendida" erro={erros.setorId}>
                    <Dropdown aria-label="Área" className="w-full" value={f.setorId} onChange={(e) => set('setorId')(e.target.value)}>
                      <option value="">—</option>{o.setores.map((s) => <option key={s.id} value={s.id}>{s.nome}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Centro de custo" erro={erros.centroCustoId}>
                    <Dropdown aria-label="Centro de custo" className="w-full" value={f.centroCustoId} onChange={(e) => set('centroCustoId')(e.target.value)}>
                      <option value="">—</option>{o.centros.filter((c) => c.ativo).map((c) => <option key={c.id} value={c.id}>{c.codigo} · {c.nome}</option>)}
                    </Dropdown>
                  </Field>
                </div>
              </Card>

              <Card className="p-5 sm:p-6 mb-4">
                <h2 className="text-[15px] font-bold mb-4">Objeto e remuneração</h2>
                <Field label="Objeto" required erro={erros.objeto} htmlFor="c-objeto"><input {...inp('objeto')} maxLength={2000} /></Field>
                <Field label="Escopo dos serviços" htmlFor="c-escopo"><textarea {...inp('escopo')} className="input h-28 py-2.5" /></Field>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                  <Field label="Modelo de remuneração">
                    <Dropdown aria-label="Modelo" className="w-full" value={f.modeloRemuneracao} disabled={emVigor} onChange={(e) => set('modeloRemuneracao')(e.target.value)}>
                      {Object.entries(ROTULO_MODELO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label={ROTULO_VALOR_MODELO[f.modeloRemuneracao] ?? 'Valor'} required erro={erros.valor} htmlFor="c-valor"><input {...inp('valor', { inputMode: 'decimal', disabled: emVigor, placeholder: '0,00' })} /></Field>
                  <Field label="Faturamento">
                    <Dropdown aria-label="Periodicidade" className="w-full" value={f.periodicidadeFaturamento} onChange={(e) => set('periodicidadeFaturamento')(e.target.value)}>
                      {Object.entries(ROTULO_PERIODICIDADE).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </Dropdown>
                  </Field>
                  <Field label="Prazo de pagamento (dias após o aceite)" hint="Vazio = prazo padrão da configuração." erro={erros.prazoPagamentoDias} htmlFor="c-prazoPagamentoDias"><input {...inp('prazoPagamentoDias', { type: 'number', min: 0, max: 120 })} /></Field>
                </div>
              </Card>

              <Card className="p-5 sm:p-6 mb-4">
                <h2 className="text-[15px] font-bold mb-4">Vigência e renovação</h2>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
                  <Field label="Prazo">
                    <Dropdown aria-label="Tipo de prazo" className="w-full" value={f.tipoPrazo} disabled={emVigor} onChange={(e) => set('tipoPrazo')(e.target.value)}>
                      <option value="determinado">Determinado</option><option value="indeterminado">Indeterminado</option>
                    </Dropdown>
                  </Field>
                  <Field label="Data de assinatura" hint="Obrigatória para ativar." erro={erros.dataAssinatura} htmlFor="c-dataAssinatura"><input {...inp('dataAssinatura', { type: 'date' })} /></Field>
                  <Field label="Início" required erro={erros.inicio} htmlFor="c-inicio"><input {...inp('inicio', { type: 'date', disabled: emVigor })} /></Field>
                  {f.tipoPrazo === 'determinado' && <Field label="Término" required erro={erros.fim} htmlFor="c-fim"><input {...inp('fim', { type: 'date', disabled: emVigor })} /></Field>}
                  <Field label="Renovação">
                    <Dropdown aria-label="Renovação" className="w-full" value={f.renovacao} onChange={(e) => set('renovacao')(e.target.value)}>
                      {Object.entries(ROTULO_RENOVACAO).map(([v, r]) => <option key={v} value={v}>{r}</option>)}
                    </Dropdown>
                  </Field>
                  {f.renovacao === 'automatica' && <Field label="Renova por (meses)" htmlFor="c-renovacaoMeses" erro={erros.renovacaoMeses}><input {...inp('renovacaoMeses', { type: 'number', min: 1, max: 60 })} /></Field>}
                  <Field label="Avisar com antecedência (dias)" htmlFor="c-avisoRenovacaoDias" erro={erros.avisoRenovacaoDias}><input {...inp('avisoRenovacaoDias', { type: 'number', min: 0, max: 365 })} /></Field>
                </div>
              </Card>

              <Card className="p-5 sm:p-6 mb-4">
                <h2 className="text-[15px] font-bold mb-4">Obrigações e observações</h2>
                <Field label="Obrigações da contratada" htmlFor="c-obrigacoesContratada"><textarea {...inp('obrigacoesContratada')} className="input h-24 py-2.5" /></Field>
                <Field label="Obrigações da contratante" htmlFor="c-obrigacoesContratante"><textarea {...inp('obrigacoesContratante')} className="input h-24 py-2.5" /></Field>
                <Field label="Observações administrativas" htmlFor="c-observacoes"><textarea {...inp('observacoes')} className="input h-20 py-2.5" /></Field>
              </Card>
              <div className="flex justify-end gap-2.5">
                <Button variant="ghost" onClick={() => nav(-1)}>Cancelar</Button>
                <Button type="submit" icon="Save" disabled={salvando}>{salvando ? 'Salvando…' : 'Salvar'}</Button>
              </div>
            </form>
          )}
        </Aguardar>
      </SoComBanco>
    </>
  )
}
