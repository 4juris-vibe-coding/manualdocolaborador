export const INTERVALO_RELATORIO_OPTIONS = [
  { value: "3", label: "3 meses" },
  { value: "6", label: "6 meses" },
  { value: "12", label: "12 meses" },
] as const;

export const PERIODO_AVALIACAO_FILTRO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "30", label: "30 dias" },
  { value: "45", label: "45 dias" },
  { value: "60", label: "60 dias" },
  { value: "90", label: "90 dias" },
] as const;

export const STATUS_AVALIACAO_EXPERIENCIA_FILTRO_OPTIONS = [
  { value: "todos", label: "Todos" },
  { value: "pendente", label: "Pendente" },
  { value: "respondida", label: "Respondida" },
  { value: "expirada", label: "Expirada" },
] as const;

export const STATUS_AVALIACAO_EXPERIENCIA_LABEL: Record<string, string> = {
  pendente: "Pendente",
  respondida: "Respondida",
  expirada: "Expirada",
};
