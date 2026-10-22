/* ============================================================
   API v2 · Gestão de prestadores PJ · cadastros
   Configuração, centros de custo, fornecedores, regras de retenção,
   contratos (aditivos, ativação, suspensão, encerramento comercial)
   e o repositório de documentos com arquivo.
   Encerramento de contrato é COMERCIAL: não há verbas rescisórias.
   ============================================================ */
import {
  auditar, conflito, dataISO, email, enumerado, inteiro, invalido, naoEncontrado, notificar, ok, paginacao, pessoaPorId, proibido, tem, texto,
  type Executor, type Rota, type Usuario,
} from '../../nucleo.js'
import { baixarArquivo } from '../../arquivos.js'
import {
  CATEGORIAS_DOCUMENTO, MODELOS_REMUNERACAO, PERIODICIDADES, REGIMES_TRIBUTARIOS, TIPOS_ENCERRAMENTO, TIPOS_FORNECEDOR, TIPOS_RETENCAO,
  cnpjValido, cpfValido, situacaoPrazo, soDigitos, type CategoriaDocumento,
} from '../../../../src/domain/v2/financeiro.js'
import {
  contratoOu404, dinheiro, dstr, espelharContrato, espelharDocumento, exigirAcessoContrato, exigirNaoProprio, escopoContrato, hoje, idTexto,
  lerConfig, mapaPessoas, meusFornecedores, nomeDe, notificarCap, num, podeVerDocumento, registrarDocumento, titularDoc, uuid, uuidOuNulo, type Linha,
} from './comum.js'

/* ---------- serializadores ---------- */
export function fornecedorJson(f: Linha, pessoas: Map<string, Linha>, verPagamento: boolean) {
  const base = {
    id: f.id, tipo: f.tipo, razaoSocial: f.razao_social, nomeFantasia: f.nome_fantasia, documento: f.documento, inscricaoMunicipal: f.inscricao_municipal,
    regimeTributario: f.regime_tributario, municipio: f.municipio, uf: f.uf, email: f.email, telefone: f.telefone,
    representanteId: f.representante_id, representanteNome: nomeDe(pessoas, f.representante_id), status: f.status, observacoes: f.observacoes,
    criadoEm: f.criado_em, atualizadoEm: f.atualizado_em, versao: f.versao,
  }
  if (!verPagamento) return base
  return { ...base, pagamento: dadosPagamento(f, pessoas) }
}
/** Destino do pagamento: dados da empresa; se vazios, os do perfil da pessoa representante. */
export function dadosPagamento(f: Linha, pessoas: Map<string, Linha>) {
  if (f.pix_chave || f.conta) return { origem: 'fornecedor', banco: f.banco, agencia: f.agencia, conta: f.conta, pixTipo: f.pix_tipo, pixChave: f.pix_chave }
  const p = f.representante_id ? pessoas.get(f.representante_id) : undefined
  if (p && (p.pixChave || p.conta)) return { origem: 'representante', banco: p.banco ?? null, agencia: p.agencia ?? null, conta: p.conta ?? null, pixTipo: p.pixTipo ?? null, pixChave: p.pixChave ?? null }
  return { origem: 'ausente', banco: null, agencia: null, conta: null, pixTipo: null, pixChave: null }
}

const SEL_CONTRATO = `k.*, k.inicio::text as inicio_t, k.fim::text as fim_t, k.data_assinatura::text as assinatura_t, k.encerrado_em::text as encerrado_t,
  f.razao_social as fornecedor_nome, f.documento as fornecedor_documento, cc.nome as centro_nome, cc.codigo as centro_codigo`
const FROM_CONTRATO = `fin_contratos k join fin_fornecedores f on f.id = k.fornecedor_id left join fin_centros_custo cc on cc.id = k.centro_custo_id`

export function contratoJson(k: Linha, pessoas: Map<string, Linha>, hojeStr: string, setores?: Map<string, string>) {
  return {
    id: k.id, numero: k.numero, fornecedorId: k.fornecedor_id, fornecedorNome: k.fornecedor_nome, fornecedorDocumento: k.fornecedor_documento,
    prestadorId: k.prestador_id, prestadorNome: nomeDe(pessoas, k.prestador_id), gestorId: k.gestor_id, gestorNome: nomeDe(pessoas, k.gestor_id),
    setorId: k.setor_id, setorNome: k.setor_id ? setores?.get(k.setor_id) ?? null : null, centroCustoId: k.centro_custo_id, centroCustoNome: k.centro_nome ? `${k.centro_codigo} · ${k.centro_nome}` : null,
    objeto: k.objeto, escopo: k.escopo, modeloRemuneracao: k.modelo_remuneracao, valor: num(k.valor), periodicidadeFaturamento: k.periodicidade_faturamento,
    prazoPagamentoDias: k.prazo_pagamento_dias, tipoPrazo: k.tipo_prazo, dataAssinatura: k.assinatura_t, inicio: k.inicio_t, fim: k.fim_t,
    renovacao: k.renovacao, renovacaoMeses: k.renovacao_meses, avisoRenovacaoDias: k.aviso_renovacao_dias,
    obrigacoesContratada: k.obrigacoes_contratada, obrigacoesContratante: k.obrigacoes_contratante, observacoes: k.observacoes,
    status: k.status, situacaoPrazo: situacaoPrazo({ status: k.status, fim: k.fim_t, avisoRenovacaoDias: k.aviso_renovacao_dias }, hojeStr),
    encerradoEm: k.encerrado_t, encerramentoTipo: k.encerramento_tipo, encerramentoMotivo: k.encerramento_motivo,
    criadoEm: k.criado_em, atualizadoEm: k.atualizado_em, versao: k.versao,
  }
}

export function documentoJson(d: Linha, pessoas: Map<string, Linha>) {
  return {
    id: d.id, categoria: d.categoria, titulo: d.titulo, pessoaId: d.pessoa_id, pessoaNome: nomeDe(pessoas, d.pessoa_id), fornecedorId: d.fornecedor_id,
    fornecedorNome: d.fornecedor_nome ?? null, contratoId: d.contrato_id, contratoNumero: d.contrato_numero ?? null, emitidoEm: dstr(d.emitido_t ?? d.emitido_em),
    validade: dstr(d.validade_t ?? d.validade), status: d.status, conferidoPor: nomeDe(pessoas, d.conferido_por), conferidoEm: d.conferido_em, motivoRejeicao: d.motivo_rejeicao,
    substituiId: d.substitui_id, temArquivo: !!d.arquivo_id, tamanho: d.tamanho, legado: d.legado, enviadoPor: nomeDe(pessoas, d.enviado_por), enviadoPorId: d.enviado_por, criadoEm: d.criado_em,
  }
}

async function setoresMapa(ex: Executor) {
  return new Map((await ex.query('select id, dados->>\'nome\' as nome from app_setores')).rows.map((r) => [r.id as string, r.nome as string]))
}

