/* ============================================================
   Departamentos · regras puras (cliente e servidor; só imports relativos)
   Um departamento pode ficar dentro de outro (paiId) e ter um líder
   opcional (gestorId). A árvore de departamentos alimenta o
   organograma estrutural: departamento → líder → cargos → pessoas.
   ============================================================ */

export interface DepartamentoBase {
  id: string
  nome: string
  paiId?: string | null
  gestorId?: string | null
  liderancaIds?: string[]
  cor?: string
  icon?: string
}
export interface CargoDep { id: string; nome: string; setorId: string; nivel?: string }
export interface PessoaDep { id: string; nome: string; setorId?: string; cargoId?: string; status: string; avatarCor?: string }

/** Pai efetivo: existe, não é o próprio departamento e não fecha ciclo. Caso contrário, o departamento é raiz. */
function paiValido(porId: Map<string, DepartamentoBase>, d: DepartamentoBase): string | null {
  if (!d.paiId || d.paiId === d.id || !porId.has(d.paiId)) return null
  const visto = new Set<string>()
  let cur: string | null | undefined = d.paiId
  while (cur && !visto.has(cur)) {
    if (cur === d.id) return null
    visto.add(cur)
    cur = porId.get(cur)?.paiId
  }
  return d.paiId
}

/** Todos os departamentos abaixo de `id` (subdepartamentos diretos e indiretos). */
export function subdepartamentos(deps: DepartamentoBase[], id: string): string[] {
  const out: string[] = []
  const pilha = [id]
  while (pilha.length) {
    const atual = pilha.pop()!
    for (const d of deps) if (d.paiId === atual && d.id !== id && !out.includes(d.id)) { out.push(d.id); pilha.push(d.id) }
  }
  return out
}

/** Nomes do topo até o departamento (ex.: ["Diretoria", "Jurídico", "Contencioso"]). */
export function caminhoDepartamento(deps: DepartamentoBase[], id: string): string[] {
  const porId = new Map(deps.map((d) => [d.id, d]))
  const out: string[] = []
  let cur = porId.get(id)
  while (cur && out.length < 50) {
    out.unshift(cur.nome)
    const p = paiValido(porId, cur)
    cur = p ? porId.get(p) : undefined
  }
  return out
}

/** Erro ao definir `paiId` como departamento pai de `id` (null = válido). `id` vazio = departamento novo. */
export function validarDepartamentoPai(deps: DepartamentoBase[], id: string | undefined, paiId: string | null | undefined): string | null {
  if (!paiId) return null
  if (!deps.some((d) => d.id === paiId)) return 'O departamento pai escolhido não existe.'
  if (!id) return null
  if (paiId === id) return 'Um departamento não pode estar dentro dele mesmo.'
  if (subdepartamentos(deps, id).includes(paiId)) return 'O departamento pai escolhido já está dentro deste departamento.'
  return null
}

export interface NoDepartamento {
  id: string
  nome: string
  cor: string | null
  icon: string | null
  paiId: string | null
  lider: { id: string; nome: string; avatarCor: string | null } | null
  liderancas: { id: string; nome: string }[]
  cargos: { id: string; nome: string; nivel: string | null; pessoas: number }[]
  /** Pessoas ativas lotadas diretamente no departamento. */
  pessoas: number
  /** Pessoas ativas no departamento e em todos os subdepartamentos. */
  pessoasTotal: number
  filhos: string[]
  /** Profundidade na árvore (0 = topo). */
  nivel: number
}
export interface ArvoreDepartamentos { nos: NoDepartamento[]; raizes: string[] }

export function arvoreDepartamentos(deps: DepartamentoBase[], cargos: CargoDep[], pessoas: PessoaDep[]): ArvoreDepartamentos {
  const porId = new Map(deps.map((d) => [d.id, d]))
  const ativas = pessoas.filter((p) => p.status !== 'encerrado')
  const pessoaPorId = new Map(pessoas.map((p) => [p.id, p]))
  const ordenar = (ids: string[]) => ids.sort((a, b) => porId.get(a)!.nome.localeCompare(porId.get(b)!.nome, 'pt-BR'))

  const filhos = new Map<string, string[]>(deps.map((d) => [d.id, []]))
  const raizes: string[] = []
  const pai = new Map<string, string | null>()
  for (const d of deps) {
    const p = paiValido(porId, d)
    pai.set(d.id, p)
    if (p) filhos.get(p)!.push(d.id)
    else raizes.push(d.id)
  }
  filhos.forEach(ordenar)
  ordenar(raizes)

  const nos = new Map<string, NoDepartamento>()
  const montar = (id: string, nivel: number): number => {
    const d = porId.get(id)!
    const gente = ativas.filter((p) => p.setorId === id)
    const lider = d.gestorId ? pessoaPorId.get(d.gestorId) : undefined
    const no: NoDepartamento = {
      id, nome: d.nome, cor: d.cor ?? null, icon: d.icon ?? null, paiId: pai.get(id) ?? null,
      lider: lider && lider.status !== 'encerrado' ? { id: lider.id, nome: lider.nome, avatarCor: lider.avatarCor ?? null } : null,
      liderancas: (d.liderancaIds ?? []).filter((x) => x !== d.gestorId).map((x) => pessoaPorId.get(x)).filter((p): p is PessoaDep => !!p && p.status !== 'encerrado').map((p) => ({ id: p.id, nome: p.nome })),
      cargos: cargos.filter((c) => c.setorId === id).map((c) => ({ id: c.id, nome: c.nome, nivel: c.nivel ?? null, pessoas: gente.filter((p) => p.cargoId === c.id).length }))
        .sort((a, b) => b.pessoas - a.pessoas || a.nome.localeCompare(b.nome, 'pt-BR')),
      pessoas: gente.length,
      pessoasTotal: gente.length,
      filhos: filhos.get(id)!,
      nivel,
    }
    nos.set(id, no)
    for (const f of no.filhos) no.pessoasTotal += montar(f, nivel + 1)
    return no.pessoasTotal
  }
  raizes.forEach((r) => montar(r, 0))
  return { nos: deps.map((d) => nos.get(d.id)!).filter(Boolean), raizes }
}
