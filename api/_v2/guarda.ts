/* ============================================================
   Regras de LEITURA e ESCRITA da sincronização legada (/api/estado).
   ------------------------------------------------------------
   As telas legadas guardam as coleções em JSONB (app_<coleção>) e
   alteram dados no navegador. Antes desta camada, o servidor
   entregava o banco inteiro a qualquer pessoa logada e aceitava a
   substituição de coleções inteiras. Agora:
   - LEITURA: cada pessoa recebe só os registros que pode ver, e os
     campos sensíveis de terceiros vêm removidos (filtrarEstado).
   - ESCRITA: cada registro criado/alterado/removido passa pela regra
     da sua coleção (POLITICAS), espelhando as permissões das ações
     da interface (src/lib/store.ts). O que a pessoa não viu (campos
     removidos na leitura) é preservado do registro guardado.
   Funções puras, testáveis (api/_v2/estadoLegado.test.ts).
   ============================================================ */
import { capacidadesDe, type Capacidade, type FuncaoAdicional } from '../../src/domain/permissions.js'
import { comunicadoVisivel, eventoVisivel, podeAlinharPeriodo, podeGerenciarEvento, podeVerPeriodo } from '../../src/domain/visibilidade.js'
import { avaliarPontuacao } from '../../src/domain/gamificacao.js'
import { pesquisaAbertaPara } from '../../src/domain/pesquisas.js'
import { chaveApoio, chaveAutor } from '../../src/domain/anonimato.js'
import { canonico, chaveRegistro } from '../../src/domain/sincronia.js'
import type { Papel } from '../../src/lib/types.js'

type Obj = Record<string, any>

export class Recusa extends Error {
  constructor(mensagem: string, public status = 403) { super(mensagem) }
}
const recusa = (m: string, status = 403): never => { throw new Recusa(m, status) }

export interface CtxLegado {
  eu: Obj
  caps: Set<Capacidade>
  /** RH ou administração: leitura e escrita amplas (salvo as exceções de cada coleção). */
  priv: boolean
  admin: boolean
  /** Diretoria: leitura gerencial (contratos, documentos, financeiro), sem dados pessoais sensíveis de terceiros. */
  diretoria: boolean
  /** Áreas que a pessoa lidera. */
  lidera: Set<string>
  /** Estado atual completo (como está no banco). */
  estado: Obj
  /** Segredo anônimo da pessoa (caixa de sugestões). */
  segredo: string
  /** Data de hoje (AAAA-MM-DD) e instante atual, injetáveis em testes. */
  hoje: string
  agora: Date
}

export function montarContexto(estado: Obj, colaboradorId: string, funcoes: FuncaoAdicional[], segredo: string, agora = new Date()): CtxLegado | null {
  const eu = (estado.colaboradores as Obj[] | undefined)?.find((c) => c.id === colaboradorId)
  if (!eu) return null
  const papel = eu.papel as Papel
  const lidera = new Set<string>((estado.setores as Obj[] ?? []).filter((s) => s.gestorId === eu.id || (s.liderancaIds ?? []).includes(eu.id)).map((s) => s.id))
  return {
    eu, caps: capacidadesDe(papel, funcoes), priv: papel === 'rh' || papel === 'admin', admin: papel === 'admin', diretoria: papel === 'diretoria',
    lidera, estado, segredo, hoje: agora.toISOString().slice(0, 10), agora,
  }
}

/* ---------- utilidades ---------- */
const igual = (a: unknown, b: unknown) => canonico(a) === canonico(b)
const tem = (c: CtxLegado, cap: Capacidade) => c.caps.has(cap)
const meuId = (c: CtxLegado) => c.eu.id as string
const setorDe = (c: CtxLegado, pessoaId: unknown) => (c.estado.colaboradores as Obj[]).find((p) => p.id === pessoaId)?.setorId as string | undefined
const lideraPessoa = (c: CtxLegado, pessoaId: unknown) => {
  const p = (c.estado.colaboradores as Obj[]).find((x) => x.id === pessoaId)
  return !!p && (c.lidera.has(p.setorId) || p.responsavelId === meuId(c))
}
const exigir = (ok: boolean, m = 'Você não tem permissão para esta ação.') => { if (!ok) recusa(m) }
const exigirCap = (c: CtxLegado, cap: Capacidade, m?: string) => exigir(tem(c, cap), m)
const exigirPriv = (c: CtxLegado) => exigir(c.priv, 'Apenas RH ou administração alteram esta informação.')

