/* ============================================================
   /api/estado · leitura filtrada e gravação por registro
   ------------------------------------------------------------
   GET: carrega as coleções, filtra pelo que a pessoa pode ver
        (guarda.ts) e entrega também o segredo anônimo dela.
   PUT: recebe operações por registro (src/domain/sincronia.ts),
        trava as coleções tocadas, confere conflitos (hash da versão
        vista × versão atual), aplica as regras e grava numa única
        transação. Nada é gravado se qualquer operação for recusada.
   ============================================================ */
import { createHmac } from 'node:crypto'
import { COLECOES, tabela } from '../_lib.js'
import { CHAVE_COMPOSTA, chaveRegistro, hashRegistro, canonico, type OpsColecao } from '../../src/domain/sincronia.js'
import { chaveApoio, chaveAutor } from '../../src/domain/anonimato.js'
import { IGNORAR, Recusa, filtrarEstado, mesclar, montarContexto, politicaDe, visao, type CtxEscrita } from './guarda.js'
import type { FuncaoAdicional } from '../../src/domain/permissions.js'

type Obj = Record<string, any>
export interface Ex { query(sql: string, params?: unknown[]): Promise<{ rows: any[]; rowCount?: number | null }> }

/** Segredo anônimo por pessoa (caixa de sugestões). ANON_SECRET separado; sem ele, deriva do SESSION_SECRET. */
export function segredoAnonimo(colaboradorId: string): string {
  const base = process.env.ANON_SECRET || process.env.SESSION_SECRET
  if (!base || base.length < 32) throw new Error('ANON_SECRET/SESSION_SECRET ausente ou curto.')
  return createHmac('sha256', base).update(`sugestoes|${colaboradorId}`).digest('base64url')
}

export async function carregarEstadoDe(ex: Ex): Promise<Obj> {
  const out: Obj = Object.fromEntries(COLECOES.map((c) => [c, [] as unknown[]]))
  const sql = COLECOES.map((c) => `select '${c}'::text as c, ord, dados from ${tabela(c)}`).join(' union all ') + ' order by c, ord'
  for (const r of (await ex.query(sql)).rows) (out[r.c] as unknown[]).push(r.dados)
  const cfg = await ex.query('select chave, dados from app_config')
  out.config = Object.fromEntries(cfg.rows.map((r) => [r.chave, r.dados]))
  return out
}

/** O handler garante o schema v2 (acl_funcoes, fin_*) antes de chamar estas funções. */
async function funcoesDe(ex: Ex, colaboradorId: string): Promise<FuncaoAdicional[]> {
  return (await ex.query('select funcao from acl_funcoes where colaborador_id = $1', [colaboradorId])).rows.map((r) => r.funcao)
}

/**
 * Converte, uma única vez, as chaves das sugestões do esquema antigo (sal público, recalculável por
 * qualquer pessoa) para o novo (segredo por pessoa). Idempotente: marca em app_meta.
 */
export async function migrarChavesSugestoes(ex: Ex): Promise<number> {
  if ((await ex.query("select 1 from app_meta where chave = 'sugestoes_chaves_v2'")).rows.length) return 0
  const pessoas = (await ex.query('select id from app_colaboradores')).rows.map((r) => String(r.id))
  const autor = new Map(pessoas.map((p) => [chaveAutor(p, ''), p]))
  const linhas = (await ex.query('select ord, dados from app_sugestoes')).rows
  let n = 0
  for (const l of linhas) {
    const s = l.dados as Obj
    const apoioAntigo = new Map(pessoas.map((p) => [chaveApoio(p, s.id, ''), p]))
    const dono = autor.get(s.autorChave)
    const novo = {
      ...s,
      autorChave: dono ? chaveAutor(dono, segredoAnonimo(dono)) : s.autorChave,
      apoios: ((s.apoios as string[]) ?? []).map((k) => { const p = apoioAntigo.get(k); return p ? chaveApoio(p, s.id, segredoAnonimo(p)) : k }),
    }
    if (canonico(novo) !== canonico(s)) { await ex.query('update app_sugestoes set dados = $2::jsonb where ord = $1', [l.ord, JSON.stringify(novo)]); n++ }
  }
  await ex.query("insert into app_meta (chave, valor) values ('sugestoes_chaves_v2', $1::jsonb) on conflict (chave) do nothing", [JSON.stringify({ em: new Date().toISOString(), convertidas: n })])
  return n
}