/* ---------- leitura do corpo ---------- */
async function lerFornecedor(ex: Executor, b: Linha, atualId?: string) {
  const tipo = enumerado(b.tipo, 'tipo', TIPOS_FORNECEDOR, 'pj')
  const documento = b.documento ? soDigitos(String(b.documento)) : ''
  if (documento) {
    if (tipo === 'pf' ? !cpfValido(documento) : !cnpjValido(documento)) throw invalido(tipo === 'pf' ? 'CPF inválido.' : 'CNPJ inválido.', { documento: 'Documento inválido' })
    const dup = (await ex.query('select id, razao_social from fin_fornecedores where documento = $1 and id <> coalesce($2, \'\')', [documento, atualId ?? null])).rows[0]
    if (dup) throw conflito(`Já existe fornecedor com este documento (${dup.razao_social}).`)
  }
  const representanteId = b.representanteId ? String(b.representanteId) : null
  if (representanteId && !(await pessoaPorId(ex, representanteId))) throw invalido('Pessoa representante não encontrada.', { representanteId: 'Não encontrada' })
  return {
    tipo, razao_social: texto(b.razaoSocial, 'razão social', { min: 2, max: 200 }), nome_fantasia: texto(b.nomeFantasia, 'nome fantasia', { obrigatorio: false, max: 200 }) || null,
    documento: documento || null, inscricao_municipal: texto(b.inscricaoMunicipal, 'inscrição municipal', { obrigatorio: false, max: 40 }) || null,
    regime_tributario: enumerado(b.regimeTributario, 'regime tributário', REGIMES_TRIBUTARIOS, 'nao_informado'),
    municipio: texto(b.municipio, 'município', { obrigatorio: false, max: 100 }) || null, uf: texto(b.uf, 'UF', { obrigatorio: false, max: 2 }).toUpperCase() || null,
    email: b.email ? email(b.email) : null, telefone: texto(b.telefone, 'telefone', { obrigatorio: false, max: 30 }) || null, representante_id: representanteId,
    banco: texto(b.banco, 'banco', { obrigatorio: false, max: 60 }) || null, agencia: texto(b.agencia, 'agência', { obrigatorio: false, max: 20 }) || null,
    conta: texto(b.conta, 'conta', { obrigatorio: false, max: 30 }) || null, pix_tipo: texto(b.pixTipo, 'tipo de chave PIX', { obrigatorio: false, max: 20 }) || null,
    pix_chave: texto(b.pixChave, 'chave PIX', { obrigatorio: false, max: 120 }) || null,
    status: enumerado(b.status, 'situação', ['ativo', 'suspenso', 'inativo'] as const, 'ativo'),
    observacoes: texto(b.observacoes, 'observações', { obrigatorio: false, max: 2000 }) || null,
  }
}

async function lerContrato(ex: Executor, b: Linha) {
  const fornecedorId = idTexto(b.fornecedorId, 'fornecedorId')
  const f = (await ex.query('select id, status, representante_id from fin_fornecedores where id = $1', [fornecedorId])).rows[0]
  if (!f) throw invalido('Fornecedor não encontrado.', { fornecedorId: 'Não encontrado' })
  if (f.status === 'inativo') throw invalido('Fornecedor inativo.', { fornecedorId: 'Inativo' })
  const prestadorId = b.prestadorId ? String(b.prestadorId) : f.representante_id ?? null
  if (prestadorId && !(await pessoaPorId(ex, prestadorId))) throw invalido('Pessoa prestadora não encontrada.', { prestadorId: 'Não encontrada' })
  const gestorId = b.gestorId ? String(b.gestorId) : null
  if (gestorId) {
    if (!(await pessoaPorId(ex, gestorId))) throw invalido('Gestor(a) não encontrado(a).', { gestorId: 'Não encontrado' })
    if (gestorId === prestadorId) throw invalido('Quem presta o serviço não pode ser o gestor do próprio contrato.', { gestorId: 'Mesma pessoa do prestador' })
  }
  const setorId = b.setorId ? String(b.setorId) : null
  if (setorId && !(await ex.query('select 1 from app_setores where id = $1', [setorId])).rowCount) throw invalido('Área não encontrada.', { setorId: 'Não encontrada' })
  const centro = uuidOuNulo(b.centroCustoId, 'centroCustoId')
  if (centro && !(await ex.query('select 1 from fin_centros_custo where id = $1 and ativo', [centro])).rowCount) throw invalido('Centro de custo inválido.', { centroCustoId: 'Inválido' })
  const tipoPrazo = enumerado(b.tipoPrazo, 'tipo de prazo', ['determinado', 'indeterminado'] as const, 'determinado')
  const inicio = dataISO(b.inicio, 'início da vigência', true)!
  const fim = dataISO(b.fim, 'término')
  if (tipoPrazo === 'determinado' && !fim) throw invalido('Informe o término (prazo determinado).', { fim: 'Obrigatório' })
  if (fim && fim < inicio) throw invalido('O término deve ser posterior ao início.', { fim: 'Antes do início' })
  const assinatura = dataISO(b.dataAssinatura, 'data de assinatura')
  return {
    numero: texto(b.numero, 'número do contrato', { max: 60 }), fornecedor_id: fornecedorId, prestador_id: prestadorId, gestor_id: gestorId, setor_id: setorId,
    centro_custo_id: centro, objeto: texto(b.objeto, 'objeto', { min: 3, max: 2000 }), escopo: texto(b.escopo, 'escopo', { obrigatorio: false, max: 8000 }) || null,
    modelo_remuneracao: enumerado(b.modeloRemuneracao, 'modelo de remuneração', MODELOS_REMUNERACAO, 'mensal_fixo'),
    valor: dinheiro(b.valor, 'valor', { positivo: false }),
    periodicidade_faturamento: enumerado(b.periodicidadeFaturamento, 'periodicidade', PERIODICIDADES, 'mensal'),
    prazo_pagamento_dias: b.prazoPagamentoDias === undefined || b.prazoPagamentoDias === null || b.prazoPagamentoDias === '' ? null : inteiro(b.prazoPagamentoDias, 'prazo de pagamento', { min: 0, max: 120 }),
    tipo_prazo: tipoPrazo, data_assinatura: assinatura, inicio, fim: tipoPrazo === 'indeterminado' ? null : fim,
    renovacao: enumerado(b.renovacao, 'renovação', ['automatica', 'manual', 'nao_renova'] as const, 'manual'),
    renovacao_meses: inteiro(b.renovacaoMeses, 'meses de renovação', { min: 1, max: 60, padrao: 12 }),
    aviso_renovacao_dias: inteiro(b.avisoRenovacaoDias, 'aviso de renovação', { min: 0, max: 365, padrao: 30 }),
    obrigacoes_contratada: texto(b.obrigacoesContratada, 'obrigações da contratada', { obrigatorio: false, max: 8000 }) || null,
    obrigacoes_contratante: texto(b.obrigacoesContratante, 'obrigações da contratante', { obrigatorio: false, max: 8000 }) || null,
    observacoes: texto(b.observacoes, 'observações', { obrigatorio: false, max: 4000 }) || null,
  }
}

