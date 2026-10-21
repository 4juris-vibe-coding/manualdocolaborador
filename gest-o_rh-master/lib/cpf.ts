/** Valida CPF pelo algoritmo oficial dos dígitos verificadores (módulo 11).
 * Recebe apenas dígitos (sem pontuação). */
export function isValidCPF(cpfDigits: string): boolean {
  if (!/^\d{11}$/.test(cpfDigits)) return false;
  // Rejeita sequências repetidas (000.000.000-00, 111.111.111-11, etc.),
  // que passariam no cálculo do dígito verificador mas não são CPFs reais.
  if (/^(\d)\1{10}$/.test(cpfDigits)) return false;

  const digitos = cpfDigits.split("").map(Number);

  function calcularDigito(ateIndice: number): number {
    let soma = 0;
    let peso = ateIndice + 1;
    for (let i = 0; i < ateIndice; i++) {
      soma += digitos[i] * peso;
      peso--;
    }
    const resto = (soma * 10) % 11;
    return resto === 10 ? 0 : resto;
  }

  return (
    calcularDigito(9) === digitos[9] && calcularDigito(10) === digitos[10]
  );
}