/** Só os campos listados mudaram (os demais são idênticos). */
function soMudou(antes: Obj, depois: Obj, campos: string[]): boolean {
  const livres = new Set(campos)
  const chaves = new Set([...Object.keys(antes), ...Object.keys(depois)])
  for (const k of chaves) if (!livres.has(k) && !igual(antes[k], depois[k])) return false
  return true
}
/** A lista só ganhou ou perdeu `valor` (e nada mais). */
function alternouSo(antes: unknown, depois: unknown, valor: string): boolean {
  const a = new Set((antes as string[] | undefined) ?? []), d = new Set((depois as string[] | undefined) ?? [])
  a.delete(valor); d.delete(valor)
  return a.size === d.size && [...a].every((x) => d.has(x))
}
function pick(r: Obj, campos: string[]): Obj {
  const o: Obj = {}
  for (const k of campos) if (r[k] !== undefined) o[k] = r[k]
  return o
}

/** Restaura do registro guardado os campos que a pessoa não viu (removidos ou mascarados na leitura). */
export function mesclar(novo: Obj, antes: Obj, visto: Obj): Obj {
  const out = { ...novo }
  for (const k of Object.keys(antes)) if (!igual(visto[k], antes[k])) out[k] = antes[k]
  return out
}

/* ---------- contexto de escrita (lote) ---------- */
export interface CtxEscrita extends CtxLegado {
  /** Registros que o lote grava, por coleção e chave (null = removido). */
  lote: Record<string, Map<string, Obj | null>>
  /** Lançamentos de pontos aceitos até aqui no lote (para limites e duplicidade). */
  ledger: Obj[]
  /** Reconhecimentos enviados no lote (limite mensal). */
  reconhecimentosNoLote: number
  /** Pesquisas respondidas no lote (uma resposta por participação). */
  respostasNoLote: Set<string>
  /** Pessoas (entre as removidas no lote) com registros no módulo financeiro. */
  historicoFinanceiro: Set<string>
}
/** Registro como fica DEPOIS do lote (lote tem prioridade sobre o banco). */
function depois(c: CtxEscrita, colecao: string, chave: string): Obj | null {
  const l = c.lote[colecao]
  if (l?.has(chave)) return l.get(chave) ?? null
  return ((c.estado[colecao] as Obj[] | undefined) ?? []).find((r) => chaveRegistro(colecao, r) === chave) ?? null
}

/** Remoções que o servidor ignora em silêncio (ex.: a interface corta a trilha de auditoria exibida). */
export const IGNORAR = Symbol('ignorar')

export interface Politica {
  ver?: (r: Obj, c: CtxLegado) => boolean
  redigir?: (r: Obj, c: CtxLegado) => Obj
  /** `antes` = guardado (completo) ou null; `novo` = enviado já mesclado, ou null (remoção). Devolve o que gravar. */
  escrever: (antes: Obj | null, novo: Obj | null, c: CtxEscrita) => Obj | null | typeof IGNORAR
}

const soPriv: Politica = { escrever: (_a, n, c) => { exigirPriv(c); return n } }
const comCap = (cap: Capacidade): Politica => ({ escrever: (_a, n, c) => { exigirCap(c, cap); return n } })
const proprioOuPriv = (campo = 'colaboradorId', gerencial = false) => (r: Obj, c: CtxLegado) => c.priv || (gerencial && c.diretoria) || r[campo] === meuId(c)

/* ---------- pessoas ---------- */
/** Campos de terceiros visíveis a quem não é RH (diretório e organização). */
const PUBLICOS = ['id', 'nome', 'nomeSocial', 'email', 'telefone', 'avatarCor', 'papel', 'setorId', 'cargoId', 'unidadeId', 'status', 'dataEntrada', 'cidade', 'uf', 'regime', 'privacidade', 'responsavelId', 'fusoHorario']
/** O que a própria pessoa altera no próprio cadastro (Meu perfil, privacidade, diversidade, perfil comportamental). */
const AUTO_EDITAVEIS = new Set(['nomeSocial', 'telefone', 'cidade', 'uf', 'nascimento', 'banco', 'agencia', 'conta', 'pixTipo', 'pixChave',
  'emergenciaNome', 'emergenciaTelefone', 'emergenciaParentesco', 'endereco', 'celular', 'emailPessoal', 'escolaridade', 'curso',
  'tamanhoCamisa', 'fusoHorario', 'privacidade', 'diversidade', 'perfil'])

