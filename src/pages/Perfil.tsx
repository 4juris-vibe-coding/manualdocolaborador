import { Link } from 'react-router-dom'
import { MODO_API } from '@/data/config'
import { useState } from 'react'
import { useStore } from '@/lib/store'
import { ListaDocumentos } from '@/components/v2/financeiro/Documentos'
import type { Colaborador, TipoDocumento, Diversidade, PerfilDisc, Escolaridade } from '@/lib/types'
import { SliderBipolar } from '@/components/inputs'
import { BarrasDisc } from '@/components/charts'
import { ConfirmModal } from '@/components/Modal'
import { CATEGORIAS_DISC, TRACOS, DISC_NEUTRO, tracosPadrao } from '@/domain/perfil'
import { ESCOLARIDADE_LABEL, GENERO_LABEL, RACA_LABEL, ESTADO_CIVIL_LABEL } from '@/domain/metricas'
import { cpfValido } from '@/domain/validacao'
import { CLASS_FB } from './rh/Feedbacks'
import { PageHeader, Card, CardHead, Avatar, Badge, Tabs, Button, Field, Icon, Toggle, Callout, EmptyState } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { brl, fmtDate, STATUS_COLAB, REGIME_LABEL, cn } from '@/lib/utils'
import { hojeISO, tempoParceria } from '@/domain/datas'
import { ocultar } from '@/domain/validacao'
import { baixarArquivo } from '@/domain/csv'
import { PAPEL_LABEL } from '@/domain/permissions'
import { CONFIG } from '@/data/config'
import { exportarDadosTitular } from '@/domain/lgpd'
import { Dropdown } from '@/components/Dropdown'

export const TIPOS_DOC: TipoDocumento[] = ['Contrato', 'Aditivo', 'Cartão CNPJ', 'Certidão', 'Documento pessoal', 'Comprovante', 'Certificado', 'Outro']

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  return (
    <div className="py-3 border-b border-line last:border-0">
      <dt className="text-[11px] font-bold uppercase tracking-wide text-muted mb-1">{label}</dt>
      <dd className="text-[14px] text-ink font-medium break-words">{value || '—'}</dd>
    </div>
  )
}

