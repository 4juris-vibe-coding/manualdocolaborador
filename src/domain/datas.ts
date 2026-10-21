/* Utilitários de data sem fuso: trabalham com 'YYYY-MM-DD' locais. */

export function hojeISO(d = new Date()): string {
  const y = d.getFullYear(), m = String(d.getMonth() + 1).padStart(2, '0'), day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

export function agoraISO(d = new Date()): string {
  return d.toISOString()
}

export function parseDia(iso: string): Date {
  return new Date(iso.slice(0, 10) + 'T00:00:00')
}

export function somarDias(iso: string, dias: number): string {
  const d = parseDia(iso)
  d.setDate(d.getDate() + dias)
  return hojeISO(d)
}

/** Dias corridos de a até b (b - a). */
export function diasEntre(a: string, b: string): number {
  return Math.round((parseDia(b).getTime() - parseDia(a).getTime()) / 86400000)
}

export function mesISO(iso: string): string {
  return iso.slice(0, 7)
}

/** Meses inteiros completos entre duas datas. */
export function mesesEntre(a: string, b: string): number {
  const da = parseDia(a), db = parseDia(b)
  let m = (db.getFullYear() - da.getFullYear()) * 12 + (db.getMonth() - da.getMonth())
  if (db.getDate() < da.getDate()) m--
  return Math.max(0, m)
}

export function tempoParceria(inicio: string | undefined, hoje: string): string {
  if (!inicio) return '—'
  const m = mesesEntre(inicio, hoje)
  const y = Math.floor(m / 12), r = m % 12
  if (y === 0) return m === 0 ? 'menos de 1 mês' : `${m} ${m === 1 ? 'mês' : 'meses'}`
  return `${y} ${y === 1 ? 'ano' : 'anos'}${r ? ` e ${r} ${r === 1 ? 'mês' : 'meses'}` : ''}`
}

export function isDataValida(iso: string | undefined): boolean {
  if (!iso || !/^\d{4}-\d{2}-\d{2}$/.test(iso)) return false
  const d = parseDia(iso)
  return !isNaN(d.getTime()) && hojeISO(d) === iso
}
