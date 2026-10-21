/* API v2 · base: identidade da sessão, funções adicionais, notificações */
import { auditar, enumerado, invalido, naoEncontrado, ok, pessoaPorId, pessoas, type Rota } from '../nucleo.js'
import { FUNCAO_LABEL, type FuncaoAdicional } from '../../../src/domain/permissions.js'

const FUNCOES = Object.keys(FUNCAO_LABEL) as FuncaoAdicional[]

export const rotas: Rota[] = [
  // Quem sou eu e o que posso fazer (a interface usa para montar menus; o servidor decide de verdade)
  {
    metodo: 'GET', padrao: 'eu',
    h: async ({ usuario }) => ok({
      colaboradorId: usuario.colaboradorId, nome: usuario.nome, papel: usuario.papel, funcoes: usuario.funcoes,
      capacidades: [...usuario.caps], setoresLiderados: usuario.setoresLiderados,
    }),
  },

  // Funções adicionais (recrutador, analista de RH, responsável por pesquisas…)
  {
    metodo: 'GET', padrao: 'acl/funcoes', cap: 'admin:usuarios',
    h: async ({ db }) => {
      const r = await db.query('select colaborador_id, funcao from acl_funcoes order by colaborador_id')
      const porPessoa: Record<string, string[]> = {}
      for (const x of r.rows) (porPessoa[x.colaborador_id] ??= []).push(x.funcao)
      const gente = await pessoas(db)
      return ok({
        disponiveis: FUNCOES.map((f) => ({ chave: f, rotulo: FUNCAO_LABEL[f] })),
        atribuicoes: gente.filter((p) => p.status !== 'encerrado').map((p) => ({ colaboradorId: p.id, nome: p.nome, papel: p.papel, funcoes: porPessoa[p.id] ?? [] })),
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'acl/funcoes/:colaboradorId', cap: 'admin:usuarios',
    h: async ({ db, params, req, usuario }) => {
      const p = await pessoaPorId(db, params.colaboradorId)
      if (!p) throw naoEncontrado('Pessoa não encontrada.')
      const funcoes = Array.isArray(req.corpo?.funcoes) ? (req.corpo.funcoes as unknown[]).map((f) => enumerado(f, 'função', FUNCOES)) : null
      if (!funcoes) throw invalido('Informe a lista de funções.')
      const unicas = [...new Set(funcoes)]
      await db.tx(async (t) => {
        await t.query('delete from acl_funcoes where colaborador_id = $1', [p.id])
        for (const f of unicas) await t.query('insert into acl_funcoes (colaborador_id, funcao, concedido_por) values ($1,$2,$3)', [p.id, f, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'acl', p.id, 'funcoes_alteradas', { funcoes: unicas })
      })
      return ok({ colaboradorId: p.id, funcoes: unicas })
    },
  },

  // Notificações internas
  {
    metodo: 'GET', padrao: 'notificacoes',
    h: async ({ db, usuario, req }) => {
      const soNaoLidas = req.query.nao_lidas === '1'
      const r = await db.query(
        `select id, tipo, titulo, corpo, link, criada_em, lida_em from ntf_notificacoes
         where destinatario_id = $1 ${soNaoLidas ? 'and lida_em is null' : ''} order by criada_em desc limit 100`, [usuario.colaboradorId])
      const n = await db.query('select count(*)::int as n from ntf_notificacoes where destinatario_id = $1 and lida_em is null', [usuario.colaboradorId])
      return ok({ itens: r.rows, naoLidas: n.rows[0].n })
    },
  },
  {
    metodo: 'POST', padrao: 'notificacoes/lidas',
    h: async ({ db, usuario }) => {
      await db.query('update ntf_notificacoes set lida_em = now() where destinatario_id = $1 and lida_em is null', [usuario.colaboradorId])
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'notificacoes/:id/lida',
    h: async ({ db, usuario, params }) => {
      if (!/^[0-9a-f-]{36}$/i.test(params.id)) throw naoEncontrado()
      await db.query('update ntf_notificacoes set lida_em = coalesce(lida_em, now()) where id = $1 and destinatario_id = $2', [params.id, usuario.colaboradorId])
      return ok()
    },
  },

  // Auditoria dos módulos v2 (somente leitura)
  {
    metodo: 'GET', padrao: 'auditoria', cap: 'admin:auditoria',
    h: async ({ db, req }) => {
      const params: unknown[] = []
      let where = ''
      if (req.query.entidade) { params.push(req.query.entidade); where += ` and entidade = $${params.length}` }
      if (req.query.entidade_id) { params.push(req.query.entidade_id); where += ` and entidade_id = $${params.length}` }
      const r = await db.query(`select id, em, colaborador_id, entidade, entidade_id, acao, detalhes from aud_eventos where true ${where} order by em desc limit 300`, params)
      return ok({ itens: r.rows })
    },
  },
]