/** Pessoas com contrato, fornecedor, documento ou conta no módulo financeiro. */
async function comHistoricoFinanceiro(ex: Ex, ids: string[]): Promise<Set<string>> {
  if (!ids.length) return new Set()
  const r = await ex.query(`select prestador_id as id from fin_contratos where prestador_id = any($1::text[])
    union select representante_id from fin_fornecedores where representante_id = any($1::text[])
    union select pessoa_id from doc_documentos where pessoa_id = any($1::text[])
    union select pessoa_id from fin_contas where pessoa_id = any($1::text[])`, [ids])
  return new Set(r.rows.map((x) => String(x.id)))
}

/** Estado que a pessoa pode ver. */
export async function estadoPara(ex: Ex, colaboradorId: string): Promise<{ estado: Obj; segredo: string } | null> {
  await migrarChavesSugestoes(ex)
  const estado = await carregarEstadoDe(ex)
  const segredo = segredoAnonimo(colaboradorId)
  const c = montarContexto(estado, colaboradorId, await funcoesDe(ex, colaboradorId), segredo)
  if (!c) return null
  return { estado: filtrarEstado(estado, c, COLECOES), segredo }
}

/* ---------- gravação ---------- */
export interface Lote { ops?: Record<string, OpsColecao>; config?: { base: string | null; dados: Obj } }
export interface ResultadoLote { gravadas: string[]; conflitos?: { colecao: string; chave: string }[] }

/** Expressão SQL da chave do registro (igual a chaveRegistro). */
function exprChave(colecao: string): string {
  const campos = CHAVE_COMPOSTA[colecao]
  return campos ? campos.map((f) => `coalesce(dados->>'${f}', '')`).join(` || '|' || `) : 'id'
}

const ehObj = (v: unknown): v is Obj => !!v && typeof v === 'object' && !Array.isArray(v)

function validarFormato(lote: Lote): void {
  if (!ehObj(lote)) throw new Recusa('Corpo inválido.', 400)
  for (const [nome, ops] of Object.entries(lote.ops ?? {})) {
    if (!(COLECOES as readonly string[]).includes(nome)) throw new Recusa(`Coleção desconhecida: ${nome}`, 400)
    if (!ehObj(ops) || !Array.isArray(ops.upserts) || !Array.isArray(ops.remocoes)) throw new Recusa('Operações inválidas.', 400)
    for (const u of ops.upserts) {
      if (!ehObj(u) || typeof u.chave !== 'string' || !ehObj(u.dados) || chaveRegistro(nome, u.dados) !== u.chave || !u.chave) throw new Recusa('Registro inválido.', 400)
      if (u.base !== null && typeof u.base !== 'string') throw new Recusa('Registro inválido.', 400)
    }
    for (const r of ops.remocoes) if (!ehObj(r) || typeof r.chave !== 'string' || typeof r.base !== 'string') throw new Recusa('Remoção inválida.', 400)
  }
  if (lote.config !== undefined && (!ehObj(lote.config) || !ehObj(lote.config.dados))) throw new Recusa('Configuração inválida.', 400)
}

/**
 * Aplica o lote numa transação (o chamador abre e fecha). Lança Recusa (403/409/400) sem gravar nada
 * quando algo não é permitido ou houve edição concorrente.
 */
