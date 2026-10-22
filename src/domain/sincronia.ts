/* ============================================================
   4JURIS Pessoas · Sincronização por registro (cliente ↔ /api/estado)
   ------------------------------------------------------------
   O cliente não envia mais coleções inteiras: envia, por coleção,
   os registros criados/alterados (upserts) e removidos, cada um com
   o hash da versão que ele tinha visto (`base`). O servidor confere
   o hash com a versão atual (detecção de edição concorrente), aplica
   as regras de permissão por registro e grava só o que mudou.
   Funções puras, usadas no navegador e no servidor.
   ============================================================ */

/** Coleções cujos registros não têm `id`: a chave é composta por estes campos. */
export const CHAVE_COMPOSTA: Record<string, string[]> = {
  progressoConteudos: ['colaboradorId', 'treinamentoId'],
  conquistas: ['colaboradorId', 'badgeId'],
  participacoes: ['pesquisaId', 'colaboradorId'],
  classificacoesGrupo: ['colaboradorId'],
}

type Registro = Record<string, unknown>

/** Chave estável do registro dentro da coleção. */
export function chaveRegistro(colecao: string, r: Registro): string {
  const campos = CHAVE_COMPOSTA[colecao]
  if (campos) return campos.map((c) => String(r[c] ?? '')).join('|')
  return String(r.id ?? '')
}

/** JSON canônico: chaves ordenadas e `undefined` omitido (o jsonb do Postgres reordena chaves). */
export function canonico(v: unknown): string {
  if (v === null || typeof v !== 'object') return JSON.stringify(v ?? null)
  if (Array.isArray(v)) return `[${v.map((x) => (x === undefined ? 'null' : canonico(x))).join(',')}]`
  const o = v as Record<string, unknown>
  return `{${Object.keys(o).filter((k) => o[k] !== undefined).sort().map((k) => `${JSON.stringify(k)}:${canonico(o[k])}`).join(',')}}`
}

/** Hash de detecção de mudança (FNV-1a, 2×32 bits). Não é criptográfico — serve só para comparar versões. */
export function hashTexto(texto: string): string {
  let h1 = 0x811c9dc5, h2 = 0x050c5d1f
  for (let i = 0; i < texto.length; i++) {
    const c = texto.charCodeAt(i)
    h1 = Math.imul(h1 ^ c, 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ c, 0x01000197) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0') + texto.length.toString(16)
}
export const hashRegistro = (r: unknown) => hashTexto(canonico(r))

export interface OpUpsert { chave: string; base: string | null; pos: 'inicio' | 'fim'; dados: Registro }
export interface OpRemocao { chave: string; base: string }
export interface OpsColecao { upserts: OpUpsert[]; remocoes: OpRemocao[] }

/** Diferença entre a última versão confirmada pelo servidor e a atual. `null` = nada mudou. */
export function diferenca(colecao: string, antes: Registro[], depois: Registro[]): OpsColecao | null {
  const mapaAntes = new Map(antes.map((r) => [chaveRegistro(colecao, r), r]))
  const chavesDepois = new Set<string>()
  const upserts: OpUpsert[] = []
  // Registros novos no começo da lista (ações que "prependem") vão para o início também no banco.
  let prefixoNovo = true
  for (const r of depois) {
    const chave = chaveRegistro(colecao, r)
    if (!chave || chavesDepois.has(chave)) continue
    chavesDepois.add(chave)
    const anterior = mapaAntes.get(chave)
    if (anterior) prefixoNovo = false
    if (!anterior) upserts.push({ chave, base: null, pos: prefixoNovo ? 'inicio' : 'fim', dados: r })
    else if (canonico(anterior) !== canonico(r)) upserts.push({ chave, base: hashRegistro(anterior), pos: 'fim', dados: r })
  }
  const remocoes: OpRemocao[] = []
  for (const [chave, r] of mapaAntes) if (!chavesDepois.has(chave)) remocoes.push({ chave, base: hashRegistro(r) })
  // Itens inseridos no início: o primeiro da lista deve ficar no topo, então a ordem de inserção é invertida.
  const inicio = upserts.filter((u) => u.pos === 'inicio').reverse()
  const resto = upserts.filter((u) => u.pos !== 'inicio')
  return inicio.length || resto.length || remocoes.length ? { upserts: [...inicio, ...resto], remocoes } : null
}
