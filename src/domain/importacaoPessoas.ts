/* ============================================================
   Importação de colaboradores por planilha (.xlsx ou .csv).
   - Cabeçalhos flexíveis: reconhece "E-mail", "Email", "Área", "Setor",
     "Superior direto", "Gestor"... sem diferenciar acento ou maiúscula.
   - Quem já tem cadastro (mesmo e-mail) é ATUALIZADO só nos campos
     preenchidos na planilha; nada é apagado. Os demais são criados.
   - "Superior direto" e "CEO" são aplicados depois que todos existem,
     para que a planilha possa referenciar pessoas da própria planilha.
   ============================================================ */
import type { Colaborador, Escolaridade, Papel, PixTipo, Regime } from '@/lib/types'
import type { PessoaInput } from '@/lib/store'
import { cnpjValido, cpfValido, emailValido, soDigitos } from './validacao.js'
import { hojeISO, isDataValida } from './datas.js'

export type Celula = string | number | boolean | Date | null | undefined

type Chave =
  | 'nome' | 'nomeSocial' | 'email' | 'emailPessoal' | 'telefone' | 'celular' | 'area' | 'funcao' | 'papel' | 'superior' | 'topo'
  | 'dataEntrada' | 'nascimento' | 'cpf' | 'cnpj' | 'regime' | 'razaoSocial' | 'matricula' | 'cidade' | 'uf'
  | 'cep' | 'logradouro' | 'numero' | 'complemento' | 'bairro' | 'banco' | 'agencia' | 'conta' | 'pixTipo' | 'pixChave'
  | 'emergenciaNome' | 'emergenciaTelefone' | 'emergenciaParentesco' | 'escolaridade' | 'curso' | 'tamanhoCamisa'

interface DefColuna { chave: Chave; titulo: string; aliases: string[] }

/** Colunas aceitas, na ordem do modelo. O primeiro alias de cada uma é o título do modelo. */
export const COLUNAS: DefColuna[] = [
  { chave: 'nome', titulo: 'Nome completo', aliases: ['nome completo', 'nome', 'colaborador', 'nome do colaborador'] },
  { chave: 'email', titulo: 'E-mail', aliases: ['e mail', 'email', 'e mail corporativo', 'email corporativo', 'login'] },
  { chave: 'area', titulo: 'Área', aliases: ['area', 'setor', 'departamento'] },
  { chave: 'funcao', titulo: 'Função', aliases: ['funcao', 'cargo'] },
  { chave: 'papel', titulo: 'Papel de acesso', aliases: ['papel de acesso', 'papel', 'perfil de acesso'] },
  { chave: 'superior', titulo: 'Superior direto (e-mail)', aliases: ['superior direto', 'superior', 'gestor imediato', 'gestor', 'responde a', 'lider direto'] },
  { chave: 'topo', titulo: 'CEO (Sim)', aliases: ['ceo', 'topo da organizacao', 'topo'] },
  { chave: 'dataEntrada', titulo: 'Início da parceria', aliases: ['inicio da parceria', 'data de inicio', 'inicio', 'data de entrada', 'data de admissao', 'admissao'] },
  { chave: 'nomeSocial', titulo: 'Nome social', aliases: ['nome social', 'apelido'] },
  { chave: 'telefone', titulo: 'Telefone', aliases: ['telefone', 'fone'] },
  { chave: 'celular', titulo: 'Celular', aliases: ['celular', 'whatsapp'] },
  { chave: 'emailPessoal', titulo: 'E-mail pessoal', aliases: ['e mail pessoal', 'email pessoal'] },
  { chave: 'nascimento', titulo: 'Nascimento', aliases: ['data de nascimento', 'nascimento', 'aniversario'] },
  { chave: 'cpf', titulo: 'CPF', aliases: ['cpf'] },
  { chave: 'regime', titulo: 'Forma (PJ/MEI/Autônomo)', aliases: ['forma de contratacao', 'forma', 'regime', 'tipo de contrato'] },
  { chave: 'cnpj', titulo: 'CNPJ', aliases: ['cnpj'] },
  { chave: 'razaoSocial', titulo: 'Razão social', aliases: ['razao social', 'empresa'] },
  { chave: 'matricula', titulo: 'Matrícula', aliases: ['matricula'] },
  { chave: 'cep', titulo: 'CEP', aliases: ['cep'] },
  { chave: 'logradouro', titulo: 'Endereço', aliases: ['endereco', 'logradouro', 'rua'] },
  { chave: 'numero', titulo: 'Número', aliases: ['numero', 'n'] },
  { chave: 'complemento', titulo: 'Complemento', aliases: ['complemento'] },
  { chave: 'bairro', titulo: 'Bairro', aliases: ['bairro'] },
  { chave: 'cidade', titulo: 'Cidade', aliases: ['cidade', 'municipio'] },
  { chave: 'uf', titulo: 'UF', aliases: ['uf', 'estado'] },
  { chave: 'banco', titulo: 'Banco', aliases: ['banco'] },
  { chave: 'agencia', titulo: 'Agência', aliases: ['agencia'] },
  { chave: 'conta', titulo: 'Conta', aliases: ['conta', 'conta corrente'] },
  { chave: 'pixTipo', titulo: 'Tipo da chave PIX', aliases: ['tipo da chave pix', 'tipo de chave pix', 'tipo pix'] },
  { chave: 'pixChave', titulo: 'Chave PIX', aliases: ['chave pix', 'pix'] },
  { chave: 'emergenciaNome', titulo: 'Contato de emergência', aliases: ['contato de emergencia', 'nome do contato de emergencia', 'emergencia'] },
  { chave: 'emergenciaTelefone', titulo: 'Telefone de emergência', aliases: ['telefone de emergencia', 'telefone do contato de emergencia'] },
  { chave: 'emergenciaParentesco', titulo: 'Parentesco', aliases: ['parentesco'] },
  { chave: 'escolaridade', titulo: 'Escolaridade', aliases: ['escolaridade'] },
  { chave: 'curso', titulo: 'Curso', aliases: ['curso', 'formacao'] },
  { chave: 'tamanhoCamisa', titulo: 'Tamanho da camisa', aliases: ['tamanho da camisa', 'tamanho camisa', 'camisa'] },
]