export async function aplicarLote(ex: Ex, colaboradorId: string, lote: Lote, agora = new Date()): Promise<ResultadoLote> {
  validarFormato(lote)
  const nomes = Object.keys(lote.ops ?? {}).sort()
  // Serializa escritas na mesma coleção (ordem fixa evita deadlock).
  for (const n of [...nomes, ...(lote.config ? ['config'] : [])]) await ex.query('select pg_advisory_xact_lock(hashtext($1))', [`app_estado:${n}`])
  const estado = await carregarEstadoDe(ex)
  const base = montarContexto(estado, colaboradorId, await funcoesDe(ex, colaboradorId), segredoAnonimo(colaboradorId), agora)
  if (!base) throw new Recusa('Cadastro não encontrado.', 403)

  // 1) Conflitos e mescla com o que a pessoa não viu.
  const conflitos: { colecao: string; chave: string }[] = []
  const lote2: CtxEscrita['lote'] = {}
  const planos: { colecao: string; chave: string; antes: Obj | null; novo: Obj | null; pos: 'inicio' | 'fim' }[] = []
  for (const nome of nomes) {
    const ops = lote.ops![nome]
    const atuais = new Map((estado[nome] as Obj[]).map((r) => [chaveRegistro(nome, r), r]))
    const mapa = (lote2[nome] = new Map())
    const tratar = (chave: string, baseHash: string | null, dados: Obj | null, pos: 'inicio' | 'fim') => {
      const antes = atuais.get(chave) ?? null
      const visto = antes ? visao(nome, antes, base) : null
      if (antes && !visto) throw new Recusa('Registro inacessível.', 403)
      const hashVisto = visto ? hashRegistro(visto) : null
      if (hashVisto !== baseHash) {
        // Mesma mudança já aplicada por outra via (ex.: duas abas) não é conflito.
        if (!(dados && visto && canonico(visto) === canonico(dados)) && !(!dados && !antes)) conflitos.push({ colecao: nome, chave })
        return
      }
      const novo = dados ? (antes && visto ? mesclar(dados, antes, visto) : dados) : null
      mapa.set(chave, novo)
      planos.push({ colecao: nome, chave, antes, novo, pos })
    }
    for (const u of ops.upserts) tratar(u.chave, u.base, u.dados, u.pos === 'inicio' ? 'inicio' : 'fim')
    for (const r of ops.remocoes) tratar(r.chave, r.base, null, 'fim')
  }
  if (lote.config) {
    if (hashRegistro(estado.config) !== lote.config.base && canonico(estado.config) !== canonico(lote.config.dados)) conflitos.push({ colecao: 'config', chave: '-' })
  }
  if (conflitos.length) {
    const e = new Recusa('Outra pessoa alterou estes dados enquanto você editava. Atualizamos a tela com a versão mais recente.', 409) as Recusa & { conflitos?: unknown }
    e.conflitos = conflitos
    throw e
  }

  // 2) Regras por registro (com o lote inteiro à vista, para checagens cruzadas).
  const removidas = planos.filter((p) => p.colecao === 'colaboradores' && !p.novo && p.antes).map((p) => String(p.antes!.id))
  const c: CtxEscrita = {
    ...base, lote: lote2, ledger: [...(estado.lancamentos as Obj[])], reconhecimentosNoLote: 0, respostasNoLote: new Set(),
    historicoFinanceiro: await comHistoricoFinanceiro(ex, removidas),
  }
  // Lançamentos dependem dos demais registros do lote: ficam por último.
  planos.sort((a, b) => Number(a.colecao === 'lancamentos') - Number(b.colecao === 'lancamentos'))
  const gravar: { colecao: string; chave: string; antes: Obj | null; final: Obj | null; pos: 'inicio' | 'fim' }[] = []
  for (const p of planos) {
    if (p.novo && p.antes === null && p.novo.id === undefined && !CHAVE_COMPOSTA[p.colecao]) throw new Recusa('Registro sem identificador.', 400)
    const final = politicaDe(p.colecao).escrever(p.antes, p.novo, c)
    if (final === IGNORAR) continue
    gravar.push({ ...p, final })
  }
  if (lote.config) {
    if (!base.priv) throw new Recusa('Apenas RH ou administração alteram as configurações.')
  }

  // 3) Grava.
  const gravadas = new Set<string>()
  for (const g of gravar) {
    const t = tabela(g.colecao), k = exprChave(g.colecao)
    if (!g.final) {
      await ex.query(`delete from ${t} where ${k} = $1`, [g.chave])
    } else if (g.antes) {
      await ex.query(`update ${t} set dados = $2::jsonb, atualizado_em = now() where ${k} = $1`, [g.chave, JSON.stringify(g.final)])
    } else {
      const ord = g.pos === 'inicio' ? `(select coalesce(min(ord), 0) - 1 from ${t})` : `(select coalesce(max(ord), -1) + 1 from ${t})`
      await ex.query(`insert into ${t} (ord, id, dados) values (${ord}, $1, $2::jsonb)`, [CHAVE_COMPOSTA[g.colecao] ? g.chave : String(g.final.id), JSON.stringify(g.final)])
    }
    gravadas.add(g.colecao)
  }
  if (lote.config) {
    for (const [k, v] of Object.entries(lote.config.dados)) {
      await ex.query('insert into app_config (chave, dados) values ($1, $2::jsonb) on conflict (chave) do update set dados = excluded.dados, atualizado_em = now()', [k, JSON.stringify(v)])
    }
    gravadas.add('config')
  }
  return { gravadas: [...gravadas] }
}
