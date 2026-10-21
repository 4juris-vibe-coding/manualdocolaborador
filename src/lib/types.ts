/* ============================================================
   4JURIS Pessoas · Modelo de domínio (TypeScript)
   ------------------------------------------------------------
   Contexto: a plataforma atende prestadores de serviço contratados
   como pessoa jurídica. O modelo NÃO contém conceitos de vínculo
   CLT (férias, ponto, banco de horas, folha, admissão/demissão).
   Datas: 'YYYY-MM-DD' para datas; ISO 8601 completo para instantes.
   IDs: strings estáveis (no backend, recomenda-se UUID).
   ============================================================ */

export type Papel = 'colaborador' | 'gestor' | 'rh' | 'admin' | 'diretoria'

/** Situação da parceria na plataforma (não é status trabalhista). */
export type StatusParceria = 'integracao' | 'ativo' | 'pendente' | 'encerrado'

/** Forma de contratação da prestação de serviços. */
export type Regime = 'PJ' | 'MEI' | 'autonomo'

export type PixTipo = 'CNPJ' | 'CPF' | 'E-mail' | 'Telefone' | 'Aleatória'

export interface PreferenciasPrivacidade {
  /** Exibe dia e mês do aniversário para a comunidade (nunca o ano). */
  mostrarAniversario: boolean
  /** Exibe aniversários de parceria (ex.: "2 anos de 4JURIS"). */
  mostrarMarcos: boolean
  /** Aparece em destaques da gamificação. */
  aparecerEmDestaques: boolean
}

export interface Colaborador {
  id: string
  nome: string
  nomeSocial?: string
  email: string
  telefone: string
  avatarCor: string
  papel: Papel
  setorId: string
  cargoId: string
  unidadeId?: string
  status: StatusParceria
  /** Início da parceria. */
  dataEntrada: string
  /** Opcional — usado apenas para celebração, conforme preferências. */
  nascimento?: string
  cidade: string
  uf: string
  // Dados da prestação de serviços
  regime: Regime
  cpf?: string
  razaoSocial: string
  cnpj: string
  // Dados bancários / PIX (pagamento de notas fiscais e reembolsos)
  banco?: string
  agencia?: string
  conta?: string
  pixTipo?: PixTipo
  pixChave?: string
  // Emergência
  emergenciaNome?: string
  emergenciaTelefone?: string
  emergenciaParentesco?: string
  privacidade: PreferenciasPrivacidade
  /** Preenchido quando a parceria é encerrada. */
  encerramento?: { data: string; motivoId: string; observacao?: string }
  // ---------- Ficha complementar (portada do sistema de RH; tudo opcional) ----------
  endereco?: Endereco
  celular?: string
  emailPessoal?: string
  matricula?: string
  /** Ponto focal / responsável direto pela coordenação (equivale ao "superior direto"). */
  responsavelId?: string
  fusoHorario?: string
  tamanhoCamisa?: string
  escolaridade?: Escolaridade
  curso?: string
  /** Dados de diversidade: autodeclarados, opcionais e só usados de forma agregada. */
  diversidade?: Diversidade
  /** Perfil comportamental (DISC + traços), autodeclarado ou de assessment, com consentimento. */
  perfil?: PerfilComportamental
  codigoExterno?: string
}

export interface Endereco {
  cep?: string
  logradouro?: string
  numero?: string
  complemento?: string
  bairro?: string
  cidade?: string
  uf?: string
  pais?: string
}

export type Escolaridade =
  | 'fundamental_incompleto' | 'fundamental_completo' | 'medio_incompleto' | 'medio_completo'
  | 'superior_incompleto' | 'superior_completo' | 'pos_graduacao' | 'mestrado' | 'doutorado'

export type Genero = 'feminino' | 'masculino' | 'nao_binario' | 'outro' | 'prefiro_nao_informar'
export type RacaEtnia = 'branca' | 'preta' | 'parda' | 'amarela' | 'indigena' | 'nao_informado'
export type EstadoCivil = 'solteiro' | 'casado' | 'divorciado' | 'viuvo' | 'uniao_estavel'

export interface Diversidade {
  /** Consentimento específico para tratamento (dados sensíveis — LGPD art. 11). */
  consentimento: boolean
  consentidoEm?: string
  genero?: Genero
  racaEtnia?: RacaEtnia
  pcd?: boolean
  tipoDeficiencia?: string
  estadoCivil?: EstadoCivil
}

