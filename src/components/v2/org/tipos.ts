/* Tipos da resposta de /api/v2/organograma* usados pela interface. */
export interface CartaoPessoa {
  id: string
  nome: string
  apelido: string | null
  avatarCor: string | null
  cargo: string | null
  nivel: string | null
  setorId: string | null
  setor: string | null
  setorCor: string | null
  unidadeId: string | null
  unidade: string | null
  status: string
  gestorId: string | null
  gestorForaDaVisao: string | null
  /** Sem gestor imediato definido: o gestor mostrado é o líder do departamento. */
  gestorViaDepartamento: boolean
  lidera: boolean
  diretos: number
  totalAbaixo: number
  nivelHierarquico: number | null
  pendente: boolean
  filhosNaVisao: number
  contato: { email: string | null; telefone: string | null; cidade: string | null; uf: string | null } | null
}
export interface PosicaoVagaDto { vagaId: string; titulo: string; abertas: number; gestorId: string | null; setor: string | null; setorId: string | null; cargo: string | null }
export interface VisaoOrg {
  itens: CartaoPessoa[]
  raizes: string[]
  total: number
  parcial: boolean
  posicoesVagas: PosicaoVagaDto[]
  encerradas: { id: string; nome: string }[]
  areas: { id: string; nome: string; cor: string | null; gestorId: string | null }[]
  unidades: { id: string; nome: string }[]
  gestores: { id: string; nome: string }[]
  podeEditar: boolean
  podeVerPerfilCompleto: boolean
}
export interface ResultadoBusca { id: string; nome: string; cargo: string | null; setor: string | null; caminho: string[] }

export interface ItemContagem { id: string; nome: string; qtd: number }
export interface AnaliseOrg {
  indicadores: {
    totalAtivos: number; totalCadastrados: number; gestores: number; niveisHierarquicos: number
    porNivelHierarquico: { nivel: number; qtd: number }[]
    porSetor: ItemContagem[]; porUnidade: ItemContagem[]; porCargo: ItemContagem[]; porSenioridade: ItemContagem[]
    equipes: { id: string; nome: string; diretos: number; totais: number }[]
    tamanhoMedioEquipe: number | null
    pendenciasPorTipo: Record<string, number>
    setoresSemGestor: string[]
    ciclos: string[][]
    raizes: number
    posicoesVagas: { total: number; porSetor: ItemContagem[] }
    indisponiveis: { indicador: string; dependencia: string }[]
  }
  pendencias: { tipo: string; rotulo: string; pessoaId: string | null; pessoa: string | null; setorId: string | null; setor: string | null; detalhe: string | null; ciclo: string[] | null }[]
  evolucao: { mes: string; dados: { ativos: number; gestores: number; niveis: number; pendencias: number } }[] | null
  mensagemEvolucao: string | null
  retratos: number
}

/** Nó da árvore na interface: pessoa ou posição vaga. */
export type NoUI =
  | { tipo: 'pessoa'; chave: string; pessoa: CartaoPessoa }
  | { tipo: 'vaga'; chave: string; vaga: PosicaoVagaDto; gestorId: string }
