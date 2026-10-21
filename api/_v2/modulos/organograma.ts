/* ============================================================
   API v2 · Organograma
   Lê as coleções legadas (fonte da verdade) e devolve uma visão
   FILTRADA POR PERMISSÃO. Nunca escreve nelas: a troca de gestor é
   feita pela ação da store (que persiste e audita); aqui só se valida.
   ============================================================ */
import {
  auditar, cargos as lerCargos, invalido, naoEncontrado, ok, pessoas as lerPessoas, setores as lerSetores, unidades as lerUnidades,
  type Ctx, type Executor, type PessoaOrg as PessoaLegada, type Rota, type Usuario,
} from '../nucleo.js'
import {
  construirHierarquia, filtrarPessoas, posicoesVagas, validarMudancaGestor, ROTULO_PENDENCIA, cadeiaAcima,
  type Hierarquia, type PessoaOrg, type VagaOrg,
} from '../../../src/domain/v2/organograma.js'
import { evolucaoDisponivel, indicadoresEstrutura, resumoParaSnapshot, type SnapshotEstrutura } from '../../../src/domain/v2/estrutura.js'

const LIMITE_VISAO_COMPLETA = 300

interface Base {
  legado: (PessoaLegada & { nomeSocial?: string; privacidade?: Record<string, unknown> })[]
  pessoas: PessoaOrg[]
  setores: Awaited<ReturnType<typeof lerSetores>>
  cargos: Awaited<ReturnType<typeof lerCargos>>
  unidades: Awaited<ReturnType<typeof lerUnidades>>
  vagas: VagaOrg[]
  h: Hierarquia
}

async function carregarBase(db: Executor, u: Usuario): Promise<Base> {
  const [legado, setores, cargos, unidades] = await Promise.all([lerPessoas(db), lerSetores(db), lerCargos(db), lerUnidades(db)])
  const pessoas: PessoaOrg[] = legado.map((p) => ({ id: p.id, nome: p.nome, setorId: p.setorId, cargoId: p.cargoId, unidadeId: p.unidadeId, status: p.status, responsavelId: p.responsavelId ?? null }))
  // Posições de vagas ainda não publicadas podem ser confidenciais (ex.: substituição): só quem vê vagas as enxerga.
  const verTodasVagas = u.caps.has('vagas:ver')
  const rv = await db.query(
    `select id, titulo, status, setor_id, cargo_id, gestor_imediato_id, qtd_posicoes, posicoes_preenchidas from rec_vagas
     where not arquivada and status in ('aprovada','publicada','pausada') ${verTodasVagas ? '' : "and status = 'publicada'"}`)
  const vagas: VagaOrg[] = rv.rows.map((r) => ({
    id: r.id, titulo: r.titulo, status: r.status, setorId: r.setor_id, cargoId: r.cargo_id,
    gestorImediatoId: r.gestor_imediato_id, qtdPosicoes: r.qtd_posicoes, posicoesPreenchidas: r.posicoes_preenchidas,
  }))
  return { legado, pessoas, setores, cargos, unidades, vagas, h: construirHierarquia(pessoas, setores) }
}