/** 4 dimensões DISC (0–100) + 24 traços opostos (0 = esquerda, 100 = direita). */
export interface PerfilDisc { executor: number; comunicador: number; planejador: number; analista: number }
export interface PerfilComportamental {
  consentimento: boolean
  fonte: 'autodeclarado' | 'assessment'
  atualizadoEm: string
  disc: PerfilDisc
  tracos: Record<string, number>
}

/** Mudanças de função/valor de contrato (portado de colaborador_historico_cargo). */
export interface HistoricoFuncao {
  id: string
  colaboradorId: string
  em: string
  porId: string
  cargoAnteriorId?: string
  cargoNovoId?: string
  valorAnterior?: number
  valorNovo?: number
}

export interface Dependente {
  id: string
  colaboradorId: string
  nome: string
  parentesco: string
  nascimento?: string
  cpf?: string
}

/* ---------- Exigências e certificações (adaptação de "Saúde ocupacional") ---------- */
export type TipoExigencia = 'Exame exigido por cliente' | 'Certificação técnica' | 'Treinamento de segurança (NR)' | 'Certidão' | 'Registro profissional' | 'Seguro de responsabilidade' | 'Outro'
export type SituacaoExigencia = 'regular' | 'com_ressalvas' | 'irregular'

export interface Exigencia {
  id: string
  colaboradorId: string
  tipo: TipoExigencia
  descricao: string
  data: string
  validade?: string
  situacao: SituacaoExigencia
  emissor?: string
  registro?: string
  observacoes?: string
  documentoId?: string
  criadoPorId?: string
}

export interface Setor {
  id: string
  nome: string
  descricao: string
  cor: string
  icon: string
  gestorId: string | null
  /** IDs de pessoas responsáveis pela coordenação da área. */
  liderancaIds: string[]
  /** Se true, apenas lideranças da área podem ver/solicitar reembolsos. */
  reembolsoApenasLideranca: boolean
  unidadeId?: string
  localizacao?: string
  telefone?: string
  ramal?: string
  email?: string
  /** Orçamento mensal de referência da área (opcional). */
  orcamentoMensal?: number
}

export interface Unidade {
  id: string
  nome: string
  endereco?: string
  telefone?: string
}

export type Senioridade = 'Júnior' | 'Pleno' | 'Sênior' | 'Especialista' | 'Liderança'

/** Função exercida na prestação de serviços. */
export interface Cargo {
  id: string
  nome: string
  setorId: string
  nivel: Senioridade
  descricao?: string
  // ---------- Engenharia de função (portado de "Engenharia de Cargo") ----------
  codigoCBO?: string
  funcaoSuperiorId?: string
  /** Atividades e responsabilidades (texto com quebras de linha / marcadores "- "). */
  atividades?: string
  habilidades?: string[]
  requisitos?: string[]
  responsaveisIds?: string[]
  /** Faixa de valor de referência para contratos desta função. */
  faixaValor?: { min?: number; max?: number; visivel: boolean }
  /** Perfil comportamental ideal da função. */
  perfilIdeal?: { disc: PerfilDisc; tracos: Record<string, number> }
}

/* ---------- Contratos de prestação de serviços ---------- */
export type StatusContrato = 'rascunho' | 'vigente' | 'em_renovacao' | 'encerrado'
export type ModalidadeContrato = 'mensal' | 'por-projeto'

export interface Contrato {
  id: string
  colaboradorId: string
  numero: string
  objeto: string
  modalidade: ModalidadeContrato
  /** Valor mensal de referência dos serviços (base para a NF mensal). */
  valorMensal: number
  inicio: string
  fim?: string
  renovacaoAutomatica: boolean
  status: StatusContrato
  observacoes?: string
  atualizadoEm: string
}

/* ---------- Documentos (metadados) ---------- */
export type TipoDocumento = 'Contrato' | 'Aditivo' | 'Cartão CNPJ' | 'Certidão' | 'Documento pessoal' | 'Comprovante' | 'Certificado' | 'Outro'

