import { useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, Callout, Field } from '@/components/ui'
import { api, executar, lerBase64 } from '@/data/v2/api'
import { ORIGENS, ROTULO_ORIGEM } from '@/domain/v2/ats'
import { TEXTAREA, camposDoErro, lerTexto, mensagemDoErro } from './comuns'
import { toast } from '@/components/toast'
import { Dropdown } from '@/components/Dropdown'

const ORIGENS_MANUAL = ORIGENS.filter((o) => o !== 'portal' && o !== 'importacao')

/** Cadastro manual de candidato em uma vaga (RH/recrutador). */
export function CadastroManualModal({ vagaId, open, onClose, onFeito, podeSalario }: { vagaId: string; open: boolean; onClose: () => void; onFeito: () => void; podeSalario: boolean }) {
  const vazio = { nome: '', email: '', telefone: '', cidade: '', uf: '', origem: 'manual', pretensao: '' }
  const [f, setF] = useState(vazio)
  const [arquivo, setArquivo] = useState<File | null>(null)
  const [erros, setErros] = useState<Record<string, string>>({})
  const [enviando, setEnviando] = useState(false)
  const set = (k: keyof typeof vazio, v: string) => setF((x) => ({ ...x, [k]: v }))

  async function salvar() {
    setEnviando(true); setErros({})
    try {
      const curriculo = arquivo ? await lerBase64(arquivo) : undefined
      const r = await api.post('ats/candidaturas', { vagaId, ...f, pretensao: f.pretensao || undefined, curriculo })
      toast(r.candidatoReutilizado ? `Candidatura criada. Esta pessoa já tinha ${r.outrasCandidaturas} candidatura(s) em outras vagas.` : 'Candidato cadastrado.')
      setF(vazio); setArquivo(null); onFeito(); onClose()
    } catch (e) {
      setErros(camposDoErro(e))
      toast(mensagemDoErro(e), 'danger')
    } finally { setEnviando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title="Cadastrar candidato" subtitle="Cadastro manual na vaga selecionada."
      footer={<><Button variant="ghost" onClick={onClose}>Cancelar</Button><Button onClick={salvar} disabled={enviando}>{enviando ? 'Salvando…' : 'Cadastrar'}</Button></>}>
      <div className="grid sm:grid-cols-2 gap-x-4">
        <Field label="Nome completo" required erro={erros.nome} htmlFor="cm-nome" className="sm:col-span-2"><input id="cm-nome" className="input" value={f.nome} onChange={(e) => set('nome', e.target.value)} /></Field>
        <Field label="E-mail" required erro={erros.email} htmlFor="cm-email"><input id="cm-email" type="email" className="input" value={f.email} onChange={(e) => set('email', e.target.value)} /></Field>
        <Field label="Telefone" erro={erros.telefone} htmlFor="cm-tel"><input id="cm-tel" className="input" value={f.telefone} onChange={(e) => set('telefone', e.target.value)} /></Field>
        <Field label="Cidade" htmlFor="cm-cid"><input id="cm-cid" className="input" value={f.cidade} onChange={(e) => set('cidade', e.target.value)} /></Field>
        <Field label="UF" erro={erros.uf} htmlFor="cm-uf"><input id="cm-uf" className="input" maxLength={2} value={f.uf} onChange={(e) => set('uf', e.target.value.toUpperCase())} /></Field>
        <Field label="Origem" htmlFor="cm-ori">
          <Dropdown id="cm-ori" className="input" value={f.origem} onChange={(e) => set('origem', e.target.value)}>
            {ORIGENS_MANUAL.map((o) => <option key={o} value={o}>{ROTULO_ORIGEM[o]}</option>)}
          </Dropdown>
        </Field>
        {podeSalario && <Field label="Pretensão salarial (R$)" erro={erros.pretensao} htmlFor="cm-pre"><input id="cm-pre" type="number" min={0} className="input" value={f.pretensao} onChange={(e) => set('pretensao', e.target.value)} /></Field>}
        <Field label="Currículo (PDF, DOC, DOCX ou ODT — até 3 MB)" erro={erros.curriculo} htmlFor="cm-cv" className="sm:col-span-2">
          <input id="cm-cv" type="file" accept=".pdf,.doc,.docx,.odt" className="block w-full text-[13px]" onChange={(e) => setArquivo(e.target.files?.[0] ?? null)} />
        </Field>
      </div>
      <Callout tone="neutral" icon="ShieldCheck">Cadastro manual não registra consentimento sozinho: confirme a base legal e a ciência do candidato conforme a política da empresa.</Callout>
    </Modal>
  )
}

interface RelatorioImportacao { simulacao: boolean; totalLinhas: number; validas: number; criadas: number; ignoradas: number; erros: { linha: number; mensagem: string }[] }

/** Importação em lote por CSV: primeiro verifica (sem gravar), depois importa só as linhas válidas. */
export function ImportarModal({ vagaId, open, onClose, onFeito }: { vagaId: string; open: boolean; onClose: () => void; onFeito: () => void }) {
  const [csv, setCsv] = useState('')
  const [rel, setRel] = useState<RelatorioImportacao | null>(null)
  const [ocupado, setOcupado] = useState(false)

  async function rodar(simular: boolean) {
    setOcupado(true)
    const r = await executar(() => api.post<RelatorioImportacao>('ats/candidaturas/importar', { vagaId, csv, simular }))
    setOcupado(false)
    if (!r) return
    setRel(r)
    if (!simular) { toast(`${r.criadas} candidato(s) importado(s).`); onFeito() }
  }
  const fechar = () => { setCsv(''); setRel(null); onClose() }

  return (
    <Modal open={open} onClose={fechar} wide title="Importar candidatos (CSV)" subtitle="Colunas aceitas: nome e e-mail (obrigatórias), telefone, cidade, uf, linkedin."
      footer={<>
        <Button variant="ghost" onClick={fechar}>{rel && !rel.simulacao ? 'Fechar' : 'Cancelar'}</Button>
        <Button variant="soft" onClick={() => rodar(true)} disabled={!csv.trim() || ocupado}>Verificar arquivo</Button>
        <Button onClick={() => rodar(false)} disabled={!rel || !rel.simulacao || rel.validas === 0 || ocupado}>Importar {rel?.simulacao ? `${rel.validas} linha(s)` : ''}</Button>
      </>}>
      <Field label="Arquivo CSV" htmlFor="imp-arq">
        <input id="imp-arq" type="file" accept=".csv,text/csv" className="block w-full text-[13px]"
          onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setCsv(await lerTexto(f)); setRel(null) } }} />
      </Field>
      <Field label="…ou cole o conteúdo" htmlFor="imp-txt" hint="Primeira linha = cabeçalho. Separador vírgula ou ponto e vírgula.">
        <textarea id="imp-txt" className={TEXTAREA} value={csv} onChange={(e) => { setCsv(e.target.value); setRel(null) }} placeholder={'nome;email;telefone\nAna Souza;ana@exemplo.com;(11) 99999-0000'} />
      </Field>
      {rel && (
        <div className="mt-2" aria-live="polite">
          <Callout tone={rel.erros.length ? 'warning' : 'success'} icon={rel.erros.length ? 'AlertTriangle' : 'CheckCircle2'}>
            {rel.simulacao
              ? <><b>{rel.validas}</b> de {rel.totalLinhas} linha(s) estão prontas para importar{rel.erros.length ? <> e <b>{rel.erros.length}</b> têm problema (não serão gravadas).</> : '.'}</>
              : <><b>{rel.criadas}</b> candidato(s) importado(s){rel.erros.length ? <>; <b>{rel.erros.length}</b> linha(s) ignorada(s).</> : '.'}</>}
          </Callout>
          {rel.erros.length > 0 && (
            <ul className="mt-3 max-h-48 overflow-y-auto text-[12.5px] space-y-1 border border-line rounded-xl p-3">
              {rel.erros.map((er, i) => <li key={i}><b>Linha {er.linha}:</b> {er.mensagem}</li>)}
            </ul>
          )}
        </div>
      )}
    </Modal>
  )
}

