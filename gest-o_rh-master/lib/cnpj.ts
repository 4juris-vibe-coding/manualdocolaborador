/** Valida CNPJ pelo algoritmo oficial dos dígitos verificadores (módulo 11).
 * Recebe apenas dígitos (sem pontuação). Cobre só o formato numérico
 * tradicional de 14 dígitos — o novo CNPJ alfanumérico da Receita Federal
 * ainda não é validado aqui. */
export function isValidCNPJ(cnpjDigits: string): boolean {
  if (!/^\d{14}$/.test(cnpjDigits)) return false;
  // Rejeita sequências repetidas (00.000.000/0000-00 etc.), que passariam
  // no cálculo do dígito verificador mas não são CNPJs reais.
  if (/^(\d)\1{13}$/.test(cnpjDigits)) return false;

  const digitos = cnpjDigits.split("").map(Number);

  function calcularDigito(ateIndice: number): number {
    const pesos =
      ateIndice === 12
        ? [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2]
        : [6, 5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    let soma = 0;
    for (let i = 0; i < ateIndice; i++) {
      soma += digitos[i] * pesos[i];
    }
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  }

  return (
    calcularDigito(12) === digitos[12] && calcularDigito(13) === digitos[13]
  );
}
