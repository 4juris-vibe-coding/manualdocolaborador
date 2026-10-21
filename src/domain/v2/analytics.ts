/* ============================================================
   People Analytics · regras puras (cliente e servidor; só imports relativos)
   - Períodos: padrão = últimos 6 meses; comparação com o período
     anterior de MESMO tamanho (só quando há base nos dois lados).
   - Cada indicador carrega definição, fonte e período, e diz
     honestamente quando NÃO está disponível (nada é inventado).
   ============================================================ */

export interface Periodo { de: string; ate: string }

const DIA = 86400000
const ms = (d: string) => Date.parse(`${d}T00:00:00Z`)
const iso = (t: number) => new Date(t).toISOString().slice(0, 10)
export const ehData = (v: unknown): v is string => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) && !Number.isNaN(Date.parse(v))

/** Padrão: do primeiro dia do mês de 5 meses atrás até hoje (6 meses corridos). Datas inválidas ou invertidas caem no padrão. */
export function periodoDosFiltros(de: unknown, ate: unknown, hoje: string): Periodo {
  const fim = ehData(ate) ? ate : hoje
  const [a, m] = fim.split('-').map(Number)
  const inicioPadrao = iso(Date.UTC(a, m - 1 - 5, 1))
  const ini = ehData(de) ? de : inicioPadrao
  return ini <= fim ? { de: ini, ate: fim } : { de: inicioPadrao, ate: fim }
}

export const diasDoPeriodo = (p: Periodo) => Math.round((ms(p.ate) - ms(p.de)) / DIA) + 1

/** Período imediatamente anterior, com o mesmo número de dias. */
export function periodoAnterior(p: Periodo): Periodo {
  const n = diasDoPeriodo(p)
  const ate = iso(ms(p.de) - DIA)
  return { de: iso(ms(p.de) - n * DIA), ate }
}

export const rotuloPeriodo = (p: Periodo) => `${p.de.split('-').reverse().join('/')} a ${p.ate.split('-').reverse().join('/')}`

/** Meses (AAAA-MM) cobertos pelo período, em ordem. */
export function mesesDoPeriodo(p: Periodo): string[] {
  const out: string[] = []
  let [a, m] = p.de.split('-').map(Number)
  const [fa, fm] = p.ate.split('-').map(Number)
  while (a < fa || (a === fa && m <= fm)) { out.push(`${a}-${String(m).padStart(2, '0')}`); m++; if (m > 12) { m = 1; a++ } }
  return out.slice(-36)
}

export interface Variacao { absoluta: number; percentual: number | null; sentido: 'subiu' | 'caiu' | 'igual' }
/** Variação atual × anterior. Sem base (qualquer lado nulo) não há comparação; percentual só com anterior ≠ 0. */
export function variacao(atual: number | null, anterior: number | null): Variacao | null {
  if (atual === null || anterior === null) return null
  const abs = Math.round((atual - anterior) * 10) / 10
  return { absoluta: abs, percentual: anterior !== 0 ? Math.round(((atual - anterior) / Math.abs(anterior)) * 1000) / 10 : null, sentido: abs > 0 ? 'subiu' : abs < 0 ? 'caiu' : 'igual' }
}

const arred = (n: number) => Math.round(n * 10) / 10
/** Aceitas ÷ (aceitas + recusadas). Propostas ainda em aberto não entram. */
export function conversaoProposta(aceitas: number, recusadas: number): number | null {
  return aceitas + recusadas > 0 ? arred((aceitas / (aceitas + recusadas)) * 100) : null
}
/** Vagas finalizadas (encerradas/canceladas) com todas as posições preenchidas ÷ vagas finalizadas. */
export function taxaConclusaoProcessos(vagas: { status: string; qtdPosicoes: number; posicoesPreenchidas: number }[]): number | null {
  const fim = vagas.filter((v) => v.status === 'encerrada' || v.status === 'cancelada')
  if (!fim.length) return null
  return arred((fim.filter((v) => v.status === 'encerrada' && v.posicoesPreenchidas >= v.qtdPosicoes).length / fim.length) * 100)
}
export const pctDe = (parte: number, total: number): number | null => (total > 0 ? arred((parte / total) * 100) : null)