/** Pendências que impedem um encerramento "limpo" (o RH pode encerrar mesmo assim, confirmando). */
export async function pendenciasContrato(ex: Executor, contratoIds: string[]) {
  if (!contratoIds.length) return { notasEmAndamento: 0, contasAbertas: 0, valorAberto: 0, documentosPendentes: 0 }
  const n = (await ex.query("select count(*)::int as n from fin_notas where contrato_id = any($1::text[]) and status in ('recebida','conferida','devolvida')", [contratoIds])).rows[0].n
  const c = (await ex.query("select count(*)::int as n, coalesce(sum(valor_bruto - valor_retencoes), 0)::float8 as v from fin_contas where contrato_id = any($1::text[]) and status in ('prevista','autorizada')", [contratoIds])).rows[0]
  const d = (await ex.query("select count(*)::int as n from doc_documentos where contrato_id = any($1::text[]) and status = 'pendente'", [contratoIds])).rows[0].n
  return { notasEmAndamento: n, contasAbertas: c.n, valorAberto: c.v, documentosPendentes: d }
}

/** Compara valor do banco (Date, numeric em texto) com o do corpo. */
function difere(a: unknown, b: unknown): boolean {
  const n = (x: unknown) => (x instanceof Date ? dstr(x) : x === null || x === undefined || x === '' ? '' : typeof x === 'number' || /^-?\d+(\.\d+)?$/.test(String(x)) ? String(Number(x)) : String(x))
  return n(a) !== n(b)
}

async function proximoAditivo(ex: Executor, contratoId: string) {
  return (await ex.query('select coalesce(max(numero), 0) + 1 as n from fin_aditivos where contrato_id = $1', [contratoId])).rows[0].n as number
}

