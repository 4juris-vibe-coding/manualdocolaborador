/* ============================================================
   4JURIS Pessoas · Contrato da camada de dados (para o backend)
   ------------------------------------------------------------
   Este arquivo descreve, em TypeScript, o que um backend precisa
   oferecer para substituir o adaptador de demonstração
   (src/lib/store.ts). Não há implementação HTTP aqui de propósito:
   ela será escrita quando o banco/servidor existir.

   Convenções sugeridas:
   - REST sob VITE_API_URL, JSON, datas ISO 8601, IDs UUID.
   - Toda rota autenticada (sessão/JWT do provedor de identidade).
   - Autorização no servidor usando a mesma matriz de
     src/domain/permissions.ts (ex.: RLS no Postgres/Supabase).
   - Mutações retornam o registro gravado; erros de validação
     retornam 422 com { erro: string }.
   ============================================================ */
import type {
  Colaborador, Contrato, Documento, Evento, PeriodoIndisponibilidade, Comunicado, Reconhecimento,
  LancamentoPontos, Pesquisa, RespostaPesquisa, ProcessoJornada, RegistroAuditoria, DB,
} from '@/lib/types'

export interface Pagina<T> { itens: T[]; total: number; pagina: number; porPagina: number }

export interface RepositorioPessoas {
  listar(filtro: { q?: string; setorId?: string; status?: Colaborador['status']; pagina?: number }): Promise<Pagina<Colaborador>>
  obter(id: string): Promise<Colaborador | null>
  criar(dados: Omit<Colaborador, 'id' | 'avatarCor' | 'privacidade'>): Promise<Colaborador>
  atualizar(id: string, patch: Partial<Colaborador>): Promise<Colaborador>
  encerrarParceria(id: string, dados: { data: string; motivoId: string; observacao?: string }): Promise<Colaborador>
  /** LGPD: exportação dos dados do titular e anonimização após o encerramento. */
  exportarDadosTitular(id: string): Promise<Record<string, unknown>>
  anonimizar(id: string): Promise<void>
}

export interface RepositorioContratos {
  listarPorPessoa(pessoaId: string): Promise<Contrato[]>
  salvar(c: Omit<Contrato, 'id' | 'atualizadoEm'> & { id?: string }): Promise<Contrato>
}

export interface RepositorioDocumentos {
  listarPorPessoa(pessoaId: string): Promise<Documento[]>
  /** Upload real para storage privado; URL assinada de curta duração para download. */
  enviar(pessoaId: string, arquivo: File, meta: Pick<Documento, 'nome' | 'tipo' | 'validade' | 'confidencial'>): Promise<Documento>
  urlDownload(id: string): Promise<string>
  remover(id: string): Promise<void>
}

export interface RepositorioDisponibilidade {
  listar(filtro: { inicio: string; fim: string; setorId?: string }): Promise<PeriodoIndisponibilidade[]>
  registrar(p: Omit<PeriodoIndisponibilidade, 'id' | 'status' | 'criadoEm' | 'atualizadoEm' | 'colaboradorId'>): Promise<PeriodoIndisponibilidade>
  atualizar(id: string, patch: Partial<PeriodoIndisponibilidade>): Promise<PeriodoIndisponibilidade>
  cancelar(id: string): Promise<void>
  alinhar(id: string): Promise<PeriodoIndisponibilidade>
}

export interface RepositorioEventos {
  listar(filtro: { de?: string; ate?: string; categoria?: string }): Promise<Evento[]>
  salvar(e: Partial<Evento>): Promise<Evento>
  cancelar(id: string, motivo: string): Promise<void>
  responder(id: string, resposta: 'vou' | 'talvez' | null): Promise<void>
  registrarPresencas(id: string, pessoas: string[]): Promise<void>
}

export interface RepositorioComunicados {
  listarVisiveis(): Promise<Comunicado[]>
  publicar(c: Omit<Comunicado, 'id' | 'data' | 'lidoPor'>): Promise<Comunicado>
  marcarLido(id: string): Promise<void>
}

