/* ============================================================
   4JURIS Pessoas · Importação de vaga a partir de PDF (regras puras)
   O servidor (api/_v2/vagaPdf.ts) extrai o texto do PDF; aqui ele é
   separado pelas seções do modelo de vaga da 4JURIS — Vaga, Sobre a vaga
   (modelo de trabalho e de contratação), Sobre a 4JURIS, Sobre a
   oportunidade, Responsabilidades, Requisitos, Vantagens e Localização —
   e saneado (enums, tamanhos, listas) antes de ir para o formulário.
   ============================================================ */
import { MODALIDADES_VAGA, REGIMES_CONTRATACAO } from './vagas.js'

/** Campos que a importação devolve, com os mesmos nomes do formulário da vaga (VagaForm). */
export interface VagaImportada {
  titulo: string
  modalidade: string | null
  regimeContratacao: string | null
  sobreEmpresa: string
  textoPublico: string
  responsabilidades: string
  desafios: string
  requisitos: string[]
  diferenciais: string[]
  vantagens: string[]
  etapas: string[]
  endereco: string
  jornada: string
  senioridade: string
  qtdPosicoes: number | null
  salarioMin: number | null
  salarioMax: number | null
  encerraCandidaturasEm: string | null
  dataInicioPrevista: string | null
}

/* ---------- seções do modelo ---------- */

type Secao = 'vaga' | 'sobreVaga' | 'sobreEmpresa' | 'oportunidade' | 'responsabilidades' | 'desafios' | 'requisitos' | 'diferenciais' | 'vantagens' | 'etapas' | 'localizacao'

/** Títulos aceitos para cada seção (sem acento, minúsculos). O primeiro é o do modelo; os outros cobrem variações. */
const TITULOS: Record<Secao, string[]> = {
  vaga: ['vaga'],
  sobreVaga: ['sobre a vaga'],
  sobreEmpresa: ['sobre a 4juris', 'sobre a 4 juris', 'sobre a empresa', 'sobre nos', 'quem somos'],
  oportunidade: ['sobre a oportunidade', 'a oportunidade', 'descricao da vaga'],
  responsabilidades: ['responsabilidades', 'atividades', 'principais atividades', 'atribuicoes'],
  desafios: ['desafios'],
  requisitos: ['requisitos', 'pre-requisitos', 'requisitos obrigatorios'],
  diferenciais: ['diferenciais', 'desejaveis', 'sera um diferencial'],
  vantagens: ['vantagens', 'beneficios', 'o que oferecemos'],
  etapas: ['etapas', 'etapas do processo', 'processo seletivo', 'etapas do processo seletivo'],
  localizacao: ['localizacao', 'local', 'endereco', 'local de trabalho'],
}

export const semAcento = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '')
export const chave = (s: string) => semAcento(s).toLowerCase().replace(/\s+/g, ' ').trim()

/** Se a linha é título de seção, devolve a seção e o que vier depois de ":" na mesma linha.
    Dentro de "Sobre a vaga", "Local: X" é um campo, não uma seção nova. */
function tituloDaLinha(linha: string, atual: Secao | 'inicio'): { secao: Secao; resto: string } | null {
  const k = chave(linha).replace(/^(?:\d+[.)]\s*)/, '')
  for (const [secao, nomes] of Object.entries(TITULOS) as [Secao, string[]][]) {
    for (const nome of nomes) {
      if (k === nome || k === nome + ':') return { secao, resto: '' }
      // "Vaga: SDR Pleno", "Localização – São Paulo/SP"
      const m = new RegExp(`^${nome.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*[:\\-–—]\\s*(.+)$`).exec(k)
      if (m && atual !== 'sobreVaga') return { secao, resto: linha.slice(linha.length - m[1].length).trim() }
    }
  }
  return null
}

/* ---------- texto corrido e listas ---------- */

const MARCADOR = /^\s*(?:[-•●▪◦‣∙·*–—✓✔➤►>]|\d{1,2}[.)])\s*/
const SO_MARCADOR = /^\s*(?:[-•●▪◦‣∙·*–—✓✔➤►>]|\d{1,2}[.)])\s*$/
const RUIDO = /^(?:\d{1,3}|p[aá]gina \d+(?: de \d+)?|\d+\s*\/\s*\d+)$/i