export interface Documento {
  id: string
  colaboradorId: string
  nome: string
  tipo: TipoDocumento
  data: string
  /** Data de validade, quando aplicável (ex.: certidões). */
  validade?: string
  tamanho: string
  /** Restrito à própria pessoa e ao RH. */
  confidencial: boolean
  enviadoPorId?: string
}

/* ---------- Financeiro PJ ---------- */
export type StatusSolicitacao = 'pendente' | 'aprovado' | 'recusado' | 'pagamento' | 'pago'

export interface Reembolso {
  id: string
  colaboradorId: string
  categoria: string
  descricao: string
  valor: number
  data: string
  status: StatusSolicitacao
  comprovante?: string
  criadoEm: string
  aprovadorId?: string
  aprovadoEm?: string
  pagoEm?: string
}

export type StatusNota = 'aguardando' | 'enviada' | 'aprovada' | 'pagamento' | 'paga' | 'atrasada'

export interface NotaFiscal {
  id: string
  colaboradorId: string
  competencia: string // "2026-07"
  valor: number
  status: StatusNota
  enviadaEm?: string
  prazo: string
  pagamentoEm?: string
  arquivo?: string
  aprovadorId?: string
  aprovadaEm?: string
  pagaEm?: string
}

/* ---------- Disponibilidade · Descanso combinado ---------- */
export type StatusPeriodo = 'planejado' | 'alinhado' | 'cancelado'

/**
 * Período de indisponibilidade combinado entre as partes.
 * Não é férias: não há saldo, direito anual, desconto ou aprovação
 * hierárquica. O "alinhamento" registra que a continuidade das entregas
 * foi combinada com quem coordena os projetos.
 */
export interface PeriodoIndisponibilidade {
  id: string
  colaboradorId: string
  inicio: string
  fim: string
  /** Visível à equipe e às lideranças da área. */
  mensagemEquipe?: string
  /** Visível apenas à própria pessoa e ao RH. */
  observacaoPrivada?: string
  /** Pessoa de contato para continuidade durante o período (opcional). */
  contatoContinuidadeId?: string
  planoContinuidade?: string
  status: StatusPeriodo
  alinhadoPorId?: string
  alinhadoEm?: string
  criadoEm: string
  atualizadoEm: string
}

export interface PoliticaDisponibilidade {
  /** Antecedência sugerida (não obrigatória) para registrar o período. */
  antecedenciaSugeridaDias: number
  /** Se true, lideranças registram o alinhamento de continuidade. */
  usarAlinhamento: boolean
  /** Exibe aviso quando há sobreposição de períodos na mesma área. */
  avisarSobreposicao: boolean
  /** Texto de orientação exibido a todos (definido pela empresa). */
  orientacao: string
}

/* ---------- Comunicação ---------- */
export type AlvoComunicado = 'todos' | 'setores' | 'usuarios'
export type CategoriaComunicado = 'Geral' | 'Financeiro' | 'Políticas' | 'Eventos' | 'Novidades'

export interface Comunicado {
  id: string
  titulo: string
  resumo: string
  corpo: string
  categoria: CategoriaComunicado
  autor: string
  autorId?: string
  data: string
  fixado?: boolean
  importante?: boolean
  lidoPor: string[]
  alvo: AlvoComunicado
  setoresAlvo: string[]
  usuariosAlvo: string[]
}

/* ---------- Eventos ---------- */
export type CategoriaEvento = 'Integração' | 'Celebração' | 'Aprendizado' | 'Reunião aberta' | 'Bem-estar' | 'Data comemorativa'

export interface Evento {
  id: string
  titulo: string
  descricao: string
  categoria: CategoriaEvento
  /** ISO datetime local (YYYY-MM-DDTHH:mm:ss) */
  inicio: string
  fim?: string
  local: string
  link?: string
  organizadorId: string
  visibilidade: 'todos' | 'setores'
  setoresAlvo: string[]
  status: 'agendado' | 'cancelado'
  motivoCancelamento?: string
  capacidade?: number
  /** Confirmaram participação (opcional — nenhum evento é obrigatório). */
  confirmados: string[]
  interessados: string[]
  /** Presença registrada pela organização após o evento. */
  presencas: string[]
  criadoEm: string
}

