/* ============================================================
   4JURIS Pessoas · Adaptador de dados de DEMONSTRAÇÃO
   ------------------------------------------------------------
   Zustand + localStorage. Os dados existem APENAS neste navegador.
   Cada ação abaixo corresponde a um comando do contrato de API
   descrito em src/data/contrato.ts. Para conectar um backend:
   mantenha as assinaturas, troque o corpo por chamadas à API e
   use o retorno do servidor para atualizar o estado.

   Regras de negócio ficam em src/domain/* (funções puras).
   As ações também verificam permissões (defesa em profundidade),
   mas a autorização definitiva deve existir no servidor.
   ============================================================ */
import { validarMudancaGestor } from '@/domain/v2/organograma'
import { validarDepartamentoPai } from '@/domain/v2/departamentos'
import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import type {
  DB, Colaborador, Reembolso, NotaFiscal, Comunicado, Evento, Notificacao, Setor, Cargo, Unidade,
  Contrato, Documento, PeriodoIndisponibilidade, PoliticaDisponibilidade, RegraPontuacao, ConfigGamificacao,
  Desafio, Iniciativa, ValorCultural, ChecklistModelo, MotivoEncerramento, TipoRegistro, RegistroAdministrativo,
  Objetivo, Pesquisa, Papel, AcaoPontuavel, Badge, Treinamento,
  Dependente, Exigencia, GrupoCompetencia, Competencia, CicloAvaliativo, Feedback, CulturaOrganizacional, ConfigGeral,
  ConfigAvaliacaoInicio, PerfilComportamental, Diversidade, Endereco, Escolaridade, Beneficio,
  Apresentacao, SlideInstancia, TemaApresentacao, Sugestao, StatusSugestao, CategoriaSugestao,
} from './types'
import { seed, seedProducao } from './mock'
import { MODO_API } from '@/data/config'
import { uid } from './utils'
import { can, definirVisaoColaborador, type Capacidade } from '@/domain/permissions'
import { hojeISO, agoraISO } from '@/domain/datas'
import { avaliarPontuacao, conquistasNovas, MOTIVO_NAO_PONTUOU, progressoDesafio, saldo, validarNiveis, type EntradaPontuacao } from '@/domain/gamificacao'
import { validarPeriodo, sobreposicoesNaArea, type EntradaPeriodo } from '@/domain/disponibilidade'
import { criarProcesso } from '@/domain/jornada'
import { validarRespostas, pesquisaAbertaPara } from '@/domain/pesquisas'
import { cnpjValido, cpfValido, emailValido, soDigitos } from '@/domain/validacao'
import { areasLideradas, podeAlinharPeriodo, podeGerenciarEvento } from '@/domain/visibilidade'
import { chaveAutor, chaveApoio } from '@/domain/anonimato'
import { criarApresentacao as montarApresentacao, modeloPorId, novoSlide as montarSlide, ehEditorLivre } from '@/domain/apresentacoes'
import { ehArte, TAMANHO_MIN, TAMANHO_MAX, tamanhoDe } from '@/domain/canva'
import { gerarAvaliacoesInicio, gerarParticipantes, competenciasDe, notaPonderada, responsaveisDe } from '@/domain/avaliacoes'

export type Resultado = { ok: true; id?: string; avisos?: string[]; info?: string } | { ok: false; erro: string }
const OK = (extra: Partial<{ id: string; avisos: string[]; info: string }> = {}): Resultado => ({ ok: true, ...extra })
const ERRO = (erro: string): Resultado => ({ ok: false, erro })
const SEM_PERMISSAO = ERRO('Você não tem permissão para esta ação.')
/** No modo com banco, contratos, documentos e notas fiscais vivem no módulo financeiro (servidor), com arquivos e fluxo de aprovação. */
const NO_FINANCEIRO = ERRO('Com o banco conectado, isto é feito em Financeiro (contratos, documentos e notas fiscais).')

export const DB_KEYS: (keyof DB)[] = [
  'colaboradores', 'setores', 'unidades', 'cargos', 'contratos', 'documentos', 'reembolsos', 'notas', 'periodos',
  'comunicados', 'eventos', 'beneficios', 'treinamentos', 'progressoConteudos', 'badges', 'conquistas', 'regras',
  'lancamentos', 'desafios', 'reconhecimentos', 'iniciativas', 'checklists', 'processos', 'motivosEncerramento',
  'tiposRegistro', 'registros', 'objetivos', 'pesquisas', 'respostas', 'participacoes', 'parabens', 'notificacoes',
  'auditoria', 'historicoFuncao', 'dependentes', 'exigencias', 'beneficiarios', 'gruposCompetencia', 'competencias',
  'ciclos', 'participantesCiclo', 'respostasAvaliacao', 'avaliacoesInicio', 'classificacoesGrupo', 'feedbacks', 'apresentacoes', 'sugestoes', 'config',
]

/** Cópia rasa de todas as coleções, para mutação local dentro de uma transação. */
type Draft = DB
function draftOf(s: DB): Draft {
  const d = {} as Record<string, unknown>
  for (const k of DB_KEYS) {
    const v = s[k] as unknown
    d[k] = Array.isArray(v) ? [...v] : { ...(v as object) }
  }
  return d as unknown as Draft
}

export interface PessoaInput {
  nome: string
  nomeSocial?: string
  email: string
  telefone?: string
  papel: Papel
  setorId: string
  cargoId?: string
  unidadeId?: string
  status: Colaborador['status']
  dataEntrada: string
  nascimento?: string
  cidade?: string
  uf?: string
  regime: Colaborador['regime']
  cpf?: string
  razaoSocial?: string
  cnpj?: string
  banco?: string
  agencia?: string
  conta?: string
  pixTipo?: Colaborador['pixTipo']
  pixChave?: string
  emergenciaNome?: string
  emergenciaTelefone?: string
  emergenciaParentesco?: string
  // Ficha complementar
  endereco?: Endereco
  celular?: string
  emailPessoal?: string
  matricula?: string
  responsavelId?: string
  topoOrganizacao?: boolean
  fusoHorario?: string
  tamanhoCamisa?: string
  escolaridade?: Escolaridade
  curso?: string
  codigoExterno?: string
}

export type EventoInput = Omit<Evento, 'id' | 'confirmados' | 'interessados' | 'presencas' | 'criadoEm' | 'status' | 'motivoCancelamento' | 'organizadorId'> & { organizadorId?: string }

interface AppState extends DB {
  sessaoId: string | null
  sidebarCollapsed: boolean
  previewColaborador: boolean
  // ----- seletores
  currentUser: () => Colaborador
  realUser: () => Colaborador
  pessoa: (id?: string | null) => Colaborador | undefined
  nomeDe: (id?: string | null) => string
  setorNome: (id?: string) => string
  cargoNome: (id?: string) => string
  pontosDe: (id: string) => number
  pode: (cap: Capacidade) => boolean
  // ----- sessão e UI
  entrar: (id: string) => void
  sair: () => void
  toggleSidebar: () => void
  setPreview: (v: boolean) => void
  // ----- pessoas
  salvarPessoa: (input: PessoaInput, id?: string) => Resultado
  atualizarMeuPerfil: (patch: Partial<Pick<Colaborador, 'nomeSocial' | 'telefone' | 'cidade' | 'uf' | 'nascimento' | 'banco' | 'agencia' | 'conta' | 'pixTipo' | 'pixChave' | 'emergenciaNome' | 'emergenciaTelefone' | 'emergenciaParentesco' | 'endereco' | 'celular' | 'emailPessoal' | 'escolaridade' | 'curso' | 'tamanhoCamisa' | 'fusoHorario'>>) => Resultado
  salvarDiversidade: (d: Diversidade) => Resultado
  salvarPerfilComportamental: (pessoaId: string, perfil: PerfilComportamental | null) => Resultado
  salvarDependente: (d: Omit<Dependente, 'id'>, id?: string) => Resultado
  removerDependente: (id: string) => Resultado
  salvarExigencia: (e: Omit<Exigencia, 'id' | 'criadoPorId'>, id?: string) => Resultado
  removerExigencia: (id: string) => Resultado
  salvarCargo: (c: Omit<Cargo, 'id'>, id?: string) => Resultado
  salvarBeneficio: (b: Omit<Beneficio, 'id'>, id?: string) => Resultado
  removerBeneficio: (id: string) => Resultado
  vincularBeneficiarios: (beneficioId: string, pessoaIds: string[], dependentesPorPessoa?: Record<string, string[]>) => Resultado
  desvincularBeneficiario: (id: string) => Resultado
  salvarGrupoCompetencia: (g: Omit<GrupoCompetencia, 'id'>, id?: string) => Resultado
  removerGrupoCompetencia: (id: string) => Resultado
  salvarCompetencia: (c: Omit<Competencia, 'id'>, id?: string) => Resultado
  removerCompetencia: (id: string) => Resultado
  salvarCiclo: (c: Partial<CicloAvaliativo>, id?: string) => Resultado
  gerarParticipantesCiclo: (cicloId: string) => Resultado
  adicionarParticipante: (cicloId: string, avaliadorId: string, avaliadoId: string) => Resultado
  removerParticipante: (id: string) => Resultado
  finalizarCiclo: (id: string) => Resultado
  encerrarCiclo: (id: string) => Resultado
  removerCiclo: (id: string) => Resultado
  responderAvaliacao: (participanteId: string, notas: Record<string, number>, comentarios: Record<string, string>, comentarioGeral?: string) => Resultado
  salvarConfigAvaliacaoInicio: (c: ConfigAvaliacaoInicio) => Resultado
  sincronizarAvaliacoesInicio: () => Resultado
  responderAvaliacaoInicio: (id: string, notas: Record<string, number>, comentario: string, continuidade: 'seguir' | 'ajustar' | 'revisar') => Resultado
  classificarGrupo: (pessoaId: string, grupo: 'alto' | 'desenvolvimento' | null) => Resultado
  inverterGrupos: () => Resultado
  salvarFeedback: (f: Omit<Feedback, 'id' | 'autorId' | 'criadoEm'>, id?: string) => Resultado
  removerFeedback: (id: string) => Resultado
  salvarCultura: (c: CulturaOrganizacional) => Resultado
  // apresentações
  criarApresentacao: (modeloId: string, titulo: string) => Resultado
  salvarApresentacao: (id: string, patch: Partial<Pick<Apresentacao, 'titulo' | 'tema' | 'compartilhada' | 'deck'>> & { slides?: SlideInstancia[]; capa?: string }) => Resultado
  duplicarApresentacao: (id: string) => Resultado
  removerApresentacao: (id: string) => Resultado
  // caixa de sugestões (anônima)
  enviarSugestao: (s: { titulo: string; descricao: string; categoria: CategoriaSugestao }) => Resultado
  editarSugestao: (id: string, s: { titulo: string; descricao: string; categoria: CategoriaSugestao }) => Resultado
  excluirSugestao: (id: string) => Resultado
  apoiarSugestao: (id: string) => Resultado
  moderarSugestao: (id: string, status: StatusSugestao, resposta?: string) => Resultado
  sugestaoEhMinha: (id: string) => boolean
  minhaChaveApoio: (id: string) => string
  salvarConfigGeral: (g: ConfigGeral) => Resultado
  atualizarPrivacidade: (patch: Partial<Colaborador['privacidade']>) => Resultado
  encerrarParceria: (id: string, data: string, motivoId: string, observacao?: string, iniciarChecklist?: boolean) => Resultado
  reativarParceria: (id: string) => Resultado
  importarPessoas: (linhas: PessoaInput[]) => { criadas: number; erros: { linha: number; erro: string }[] }
  anonimizarPessoa: (id: string) => Resultado
  // ----- contratos e documentos
  salvarContrato: (input: Omit<Contrato, 'id' | 'atualizadoEm'>, id?: string) => Resultado
  adicionarDocumento: (input: Omit<Documento, 'id' | 'enviadoPorId'>) => Resultado
  removerDocumento: (id: string) => Resultado
  // ----- estrutura
  salvarSetor: (s: Omit<Setor, 'id'>, id?: string) => Resultado
  removerSetor: (id: string) => Resultado
  salvarUnidade: (u: Omit<Unidade, 'id'>, id?: string) => Resultado
  removerUnidade: (id: string) => Resultado
  addCargo: (c: Omit<Cargo, 'id'>) => Resultado
  removeCargo: (id: string) => Resultado
  salvarMotivo: (m: Omit<MotivoEncerramento, 'id'>, id?: string) => Resultado
  salvarTipoRegistro: (t: Omit<TipoRegistro, 'id'>, id?: string) => Resultado
  // ----- registros administrativos
  salvarRegistro: (r: Omit<RegistroAdministrativo, 'id' | 'autorId' | 'criadoEm'>, id?: string) => Resultado
  removerRegistro: (id: string) => Resultado
  // ----- jornadas
  salvarChecklistModelo: (m: Omit<ChecklistModelo, 'id'>, id?: string) => Resultado
  removerChecklistModelo: (id: string) => Resultado
  iniciarJornada: (pessoaId: string, modeloId: string) => Resultado
  marcarItemJornada: (processoId: string, itemId: string, feito: boolean) => Resultado
  // ----- financeiro PJ
  addReembolso: (r: Omit<Reembolso, 'id' | 'criadoEm' | 'status'>) => void
  setReembolsoStatus: (id: string, status: Reembolso['status'], byId?: string) => Resultado
  enviarNota: (id: string) => void
  aprovarNota: (id: string, aprovadorId: string) => void
  pagarNota: (id: string) => void
  setNotaStatus: (id: string, status: NotaFiscal['status'], byId?: string) => void
  addNota: (n: Omit<NotaFiscal, 'id'>) => void
  gerarNotasCompetencia: (competencia: string) => number
  // ----- disponibilidade
  registrarPeriodo: (e: EntradaPeriodo, id?: string) => Resultado
  cancelarPeriodo: (id: string) => Resultado
  alinharPeriodo: (id: string) => Resultado
  salvarPoliticaDisponibilidade: (p: PoliticaDisponibilidade) => Resultado
  // ----- comunicados
  addComunicado: (m: Omit<Comunicado, 'id' | 'data' | 'lidoPor'>) => Resultado
  editarComunicado: (id: string, patch: Partial<Comunicado>) => Resultado
  removerComunicado: (id: string) => Resultado
  marcarLido: (id: string) => void
  // ----- eventos
  salvarEvento: (e: EventoInput, id?: string) => Resultado
  cancelarEvento: (id: string, motivo: string) => Resultado
  responderEvento: (id: string, resposta: 'vou' | 'talvez' | null) => Resultado
  registrarPresencas: (id: string, presentes: string[]) => Resultado
  // ----- gamificação
  reconhecer: (paraId: string, valor: ValorCultural, mensagem: string, publico: boolean) => Resultado
  participarDesafio: (id: string, participar: boolean) => Resultado
  salvarDesafio: (d: Omit<Desafio, 'id' | 'participantes' | 'criadoPorId'>, id?: string) => Resultado
  salvarRegra: (id: string, patch: Partial<Pick<RegraPontuacao, 'pontos' | 'ativa' | 'limiteMensal'>>) => Resultado
  salvarBadge: (id: string, patch: Partial<Pick<Badge, 'ativa'>>) => Resultado
  salvarConfigGamificacao: (c: ConfigGamificacao) => Resultado
  concederPontos: (pessoaId: string, pontos: number, motivo: string) => Resultado
  estornarLancamento: (id: string, motivo: string) => Resultado
  // ----- iniciativas
  addIniciativa: (t: Pick<Iniciativa, 'titulo' | 'descricao' | 'pontos' | 'prazo'>) => Resultado
  assumirIniciativa: (id: string) => Resultado
  desistirIniciativa: (id: string) => Resultado
  enviarContribuicao: (id: string, entrega: string) => Resultado
  confirmarIniciativa: (id: string) => Resultado
  devolverIniciativa: (id: string) => Resultado
  removerIniciativa: (id: string) => Resultado
  // ----- conteúdos
  concluirConteudo: (treinamentoId: string) => Resultado
  salvarConteudo: (t: Omit<Treinamento, 'id'>, id?: string) => Resultado
  // ----- pesquisas
  responderPesquisa: (id: string, respostas: Record<string, number | string>) => Resultado
  salvarPesquisa: (p: Omit<Pesquisa, 'id' | 'criadaPor' | 'criadaEm'>, id?: string) => Resultado
  // ----- comunidade
  enviarParabens: (paraId: string, ocasiao: string, mensagem: string) => Resultado
  // ----- objetivos
  salvarObjetivo: (o: Omit<Objetivo, 'id'>, id?: string) => Resultado
  removerObjetivo: (id: string) => Resultado
  // ----- notificações
  marcarNotifLida: (id: string) => void
  marcarTodasLidas: () => void
  // ----- exclusões definitivas (administração / RH)
  excluirPessoa: (id: string) => Resultado
  removerContrato: (id: string) => Resultado
  excluirEvento: (id: string) => Resultado
  excluirPesquisa: (id: string) => Resultado
  removerDesafio: (id: string) => Resultado
  removerConteudo: (id: string) => Resultado
  removerMotivo: (id: string) => Resultado
  removerTipoRegistro: (id: string) => Resultado
  excluirReembolso: (id: string) => Resultado
  excluirNota: (id: string) => Resultado
  // ----- administração
  alterarPapel: (id: string, papel: Papel) => Resultado
  reset: () => void
}

