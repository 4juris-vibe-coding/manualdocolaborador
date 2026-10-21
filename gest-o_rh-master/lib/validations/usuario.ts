import { z } from "zod";

export const novoUsuarioSchema = z.object({
  nome_completo: z.string().trim().min(2, "Informe o nome completo."),
  email: z.email("Informe um e-mail válido."),
  senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
  papel: z.enum(["admin_rh", "gestor"]),
});

export const editarUsuarioSchema = z.object({
  nome_completo: z.string().trim().min(2, "Informe o nome completo."),
  papel: z.enum(["admin_rh", "gestor"]),
  ativo: z.boolean(),
});

export const redefinirSenhaSchema = z.object({
  senha: z.string().min(8, "A senha deve ter pelo menos 8 caracteres."),
});

export const PAPEL_OPTIONS = [
  { value: "admin_rh" as const, label: "Administrador de RH" },
  { value: "gestor" as const, label: "Gestor" },
];
