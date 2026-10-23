/* ============================================================
   4JURIS Pessoas · Importação da ficha de cargo a partir de PDF (regras puras)
   O servidor (api/_v2/cargoPdf.ts) extrai o texto do PDF da descrição de
   cargo; aqui ele é separado pelas seções (Descrição, Objetivo,
   Responsabilidades, Requisitos, Competências...) nos campos da ficha
   oficial e saneado antes de ir para o formulário. Família e nível vêm
   como texto: a tela casa com a taxonomia cadastrada.
   ============================================================ */
import { chave, itensDaLista, linhasDoPdf, paragrafos } from './vagaImportada.js'

/** Campos que a importação devolve, com os mesmos nomes da ficha (CargoFicha). */
export interface FichaImportada {
  nome: string
  codigo: string
  area: string
  familia: string
  nivel: string
  descricaoOficial: string
  objetivo: string
  responsabilidades: string
  entregas: string
  requisitosMinimos: string
  formacao: string
  experiencia: string
  competenciasTecnicas: string[]
  competenciasComportamentais: string[]
  conhecimentos: string[]
  certificacoes: string[]
  kpis: string[]
  vigenciaInicio: string | null
}

type Secao = 'nome' | 'codigo' | 'area' | 'familia' | 'nivel' | 'descricaoOficial' | 'objetivo' | 'responsabilidades' | 'entregas'
  | 'requisitosMinimos' | 'formacao' | 'experiencia' | 'competenciasTecnicas' | 'competenciasComportamentais' | 'conhecimentos'
  | 'certificacoes' | 'kpis' | 'vigenciaInicio' | 'ignorar'

/** Títulos aceitos para cada seção (sem acento, minúsculos). "ignorar" fecha a seção anterior sem virar campo. */
const TITULOS: Record<Secao, string[]> = {
  nome: ['cargo', 'nome do cargo', 'titulo do cargo', 'denominacao do cargo', 'funcao'],
  codigo: ['codigo', 'codigo do cargo'],
  area: ['area', 'area de atuacao', 'departamento', 'setor', 'diretoria'],
  familia: ['familia', 'familia do cargo', 'familia de cargos'],
  nivel: ['nivel', 'nivel do cargo', 'senioridade', 'grau'],
  descricaoOficial: ['descricao', 'descricao do cargo', 'descricao oficial', 'descricao sumaria', 'resumo do cargo', 'sobre o cargo', 'visao geral'],
  objetivo: ['objetivo', 'objetivo do cargo', 'objetivo da funcao', 'missao', 'missao do cargo', 'proposito', 'proposito do cargo'],
  responsabilidades: ['responsabilidades', 'principais responsabilidades', 'atribuicoes', 'principais atribuicoes', 'atividades', 'principais atividades',
    'atividades e responsabilidades', 'responsabilidades e atribuicoes', 'descricao detalhada'],
  entregas: ['entregas', 'principais entregas', 'entregaveis', 'resultados esperados'],
  requisitosMinimos: ['requisitos', 'requisitos minimos', 'pre-requisitos', 'requisitos obrigatorios', 'requisitos do cargo'],
  formacao: ['formacao', 'formacao academica', 'escolaridade', 'formacao minima'],
  experiencia: ['experiencia', 'experiencia minima', 'experiencia previa', 'experiencia necessaria', 'tempo de experiencia'],
  competenciasTecnicas: ['competencias tecnicas', 'habilidades tecnicas', 'hard skills'],
  competenciasComportamentais: ['competencias comportamentais', 'habilidades comportamentais', 'soft skills', 'perfil comportamental'],
  conhecimentos: ['conhecimentos', 'conhecimentos necessarios', 'conhecimentos especificos', 'conhecimentos tecnicos', 'ferramentas', 'ferramentas e sistemas'],
  certificacoes: ['certificacoes', 'certificacoes desejaveis', 'certificacoes necessarias', 'registro profissional'],
  kpis: ['kpis', 'kpi', 'indicadores', 'indicadores de desempenho', 'indicadores de desempenho relacionados', 'metricas', 'metas'],
  vigenciaInicio: ['vigencia', 'inicio da vigencia', 'data de vigencia', 'vigente desde'],
  ignorar: ['faixa salarial', 'remuneracao', 'salario', 'beneficios', 'jornada', 'jornada de trabalho', 'reporta a', 'reporta-se a', 'subordinacao',
    'aprovacao', 'aprovado por', 'elaborado por', 'revisado por', 'historico de revisoes', 'observacoes'],
}

const MARCADOR = /^\s*(?:[-•●▪◦‣∙·*–—✓✔➤►>]|\d{1,2}[.)])\s*/
const escapar = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

/** Se a linha é título de seção, devolve a seção e o que vier depois de ":" na mesma linha ("Formação: Direito"). */
function tituloDaLinha(linha: string): { secao: Secao; resto: string } | null {
  if (MARCADOR.test(linha) && !/^\s*\d{1,2}[.)]/.test(linha)) return null // item de lista nunca é título
  const k = chave(linha).replace(/^\d{1,2}(?:\.\d{1,2})*[.)]?\s+/, '')
  for (const [secao, nomes] of Object.entries(TITULOS) as [Secao, string[]][]) {
    for (const nome of nomes) {
      if (k === nome || k === nome + ':') return { secao, resto: '' }
      const m = new RegExp(`^${escapar(nome)}\\s*[:\\-–—]\\s*(.+)$`).exec(k)
      if (m) return { secao, resto: linha.slice(linha.length - m[1].length).trim() }
    }
  }
  return null
}

