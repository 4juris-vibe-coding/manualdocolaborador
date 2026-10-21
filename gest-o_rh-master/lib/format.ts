const currencyFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

const dateFormatter = new Intl.DateTimeFormat("pt-BR", { timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("pt-BR", {
  dateStyle: "short",
  timeStyle: "short",
});

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return currencyFormatter.format(value);
}

/** Formata uma data `YYYY-MM-DD` (coluna `date` do Postgres) sem sofrer o
 * deslocamento de fuso horário do `new Date("YYYY-MM-DD")` no navegador. */
export function formatDate(value: string | null | undefined) {
  if (!value) return "—";
  return dateFormatter.format(new Date(`${value}T00:00:00Z`));
}

/** Formata um timestamp (`timestamptz`, ex.: `criado_em`) com data e hora,
 * já no fuso do navegador — diferente de `formatDate`, que é só pra
 * colunas `date` puras. */
export function formatDateTime(value: string | null | undefined) {
  if (!value) return "—";
  return dateTimeFormatter.format(new Date(value));
}

export function formatCPF(value: string | null | undefined) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 11) return value;
  return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
}

export function formatCNPJ(value: string | null | undefined) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length !== 14) return value;
  return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
}

export function formatPhone(value: string | null | undefined) {
  if (!value) return "—";
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11) {
    return digits.replace(/(\d{2})(\d{5})(\d{4})/, "($1) $2-$3");
  }
  if (digits.length === 10) {
    return digits.replace(/(\d{2})(\d{4})(\d{4})/, "($1) $2-$3");
  }
  return value;
}

export const SENIORIDADE_LABEL: Record<string, string> = {
  estagiario: "Estagiário",
  junior: "Júnior",
  pleno: "Pleno",
  senior: "Sênior",
  especialista: "Especialista",
  lideranca: "Liderança",
};