/** Cartão de pessoa. Contato só com org:ver_contato e se a pessoa não o ocultou. NUNCA salário, contrato, avaliações. */
function cartao(b: Base, id: string, u: Usuario, noMapa: Set<string>) {
  const p = b.legado.find((x) => x.id === id)!
  const cargo = b.cargos.find((c) => c.id === p.cargoId)
  const setor = b.setores.find((s) => s.id === p.setorId)
  const unidade = b.unidades.find((x) => x.id === (p.unidadeId ?? setor?.unidadeId))
  const no = b.h.nos.get(id)
  const pai = no?.pai ?? null
  const verContato = u.caps.has('org:ver_contato') && p.privacidade?.ocultarContato !== true
  return {
    id: p.id,
    nome: p.nome,
    apelido: p.nomeSocial || null,
    avatarCor: p.avatarCor ?? null,
    cargoId: p.cargoId || null, cargo: cargo?.nome ?? null, nivel: (cargo?.nivel as string | undefined) ?? null,
    setorId: p.setorId || null, setor: setor?.nome ?? null, setorCor: setor?.cor ?? null,
    unidadeId: unidade?.id ?? null, unidade: unidade?.nome ?? null,
    status: p.status,
    gestorId: pai && noMapa.has(pai) ? pai : null,
    gestorForaDaVisao: pai && !noMapa.has(pai) ? pai : null,
    lidera: !!(setor && (setor.gestorId === p.id || setor.liderancaIds?.includes(p.id))),
    diretos: b.h.diretos.get(id) ?? 0,
    totalAbaixo: b.h.totais.get(id) ?? 0,
    nivelHierarquico: no ? no.nivel + 1 : null,
    pendente: b.h.foraDaArvore.includes(id) || b.h.soltas.includes(id) || b.h.orfas.includes(id),
    contato: verContato ? { email: p.email ?? null, telefone: p.telefone || null, cidade: p.cidade || null, uf: p.uf || null } : null,
  }
}

function filtros(q: Record<string, string>) {
  return { setorId: q.setor || undefined, unidadeId: q.unidade || undefined, gestorId: q.gestor || undefined }
}

function nomeBusca(s: string) { return s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase() }

