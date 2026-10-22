/* ============================================================
   API v2 · portal público de carreiras (SEM login, SEM cookie)
   Regra: só sai daqui o que é próprio para o público. Nunca:
   aprovações, comentários, observações do RH, orçamento/salário
   (exceto se a vaga marcou divulgar_salario), nomes de gestores,
   dados de outros candidatos ou notas internas.
   ============================================================ */
import { auditar, conflito, enumerado, hojeISO, idsComPapel, invalido, listaTexto, naoEncontrado, notificar, novoToken, hashToken, ok, paginacao, setores, texto, email as validarEmail, type Rota } from '../nucleo.js'
import { baixarArquivo, guardarArquivo, validarUpload } from '../arquivos.js'
import { concluirContratacao as _nao, criarCandidatura, modeloPreenchido, obterPrivacidade, registrarConsentimento, registrarEEnviar, variaveisCandidatura } from '../atsLib.js'
import { urlPortal } from '../../_lib.js'
import { ORIGENS_PUBLICAS, statusPublico, somarMeses, vagaAceitaCandidaturas } from '../../../src/domain/v2/ats.js'

void _nao

const DIA = (c: string) => `to_char(${c}, 'YYYY-MM-DD')`
const CAMPOS_PUBLICOS = `v.id, v.slug, v.titulo, v.resumo, v.tipo, v.regime_contratacao, v.modalidade, v.cidade, v.estado, v.pais, v.senioridade, v.setor_id, v.publicada_em, (v.imagem_arquivo_id is not null) as tem_imagem,
  ${DIA('v.encerra_candidaturas_em')} as encerra_candidaturas_em, ${DIA('v.publicar_em')} as publicar_em`
const FILTRO_PUBLICADA = `v.status = 'publicada' and not v.arquivada and (v.publicar_em is null or v.publicar_em <= $1::date) and (v.encerra_candidaturas_em is null or v.encerra_candidaturas_em >= $1::date)`

const PORTAL_PADRAO = {
  titulo: 'Trabalhe na 4JURIS',
  apresentacao: 'Conheça as oportunidades abertas e envie a sua candidatura. Analisamos cada perfil com atenção e informamos você sobre os próximos passos.',
}

const TIPOS: Record<string, string> = { efetivo: 'Efetivo', temporario: 'Temporário', estagio: 'Estágio', aprendiz: 'Aprendiz', contrato: 'Contrato', outro: 'Outro' }

