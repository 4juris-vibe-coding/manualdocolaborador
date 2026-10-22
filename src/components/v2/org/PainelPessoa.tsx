/* Painel da pessoa selecionada. Mostra só o que a API entregou (já filtrado por permissão). */
import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Avatar, Badge, Button, Callout, Field, Icon, Select } from '@/components/ui'
import { api, ErroApi } from '@/data/v2/api'
import { useStore } from '@/lib/store'
import { useSync } from '@/data/sync'
import { toast } from '@/components/toast'
import { validarMudancaGestor } from '@/domain/v2/organograma'
import type { CartaoPessoa } from './tipos'

interface Props {
  pessoa: CartaoPessoa
  pessoas: Map<string, CartaoPessoa>
  filhosDe: Map<string, string[]>
  podeEditar: boolean
  podeVerPerfilCompleto: boolean
  onSelecionar: (id: string) => void
  onAtualizar: () => void
}

/** A store envia as alterações ao servidor com pequeno atraso; espera terminar antes de recarregar o mapa. */
async function aguardarGravacao(): Promise<boolean> {
  await new Promise((r) => setTimeout(r, 900))
  for (let i = 0; i < 40; i++) {
    const s = useSync.getState()
    if (!s.salvando) return !s.erro
    await new Promise((r) => setTimeout(r, 250))
  }
  return false
}

