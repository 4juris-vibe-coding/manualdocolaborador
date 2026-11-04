/* ============================================================
   API v2 · LGPD · retenção de dados de candidatos
   Anonimiza, depois do prazo de retenção (rec_config.privacidade.
   retencaoMeses), os candidatos cujo processo terminou e que não estão
   no banco de talentos com autorização vigente.

   Regras (todas precisam valer):
   - o candidato não foi anonimizado e tem ao menos uma candidatura;
   - nenhuma candidatura está 'ativa';
   - nenhuma candidatura terminou em 'contratado' (os dados de quem foi
     contratado seguem o cadastro de pessoas; a anonimização desses é manual);
   - a última data de encerramento (encerrada_em, ou atualizado_em se vazia)
     é anterior a agora − retencaoMeses;
   - não está no banco de talentos com prazo e consentimento vigentes.

   O que acontece com cada candidato (numa transação por pessoa):
   - rec_candidatos: nome → 'Candidato(a) anonimizado(a)', e-mail → marcador
     não reversível e único por id, contato/cidade/LinkedIn/resumo/experiências/
     formação/competências/pretensão → vazio; anonimizado_em = agora;
   - currículos e documentos (arq_arquivos + rec_candidatura_documentos) apagados;
   - respostas de triagem, pretensão, disponibilidade e código de acompanhamento
     das candidaturas apagados;
   - respostas de questionários (fit/DISC) APAGADAS por inteiro: o retrato e as
     respostas são dado pessoal e nenhum indicador depende delas;
   - textos de notas, pareceres e mensagens trocados por marcador;
   - mantidos: as candidaturas (vaga, origem, situação, datas), as movimentações
     de etapa e os registros de consentimento — base das estatísticas e prova
     da base legal, sem dado pessoal.
   - um evento de auditoria por candidato, sem dado pessoal.
   Idempotente: quem já foi anonimizado não entra de novo.
   ============================================================ */
import { auditar, hojeISO, type Db, type Executor } from './nucleo.js'
import { obterPrivacidade } from './atsLib.js'

export const NOME_ANONIMIZADO = 'Candidato(a) anonimizado(a)'
/** Marcador do e-mail: derivado só do id (não do e-mail original), logo não reversível; único por candidato. */
export const emailAnonimizado = (id: string) => `anonimizado-${id}@anonimizado.invalid`
/** Lote máximo por execução (a próxima execução continua de onde parou). */
const LOTE = 500

/** Data-limite: quem terminou o processo antes dela é elegível. */
export function limiteRetencao(agora: Date, meses: number): Date {
  const d = new Date(agora.getTime())
  d.setUTCMonth(d.getUTCMonth() - meses)
  return d
}

/** Ids dos candidatos elegíveis para anonimização por retenção. */
export async function candidatosElegiveis(ex: Executor, agora = new Date()): Promise<{ ids: string[]; retencaoMeses: number; limite: string }> {
  const priv = await obterPrivacidade(ex)
  const meses = Math.min(60, Math.max(1, Math.floor(Number(priv.retencaoMeses) || 12)))
  const limite = limiteRetencao(agora, meses).toISOString()
  const hoje = hojeISO(agora)
  const r = await ex.query(
    `select k.id from rec_candidatos k
     where k.anonimizado_em is null
       and exists (select 1 from rec_candidaturas c where c.candidato_id = k.id)
       and not exists (select 1 from rec_candidaturas c where c.candidato_id = k.id and c.status in ('ativa','contratado'))
       and (select max(coalesce(c.encerrada_em, c.atualizado_em)) from rec_candidaturas c where c.candidato_id = k.id) < $1::timestamptz
       and not exists (
         select 1 from rec_talentos t where t.candidato_id = k.id and (t.retencao_ate is null or t.retencao_ate >= $2::date)
           and exists (select 1 from rec_consentimentos co where co.candidato_id = k.id and co.finalidade = 'banco_talentos' and co.concedido
                       and co.revogado_em is null and (co.valido_ate is null or co.valido_ate >= $2::date)))
     order by k.id limit ${LOTE}`, [limite, hoje])
  return { ids: r.rows.map((x) => x.id as string), retencaoMeses: meses, limite }
}

