/* ============================================================
   4JURIS Pessoas · Métricas de pessoas, rotatividade, encerramentos
   e faturamento. Portado de lib/metricas-colaborador.ts e
   lib/turnover-calculo.ts do sistema de RH, com:
   - dados de diversidade só com consentimento e supressão de
     grupos com menos de MIN_GRUPO pessoas;
   - "admissão/desligamento" → início/encerramento de parceria.
   ============================================================ */
import type { Colaborador, DB, Escolaridade, Genero, RacaEtnia } from '@/lib/types'
import { ativoEm } from './analytics'
import { diasEntre, somarDias } from './datas'

export const MIN_GRUPO = 5
export const PALETA = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4', '#008300', '#4a3aa7', '#e34948']

export const ESCOLARIDADE_LABEL: Record<Escolaridade, string> = {
  fundamental_incompleto: 'Fundamental incompleto', fundamental_completo: 'Fundamental completo', medio_incompleto: 'Médio incompleto',
  medio_completo: 'Médio completo', superior_incompleto: 'Superior incompleto', superior_completo: 'Superior completo',
  pos_graduacao: 'Pós-graduação', mestrado: 'Mestrado', doutorado: 'Doutorado',
}
export const GENERO_LABEL: Record<Genero, string> = { feminino: 'Feminino', masculino: 'Masculino', nao_binario: 'Não binário', outro: 'Outro', prefiro_nao_informar: 'Prefiro não informar' }
export const RACA_LABEL: Record<RacaEtnia, string> = { branca: 'Branca', preta: 'Preta', parda: 'Parda', amarela: 'Amarela', indigena: 'Indígena', nao_informado: 'Prefiro não informar' }
export const ESTADO_CIVIL_LABEL = { solteiro: 'Solteiro(a)', casado: 'Casado(a)', divorciado: 'Divorciado(a)', viuvo: 'Viúvo(a)', uniao_estavel: 'União estável' } as const

export interface Fatia { rotulo: string; valor: number; cor: string }

export function idade(nasc: string, hoje: string): number {
  const [a, m, d] = nasc.split('-').map(Number)
  const [ha, hm, hd] = hoje.split('-').map(Number)
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0)
}

const FAIXAS_IDADE = [
  { rotulo: 'Até 24 anos', ok: (i: number) => i <= 24 }, { rotulo: '25 a 34', ok: (i: number) => i >= 25 && i <= 34 },
  { rotulo: '35 a 44', ok: (i: number) => i >= 35 && i <= 44 }, { rotulo: '45 a 54', ok: (i: number) => i >= 45 && i <= 54 },
  { rotulo: '55 ou mais', ok: (i: number) => i >= 55 },
]
const FAIXAS_TEMPO = [
  { rotulo: 'Até 1 ano', ok: (a: number) => a < 1 }, { rotulo: '1 a 3 anos', ok: (a: number) => a >= 1 && a < 3 },
  { rotulo: '3 a 5 anos', ok: (a: number) => a >= 3 && a < 5 }, { rotulo: '5 a 10 anos', ok: (a: number) => a >= 5 && a < 10 },
  { rotulo: 'Mais de 10 anos', ok: (a: number) => a >= 10 },
]

function contar<T extends string>(valores: (T | undefined)[], labels: Record<T, string>, incluirVazios = false): Fatia[] {
  return (Object.keys(labels) as T[]).map((k, i) => ({ rotulo: labels[k], valor: valores.filter((v) => v === k).length, cor: PALETA[i % PALETA.length] }))
    .filter((f) => incluirVazios || f.valor > 0)
}

export interface MetricasPessoas {
  total: number
  idadeMedia: number | null
  comNascimento: number
  porIdade: Fatia[]
  porTempo: Fatia[]
  porEscolaridade: Fatia[]
  porRegime: Fatia[]
  porArea: Fatia[]
  porUnidade: Fatia[]
  porResponsavel: Fatia[]
  porSenioridade: Fatia[]
  diversidade: {
    consentidos: number
    suprimido: boolean
    genero: Fatia[]
    raca: Fatia[]
    pcd: Fatia[]
    estadoCivil: Fatia[]
  }
  comDependentes: Fatia[]
}