/** A linha continua a anterior (quebra do PDF no meio da frase)? */
const continua = (anterior: string, atual: string) => !/[.!?:;]$/.test(anterior) && /^[a-zà-ú(,]/.test(atual)

/** Junta as quebras de linha do PDF em parágrafos. */
export function paragrafos(linhas: string[]): string {
  const out: string[] = []
  for (const l of linhas) {
    if (out.length && continua(out[out.length - 1], l)) out[out.length - 1] += ' ' + l
    else out.push(l)
  }
  return out.join('\n')
}

/** Um item por posição: com marcadores, cada marcador abre um item; sem eles, cada linha que não continua a anterior. */
export function itensDaLista(linhas: string[]): string[] {
  const comMarcador = linhas.some((l) => MARCADOR.test(l))
  const out: string[] = []
  let abrir = true
  for (const l of linhas) {
    if (SO_MARCADOR.test(l)) { abrir = true; continue } // marcador numa linha e o texto na seguinte
    const novo = abrir || (comMarcador ? MARCADOR.test(l) : !continua(out[out.length - 1] ?? '', l))
    const texto = l.replace(MARCADOR, '').trim()
    if (!texto) continue
    if (novo || !out.length) out.push(texto)
    else out[out.length - 1] += ' ' + texto
    abrir = false
  }
  return out
}

/** Linhas do texto extraído do PDF, sem espaços repetidos, vazias nem números de página. */
export const linhasDoPdf = (texto: string) =>
  texto.replace(/\r\n?/g, '\n').split('\n').map((l) => l.replace(/\s+/g, ' ').trim()).filter((l) => l && !RUIDO.test(l))

/* ---------- campos de "Sobre a vaga" ---------- */

function modalidadeDe(s: string): string | null {
  const k = chave(s)
  if (/hibrid/.test(k)) return 'hibrido'
  if (/remot|home ?office|teletrabalho/.test(k)) return 'remoto'
  if (/presencial/.test(k)) return 'presencial'
  return null
}

function regimeDe(s: string): string | null {
  const k = chave(s)
  if (/\bclt\b/.test(k)) return 'clt'
  if (/estagi/.test(k)) return 'estagio'
  if (/temporari/.test(k)) return 'temporario'
  if (/autonom/.test(k)) return 'autonomo'
  if (/\bpj\b|pessoa juridica/.test(k)) return 'pj'
  if (/\bmei\b|microempreendedor/.test(k)) return 'mei'
  return null
}

/** "R$ 3.500,00" → 3500; devolve todos os valores em reais do texto. */
export function valoresEmReais(s: string): number[] {
  return [...s.matchAll(/R\$\s*(\d{1,3}(?:\.\d{3})+|\d+)(?:,(\d{1,2}))?(\s*mil\b)?/gi)].map((m) => {
    const v = Number(m[1].replace(/\./g, '') + '.' + (m[2] ?? '0'))
    return m[3] ? v * 1000 : v
  })
}

/** "15/11/2026" → "2026-11-15". */
const dataBr = (s: string) => {
  const m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

const SENIORIDADES: [RegExp, string][] = [[/\bjunior\b|\bjr\b/, 'Júnior'], [/\bpleno\b|\bpl\b/, 'Pleno'], [/\bsenior\b|\bsr\b/, 'Sênior'], [/\btrainee\b/, 'Trainee'], [/\bestagiari/, 'Estágio']]
const senioridadeDe = (s: string) => SENIORIDADES.find(([re]) => re.test(chave(s)))?.[1] ?? ''

/* ---------- leitura ---------- */

/** Separa o texto extraído do PDF nas seções do modelo e devolve os campos do formulário (já saneados). */
export function extrairVagaDoTexto(texto: string): VagaImportada {
  const linhas = linhasDoPdf(texto)
  const secoes = new Map<Secao | 'inicio', string[]>([['inicio', []]])
  let atual: Secao | 'inicio' = 'inicio'
  for (const l of linhas) {
    const t = tituloDaLinha(l, atual)
    if (t) {
      atual = t.secao
      if (!secoes.has(atual)) secoes.set(atual, [])
      if (t.resto) secoes.get(atual)!.push(t.resto)
    } else secoes.get(atual)!.push(l)
  }
  const de = (s: Secao) => secoes.get(s) ?? []

  // Título: a seção "Vaga"; sem ela, a primeira linha antes de qualquer seção.
  const titulo = de('vaga')[0] ?? secoes.get('inicio')![0] ?? ''

  // "Sobre a vaga": linhas "Chave: valor" viram campos; o resto entra no texto da oportunidade.
  let modalidade: string | null = null, regime: string | null = null, jornada = '', senioridade = '', qtd: number | null = null
  let encerra: string | null = null, inicio: string | null = null, endereco = ''
  const salarios: number[] = []
  const soltas: string[] = []
  for (const l of de('sobreVaga')) {
    const m = /^([^:]{2,40}):\s*(.+)$/.exec(l)
    const k = m ? chave(m[1]) : ''
    const v = m ? m[2].trim() : l
    if (/modelo de trabalho|modalidade|formato de trabalho|regime de trabalho/.test(k)) modalidade = modalidadeDe(v) ?? modalidade
    else if (/modelo de contrata|contratacao|tipo de contrato|vinculo/.test(k)) regime = regimeDe(v) ?? regime
    else if (/salario|remuneracao|faixa salarial/.test(k)) salarios.push(...valoresEmReais(v))
    else if (/jornada|horario|carga horaria/.test(k)) jornada = v
    else if (/senioridade|nivel/.test(k)) senioridade = v
    else if (/quantidade|n(?:o|umero) de vagas|posicoes|vagas/.test(k)) qtd = Number(/\d+/.exec(v)?.[0]) || null
    else if (/inscric|candidatura|prazo/.test(k)) encerra = dataBr(v) ?? encerra
    else if (/inicio/.test(k)) inicio = dataBr(v) ?? inicio
    else if (/^local|endereco/.test(k)) endereco = v
    else soltas.push(l)
  }
  // Sem a linha "Modelo de ...: X", procura a palavra na própria seção.
  const sobreVagaTexto = de('sobreVaga').join(' ')
  modalidade ??= modalidadeDe(sobreVagaTexto)
  regime ??= regimeDe(sobreVagaTexto)
  if (!salarios.length) salarios.push(...valoresEmReais(sobreVagaTexto))

  const textoPublico = paragrafos([...de('oportunidade'), ...soltas])
  return normalizarVagaImportada({
    titulo,
    modalidade, regimeContratacao: regime,
    sobreEmpresa: paragrafos(de('sobreEmpresa')),
    textoPublico,
    responsabilidades: itensDaLista(de('responsabilidades')).join('\n'),
    desafios: itensDaLista(de('desafios')).join('\n'),
    requisitos: itensDaLista(de('requisitos')),
    diferenciais: itensDaLista(de('diferenciais')),
    vantagens: itensDaLista(de('vantagens')),
    etapas: itensDaLista(de('etapas')),
    endereco: de('localizacao').join(', ') || endereco,
    jornada,
    senioridade: senioridade || senioridadeDe(titulo),
    qtdPosicoes: qtd,
    salarioMin: salarios.length ? Math.min(...salarios) : null,
    salarioMax: salarios.length ? Math.max(...salarios) : null,
    encerraCandidaturasEm: encerra, dataInicioPrevista: inicio,
  })
}

/* ---------- saneamento ---------- */

const MAX_ITEM = 200
const MAX_ITENS = 40
const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '')
const itens = (v: unknown) => (Array.isArray(v) ? v : [])
  .map((i) => str(i, 1000).replace(/^\s*(?:[-•*·]|\d+[.)])\s*/, '').replace(/\s+/g, ' ').trim())
  .filter(Boolean).map((i) => i.slice(0, MAX_ITEM)).slice(0, MAX_ITENS)
