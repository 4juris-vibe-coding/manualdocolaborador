/* Lógica pura do calendário (sem React): grade do mês, semana, eventos de cada dia,
   posicionamento por horário e colunas para eventos sobrepostos. Datas em ISO local. */

export type Vista = 'mes' | 'semana' | 'dia' | 'lista'

export interface EventoCal {
  id: string
  titulo: string
  /** 'AAAA-MM-DD' (dia inteiro) ou data e hora ISO (local ou com fuso). */
  inicio: string
  /** Fim (opcional). Para dia inteiro, o último dia incluído. */
  fim?: string
  diaInteiro?: boolean
  /** Cor do evento (hex). */
  cor: string
  subtitulo?: string
  cancelado?: boolean
}

const p2 = (n: number) => String(n).padStart(2, '0')
export const isoDia = (d: Date) => `${d.getFullYear()}-${p2(d.getMonth() + 1)}-${p2(d.getDate())}`
export const dataDe = (iso: string) => new Date(iso.slice(0, 10) + 'T00:00:00')
export function somarDiasISO(iso: string, n: number): string { const d = dataDe(iso); d.setDate(d.getDate() + n); return isoDia(d) }

/** Converte o início/fim do evento em Date (texto só com data = meia-noite local). */
export function instante(v: string): Date {
  return /^\d{4}-\d{2}-\d{2}$/.test(v) ? dataDe(v) : new Date(v)
}
/** Minutos desde a meia-noite (no fuso do navegador). */
export const minutosDoDia = (d: Date) => d.getHours() * 60 + d.getMinutes()
export const ehDiaInteiro = (e: EventoCal) => !!e.diaInteiro || /^\d{4}-\d{2}-\d{2}$/.test(e.inicio)

/** Primeiro e último dia (ISO) que o evento ocupa. */
export function diasDoEvento(e: EventoCal): [string, string] {
  const ini = isoDia(instante(e.inicio))
  if (!e.fim) return [ini, ini]
  const f = instante(e.fim)
  // Evento com hora que termina exatamente à meia-noite não ocupa o dia seguinte.
  const fimISO = !ehDiaInteiro(e) && minutosDoDia(f) === 0 && isoDia(f) > ini ? somarDiasISO(isoDia(f), -1) : isoDia(f)
  return [ini, fimISO < ini ? ini : fimISO]
}

export const eventosDoDia = (eventos: EventoCal[], dia: string) =>
  eventos.filter((e) => { const [a, b] = diasDoEvento(e); return a <= dia && dia <= b })
    .sort((x, y) => Number(ehDiaInteiro(y)) - Number(ehDiaInteiro(x)) || instante(x.inicio).getTime() - instante(y.inicio).getTime())

/** Dias (ISO) da grade do mês, semanas completas começando no domingo (inclui dias dos meses vizinhos). */
export function gradeMes(ano: number, mes: number): string[] {
  const primeiro = new Date(ano, mes - 1, 1)
  const ultimo = new Date(ano, mes, 0)
  const inicio = somarDiasISO(isoDia(primeiro), -primeiro.getDay())
  const total = Math.ceil((primeiro.getDay() + ultimo.getDate()) / 7) * 7
  return Array.from({ length: total }, (_, i) => somarDiasISO(inicio, i))
}

/** Os 7 dias (domingo a sábado) da semana que contém `ref`. */
export function diasDaSemana(ref: string): string[] {
  const inicio = somarDiasISO(ref, -dataDe(ref).getDay())
  return Array.from({ length: 7 }, (_, i) => somarDiasISO(inicio, i))
}

/** Move a data de referência um período para frente/trás conforme a vista. */
export function moverRef(ref: string, vista: Vista, delta: number): string {
  if (vista === 'semana') return somarDiasISO(ref, 7 * delta)
  if (vista === 'dia') return somarDiasISO(ref, delta)
  const d = dataDe(ref)
  const alvo = new Date(d.getFullYear(), d.getMonth() + delta, 1)
  return isoDia(alvo)
}

const cap = (t: string) => t.charAt(0).toUpperCase() + t.slice(1)
export function tituloPeriodo(ref: string, vista: Vista): string {
  const d = dataDe(ref)
  if (vista === 'dia') return cap(d.toLocaleDateString('pt-BR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))
  if (vista === 'semana') {
    const [a, , , , , , b] = diasDaSemana(ref).map(dataDe)
    const mesmoMes = a.getMonth() === b.getMonth()
    return mesmoMes
      ? `${a.getDate()} – ${b.getDate()} de ${b.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' })}`
      : `${a.getDate()} ${a.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '')} – ${b.getDate()} ${b.toLocaleDateString('pt-BR', { month: 'short', year: 'numeric' }).replace('.', '')}`
  }
  return cap(d.toLocaleDateString('pt-BR', { month: 'long', year: 'numeric' }))
}

export interface Posicionado { evento: EventoCal; inicioMin: number; fimMin: number; coluna: number; colunas: number }

/**
 * Posiciona os eventos com horário de um dia: minutos de início/fim (recortados ao dia; sem fim = `duracaoPadrao`)
 * e colunas lado a lado para os que se sobrepõem (cada grupo de sobreposição divide a largura igualmente).
 */
export function layoutDia(eventos: EventoCal[], dia: string, duracaoPadrao = 60): Posicionado[] {
  const itens = eventos.filter((e) => !ehDiaInteiro(e)).map((e) => {
    const a = instante(e.inicio), b = e.fim ? instante(e.fim) : new Date(a.getTime() + duracaoPadrao * 60000)
    const inicioMin = isoDia(a) < dia ? 0 : minutosDoDia(a)
    const fimMin = isoDia(b) > dia ? 24 * 60 : Math.max(minutosDoDia(b), inicioMin + 15)
    return { evento: e, inicioMin, fimMin: Math.min(fimMin, 24 * 60), coluna: 0, colunas: 1 }
  }).sort((x, y) => x.inicioMin - y.inicioMin || y.fimMin - x.fimMin)

  let grupo: Posicionado[] = []
  let fimGrupo = -1
  const fechar = () => { const n = Math.max(1, ...grupo.map((g) => g.coluna + 1)); for (const g of grupo) g.colunas = n; grupo = [] }
  for (const it of itens) {
    if (it.inicioMin >= fimGrupo && grupo.length) fechar()
    const ocupadas = new Set(grupo.filter((g) => g.fimMin > it.inicioMin).map((g) => g.coluna))
    let c = 0
    while (ocupadas.has(c)) c++
    it.coluna = c
    grupo.push(it)
    fimGrupo = Math.max(fimGrupo, it.fimMin)
  }
  if (grupo.length) fechar()
  return itens
}

export const horaTexto = (v: string) => instante(v).toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' })