export function metricasPessoas(db: DB, pessoas: Colaborador[], hoje: string): MetricasPessoas {
  const ativos = pessoas.filter((c) => ativoEm(c, hoje))
  const idades = ativos.filter((c) => c.nascimento).map((c) => idade(c.nascimento!, hoje))
  const anos = ativos.map((c) => diasEntre(c.dataEntrada, hoje) / 365.25)
  const faixas = (vals: number[], fx: { rotulo: string; ok: (n: number) => boolean }[]) => fx.map((f, i) => ({ rotulo: f.rotulo, valor: vals.filter(f.ok).length, cor: PALETA[i % PALETA.length] }))
  const agrupar = (chave: (c: Colaborador) => string) => {
    const m = new Map<string, number>()
    ativos.forEach((c) => m.set(chave(c), (m.get(chave(c)) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([rotulo, valor], i) => ({ rotulo, valor, cor: PALETA[i % PALETA.length] }))
  }
  const cons = ativos.filter((c) => c.diversidade?.consentimento)
  const suprimido = cons.length < MIN_GRUPO
  const div = cons.map((c) => c.diversidade!)
  const comDep = ativos.filter((c) => db.dependentes.some((d) => d.colaboradorId === c.id)).length
  return {
    total: ativos.length,
    idadeMedia: idades.length ? Math.round(idades.reduce((a, b) => a + b, 0) / idades.length) : null,
    comNascimento: idades.length,
    porIdade: faixas(idades, FAIXAS_IDADE),
    porTempo: faixas(anos, FAIXAS_TEMPO),
    porEscolaridade: contar(ativos.map((c) => c.escolaridade), ESCOLARIDADE_LABEL),
    porRegime: agrupar((c) => ({ PJ: 'PJ', MEI: 'MEI', autonomo: 'Autônomo' }[c.regime])),
    porArea: agrupar((c) => db.setores.find((s) => s.id === c.setorId)?.nome ?? 'Sem área'),
    porUnidade: agrupar((c) => db.unidades.find((u) => u.id === c.unidadeId)?.nome ?? 'Sem unidade'),
    porResponsavel: agrupar((c) => db.colaboradores.find((x) => x.id === c.responsavelId)?.nome ?? 'Sem responsável definido').slice(0, 8),
    porSenioridade: agrupar((c) => db.cargos.find((g) => g.id === c.cargoId)?.nivel ?? 'Sem função'),
    diversidade: {
      consentidos: cons.length, suprimido,
      genero: suprimido ? [] : contar(div.map((d) => d.genero), GENERO_LABEL),
      raca: suprimido ? [] : contar(div.map((d) => d.racaEtnia), RACA_LABEL),
      pcd: suprimido ? [] : [{ rotulo: 'Pessoa com deficiência', valor: div.filter((d) => d.pcd).length, cor: PALETA[0] }, { rotulo: 'Sem deficiência informada', valor: div.filter((d) => !d.pcd).length, cor: PALETA[3] }],
      estadoCivil: suprimido ? [] : contar(div.map((d) => d.estadoCivil), ESTADO_CIVIL_LABEL),
    },
    comDependentes: [{ rotulo: 'Com dependentes', valor: comDep, cor: PALETA[0] }, { rotulo: 'Sem dependentes', valor: ativos.length - comDep, cor: PALETA[3] }],
  }
}

/* ---------- Rotatividade (portado de turnover-calculo.ts) ---------- */
export interface JanelaRotatividade { dias: number; inicio: string; fim: string; inicios: number; encerramentos: number; mediaAtivos: number; taxa: number }

export function rotatividade(pessoas: Colaborador[], hoje: string, dias: number): JanelaRotatividade {
  const inicio = somarDias(hoje, -dias)
  const aIni = pessoas.filter((c) => ativoEm(c, inicio)).length
  const aFim = pessoas.filter((c) => ativoEm(c, hoje)).length
  const media = (aIni + aFim) / 2
  const enc = pessoas.filter((c) => c.encerramento && c.encerramento.data > inicio && c.encerramento.data <= hoje).length
  const ini = pessoas.filter((c) => c.dataEntrada > inicio && c.dataEntrada <= hoje).length
  return { dias, inicio, fim: hoje, inicios: ini, encerramentos: enc, mediaAtivos: Math.round(media * 10) / 10, taxa: media ? Math.round((enc / media) * 1000) / 10 : 0 }
}

export function serie12Meses(datas: (string | undefined)[], hoje: string) {
  const base = new Date(hoje.slice(0, 7) + '-01T00:00:00')
  return Array.from({ length: 12 }, (_, i) => {
    const d = new Date(base.getFullYear(), base.getMonth() - 11 + i, 1)
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    return { mes: k, qtd: datas.filter((x) => x?.slice(0, 7) === k).length }
  })
}

/* ---------- Métricas de encerramento ---------- */
export function metricasEncerramento(db: DB, pessoas: Colaborador[], inicio: string, fim: string) {
  const enc = pessoas.filter((c) => c.encerramento && c.encerramento.data >= inicio && c.encerramento.data <= fim)
  const duracoes = enc.map((c) => diasEntre(c.dataEntrada, c.encerramento!.data))
  const motivo = (c: Colaborador) => db.motivosEncerramento.find((m) => m.id === c.encerramento?.motivoId)?.nome ?? 'Não informado'
  const iniciativa = (c: Colaborador) => {
    const m = motivo(c).toLowerCase()
    return m.includes('prestadora') ? 'Prestadora' : m.includes('contratante') ? 'Contratante' : m.includes('acordo') ? 'Acordo entre as partes' : 'Término natural / outro'
  }
  const grupo = (fn: (c: Colaborador) => string) => {
    const m = new Map<string, number>()
    enc.forEach((c) => m.set(fn(c), (m.get(fn(c)) ?? 0) + 1))
    return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([rotulo, valor], i) => ({ rotulo, valor, cor: PALETA[i % PALETA.length] }))
  }
  return {
    lista: enc.sort((a, b) => b.encerramento!.data.localeCompare(a.encerramento!.data)),
    total: enc.length,
    duracaoMediaDias: duracoes.length ? Math.round(duracoes.reduce((a, b) => a + b, 0) / duracoes.length) : null,
    porMotivo: grupo(motivo),
    porArea: grupo((c) => db.setores.find((s) => s.id === c.setorId)?.nome ?? 'Sem área'),
    porIniciativa: grupo(iniciativa),
    antesDe6Meses: duracoes.filter((d) => d < 183).length,
  }
}

/* ---------- Faturamento de serviços (notas fiscais e reembolsos) ---------- */
export function faturamento(db: DB, competencias: string[]) {
  const notas = db.notas.filter((n) => competencias.includes(n.competencia))
  const soma = (st: string[]) => notas.filter((n) => st.includes(n.status)).reduce((a, n) => a + n.valor, 0)
  const porArea = new Map<string, number>()
  notas.forEach((n) => {
    const area = db.setores.find((s) => s.id === db.colaboradores.find((c) => c.id === n.colaboradorId)?.setorId)?.nome ?? 'Sem área'
    porArea.set(area, (porArea.get(area) ?? 0) + n.valor)
  })
  const reemb = db.reembolsos.filter((r) => competencias.includes(r.data.slice(0, 7)) && r.status !== 'recusado')
  return {
    total: notas.reduce((a, n) => a + n.valor, 0),
    pago: soma(['paga']),
    aPagar: soma(['aprovada', 'pagamento']),
    emAnalise: soma(['enviada']),
    aguardandoEnvio: soma(['aguardando', 'atrasada']),
    qtdNotas: notas.length,
    porArea: [...porArea.entries()].sort((a, b) => b[1] - a[1]).map(([rotulo, valor], i) => ({ rotulo, valor, cor: PALETA[i % PALETA.length] })),
    reembolsos: reemb.reduce((a, r) => a + r.valor, 0),
    reembolsosPagos: reemb.filter((r) => r.status === 'pago').reduce((a, r) => a + r.valor, 0),
    notas,
  }
}