export const normalizar = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim()

/** Associa cada cabeçalho a uma coluna conhecida: nome exato primeiro, depois o prefixo mais longo. */
export function mapearCabecalho(cab: Celula[]): { indices: Partial<Record<Chave, number>>; ignoradas: string[] } {
  const indices: Partial<Record<Chave, number>> = {}
  const ignoradas: string[] = []
  cab.forEach((c, i) => {
    const h = normalizar(String(c ?? ''))
    if (!h) return
    let melhor: { chave: Chave; tam: number } | null = null
    for (const d of COLUNAS) {
      if (indices[d.chave] !== undefined) continue
      for (const a of d.aliases) {
        const tam = h === a ? 1000 : h.startsWith(a + ' ') ? a.length : -1
        if (tam > (melhor?.tam ?? -1)) melhor = { chave: d.chave, tam }
      }
    }
    if (melhor) indices[melhor.chave] = i
    else ignoradas.push(String(c).trim())
  })
  return { indices, ignoradas }
}

const pad = (n: number) => String(n).padStart(2, '0')

/** Data em AAAA-MM-DD a partir de Date, número serial do Excel, "DD/MM/AAAA" ou "AAAA-MM-DD". */
export function lerData(v: Celula): string | null {
  if (v == null || v === '') return null
  if (v instanceof Date) return isNaN(v.getTime()) ? null : `${v.getUTCFullYear()}-${pad(v.getUTCMonth() + 1)}-${pad(v.getUTCDate())}`
  if (typeof v === 'number') {
    if (v < 1 || v > 100000) return null
    const d = new Date(Date.UTC(1899, 11, 30) + Math.round(v) * 86400000)
    return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`
  }
  const s = String(v).trim()
  let m = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (m) { const iso = `${m[1]}-${pad(+m[2])}-${pad(+m[3])}`; return isDataValida(iso) ? iso : null }
  m = s.match(/^(\d{1,2})[/.-](\d{1,2})[/.-](\d{2,4})$/)
  if (m) {
    const ano = m[3].length === 2 ? (+m[3] > 30 ? 1900 : 2000) + +m[3] : +m[3]
    const iso = `${ano}-${pad(+m[2])}-${pad(+m[1])}`
    return isDataValida(iso) ? iso : null
  }
  return null
}

const texto = (v: Celula) => (v == null ? '' : v instanceof Date ? (lerData(v) ?? '') : String(v).trim())
/** Documentos numéricos perdem zeros à esquerda no Excel; recompõe pelo tamanho esperado. */
const documento = (v: Celula, tamanho: number) => {
  const t = texto(v)
  if (!t) return ''
  const d = soDigitos(t)
  return typeof v === 'number' && d.length < tamanho ? d.padStart(tamanho, '0') : t
}

const PAPEIS: Record<string, Papel> = {
  colaborador: 'colaborador', colaboradora: 'colaborador', gestor: 'gestor', gestora: 'gestor', lider: 'gestor', lideranca: 'gestor',
  rh: 'rh', 'recursos humanos': 'rh', diretoria: 'diretoria', diretor: 'diretoria', diretora: 'diretoria', ceo: 'diretoria',
  admin: 'admin', administrador: 'admin', administradora: 'admin', administracao: 'admin',
}
const REGIMES: Record<string, Regime> = { pj: 'PJ', 'pessoa juridica': 'PJ', mei: 'MEI', autonomo: 'autonomo', autonoma: 'autonomo', pf: 'autonomo', rpa: 'autonomo' }
const PIX: Record<string, PixTipo> = { cnpj: 'CNPJ', cpf: 'CPF', email: 'E-mail', 'e mail': 'E-mail', telefone: 'Telefone', celular: 'Telefone', aleatoria: 'Aleatória', 'chave aleatoria': 'Aleatória' }
const ESCOLARIDADES: Record<string, Escolaridade> = {
  'fundamental incompleto': 'fundamental_incompleto', 'fundamental completo': 'fundamental_completo', 'medio incompleto': 'medio_incompleto',
  'medio completo': 'medio_completo', 'superior incompleto': 'superior_incompleto', 'superior completo': 'superior_completo',
  'pos graduacao': 'pos_graduacao', especializacao: 'pos_graduacao', mestrado: 'mestrado', doutorado: 'doutorado',
}
const SIM = new Set(['sim', 's', 'x', 'yes', 'y', 'true', '1', 'ceo', 'topo'])

export interface Referencias {
  setores: { id: string; nome: string }[]
  cargos: { id: string; nome: string; setorId: string }[]
  pessoas: Colaborador[]
}

export interface LinhaImportacao {
  /** Número da linha na planilha (o cabeçalho é a linha 1). */
  linha: number
  acao: 'criar' | 'atualizar'
  existenteId?: string
  input: PessoaInput
  /** Rótulos das colunas preenchidas nesta linha. */
  campos: string[]
  superior: string
  topo: boolean
  erros: string[]
  avisos: string[]
}

export interface LeituraPlanilha {
  linhas: LinhaImportacao[]
  erroCabecalho?: string
  reconhecidas: string[]
  ignoradas: string[]
}

/** Pessoa por e-mail (preferencial) ou nome exato, entre as ativas. */
export function acharPessoa<T extends { id: string; nome: string; email: string; status: string }>(ref: string, pessoas: T[]): { pessoa?: T; erro?: string } {
  const r = ref.trim()
  if (!r) return {}
  const ativas = pessoas.filter((p) => p.status !== 'encerrado')
  if (r.includes('@')) {
    const p = ativas.find((x) => x.email.toLowerCase() === r.toLowerCase())
    return p ? { pessoa: p } : { erro: `Superior "${r}" não encontrado.` }
  }
  const n = normalizar(r)
  const achadas = ativas.filter((x) => normalizar(x.nome) === n)
  if (achadas.length === 1) return { pessoa: achadas[0] }
  return { erro: achadas.length ? `Há mais de uma pessoa chamada "${r}". Use o e-mail do superior.` : `Superior "${r}" não encontrado.` }
}

export function lerPlanilhaPessoas(rows: Celula[][], ref: Referencias, hoje = hojeISO()): LeituraPlanilha {
  // Ignora linhas vazias antes do cabeçalho (planilhas com título no topo).
  const inicio = rows.findIndex((r) => r.some((c) => texto(c) !== ''))
  if (inicio < 0) return { linhas: [], erroCabecalho: 'A planilha está vazia.', reconhecidas: [], ignoradas: [] }
  const { indices, ignoradas } = mapearCabecalho(rows[inicio])
  const reconhecidas = COLUNAS.filter((d) => indices[d.chave] !== undefined).map((d) => d.titulo)
  if (indices.nome === undefined || indices.email === undefined) {
    return { linhas: [], erroCabecalho: 'Não encontrei as colunas "Nome completo" e "E-mail" no cabeçalho. Use o modelo ou renomeie as colunas.', reconhecidas, ignoradas }
  }
  const porEmail = new Map(ref.pessoas.map((p) => [p.email.toLowerCase(), p]))
  const setorPorNome = (n: string) => ref.setores.find((s) => normalizar(s.nome) === normalizar(n))
  const vistos = new Map<string, number>()
  const linhas: LinhaImportacao[] = []
  let topoNaPlanilha: number | null = null

  rows.slice(inicio + 1).forEach((r, k) => {
    const linha = inicio + k + 2
    const cel = (c: Chave) => (indices[c] === undefined ? undefined : r[indices[c]!])
    const val = (c: Chave) => texto(cel(c))
    if (COLUNAS.every((d) => val(d.chave) === '')) return
    const erros: string[] = [], avisos: string[] = []
    const email = val('email').toLowerCase()
    const existente = email ? porEmail.get(email) : undefined
    const campos = COLUNAS.filter((d) => val(d.chave) !== '').map((d) => d.titulo)

    if (!emailValido(email)) erros.push(email ? `E-mail inválido: ${email}.` : 'E-mail não informado.')
    else if (vistos.has(email)) erros.push(`E-mail repetido (já aparece na linha ${vistos.get(email)}).`)
    else vistos.set(email, linha)

    // Parte de quem já existe; só os campos preenchidos sobrescrevem.
    const base: PessoaInput = existente
      ? (({ id: _i, avatarCor: _a, privacidade: _p, encerramento: _e, diversidade: _d, perfil: _pf, ...resto }) => resto)(existente) as PessoaInput
      : { nome: '', email, papel: 'colaborador', setorId: '', status: 'ativo', dataEntrada: hoje, regime: 'autonomo' }
    const input: PessoaInput = { ...base, email }
    const set = <K extends keyof PessoaInput>(k: K, v: PessoaInput[K] | '' | null | undefined) => { if (v !== '' && v != null) input[k] = v as PessoaInput[K] }

    set('nome', val('nome'))
    set('nomeSocial', val('nomeSocial'))
    set('telefone', val('telefone'))
    set('celular', val('celular'))
    set('emailPessoal', val('emailPessoal').toLowerCase())
    set('matricula', val('matricula'))
    set('cidade', val('cidade'))
    set('uf', val('uf').toUpperCase().slice(0, 2))
    set('banco', val('banco'))
    set('agencia', val('agencia'))
    set('conta', val('conta'))
    set('pixChave', val('pixChave'))
    set('emergenciaNome', val('emergenciaNome'))
    set('emergenciaTelefone', val('emergenciaTelefone'))
    set('emergenciaParentesco', val('emergenciaParentesco'))
    set('curso', val('curso'))
    set('tamanhoCamisa', val('tamanhoCamisa').toUpperCase())
    set('razaoSocial', val('razaoSocial'))
    set('cpf', documento(cel('cpf'), 11))
    set('cnpj', documento(cel('cnpj'), 14))
    if (!input.nome || input.nome.trim().length < 3) erros.push('Nome completo não informado.')

    const end = { cep: documento(cel('cep'), 8), logradouro: val('logradouro'), numero: val('numero'), complemento: val('complemento'), bairro: val('bairro') }
    if (Object.values(end).some(Boolean)) {
      const atual = { ...(input.endereco ?? {}) }
      for (const [k, v] of Object.entries(end)) if (v) (atual as Record<string, string>)[k] = v
      if (input.cidade) atual.cidade = input.cidade
      if (input.uf) atual.uf = input.uf
      input.endereco = atual
    }

    // Área e função: pelo nome cadastrado em Estrutura.
    if (val('area')) {
      const s = setorPorNome(val('area'))
      if (s) input.setorId = s.id
      else erros.push(`Área "${val('area')}" não existe em Estrutura.`)
    } else if (!existente) erros.push('Área não informada.')
    if (val('funcao')) {
      const n = normalizar(val('funcao'))
      const daArea = ref.cargos.filter((g) => normalizar(g.nome) === n && g.setorId === input.setorId)
      const todas = ref.cargos.filter((g) => normalizar(g.nome) === n)
      const g = daArea[0] ?? (todas.length === 1 ? todas[0] : undefined)
      if (g) input.cargoId = g.id
      else avisos.push(`Função "${val('funcao')}" não encontrada em Estrutura; ficará em branco.`)
    }

    if (val('papel')) {
      const p = PAPEIS[normalizar(val('papel'))]
      if (p) input.papel = p
      else avisos.push(`Papel "${val('papel')}" não reconhecido; mantido como ${existente ? 'está' : 'colaborador'}.`)
    }
    if (val('regime')) {
      const g = REGIMES[normalizar(val('regime'))]
      if (g) input.regime = g
      else avisos.push(`Forma "${val('regime')}" não reconhecida.`)
    } else if (!existente && input.cnpj) input.regime = 'PJ'
    if (val('pixTipo')) {
      const t = PIX[normalizar(val('pixTipo'))]
      if (t) input.pixTipo = t
      else avisos.push(`Tipo de chave PIX "${val('pixTipo')}" não reconhecido.`)
    }
    if (val('escolaridade')) {
      const e = ESCOLARIDADES[normalizar(val('escolaridade'))]
      if (e) input.escolaridade = e
      else avisos.push(`Escolaridade "${val('escolaridade')}" não reconhecida.`)
    }

    for (const c of ['dataEntrada', 'nascimento'] as const) {
      if (!val(c)) continue
      const d = lerData(cel(c))
      if (d) input[c] = d
      else erros.push(`Data inválida em "${COLUNAS.find((x) => x.chave === c)!.titulo}": ${val(c)}. Use DD/MM/AAAA.`)
    }
    if (input.nascimento && input.nascimento > hoje) erros.push('A data de nascimento está no futuro.')

    // Mesmas regras do cadastro: PJ/MEI exigem razão social e CNPJ válido.
    if (input.regime !== 'autonomo') {
      if (!input.razaoSocial?.trim()) erros.push('Forma PJ/MEI exige a razão social.')
      if (!cnpjValido(input.cnpj ?? '')) erros.push(input.cnpj ? `CNPJ inválido: ${input.cnpj}.` : 'Forma PJ/MEI exige o CNPJ.')
    } else if (input.cpf && !cpfValido(input.cpf)) erros.push(`CPF inválido: ${input.cpf}.`)

    const topo = SIM.has(normalizar(val('topo')))
    const superior = topo ? '' : val('superior')
    if (topo) {
      if (topoNaPlanilha !== null) erros.push(`Só uma pessoa pode ser o topo (CEO). A linha ${topoNaPlanilha} já está marcada.`)
      else topoNaPlanilha = linha
      if (val('superior')) avisos.push('Marcada como CEO: o superior direto informado será ignorado.')
    }
    if (superior && (superior.toLowerCase() === email || normalizar(superior) === normalizar(input.nome))) erros.push('A pessoa não pode ser superior de si mesma.')

    linhas.push({ linha, acao: existente ? 'atualizar' : 'criar', existenteId: existente?.id, input, campos, superior, topo, erros, avisos })
  })

  // Superior precisa existir no cadastro ou na própria planilha.
  const daPlanilha = linhas.filter((l) => !l.erros.length).map((l) => ({ id: `linha${l.linha}`, nome: l.input.nome, email: l.input.email, status: 'ativo' }))
  const universo = [...ref.pessoas.filter((p) => !daPlanilha.some((x) => x.email === p.email.toLowerCase())), ...daPlanilha]
  for (const l of linhas) {
    if (!l.superior) continue
    const r = acharPessoa(l.superior, universo)
    if (r.erro) l.avisos.push(`${r.erro} A pessoa ficará sem superior definido.`)
  }
  return { linhas, reconhecidas, ignoradas }
}

/** Planilha modelo (CSV com ";", abre direto no Excel). */
export function modeloCSV(): string {
  const exemplo: Partial<Record<Chave, string>> = {
    nome: 'Maria Souza', email: 'maria@empresa.com.br', area: 'Comercial', funcao: 'Executiva de contas', papel: 'Colaborador',
    superior: 'joao@empresa.com.br', topo: '', dataEntrada: '01/03/2025', nascimento: '15/08/1990', regime: 'PJ', cnpj: '11.222.333/0001-81', razaoSocial: 'Maria Souza Consultoria LTDA',
    celular: '(11) 99999-0000', cidade: 'São Paulo', uf: 'SP', pixTipo: 'CNPJ', pixChave: '11.222.333/0001-81',
  }
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return '﻿' + [COLUNAS.map((c) => c.titulo).join(';'), COLUNAS.map((c) => esc(exemplo[c.chave] ?? '')).join(';')].join('\r\n') + '\r\n'
}

/* ---------- aplicação ---------- */
export interface AcoesImportacao {
  salvarPessoa: (input: PessoaInput, id?: string) => { ok: true; id?: string } | { ok: false; erro: string }
  pessoas: () => Colaborador[]
}
export interface ResultadoImportacao {
  criadas: string[]
  atualizadas: string[]
  erros: { linha: number; erro: string }[]
  avisos: { linha: number; aviso: string }[]
}

/**
 * Grava as linhas válidas em duas etapas: (1) cria/atualiza os cadastros;
 * (2) aplica superior direto e CEO, já com todas as pessoas existindo.
 */
export function aplicarImportacao(linhas: LinhaImportacao[], acoes: AcoesImportacao): ResultadoImportacao {
  const res: ResultadoImportacao = { criadas: [], atualizadas: [], erros: [], avisos: [] }
  const idDaLinha = new Map<number, string>()
  for (const l of linhas) {
    if (l.erros.length) continue
    const r = acoes.salvarPessoa(l.input, l.existenteId)
    if (!r.ok) { res.erros.push({ linha: l.linha, erro: r.erro }); continue }
    const id = l.existenteId ?? r.id ?? ''
    idDaLinha.set(l.linha, id)
    ;(l.existenteId ? res.atualizadas : res.criadas).push(id)
  }

  const regravar = (id: string, patch: Partial<PessoaInput>) => {
    const atual = acoes.pessoas().find((p) => p.id === id)
    if (!atual) return 'Cadastro não encontrado.'
    const { id: _id, ...resto } = atual
    const r = acoes.salvarPessoa({ ...resto, ...patch }, id)
    return r.ok ? null : r.erro
  }

  // CEO: um único topo, sem superior. Quem estava marcado antes deixa de ser.
  const linhaTopo = linhas.find((l) => l.topo && idDaLinha.has(l.linha))
  if (linhaTopo) {
    const idTopo = idDaLinha.get(linhaTopo.linha)!
    for (const p of acoes.pessoas()) if (p.topoOrganizacao && p.id !== idTopo) regravar(p.id, { topoOrganizacao: false })
    const e = regravar(idTopo, { topoOrganizacao: true, responsavelId: undefined })
    if (e) res.erros.push({ linha: linhaTopo.linha, erro: `Não foi possível marcar como CEO: ${e}` })
  }

  for (const l of linhas) {
    const id = idDaLinha.get(l.linha)
    if (!id || !l.superior) continue
    const r = acharPessoa(l.superior, acoes.pessoas())
    if (!r.pessoa) { res.avisos.push({ linha: l.linha, aviso: r.erro ?? 'Superior não encontrado.' }); continue }
    if (acoes.pessoas().find((p) => p.id === id)?.responsavelId === r.pessoa.id) continue
    const e = regravar(id, { responsavelId: r.pessoa.id, topoOrganizacao: false })
    if (e) res.avisos.push({ linha: l.linha, aviso: `Superior direto não aplicado: ${e}` })
  }
  return res
}
