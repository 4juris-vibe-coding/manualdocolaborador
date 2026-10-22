/* ============================================================
   API v2 · Gestão de prestadores PJ · contratos-base
   Toda pessoa ativa que presta serviço precisa de um contrato
   vigente para enviar a nota do mês e aparecer no kanban. Esta
   rotina cria, para quem ainda não tem:
   - o fornecedor (CPF do autônomo, CNPJ do PJ/MEI), se faltar;
   - um contrato mensal vigente, por prazo indeterminado, com o
     valor "a definir" (R$ 0). O valor é definido depois, uma vez,
     sem aditivo (e não gera divergência enquanto estiver em 0).
   Idempotente: quem já tem contrato (não encerrado) é mantido.
   ============================================================ */
import { auditar, ok, type Executor, type Rota } from '../../nucleo.js'
import { espelharContrato, hoje, mapaPessoas, type Linha } from './comum.js'

/** Conta técnica da administração (src/lib/mock.ts ADMIN_ID): não presta serviço. */
const ADMIN_ID = 'c1'
const soDigitos = (v: unknown) => String(v ?? '').replace(/\D/g, '')

export interface PlanoBase { pessoaId: string; nome: string; fornecedorId: string | null; criarFornecedor: boolean; documento: string | null }

/** Pessoas ativas sem contrato (não encerrado). Quem não tem fornecedor nem CPF/CNPJ válido fica em `semDocumento`. */
export async function planoContratosBase(ex: Executor): Promise<{ criar: PlanoBase[]; semDocumento: { pessoaId: string; nome: string }[] }> {
  const gente = await mapaPessoas(ex)
  const forn = new Map<string, string>((await ex.query('select id, representante_id from fin_fornecedores where representante_id is not null order by criado_em, id')).rows
    .reverse().map((r) => [r.representante_id, r.id]))
  const comContrato = new Set<string>((await ex.query(`select coalesce(k.prestador_id, f.representante_id) as p from fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id
    where k.status <> 'encerrado'`)).rows.map((r) => r.p))
  const docsUsados = new Set<string>((await ex.query("select documento from fin_fornecedores where documento is not null and documento <> ''")).rows.map((r) => r.documento))
  const criar: PlanoBase[] = [], semDocumento: { pessoaId: string; nome: string }[] = []
  for (const p of gente.values() as Iterable<Linha>) {
    if (p.status === 'encerrado' || p.id === ADMIN_ID || comContrato.has(p.id)) continue
    const fornecedorId = forn.get(p.id) ?? null
    if (fornecedorId) { criar.push({ pessoaId: p.id, nome: p.nome, fornecedorId, criarFornecedor: false, documento: null }); continue }
    const doc = soDigitos(p.regime === 'autonomo' ? p.cpf : (p.cnpj || p.cpf))
    if ((doc.length === 11 || doc.length === 14) && !docsUsados.has(doc)) {
      docsUsados.add(doc)
      criar.push({ pessoaId: p.id, nome: p.nome, fornecedorId: null, criarFornecedor: true, documento: doc })
    } else semDocumento.push({ pessoaId: p.id, nome: p.nome })
  }
  return { criar, semDocumento }
}

export async function gerarContratosBase(ex: Executor, quem: string, agora: Date) {
  const { criar, semDocumento } = await planoContratosBase(ex)
  const gente = await mapaPessoas(ex)
  const ano = hoje(agora).slice(0, 4)
  let seq = Number((await ex.query(`select coalesce(max(substring(numero from '^PS-${ano}-(\\d+)$')::int), 0) as n from fin_contratos`)).rows[0].n)
  let fornecedores = 0
  for (const c of criar) {
    const p = gente.get(c.pessoaId)!
    let fornecedorId = c.fornecedorId
    if (c.criarFornecedor) {
      const tipo = p.regime === 'MEI' ? 'mei' : p.regime === 'autonomo' ? 'pf' : 'pj'
      fornecedorId = (await ex.query(`insert into fin_fornecedores (id, tipo, razao_social, documento, regime_tributario, municipio, uf, email, telefone, representante_id, criado_por)
        values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
        [`forn-${p.id}`, tipo, String(p.razaoSocial || '').trim() || p.nome, c.documento, tipo === 'mei' ? 'mei' : tipo === 'pf' ? 'pessoa_fisica' : 'nao_informado',
          p.cidade || null, p.uf || null, p.email || null, p.telefone || p.celular || null, p.id, quem])).rows[0].id
      await auditar(ex, quem, 'fornecedor', fornecedorId, 'criado', { origem: 'contratos_base' })
      fornecedores++
    }
    const entrada = /^\d{4}-\d{2}-\d{2}/.test(String(p.dataEntrada ?? '')) ? String(p.dataEntrada).slice(0, 7) : hoje(agora).slice(0, 7)
    const numero = `PS-${ano}-${String(++seq).padStart(3, '0')}`
    const id = (await ex.query(`insert into fin_contratos (numero, fornecedor_id, prestador_id, gestor_id, setor_id, objeto, modelo_remuneracao, valor, periodicidade_faturamento,
        tipo_prazo, inicio, renovacao, observacoes, status, criado_por)
      values ($1,$2,$3,$4,$5,'Prestação de serviços','mensal_fixo',0,'mensal','indeterminado',$6,'manual',$7,'vigente',$8) returning id`,
      [numero, fornecedorId, p.id, p.responsavelId || null, p.setorId || null, `${entrada}-01`,
        'Contrato-base criado automaticamente para habilitar o envio mensal da nota fiscal. Complete o valor mensal, o objeto e a data de assinatura.', quem])).rows[0].id
    await auditar(ex, quem, 'contrato', id, 'criado', { origem: 'contratos_base', numero })
    await espelharContrato(ex, id)
  }
  return { contratos: criar.length, fornecedores, semDocumento }
}

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'financeiro/contratos-base', cap: 'fin:ver',
    h: async ({ db }) => {
      const { criar, semDocumento } = await planoContratosBase(db)
      return ok({ pessoas: criar.map((c) => ({ pessoaId: c.pessoaId, nome: c.nome, criarFornecedor: c.criarFornecedor })), semDocumento })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos-base', cap: 'fin:cadastrar',
    h: async ({ db, usuario, agora }) => ok(await db.tx((t) => gerarContratosBase(t, usuario.colaboradorId, agora))),
  },
]