/* ---------- Gamificação ---------- */
export type AcaoPontuavel =
  | 'perfil_completo' | 'participacao_evento' | 'reconhecimento_recebido' | 'reconhecimento_enviado'
  | 'desafio_concluido' | 'conteudo_concluido' | 'pesquisa_respondida' | 'integracao_concluida'
  | 'iniciativa_concluida' | 'ajuste_manual'

export interface RegraPontuacao {
  id: string
  acao: AcaoPontuavel
  nome: string
  descricao: string
  pontos: number
  ativa: boolean
  /** Máximo de lançamentos desta ação por pessoa por mês (vazio = sem limite). */
  limiteMensal?: number
}

/** Registro auditável de pontos. O saldo é a soma dos lançamentos. */
export interface LancamentoPontos {
  id: string
  colaboradorId: string
  acao: AcaoPontuavel
  regraId?: string
  /** Referência que torna o lançamento único (evento, desafio, etc.). */
  referenciaId: string
  pontos: number
  descricao: string
  criadoEm: string
  /** Quem registrou (ajustes manuais e confirmações). */
  registradoPorId?: string
}

export interface NivelConfig { nivel: number; nome: string; minimo: number }

export interface ConfigGamificacao {
  /** Exibe "destaques da comunidade" (apenas quem optou por aparecer). */
  destaquesAtivos: boolean
  limiteReconhecimentosEnviadosMes: number
  pontosMaximosIniciativa: number
  niveis: NivelConfig[]
}

export type CriterioBadge =
  | { tipo: 'acao'; acao: AcaoPontuavel; quantidade: number }
  | { tipo: 'nivel'; nivel: number }

export interface Badge {
  id: string
  nome: string
  descricao: string
  icon: string
  cor: string
  raridade: 'comum' | 'raro' | 'épico' | 'lendário'
  criterio: CriterioBadge
  ativa: boolean
}

export interface ConquistaObtida { colaboradorId: string; badgeId: string; obtidaEm: string }

export interface Desafio {
  id: string
  titulo: string
  descricao: string
  inicio: string
  fim: string
  criterio: { acao: AcaoPontuavel; meta: number }
  pontosBonus: number
  /** Participação é opcional (opt-in). */
  participantes: string[]
  criadoPorId: string
}

/** Nome de um valor da cultura (configurável em Cultura organizacional). */
export type ValorCultural = string

export interface Reconhecimento {
  id: string
  deId: string
  paraId: string
  valor: ValorCultural
  mensagem: string
  /** Se false, só remetente e destinatário veem. */
  publico: boolean
  criadoEm: string
}

/** Iniciativa voluntária da comunidade (não é atribuição de trabalho). */
export type StatusIniciativa = 'aberta' | 'andamento' | 'revisao' | 'concluida'

export interface Iniciativa {
  id: string
  titulo: string
  descricao: string
  pontos: number
  status: StatusIniciativa
  voluntarioId: string | null
  criadaPor: string
  criadaEm: string
  prazo?: string
  /** Link ou breve relato da contribuição. */
  entrega?: string
  confirmadaPor?: string
  concluidaEm?: string
}

/* ---------- Conteúdos e integração ---------- */
export interface Treinamento {
  id: string
  titulo: string
  descricao: string
  categoria: string
  duracaoMin: number
  /** Recomendado para a integração inicial (não é obrigação trabalhista). */
  recomendado: boolean
  modulos: number
  link?: string
}

export interface ProgressoConteudo { colaboradorId: string; treinamentoId: string; concluidoEm: string }

export type TipoJornada = 'integracao' | 'encerramento'
export type ResponsavelItem = 'pessoa' | 'rh' | 'lideranca'

export interface ChecklistItemModelo {
  id: string
  titulo: string
  descricao?: string
  responsavel: ResponsavelItem
  /** Dias, a partir do início do processo, sugeridos para concluir. */
  prazoDias?: number
}

export interface ChecklistModelo {
  id: string
  nome: string
  tipo: TipoJornada
  itens: ChecklistItemModelo[]
}

export interface ProcessoItem extends ChecklistItemModelo {
  feito: boolean
  feitoEm?: string
  feitoPorId?: string
}

export interface ProcessoJornada {
  id: string
  colaboradorId: string
  modeloId: string
  tipo: TipoJornada
  iniciadoEm: string
  concluidoEm?: string
  itens: ProcessoItem[]
}