const colaboradores: Politica = {
  redigir: (r, c) => {
    if (c.priv || r.id === meuId(c)) return r
    const o = pick(r, PUBLICOS)
    if (c.diretoria) {
      // Indicadores executivos: idade média, escolaridade e encerramentos (sem a observação).
      Object.assign(o, pick(r, ['nascimento', 'escolaridade', 'curso']))
      if (r.encerramento) o.encerramento = pick(r.encerramento, ['data', 'motivoId'])
    } else if (r.nascimento && r.privacidade?.mostrarAniversario) {
      // Celebrações mostram dia e mês; o ano nunca sai do servidor.
      o.nascimento = `2000${String(r.nascimento).slice(4, 10)}`
    }
    return o
  },
  escrever: (antes, novo, c) => {
    if (!antes) {
      exigir(tem(c, 'pessoas:gerenciar'), 'Apenas RH ou administração cadastram pessoas.')
      if (!c.admin && !['colaborador', 'gestor'].includes(novo!.papel)) recusa('Apenas a administração concede este papel.')
      return novo
    }
    if (!novo) {
      exigir(c.admin, 'Apenas a administração exclui cadastros.')
      // Histórico contratual e financeiro tem prazo de guarda: quem tem esse histórico é anonimizado, não excluído.
      const temHistorico = c.historicoFinanceiro.has(antes.id) || ['contratos', 'notas', 'reembolsos', 'documentos']
        .some((k) => ((c.estado[k] as Obj[] | undefined) ?? []).some((r) => r.colaboradorId === antes.id))
      if (temHistorico) recusa('Esta pessoa tem contratos, documentos, notas ou pagamentos registrados. Encerre a parceria e use a anonimização (LGPD), que preserva o histórico obrigatório.')
      return null
    }
    if (antes.id !== novo.id) recusa('Identificador não pode mudar.')
    if (c.priv) {
      if (antes.papel !== novo.papel && !c.admin) recusa('Apenas a administração altera papéis.')
      return novo
    }
    const concluiuIntegracao = antes.status === 'integracao' && novo.status === 'ativo'
    if (antes.id === meuId(c)) {
      const chaves = new Set([...Object.keys(antes), ...Object.keys(novo)])
      for (const k of chaves) {
        if (AUTO_EDITAVEIS.has(k) || igual(antes[k], novo[k])) continue
        if (k === 'status' && concluiuIntegracao) continue
        recusa(k === 'papel' ? 'Apenas a administração altera papéis.' : 'Área, função, gestor, status, e-mail e dados do contrato são alterados pelo RH.')
      }
      return novo
    }
    // Terceiros: só a conclusão da integração por quem coordena a área.
    if (concluiuIntegracao && lideraPessoa(c, antes.id) && soMudou(antes, novo, ['status'])) return novo
    return recusa('Você só pode alterar o próprio cadastro.')
  },
}

/* ---------- financeiro legado ---------- */
const reembolsos: Politica = {
  ver: (r, c) => c.priv || c.diretoria || r.colaboradorId === meuId(c) || (tem(c, 'reembolsos:aprovar_area') && c.lidera.has(setorDe(c, r.colaboradorId) ?? '')),
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    if (!antes) {
      if (tem(c, 'financeiro:gerenciar')) return novo
      exigir(novo!.colaboradorId === me, 'Você só pode pedir reembolso em seu nome.')
      exigir(novo!.status === 'pendente' && !novo!.aprovadorId && !novo!.pagoEm && !novo!.aprovadoEm, 'Pedido de reembolso inválido.')
      return novo
    }
    if (!novo) {
      exigirCap(c, 'financeiro:gerenciar')
      // Reembolso aprovado, em pagamento ou pago é histórico financeiro: não se apaga.
      if (!['pendente', 'recusado'].includes(antes.status)) recusa('Reembolso aprovado ou pago não pode ser excluído (histórico financeiro).')
      return null
    }
    if (antes.colaboradorId === me && !igual(antes.status, novo.status)) recusa('Você não pode decidir o próprio reembolso.')
    // Pagamento de reembolso passa por Contas a pagar (autorização + registro com comprovante); o servidor atualiza o status.
    if (!igual(antes.status, novo.status) && (['pagamento', 'pago'].includes(novo.status) || ['pagamento', 'pago'].includes(antes.status))) {
      recusa('O pagamento de reembolsos é feito em Financeiro › Contas a pagar.')
    }
    if (tem(c, 'financeiro:gerenciar')) return novo
    const lider = tem(c, 'reembolsos:aprovar_area') && c.lidera.has(setorDe(c, antes.colaboradorId) ?? '')
    exigir(lider && antes.status === 'pendente' && ['aprovado', 'recusado'].includes(novo.status) && soMudou(antes, novo, ['status', 'aprovadorId', 'aprovadoEm'])
      && (novo.status !== 'aprovado' || novo.aprovadorId === me), 'A liderança aprova ou recusa pedidos pendentes da própria área; pagamento é com o financeiro.')
    return novo
  },
}

/**
 * Contratos, documentos e notas fiscais agora vivem no módulo financeiro (api/_v2/modulos/financeiro.ts), com
 * arquivos reais, fluxo de aprovação e trilha. As coleções legadas viram ESPELHO mantido pelo servidor (leitura das
 * telas antigas); a interface não grava mais nelas.
 */
