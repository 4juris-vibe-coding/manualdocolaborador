/* ============================================================
   Gestão de prestadores PJ · regras puras (cliente e servidor)
   ------------------------------------------------------------
   - Valores monetários são calculados em CENTAVOS inteiros.
   - Nenhuma alíquota tributária está fixada aqui: retenções vêm de
     regras cadastradas por pessoa autorizada (com fundamento e
     vigência) ou de lançamento manual, e são sempre revisáveis.
   - Arredondamento das retenções: meio para cima ("comercial"),
     na segunda casa decimal, sobre base × alíquota ÷ 100.
   - Estes cálculos são CONTROLE INTERNO. Não substituem a apuração
     fiscal oficial nem a orientação contábil.
   Só imports relativos (este arquivo roda também no servidor).
   ============================================================ */

/* ---------- rótulos e situações ---------- */
type Tom = 'brand' | 'success' | 'warning' | 'danger' | 'neutral' | 'gold'
export type Mapa = Record<string, { rotulo: string; tom: Tom }>

export const STATUS_CONTRATO = ['rascunho', 'vigente', 'suspenso', 'encerrado'] as const
export type StatusContrato = (typeof STATUS_CONTRATO)[number]
export const MAPA_STATUS_CONTRATO: Mapa = {
  rascunho: { rotulo: 'Rascunho', tom: 'neutral' },
  vigente: { rotulo: 'Vigente', tom: 'success' },
  suspenso: { rotulo: 'Suspenso', tom: 'warning' },
  encerrado: { rotulo: 'Encerrado', tom: 'neutral' },
}

