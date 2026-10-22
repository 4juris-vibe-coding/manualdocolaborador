/* ============================================================
   API v2 · ATS · operações compartilhadas entre o painel interno
   (modulos/ats.ts) e o portal público (modulos/publico.ts).
   ============================================================ */
import { conflito, naoEncontrado, type Executor, invalido } from './nucleo.js'
import { enviarEmail, preencherModelo } from './email.js'
import { ETAPAS_PADRAO, PRIVACIDADE_PADRAO, TEMPLATES_PADRAO, MODELO_AVALIACAO_PADRAO } from '../../src/domain/v2/ats.js'

export interface EtapaVaga { id: string; nome: string; tipo: string; ordem: number; cor: string | null }

export async function garantirEtapas(ex: Executor, vagaId: string): Promise<EtapaVaga[]> {
  let r = await ex.query('select id, nome, tipo, ordem, cor from rec_vaga_etapas where vaga_id = $1 order by ordem', [vagaId])
  if (!r.rowCount) {
    for (let i = 0; i < ETAPAS_PADRAO.length; i++) {
      await ex.query('insert into rec_vaga_etapas (vaga_id, ordem, nome, tipo) values ($1,$2,$3,$4)', [vagaId, i + 1, ETAPAS_PADRAO[i].nome, ETAPAS_PADRAO[i].tipo])
    }
    r = await ex.query('select id, nome, tipo, ordem, cor from rec_vaga_etapas where vaga_id = $1 order by ordem', [vagaId])
  }
  return r.rows as EtapaVaga[]
}

export async function garantirTemplates(ex: Executor) {
  for (const t of TEMPLATES_PADRAO) {
    await ex.query('insert into rec_templates_msg (chave, nome, assunto, corpo) values ($1,$2,$3,$4) on conflict (chave) do nothing', [t.chave, t.nome, t.assunto, t.corpo])
  }
}

export async function garantirModeloAvaliacao(ex: Executor) {
  const r = await ex.query('select 1 from rec_modelos_avaliacao limit 1')
  if (!r.rowCount) await ex.query('insert into rec_modelos_avaliacao (nome, criterios) values ($1,$2::jsonb)', [MODELO_AVALIACAO_PADRAO.nome, JSON.stringify(MODELO_AVALIACAO_PADRAO.criterios)])
}

export async function obterPrivacidade(ex: Executor): Promise<typeof PRIVACIDADE_PADRAO> {
  const r = await ex.query("select dados from rec_config where chave = 'privacidade'")
  return { ...PRIVACIDADE_PADRAO, ...(r.rows[0]?.dados ?? {}) }
}

export async function registrarConsentimento(ex: Executor, c: { candidatoId: string; candidaturaId?: string | null; finalidade: string; baseLegal: string; versao: string; concedido: boolean; validoAte?: string | null }) {
  await ex.query(
    'insert into rec_consentimentos (candidato_id, candidatura_id, finalidade, base_legal, texto_versao, concedido, valido_ate) values ($1,$2,$3,$4,$5,$6,$7)',
    [c.candidatoId, c.candidaturaId ?? null, c.finalidade, c.baseLegal, c.versao, c.concedido, c.validoAte ?? null])
}

export interface DadosCandidato { nome: string; email: string; telefone?: string; cidade?: string; uf?: string; linkedin?: string }

export interface NovaCandidatura {
  vagaId: string
  candidato: DadosCandidato
  origem: string
  origemDetalhe?: string | null
  respostasTriagem?: unknown[]
  curriculoArquivoId?: string | null
  pretensao?: number | null
  disponibilidade?: string | null
  tokenHash?: string | null
  colaboradorId?: string | null
}