const espelho = (onde: string, gerencial = true): Politica => ({
  ver: proprioOuPriv('colaboradorId', gerencial),
  escrever: () => recusa(`Esta informação é mantida em ${onde}.`),
})
const notas = espelho('Financeiro › Notas fiscais')

/* ---------- disponibilidade ---------- */
const periodos: Politica = {
  ver: (r, c) => c.priv || r.colaboradorId === meuId(c) || podeVerPeriodo(r as never, c.eu as never, setorDe(c, r.colaboradorId)),
  redigir: (r, c) => {
    if (r.colaboradorId === meuId(c) || tem(c, 'disponibilidade:configurar')) return r
    const { observacaoPrivada: _o, ...resto } = r
    return resto
  },
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    if (tem(c, 'disponibilidade:configurar')) return novo
    if (!novo) return recusa('Cancele o período em vez de excluí-lo.')
    if (!antes) { exigir(novo.colaboradorId === me, 'Você só registra a própria disponibilidade.'); exigir(novo.status !== 'alinhado', 'O alinhamento é registrado pela liderança.'); return novo }
    if (antes.colaboradorId === me) {
      exigir(novo.colaboradorId === me, 'Período inválido.')
      if (novo.status === 'alinhado' && !(antes.status === 'alinhado' && igual(antes.alinhadoPorId, novo.alinhadoPorId) && igual(antes.alinhadoEm, novo.alinhadoEm))) recusa('O alinhamento é registrado pela liderança.')
      return novo
    }
    exigir(podeAlinharPeriodo(antes as never, c.eu as never, setorDe(c, antes.colaboradorId), c.estado.setores) && novo.status === 'alinhado' && novo.alinhadoPorId === me
      && soMudou(antes, novo, ['status', 'alinhadoPorId', 'alinhadoEm', 'atualizadoEm']), 'Você só registra o alinhamento de períodos da sua área.')
    return novo
  },
}

/* ---------- comunicação e eventos ---------- */
const comunicados: Politica = {
  ver: (r, c) => c.priv || r.autorId === meuId(c) || comunicadoVisivel(r as never, c.eu as never),
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    const gestor = (r: Obj) => tem(c, 'comunicados:publicar') && (r.autorId === me || tem(c, 'rh:painel'))
    if (!antes) { exigirCap(c, 'comunicados:publicar'); exigir(c.priv || novo!.autorId === me, 'Comunicado inválido.'); return novo }
    if (!novo) { exigir(gestor(antes)); return null }
    if (gestor(antes)) { exigir(c.priv || igual(antes.autorId, novo.autorId), 'O autor não pode mudar.'); return novo }
    exigir(soMudou(antes, novo, ['lidoPor']) && alternouSo(antes.lidoPor, novo.lidoPor, me) && (novo.lidoPor ?? []).includes(me), 'Você só pode confirmar a própria leitura.')
    return novo
  },
}

const eventos: Politica = {
  ver: (r, c) => c.priv || eventoVisivel(r as never, c.eu as never),
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    const gere = (r: Obj) => podeGerenciarEvento(r as never, c.eu as never, c.estado.setores)
    if (!antes) { exigir(tem(c, 'eventos:gerenciar') || (tem(c, 'eventos:gerenciar_area') && gere(novo!)), 'Você não pode criar este evento.'); return novo }
    if (!novo) { exigir(gere(antes)); return null }
    if (gere(antes)) { exigir(tem(c, 'eventos:gerenciar') || gere(novo), 'O evento ficaria fora das suas áreas.'); return novo }
    exigir(soMudou(antes, novo, ['confirmados', 'interessados']) && alternouSo(antes.confirmados, novo.confirmados, me) && alternouSo(antes.interessados, novo.interessados, me),
      'Você só pode responder por você.')
    return novo
  },
}