export type Bloco = 'recrutamento' | 'pesquisas' | 'estrutura'

export interface Indicador {
  chave: string
  rotulo: string
  valor: number | null
  /** 'dias' | '%' | 'n' | 'pontos' */
  unidade: 'dias' | '%' | 'n' | 'pontos'
  definicao: string
  fonte: string
  periodo: string
  disponivel: boolean
  dependencia?: string
  anterior?: number | null
  variacao?: Variacao | null
  /** Quantidade de registros que compõem o indicador (transparência sobre a amostra). */
  base?: number
  /** Chave aceita por `analytics/detalhe` (clicar no indicador abre os registros). */
  detalhe?: string
}

export function indicador(p: Omit<Indicador, 'disponivel'> & { disponivel?: boolean }): Indicador {
  const disponivel = p.disponivel ?? p.valor !== null
  return { ...p, disponivel, variacao: p.anterior !== undefined ? variacao(p.valor, p.anterior ?? null) : undefined }
}

export function indisponivel(chave: string, rotulo: string, dependencia: string, fonte = 'Não há base de dados'): Indicador {
  return { chave, rotulo, valor: null, unidade: 'n', definicao: 'Indicador não calculado neste painel.', fonte, periodo: '—', disponivel: false, dependencia }
}

/** Indicadores que o sistema não tem como medir hoje: aparecem como indisponíveis, com a dependência explicada. */
export const INDISPONIVEIS_PADRAO: Indicador[] = [
  indisponivel('rotatividade', 'Rotatividade', 'Calculada na página Rotatividade (RH → Relatórios) a partir das datas de início e encerramento das parcerias; não é replicada aqui.', 'Cadastro de pessoas'),
  indisponivel('absenteismo', 'Absenteísmo', 'Registro de ausências/ponto. O modelo de prestação de serviços PJ não tem esse controle.'),
  indisponivel('folha', 'Custo de folha', 'Dados de folha de pagamento. Contratos e notas fiscais são dados financeiros restritos e não entram neste painel.'),
  indisponivel('desempenho', 'Desempenho individual', 'Resultados de avaliação são individuais e sensíveis; só aparecem nos relatórios de avaliação, com seus próprios controles.'),
]

/* ---------- CSV (mesmo formato do restante do sistema: ; e BOM) ---------- */
export const celulaCsv = (v: unknown): string => {
  const s = v === null || v === undefined ? '' : String(v)
  const seguro = /^[=+\-@\t\r]/.test(s) ? `'${s}` : s // evita injeção de fórmula em planilhas
  return /[";\n\r]/.test(seguro) ? `"${seguro.replace(/"/g, '""')}"` : seguro
}
export function paraCsv(linhas: unknown[][]): string {
  return '﻿' + linhas.map((l) => l.map(celulaCsv).join(';')).join('\r\n')
}

/* ---------- cache de 60 s (relógio injetável para teste) ---------- */
export class CacheCurto<T> {
  private m = new Map<string, { ate: number; valor: T }>()
  constructor(private ttlMs = 60_000, private maximo = 200) {}
  obter(chave: string, agora: number): T | undefined {
    const e = this.m.get(chave)
    if (!e) return undefined
    if (e.ate <= agora) { this.m.delete(chave); return undefined }
    return e.valor
  }
  guardar(chave: string, valor: T, agora: number) {
    if (this.m.size >= this.maximo) for (const [k, e] of this.m) if (e.ate <= agora || this.m.size >= this.maximo) this.m.delete(k)
    this.m.set(chave, { ate: agora + this.ttlMs, valor })
  }
  limpar() { this.m.clear() }
}

/* ---------- séries ---------- */
export function serieMensal(meses: string[], valores: Map<string, number>): { mes: string; valor: number }[] {
  return meses.map((mes) => ({ mes, valor: valores.get(mes) ?? 0 }))
}
