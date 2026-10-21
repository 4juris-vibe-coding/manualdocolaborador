/** Cálculos usados só na página de Métricas do Colaborador — idade,
 * tempo de casa e período de experiência agrupados em faixas, pra
 * alimentar os gráficos de distribuição. */

/** Paleta categórica validada (ver skill de dataviz) — ordem fixa, nunca
 * ciclada arbitrariamente por gráfico. Usada nas distribuições com 3+
 * categorias; os casos binários (Com/Sem Deficiência etc.) usam a cor da
 * marca (roxo/dourado) direto, igual ao Sólides. */
export const PALETA_CATEGORICA = [
  "#2a78d6", // azul
  "#eb6834", // laranja
  "#1baf7a", // água
  "#eda100", // amarelo
  "#e87ba4", // magenta
  "#008300", // verde
  "#4a3aa7", // violeta
  "#e34948", // vermelho
];

export function comCores<T extends { label: string; value: number }>(dados: T[]) {
  return dados.map((d, i) => ({ ...d, color: PALETA_CATEGORICA[i % PALETA_CATEGORICA.length] }));
}

export function calcularIdade(dataNascimento: string, agora: Date = new Date()) {
  const nascimento = new Date(`${dataNascimento}T00:00:00Z`);
  let idade = agora.getUTCFullYear() - nascimento.getUTCFullYear();
  const aindaNaoFezAniversario =
    agora.getUTCMonth() < nascimento.getUTCMonth() ||
    (agora.getUTCMonth() === nascimento.getUTCMonth() &&
      agora.getUTCDate() < nascimento.getUTCDate());
  if (aindaNaoFezAniversario) idade -= 1;
  return idade;
}

export function calcularAnosDeCasa(dataAdmissao: string, agora: Date = new Date()) {
  const admissao = new Date(`${dataAdmissao}T00:00:00Z`);
  return (agora.getTime() - admissao.getTime()) / (1000 * 60 * 60 * 24 * 365.25);
}

type Faixa = { label: string; teste: (valor: number) => boolean };

export const FAIXAS_IDADE: Faixa[] = [
  { label: "Até 24 anos", teste: (i) => i <= 24 },
  { label: "25 a 34 anos", teste: (i) => i >= 25 && i <= 34 },
  { label: "35 a 44 anos", teste: (i) => i >= 35 && i <= 44 },
  { label: "45 a 54 anos", teste: (i) => i >= 45 && i <= 54 },
  { label: "55 anos ou mais", teste: (i) => i >= 55 },
];

export const FAIXAS_TEMPO_EMPRESA: Faixa[] = [
  { label: "Até 1 ano", teste: (a) => a < 1 },
  { label: "1 a 3 anos", teste: (a) => a >= 1 && a < 3 },
  { label: "3 a 5 anos", teste: (a) => a >= 3 && a < 5 },
  { label: "5 a 10 anos", teste: (a) => a >= 5 && a < 10 },
  { label: "Mais de 10 anos", teste: (a) => a >= 10 },
];

/** Faixas do período de experiência CLT (45+45 dias) — só faz sentido
 * pra colaboradores em regime CLT (ver `temRegimeClt`). */
export const FAIXAS_EXPERIENCIA: Faixa[] = [
  { label: "0 a 45 dias", teste: (d) => d >= 0 && d <= 45 },
  { label: "46 a 90 dias", teste: (d) => d > 45 && d <= 90 },
  { label: "Fora do período de experiência", teste: (d) => d > 90 },
];

/** Conta quantos valores caem em cada faixa, na ordem das faixas. */
export function contarPorFaixa(valores: number[], faixas: Faixa[]) {
  return faixas.map((faixa) => ({
    label: faixa.label,
    value: valores.filter((v) => faixa.teste(v)).length,
  }));
}

/** Conta quantos colaboradores caem em cada opção de uma lista FIXA (ex.:
 * gênero, raça/etnia) — ao contrário de `contarCategorias`, mantém todas
 * as opções na ordem original mesmo com contagem zero (é assim que o
 * Sólides mostra "0% (0) Com Deficiência" mesmo sem nenhum dado). */
export function contarPorOpcoes<T extends string>(
  valores: (T | null | undefined)[],
  opcoes: readonly { value: T; label: string }[],
) {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  return opcoes.map((o) => ({ label: o.label, value: contagem.get(o.value) ?? 0 }));
}

/** Conta ocorrências de cada valor categórico (ignora nulos), ordenado
 * do mais frequente pro menos frequente. Além de N categorias, agrupa o
 * resto em "Outros" — útil pra campos de texto livre como cargo/grau
 * hierárquico, que não têm uma lista fixa de opções. */
export function contarCategorias(
  valores: (string | null | undefined)[],
  rotulo: (valor: string) => string,
  maxCategorias = 8,
) {
  const contagem = new Map<string, number>();
  for (const v of valores) {
    if (!v) continue;
    contagem.set(v, (contagem.get(v) ?? 0) + 1);
  }
  const ordenado = [...contagem.entries()].sort((a, b) => b[1] - a[1]);
  const principais = ordenado.slice(0, maxCategorias);
  const resto = ordenado.slice(maxCategorias).reduce((soma, [, qtd]) => soma + qtd, 0);
  const resultado = principais.map(([valor, qtd]) => ({ label: rotulo(valor), value: qtd }));
  if (resto > 0) resultado.push({ label: "Outros", value: resto });
  return resultado;
}
