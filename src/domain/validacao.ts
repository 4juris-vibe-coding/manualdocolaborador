/* Validações de entrada (portadas de gest-o_rh-master/lib/cpf.ts e cnpj.ts). */

export const soDigitos = (v: string) => (v ?? '').replace(/\D/g, '')

export function cpfValido(v: string): boolean {
  const d = soDigitos(v)
  if (d.length !== 11 || /^(\d)\1{10}$/.test(d)) return false
  const calc = (len: number) => {
    let s = 0
    for (let i = 0; i < len; i++) s += Number(d[i]) * (len + 1 - i)
    const r = (s * 10) % 11
    return r === 10 ? 0 : r
  }
  return calc(9) === Number(d[9]) && calc(10) === Number(d[10])
}

export function cnpjValido(v: string): boolean {
  const d = soDigitos(v)
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false
  const calc = (len: number) => {
    const pesos = len === 12 ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2] : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
    const s = pesos.reduce((acc, p, i) => acc + Number(d[i]) * p, 0)
    const r = s % 11
    return r < 2 ? 0 : 11 - r
  }
  return calc(12) === Number(d[12]) && calc(13) === Number(d[13])
}

export function emailValido(v: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((v ?? '').trim())
}

export function mascaraCNPJ(v: string): string {
  const d = soDigitos(v).slice(0, 14)
  return d.replace(/^(\d{2})(\d)/, '$1.$2').replace(/^(\d{2})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/\.(\d{3})(\d)/, '.$1/$2').replace(/(\d{4})(\d)/, '$1-$2')
}

export function mascaraCPF(v: string): string {
  const d = soDigitos(v).slice(0, 11)
  return d.replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d)/, '$1.$2').replace(/(\d{3})(\d{1,2})$/, '$1-$2')
}

/** Mascara um identificador para exibição (LGPD: mostrar só o necessário). */
export function ocultar(v: string | undefined, visiveis = 4): string {
  if (!v) return '—'
  const d = v.trim()
  if (d.length <= visiveis) return d
  return '•'.repeat(Math.min(8, d.length - visiveis)) + d.slice(-visiveis)
}

export type Erros<T extends string = string> = Partial<Record<T, string>>
