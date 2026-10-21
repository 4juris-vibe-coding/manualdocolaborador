export type ColaboradorParaRotatividade = {
  data_admissao: string;
  data_desligamento: string | null;
  departamento_id: string;
  motivo_desligamento_id: string | null;
};

function ativosEm(colaboradores: ColaboradorParaRotatividade[], data: Date) {
  return colaboradores.filter((c) => {
    const admissao = new Date(`${c.data_admissao}T00:00:00Z`);
    if (admissao > data) return false;
    if (!c.data_desligamento) return true;
    return new Date(`${c.data_desligamento}T00:00:00Z`) > data;
  }).length;
}

/**
 * Rotatividade = desligamentos no período / colaboradores ativos médio no
 * período × 100 — fórmula clássica de turnover de RH. "Ativos médio" usa a
 * média entre o headcount no início e no fim da janela (aproximação comum
 * quando não se tem uma foto diária do quadro).
 */
export function calcularRotatividade(
  colaboradores: ColaboradorParaRotatividade[],
  diasJanela: number,
  agora: Date = new Date(),
) {
  const inicio = new Date(agora);
  inicio.setUTCDate(inicio.getUTCDate() - diasJanela);

  const admissoes = colaboradores.filter((c) => {
    const admissao = new Date(`${c.data_admissao}T00:00:00Z`);
    return admissao >= inicio && admissao <= agora;
  }).length;

  const desligados = colaboradores.filter((c) => {
    if (!c.data_desligamento) return false;
    const desligamento = new Date(`${c.data_desligamento}T00:00:00Z`);
    return desligamento >= inicio && desligamento <= agora;
  });

  const ativosInicio = ativosEm(colaboradores, inicio);
  const ativosFim = ativosEm(colaboradores, agora);
  const headcountMedio = (ativosInicio + ativosFim) / 2;
  const taxa = headcountMedio > 0 ? (desligados.length / headcountMedio) * 100 : 0;

  return {
    admissoes,
    desligamentos: desligados.length,
    desligados,
    ativosInicio,
    ativosFim,
    headcountMedio,
    taxa,
  };
}

const MESES_ABREV = [
  "jan", "fev", "mar", "abr", "mai", "jun",
  "jul", "ago", "set", "out", "nov", "dez",
];

/** Contagem de desligamentos por mês, últimos `quantidadeMeses` meses
 * (incluindo o mês atual), pra alimentar o gráfico de rotatividade. */
export function desligamentosPorMes(
  colaboradores: ColaboradorParaRotatividade[],
  quantidadeMeses = 12,
  agora: Date = new Date(),
) {
  const meses: { ano: number; mes: number; label: string }[] = [];
  for (let i = quantidadeMeses - 1; i >= 0; i--) {
    const data = new Date(Date.UTC(agora.getUTCFullYear(), agora.getUTCMonth() - i, 1));
    meses.push({
      ano: data.getUTCFullYear(),
      mes: data.getUTCMonth(),
      label: MESES_ABREV[data.getUTCMonth()],
    });
  }

  const contagem = new Map<string, number>();
  for (const c of colaboradores) {
    if (!c.data_desligamento) continue;
    const d = new Date(`${c.data_desligamento}T00:00:00Z`);
    const chave = `${d.getUTCFullYear()}-${d.getUTCMonth()}`;
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  return meses.map((m) => ({
    label: m.label,
    value: contagem.get(`${m.ano}-${m.mes}`) ?? 0,
  }));
}
