/* Painel da liderança · Acessos da equipe: a liderança cadastra colaboradores nas áreas que lidera
   e cria/envia o acesso ao portal deles. O servidor confere tudo de novo (api/[acao].ts e api/_v2/guarda.ts). */
import { useEffect, useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import type { Colaborador, Setor } from '@/lib/types'
import { Avatar, Badge, Button, Callout, Card, CardHead, EmptyState, Field, Select } from '@/components/ui'
import { Modal, ConfirmModal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { enviarAcessos } from '@/components/envioAcesso'
import { listarAcessos, salvarAcesso, salvarAgora, type AcessoUsuario } from '@/data/sync'
import { MODO_API } from '@/data/config'
import { can } from '@/domain/permissions'
import { areasLideradas } from '@/domain/visibilidade'
import { hojeISO } from '@/domain/datas'
import { emailValido } from '@/domain/validacao'
import { dataBR } from '@/lib/fmt'

type Situacao = { rotulo: string; tom: string }
function situacao(a: AcessoUsuario | undefined): Situacao {
  if (!a) return { rotulo: 'Sem acesso', tom: 'neutral' }
  if (!a.ativo) return { rotulo: 'Desativado', tom: 'danger' }
  if (a.ultimoAcesso) return { rotulo: 'Ativo', tom: 'success' }
  if (a.conviteEnviadoEm) return { rotulo: 'Convite enviado', tom: 'warning' }
  return { rotulo: 'Acesso criado · ainda não entrou', tom: 'warning' }
}

export function AcessosEquipe({ areas, equipe }: { areas: Setor[]; equipe: Colaborador[] }) {
  const s = useStore()
  const user = s.currentUser()
  // Onde a pessoa pode cadastrar: só nas áreas que lidera de fato (RH/admin cadastram em Pessoas & contratos).
  const minhas = useMemo(() => areasLideradas(user, s.setores).filter((a) => areas.some((x) => x.id === a.id)), [user, s.setores, areas])
  const gestaoTotal = can(user.papel, 'pessoas:gerenciar')
  const podeGerir = (c: Colaborador) => can(user.papel, 'admin:usuarios') || (gestaoTotal && ['colaborador', 'gestor'].includes(c.papel))
    || (c.papel === 'colaborador' && minhas.some((a) => a.id === c.setorId))

  const [acessos, setAcessos] = useState<Record<string, AcessoUsuario>>({})
  const recarregar = () => listarAcessos().then((l) => setAcessos(Object.fromEntries(l.map((a) => [a.colaboradorId, a]))))
  useEffect(() => { if (MODO_API) void recarregar() }, [])

  const [enviando, setEnviando] = useState<string | null>(null)
  const enviar = async (id: string) => { setEnviando(id); await enviarAcessos([id]); setEnviando(null); void recarregar() }
  const [desativar, setDesativar] = useState<Colaborador | null>(null)
  const alternar = async (c: Colaborador, ativo: boolean) => {
    const falha = await salvarAcesso(c.id, { ativo })
    if (falha) { toast(falha, 'danger'); return }
    toast(ativo ? 'Acesso reativado.' : 'Acesso desativado.')
    setDesativar(null)
    void recarregar()
  }

  const vazio = { nome: '', email: '', setorId: minhas[0]?.id ?? '', cargoId: '', enviar: true }
  const [novo, setNovo] = useState<typeof vazio | null>(null)
  const [salvando, setSalvando] = useState(false)
  const cargosDaArea = novo ? s.cargos.filter((g) => !g.setorId || g.setorId === novo.setorId) : []
  const cadastrar = async () => {
    if (!novo) return
    if (novo.nome.trim().length < 3) { toast('Informe o nome completo.', 'danger'); return }
    if (!emailValido(novo.email.trim())) { toast('Informe um e-mail válido.', 'danger'); return }
    setSalvando(true)
    const r = s.salvarPessoa({ nome: novo.nome, email: novo.email, papel: 'colaborador', setorId: novo.setorId, cargoId: novo.cargoId || undefined,
      responsavelId: user.id, status: 'integracao', dataEntrada: hojeISO(), regime: 'autonomo' })
    if (!r.ok) { setSalvando(false); toast(r.erro ?? 'Não foi possível cadastrar a pessoa.', 'danger'); return }
    if (MODO_API) {
      if (!(await salvarAgora())) { setSalvando(false); toast('Não foi possível salvar o cadastro no servidor. Tente de novo.', 'danger'); return }
      if (novo.enviar && r.id) await enviarAcessos([r.id])
      void recarregar()
    } else toast('Pessoa cadastrada.')
    setSalvando(false)
    setNovo(null)
  }

  return (
    <Card>
      <CardHead title="Acessos da equipe" sub="Cadastre colaboradores nas suas áreas e envie o acesso ao portal. Contrato, dados bancários e documentos ficam com o RH."
        action={minhas.length > 0 && <Button size="sm" icon="UserPlus" onClick={() => setNovo({ ...vazio })}>Cadastrar pessoa</Button>} />
      {!MODO_API && <div className="px-5 pb-3"><Callout tone="neutral" icon="Info">Modo demonstração: o envio de acesso por e-mail só existe com o banco conectado.</Callout></div>}
      {equipe.length === 0 ? <EmptyState icon="Users" title="Nenhuma pessoa nas áreas selecionadas" /> : (
        <ul className="divide-y divide-line">
          {equipe.map((c) => {
            const a = acessos[c.id]
            const st = situacao(a)
            const gerir = podeGerir(c)
            return (
              <li key={c.id} className="flex items-center gap-3 sm:gap-4 p-4 flex-wrap sm:flex-nowrap">
                <Avatar pessoaId={c.id} nome={c.nome} cor={c.avatarCor} size="md" />
                <div className="flex-1 min-w-[180px]">
                  <div className="text-[14px] font-semibold text-ink">{c.nome}</div>
                  <div className="text-[12px] text-muted">{c.email} · {s.setorNome(c.setorId)}</div>
                  {MODO_API && a && <div className="text-[11.5px] text-muted">{a.ultimoAcesso ? `Último acesso em ${dataBR(a.ultimoAcesso)}` : a.conviteEnviadoEm ? `E-mail enviado em ${dataBR(a.conviteEnviadoEm)}` : ''}</div>}
                </div>
                {MODO_API && <Badge tone={st.tom} dot>{gerir ? st.rotulo : 'Gerido pelo RH'}</Badge>}
                {MODO_API && gerir && (!a || a.ativo) && !a?.ultimoAcesso && (
                  <Button size="sm" variant={a ? 'soft' : 'primary'} icon="Send" disabled={enviando === c.id} onClick={() => void enviar(c.id)}>
                    {enviando === c.id ? 'Enviando…' : a?.conviteEnviadoEm ? 'Reenviar acesso' : 'Enviar acesso'}
                  </Button>
                )}
                {MODO_API && gerir && a && c.id !== user.id && (a.ativo
                  ? <Button size="sm" variant="ghost" onClick={() => setDesativar(c)}>Desativar</Button>
                  : <Button size="sm" variant="ghost" onClick={() => void alternar(c, true)}>Reativar</Button>)}
              </li>
            )
          })}
        </ul>
      )}

      <Modal open={!!novo} onClose={() => setNovo(null)} title="Cadastrar pessoa na equipe" subtitle="Cadastro mínimo como colaborador(a). O RH completa contrato e demais dados."
        footer={<><Button variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button><Button icon="Check" disabled={salvando} onClick={() => void cadastrar()}>{salvando ? 'Salvando…' : 'Cadastrar'}</Button></>}>
        {novo && (
          <div className="space-y-3">
            <Field label="Nome completo" required htmlFor="eq-nome"><input id="eq-nome" className="input" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></Field>
            <Field label="E-mail" required hint="É o login da pessoa no portal." htmlFor="eq-email"><input id="eq-email" type="email" className="input" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} /></Field>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Select label="Área" value={novo.setorId} onChange={(v) => setNovo({ ...novo, setorId: v, cargoId: '' })}>{minhas.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
              <Select label="Função" value={novo.cargoId} onChange={(v) => setNovo({ ...novo, cargoId: v })}><option value="">A definir</option>{cargosDaArea.map((g) => <option key={g.id} value={g.id}>{g.nome}</option>)}</Select>
            </div>
            {MODO_API && <label className="flex items-center gap-2 text-[13px]"><input type="checkbox" checked={novo.enviar} onChange={(e) => setNovo({ ...novo, enviar: e.target.checked })} /> Enviar o e-mail de acesso agora</label>}
          </div>
        )}
      </Modal>
      <ConfirmModal open={!!desativar} onClose={() => setDesativar(null)} titulo="Desativar acesso?" confirmar="Desativar"
        texto={desativar ? `${desativar.nome} não conseguirá mais entrar no portal até que o acesso seja reativado.` : ''}
        onConfirm={() => { if (desativar) void alternar(desativar, false) }} />
    </Card>
  )
}
