import { useMemo, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore, type PessoaInput } from '@/lib/store'
import { PageHeader, Card, Badge, Button, Avatar, EmptyState, Tabs, SearchBox, Select, Tabela, TH, TD, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { fmtDate, STATUS_COLAB, REGIME_LABEL } from '@/lib/utils'
import { hojeISO, somarDias } from '@/domain/datas'
import { gerarCSV, baixarArquivo, lerCSV } from '@/domain/csv'
import { soDigitos } from '@/domain/validacao'
import { PessoaForm } from './PessoaForm'
import { MODO_DEMO } from '@/data/config'

const POR_PAGINA = 20
const COLUNAS_IMPORT = ['Nome completo', 'E-mail', 'Telefone', 'Área', 'Função', 'Início da parceria (AAAA-MM-DD)', 'Forma (PJ/MEI/autonomo)', 'CNPJ', 'Razão social']

export default function Pessoas() {
  const s = useStore()
  const navigate = useNavigate()
  const hoje = hojeISO()
  const [q, setQ] = useState('')
  const [status, setStatus] = useState('vigentes')
  const [setor, setSetor] = useState('todos')
  const [regime, setRegime] = useState('todos')
  const [pagina, setPagina] = useState(1)
  const [novo, setNovo] = useState(false)
  const [importar, setImportar] = useState(false)

  const lista = useMemo(() => {
    const t = q.trim().toLowerCase()
    const dig = soDigitos(q)
    return s.colaboradores
      .filter((c) => status === 'todos' || (status === 'vigentes' ? c.status !== 'encerrado' : c.status === status))
      .filter((c) => setor === 'todos' || c.setorId === setor)
      .filter((c) => regime === 'todos' || c.regime === regime)
      .filter((c) => !t || `${c.nome} ${c.nomeSocial ?? ''} ${c.email} ${c.razaoSocial}`.toLowerCase().includes(t) || (dig.length >= 3 && soDigitos(c.cnpj).includes(dig)))
      .sort((a, b) => a.nome.localeCompare(b.nome))
  }, [s.colaboradores, q, status, setor, regime])
  const paginas = Math.max(1, Math.ceil(lista.length / POR_PAGINA))
  const pag = Math.min(pagina, paginas)
  const visiveis = lista.slice((pag - 1) * POR_PAGINA, pag * POR_PAGINA)
  const contrato = (id: string) => s.contratos.filter((k) => k.colaboradorId === id).sort((a, b) => b.inicio.localeCompare(a.inicio))[0]
  const cont = (st: string) => s.colaboradores.filter((c) => (st === 'vigentes' ? c.status !== 'encerrado' : st === 'todos' ? true : c.status === st)).length

  const exportar = () => {
    const csv = gerarCSV(lista, [
      { titulo: 'Nome', valor: (c) => c.nome }, { titulo: 'E-mail', valor: (c) => c.email }, { titulo: 'Área', valor: (c) => s.setorNome(c.setorId) },
      { titulo: 'Função', valor: (c) => s.cargoNome(c.cargoId) }, { titulo: 'Forma', valor: (c) => REGIME_LABEL[c.regime] }, { titulo: 'CNPJ', valor: (c) => c.cnpj },
      { titulo: 'Razão social', valor: (c) => c.razaoSocial }, { titulo: 'Início da parceria', valor: (c) => c.dataEntrada }, { titulo: 'Situação', valor: (c) => STATUS_COLAB[c.status].label },
      { titulo: 'Contrato até', valor: (c) => contrato(c.id)?.fim ?? '' }, { titulo: 'Encerramento', valor: (c) => c.encerramento?.data ?? '' },
    ], [`Pessoas — 4JURIS`, `Filtros: situação=${status}; área=${setor === 'todos' ? 'todas' : s.setorNome(setor)}; forma=${regime}; busca="${q}"`, `Gerado em ${new Date().toLocaleString('pt-BR')}`, 'Dados bancários e pessoais sensíveis não são exportados.', ...(MODO_DEMO ? ['Dados fictícios de demonstração'] : [])])
    baixarArquivo(csv, `pessoas-${hoje}.csv`)
    toast(`${lista.length} registro(s) exportado(s).`)
  }

  return (
    <>
      <PageHeader title="Pessoas & contratos" subtitle="Cadastro de prestadores, contratos, documentos, registros e encerramentos."
        actions={<>
          <Button variant="ghost" icon="Download" onClick={exportar}>Exportar</Button>
          <Button variant="ghost" icon="Upload" onClick={() => setImportar(true)}>Importar CSV</Button>
          <Button icon="UserPlus" onClick={() => setNovo(true)}>Nova pessoa</Button>
        </>} />

      <Tabs tabs={[
        { key: 'vigentes', label: `Vigentes (${cont('vigentes')})` }, { key: 'integracao', label: `Em integração (${cont('integracao')})` },
        { key: 'pendente', label: `Pendentes (${cont('pendente')})` }, { key: 'encerrado', label: `Encerradas (${cont('encerrado')})` }, { key: 'todos', label: 'Todas' },
      ]} active={status} onChange={(k) => { setStatus(k); setPagina(1) }} />

      <div className="flex flex-wrap items-center gap-3 mb-4">
        <SearchBox value={q} onChange={(v) => { setQ(v); setPagina(1) }} placeholder="Nome, e-mail, razão social ou CNPJ" label="Buscar pessoas" />
        <Select label="Filtrar por área" value={setor} onChange={(v) => { setSetor(v); setPagina(1) }}><option value="todos">Todas as áreas</option>{s.setores.map((a) => <option key={a.id} value={a.id}>{a.nome}</option>)}</Select>
        <Select label="Filtrar por forma de contratação" value={regime} onChange={(v) => { setRegime(v); setPagina(1) }}><option value="todos">Todas as formas</option>{Object.entries(REGIME_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</Select>
        <span className="text-[12.5px] text-muted ml-auto">{lista.length} pessoa(s)</span>
      </div>

      <Card>
        {lista.length === 0 ? <EmptyState icon="Users" title="Ninguém encontrado" desc="Ajuste a busca ou os filtros." action={<Button icon="UserPlus" onClick={() => setNovo(true)}>Cadastrar pessoa</Button>} /> : (
          <>
            <Tabela minWidth={820}>
              <thead><tr><th className={TH}>Pessoa</th><th className={TH}>Área · Função</th><th className={TH}>Forma</th><th className={TH}>Início</th><th className={TH}>Contrato</th><th className={TH}>Situação</th></tr></thead>
              <tbody>
                {visiveis.map((c) => {
                  const k = contrato(c.id)
                  const vence = k?.fim && k.status !== 'encerrado' && k.fim <= somarDias(hoje, 60)
                  const st = STATUS_COLAB[c.status]
                  return (
                    <tr key={c.id} className="hover:bg-brand-50/40 cursor-pointer" onClick={() => navigate(`/rh/pessoas/${c.id}`)}>
                      <td className={TD}>
                        <div className="flex items-center gap-3">
                          <Avatar nome={c.nome} cor={c.avatarCor} size="sm" />
                          <div className="min-w-0"><Link to={`/rh/pessoas/${c.id}`} onClick={(e) => e.stopPropagation()} className="font-semibold text-ink hover:text-brand">{c.nome}</Link><div className="text-[11.5px] text-muted truncate">{c.email}</div></div>
                        </div>
                      </td>
                      <td className={TD}><div className="text-ink-2">{s.setorNome(c.setorId)}</div><div className="text-[11.5px] text-muted">{s.cargoNome(c.cargoId)}</div></td>
                      <td className={TD}>{c.regime}</td>
                      <td className={TD}>{fmtDate(c.dataEntrada)}</td>
                      <td className={TD}>{!k ? <span className="text-muted">—</span> : vence ? <Badge tone="warning" dot>Vence {fmtDate(k.fim)}</Badge> : <span className="text-[12.5px] text-ink-2">{k.fim ? `até ${fmtDate(k.fim)}` : 'Indeterminado'}</span>}</td>
                      <td className={TD}><Badge tone={st.tone} dot>{st.label}</Badge></td>
                    </tr>
                  )
                })}
              </tbody>
            </Tabela>
            {paginas > 1 && (
              <nav aria-label="Paginação" className="flex items-center justify-between px-4 py-3 border-t border-line text-[12.5px]">
                <span className="text-muted">Página {pag} de {paginas}</span>
                <div className="flex gap-2">
                  <Button size="sm" variant="ghost" icon="ChevronLeft" disabled={pag <= 1} onClick={() => setPagina(pag - 1)}>Anterior</Button>
                  <Button size="sm" variant="ghost" disabled={pag >= paginas} onClick={() => setPagina(pag + 1)}>Próxima</Button>
                </div>
              </nav>
            )}
          </>
        )}
      </Card>

      {novo && <PessoaForm onClose={() => setNovo(false)} onSalvo={(id) => id && navigate(`/rh/pessoas/${id}`)} />}
      {importar && <ImportarModal onClose={() => setImportar(false)} />}
    </>
  )
}

function ImportarModal({ onClose }: { onClose: () => void }) {
  const s = useStore()
  const [linhas, setLinhas] = useState<PessoaInput[]>([])
  const [arquivo, setArquivo] = useState('')
  const [erroArquivo, setErroArquivo] = useState('')
  const [resultado, setResultado] = useState<{ criadas: number; erros: { linha: number; erro: string }[] } | null>(null)

  const modelo = () => baixarArquivo('﻿' + COLUNAS_IMPORT.join(';') + '\r\n', 'modelo-importacao-pessoas.csv')

  const ler = async (f: File) => {
    setErroArquivo(''); setResultado(null); setArquivo(f.name)
    const texto = await f.text()
    const rows = lerCSV(texto)
    if (rows.length < 2) { setErroArquivo('O arquivo não tem linhas de dados.'); setLinhas([]); return }
    const [cab, ...dados] = rows
    const idx = (nome: string) => cab.findIndex((c) => c.trim().toLowerCase().startsWith(nome.toLowerCase()))
    const iNome = idx('Nome'), iEmail = idx('E-mail'), iTel = idx('Telefone'), iArea = idx('Área'), iFunc = idx('Função'), iIni = idx('Início'), iForma = idx('Forma'), iCnpj = idx('CNPJ'), iRs = idx('Razão')
    if (iNome < 0 || iEmail < 0 || iArea < 0) { setErroArquivo('Cabeçalho inválido. Use o modelo (colunas Nome completo, E-mail e Área são obrigatórias).'); setLinhas([]); return }
    const porNome = <T extends { id: string; nome: string }>(lista: T[], nome: string) => lista.find((x) => x.nome.toLowerCase() === nome.trim().toLowerCase())
    setLinhas(dados.map((r) => {
      const area = porNome(s.setores, r[iArea] ?? '')
      const func = area ? porNome(s.cargos.filter((g) => g.setorId === area.id), r[iFunc] ?? '') : undefined
      const forma = (r[iForma] ?? 'PJ').trim()
      return {
        nome: r[iNome] ?? '', email: r[iEmail] ?? '', telefone: iTel >= 0 ? r[iTel] : '', papel: 'colaborador', setorId: area?.id ?? '',
        cargoId: func?.id, status: 'integracao', dataEntrada: (iIni >= 0 && r[iIni]?.trim()) || hojeISO(),
        regime: (['PJ', 'MEI', 'autonomo'].includes(forma) ? forma : 'PJ') as PessoaInput['regime'], cnpj: iCnpj >= 0 ? r[iCnpj] : '', razaoSocial: iRs >= 0 ? r[iRs] : '',
      }
    }))
  }

  const confirmar = () => {
    const r = s.importarPessoas(linhas)
    setResultado(r)
    toast(`${r.criadas} pessoa(s) importada(s)${r.erros.length ? `, ${r.erros.length} com erro` : ''}.`, r.erros.length ? 'info' : 'success')
    setLinhas([])
  }

  return (
    <Modal open onClose={onClose} wide title="Importar pessoas (CSV)" subtitle="Cada linha é validada individualmente; linhas com erro não são importadas."
      footer={<><Button variant="ghost" onClick={onClose}>Fechar</Button>{linhas.length > 0 && <Button icon="Upload" onClick={confirmar}>Importar {linhas.length} linha(s)</Button>}</>}>
      <ol className="text-[13px] text-ink-2 space-y-1.5 list-decimal pl-5 mb-4">
        <li>Baixe o <button type="button" onClick={modelo} className="text-brand font-semibold underline">modelo de planilha</button> (separador “;”).</li>
        <li>Área e Função devem ter o mesmo nome cadastrado em Estrutura.</li>
        <li>Selecione o arquivo e confira a prévia antes de importar.</li>
      </ol>
      <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line-strong rounded-xl py-6 cursor-pointer hover:border-brand hover:bg-brand-50/50 transition">
        <span className="text-[13px] font-medium text-ink-2">{arquivo || 'Clique para selecionar um arquivo .csv'}</span>
        <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => e.target.files?.[0] && ler(e.target.files[0])} />
      </label>
      {erroArquivo && <Callout tone="danger" icon="AlertCircle" className="mt-4">{erroArquivo}</Callout>}
      {linhas.length > 0 && (
        <div className="mt-4 max-h-56 overflow-auto rounded-xl border border-line">
          <table className="w-full text-[12px]"><thead><tr className="bg-surface-2 text-left text-muted"><th className="p-2">Nome</th><th className="p-2">E-mail</th><th className="p-2">Área</th><th className="p-2">CNPJ</th></tr></thead>
            <tbody>{linhas.map((l, i) => <tr key={i} className="border-t border-line"><td className="p-2">{l.nome}</td><td className="p-2">{l.email}</td><td className="p-2">{l.setorId ? s.setorNome(l.setorId) : <span className="text-danger">não encontrada</span>}</td><td className="p-2">{l.cnpj}</td></tr>)}</tbody>
          </table>
        </div>
      )}
      {resultado && (
        <div className="mt-4 space-y-2">
          <Callout tone={resultado.erros.length ? 'warning' : 'success'} icon="ListChecks">{resultado.criadas} criada(s), {resultado.erros.length} com erro.</Callout>
          {resultado.erros.length > 0 && <ul className="text-[12.5px] text-danger space-y-1 max-h-40 overflow-auto">{resultado.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.erro}</li>)}</ul>}
        </div>
      )}
    </Modal>
  )
}
