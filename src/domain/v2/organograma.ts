/* ============================================================
   Organograma · regras puras (cliente e servidor; só imports relativos)
   A árvore nasce de relacionamentos EXPLÍCITOS: responsavelId
   (gestor imediato), setorId, cargoId e unidadeId. Nunca se deduz
   subordinação pelo nome do cargo ou pela senioridade. O que faltar
   vira pendência de cadastro — sem juízo sobre a estrutura.
   ============================================================ */

export interface PessoaOrg {
  id: string
  nome: string
  setorId?: string
  cargoId?: string
  unidadeId?: string
  status: string
  responsavelId?: string | null
}
export interface SetorOrg { id: string; nome: string; gestorId?: string | null; liderancaIds?: string[]; unidadeId?: string }

export const ehAtiva = (p: { status: string }) => p.status !== 'encerrado'

export type TipoPendencia =
  | 'sem_gestor'          // sem gestor definido e sem equipe
  | 'gestor_inexistente'  // responsavelId aponta para cadastro que não existe
  | 'gestor_inativo'      // gestor com parceria encerrada
  | 'auto_gestor'         // pessoa aponta para si mesma
  | 'ciclo'               // ciclo hierárquico
  | 'setor_sem_gestor'    // área sem gestor cadastrado (ou gestor inexistente/inativo)
  | 'setor_inexistente'   // pessoa aponta para área que não existe
  | 'sem_setor'
  | 'sem_cargo'

export const ROTULO_PENDENCIA: Record<TipoPendencia, string> = {
  sem_gestor: 'Sem gestor imediato definido',
  gestor_inexistente: 'Gestor inexistente',
  gestor_inativo: 'Gestor com parceria encerrada',
  auto_gestor: 'Aponta para si mesma como gestora',
  ciclo: 'Ciclo hierárquico',
  setor_sem_gestor: 'Área sem gestor cadastrado',
  setor_inexistente: 'Área inexistente',
  sem_setor: 'Sem área definida',
  sem_cargo: 'Sem função definida',
}

export interface Pendencia {
  tipo: TipoPendencia
  /** Pessoa afetada (ou null quando a pendência é de uma área). */
  pessoaId: string | null
  setorId?: string | null
  /** Para ciclos: os ids que formam o ciclo. */
  ciclo?: string[]
  detalhe?: string
}

export interface No { id: string; filhos: string[]; pai: string | null; nivel: number }

export interface Hierarquia {
  /** Apenas pessoas ativas entram na árvore. */
  pessoas: Map<string, PessoaOrg>
  nos: Map<string, No>
  /** Raízes com equipe (topo legítimo). */
  raizes: string[]
  /** Pessoas ativas sem vínculo hierárquico utilizável e sem equipe (pendência, não árvore). */
  soltas: string[]
  /** Pessoas com gestor inválido (inexistente/inativo) — entram na árvore como raiz de pendência. */
  orfas: string[]
  ciclos: string[][]
  foraDaArvore: string[]
  pendencias: Pendencia[]
  diretos: Map<string, number>
  totais: Map<string, number>
  niveis: number
}

/**
 * Constrói a hierarquia. `todas` inclui encerradas (para distinguir gestor inexistente de inativo).
 * Raiz = pessoa ativa sem responsavelId que tem equipe. Gestor inválido (inexistente/inativo)
 * torna a pessoa "órfã": aparece como raiz de pendência para não sumir do mapa.
 */
