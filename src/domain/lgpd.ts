/* ============================================================
   4JURIS Pessoas · Direitos do titular (LGPD, art. 18)
   Monta a cópia dos dados pessoais de uma pessoa. Respostas de
   pesquisas NÃO entram (são anônimas e não vinculadas ao titular).
   ============================================================ */
import type { DB } from '@/lib/types'

export function exportarDadosTitular(db: DB, pessoaId: string) {
  const p = db.colaboradores.find((c) => c.id === pessoaId)
  return {
    geradoEm: new Date().toISOString(),
    aviso: 'Cópia dos dados pessoais mantidos na plataforma 4JURIS Pessoas. Respostas de pesquisas são anônimas e não estão vinculadas ao seu cadastro.',
    cadastro: p,
    contratos: db.contratos.filter((k) => k.colaboradorId === pessoaId),
    documentos: db.documentos.filter((d) => d.colaboradorId === pessoaId).map(({ id, nome, tipo, data, validade, tamanho }) => ({ id, nome, tipo, data, validade, tamanho })),
    notasFiscais: db.notas.filter((n) => n.colaboradorId === pessoaId),
    reembolsos: db.reembolsos.filter((r) => r.colaboradorId === pessoaId),
    periodosIndisponibilidade: db.periodos.filter((x) => x.colaboradorId === pessoaId),
    pontos: db.lancamentos.filter((l) => l.colaboradorId === pessoaId),
    conquistas: db.conquistas.filter((c) => c.colaboradorId === pessoaId),
    reconhecimentosEnviados: db.reconhecimentos.filter((r) => r.deId === pessoaId),
    reconhecimentosRecebidos: db.reconhecimentos.filter((r) => r.paraId === pessoaId),
    eventosConfirmados: db.eventos.filter((e) => e.confirmados.includes(pessoaId)).map((e) => ({ id: e.id, titulo: e.titulo, inicio: e.inicio })),
    jornadas: db.processos.filter((x) => x.colaboradorId === pessoaId),
    participacaoEmPesquisas: db.participacoes.filter((x) => x.colaboradorId === pessoaId).map((x) => x.pesquisaId),
    registrosAdministrativos: db.registros.filter((r) => r.colaboradorId === pessoaId),
  }
}