/* ---------- gamificação ---------- */
function validarLancamento(n: Obj, c: CtxEscrita): void {
  const me = meuId(c)
  if (n.acao === 'ajuste_manual') { exigirCap(c, 'gamificacao:configurar', 'Ajustes de pontos são feitos pela gestão da gamificação.'); return }
  const quando = Date.parse(n.criadoEm)
  if (!Number.isFinite(quando) || Math.abs(quando - c.agora.getTime()) > 36 * 3600 * 1000) recusa('Lançamento de pontos com data inválida.', 409)
  const r = avaliarPontuacao(c.ledger as never, c.estado.regras ?? [], { pessoaId: n.colaboradorId, acao: n.acao, referenciaId: n.referenciaId, descricao: n.descricao, pontos: n.pontos, agora: n.criadoEm }, () => n.id)
  if (!r.ok) recusa('Pontuação não aplicável (já registrada, limite atingido ou regra inativa). Os dados foram atualizados.', 409)
  const regra = (c.estado.regras as Obj[]).find((x) => x.acao === n.acao)!
  const ref = String(n.referenciaId ?? '')
  let esperado = regra.pontos as number
  const proprio = n.colaboradorId === me
  switch (n.acao) {
    case 'desafio_concluido': {
      const d = depois(c, 'desafios', ref)
      exigir(!!d && (d.participantes ?? []).includes(n.colaboradorId), 'Desafio inválido.')
      esperado = d!.pontosBonus
      break
    }
    case 'iniciativa_concluida': {
      const i = depois(c, 'iniciativas', ref)
      exigir(!!i && i.status === 'concluida' && i.voluntarioId === n.colaboradorId && !proprio && tem(c, 'iniciativas:gerenciar'), 'Iniciativa não confirmada.')
      esperado = i!.pontos
      break
    }
    case 'participacao_evento': {
      const e = depois(c, 'eventos', ref)
      exigir(!!e && (e.presencas ?? []).includes(n.colaboradorId) && podeGerenciarEvento(e as never, c.eu as never, c.estado.setores), 'Presença não registrada pela organização.')
      break
    }
    case 'reconhecimento_recebido': {
      const rc = depois(c, 'reconhecimentos', ref)
      exigir(!!rc && rc.deId === me && rc.paraId === n.colaboradorId, 'Reconhecimento inválido.')
      break
    }
    case 'reconhecimento_enviado': {
      const rc = depois(c, 'reconhecimentos', ref)
      exigir(proprio && !!rc && rc.deId === me, 'Reconhecimento inválido.')
      break
    }
    case 'conteudo_concluido': exigir(proprio && !!depois(c, 'progressoConteudos', `${me}|${ref}`), 'Conteúdo não concluído.'); break
    case 'pesquisa_respondida': exigir(proprio && !!depois(c, 'participacoes', `${ref}|${me}`), 'Pesquisa não respondida.'); break
    case 'integracao_concluida': {
      const p = depois(c, 'processos', ref)
      exigir(!!p && p.colaboradorId === n.colaboradorId && !!p.concluidoEm, 'Integração não concluída.')
      break
    }
    case 'perfil_completo': exigir(proprio, 'Pontuação inválida.'); break
    default: recusa('Pontuação inválida.')
  }
  exigir(Number(n.pontos) === Math.max(0, Number(esperado)), 'Pontuação diferente da regra configurada.')
  c.ledger.push(n)
}

const lancamentos: Politica = {
  redigir: (r, c) => (c.priv || r.colaboradorId === meuId(c) || r.acao !== 'pesquisa_respondida' ? r : { ...r, referenciaId: '' }),
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'gamificacao:configurar', 'O histórico de pontos não pode ser alterado; use o estorno.'); return novo }
    validarLancamento(novo, c)
    return novo
  },
}

const conquistas: Politica = {
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'gamificacao:configurar'); return novo }
    const b = (c.estado.badges as Obj[]).find((x) => x.id === novo.badgeId)
    exigir(!!b && b.ativa !== false, 'Conquista inválida.')
    return novo
  },
}

const reconhecimentos: Politica = {
  ver: (r, c) => c.priv || r.publico || r.deId === meuId(c) || r.paraId === meuId(c),
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'gamificacao:configurar'); return novo }
    const me = meuId(c)
    exigir(novo.deId === me && novo.paraId !== me && (c.estado.colaboradores as Obj[]).some((p) => p.id === novo.paraId), 'Reconhecimento inválido.')
    const mes = c.hoje.slice(0, 7)
    const enviados = (c.estado.reconhecimentos as Obj[]).filter((r) => r.deId === me && String(r.criadoEm).slice(0, 7) === mes).length + c.reconhecimentosNoLote
    const limite = c.estado.config?.gamificacao?.limiteReconhecimentosEnviadosMes
    if (typeof limite === 'number' && enviados >= limite) recusa('Limite mensal de reconhecimentos atingido.')
    c.reconhecimentosNoLote++
    return novo
  },
}

const desafios: Politica = {
  escrever: (antes, novo, c) => {
    if (tem(c, 'gamificacao:configurar')) return novo
    exigir(!!antes && !!novo && soMudou(antes, novo, ['participantes']) && alternouSo(antes.participantes, novo.participantes, meuId(c)), 'Você só pode entrar ou sair de um desafio.')
    return novo
  },
}

