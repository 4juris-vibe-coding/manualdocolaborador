/* ============================================================
   API v2 · Arquitetura de cargos (cg_*)
   cargo_id = Cargo.id legado (app_cargos), fonte da verdade do cargo.
   Nada aqui escreve em coleções legadas.
   ============================================================ */
import {
  auditar, camel, cargos as cargosLegado, competenciasLegado, conflito, dataISO, enumerado, idsComPapel, inteiro, invalido, listaTexto,
  naoEncontrado, notificar, ok, paginacao, pessoas as pessoasLegado, proibido, texto, tem, unidades as unidadesLegado, setores as setoresLegado,
  type Ctx, type Executor, type Rota, type Usuario,
} from '../nucleo.js'
import {
  CAMPOS_FICHA, RESSALVA_FAIXA, TRILHAS_INICIAIS, detectarDuplicidades, diffFichas, podeAprovar, posicaoNaFaixa, revisaoPendente,
  validarFaixa, vigenciasSobrepoem, type Vigencia,
} from '../../../src/domain/v2/cargos.js'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const uuid = (v: unknown, campo = 'id') => { if (typeof v !== 'string' || !UUID.test(v)) throw invalido(`${campo} inválido.`); return v }
const uuidOuNulo = (v: unknown, campo: string) => (v === undefined || v === null || v === '' ? null : uuid(v, campo))
const hojeStr = (c: Ctx) => c.agora.toISOString().slice(0, 10)
const somaDia = (d: string, n: number) => { const x = new Date(d + 'T00:00:00Z'); x.setUTCDate(x.getUTCDate() + n); return x.toISOString().slice(0, 10) }

/* ---------- mapeamento da ficha ---------- */
const COL: Record<string, string> = {
  codigo: 'codigo', familiaId: 'familia_id', subfamiliaId: 'subfamilia_id', area: 'area', trilhaId: 'trilha_id', nivelId: 'nivel_id',
  cargoReferenciaId: 'cargo_referencia_id', descricaoOficial: 'descricao_oficial', objetivo: 'objetivo', responsabilidades: 'responsabilidades',
  entregas: 'entregas', requisitosMinimos: 'requisitos_minimos', formacao: 'formacao', experiencia: 'experiencia',
  competenciasTecnicas: 'competencias_tecnicas', competenciasComportamentais: 'competencias_comportamentais', conhecimentos: 'conhecimentos',
  certificacoes: 'certificacoes', kpis: 'kpis', vigenciaInicio: 'vigencia_inicio', aprovadores: 'aprovadores',
}
const JSONCOLS = new Set(['competenciasTecnicas', 'competenciasComportamentais', 'conhecimentos', 'certificacoes', 'kpis', 'aprovadores'])
const TEXTOS_LONGOS = ['descricaoOficial', 'objetivo', 'responsabilidades', 'entregas', 'requisitosMinimos', 'formacao', 'experiencia'] as const

const SEL_FICHA = `cargo_id, codigo, familia_id, subfamilia_id, area, trilha_id, nivel_id, cargo_referencia_id, descricao_oficial, objetivo,
  responsabilidades, entregas, requisitos_minimos, formacao, experiencia, competencias_tecnicas, competencias_comportamentais, conhecimentos,
  certificacoes, kpis, vigencia_inicio::text as vigencia_inicio, aprovadores, status, versao_vigente, revisado_em, atualizado_por, atualizado_em`

const dadosDaFicha = (row: Record<string, unknown>) => {
  const c = camel(row)
  return Object.fromEntries(CAMPOS_FICHA.map((k) => [k, c[k] ?? null]))
}

async function fichaDe(ex: Executor, cargoId: string) {
  const r = await ex.query(`select ${SEL_FICHA} from cg_fichas where cargo_id = $1`, [cargoId])
  return r.rows[0] as Record<string, unknown> | undefined
}

async function cargoLegadoOu404(ex: Executor, cargoId: string) {
  const c = (await cargosLegado(ex)).find((x) => x.id === cargoId)
  if (!c) throw naoEncontrado('Cargo não encontrado.')
  return c
}

/* ---------- taxonomia ---------- */
async function garantirTrilhas(ex: Executor) {
  const n = await ex.query('select count(*)::int as n from cg_trilhas')
  if (n.rows[0].n > 0) return
  let ordem = 0
  for (const t of TRILHAS_INICIAIS) {
    const r = await ex.query('insert into cg_trilhas (nome, descricao, ordem) values ($1,$2,$3) on conflict (nome) do nothing returning id', [t.nome, t.descricao, ordem++])
    if (!r.rows[0]) continue
    let o = 1
    for (const nome of t.niveis) await ex.query('insert into cg_niveis (trilha_id, ordem, nome) values ($1,$2,$3) on conflict do nothing', [r.rows[0].id, o++, nome])
  }
}

async function taxonomia(ex: Executor) {
  await garantirTrilhas(ex)
  const fam = await ex.query('select id, nome, descricao, pai_id, ativa from cg_familias order by lower(nome)')
  const tr = await ex.query('select id, nome, descricao, ordem, ativa from cg_trilhas order by ordem, nome')
  const ni = await ex.query('select id, trilha_id, ordem, nome, criterios_evolucao, requisitos from cg_niveis order by trilha_id, ordem')
  const usoF = await ex.query('select familia_id, subfamilia_id from cg_fichas')
  const contaF = new Map<string, number>()
  for (const u of usoF.rows) for (const k of [u.familia_id, u.subfamilia_id]) if (k) contaF.set(k, (contaF.get(k) ?? 0) + 1)
  const usoN = await ex.query('select nivel_id, count(*)::int as n from cg_fichas where nivel_id is not null group by nivel_id')
  const contaN = new Map(usoN.rows.map((r) => [r.nivel_id as string, r.n as number]))
  return {
    familias: fam.rows.map((f) => ({ ...camel(f), cargos: contaF.get(f.id) ?? 0 })),
    trilhas: tr.rows.map((t) => ({
      ...camel(t),
      niveis: ni.rows.filter((n) => n.trilha_id === t.id).map((n) => ({ ...camel(n), cargos: contaN.get(n.id) ?? 0 })),
    })),
  }
}

async function validarFamilia(ex: Executor, id: string | null, campo: string) {
  if (!id) return
  if (!(await ex.query('select 1 from cg_familias where id = $1', [id])).rowCount) throw invalido('Família não encontrada.', { [campo]: 'Família inexistente' })
}