/** Anonimiza um candidato (dentro de uma transação). Não confere elegibilidade: quem chama decide. */
export async function anonimizarCandidatoPorRetencao(t: Executor, candidatoId: string, quem: string | null, meses: number): Promise<boolean> {
  const k = (await t.query('select id, anonimizado_em from rec_candidatos where id = $1 for update', [candidatoId])).rows[0]
  if (!k || k.anonimizado_em) return false
  const cands = (await t.query('select id, curriculo_arquivo_id from rec_candidaturas where candidato_id = $1', [candidatoId])).rows
  const idsCand = cands.map((c) => c.id as string)
  const arqs = new Set<string>(cands.map((c) => c.curriculo_arquivo_id).filter(Boolean))
  if (idsCand.length) {
    for (const d of (await t.query('select arquivo_id from rec_candidatura_documentos where candidatura_id = any($1::uuid[])', [idsCand])).rows) arqs.add(d.arquivo_id)
    // Arquivos ligados à candidatura sem vínculo explícito (ex.: currículo substituído que ficou para trás).
    for (const a of (await t.query("select id from arq_arquivos where dono_tipo = 'candidatura' and dono_id = any($1::text[])", [idsCand])).rows) arqs.add(a.id)
    await t.query(
      `update rec_candidaturas set curriculo_arquivo_id = null, respostas_triagem = '[]'::jsonb, pretensao = null, disponibilidade = null, token_hash = null, origem_detalhe = null
       where candidato_id = $1`, [candidatoId])
    await t.query('delete from rec_candidatura_documentos where candidatura_id = any($1::uuid[])', [idsCand])
    await t.query('delete from rec_questionario_respostas where candidatura_id = any($1::uuid[])', [idsCand])
    await t.query(`update rec_candidatura_notas set texto = '[removido por anonimização]' where candidatura_id = any($1::uuid[])`, [idsCand])
    await t.query('update rec_avaliacoes set parecer = null where candidatura_id = any($1::uuid[])', [idsCand])
    await t.query('update rec_entrevistas set parecer = null where candidatura_id = any($1::uuid[])', [idsCand])
  }
  if (arqs.size) await t.query('delete from arq_arquivos where id = any($1::uuid[])', [[...arqs]])
  await t.query(`update rec_comunicacoes set corpo = '[removido por anonimização]', assunto = '[removido]' where candidato_id = $1`, [candidatoId])
  await t.query('delete from rec_talentos where candidato_id = $1', [candidatoId])
  await t.query(
    `update rec_candidatos set nome = $3, email = $2, telefone = null, cidade = null, uf = null, linkedin = null, resumo = null,
       experiencias = '[]'::jsonb, formacoes = '[]'::jsonb, competencias = '[]'::jsonb, areas_interesse = '[]'::jsonb, pretensao = null, disponibilidade = null,
       anonimizado_em = now(), atualizado_em = now() where id = $1`, [candidatoId, emailAnonimizado(candidatoId), NOME_ANONIMIZADO])
  await auditar(t, quem, 'candidato', candidatoId, 'anonimizado_retencao', { retencaoMeses: meses, candidaturas: idsCand.length, arquivosRemovidos: arqs.size })
  return true
}

/**
 * Aplica a retenção: anonimiza os candidatos elegíveis (até 500 por execução). Para o cron diário.
 * `quem` = colaborador que disparou pela tela (null = rotina automática).
 */
export async function processarRetencaoCandidatos(db: Db, agora: Date = new Date(), quem: string | null = null): Promise<{ anonimizados: number }> {
  const { ids, retencaoMeses } = await candidatosElegiveis(db, agora)
  let anonimizados = 0
  for (const id of ids) {
    if (await db.tx((t) => anonimizarCandidatoPorRetencao(t, id, quem, retencaoMeses))) anonimizados++
  }
  return { anonimizados }
}