const valor = (v: unknown) => (typeof v === 'number' && Number.isFinite(v) && v >= 0 ? Math.round(v * 100) / 100 : null)
const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : null)
const um = <T extends string>(v: unknown, lista: readonly T[]) => (typeof v === 'string' && (lista as readonly string[]).includes(v) ? v : null)

/** Saneia os campos: nada fora do formato do formulário passa adiante. */
export function normalizarVagaImportada(bruto: unknown): VagaImportada {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  const qtd = typeof b.qtdPosicoes === 'number' && Number.isInteger(b.qtdPosicoes) && b.qtdPosicoes >= 1 && b.qtdPosicoes <= 500 ? b.qtdPosicoes : null
  let salarioMin = valor(b.salarioMin), salarioMax = valor(b.salarioMax)
  if (salarioMin !== null && salarioMax !== null && salarioMax < salarioMin) [salarioMin, salarioMax] = [salarioMax, salarioMin]
  return {
    titulo: str(b.titulo, 200),
    modalidade: um(b.modalidade, MODALIDADES_VAGA),
    regimeContratacao: um(b.regimeContratacao, REGIMES_CONTRATACAO),
    sobreEmpresa: str(b.sobreEmpresa, 4000),
    textoPublico: str(b.textoPublico, 8000),
    responsabilidades: str(b.responsabilidades, 6000),
    desafios: str(b.desafios, 4000),
    requisitos: itens(b.requisitos), diferenciais: itens(b.diferenciais), vantagens: itens(b.vantagens), etapas: itens(b.etapas),
    endereco: str(b.endereco, 300), jornada: str(b.jornada, 300), senioridade: str(b.senioridade, 60),
    qtdPosicoes: qtd, salarioMin, salarioMax,
    encerraCandidaturasEm: data(b.encerraCandidaturasEm), dataInicioPrevista: data(b.dataInicioPrevista),
  }
}