/* ---------- validação da ficha ---------- */
async function lerCamposFicha(ex: Executor, corpo: Record<string, unknown>, cargoIdSelf: string): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  const tem_ = (k: string) => Object.prototype.hasOwnProperty.call(corpo, k)
  // Código em branco = "gerar automaticamente" (ficha nova) ou manter o atual.
  if (tem_('codigo') && corpo.codigo !== '' && corpo.codigo !== null) out.codigo = texto(corpo.codigo, 'codigo', { max: 40 }).toUpperCase()
  if (tem_('area')) out.area = texto(corpo.area, 'area', { obrigatorio: false, max: 120 }) || null
  for (const k of TEXTOS_LONGOS) if (tem_(k)) out[k] = texto(corpo[k], k, { obrigatorio: false, max: 6000 }) || null
  for (const k of ['competenciasTecnicas', 'competenciasComportamentais', 'conhecimentos', 'certificacoes', 'kpis'] as const) if (tem_(k)) out[k] = listaTexto(corpo[k], 60, 200)
  if (tem_('aprovadores')) out.aprovadores = listaTexto(corpo.aprovadores, 10, 80)
  if (tem_('vigenciaInicio')) out.vigenciaInicio = dataISO(corpo.vigenciaInicio, 'vigenciaInicio')
  if (tem_('familiaId')) { out.familiaId = uuidOuNulo(corpo.familiaId, 'familiaId'); await validarFamilia(ex, out.familiaId as string | null, 'familiaId') }
  if (tem_('subfamiliaId')) {
    const s = uuidOuNulo(corpo.subfamiliaId, 'subfamiliaId')
    await validarFamilia(ex, s, 'subfamiliaId')
    if (s) {
      const pai = (await ex.query('select pai_id from cg_familias where id = $1', [s])).rows[0]?.pai_id
      const fam = (out.familiaId ?? corpo.familiaId) as string | null | undefined
      if (!pai) throw invalido('A subfamília precisa pertencer a uma família.', { subfamiliaId: 'Escolha uma subfamília' })
      if (fam && pai !== fam) throw invalido('A subfamília não pertence à família escolhida.', { subfamiliaId: 'Subfamília de outra família' })
    }
    out.subfamiliaId = s
  }
  if (tem_('trilhaId')) {
    const t = uuidOuNulo(corpo.trilhaId, 'trilhaId')
    if (t && !(await ex.query('select 1 from cg_trilhas where id = $1', [t])).rowCount) throw invalido('Trilha não encontrada.', { trilhaId: 'Trilha inexistente' })
    out.trilhaId = t
  }
  if (tem_('nivelId')) {
    const n = uuidOuNulo(corpo.nivelId, 'nivelId')
    if (n) {
      const lin = (await ex.query('select trilha_id from cg_niveis where id = $1', [n])).rows[0]
      if (!lin) throw invalido('Nível não encontrado.', { nivelId: 'Nível inexistente' })
      const tr = (out.trilhaId ?? corpo.trilhaId) as string | null | undefined
      if (tr && lin.trilha_id !== tr) throw invalido('O nível não pertence à trilha escolhida.', { nivelId: 'Nível de outra trilha' })
    }
    out.nivelId = n
  }
  if (tem_('cargoReferenciaId')) {
    const r = corpo.cargoReferenciaId ? String(corpo.cargoReferenciaId) : null
    if (r) {
      if (r === cargoIdSelf) throw invalido('O cargo de referência não pode ser o próprio cargo.', { cargoReferenciaId: 'Escolha outro cargo' })
      await cargoLegadoOu404(ex, r).catch(() => { throw invalido('Cargo de referência não encontrado.', { cargoReferenciaId: 'Cargo inexistente' }) })
    }
    out.cargoReferenciaId = r
  }
  return out
}

async function proximoCodigo(ex: Executor): Promise<string> {
  const n = (await ex.query('select count(*)::int as n from cg_fichas')).rows[0].n as number
  for (let i = n + 1; i < n + 200; i++) {
    const c = `CAR-${String(i).padStart(3, '0')}`
    if (!(await ex.query('select 1 from cg_fichas where upper(codigo) = $1', [c])).rowCount) return c
  }
  throw conflito('Não foi possível gerar um código livre.')
}

/* ---------- aprovadores / notificações ---------- */
async function aprovadoresDe(ex: Executor, ficha?: Record<string, unknown>): Promise<string[]> {
  const designados = (ficha?.aprovadores as string[] | undefined) ?? []
  if (designados.length) return designados
  return idsComPapel(ex, 'rh', 'admin')
}
const podeDecidir = (u: Usuario, designados: string[]) => u.caps.has('cargos:aprovar') && (u.papel === 'admin' || designados.length === 0 || designados.includes(u.colaboradorId))

/* ---------- faixas ---------- */
const SEL_FAIXA = `id, cargo_id, nivel_id, unidade_id, criterio, minimo, referencia, maximo, moeda, vigencia_inicio::text as vigencia_inicio,
  vigencia_fim::text as vigencia_fim, status, revisao_de, criado_por, criado_em, aprovado_por, aprovado_em`
const faixaOut = (r: Record<string, unknown>, hoje: string) => {
  const f = camel(r) as Record<string, any>
  f.minimo = Number(f.minimo); f.maximo = Number(f.maximo); f.referencia = f.referencia == null ? null : Number(f.referencia)
  f.situacao = f.status === 'vigente' ? (f.vigenciaInicio > hoje ? 'futura' : f.vigenciaFim && f.vigenciaFim < hoje ? 'encerrada' : 'vigente') : f.status
  return f
}

async function conflitoVigencia(ex: Executor, f: { cargoId: string; nivelId: string | null; unidadeId: string | null; criterio: string | null }, v: Vigencia, ignorar: string[]) {
  const r = await ex.query(
    `select id, vigencia_inicio::text as inicio, vigencia_fim::text as fim from cg_faixas
     where cargo_id = $1 and nivel_id is not distinct from $2 and unidade_id is not distinct from $3 and coalesce(criterio,'') = coalesce($4,'')
       and status in ('vigente','em_aprovacao','encerrada') and not (id = any($5::uuid[]))`,
    [f.cargoId, f.nivelId, f.unidadeId, f.criterio, ignorar])
  return r.rows.some((x) => vigenciasSobrepoem(v, { inicio: x.inicio, fim: x.fim }))
}

async function lerFaixa(c: Ctx, corpo: Record<string, unknown>, cargoId: string) {
  const minimo = Number(corpo.minimo), maximo = Number(corpo.maximo)
  const referencia = corpo.referencia === undefined || corpo.referencia === null || corpo.referencia === '' ? null : Number(corpo.referencia)
  const inicio = dataISO(corpo.vigenciaInicio, 'vigenciaInicio', true)!
  const fim = dataISO(corpo.vigenciaFim, 'vigenciaFim')
  const erro = validarFaixa({ minimo, referencia, maximo }, { inicio, fim })
  if (erro) throw invalido(erro)
  const moeda = texto(corpo.moeda ?? 'BRL', 'moeda', { max: 3, min: 3 }).toUpperCase()
  const nivelId = uuidOuNulo(corpo.nivelId, 'nivelId')
  if (nivelId && !(await c.db.query('select 1 from cg_niveis where id = $1', [nivelId])).rowCount) throw invalido('Nível não encontrado.', { nivelId: 'Nível inexistente' })
  const unidadeId = corpo.unidadeId ? String(corpo.unidadeId) : null
  if (unidadeId && !(await unidadesLegado(c.db)).some((u) => u.id === unidadeId)) throw invalido('Unidade não encontrada.', { unidadeId: 'Unidade inexistente' })
  const criterio = texto(corpo.criterio, 'criterio', { obrigatorio: false, max: 120 }) || null
  return { cargoId, minimo, referencia, maximo, inicio, fim, moeda, nivelId, unidadeId, criterio }
}

const exigirFaixas = (c: Ctx) => { if (!tem(c.usuario, 'cargos:ver_faixas')) throw proibido() }

/* ============================================================
   Rotas
   ============================================================ */
