/* ============================================================
   API v2 · LGPD e auditoria de acessos sensíveis
   Rotas:
   - POST lgpd/candidatos/retencao   (admin:privacidade) simular/aplicar a retenção
   - GET  auditoria/sensiveis         (admin:auditoria)   quem acessou dado sensível, quando
   O relatório mostra quem, quando, o tipo de acesso e qual registro;
   nunca o conteúdo acessado (currículo, nota, documento).
   ============================================================ */
import { auditar, dataISO, invalido, ok, paginacao, pessoas, type Res, type Rota } from '../nucleo.js'
import { candidatosElegiveis, processarRetencaoCandidatos } from '../lgpdRetencao.js'
import { ACESSOS_SENSIVEIS, ROTULO_ENTIDADE_SENSIVEL, tipoAcessoDoEvento, tipoAcessoPorChave } from '../../../src/domain/v2/acessosSensiveis.js'
import { linhaCsv } from '../../../src/domain/v2/ats.js'

const ID_PESSOA = /^[\w:.-]{1,80}$/

export const rotas: Rota[] = [
  {
    metodo: 'POST', padrao: 'lgpd/candidatos/retencao', cap: 'admin:privacidade',
    h: async ({ db, usuario, req, agora }) => {
      const simular = req.corpo?.simular !== false
      const el = await candidatosElegiveis(db, agora)
      if (simular) return ok({ simulacao: true, elegiveis: el.ids.length, anonimizados: 0, retencaoMeses: el.retencaoMeses, limite: el.limite })
      if (req.corpo?.confirmar !== true) throw invalido('Confirme a aplicação da retenção (a anonimização é irreversível).', { confirmar: 'Obrigatório' })
      const r = await processarRetencaoCandidatos(db, agora, usuario.colaboradorId)
      await auditar(db, usuario.colaboradorId, 'lgpd', 'retencao_candidatos', 'retencao_aplicada', { anonimizados: r.anonimizados, retencaoMeses: el.retencaoMeses })
      return ok({ simulacao: false, elegiveis: el.ids.length, anonimizados: r.anonimizados, retencaoMeses: el.retencaoMeses, limite: el.limite })
    },
  },

  {
    // ?de=AAAA-MM-DD&ate=AAAA-MM-DD&colaboradorId=&tipo=<chave>&entidade=&pagina=&por=&formato=csv
    metodo: 'GET', padrao: 'auditoria/sensiveis', cap: 'admin:auditoria',
    h: async ({ db, req, usuario }): Promise<Res> => {
      const q = req.query
      const de = dataISO(q.de, 'data inicial'), ate = dataISO(q.ate, 'data final')
      if (de && ate && de > ate) throw invalido('A data inicial deve ser anterior à final.', { de: 'Período inválido' })
      const tipos = q.tipo ? [tipoAcessoPorChave(q.tipo)].filter((t) => !!t) : ACESSOS_SENSIVEIS
      if (q.tipo && !tipos.length) throw invalido('Tipo de acesso inválido.', { tipo: 'Valor inválido' })
      const ps: unknown[] = []
      const par = (v: unknown) => { ps.push(v); return `$${ps.length}` }
      const pares = tipos.map((t) => `(e.entidade = ${par(t!.entidade)} and e.acao = ${par(t!.acao)})`).join(' or ')
      let where = `(${pares})`
      if (de) where += ` and e.em >= ${par(de)}::date`
      if (ate) where += ` and e.em < (${par(ate)}::date + 1)`
      if (q.colaboradorId) { if (!ID_PESSOA.test(q.colaboradorId)) throw invalido('Pessoa inválida.'); where += ` and e.colaborador_id = ${par(q.colaboradorId)}` }
      if (q.entidade) { if (!(q.entidade in ROTULO_ENTIDADE_SENSIVEL)) throw invalido('Entidade inválida.'); where += ` and e.entidade = ${par(q.entidade)}` }
      if (q.entidadeId) { if (!ID_PESSOA.test(q.entidadeId)) throw invalido('Registro inválido.'); where += ` and e.entidade_id = ${par(q.entidadeId)}` }

      const csv = q.formato === 'csv'
      const { pagina, por, offset } = csv ? { pagina: 1, por: 5000, offset: 0 } : paginacao(q, 50, 200)
      const total = (await db.query(`select count(*)::int as n from aud_eventos e where ${where}`, ps)).rows[0].n as number
      const rows = (await db.query(`select e.id, e.em, e.colaborador_id, e.entidade, e.entidade_id, e.acao from aud_eventos e where ${where} order by e.em desc, e.id desc limit ${por} offset ${offset}`, ps)).rows

      // Rótulos dos registros: vaga e candidato (nome cadastral, não o conteúdo acessado); documento/nota pela identificação.
      const ids = (ent: string) => [...new Set(rows.filter((r) => r.entidade === ent && r.entidade_id).map((r) => String(r.entidade_id)))]
      const rotulos = new Map<string, string>()
      const idsCand = ids('candidatura').filter((x) => /^[0-9a-f-]{36}$/i.test(x))
      if (idsCand.length) for (const r of (await db.query(
        `select c.id, k.nome, v.codigo from rec_candidaturas c join rec_candidatos k on k.id = c.candidato_id join rec_vagas v on v.id = c.vaga_id where c.id = any($1::uuid[])`, [idsCand])).rows) rotulos.set(`candidatura:${r.id}`, `${r.nome} · ${r.codigo}`)
      const idsDoc = ids('documento').filter((x) => /^[0-9a-f-]{36}$/i.test(x))
      if (idsDoc.length) for (const r of (await db.query('select id, titulo, categoria from doc_documentos where id = any($1::uuid[])', [idsDoc])).rows) rotulos.set(`documento:${r.id}`, `${r.titulo} (${r.categoria})`)
      const idsNf = ids('nota_fiscal').filter((x) => /^[0-9a-f-]{36}$/i.test(x))
      if (idsNf.length) for (const r of (await db.query('select id, numero, competencia from fin_notas where id = any($1::uuid[])', [idsNf])).rows) rotulos.set(`nota_fiscal:${r.id}`, `NF ${r.numero} · ${r.competencia}`)
      const gente = new Map((await pessoas(db)).map((p) => [p.id, p.nomeSocial || p.nome]))

      const itens = rows.map((r) => {
        const t = tipoAcessoDoEvento(r.entidade, r.acao)
        return {
          id: Number(r.id), em: r.em instanceof Date ? r.em.toISOString() : String(r.em),
          colaboradorId: r.colaborador_id, colaboradorNome: r.colaborador_id ? gente.get(r.colaborador_id) ?? 'Pessoa removida' : 'Sistema',
          tipo: t?.chave ?? r.acao, tipoRotulo: t?.rotulo ?? r.acao,
          entidade: r.entidade, entidadeRotulo: ROTULO_ENTIDADE_SENSIVEL[r.entidade] ?? r.entidade, entidadeId: r.entidade_id,
          registro: r.entidade_id ? rotulos.get(`${r.entidade}:${r.entidade_id}`) ?? (r.entidade_id ? 'Registro removido' : '—') : 'Vários registros',
        }
      })

      if (csv) {
        await auditar(db, usuario.colaboradorId, 'auditoria', null, 'relatorio_sensiveis_exportado', { linhas: itens.length, de, ate })
        const linhas = [linhaCsv(['Data e hora (UTC)', 'Quem acessou', 'Tipo de acesso', 'Entidade', 'Registro', 'ID do registro']),
          ...itens.map((i) => linhaCsv([i.em, i.colaboradorNome, i.tipoRotulo, i.entidadeRotulo, i.registro, i.entidadeId ?? '']))]
        return { status: 200, binario: { mime: 'text/csv; charset=utf-8', nome: 'acessos-sensiveis.csv', dados: Buffer.from('﻿' + linhas.join('\r\n'), 'utf8') } }
      }
      return ok({
        itens, total, pagina, por,
        tipos: ACESSOS_SENSIVEIS.map((t) => ({ chave: t.chave, rotulo: t.rotulo })),
        entidades: Object.entries(ROTULO_ENTIDADE_SENSIVEL).map(([chave, rotulo]) => ({ chave, rotulo })),
      })
    },
  },
]