export default function Perfil() {
  const s = useStore()
  const user = s.currentUser()
  const hoje = hojeISO()
  const contrato = s.contratos.filter((k) => k.colaboradorId === user.id).sort((a, b) => b.inicio.localeCompare(a.inicio))[0]
  const documentos = s.documentos.filter((d) => d.colaboradorId === user.id)
  const [tab, setTab] = useState('pessoais')
  const [edit, setEdit] = useState(false)
  const [docOpen, setDocOpen] = useState(false)
  const [mostrarBanco, setMostrarBanco] = useState(false)
  const st = STATUS_COLAB[user.status]

  const tabs = [
    { key: 'pessoais', label: 'Dados pessoais' },
    { key: 'contrato', label: 'Contrato & PJ' },
    { key: 'pagamento', label: 'Pagamento' },
    { key: 'documentos', label: `Documentos (${documentos.length})` },
    { key: 'beneficios', label: 'Benefícios & dependentes' },
    { key: 'feedbacks', label: 'Feedbacks' },
    { key: 'perfil', label: 'Perfil comportamental' },
    { key: 'privacidade', label: 'Privacidade' },
  ]

  const save = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    const patch: Partial<Colaborador> = {
      nomeSocial: d.nomeSocial?.trim() || undefined, telefone: d.telefone?.trim(), cidade: d.cidade?.trim(), uf: d.uf?.trim().toUpperCase().slice(0, 2),
      nascimento: d.nascimento || undefined, emergenciaNome: d.emergenciaNome?.trim(), emergenciaTelefone: d.emergenciaTelefone?.trim(),
      emergenciaParentesco: d.emergenciaParentesco?.trim(), banco: d.banco?.trim(), agencia: d.agencia?.trim(), conta: d.conta?.trim(),
      pixTipo: d.pixTipo as Colaborador['pixTipo'], pixChave: d.pixChave?.trim(),
      celular: d.celular?.trim() || undefined, emailPessoal: d.emailPessoal?.trim() || undefined,
      escolaridade: (d.escolaridade || undefined) as Escolaridade | undefined, curso: d.curso?.trim() || undefined, tamanhoCamisa: d.tamanhoCamisa || undefined,
      endereco: { ...user.endereco, cep: d.cep?.trim() || undefined, logradouro: d.logradouro?.trim() || undefined, numero: d.numero?.trim() || undefined, complemento: d.complemento?.trim() || undefined, bairro: d.bairro?.trim() || undefined, cidade: d.cidade?.trim(), uf: d.uf?.trim().toUpperCase().slice(0, 2) },
    }
    if (patch.nascimento && patch.nascimento > hoje) { toast('A data de nascimento não pode estar no futuro.', 'danger'); return }
    if (feedback(s.atualizarMeuPerfil(patch), 'Perfil atualizado.')) setEdit(false)
  }

  const enviarDoc = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const fd = new FormData(e.currentTarget)
    const arquivo = fd.get('arquivo') as File | null
    const nome = String(fd.get('nome') ?? '').trim() || arquivo?.name || ''
    if (!arquivo?.name) { toast('Selecione um arquivo.', 'danger'); return }
    if (arquivo.size > 10 * 1024 * 1024) { toast('O arquivo deve ter até 10 MB.', 'danger'); return }
    const r = s.adicionarDocumento({
      colaboradorId: user.id, nome, tipo: fd.get('tipo') as TipoDocumento, data: hoje, validade: (fd.get('validade') as string) || undefined,
      tamanho: `${Math.max(1, Math.round(arquivo.size / 1024))} KB`, confidencial: true,
    })
    if (feedback(r, 'Documento registrado. O RH foi avisado.')) setDocOpen(false)
  }

  const exportar = () => {
    const dados = exportarDadosTitular(s, user.id)
    baixarArquivo(JSON.stringify(dados, null, 2), `meus-dados-4juris-${hoje}.json`, 'application/json')
    toast('Arquivo com seus dados gerado.')
  }

  return (
    <>
      <PageHeader title="Meu perfil" subtitle="Seus dados, contrato de prestação de serviços, documentos e preferências."
        actions={<Button icon="Pencil" variant="ghost" onClick={() => setEdit(true)}>Editar meus dados</Button>} />

      <Card className="p-5 sm:p-6 mb-6">
        <div className="flex items-center gap-5 flex-wrap">
          <Avatar nome={user.nome} cor={user.avatarCor} size="xl" />
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-[21px] font-bold text-ink">{user.nomeSocial || user.nome}</h2>
              <Badge tone={st.tone} dot>{st.label}</Badge>
            </div>
            <p className="text-[14px] text-muted mt-1">{s.cargoNome(user.cargoId)} · {s.setorNome(user.setorId)} · {PAPEL_LABEL[user.papel]}</p>
            <div className="flex flex-wrap gap-x-5 gap-y-1 mt-3 text-[13px] text-ink-2">
              <span className="flex items-center gap-1.5"><Icon name="Mail" className="h-4 w-4 text-muted" />{user.email}</span>
              {user.telefone && <span className="flex items-center gap-1.5"><Icon name="Phone" className="h-4 w-4 text-muted" />{user.telefone}</span>}
              <span className="flex items-center gap-1.5"><Icon name="Handshake" className="h-4 w-4 text-muted" />Parceria há {tempoParceria(user.dataEntrada, hoje)}</span>
            </div>
          </div>
        </div>
      </Card>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {tab === 'pessoais' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="px-5 sm:px-6 py-2"><dl>
            <Row label="Nome completo" value={user.nome} />
            <Row label="Nome social" value={user.nomeSocial} />
            <Row label="Nascimento" value={user.nascimento ? `${fmtDate(user.nascimento)} · ${user.privacidade.mostrarAniversario ? 'dia e mês visíveis à comunidade' : 'oculto da comunidade'}` : undefined} />
            <Row label="Cidade / UF" value={user.cidade ? `${user.cidade} / ${user.uf}` : undefined} />
            <Row label="Telefone / celular" value={[user.telefone, user.celular].filter(Boolean).join(' · ')} />
            <Row label="E-mail pessoal" value={user.emailPessoal} />
            <Row label="Endereço" value={user.endereco?.logradouro ? `${user.endereco.logradouro}${user.endereco.numero ? `, ${user.endereco.numero}` : ''}${user.endereco.bairro ? ` · ${user.endereco.bairro}` : ''}` : undefined} />
            <Row label="Escolaridade" value={user.escolaridade ? `${ESCOLARIDADE_LABEL[user.escolaridade]}${user.curso ? ` · ${user.curso}` : ''}` : undefined} />
          </dl></Card>
          <Card className="px-5 sm:px-6 py-2"><dl>
            <Row label="Contato de emergência" value={user.emergenciaNome} />
            <Row label="Telefone de emergência" value={user.emergenciaTelefone} />
            <Row label="Relação" value={user.emergenciaParentesco} />
            <Row label="Área / Função" value={`${s.setorNome(user.setorId)} · ${s.cargoNome(user.cargoId)}`} />
            <Row label="Unidade" value={s.unidades.find((u) => u.id === user.unidadeId)?.nome} />
          </dl></Card>
          <Callout tone="neutral" icon="Info" className="lg:col-span-2">E-mail, área, função e dados da empresa prestadora são mantidos pelo RH. Para corrigir, escreva para <a className="text-brand font-semibold" href={`mailto:${CONFIG.emailRH}`}>{CONFIG.emailRH}</a>.</Callout>
        </div>
      )}

      {tab === 'contrato' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="px-5 sm:px-6 py-2"><dl>
            <Row label="Forma de contratação" value={REGIME_LABEL[user.regime]} />
            <Row label="Razão social" value={user.razaoSocial} />
            <Row label="CNPJ" value={user.cnpj} />
            {user.regime === 'autonomo' && <Row label="CPF" value={ocultar(user.cpf, 5)} />}
            <Row label="Início da parceria" value={fmtDate(user.dataEntrada)} />
          </dl></Card>
          <Card>
            <CardHead title="Contrato de prestação de serviços" sub={contrato ? contrato.numero : undefined} action={MODO_API ? <Link to="/meus-contratos" className="text-[13px] font-semibold text-brand hover:underline">Ver detalhes e aditivos</Link> : undefined} />
            {!contrato ? <EmptyState icon="FileSignature" title="Nenhum contrato registrado" desc="O RH registra aqui o contrato vigente." /> : (
              <dl className="px-5 sm:px-6 py-2">
                <Row label="Objeto" value={contrato.objeto} />
                <Row label="Modalidade" value={contrato.modalidade === 'mensal' ? 'Valor mensal fixo' : 'Por projeto'} />
                <Row label="Valor de referência" value={brl(contrato.valorMensal)} />
                <Row label="Vigência" value={`${fmtDate(contrato.inicio)} → ${contrato.fim ? fmtDate(contrato.fim) : 'prazo indeterminado'}${contrato.renovacaoAutomatica ? ' · renovação automática' : ''}`} />
                <Row label="Situação" value={<Badge tone={contrato.status === 'vigente' ? 'success' : contrato.status === 'em_renovacao' ? 'warning' : 'neutral'} dot>{contrato.status === 'vigente' ? 'Vigente' : contrato.status === 'em_renovacao' ? 'Em renovação' : contrato.status === 'encerrado' ? 'Encerrado' : 'Rascunho'}</Badge>} />
              </dl>
            )}
          </Card>
        </div>
      )}

      {tab === 'pagamento' && (
        <Card className="px-5 sm:px-6 py-2 max-w-2xl">
          <div className="flex items-center justify-between pt-3">
            <span className="text-[12.5px] text-muted">Usados para pagamento das notas fiscais e reembolsos.</span>
            <Button size="sm" variant="subtle" icon={mostrarBanco ? 'EyeOff' : 'Eye'} onClick={() => setMostrarBanco((v) => !v)}>{mostrarBanco ? 'Ocultar' : 'Mostrar'}</Button>
          </div>
          <dl>
            <Row label="Banco" value={user.banco} />
            <Row label="Agência / Conta" value={mostrarBanco ? `${user.agencia ?? '—'} / ${user.conta ?? '—'}` : `${ocultar(user.agencia, 2)} / ${ocultar(user.conta, 3)}`} />
            <Row label={`Chave PIX (${user.pixTipo ?? '—'})`} value={mostrarBanco ? user.pixChave : ocultar(user.pixChave, 4)} />
          </dl>
        </Card>
      )}

      {tab === 'documentos' && MODO_API && <ListaDocumentos filtro={`pessoa=${user.id}`} vinculo={{ pessoaId: user.id }} podeEnviar titulo="Meus documentos" />}
      {tab === 'documentos' && !MODO_API && (
        <Card>
          <CardHead title="Meus documentos" sub="Visíveis apenas para você e para o RH" action={<Button size="sm" icon="Upload" onClick={() => setDocOpen(true)}>Enviar documento</Button>} />
          {documentos.length === 0 ? <EmptyState icon="FolderOpen" title="Nenhum documento" desc="Envie o cartão CNPJ, certidões ou outros documentos solicitados pelo RH." /> : (
            <ul className="divide-y divide-line">
              {documentos.map((d) => {
                const vencido = d.validade && d.validade < hoje
                return (
                  <li key={d.id} className="flex items-center gap-3 px-4 sm:px-5 py-3.5">
                    <span className="h-10 w-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name="FileText" className="h-5 w-5" /></span>
                    <div className="flex-1 min-w-0">
                      <div className="text-[13.5px] font-semibold text-ink truncate">{d.nome}</div>
                      <div className="text-[12px] text-muted">{d.tipo} · {fmtDate(d.data)} · {d.tamanho}{d.validade ? ` · válido até ${fmtDate(d.validade)}` : ''}</div>
                    </div>
                    {vencido ? <Badge tone="danger" dot>Vencido</Badge> : d.validade ? <Badge tone="success" dot>Válido</Badge> : null}
                  </li>
                )
              })}
            </ul>
          )}
          <div className="px-5 py-3 border-t border-line text-[11.5px] text-muted">Demonstração: apenas os metadados (nome, tipo, tamanho) são guardados neste navegador — o arquivo não é enviado a nenhum servidor.</div>
        </Card>
      )}

      {tab === 'beneficios' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card>
            <CardHead title="Meus benefícios" sub="Adesões vigentes" />
            {s.beneficiarios.filter((v) => v.colaboradorId === user.id).length === 0 ? <p className="p-5 text-[13px] text-muted">Você não tem benefícios vinculados. Veja as opções em Vantagens & parcerias.</p> : (
              <ul className="divide-y divide-line">{s.beneficiarios.filter((v) => v.colaboradorId === user.id).map((v) => { const b = s.beneficios.find((x) => x.id === v.beneficioId); return <li key={v.id} className="flex items-center gap-3 px-5 py-3.5"><span className="h-10 w-10 rounded-xl bg-brand-50 text-brand flex items-center justify-center"><Icon name={b?.icon ?? 'Gift'} className="h-5 w-5" /></span><div><div className="text-[13.5px] font-semibold text-ink">{b?.nome}</div><div className="text-[12px] text-muted">Desde {fmtDate(v.desde)}{v.dependentesIds.length ? ` · ${v.dependentesIds.map((d) => s.dependentes.find((x) => x.id === d)?.nome).join(', ')}` : ''}</div></div></li> })}</ul>
            )}
          </Card>
          <Card><CardHead title="Meus dependentes" sub="Usados apenas para benefícios com dependentes" /><DependentesLista pessoaId={user.id} /></Card>
        </div>
      )}

      {tab === 'feedbacks' && (
        <Card>
          <CardHead title="Feedbacks sobre suas entregas" sub="Apenas os marcados como visíveis para você" />
          {s.feedbacks.filter((f) => f.colaboradorId === user.id && f.visivelParaPessoa).length === 0 ? <EmptyState icon="MessageSquareText" title="Nenhum feedback ainda" /> : (
            <ul className="divide-y divide-line">{s.feedbacks.filter((f) => f.colaboradorId === user.id && f.visivelParaPessoa).sort((a, b) => b.data.localeCompare(a.data)).map((f) => <li key={f.id} className="px-5 py-4"><div className="flex items-center gap-2"><Badge tone={CLASS_FB[f.classificacao].tone} dot>{CLASS_FB[f.classificacao].label}</Badge><span className="text-[12px] text-muted">{fmtDate(f.data)} · {s.nomeDe(f.autorId)}</span></div><p className="text-[13.5px] text-ink-2 mt-1.5">{f.comentario}</p></li>)}</ul>
          )}
        </Card>
      )}

      {tab === 'perfil' && (
        <Card className="p-5 sm:p-6">
          <Callout tone="brand" icon="Brain" className="mb-5">O perfil comportamental é <b>opcional</b> e serve para você se conhecer e para o RH formar times. Só é usado nas buscas do RH com o seu consentimento — e você pode removê-lo quando quiser.</Callout>
          <PerfilComportamentalEditor pessoaId={user.id} />
        </Card>
      )}

      {tab === 'privacidade' && (
        <div className="grid lg:grid-cols-2 gap-6">
          <Card className="p-5 sm:p-6">
            <h3 className="text-[15px] font-bold text-ink mb-1">O que a comunidade vê</h3>
            <p className="text-[12.5px] text-muted mb-5">Suas escolhas valem imediatamente em toda a plataforma.</p>
            <div className="space-y-4">
              <Toggle checked={user.privacidade.mostrarAniversario} disabled={!user.nascimento} onChange={(v) => feedback(s.atualizarPrivacidade({ mostrarAniversario: v }), 'Preferência salva.')} label="Mostrar meu aniversário (apenas dia e mês)" />
              <Toggle checked={user.privacidade.mostrarMarcos} onChange={(v) => feedback(s.atualizarPrivacidade({ mostrarMarcos: v }), 'Preferência salva.')} label="Mostrar meus marcos de parceria" />
              <Toggle checked={user.privacidade.aparecerEmDestaques} onChange={(v) => feedback(s.atualizarPrivacidade({ aparecerEmDestaques: v }), 'Preferência salva.')} label="Aparecer nos destaques da gamificação" />
            </div>
          </Card>
          <DiversidadeCard />
          <Card className="p-5 sm:p-6">
            <h3 className="text-[15px] font-bold text-ink mb-1">Seus direitos (LGPD)</h3>
            <ul className="text-[13px] text-ink-2 space-y-2 mt-3 mb-5 list-disc pl-5">
              <li>Liderança não vê seus documentos, contrato, dados bancários nem observações privadas.</li>
              <li>Respostas de pesquisas são anônimas e exibidas apenas de forma agregada.</li>
              <li>Você pode baixar uma cópia dos seus dados a qualquer momento.</li>
              <li>Correções e outros pedidos: <a className="text-brand font-semibold" href={`mailto:${CONFIG.emailRH}`}>{CONFIG.emailRH}</a>.</li>
            </ul>
            <Button variant="ghost" icon="Download" onClick={exportar}>Baixar meus dados (JSON)</Button>
          </Card>
        </div>
      )}

      <Modal open={edit} onClose={() => setEdit(false)} wide title="Editar meus dados" subtitle="Campos institucionais são atualizados pelo RH."
        footer={<><Button variant="ghost" onClick={() => setEdit(false)}>Cancelar</Button><Button icon="Check" type="submit" form="perfilForm">Salvar</Button></>}>
        <form id="perfilForm" onSubmit={save}>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3">Pessoais</h4>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Nome social (opcional)" htmlFor="pf-ns"><input id="pf-ns" name="nomeSocial" className="input" defaultValue={user.nomeSocial} /></Field>
            <Field label="Telefone" htmlFor="pf-tel"><input id="pf-tel" name="telefone" className="input" defaultValue={user.telefone} inputMode="tel" /></Field>
            <Field label="Data de nascimento (opcional)" htmlFor="pf-nasc" hint="Usada só para celebrações, conforme sua privacidade."><input id="pf-nasc" name="nascimento" type="date" max={hoje} className="input" defaultValue={user.nascimento} /></Field>
            <div className="grid grid-cols-[1fr_80px] gap-3">
              <Field label="Cidade" htmlFor="pf-cid"><input id="pf-cid" name="cidade" className="input" defaultValue={user.cidade} /></Field>
              <Field label="UF" htmlFor="pf-uf"><input id="pf-uf" name="uf" className="input uppercase" maxLength={2} defaultValue={user.uf} /></Field>
            </div>
          </div>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Contatos, endereço e formação</h4>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Celular" htmlFor="pf-cel"><input id="pf-cel" name="celular" className="input" defaultValue={user.celular} inputMode="tel" /></Field>
            <Field label="E-mail pessoal" htmlFor="pf-ep"><input id="pf-ep" name="emailPessoal" type="email" className="input" defaultValue={user.emailPessoal} /></Field>
          </div>
          <div className="grid sm:grid-cols-[120px_1fr_100px] gap-x-4">
            <Field label="CEP" htmlFor="pf-cep"><input id="pf-cep" name="cep" className="input" defaultValue={user.endereco?.cep} /></Field>
            <Field label="Logradouro" htmlFor="pf-log"><input id="pf-log" name="logradouro" className="input" defaultValue={user.endereco?.logradouro} /></Field>
            <Field label="Número" htmlFor="pf-nu"><input id="pf-nu" name="numero" className="input" defaultValue={user.endereco?.numero} /></Field>
          </div>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Complemento" htmlFor="pf-co"><input id="pf-co" name="complemento" className="input" defaultValue={user.endereco?.complemento} /></Field>
            <Field label="Bairro" htmlFor="pf-ba"><input id="pf-ba" name="bairro" className="input" defaultValue={user.endereco?.bairro} /></Field>
            <Field label="Escolaridade" htmlFor="pf-es"><Dropdown id="pf-es" name="escolaridade" className="input" defaultValue={user.escolaridade ?? ''}><option value="">Prefiro não informar</option>{Object.entries(ESCOLARIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
            <Field label="Curso" htmlFor="pf-cu"><input id="pf-cu" name="curso" className="input" defaultValue={user.curso} /></Field>
            <Field label="Tamanho de camiseta (kits)" htmlFor="pf-tc"><Dropdown id="pf-tc" name="tamanhoCamisa" className="input" defaultValue={user.tamanhoCamisa ?? ''}><option value="">—</option>{['PP', 'P', 'M', 'G', 'GG', 'XG'].map((t) => <option key={t}>{t}</option>)}</Dropdown></Field>
          </div>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Emergência</h4>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <Field label="Nome" htmlFor="pf-en"><input id="pf-en" name="emergenciaNome" className="input" defaultValue={user.emergenciaNome} /></Field>
            <Field label="Telefone" htmlFor="pf-et"><input id="pf-et" name="emergenciaTelefone" className="input" defaultValue={user.emergenciaTelefone} /></Field>
            <Field label="Relação" htmlFor="pf-ep"><input id="pf-ep" name="emergenciaParentesco" className="input" defaultValue={user.emergenciaParentesco} /></Field>
          </div>
          <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Pagamento</h4>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <Field label="Banco" htmlFor="pf-b"><input id="pf-b" name="banco" className="input" defaultValue={user.banco} /></Field>
            <Field label="Agência" htmlFor="pf-ag"><input id="pf-ag" name="agencia" className="input" defaultValue={user.agencia} /></Field>
            <Field label="Conta" htmlFor="pf-ct"><input id="pf-ct" name="conta" className="input" defaultValue={user.conta} /></Field>
            <Field label="Tipo de chave PIX" htmlFor="pf-pt">
              <Dropdown id="pf-pt" name="pixTipo" className="input" defaultValue={user.pixTipo}>{['CNPJ', 'CPF', 'E-mail', 'Telefone', 'Aleatória'].map((t) => <option key={t}>{t}</option>)}</Dropdown>
            </Field>
            <Field label="Chave PIX" htmlFor="pf-pc" className="sm:col-span-2"><input id="pf-pc" name="pixChave" className="input" defaultValue={user.pixChave} maxLength={120} /></Field>
          </div>
          <p className={cn('text-[12px] text-muted')}>Preencher telefone, cidade e contato de emergência completa seu perfil (vale pontos uma única vez).</p>
        </form>
      </Modal>

      <Modal open={docOpen} onClose={() => setDocOpen(false)} title="Enviar documento" subtitle="Somente você e o RH terão acesso."
        footer={<><Button variant="ghost" onClick={() => setDocOpen(false)}>Cancelar</Button><Button icon="Upload" type="submit" form="docForm">Enviar</Button></>}>
        <form id="docForm" onSubmit={enviarDoc}>
          <Field label="Arquivo" required hint="PDF ou imagem, até 10 MB." htmlFor="dc-a"><input id="dc-a" name="arquivo" type="file" accept=".pdf,image/*" className="input py-2" required /></Field>
          <div className="grid sm:grid-cols-2 gap-x-4">
            <Field label="Tipo" htmlFor="dc-t"><Dropdown id="dc-t" name="tipo" className="input" defaultValue="Certidão">{TIPOS_DOC.map((t) => <option key={t}>{t}</option>)}</Dropdown></Field>
            <Field label="Validade (se houver)" htmlFor="dc-v"><input id="dc-v" name="validade" type="date" className="input" /></Field>
          </div>
          <Field label="Nome de exibição (opcional)" htmlFor="dc-n"><input id="dc-n" name="nome" className="input" placeholder="Ex.: Certidão negativa federal" /></Field>
        </form>
      </Modal>
    </>
  )
}