export function PainelPessoa({ pessoa, pessoas, filhosDe, podeEditar, podeVerPerfilCompleto, onSelecionar, onAtualizar }: Props) {
  const colaboradores = useStore((s) => s.colaboradores)
  const salvarPessoa = useStore((s) => s.salvarPessoa)
  const [novoGestor, setNovoGestor] = useState<string | null>(null) // null = sem alteração em edição
  const [analise, setAnalise] = useState<{ erros: string[]; avisos: string[] } | null>(null)
  const [trabalhando, setTrabalhando] = useState(false)

  const cadeia = useMemo(() => {
    const out: CartaoPessoa[] = []
    let cur = pessoa.gestorId ? pessoas.get(pessoa.gestorId) : undefined
    while (cur && out.length < 30 && !out.includes(cur)) { out.push(cur); cur = cur.gestorId ? pessoas.get(cur.gestorId) : undefined }
    return out
  }, [pessoa, pessoas])
  const equipe = (filhosDe.get(pessoa.id) ?? []).map((id) => pessoas.get(id)!).filter(Boolean)
  const gestor = pessoa.gestorId ? pessoas.get(pessoa.gestorId) : null

  const opcoes = useMemo(
    () => colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== pessoa.id).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR')),
    [colaboradores, pessoa.id])
  const atualNaStore = colaboradores.find((c) => c.id === pessoa.id)?.responsavelId ?? ''

  const iniciarEdicao = () => { setNovoGestor(atualNaStore); setAnalise(null) }
  const cancelar = () => { setNovoGestor(null); setAnalise(null) }

  const validar = async (alvo: string): Promise<{ erros: string[]; avisos: string[] }> => {
    // 1) mesma regra no cliente (resposta imediata); 2) confirmação no servidor (fonte de verdade).
    const local = validarMudancaGestor(colaboradores.map((c) => ({ id: c.id, nome: c.nome, status: c.status, responsavelId: c.responsavelId ?? null, setorId: c.setorId })), pessoa.id, alvo || null)
    if (local.erros.length) return local
    const r = await api.post<{ erros: string[]; avisos: string[] }>('organograma/validar-mudanca', { pessoaId: pessoa.id, novoGestorId: alvo || null })
    return { erros: r.erros, avisos: [...new Set([...local.avisos, ...r.avisos])] }
  }

  const salvar = async () => {
    if (novoGestor === null) return
    setTrabalhando(true)
    try {
      const v = await validar(novoGestor)
      setAnalise(v)
      if (v.erros.length) return
      if (novoGestor === atualNaStore) { toast('O gestor já é esse. Nada foi alterado.', 'info'); return }
      const atual = useStore.getState().pessoa(pessoa.id)
      if (!atual) { toast('Cadastro não encontrado.', 'danger'); return }
      const { id: _id, ...resto } = atual
      const r = salvarPessoa({ ...resto, responsavelId: novoGestor || undefined }, pessoa.id)
      if (!r.ok) { toast(r.erro, 'danger'); return }
      const gravou = await aguardarGravacao()
      toast(gravou ? 'Gestor imediato atualizado e gravado.' : 'Alterado, mas ainda não foi gravado no servidor. Mantenha a página aberta.', gravou ? 'success' : 'info')
      setNovoGestor(null); setAnalise(null)
      onAtualizar()
    } catch (e) {
      toast(e instanceof ErroApi ? e.message : 'Não foi possível validar a alteração.', 'danger')
    } finally { setTrabalhando(false) }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Avatar nome={pessoa.nome} cor={pessoa.avatarCor ?? undefined} size="xl" />
        <div className="min-w-0">
          <div className="text-[18px] font-bold text-ink">{pessoa.apelido || pessoa.nome}</div>
          {pessoa.apelido && <div className="text-[12.5px] text-muted">{pessoa.nome}</div>}
          <div className="text-[13.5px] text-ink-2">{pessoa.cargo ?? 'Função não definida'}{pessoa.nivel ? ` · ${pessoa.nivel}` : ''}</div>
          <div className="flex gap-1.5 flex-wrap mt-2">
            {pessoa.setor && <Badge tone="brand">{pessoa.setor}</Badge>}
            {pessoa.unidade && <Badge tone="neutral">{pessoa.unidade}</Badge>}
            {pessoa.lidera && <Badge tone="gold">Liderança do departamento</Badge>}
            {pessoa.status === 'integracao' && <Badge tone="warning">Em integração</Badge>}
            {pessoa.pendente && <Badge tone="warning">Pendência de cadastro</Badge>}
          </div>
        </div>
      </div>

      <section aria-labelledby="org-rel">
        <h3 id="org-rel" className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Relações hierárquicas</h3>
        <dl className="text-[13.5px] space-y-2">
          <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Gestor imediato</dt>
            <dd className="min-w-0">{gestor ? <><button type="button" className="font-semibold text-brand hover:underline" onClick={() => onSelecionar(gestor.id)}>{gestor.apelido || gestor.nome}</button>{pessoa.gestorViaDepartamento && <span className="block text-[12px] text-muted">Líder do departamento (sem gestor imediato definido no cadastro)</span>}</> : pessoa.gestorForaDaVisao ? <span className="text-ink-2">Fora do recorte atual</span> : <span className="text-ink-2">Não definido</span>}</dd></div>
          {cadeia.length > 1 && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Cadeia acima</dt><dd className="text-ink-2">{cadeia.slice(1).map((c) => c.apelido || c.nome).join(' → ')}</dd></div>}
          <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Equipe</dt><dd className="text-ink-2">{pessoa.diretos} direto{pessoa.diretos === 1 ? '' : 's'}{pessoa.totalAbaixo > pessoa.diretos ? ` · ${pessoa.totalAbaixo} no total` : ''}</dd></div>
          {pessoa.nivelHierarquico && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Nível hierárquico</dt><dd className="text-ink-2">{pessoa.nivelHierarquico}º</dd></div>}
        </dl>
        {equipe.length > 0 && (
          <ul className="mt-3 space-y-1">
            {equipe.map((e) => (
              <li key={e.id}><button type="button" onClick={() => onSelecionar(e.id)} className="w-full flex items-center gap-2.5 rounded-xl px-2 py-1.5 hover:bg-winter text-left">
                <Avatar nome={e.nome} cor={e.avatarCor ?? undefined} size="sm" /><span className="text-[13px] font-medium text-ink truncate">{e.apelido || e.nome}</span>
                <span className="text-[12px] text-muted truncate ml-auto">{e.cargo}</span></button></li>
            ))}
          </ul>
        )}
      </section>

      <section aria-labelledby="org-contato">
        <h3 id="org-contato" className="text-[12px] font-bold uppercase tracking-wide text-muted mb-2">Contato</h3>
        {pessoa.contato ? (
          <dl className="text-[13.5px] space-y-1.5">
            {pessoa.contato.email && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">E-mail</dt><dd><a className="text-brand hover:underline break-all" href={`mailto:${pessoa.contato.email}`}>{pessoa.contato.email}</a></dd></div>}
            {pessoa.contato.telefone && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Telefone</dt><dd className="text-ink-2">{pessoa.contato.telefone}</dd></div>}
            {(pessoa.contato.cidade || pessoa.contato.uf) && <div className="flex gap-2"><dt className="text-muted w-32 shrink-0">Localidade</dt><dd className="text-ink-2">{[pessoa.contato.cidade, pessoa.contato.uf].filter(Boolean).join(' / ')}</dd></div>}
            {!pessoa.contato.email && !pessoa.contato.telefone && !pessoa.contato.cidade && <p className="text-muted">Sem dados de contato cadastrados.</p>}
          </dl>
        ) : <p className="text-[13px] text-muted">Os dados de contato não são exibidos para o seu perfil ou foram ocultados pela própria pessoa.</p>}
      </section>

      {podeEditar && (
        <section aria-labelledby="org-edit" className="rounded-2xl border border-line p-4">
          <h3 id="org-edit" className="text-[14px] font-bold text-ink mb-1">Gestor imediato</h3>
          {novoGestor === null ? (
            <>
              <p className="text-[12.5px] text-muted mb-3">A alteração é validada (sem ciclos nem gestores encerrados), gravada no cadastro e registrada no histórico.</p>
              <Button variant="ghost" icon="Pencil" onClick={iniciarEdicao}>Alterar gestor imediato</Button>
            </>
          ) : (
            <>
              <Field label="Novo gestor imediato" htmlFor="org-novo-gestor">
                <Select id="org-novo-gestor" label="Novo gestor imediato" value={novoGestor} onChange={(v) => { setNovoGestor(v); setAnalise(null) }} className="w-full">
                  <option value="">Sem gestor definido</option>
                  {opcoes.map((c) => <option key={c.id} value={c.id}>{c.nomeSocial || c.nome}</option>)}
                </Select>
              </Field>
              {analise?.erros.map((e) => <Callout key={e} tone="danger" icon="XCircle" className="mb-2">{e}</Callout>)}
              {analise?.avisos.map((a) => <Callout key={a} tone="warning" icon="AlertTriangle" className="mb-2">{a}</Callout>)}
              <div className="flex gap-2 mt-3">
                <Button icon="Check" disabled={trabalhando} onClick={salvar}>{trabalhando ? 'Validando…' : 'Validar e salvar'}</Button>
                <Button variant="subtle" onClick={cancelar} disabled={trabalhando}>Cancelar</Button>
              </div>
            </>
          )}
        </section>
      )}

      {podeVerPerfilCompleto && (
        <Link to={`/rh/pessoas/${pessoa.id}`} className="inline-flex items-center gap-2 text-[13.5px] font-semibold text-brand hover:underline">
          <Icon name="ExternalLink" className="h-4 w-4" /> Ver perfil completo
        </Link>
      )}
    </div>
  )
}
