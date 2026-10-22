/* ============================================================
   Importação de colaboradores por planilha (.xlsx ou .csv).
   - Cabeçalhos flexíveis: reconhece "E-mail", "Email", "Área", "Setor",
     "Superior direto", "Liderança", "Cargo", "Modalidade"... sem
     diferenciar acento ou maiúscula. Em .xlsx com várias abas, usa a
     aba que tem as colunas de nome e e-mail.
   - Quem já tem cadastro é reconhecido pelo e-mail (de login ou pessoal),
     pelo CPF ou pelo nome. O que acontece com essas pessoas depende do
     modo: 'novos' (só cria quem falta), 'completar' (preenche só campos
     vazios) ou 'atualizar' (sobrescreve com o que veio preenchido).
   - Funções que ainda não existem em Estrutura são criadas. Sem coluna
     de área, a área vem da função (cadastrada ou por palavra-chave) ou,
     por último, da área da liderança.
   - "Superior direto"/"Liderança" e "CEO" são aplicados depois que todos
     existem; aceita e-mail, nome completo ou só o primeiro nome. Quem
     lidera alguém vira liderança das áreas dessas pessoas.
   ============================================================ */
import type { Cargo, Colaborador, Escolaridade, Papel, PixTipo, Regime, Senioridade, Setor } from '@/lib/types'
import type { PessoaInput } from '@/lib/store'
import { cnpjValido, cpfValido, emailValido, soDigitos } from './validacao.js'
import { hojeISO, isDataValida } from './datas.js'

export type Celula = string | number | boolean | Date | null | undefined

type Chave =
  | 'nome' | 'nomeSocial' | 'email' | 'emailPessoal' | 'telefone' | 'celular' | 'area' | 'funcao' | 'papel' | 'superior' | 'topo' | 'unidade'
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
  { chave: 'superior', titulo: 'Superior direto (e-mail)', aliases: ['superior direto', 'superior', 'gestor imediato', 'gestor', 'responde a', 'lider direto', 'lideranca', 'lider'] },
  { chave: 'topo', titulo: 'CEO (Sim)', aliases: ['ceo', 'topo da organizacao', 'topo'] },
  { chave: 'dataEntrada', titulo: 'Início da parceria', aliases: ['inicio da parceria', 'data de inicio', 'inicio', 'data de entrada', 'data de admissao', 'admissao'] },
  { chave: 'unidade', titulo: 'Modalidade', aliases: ['modalidade', 'unidade', 'local de trabalho', 'regime de trabalho'] },
  { chave: 'nomeSocial', titulo: 'Nome social', aliases: ['nome social', 'apelido'] },
  { chave: 'telefone', titulo: 'Telefone', aliases: ['telefone', 'fone'] },
  { chave: 'celular', titulo: 'Celular', aliases: ['celular', 'whatsapp', 'contato'] },
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

/** Linha do cabeçalho: a primeira (entre as 15 iniciais) que tem nome e e-mail; senão, a primeira não vazia. */
function acharCabecalho(rows: Celula[][]): number {
  for (let i = 0; i < Math.min(rows.length, 15); i++) {
    const { indices } = mapearCabecalho(rows[i])
    if (indices.nome !== undefined && indices.email !== undefined) return i
  }
  return rows.findIndex((r) => r.some((c) => texto(c) !== ''))
}