const iniciativas: Politica = {
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    if (!antes || !novo) { exigirCap(c, 'iniciativas:gerenciar'); return novo }
    if (tem(c, 'iniciativas:gerenciar')) {
      if (novo.status === 'concluida' && antes.status !== 'concluida' && antes.voluntarioId === me) recusa('Outra pessoa da organização precisa confirmar a sua contribuição.')
      return novo
    }
    const assumir = antes.status === 'aberta' && novo.status === 'andamento' && novo.voluntarioId === me && soMudou(antes, novo, ['status', 'voluntarioId'])
    const desistir = antes.voluntarioId === me && antes.status === 'andamento' && novo.status === 'aberta' && novo.voluntarioId == null && soMudou(antes, novo, ['status', 'voluntarioId'])
    const contribuir = antes.voluntarioId === me && novo.voluntarioId === me && novo.status === 'revisao' && ['andamento', 'revisao'].includes(antes.status) && soMudou(antes, novo, ['status', 'entrega', 'concluidaEm'])
    exigir(assumir || desistir || contribuir, 'Ação não permitida nesta iniciativa.')
    return novo
  },
}

/* ---------- integração e encerramento ---------- */
const processos: Politica = {
  ver: (r, c) => c.priv || r.colaboradorId === meuId(c) || c.lidera.has(setorDe(c, r.colaboradorId) ?? ''),
  escrever: (antes, novo, c) => {
    if (tem(c, 'onboarding:gerenciar')) return novo
    exigir(!!antes && !!novo && soMudou(antes, novo, ['itens', 'concluidoEm']), 'Apenas o RH inicia ou remove processos.')
    const me = meuId(c)
    const a = antes!.itens as Obj[], d = novo!.itens as Obj[]
    exigir(Array.isArray(d) && a.length === d.length, 'Itens do processo não podem ser alterados.')
    const lidera = c.lidera.has(setorDe(c, antes!.colaboradorId) ?? '')
    a.forEach((ia, i) => {
      const id = d[i]
      exigir(ia.id === id.id && soMudou(ia, id, ['feito', 'feitoEm', 'feitoPorId']), 'Itens do processo não podem ser alterados.')
      if (igual(ia, id)) return
      exigir((ia.responsavel === 'pessoa' && antes!.colaboradorId === me) || (ia.responsavel === 'lideranca' && lidera), 'Este item é de responsabilidade de outra pessoa.')
      if (id.feito) exigir(id.feitoPorId === me, 'Item inválido.')
    })
    return novo
  },
}

/* ---------- pesquisas legadas (anônimas) ---------- */
const respostas: Politica = {
  ver: (_r, c) => c.priv || c.diretoria,
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'pesquisas:gerenciar'); return novo }
    const me = meuId(c)
    const chavePart = `${novo.pesquisaId}|${me}`
    // A resposta só entra junto com o registro de participação (uma por pessoa), sem guardar quem respondeu.
    const part = c.lote.participacoes
    exigir(!!part?.get(chavePart) && !(c.estado.participacoes as Obj[]).some((p) => p.pesquisaId === novo.pesquisaId && p.colaboradorId === me), 'Você já respondeu esta pesquisa.')
    exigir(!c.respostasNoLote.has(novo.pesquisaId), 'Resposta duplicada.')
    c.respostasNoLote.add(novo.pesquisaId)
    exigir(novo.setorId === c.eu.setorId, 'Resposta inválida.')
    return novo
  },
}
const participacoes: Politica = {
  ver: proprioOuPriv('colaboradorId', true),
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'pesquisas:gerenciar'); return novo }
    exigir(novo.colaboradorId === meuId(c), 'Participação inválida.')
    const p = (c.estado.pesquisas as Obj[]).find((x) => x.id === novo.pesquisaId)
    exigir(!!p && pesquisaAbertaPara(p as never, c.eu.setorId, c.hoje), 'Esta pesquisa não está aberta para você.')
    return novo
  },
}

/* ---------- avaliações ---------- */
const participanteDe = (c: CtxLegado, id: unknown) => (c.estado.participantesCiclo as Obj[]).find((p) => p.id === id)
const respostasAvaliacao: Politica = {
  ver: (r, c) => {
    if (c.priv || c.diretoria) return true
    const p = participanteDe(c, r.participanteId)
    return !!p && (p.avaliadorId === meuId(c) || p.avaliadoId === meuId(c))
  },
  redigir: (r, c) => {
    if (c.priv) return r
    const p = participanteDe(c, r.participanteId)
    if (p && (p.avaliadorId === meuId(c) || p.avaliadoId === meuId(c))) return r
    return pick(r, ['id', 'cicloId', 'participanteId', 'respondidaEm'])
  },
  escrever: (antes, novo, c) => {
    if (antes || !novo) { exigirCap(c, 'desenvolvimento:gerenciar'); return novo }
    const p = participanteDe(c, novo.participanteId)
    exigir(!!p && (p.avaliadorId === meuId(c) || tem(c, 'desenvolvimento:gerenciar')), 'Esta avaliação não é sua.')
    exigir(!(c.estado.respostasAvaliacao as Obj[]).some((r) => r.participanteId === novo.participanteId), 'Avaliação já respondida.')
    return novo
  },
}
const avaliacoesInicio: Politica = {
  ver: (r, c) => c.priv || r.avaliadorId === meuId(c) || r.avaliadoId === meuId(c),
  escrever: (antes, novo, c) => {
    if (tem(c, 'desenvolvimento:gerenciar')) return novo
    exigir(!!antes && !!novo && antes.avaliadorId === meuId(c) && antes.status === 'pendente' && novo.status === 'respondida'
      && soMudou(antes, novo, ['notas', 'nota', 'comentario', 'continuidade', 'respondidaEm', 'status']), 'Esta avaliação não é sua.')
    return novo
  },
}