export interface MotivoEncerramento { id: string; nome: string; ativo: boolean }

/* ---------- Registros administrativos (RH) ---------- */
export interface TipoRegistro { id: string; nome: string; ativo: boolean }

export type ClassificacaoRegistro = 'positivo' | 'negativo' | 'neutro'

export interface RegistroAdministrativo {
  id: string
  colaboradorId: string
  tipoId: string
  data: string
  classificacao?: ClassificacaoRegistro
  /** Valor ou quantidade associada (ex.: valor de um aditivo). */
  quantidade?: number
  descricao: string
  autorId: string
  criadoEm: string
}

/* ---------- Objetivos (projetos e metas de área) ---------- */
export interface Objetivo {
  id: string
  codigo?: string
  titulo: string
  descricao: string
  setorId: string
  /** Mês de referência 'YYYY-MM'. */
  periodo: string
  meta: number
  atual: number
  unidadeMedida: string
  responsavelId?: string
}

/* ---------- Pesquisas (voluntárias e anônimas) ---------- */
export type TipoPergunta = 'escala' | 'enps' | 'texto' | 'opcoes'

export interface Pergunta {
  id: string
  texto: string
  tipo: TipoPergunta
  opcoes?: string[]
}

export interface Pesquisa {
  id: string
  titulo: string
  descricao: string
  perguntas: Pergunta[]
  inicio: string
  fim: string
  status: 'rascunho' | 'aberta' | 'encerrada'
  /** Áreas convidadas (vazio = todas). */
  setoresAlvo: string[]
  /** Grupos com menos respostas que isso têm resultados suprimidos. */
  minimoRespostas: number
  criadaPor: string
  criadaEm: string
}

/**
 * Resposta anônima: NÃO guarda quem respondeu. Apenas a área, para
 * recortes agregados que respeitam o mínimo de respostas.
 */
export interface RespostaPesquisa {
  id: string
  pesquisaId: string
  setorId: string
  respostas: Record<string, number | string>
  enviadaEm: string // apenas data
}

/** Registra que a pessoa já respondeu (evita duplicidade), sem ligação com o conteúdo. */
export interface ParticipacaoPesquisa { pesquisaId: string; colaboradorId: string }

/* ---------- Comunidade ---------- */
export interface Parabens {
  id: string
  deId: string
  paraId: string
  /** 'aniversario-2026' | 'marco-2026' */
  ocasiao: string
  mensagem: string
  criadoEm: string
}

export type TipoBeneficio =
  | 'plano_saude' | 'plano_odontologico' | 'seguro_vida' | 'auxilio_educacao' | 'bem_estar'
  | 'vale_refeicao' | 'vale_alimentacao' | 'vale_transporte' | 'auxilio_creche' | 'plr' | 'clube_descontos' | 'outro'

export interface Beneficio {
  id: string
  nome: string
  categoria: 'Bem-estar' | 'Saúde' | 'Educação' | 'Desconto'
  descricao: string
  icon: string
  elegibilidade: string
  comoUsar: string
  // ---------- Gestão (portado de "Cadastro de Benefícios") ----------
  tipo?: TipoBeneficio
  fornecedor?: string
  valor?: number
  aplicadoComo?: 'reais' | 'percentual_contrato'
  periodicidade?: 'diario' | 'semanal' | 'quinzenal' | 'mensal' | 'anual'
  /** Coparticipação paga pela pessoa. */
  coparticipacao?: number
  opcaoCoparticipacao?: 'percentual' | 'valor_fixo'
  permiteDependentes?: boolean
  ativo?: boolean
}

export interface Beneficiario {
  id: string
  colaboradorId: string
  beneficioId: string
  desde: string
  dependentesIds: string[]
}

/* ---------- Desenvolvimento: competências e avaliações ---------- */
export type Categoria9Box = 'nenhuma' | 'comportamento' | 'desempenho'
export interface GrupoCompetencia { id: string; nome: string; categoria9box: Categoria9Box; ativo: boolean }

export type TipoAvaliacaoCompetencia = 'desempenho' | 'inicio_parceria'
export interface Competencia {
  id: string
  tipo: TipoAvaliacaoCompetencia
  grupoId: string
  nome: string
  descricao?: string
  peso: number
  cargoIds: string[]
  ativo: boolean
}