export const STATUS_NOTA = ['recebida', 'conferida', 'aprovada', 'devolvida', 'cancelada'] as const
export type StatusNota = (typeof STATUS_NOTA)[number]
export const MAPA_STATUS_NOTA: Mapa = {
  recebida: { rotulo: 'Aguardando conferência', tom: 'warning' },
  conferida: { rotulo: 'Aguardando aceite do serviço', tom: 'brand' },
  aprovada: { rotulo: 'Aprovada', tom: 'success' },
  devolvida: { rotulo: 'Devolvida para correção', tom: 'danger' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
}

export const STATUS_CONTA = ['prevista', 'autorizada', 'paga', 'cancelada'] as const
export type StatusConta = (typeof STATUS_CONTA)[number]
export const MAPA_STATUS_CONTA: Mapa = {
  prevista: { rotulo: 'Prevista (aguarda autorização)', tom: 'warning' },
  autorizada: { rotulo: 'Autorizada (aguarda pagamento)', tom: 'brand' },
  paga: { rotulo: 'Paga (registro manual)', tom: 'success' },
  cancelada: { rotulo: 'Cancelada', tom: 'neutral' },
}

export const STATUS_DOCUMENTO = ['pendente', 'valido', 'rejeitado', 'substituido'] as const
export const MAPA_STATUS_DOCUMENTO: Mapa = {
  pendente: { rotulo: 'Aguardando conferência', tom: 'warning' },
  valido: { rotulo: 'Válido', tom: 'success' },
  rejeitado: { rotulo: 'Rejeitado', tom: 'danger' },
  substituido: { rotulo: 'Substituído', tom: 'neutral' },
}

export const CATEGORIAS_DOCUMENTO = ['contrato', 'aditivo', 'cadastral', 'certidao', 'fiscal', 'nota_fiscal', 'comprovante_pagamento', 'aprovacao', 'encerramento', 'outro'] as const
export type CategoriaDocumento = (typeof CATEGORIAS_DOCUMENTO)[number]
export const ROTULO_CATEGORIA_DOC: Record<CategoriaDocumento, string> = {
  contrato: 'Contrato assinado', aditivo: 'Aditivo contratual', cadastral: 'Documento cadastral', certidao: 'Certidão',
  fiscal: 'Documento fiscal', nota_fiscal: 'Nota fiscal', comprovante_pagamento: 'Comprovante de pagamento',
  aprovacao: 'Registro de aprovação', encerramento: 'Documento de encerramento', outro: 'Outro',
}

export const MODELOS_REMUNERACAO = ['mensal_fixo', 'por_projeto', 'por_hora', 'por_entrega'] as const
export const ROTULO_MODELO: Record<string, string> = {
  mensal_fixo: 'Valor mensal fixo', por_projeto: 'Valor global por projeto', por_hora: 'Por hora', por_entrega: 'Por entrega',
}
export const ROTULO_VALOR_MODELO: Record<string, string> = {
  mensal_fixo: 'Valor mensal', por_projeto: 'Valor global', por_hora: 'Valor da hora', por_entrega: 'Valor por entrega',
}
export const PERIODICIDADES = ['mensal', 'quinzenal', 'por_entrega', 'unica'] as const
export const ROTULO_PERIODICIDADE: Record<string, string> = { mensal: 'Mensal', quinzenal: 'Quinzenal', por_entrega: 'Por entrega', unica: 'Parcela única' }
export const ROTULO_RENOVACAO: Record<string, string> = { automatica: 'Renovação automática', manual: 'Renovação por decisão', nao_renova: 'Não renova' }

/** Fim da relação COMERCIAL. Não é rescisão trabalhista: não há verbas rescisórias. */
export const TIPOS_ENCERRAMENTO = ['termino_prazo', 'nao_renovacao', 'distrato', 'rescisao_contratual', 'outro'] as const
export const ROTULO_ENCERRAMENTO: Record<string, string> = {
  termino_prazo: 'Término do prazo contratado', nao_renovacao: 'Não renovação', distrato: 'Distrato (acordo entre as partes)',
  rescisao_contratual: 'Rescisão contratual (cláusula do contrato)', outro: 'Outro motivo',
}

export const TIPOS_FORNECEDOR = ['pj', 'mei', 'pf'] as const
export const ROTULO_TIPO_FORNECEDOR: Record<string, string> = { pj: 'Pessoa jurídica', mei: 'MEI', pf: 'Pessoa física (autônomo)' }
export const REGIMES_TRIBUTARIOS = ['mei', 'simples_nacional', 'lucro_presumido', 'lucro_real', 'pessoa_fisica', 'nao_informado'] as const
export const ROTULO_REGIME: Record<string, string> = {
  mei: 'MEI', simples_nacional: 'Simples Nacional', lucro_presumido: 'Lucro Presumido', lucro_real: 'Lucro Real', pessoa_fisica: 'Pessoa física', nao_informado: 'Não informado',
}

export const TIPOS_RETENCAO = ['IRRF', 'ISS', 'INSS', 'PIS', 'COFINS', 'CSLL', 'CSRF', 'outra'] as const
export const FORMAS_PAGAMENTO = ['pix', 'ted', 'boleto', 'transferencia', 'outro'] as const
export const ROTULO_FORMA: Record<string, string> = { pix: 'PIX', ted: 'TED', boleto: 'Boleto', transferencia: 'Transferência', outro: 'Outro' }

/* ---------- dinheiro ---------- */
/** Reais (número ou texto do banco) → centavos inteiros. */
export function centavos(v: number | string | null | undefined): number {
  if (v === null || v === undefined || v === '') return 0
  const n = typeof v === 'number' ? v : Number(String(v).replace(',', '.'))
  if (!Number.isFinite(n)) return NaN
  return Math.round(n * 100)
}
export const reais = (c: number) => Math.round(c) / 100

/**
 * Retenção = base × alíquota ÷ 100, arredondada meio para cima na 2ª casa.
 * Alíquota aceita até 4 casas (ex.: 4,6500%). Cálculo em inteiros (BigInt), sem erro de ponto flutuante.
 */
export function calcularRetencao(baseReais: number, aliquotaPct: number): number {
  const base = BigInt(centavos(baseReais))
  const aliq = BigInt(Math.round(aliquotaPct * 10_000))
  if (base < 0n || aliq < 0n) throw new Error('Base e alíquota não podem ser negativas.')
  const c = (base * aliq + 500_000n) / 1_000_000n
  return Number(c) / 100
}

/** Valor líquido = bruto − retenções (em reais, 2 casas). */
export const liquido = (brutoReais: number, retencoesReais: number[]) =>
  reais(centavos(brutoReais) - retencoesReais.reduce((a, r) => a + centavos(r), 0))

/* ---------- datas ---------- */
export const RE_DATA = /^\d{4}-\d{2}-\d{2}$/
export const RE_COMPETENCIA = /^\d{4}-(0[1-9]|1[0-2])$/
export function somarDias(data: string, dias: number): string {
  const d = new Date(`${data}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + dias)
  return d.toISOString().slice(0, 10)
}
/** Soma meses mantendo o dia (ou o último dia do mês, quando não existe). */
export function somarMeses(data: string, meses: number): string {
  const [a, m, d] = data.split('-').map(Number)
  const alvo = new Date(Date.UTC(a, m - 1 + meses, 1))
  const ultimo = new Date(Date.UTC(alvo.getUTCFullYear(), alvo.getUTCMonth() + 1, 0)).getUTCDate()
  alvo.setUTCDate(Math.min(d, ultimo))
  return alvo.toISOString().slice(0, 10)
}
export const diasAte = (de: string, ate: string) => Math.round((Date.parse(`${ate}T00:00:00Z`) - Date.parse(`${de}T00:00:00Z`)) / 86_400_000)
export const primeiroDia = (comp: string) => `${comp}-01`
export function ultimoDia(comp: string): string {
  const [a, m] = comp.split('-').map(Number)
  return new Date(Date.UTC(a, m, 0)).toISOString().slice(0, 10)
}

/* ---------- divergências da nota fiscal ---------- */
export interface ContratoBase {
  status: string; inicio: string; fim: string | null; valor: number; modeloRemuneracao: string; fornecedorId: string
}
export interface NotaBase { valorBruto: number; competencia: string; dataEmissao: string; fornecedorId: string }
export interface Divergencia { codigo: string; mensagem: string }

/**
 * Pontos que exigem atenção antes do aceite. Não bloqueiam o envio (a nota pode estar correta por motivo legítimo),
 * mas o aceite com divergência exige justificativa registrada.
 */
export function divergenciasNota(n: NotaBase, k: ContratoBase, outrasNaCompetencia: number): Divergencia[] {
  const out: Divergencia[] = []
  if (k.modeloRemuneracao === 'mensal_fixo' && centavos(n.valorBruto) !== centavos(k.valor)) {
    out.push({ codigo: 'valor_diferente', mensagem: `Valor da nota difere do valor mensal do contrato (${k.valor.toFixed(2)}).` })
  }
  if (k.modeloRemuneracao === 'por_projeto' && centavos(n.valorBruto) > centavos(k.valor)) {
    out.push({ codigo: 'acima_do_global', mensagem: 'Valor da nota acima do valor global do contrato.' })
  }
  if (ultimoDia(n.competencia) < k.inicio || (k.fim && primeiroDia(n.competencia) > k.fim)) {
    out.push({ codigo: 'fora_da_vigencia', mensagem: 'Competência fora da vigência do contrato.' })
  }
  if (n.dataEmissao < k.inicio) out.push({ codigo: 'emissao_antes_inicio', mensagem: 'Nota emitida antes do início do contrato.' })
  if (k.status !== 'vigente') out.push({ codigo: 'contrato_nao_vigente', mensagem: 'Contrato não está vigente.' })
  if (n.fornecedorId !== k.fornecedorId) out.push({ codigo: 'fornecedor_diferente', mensagem: 'Emitente diferente do fornecedor do contrato.' })
  if (outrasNaCompetencia > 0 && k.modeloRemuneracao === 'mensal_fixo') {
    out.push({ codigo: 'competencia_repetida', mensagem: 'Já existe outra nota ativa deste contrato na mesma competência.' })
  }
  return out
}

/** Vencimento da conta a pagar: informado na nota, ou aceite + prazo do contrato, ou aceite + prazo padrão. Nunca antes do aceite. */
export function vencimentoConta(aceite: string, prazoContratoDias: number | null | undefined, informado: string | null | undefined, prazoPadraoDias: number): string {
  const calculado = somarDias(aceite, prazoContratoDias ?? prazoPadraoDias)
  if (informado && RE_DATA.test(informado)) return informado < aceite ? aceite : informado
  return calculado
}

/** Situação do prazo do contrato para listas e alertas. */
export function situacaoPrazo(k: { status: string; fim: string | null; avisoRenovacaoDias: number }, hoje: string): 'sem_prazo' | 'ok' | 'a_vencer' | 'vencido' | 'encerrado' {
  if (k.status === 'encerrado') return 'encerrado'
  if (!k.fim) return 'sem_prazo'
  if (k.fim < hoje) return 'vencido'
  return diasAte(hoje, k.fim) <= Math.max(k.avisoRenovacaoDias, 0) ? 'a_vencer' : 'ok'
}

/* ---------- documentos ---------- */
export { cnpjValido, cpfValido, soDigitos } from '../validacao.js'
