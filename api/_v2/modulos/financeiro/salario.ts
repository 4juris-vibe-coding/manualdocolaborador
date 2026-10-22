/* ============================================================
   API v2 · Salário da pessoa × valor padrão da função
   ------------------------------------------------------------
   - A função (app_cargos.valorPadrao) guarda UM valor de
     referência — não é faixa nem piso.
   - O salário oficial de cada pessoa é o valor do contrato
     mensal dela (fin_contratos.valor). Pessoas com a mesma
     função podem ter valores diferentes.
   - Contrato com valor "a definir" (0) recebe o padrão da função
     automaticamente: ao criar o contrato-base, quando a pessoa
     ganha a função ou quando a função ganha um padrão.
   - Valor já definido nunca é trocado pelo padrão. Ajuste é
     feito na ficha da pessoa e fica no histórico (aditivo).
   ============================================================ */
import { auditar, conflito, dataISO, invalido, naoEncontrado, ok, texto, type Executor, type Rota } from '../../nucleo.js'
import { dinheiro, dstr, espelharContrato, hoje, idTexto, mapaPessoas, nomeDe, num, type Linha } from './comum.js'

/** Valor padrão da função (0 quando não definido). */
export async function valorPadraoDaFuncao(ex: Executor, cargoId: string | null | undefined): Promise<number> {
  if (!cargoId) return 0
  const v = Number((await ex.query("select dados->>'valorPadrao' as v from app_cargos where id = $1", [cargoId])).rows[0]?.v ?? 0)
  return Number.isFinite(v) && v > 0 ? v : 0
}

/** Contratos mensais não encerrados de uma pessoa (prestador direto ou representante do fornecedor). */
async function contratosMensais(ex: Executor, pessoaId: string, travar = false): Promise<Linha[]> {
  return (await ex.query(`select k.* from fin_contratos k left join fin_fornecedores f on f.id = k.fornecedor_id
    where coalesce(k.prestador_id, f.representante_id) = $1 and k.status <> 'encerrado' and k.modelo_remuneracao = 'mensal_fixo'
    order by k.inicio desc, k.criado_em desc ${travar ? 'for update of k' : ''}`, [pessoaId])).rows
}

/**
 * Aplica o padrão da função a quem está com valor "a definir" (0). Nunca altera valor já definido.
 * `pessoas` limita às pessoas indicadas; `cargos` limita a quem exerce as funções indicadas.
 */