export const useStore = create<AppState>()(
  persist(
    (set, get) => {
      /* ---------- helpers internos ---------- */
      const eu = () => get().currentUser()
      const pode = (cap: Capacidade) => can(eu().papel, cap)
      const tx = (fn: (d: Draft) => Resultado | void): Resultado => {
        const d = draftOf(get())
        const r = fn(d) ?? OK()
        if (r.ok) set(d)
        return r
      }
      const audit = (d: Draft, acao: string, entidade: string, entidadeId: string, resumo: string) => {
        d.auditoria = [{ id: uid('au'), em: agoraISO(), atorId: get().realUser().id, acao, entidade, entidadeId, resumo }, ...d.auditoria].slice(0, 500)
      }
      const notificar = (d: Draft, n: Omit<Notificacao, 'id' | 'data' | 'lida'>) => {
        if (!n.colaboradorId) return
        d.notificacoes = [{ ...n, id: uid('no'), data: agoraISO(), lida: false }, ...d.notificacoes]
      }
      const notificarRH = (d: Draft, n: Omit<Notificacao, 'id' | 'data' | 'lida' | 'colaboradorId'>) => {
        d.colaboradores.filter((c) => c.papel === 'rh' && c.status !== 'encerrado').forEach((c) => notificar(d, { ...n, colaboradorId: c.id }))
      }
      /** Pontua via motor de regras; também concede bônus de desafios e conquistas. */
      const pontuar = (d: Draft, e: Omit<EntradaPontuacao, 'agora'> & { agora?: string }): number => {
        const agora = e.agora ?? agoraISO()
        const r = avaliarPontuacao(d.lancamentos, d.regras, { ...e, agora }, () => uid('l'))
        if (!r.ok) return 0
        d.lancamentos = [...d.lancamentos, r.lancamento]
        let total = r.lancamento.pontos
        const hoje = agora.slice(0, 10)
        if (e.acao !== 'desafio_concluido') {
          for (const des of d.desafios) {
            if (des.criterio.acao !== e.acao || !des.participantes.includes(e.pessoaId)) continue
            const p = progressoDesafio(des, d.lancamentos, e.pessoaId, hoje)
            if (p.status === 'ativo' && !p.concluido && p.atual >= p.meta) {
              total += pontuar(d, { pessoaId: e.pessoaId, acao: 'desafio_concluido', referenciaId: des.id, descricao: `Desafio: ${des.titulo}`, pontos: des.pontosBonus, agora })
              notificar(d, { colaboradorId: e.pessoaId, tipo: 'gamificacao', titulo: 'Desafio concluído!', texto: `Você concluiu "${des.titulo}".`, href: '/gamificacao' })
            }
          }
        }
        for (const b of conquistasNovas(d.lancamentos, d.badges, d.conquistas, e.pessoaId, d.config.gamificacao.niveis)) {
          d.conquistas = [...d.conquistas, { colaboradorId: e.pessoaId, badgeId: b.id, obtidaEm: agora }]
          notificar(d, { colaboradorId: e.pessoaId, tipo: 'gamificacao', titulo: 'Nova conquista!', texto: `Você desbloqueou "${b.nome}".`, href: '/experiencia' })
        }
        return total
      }
      const perfilCompleto = (c: Colaborador) => !!(c.telefone && c.cidade && c.emergenciaNome && c.emergenciaTelefone)
      const setorDe = (d: Draft, pessoaId: string) => d.colaboradores.find((c) => c.id === pessoaId)?.setorId

      const validarPessoa = (d: Draft, i: PessoaInput, id?: string): string | null => {
        if (!i.nome?.trim() || i.nome.trim().length < 3) return 'Informe o nome completo.'
        if (!emailValido(i.email)) return 'Informe um e-mail válido.'
        if (d.colaboradores.some((c) => c.email.toLowerCase() === i.email.trim().toLowerCase() && c.id !== id)) return 'Já existe uma pessoa com este e-mail.'
        if (!d.setores.some((s) => s.id === i.setorId)) return 'Selecione uma área válida.'
        if (i.cargoId && !d.cargos.some((g) => g.id === i.cargoId)) return 'Selecione uma função válida.'
        if (!i.dataEntrada) return 'Informe a data de início da parceria.'
        // Cadastro pendente (ex.: criado na contratação pelo ATS): os dados da empresa são completados depois.
        if (i.status === 'pendente' && !i.razaoSocial?.trim() && !i.cnpj?.trim()) { /* completa depois */ } else if (i.regime !== 'autonomo') {
          if (!i.razaoSocial?.trim()) return 'Informe a razão social da empresa prestadora.'
          if (!cnpjValido(i.cnpj ?? '')) return 'CNPJ inválido.'
        } else if (i.cpf && !cpfValido(i.cpf)) return 'CPF inválido.'
        if (i.nascimento && i.nascimento > hojeISO()) return 'A data de nascimento não pode estar no futuro.'
        return null
      }

      return {
        ...(MODO_API ? seedProducao() : seed()),
        sessaoId: null,
        sidebarCollapsed: false,
        previewColaborador: false,

        /* ---------- seletores ---------- */
        realUser: () => {
          const s = get()
          return s.colaboradores.find((c) => c.id === s.sessaoId) ?? s.colaboradores[0]
        },
        currentUser: () => {
          const s = get()
          const u = s.realUser()
          // No modo "ver como colaborador", o papel efetivo vira 'colaborador'.
          return s.previewColaborador ? { ...u, papel: 'colaborador' } : u
        },
        pessoa: (id) => get().colaboradores.find((c) => c.id === id),
        nomeDe: (id) => get().colaboradores.find((c) => c.id === id)?.nome ?? '—',
        setorNome: (id) => get().setores.find((x) => x.id === id)?.nome ?? 'Sem área',
        cargoNome: (id) => get().cargos.find((x) => x.id === id)?.nome ?? 'Sem função',
        pontosDe: (id) => saldo(get().lancamentos, id),
        pode: (cap) => pode(cap),

        /* ---------- sessão ---------- */
        entrar: (id) => { definirVisaoColaborador(false); set({ sessaoId: id, previewColaborador: false }) },
        sair: () => { definirVisaoColaborador(false); set({ sessaoId: null, previewColaborador: false }) },
        toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
        setPreview: (v) => { definirVisaoColaborador(v); set({ previewColaborador: v }) },

        /* ---------- pessoas ---------- */
        salvarPessoa: (input, id) => tx((d) => {
          // Liderança cadastra (só cria) colaboradores nas áreas que lidera; o servidor confere de novo (api/_v2/guarda.ts).
          const liderDaArea = !id && pode('acessos:equipe') && areasLideradas(eu(), d.setores).some((a) => a.id === input.setorId)
          if (!pode('pessoas:gerenciar') && !liderDaArea) return SEM_PERMISSAO
          const erro = validarPessoa(d, input, id)
          if (erro) return ERRO(erro)
          const dados = {
            ...input, nome: input.nome.trim(), email: input.email.trim().toLowerCase(),
            telefone: input.telefone ?? '', cargoId: input.cargoId ?? '', cidade: input.cidade ?? '', uf: input.uf ?? '',
            razaoSocial: input.razaoSocial ?? '', cnpj: input.cnpj ?? '',
          }
          if (id) {
            const atual = d.colaboradores.find((c) => c.id === id)
            if (!atual) return ERRO('Pessoa não encontrada.')
            // Papel só muda pela administração de usuários.
            const papel = can(eu().papel, 'admin:usuarios') ? dados.papel : atual.papel
            if (dados.responsavelId && dados.responsavelId === id) return ERRO('A pessoa não pode ser responsável por si mesma.')
            const gestorMudou = (atual.responsavelId || '') !== (dados.responsavelId || '')
            if (gestorMudou) {
              // Mesma validação do organograma: sem ciclos, sem gestor inexistente ou com parceria encerrada.
              const v = validarMudancaGestor(d.colaboradores, id, dados.responsavelId || null)
              if (v.erros.length) return ERRO(v.erros[0])
            }
            d.colaboradores = d.colaboradores.map((c) => (c.id === id ? { ...c, ...dados, papel } : c))
            if ((atual.cargoId || '') !== (dados.cargoId || '')) {
              d.historicoFuncao = [{ id: uid('hf'), colaboradorId: id, em: hojeISO(), porId: get().realUser().id, cargoAnteriorId: atual.cargoId || undefined, cargoNovoId: dados.cargoId || undefined }, ...d.historicoFuncao]
            }
            audit(d, 'pessoa.atualizar', 'pessoa', id, `Cadastro de ${dados.nome} atualizado`)
            if (gestorMudou) {
              const nomeDe = (gid?: string) => (gid ? d.colaboradores.find((c) => c.id === gid)?.nome ?? 'cadastro removido' : 'sem gestor')
              audit(d, 'pessoa.gestor', 'pessoa', id, `Gestor imediato de ${dados.nome}: ${nomeDe(atual.responsavelId)} → ${nomeDe(dados.responsavelId)}`)
            }
            return OK({ id })
          }
          const novo: Colaborador = {
            ...dados, id: uid('c'), papel: can(eu().papel, 'admin:usuarios') ? dados.papel : 'colaborador',
            avatarCor: ['#0032D2', '#0f9d6b', '#c98a12', '#7c3aed', '#0891b2', '#db2777'][d.colaboradores.length % 6],
            privacidade: { mostrarAniversario: false, mostrarMarcos: true, aparecerEmDestaques: false },
          }
          d.colaboradores = [...d.colaboradores, novo]
          audit(d, 'pessoa.criar', 'pessoa', novo.id, `Pessoa ${novo.nome} cadastrada`)
          return OK({ id: novo.id })
        }),

        atualizarMeuPerfil: (patch) => tx((d) => {
          const me = get().realUser()
          if (patch.pixChave !== undefined && patch.pixChave.length > 120) return ERRO('Chave PIX muito longa.')
          let atualizado: Colaborador | undefined
          d.colaboradores = d.colaboradores.map((c) => (c.id === me.id ? (atualizado = { ...c, ...patch }) : c))
          audit(d, 'perfil.atualizar', 'pessoa', me.id, 'Dados do próprio perfil atualizados')
          if (atualizado && perfilCompleto(atualizado)) {
            const pts = pontuar(d, { pessoaId: me.id, acao: 'perfil_completo', referenciaId: 'perfil', descricao: 'Perfil completo' })
            if (pts) return OK({ info: `Perfil completo! +${pts} pontos.` })
          }
          return OK()
        }),

        atualizarPrivacidade: (patch) => tx((d) => {
          const me = get().realUser()
          d.colaboradores = d.colaboradores.map((c) => (c.id === me.id ? { ...c, privacidade: { ...c.privacidade, ...patch } } : c))
          audit(d, 'privacidade.atualizar', 'pessoa', me.id, 'Preferências de privacidade atualizadas')
        }),

        encerrarParceria: (id, data, motivoId, observacao, iniciarChecklist) => tx((d) => {
          if (!pode('pessoas:gerenciar')) return SEM_PERMISSAO
          const c = d.colaboradores.find((x) => x.id === id)
          if (!c) return ERRO('Pessoa não encontrada.')
          if (!data) return ERRO('Informe a data de encerramento.')
          if (data < c.dataEntrada) return ERRO('O encerramento não pode ser anterior ao início da parceria.')
          if (!d.motivosEncerramento.some((m) => m.id === motivoId && m.ativo)) return ERRO('Selecione um motivo.')
          d.colaboradores = d.colaboradores.map((x) => (x.id === id ? { ...x, status: 'encerrado', encerramento: { data, motivoId, observacao } } : x))
          // Com banco, os contratos são encerrados no módulo financeiro (com conferência de pendências).
          if (!MODO_API) d.contratos = d.contratos.map((k) => (k.colaboradorId === id && k.status !== 'encerrado' ? { ...k, status: 'encerrado', fim: k.fim && k.fim < data ? k.fim : data, atualizadoEm: hojeISO() } : k))
          d.periodos = d.periodos.map((p) => (p.colaboradorId === id && p.inicio > data && p.status !== 'cancelado' ? { ...p, status: 'cancelado' } : p))
          // Quem saiu deixa de liderar áreas (avaliações, reembolsos e a edição do departamento dependem disso).
          // Os subordinados diretos continuam apontando para a pessoa: o novo gestor é decisão do RH (pendência no organograma).
          if (pode('estrutura:gerenciar')) {
            d.setores = d.setores.map((s) => (s.gestorId === id || s.liderancaIds.includes(id)
              ? { ...s, gestorId: s.gestorId === id ? null : s.gestorId, liderancaIds: s.liderancaIds.filter((x) => x !== id) } : s))
          }
          if (iniciarChecklist) {
            const modelo = d.checklists.find((m) => m.tipo === 'encerramento')
            if (modelo) d.processos = [...d.processos, criarProcesso(modelo, id, hojeISO(), uid('pj'))]
          }
          audit(d, 'parceria.encerrar', 'pessoa', id, `Parceria de ${c.nome} encerrada em ${data}`)
        }),

        reativarParceria: (id) => tx((d) => {
          if (!pode('pessoas:gerenciar')) return SEM_PERMISSAO
          const c = d.colaboradores.find((x) => x.id === id)
          if (!c) return ERRO('Pessoa não encontrada.')
          d.colaboradores = d.colaboradores.map((x) => (x.id === id ? { ...x, status: 'ativo', encerramento: undefined } : x))
          audit(d, 'parceria.reativar', 'pessoa', id, `Parceria de ${c.nome} reativada`)
        }),

        importarPessoas: (linhas) => {
          const erros: { linha: number; erro: string }[] = []
          let criadas = 0
          if (!pode('pessoas:gerenciar')) return { criadas, erros: [{ linha: 0, erro: 'Sem permissão.' }] }
          linhas.forEach((l, i) => {
            const r = get().salvarPessoa(l)
            if (r.ok) criadas++
            else erros.push({ linha: i + 2, erro: r.erro })
          })
          return { criadas, erros }
        },

        anonimizarPessoa: (id) => tx((d) => {
          if (!pode('admin:privacidade')) return SEM_PERMISSAO
          const c = d.colaboradores.find((x) => x.id === id)
          if (!c) return ERRO('Pessoa não encontrada.')
          if (c.status !== 'encerrado') return ERRO('Encerre a parceria antes de anonimizar os dados.')
          if (id === get().realUser().id) return ERRO('Você não pode anonimizar o próprio cadastro.')
          d.colaboradores = d.colaboradores.map((x) => x.id === id ? {
            ...x, nome: `Pessoa anonimizada ${id.slice(-4)}`, nomeSocial: undefined, email: `anonimizado+${id}@invalid`, telefone: '',
            nascimento: undefined, cidade: '', cpf: undefined, razaoSocial: '', cnpj: '', banco: undefined, agencia: undefined,
            conta: undefined, pixChave: undefined, emergenciaNome: undefined, emergenciaTelefone: undefined, emergenciaParentesco: undefined,
            privacidade: { mostrarAniversario: false, mostrarMarcos: false, aparecerEmDestaques: false },
          } : x)
          // Com banco, documentos ficam no repositório do servidor (guarda conforme a política de retenção).
          if (!MODO_API) d.documentos = d.documentos.filter((x) => x.colaboradorId !== id)
          d.reconhecimentos = d.reconhecimentos.map((r) => (r.deId === id || r.paraId === id ? { ...r, mensagem: '[removida]', publico: false } : r))
          d.periodos = d.periodos.map((p) => (p.colaboradorId === id ? { ...p, mensagemEquipe: undefined, observacaoPrivada: undefined, planoContinuidade: undefined } : p))
          d.notificacoes = d.notificacoes.filter((n) => n.colaboradorId !== id)
          d.parabens = d.parabens.filter((p) => p.deId !== id && p.paraId !== id)
          audit(d, 'lgpd.anonimizar', 'pessoa', id, 'Dados pessoais anonimizados (registros financeiros e contratuais mantidos para obrigações legais)')
        }),

        /* ---------- contratos e documentos ---------- */
        salvarContrato: (input, id) => tx((d) => {
          if (MODO_API) return NO_FINANCEIRO
          if (!pode('pessoas:ver_contratos')) return SEM_PERMISSAO
          if (!input.objeto.trim()) return ERRO('Descreva o objeto do contrato.')
          if (!input.inicio) return ERRO('Informe o início da vigência.')
          if (input.fim && input.fim < input.inicio) return ERRO('O término deve ser posterior ao início.')
          if (!(input.valorMensal >= 0)) return ERRO('Valor inválido.')
          const rec = { ...input, atualizadoEm: hojeISO() }
          const anterior = id ? d.contratos.find((k) => k.id === id) : undefined
          if (anterior && anterior.valorMensal !== input.valorMensal) {
            d.historicoFuncao = [{ id: uid('hf'), colaboradorId: input.colaboradorId, em: hojeISO(), porId: get().realUser().id, valorAnterior: anterior.valorMensal, valorNovo: input.valorMensal }, ...d.historicoFuncao]
          }
          if (id) d.contratos = d.contratos.map((k) => (k.id === id ? { ...k, ...rec } : k))
          else d.contratos = [...d.contratos, { ...rec, id: uid('k') }]
          audit(d, id ? 'contrato.atualizar' : 'contrato.criar', 'contrato', id ?? '-', `Contrato ${input.numero} ${id ? 'atualizado' : 'registrado'}`)
        }),

        adicionarDocumento: (input) => tx((d) => {
          if (MODO_API) return NO_FINANCEIRO
          const me = get().realUser()
          const proprio = input.colaboradorId === me.id
          if (!proprio && !pode('documentos:gerenciar')) return SEM_PERMISSAO
          if (!input.nome.trim()) return ERRO('Informe o nome do documento.')
          if (input.validade && input.validade < input.data) return ERRO('A validade não pode ser anterior à data do documento.')
          const doc: Documento = { ...input, id: uid('doc'), enviadoPorId: me.id }
          d.documentos = [...d.documentos, doc]
          audit(d, 'documento.adicionar', 'documento', doc.id, `Documento "${doc.tipo}" registrado`)
          if (proprio && !pode('documentos:gerenciar')) notificarRH(d, { tipo: 'pendencia', titulo: 'Novo documento enviado', texto: `${me.nome} enviou um documento (${doc.tipo}).`, href: '/rh/documentos' })
        }),

        removerDocumento: (id) => tx((d) => {
          if (MODO_API) return NO_FINANCEIRO
          if (!pode('documentos:gerenciar')) return SEM_PERMISSAO
          d.documentos = d.documentos.filter((x) => x.id !== id)
          audit(d, 'documento.remover', 'documento', id, 'Documento removido')
        }),

        /* ---------- estrutura ---------- */
        salvarSetor: (s, id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!s.nome.trim()) return ERRO('Informe o nome do departamento.')
          if (d.setores.some((x) => x.nome.toLowerCase() === s.nome.trim().toLowerCase() && x.id !== id)) return ERRO('Já existe um departamento com este nome.')
          const erroPai = validarDepartamentoPai(d.setores, id, s.paiId)
          if (erroPai) return ERRO(erroPai)
          if (s.gestorId && !d.colaboradores.some((c) => c.id === s.gestorId && c.status !== 'encerrado')) return ERRO('O líder escolhido não está ativo.')
          // O líder também coordena: entra nas lideranças (painel da liderança, reembolsos, avaliações).
          s = { ...s, paiId: s.paiId || undefined, liderancaIds: [...new Set([...(s.gestorId ? [s.gestorId] : []), ...s.liderancaIds])] }
          if (id) d.setores = d.setores.map((x) => (x.id === id ? { ...x, ...s } : x))
          else d.setores = [...d.setores, { ...s, id: uid('s') }]
          audit(d, id ? 'area.atualizar' : 'area.criar', 'area', id ?? '-', `Departamento ${s.nome}`)
        }),
        removerSetor: (id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          const qtd = d.colaboradores.filter((c) => c.setorId === id && c.status !== 'encerrado').length
          if (qtd) return ERRO(`Este departamento possui ${qtd} pessoa(s) ativa(s). Mova-as antes de remover.`)
          const subs = d.setores.filter((x) => x.paiId === id).length
          if (subs) return ERRO(`Este departamento possui ${subs} subdepartamento(s). Mova-os ou remova-os antes.`)
          // As funções do departamento saem junto, desde que nenhuma esteja em uso (o servidor confere também vagas e cargos v2).
          const funcoes = new Set(d.cargos.filter((c) => c.setorId === id).map((c) => c.id))
          const emUso = d.colaboradores.filter((c) => c.setorId === id || funcoes.has(c.cargoId)).length + d.historicoFuncao.filter((h) => funcoes.has(h.cargoNovoId ?? '') || funcoes.has(h.cargoAnteriorId ?? '')).length
          if (emUso) return ERRO('Há pessoas (inclusive encerradas) ou histórico ligados a este departamento ou às suas funções. Mova-os antes de remover.')
          d.setores = d.setores.filter((x) => x.id !== id)
          d.cargos = d.cargos.filter((c) => c.setorId !== id)
          audit(d, 'area.remover', 'area', id, 'Departamento removido')
        }),
        salvarUnidade: (u, id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!u.nome.trim()) return ERRO('Informe o nome da unidade.')
          if (id) d.unidades = d.unidades.map((x) => (x.id === id ? { ...x, ...u } : x))
          else d.unidades = [...d.unidades, { ...u, id: uid('u') }]
          audit(d, id ? 'unidade.atualizar' : 'unidade.criar', 'unidade', id ?? '-', `Unidade ${u.nome}`)
        }),
        removerUnidade: (id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (d.colaboradores.some((c) => c.unidadeId === id) || d.setores.some((s) => s.unidadeId === id)) return ERRO('Unidade em uso por pessoas ou áreas.')
          d.unidades = d.unidades.filter((x) => x.id !== id)
          audit(d, 'unidade.remover', 'unidade', id, 'Unidade removida')
        }),
        addCargo: (c) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!c.nome.trim()) return ERRO('Informe o nome da função.')
          d.cargos = [...d.cargos, { ...c, nome: c.nome.trim(), id: uid('g') }]
          audit(d, 'funcao.criar', 'funcao', '-', `Função ${c.nome}`)
        }),
        removeCargo: (id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (d.colaboradores.some((c) => c.cargoId === id && c.status !== 'encerrado')) return ERRO('Há pessoas ativas com esta função.')
          // Pessoas encerradas e o histórico de função continuam apontando para ela: removê-la deixaria o vínculo órfão.
          if (d.colaboradores.some((c) => c.cargoId === id) || d.historicoFuncao.some((h) => h.cargoNovoId === id || h.cargoAnteriorId === id)) return ERRO('Esta função aparece no cadastro de pessoas encerradas ou no histórico de funções e não pode ser removida.')
          d.cargos = d.cargos.filter((c) => c.id !== id)
          audit(d, 'funcao.remover', 'funcao', id, 'Função removida')
        }),
        salvarMotivo: (m, id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!m.nome.trim()) return ERRO('Informe o nome do motivo.')
          if (id) d.motivosEncerramento = d.motivosEncerramento.map((x) => (x.id === id ? { ...x, ...m } : x))
          else d.motivosEncerramento = [...d.motivosEncerramento, { ...m, id: uid('me') }]
        }),
        salvarTipoRegistro: (t, id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!t.nome.trim()) return ERRO('Informe o nome do tipo.')
          if (id) d.tiposRegistro = d.tiposRegistro.map((x) => (x.id === id ? { ...x, ...t } : x))
          else d.tiposRegistro = [...d.tiposRegistro, { ...t, id: uid('tr') }]
        }),

        /* ---------- registros administrativos ---------- */
        salvarRegistro: (r, id) => tx((d) => {
          if (!pode('pessoas:gerenciar')) return SEM_PERMISSAO
          if (!r.descricao.trim()) return ERRO('Descreva o registro.')
          if (!r.data) return ERRO('Informe a data.')
          if (id) d.registros = d.registros.map((x) => (x.id === id ? { ...x, ...r } : x))
          else d.registros = [{ ...r, id: uid('ra'), autorId: get().realUser().id, criadoEm: hojeISO() }, ...d.registros]
          audit(d, id ? 'registro.atualizar' : 'registro.criar', 'registro', id ?? '-', 'Registro administrativo')
        }),
        removerRegistro: (id) => tx((d) => {
          if (!pode('pessoas:gerenciar')) return SEM_PERMISSAO
          d.registros = d.registros.filter((x) => x.id !== id)
          audit(d, 'registro.remover', 'registro', id, 'Registro administrativo removido')
        }),

        /* ---------- jornadas (integração / encerramento) ---------- */
        salvarChecklistModelo: (m, id) => tx((d) => {
          if (!pode('onboarding:gerenciar')) return SEM_PERMISSAO
          if (!m.nome.trim()) return ERRO('Informe o nome do checklist.')
          if (!m.itens.length || m.itens.some((i) => !i.titulo.trim())) return ERRO('Inclua ao menos um item, todos com título.')
          if (id) d.checklists = d.checklists.map((x) => (x.id === id ? { ...x, ...m } : x))
          else d.checklists = [...d.checklists, { ...m, id: uid('ck') }]
          audit(d, 'checklist.salvar', 'checklist', id ?? '-', `Checklist ${m.nome}`)
        }),
        removerChecklistModelo: (id) => tx((d) => {
          if (!pode('onboarding:gerenciar')) return SEM_PERMISSAO
          if (d.processos.some((p) => p.modeloId === id && !p.concluidoEm)) return ERRO('Há processos em andamento usando este checklist.')
          d.checklists = d.checklists.filter((x) => x.id !== id)
        }),
        iniciarJornada: (pessoaId, modeloId) => tx((d) => {
          if (!pode('onboarding:gerenciar')) return SEM_PERMISSAO
          const modelo = d.checklists.find((m) => m.id === modeloId)
          if (!modelo) return ERRO('Checklist não encontrado.')
          if (d.processos.some((p) => p.colaboradorId === pessoaId && p.tipo === modelo.tipo && !p.concluidoEm)) return ERRO('Já existe um processo deste tipo em andamento para esta pessoa.')
          const p = criarProcesso(modelo, pessoaId, hojeISO(), uid('pj'))
          d.processos = [...d.processos, p]
          if (modelo.tipo === 'integracao') notificar(d, { colaboradorId: pessoaId, tipo: 'pendencia', titulo: 'Sua integração começou', texto: 'Confira os próximos passos na sua integração.', href: '/onboarding' })
          audit(d, 'jornada.iniciar', 'jornada', p.id, `${modelo.tipo === 'integracao' ? 'Integração' : 'Encerramento'} iniciado para ${get().nomeDe(pessoaId)}`)
          return OK({ id: p.id })
        }),
        marcarItemJornada: (processoId, itemId, feito) => tx((d) => {
          const me = get().currentUser()
          const p = d.processos.find((x) => x.id === processoId)
          if (!p) return ERRO('Processo não encontrado.')
          const item = p.itens.find((i) => i.id === itemId)
          if (!item) return ERRO('Item não encontrado.')
          const setor = setorDe(d, p.colaboradorId)
          const permitido = can(me.papel, 'onboarding:gerenciar') ||
            (item.responsavel === 'pessoa' && p.colaboradorId === me.id) ||
            (item.responsavel === 'lideranca' && areasLideradas(me, d.setores).some((s) => s.id === setor))
          if (!permitido) return SEM_PERMISSAO
          const itens = p.itens.map((i) => (i.id === itemId ? { ...i, feito, feitoEm: feito ? hojeISO() : undefined, feitoPorId: feito ? me.id : undefined } : i))
          const completo = itens.every((i) => i.feito)
          const atualizado = { ...p, itens, concluidoEm: completo ? (p.concluidoEm ?? hojeISO()) : undefined }
          d.processos = d.processos.map((x) => (x.id === processoId ? atualizado : x))
          let info: string | undefined
          if (completo && !p.concluidoEm) {
            if (p.tipo === 'integracao') {
              d.colaboradores = d.colaboradores.map((c) => (c.id === p.colaboradorId && c.status === 'integracao' ? { ...c, status: 'ativo' } : c))
              const pts = pontuar(d, { pessoaId: p.colaboradorId, acao: 'integracao_concluida', referenciaId: p.id, descricao: 'Integração inicial concluída' })
              notificar(d, { colaboradorId: p.colaboradorId, tipo: 'gamificacao', titulo: 'Integração concluída 🎉', texto: pts ? `Boas-vindas oficiais! +${pts} pontos.` : 'Boas-vindas oficiais!', href: '/experiencia' })
            }
            info = 'Processo concluído.'
          }
          return OK({ info })
        }),

        /* ---------- financeiro PJ (fluxos preservados) ---------- */
        addReembolso: (r) => set((s) => ({ reembolsos: [{ ...r, id: uid('r'), criadoEm: hojeISO(), status: 'pendente' }, ...s.reembolsos] })),
        setReembolsoStatus: (id, status, byId) => {
          return tx((d) => {
            const r0 = d.reembolsos.find((r) => r.id === id)
            if (!r0) return ERRO('Reembolso não encontrado.')
            // Gestão financeira (RH/Admin) ou liderança da área da pessoa — nunca a própria pessoa.
            const me = get().currentUser()
            const lideraArea = can(me.papel, 'reembolsos:aprovar_area') && areasLideradas(me, d.setores).some((a) => a.id === setorDe(d, r0.colaboradorId))
            if (r0.colaboradorId === me.id || !(pode('financeiro:gerenciar') || lideraArea)) return SEM_PERMISSAO
            d.reembolsos = d.reembolsos.map((r) => {
              if (r.id !== id) return r
              const patch: Partial<Reembolso> = { status }
              if (status === 'aprovado') { patch.aprovadorId = byId ?? r.aprovadorId; patch.aprovadoEm = r.aprovadoEm ?? hojeISO() }
              if (status === 'pago') patch.pagoEm = r.pagoEm ?? hojeISO()
              return { ...r, ...patch }
            })
            if (r0 && (status === 'aprovado' || status === 'recusado' || status === 'pago')) {
              notificar(d, { colaboradorId: r0.colaboradorId, tipo: status === 'recusado' ? 'recusa' : 'aprovacao', titulo: `Reembolso ${status === 'recusado' ? 'recusado' : status === 'pago' ? 'pago' : 'aprovado'}`, texto: `"${r0.descricao}"`, href: '/reembolsos' })
            }
            audit(d, 'reembolso.status', 'reembolso', id, `Status alterado para ${status}`)
          })
        },
        enviarNota: (id) => set((s) => ({ notas: s.notas.map((n) => (n.id === id ? { ...n, status: 'enviada' as NotaFiscal['status'], enviadaEm: hojeISO() } : n)) })),
        aprovarNota: (id, aprovadorId) => get().setNotaStatus(id, 'aprovada', aprovadorId),
        pagarNota: (id) => get().setNotaStatus(id, 'paga'),
        setNotaStatus: (id, status, byId) => {
          tx((d) => {
            const n0 = d.notas.find((n) => n.id === id)
            // Aprovar/pagar é do financeiro e nunca da própria pessoa (modo demonstração; com banco, o fluxo é do servidor).
            if (!pode('financeiro:gerenciar') || (n0?.colaboradorId === get().realUser().id && status !== 'enviada')) return SEM_PERMISSAO
            d.notas = d.notas.map((n) => {
              if (n.id !== id) return n
              const patch: Partial<NotaFiscal> = { status }
              if (status === 'enviada' && !n.enviadaEm) patch.enviadaEm = hojeISO()
              if (status === 'aprovada') { patch.aprovadorId = byId ?? n.aprovadorId; patch.aprovadaEm = n.aprovadaEm ?? hojeISO() }
              if (status === 'paga') patch.pagaEm = n.pagaEm ?? hojeISO()
              if (status === 'aguardando') { patch.enviadaEm = undefined; patch.aprovadorId = undefined; patch.aprovadaEm = undefined; patch.pagaEm = undefined }
              return { ...n, ...patch }
            })
            if (n0 && (status === 'aprovada' || status === 'paga')) notificar(d, { colaboradorId: n0.colaboradorId, tipo: 'aprovacao', titulo: status === 'paga' ? 'Pagamento registrado' : 'Nota fiscal aprovada', texto: `Competência ${n0.competencia}.`, href: '/notas' })
            audit(d, 'nf.status', 'nota_fiscal', id, `Status alterado para ${status}`)
          })
        },
        addNota: (n) => { if (pode('financeiro:gerenciar')) set((s) => ({ notas: [{ ...n, id: uid('n') }, ...s.notas] })) },
        gerarNotasCompetencia: (competencia) => {
          if (!pode('financeiro:gerenciar')) return 0
          const { colaboradores, notas, contratos, config } = get()
          const jaTem = new Set(notas.filter((n) => n.competencia === competencia).map((n) => n.colaboradorId))
          const [ano, mes] = competencia.split('-')
          const dd = (n: number) => String(n).padStart(2, '0')
          const novas: NotaFiscal[] = colaboradores
            .filter((c) => (c.status === 'ativo' || c.status === 'integracao') && !jaTem.has(c.id))
            .map((c): NotaFiscal | null => {
              const k = contratos.find((x) => x.colaboradorId === c.id && x.status !== 'encerrado' && x.modalidade === 'mensal')
              return k ? {
                id: uid('n'), colaboradorId: c.id, competencia, valor: k.valorMensal, status: 'aguardando',
                prazo: `${ano}-${mes}-${dd(config.financeiro.diaEnvioNF)}`, pagamentoEm: `${ano}-${mes}-${dd(config.financeiro.diaPagamento)}`,
              } : null
            })
            .filter((x): x is NotaFiscal => !!x)
          if (novas.length) set((s) => ({ notas: [...novas, ...s.notas] }))
          return novas.length
        },

        /* ---------- disponibilidade ---------- */
        registrarPeriodo: (e, id) => tx((d) => {
          const me = get().realUser()
          if (id) {
            const atual = d.periodos.find((p) => p.id === id)
            if (!atual || atual.colaboradorId !== me.id) return SEM_PERMISSAO
          }
          const v = validarPeriodo(e, me.id, d.periodos, d.config.disponibilidade, hojeISO(), id)
          if (v.erros.length) return ERRO(v.erros[0])
          const avisos = [...v.avisos]
          if (d.config.disponibilidade.avisarSobreposicao) {
            const sob = sobreposicoesNaArea(e.inicio, e.fim, me.id, me.setorId, d.periodos, (pid) => setorDe(d, pid))
            if (sob.length) avisos.push(`Há ${sob.length} período(s) de outras pessoas da área nessas datas. A liderança verá o aviso para coordenar as entregas.`)
          }
          const agora = hojeISO()
          let pid = id
          if (id) {
            // Alterar datas desfaz o alinhamento anterior (precisa ser recombinado).
            d.periodos = d.periodos.map((p) => (p.id === id ? {
              ...p, ...e, atualizadoEm: agora,
              ...(p.inicio !== e.inicio || p.fim !== e.fim ? { status: 'planejado' as const, alinhadoPorId: undefined, alinhadoEm: undefined } : {}),
            } : p))
          } else {
            const novo: PeriodoIndisponibilidade = { ...e, id: uid('p'), colaboradorId: me.id, status: 'planejado', criadoEm: agora, atualizadoEm: agora }
            pid = novo.id
            d.periodos = [novo, ...d.periodos]
          }
          const setor = d.setores.find((s) => s.id === me.setorId)
          ;[...(setor?.liderancaIds ?? []), setor?.gestorId].filter((x): x is string => !!x && x !== me.id)
            .filter((x, i, arr) => arr.indexOf(x) === i)
            .forEach((lid) => notificar(d, { colaboradorId: lid, tipo: 'disponibilidade', titulo: id ? 'Período atualizado na sua área' : 'Novo período na sua área', texto: `${me.nome}: ${e.inicio} a ${e.fim}.`, href: '/lideranca' }))
          audit(d, id ? 'periodo.atualizar' : 'periodo.registrar', 'periodo', pid ?? '-', `Período ${e.inicio} → ${e.fim}`)
          return OK({ id: pid, avisos })
        }),
        cancelarPeriodo: (id) => tx((d) => {
          const me = get().realUser()
          const p = d.periodos.find((x) => x.id === id)
          if (!p) return ERRO('Período não encontrado.')
          if (p.colaboradorId !== me.id && !pode('disponibilidade:configurar')) return SEM_PERMISSAO
          d.periodos = d.periodos.map((x) => (x.id === id ? { ...x, status: 'cancelado', atualizadoEm: hojeISO() } : x))
          audit(d, 'periodo.cancelar', 'periodo', id, 'Período cancelado')
        }),
        alinharPeriodo: (id) => tx((d) => {
          const me = get().currentUser()
          const p = d.periodos.find((x) => x.id === id)
          if (!p) return ERRO('Período não encontrado.')
          if (!podeAlinharPeriodo(p, me, setorDe(d, p.colaboradorId), d.setores)) return SEM_PERMISSAO
          d.periodos = d.periodos.map((x) => (x.id === id ? { ...x, status: 'alinhado', alinhadoPorId: me.id, alinhadoEm: hojeISO() } : x))
          notificar(d, { colaboradorId: p.colaboradorId, tipo: 'disponibilidade', titulo: 'Continuidade alinhada', texto: `${me.nome} registrou o alinhamento das entregas para ${p.inicio} → ${p.fim}.`, href: '/disponibilidade' })
          audit(d, 'periodo.alinhar', 'periodo', id, 'Alinhamento de continuidade registrado')
        }),
        salvarPoliticaDisponibilidade: (p) => tx((d) => {
          if (!pode('disponibilidade:configurar')) return SEM_PERMISSAO
          if (!(p.antecedenciaSugeridaDias >= 0 && p.antecedenciaSugeridaDias <= 180)) return ERRO('Antecedência deve ficar entre 0 e 180 dias.')
          d.config = { ...d.config, disponibilidade: p }
          audit(d, 'config.disponibilidade', 'config', 'disponibilidade', 'Política de disponibilidade atualizada')
        }),

        /* ---------- comunicados ---------- */
        addComunicado: (m) => tx((d) => {
          if (!pode('comunicados:publicar')) return SEM_PERMISSAO
          const rec: Comunicado = { ...m, autorId: get().realUser().id, id: uid('m'), data: hojeISO(), lidoPor: [] }
          d.comunicados = [rec, ...d.comunicados]
          const alvo = d.colaboradores.filter((c) => c.status !== 'encerrado' && c.id !== rec.autorId &&
            (m.alvo === 'todos' || (m.alvo === 'setores' && m.setoresAlvo.includes(c.setorId)) || (m.alvo === 'usuarios' && m.usuariosAlvo.includes(c.id))))
          alvo.forEach((c) => notificar(d, { colaboradorId: c.id, tipo: 'comunicado', titulo: m.importante ? 'Comunicado importante' : 'Novo comunicado', texto: m.titulo, href: '/comunicados' }))
          audit(d, 'comunicado.publicar', 'comunicado', rec.id, `Comunicado "${m.titulo}" para ${alvo.length} pessoa(s)`)
        }),
        editarComunicado: (id, patch) => tx((d) => {
          const m = d.comunicados.find((x) => x.id === id)
          if (!m) return ERRO('Comunicado não encontrado.')
          if (!pode('comunicados:publicar') || (m.autorId !== get().realUser().id && !pode('rh:painel'))) return SEM_PERMISSAO
          d.comunicados = d.comunicados.map((x) => (x.id === id ? { ...x, ...patch } : x))
          audit(d, 'comunicado.editar', 'comunicado', id, `Comunicado "${m.titulo}" editado`)
        }),
        removerComunicado: (id) => tx((d) => {
          const m = d.comunicados.find((x) => x.id === id)
          if (!m) return ERRO('Comunicado não encontrado.')
          if (!pode('comunicados:publicar') || (m.autorId !== get().realUser().id && !pode('rh:painel'))) return SEM_PERMISSAO
          d.comunicados = d.comunicados.filter((x) => x.id !== id)
          audit(d, 'comunicado.remover', 'comunicado', id, `Comunicado "${m.titulo}" removido`)
        }),
        marcarLido: (id) => {
          const me = get().realUser().id
          set((s) => ({ comunicados: s.comunicados.map((m) => (m.id === id && !m.lidoPor.includes(me) ? { ...m, lidoPor: [...m.lidoPor, me] } : m)) }))
        },

        /* ---------- eventos ---------- */
        salvarEvento: (e, id) => tx((d) => {
          const me = get().currentUser()
          if (!pode('eventos:gerenciar') && !pode('eventos:gerenciar_area')) return SEM_PERMISSAO
          if (!e.titulo.trim()) return ERRO('Informe o título do evento.')
          if (!e.inicio || e.inicio.length < 16) return ERRO('Informe data e horário.')
          if (e.fim && e.fim <= e.inicio) return ERRO('O término deve ser depois do início.')
          if (e.link && !/^https?:\/\//i.test(e.link)) return ERRO('O link deve começar com http:// ou https://')
          if (e.capacidade != null && e.capacidade < 1) return ERRO('Capacidade inválida.')
          if (e.visibilidade === 'setores' && !e.setoresAlvo.length) return ERRO('Selecione ao menos uma área.')
          if (!pode('eventos:gerenciar')) {
            const minhas = new Set(areasLideradas(me, d.setores).map((s) => s.id))
            if (e.visibilidade !== 'setores' || !e.setoresAlvo.every((s) => minhas.has(s))) return ERRO('Lideranças podem criar eventos apenas para as próprias áreas.')
          }
          if (id) {
            const atual = d.eventos.find((x) => x.id === id)
            if (!atual || !podeGerenciarEvento(atual, me, d.setores)) return SEM_PERMISSAO
            d.eventos = d.eventos.map((x) => (x.id === id ? { ...x, ...e, organizadorId: e.organizadorId ?? x.organizadorId } : x))
            ;[...atual.confirmados, ...atual.interessados].forEach((pid) => notificar(d, { colaboradorId: pid, tipo: 'evento', titulo: 'Evento atualizado', texto: `"${e.titulo}" teve informações atualizadas.`, href: '/eventos' }))
            audit(d, 'evento.editar', 'evento', id, `Evento "${e.titulo}" atualizado`)
            return OK({ id })
          }
          const novo: Evento = { ...e, organizadorId: e.organizadorId ?? me.id, id: uid('e'), status: 'agendado', confirmados: [], interessados: [], presencas: [], criadoEm: hojeISO() }
          d.eventos = [...d.eventos, novo]
          audit(d, 'evento.criar', 'evento', novo.id, `Evento "${e.titulo}" criado`)
          return OK({ id: novo.id })
        }),
        cancelarEvento: (id, motivo) => tx((d) => {
          const me = get().currentUser()
          const ev = d.eventos.find((x) => x.id === id)
          if (!ev) return ERRO('Evento não encontrado.')
          if (!podeGerenciarEvento(ev, me, d.setores)) return SEM_PERMISSAO
          if (!motivo.trim()) return ERRO('Informe o motivo do cancelamento para comunicar as pessoas.')
          d.eventos = d.eventos.map((x) => (x.id === id ? { ...x, status: 'cancelado', motivoCancelamento: motivo.trim() } : x))
          ;[...ev.confirmados, ...ev.interessados].forEach((pid) => notificar(d, { colaboradorId: pid, tipo: 'evento', titulo: 'Evento cancelado', texto: `"${ev.titulo}": ${motivo.trim()}`, href: '/eventos' }))
          audit(d, 'evento.cancelar', 'evento', id, `Evento "${ev.titulo}" cancelado`)
          return OK({ info: `${ev.confirmados.length + ev.interessados.length} pessoa(s) notificada(s).` })
        }),
        responderEvento: (id, resposta) => tx((d) => {
          const me = get().realUser().id
          const ev = d.eventos.find((x) => x.id === id)
          if (!ev) return ERRO('Evento não encontrado.')
          if (ev.status === 'cancelado') return ERRO('Este evento foi cancelado.')
          if (ev.inicio.slice(0, 10) < hojeISO()) return ERRO('Este evento já aconteceu.')
          const confirmados = ev.confirmados.filter((x) => x !== me)
          const interessados = ev.interessados.filter((x) => x !== me)
          if (resposta === 'vou') {
            if (ev.capacidade && confirmados.length >= ev.capacidade) return ERRO('As vagas deste evento estão esgotadas.')
            confirmados.push(me)
          }
          if (resposta === 'talvez') interessados.push(me)
          d.eventos = d.eventos.map((x) => (x.id === id ? { ...x, confirmados, interessados } : x))
        }),
        registrarPresencas: (id, presentes) => tx((d) => {
          const me = get().currentUser()
          const ev = d.eventos.find((x) => x.id === id)
          if (!ev) return ERRO('Evento não encontrado.')
          if (!podeGerenciarEvento(ev, me, d.setores)) return SEM_PERMISSAO
          if (ev.status === 'cancelado') return ERRO('Evento cancelado.')
          if (ev.inicio.slice(0, 10) > hojeISO()) return ERRO('A presença só pode ser registrada depois do início do evento.')
          d.eventos = d.eventos.map((x) => (x.id === id ? { ...x, presencas: [...new Set(presentes)] } : x))
          let pontuadas = 0
          presentes.forEach((pid) => {
            const pts = pontuar(d, { pessoaId: pid, acao: 'participacao_evento', referenciaId: id, descricao: `Presença: ${ev.titulo}`, registradoPorId: me.id })
            if (pts) pontuadas++
          })
          audit(d, 'evento.presencas', 'evento', id, `${presentes.length} presença(s) registrada(s)`)
          return OK({ info: pontuadas ? `${pontuadas} pessoa(s) receberam pontos de participação.` : undefined })
        }),

        /* ---------- gamificação ---------- */
        reconhecer: (paraId, valor, mensagem, publico) => tx((d) => {
          const me = get().realUser()
          if (paraId === me.id) return ERRO('Reconheça outra pessoa — autorreconhecimento não vale. 🙂')
          if (!d.config.cultura.valores.some((v) => v.nome === valor)) return ERRO('Escolha um dos valores da cultura.')
          const para = d.colaboradores.find((c) => c.id === paraId && c.status !== 'encerrado')
          if (!para) return ERRO('Pessoa não encontrada.')
          const msg = mensagem.trim()
          if (msg.length < 10) return ERRO('Escreva uma mensagem com pelo menos 10 caracteres.')
          if (msg.length > 400) return ERRO('A mensagem deve ter no máximo 400 caracteres.')
          const mes = hojeISO().slice(0, 7)
          const enviadosMes = d.reconhecimentos.filter((r) => r.deId === me.id && r.criadoEm.slice(0, 7) === mes).length
          if (enviadosMes >= d.config.gamificacao.limiteReconhecimentosEnviadosMes) return ERRO('Você atingiu o limite mensal de reconhecimentos. Obrigado pela generosidade!')
          const rec = { id: uid('rc'), deId: me.id, paraId, valor, mensagem: msg, publico, criadoEm: agoraISO() }
          d.reconhecimentos = [rec, ...d.reconhecimentos]
          pontuar(d, { pessoaId: paraId, acao: 'reconhecimento_recebido', referenciaId: rec.id, descricao: `Reconhecimento (${valor})` })
          const ptsEnvio = pontuar(d, { pessoaId: me.id, acao: 'reconhecimento_enviado', referenciaId: rec.id, descricao: 'Reconheceu um colega' })
          notificar(d, { colaboradorId: paraId, tipo: 'gamificacao', titulo: 'Você recebeu um reconhecimento', texto: `${me.nome.split(' ')[0]} reconheceu você por ${valor}.`, href: '/experiencia' })
          return OK({ id: rec.id, info: ptsEnvio ? `+${ptsEnvio} pontos por reconhecer.` : undefined })
        }),
        participarDesafio: (id, participar) => tx((d) => {
          const me = get().realUser().id
          const des = d.desafios.find((x) => x.id === id)
          if (!des) return ERRO('Desafio não encontrado.')
          if (hojeISO() > des.fim) return ERRO('Este desafio já foi encerrado.')
          const participantes = participar ? [...new Set([...des.participantes, me])] : des.participantes.filter((x) => x !== me)
          d.desafios = d.desafios.map((x) => (x.id === id ? { ...x, participantes } : x))
          // Ações já realizadas no período contam para o progresso.
          if (participar) {
            const p = progressoDesafio({ ...des, participantes }, d.lancamentos, me, hojeISO())
            if (p.status === 'ativo' && !p.concluido && p.atual >= p.meta) {
              const pts = pontuar(d, { pessoaId: me, acao: 'desafio_concluido', referenciaId: des.id, descricao: `Desafio: ${des.titulo}`, pontos: des.pontosBonus })
              return OK({ info: pts ? `Você já cumpria a meta! +${pts} pontos.` : undefined })
            }
          }
        }),
        salvarDesafio: (des, id) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          if (!des.titulo.trim()) return ERRO('Informe o título.')
          if (!des.inicio || !des.fim || des.fim < des.inicio) return ERRO('Período inválido.')
          if (!(des.criterio.meta >= 1)) return ERRO('A meta deve ser ao menos 1.')
          if (!(des.pontosBonus >= 0 && des.pontosBonus <= 1000)) return ERRO('Bônus deve ficar entre 0 e 1000 pontos.')
          if (id) d.desafios = d.desafios.map((x) => (x.id === id ? { ...x, ...des } : x))
          else d.desafios = [{ ...des, id: uid('d'), participantes: [], criadoPorId: get().realUser().id }, ...d.desafios]
          audit(d, 'desafio.salvar', 'desafio', id ?? '-', `Desafio "${des.titulo}"`)
        }),
        salvarRegra: (id, patch) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          if (patch.pontos != null && !(patch.pontos >= 0 && patch.pontos <= 1000)) return ERRO('Pontos devem ficar entre 0 e 1000.')
          if (patch.limiteMensal != null && !(patch.limiteMensal >= 1)) return ERRO('Limite mensal deve ser ao menos 1 (ou vazio).')
          const r = d.regras.find((x) => x.id === id)
          d.regras = d.regras.map((x) => (x.id === id ? { ...x, ...patch } : x))
          audit(d, 'regra.atualizar', 'regra_pontuacao', id, `Regra "${r?.nome}" atualizada (vale para novos lançamentos)`)
        }),
        salvarBadge: (id, patch) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          d.badges = d.badges.map((x) => (x.id === id ? { ...x, ...patch } : x))
        }),
        salvarConfigGamificacao: (c) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          const erro = validarNiveis(c.niveis)
          if (erro) return ERRO(erro)
          if (!(c.limiteReconhecimentosEnviadosMes >= 1)) return ERRO('O limite de reconhecimentos deve ser ao menos 1.')
          d.config = { ...d.config, gamificacao: c }
          audit(d, 'config.gamificacao', 'config', 'gamificacao', 'Configuração de gamificação atualizada')
        }),
        concederPontos: (pessoaId, pontos, motivo) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          if (!(pontos > 0 && pontos <= 500)) return ERRO('Concessões manuais devem ficar entre 1 e 500 pontos.')
          if (motivo.trim().length < 10) return ERRO('Justifique a concessão (mín. 10 caracteres). Ela fica registrada no histórico.')
          const me = get().realUser()
          const l = { id: uid('l'), colaboradorId: pessoaId, acao: 'ajuste_manual' as AcaoPontuavel, referenciaId: uid('aj'), pontos, descricao: `Concessão manual: ${motivo.trim()}`, criadoEm: agoraISO(), registradoPorId: me.id }
          d.lancamentos = [...d.lancamentos, l]
          audit(d, 'pontos.conceder', 'lancamento', l.id, `${pontos} pts para ${get().nomeDe(pessoaId)}`)
        }),
        estornarLancamento: (id, motivo) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          const l = d.lancamentos.find((x) => x.id === id)
          if (!l) return ERRO('Lançamento não encontrado.')
          if (l.pontos <= 0) return ERRO('Este lançamento não pode ser estornado.')
          if (d.lancamentos.some((x) => x.referenciaId === `estorno:${id}`)) return ERRO('Este lançamento já foi estornado.')
          if (motivo.trim().length < 10) return ERRO('Justifique o estorno (mín. 10 caracteres).')
          const est = { id: uid('l'), colaboradorId: l.colaboradorId, acao: 'ajuste_manual' as AcaoPontuavel, referenciaId: `estorno:${id}`, pontos: -l.pontos, descricao: `Correção de lançamento indevido: ${motivo.trim()}`, criadoEm: agoraISO(), registradoPorId: get().realUser().id }
          d.lancamentos = [...d.lancamentos, est]
          audit(d, 'pontos.estornar', 'lancamento', id, `Estorno de ${l.pontos} pts (${get().nomeDe(l.colaboradorId)})`)
        }),

        /* ---------- iniciativas voluntárias ---------- */
        addIniciativa: (t) => tx((d) => {
          if (!pode('iniciativas:gerenciar')) return SEM_PERMISSAO
          if (!t.titulo.trim()) return ERRO('Informe o título.')
          const max = d.config.gamificacao.pontosMaximosIniciativa
          if (!(t.pontos >= 0 && t.pontos <= max)) return ERRO(`Pontos devem ficar entre 0 e ${max}.`)
          d.iniciativas = [{ ...t, id: uid('i'), status: 'aberta', voluntarioId: null, criadaPor: get().realUser().id, criadaEm: hojeISO() }, ...d.iniciativas]
        }),
        assumirIniciativa: (id) => tx((d) => {
          const me = get().realUser().id
          const t = d.iniciativas.find((x) => x.id === id)
          if (!t || t.status !== 'aberta') return ERRO('Esta iniciativa não está mais disponível.')
          d.iniciativas = d.iniciativas.map((x) => (x.id === id ? { ...x, status: 'andamento', voluntarioId: me } : x))
        }),
        desistirIniciativa: (id) => tx((d) => {
          const t = d.iniciativas.find((x) => x.id === id)
          if (!t || t.voluntarioId !== get().realUser().id || t.status !== 'andamento') return SEM_PERMISSAO
          d.iniciativas = d.iniciativas.map((x) => (x.id === id ? { ...x, status: 'aberta', voluntarioId: null } : x))
        }),
        enviarContribuicao: (id, entrega) => tx((d) => {
          const t = d.iniciativas.find((x) => x.id === id)
          if (!t || t.voluntarioId !== get().realUser().id) return SEM_PERMISSAO
          if (entrega.trim().length < 5) return ERRO('Conte brevemente como foi a contribuição (ou cole um link).')
          d.iniciativas = d.iniciativas.map((x) => (x.id === id ? { ...x, status: 'revisao', entrega: entrega.trim(), concluidaEm: hojeISO() } : x))
          notificar(d, { colaboradorId: t.criadaPor, tipo: 'pendencia', titulo: 'Contribuição para confirmar', texto: `"${t.titulo}"`, href: '/gamificacao' })
        }),
        confirmarIniciativa: (id) => tx((d) => {
          const me = get().currentUser()
          const t = d.iniciativas.find((x) => x.id === id)
          if (!t || t.status !== 'revisao' || !t.voluntarioId) return ERRO('Nada a confirmar.')
          if (!can(me.papel, 'iniciativas:gerenciar')) return SEM_PERMISSAO
          if (t.voluntarioId === me.id) return ERRO('Outra pessoa da organização precisa confirmar a sua contribuição.')
          d.iniciativas = d.iniciativas.map((x) => (x.id === id ? { ...x, status: 'concluida', confirmadaPor: me.id } : x))
          const pts = pontuar(d, { pessoaId: t.voluntarioId, acao: 'iniciativa_concluida', referenciaId: id, descricao: `Iniciativa: ${t.titulo}`, pontos: t.pontos, registradoPorId: me.id })
          notificar(d, { colaboradorId: t.voluntarioId, tipo: 'gamificacao', titulo: 'Contribuição confirmada', texto: `Obrigado por "${t.titulo}"!${pts ? ` +${pts} pontos.` : ''}`, href: '/experiencia' })
          return OK({ info: pts ? `+${pts} pontos para ${get().nomeDe(t.voluntarioId)}.` : undefined })
        }),
        devolverIniciativa: (id) => tx((d) => {
          if (!pode('iniciativas:gerenciar')) return SEM_PERMISSAO
          d.iniciativas = d.iniciativas.map((x) => (x.id === id ? { ...x, status: 'andamento', concluidaEm: undefined } : x))
        }),
        removerIniciativa: (id) => tx((d) => {
          if (!pode('iniciativas:gerenciar')) return SEM_PERMISSAO
          const t = d.iniciativas.find((x) => x.id === id)
          if (t && t.status !== 'aberta') return ERRO('Só iniciativas sem voluntário podem ser removidas.')
          d.iniciativas = d.iniciativas.filter((x) => x.id !== id)
        }),

        /* ---------- conteúdos ---------- */
        concluirConteudo: (treinamentoId) => tx((d) => {
          const me = get().realUser().id
          if (d.progressoConteudos.some((p) => p.colaboradorId === me && p.treinamentoId === treinamentoId)) return ERRO('Você já concluiu este conteúdo.')
          const t = d.treinamentos.find((x) => x.id === treinamentoId)
          if (!t) return ERRO('Conteúdo não encontrado.')
          d.progressoConteudos = [...d.progressoConteudos, { colaboradorId: me, treinamentoId, concluidoEm: hojeISO() }]
          const pts = pontuar(d, { pessoaId: me, acao: 'conteudo_concluido', referenciaId: treinamentoId, descricao: `Conteúdo: ${t.titulo}` })
          return OK({ info: pts ? `+${pts} pontos.` : undefined })
        }),
        salvarConteudo: (t, id) => tx((d) => {
          if (!pode('onboarding:gerenciar')) return SEM_PERMISSAO
          if (!t.titulo.trim()) return ERRO('Informe o título.')
          if (t.link && !/^https?:\/\//i.test(t.link)) return ERRO('O link deve começar com http:// ou https://')
          if (id) d.treinamentos = d.treinamentos.map((x) => (x.id === id ? { ...x, ...t } : x))
          else d.treinamentos = [...d.treinamentos, { ...t, id: uid('t') }]
        }),

        /* ---------- pesquisas ---------- */
        responderPesquisa: (id, respostas) => tx((d) => {
          const me = get().realUser()
          const p = d.pesquisas.find((x) => x.id === id)
          if (!p || !pesquisaAbertaPara(p, me.setorId, hojeISO())) return ERRO('Esta pesquisa não está aberta para você.')
          if (d.participacoes.some((x) => x.pesquisaId === id && x.colaboradorId === me.id)) return ERRO('Você já respondeu esta pesquisa.')
          const erro = validarRespostas(p, respostas)
          if (erro) return ERRO(erro)
          const limpas = Object.fromEntries(Object.entries(respostas).filter(([, v]) => v !== '').map(([k, v]) => [k, typeof v === 'string' ? v.trim().slice(0, 1000) : v]))
          // Resposta sem identidade; participação registrada separadamente.
          d.respostas = [...d.respostas, { id: uid('rp'), pesquisaId: id, setorId: me.setorId, respostas: limpas, enviadaEm: hojeISO() }]
          d.participacoes = [...d.participacoes, { pesquisaId: id, colaboradorId: me.id }]
          const pts = pontuar(d, { pessoaId: me.id, acao: 'pesquisa_respondida', referenciaId: id, descricao: 'Respondeu a uma pesquisa' })
          return OK({ info: pts ? `Obrigado! +${pts} pontos.` : 'Obrigado pela participação!' })
        }),
        salvarPesquisa: (p, id) => tx((d) => {
          if (!pode('pesquisas:gerenciar')) return SEM_PERMISSAO
          if (!p.titulo.trim()) return ERRO('Informe o título.')
          if (!p.perguntas.length || p.perguntas.some((q) => !q.texto.trim())) return ERRO('Inclua ao menos uma pergunta, todas com texto.')
          if (p.perguntas.some((q) => q.tipo === 'opcoes' && (q.opcoes ?? []).filter((o) => o.trim()).length < 2)) return ERRO('Perguntas de opções precisam de ao menos 2 opções.')
          if (!p.inicio || !p.fim || p.fim < p.inicio) return ERRO('Período inválido.')
          if (!(p.minimoRespostas >= 3)) return ERRO('O mínimo de respostas para exibir resultados deve ser 3 ou mais.')
          if (id) {
            const atual = d.pesquisas.find((x) => x.id === id)
            if (atual && d.respostas.some((r) => r.pesquisaId === id) && JSON.stringify(atual.perguntas) !== JSON.stringify(p.perguntas)) {
              return ERRO('A pesquisa já tem respostas — as perguntas não podem mais ser alteradas.')
            }
            d.pesquisas = d.pesquisas.map((x) => (x.id === id ? { ...x, ...p } : x))
          } else d.pesquisas = [{ ...p, id: uid('q'), criadaPor: get().realUser().id, criadaEm: hojeISO() }, ...d.pesquisas]
          audit(d, 'pesquisa.salvar', 'pesquisa', id ?? '-', `Pesquisa "${p.titulo}" (${p.status})`)
        }),

        /* ---------- comunidade ---------- */
        enviarParabens: (paraId, ocasiao, mensagem) => tx((d) => {
          const me = get().realUser()
          if (paraId === me.id) return ERRO('Você não pode enviar parabéns para si mesmo(a).')
          if (d.parabens.some((p) => p.deId === me.id && p.paraId === paraId && p.ocasiao === ocasiao)) return ERRO('Você já enviou uma mensagem nesta ocasião.')
          const msg = mensagem.trim()
          if (msg.length < 2 || msg.length > 280) return ERRO('A mensagem deve ter entre 2 e 280 caracteres.')
          d.parabens = [{ id: uid('pb'), deId: me.id, paraId, ocasiao, mensagem: msg, criadoEm: agoraISO() }, ...d.parabens]
          notificar(d, { colaboradorId: paraId, tipo: 'gamificacao', titulo: 'Você recebeu uma mensagem 🎉', texto: `${me.nome.split(' ')[0]}: ${msg}`, href: '/aniversarios' })
        }),

        /* ---------- objetivos ---------- */
        salvarObjetivo: (o, id) => tx((d) => {
          const me = get().currentUser()
          const lidera = areasLideradas(me, d.setores).some((s) => s.id === o.setorId)
          if (!pode('estrutura:gerenciar') && !lidera) return SEM_PERMISSAO
          if (!o.titulo.trim()) return ERRO('Informe o título.')
          if (!(o.meta > 0) || !(o.atual >= 0)) return ERRO('Meta e valor atual devem ser números válidos.')
          if (id) d.objetivos = d.objetivos.map((x) => (x.id === id ? { ...x, ...o } : x))
          else d.objetivos = [...d.objetivos, { ...o, id: uid('o') }]
        }),
        removerObjetivo: (id) => tx((d) => {
          const me = get().currentUser()
          const o = d.objetivos.find((x) => x.id === id)
          if (!o) return ERRO('Objetivo não encontrado.')
          if (!pode('estrutura:gerenciar') && !areasLideradas(me, d.setores).some((s) => s.id === o.setorId)) return SEM_PERMISSAO
          d.objetivos = d.objetivos.filter((x) => x.id !== id)
        }),


        /* ---------- ficha complementar, diversidade e perfil ---------- */
        salvarDiversidade: (div) => tx((d) => {
          const me = get().realUser()
          // Sem consentimento, nenhum dado de diversidade é mantido.
          const valor: Diversidade = div.consentimento ? { ...div, consentidoEm: div.consentidoEm ?? hojeISO() } : { consentimento: false }
          d.colaboradores = d.colaboradores.map((c) => (c.id === me.id ? { ...c, diversidade: valor } : c))
          audit(d, div.consentimento ? 'lgpd.diversidade.consentir' : 'lgpd.diversidade.revogar', 'pessoa', me.id, div.consentimento ? 'Dados de diversidade autodeclarados' : 'Consentimento de diversidade revogado (dados apagados)')
        }),
        salvarPerfilComportamental: (pessoaId, perfil) => tx((d) => {
          const me = get().realUser()
          if (pessoaId !== me.id && !pode('perfis:consultar')) return SEM_PERMISSAO
          if (perfil && !perfil.consentimento) return ERRO('O perfil só pode ser registrado com consentimento da pessoa.')
          const vals = perfil ? [...Object.values(perfil.disc), ...Object.values(perfil.tracos)] : []
          if (vals.some((v) => !(v >= 0 && v <= 100))) return ERRO('Valores devem ficar entre 0 e 100.')
          d.colaboradores = d.colaboradores.map((c) => (c.id === pessoaId ? { ...c, perfil: perfil ? { ...perfil, atualizadoEm: hojeISO() } : undefined } : c))
          audit(d, perfil ? 'perfil.salvar' : 'perfil.remover', 'pessoa', pessoaId, perfil ? 'Perfil comportamental atualizado' : 'Perfil comportamental removido')
        }),
        salvarDependente: (dep, id) => tx((d) => {
          const me = get().realUser()
          if (dep.colaboradorId !== me.id && !pode('beneficios:gerenciar')) return SEM_PERMISSAO
          if (dep.nome.trim().length < 2) return ERRO('Informe o nome do dependente.')
          if (!dep.parentesco.trim()) return ERRO('Informe o parentesco.')
          if (dep.cpf && !cpfValido(dep.cpf)) return ERRO('CPF do dependente inválido.')
          if (dep.nascimento && dep.nascimento > hojeISO()) return ERRO('Data de nascimento no futuro.')
          if (id) d.dependentes = d.dependentes.map((x) => (x.id === id ? { ...x, ...dep } : x))
          else d.dependentes = [...d.dependentes, { ...dep, id: uid('dp') }]
          audit(d, 'dependente.salvar', 'dependente', id ?? '-', 'Dependente registrado')
        }),
        removerDependente: (id) => tx((d) => {
          const dep = d.dependentes.find((x) => x.id === id)
          if (!dep) return ERRO('Dependente não encontrado.')
          if (dep.colaboradorId !== get().realUser().id && !pode('beneficios:gerenciar')) return SEM_PERMISSAO
          d.dependentes = d.dependentes.filter((x) => x.id !== id)
          d.beneficiarios = d.beneficiarios.map((b) => ({ ...b, dependentesIds: b.dependentesIds.filter((x) => x !== id) }))
          audit(d, 'dependente.remover', 'dependente', id, 'Dependente removido')
        }),
        salvarExigencia: (e, id) => tx((d) => {
          if (!pode('documentos:gerenciar')) return SEM_PERMISSAO
          if (!e.descricao.trim()) return ERRO('Descreva a exigência.')
          if (!e.data) return ERRO('Informe a data.')
          if (e.validade && e.validade < e.data) return ERRO('A validade deve ser igual ou posterior à data.')
          if (id) d.exigencias = d.exigencias.map((x) => (x.id === id ? { ...x, ...e } : x))
          else d.exigencias = [...d.exigencias, { ...e, id: uid('ex'), criadoPorId: get().realUser().id }]
          audit(d, 'exigencia.salvar', 'exigencia', id ?? '-', `${e.tipo} registrada`)
        }),
        removerExigencia: (id) => tx((d) => {
          if (!pode('documentos:gerenciar')) return SEM_PERMISSAO
          d.exigencias = d.exigencias.filter((x) => x.id !== id)
          audit(d, 'exigencia.remover', 'exigencia', id, 'Exigência removida')
        }),
        salvarCargo: (c, id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!c.nome.trim()) return ERRO('Informe o nome da função.')
          if (!d.setores.some((x) => x.id === c.setorId)) return ERRO('Selecione a área.')
          if (id && c.funcaoSuperiorId === id) return ERRO('A função não pode ser superior a si mesma.')
          if (c.faixaValor?.min != null && c.faixaValor?.max != null && c.faixaValor.max < c.faixaValor.min) return ERRO('O valor máximo da faixa deve ser maior que o mínimo.')
          if (c.codigoCBO && !/^\d{4}-?\d{2}$/.test(c.codigoCBO.trim())) return ERRO('CBO no formato 0000-00.')
          const rec = { ...c, nome: c.nome.trim() }
          const novoId = id ?? uid('g')
          if (id) d.cargos = d.cargos.map((x) => (x.id === id ? { ...x, ...rec } : x))
          else d.cargos = [...d.cargos, { ...rec, id: novoId }]
          audit(d, id ? 'funcao.atualizar' : 'funcao.criar', 'funcao', novoId, `Função ${c.nome}`)
          return OK({ id: novoId })
        }),

        /* ---------- benefícios ---------- */
        salvarBeneficio: (b, id) => tx((d) => {
          if (!pode('beneficios:gerenciar')) return SEM_PERMISSAO
          if (b.nome.trim().length < 2) return ERRO('Informe o nome do benefício.')
          if (b.valor != null && !(b.valor >= 0)) return ERRO('Valor inválido.')
          if (b.aplicadoComo === 'percentual_contrato' && b.valor != null && b.valor > 100) return ERRO('Percentual acima de 100%.')
          if (b.coparticipacao != null && !(b.coparticipacao >= 0)) return ERRO('Coparticipação inválida.')
          if (b.opcaoCoparticipacao === 'percentual' && (b.coparticipacao ?? 0) > 100) return ERRO('Coparticipação acima de 100%.')
          if (id) d.beneficios = d.beneficios.map((x) => (x.id === id ? { ...x, ...b } : x))
          else d.beneficios = [...d.beneficios, { ...b, id: uid('v') }]
          audit(d, 'beneficio.salvar', 'beneficio', id ?? '-', `Benefício ${b.nome}`)
        }),
        removerBeneficio: (id) => tx((d) => {
          if (!pode('beneficios:gerenciar')) return SEM_PERMISSAO
          const n = d.beneficiarios.filter((x) => x.beneficioId === id).length
          if (n) return ERRO(`Há ${n} pessoa(s) vinculada(s). Remova os vínculos antes.`)
          d.beneficios = d.beneficios.filter((x) => x.id !== id)
          audit(d, 'beneficio.remover', 'beneficio', id, 'Benefício removido')
        }),
        vincularBeneficiarios: (beneficioId, pessoaIds, deps) => tx((d) => {
          if (!pode('beneficios:gerenciar')) return SEM_PERMISSAO
          const b = d.beneficios.find((x) => x.id === beneficioId)
          if (!b) return ERRO('Benefício não encontrado.')
          if (!pessoaIds.length) return ERRO('Selecione ao menos uma pessoa.')
          let novos = 0, ignorados = 0
          for (const pid of pessoaIds) {
            // Igual ao upsert do sistema de RH: duplicados são ignorados.
            if (d.beneficiarios.some((x) => x.beneficioId === beneficioId && x.colaboradorId === pid)) { ignorados++; continue }
            const depIds = b.permiteDependentes ? (deps?.[pid] ?? []).filter((x) => d.dependentes.some((dp) => dp.id === x && dp.colaboradorId === pid)) : []
            d.beneficiarios = [...d.beneficiarios, { id: uid('bf'), colaboradorId: pid, beneficioId, desde: hojeISO(), dependentesIds: depIds }]
            notificar(d, { colaboradorId: pid, tipo: 'aprovacao', titulo: 'Benefício vinculado', texto: `Você foi incluído(a) em "${b.nome}".`, href: '/beneficios' })
            novos++
          }
          audit(d, 'beneficio.vincular', 'beneficio', beneficioId, `${novos} vínculo(s) criado(s)`)
          return OK({ info: `${novos} vínculo(s) criado(s)${ignorados ? `, ${ignorados} já existia(m)` : ''}.` })
        }),
        desvincularBeneficiario: (id) => tx((d) => {
          if (!pode('beneficios:gerenciar')) return SEM_PERMISSAO
          d.beneficiarios = d.beneficiarios.filter((x) => x.id !== id)
          audit(d, 'beneficio.desvincular', 'beneficiario', id, 'Vínculo removido')
        }),

        /* ---------- competências ---------- */
        salvarGrupoCompetencia: (g, id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (g.nome.trim().length < 2) return ERRO('Informe o nome do grupo.')
          if (id) d.gruposCompetencia = d.gruposCompetencia.map((x) => (x.id === id ? { ...x, ...g } : x))
          else d.gruposCompetencia = [...d.gruposCompetencia, { ...g, id: uid('gc') }]
        }),
        removerGrupoCompetencia: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (d.competencias.some((c) => c.grupoId === id)) return ERRO('O grupo tem competências. Arquive-o ou mova as competências.')
          d.gruposCompetencia = d.gruposCompetencia.filter((x) => x.id !== id)
        }),
        salvarCompetencia: (c, id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (c.nome.trim().length < 2) return ERRO('Informe o nome da competência.')
          if (!d.gruposCompetencia.some((g) => g.id === c.grupoId)) return ERRO('Selecione o grupo.')
          if (!(c.peso >= 1 && c.peso <= 100)) return ERRO('Peso entre 1 e 100.')
          if (id) d.competencias = d.competencias.map((x) => (x.id === id ? { ...x, ...c } : x))
          else d.competencias = [...d.competencias, { ...c, id: uid('cp') }]
          audit(d, 'competencia.salvar', 'competencia', id ?? '-', `Competência ${c.nome}`)
        }),
        removerCompetencia: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (d.respostasAvaliacao.some((r) => r.notas[id] != null) || d.avaliacoesInicio.some((a) => a.notas?.[id] != null)) return ERRO('Competência já usada em avaliações — arquive em vez de remover.')
          d.competencias = d.competencias.filter((x) => x.id !== id)
        }),

        /* ---------- ciclos de avaliação ---------- */
        salvarCiclo: (c, id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          const atual = id ? d.ciclos.find((x) => x.id === id) : undefined
          if (id && !atual) return ERRO('Ciclo não encontrado.')
          if (atual && atual.status !== 'rascunho' && (c.tipoRelacao || c.niveisEscala || c.rotuloEscala)) return ERRO('Ciclo já iniciado: escala e relações não podem mudar.')
          const merged = { ...(atual ?? {}), ...c } as CicloAvaliativo
          if (!merged.nome?.trim() || merged.nome.trim().length < 2) return ERRO('Informe o nome da avaliação.')
          if (!merged.abertura || !merged.encerramento) return ERRO('Informe as datas de abertura e encerramento.')
          if (merged.encerramento < merged.abertura) return ERRO('O encerramento deve ser depois da abertura.')
          if (id) { d.ciclos = d.ciclos.map((x) => (x.id === id ? merged : x)); return OK({ id }) }
          const padrao: Partial<CicloAvaliativo> = {
            niveisEscala: 5, rotuloEscala: 'desempenho', comentarioCompetenciaMostrar: true, comentarioCompetenciaObrigatorio: false,
            comentarioGeralObrigatorio: false, tipoRelacao: 'direta_90', autoavaliacao: false, regimes: [], etapa: 1,
          }
          const novo = { ...padrao, ...merged, id: uid('cv'), status: 'rascunho', criadoEm: hojeISO() } as CicloAvaliativo
          d.ciclos = [novo, ...d.ciclos]
          audit(d, 'ciclo.criar', 'ciclo', novo.id, `Ciclo "${novo.nome}"`)
          return OK({ id: novo.id })
        }),
        gerarParticipantesCiclo: (cicloId) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          const c = d.ciclos.find((x) => x.id === cicloId)
          if (!c) return ERRO('Ciclo não encontrado.')
          if (c.status !== 'rascunho') return ERRO('Participantes só podem ser gerados em rascunho.')
          const novos = gerarParticipantes(c, d.colaboradores, d.setores, () => uid('pc'))
          d.participantesCiclo = [...d.participantesCiclo.filter((p) => p.cicloId !== cicloId), ...novos]
          return OK({ info: `${novos.length} par(es) avaliador → avaliado.` })
        }),
        adicionarParticipante: (cicloId, avaliadorId, avaliadoId) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (!avaliadorId || !avaliadoId) return ERRO('Escolha avaliador e avaliado.')
          if (d.participantesCiclo.some((p) => p.cicloId === cicloId && p.avaliadorId === avaliadorId && p.avaliadoId === avaliadoId)) return ERRO('Esse par já existe.')
          d.participantesCiclo = [...d.participantesCiclo, { id: uid('pc'), cicloId, avaliadorId, avaliadoId }]
        }),
        removerParticipante: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (d.respostasAvaliacao.some((r) => r.participanteId === id)) return ERRO('Esse par já respondeu.')
          d.participantesCiclo = d.participantesCiclo.filter((p) => p.id !== id)
        }),
        finalizarCiclo: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          const c = d.ciclos.find((x) => x.id === id)
          if (!c) return ERRO('Ciclo não encontrado.')
          const parts = d.participantesCiclo.filter((p) => p.cicloId === id)
          if (!parts.length) return ERRO('Inclua ao menos um participante.')
          d.ciclos = d.ciclos.map((x) => (x.id === id ? { ...x, status: 'ativo', etapa: 4 } : x))
          ;[...new Set(parts.map((p) => p.avaliadorId))].forEach((av) => notificar(d, { colaboradorId: av, tipo: 'pendencia', titulo: 'Avaliação para responder', texto: `"${c.nome}" está aberta até ${c.encerramento}.`, href: '/avaliacoes' }))
          audit(d, 'ciclo.iniciar', 'ciclo', id, `Ciclo "${c.nome}" iniciado com ${parts.length} pares`)
          return OK({ info: `${new Set(parts.map((p) => p.avaliadorId)).size} avaliador(es) notificado(s).` })
        }),
        encerrarCiclo: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          d.ciclos = d.ciclos.map((x) => (x.id === id ? { ...x, status: 'encerrado' } : x))
          audit(d, 'ciclo.encerrar', 'ciclo', id, 'Ciclo encerrado')
        }),
        removerCiclo: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          const c = d.ciclos.find((x) => x.id === id)
          if (c?.status !== 'rascunho') return ERRO('Só rascunhos podem ser removidos.')
          d.ciclos = d.ciclos.filter((x) => x.id !== id)
          d.participantesCiclo = d.participantesCiclo.filter((p) => p.cicloId !== id)
        }),
        responderAvaliacao: (participanteId, notas, comentarios, comentarioGeral) => tx((d) => {
          const me = get().realUser()
          const par = d.participantesCiclo.find((p) => p.id === participanteId)
          if (!par) return ERRO('Avaliação não encontrada.')
          if (par.avaliadorId !== me.id) return SEM_PERMISSAO
          const c = d.ciclos.find((x) => x.id === par.cicloId)!
          const hoje = hojeISO()
          if (c.status !== 'ativo' || hoje < c.abertura || hoje > c.encerramento) return ERRO('Este ciclo não está aberto para respostas.')
          if (d.respostasAvaliacao.some((r) => r.participanteId === participanteId)) return ERRO('Você já respondeu esta avaliação.')
          const avaliado = d.colaboradores.find((x) => x.id === par.avaliadoId)!
          const comps = competenciasDe(avaliado, d.competencias, 'desempenho')
          for (const comp of comps) {
            const n = notas[comp.id]
            if (!(n >= 1 && n <= c.niveisEscala)) return ERRO(`Avalie: ${comp.nome}`)
            if (c.comentarioCompetenciaObrigatorio && !comentarios[comp.id]?.trim()) return ERRO(`Comente: ${comp.nome}`)
          }
          if (c.comentarioGeralObrigatorio && !comentarioGeral?.trim()) return ERRO('O comentário geral é obrigatório neste ciclo.')
          d.respostasAvaliacao = [...d.respostasAvaliacao, { id: uid('ra'), cicloId: c.id, participanteId, notas, comentarios, comentarioGeral: comentarioGeral?.trim() || undefined, respondidaEm: hoje }]
          audit(d, 'avaliacao.responder', 'ciclo', c.id, 'Avaliação respondida')
        }),

        /* ---------- avaliação de início de parceria ---------- */
        salvarConfigAvaliacaoInicio: (cfg) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (!cfg.marcos.length) return ERRO('Escolha os marcos de avaliação.')
          if (!(cfg.prazoRespostaDias >= 1)) return ERRO('Prazo de resposta inválido.')
          d.config = { ...d.config, avaliacaoInicio: cfg }
          audit(d, 'config.avaliacao_inicio', 'config', 'avaliacaoInicio', cfg.habilitado ? 'Avaliação de início habilitada' : 'Avaliação de início desabilitada')
        }),
        sincronizarAvaliacoesInicio: () => tx((d) => {
          const { novas, expiradasIds } = gerarAvaliacoesInicio(d.config.avaliacaoInicio, d.colaboradores, d.setores, d.avaliacoesInicio, hojeISO(), () => uid('ai'))
          if (!novas.length && !expiradasIds.length) return OK({ info: 'Nada novo a gerar.' })
          d.avaliacoesInicio = [...d.avaliacoesInicio.map((a) => (expiradasIds.includes(a.id) ? { ...a, status: 'expirada' as const } : a)), ...novas]
          novas.forEach((a) => a.avaliadorId && notificar(d, { colaboradorId: a.avaliadorId, tipo: 'pendencia', titulo: 'Avaliação de início de parceria', texto: `${d.colaboradores.find((c) => c.id === a.avaliadoId)?.nome}: marco de ${a.marcoDias} dias.`, href: '/avaliacoes' }))
          return OK({ info: `${novas.length} gerada(s), ${expiradasIds.length} expirada(s).` })
        }),
        responderAvaliacaoInicio: (id, notas, comentario, continuidade) => tx((d) => {
          const me = get().realUser()
          const a = d.avaliacoesInicio.find((x) => x.id === id)
          if (!a) return ERRO('Avaliação não encontrada.')
          if (a.avaliadorId !== me.id && !pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          if (a.status !== 'pendente') return ERRO(a.status === 'respondida' ? 'Já respondida.' : 'O prazo desta avaliação expirou.')
          const avaliado = d.colaboradores.find((x) => x.id === a.avaliadoId)!
          const comps = competenciasDe(avaliado, d.competencias, 'inicio_parceria')
          for (const comp of comps) if (!(notas[comp.id] >= 1 && notas[comp.id] <= 5)) return ERRO(`Avalie: ${comp.nome}`)
          const nota = notaPonderada(notas, comps, 5)
          d.avaliacoesInicio = d.avaliacoesInicio.map((x) => (x.id === id ? { ...x, notas, nota: nota ?? undefined, comentario: comentario.trim() || undefined, continuidade, status: 'respondida', respondidaEm: hojeISO(), avaliadorId: x.avaliadorId ?? me.id } : x))
          if (continuidade === 'revisar') notificarRH(d, { tipo: 'pendencia', titulo: 'Início de parceria para revisar', texto: `${avaliado.nome} (marco de ${a.marcoDias} dias) foi sinalizado(a) para conversa.`, href: '/rh/avaliacoes' })
          audit(d, 'avaliacao_inicio.responder', 'avaliacao_inicio', id, `Marco de ${a.marcoDias} dias respondido`)
        }),

        /* ---------- análise de grupos ---------- */
        classificarGrupo: (pessoaId, grupo) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          d.classificacoesGrupo = d.classificacoesGrupo.filter((x) => x.colaboradorId !== pessoaId)
          if (grupo) d.classificacoesGrupo = [...d.classificacoesGrupo, { colaboradorId: pessoaId, grupo, porId: get().realUser().id, em: hojeISO() }]
        }),
        inverterGrupos: () => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          d.classificacoesGrupo = d.classificacoesGrupo.map((x) => ({ ...x, grupo: x.grupo === 'alto' ? 'desenvolvimento' : 'alto' }))
        }),

        /* ---------- feedbacks ---------- */
        salvarFeedback: (f, id) => tx((d) => {
          const me = get().currentUser()
          const alvo = d.colaboradores.find((c) => c.id === f.colaboradorId)
          if (!alvo) return ERRO('Selecione a pessoa.')
          if (alvo.id === me.id) return ERRO('Feedback é sobre outra pessoa.')
          const lidera = areasLideradas(me, d.setores).some((s) => s.id === alvo.setorId) || alvo.responsavelId === me.id
          if (!pode('pessoas:gerenciar') && !(pode('feedbacks:registrar') && lidera)) return SEM_PERMISSAO
          if (f.comentario.trim().length < 3) return ERRO('Escreva o feedback.')
          if (!f.data) return ERRO('Informe a data.')
          if (id) {
            const atual = d.feedbacks.find((x) => x.id === id)
            if (!atual || (atual.autorId !== me.id && !pode('pessoas:gerenciar'))) return SEM_PERMISSAO
            d.feedbacks = d.feedbacks.map((x) => (x.id === id ? { ...x, ...f } : x))
          } else {
            d.feedbacks = [{ ...f, comentario: f.comentario.trim(), id: uid('fb'), autorId: me.id, criadoEm: hojeISO() }, ...d.feedbacks]
            if (f.visivelParaPessoa) notificar(d, { colaboradorId: alvo.id, tipo: 'pendencia', titulo: 'Novo feedback', texto: `${me.nome.split(' ')[0]} registrou um feedback para você.`, href: '/perfil' })
          }
          audit(d, 'feedback.salvar', 'feedback', id ?? '-', `Feedback (${f.classificacao}) para ${alvo.nome}`)
        }),
        removerFeedback: (id) => tx((d) => {
          const f = d.feedbacks.find((x) => x.id === id)
          if (!f) return ERRO('Feedback não encontrado.')
          if (f.autorId !== get().realUser().id && !pode('pessoas:gerenciar')) return SEM_PERMISSAO
          d.feedbacks = d.feedbacks.filter((x) => x.id !== id)
          audit(d, 'feedback.remover', 'feedback', id, 'Feedback removido')
        }),

        /* ---------- cultura e configurações gerais ---------- */
        salvarCultura: (c) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (!c.valores.length || c.valores.some((v) => !v.nome.trim())) return ERRO('Inclua ao menos um valor, todos com nome.')
          if (new Set(c.valores.map((v) => v.nome.trim().toLowerCase())).size !== c.valores.length) return ERRO('Há valores com nomes repetidos.')
          d.config = { ...d.config, cultura: { ...c, valores: c.valores.map((v) => ({ ...v, nome: v.nome.trim() })), atualizadoEm: hojeISO() } }
          audit(d, 'config.cultura', 'config', 'cultura', 'Cultura organizacional atualizada')
        }),
        salvarConfigGeral: (g) => tx((d) => {
          if (!pode('config:geral')) return SEM_PERMISSAO
          if (!g.nomeEmpresa.trim()) return ERRO('Informe o nome da empresa.')
          if (g.cnpjTomador && !cnpjValido(g.cnpjTomador)) return ERRO('CNPJ do tomador inválido.')
          if (!emailValido(g.emailRH) || !emailValido(g.emailFinanceiro)) return ERRO('Informe e-mails válidos.')
          d.config = { ...d.config, geral: g }
          audit(d, 'config.geral', 'config', 'geral', 'Configurações gerais atualizadas')
        }),


        /* ---------- apresentações ---------- */
        criarApresentacao: (modeloId, titulo) => tx((d) => {
          const t = titulo.trim()
          if (t.length < 3) return ERRO('Dê um título à apresentação (mín. 3 caracteres).')
          const a = montarApresentacao(modeloPorId(ehEditorLivre(modeloId) || ehArte(modeloId) ? 'institucional' : modeloId), t.slice(0, 80), get().realUser().id, hojeISO(), () => uid('sl'))
          if (ehArte(modeloId)) {
            const { w, h } = tamanhoDe(modeloId)
            if (w < TAMANHO_MIN || h < TAMANHO_MIN || w > TAMANHO_MAX || h > TAMANHO_MAX) return ERRO(`Tamanho inválido: use de ${TAMANHO_MIN} a ${TAMANHO_MAX} px.`)
          }
          if (ehEditorLivre(modeloId) || ehArte(modeloId)) { a.modeloId = modeloId; a.deck = null }
          d.apresentacoes = [a, ...d.apresentacoes]
          return OK({ id: a.id })
        }),
        salvarApresentacao: (id, patch) => tx((d) => {
          const a = d.apresentacoes.find((x) => x.id === id)
          if (!a) return ERRO('Apresentação não encontrada.')
          if (a.criadaPorId !== get().realUser().id) return SEM_PERMISSAO
          if (patch.titulo !== undefined && patch.titulo.trim().length < 3) return ERRO('Título muito curto.')
          if (patch.slides && !patch.slides.length) return ERRO('A apresentação precisa ter ao menos um slide.')
          if (patch.slides && patch.slides.length > 40) return ERRO('Limite de 40 slides por apresentação.')
          if (patch.deck && JSON.stringify(patch.deck).length > 3_000_000) return ERRO('O design ficou grande demais (fotos). Reduza o número de imagens.')
          if (patch.capa && (!patch.capa.startsWith('data:image/') || patch.capa.length > 250_000)) return ERRO('Miniatura inválida.')
          d.apresentacoes = d.apresentacoes.map((x) => (x.id === id ? { ...x, ...patch, titulo: patch.titulo?.trim() ?? x.titulo, atualizadaEm: hojeISO() } : x))
        }),
        duplicarApresentacao: (id) => tx((d) => {
          const a = d.apresentacoes.find((x) => x.id === id)
          const me = get().realUser().id
          if (!a || (a.criadaPorId !== me && !a.compartilhada)) return SEM_PERMISSAO
          const copia: Apresentacao = { ...a, id: uid('ap'), titulo: `${a.titulo} (cópia)`.slice(0, 80), slides: a.slides.map((x) => ({ ...x, id: uid('sl'), valores: { ...x.valores } })), deck: a.deck === undefined ? undefined : structuredClone(a.deck), criadaPorId: me, compartilhada: false, criadaEm: hojeISO(), atualizadaEm: hojeISO() }
          d.apresentacoes = [copia, ...d.apresentacoes]
          return OK({ id: copia.id })
        }),
        removerApresentacao: (id) => tx((d) => {
          const a = d.apresentacoes.find((x) => x.id === id)
          if (!a) return ERRO('Apresentação não encontrada.')
          if (a.criadaPorId !== get().realUser().id && !pode('admin:usuarios')) return SEM_PERMISSAO
          d.apresentacoes = d.apresentacoes.filter((x) => x.id !== id)
        }),

        /* ---------- caixa de sugestões (anônima) ----------
           Nenhuma ação abaixo grava auditoria ou notificação com a identidade de quem sugeriu/apoiou. */
        sugestaoEhMinha: (id) => get().sugestoes.find((x) => x.id === id)?.autorChave === chaveAutor(get().realUser().id),
        minhaChaveApoio: (id) => chaveApoio(get().realUser().id, id),
        enviarSugestao: (sg) => tx((d) => {
          const me = chaveAutor(get().realUser().id)
          const titulo = sg.titulo.trim(), descricao = sg.descricao.trim()
          if (titulo.length < 5 || titulo.length > 100) return ERRO('O título deve ter entre 5 e 100 caracteres.')
          if (descricao.length < 10 || descricao.length > 800) return ERRO('Descreva a ideia em 10 a 800 caracteres.')
          const mes = hojeISO().slice(0, 7)
          if (d.sugestoes.filter((x) => x.autorChave === me && x.criadaEm.slice(0, 7) === mes).length >= 10) return ERRO('Você atingiu o limite de 10 sugestões neste mês.')
          const nova: Sugestao = { id: uid('sg'), titulo, descricao, categoria: sg.categoria, status: 'aguardando', autorChave: me, apoios: [], criadaEm: hojeISO() }
          d.sugestoes = [nova, ...d.sugestoes]
          return OK({ id: nova.id })
        }),
        editarSugestao: (id, sg) => tx((d) => {
          const x = d.sugestoes.find((y) => y.id === id)
          if (!x) return ERRO('Sugestão não encontrada.')
          if (x.autorChave !== chaveAutor(get().realUser().id)) return SEM_PERMISSAO
          if (x.status !== 'aguardando') return ERRO('Só dá para editar enquanto a sugestão está aguardando análise.')
          const titulo = sg.titulo.trim(), descricao = sg.descricao.trim()
          if (titulo.length < 5 || titulo.length > 100) return ERRO('O título deve ter entre 5 e 100 caracteres.')
          if (descricao.length < 10 || descricao.length > 800) return ERRO('Descreva a ideia em 10 a 800 caracteres.')
          d.sugestoes = d.sugestoes.map((y) => (y.id === id ? { ...y, titulo, descricao, categoria: sg.categoria, editadaEm: hojeISO() } : y))
        }),
        excluirSugestao: (id) => tx((d) => {
          const x = d.sugestoes.find((y) => y.id === id)
          if (!x) return ERRO('Sugestão não encontrada.')
          if (x.autorChave !== chaveAutor(get().realUser().id)) return SEM_PERMISSAO
          if (x.status !== 'aguardando') return ERRO('Sugestões já respondidas ficam no histórico e não podem ser excluídas.')
          d.sugestoes = d.sugestoes.filter((y) => y.id !== id)
        }),
        apoiarSugestao: (id) => tx((d) => {
          const x = d.sugestoes.find((y) => y.id === id)
          if (!x) return ERRO('Sugestão não encontrada.')
          const me = get().realUser().id
          if (x.autorChave === chaveAutor(me)) return ERRO('Você não pode apoiar a própria sugestão.')
          const k = chaveApoio(me, id)
          const apoios = x.apoios.includes(k) ? x.apoios.filter((a) => a !== k) : [...x.apoios, k]
          d.sugestoes = d.sugestoes.map((y) => (y.id === id ? { ...y, apoios } : y))
        }),
        moderarSugestao: (id, status, resposta) => tx((d) => {
          if (!pode('sugestoes:moderar')) return SEM_PERMISSAO
          const x = d.sugestoes.find((y) => y.id === id)
          if (!x) return ERRO('Sugestão não encontrada.')
          const r = resposta?.trim()
          if (status === 'recusada' && (!r || r.length < 10)) return ERRO('Explique o motivo da recusa (mín. 10 caracteres) — a resposta é pública.')
          if (r && r.length > 500) return ERRO('Resposta muito longa (máx. 500 caracteres).')
          d.sugestoes = d.sugestoes.map((y) => (y.id === id ? { ...y, status, resposta: status === 'aguardando' ? undefined : r ?? y.resposta, respondidaEm: status === 'aguardando' ? undefined : hojeISO(), moderadorId: status === 'aguardando' ? undefined : get().realUser().id } : y))
          audit(d, 'sugestao.moderar', 'sugestao', id, `Sugestão "${x.titulo}" → ${status}`)
        }),

        /* ---------- notificações (somente as do usuário logado) ---------- */
        marcarNotifLida: (id) => {
          const me = get().realUser().id
          set((s) => ({ notificacoes: s.notificacoes.map((n) => (n.id === id && n.colaboradorId === me ? { ...n, lida: true } : n)) }))
        },
        marcarTodasLidas: () => {
          const me = get().realUser().id
          set((s) => ({ notificacoes: s.notificacoes.map((n) => (n.colaboradorId === me ? { ...n, lida: true } : n)) }))
        },

        /* ---------- exclusões definitivas ---------- */
        excluirPessoa: (id) => tx((d) => {
          if (!pode('admin:usuarios')) return SEM_PERMISSAO
          const c = d.colaboradores.find((x) => x.id === id)
          if (!c) return ERRO('Pessoa não encontrada.')
          if (id === get().realUser().id) return ERRO('Você não pode excluir o próprio cadastro.')
          if (c.papel === 'admin' && d.colaboradores.filter((x) => x.papel === 'admin').length <= 1) return ERRO('Não é possível excluir o único administrador.')
          const pares = new Set(d.participantesCiclo.filter((p) => p.avaliadoId === id || p.avaliadorId === id).map((p) => p.id))
          d.colaboradores = d.colaboradores.filter((x) => x.id !== id).map((x) => (x.responsavelId === id ? { ...x, responsavelId: undefined } : x))
          d.setores = d.setores.map((x) => ({ ...x, gestorId: x.gestorId === id ? null : x.gestorId, liderancaIds: x.liderancaIds.filter((l) => l !== id) }))
          d.contratos = d.contratos.filter((x) => x.colaboradorId !== id)
          d.documentos = d.documentos.filter((x) => x.colaboradorId !== id)
          d.reembolsos = d.reembolsos.filter((x) => x.colaboradorId !== id)
          d.notas = d.notas.filter((x) => x.colaboradorId !== id)
          d.periodos = d.periodos.filter((x) => x.colaboradorId !== id)
          d.progressoConteudos = d.progressoConteudos.filter((x) => x.colaboradorId !== id)
          d.conquistas = d.conquistas.filter((x) => x.colaboradorId !== id)
          d.lancamentos = d.lancamentos.filter((x) => x.colaboradorId !== id)
          d.reconhecimentos = d.reconhecimentos.filter((x) => x.deId !== id && x.paraId !== id)
          d.processos = d.processos.filter((x) => x.colaboradorId !== id)
          d.registros = d.registros.filter((x) => x.colaboradorId !== id)
          d.notificacoes = d.notificacoes.filter((x) => x.colaboradorId !== id)
          d.parabens = d.parabens.filter((x) => x.deId !== id && x.paraId !== id)
          d.historicoFuncao = d.historicoFuncao.filter((x) => x.colaboradorId !== id)
          d.dependentes = d.dependentes.filter((x) => x.colaboradorId !== id)
          d.exigencias = d.exigencias.filter((x) => x.colaboradorId !== id)
          d.beneficiarios = d.beneficiarios.filter((x) => x.colaboradorId !== id)
          d.participacoes = d.participacoes.filter((x) => x.colaboradorId !== id)
          d.participantesCiclo = d.participantesCiclo.filter((x) => !pares.has(x.id))
          d.respostasAvaliacao = d.respostasAvaliacao.filter((x) => !pares.has(x.participanteId))
          d.avaliacoesInicio = d.avaliacoesInicio.filter((x) => x.avaliadoId !== id).map((x) => (x.avaliadorId === id ? { ...x, avaliadorId: undefined } : x))
          d.classificacoesGrupo = d.classificacoesGrupo.filter((x) => x.colaboradorId !== id)
          d.feedbacks = d.feedbacks.filter((x) => x.colaboradorId !== id)
          d.desafios = d.desafios.map((x) => ({ ...x, participantes: x.participantes.filter((p) => p !== id) }))
          d.eventos = d.eventos.map((x) => ({ ...x, confirmados: x.confirmados.filter((p) => p !== id), interessados: x.interessados.filter((p) => p !== id), presencas: x.presencas.filter((p) => p !== id) }))
          d.comunicados = d.comunicados.map((x) => ({ ...x, lidoPor: x.lidoPor.filter((p) => p !== id) }))
          audit(d, 'pessoa.excluir', 'pessoa', id, `Cadastro de ${c.nome} excluído definitivamente`)
        }),
        removerContrato: (id) => tx((d) => {
          if (MODO_API) return NO_FINANCEIRO
          if (!pode('pessoas:ver_contratos')) return SEM_PERMISSAO
          const k = d.contratos.find((x) => x.id === id)
          if (!k) return ERRO('Contrato não encontrado.')
          d.contratos = d.contratos.filter((x) => x.id !== id)
          audit(d, 'contrato.remover', 'contrato', id, `Contrato ${k.numero} removido`)
        }),
        excluirEvento: (id) => tx((d) => {
          const ev = d.eventos.find((x) => x.id === id)
          if (!ev) return ERRO('Evento não encontrado.')
          if (!podeGerenciarEvento(ev, get().currentUser(), d.setores)) return SEM_PERMISSAO
          d.eventos = d.eventos.filter((x) => x.id !== id)
          audit(d, 'evento.excluir', 'evento', id, `Evento "${ev.titulo}" excluído`)
        }),
        excluirPesquisa: (id) => tx((d) => {
          if (!pode('pesquisas:gerenciar')) return SEM_PERMISSAO
          const p = d.pesquisas.find((x) => x.id === id)
          if (!p) return ERRO('Pesquisa não encontrada.')
          d.pesquisas = d.pesquisas.filter((x) => x.id !== id)
          d.respostas = d.respostas.filter((x) => x.pesquisaId !== id)
          d.participacoes = d.participacoes.filter((x) => x.pesquisaId !== id)
          audit(d, 'pesquisa.excluir', 'pesquisa', id, `Pesquisa "${p.titulo}" excluída com as respostas`)
        }),
        removerDesafio: (id) => tx((d) => {
          if (!pode('gamificacao:configurar')) return SEM_PERMISSAO
          const x = d.desafios.find((y) => y.id === id)
          if (!x) return ERRO('Desafio não encontrado.')
          d.desafios = d.desafios.filter((y) => y.id !== id)
          audit(d, 'desafio.remover', 'desafio', id, `Desafio "${x.titulo}" removido`)
        }),
        removerConteudo: (id) => tx((d) => {
          if (!pode('desenvolvimento:gerenciar')) return SEM_PERMISSAO
          const x = d.treinamentos.find((y) => y.id === id)
          if (!x) return ERRO('Conteúdo não encontrado.')
          d.treinamentos = d.treinamentos.filter((y) => y.id !== id)
          d.progressoConteudos = d.progressoConteudos.filter((y) => y.treinamentoId !== id)
          audit(d, 'conteudo.remover', 'conteudo', id, `Conteúdo "${x.titulo}" removido`)
        }),
        removerMotivo: (id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (d.colaboradores.some((c) => c.encerramento?.motivoId === id)) return ERRO('Motivo já usado em encerramentos — desative em vez de remover.')
          d.motivosEncerramento = d.motivosEncerramento.filter((x) => x.id !== id)
          audit(d, 'motivo.remover', 'motivo', id, 'Motivo de encerramento removido')
        }),
        removerTipoRegistro: (id) => tx((d) => {
          if (!pode('estrutura:gerenciar')) return SEM_PERMISSAO
          if (d.registros.some((r) => r.tipoId === id)) return ERRO('Tipo já usado em registros — desative em vez de remover.')
          d.tiposRegistro = d.tiposRegistro.filter((x) => x.id !== id)
          audit(d, 'tipo_registro.remover', 'tipo_registro', id, 'Tipo de registro removido')
        }),
        excluirReembolso: (id) => tx((d) => {
          if (!pode('financeiro:gerenciar')) return SEM_PERMISSAO
          const r = d.reembolsos.find((x) => x.id === id)
          if (!r) return ERRO('Reembolso não encontrado.')
          d.reembolsos = d.reembolsos.filter((x) => x.id !== id)
          audit(d, 'reembolso.excluir', 'reembolso', id, `Reembolso "${r.descricao}" excluído`)
        }),
        excluirNota: (id) => tx((d) => {
          if (MODO_API) return NO_FINANCEIRO
          if (!pode('financeiro:gerenciar')) return SEM_PERMISSAO
          const n = d.notas.find((x) => x.id === id)
          if (!n) return ERRO('Nota fiscal não encontrada.')
          d.notas = d.notas.filter((x) => x.id !== id)
          audit(d, 'nota.excluir', 'nota', id, `Nota fiscal da competência ${n.competencia} excluída`)
        }),

        /* ---------- administração ---------- */
        alterarPapel: (id, papel) => tx((d) => {
          if (!pode('admin:usuarios')) return SEM_PERMISSAO
          const me = get().realUser()
          if (id === me.id && papel !== 'admin') return ERRO('Você não pode remover o próprio acesso de administração.')
          const alvo = d.colaboradores.find((c) => c.id === id)
          d.colaboradores = d.colaboradores.map((c) => (c.id === id ? { ...c, papel } : c))
          audit(d, 'acesso.papel', 'pessoa', id, `Papel de ${alvo?.nome} alterado para ${papel}`)
        }),
        reset: () => { definirVisaoColaborador(false); set({ ...(MODO_API ? seedProducao() : seed()), sessaoId: get().sessaoId, sidebarCollapsed: get().sidebarCollapsed, previewColaborador: false }) },
      }
    },
    {
      name: MODO_API ? '4juris_pessoas_ui_v1' : '4juris_pessoas_demo_v5',
      version: 5,
      partialize: (s) => {
        // No modo API os dados e a sessão ficam no servidor; no navegador só a preferência de layout.
        if (MODO_API) return { sidebarCollapsed: s.sidebarCollapsed } as unknown as AppState
        const out: Record<string, unknown> = { sessaoId: s.sessaoId, sidebarCollapsed: s.sidebarCollapsed }
        for (const k of DB_KEYS) out[k] = s[k]
        return out as unknown as AppState
      },
      // Versões anteriores tinham outro modelo (férias/folgas, senha em texto): descartamos.
      migrate: () => ({}) as AppState,
    },
  ),
)

/** Usuário logado (papel efetivo, considerando a visão de colaborador). */
export const useUser = () => useStore((s) => s.currentUser())