export interface RepositorioGamificacao {
  /** O servidor aplica as regras (src/domain/gamificacao.ts) — o cliente nunca envia "pontos". */
  extrato(pessoaId: string): Promise<LancamentoPontos[]>
  reconhecer(r: Pick<Reconhecimento, 'paraId' | 'valor' | 'mensagem' | 'publico'>): Promise<Reconhecimento>
  participarDesafio(id: string, participar: boolean): Promise<void>
}

export interface RepositorioPesquisas {
  listarAbertas(): Promise<Pesquisa[]>
  /** Grava resposta SEM identidade e, em tabela separada, apenas a participação. */
  responder(id: string, respostas: RespostaPesquisa['respostas']): Promise<void>
  /** Resultados já agregados e com supressão de grupos pequenos, calculados no servidor. */
  resultados(id: string, setorId?: string): Promise<unknown>
}

export interface RepositorioJornadas {
  listar(filtro: { tipo?: 'integracao' | 'encerramento'; emAndamento?: boolean }): Promise<ProcessoJornada[]>
  iniciar(pessoaId: string, modeloId: string): Promise<ProcessoJornada>
  marcarItem(processoId: string, itemId: string, feito: boolean): Promise<ProcessoJornada>
}

export interface RepositorioAuditoria {
  listar(filtro: { de?: string; ate?: string; atorId?: string; entidade?: string }): Promise<Pagina<RegistroAuditoria>>
}

/** Agregado de todos os repositórios — o que um adaptador "api" deve implementar. */
export interface FonteDeDados {
  pessoas: RepositorioPessoas
  contratos: RepositorioContratos
  documentos: RepositorioDocumentos
  disponibilidade: RepositorioDisponibilidade
  eventos: RepositorioEventos
  comunicados: RepositorioComunicados
  gamificacao: RepositorioGamificacao
  pesquisas: RepositorioPesquisas
  jornadas: RepositorioJornadas
  auditoria: RepositorioAuditoria
}

/** Coleções do modelo e a tabela correspondente sugerida (ver docs/banco/schema.sql). */
export const TABELAS: Record<keyof DB, string> = {
  colaboradores: 'pessoas', setores: 'areas', unidades: 'unidades', cargos: 'funcoes', contratos: 'contratos',
  documentos: 'documentos', reembolsos: 'reembolsos', notas: 'notas_fiscais', periodos: 'periodos_indisponibilidade',
  comunicados: 'comunicados', eventos: 'eventos', beneficios: 'vantagens', treinamentos: 'conteudos',
  progressoConteudos: 'conteudos_concluidos', badges: 'conquistas', conquistas: 'conquistas_obtidas',
  regras: 'regras_pontuacao', lancamentos: 'lancamentos_pontos', desafios: 'desafios', reconhecimentos: 'reconhecimentos',
  iniciativas: 'iniciativas', checklists: 'checklist_modelos', processos: 'jornadas', motivosEncerramento: 'motivos_encerramento',
  tiposRegistro: 'tipos_registro', registros: 'registros_administrativos', objetivos: 'objetivos', pesquisas: 'pesquisas',
  respostas: 'pesquisa_respostas', participacoes: 'pesquisa_participacoes', parabens: 'mensagens_celebracao',
  notificacoes: 'notificacoes', auditoria: 'auditoria', config: 'configuracoes',
  historicoFuncao: 'historico_funcao', dependentes: 'dependentes', exigencias: 'exigencias', beneficiarios: 'beneficiarios',
  gruposCompetencia: 'grupos_competencia', competencias: 'competencias', ciclos: 'ciclos_avaliativos', participantesCiclo: 'ciclo_participantes',
  respostasAvaliacao: 'avaliacao_respostas', apresentacoes: 'apresentacoes', sugestoes: 'sugestoes', avaliacoesInicio: 'avaliacoes_inicio_parceria', classificacoesGrupo: 'classificacoes_grupo', feedbacks: 'feedbacks',
}