/* ---------- feedbacks ---------- */
const feedbacks: Politica = {
  ver: (r, c) => c.priv || r.autorId === meuId(c) || (r.colaboradorId === meuId(c) && r.visivelParaPessoa) || (tem(c, 'feedbacks:registrar') && lideraPessoa(c, r.colaboradorId)),
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    if (tem(c, 'pessoas:gerenciar')) return novo
    if (antes) exigir(antes.autorId === me, 'Você só altera os próprios feedbacks.')
    if (novo) exigir(novo.autorId === me && novo.colaboradorId !== me && tem(c, 'feedbacks:registrar') && lideraPessoa(c, novo.colaboradorId), 'Feedback só para pessoas das suas áreas.')
    return novo
  },
}

/* ---------- apresentações e sugestões ---------- */
const apresentacoes: Politica = {
  ver: (r, c) => r.criadaPorId === meuId(c) || !!r.compartilhada || tem(c, 'admin:usuarios'),
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    if (!novo) { exigir(antes!.criadaPorId === me || tem(c, 'admin:usuarios')); return null }
    exigir(novo.criadaPorId === me && (!antes || antes.criadaPorId === me), 'Você só edita as próprias apresentações.')
    return novo
  },
}

const sugestoes: Politica = {
  escrever: (antes, novo, c) => {
    const me = meuId(c)
    const minha = chaveAutor(me, c.segredo)
    if (!antes) {
      exigir(novo!.autorChave === minha && novo!.status === 'aguardando' && !(novo!.apoios ?? []).length && !novo!.resposta, 'Sugestão inválida.')
      return novo
    }
    if (!novo) { exigir((antes.autorChave === minha && antes.status === 'aguardando') || tem(c, 'sugestoes:moderar'), 'Você só exclui as próprias sugestões ainda em análise.'); return null }
    const livres = ['apoios']
    if (antes.autorChave === minha && antes.status === 'aguardando') livres.push('titulo', 'descricao', 'categoria', 'editadaEm')
    if (tem(c, 'sugestoes:moderar')) livres.push('status', 'resposta', 'respondidaEm', 'moderadorId')
    exigir(soMudou(antes, novo, livres), 'Você não pode alterar esta sugestão.')
    if (!igual(antes.apoios, novo.apoios)) exigir(alternouSo(antes.apoios, novo.apoios, chaveApoio(me, antes.id, c.segredo)), 'Apoio inválido.')
    return novo
  },
}