export function construirHierarquia(todas: PessoaOrg[], setores: SetorOrg[] = []): Hierarquia {
  const porId = new Map(todas.map((p) => [p.id, p]))
  const ativas = todas.filter(ehAtiva)
  const pessoas = new Map(ativas.map((p) => [p.id, p]))
  const pendencias: Pendencia[] = []

  // Pai efetivo: só vale se o gestor existe, está ativo e não é a própria pessoa.
  const pai = new Map<string, string | null>()
  for (const p of ativas) {
    const g = p.responsavelId || null
    if (!g) { pai.set(p.id, null); continue }
    if (g === p.id) { pendencias.push({ tipo: 'auto_gestor', pessoaId: p.id }); pai.set(p.id, null); continue }
    const gp = porId.get(g)
    if (!gp) { pendencias.push({ tipo: 'gestor_inexistente', pessoaId: p.id }); pai.set(p.id, null); continue }
    if (!ehAtiva(gp)) { pendencias.push({ tipo: 'gestor_inativo', pessoaId: p.id, detalhe: gp.nome }); pai.set(p.id, null); continue }
    pai.set(p.id, g)
  }
  const invalidos = new Set(pendencias.filter((x) => ['gestor_inexistente', 'gestor_inativo', 'auto_gestor'].includes(x.tipo)).map((x) => x.pessoaId!))

  // Ciclos: segue a cadeia de cada pessoa; quem repete um nó do caminho forma ciclo.
  const ciclos: string[][] = []
  const emCiclo = new Set<string>()
  const estado = new Map<string, 0 | 1 | 2>()
  for (const p of ativas) {
    if (estado.get(p.id)) continue
    const caminho: string[] = []
    let cur: string | null = p.id
    while (cur && !estado.get(cur)) { estado.set(cur, 1); caminho.push(cur); cur = pai.get(cur) ?? null }
    if (cur && estado.get(cur) === 1) {
      const ini = caminho.indexOf(cur)
      const c = caminho.slice(ini)
      ciclos.push(c)
      c.forEach((id) => emCiclo.add(id))
      pendencias.push({ tipo: 'ciclo', pessoaId: c[0], ciclo: c })
    }
    caminho.forEach((id) => estado.set(id, 2))
  }

  const filhos = new Map<string, string[]>(ativas.map((p) => [p.id, []]))
  for (const p of ativas) {
    const g = pai.get(p.id)
    if (g && !emCiclo.has(p.id)) filhos.get(g)!.push(p.id)
  }
  const ordenar = (ids: string[]) => ids.sort((a, b) => (pessoas.get(a)!.nome).localeCompare(pessoas.get(b)!.nome, 'pt-BR'))
  filhos.forEach((v) => ordenar(v))

  const raizes: string[] = [], soltas: string[] = [], orfas: string[] = []
  for (const p of ativas) {
    if (emCiclo.has(p.id) || pai.get(p.id)) continue
    const temEquipe = (filhos.get(p.id)?.length ?? 0) > 0
    if (invalidos.has(p.id)) orfas.push(p.id)
    else if (temEquipe) raizes.push(p.id)
    else { soltas.push(p.id); pendencias.push({ tipo: 'sem_gestor', pessoaId: p.id }) }
  }
  ordenar(raizes); ordenar(orfas); ordenar(soltas)

  // Níveis (0 = topo) e contagens, por busca em largura a partir das raízes e órfãs.
  const nos = new Map<string, No>()
  const diretos = new Map<string, number>(), totais = new Map<string, number>()
  let niveis = 0
  const fila: string[] = []
  for (const r of [...raizes, ...orfas]) { nos.set(r, { id: r, filhos: filhos.get(r)!, pai: null, nivel: 0 }); fila.push(r) }
  for (let i = 0; i < fila.length; i++) {
    const n = nos.get(fila[i])!
    niveis = Math.max(niveis, n.nivel + 1)
    for (const f of n.filhos) { nos.set(f, { id: f, filhos: filhos.get(f)!, pai: n.id, nivel: n.nivel + 1 }); fila.push(f) }
  }
  for (let i = fila.length - 1; i >= 0; i--) {
    const n = nos.get(fila[i])!
    diretos.set(n.id, n.filhos.length)
    totais.set(n.id, n.filhos.reduce((s, f) => s + 1 + (totais.get(f) ?? 0), 0))
  }
  for (const id of soltas) { nos.set(id, { id, filhos: [], pai: null, nivel: 0 }); diretos.set(id, 0); totais.set(id, 0) }
  const foraDaArvore = ativas.filter((p) => emCiclo.has(p.id)).map((p) => p.id)

  // Pendências de cadastro das pessoas.
  const setoresPorId = new Map(setores.map((s) => [s.id, s]))
  for (const p of ativas) {
    if (!p.setorId) pendencias.push({ tipo: 'sem_setor', pessoaId: p.id })
    else if (setores.length && !setoresPorId.has(p.setorId)) pendencias.push({ tipo: 'setor_inexistente', pessoaId: p.id, setorId: p.setorId })
    if (!p.cargoId) pendencias.push({ tipo: 'sem_cargo', pessoaId: p.id })
  }
  for (const s of setores) {
    const g = s.gestorId ? porId.get(s.gestorId) : undefined
    if (!s.gestorId || !g || !ehAtiva(g)) {
      const temGente = ativas.some((p) => p.setorId === s.id)
      pendencias.push({ tipo: 'setor_sem_gestor', pessoaId: null, setorId: s.id, detalhe: temGente ? 'A área tem pessoas ativas.' : 'A área não tem pessoas ativas.' })
    }
  }

  return { pessoas, nos, raizes, soltas, orfas, ciclos, foraDaArvore, pendencias, diretos, totais, niveis }
}

/** Cadeia de gestores acima da pessoa (do gestor imediato ao topo). */
export function cadeiaAcima(h: Hierarquia, id: string): string[] {
  const out: string[] = []
  let cur = h.nos.get(id)?.pai ?? null
  while (cur && out.length < 200) { out.push(cur); cur = h.nos.get(cur)?.pai ?? null }
  return out
}

