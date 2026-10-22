import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { Papel } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Avatar, Tabs, SearchBox, Select, Badge, Callout, Icon, Tabela, TH, TD } from '@/components/ui'
import { ConfirmModal, Modal } from '@/components/Modal'
import { feedback, toast } from '@/components/toast'
import { STATUS_COLAB, cn } from '@/lib/utils'
import { MATRIZ, PAPEL_DESC, PAPEL_LABEL, type Capacidade } from '@/domain/permissions'
import { MODO_DEMO, MODO_API } from '@/data/config'
import { listarAcessos, salvarAcesso, salvarAgora, type AcessoUsuario } from '@/data/sync'
import { gerarSenha } from '@/components/AcessoPortal'
import { hojeISO } from '@/domain/datas'
import { Dropdown } from '@/components/Dropdown'

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
  const caps = Object.keys(CAP_LABEL) as Capacidade[]

  return (
    <>
      <PageHeader title="Usuários & acessos" subtitle="Papéis, permissões e dados da plataforma."
        actions={MODO_API ? <Button icon="UserPlus" onClick={() => { setNovo({ nome: '', email: '', papel: 'colaborador', setorId: s.setores[0]?.id ?? '', senha: '' }); setVerNovaSenha(false) }}>Criar acesso</Button> : undefined} />
      <Tabs tabs={[{ key: 'usuarios', label: 'Usuários e papéis' }, { key: 'matriz', label: 'Matriz de permissões' }, { key: 'dados', label: 'Dados da demonstração' }]} active={tab} onChange={setTab} />

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
                          <Button size="sm" variant={acessos[c.id] ? 'soft' : 'primary'} icon={acessos[c.id] ? 'KeyRound' : 'UserPlus'} onClick={() => abrirAcesso(c.id)}>
                            {acessos[c.id] ? 'Nova senha' : 'Criar acesso'}
                          </Button>
                          {acessos[c.id] && c.id !== me.id && (
                            <Button size="sm" variant="ghost" onClick={() => void alternarAtivo(c.id, !acessos[c.id].ativo)}>{acessos[c.id].ativo ? 'Desativar' : 'Reativar'}</Button>
                          )}
                        </div>
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

      <ConfirmModal open={resetar} onClose={() => setResetar(false)} titulo="Restaurar dados de demonstração?" confirmar="Restaurar"
        texto="Todas as alterações feitas neste navegador serão descartadas e os dados fictícios originais voltarão. Você continua conectado(a)."
        onConfirm={() => { s.reset(); setResetar(false); toast('Dados de demonstração restaurados.') }} />
    </>
  )
}