/* ---------- Diversidade (autodeclarada, consentimento específico) ---------- */
function DiversidadeCard() {
  const s = useStore()
  const me = s.realUser()
  const [d, setD] = useState<Diversidade>(me.diversidade ?? { consentimento: false })
  const [revogar, setRevogar] = useState(false)
  return (
    <Card className="p-5 sm:p-6 lg:col-span-2">
      <h3 className="text-[15px] font-bold text-ink mb-1">Dados de diversidade (opcional)</h3>
      <p className="text-[12.5px] text-muted mb-4">Ajudam a empresa a entender e promover diversidade. São dados sensíveis: só são guardados com o seu consentimento, só aparecem de forma agregada (grupos de 5+ pessoas) e você pode apagá-los a qualquer momento.</p>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-2 mb-4 cursor-pointer">
        <input type="checkbox" className="h-4 w-4 mt-0.5 accent-brand" checked={d.consentimento} onChange={(e) => (e.target.checked ? setD({ ...d, consentimento: true }) : me.diversidade?.consentimento ? setRevogar(true) : setD({ consentimento: false }))} />
        <span>Concordo em informar meus dados de diversidade para análises <b>agregadas e anônimas</b> da 4JURIS.</span>
      </label>
      {d.consentimento && (
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-x-4">
          <Field label="Gênero" htmlFor="dv-g"><Dropdown id="dv-g" className="input" value={d.genero ?? ''} onChange={(e) => setD({ ...d, genero: (e.target.value || undefined) as Diversidade['genero'] })}><option value="">—</option>{Object.entries(GENERO_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
          <Field label="Raça/etnia" htmlFor="dv-r"><Dropdown id="dv-r" className="input" value={d.racaEtnia ?? ''} onChange={(e) => setD({ ...d, racaEtnia: (e.target.value || undefined) as Diversidade['racaEtnia'] })}><option value="">—</option>{Object.entries(RACA_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
          <Field label="Estado civil" htmlFor="dv-e"><Dropdown id="dv-e" className="input" value={d.estadoCivil ?? ''} onChange={(e) => setD({ ...d, estadoCivil: (e.target.value || undefined) as Diversidade['estadoCivil'] })}><option value="">—</option>{Object.entries(ESTADO_CIVIL_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
          <Field label="Pessoa com deficiência" htmlFor="dv-p"><Dropdown id="dv-p" className="input" value={d.pcd == null ? '' : d.pcd ? 's' : 'n'} onChange={(e) => setD({ ...d, pcd: e.target.value === '' ? undefined : e.target.value === 's' })}><option value="">Prefiro não informar</option><option value="s">Sim</option><option value="n">Não</option></Dropdown></Field>
          {d.pcd && <Field label="Tipo (opcional)" htmlFor="dv-t" className="sm:col-span-2"><input id="dv-t" className="input" value={d.tipoDeficiencia ?? ''} onChange={(e) => setD({ ...d, tipoDeficiencia: e.target.value })} placeholder="Ex.: auditiva — ajuda a planejar acessibilidade" /></Field>}
        </div>
      )}
      <Button variant="ghost" icon="Check" onClick={() => feedback(s.salvarDiversidade(d), d.consentimento ? 'Dados de diversidade salvos.' : 'Preferência salva.')}>Salvar</Button>
      <ConfirmModal open={revogar} onClose={() => setRevogar(false)} titulo="Revogar consentimento?" confirmar="Revogar e apagar" texto="Seus dados de diversidade serão apagados da plataforma."
        onConfirm={() => { const r = s.salvarDiversidade({ consentimento: false }); if (feedback(r, 'Consentimento revogado e dados apagados.')) { setD({ consentimento: false }); setRevogar(false) } }} />
    </Card>
  )
}

/* ---------- Perfil comportamental (DISC + 24 traços) ---------- */
export function PerfilComportamentalEditor({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const pessoa = s.pessoa(pessoaId)!
  const proprio = pessoaId === s.realUser().id
  const [disc, setDisc] = useState<PerfilDisc>(pessoa.perfil?.disc ?? { ...DISC_NEUTRO })
  const [tracos, setTracos] = useState<Record<string, number>>(pessoa.perfil?.tracos ?? tracosPadrao())
  const [consent, setConsent] = useState(!!pessoa.perfil?.consentimento)
  const [fonte, setFonte] = useState<'autodeclarado' | 'assessment'>(pessoa.perfil?.fonte ?? (proprio ? 'autodeclarado' : 'assessment'))
  const [remover, setRemover] = useState(false)
  return (
    <div>
      <div className="grid md:grid-cols-2 gap-6">
        <div>
          <h4 className="text-[12px] font-bold uppercase text-muted mb-2">DISC</h4>
          {CATEGORIAS_DISC.map((d) => <SliderBipolar key={d.chave} esquerda={`${d.label}: ${disc[d.chave]}`} valor={disc[d.chave]} cor={d.cor} onChange={(v) => setDisc({ ...disc, [d.chave]: v })} />)}
          <div className="mt-4"><BarrasDisc compacto valores={CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: disc[d.chave], cor: d.cor }))} /></div>
          {!proprio && <Field label="Fonte" htmlFor="pc-f" className="mt-4"><Dropdown id="pc-f" className="input" value={fonte} onChange={(e) => setFonte(e.target.value as typeof fonte)}><option value="assessment">Assessment aplicado</option><option value="autodeclarado">Autodeclarado</option></Dropdown></Field>}
        </div>
        <div className="max-h-[420px] overflow-y-auto pr-1">
          <h4 className="text-[12px] font-bold uppercase text-muted mb-2">Traços (24)</h4>
          {TRACOS.map((t) => <SliderBipolar key={t.chave} esquerda={t.esquerda} direita={t.direita} valor={tracos[t.chave] ?? 50} onChange={(v) => setTracos({ ...tracos, [t.chave]: v })} />)}
        </div>
      </div>
      <label className="flex items-start gap-2.5 text-[13px] text-ink-2 my-4 cursor-pointer">
        <input type="checkbox" className="h-4 w-4 mt-0.5 accent-brand" checked={consent} onChange={(e) => setConsent(e.target.checked)} />
        <span>{proprio ? 'Concordo que o RH use meu perfil em buscas e análises de grupos.' : 'A pessoa consentiu com o registro e uso deste perfil (registre a evidência fora da plataforma).'}</span>
      </label>
      <div className="flex flex-wrap gap-2">
        <Button icon="Check" disabled={!consent} onClick={() => feedback(s.salvarPerfilComportamental(pessoaId, { consentimento: true, fonte, atualizadoEm: hojeISO(), disc, tracos }), 'Perfil salvo.')}>Salvar perfil</Button>
        {pessoa.perfil && <Button variant="subtle" icon="Trash2" onClick={() => setRemover(true)}>Remover perfil</Button>}
      </div>
      <ConfirmModal open={remover} onClose={() => setRemover(false)} titulo="Remover perfil comportamental?" confirmar="Remover" texto="O perfil deixará de aparecer em buscas e análises."
        onConfirm={() => { if (feedback(s.salvarPerfilComportamental(pessoaId, null), 'Perfil removido.')) setRemover(false) }} />
    </div>
  )
}

/* ---------- Dependentes ---------- */
export function DependentesLista({ pessoaId }: { pessoaId: string }) {
  const s = useStore()
  const deps = s.dependentes.filter((d) => d.colaboradorId === pessoaId)
  const [novo, setNovo] = useState(false)
  const [remover, setRemover] = useState<string | null>(null)
  const salvar = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault()
    const d = Object.fromEntries(new FormData(e.currentTarget)) as Record<string, string>
    if (d.cpf && !cpfValido(d.cpf)) { toast('CPF inválido.', 'danger'); return }
    if (feedback(s.salvarDependente({ colaboradorId: pessoaId, nome: d.nome.trim(), parentesco: d.parentesco, nascimento: d.nascimento || undefined, cpf: d.cpf.trim() || undefined }), 'Dependente cadastrado.')) setNovo(false)
  }
  return (
    <>
      {deps.length === 0 ? <p className="px-5 pt-5 text-[13px] text-muted">Nenhum dependente cadastrado.</p> : (
        <ul className="divide-y divide-line">{deps.map((d) => <li key={d.id} className="flex items-center gap-3 px-5 py-3"><Icon name="User" className="h-4 w-4 text-muted" /><div className="flex-1"><div className="text-[13.5px] font-semibold text-ink">{d.nome}</div><div className="text-[12px] text-muted">{d.parentesco}{d.nascimento ? ` · ${fmtDate(d.nascimento)}` : ''}</div></div><Button size="icon-sm" variant="subtle" icon="Trash2" aria-label={`Remover ${d.nome}`} onClick={() => setRemover(d.id)} /></li>)}</ul>
      )}
      <div className="p-4"><Button size="sm" variant="soft" icon="Plus" onClick={() => setNovo(true)}>Adicionar dependente</Button></div>
      <Modal open={novo} onClose={() => setNovo(false)} title="Novo dependente" subtitle="Dados mínimos, usados apenas para adesão a benefícios." footer={<><Button variant="ghost" onClick={() => setNovo(false)}>Cancelar</Button><Button icon="Check" type="submit" form="depForm">Salvar</Button></>}>
        <form id="depForm" onSubmit={salvar}>
          <Field label="Nome" required htmlFor="dp-n"><input id="dp-n" name="nome" className="input" required /></Field>
          <div className="grid sm:grid-cols-3 gap-x-4">
            <Field label="Parentesco" htmlFor="dp-p"><Dropdown id="dp-p" name="parentesco" className="input">{['Cônjuge', 'Companheiro(a)', 'Filho(a)', 'Enteado(a)', 'Pai/Mãe', 'Outro'].map((p) => <option key={p}>{p}</option>)}</Dropdown></Field>
            <Field label="Nascimento" htmlFor="dp-d"><input id="dp-d" name="nascimento" type="date" max={hojeISO()} className="input" /></Field>
            <Field label="CPF (se exigido)" htmlFor="dp-c"><input id="dp-c" name="cpf" className="input" inputMode="numeric" /></Field>
          </div>
        </form>
      </Modal>
      <ConfirmModal open={!!remover} onClose={() => setRemover(null)} titulo="Remover dependente?" confirmar="Remover" texto="Ele(a) também sai dos benefícios vinculados."
        onConfirm={() => { if (remover && feedback(s.removerDependente(remover), 'Dependente removido.')) setRemover(null) }} />
    </>
  )
}
