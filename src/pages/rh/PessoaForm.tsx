/* Formulário de cadastro/edição de pessoa (RH). Validação final na camada de dados. */
import { useState } from 'react'
import { useStore, type PessoaInput } from '@/lib/store'
import type { Colaborador, Papel, Escolaridade } from '@/lib/types'
import { ESCOLARIDADE_LABEL } from '@/domain/metricas'
import { Modal } from '@/components/Modal'
import { Button, Field, Callout } from '@/components/ui'
import { feedback } from '@/components/toast'
import { cnpjValido, cpfValido, emailValido, mascaraCNPJ, mascaraCPF } from '@/domain/validacao'
import { hojeISO } from '@/domain/datas'
import { PAPEL_LABEL, can } from '@/domain/permissions'
import { REGIME_LABEL } from '@/lib/utils'
import { Dropdown } from '@/components/Dropdown'

export function PessoaForm({ pessoa, onClose, onSalvo }: { pessoa?: Colaborador; onClose: () => void; onSalvo?: (id: string) => void }) {
  const s = useStore()
  const podePapel = can(s.currentUser().papel, 'admin:usuarios')
  const [f, setF] = useState<PessoaInput>(() => ({
    nome: pessoa?.nome ?? '', nomeSocial: pessoa?.nomeSocial ?? '', email: pessoa?.email ?? '', telefone: pessoa?.telefone ?? '',
    papel: pessoa?.papel ?? 'colaborador', setorId: pessoa?.setorId ?? s.setores[0]?.id ?? '', cargoId: pessoa?.cargoId ?? '',
    unidadeId: pessoa?.unidadeId ?? '', produtoIds: pessoa?.produtoIds ?? [], status: pessoa?.status ?? 'integracao', dataEntrada: pessoa?.dataEntrada ?? hojeISO(),
    nascimento: pessoa?.nascimento ?? '', cidade: pessoa?.cidade ?? '', uf: pessoa?.uf ?? '', regime: pessoa?.regime ?? 'PJ',
    cpf: pessoa?.cpf ?? '', razaoSocial: pessoa?.razaoSocial ?? '', cnpj: pessoa?.cnpj ?? '',
    endereco: pessoa?.endereco ?? { pais: 'Brasil' }, celular: pessoa?.celular ?? '', emailPessoal: pessoa?.emailPessoal ?? '',
    matricula: pessoa?.matricula ?? '', responsavelId: pessoa?.responsavelId ?? '', fusoHorario: pessoa?.fusoHorario ?? 'America/Sao_Paulo',
    tamanhoCamisa: pessoa?.tamanhoCamisa ?? '', escolaridade: pessoa?.escolaridade, curso: pessoa?.curso ?? '', codigoExterno: pessoa?.codigoExterno ?? '',
  }))
  const [secao, setSecao] = useState<'principal' | 'complementar'>('principal')
  const setEnd = (p: Partial<NonNullable<PessoaInput['endereco']>>) => setF((x) => ({ ...x, endereco: { ...x.endereco, ...p } }))
  const [tocado, setTocado] = useState<Record<string, boolean>>({})
  const set = (p: Partial<PessoaInput>) => setF((x) => ({ ...x, ...p }))
  const toque = (k: string) => setTocado((t) => ({ ...t, [k]: true }))
  const cargos = s.cargos.filter((g) => g.setorId === f.setorId)
  const pj = f.regime !== 'autonomo'

  const erros: Record<string, string | undefined> = {
    nome: f.nome.trim().length < 3 ? 'Informe o nome completo.' : undefined,
    email: !emailValido(f.email) ? 'E-mail inválido.' : undefined,
    cnpj: pj && !cnpjValido(f.cnpj ?? '') ? 'CNPJ inválido (verifique os dígitos).' : undefined,
    razaoSocial: pj && !(f.razaoSocial ?? '').trim() ? 'Informe a razão social.' : undefined,
    cpf: !pj && f.cpf && !cpfValido(f.cpf) ? 'CPF inválido.' : undefined,
  }
  const e = (k: string) => (tocado[k] || tocado._submit ? erros[k] : undefined)

  const salvar = (ev: React.FormEvent) => {
    ev.preventDefault()
    toque('_submit')
    if (Object.values(erros).some(Boolean)) return
    const vazio = (v?: string) => (v && v.trim() ? v.trim() : undefined)
    const r = s.salvarPessoa({
      ...f, nascimento: f.nascimento || undefined, unidadeId: f.unidadeId || undefined, cargoId: f.cargoId || undefined,
      responsavelId: f.responsavelId || undefined, celular: vazio(f.celular), emailPessoal: vazio(f.emailPessoal), matricula: vazio(f.matricula),
      curso: vazio(f.curso), codigoExterno: vazio(f.codigoExterno), tamanhoCamisa: vazio(f.tamanhoCamisa),
    }, pessoa?.id)
    if (feedback(r, pessoa ? 'Cadastro atualizado.' : 'Pessoa cadastrada.') && r.ok) { onSalvo?.(r.id ?? pessoa?.id ?? ''); onClose() }
  }

  return (
    <Modal open onClose={onClose} wide title={pessoa ? `Editar ${pessoa.nome}` : 'Nova pessoa'} subtitle="Somente os dados necessários à prestação de serviços e à convivência na plataforma."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button icon="Check" type="submit" form="pessoaForm">{pessoa ? 'Salvar' : 'Cadastrar'}</Button></>}>
      <form id="pessoaForm" onSubmit={salvar} noValidate>
        <div className="inline-flex rounded-xl border border-line p-1 mb-5" role="group" aria-label="Seção">
          {(['principal', 'complementar'] as const).map((k) => <button key={k} type="button" aria-pressed={secao === k} onClick={() => setSecao(k)} className={`h-8 px-3 rounded-lg text-[12.5px] font-semibold ${secao === k ? 'bg-ink text-surface' : 'text-ink-2'}`}>{k === 'principal' ? 'Dados principais' : 'Ficha complementar'}</button>)}
        </div>
        {secao === 'complementar' && (
          <>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3">Endereço</h4>
            <div className="grid grid-cols-1 sm:grid-cols-[140px_1fr_110px] gap-x-4">
              <Field label="CEP" htmlFor="pf-cep"><input id="pf-cep" className="input" inputMode="numeric" value={f.endereco?.cep ?? ''} onChange={(x) => setEnd({ cep: x.target.value.replace(/\D/g, '').slice(0, 8).replace(/(\d{5})(\d)/, '$1-$2') })} /></Field>
              <Field label="Logradouro" htmlFor="pf-log"><input id="pf-log" className="input" value={f.endereco?.logradouro ?? ''} onChange={(x) => setEnd({ logradouro: x.target.value })} /></Field>
              <Field label="Número" htmlFor="pf-num"><input id="pf-num" className="input" value={f.endereco?.numero ?? ''} onChange={(x) => setEnd({ numero: x.target.value })} /></Field>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-x-4">
              <Field label="Complemento" htmlFor="pf-comp"><input id="pf-comp" className="input" value={f.endereco?.complemento ?? ''} onChange={(x) => setEnd({ complemento: x.target.value })} /></Field>
              <Field label="Bairro" htmlFor="pf-bai"><input id="pf-bai" className="input" value={f.endereco?.bairro ?? ''} onChange={(x) => setEnd({ bairro: x.target.value })} /></Field>
              <Field label="País" htmlFor="pf-pais"><input id="pf-pais" className="input" value={f.endereco?.pais ?? 'Brasil'} onChange={(x) => setEnd({ pais: x.target.value })} /></Field>
            </div>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Contatos</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label="Celular" htmlFor="pf-cel"><input id="pf-cel" className="input" inputMode="tel" value={f.celular} onChange={(x) => set({ celular: x.target.value })} /></Field>
              <Field label="E-mail pessoal" htmlFor="pf-ep"><input id="pf-ep" type="email" className="input" value={f.emailPessoal} onChange={(x) => set({ emailPessoal: x.target.value })} /></Field>
            </div>
            <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Formação e dados adicionais</h4>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
              <Field label="Escolaridade" htmlFor="pf-esc"><Dropdown id="pf-esc" className="input" value={f.escolaridade ?? ''} onChange={(x) => set({ escolaridade: (x.target.value || undefined) as Escolaridade | undefined })}><option value="">Não informada</option>{Object.entries(ESCOLARIDADE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Dropdown></Field>
              <Field label="Curso" htmlFor="pf-cur"><input id="pf-cur" className="input" value={f.curso} onChange={(x) => set({ curso: x.target.value })} /></Field>
              <Field label="Responsável direto (ponto focal)" htmlFor="pf-resp" hint="Usado nas avaliações 90°/180°/360°."><Dropdown id="pf-resp" className="input" value={f.responsavelId} onChange={(x) => set({ responsavelId: x.target.value })}><option value="">Lideranças da área</option>{s.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== pessoa?.id).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Dropdown></Field>
              <Field label="Matrícula / código interno" htmlFor="pf-mat"><input id="pf-mat" className="input" value={f.matricula} onChange={(x) => set({ matricula: x.target.value })} /></Field>
              <Field label="Código externo (integrações)" htmlFor="pf-cod"><input id="pf-cod" className="input" value={f.codigoExterno} onChange={(x) => set({ codigoExterno: x.target.value })} /></Field>
              <Field label="Fuso horário" htmlFor="pf-fuso"><Dropdown id="pf-fuso" className="input" value={f.fusoHorario} onChange={(x) => set({ fusoHorario: x.target.value })}>{[['America/Noronha', 'Fernando de Noronha (UTC-2)'], ['America/Sao_Paulo', 'Brasília (UTC-3)'], ['America/Manaus', 'Amazonas (UTC-4)'], ['America/Rio_Branco', 'Acre (UTC-5)']].map(([v, t]) => <option key={v} value={v}>{t}</option>)}</Dropdown></Field>
              <Field label="Tamanho de camiseta (kits)" htmlFor="pf-cam"><Dropdown id="pf-cam" className="input" value={f.tamanhoCamisa} onChange={(x) => set({ tamanhoCamisa: x.target.value })}><option value="">—</option>{['PP', 'P', 'M', 'G', 'GG', 'XG'].map((t) => <option key={t}>{t}</option>)}</Dropdown></Field>
            </div>
          </>
        )}
        <div className={secao === 'principal' ? '' : 'hidden'}>
        <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3">Identificação</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Nome completo" required erro={e('nome')} htmlFor="pf-nome"><input id="pf-nome" className="input" value={f.nome} onBlur={() => toque('nome')} onChange={(x) => set({ nome: x.target.value })} aria-invalid={!!e('nome')} /></Field>
          <Field label="Nome social" htmlFor="pf-ns"><input id="pf-ns" className="input" value={f.nomeSocial} onChange={(x) => set({ nomeSocial: x.target.value })} /></Field>
          <Field label="E-mail" required erro={e('email')} htmlFor="pf-email" hint="Usado para o acesso à plataforma."><input id="pf-email" type="email" className="input" value={f.email} onBlur={() => toque('email')} onChange={(x) => set({ email: x.target.value })} aria-invalid={!!e('email')} /></Field>
          <Field label="Telefone" htmlFor="pf-tel"><input id="pf-tel" className="input" type="tel" inputMode="tel" value={f.telefone} onChange={(x) => set({ telefone: x.target.value })} /></Field>
          <Field label="Nascimento (opcional)" htmlFor="pf-nasc" hint="Apenas para celebrações, se a pessoa permitir."><input id="pf-nasc" type="date" max={hojeISO()} className="input" value={f.nascimento} onChange={(x) => set({ nascimento: x.target.value })} /></Field>
          <div className="grid grid-cols-[1fr_80px] gap-3">
            <Field label="Cidade" htmlFor="pf-cid"><input id="pf-cid" className="input" value={f.cidade} onChange={(x) => set({ cidade: x.target.value })} /></Field>
            <Field label="UF" htmlFor="pf-uf"><input id="pf-uf" className="input uppercase" maxLength={2} value={f.uf} onChange={(x) => set({ uf: x.target.value.toUpperCase() })} /></Field>
          </div>
        </div>

        <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Atuação</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Área" required htmlFor="pf-area"><Dropdown id="pf-area" className="input" value={f.setorId} onChange={(x) => set({ setorId: x.target.value, cargoId: '' })}>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Dropdown></Field>
          <Field label="Função" htmlFor="pf-func" hint={cargos.length ? undefined : 'Cadastre funções da área em Estrutura.'}><Dropdown id="pf-func" className="input" value={f.cargoId} onChange={(x) => set({ cargoId: x.target.value })}><option value="">—</option>{cargos.map((g) => <option key={g.id} value={g.id}>{g.nome} · {g.nivel}</option>)}</Dropdown></Field>
          <Field label="Unidade" htmlFor="pf-un"><Dropdown id="pf-un" className="input" value={f.unidadeId} onChange={(x) => set({ unidadeId: x.target.value })}><option value="">—</option>{s.unidades.map((u) => <option key={u.id} value={u.id}>{u.nome}</option>)}</Dropdown></Field>
          {(s.config.produtos ?? []).length > 0 && (
            <div className="sm:col-span-2 mb-4">
              <span className="label" id="pf-prod">Produtos em que atua</span>
              <div className="flex flex-wrap gap-2" role="group" aria-labelledby="pf-prod">
                {(s.config.produtos ?? []).map((p) => {
                  const marcado = !!f.produtoIds?.includes(p.id)
                  return (
                    <button key={p.id} type="button" aria-pressed={marcado}
                      onClick={() => set({ produtoIds: marcado ? f.produtoIds!.filter((x) => x !== p.id) : [...(f.produtoIds ?? []), p.id] })}
                      className={`rounded-full border px-3 py-1.5 text-[12.5px] font-semibold transition ${marcado ? '' : 'border-line text-ink-2 hover:bg-winter'}`}
                      style={marcado ? { color: p.cor, borderColor: p.cor, backgroundColor: `${p.cor}14` } : undefined}>
                      {marcado ? '✓ ' : ''}{p.nome}
                    </button>
                  )
                })}
              </div>
            </div>
          )}
          <Field label="Início da parceria" required htmlFor="pf-ini"><input id="pf-ini" type="date" className="input" value={f.dataEntrada} onChange={(x) => set({ dataEntrada: x.target.value })} /></Field>
          {!pessoa || pessoa.status !== 'encerrado' ? (
            <Field label="Situação" htmlFor="pf-st"><Dropdown id="pf-st" className="input" value={f.status} onChange={(x) => set({ status: x.target.value as Colaborador['status'] })}>
              <option value="integracao">Em integração</option><option value="ativo">Ativo</option><option value="pendente">Cadastro pendente</option>
            </Dropdown></Field>
          ) : <Field label="Situação"><p className="text-[13px] text-muted h-11 flex items-center">Encerrada — use “Reativar parceria”.</p></Field>}
          <Field label="Papel de acesso" htmlFor="pf-papel" hint={podePapel ? undefined : 'Alterado apenas pela Administração.'}>
            <Dropdown id="pf-papel" className="input" value={f.papel} disabled={!podePapel} onChange={(x) => set({ papel: x.target.value as Papel })}>
              {(Object.keys(PAPEL_LABEL) as Papel[]).map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
            </Dropdown>
          </Field>
        </div>

        <h4 className="text-[12px] font-bold uppercase tracking-wide text-muted mb-3 mt-2">Prestação de serviços</h4>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
          <Field label="Forma de contratação" htmlFor="pf-reg"><Dropdown id="pf-reg" className="input" value={f.regime} onChange={(x) => set({ regime: x.target.value as Colaborador['regime'] })}>
            {Object.entries(REGIME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </Dropdown></Field>
          {pj ? <>
            <Field label="CNPJ" required erro={e('cnpj')} htmlFor="pf-cnpj"><input id="pf-cnpj" className="input" inputMode="numeric" value={f.cnpj} onBlur={() => toque('cnpj')} onChange={(x) => set({ cnpj: mascaraCNPJ(x.target.value) })} placeholder="00.000.000/0000-00" aria-invalid={!!e('cnpj')} /></Field>
            <Field label="Razão social" required erro={e('razaoSocial')} htmlFor="pf-rs" className="sm:col-span-2"><input id="pf-rs" className="input" value={f.razaoSocial} onBlur={() => toque('razaoSocial')} onChange={(x) => set({ razaoSocial: x.target.value })} /></Field>
          </> : (
            <Field label="CPF (opcional)" erro={e('cpf')} htmlFor="pf-cpf"><input id="pf-cpf" className="input" inputMode="numeric" value={f.cpf} onBlur={() => toque('cpf')} onChange={(x) => set({ cpf: mascaraCPF(x.target.value) })} /></Field>
          )}
        </div>
        <Callout tone="neutral" icon="ShieldCheck" className="mt-1">Dados bancários e de emergência são informados pela própria pessoa no perfil. Valores e vigência ficam no contrato.</Callout>
        </div>
      </form>
    </Modal>
  )
}
