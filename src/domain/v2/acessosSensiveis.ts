/* ============================================================
   Relatório de acessos a dados sensíveis · catálogo PURO
   Quais eventos de auditoria (aud_eventos: entidade + ação) contam
   como acesso a dado sensível. Usado pelo servidor (filtro SQL) e
   pela tela (rótulos). O relatório mostra quem, quando e o quê —
   nunca o conteúdo acessado.
   ============================================================ */

export interface TipoAcessoSensivel { chave: string; entidade: string; acao: string; rotulo: string }

export const ACESSOS_SENSIVEIS: TipoAcessoSensivel[] = [
  { chave: 'download_curriculo', entidade: 'candidatura', acao: 'curriculo_baixado', rotulo: 'Download de currículo' },
  { chave: 'download_documento_candidato', entidade: 'candidatura', acao: 'documento_baixado', rotulo: 'Download de documento do candidato' },
  { chave: 'ver_notas_rh', entidade: 'candidatura', acao: 'notas_rh_visualizadas', rotulo: 'Leitura de notas restritas ao RH' },
  { chave: 'ver_observacoes_rh', entidade: 'candidatura', acao: 'observacoes_rh_visualizadas', rotulo: 'Leitura de observações do RH (questionários)' },
  { chave: 'exportar_candidaturas', entidade: 'candidatura', acao: 'exportacao', rotulo: 'Exportação de candidaturas (CSV)' },
  { chave: 'download_documento_financeiro', entidade: 'documento', acao: 'baixado', rotulo: 'Download de documento financeiro/cadastral' },
  { chave: 'download_nota_fiscal', entidade: 'nota_fiscal', acao: 'arquivo_baixado', rotulo: 'Download de nota fiscal' },
  { chave: 'ver_feedback_lideranca', entidade: 'dsv_ciclo', acao: 'feedback_equipe_visualizado', rotulo: 'Leitura do feedback da equipe sobre uma liderança' },
  { chave: 'exportar_avaliacoes', entidade: 'dsv_ciclo', acao: 'exportacao', rotulo: 'Exportação de avaliações de desempenho (CSV)' },
]

export const ROTULO_ENTIDADE_SENSIVEL: Record<string, string> = {
  candidatura: 'Candidatura', documento: 'Documento (financeiro)', nota_fiscal: 'Nota fiscal', dsv_ciclo: 'Avaliação de desempenho',
}

export const tipoAcessoPorChave = (chave: string) => ACESSOS_SENSIVEIS.find((t) => t.chave === chave)
export const tipoAcessoDoEvento = (entidade: string, acao: string) => ACESSOS_SENSIVEIS.find((t) => t.entidade === entidade && t.acao === acao)