export const rotas: Rota[] = [
  // Mapa: visão completa (ou, em estruturas grandes, só os primeiros níveis; o resto vem por `ramo`).
  {
    metodo: 'GET', padrao: 'organograma', cap: 'org:ver',
    h: async ({ db, usuario, req }) => {
      const b = await carregarBase(db, usuario)
      const f = filtros(req.query)
      const noFiltro = filtrarPessoas(b.pessoas, f).filter((p) => p.status !== 'encerrado')
      const ids = new Set(noFiltro.map((p) => p.id))
      const q = nomeBusca(req.query.q ?? '').trim()
      // Hierarquia na visão: quem tem gestor fora do recorte vira raiz do recorte.
      const filhosVisao = new Map<string, string[]>()
      const raizesVisao: string[] = []
      for (const p of noFiltro) {
        const pai = b.h.nos.get(p.id)?.pai ?? null
        if (pai && ids.has(pai)) { (filhosVisao.get(pai) ?? filhosVisao.set(pai, []).get(pai)!).push(p.id) } else raizesVisao.push(p.id)
      }
      const parcial = ids.size > LIMITE_VISAO_COMPLETA && !req.query.completo
      const profundidade = req.query.profundidade ? Math.max(1, Math.min(10, Number(req.query.profundidade) || 2)) : parcial ? 2 : 99
      const incluidos = new Set<string>()
      const fila: [string, number][] = raizesVisao.map((id) => [id, 0])
      for (let i = 0; i < fila.length; i++) {
        const [id, nv] = fila[i]
        if (nv >= profundidade) continue
        incluidos.add(id)
        for (const fl of filhosVisao.get(id) ?? []) fila.push([fl, nv + 1])
      }
      const itens = [...incluidos].map((id) => ({ ...cartao(b, id, usuario, ids), filhosNaVisao: filhosVisao.get(id)?.length ?? 0 }))
      const pos = posicoesVagas(b.vagas, b.h.pessoas, b.setores)
        .filter((v) => (!f.setorId || v.setorId === f.setorId) && (v.gestorId === null || ids.has(v.gestorId)))
        .map((v) => ({
          vagaId: v.vagaId, titulo: v.titulo, abertas: v.abertas, gestorId: v.gestorId,
          setor: b.setores.find((s) => s.id === v.setorId)?.nome ?? null, setorId: v.setorId ?? null,
          cargo: b.cargos.find((c) => c.id === v.cargoId)?.nome ?? null,
        }))
      const encerradas = usuario.caps.has('pessoas:gerenciar')
        ? b.legado.filter((p) => p.status === 'encerrado').map((p) => ({ id: p.id, nome: p.nome })) : []
      return ok({
        itens, raizes: raizesVisao.filter((id) => incluidos.has(id)), total: ids.size, parcial: itens.length < ids.size,
        posicoesVagas: pos, encerradas,
        buscaAplicada: q || null,
        areas: b.setores.map((s) => ({ id: s.id, nome: s.nome, cor: s.cor ?? null, gestorId: s.gestorId ?? null })),
        unidades: b.unidades.map((x) => ({ id: x.id, nome: x.nome })),
        gestores: b.h.diretos.size ? [...b.h.diretos.entries()].filter(([, n]) => n > 0).map(([id]) => ({ id, nome: b.h.pessoas.get(id)!.nome })).sort((a, c) => a.nome.localeCompare(c.nome, 'pt-BR')) : [],
        podeEditar: usuario.caps.has('org:editar'),
        podeVerPerfilCompleto: usuario.caps.has('pessoas:gerenciar'),
      })
    },
  },

  // Ramo sob demanda (estruturas grandes): descendentes de uma pessoa até `profundidade` níveis.
  {
    metodo: 'GET', padrao: 'organograma/ramo/:pessoaId', cap: 'org:ver',
    h: async ({ db, usuario, req, params }) => {
      const b = await carregarBase(db, usuario)
      if (!b.h.nos.has(params.pessoaId)) throw naoEncontrado('Pessoa não encontrada no mapa.')
      const prof = Math.max(1, Math.min(5, Number(req.query.profundidade) || 1))
      const ids = new Set<string>()
      let atual = [params.pessoaId]
      for (let n = 0; n < prof; n++) {
        const prox: string[] = []
        for (const id of atual) for (const f of b.h.nos.get(id)?.filhos ?? []) { ids.add(f); prox.push(f) }
        atual = prox
      }
      const visiveis = new Set([params.pessoaId, ...ids])
      return ok({ itens: [...ids].map((id) => ({ ...cartao(b, id, usuario, visiveis), filhosNaVisao: b.h.nos.get(id)?.filhos.length ?? 0 })) })
    },
  },

  // Busca por pessoa: devolve o caminho de gestores para o mapa abrir os ramos até ela.
  {
    metodo: 'GET', padrao: 'organograma/busca', cap: 'org:ver',
    h: async ({ db, usuario, req }) => {
      const q = nomeBusca(req.query.q ?? '').trim()
      if (q.length < 2 && !req.query.id) return ok({ itens: [] })
      const b = await carregarBase(db, usuario)
      const achados = (req.query.id
        ? b.legado.filter((p) => p.id === req.query.id && p.status !== 'encerrado')
        : b.legado.filter((p) => p.status !== 'encerrado' && (nomeBusca(p.nome).includes(q) || nomeBusca(p.nomeSocial ?? '').includes(q)))).slice(0, 20)
      return ok({
        itens: achados.map((p) => ({
          id: p.id, nome: p.nome, cargo: b.cargos.find((c) => c.id === p.cargoId)?.nome ?? null, setor: b.setores.find((s) => s.id === p.setorId)?.nome ?? null,
          caminho: cadeiaAcima(b.h, p.id).reverse(),
        })),
      })
    },
  },

  // Indicadores de estrutura e pendências de cadastro (descrevem; não julgam).
  {
    metodo: 'GET', padrao: 'organograma/analise', cap: ['org:editar', 'analytics:ver'],
    h: async (c) => {
      const b = await carregarBase(c.db, c.usuario)
      const ind = indicadoresEstrutura(b.pessoas, b.setores, b.cargos.map((x) => ({ id: x.id, nome: x.nome, nivel: x.nivel as string | undefined })), b.unidades, b.vagas)
      await garantirSnapshot(c, b, ind, null)
      const snaps = await c.db.query('select to_char(mes, \'YYYY-MM-DD\') as mes, dados from org_snapshots order by mes')
      const nomePessoa = new Map(b.pessoas.map((p) => [p.id, p.nome]))
      const nomeSetor = new Map(b.setores.map((s) => [s.id, s.nome]))
      const pendencias = ind.pendencias.map((p) => ({
        tipo: p.tipo, rotulo: ROTULO_PENDENCIA[p.tipo], pessoaId: p.pessoaId, pessoa: p.pessoaId ? nomePessoa.get(p.pessoaId) ?? null : null,
        setorId: p.setorId ?? null, setor: p.setorId ? nomeSetor.get(p.setorId) ?? null : null, detalhe: p.detalhe ?? null,
        ciclo: p.ciclo?.map((id) => nomePessoa.get(id) ?? id) ?? null,
      }))
      const evolucao = snaps.rows as SnapshotEstrutura[]
      return ok({
        indicadores: { ...ind, pendencias: undefined, ciclos: ind.ciclos.map((cc) => cc.map((id) => nomePessoa.get(id) ?? id)), setoresSemGestor: ind.setoresSemGestor.map((id) => nomeSetor.get(id) ?? id) },
        pendencias,
        evolucao: evolucaoDisponivel(evolucao) ? evolucao : null,
        mensagemEvolucao: evolucaoDisponivel(evolucao) ? null : 'Ainda não há histórico suficiente: a linha do tempo aparece quando houver retratos de pelo menos dois meses.',
        retratos: evolucao.length,
      })
    },
  },

  // Validação de troca de gestor (a gravação é feita pela ação da store, que audita e persiste).
  {
    metodo: 'POST', padrao: 'organograma/validar-mudanca', cap: 'org:editar',
    h: async ({ db, req, usuario }) => {
      const pessoaId = String(req.corpo?.pessoaId ?? '')
      const novo = req.corpo?.novoGestorId
      if (!pessoaId) throw invalido('Informe a pessoa.')
      if (novo !== null && novo !== undefined && typeof novo !== 'string') throw invalido('Gestor inválido.')
      const b = await carregarBase(db, usuario)
      const r = validarMudancaGestor(b.pessoas, pessoaId, (novo as string | null | undefined) || null)
      const nome = (id?: string | null) => (id ? b.pessoas.find((p) => p.id === id)?.nome ?? null : null)
      return ok({ ok: r.erros.length === 0, erros: r.erros, avisos: r.avisos, pessoa: nome(pessoaId), novoGestor: nome(novo as string | null), gestorAtual: nome(b.pessoas.find((p) => p.id === pessoaId)?.responsavelId) })
    },
  },

  {
    metodo: 'POST', padrao: 'organograma/snapshot', cap: 'org:editar',
    h: async (c) => {
      const b = await carregarBase(c.db, c.usuario)
      const ind = indicadoresEstrutura(b.pessoas, b.setores, b.cargos.map((x) => ({ id: x.id, nome: x.nome, nivel: x.nivel as string | undefined })), b.unidades, b.vagas)
      await garantirSnapshot(c, b, ind, c.usuario.colaboradorId, true)
      return ok()
    },
  },
]

async function garantirSnapshot(c: Ctx, _b: Base, ind: ReturnType<typeof indicadoresEstrutura>, por: string | null, substituir = false) {
  const mes = `${c.agora.getUTCFullYear()}-${String(c.agora.getUTCMonth() + 1).padStart(2, '0')}-01`
  const dados = JSON.stringify(resumoParaSnapshot(ind))
  const r = await c.db.query(
    `insert into org_snapshots (mes, dados, criado_por) values ($1, $2::jsonb, $3)
     on conflict (mes) do ${substituir ? 'update set dados = excluded.dados, criado_por = excluded.criado_por, criado_em = now()' : 'nothing'}`, [mes, dados, por])
  if (por && r.rowCount) await auditar(c.db, por, 'organograma', mes, 'snapshot_registrado', { ativos: ind.totalAtivos })
}