export type TipoRelacaoAvaliacao = 'direta_90' | 'conjunta_180' | 'trezentos_sessenta' | 'customizada'
export type RotuloEscala = 'concordancia' | 'desempenho' | 'frequencia'

export interface CicloAvaliativo {
  id: string
  nome: string
  descricao?: string
  abertura: string
  encerramento: string
  niveisEscala: 4 | 5
  rotuloEscala: RotuloEscala
  comentarioCompetenciaMostrar: boolean
  comentarioCompetenciaObrigatorio: boolean
  comentarioGeralObrigatorio: boolean
  tipoRelacao: TipoRelacaoAvaliacao
  autoavaliacao: boolean
  /** Só pessoas com parceria iniciada até esta data. */
  iniciadosAte?: string
  regimes: Regime[]
  nivelEstrutura?: 'unidade' | 'area' | 'funcao'
  opcaoEstruturaId?: string
  status: 'rascunho' | 'ativo' | 'encerrado'
  etapa: 1 | 2 | 3 | 4
  criadoEm: string
}

export interface ParticipanteCiclo { id: string; cicloId: string; avaliadoId: string; avaliadorId: string }

export interface RespostaAvaliacao {
  id: string
  cicloId: string
  participanteId: string
  notas: Record<string, number>
  comentarios: Record<string, string>
  comentarioGeral?: string
  respondidaEm: string
}

/** Avaliação de início de parceria (adaptação da "avaliação de experiência"). */
export interface ConfigAvaliacaoInicio {
  habilitado: boolean
  marcos: number[] // dias após o início: [90] | [45, 90] | [30, 60, 90]
  regimes: Regime[]
  cargoIds: string[] // vazio = todas as funções
  /** Dias de antecedência para gerar a avaliação antes do marco. */
  antecedenciaDias: number
  /** Dias para responder após o marco. */
  prazoRespostaDias: number
}

export interface AvaliacaoInicio {
  id: string
  avaliadoId: string
  avaliadorId?: string
  cargoId?: string
  setorId?: string
  unidadeId?: string
  marcoDias: number
  dataReferencia: string
  expiraEm: string
  status: 'pendente' | 'respondida' | 'expirada'
  notas?: Record<string, number>
  nota?: number
  comentario?: string
  continuidade?: 'seguir' | 'ajustar' | 'revisar'
  respondidaEm?: string
  criadoEm: string
}

/** Agrupamento manual feito pelo RH para comparar grupos (portado de "Análise de Performance"). */
export interface ClassificacaoGrupo { colaboradorId: string; grupo: 'alto' | 'desenvolvimento'; porId: string; em: string }

/* ---------- Feedbacks ---------- */
export type ClassificacaoFeedback = 'positivo' | 'para_melhorar' | 'neutro'
export interface Feedback {
  id: string
  colaboradorId: string
  data: string
  classificacao: ClassificacaoFeedback
  comentario: string
  autorId: string
  /** Se true, a própria pessoa vê o feedback no perfil (transparência). */
  visivelParaPessoa: boolean
  criadoEm: string
}

/* ---------- Cultura organizacional ---------- */
export interface ValorCulturaConfig { nome: string; descricao: string; icone: string; cor: string }
export interface CulturaOrganizacional {
  proposito: string
  missao: string
  visao: string
  valores: ValorCulturaConfig[]
  atualizadoEm?: string
}

/* ---------- Apresentações (geradas a partir de modelos) ---------- */
export interface SlideInstancia {
  id: string
  /** Slide do modelo que originou este (define layout e campos). */
  modeloSlideId: string
  /** Valores dos campos. Listas são texto com um item por linha. */
  valores: Record<string, string>
}

export interface TemaApresentacao { variante: 'escuro' | 'claro'; cor: string; mostrarLogo: boolean }

export interface Apresentacao {
  id: string
  titulo: string
  modeloId: string
  tema: TemaApresentacao
  slides: SlideInstancia[]
  criadaPorId: string
  /** Se true, qualquer pessoa pode visualizar, apresentar e exportar (somente leitura). */
  compartilhada: boolean
  criadaEm: string
  atualizadaEm: string
  /** Presente (null = ainda vazio) quando a apresentação é do "Editor livre" (public/4jurisday-apresentacao.html);
   *  nesse caso o conteúdo vive aqui e `slides` é só um espaço reservado. */
  deck?: unknown | null
}