export const rotas: Rota[] = [
  {
    metodo: 'GET', padrao: 'publico/vagas', publica: true,
    h: async ({ db, req, agora }) => {
      const hoje = hojeISO(agora)
      const { pagina, por, offset } = paginacao(req.query, 12, 50)
      const ps: unknown[] = [hoje]
      let where = FILTRO_PUBLICADA
      const q = (req.query.q ?? '').trim().slice(0, 80)
      if (q) { ps.push(`%${q}%`); where += ` and (v.titulo ilike $${ps.length} or v.resumo ilike $${ps.length} or v.texto_publico ilike $${ps.length})` }
      if (req.query.modalidade && ['presencial', 'hibrido', 'remoto'].includes(req.query.modalidade)) { ps.push(req.query.modalidade); where += ` and v.modalidade = $${ps.length}` }
      if (req.query.tipo && TIPOS[req.query.tipo]) { ps.push(req.query.tipo); where += ` and v.tipo = $${ps.length}` }
      if (req.query.cidade) { ps.push(`%${req.query.cidade.slice(0, 60)}%`); where += ` and (v.cidade ilike $${ps.length} or v.estado ilike $${ps.length})` }
      const mapa = new Map((await setores(db)).map((s) => [s.id, s.nome]))
      if (req.query.area) {
        const ids = [...mapa.entries()].filter(([, n]) => n === req.query.area).map(([id]) => id)
        ps.push(ids); where += ` and v.setor_id = any($${ps.length}::text[])`
      }
      const total = (await db.query(`select count(*)::int as n from rec_vagas v where ${where}`, ps)).rows[0].n
      const r = await db.query(`select ${CAMPOS_PUBLICOS} from rec_vagas v where ${where} order by v.publicada_em desc nulls last, v.criado_em desc limit ${por} offset ${offset}`, ps)
      const todas = (await db.query(`select v.setor_id, v.cidade, v.estado, v.modalidade, v.tipo from rec_vagas v where ${FILTRO_PUBLICADA}`, [hoje])).rows
      const cfg = (await db.query("select dados from rec_config where chave = 'portal'")).rows[0]?.dados ?? {}
      return ok({
        portal: { ...PORTAL_PADRAO, ...cfg },
        itens: r.rows.map((v) => itemPublico(v, mapa)),
        total, pagina, por,
        filtros: {
          areas: [...new Set(todas.map((x) => mapa.get(x.setor_id)).filter(Boolean))].sort(),
          cidades: [...new Set(todas.map((x) => (x.cidade ? `${x.cidade}${x.estado ? '/' + x.estado : ''}` : '')).filter(Boolean))].sort(),
          modalidades: [...new Set(todas.map((x) => x.modalidade))],
          tipos: [...new Set(todas.map((x) => x.tipo))].map((t) => ({ valor: t, rotulo: TIPOS[t] ?? t })),
        },
      })
    },
  },

  {
    metodo: 'GET', padrao: 'publico/vagas/:slug', publica: true,
    h: async ({ db, params, agora }) => {
      const hoje = hojeISO(agora)
      const r = await db.query(
        `select ${CAMPOS_PUBLICOS}, v.texto_publico, v.responsabilidades, v.atividades, v.requisitos_obrigatorios, v.requisitos_desejaveis, v.formacao, v.experiencia,
           v.idiomas, v.certificacoes, v.beneficios, v.divulgar_salario, v.salario_min, v.salario_max, v.moeda, v.tipo_remuneracao, v.perguntas_triagem, v.documentos_necessarios, v.viagens,
           v.sobre_empresa, v.endereco, v.desafios, v.jornada, v.etapas_processo, v.atualizado_em
         from rec_vagas v where v.slug = $2 and ${FILTRO_PUBLICADA}`, [hoje, params.slug])
      const v = r.rows[0]
      if (!v) {
        // Distingue "pausada/encerrada" de "não existe" com mensagem útil, sem expor nada interno.
        const x = (await db.query(`select status, arquivada, ${DIA('publicar_em')} as publicar_em, ${DIA('encerra_candidaturas_em')} as encerra_candidaturas_em from rec_vagas where slug = $1`, [params.slug])).rows[0]
        if (x && x.status !== 'rascunho' && x.status !== 'em_aprovacao' && x.status !== 'ajustes' && x.status !== 'aprovada') {
          const a = vagaAceitaCandidaturas(x, hoje)
          if (!a.ok) return { status: 410, corpo: { erro: a.motivo, encerrada: true } }
        }
        throw naoEncontrado('Vaga não encontrada ou não disponível.')
      }
      const mapa = new Map((await setores(db)).map((s) => [s.id, s.nome]))
      const priv = await obterPrivacidade(db)
      return ok({
        ...itemPublico(v, mapa),
        sobreEmpresa: v.sobre_empresa, endereco: v.endereco, desafios: v.desafios, jornada: v.jornada, etapasProcesso: v.etapas_processo ?? [],
        atualizadaEm: v.atualizado_em,
        descricao: v.texto_publico, responsabilidades: v.responsabilidades, atividades: v.atividades,
        requisitosObrigatorios: v.requisitos_obrigatorios, requisitosDesejaveis: v.requisitos_desejaveis, formacao: v.formacao, experiencia: v.experiencia,
        idiomas: v.idiomas, certificacoes: v.certificacoes, beneficios: v.beneficios, viagens: v.viagens,
        salario: v.divulgar_salario ? { min: v.salario_min === null ? null : Number(v.salario_min), max: v.salario_max === null ? null : Number(v.salario_max), moeda: v.moeda, tipo: v.tipo_remuneracao } : null,
        // A eliminatória é decisão interna: não vai para o público.
        perguntas: (v.perguntas_triagem as any[]).map((p) => ({ id: p.id, texto: p.texto, tipo: p.tipo, obrigatoria: !!p.obrigatoria, opcoes: p.opcoes })),
        documentosNecessarios: v.documentos_necessarios,
        privacidade: { versao: priv.versao, texto: priv.texto, contato: priv.contato, retencaoMeses: priv.retencaoMeses },
      })
    },
  },

  {
    // Imagem de capa: só de vaga publicada e dentro do prazo; nunca expõe nada além da imagem.
    metodo: 'GET', padrao: 'publico/vagas/:slug/imagem', publica: true, limite: 300,
    h: async ({ db, params, agora }) => {
      const hoje = agora.toISOString().slice(0, 10)
      const r = await db.query(`select v.imagem_arquivo_id from rec_vagas v where v.slug = $2 and v.imagem_arquivo_id is not null and ${FILTRO_PUBLICADA}`, [hoje, params.slug])
      if (!r.rows[0]) throw naoEncontrado('Imagem não encontrada.')
      const a = await baixarArquivo(db, r.rows[0].imagem_arquivo_id)
      if (!a?.binario) throw naoEncontrado('Imagem não encontrada.')
      return { ...a, binario: { ...a.binario, inline: true }, cabecalhos: { 'Cache-Control': 'public, max-age=300' } }
    },
  },

  {
    metodo: 'POST', padrao: 'publico/vagas/:slug/candidaturas', publica: true, limite: 6,
    h: async ({ db, params, req, agora }) => {
      const b = req.corpo ?? {}
      // Isca para robôs: campo invisível preenchido → finge sucesso sem gravar nada.
      if (typeof b.website === 'string' && b.website.trim()) return ok({ ok: true, mensagem: 'Candidatura recebida.' }, 201)

      const v = (await db.query(
        `select id, slug, titulo, status, arquivada, ${DIA('publicar_em')} as publicar_em, ${DIA('encerra_candidaturas_em')} as encerra_candidaturas_em,
           perguntas_triagem, mensagem_confirmacao, recrutador_id from rec_vagas where slug = $1`, [params.slug])).rows[0]
      if (!v) throw naoEncontrado('Vaga não encontrada.')
      const aceita = vagaAceitaCandidaturas(v, hojeISO(agora))
      if (!aceita.ok) return { status: 410, corpo: { erro: aceita.motivo, encerrada: true } }

      const nome = texto(b.nome, 'nome', { min: 3, max: 200 })
      const mail = validarEmail(b.email, 'email')
      const telefone = texto(b.telefone, 'telefone', { min: 8, max: 40 })
      const cidade = texto(b.cidade, 'cidade', { max: 100, obrigatorio: false })
      const uf = texto(b.uf, 'uf', { max: 2, obrigatorio: false }).toUpperCase()
      if (uf && !/^[A-Z]{2}$/.test(uf)) throw invalido('UF inválida.', { uf: 'Use a sigla com 2 letras' })
      const linkedin = texto(b.linkedin, 'linkedin', { max: 200, obrigatorio: false })
      if (linkedin && !/^https?:\/\//i.test(linkedin)) throw invalido('Informe o link completo do LinkedIn (começando com https://).', { linkedin: 'Link inválido' })
      let pretensao: number | null = null
      if (b.pretensao !== undefined && b.pretensao !== null && b.pretensao !== '') {
        pretensao = Number(b.pretensao)
        if (!Number.isFinite(pretensao) || pretensao < 0 || pretensao > 10_000_000) throw invalido('Pretensão salarial inválida.', { pretensao: 'Valor inválido' })
      }
      const disponibilidade = texto(b.disponibilidade, 'disponibilidade', { max: 200, obrigatorio: false }) || null
      if (b.consentimento !== true) throw invalido('Para enviar a candidatura é preciso ciência do aviso de privacidade.', { consentimento: 'Confirme que leu o aviso de privacidade' })

      // Triagem: valida cada pergunta da vaga (a decisão sobre as respostas é sempre humana).
      const respostasIn = (b.respostas ?? {}) as Record<string, unknown>
      const respostas: { perguntaId: string; texto: string; resposta: string }[] = []
      const campos: Record<string, string> = {}
      for (const p of v.perguntas_triagem as any[]) {
        const bruto = respostasIn[p.id]
        const val = typeof bruto === 'string' ? bruto.trim().slice(0, 2000) : bruto === true ? 'sim' : bruto === false ? 'nao' : ''
        if (!val) { if (p.obrigatoria) campos[`pergunta_${p.id}`] = 'Resposta obrigatória'; continue }
        if (p.tipo === 'sim_nao' && !['sim', 'nao'].includes(val)) { campos[`pergunta_${p.id}`] = 'Responda sim ou não'; continue }
        if (p.tipo === 'opcoes' && !(p.opcoes ?? []).includes(val)) { campos[`pergunta_${p.id}`] = 'Opção inválida'; continue }
        respostas.push({ perguntaId: p.id, texto: p.texto, resposta: val })
      }
      if (Object.keys(campos).length) throw invalido('Responda às perguntas obrigatórias.', campos)

      const up = validarUpload(b.curriculo, ['pdf', 'docx', 'doc', 'odt'], 'curriculo')
      const origem = enumerado(b.origem, 'origem', ORIGENS_PUBLICAS, 'portal')
      const token = novoToken()

      const out = await db.tx(async (t) => {
        const priv = await obterPrivacidade(t)
        const arq = await guardarArquivo(t, up, 'candidatura', null, null)
        const c = await criarCandidatura(t, { vagaId: v.id, candidato: { nome, email: mail, telefone, cidade, uf, linkedin }, origem, respostasTriagem: respostas, curriculoArquivoId: arq, pretensao, disponibilidade, tokenHash: hashToken(token) })
        await t.query('update arq_arquivos set dono_id = $2 where id = $1', [arq, c.candidaturaId])
        await registrarConsentimento(t, { candidatoId: c.candidatoId, candidaturaId: c.candidaturaId, finalidade: priv.finalidade, baseLegal: priv.baseLegal, versao: priv.versao, concedido: true, validoAte: somarMeses(hojeISO(agora), priv.retencaoMeses) })
        if (b.bancoTalentos === true) {
          const ate = somarMeses(hojeISO(agora), priv.retencaoMeses)
          await registrarConsentimento(t, { candidatoId: c.candidatoId, candidaturaId: c.candidaturaId, finalidade: 'banco_talentos', baseLegal: 'consentimento', versao: priv.versao, concedido: true, validoAte: ate })
          await t.query(`insert into rec_talentos (candidato_id, retencao_ate) values ($1,$2) on conflict (candidato_id) do update set retencao_ate = excluded.retencao_ate`, [c.candidatoId, ate])
        }
        const destinos = v.recrutador_id ? [v.recrutador_id] : await idsComPapel(t, 'rh')
        for (const d of destinos) await notificar(t, { destinatarioId: d, tipo: 'candidatura_nova', titulo: 'Nova candidatura recebida', corpo: `Vaga: ${v.titulo}`, link: `/recrutamento/candidatos/${c.candidaturaId}`, chave: `cand-nova-${c.candidaturaId}` })
        await auditar(t, null, 'candidatura', c.candidaturaId, 'recebida_portal', { vagaId: v.id, origem })
        return c
      })

      // Confirmação por e-mail: o status reflete o que realmente aconteceu.
      let emailStatus = 'pendente'
      try {
        const { vars, email: para, candidatoId } = await variaveisCandidatura(db, out.candidaturaId)
        const link = `${urlPortal()}/carreiras/acompanhar?codigo=${encodeURIComponent(token)}`
        const m = await modeloPreenchido(db, 'confirmacao_candidatura', { ...vars, link_acompanhamento: link })
        const persistido = (await modeloPreenchido(db, 'confirmacao_candidatura', { ...vars, link_acompanhamento: '(enviado somente ao candidato)' })).corpo
        const r = await registrarEEnviar(db, { candidaturaId: out.candidaturaId, candidatoId, templateChave: 'confirmacao_candidatura', assunto: m.assunto, corpo: m.corpo, corpoPersistido: persistido, para, criadoPor: null, enviar: true })
        emailStatus = r.status
      } catch (e) { console.error('[publico] confirmação de candidatura', e instanceof Error ? e.message : e) }

      return ok({
        ok: true,
        mensagem: v.mensagem_confirmacao || 'Candidatura recebida! Analisaremos o seu perfil e entraremos em contato.',
        // Mostrado uma única vez: só o hash fica guardado.
        codigoAcompanhamento: token,
        confirmacaoPorEmail: emailStatus === 'enviada' ? 'enviada' : 'nao_enviada',
      }, 201)
    },
  },

  {
    metodo: 'POST', padrao: 'publico/candidaturas/acompanhar', publica: true, limite: 12,
    h: async ({ db, req }) => {
      const token = typeof req.corpo?.token === 'string' ? req.corpo.token.trim() : ''
      if (!token || token.length > 200) throw invalido('Informe o código de acompanhamento.', { token: 'Obrigatório' })
      const r = (await db.query(
        `select c.status, c.criado_em, c.atualizado_em, e.tipo as etapa_tipo, v.titulo
         from rec_candidaturas c join rec_vagas v on v.id = c.vaga_id left join rec_vaga_etapas e on e.id = c.etapa_id where c.token_hash = $1`, [hashToken(token)])).rows[0]
      if (!r) throw naoEncontrado('Código não encontrado. Confira se copiou o código completo.')
      const s = statusPublico(r.status, r.etapa_tipo)
      return ok({ vaga: r.titulo, situacao: s.rotulo, descricao: s.descricao, recebidaEm: r.criado_em, atualizadoEm: r.atualizado_em, podeDesistir: r.status === 'ativa' })
    },
  },

  {
    metodo: 'POST', padrao: 'publico/candidaturas/desistir', publica: true, limite: 6,
    h: async ({ db, req }) => {
      const token = typeof req.corpo?.token === 'string' ? req.corpo.token.trim() : ''
      if (!token) throw invalido('Informe o código de acompanhamento.')
      const c = (await db.query("select id, etapa_id, status from rec_candidaturas where token_hash = $1", [hashToken(token)])).rows[0]
      if (!c) throw naoEncontrado('Código não encontrado.')
      if (c.status !== 'ativa') throw conflito('Esta candidatura já não está em andamento.')
      await db.tx(async (t) => {
        await t.query("update rec_candidaturas set status = 'desistiu', motivo_saida = 'Desistência informada pelo candidato', encerrada_em = now(), atualizado_em = now() where id = $1", [c.id])
        await t.query("insert into rec_candidatura_movs (candidatura_id, de_etapa_id, para_etapa_id, de_status, para_status, motivo) values ($1,$2,$2,'ativa','desistiu','Desistência informada pelo candidato')", [c.id, c.etapa_id])
        await auditar(t, null, 'candidatura', c.id, 'desistencia_candidato', {})
      })
      return ok()
    },
  },
]

function itemPublico(v: any, mapa: Map<string, string>) {
  return {
    slug: v.slug, titulo: v.titulo, resumo: v.resumo, area: mapa.get(v.setor_id) ?? null, tipo: v.tipo, tipoRotulo: TIPOS[v.tipo] ?? v.tipo,
    regimeContratacao: v.regime_contratacao, modalidade: v.modalidade, cidade: v.cidade, estado: v.estado, pais: v.pais, senioridade: v.senioridade,
    publicadaEm: v.publicada_em, encerraEm: v.encerra_candidaturas_em,
    imagemUrl: v.tem_imagem ? `/api/v2/publico/vagas/${encodeURIComponent(v.slug)}/imagem` : null,
  }
}

void listaTexto
