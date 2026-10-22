import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Papel } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Avatar, Tabs, SearchBox, Select, Badge, Callout, Icon, Tabela, TH, TD, EmptyState } from '@/components/ui'
import { ConfirmModal, Modal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { STATUS_COLAB, cn, fmtDateTime } from '@/lib/utils'
import { MATRIZ, PAPEL_DESC, PAPEL_LABEL, type Capacidade } from '@/domain/permissions'
import { MODO_DEMO, MODO_API } from '@/data/config'
import { alterarConvite, decidirSolicitacao, lerConvite, linkCadastro, listarAcessos, listarSolicitacoes, salvarAcesso, salvarAgora, type AcessoUsuario, type Convite, type Solicitacao } from '@/data/sync'
import { gerarSenha } from '@/components/AcessoPortal'
import { hojeISO } from '@/domain/datas'
import { Dropdown } from '@/components/Dropdown'
import { ImportarColaboradores } from '@/components/ImportarColaboradores'
import { enviarAcessos } from '@/components/envioAcesso'
import { dataBR } from '@/lib/fmt'

const CAP_LABEL: Partial<Record<Capacidade, string>> = {
  'portal:usar': 'Área pessoal', 'lideranca:painel': 'Painel da liderança', 'lideranca:ver_disponibilidade_equipe': 'Ver disponibilidade da equipe',
  'eventos:gerenciar_area': 'Eventos da própria área', 'iniciativas:gerenciar': 'Iniciativas voluntárias', 'reembolsos:aprovar_area': 'Aprovar reembolsos da área',
  'rh:painel': 'Indicadores agregados', 'pessoas:gerenciar': 'Cadastro de pessoas', 'pessoas:ver_contratos': 'Contratos e valores',
  'documentos:gerenciar': 'Documentos de terceiros', 'estrutura:gerenciar': 'Estrutura', 'onboarding:gerenciar': 'Integração e conteúdos',
  'eventos:gerenciar': 'Todos os eventos', 'comunicados:publicar': 'Publicar comunicados', 'gamificacao:configurar': 'Configurar gamificação',
  'pesquisas:gerenciar': 'Pesquisas', 'disponibilidade:configurar': 'Política e agenda de disponibilidade', 'financeiro:gerenciar': 'Notas fiscais e reembolsos (gestão)',
  'relatorios:exportar': 'Exportar relatórios', 'admin:usuarios': 'Usuários e papéis', 'admin:auditoria': 'Auditoria', 'admin:privacidade': 'Anonimização (LGPD)', 'admin:dados_demo': 'Dados de demonstração',
}
const PAPEIS: Papel[] = ['colaborador', 'gestor', 'rh', 'diretoria', 'admin']

export default function Admin() {
  const s = useStore()
  const me = s.realUser()
  const [tab, setTab] = useState('usuarios')
  const [q, setQ] = useState('')
  const [papel, setPapel] = useState('todos')
  const [resetar, setResetar] = useState(false)
  const [acessos, setAcessos] = useState<Record<string, AcessoUsuario>>({})
  const [alvo, setAlvo] = useState<string | null>(null)
  const [senha, setSenha] = useState('')
  const [verSenha, setVerSenha] = useState(false)
  const [salvando, setSalvando] = useState(false)
  const [importar, setImportar] = useState(false)
  const [enviando, setEnviando] = useState<string | null>(null)
  const [confirmarEnvio, setConfirmarEnvio] = useState(false)
  const enviarEmailAcesso = async (ids: string[], chave: string) => {
    setEnviando(chave)
    await enviarAcessos(ids)
    setEnviando(null)
    void recarregarAcessos()
  }
  const recarregarAcessos = () => listarAcessos().then((l) => setAcessos(Object.fromEntries(l.map((a) => [a.colaboradorId, a]))))
  useEffect(() => { if (MODO_API && tab === 'usuarios') void recarregarAcessos() }, [tab])
  const [novo, setNovo] = useState<{ nome: string; email: string; papel: Papel; setorId: string; senha: string } | null>(null)
  const [verNovaSenha, setVerNovaSenha] = useState(false)
  /** Cria o cadastro mínimo da pessoa + o login. O restante (contrato, CNPJ, dados pessoais) é completado depois em Pessoas. */
  const criarNovoAcesso = async () => {
    if (!novo) return
    if (novo.senha.length < 10) { toast('A senha precisa ter ao menos 10 caracteres.', 'danger'); return }
    setSalvando(true)
    const r = s.salvarPessoa({ nome: novo.nome, email: novo.email, papel: novo.papel, setorId: novo.setorId, status: 'ativo', dataEntrada: hojeISO(), regime: 'autonomo' })
    if (!r.ok) { setSalvando(false); toast(r.erro ?? 'Não foi possível cadastrar a pessoa.', 'danger'); return }
    if (!(await salvarAgora())) { setSalvando(false); toast('Não foi possível salvar o cadastro no servidor. Tente de novo.', 'danger'); return }
    const falha = await salvarAcesso(r.id ?? '', { senha: novo.senha, ativo: true })
    setSalvando(false)
    if (falha) { toast(`Cadastro criado, mas o acesso não: ${falha}`, 'danger'); void recarregarAcessos(); return }
    toast('Acesso criado. Complete o cadastro em Pessoas & contratos.')
    setNovo(null)
    void recarregarAcessos()
  }
  /* ---------- cadastro por link: o link enviado às pessoas e as solicitações que chegam por ele ---------- */
  const [solicitacoes, setSolicitacoes] = useState<Solicitacao[]>([])
  const [convite, setConvite] = useState<Convite | null | undefined>(undefined)
  const [aprovando, setAprovando] = useState<{ sol: Solicitacao; nome: string; papel: Papel; setorId: string } | null>(null)
  const [recusando, setRecusando] = useState<Solicitacao | null>(null)
  const [novoLink, setNovoLink] = useState(false)
  const recarregarSolicitacoes = () => listarSolicitacoes().then(setSolicitacoes)
  useEffect(() => { if (MODO_API) void recarregarSolicitacoes() }, [tab])
  useEffect(() => { if (MODO_API && tab === 'solicitacoes') void lerConvite().then(setConvite) }, [tab])
  const pendentes = solicitacoes.filter((x) => x.status === 'pendente')
  const analisadas = solicitacoes.filter((x) => x.status !== 'pendente')
  const link = convite ? linkCadastro(convite.token) : ''
  const trocarLink = async (acao: 'gerar' | 'revogar') => {
    const r = await alterarConvite(acao)
    if (r.erro) { toast(r.erro, 'danger'); return }
    setConvite(r.convite)
    setNovoLink(false)
    toast(acao === 'gerar' ? 'Link de cadastro pronto. Copie e envie para as pessoas.' : 'Link desativado. Ninguém mais consegue se cadastrar por ele.')
  }
  const copiarLink = () => { void navigator.clipboard?.writeText(link); toast('Link copiado.') }
  const existenteDe = (email: string) => s.colaboradores.find((c) => c.email.toLowerCase() === email.toLowerCase())
  const aprovar = async () => {
    if (!aprovando) return
    const { sol } = aprovando
    setSalvando(true)
    // Quem já tem cadastro com o mesmo e-mail (feito pelo RH antes) só ganha o login; os demais ganham o cadastro mínimo.
    let id = existenteDe(sol.email)?.id
    if (!id) {
      const r = s.salvarPessoa({ nome: aprovando.nome.trim(), email: sol.email, papel: aprovando.papel, setorId: aprovando.setorId, status: 'ativo', dataEntrada: hojeISO(), regime: 'autonomo' })
      if (!r.ok) { setSalvando(false); toast(r.erro ?? 'Não foi possível cadastrar a pessoa.', 'danger'); return }
      id = r.id
    }
    if (!(await salvarAgora())) { setSalvando(false); toast('Não foi possível salvar o cadastro no servidor. Tente de novo.', 'danger'); return }
    const falha = await decidirSolicitacao(sol.id, 'aprovar', id)
    setSalvando(false)
    if (falha) { toast(falha, 'danger'); return }
    toast(`Acesso de ${sol.nome.split(' ')[0]} liberado.`)
    setAprovando(null)
    void recarregarSolicitacoes()
    void recarregarAcessos()
  }
  const recusar = async () => {
    if (!recusando) return
    const falha = await decidirSolicitacao(recusando.id, 'recusar')
    if (falha) { toast(falha, 'danger'); return }
    toast('Solicitação recusada.')
    setRecusando(null)
    void recarregarSolicitacoes()
  }
  const existenteAprovando = aprovando ? existenteDe(aprovando.sol.email) : undefined

  const pessoaAlvo = s.colaboradores.find((c) => c.id === alvo)
  const abrirAcesso = (id: string) => { setAlvo(id); setSenha(''); setVerSenha(false) }
  const gravarSenha = async () => {
    if (!alvo) return
    if (senha.length < 10) { toast('A senha precisa ter ao menos 10 caracteres.', 'danger'); return }
    setSalvando(true)
    const falha = await salvarAcesso(alvo, { senha, ativo: true })
    setSalvando(false)
    if (falha) { toast(falha, 'danger'); return }
    toast(acessos[alvo] ? 'Senha redefinida.' : 'Acesso criado.')
    setAlvo(null)
    void recarregarAcessos()
  }
  const alternarAtivo = async (id: string, ativo: boolean) => {
    const falha = await salvarAcesso(id, { ativo })
    if (falha) { toast(falha, 'danger'); return }
    toast(ativo ? 'Acesso reativado.' : 'Acesso desativado.')
    void recarregarAcessos()
  }
  const lista = useMemo(() => s.colaboradores
    .filter((c) => c.status !== 'encerrado')
    .filter((c) => papel === 'todos' || c.papel === papel)
    .filter((c) => !q.trim() || `${c.nome} ${c.email}`.toLowerCase().includes(q.trim().toLowerCase()))
    .sort((a, b) => a.nome.localeCompare(b.nome)), [s.colaboradores, q, papel])
  // Quem ainda não entrou no portal (com ou sem login criado): candidatos ao e-mail de acesso.
  const nuncaEntraram = s.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== me.id && !acessos[c.id]?.ultimoAcesso && acessos[c.id]?.ativo !== false)
  const caps = Object.keys(CAP_LABEL) as Capacidade[]

  return (
    <>
      <PageHeader title="Usuários & acessos" subtitle="Papéis, permissões e dados da plataforma."
        actions={<>
          <Button variant="soft" icon="Upload" onClick={() => setImportar(true)}>Importar planilha</Button>
          {MODO_API && <Button icon="UserPlus" onClick={() => { setNovo({ nome: '', email: '', papel: 'colaborador', setorId: s.setores[0]?.id ?? '', senha: '' }); setVerNovaSenha(false) }}>Criar acesso</Button>}
        </>} />
      <Tabs tabs={[
        { key: 'usuarios', label: 'Usuários e papéis' },
        ...(MODO_API ? [{ key: 'solicitacoes', label: pendentes.length ? `Solicitações de acesso (${pendentes.length})` : 'Solicitações de acesso' }] : []),
        { key: 'matriz', label: 'Matriz de permissões' }, { key: 'dados', label: 'Dados da demonstração' },
      ]} active={tab} onChange={setTab} />

      {tab === 'usuarios' && pendentes.length > 0 && (
        <Callout tone="warning" icon="UserPlus" className="mb-5">
          {pendentes.length === 1 ? '1 pessoa se cadastrou pelo link e aguarda' : `${pendentes.length} pessoas se cadastraram pelo link e aguardam`} aprovação.{' '}
          <button type="button" className="font-semibold underline" onClick={() => setTab('solicitacoes')}>Ver solicitações</button>
        </Callout>
      )}

      {tab === 'solicitacoes' && (
        <div className="space-y-6">
          <Card>
            <CardHead title="Link de cadastro" />
            <div className="p-5 space-y-4">
              <p className="text-[13.5px] text-ink-2">Envie este link para quem precisa de acesso. A pessoa preenche nome, e-mail e senha e o pedido aparece aqui. O acesso só é liberado quando vocês aprovarem.</p>
              {convite === undefined ? <div className="h-11 rounded-xl bg-winter animate-pulse" /> : convite ? (
                <>
                  <div className="flex flex-col sm:flex-row gap-2">
                    <div className="relative flex-1 min-w-0">
                      <Icon name="Link2" className="h-4 w-4 text-brand absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <input readOnly aria-label="Link de cadastro" className="input pl-10 font-mono text-[12.5px]" value={link} onFocus={(e) => e.target.select()} />
                    </div>
                    <Button icon="Copy" onClick={copiarLink}>Copiar link</Button>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <a className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-semibold bg-success-soft text-success-ink hover:opacity-90 transition"
                      href={`https://wa.me/?text=${encodeURIComponent(`Olá! Crie seu acesso ao Portal 4JURIS por este link: ${link}`)}`} target="_blank" rel="noreferrer">
                      <Icon name="Send" className="h-4 w-4" /> Enviar pelo WhatsApp
                    </a>
                    <a className="inline-flex items-center gap-2 h-9 px-3.5 rounded-xl text-[13px] font-semibold bg-brand-50 text-brand hover:opacity-90 transition"
                      href={`mailto:?subject=${encodeURIComponent('Seu acesso ao Portal 4JURIS')}&body=${encodeURIComponent(`Olá!\n\nCrie seu acesso ao Portal 4JURIS por este link:\n${link}\n\nDepois do cadastro, a equipe aprova e você recebe a liberação.`)}`}>
                      <Icon name="Mail" className="h-4 w-4" /> Enviar por e-mail
                    </a>
                    <span className="flex-1" />
                    <Button size="sm" variant="ghost" icon="RefreshCw" onClick={() => setNovoLink(true)}>Gerar novo link</Button>
                    <Button size="sm" variant="ghost" icon="Link2Off" onClick={() => void trocarLink('revogar')}>Desativar</Button>
                  </div>
                  <p className="text-[12px] text-muted">Criado em {fmtDateTime(convite.criadoEm)}. Gerar um novo link desativa este.</p>
                </>
              ) : (
                <div className="flex flex-wrap items-center gap-3">
                  <Button icon="Link2" onClick={() => void trocarLink('gerar')}>Gerar link de cadastro</Button>
                  <span className="text-[12.5px] text-muted">Nenhum link ativo no momento.</span>
                </div>
              )}
            </div>
          </Card>

          <Card>
            <CardHead title={`Aguardando aprovação${pendentes.length ? ` · ${pendentes.length}` : ''}`} />
            {pendentes.length === 0 ? (
              <EmptyState icon="UserCheck" title="Nenhuma solicitação pendente" desc="Quando alguém se cadastrar pelo link, o pedido aparece aqui." />
            ) : (
              <ul className="divide-y divide-line">
                {pendentes.map((x) => {
                  const ja = existenteDe(x.email)
                  return (
                    <li key={x.id} className="p-4 sm:px-5 flex flex-col sm:flex-row sm:items-center gap-3">
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <Avatar nome={x.nome} size="sm" />
                        <div className="min-w-0">
                          <div className="font-semibold text-ink truncate">{x.nome}</div>
                          <div className="text-[12px] text-muted truncate">{x.email} · {fmtDateTime(x.criadoEm)}</div>
                          {ja && <div className="text-[11.5px] text-brand font-semibold mt-0.5">Já cadastrado(a) em Pessoas como {ja.nome}</div>}
                        </div>
                      </div>
                      <div className="flex gap-2 shrink-0">
                        <Button size="sm" variant="ghost" icon="X" onClick={() => setRecusando(x)}>Recusar</Button>
                        <Button size="sm" icon="Check" onClick={() => setAprovando({ sol: x, nome: x.nome, papel: 'colaborador', setorId: s.setores[0]?.id ?? '' })}>Aprovar</Button>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>

          {analisadas.length > 0 && (
            <Card>
              <CardHead title="Analisadas nos últimos 30 dias" />
              <Tabela minWidth={560}>
                <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Pedido</th><th className={TH}>Decisão</th></tr></thead>
                <tbody>
                  {analisadas.map((x) => (
                    <tr key={x.id}>
                      <td className={TD}>
                        {x.colaboradorId && s.colaboradores.some((c) => c.id === x.colaboradorId)
                          ? <Link to={`/rh/pessoas/${x.colaboradorId}`} className="font-semibold text-ink hover:text-brand">{x.nome}</Link>
                          : <span className="font-semibold text-ink">{x.nome}</span>}
                        <div className="text-[11.5px] text-muted">{x.email}</div>
                      </td>
                      <td className={TD}>{fmtDateTime(x.criadoEm)}</td>
                      <td className={TD}><Badge tone={x.status === 'aprovado' ? 'success' : 'neutral'} dot>{x.status === 'aprovado' ? 'Aprovado' : 'Recusado'}</Badge> <span className="text-[11.5px] text-muted ml-1">{fmtDateTime(x.decididoEm ?? undefined)}</span></td>
                    </tr>
                  ))}
                </tbody>
              </Tabela>
            </Card>
          )}
        </div>
      )}

      {tab === 'usuarios' && (
        <>
          <div className="grid sm:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {PAPEIS.map((p) => (
              <button key={p} type="button" aria-pressed={papel === p} onClick={() => setPapel(papel === p ? 'todos' : p)} className={cn('card p-4 text-left hover:shadow-sm transition', papel === p && 'ring-2 ring-brand')}>
                <div className="text-[22px] font-extrabold text-ink">{s.colaboradores.filter((c) => c.papel === p && c.status !== 'encerrado').length}</div>
                <div className="text-[12.5px] font-semibold text-ink-2">{PAPEL_LABEL[p]}</div>
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3 mb-4">
            <SearchBox value={q} onChange={setQ} placeholder="Nome ou e-mail" label="Buscar usuários" />
            <Select label="Papel" value={papel} onChange={setPapel}><option value="todos">Todos os papéis</option>{PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</Select>
            {MODO_API && nuncaEntraram.length > 0 && (
              <Button icon="Mail" variant="soft" className="ml-auto" disabled={!!enviando} onClick={() => setConfirmarEnvio(true)}>
                {enviando === 'todos' ? 'Enviando…' : `Enviar acesso por e-mail (${nuncaEntraram.length})`}
              </Button>
            )}
          </div>
          <Card>
            <Tabela minWidth={720}>
              <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Área</th><th className={TH}>Situação</th><th className={TH}>Papel de acesso</th>{MODO_API && <th className={TH}>Acesso ao portal</th>}</tr></thead>
              <tbody>
                {lista.map((c) => (
                  <tr key={c.id}>
                    <td className={TD}><div className="flex items-center gap-3"><Avatar nome={c.nome} cor={c.avatarCor} size="sm" /><div><Link to={`/rh/pessoas/${c.id}`} className="font-semibold text-ink hover:text-brand">{c.nome}</Link><div className="text-[11.5px] text-muted">{c.email}</div></div></div></td>
                    <td className={TD}>{s.setorNome(c.setorId)}</td>
                    <td className={TD}><Badge tone={STATUS_COLAB[c.status].tone} dot>{STATUS_COLAB[c.status].label}</Badge></td>
                    <td className={TD}>
                      <Dropdown aria-label={`Papel de ${c.nome}`} className="input !h-9 w-auto" value={c.papel} disabled={c.id === me.id}
                        onChange={(e) => feedback(s.alterarPapel(c.id, e.target.value as Papel), `Papel de ${c.nome.split(' ')[0]} alterado para ${PAPEL_LABEL[e.target.value as Papel]}.`)}>
                        {PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}
                      </Dropdown>
                      {c.id === me.id && <span className="text-[11px] text-muted ml-2">você</span>}
                    </td>
                    {MODO_API && (
                      <td className={TD}>
                        <div className="flex flex-wrap items-center gap-2">
                          {acessos[c.id]
                            ? <Badge tone={acessos[c.id].ativo ? 'success' : 'neutral'} dot>{acessos[c.id].ativo ? 'Com acesso' : 'Desativado'}</Badge>
                            : <Badge tone="warning" dot>Sem acesso</Badge>}
                          {c.id !== me.id && !acessos[c.id]?.ultimoAcesso && acessos[c.id]?.ativo !== false && (
                            <Button size="sm" variant="soft" icon="Mail" disabled={!!enviando} onClick={() => void enviarEmailAcesso([c.id], c.id)}>
                              {enviando === c.id ? 'Enviando…' : acessos[c.id]?.conviteEnviadoEm ? 'Reenviar e-mail' : 'Enviar por e-mail'}
                            </Button>
                          )}
                          <Button size="sm" variant={acessos[c.id] ? 'soft' : 'primary'} icon={acessos[c.id] ? 'KeyRound' : 'UserPlus'} onClick={() => abrirAcesso(c.id)}>
                            {acessos[c.id] ? 'Nova senha' : 'Criar acesso'}
                          </Button>
                          {acessos[c.id] && c.id !== me.id && (
                            <Button size="sm" variant="ghost" onClick={() => void alternarAtivo(c.id, !acessos[c.id].ativo)}>{acessos[c.id].ativo ? 'Desativar' : 'Reativar'}</Button>
                          )}
                        </div>
                        {acessos[c.id] && (
                          <div className="text-[11px] text-muted mt-1">
                            {acessos[c.id].ultimoAcesso ? `Último acesso em ${dataBR(acessos[c.id].ultimoAcesso)}` : acessos[c.id].conviteEnviadoEm ? `E-mail enviado em ${dataBR(acessos[c.id].conviteEnviadoEm)} · ainda não entrou` : 'Ainda não entrou'}
                          </div>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Card>
          <p className="text-[12px] text-muted mt-3">Pessoas com parceria encerrada perdem o acesso automaticamente. Cadastros novos são feitos em <Link to="/rh/pessoas" className="text-brand font-semibold">Pessoas & contratos</Link>.</p>
        </>
      )}

      {tab === 'matriz' && (
        <>
          <div className="grid md:grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
            {PAPEIS.map((p) => <Card key={p} className="p-4"><div className="text-[13.5px] font-bold text-ink">{PAPEL_LABEL[p]}</div><p className="text-[12px] text-muted mt-1">{PAPEL_DESC[p]}</p></Card>)}
          </div>
          <Card>
            <Tabela minWidth={760}>
              <thead><tr><th className={TH}>Capacidade</th>{PAPEIS.map((p) => <th key={p} className={cn(TH, 'text-center')}>{PAPEL_LABEL[p]}</th>)}</tr></thead>
              <tbody>
                {caps.map((c) => (
                  <tr key={c}>
                    <td className={TD}>{CAP_LABEL[c]}<div className="text-[10.5px] text-muted font-mono">{c}</div></td>
                    {PAPEIS.map((p) => <td key={p} className={cn(TD, 'text-center')}>{MATRIZ[p].includes(c) ? <Icon name="Check" className="h-4 w-4 text-success inline" aria-label="permitido" /> : <span className="text-muted-2" aria-label="não permitido">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </Tabela>
          </Card>
          <Callout tone="warning" icon="ServerCog" className="mt-4">A matriz é aplicada na interface e na camada de dados da demonstração. Em produção, ela precisa ser replicada no servidor (ex.: políticas RLS) — esconder botões não é segurança.</Callout>
        </>
      )}

      {tab === 'dados' && (
        <Card className="p-5 sm:p-6 max-w-2xl">
          <CardHead title="Armazenamento atual" />
          <div className="p-5 space-y-3 text-[13.5px] text-ink-2">
            <p><b>Fonte de dados:</b> {MODO_DEMO ? 'demonstração (localStorage deste navegador)' : 'banco de dados (Supabase / PostgreSQL)'}</p>
            {MODO_DEMO
              ? <p>Os dados ficam somente neste navegador. Outras pessoas e outros dispositivos não veem estas alterações. Não há backup em servidor.</p>
              : <p>Tudo o que é feito aqui é gravado no banco de dados, e o acesso exige login com senha. Faça backups pelo painel do Supabase.</p>}
            <p className="text-[12.5px] text-muted">{s.colaboradores.length} pessoas · {s.eventos.length} eventos · {s.lancamentos.length} lançamentos de pontos · {s.auditoria.length} registros de auditoria</p>
            {MODO_DEMO && <Button variant="danger" icon="RotateCcw" onClick={() => setResetar(true)}>Restaurar dados de demonstração</Button>}
          </div>
        </Card>
      )}

      <Modal open={!!novo} onClose={() => setNovo(null)} title="Criar acesso" subtitle="Cadastro mínimo e login. Depois complete os dados em Pessoas & contratos."
        footer={<><Button variant="ghost" onClick={() => setNovo(null)}>Cancelar</Button><Button icon="Check" disabled={salvando || !novo || novo.senha.length < 10 || !novo.nome.trim() || !novo.email.trim()} onClick={() => void criarNovoAcesso()}>{salvando ? 'Criando…' : 'Criar acesso'}</Button></>}>
        {novo && (
          <div className="space-y-3">
            <div><label className="label" htmlFor="novo-nome">Nome completo</label><input id="novo-nome" className="input" value={novo.nome} onChange={(e) => setNovo({ ...novo, nome: e.target.value })} /></div>
            <div><label className="label" htmlFor="novo-email">E-mail (será o login)</label><input id="novo-email" className="input" type="email" value={novo.email} onChange={(e) => setNovo({ ...novo, email: e.target.value })} autoComplete="off" /></div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Papel" value={novo.papel} onChange={(v) => setNovo({ ...novo, papel: v as Papel })}>{PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</Select>
              <Select label="Área" value={novo.setorId} onChange={(v) => setNovo({ ...novo, setorId: v })}>{s.setores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
            </div>
            <div>
              <label className="label" htmlFor="novo-senha">Senha (mínimo 10 caracteres)</label>
              <div className="flex gap-2">
                <input id="novo-senha" className="input" type={verNovaSenha ? 'text' : 'password'} value={novo.senha} onChange={(e) => setNovo({ ...novo, senha: e.target.value })} autoComplete="new-password" />
                <Button variant="soft" onClick={() => { setNovo({ ...novo, senha: gerarSenha() }); setVerNovaSenha(true) }}>Gerar</Button>
              </div>
              <div className="flex items-center gap-4 mt-2 text-[12.5px]">
                <button type="button" className="text-brand font-semibold hover:underline" onClick={() => setVerNovaSenha((v) => !v)}>{verNovaSenha ? 'Ocultar' : 'Mostrar'}</button>
                <button type="button" disabled={!novo.senha} className="text-brand font-semibold hover:underline disabled:opacity-50" onClick={() => { void navigator.clipboard?.writeText(novo.senha); toast('Senha copiada.') }}>Copiar</button>
              </div>
            </div>
          </div>
        )}
      </Modal>

      <Modal open={!!alvo} onClose={() => setAlvo(null)} title={alvo && acessos[alvo] ? 'Nova senha de acesso' : 'Criar acesso ao portal'}
        subtitle={pessoaAlvo ? `${pessoaAlvo.nome} · ${pessoaAlvo.email}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setAlvo(null)}>Cancelar</Button><Button icon="Check" disabled={salvando || senha.length < 10} onClick={() => void gravarSenha()}>{salvando ? 'Salvando…' : 'Salvar'}</Button></>}>
        <label className="label" htmlFor="acesso-senha">Senha (mínimo 10 caracteres)</label>
        <div className="flex gap-2">
          <input id="acesso-senha" className="input" type={verSenha ? 'text' : 'password'} value={senha} onChange={(e) => setSenha(e.target.value)} autoComplete="new-password" />
          <Button variant="soft" onClick={() => { setSenha(gerarSenha()); setVerSenha(true) }}>Gerar</Button>
        </div>
        <div className="flex items-center gap-4 mt-2 text-[12.5px]">
          <button type="button" className="text-brand font-semibold hover:underline" onClick={() => setVerSenha((v) => !v)}>{verSenha ? 'Ocultar' : 'Mostrar'}</button>
          <button type="button" disabled={!senha} className="text-brand font-semibold hover:underline disabled:opacity-50" onClick={() => { void navigator.clipboard?.writeText(senha); toast('Senha copiada.') }}>Copiar</button>
        </div>
        <p className="text-[12px] text-muted mt-3">O login é o e-mail do cadastro da pessoa. Repasse a senha por um canal seguro e peça para ela trocar depois em "Esqueceu a senha?".</p>
      </Modal>

      <Modal open={!!aprovando} onClose={() => setAprovando(null)} title="Aprovar acesso" subtitle={aprovando ? `${aprovando.sol.nome} · ${aprovando.sol.email}` : undefined}
        footer={<><Button variant="ghost" onClick={() => setAprovando(null)}>Cancelar</Button><Button icon="Check" disabled={salvando || (!existenteAprovando && !aprovando?.nome.trim())} onClick={() => void aprovar()}>{salvando ? 'Liberando…' : 'Aprovar e liberar acesso'}</Button></>}>
        {aprovando && (existenteAprovando ? (
          <Callout tone="brand" icon="UserCheck">
            Já existe um cadastro com este e-mail: <b>{existenteAprovando.nome}</b> ({PAPEL_LABEL[existenteAprovando.papel]}, {s.setorNome(existenteAprovando.setorId)}). O login será vinculado a ele, com a senha que a pessoa escolheu.
          </Callout>
        ) : (
          <div className="space-y-3">
            <div><label className="label" htmlFor="apr-nome">Nome completo</label><input id="apr-nome" className="input" value={aprovando.nome} onChange={(e) => setAprovando({ ...aprovando, nome: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-3">
              <Select label="Papel" value={aprovando.papel} onChange={(v) => setAprovando({ ...aprovando, papel: v as Papel })}>{PAPEIS.map((p) => <option key={p} value={p}>{PAPEL_LABEL[p]}</option>)}</Select>
              <Select label="Área" value={aprovando.setorId} onChange={(v) => setAprovando({ ...aprovando, setorId: v })}>{s.setores.map((x) => <option key={x.id} value={x.id}>{x.nome}</option>)}</Select>
            </div>
            <p className="text-[12px] text-muted">A pessoa entra com o e-mail e a senha que cadastrou. Contrato, CNPJ e demais dados são completados depois em Pessoas & contratos.</p>
          </div>
        ))}
      </Modal>

      {importar && <ImportarColaboradores onClose={() => setImportar(false)} onConcluido={() => { setTab('usuarios'); if (MODO_API) void recarregarAcessos() }} />}

      <ConfirmModal open={!!recusando} onClose={() => setRecusando(null)} titulo="Recusar solicitação?" confirmar="Recusar"
        texto={recusando ? `${recusando.nome} (${recusando.email}) não terá acesso ao portal. Se tentar entrar, verá que o cadastro não foi aprovado.` : ''}
        onConfirm={() => void recusar()} />

      <ConfirmModal open={confirmarEnvio} onClose={() => setConfirmarEnvio(false)} titulo="Enviar o acesso por e-mail?" confirmar={`Enviar para ${nuncaEntraram.length}`} perigo={false}
        onConfirm={() => { setConfirmarEnvio(false); void enviarEmailAcesso(nuncaEntraram.map((c) => c.id), 'todos') }}
        texto={<>Cada uma das <b>{nuncaEntraram.length} pessoa(s)</b> que ainda não entraram no portal recebe um e-mail com o login e um link para criar a senha (válido por 7 dias). Quem ainda não tem login ganha um agora. Um novo envio invalida o link anterior da pessoa.</>} />
      <ConfirmModal open={novoLink} onClose={() => setNovoLink(false)} titulo="Gerar um novo link?" confirmar="Gerar novo link" perigo={false}
        texto="O link atual deixa de funcionar. Quem ainda não se cadastrou vai precisar do link novo. Solicitações já enviadas continuam aqui."
        onConfirm={() => void trocarLink('gerar')} />

      <ConfirmModal open={resetar} onClose={() => setResetar(false)} titulo="Restaurar dados de demonstração?" confirmar="Restaurar"
        texto="Todas as alterações feitas neste navegador serão descartadas e os dados fictícios originais voltarão. Você continua conectado(a)."
        onConfirm={() => { s.reset(); setResetar(false); toast('Dados de demonstração restaurados.') }} />
    </>
  )
}