/** Pede o motivo (e confirma) antes de reprovar/encerrar uma candidatura. */
export function MotivoModal({ titulo, aberto, onClose, onConfirmar, avisarCandidato }: { titulo: string; aberto: boolean; onClose: () => void; onConfirmar: (motivo: string, avisar: boolean) => Promise<void>; avisarCandidato?: boolean }) {
  const [motivo, setMotivo] = useState('')
  const [avisar, setAvisar] = useState(false)
  const [ocupado, setOcupado] = useState(false)
  const [erro, setErro] = useState('')
  async function ok() {
    if (!motivo.trim()) { setErro('Informe o motivo.'); return }
    setOcupado(true)
    await onConfirmar(motivo.trim(), avisar)
    setOcupado(false); setMotivo(''); setAvisar(false); setErro('')
  }
  return (
    <Modal open={aberto} onClose={onClose} title={titulo}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button variant="danger" onClick={ok} disabled={ocupado}>{ocupado ? 'Salvando…' : 'Confirmar'}</Button></>}>
      <Field label="Motivo" required erro={erro} htmlFor="mot-txt" hint="Fica registrado no histórico da candidatura (acesso restrito ao RH).">
        <textarea id="mot-txt" className={TEXTAREA} value={motivo} onChange={(e) => { setMotivo(e.target.value); setErro('') }} />
      </Field>
      {avisarCandidato && (
        <label className="flex items-start gap-2.5 text-[13px] text-ink-2 cursor-pointer">
          <input type="checkbox" className="mt-0.5" checked={avisar} onChange={(e) => setAvisar(e.target.checked)} />
          <span>Enviar comunicação de encerramento ao candidato. <span className="text-muted">Só é enviada se o e-mail estiver configurado; caso contrário fica na lista de pendências de Comunicação.</span></span>
        </label>
      )}
    </Modal>
  )
}
