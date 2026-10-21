import { useCallback, useEffect, useState } from 'react'
import type { Colaborador } from '@/lib/types'
import { Card, CardHead, Badge, Button } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { MODO_API } from '@/data/config'
import { listarAcessos, salvarAcesso, type AcessoUsuario } from '@/data/sync'
import { fmtDate } from '@/lib/utils'

/** Senha aleatória de 14 caracteres (sem símbolos ambíguos), gerada no navegador. */
export function gerarSenha(): string {
  const alfabeto = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789@#$%'
  const bytes = crypto.getRandomValues(new Uint8Array(14))
  return Array.from(bytes, (b) => alfabeto[b % alfabeto.length]).join('')
}

/** Cartão "Acesso ao portal" da pessoa: criar login, redefinir senha, desativar/reativar. `pode` = quem vê o cartão pode gerenciar este alvo. */
export function AcessoPortal({ pessoa, pode, ehVoce }: { pessoa: Colaborador; pode: boolean; ehVoce: boolean }) {
  const [acesso, setAcesso] = useState<AcessoUsuario | null | undefined>(undefined)
  const [aberto, setAberto] = useState(false)
  const [senha, setSenha] = useState('')
  const [ver, setVer] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const carregar = useCallback(() => listarAcessos(pessoa.id).then((l) => setAcesso(l[0] ?? null)), [pessoa.id])
  useEffect(() => { if (MODO_API) void carregar() }, [carregar])
  if (!MODO_API) return null

  const gravar = async () => {
    setSalvando(true)
    const falha = await salvarAcesso(pessoa.id, { senha, ativo: true })
    setSalvando(false)
    if (falha) { toast(falha, 'danger'); return }
    toast(acesso ? 'Senha redefinida.' : 'Acesso criado.')
    setAberto(false)
    void carregar()
  }
  const alternar = async (ativo: boolean) => {
    const falha = await salvarAcesso(pessoa.id, { ativo })
    if (falha) { toast(falha, 'danger'); return }
    toast(ativo ? 'Acesso reativado.' : 'Acesso desativado.')
    void carregar()
  }

  return (
    <Card>
      <CardHead title="Acesso ao portal" />
      <div className="p-5 space-y-3 text-[13.5px] text-ink-2">
        {acesso === undefined ? <p className="text-muted">Carregando…</p> : (
          <>
            <div className="flex items-center gap-2">
              {acesso ? <Badge tone={acesso.ativo ? 'success' : 'neutral'} dot>{acesso.ativo ? 'Com acesso' : 'Desativado'}</Badge> : <Badge tone="warning" dot>Sem acesso</Badge>}
              {acesso?.ultimoAcesso && <span className="text-[12px] text-muted">último acesso {fmtDate(acesso.ultimoAcesso.slice(0, 10))}</span>}
            </div>
            <p className="text-[12.5px] text-muted">Login: {pessoa.email}</p>
            {pode ? (
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant={acesso ? 'soft' : 'primary'} icon={acesso ? 'KeyRound' : 'UserPlus'} onClick={() => { setSenha(''); setVer(false); setAberto(true) }}>{acesso ? 'Nova senha' : 'Criar acesso'}</Button>
                {acesso && !ehVoce && <Button size="sm" variant="ghost" onClick={() => void alternar(!acesso.ativo)}>{acesso.ativo ? 'Desativar' : 'Reativar'}</Button>}
              </div>
            ) : <p className="text-[12px] text-muted">Apenas a administração gerencia o acesso deste perfil.</p>}
          </>
        )}
      </div>
      <Modal open={aberto} onClose={() => setAberto(false)} title={acesso ? 'Nova senha de acesso' : 'Criar acesso ao portal'} subtitle={`${pessoa.nome} · ${pessoa.email}`}
        footer={<><Button variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button><Button icon="Check" disabled={salvando || senha.length < 10} onClick={() => void gravar()}>{salvando ? 'Salvando…' : 'Salvar'}</Button></>}>
        <label className="label" htmlFor="acesso-senha">Senha (mínimo 10 caracteres)</label>
        <div className="flex gap-2">
          <input id="acesso-senha" className="input" type={ver ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          <Button variant="soft" onClick={() => { setSenha(gerarSenha()); setVer(true) }}>Gerar</Button>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[12.5px]">
          <button type="button" className="text-brand font-semibold hover:underline" onClick={() => setVer((v) => !v)}>{ver ? 'Ocultar' : 'Mostrar'}</button>
          <button type="button" disabled={!senha} className="text-brand font-semibold hover:underline disabled:opacity-50" onClick={() => { void navigator.clipboard?.writeText(senha); toast('Senha copiada.') }}>Copiar</button>
        </div>
        <p className="text-[12px] text-muted mt-3">O login é o e-mail do cadastro. Repasse a senha por um canal seguro e peça para a pessoa trocar depois em "Esqueceu a senha?".</p>
      </Modal>
    </Card>
  )
}
