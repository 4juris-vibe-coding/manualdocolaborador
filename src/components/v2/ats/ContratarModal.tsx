/* Conclusão da contratação no ATS: marca a candidatura como contratada e, em seguida,
   cadastra a pessoa como colaboradora e envia o e-mail de acesso ao portal. */
import { useEffect, useState } from 'react'
import { Modal } from '@/components/Modal'
import { Button, Callout, Field } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { toast } from '@/components/toast'
import { enviarAcessos } from '@/components/envioAcesso'
import { MODO_API } from '@/data/config'
import { salvarAgora } from '@/data/sync'
import { useStore } from '@/lib/store'
import { hojeISO } from '@/lib/fmt'

export interface Contratado { nome: string; email: string; telefone?: string | null; cidade?: string | null; uf?: string | null }

/**
 * Cria (ou reaproveita, pelo e-mail) o cadastro da pessoa e envia o acesso ao portal.
 * O cadastro nasce "pendente": razão social e CNPJ são completados depois pelo RH.
 */
export async function cadastrarEEnviarAcesso(p: Contratado, setorId: string, dataEntrada: string): Promise<void> {
  const s = useStore.getState()
  const email = p.email.trim().toLowerCase()
  let id = s.colaboradores.find((c) => c.email.toLowerCase() === email)?.id
  if (!id) {
    const r = s.salvarPessoa({ nome: p.nome.trim(), email, telefone: p.telefone ?? '', papel: 'colaborador', setorId, status: 'pendente', dataEntrada, regime: 'PJ', cidade: p.cidade ?? '', uf: p.uf ?? '' })
    if (!r.ok) { toast(`Contratação concluída, mas o cadastro não foi criado: ${r.erro}`, 'danger'); return }
    id = r.id!
  }
  if (!MODO_API) { toast('Pessoa cadastrada.', 'success'); return }
  if (!(await salvarAgora())) { toast('Contratação concluída, mas o cadastro ainda não chegou ao servidor. Envie o acesso pela tela de usuários.', 'danger'); return }
  await enviarAcessos([id])
}

export function ContratarModal({ open, onClose, pessoa, titulo, texto, onContratar }: {
  open: boolean; onClose: () => void; pessoa: Contratado | null; titulo: string; texto: React.ReactNode
  /** Conclui a contratação no servidor; devolve se deu certo. */
  onContratar: () => Promise<boolean>
}) {
  const s = useStore()
  const podeCadastrar = s.pode('pessoas:gerenciar')
  const jaCadastrada = !!pessoa && s.colaboradores.some((c) => c.email.toLowerCase() === pessoa.email.trim().toLowerCase())
  const [criarAcesso, setCriarAcesso] = useState(true)
  const [setorId, setSetorId] = useState('')
  const [dataEntrada, setDataEntrada] = useState(hojeISO())
  const [enviando, setEnviando] = useState(false)
  useEffect(() => { if (open) { setCriarAcesso(true); setDataEntrada(hojeISO()); setSetorId((a) => a || (s.setores.length === 1 ? s.setores[0].id : '')) } }, [open]) // eslint-disable-line react-hooks/exhaustive-deps

  const cadastrar = podeCadastrar && criarAcesso
  const confirmar = async () => {
    if (cadastrar && !jaCadastrada && !setorId) { toast('Escolha a área da pessoa.', 'danger'); return }
    setEnviando(true)
    try {
      if (!(await onContratar())) return
      onClose()
      if (cadastrar && pessoa) await cadastrarEEnviarAcesso(pessoa, setorId, dataEntrada)
    } finally { setEnviando(false) }
  }

  return (
    <Modal open={open} onClose={onClose} title={titulo}
      footer={<><Button variant="ghost" onClick={onClose}>Voltar</Button><Button icon="UserCheck" disabled={enviando} onClick={() => void confirmar()}>{enviando ? 'Concluindo…' : 'Concluir contratação'}</Button></>}>
      <p className="text-[13.5px] text-ink-2 mb-4">{texto}</p>
      {podeCadastrar && pessoa && (
        <div className="rounded-xl border border-line p-4">
          <label className="flex items-start gap-2.5 text-[13.5px] cursor-pointer">
            <input type="checkbox" className="mt-0.5" checked={criarAcesso} onChange={(e) => setCriarAcesso(e.target.checked)} />
            <span><b className="text-ink">{jaCadastrada ? 'Enviar o acesso ao portal' : 'Cadastrar como colaborador(a) e enviar o acesso ao portal'}</b><br />
              <span className="text-muted">{pessoa.email} recebe um e-mail com o login e um link para criar a senha.</span></span>
          </label>
          {criarAcesso && !jaCadastrada && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 mt-4">
              <Field label="Área" required htmlFor="ct-setor">
                <Dropdown id="ct-setor" className="input" value={setorId} onChange={(e) => setSetorId(e.target.value)}>
                  <option value="">Selecione…</option>
                  {s.setores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}
                </Dropdown>
              </Field>
              <Field label="Início da parceria" htmlFor="ct-data"><input id="ct-data" type="date" className="input" value={dataEntrada} onChange={(e) => setDataEntrada(e.target.value)} /></Field>
              <Callout tone="neutral" icon="Info" className="sm:col-span-2">O cadastro entra como <b>pendente</b>: complete a razão social e o CNPJ em Pessoas.</Callout>
            </div>
          )}
        </div>
      )}
    </Modal>
  )
}