/* ---------- Caixa de sugestões (anônima) ---------- */
export type StatusSugestao = 'aguardando' | 'aprovada' | 'recusada'
export type CategoriaSugestao = 'Processos' | 'Cultura' | 'Ferramentas' | 'Eventos' | 'Benefícios' | 'Comunicação' | 'Outros'

/**
 * A sugestão NÃO guarda quem a enviou. `autorChave` é um identificador opaco
 * (hash com sal) usado só para permitir que a própria pessoa edite/exclua,
 * e nunca é exibido. Datas sem hora, para dificultar correlação.
 */
export interface Sugestao {
  id: string
  titulo: string
  descricao: string
  categoria: CategoriaSugestao
  status: StatusSugestao
  autorChave: string
  /** Chaves opacas de quem apoiou (uma por pessoa e sugestão). */
  apoios: string[]
  /** Resposta pública da equipe (obrigatória na recusa). */
  resposta?: string
  respondidaEm?: string
  moderadorId?: string
  criadaEm: string
  editadaEm?: string
}

export interface ConfigGeral {
  nomeEmpresa: string
  razaoSocialTomador: string
  cnpjTomador: string
  emailRH: string
  emailFinanceiro: string
}

export interface Notificacao {
  id: string
  /** Destinatário. */
  colaboradorId: string
  tipo: 'aprovacao' | 'recusa' | 'prazo' | 'comunicado' | 'evento' | 'gamificacao' | 'pendencia' | 'disponibilidade'
  titulo: string
  texto: string
  data: string
  lida: boolean
  href?: string
}

/* ---------- Auditoria ---------- */
export interface RegistroAuditoria {
  id: string
  em: string
  atorId: string
  acao: string
  entidade: string
  entidadeId: string
  /** Resumo legível, SEM dados sensíveis (documentos, valores bancários, senhas). */
  resumo: string
}

export interface ConfigPlataforma {
  disponibilidade: PoliticaDisponibilidade
  gamificacao: ConfigGamificacao
  financeiro: { diaEnvioNF: number; diaPagamento: number }
  geral: ConfigGeral
  cultura: CulturaOrganizacional
  avaliacaoInicio: ConfigAvaliacaoInicio
}

export interface DB {
  colaboradores: Colaborador[]
  setores: Setor[]
  unidades: Unidade[]
  cargos: Cargo[]
  contratos: Contrato[]
  documentos: Documento[]
  reembolsos: Reembolso[]
  notas: NotaFiscal[]
  periodos: PeriodoIndisponibilidade[]
  comunicados: Comunicado[]
  eventos: Evento[]
  beneficios: Beneficio[]
  treinamentos: Treinamento[]
  progressoConteudos: ProgressoConteudo[]
  badges: Badge[]
  conquistas: ConquistaObtida[]
  regras: RegraPontuacao[]
  lancamentos: LancamentoPontos[]
  desafios: Desafio[]
  reconhecimentos: Reconhecimento[]
  iniciativas: Iniciativa[]
  checklists: ChecklistModelo[]
  processos: ProcessoJornada[]
  motivosEncerramento: MotivoEncerramento[]
  tiposRegistro: TipoRegistro[]
  registros: RegistroAdministrativo[]
  objetivos: Objetivo[]
  pesquisas: Pesquisa[]
  respostas: RespostaPesquisa[]
  participacoes: ParticipacaoPesquisa[]
  parabens: Parabens[]
  notificacoes: Notificacao[]
  auditoria: RegistroAuditoria[]
  historicoFuncao: HistoricoFuncao[]
  dependentes: Dependente[]
  exigencias: Exigencia[]
  beneficiarios: Beneficiario[]
  gruposCompetencia: GrupoCompetencia[]
  competencias: Competencia[]
  ciclos: CicloAvaliativo[]
  participantesCiclo: ParticipanteCiclo[]
  respostasAvaliacao: RespostaAvaliacao[]
  avaliacoesInicio: AvaliacaoInicio[]
  classificacoesGrupo: ClassificacaoGrupo[]
  feedbacks: Feedback[]
  apresentacoes: Apresentacao[]
  sugestoes: Sugestao[]
  config: ConfigPlataforma
}