/** Itens de competências/conhecimentos: lista com marcadores ou uma linha separada por vírgulas/ponto e vírgula. */
function itensCurtos(linhas: string[]): string[] {
  const itens = itensDaLista(linhas)
  return itens.flatMap((i) => (/[;,]/.test(i) && i.length <= 300 && !/[.!?]\s/.test(i) ? i.split(/\s*[;,]\s*/) : [i]))
    .map((i) => i.replace(/[.;]$/, '').trim()).filter(Boolean)
}

/** "15/11/2026" → "2026-11-15". */
const dataBr = (s: string) => {
  const m = /\b(\d{1,2})\/(\d{1,2})\/(\d{4})\b/.exec(s)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

/** Separa o texto extraído do PDF nas seções da ficha e devolve os campos (já saneados). */
export function extrairFichaDoTexto(texto: string): FichaImportada {
  const secoes = new Map<Secao | 'inicio', string[]>([['inicio', []]])
  let atual: Secao | 'inicio' = 'inicio'
  for (const l of linhasDoPdf(texto)) {
    const t = tituloDaLinha(l)
    if (t) {
      atual = t.secao
      if (!secoes.has(atual)) secoes.set(atual, [])
      if (t.resto) secoes.get(atual)!.push(t.resto)
    } else secoes.get(atual)!.push(l)
  }
  const de = (s: Secao) => secoes.get(s) ?? []
  const linha = (s: Secao) => de(s)[0] ?? ''
  const lista = (s: Secao) => itensDaLista(de(s)).join('\n')

  // Nome: a seção "Cargo"; sem ela, a primeira linha antes de qualquer seção que não seja o título do documento.
  const cabecalho = secoes.get('inicio')!.find((l) => !/^(?:ficha|descricao|perfil) (?:de|do) cargo$/.test(chave(l)))
  return normalizarFichaImportada({
    nome: linha('nome') || (cabecalho ?? ''),
    codigo: linha('codigo'), area: linha('area'), familia: linha('familia'), nivel: linha('nivel'),
    descricaoOficial: paragrafos(de('descricaoOficial')),
    objetivo: paragrafos(de('objetivo')),
    responsabilidades: lista('responsabilidades'),
    entregas: lista('entregas'),
    requisitosMinimos: lista('requisitosMinimos'),
    formacao: paragrafos(de('formacao')),
    experiencia: paragrafos(de('experiencia')),
    competenciasTecnicas: itensCurtos(de('competenciasTecnicas')),
    competenciasComportamentais: itensCurtos(de('competenciasComportamentais')),
    conhecimentos: itensCurtos(de('conhecimentos')),
    certificacoes: itensCurtos(de('certificacoes')),
    kpis: itensDaLista(de('kpis')),
    vigenciaInicio: dataBr(de('vigenciaInicio').join(' ')),
  })
}

/* ---------- saneamento ---------- */

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.replace(/\r\n?/g, '\n').trim().slice(0, max) : '')
const itens = (v: unknown) => [...new Set((Array.isArray(v) ? v : [])
  .map((i) => str(i, 1000).replace(MARCADOR, '').replace(/\s+/g, ' ').trim())
  .filter(Boolean).map((i) => i.slice(0, 200)))].slice(0, 60)
const data = (v: unknown) => (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(`${v}T12:00:00Z`)) ? v : null)

/** Saneia os campos: nada fora do formato da ficha passa adiante. */
export function normalizarFichaImportada(bruto: unknown): FichaImportada {
  const b = (bruto && typeof bruto === 'object' ? bruto : {}) as Record<string, unknown>
  return {
    nome: str(b.nome, 200), codigo: str(b.codigo, 40), area: str(b.area, 120), familia: str(b.familia, 120), nivel: str(b.nivel, 120),
    descricaoOficial: str(b.descricaoOficial, 6000), objetivo: str(b.objetivo, 4000), responsabilidades: str(b.responsabilidades, 6000),
    entregas: str(b.entregas, 6000), requisitosMinimos: str(b.requisitosMinimos, 6000), formacao: str(b.formacao, 2000), experiencia: str(b.experiencia, 2000),
    competenciasTecnicas: itens(b.competenciasTecnicas), competenciasComportamentais: itens(b.competenciasComportamentais),
    conhecimentos: itens(b.conhecimentos), certificacoes: itens(b.certificacoes), kpis: itens(b.kpis),
    vigenciaInicio: data(b.vigenciaInicio),
  }
}

/** A ficha importada trouxe algum conteúdo de cargo? */
export const temConteudoDeCargo = (f: FichaImportada) =>
  !!(f.descricaoOficial || f.objetivo || f.responsabilidades || f.entregas || f.requisitosMinimos || f.formacao || f.experiencia
    || f.competenciasTecnicas.length || f.competenciasComportamentais.length || f.conhecimentos.length || f.kpis.length)