export const rotas: Rota[] = [
  /* ---------- opções e configuração ---------- */
  {
    metodo: 'GET', padrao: 'financeiro/opcoes',
    h: async ({ db, usuario }) => {
      const centros = (await db.query('select id, codigo, nome, setor_id, ativo from fin_centros_custo order by codigo')).rows
      const fin = tem(usuario, 'fin:ver')
      const fornecedores = fin
        ? (await db.query("select id, razao_social, documento, representante_id, status from fin_fornecedores order by razao_social")).rows
        : (await db.query('select id, razao_social, documento, representante_id, status from fin_fornecedores where representante_id = $1', [usuario.colaboradorId])).rows
      const gente = await mapaPessoas(db)
      return ok({
        centros: centros.map((c) => ({ id: c.id, codigo: c.codigo, nome: c.nome, setorId: c.setor_id, ativo: c.ativo })),
        fornecedores: fornecedores.map((f) => ({ id: f.id, razaoSocial: f.razao_social, documento: f.documento, representanteId: f.representante_id, status: f.status })),
        pessoas: fin ? [...gente.values()].filter((p) => p.status !== 'encerrado').map((p) => ({ id: p.id, nome: p.nome, setorId: p.setorId })).sort((a, b) => a.nome.localeCompare(b.nome)) : [],
        setores: fin ? [...(await setoresMapa(db))].map(([id, nome]) => ({ id, nome })) : [],
        config: await lerConfig(db),
        capacidades: {
          ver: fin, cadastrar: tem(usuario, 'fin:cadastrar'), conferir: tem(usuario, 'fin:conferir'), aprovar: tem(usuario, 'fin:aprovar'),
          pagar: tem(usuario, 'fin:pagar'), autorizar: tem(usuario, 'fin:autorizar'), config: tem(usuario, 'fin:config'),
        },
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'financeiro/config', cap: 'fin:config',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const v = {
        exigir_segregacao: b.exigirSegregacao !== false,
        dias_alerta_contrato: inteiro(b.diasAlertaContrato, 'dias de alerta de contrato', { min: 1, max: 365, padrao: 45 }),
        dias_alerta_pagamento: inteiro(b.diasAlertaPagamento, 'dias de alerta de pagamento', { min: 0, max: 60, padrao: 3 }),
        dias_alerta_documento: inteiro(b.diasAlertaDocumento, 'dias de alerta de documento', { min: 1, max: 365, padrao: 30 }),
        dias_alerta_aprovacao: inteiro(b.diasAlertaAprovacao, 'dias de alerta de aprovação', { min: 1, max: 60, padrao: 3 }),
        dia_limite_envio_nf: inteiro(b.diaLimiteEnvioNf, 'dia limite de envio da NF', { min: 1, max: 28, padrao: 22 }),
        prazo_pagamento_padrao_dias: inteiro(b.prazoPagamentoPadraoDias, 'prazo padrão de pagamento', { min: 0, max: 120, padrao: 10 }),
      }
      const antes = await lerConfig(db)
      await db.tx(async (t) => {
        await t.query(`update fin_config set exigir_segregacao = $1, dias_alerta_contrato = $2, dias_alerta_pagamento = $3, dias_alerta_documento = $4,
          dias_alerta_aprovacao = $5, dia_limite_envio_nf = $6, prazo_pagamento_padrao_dias = $7, atualizado_em = now(), atualizado_por = $8 where id`,
          [v.exigir_segregacao, v.dias_alerta_contrato, v.dias_alerta_pagamento, v.dias_alerta_documento, v.dias_alerta_aprovacao, v.dia_limite_envio_nf, v.prazo_pagamento_padrao_dias, usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'fin_config', null, 'alterada', { antes: { segregacao: antes.exigirSegregacao }, depois: { segregacao: v.exigir_segregacao } })
      })
      return ok({ config: await lerConfig(db) })
    },
  },

  /* ---------- centros de custo ---------- */
  {
    metodo: 'POST', padrao: 'financeiro/centros-custo', cap: 'fin:cadastrar',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const codigo = texto(b.codigo, 'código', { max: 30 })
      if ((await db.query('select 1 from fin_centros_custo where lower(codigo) = lower($1)', [codigo])).rowCount) throw conflito('Já existe um centro de custo com este código.')
      const r = await db.query('insert into fin_centros_custo (codigo, nome, setor_id) values ($1,$2,$3) returning id',
        [codigo, texto(b.nome, 'nome', { max: 120 }), b.setorId ? String(b.setorId) : null])
      await auditar(db, usuario.colaboradorId, 'centro_custo', r.rows[0].id, 'criado', { codigo })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'PUT', padrao: 'financeiro/centros-custo/:id', cap: 'fin:cadastrar',
    h: async ({ db, req, params, usuario }) => {
      const id = uuid(params.id)
      const b = req.corpo ?? {}
      const r = await db.query('update fin_centros_custo set nome = $2, setor_id = $3, ativo = $4 where id = $1',
        [id, texto(b.nome, 'nome', { max: 120 }), b.setorId ? String(b.setorId) : null, b.ativo !== false])
      if (!r.rowCount) throw naoEncontrado('Centro de custo não encontrado.')
      await auditar(db, usuario.colaboradorId, 'centro_custo', id, 'alterado', { ativo: b.ativo !== false })
      return ok()
    },
  },

  /* ---------- fornecedores ---------- */
  {
    metodo: 'GET', padrao: 'financeiro/fornecedores', cap: 'fin:ver',
    h: async ({ db, req, usuario }) => {
      const { pagina, por, offset } = paginacao(req.query, 25)
      const ps: unknown[] = []
      const w: string[] = ['true']
      if (req.query.q) { ps.push(`%${req.query.q.trim().toLowerCase()}%`, soDigitos(req.query.q)); w.push(`(lower(f.razao_social) like $${ps.length - 1} or lower(coalesce(f.nome_fantasia,'')) like $${ps.length - 1} or ($${ps.length} <> '' and f.documento like '%' || $${ps.length} || '%'))`) }
      if (req.query.status) { ps.push(req.query.status); w.push(`f.status = $${ps.length}`) }
      const where = w.join(' and ')
      const total = (await db.query(`select count(*)::int as n from fin_fornecedores f where ${where}`, ps)).rows[0].n
      const rows = (await db.query(`select f.*, (select count(*)::int from fin_contratos k where k.fornecedor_id = f.id and k.status = 'vigente') as ativos
        from fin_fornecedores f where ${where} order by f.razao_social limit ${por} offset ${offset}`, ps)).rows
      const gente = await mapaPessoas(db)
      const verPag = tem(usuario, 'fin:pagar') || tem(usuario, 'fin:cadastrar')
      return ok({ itens: rows.map((f) => ({ ...fornecedorJson(f, gente, false), contratosVigentes: f.ativos, semDadosPagamento: verPag ? dadosPagamento(f, gente).origem === 'ausente' : undefined })), total, pagina, por })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/fornecedores', cap: 'fin:cadastrar',
    h: async ({ db, req, usuario }) => {
      const v = await lerFornecedor(db, req.corpo ?? {})
      const cols = Object.keys(v)
      const r = await db.query(`insert into fin_fornecedores (${cols.join(',')}, criado_por) values (${cols.map((_, i) => `$${i + 1}`).join(',')}, $${cols.length + 1}) returning id`,
        [...Object.values(v), usuario.colaboradorId])
      await auditar(db, usuario.colaboradorId, 'fornecedor', r.rows[0].id, 'criado', { tipo: v.tipo })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/fornecedores/:id',
    h: async ({ db, params, usuario, agora }) => {
      const id = idTexto(params.id)
      const f = (await db.query('select * from fin_fornecedores where id = $1', [id])).rows[0]
      const meu = f?.representante_id === usuario.colaboradorId
      if (!f || (!tem(usuario, 'fin:ver') && !meu)) throw naoEncontrado('Fornecedor não encontrado.')
      const gente = await mapaPessoas(db)
      const verPag = meu || tem(usuario, 'fin:pagar') || tem(usuario, 'fin:cadastrar') || tem(usuario, 'fin:autorizar')
      const contratos = (await db.query(`select ${SEL_CONTRATO} from ${FROM_CONTRATO} where k.fornecedor_id = $1 order by k.inicio desc`, [id])).rows
      const regras = tem(usuario, 'fin:ver') ? (await db.query(`select id, tipo, aliquota, fundamento, vigencia_inicio::text as ini, vigencia_fim::text as fim, ativo, criado_por, criado_em
        from fin_regras_retencao where fornecedor_id = $1 order by ativo desc, vigencia_inicio desc`, [id])).rows : []
      const docs = (await db.query(`select d.*, d.emitido_em::text as emitido_t, d.validade::text as validade_t from doc_documentos d where d.fornecedor_id = $1 order by d.criado_em desc limit 100`, [id])).rows
      const h = hoje(agora)
      return ok({
        fornecedor: fornecedorJson(f, gente, verPag),
        contratos: contratos.map((k) => contratoJson(k, gente, h)),
        regrasRetencao: regras.map((r) => ({ id: r.id, tipo: r.tipo, aliquota: num(r.aliquota), fundamento: r.fundamento, vigenciaInicio: r.ini, vigenciaFim: r.fim, ativo: r.ativo, criadoPor: nomeDe(gente, r.criado_por), criadoEm: r.criado_em })),
        documentos: docs.map((d) => documentoJson(d, gente)),
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'financeiro/fornecedores/:id', cap: 'fin:cadastrar',
    h: async ({ db, req, params, usuario }) => {
      const id = idTexto(params.id)
      const versao = inteiro(req.corpo?.versao, 'versão', { min: 1, max: 1_000_000 })
      const v = await lerFornecedor(db, req.corpo ?? {}, id)
      const cols = Object.keys(v)
      const r = await db.query(`update fin_fornecedores set ${cols.map((c, i) => `${c} = $${i + 3}`).join(', ')}, atualizado_em = now(), versao = versao + 1
        where id = $1 and versao = $2 returning versao`, [id, versao, ...Object.values(v)])
      if (!r.rowCount) {
        if (!(await db.query('select 1 from fin_fornecedores where id = $1', [id])).rowCount) throw naoEncontrado('Fornecedor não encontrado.')
        throw conflito('Outra pessoa alterou este fornecedor. Recarregue para ver a versão atual.')
      }
      // Dados de pagamento: só registra que mudaram (sem os valores).
      await auditar(db, usuario.colaboradorId, 'fornecedor', id, 'alterado', { status: v.status })
      for (const k of (await db.query('select id from fin_contratos where fornecedor_id = $1', [id])).rows) await espelharContrato(db, k.id)
      return ok({ versao: r.rows[0].versao })
    },
  },

  /* ---------- regras de retenção (por fornecedor, com fundamento e vigência) ---------- */
  {
    metodo: 'POST', padrao: 'financeiro/fornecedores/:id/regras-retencao', cap: 'fin:pagar',
    h: async ({ db, req, params, usuario }) => {
      const id = idTexto(params.id)
      if (!(await db.query('select 1 from fin_fornecedores where id = $1', [id])).rowCount) throw naoEncontrado('Fornecedor não encontrado.')
      const b = req.corpo ?? {}
      const aliquota = Number(b.aliquota)
      if (!Number.isFinite(aliquota) || aliquota <= 0 || aliquota > 100 || Math.round(aliquota * 10000) !== aliquota * 10000) throw invalido('Alíquota inválida (0 a 100, até 4 casas).', { aliquota: 'Inválida' })
      const ini = dataISO(b.vigenciaInicio, 'início da vigência', true)!
      const fim = dataISO(b.vigenciaFim, 'fim da vigência')
      if (fim && fim < ini) throw invalido('Fim da vigência anterior ao início.', { vigenciaFim: 'Anterior ao início' })
      const r = await db.query(`insert into fin_regras_retencao (fornecedor_id, tipo, aliquota, fundamento, vigencia_inicio, vigencia_fim, criado_por)
        values ($1,$2,$3,$4,$5,$6,$7) returning id`, [id, enumerado(b.tipo, 'tipo', TIPOS_RETENCAO), aliquota, texto(b.fundamento, 'fundamento', { min: 5, max: 1000 }), ini, fim, usuario.colaboradorId])
      await auditar(db, usuario.colaboradorId, 'regra_retencao', r.rows[0].id, 'criada', { fornecedorId: id, tipo: b.tipo, aliquota })
      return ok({ id: r.rows[0].id }, 201)
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/regras-retencao/:id/desativar', cap: 'fin:pagar',
    h: async ({ db, params, usuario }) => {
      const id = uuid(params.id)
      const r = await db.query('update fin_regras_retencao set ativo = false where id = $1 and ativo', [id])
      if (!r.rowCount) throw naoEncontrado('Regra não encontrada ou já desativada.')
      await auditar(db, usuario.colaboradorId, 'regra_retencao', id, 'desativada')
      return ok()
    },
  },

  /* ---------- contratos ---------- */
  {
    metodo: 'GET', padrao: 'financeiro/contratos',
    h: async ({ db, req, usuario, agora }) => {
      const { pagina, por, offset } = paginacao(req.query, 25)
      const esc = escopoContrato(usuario, 'k', 1)
      const ps: unknown[] = [...esc.params]
      const w: string[] = [esc.sql]
      const h = hoje(agora)
      if (req.query.status) { ps.push(req.query.status.split(',')); w.push(`k.status = any($${ps.length}::text[])`) }
      if (req.query.fornecedor) { ps.push(req.query.fornecedor); w.push(`k.fornecedor_id = $${ps.length}`) }
      if (req.query.prestador) { ps.push(req.query.prestador); w.push(`k.prestador_id = $${ps.length}`) }
      if (req.query.setor) { ps.push(req.query.setor); w.push(`k.setor_id = $${ps.length}`) }
      if (req.query.centro && /^[0-9a-f-]{36}$/i.test(req.query.centro)) { ps.push(req.query.centro); w.push(`k.centro_custo_id = $${ps.length}`) }
      if (req.query.q) { ps.push(`%${req.query.q.trim().toLowerCase()}%`); w.push(`(lower(k.numero) like $${ps.length} or lower(k.objeto) like $${ps.length} or lower(f.razao_social) like $${ps.length})`) }
      if (req.query.prazo === 'a_vencer') { ps.push(h, Number(req.query.dias) || 60); w.push(`k.status in ('vigente','suspenso') and k.fim between $${ps.length - 1}::date and $${ps.length - 1}::date + $${ps.length}::int`) }
      if (req.query.prazo === 'vencido') { ps.push(h); w.push(`k.status in ('vigente','suspenso') and k.fim < $${ps.length}::date`) }
      const where = w.join(' and ')
      const total = (await db.query(`select count(*)::int as n from ${FROM_CONTRATO} where ${where}`, ps)).rows[0].n
      const ordem = req.query.ordem === 'fim' ? 'k.fim asc nulls last' : req.query.ordem === 'valor' ? 'k.valor desc' : 'k.atualizado_em desc'
      const rows = (await db.query(`select ${SEL_CONTRATO} from ${FROM_CONTRATO} where ${where} order by ${ordem} limit ${por} offset ${offset}`, ps)).rows
      const gente = await mapaPessoas(db)
      const setores = await setoresMapa(db)
      return ok({ itens: rows.map((k) => contratoJson(k, gente, h, setores)), total, pagina, por })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos', cap: 'fin:cadastrar',
    h: async ({ db, req, usuario }) => {
      const v = await lerContrato(db, req.corpo ?? {})
      if ((await db.query('select 1 from fin_contratos where lower(numero) = lower($1)', [v.numero])).rowCount) throw conflito('Já existe contrato com este número.')
      const id = await db.tx(async (t) => {
        const cols = Object.keys(v)
        const r = await t.query(`insert into fin_contratos (${cols.join(',')}, criado_por) values (${cols.map((_, i) => `$${i + 1}`).join(',')}, $${cols.length + 1}) returning id`,
          [...Object.values(v), usuario.colaboradorId])
        await auditar(t, usuario.colaboradorId, 'contrato', r.rows[0].id, 'criado', { numero: v.numero, valor: v.valor, inicio: v.inicio, fim: v.fim })
        await espelharContrato(t, r.rows[0].id)
        return r.rows[0].id as string
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/contratos/:id',
    h: async ({ db, params, usuario, agora }) => {
      const id = idTexto(params.id)
      const k = (await db.query(`select ${SEL_CONTRATO} from ${FROM_CONTRATO} where k.id = $1`, [id])).rows[0]
      if (!k) throw naoEncontrado('Contrato não encontrado.')
      const acesso = await exigirAcessoContrato(db, usuario, k)
      const gente = await mapaPessoas(db)
      const h = hoje(agora)
      const aditivos = (await db.query(`select a.*, a.vigencia_inicio::text as vig, a.fim_anterior::text as fa, a.fim_novo::text as fn from fin_aditivos a where contrato_id = $1 order by numero`, [id])).rows
      const docs = (await db.query(`select d.*, d.emitido_em::text as emitido_t, d.validade::text as validade_t from doc_documentos d where d.contrato_id = $1 order by d.criado_em desc`, [id])).rows
      const notas = (await db.query(`select id, numero, serie, competencia, valor_bruto, status, enviada_em, data_emissao::text as emissao from fin_notas where contrato_id = $1 order by competencia desc, enviada_em desc limit 60`, [id])).rows
      const historico = tem(usuario, 'fin:ver') || acesso.gestor
        ? (await db.query("select id, em, colaborador_id, acao, detalhes from aud_eventos where entidade = 'contrato' and entidade_id = $1 order by em desc limit 100", [id])).rows : []
      const visiveis = []
      for (const d of docs) if (await podeVerDocumento(db, usuario, d)) visiveis.push(documentoJson(d, gente))
      return ok({
        contrato: contratoJson(k, gente, h, await setoresMapa(db)),
        papel: { prestador: acesso.prestador, gestor: acesso.gestor, financeiro: tem(usuario, 'fin:ver'), cadastrar: tem(usuario, 'fin:cadastrar') },
        aditivos: aditivos.map((a) => ({ id: a.id, numero: a.numero, tipo: a.tipo, descricao: a.descricao, vigenciaInicio: a.vig, valorAnterior: num(a.valor_anterior), valorNovo: num(a.valor_novo), fimAnterior: a.fa, fimNovo: a.fn, documentoId: a.documento_id, criadoPor: nomeDe(gente, a.criado_por) ?? (a.criado_por === 'sistema' ? 'Renovação automática' : null), criadoEm: a.criado_em })),
        documentos: visiveis,
        notas: notas.map((n) => ({ id: n.id, numero: n.numero, serie: n.serie, competencia: n.competencia, valorBruto: num(n.valor_bruto), status: n.status, enviadaEm: n.enviada_em, dataEmissao: n.emissao })),
        historico: historico.map((e) => ({ id: Number(e.id), em: e.em, autor: nomeDe(gente, e.colaborador_id) ?? (e.colaborador_id === 'sistema' ? 'Sistema' : null), acao: e.acao, detalhes: e.detalhes })),
        pendencias: tem(usuario, 'fin:ver') ? await pendenciasContrato(db, [id]) : null,
      })
    },
  },
  {
    metodo: 'PUT', padrao: 'financeiro/contratos/:id', cap: 'fin:cadastrar',
    h: async ({ db, req, params, usuario }) => {
      const id = idTexto(params.id)
      const versao = inteiro(req.corpo?.versao, 'versão', { min: 1, max: 1_000_000 })
      const v = await lerContrato(db, req.corpo ?? {})
      await db.tx(async (t) => {
        const k = await contratoOu404(t, id, true)
        if (k.versao !== versao) throw conflito('Outra pessoa alterou este contrato. Recarregue para ver a versão atual.')
        if (k.status === 'encerrado') throw conflito('Contrato encerrado não pode ser alterado.')
        if ((await t.query('select 1 from fin_contratos where lower(numero) = lower($1) and id <> $2', [v.numero, id])).rowCount) throw conflito('Já existe contrato com este número.')
        if (k.status !== 'rascunho') {
          // Valor, prazo e partes de contrato em vigor mudam por aditivo (fica o histórico).
          const fimAtual = dstr(k.fim), iniAtual = dstr(k.inicio)
          if (Number(k.valor) !== v.valor || fimAtual !== v.fim || iniAtual !== v.inicio || k.fornecedor_id !== v.fornecedor_id || k.modelo_remuneracao !== v.modelo_remuneracao || k.tipo_prazo !== v.tipo_prazo) {
            throw conflito('Valor, vigência, modelo e fornecedor de contrato em vigor mudam por aditivo (aba Aditivos).')
          }
        }
        const cols = Object.keys(v)
        await t.query(`update fin_contratos set ${cols.map((c, i) => `${c} = $${i + 2}`).join(', ')}, atualizado_em = now(), versao = versao + 1 where id = $1`, [id, ...Object.values(v)])
        await auditar(t, usuario.colaboradorId, 'contrato', id, 'alterado', { campos: cols.filter((c) => difere(k[c], (v as Linha)[c])) })
        await espelharContrato(t, id)
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos/:id/ativar', cap: 'fin:cadastrar',
    h: async ({ db, params, usuario }) => {
      const id = idTexto(params.id)
      await db.tx(async (t) => {
        const k = await contratoOu404(t, id, true)
        if (k.status !== 'rascunho' && k.status !== 'suspenso') throw conflito('Só rascunhos ou contratos suspensos podem ser ativados.')
        if (!k.data_assinatura) throw invalido('Informe a data de assinatura antes de ativar o contrato.', { dataAssinatura: 'Obrigatória para ativar' })
        await t.query("update fin_contratos set status = 'vigente', atualizado_em = now(), versao = versao + 1 where id = $1", [id])
        await auditar(t, usuario.colaboradorId, 'contrato', id, k.status === 'suspenso' ? 'reativado' : 'ativado')
        await espelharContrato(t, id)
        if (k.prestador_id) await notificar(t, { destinatarioId: k.prestador_id, tipo: 'contrato', titulo: `Contrato ${k.numero} em vigor`, link: `/meus-contratos`, chave: `ctr-ativo:${id}:${k.versao}` })
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos/:id/suspender', cap: 'fin:cadastrar',
    h: async ({ db, params, req, usuario }) => {
      const id = idTexto(params.id)
      const motivo = texto(req.corpo?.motivo, 'motivo', { min: 5, max: 1000 })
      await db.tx(async (t) => {
        const k = await contratoOu404(t, id, true)
        if (k.status !== 'vigente') throw conflito('Só contratos vigentes podem ser suspensos.')
        await t.query("update fin_contratos set status = 'suspenso', atualizado_em = now(), versao = versao + 1 where id = $1", [id])
        await auditar(t, usuario.colaboradorId, 'contrato', id, 'suspenso', { motivo })
        await espelharContrato(t, id)
      })
      return ok()
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos/:id/aditivos', cap: 'fin:cadastrar',
    h: async ({ db, params, req, usuario }) => {
      const id = idTexto(params.id)
      const b = req.corpo ?? {}
      const tipo = enumerado(b.tipo, 'tipo', ['valor', 'prazo', 'escopo', 'valor_prazo', 'outro'] as const)
      const descricao = texto(b.descricao, 'descrição', { min: 5, max: 4000 })
      const vigencia = dataISO(b.vigenciaInicio, 'início da vigência do aditivo', true)!
      const valorNovo = tipo === 'valor' || tipo === 'valor_prazo' ? dinheiro(b.valorNovo, 'novo valor', { positivo: false }) : null
      const fimNovo = tipo === 'prazo' || tipo === 'valor_prazo' ? dataISO(b.fimNovo, 'novo término', true) : null
      const out = await db.tx(async (t) => {
        const k = await contratoOu404(t, id, true)
        if (k.status === 'encerrado' || k.status === 'rascunho') throw conflito('Aditivos só em contratos vigentes ou suspensos (rascunhos são editados diretamente).')
        const ini = dstr(k.inicio)!
        if (vigencia < ini) throw invalido('O aditivo não pode valer antes do início do contrato.', { vigenciaInicio: 'Antes do início' })
        if (fimNovo && fimNovo < ini) throw invalido('Novo término anterior ao início do contrato.', { fimNovo: 'Antes do início' })
        let docId: string | null = null
        if (b.documento) docId = await registrarDocumento(t, usuario, { categoria: 'aditivo', titulo: `Aditivo ao contrato ${k.numero}`, contratoId: id, fornecedorId: k.fornecedor_id, emitidoEm: vigencia, status: 'valido' }, b.documento, 'documento')
        const numero = await proximoAditivo(t, id)
        const r = await t.query(`insert into fin_aditivos (contrato_id, numero, tipo, descricao, vigencia_inicio, valor_anterior, valor_novo, fim_anterior, fim_novo, documento_id, criado_por)
          values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11) returning id`,
          [id, numero, tipo, descricao, vigencia, valorNovo !== null ? k.valor : null, valorNovo, fimNovo ? k.fim : null, fimNovo, docId, usuario.colaboradorId])
        await t.query(`update fin_contratos set valor = coalesce($2, valor), fim = coalesce($3, fim), tipo_prazo = case when $3::date is null then tipo_prazo else 'determinado' end,
          atualizado_em = now(), versao = versao + 1 where id = $1`, [id, valorNovo, fimNovo])
        await auditar(t, usuario.colaboradorId, 'contrato', id, 'aditivo', { numero, tipo, valorAnterior: valorNovo !== null ? Number(k.valor) : undefined, valorNovo, fimAnterior: fimNovo ? dstr(k.fim) : undefined, fimNovo })
        await espelharContrato(t, id)
        return { id: r.rows[0].id, numero }
      })
      return ok(out, 201)
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/contratos/:id/pendencias', cap: 'fin:ver',
    h: async ({ db, params }) => ok(await pendenciasContrato(db, [(await contratoOu404(db, idTexto(params.id))).id])),
  },
  {
    metodo: 'POST', padrao: 'financeiro/contratos/:id/encerrar', cap: 'fin:cadastrar',
    h: async ({ db, params, req, usuario }) => {
      const id = idTexto(params.id)
      const b = req.corpo ?? {}
      const data = dataISO(b.data, 'data de encerramento', true)!
      const tipo = enumerado(b.tipo, 'tipo de encerramento', TIPOS_ENCERRAMENTO)
      const motivo = texto(b.motivo, 'motivo', { min: 5, max: 2000 })
      const out = await db.tx(async (t) => {
        const k = await contratoOu404(t, id, true)
        if (k.status === 'encerrado') throw conflito('Contrato já encerrado.')
        if (data < dstr(k.inicio)!) throw invalido('O encerramento não pode ser anterior ao início.', { data: 'Antes do início' })
        const pend = await pendenciasContrato(t, [id])
        const temPend = pend.notasEmAndamento + pend.contasAbertas > 0
        // Encerrar não apaga nada: notas e pagamentos em aberto continuam no fluxo até a liquidação.
        if (temPend && b.confirmarPendencias !== true) return { pendente: true, pendencias: pend }
        let docId: string | null = null
        if (b.documento) docId = await registrarDocumento(t, usuario, { categoria: 'encerramento', titulo: `Encerramento do contrato ${k.numero}`, contratoId: id, fornecedorId: k.fornecedor_id, emitidoEm: data, status: 'valido' }, b.documento, 'documento')
        await t.query(`update fin_contratos set status = 'encerrado', encerrado_em = $2, encerramento_tipo = $3, encerramento_motivo = $4,
          fim = case when fim is null or fim > $2::date then $2::date else fim end, tipo_prazo = 'determinado', atualizado_em = now(), versao = versao + 1 where id = $1`, [id, data, tipo, motivo])
        await auditar(t, usuario.colaboradorId, 'contrato', id, 'encerrado', { data, tipo, comPendencias: temPend, pendencias: pend, documentoId: docId })
        await espelharContrato(t, id)
        if (k.prestador_id) await notificar(t, { destinatarioId: k.prestador_id, tipo: 'contrato', titulo: `Contrato ${k.numero} encerrado`, corpo: `Encerramento em ${data}.`, link: '/meus-contratos', chave: `ctr-enc:${id}` })
        return { pendente: false, pendencias: pend }
      })
      if (out.pendente) return { status: 409, corpo: { erro: 'Há notas fiscais ou pagamentos em aberto neste contrato. Confirme para encerrar mesmo assim (eles seguem no fluxo até a liquidação).', pendencias: out.pendencias } }
      return ok(out)
    },
  },
  {
    // Para o encerramento da parceria (offboarding): pendências de todos os contratos da pessoa.
    metodo: 'GET', padrao: 'financeiro/pessoas/:id/pendencias', cap: ['fin:ver', 'pessoas:gerenciar'],
    h: async ({ db, params }) => {
      const pid = String(params.id)
      const ids = (await db.query(`select id from fin_contratos where status <> 'encerrado' and (prestador_id = $1 or fornecedor_id in (select id from fin_fornecedores where representante_id = $1))`, [pid])).rows.map((r) => r.id)
      const todos = (await db.query(`select id from fin_contratos where prestador_id = $1 or fornecedor_id in (select id from fin_fornecedores where representante_id = $1)`, [pid])).rows.map((r) => r.id)
      const p = await pendenciasContrato(db, todos)
      const reemb = (await db.query("select count(*)::int as n from app_reembolsos where dados->>'colaboradorId' = $1 and dados->>'status' in ('pendente','aprovado','pagamento')", [pid])).rows[0].n
      return ok({ contratosAtivos: ids, ...p, reembolsosAbertos: reemb })
    },
  },

  /* ---------- documentos ---------- */
  {
    metodo: 'GET', padrao: 'financeiro/documentos',
    h: async ({ db, req, usuario, agora }) => {
      const { pagina, por, offset } = paginacao(req.query, 30)
      const amplo = tem(usuario, 'fin:ver') || tem(usuario, 'documentos:gerenciar')
      const ps: unknown[] = []
      const w: string[] = []
      if (!amplo) {
        ps.push(usuario.colaboradorId)
        w.push(`(d.pessoa_id = $1 or d.enviado_por = $1 or d.fornecedor_id in (select id from fin_fornecedores where representante_id = $1)
          or d.contrato_id in (select id from fin_contratos where prestador_id = $1))`)
      }
      if (req.query.pessoa) { ps.push(req.query.pessoa); w.push(`d.pessoa_id = $${ps.length}`) }
      if (req.query.fornecedor) { ps.push(req.query.fornecedor); w.push(`d.fornecedor_id = $${ps.length}`) }
      if (req.query.contrato) { ps.push(req.query.contrato); w.push(`d.contrato_id = $${ps.length}`) }
      if (req.query.categoria) { ps.push(req.query.categoria.split(',')); w.push(`d.categoria = any($${ps.length}::text[])`) }
      if (req.query.status) { ps.push(req.query.status.split(',')); w.push(`d.status = any($${ps.length}::text[])`) }
      else if (req.query.historico !== '1') w.push("d.status <> 'substituido'")
      if (req.query.validade === 'vencidos') { ps.push(hoje(agora)); w.push(`d.validade < $${ps.length}::date and d.status in ('valido','pendente')`) }
      if (req.query.validade === 'vencendo') { ps.push(hoje(agora), Number(req.query.dias) || 30); w.push(`d.validade between $${ps.length - 1}::date and $${ps.length - 1}::date + $${ps.length}::int and d.status in ('valido','pendente')`) }
      if (req.query.q) { ps.push(`%${req.query.q.trim().toLowerCase()}%`); w.push(`lower(d.titulo) like $${ps.length}`) }
      const where = w.length ? w.join(' and ') : 'true'
      const from = `doc_documentos d left join fin_fornecedores f on f.id = d.fornecedor_id left join fin_contratos k on k.id = d.contrato_id`
      const total = (await db.query(`select count(*)::int as n from ${from} where ${where}`, ps)).rows[0].n
      const rows = (await db.query(`select d.*, d.emitido_em::text as emitido_t, d.validade::text as validade_t, f.razao_social as fornecedor_nome, k.numero as contrato_numero
        from ${from} where ${where} order by (d.status = 'pendente') desc, d.criado_em desc limit ${por} offset ${offset}`, ps)).rows
      const gente = await mapaPessoas(db)
      return ok({ itens: rows.map((d) => documentoJson(d, gente)), total, pagina, por })
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/documentos',
    h: async ({ db, req, usuario }) => {
      const b = req.corpo ?? {}
      const categoria = enumerado(b.categoria, 'categoria', CATEGORIAS_DOCUMENTO) as CategoriaDocumento
      if (categoria === 'nota_fiscal' || categoria === 'comprovante_pagamento') throw invalido('Notas fiscais e comprovantes são enviados nos fluxos próprios.', { categoria: 'Use o fluxo próprio' })
      const contratoId = b.contratoId ? idTexto(b.contratoId, 'contratoId') : null
      const fornecedorId = b.fornecedorId ? idTexto(b.fornecedorId, 'fornecedorId') : null
      let pessoaId = b.pessoaId ? String(b.pessoaId) : null
      const gerencia = tem(usuario, 'documentos:gerenciar') || tem(usuario, 'fin:cadastrar') || tem(usuario, 'fin:conferir')
      if (!gerencia) {
        // A própria pessoa envia em seu nome, do fornecedor que representa ou de contrato que presta.
        const meus = await meusFornecedores(db, usuario)
        if (pessoaId && pessoaId !== usuario.colaboradorId) throw proibido('Você só envia documentos em seu nome.')
        if (fornecedorId && !meus.includes(fornecedorId)) throw proibido('Você só envia documentos do fornecedor que representa.')
        if (contratoId) { const k = await contratoOu404(db, contratoId); if (k.prestador_id !== usuario.colaboradorId && !meus.includes(k.fornecedor_id)) throw proibido('Contrato de outra pessoa.') }
        if (!pessoaId && !fornecedorId && !contratoId) pessoaId = usuario.colaboradorId
      } else if (pessoaId && !(await pessoaPorId(db, pessoaId))) throw invalido('Pessoa não encontrada.', { pessoaId: 'Não encontrada' })
      if (!pessoaId && !fornecedorId && !contratoId) throw invalido('Vincule o documento a uma pessoa, fornecedor ou contrato.')
      const substituiId = uuidOuNulo(b.substituiId, 'substituiId')
      const id = await db.tx(async (t) => {
        if (substituiId) {
          const ant = (await t.query('select * from doc_documentos where id = $1 for update', [substituiId])).rows[0]
          if (!ant || !(await podeVerDocumento(t, usuario, ant))) throw naoEncontrado('Documento a substituir não encontrado.')
          if (ant.status === 'substituido') throw conflito('Este documento já foi substituído.')
        }
        const novo = await registrarDocumento(t, usuario, {
          categoria, titulo: texto(b.titulo, 'título', { max: 200 }), pessoaId, fornecedorId, contratoId,
          emitidoEm: dataISO(b.emitidoEm, 'data de emissão'), validade: dataISO(b.validade, 'validade'), substituiId, confidencial: b.confidencial !== false,
        }, b.arquivo)
        if (!gerencia) await notificarCap(t, 'fin:conferir', { tipo: 'documento', titulo: 'Documento para conferir', corpo: `${usuario.nome} enviou um documento.`, link: '/financeiro/documentos?status=pendente', chave: `doc-novo:${novo}` }, [usuario.colaboradorId])
        return novo
      })
      return ok({ id }, 201)
    },
  },
  {
    metodo: 'GET', padrao: 'financeiro/documentos/:id/arquivo',
    h: async ({ db, params, usuario }) => {
      const d = (await db.query('select * from doc_documentos where id = $1', [uuid(params.id)])).rows[0]
      if (!d || !(await podeVerDocumento(db, usuario, d))) throw naoEncontrado('Documento não encontrado.')
      if (!d.arquivo_id) throw naoEncontrado('Este registro veio do cadastro antigo e não tem arquivo anexado.')
      const out = await baixarArquivo(db, d.arquivo_id)
      if (!out) throw naoEncontrado('Arquivo não encontrado.')
      await auditar(db, usuario.colaboradorId, 'documento', d.id, 'baixado')
      return out.binario ? { ...out, binario: { ...out.binario, inline: true } } : out
    },
  },
  {
    metodo: 'POST', padrao: 'financeiro/documentos/:id/conferir', cap: ['fin:conferir', 'documentos:gerenciar'],
    h: async ({ db, params, req, usuario }) => {
      const id = uuid(params.id)
      const decisao = enumerado(req.corpo?.decisao, 'decisão', ['valido', 'rejeitado'] as const)
      const motivo = decisao === 'rejeitado' ? texto(req.corpo?.motivo, 'motivo da rejeição', { min: 5, max: 1000 }) : null
      await db.tx(async (t) => {
        const d = (await t.query('select * from doc_documentos where id = $1 for update', [id])).rows[0]
        if (!d) throw naoEncontrado('Documento não encontrado.')
        if (d.status !== 'pendente') throw conflito('Este documento já foi conferido.')
        if (!d.arquivo_id) throw conflito('Registro antigo sem arquivo: peça o envio do documento e confira o novo.')
        exigirNaoProprio(usuario, await titularDoc(t, d))
        await t.query('update doc_documentos set status = $2, conferido_por = $3, conferido_em = now(), motivo_rejeicao = $4 where id = $1', [id, decisao, usuario.colaboradorId, motivo])
        await auditar(t, usuario.colaboradorId, 'documento', id, decisao === 'valido' ? 'validado' : 'rejeitado', motivo ? { motivo } : {})
        await espelharDocumento(t, id)
        const titular = await titularDoc(t, d)
        if (titular && decisao === 'rejeitado') await notificar(t, { destinatarioId: titular, tipo: 'documento', titulo: 'Documento recusado', corpo: `"${d.titulo}": ${motivo}`, link: '/meus-documentos', chave: `doc-rej:${id}` })
      })
      return ok()
    },
  },
]

/** Validação simples usada por notas e contas: contrato ativo do fornecedor. */
export async function contratoParaNota(ex: Executor, u: Usuario, contratoId: string) {
  const k = await contratoOu404(ex, contratoId)
  const prestador = (k.prestador_id === u.colaboradorId) || (await meusFornecedores(ex, u)).includes(k.fornecedor_id)
  if (!prestador && !tem(u, 'fin:conferir')) throw proibido('Você só envia notas de contratos que presta.')
  return { k, prestador }
}