/* ---------- tabela de políticas ---------- */
export const POLITICAS: Record<string, Politica> = {
  colaboradores,
  setores: comCap('estrutura:gerenciar'),
  unidades: comCap('estrutura:gerenciar'),
  cargos: {
    redigir: (r, c) => {
      if (c.priv || tem(c, 'cargos:ver_faixas') || !r.faixaValor || r.faixaValor.visivel) return r
      const { faixaValor: _f, ...resto } = r
      return resto
    },
    escrever: (_a, n, c) => { exigirCap(c, 'estrutura:gerenciar'); return n },
  },
  contratos: espelho('Financeiro › Contratos'),
  documentos: espelho('Documentos (envio com arquivo)'),
  reembolsos,
  notas,
  periodos,
  comunicados,
  eventos,
  beneficios: comCap('beneficios:gerenciar'),
  treinamentos: comCap('onboarding:gerenciar'),
  progressoConteudos: {
    ver: proprioOuPriv(),
    escrever: (antes, novo, c) => {
      if (c.priv) return novo
      exigir(!antes && !!novo && novo.colaboradorId === meuId(c) && (c.estado.treinamentos as Obj[]).some((t) => t.id === novo.treinamentoId), 'Conclusão inválida.')
      return novo
    },
  },
  badges: comCap('gamificacao:configurar'),
  conquistas,
  regras: comCap('gamificacao:configurar'),
  lancamentos,
  desafios,
  reconhecimentos,
  iniciativas,
  checklists: comCap('onboarding:gerenciar'),
  processos,
  motivosEncerramento: comCap('estrutura:gerenciar'),
  tiposRegistro: comCap('estrutura:gerenciar'),
  registros: { ver: (_r, c) => c.priv, escrever: (_a, n, c) => { exigirCap(c, 'pessoas:gerenciar'); return n } },
  objetivos: {
    escrever: (antes, novo, c) => {
      if (tem(c, 'estrutura:gerenciar')) return novo
      exigir((!antes || c.lidera.has(antes.setorId)) && (!novo || c.lidera.has(novo.setorId)), 'Você só gerencia objetivos das suas áreas.')
      return novo
    },
  },
  pesquisas: comCap('pesquisas:gerenciar'),
  respostas,
  participacoes,
  parabens: {
    ver: (r, c) => c.priv || r.deId === meuId(c) || r.paraId === meuId(c),
    escrever: (antes, novo, c) => {
      if (c.priv) return novo
      exigir(!antes && !!novo && novo.deId === meuId(c) && novo.paraId !== meuId(c), 'Mensagem inválida.')
      return novo
    },
  },
  notificacoes: {
    // Cada pessoa vê só as próprias notificações (inclusive RH e administração).
    ver: (r, c) => r.colaboradorId === meuId(c),
    escrever: (antes, novo, c) => {
      if (!antes) { exigir(!!novo && typeof novo.colaboradorId === 'string' && novo.lida === false, 'Notificação inválida.'); return novo }
      exigir(antes.colaboradorId === meuId(c) && (!novo || soMudou(antes, novo, ['lida'])), 'Notificação de outra pessoa.')
      return novo
    },
  },
  auditoria: {
    ver: (_r, c) => c.priv,
    escrever: (antes, novo, c) => {
      if (!novo) return IGNORAR // a interface só exibe as últimas; a trilha nunca é apagada
      exigir(!antes && novo.atorId === meuId(c), 'A trilha de auditoria não pode ser alterada.')
      return novo
    },
  },
  historicoFuncao: { ver: proprioOuPriv(), escrever: (_a, n, c) => { exigirPriv(c); return n } },
  dependentes: {
    ver: proprioOuPriv('colaboradorId', true),
    redigir: (r, c) => (c.priv || r.colaboradorId === meuId(c) ? r : pick(r, ['id', 'colaboradorId', 'parentesco'])),
    escrever: (antes, novo, c) => {
      if (tem(c, 'beneficios:gerenciar')) return novo
      exigir((!antes || antes.colaboradorId === meuId(c)) && (!novo || novo.colaboradorId === meuId(c)), 'Você só gerencia os próprios dependentes.')
      return novo
    },
  },
  exigencias: { ver: proprioOuPriv('colaboradorId', true), escrever: (_a, n, c) => { exigirCap(c, 'documentos:gerenciar'); return n } },
  beneficiarios: { ver: proprioOuPriv('colaboradorId', true), escrever: (_a, n, c) => { exigirCap(c, 'beneficios:gerenciar'); return n } },
  gruposCompetencia: comCap('desenvolvimento:gerenciar'),
  competencias: comCap('desenvolvimento:gerenciar'),
  ciclos: comCap('desenvolvimento:gerenciar'),
  participantesCiclo: {
    ver: (r, c) => c.priv || c.diretoria || r.avaliadorId === meuId(c) || r.avaliadoId === meuId(c),
    escrever: (_a, n, c) => { exigirCap(c, 'desenvolvimento:gerenciar'); return n },
  },
  respostasAvaliacao,
  avaliacoesInicio,
  classificacoesGrupo: { ver: (_r, c) => c.priv, escrever: (_a, n, c) => { exigirCap(c, 'desenvolvimento:gerenciar'); return n } },
  feedbacks,
  apresentacoes,
  sugestoes,
}

/** Garante que toda coleção conhecida tem regra (falha cedo se alguém criar uma coleção nova sem regra). */
export function politicaDe(colecao: string): Politica {
  const p = POLITICAS[colecao]
  if (!p) throw new Recusa(`Coleção desconhecida: ${colecao}`, 400)
  return p
}

/** Registro como a pessoa o vê (null = invisível). */
export function visao(colecao: string, r: Obj, c: CtxLegado): Obj | null {
  const p = politicaDe(colecao)
  if (p.ver && !p.ver(r, c)) return null
  return p.redigir ? p.redigir(r, c) : r
}

/** Estado filtrado para a pessoa: só o que ela pode ver, sem campos sensíveis de terceiros. */
export function filtrarEstado(estado: Obj, c: CtxLegado, colecoes: readonly string[]): Obj {
  const out: Obj = {}
  for (const nome of colecoes) {
    const lista = (estado[nome] as Obj[] | undefined) ?? []
    out[nome] = lista.map((r) => visao(nome, r, c)).filter((r): r is Obj => r !== null)
  }
  out.config = estado.config
  return out
}