/** Numa planilha com várias abas, a primeira que tem as colunas de nome e e-mail. */
export function escolherAba<T extends { nome: string; rows: Celula[][] }>(abas: T[]): T | undefined {
  return abas.find((a) => {
    const i = acharCabecalho(a.rows)
    if (i < 0) return false
    const { indices } = mapearCabecalho(a.rows[i])
    return indices.nome !== undefined && indices.email !== undefined
  }) ?? abas[0]
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

/* ---------- nomes ---------- */
const PARTICULAS = new Set(['da', 'de', 'do', 'das', 'dos', 'e'])
const partesNome = (s: string) => normalizar(s).split(' ').filter((t) => t && !PARTICULAS.has(t))
const contem = (maior: string[], menor: string[]) => menor.every((t) => maior.includes(t))

/** Mesmo nome com mais ou menos sobrenomes ("Ramon Magalhães" = "Ramon Jaime Maia Magalhães"); exige ao menos 2 partes em comum. */
export function mesmoNome(a: string, b: string): boolean {
  const pa = partesNome(a), pb = partesNome(b)
  const [menor, maior] = pa.length <= pb.length ? [pa, pb] : [pb, pa]
  return menor.length >= 2 && contem(maior, menor)
}

/* ---------- função → área e nível ---------- */
/** Palavras da função que indicam a área (nomes de área comparados sem acento). Usado quando a planilha não tem a coluna "Área". */
const AREA_POR_FUNCAO: [RegExp, string[]][] = [
  [/\b(closer|sdr|hunter|comercial|vendas?|vendedora?|executiv[oa]s? de vendas|consultor[a]? comercial|inside sales|bdr)\b/, ['comercial']],
  [/\b(rh|recursos humanos|pessoas|recrutador[a]?|recrutamento|departamento pessoal)\b/, ['rh pessoas', 'rh', 'recursos humanos', 'pessoas']],
  [/\b(financeir[oa]|contabil|contador[a]?|fiscal|faturamento)\b/, ['financeiro']],
  [/\b(juridico|advogad[oa]|paralegal)\b/, ['juridico']],
  [/\b(desenvolvedor[a]?|dev|programador[a]?|automac(ao|oes)|tecnologia|software|dados|ti|suporte tecnico)\b/, ['tecnologia']],
  [/\b(marketing|copy|copywriter|videomaker|video|conteudo|social media|redator[a]?|editor[a]? de video)\b/, ['marketing']],
  [/\b(trafego|account|cs|customer|sucesso do cliente|designer|operacional|operac(ao|oes)|projetos?|processos?)\b/, ['operacional']],
]

export function areaPorFuncao(funcao: string, setores: { id: string; nome: string }[]): string | undefined {
  const f = normalizar(funcao)
  for (const [re, nomes] of AREA_POR_FUNCAO) {
    if (!re.test(f)) continue
    const s = setores.find((x) => nomes.includes(normalizar(x.nome)))
    if (s) return s.id
  }
  return undefined
}

/** Nível da função pelo nome ("PL II" → Pleno, "Coordenadora" → Liderança). */
export function nivelPorFuncao(funcao: string): Senioridade {
  const f = normalizar(funcao)
  if (/\b(coordenador[a]?|gerente|head|diretor[a]?|lider|supervisor[a]?)\b/.test(f)) return 'Liderança'
  if (/\b(jr|junior|estagiari[oa]|trainee)\b/.test(f)) return 'Júnior'
  if (/\b(sr|senior)\b/.test(f)) return 'Sênior'
  if (/\b(especialista)\b/.test(f)) return 'Especialista'
  return 'Pleno'
}

/** Chave de comparação de funções: ignora acento, caixa e "(a)". */
export const chaveFuncao = (s: string) => normalizar(s.replace(/\((a|as|o|os)\)/gi, ''))

/* ---------- contato de emergência em texto livre ---------- */
const PARENTESCOS = new Set(['esposa', 'esposo', 'marido', 'mae', 'pai', 'irma', 'irmao', 'filha', 'filho', 'namorada', 'namorado', 'avo', 'tia', 'tio',
  'prima', 'primo', 'companheira', 'companheiro', 'noiva', 'noivo', 'conjuge', 'amiga', 'amigo', 'sogra', 'sogro', 'madrasta', 'padrasto', 'cunhada', 'cunhado'])

/** "Ana Paula - Esposa - 88 99206-6008" → nome, parentesco e telefone. Com vários contatos, usa o primeiro. */
export function lerContatoEmergencia(v: string): { nome?: string; telefone?: string; parentesco?: string } {
  const primeiro = v.split(/\r?\n|\s{3,}/).map((s) => s.trim()).find(Boolean) ?? ''
  const fone = primeiro.match(/\+?\(?\d[\d\s().-]{6,}\d/)
  const resto = fone ? primeiro.replace(fone[0], ' ') : primeiro
  const r: { nome?: string; telefone?: string; parentesco?: string } = {}
  if (fone) r.telefone = fone[0].trim()
  for (const parte of resto.split(/[-–,:;()]/).map((s) => s.trim().replace(/\.$/, '')).filter(Boolean)) {
    const n = normalizar(parte)
    if (PARENTESCOS.has(n)) r.parentesco ??= parte.charAt(0).toUpperCase() + parte.slice(1).toLowerCase()
    else if (!r.nome && n && n !== 'sem nome') r.nome = parte
  }
  return r
}

/* ---------- modalidade → unidade ---------- */
const REMOTO = /\b(home|remot[oa]|teletrabalho|home office)\b/
function acharUnidade(v: string, unidades: { id: string; nome: string }[]): string | undefined {
  const n = normalizar(v)
  const exata = unidades.find((u) => normalizar(u.nome) === n)
  if (exata) return exata.id
  if (REMOTO.test(n)) return unidades.find((u) => REMOTO.test(normalizar(u.nome)))?.id
  if (/\b(presencial|escritorio|sede)\b/.test(n)) {
    const fisicas = unidades.filter((u) => !REMOTO.test(normalizar(u.nome)))
    return (fisicas.find((u) => /\bsede\b/.test(normalizar(u.nome))) ?? fisicas[0])?.id
  }
  return undefined
}

export type ModoImportacao = 'novos' | 'completar' | 'atualizar'

export interface Referencias {
  setores: { id: string; nome: string }[]
  cargos: { id: string; nome: string; setorId: string }[]
  pessoas: Colaborador[]
  unidades?: { id: string; nome: string }[]
}

export interface LinhaImportacao {
  /** Número da linha na planilha (a primeira linha do arquivo é a 1). */
  linha: number
  /** 'ignorar': já tem cadastro e o modo é 'novos'. */
  acao: 'criar' | 'atualizar' | 'ignorar'
  existenteId?: string
  /** Como o cadastro existente foi reconhecido. */
  reconhecidoPor?: 'e-mail' | 'CPF' | 'nome'
  input: PessoaInput
  /** Função que ainda não existe em Estrutura e será criada (na área indicada pelo nome da função ou na da pessoa). */
  novaFuncao?: { nome: string; nivel: Senioridade; setorId?: string }
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
  /** Funções novas que serão criadas (nome · área). */
  funcoesNovas: { nome: string; setorId: string }[]
}

type PessoaRef = { id: string; nome: string; nomeSocial?: string; email: string; status: string }

/**
 * Pessoa por e-mail, nome completo ou parte do nome ("Jardel", "Laís Ferreira"), entre as ativas.
 * Só aceita quando há exatamente uma correspondência.
 */
export function acharPessoa<T extends PessoaRef>(ref: string, pessoas: T[]): { pessoa?: T; erro?: string } {
  const r = ref.trim()
  if (!r) return {}
  const ativas = pessoas.filter((p) => p.status !== 'encerrado')
  if (r.includes('@')) {
    const p = ativas.find((x) => x.email.toLowerCase() === r.toLowerCase())
    return p ? { pessoa: p } : { erro: `Superior "${r}" não encontrado.` }
  }
  const n = normalizar(r)
  const nomes = (x: T) => [x.nome, x.nomeSocial ?? ''].filter(Boolean)
  let achadas = ativas.filter((x) => nomes(x).some((k) => normalizar(k) === n))
  if (!achadas.length) {
    const partes = partesNome(r)
    if (partes.length) achadas = ativas.filter((x) => nomes(x).some((k) => contem(partesNome(k), partes)))
  }
  if (achadas.length === 1) return { pessoa: achadas[0] }
  return { erro: achadas.length ? `Há mais de uma pessoa que corresponde a "${r}" (${achadas.map((a) => a.nome).join(', ')}). Use o e-mail ou o nome completo.` : `Superior "${r}" não encontrado.` }
}

/** Cadastro existente: e-mail (login ou pessoal) → CPF → nome (com mais ou menos sobrenomes, se único). */
export function acharCadastro(dados: { email: string; cpf?: string; nome: string }, pessoas: Colaborador[]): { pessoa?: Colaborador; por?: LinhaImportacao['reconhecidoPor'] } {
  const email = dados.email.toLowerCase()
  if (email) {
    const p = pessoas.find((x) => x.email.toLowerCase() === email || (x.emailPessoal ?? '').toLowerCase() === email)
    if (p) return { pessoa: p, por: 'e-mail' }
  }
  const cpf = soDigitos(dados.cpf ?? '')
  if (cpf.length === 11) {
    const p = pessoas.find((x) => soDigitos(x.cpf ?? '') === cpf)
    if (p) return { pessoa: p, por: 'CPF' }
  }
  if (dados.nome.trim()) {
    const exatas = pessoas.filter((x) => normalizar(x.nome) === normalizar(dados.nome))
    if (exatas.length === 1) return { pessoa: exatas[0], por: 'nome' }
    const parecidas = pessoas.filter((x) => mesmoNome(x.nome, dados.nome))
    if (parecidas.length === 1) return { pessoa: parecidas[0], por: 'nome' }
  }
  return {}
}

const vazio = (v: unknown) => v == null || v === '' || (Array.isArray(v) && !v.length)

export function lerPlanilhaPessoas(rows: Celula[][], ref: Referencias, hoje = hojeISO(), opcoes: { modo?: ModoImportacao } = {}): LeituraPlanilha {
  const modo = opcoes.modo ?? 'atualizar'
  const inicio = acharCabecalho(rows)
  if (inicio < 0) return { linhas: [], erroCabecalho: 'A planilha está vazia.', reconhecidas: [], ignoradas: [], funcoesNovas: [] }
  const { indices, ignoradas } = mapearCabecalho(rows[inicio])
  const reconhecidas = COLUNAS.filter((d) => indices[d.chave] !== undefined).map((d) => d.titulo)
  if (indices.nome === undefined || indices.email === undefined) {
    return { linhas: [], erroCabecalho: 'Não encontrei as colunas "Nome completo" e "E-mail" no cabeçalho. Use o modelo ou renomeie as colunas.', reconhecidas, ignoradas, funcoesNovas: [] }
  }
  const unidades = ref.unidades ?? []
  const setorPorNome = (n: string) => ref.setores.find((s) => normalizar(s.nome) === normalizar(n))
  const vistos = new Map<string, number>()
  const cadastrosVistos = new Map<string, number>()
  const linhas: LinhaImportacao[] = []
  let topoNaPlanilha: number | null = null

  rows.slice(inicio + 1).forEach((r, k) => {
    const linha = inicio + k + 2
    const cel = (c: Chave) => (indices[c] === undefined ? undefined : r[indices[c]!])
    const val = (c: Chave) => texto(cel(c))
    // Linhas sem nome e sem e-mail (vazias, totais, "Atualizada em...") não são pessoas.
    if (!val('nome') && !val('email')) return
    const erros: string[] = [], avisos: string[] = []
    const email = val('email').toLowerCase()
    const campos = COLUNAS.filter((d) => val(d.chave) !== '').map((d) => d.titulo)

    if (!emailValido(email)) erros.push(email ? `E-mail inválido: ${email}.` : 'E-mail não informado.')
    else if (vistos.has(email)) erros.push(`E-mail repetido (já aparece na linha ${vistos.get(email)}).`)
    else vistos.set(email, linha)

    const cpfPlanilha = documento(cel('cpf'), 11)
    const { pessoa: existente, por } = acharCadastro({ email, cpf: cpfPlanilha, nome: val('nome') }, ref.pessoas)
    if (existente) {
      if (cadastrosVistos.has(existente.id)) erros.push(`Esta pessoa já aparece na linha ${cadastrosVistos.get(existente.id)} (${existente.nome}).`)
      else cadastrosVistos.set(existente.id, linha)
    }

    // Parte de quem já existe; o modo decide o que a planilha pode sobrescrever.
    const base: PessoaInput = existente
      ? (({ id: _i, avatarCor: _a, privacidade: _p, encerramento: _e, diversidade: _d, perfil: _pf, ...resto }) => resto)(existente) as PessoaInput
      : { nome: '', email, papel: 'colaborador', setorId: '', status: 'ativo', dataEntrada: hoje, regime: 'autonomo' }
    const input: PessoaInput = { ...base }
    const soVazios = !!existente && modo === 'completar'
    const set = <K extends keyof PessoaInput>(k: K, v: PessoaInput[K] | '' | null | undefined) => {
      if (v === '' || v == null) return
      if (soVazios && !vazio(base[k])) return
      input[k] = v as PessoaInput[K]
    }

    // O login de quem já existe não muda; o e-mail da planilha, se for outro, fica como e-mail pessoal.
    if (existente) {
      if (email && emailValido(email) && email !== existente.email.toLowerCase() && !val('emailPessoal')) set('emailPessoal', email)
    } else input.email = email

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
    // Sem colunas separadas, o contato de emergência vem em texto livre ("Ana - esposa - 85 9999-0000").
    if (val('emergenciaNome') && indices.emergenciaTelefone === undefined && indices.emergenciaParentesco === undefined) {
      const c = lerContatoEmergencia(val('emergenciaNome'))
      set('emergenciaNome', c.nome)
      set('emergenciaTelefone', c.telefone)
      set('emergenciaParentesco', c.parentesco)
    } else {
      set('emergenciaNome', val('emergenciaNome'))
      set('emergenciaTelefone', val('emergenciaTelefone'))
      set('emergenciaParentesco', val('emergenciaParentesco'))
    }
    set('curso', val('curso'))
    set('tamanhoCamisa', val('tamanhoCamisa').toUpperCase())
    set('razaoSocial', val('razaoSocial'))
    set('cpf', cpfPlanilha)
    set('cnpj', documento(cel('cnpj'), 14))
    if (!input.nome || input.nome.trim().length < 3) erros.push('Nome completo não informado.')

    const end = { cep: documento(cel('cep'), 8), logradouro: val('logradouro'), numero: val('numero'), complemento: val('complemento'), bairro: val('bairro') }
    if (Object.values(end).some(Boolean)) {
      const atual = { ...(input.endereco ?? {}) }
      for (const [k, v] of Object.entries(end)) if (v && !(soVazios && (atual as Record<string, string>)[k])) (atual as Record<string, string>)[k] = v
      if (input.cidade) atual.cidade = input.cidade
      if (input.uf) atual.uf = input.uf
      input.endereco = atual
    }

    if (val('unidade')) {
      const u = acharUnidade(val('unidade'), unidades)
      if (u) set('unidadeId', u)
      else avisos.push(`Modalidade/unidade "${val('unidade')}" não encontrada em Estrutura.`)
    }

    // Área: coluna "Área"; senão a do cadastro; senão a da função; senão a da liderança (resolvida mais abaixo).
    if (val('area')) {
      const s = setorPorNome(val('area'))
      if (s) set('setorId', s.id)
      else erros.push(`Área "${val('area')}" não existe em Estrutura.`)
    }
    let novaFuncao: LinhaImportacao['novaFuncao']
    if (val('funcao') && !(soVazios && base.cargoId)) {
      const n = chaveFuncao(val('funcao'))
      const iguais = ref.cargos.filter((g) => chaveFuncao(g.nome) === n)
      const g = iguais.find((x) => x.setorId === input.setorId) ?? (iguais.length === 1 ? iguais[0] : undefined)
        ?? (iguais.length > 1 ? iguais.find((x) => x.setorId === areaPorFuncao(val('funcao'), ref.setores)) ?? iguais[0] : undefined)
      if (g) {
        input.cargoId = g.id
        if (!input.setorId) input.setorId = g.setorId
      } else {
        novaFuncao = { nome: val('funcao'), nivel: nivelPorFuncao(val('funcao')) }
        input.cargoId = undefined
      }
    }
    if (!input.setorId && val('funcao')) {
      const s = areaPorFuncao(val('funcao'), ref.setores)
      if (s) input.setorId = s
    }

    if (val('papel')) {
      const p = PAPEIS[normalizar(val('papel'))]
      if (p) set('papel', p)
      else avisos.push(`Papel "${val('papel')}" não reconhecido; mantido como ${existente ? 'está' : 'colaborador'}.`)
    }
    if (val('regime')) {
      const g = REGIMES[normalizar(val('regime'))]
      if (g) { if (!soVazios) input.regime = g }
      else avisos.push(`Forma "${val('regime')}" não reconhecida.`)
    } else if (!existente && input.cnpj) input.regime = 'PJ'
    if (val('pixTipo')) {
      const t = PIX[normalizar(val('pixTipo'))]
      if (t) set('pixTipo', t)
      else avisos.push(`Tipo de chave PIX "${val('pixTipo')}" não reconhecido.`)
    }
    if (val('escolaridade')) {
      const e = ESCOLARIDADES[normalizar(val('escolaridade'))]
      if (e) set('escolaridade', e)
      else avisos.push(`Escolaridade "${val('escolaridade')}" não reconhecida.`)
    }

    for (const c of ['dataEntrada', 'nascimento'] as const) {
      if (!val(c)) continue
      const d = lerData(cel(c))
      if (d) { if (!(soVazios && c === 'dataEntrada')) set(c, d) }
      else erros.push(`Data inválida em "${COLUNAS.find((x) => x.chave === c)!.titulo}": ${val(c)}. Use DD/MM/AAAA.`)
    }
    if (input.nascimento && input.nascimento > hoje) erros.push('A data de nascimento está no futuro.')

    // Mesmas regras do cadastro: PJ/MEI exigem razão social e CNPJ válido.
    if (input.regime !== 'autonomo') {
      if (!input.razaoSocial?.trim()) erros.push('Forma PJ/MEI exige a razão social.')
      if (!cnpjValido(input.cnpj ?? '')) erros.push(input.cnpj ? `CNPJ inválido: ${input.cnpj}.` : 'Forma PJ/MEI exige o CNPJ.')
    } else if (input.cpf && !cpfValido(input.cpf)) {
      // CPF errado não impede o cadastro: fica em branco para corrigir depois.
      avisos.push(`CPF inválido (${input.cpf}); o cadastro será gravado sem CPF.`)
      input.cpf = base.cpf && cpfValido(base.cpf) ? base.cpf : undefined
    }

    const topo = SIM.has(normalizar(val('topo')))
    const superior = topo ? '' : val('superior')
    if (topo) {
      if (topoNaPlanilha !== null) erros.push(`Só uma pessoa pode ser o topo (CEO). A linha ${topoNaPlanilha} já está marcada.`)
      else topoNaPlanilha = linha
      if (val('superior')) avisos.push('Marcada como CEO: o superior direto informado será ignorado.')
    }
    if (superior && (superior.toLowerCase() === email || normalizar(superior) === normalizar(input.nome))) erros.push('A pessoa não pode ser superior de si mesma.')

    const acao: LinhaImportacao['acao'] = !existente ? 'criar' : modo === 'novos' ? 'ignorar' : 'atualizar'
    if (acao === 'ignorar') { linhas.push({ linha, acao, existenteId: existente!.id, reconhecidoPor: por, input, campos, superior, topo, erros: [], avisos: [] }); return }
    if (existente && por !== 'e-mail') avisos.push(`Já cadastrada como "${existente.nome}" (${existente.email}), reconhecida pelo ${por}.`)
    linhas.push({ linha, acao, existenteId: existente?.id, reconhecidoPor: por, input, novaFuncao, campos, superior, topo, erros, avisos })
  })

  // Superior precisa existir no cadastro ou na própria planilha.
  const daPlanilha = linhas.filter((l) => !l.erros.length && l.acao !== 'ignorar')
    .map((l) => ({ id: l.existenteId ?? `linha${l.linha}`, nome: l.input.nome, nomeSocial: l.input.nomeSocial, email: l.input.email, status: 'ativo', setorId: l.input.setorId, linha: l }))
  const universo = [
    ...ref.pessoas.filter((p) => !daPlanilha.some((x) => x.id === p.id || x.email === p.email.toLowerCase())).map((p) => ({ ...p, linha: undefined as LinhaImportacao | undefined })),
    ...daPlanilha,
  ]
  const liderDe = (l: LinhaImportacao) => (l.superior ? acharPessoa(l.superior, universo) : {})
  for (const l of linhas) {
    if (l.acao === 'ignorar' || !l.superior) continue
    const r = liderDe(l)
    if (r.erro) l.avisos.push(`${r.erro} A pessoa ficará sem superior definido.`)
  }

  // Área pela liderança, para quem ainda não tem (a liderança pode estar na própria planilha).
  for (let volta = 0; volta < 3; volta++) {
    for (const l of linhas) {
      if (l.input.setorId || l.acao === 'ignorar') continue
      const lider = liderDe(l).pessoa
      const s = lider?.linha ? lider.linha.input.setorId : lider?.setorId
      if (s) l.input.setorId = s
    }
  }
  const funcoesNovas: LeituraPlanilha['funcoesNovas'] = []
  for (const l of linhas) {
    if (l.acao === 'ignorar') continue
    if (!l.input.setorId) { if (!l.erros.some((e) => e.startsWith('Área'))) l.erros.push('Área não informada (não deu para deduzir pela função nem pela liderança).'); continue }
    if (l.novaFuncao) {
      l.novaFuncao.setorId = areaPorFuncao(l.novaFuncao.nome, ref.setores) ?? l.input.setorId
      const ja = funcoesNovas.some((f) => f.setorId === l.novaFuncao!.setorId && chaveFuncao(f.nome) === chaveFuncao(l.novaFuncao!.nome))
      if (!ja) funcoesNovas.push({ nome: l.novaFuncao.nome, setorId: l.novaFuncao.setorId })
    }
  }
  return { linhas, reconhecidas, ignoradas, funcoesNovas }
}

/** Planilha modelo (CSV com ";", abre direto no Excel). */
export function modeloCSV(): string {
  const exemplo: Partial<Record<Chave, string>> = {
    nome: 'Maria Souza', email: 'maria@empresa.com.br', area: 'Comercial', funcao: 'Executiva de contas', papel: 'Colaborador',
    superior: 'joao@empresa.com.br', topo: '', dataEntrada: '01/03/2025', unidade: 'Presencial', nascimento: '15/08/1990', regime: 'PJ', cnpj: '11.222.333/0001-81', razaoSocial: 'Maria Souza Consultoria LTDA',
    celular: '(11) 99999-0000', cidade: 'São Paulo', uf: 'SP', pixTipo: 'CNPJ', pixChave: '11.222.333/0001-81',
  }
  const esc = (s: string) => (/[";\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s)
  return '﻿' + [COLUNAS.map((c) => c.titulo).join(';'), COLUNAS.map((c) => esc(exemplo[c.chave] ?? '')).join(';')].join('\r\n') + '\r\n'
}

/* ---------- aplicação ---------- */
type Res = { ok: true; id?: string } | { ok: false; erro: string }
export interface AcoesImportacao {
  salvarPessoa: (input: PessoaInput, id?: string) => Res
  pessoas: () => Colaborador[]
  /** Sem estas, funções novas não são criadas e as lideranças das áreas não são ajustadas. */
  cargos?: () => Cargo[]
  salvarCargo?: (c: Omit<Cargo, 'id'>) => Res
  setores?: () => Setor[]
  salvarSetor?: (s: Omit<Setor, 'id'>, id: string) => Res
}
export interface ResultadoImportacao {
  criadas: string[]
  atualizadas: string[]
  ignoradas: number
  funcoesCriadas: string[]
  /** Resumo das lideranças conectadas ("Fulana lidera 3 pessoas · Comercial"). */
  liderancas: string[]
  erros: { linha: number; erro: string }[]
  avisos: { linha: number; aviso: string }[]
}

/**
 * Grava as linhas válidas em etapas: (1) cria as funções que faltam; (2) cria/atualiza os cadastros;
 * (3) aplica superior direto e CEO, já com todas as pessoas existindo; (4) conecta as lideranças às áreas.
 */
export function aplicarImportacao(linhas: LinhaImportacao[], acoes: AcoesImportacao, opcoes: { modo?: ModoImportacao } = {}): ResultadoImportacao {
  const modo = opcoes.modo ?? 'atualizar'
  const res: ResultadoImportacao = { criadas: [], atualizadas: [], ignoradas: 0, funcoesCriadas: [], liderancas: [], erros: [], avisos: [] }
  const idDaLinha = new Map<number, string>()
  const responsavelAntes = new Map<string, string | undefined>()

  for (const l of linhas) {
    if (l.acao === 'ignorar') { res.ignoradas++; continue }
    if (l.erros.length) continue
    const input = { ...l.input }
    if (l.novaFuncao && acoes.cargos && acoes.salvarCargo) {
      const nf = l.novaFuncao
      const setorFuncao = nf.setorId ?? input.setorId
      const achar = () => acoes.cargos!().find((g) => g.setorId === setorFuncao && chaveFuncao(g.nome) === chaveFuncao(nf.nome))
      const ja = achar()
      if (ja) input.cargoId = ja.id
      else {
        const r = acoes.salvarCargo({ nome: nf.nome, setorId: setorFuncao, nivel: nf.nivel })
        const id = r.ok ? r.id ?? achar()?.id : undefined
        if (id) { input.cargoId = id; res.funcoesCriadas.push(l.novaFuncao.nome) }
        else res.avisos.push({ linha: l.linha, aviso: `Função "${l.novaFuncao.nome}" não foi criada${r.ok ? '' : `: ${r.erro}`}; ficará em branco.` })
      }
    }
    if (l.existenteId) responsavelAntes.set(l.existenteId, acoes.pessoas().find((p) => p.id === l.existenteId)?.responsavelId)
    const r = acoes.salvarPessoa(input, l.existenteId)
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

  const liderados = new Map<string, string[]>()
  for (const l of linhas) {
    const id = idDaLinha.get(l.linha)
    if (!id || !l.superior) continue
    const r = acharPessoa(l.superior, acoes.pessoas())
    if (!r.pessoa) { res.avisos.push({ linha: l.linha, aviso: r.erro ?? 'Superior não encontrado.' }); continue }
    // No modo "completar", quem já tinha superior mantém o que está.
    if (modo === 'completar' && l.existenteId && responsavelAntes.get(l.existenteId)) continue
    if (acoes.pessoas().find((p) => p.id === id)?.responsavelId !== r.pessoa.id) {
      const e = regravar(id, { responsavelId: r.pessoa.id, topoOrganizacao: false })
      if (e) { res.avisos.push({ linha: l.linha, aviso: `Superior direto não aplicado: ${e}` }); continue }
    }
    liderados.set(r.pessoa.id, [...(liderados.get(r.pessoa.id) ?? []), id])
  }

  // Lideranças: quem lidera alguém passa a ter o papel de liderança (se era colaborador) e entra na coordenação
  // das áreas das pessoas que lidera; vira líder da própria área se ela ainda não tiver um.
  for (const [liderId, ids] of liderados) {
    const lider = acoes.pessoas().find((p) => p.id === liderId)
    if (!lider) continue
    if (lider.papel === 'colaborador') {
      const e = regravar(liderId, { papel: 'gestor' })
      if (e) res.avisos.push({ linha: 0, aviso: `${lider.nome}: papel de liderança não aplicado (${e}).` })
    }
    const areas = new Set(ids.map((i) => acoes.pessoas().find((p) => p.id === i)?.setorId).filter((s): s is string => !!s))
    const nomesAreas: string[] = []
    if (acoes.setores && acoes.salvarSetor) {
      for (const sid of areas) {
        const s = acoes.setores().find((x) => x.id === sid)
        if (!s) continue
        nomesAreas.push(s.nome)
        const virarLider = !s.gestorId && lider.setorId === sid
        if (s.liderancaIds.includes(liderId) && !virarLider) continue
        const { id: _id, ...dados } = s
        const r = acoes.salvarSetor({ ...dados, gestorId: virarLider ? liderId : s.gestorId, liderancaIds: [...new Set([...s.liderancaIds, liderId])] }, sid)
        if (!r.ok) res.avisos.push({ linha: 0, aviso: `${lider.nome} não entrou na liderança de ${s.nome}: ${r.erro}` })
      }
    }
    res.liderancas.push(`${lider.nome} lidera ${ids.length} pessoa(s)${nomesAreas.length ? ` · ${nomesAreas.join(', ')}` : ''}`)
  }
  res.funcoesCriadas = [...new Set(res.funcoesCriadas)]
  return res
}