/** Cria (ou reaproveita) o candidato e cria a candidatura na primeira etapa. Conflito se o e-mail já se candidatou à vaga. */
export async function criarCandidatura(ex: Executor, n: NovaCandidatura): Promise<{ candidaturaId: string; candidatoId: string; candidatoReutilizado: boolean; outrasCandidaturas: number; etapaId: string }> {
  const email = n.candidato.email.toLowerCase()
  const dup = await ex.query(
    `select 1 from rec_candidaturas c join rec_candidatos k on k.id = c.candidato_id
     where c.vaga_id = $1 and lower(k.email) = $2 and k.anonimizado_em is null`, [n.vagaId, email])
  if (dup.rowCount) throw conflito('Já existe uma candidatura com este e-mail para esta vaga.')

  let candidatoId: string, reutilizado = false
  const ex1 = await ex.query('select id from rec_candidatos where lower(email) = $1 and anonimizado_em is null', [email])
  if (ex1.rowCount) {
    candidatoId = ex1.rows[0].id; reutilizado = true
    // Só completa o que estava vazio; nunca sobrescreve dados já conferidos.
    await ex.query(
      `update rec_candidatos set telefone = coalesce(nullif(telefone,''), $2), cidade = coalesce(nullif(cidade,''), $3), uf = coalesce(nullif(uf,''), $4),
         linkedin = coalesce(nullif(linkedin,''), $5), atualizado_em = now() where id = $1`,
      [candidatoId, n.candidato.telefone || null, n.candidato.cidade || null, n.candidato.uf || null, n.candidato.linkedin || null])
  } else {
    const ins = await ex.query(
      'insert into rec_candidatos (nome, email, telefone, cidade, uf, linkedin, pretensao, disponibilidade, origem_inicial) values ($1,$2,$3,$4,$5,$6,$7,$8,$9) returning id',
      [n.candidato.nome, email, n.candidato.telefone || null, n.candidato.cidade || null, n.candidato.uf || null, n.candidato.linkedin || null, n.pretensao ?? null, n.disponibilidade ?? null, n.origem])
    candidatoId = ins.rows[0].id
  }
  const outras = (await ex.query('select count(*)::int as n from rec_candidaturas where candidato_id = $1', [candidatoId])).rows[0].n as number
  const etapas = await garantirEtapas(ex, n.vagaId)
  const primeira = etapas[0]
  let candidaturaId: string
  try {
    const c = await ex.query(
      `insert into rec_candidaturas (vaga_id, candidato_id, etapa_id, origem, origem_detalhe, respostas_triagem, curriculo_arquivo_id, pretensao, disponibilidade, token_hash)
       values ($1,$2,$3,$4,$5,$6::jsonb,$7,$8,$9,$10) returning id`,
      [n.vagaId, candidatoId, primeira.id, n.origem, n.origemDetalhe ?? null, JSON.stringify(n.respostasTriagem ?? []), n.curriculoArquivoId ?? null, n.pretensao ?? null, n.disponibilidade ?? null, n.tokenHash ?? null])
    candidaturaId = c.rows[0].id
  } catch (e) {
    if ((e as { code?: string }).code === '23505') throw conflito('Já existe uma candidatura com este e-mail para esta vaga.')
    throw e
  }
  await ex.query(
    "insert into rec_candidatura_movs (candidatura_id, colaborador_id, para_etapa_id, para_status, motivo) values ($1,$2,$3,'ativa','Candidatura recebida')",
    [candidaturaId, n.colaboradorId ?? null, primeira.id])
  await ex.query('update rec_vagas set primeira_candidatura_em = coalesce(primeira_candidatura_em, now()) where id = $1', [n.vagaId])
  return { candidaturaId, candidatoId, candidatoReutilizado: reutilizado, outrasCandidaturas: outras, etapaId: primeira.id }
}

/** Conclui a contratação: candidatura "contratado", +1 posição preenchida e, se completou, encerra a vaga como "preenchida".
 *  Trava a candidatura e a vaga: duas contratações simultâneas na mesma vaga não passam do número de posições. */