export async function aplicarPadraoAosIndefinidos(ex: Executor, quem: string, filtro: { pessoas?: string[]; cargos?: string[] }): Promise<number> {
  if (!filtro.pessoas?.length && !filtro.cargos?.length) return 0
  const r = await ex.query(`select k.id, c.dados->>'cargoId' as cargo, c.id as pessoa from fin_contratos k
      left join fin_fornecedores f on f.id = k.fornecedor_id
      join app_colaboradores c on c.id = coalesce(k.prestador_id, f.representante_id)
    where k.valor = 0 and k.status <> 'encerrado' and k.modelo_remuneracao = 'mensal_fixo' and coalesce(c.dados->>'status', '') <> 'encerrado'
      and (c.id = any($1::text[]) or c.dados->>'cargoId' = any($2::text[]))
    for update of k`, [filtro.pessoas ?? [], filtro.cargos ?? []])
  let n = 0
  for (const k of r.rows) {
    const padrao = await valorPadraoDaFuncao(ex, k.cargo)
    if (!padrao) continue
    await ex.query('update fin_contratos set valor = $2, atualizado_em = now(), versao = versao + 1 where id = $1 and valor = 0', [k.id, padrao])
    await auditar(ex, quem, 'contrato', k.id, 'valor_padrao_aplicado', { cargoId: k.cargo, valorNovo: padrao })
    await espelharContrato(ex, k.id)
    n++
  }
  return n
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'pessoas/:id/salario', cap: 'pessoas:ver_contratos',
    h: async ({ db, params }) => {
      const id = idTexto(params.id)
      const gente = await mapaPessoas(db)
      const p = gente.get(id)
      if (!p) throw naoEncontrado('Pessoa não encontrada.')
      const cargo = p.cargoId ? (await db.query("select dados->>'nome' as nome from app_cargos where id = $1", [p.cargoId])).rows[0] : null
      const contratos = await contratosMensais(db, id)
      const k = contratos[0]
      const historico = k ? (await db.query(`select numero, vigencia_inicio::text as vig, valor_anterior, valor_novo, descricao, criado_por, criado_em from fin_aditivos
        where contrato_id = $1 and valor_novo is not null order by numero desc`, [k.id])).rows : []
      return ok({
        cargo: p.cargoId ? { id: p.cargoId, nome: cargo?.nome ?? null, valorPadrao: (await valorPadraoDaFuncao(db, p.cargoId)) || null } : null,
        contrato: k ? { id: k.id, numero: k.numero, valor: num(k.valor), inicio: dstr(k.inicio), status: k.status } : null,
        outrosContratos: Math.max(0, contratos.length - 1),
        historico: historico.map((a) => ({ numero: a.numero, vigenciaInicio: a.vig, valorAnterior: num(a.valor_anterior), valorNovo: num(a.valor_novo), motivo: a.descricao, por: nomeDe(gente, a.criado_por), em: a.criado_em })),
      })
    },
  },
  {
    // Ajuste do salário de UMA pessoa. Primeira definição (valor 0) grava direto; depois, vira aditivo de valor (histórico).
    metodo: 'POST', padrao: 'pessoas/:id/salario', cap: 'fin:cadastrar',
    h: async ({ db, params, req, usuario, agora }) => {
      const id = idTexto(params.id)
      const b = req.corpo ?? {}
      const valor = dinheiro(b.valor, 'salário')
      const vigencia = dataISO(b.vigenciaInicio ?? hoje(agora), 'a partir de', true)!
      const motivo = texto(b.motivo, 'motivo', { obrigatorio: false, max: 1000 }) || null
      return ok(await db.tx(async (t) => {
        const contratos = await contratosMensais(t, id, true)
        if (!contratos.length) throw conflito('Esta pessoa não tem contrato mensal em vigor. Gere o contrato-base em Financeiro › Kanban ou cadastre um contrato.')
        if (contratos.length > 1) throw conflito('Esta pessoa tem mais de um contrato mensal em vigor. Ajuste o valor pelo contrato certo, em Financeiro › Contratos.')
        const k = contratos[0]
        if (Number(k.valor) === valor) return { contratoId: k.id, alterado: false }
        if (Number(k.valor) === 0 || k.status === 'rascunho') {
          await t.query('update fin_contratos set valor = $2, atualizado_em = now(), versao = versao + 1 where id = $1', [k.id, valor])
          await auditar(t, usuario.colaboradorId, 'contrato', k.id, 'valor_definido', { valorAnterior: Number(k.valor), valorNovo: valor, origem: 'ficha_da_pessoa' })
        } else {
          if (!motivo || motivo.length < 5) throw invalido('Informe o motivo do ajuste (fica no histórico).', { motivo: 'Obrigatório' })
          if (vigencia < dstr(k.inicio)!) throw invalido('O ajuste não pode valer antes do início do contrato.', { vigenciaInicio: 'Antes do início' })
          const numero = (await t.query('select coalesce(max(numero), 0) + 1 as n from fin_aditivos where contrato_id = $1', [k.id])).rows[0].n
          await t.query(`insert into fin_aditivos (contrato_id, numero, tipo, descricao, vigencia_inicio, valor_anterior, valor_novo, criado_por)
            values ($1,$2,'valor',$3,$4,$5,$6,$7)`, [k.id, numero, motivo, vigencia, k.valor, valor, usuario.colaboradorId])
          await t.query('update fin_contratos set valor = $2, atualizado_em = now(), versao = versao + 1 where id = $1', [k.id, valor])
          await auditar(t, usuario.colaboradorId, 'contrato', k.id, 'aditivo', { numero, tipo: 'valor', valorAnterior: Number(k.valor), valorNovo: valor, origem: 'ficha_da_pessoa' })
        }
        await espelharContrato(t, k.id)
        return { contratoId: k.id, alterado: true }
      }))
    },
  },
]
