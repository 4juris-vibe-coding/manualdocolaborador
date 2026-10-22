/* Importação de colaboradores por planilha (.xlsx ou .csv), com prévia linha a linha antes de gravar. */
import { useMemo, useState } from 'react'
import { useStore } from '@/lib/store'
import { Badge, Button, Callout, Icon, Select, Toggle } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { toast } from '@/components/toast'
import { gerarSenha } from '@/components/AcessoPortal'
import { baixarArquivo, lerCSV } from '@/domain/csv'
import { aplicarImportacao, escolherAba, lerPlanilhaPessoas, modeloCSV, type Celula, type ModoImportacao, type ResultadoImportacao } from '@/domain/importacaoPessoas'
import { PAPEL_LABEL } from '@/domain/permissions'
import { MODO_API } from '@/data/config'
import { salvarAcesso, salvarAgora } from '@/data/sync'
import { cn } from '@/lib/utils'

async function lerArquivo(f: File): Promise<{ rows: Celula[][]; aba?: string }> {
  if (/\.csv$/i.test(f.name) || f.type === 'text/csv') return { rows: lerCSV(await f.text()) }
  if (!/\.xlsx$/i.test(f.name)) throw new Error('Formato não suportado. Envie um arquivo .xlsx (Excel) ou .csv.')
  const { default: lerXlsx } = await import('read-excel-file/browser')
  const abas = (await lerXlsx(f)).map((a) => ({ nome: a.sheet, rows: a.data as Celula[][] }))
  const aba = escolherAba(abas)
  if (!aba) throw new Error('A planilha está vazia.')
  return { rows: aba.rows, aba: abas.length > 1 ? aba.nome : undefined }
}

const MODOS: { valor: ModoImportacao; rotulo: string; desc: string }[] = [
  { valor: 'novos', rotulo: 'Só cadastrar quem ainda não existe', desc: 'Quem já tem cadastro fica como está. Use para subir a planilha completa sempre que entrar alguém.' },
  { valor: 'completar', rotulo: 'Cadastrar novos e completar campos vazios', desc: 'Também preenche o que estiver em branco no cadastro de quem já existe, sem trocar nada que já foi preenchido.' },
  { valor: 'atualizar', rotulo: 'Cadastrar novos e atualizar existentes', desc: 'Sobrescreve os campos de quem já existe com o que vier preenchido na planilha.' },
]