export async function concluirContratacao(ex: Executor, candidaturaId: string, quem: string | null): Promise<{ vagaEncerrada: boolean }> {
  const r = await ex.query(
    `select c.id, c.status, c.etapa_id, c.vaga_id, v.status as vaga_status, v.qtd_posicoes, v.posicoes_preenchidas
     from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id where c.id = $1 for update of c, v`, [candidaturaId])
  const c = r.rows[0]
  if (!c) throw naoEncontrado('Candidatura não encontrada.')
  if (c.status === 'contratado') throw conflito('Esta candidatura já foi concluída com contratação.')
  if (c.status !== 'ativa') throw conflito('Apenas candidaturas em andamento podem ser contratadas. Reative-a antes.')
  if (c.posicoes_preenchidas >= c.qtd_posicoes) throw conflito('Todas as posições desta vaga já foram preenchidas.')
  const etapas = await garantirEtapas(ex, c.vaga_id)
  const etapaContratado = etapas.find((e) => e.tipo === 'contratado')
  await ex.query(`update rec_candidaturas set status = 'contratado', etapa_id = coalesce($2, etapa_id), etapa_desde = now(), encerrada_em = now(), atualizado_em = now() where id = $1`,
    [candidaturaId, etapaContratado?.id ?? null])
  await ex.query("insert into rec_candidatura_movs (candidatura_id, colaborador_id, de_etapa_id, para_etapa_id, de_status, para_status, motivo) values ($1,$2,$3,$4,'ativa','contratado','Contratação concluída')",
    [candidaturaId, quem, c.etapa_id, etapaContratado?.id ?? c.etapa_id])
  const preenchidas = c.posicoes_preenchidas + 1
  await ex.query('update rec_vagas set posicoes_preenchidas = $2, atualizado_em = now() where id = $1', [c.vaga_id, preenchidas])
  await ex.query("insert into rec_vaga_eventos (vaga_id, colaborador_id, tipo, detalhes) values ($1,$2,'contratacao',$3::jsonb)", [c.vaga_id, quem, JSON.stringify({ candidaturaId, preenchidas, total: c.qtd_posicoes })])
  let encerrada = false
  if (preenchidas >= c.qtd_posicoes && ['publicada', 'pausada', 'aprovada'].includes(c.vaga_status)) {
    // Encerramento por preenchimento, com o mesmo registro de status que o módulo de vagas usa.
    await ex.query(`update rec_vagas set status = 'encerrada', encerrada_em = now(), motivo_encerramento = 'preenchida', atualizado_em = now() where id = $1`, [c.vaga_id])
    await ex.query("insert into rec_vaga_eventos (vaga_id, colaborador_id, tipo, de_status, para_status, detalhes) values ($1,$2,'status',$3,'encerrada',$4::jsonb)",
      [c.vaga_id, quem, c.vaga_status, JSON.stringify({ motivo: 'preenchida' })])
    encerrada = true
  }
  return { vagaEncerrada: encerrada }
}

/* ---------- comunicação ---------- */
export async function variaveisCandidatura(ex: Executor, candidaturaId: string): Promise<{ vars: Record<string, string>; email: string; candidatoId: string }> {
  const r = await ex.query(
    `select k.id as candidato_id, k.nome, k.email, v.titulo, e.nome as etapa from rec_candidaturas c
     join rec_candidatos k on k.id = c.candidato_id join rec_vagas v on v.id = c.vaga_id left join rec_vaga_etapas e on e.id = c.etapa_id where c.id = $1`, [candidaturaId])
  const x = r.rows[0]
  if (!x) throw naoEncontrado('Candidatura não encontrada.')
  return { vars: { nome: String(x.nome).split(' ')[0], vaga: x.titulo, etapa: x.etapa ?? '', empresa: '4JURIS' }, email: x.email, candidatoId: x.candidato_id }
}

export interface ComunicacaoNova {
  candidaturaId: string | null; candidatoId: string | null; templateChave?: string | null
  assunto: string; corpo: string; corpoPersistido?: string; para: string; criadoPor: string | null; enviar: boolean
}
/** Registra a mensagem como pendente e, se pedido, tenta enviar. O status só vira "enviada" com a confirmação do provedor. */
export async function registrarEEnviar(ex: Executor, m: ComunicacaoNova): Promise<{ id: string; status: string; erro?: string }> {
  const ins = await ex.query(
    `insert into rec_comunicacoes (candidatura_id, candidato_id, template_chave, assunto, corpo, criado_por) values ($1,$2,$3,$4,$5,$6) returning id`,
    [m.candidaturaId, m.candidatoId, m.templateChave ?? null, m.assunto, m.corpoPersistido ?? m.corpo, m.criadoPor])
  const id = ins.rows[0].id as string
  if (!m.enviar) return { id, status: 'pendente' }
  const res = await enviarEmail(m.para, m.assunto, m.corpo)
  await ex.query('update rec_comunicacoes set status = $2, erro = $3, enviada_em = case when $2 = $4 then now() else null end where id = $1', [id, res.status, res.erro ?? null, 'enviada'])
  return { id, status: res.status, erro: res.erro }
}

export async function modeloPreenchido(ex: Executor, chave: string, vars: Record<string, string>): Promise<{ assunto: string; corpo: string }> {
  await garantirTemplates(ex)
  const t = (await ex.query('select assunto, corpo from rec_templates_msg where chave = $1', [chave])).rows[0]
  if (!t) throw invalido('Modelo de mensagem inexistente.')
  return { assunto: preencherModelo(t.assunto, vars), corpo: preencherModelo(t.corpo, vars) }
}
