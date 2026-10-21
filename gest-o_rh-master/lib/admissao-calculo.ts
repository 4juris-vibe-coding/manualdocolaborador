/** Dias corridos desde a data de admissão até `agora`. */
export function calcularDiasDeCasa(
  dataAdmissao: string,
  agora: Date = new Date(),
) {
  const admissao = new Date(`${dataAdmissao}T00:00:00Z`);
  return Math.floor((agora.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24));
}

/** true quando o colaborador ainda está nos primeiros ~90 dias de casa
 * (janela típica de período de experiência CLT, geralmente 45+45 dias). */
export function estaEmPeriodoDeExperiencia(
  dataAdmissao: string,
  agora: Date = new Date(),
) {
  const diasDeCasa = calcularDiasDeCasa(dataAdmissao, agora);
  return diasDeCasa >= 0 && diasDeCasa <= 90
    ? { emExperiencia: true, diasDeCasa, diasRestantes: 90 - diasDeCasa }
    : { emExperiencia: false, diasDeCasa, diasRestantes: 0 };
}