export function ImportarColaboradores({ onClose, onConcluido }: { onClose: () => void; onConcluido?: () => void }) {
  const s = useStore()
  const [arquivo, setArquivo] = useState('')
  const [lendo, setLendo] = useState(false)
  const [erroArquivo, setErroArquivo] = useState('')
  const [planilha, setPlanilha] = useState<{ rows: Celula[][]; aba?: string } | null>(null)
  const [modo, setModo] = useState<ModoImportacao>('novos')
  const [soProblemas, setSoProblemas] = useState(false)
  const [criarAcesso, setCriarAcesso] = useState(true)
  const [gravando, setGravando] = useState(false)
  const [resultado, setResultado] = useState<(ResultadoImportacao & { acessos: number; falhasAcesso: string[] }) | null>(null)

  // Refaz a prévia quando o modo muda; usa sempre o cadastro atual.
  const leitura = useMemo(() => {
    if (!planilha) return null
    const st = useStore.getState()
    return lerPlanilhaPessoas(planilha.rows, { setores: st.setores, cargos: st.cargos, pessoas: st.colaboradores, unidades: st.unidades }, undefined, { modo })
  }, [planilha, modo])

  const ler = async (f: File) => {
    setErroArquivo(''); setResultado(null); setPlanilha(null); setArquivo(f.name); setLendo(true)
    try {
      const p = await lerArquivo(f)
      const st = useStore.getState()
      const r = lerPlanilhaPessoas(p.rows, { setores: st.setores, cargos: st.cargos, pessoas: st.colaboradores, unidades: st.unidades })
      if (r.erroCabecalho) setErroArquivo(r.erroCabecalho)
      else if (!r.linhas.length) setErroArquivo('A planilha não tem linhas de dados abaixo do cabeçalho.')
      else setPlanilha(p)
    } catch (e) {
      setErroArquivo(e instanceof Error && /^(Formato|A planilha)/.test(e.message) ? e.message : 'Não consegui ler o arquivo. Confira se é uma planilha .xlsx ou .csv válida.')
    } finally { setLendo(false) }
  }

  const linhas = leitura?.linhas ?? []
  const ignoradas = linhas.filter((l) => l.acao === 'ignorar').length
  const validas = linhas.filter((l) => l.acao !== 'ignorar' && !l.erros.length)
  const novas = validas.filter((l) => l.acao === 'criar').length
  const comErro = linhas.filter((l) => l.acao !== 'ignorar' && l.erros.length).length
  const visiveis = useMemo(() => (soProblemas ? linhas.filter((l) => l.erros.length || l.avisos.length) : linhas), [linhas, soProblemas])

  const confirmar = async () => {
    setGravando(true)
    try {
      const st = useStore.getState
      const r = aplicarImportacao(validas, {
        salvarPessoa: st().salvarPessoa, pessoas: () => st().colaboradores,
        salvarCargo: st().salvarCargo, cargos: () => st().cargos,
        salvarSetor: st().salvarSetor, setores: () => st().setores,
      }, { modo })
      let acessos = 0
      const falhasAcesso: string[] = []
      if (MODO_API) {
        if (!(await salvarAgora())) { toast('Os cadastros foram alterados na tela, mas ainda não foram gravados no servidor. Mantenha a página aberta e tente de novo.', 'danger'); return }
        // Login com senha aleatória: cada pessoa define a sua em "Esqueceu a senha?" na tela de entrada.
        if (criarAcesso) {
          for (const id of r.criadas) {
            const falha = await salvarAcesso(id, { senha: gerarSenha(), ativo: true })
            if (falha) falhasAcesso.push(`${useStore.getState().nomeDe(id)}: ${falha}`)
            else acessos++
          }
        }
      }
      setResultado({ ...r, acessos, falhasAcesso })
      setPlanilha(null)
      const total = r.criadas.length + r.atualizadas.length
      toast(`${total} colaborador(es) importado(s)${r.erros.length ? `, ${r.erros.length} com erro` : ''}.`, r.erros.length ? 'info' : 'success')
      onConcluido?.()
    } finally { setGravando(false) }
  }

  const footer = (
    <>
      <Button variant="ghost" onClick={onClose}>{resultado ? 'Fechar' : 'Cancelar'}</Button>
      {leitura && validas.length > 0 && (
        <Button icon="Upload" disabled={gravando} onClick={() => void confirmar()}>
          {gravando ? 'Importando…' : `Importar ${validas.length} colaborador(es)`}
        </Button>
      )}
    </>
  )

  return (
    <Modal open onClose={onClose} wide title="Importar colaboradores por planilha" subtitle="Pode subir a planilha completa sempre: quem já tem cadastro é reconhecido pelo e-mail, CPF ou nome. Nada é gravado antes da sua confirmação." footer={footer}>
      {!resultado && (
        <>
          <ol className="text-[13px] text-ink-2 space-y-1.5 list-decimal pl-5 mb-4">
            <li>Use a planilha de colaboradores de sempre ou baixe o <button type="button" onClick={() => baixarArquivo(modeloCSV(), 'modelo-colaboradores.csv')} className="text-brand font-semibold underline">modelo</button>. As colunas são reconhecidas pelo nome (Nome, email, CARGO, Liderança, Admissão, Modalidade, CPF, Nascimento, Contato, Contato de emergência…). Se o arquivo tiver várias abas, uso a que tem nome e e-mail.</li>
            <li><b>Nome</b> e <b>E-mail</b> são obrigatórios. Funções que ainda não existem são criadas. Sem a coluna <b>Área</b>, ela vem da função ou da liderança.</li>
            <li>Em <b>Liderança</b> (ou <b>Superior direto</b>), vale o e-mail, o nome completo ou só o primeiro nome, se for único. A pessoa indicada vira liderança das áreas de quem ela lidera.</li>
          </ol>
          <label className={cn('flex flex-col items-center justify-center gap-2 border-2 border-dashed border-line-strong rounded-xl py-7 cursor-pointer hover:border-brand hover:bg-brand-50/50 transition', lendo && 'opacity-60 pointer-events-none')}>
            <Icon name="Upload" className="h-6 w-6 text-brand" />
            <span className="text-[13px] font-medium text-ink-2">{lendo ? 'Lendo planilha…' : arquivo || 'Clique para selecionar a planilha (.xlsx ou .csv)'}</span>
            <input type="file" accept=".xlsx,.csv,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="sr-only"
              onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void ler(f) }} />
          </label>
          {erroArquivo && <Callout tone="danger" icon="AlertCircle" className="mt-4">{erroArquivo}</Callout>}
        </>
      )}

      {leitura && (
        <div className="mt-4 space-y-3">
          <div>
            <Select label="O que fazer com quem já tem cadastro" value={modo} onChange={(v) => setModo(v as ModoImportacao)}>
              {MODOS.map((m) => <option key={m.valor} value={m.valor}>{m.rotulo}</option>)}
            </Select>
            <p className="text-[12px] text-muted mt-1">{MODOS.find((m) => m.valor === modo)!.desc}</p>
          </div>
          <div className="flex flex-wrap items-center gap-2 text-[12.5px]">
            <Badge tone="success" dot>{novas} nova(s)</Badge>
            {modo !== 'novos' && <Badge tone="brand" dot>{validas.length - novas} atualização(ões)</Badge>}
            {ignoradas > 0 && <Badge tone="neutral" dot>{ignoradas} já cadastrada(s), sem alteração</Badge>}
            {comErro > 0 && <Badge tone="danger" dot>{comErro} com erro (não serão gravadas)</Badge>}
            <span className="flex-1" />
            <Toggle checked={soProblemas} onChange={setSoProblemas} label="Só linhas com problema" />
          </div>
          <p className="text-[12px] text-muted">
            {planilha?.aba && <>Aba usada: <b>{planilha.aba}</b>. </>}
            Colunas reconhecidas: {leitura.reconhecidas.join(', ')}.
            {leitura.ignoradas.length > 0 && <> Ignoradas: {leitura.ignoradas.join(', ')}.</>}
          </p>
          {leitura.funcoesNovas.length > 0 && (
            <Callout tone="brand" icon="Briefcase">
              {leitura.funcoesNovas.length} função(ões) nova(s) serão criadas em Estrutura: {leitura.funcoesNovas.map((f) => `${f.nome} (${s.setorNome(f.setorId)})`).join(', ')}.
            </Callout>
          )}
          <div className="max-h-[46vh] overflow-auto rounded-xl border border-line">
            <table className="w-full text-[12px]">
              <thead className="sticky top-0 bg-surface-2">
                <tr className="text-left text-muted"><th className="p-2 w-12">Linha</th><th className="p-2">Pessoa</th><th className="p-2">Área · Função</th><th className="p-2">Liderança</th><th className="p-2">Situação</th></tr>
              </thead>
              <tbody>
                {visiveis.map((l) => (
                  <tr key={l.linha} className={cn('border-t border-line align-top', l.acao === 'ignorar' && 'opacity-60')}>
                    <td className="p-2 text-muted">{l.linha}</td>
                    <td className="p-2">
                      <div className="font-semibold text-ink">{l.input.nome || '—'}</div>
                      <div className="text-muted">{l.input.email || '—'} · {PAPEL_LABEL[l.input.papel]}</div>
                    </td>
                    <td className="p-2">
                      {l.input.setorId ? s.setorNome(l.input.setorId) : '—'}
                      {l.input.cargoId ? ` · ${s.cargoNome(l.input.cargoId)}` : l.novaFuncao ? <> · {l.novaFuncao.nome} <Badge tone="brand">nova</Badge></> : ''}
                    </td>
                    <td className="p-2">{l.topo ? <Badge tone="brand"><Icon name="Crown" className="h-3 w-3 inline mr-1" />CEO</Badge> : l.superior || '—'}</td>
                    <td className="p-2 min-w-[200px]">
                      {l.acao === 'ignorar' ? <Badge tone="neutral" dot>Já cadastrada{l.reconhecidoPor && l.reconhecidoPor !== 'e-mail' ? ` (pelo ${l.reconhecidoPor})` : ''}</Badge>
                        : l.erros.length ? <Badge tone="danger" dot>Erro</Badge>
                        : <Badge tone={l.acao === 'criar' ? 'success' : 'brand'} dot>{l.acao === 'criar' ? 'Novo cadastro' : modo === 'completar' ? 'Completar cadastro' : `Atualizar (${l.campos.length} campos)`}</Badge>}
                      {l.erros.map((e) => <div key={e} className="text-danger mt-1">{e}</div>)}
                      {l.avisos.map((a) => <div key={a} className="text-warning-ink mt-1">{a}</div>)}
                    </td>
                  </tr>
                ))}
                {visiveis.length === 0 && <tr><td colSpan={5} className="p-4 text-center text-muted">Nenhuma linha com problema.</td></tr>}
              </tbody>
            </table>
          </div>
          {MODO_API && novas > 0 && (
            <div className="rounded-xl bg-surface-2 p-3">
              <Toggle checked={criarAcesso} onChange={setCriarAcesso} label="Criar acesso ao portal para as pessoas novas" />
              <p className="text-[12px] text-muted mt-1.5 pl-[50px]">O login é o e-mail. Cada pessoa cria a própria senha em “Esqueceu a senha?” na tela de entrada.</p>
            </div>
          )}
        </div>
      )}

      {resultado && (
        <div className="space-y-3">
          <Callout tone={resultado.erros.length ? 'warning' : 'success'} icon="ListChecks">
            {resultado.criadas.length} cadastro(s) criado(s), {resultado.atualizadas.length} atualizado(s)
            {resultado.ignoradas ? `, ${resultado.ignoradas} já existente(s) sem alteração` : ''}
            {MODO_API && resultado.acessos ? `, ${resultado.acessos} acesso(s) ao portal criado(s)` : ''}.
            {resultado.erros.length > 0 && ` ${resultado.erros.length} linha(s) não foram gravadas.`}
          </Callout>
          {resultado.funcoesCriadas.length > 0 && <p className="text-[12.5px] text-ink-2"><b>Funções criadas:</b> {resultado.funcoesCriadas.join(', ')}.</p>}
          {resultado.liderancas.length > 0 && (
            <div className="text-[12.5px] text-ink-2"><b>Lideranças conectadas:</b>
              <ul className="list-disc pl-5 mt-1 space-y-0.5">{resultado.liderancas.map((l) => <li key={l}>{l}</li>)}</ul>
            </div>
          )}
          {resultado.erros.length > 0 && <ul className="text-[12.5px] text-danger space-y-1 max-h-40 overflow-auto">{resultado.erros.map((e) => <li key={e.linha}>Linha {e.linha}: {e.erro}</li>)}</ul>}
          {resultado.avisos.length > 0 && <ul className="text-[12.5px] text-warning-ink space-y-1 max-h-40 overflow-auto">{resultado.avisos.map((a, i) => <li key={i}>{a.linha ? `Linha ${a.linha}: ` : ''}{a.aviso}</li>)}</ul>}
          {resultado.falhasAcesso.length > 0 && <ul className="text-[12.5px] text-danger space-y-1 max-h-40 overflow-auto">{resultado.falhasAcesso.map((f) => <li key={f}>Acesso não criado · {f}</li>)}</ul>}
        </div>
      )}
    </Modal>
  )
}