export const rotas: Rota[] = [
  /* ---------- catálogo ---------- */
  {
    metodo: 'GET', padrao: 'cargos/catalogo', cap: 'cargos:ver',
    h: async (c) => {
      const q = c.req.query
      const { pagina, por, offset } = paginacao(q, 30, 100)
      const [lista, setores, fichas, fam, tri, niv, usoV, pess] = await Promise.all([
        cargosLegado(c.db), setoresLegado(c.db),
        c.db.query(`select ${SEL_FICHA} from cg_fichas`),
        c.db.query('select id, nome from cg_familias'), c.db.query('select id, nome from cg_trilhas'), c.db.query('select id, nome from cg_niveis'),
        c.db.query('select cargo_id, count(*)::int as n from rec_vagas where cargo_id is not null group by cargo_id'),
        pessoasLegado(c.db),
      ])
      const f = new Map(fichas.rows.map((r) => [r.cargo_id as string, r]))
      const nome = (rows: any[]) => new Map(rows.map((r) => [r.id as string, r.nome as string]))
      const nFam = nome(fam.rows), nTri = nome(tri.rows), nNiv = nome(niv.rows), nSet = new Map(setores.map((s) => [s.id, s.nome]))
      const vagas = new Map(usoV.rows.map((r) => [r.cargo_id as string, r.n as number]))
      const pessoasPorCargo = new Map<string, number>()
      for (const p of pess) if (p.status !== 'encerrado') pessoasPorCargo.set(p.cargoId, (pessoasPorCargo.get(p.cargoId) ?? 0) + 1)
      const busca = (q.busca ?? '').toLowerCase().trim()
      let itens = lista.map((cg) => {
        const fi = f.get(cg.id)
        return {
          cargoId: cg.id, nome: cg.nome, setorId: cg.setorId, setorNome: nSet.get(cg.setorId) ?? null, nivelLegado: cg.nivel ?? null,
          codigo: (fi?.codigo as string) ?? null,
          familiaId: (fi?.familia_id as string) ?? null, familia: fi?.familia_id ? nFam.get(fi.familia_id as string) ?? null : null,
          trilhaId: (fi?.trilha_id as string) ?? null, trilha: fi?.trilha_id ? nTri.get(fi.trilha_id as string) ?? null : null,
          nivel: fi?.nivel_id ? nNiv.get(fi.nivel_id as string) ?? null : null,
          status: (fi?.status as string) ?? 'sem_ficha', versaoVigente: (fi?.versao_vigente as number) ?? 0,
          revisaoPendente: fi?.status === 'inativo' ? false : revisaoPendente((fi?.revisado_em as string | null) ?? null, c.agora),
          vagas: vagas.get(cg.id) ?? 0, pessoas: pessoasPorCargo.get(cg.id) ?? 0,
        }
      })
      const resumo = {
        total: itens.length, semFicha: itens.filter((i) => i.status === 'sem_ficha').length, vigentes: itens.filter((i) => i.status === 'vigente').length,
        emAprovacao: itens.filter((i) => i.status === 'em_aprovacao').length, inativos: itens.filter((i) => i.status === 'inativo').length,
        revisoesPendentes: itens.filter((i) => i.revisaoPendente && i.status !== 'sem_ficha').length,
      }
      if (busca) itens = itens.filter((i) => `${i.nome} ${i.codigo ?? ''}`.toLowerCase().includes(busca))
      if (q.familia) itens = itens.filter((i) => i.familiaId === q.familia)
      if (q.trilha) itens = itens.filter((i) => i.trilhaId === q.trilha)
      if (q.setor) itens = itens.filter((i) => i.setorId === q.setor)
      if (q.status) itens = itens.filter((i) => i.status === q.status)
      if (q.revisao === '1') itens = itens.filter((i) => i.revisaoPendente)
      itens.sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'))
      return ok({ itens: itens.slice(offset, offset + por), total: itens.length, pagina, por, resumo })
    },
  },

  /* ---------- taxonomia ---------- */
  { metodo: 'GET', padrao: 'cargos/taxonomia', cap: 'cargos:ver', h: async (c) => ok(await taxonomia(c.db)) },
  {
    metodo: 'POST', padrao: 'cargos/taxonomia/familias', cap: 'cargos:gerenciar',
    h: async (c) => {
      const nome = texto(c.req.corpo.nome, 'nome', { max: 120 })
      const paiId = uuidOuNulo(c.req.corpo.paiId, 'paiId')
      if (paiId) {
        const pai = (await c.db.query('select pai_id from cg_familias where id = $1', [paiId])).rows[0]
        if (!pai) throw invalido('Família-mãe não encontrada.')
        if (pai.pai_id) throw invalido('Subfamílias não podem ter subfamílias.')
      }
      const dup = await c.db.query('select 1 from cg_familias where lower(nome) = lower($1) and pai_id is not distinct from $2', [nome, paiId])
      if (dup.rowCount) throw conflito('Já existe uma família com esse nome.')
      const r = await c.db.query('insert into cg_familias (nome, descricao, pai_id) values ($1,$2,$3) returning id', [nome, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null, paiId])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_familia', r.rows[0].id, 'criada', { nome })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/taxonomia/familias/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      const id = uuid(c.params.id)
      const atual = (await c.db.query('select nome, pai_id from cg_familias where id = $1', [id])).rows[0]
      if (!atual) throw naoEncontrado()
      const nome = texto(c.req.corpo.nome ?? atual.nome, 'nome', { max: 120 })
      const dup = await c.db.query('select 1 from cg_familias where lower(nome) = lower($1) and pai_id is not distinct from $2 and id <> $3', [nome, atual.pai_id, id])
      if (dup.rowCount) throw conflito('Já existe uma família com esse nome.')
      await c.db.query('update cg_familias set nome = $2, descricao = $3, ativa = $4 where id = $1',
        [id, nome, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null, c.req.corpo.ativa !== false])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_familia', id, 'editada', { nome })
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'cargos/taxonomia/familias/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      const id = uuid(c.params.id)
      const uso = await c.db.query('select (select count(*) from cg_fichas where familia_id = $1 or subfamilia_id = $1)::int as f, (select count(*) from cg_familias where pai_id = $1)::int as s', [id])
      if (uso.rows[0].f || uso.rows[0].s) throw conflito('Há cargos ou subfamílias ligados a esta família. Desative-a em vez de excluir.')
      await c.db.query('delete from cg_familias where id = $1', [id])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_familia', id, 'excluida')
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/taxonomia/trilhas', cap: 'cargos:gerenciar',
    h: async (c) => {
      const nome = texto(c.req.corpo.nome, 'nome', { max: 80 })
      if ((await c.db.query('select 1 from cg_trilhas where lower(nome) = lower($1)', [nome])).rowCount) throw conflito('Já existe uma trilha com esse nome.')
      const ordem = (await c.db.query('select coalesce(max(ordem),0)+1 as o from cg_trilhas')).rows[0].o
      const r = await c.db.query('insert into cg_trilhas (nome, descricao, ordem) values ($1,$2,$3) returning id', [nome, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null, ordem])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_trilha', r.rows[0].id, 'criada', { nome })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/taxonomia/trilhas/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      const id = uuid(c.params.id)
      const atual = (await c.db.query('select nome from cg_trilhas where id = $1', [id])).rows[0]
      if (!atual) throw naoEncontrado()
      const nome = texto(c.req.corpo.nome ?? atual.nome, 'nome', { max: 80 })
      if ((await c.db.query('select 1 from cg_trilhas where lower(nome) = lower($1) and id <> $2', [nome, id])).rowCount) throw conflito('Já existe uma trilha com esse nome.')
      await c.db.query('update cg_trilhas set nome = $2, descricao = $3, ativa = $4 where id = $1', [id, nome, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null, c.req.corpo.ativa !== false])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_trilha', id, 'editada', { nome })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/taxonomia/trilhas/:id/niveis', cap: 'cargos:gerenciar',
    h: async (c) => {
      const trilha = uuid(c.params.id)
      if (!(await c.db.query('select 1 from cg_trilhas where id = $1', [trilha])).rowCount) throw naoEncontrado('Trilha não encontrada.')
      const nome = texto(c.req.corpo.nome, 'nome', { max: 80 })
      if ((await c.db.query('select 1 from cg_niveis where trilha_id = $1 and lower(nome) = lower($2)', [trilha, nome])).rowCount) throw conflito('Já existe um nível com esse nome nesta trilha.')
      const ordem = c.req.corpo.ordem !== undefined ? inteiro(c.req.corpo.ordem, 'ordem', { min: 1, max: 99 }) : (await c.db.query('select coalesce(max(ordem),0)+1 as o from cg_niveis where trilha_id = $1', [trilha])).rows[0].o
      const r = await c.db.query('insert into cg_niveis (trilha_id, ordem, nome, criterios_evolucao, requisitos) values ($1,$2,$3,$4,$5) returning id',
        [trilha, ordem, nome, texto(c.req.corpo.criteriosEvolucao, 'criteriosEvolucao', { obrigatorio: false, max: 3000 }) || null, texto(c.req.corpo.requisitos, 'requisitos', { obrigatorio: false, max: 3000 }) || null])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_nivel', r.rows[0].id, 'criado', { nome, trilha })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/taxonomia/niveis/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      const id = uuid(c.params.id)
      const atual = (await c.db.query('select trilha_id, nome, ordem from cg_niveis where id = $1', [id])).rows[0]
      if (!atual) throw naoEncontrado()
      const nome = texto(c.req.corpo.nome ?? atual.nome, 'nome', { max: 80 })
      if ((await c.db.query('select 1 from cg_niveis where trilha_id = $1 and lower(nome) = lower($2) and id <> $3', [atual.trilha_id, nome, id])).rowCount) throw conflito('Já existe um nível com esse nome nesta trilha.')
      const ordem = c.req.corpo.ordem !== undefined ? inteiro(c.req.corpo.ordem, 'ordem', { min: 1, max: 99 }) : atual.ordem
      await c.db.query('update cg_niveis set nome = $2, ordem = $3, criterios_evolucao = $4, requisitos = $5 where id = $1',
        [id, nome, ordem, texto(c.req.corpo.criteriosEvolucao, 'criteriosEvolucao', { obrigatorio: false, max: 3000 }) || null, texto(c.req.corpo.requisitos, 'requisitos', { obrigatorio: false, max: 3000 }) || null])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_nivel', id, 'editado', { nome })
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'cargos/taxonomia/niveis/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      const id = uuid(c.params.id)
      const uso = (await c.db.query('select (select count(*) from cg_fichas where nivel_id = $1)::int + (select count(*) from cg_faixas where nivel_id = $1)::int as n', [id])).rows[0].n
      if (uso) throw conflito('Há cargos ou faixas usando este nível.')
      await c.db.query('delete from cg_niveis where id = $1', [id])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_nivel', id, 'excluido')
      return ok()
    },
  },

  /* ---------- matriz de competências ---------- */
  {
    metodo: 'GET', padrao: 'cargos/matriz', cap: 'cargos:ver',
    h: async (c) => {
      const [lista, comps, m, fichas, pess] = await Promise.all([
        cargosLegado(c.db), competenciasLegado(c.db),
        c.db.query('select cargo_id, competencia_id, nivel_esperado, obrigatoria, criterio from cg_cargo_competencias'),
        c.db.query('select cargo_id, status from cg_fichas'), pessoasLegado(c.db),
      ])
      const status = new Map(fichas.rows.map((r) => [r.cargo_id as string, r.status as string]))
      const ativas = comps.filter((x) => (x as any).ativo !== false)
      const pc = new Map<string, number>()
      for (const p of pess) if (p.status !== 'encerrado') pc.set(p.cargoId, (pc.get(p.cargoId) ?? 0) + 1)
      const filtroCargo = c.req.query.cargoId
      const cargosOut = lista.filter((x) => status.get(x.id) !== 'inativo' && (!filtroCargo || x.id === filtroCargo))
        .map((x) => ({ id: x.id, nome: x.nome, setorId: x.setorId, pessoas: pc.get(x.id) ?? 0 }))
      const entradas = m.rows.map(camel)
      const ids = new Set(cargosOut.map((x) => x.id))
      // Cobertura: competência atribuída ao cargo na tela legada mas ausente da matriz, e cargos sem nenhuma competência.
      const lacunasCobertura: { cargoId: string; competenciaId: string }[] = []
      for (const cp of ativas) for (const cid of ((cp as any).cargoIds ?? []) as string[]) {
        if (ids.has(cid) && !m.rows.some((e) => e.cargo_id === cid && e.competencia_id === cp.id)) lacunasCobertura.push({ cargoId: cid, competenciaId: cp.id })
      }
      const semMatriz = cargosOut.filter((x) => !m.rows.some((e) => e.cargo_id === x.id)).map((x) => x.id)
      return ok({
        cargos: cargosOut,
        competencias: ativas.map((x) => ({ id: x.id, nome: x.nome, grupoId: x.grupoId ?? null, tipo: (x as any).tipo ?? null })),
        entradas: entradas.filter((e: any) => ids.has(e.cargoId)),
        cobertura: { semMatriz, ausentesDaMatriz: lacunasCobertura },
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/:cargoId/matriz', cap: 'cargos:gerenciar',
    h: async (c) => {
      const cargoId = c.params.cargoId
      await cargoLegadoOu404(c.db, cargoId)
      const itens = Array.isArray(c.req.corpo.itens) ? c.req.corpo.itens as Record<string, unknown>[] : null
      if (!itens) throw invalido('Informe a lista de competências.')
      const comps = new Set((await competenciasLegado(c.db)).map((x) => x.id))
      const vistos = new Set<string>()
      const lim = itens.map((i) => {
        const competenciaId = String(i.competenciaId ?? '')
        if (!comps.has(competenciaId)) throw invalido('Competência não encontrada.', { competenciaId })
        if (vistos.has(competenciaId)) throw invalido('Competência repetida na matriz.')
        vistos.add(competenciaId)
        return { competenciaId, nivelEsperado: inteiro(i.nivelEsperado, 'nivelEsperado', { min: 1, max: 5 }), obrigatoria: i.obrigatoria !== false, criterio: texto(i.criterio, 'criterio', { obrigatorio: false, max: 600 }) || null }
      })
      await c.db.tx(async (t) => {
        await t.query('delete from cg_cargo_competencias where cargo_id = $1', [cargoId])
        for (const i of lim) await t.query('insert into cg_cargo_competencias (cargo_id, competencia_id, nivel_esperado, obrigatoria, criterio, atualizado_por) values ($1,$2,$3,$4,$5,$6)',
          [cargoId, i.competenciaId, i.nivelEsperado, i.obrigatoria, i.criterio, c.usuario.colaboradorId])
        await auditar(t, c.usuario.colaboradorId, 'cargos_matriz', cargoId, 'atualizada', { competencias: lim.length })
      })
      return ok({ itens: lim.length })
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/:cargoId/matriz', cap: 'cargos:ver',
    h: async (c) => {
      await cargoLegadoOu404(c.db, c.params.cargoId)
      const [m, comps] = await Promise.all([
        c.db.query('select competencia_id, nivel_esperado, obrigatoria, criterio from cg_cargo_competencias where cargo_id = $1', [c.params.cargoId]),
        competenciasLegado(c.db),
      ])
      const nome = new Map(comps.map((x) => [x.id, x.nome]))
      return ok({ itens: m.rows.map((r) => ({ ...camel(r), nome: nome.get(r.competencia_id) ?? '(competência removida)' })) })
    },
  },

  /* ---------- faixas salariais (restritas) ---------- */
  {
    metodo: 'GET', padrao: 'cargos/faixas', cap: 'cargos:ver_faixas',
    h: async (c) => {
      const q = c.req.query, { pagina, por, offset } = paginacao(q, 30, 100)
      const where: string[] = []; const params: unknown[] = []
      if (q.cargoId) { params.push(q.cargoId); where.push(`cargo_id = $${params.length}`) }
      if (q.status) { params.push(q.status); where.push(`status = $${params.length}`) }
      const w = where.length ? 'where ' + where.join(' and ') : ''
      const total = (await c.db.query(`select count(*)::int as n from cg_faixas ${w}`, params)).rows[0].n
      const r = await c.db.query(`select ${SEL_FAIXA} from cg_faixas ${w} order by cargo_id, vigencia_inicio desc limit ${por} offset ${offset}`, params)
      const [lista, niveis] = await Promise.all([cargosLegado(c.db), c.db.query('select id, nome from cg_niveis')])
      const nc = new Map(lista.map((x) => [x.id, x.nome])), nn = new Map(niveis.rows.map((x) => [x.id as string, x.nome as string]))
      const hoje = hojeStr(c)
      return ok({ itens: r.rows.map((x) => ({ ...faixaOut(x, hoje), cargoNome: nc.get(x.cargo_id) ?? '(cargo removido)', nivelNome: x.nivel_id ? nn.get(x.nivel_id) ?? null : null })), total, pagina, por, ressalva: RESSALVA_FAIXA })
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/faixas/comparativo', cap: 'cargos:ver_faixas',
    h: async (c) => {
      const hoje = hojeStr(c)
      const [lista, pess, fx, contratos] = await Promise.all([
        cargosLegado(c.db), pessoasLegado(c.db),
        c.db.query(`select ${SEL_FAIXA} from cg_faixas where status = 'vigente' and vigencia_inicio <= $1::date and (vigencia_fim is null or vigencia_fim >= $1::date)`, [hoje]),
        c.db.query("select dados from app_contratos where dados->>'status' = 'vigente'"),
      ])
      const valorPor = new Map<string, number>()
      for (const k of contratos.rows) valorPor.set(k.dados.colaboradorId, (valorPor.get(k.dados.colaboradorId) ?? 0) + Number(k.dados.valorMensal || 0))
      const faixas = fx.rows.map((x) => faixaOut(x, hoje))
      const detalhe = c.req.query.detalhe === '1' && tem(c.usuario, 'pessoas:ver_contratos')
      const porCargo = new Map<string, { abaixo: number; dentro: number; acima: number; semFaixa: number; semContrato: number; moedaDiferente: number }>()
      const pessoasDet: { pessoaId: string; nome: string; cargoId: string; posicao: string }[] = []
      for (const p of pess) {
        if (p.status === 'encerrado') continue
        const a = porCargo.get(p.cargoId) ?? { abaixo: 0, dentro: 0, acima: 0, semFaixa: 0, semContrato: 0, moedaDiferente: 0 }
        porCargo.set(p.cargoId, a)
        // faixa mais específica: unidade igual > sem unidade; sem escopo de nível/critério
        const cand = faixas.filter((f) => f.cargoId === p.cargoId && !f.nivelId && !f.criterio && (!f.unidadeId || f.unidadeId === p.unidadeId))
          .sort((x, y) => Number(!!y.unidadeId) - Number(!!x.unidadeId))[0]
        const v = valorPor.get(p.id)
        let pos: string
        if (!cand) { a.semFaixa++; pos = 'sem_faixa' }
        else if (v === undefined) { a.semContrato++; pos = 'sem_contrato' }
        else if (cand.moeda !== 'BRL') { a.moedaDiferente++; pos = 'moeda_diferente' }
        else { pos = posicaoNaFaixa(v, { minimo: cand.minimo, maximo: cand.maximo }); (a as any)[pos]++ }
        if (detalhe) pessoasDet.push({ pessoaId: p.id, nome: p.nome, cargoId: p.cargoId, posicao: pos })
      }
      const nc = new Map(lista.map((x) => [x.id, x.nome]))
      return ok({
        referencia: hoje, ressalva: RESSALVA_FAIXA,
        cargos: [...porCargo].filter(([, a]) => a.abaixo + a.dentro + a.acima + a.semFaixa + a.semContrato + a.moedaDiferente > 0)
          .map(([cargoId, a]) => ({ cargoId, cargoNome: nc.get(cargoId) ?? '(cargo removido)', ...a })),
        ...(detalhe ? { pessoas: pessoasDet } : {}),
      })
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/faixas', cap: 'cargos:gerenciar',
    h: async (c) => {
      exigirFaixas(c)
      const cargoId = texto(c.req.corpo.cargoId, 'cargoId', { max: 80 })
      await cargoLegadoOu404(c.db, cargoId)
      const f = await lerFaixa(c, c.req.corpo, cargoId)
      if (await conflitoVigencia(c.db, f, { inicio: f.inicio, fim: f.fim }, [])) throw conflito('Já existe uma faixa para este escopo com vigência sobreposta. Use "Revisar" para criar uma nova versão.')
      const r = await c.db.query(
        `insert into cg_faixas (cargo_id, nivel_id, unidade_id, criterio, minimo, referencia, maximo, moeda, vigencia_inicio, vigencia_fim, criado_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [cargoId, f.nivelId, f.unidadeId, f.criterio, f.minimo, f.referencia, f.maximo, f.moeda, f.inicio, f.fim, c.usuario.colaboradorId])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_faixa', r.rows[0].id, 'criada', { cargoId })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/faixas/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      exigirFaixas(c)
      const id = uuid(c.params.id)
      const at = (await c.db.query(`select ${SEL_FAIXA} from cg_faixas where id = $1`, [id])).rows[0]
      if (!at) throw naoEncontrado()
      if (!['rascunho', 'rejeitada'].includes(at.status)) throw conflito('Só faixas em rascunho podem ser editadas. Use "Revisar" para uma nova versão.')
      const f = await lerFaixa(c, { ...camel(at), ...c.req.corpo }, at.cargo_id)
      const ign = [id, ...(at.revisao_de ? [at.revisao_de] : [])]
      if (await conflitoVigencia(c.db, f, { inicio: f.inicio, fim: f.fim }, ign)) throw conflito('Vigência sobreposta a outra faixa do mesmo escopo.')
      await c.db.query(`update cg_faixas set nivel_id=$2, unidade_id=$3, criterio=$4, minimo=$5, referencia=$6, maximo=$7, moeda=$8, vigencia_inicio=$9, vigencia_fim=$10, status='rascunho' where id=$1`,
        [id, f.nivelId, f.unidadeId, f.criterio, f.minimo, f.referencia, f.maximo, f.moeda, f.inicio, f.fim])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_faixa', id, 'editada')
      return ok()
    },
  },
  {
    metodo: 'DELETE', padrao: 'cargos/faixas/:id', cap: 'cargos:gerenciar',
    h: async (c) => {
      exigirFaixas(c)
      const id = uuid(c.params.id)
      const r = await c.db.query("delete from cg_faixas where id = $1 and status in ('rascunho','rejeitada') returning id", [id])
      if (!r.rowCount) throw conflito('Só faixas em rascunho ou rejeitadas podem ser excluídas; as demais ficam no histórico.')
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_faixa', id, 'excluida')
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/faixas/:id/revisar', cap: 'cargos:gerenciar',
    h: async (c) => {
      exigirFaixas(c)
      const id = uuid(c.params.id)
      const at = (await c.db.query(`select ${SEL_FAIXA} from cg_faixas where id = $1`, [id])).rows[0]
      if (!at) throw naoEncontrado()
      if (at.status !== 'vigente') throw conflito('Só uma faixa vigente pode ser revisada.')
      const f = await lerFaixa(c, { ...camel(at), ...c.req.corpo, vigenciaFim: c.req.corpo.vigenciaFim ?? null }, at.cargo_id)
      if (f.inicio <= at.vigencia_inicio) throw invalido('A nova vigência deve começar depois do início da faixa atual.', { vigenciaInicio: 'Data posterior à vigência atual' })
      if (await conflitoVigencia(c.db, f, { inicio: f.inicio, fim: f.fim }, [id])) throw conflito('Vigência sobreposta a outra faixa do mesmo escopo.')
      const r = await c.db.query(
        `insert into cg_faixas (cargo_id, nivel_id, unidade_id, criterio, minimo, referencia, maximo, moeda, vigencia_inicio, vigencia_fim, revisao_de, criado_por)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12) returning id`,
        [at.cargo_id, f.nivelId, f.unidadeId, f.criterio, f.minimo, f.referencia, f.maximo, f.moeda, f.inicio, f.fim, id, c.usuario.colaboradorId])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_faixa', r.rows[0].id, 'revisao_criada', { de: id })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/faixas/:id/submeter', cap: 'cargos:gerenciar',
    h: async (c) => {
      exigirFaixas(c)
      const id = uuid(c.params.id)
      const at = (await c.db.query(`select ${SEL_FAIXA} from cg_faixas where id = $1`, [id])).rows[0]
      if (!at) throw naoEncontrado()
      if (!['rascunho', 'rejeitada'].includes(at.status)) throw conflito('Esta faixa não está em rascunho.')
      const ign = [id, ...(at.revisao_de ? [at.revisao_de] : [])]
      if (await conflitoVigencia(c.db, { cargoId: at.cargo_id, nivelId: at.nivel_id, unidadeId: at.unidade_id, criterio: at.criterio }, { inicio: at.vigencia_inicio, fim: at.vigencia_fim }, ign)) throw conflito('Vigência sobreposta a outra faixa do mesmo escopo.')
      await c.db.tx(async (t) => {
        await t.query("update cg_faixas set status = 'em_aprovacao' where id = $1", [id])
        await t.query("insert into cg_solicitacoes (tipo, cargo_id, alvo_id, proposta_por, descricao) values ('faixa',$1,$2,$3,$4)", [at.cargo_id, id, c.usuario.colaboradorId, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null])
        for (const a of await aprovadoresDe(t)) if (a !== c.usuario.colaboradorId) await notificar(t, { destinatarioId: a, tipo: 'cargos', titulo: 'Faixa salarial aguardando aprovação', link: '/cargos/governanca', chave: `faixa-aprov:${id}` })
        await auditar(t, c.usuario.colaboradorId, 'cargos_faixa', id, 'submetida')
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/faixas/:id/decisao', cap: 'cargos:aprovar',
    h: async (c) => {
      exigirFaixas(c)
      const id = uuid(c.params.id)
      const decisao = enumerado(c.req.corpo.decisao, 'decisao', ['aprovar', 'rejeitar'] as const)
      const just = texto(c.req.corpo.justificativa, 'justificativa', { obrigatorio: decisao === 'rejeitar', max: 600 })
      const at = (await c.db.query(`select ${SEL_FAIXA} from cg_faixas where id = $1`, [id])).rows[0]
      if (!at) throw naoEncontrado()
      if (at.status !== 'em_aprovacao') throw conflito('Esta faixa não está aguardando aprovação.')
      const sol = (await c.db.query("select id, proposta_por from cg_solicitacoes where tipo='faixa' and alvo_id = $1 and status = 'pendente'", [id])).rows[0]
      if (!sol) throw conflito('Solicitação não encontrada.')
      if (!podeAprovar(sol.proposta_por, c.usuario.colaboradorId, c.usuario.papel)) throw proibido('Quem propôs a mudança não pode aprová-la.')
      await c.db.tx(async (t) => {
        if (decisao === 'aprovar') {
          if (await conflitoVigencia(t as any, { cargoId: at.cargo_id, nivelId: at.nivel_id, unidadeId: at.unidade_id, criterio: at.criterio }, { inicio: at.vigencia_inicio, fim: at.vigencia_fim }, [id, ...(at.revisao_de ? [at.revisao_de] : [])])) throw conflito('Vigência sobreposta a outra faixa do mesmo escopo.')
          if (at.revisao_de) {
            const ant = (await t.query('select vigencia_inicio::text as ini from cg_faixas where id = $1', [at.revisao_de])).rows[0]
            const novoFim = somaDia(at.vigencia_inicio, -1)
            if (ant && novoFim >= ant.ini) await t.query("update cg_faixas set vigencia_fim = $2, status = 'encerrada' where id = $1", [at.revisao_de, novoFim])
          }
          await t.query("update cg_faixas set status = 'vigente', aprovado_por = $2, aprovado_em = now() where id = $1", [id, c.usuario.colaboradorId])
        } else await t.query("update cg_faixas set status = 'rejeitada' where id = $1", [id])
        await t.query("update cg_solicitacoes set status = $2, decidido_por = $3, decidido_em = now(), justificativa = $4 where id = $1", [sol.id, decisao === 'aprovar' ? 'aprovada' : 'rejeitada', c.usuario.colaboradorId, just || null])
        await notificar(t, { destinatarioId: sol.proposta_por, tipo: 'cargos', titulo: decisao === 'aprovar' ? 'Faixa salarial aprovada' : 'Faixa salarial rejeitada', link: '/cargos/faixas', chave: `faixa-dec:${id}:${decisao}` })
        await auditar(t, c.usuario.colaboradorId, 'cargos_faixa', id, decisao === 'aprovar' ? 'aprovada' : 'rejeitada', { justificativa: just || undefined })
      })
      return ok()
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/faixas/:id/historico', cap: 'cargos:ver_faixas',
    h: async (c) => {
      let id: string | null = uuid(c.params.id)
      const cadeia: Record<string, unknown>[] = []
      const hoje = hojeStr(c)
      for (let i = 0; id && i < 50; i++) {
        const r: Record<string, unknown> | undefined = (await c.db.query(`select ${SEL_FAIXA} from cg_faixas where id = $1`, [id])).rows[0]
        if (!r) break
        cadeia.push(faixaOut(r, hoje))
        id = (r.revisao_de as string | null) ?? null
      }
      if (!cadeia.length) throw naoEncontrado()
      return ok({ itens: cadeia })
    },
  },

  /* ---------- governança ---------- */
  {
    metodo: 'GET', padrao: 'cargos/governanca', cap: ['cargos:gerenciar', 'cargos:aprovar'],
    h: async (c) => {
      const [lista, fichas, sol] = await Promise.all([
        cargosLegado(c.db), c.db.query(`select ${SEL_FICHA} from cg_fichas`),
        c.db.query("select id, tipo, cargo_id, alvo_id, proposta_por, proposta_em, descricao from cg_solicitacoes where status = 'pendente' order by proposta_em"),
      ])
      const nome = new Map(lista.map((x) => [x.id, x.nome]))
      const pend = sol.rows.filter((s) => s.tipo === 'ficha' || tem(c.usuario, 'cargos:ver_faixas'))
      const todos = [...lista.map((x) => ({ id: x.id, nome: x.nome, codigo: (fichas.rows.find((f) => f.cargo_id === x.id)?.codigo as string) ?? null }))]
      return ok({
        pendentes: pend.map((s) => ({ ...camel(s), cargoNome: nome.get(s.cargo_id) ?? null, podeDecidir: c.usuario.caps.has('cargos:aprovar') && podeAprovar(s.proposta_por, c.usuario.colaboradorId, c.usuario.papel) })),
        duplicidades: detectarDuplicidades(todos).map((d) => ({ ...d, nomeA: nome.get(d.a), nomeB: nome.get(d.b) })),
        inativos: fichas.rows.filter((f) => f.status === 'inativo').map((f) => ({ cargoId: f.cargo_id, nome: nome.get(f.cargo_id as string) ?? '(cargo removido)', codigo: f.codigo })),
        revisoesPendentes: fichas.rows.filter((f) => f.status !== 'inativo' && revisaoPendente(f.revisado_em as string | null, c.agora)).map((f) => ({ cargoId: f.cargo_id, nome: nome.get(f.cargo_id as string) ?? '(cargo removido)', revisadoEm: f.revisado_em })),
        semFicha: lista.filter((x) => !fichas.rows.some((f) => f.cargo_id === x.id)).map((x) => ({ cargoId: x.id, nome: x.nome })),
      })
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/governanca/notificar-revisoes', cap: 'cargos:gerenciar',
    h: async (c) => {
      const [lista, fichas] = await Promise.all([cargosLegado(c.db), c.db.query('select cargo_id, status, revisado_em from cg_fichas')])
      const mes = c.agora.toISOString().slice(0, 7)
      const rh = await idsComPapel(c.db, 'rh', 'admin')
      let n = 0
      for (const f of fichas.rows) {
        if (f.status === 'inativo' || !revisaoPendente(f.revisado_em, c.agora)) continue
        const cg = lista.find((x) => x.id === f.cargo_id)
        if (!cg) continue
        const dest = (cg.responsaveisIds as string[] | undefined)?.length ? (cg.responsaveisIds as string[]) : rh
        for (const d of dest) { await notificar(c.db, { destinatarioId: d, tipo: 'cargos', titulo: `Revisão pendente da ficha: ${cg.nome}`, link: `/cargos/${cg.id}`, chave: `cargo-revisao:${cg.id}:${mes}` }); n++ }
      }
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_governanca', null, 'revisoes_notificadas', { n })
      return ok({ notificacoes: n })
    },
  },

  /* ---------- por cargo ---------- */
  {
    metodo: 'GET', padrao: 'cargos/:cargoId/ficha', cap: 'cargos:ver',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const ficha = await fichaDe(c.db, cg.id)
      const sol = (await c.db.query("select id, proposta_por, proposta_em, descricao from cg_solicitacoes where tipo='ficha' and cargo_id = $1 and status = 'pendente'", [cg.id])).rows[0]
      const ultRej = (await c.db.query("select justificativa, decidido_em from cg_solicitacoes where tipo='ficha' and cargo_id = $1 and status = 'rejeitada' order by decidido_em desc limit 1", [cg.id])).rows[0]
      const { faixaValor, perfilIdeal, ...legado } = cg as Record<string, any>
      const verFaixas = tem(c.usuario, 'cargos:ver_faixas')
      return ok({
        cargo: { ...legado, ...(verFaixas ? { faixaValor } : {}) },
        ficha: ficha ? { ...dadosDaFicha(ficha), status: ficha.status, versaoVigente: ficha.versao_vigente, revisadoEm: ficha.revisado_em, atualizadoEm: ficha.atualizado_em, revisaoPendente: ficha.status !== 'inativo' && revisaoPendente(ficha.revisado_em as string | null, c.agora) } : null,
        solicitacaoPendente: sol ? camel(sol) : null,
        ultimaRejeicao: ultRej ? camel(ultRej) : null,
        permissoes: {
          editar: tem(c.usuario, 'cargos:gerenciar') && ficha?.status !== 'em_aprovacao',
          decidir: !!sol && podeDecidir(c.usuario, (ficha?.aprovadores as string[]) ?? []) && podeAprovar(sol.proposta_por, c.usuario.colaboradorId, c.usuario.papel),
          inativar: tem(c.usuario, 'cargos:aprovar'), verFaixas,
          // Mesma regra do POST cancelar-submissao: quem submeteu ou a administração.
          cancelarSubmissao: !!sol && tem(c.usuario, 'cargos:gerenciar') && (sol.proposta_por === c.usuario.colaboradorId || c.usuario.papel === 'admin'),
          propostaPorMim: !!sol && sol.proposta_por === c.usuario.colaboradorId,
        },
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'cargos/:cargoId/ficha', cap: 'cargos:gerenciar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const atual = await fichaDe(c.db, cg.id)
      if (atual?.status === 'em_aprovacao') throw conflito('A ficha está em aprovação. Cancele a submissão para editar.')
      if (atual?.status === 'inativo') throw conflito('Cargo inativo: reative-o para editar a ficha.')
      const campos = await lerCamposFicha(c.db, c.req.corpo, cg.id)
      if (campos.codigo) {
        const dup = await c.db.query('select cargo_id from cg_fichas where upper(codigo) = $1 and cargo_id <> $2', [campos.codigo, cg.id])
        if (dup.rowCount) throw conflito('Já existe outro cargo com este código.')
      }
      await c.db.tx(async (t) => {
        if (!atual) {
          const codigo = (campos.codigo as string) ?? await proximoCodigo(t)
          await t.query('insert into cg_fichas (cargo_id, codigo, atualizado_por) values ($1,$2,$3)', [cg.id, codigo, c.usuario.colaboradorId])
          delete campos.codigo
        }
        const sets: string[] = ['atualizado_por = $2', 'atualizado_em = now()']; const params: unknown[] = [cg.id, c.usuario.colaboradorId]
        for (const [k, v] of Object.entries(campos)) {
          params.push(JSONCOLS.has(k) ? JSON.stringify(v) : v)
          sets.push(`${COL[k]} = $${params.length}${JSONCOLS.has(k) ? '::jsonb' : ''}`)
        }
        // Editar uma ficha vigente abre um rascunho; a versão vigente continua disponível.
        if (atual?.status === 'vigente' && Object.keys(campos).length) sets.push("status = 'rascunho'")
        await t.query(`update cg_fichas set ${sets.join(', ')} where cargo_id = $1`, params)
        await auditar(t, c.usuario.colaboradorId, 'cargos_ficha', cg.id, atual ? 'editada' : 'criada', { campos: Object.keys(campos) })
      })
      return ok({ ficha: dadosDaFicha((await fichaDe(c.db, cg.id))!) })
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/submeter', cap: 'cargos:gerenciar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const f = await fichaDe(c.db, cg.id)
      if (!f) throw conflito('Preencha a ficha antes de submeter.')
      if (f.status !== 'rascunho') throw conflito('Só fichas em rascunho podem ser submetidas.')
      const faltam = (['descricaoOficial', 'objetivo', 'responsabilidades'] as const).filter((k) => !String(f[COL[k]] ?? '').trim())
      if (faltam.length) throw invalido('Complete descrição oficial, objetivo e responsabilidades antes de submeter.', Object.fromEntries(faltam.map((k) => [k, 'Obrigatório para submeter'])))
      await c.db.tx(async (t) => {
        await t.query("update cg_fichas set status = 'em_aprovacao' where cargo_id = $1", [cg.id])
        await t.query("insert into cg_solicitacoes (tipo, cargo_id, proposta_por, descricao) values ('ficha',$1,$2,$3)", [cg.id, c.usuario.colaboradorId, texto(c.req.corpo.descricao, 'descricao', { obrigatorio: false, max: 600 }) || null])
        for (const a of await aprovadoresDe(t, f)) if (a !== c.usuario.colaboradorId) await notificar(t, { destinatarioId: a, tipo: 'cargos', titulo: `Ficha de cargo aguardando aprovação: ${cg.nome}`, link: `/cargos/${cg.id}`, chave: `ficha-aprov:${cg.id}:${Number(f.versao_vigente) + 1}` })
        await auditar(t, c.usuario.colaboradorId, 'cargos_ficha', cg.id, 'submetida')
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/cancelar-submissao', cap: 'cargos:gerenciar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const sol = (await c.db.query("select id, proposta_por from cg_solicitacoes where tipo='ficha' and cargo_id = $1 and status = 'pendente'", [cg.id])).rows[0]
      if (!sol) throw conflito('Não há submissão pendente.')
      if (sol.proposta_por !== c.usuario.colaboradorId && c.usuario.papel !== 'admin') throw proibido('Só quem submeteu (ou a administração) cancela.')
      await c.db.tx(async (t) => {
        await t.query("update cg_solicitacoes set status = 'cancelada', decidido_por = $2, decidido_em = now() where id = $1", [sol.id, c.usuario.colaboradorId])
        await t.query("update cg_fichas set status = 'rascunho' where cargo_id = $1", [cg.id])
        await auditar(t, c.usuario.colaboradorId, 'cargos_ficha', cg.id, 'submissao_cancelada')
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/decisao', cap: 'cargos:aprovar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const decisao = enumerado(c.req.corpo.decisao, 'decisao', ['aprovar', 'rejeitar'] as const)
      const just = texto(c.req.corpo.justificativa, 'justificativa', { obrigatorio: decisao === 'rejeitar', max: 600 })
      const f = await fichaDe(c.db, cg.id)
      const sol = (await c.db.query("select id, proposta_por from cg_solicitacoes where tipo='ficha' and cargo_id = $1 and status = 'pendente'", [cg.id])).rows[0]
      if (!f || !sol || f.status !== 'em_aprovacao') throw conflito('Esta ficha não está aguardando aprovação.')
      if (!podeAprovar(sol.proposta_por, c.usuario.colaboradorId, c.usuario.papel)) throw proibido('Quem propôs a mudança não pode aprová-la.')
      if (!podeDecidir(c.usuario, (f.aprovadores as string[]) ?? [])) throw proibido('Você não está entre os aprovadores desta ficha.')
      let versao = Number(f.versao_vigente)
      await c.db.tx(async (t) => {
        if (decisao === 'aprovar') {
          versao += 1
          const dados = dadosDaFicha(f)
          if (!dados.vigenciaInicio) dados.vigenciaInicio = hojeStr(c)
          await t.query('insert into cg_ficha_versoes (cargo_id, versao, dados, nome_cargo, aprovada_por, proposta_por) values ($1,$2,$3::jsonb,$4,$5,$6)', [cg.id, versao, JSON.stringify(dados), cg.nome, c.usuario.colaboradorId, sol.proposta_por])
          await t.query("update cg_fichas set status = 'vigente', versao_vigente = $2, revisado_em = now(), vigencia_inicio = coalesce(vigencia_inicio, $3::date) where cargo_id = $1", [cg.id, versao, hojeStr(c)])
        } else await t.query("update cg_fichas set status = 'rascunho' where cargo_id = $1", [cg.id])
        await t.query('update cg_solicitacoes set status = $2, decidido_por = $3, decidido_em = now(), justificativa = $4 where id = $1', [sol.id, decisao === 'aprovar' ? 'aprovada' : 'rejeitada', c.usuario.colaboradorId, just || null])
        const dest = new Set<string>([sol.proposta_por, ...((cg.responsaveisIds as string[] | undefined) ?? [])])
        dest.delete(c.usuario.colaboradorId)
        for (const d of dest) await notificar(t, { destinatarioId: d, tipo: 'cargos', titulo: `Ficha ${decisao === 'aprovar' ? 'aprovada' : 'rejeitada'}: ${cg.nome}`, link: `/cargos/${cg.id}`, chave: `ficha-dec:${cg.id}:${versao}:${decisao}` })
        await auditar(t, c.usuario.colaboradorId, 'cargos_ficha', cg.id, decisao === 'aprovar' ? 'aprovada' : 'rejeitada', { versao, justificativa: just || undefined })
      })
      return ok({ versao })
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/revisar', cap: 'cargos:gerenciar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const r = await c.db.query("update cg_fichas set revisado_em = now(), atualizado_por = $2 where cargo_id = $1 and status in ('vigente','rascunho') returning cargo_id", [cg.id, c.usuario.colaboradorId])
      if (!r.rowCount) throw conflito('A ficha precisa existir e não estar em aprovação ou inativa.')
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_ficha', cg.id, 'revisada_sem_alteracao')
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/inativar', cap: 'cargos:aprovar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const motivo = texto(c.req.corpo.motivo, 'motivo', { max: 600 })
      const f = await fichaDe(c.db, cg.id)
      if (!f) throw conflito('Crie a ficha do cargo antes de inativá-lo.')
      if (f.status === 'inativo') throw conflito('O cargo já está inativo.')
      await c.db.tx(async (t) => {
        await t.query("update cg_solicitacoes set status = 'cancelada', decidido_por = $2, decidido_em = now() where tipo='ficha' and cargo_id = $1 and status = 'pendente'", [cg.id, c.usuario.colaboradorId])
        await t.query("update cg_fichas set status = 'inativo' where cargo_id = $1", [cg.id])
        await auditar(t, c.usuario.colaboradorId, 'cargos_ficha', cg.id, 'inativada', { motivo })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'cargos/:cargoId/ficha/reativar', cap: 'cargos:aprovar',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const f = await fichaDe(c.db, cg.id)
      if (!f || f.status !== 'inativo') throw conflito('O cargo não está inativo.')
      await c.db.query("update cg_fichas set status = $2 where cargo_id = $1", [cg.id, Number(f.versao_vigente) > 0 ? 'vigente' : 'rascunho'])
      await auditar(c.db, c.usuario.colaboradorId, 'cargos_ficha', cg.id, 'reativada')
      return ok()
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/:cargoId/versoes', cap: 'cargos:ver',
    h: async (c) => {
      await cargoLegadoOu404(c.db, c.params.cargoId)
      const r = await c.db.query('select versao, nome_cargo, aprovada_por, aprovada_em, proposta_por from cg_ficha_versoes where cargo_id = $1 order by versao desc', [c.params.cargoId])
      const sol = await c.db.query("select tipo, status, proposta_por, proposta_em, decidido_por, decidido_em, justificativa from cg_solicitacoes where tipo = 'ficha' and cargo_id = $1 order by proposta_em desc limit 50", [c.params.cargoId])
      return ok({ versoes: r.rows.map(camel), solicitacoes: sol.rows.map(camel) })
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/:cargoId/versoes/:versao', cap: 'cargos:ver',
    h: async (c) => {
      const v = inteiro(c.params.versao, 'versao', { min: 1, max: 100000 })
      const r = (await c.db.query('select versao, dados, nome_cargo, aprovada_em from cg_ficha_versoes where cargo_id = $1 and versao = $2', [c.params.cargoId, v])).rows[0]
      if (!r) throw naoEncontrado('Versão não encontrada.')
      const contra = c.req.query.contra ? inteiro(c.req.query.contra, 'contra', { min: 1, max: 100000 }) : v - 1
      const ant = contra >= 1 ? (await c.db.query('select dados from cg_ficha_versoes where cargo_id = $1 and versao = $2', [c.params.cargoId, contra])).rows[0] : null
      return ok({ ...camel(r), contra: ant ? contra : null, mudancas: ant ? diffFichas(ant.dados, r.dados) : [] })
    },
  },
  {
    metodo: 'GET', padrao: 'cargos/:cargoId/uso', cap: 'cargos:ver',
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const pess = (await pessoasLegado(c.db)).filter((p) => p.cargoId === cg.id)
      const vagasTodas = tem(c.usuario, 'vagas:gerenciar')
      const v = await c.db.query('select codigo, titulo, status, id from rec_vagas where cargo_id = $1 order by criado_em desc', [cg.id])
      return ok({
        vagas: { total: v.rowCount, abertas: v.rows.filter((x) => ['publicada', 'aprovada', 'em_aprovacao', 'pausada'].includes(x.status)).length, itens: vagasTodas ? v.rows.slice(0, 30) : [] },
        pessoas: { total: pess.length, ativas: pess.filter((p) => p.status !== 'encerrado').length, itens: pess.filter((p) => p.status !== 'encerrado').map((p) => ({ id: p.id, nome: p.nome })) },
      })
    },
  },
  {
    // Para outros módulos pré-preencherem vagas: usa a última versão APROVADA; nunca devolve valores.
    metodo: 'GET', padrao: 'cargos/:cargoId/ficha-resumo', cap: ['cargos:ver', 'vagas:gerenciar', 'vagas:solicitar'],
    h: async (c) => {
      const cg = await cargoLegadoOu404(c.db, c.params.cargoId)
      const f = await fichaDe(c.db, cg.id)
      const ver = f && Number(f.versao_vigente) > 0 ? (await c.db.query('select dados from cg_ficha_versoes where cargo_id = $1 and versao = $2', [cg.id, f.versao_vigente])).rows[0] : null
      const d = (ver?.dados ?? (f ? dadosDaFicha(f) : {})) as Record<string, any>
      const [fam, tri, niv] = await Promise.all([
        d.familiaId ? c.db.query('select nome from cg_familias where id = $1', [d.familiaId]) : null,
        d.trilhaId ? c.db.query('select nome from cg_trilhas where id = $1', [d.trilhaId]) : null,
        d.nivelId ? c.db.query('select nome from cg_niveis where id = $1', [d.nivelId]) : null,
      ])
      const m = await c.db.query('select competencia_id, nivel_esperado, obrigatoria from cg_cargo_competencias where cargo_id = $1', [cg.id])
      const nomes = new Map((await competenciasLegado(c.db)).map((x) => [x.id, x.nome]))
      return ok({
        cargoId: cg.id, titulo: cg.nome, codigo: d.codigo ?? null, senioridade: cg.nivel ?? null,
        familia: fam?.rows[0]?.nome ?? null, trilha: tri?.rows[0]?.nome ?? null, nivel: niv?.rows[0]?.nome ?? null,
        objetivo: d.objetivo ?? null, responsabilidades: d.responsabilidades ?? cg.atividades ?? null, requisitosMinimos: d.requisitosMinimos ?? null,
        formacao: d.formacao ?? null, experiencia: d.experiencia ?? null,
        competenciasTecnicas: d.competenciasTecnicas ?? cg.habilidades ?? [], competenciasComportamentais: d.competenciasComportamentais ?? [],
        certificacoes: d.certificacoes ?? [],
        competenciasMatriz: m.rows.map((r) => ({ nome: nomes.get(r.competencia_id) ?? null, nivelEsperado: r.nivel_esperado, obrigatoria: r.obrigatoria })),
        aprovada: !!ver, inativo: f?.status === 'inativo',
      })
    },
  },
]
