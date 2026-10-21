/* Formatadores em pt-BR usados pelos módulos v2. */
export const moeda = (v: number | string | null | undefined, cod = 'BRL') =>
  v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : new Intl.NumberFormat('pt-BR', { style: 'currency', currency: cod }).format(Number(v))
export const numero = (v: number | null | undefined, casas = 0) =>
  v === null || v === undefined || Number.isNaN(v) ? '—' : new Intl.NumberFormat('pt-BR', { maximumFractionDigits: casas, minimumFractionDigits: casas }).format(v)
export const pct = (v: number | null | undefined, casas = 0) => (v === null || v === undefined || Number.isNaN(v) ? '—' : `${numero(v, casas)}%`)

/** 'AAAA-MM-DD' ou ISO completo → 'dd/mm/aaaa' (sem deslocar fuso em datas puras). */
export function dataBR(v: string | Date | null | undefined): string {
  if (!v) return '—'
  if (typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)) return `${v.slice(8, 10)}/${v.slice(5, 7)}/${v.slice(0, 4)}`
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString('pt-BR')
}
export function dataHoraBR(v: string | Date | null | undefined): string {
  if (!v) return '—'
  const d = new Date(v)
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
/** "há 3 dias", "agora há pouco". */
export function haQuanto(v: string | Date | null | undefined, agora = new Date()): string {
  if (!v) return '—'
  const s = (agora.getTime() - new Date(v).getTime()) / 1000
  if (s < 60) return 'agora há pouco'
  if (s < 3600) return `há ${Math.floor(s / 60)} min`
  if (s < 86400) return `há ${Math.floor(s / 3600)} h`
  const d = Math.floor(s / 86400)
  return d === 1 ? 'há 1 dia' : d < 60 ? `há ${d} dias` : dataBR(v)
}
export const diasEntre = (a: string | Date, b: string | Date) => Math.round((new Date(b).getTime() - new Date(a).getTime()) / 86400000)
export const hojeISO = () => new Date().toISOString().slice(0, 10)
export const plural = (n: number, um: string, varios: string) => `${numero(n)} ${n === 1 ? um : varios}`