/** Todos os descendentes (equipe direta e indireta). */
export function descendentes(h: Hierarquia, id: string): string[] {
  const out: string[] = []
  const pilha = [...(h.nos.get(id)?.filhos ?? [])]
  while (pilha.length) { const x = pilha.pop()!; out.push(x); pilha.push(...(h.nos.get(x)?.filhos ?? [])) }
  return out
}

export interface ValidacaoMudanca { erros: string[]; avisos: string[] }

/**
 * Valida a troca do gestor imediato de `pessoaId` para `novoGestorId` (null = sem gestor).
 * Mesma função no servidor e no cliente.
 */
export function validarMudancaGestor(todas: PessoaOrg[], pessoaId: string, novoGestorId: string | null): ValidacaoMudanca {
  const erros: string[] = [], avisos: string[] = []
  const porId = new Map(todas.map((p) => [p.id, p]))
  const pessoa = porId.get(pessoaId)
  if (!pessoa) return { erros: ['Pessoa não encontrada.'], avisos }
  if (!ehAtiva(pessoa)) erros.push('A parceria desta pessoa está encerrada; reative-a antes de alterar a estrutura.')
  if (!novoGestorId) {
    if ((pessoa.responsavelId ?? null) !== null) avisos.push('A pessoa ficará sem gestor imediato definido, o que aparece como pendência de cadastro.')
    return { erros, avisos }
  }
  if (novoGestorId === pessoaId) { erros.push('A pessoa não pode ser gestora de si mesma.'); return { erros, avisos } }
  const g = porId.get(novoGestorId)
  if (!g) { erros.push('O gestor escolhido não existe.'); return { erros, avisos } }
  if (!ehAtiva(g)) erros.push('O gestor escolhido está com a parceria encerrada.')
  // Ciclo: subindo a partir do novo gestor, não pode passar pela própria pessoa.
  const visto = new Set<string>()
  let cur: string | null | undefined = novoGestorId
  while (cur && !visto.has(cur)) {
    if (cur === pessoaId) { erros.push('Essa troca criaria um ciclo hierárquico (o novo gestor já está subordinado a esta pessoa).'); break }
    visto.add(cur)
    cur = porId.get(cur)?.responsavelId ?? null
  }
  if (!erros.length) {
    if (g.setorId && pessoa.setorId && g.setorId !== pessoa.setorId) avisos.push('O gestor pertence a outra área. Isso é permitido, mas confira se é intencional.')
    if ((pessoa.responsavelId ?? null) === novoGestorId) avisos.push('Esta já é a configuração atual.')
  }
  return { erros, avisos }
}

/* ---------- posições vagas (vagas do recrutamento) ---------- */
export interface VagaOrg {
  id: string; titulo: string; status: string; setorId?: string | null; cargoId?: string | null
  gestorImediatoId?: string | null; qtdPosicoes: number; posicoesPreenchidas: number
}
export const STATUS_VAGA_ABERTA = ['aprovada', 'publicada', 'pausada']

export interface PosicaoVaga { vagaId: string; titulo: string; cargoId?: string | null; setorId?: string | null; gestorId: string | null; abertas: number }

/**
 * Posições em aberto, ancoradas no gestor imediato previsto da vaga. Sem gestor imediato
 * ativo, usa o gestor da área; se nenhum existir, `gestorId` fica nulo (sem âncora no mapa).
 */
export function posicoesVagas(vagas: VagaOrg[], pessoas: Map<string, PessoaOrg>, setores: SetorOrg[]): PosicaoVaga[] {
  const out: PosicaoVaga[] = []
  for (const v of vagas) {
    if (!STATUS_VAGA_ABERTA.includes(v.status)) continue
    const abertas = v.qtdPosicoes - v.posicoesPreenchidas
    if (abertas <= 0) continue
    let gestorId: string | null = null
    if (v.gestorImediatoId && pessoas.has(v.gestorImediatoId)) gestorId = v.gestorImediatoId
    else {
      const s = setores.find((x) => x.id === v.setorId)
      if (s?.gestorId && pessoas.has(s.gestorId)) gestorId = s.gestorId
    }
    out.push({ vagaId: v.id, titulo: v.titulo, cargoId: v.cargoId, setorId: v.setorId, gestorId, abertas })
  }
  return out
}

/* ---------- recortes (visão por departamento / equipe) ---------- */
export interface Filtro { setorId?: string; unidadeId?: string; gestorId?: string }

/** Subconjunto de pessoas do filtro. Por gestor: o gestor e toda a sua equipe. */
export function filtrarPessoas(todas: PessoaOrg[], f: Filtro): PessoaOrg[] {
  let base = todas
  if (f.gestorId) {
    const h = construirHierarquia(todas)
    const ids = new Set([f.gestorId, ...descendentes(h, f.gestorId)])
    base = base.filter((p) => ids.has(p.id))
  }
  if (f.setorId) base = base.filter((p) => p.setorId === f.setorId)
  if (f.unidadeId) base = base.filter((p) => p.unidadeId === f.unidadeId)
  return base
}
