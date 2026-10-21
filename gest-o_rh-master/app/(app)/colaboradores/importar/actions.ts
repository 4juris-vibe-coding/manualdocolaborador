"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireAdmin } from "@/lib/auth/session";
import { linhaImportacaoSchema } from "@/lib/validations/colaborador-import";

export type ResultadoImportacao = {
  sucesso: number;
  erros: { linha: number; motivo: string }[];
};

/**
 * Importa colaboradores em lote a partir de linhas de CSV já parseadas no
 * navegador (papaparse). Insere um por um (em vez de um único insert em
 * lote) de propósito: assim uma linha com e-mail/CPF duplicado só derruba
 * ela mesma, não a importação inteira. Colaboradores importados não
 * recebem o checklist de admissão automaticamente — isso só acontece no
 * cadastro individual (tela "Novo Colaborador").
 */
export async function importarColaboradores(
  linhas: Record<string, string>[],
): Promise<ResultadoImportacao> {
  const admin = await requireAdmin();
  const supabase = await createClient();

  const [{ data: cargos }, { data: departamentos }] = await Promise.all([
    supabase.from("cargos").select("id, nome"),
    supabase.from("departamentos").select("id, nome, unidade_id"),
  ]);
  const cargoPorNome = new Map(
    (cargos ?? []).map((c) => [c.nome.trim().toLowerCase(), c.id]),
  );
  const departamentoPorNome = new Map(
    (departamentos ?? []).map((d) => [d.nome.trim().toLowerCase(), d]),
  );

  const erros: ResultadoImportacao["erros"] = [];
  let sucesso = 0;

  for (const [index, linha] of linhas.entries()) {
    const numeroLinha = index + 2; // +1 pelo cabeçalho, +1 porque a 1ª linha de dados é a 2ª do arquivo

    const parsed = linhaImportacaoSchema.safeParse(linha);
    if (!parsed.success) {
      erros.push({
        linha: numeroLinha,
        motivo: parsed.error.issues[0]?.message ?? "Dados inválidos.",
      });
      continue;
    }

    const cargoId = cargoPorNome.get(parsed.data.Cargo.trim().toLowerCase());
    if (!cargoId) {
      erros.push({
        linha: numeroLinha,
        motivo: `Cargo "${parsed.data.Cargo}" não encontrado.`,
      });
      continue;
    }

    const departamento = departamentoPorNome.get(
      parsed.data.Departamento.trim().toLowerCase(),
    );
    if (!departamento) {
      erros.push({
        linha: numeroLinha,
        motivo: `Departamento "${parsed.data.Departamento}" não encontrado.`,
      });
      continue;
    }

    const { error } = await supabase.from("colaboradores").insert({
      nome_completo: parsed.data["Nome completo"],
      email: parsed.data["E-mail"],
      cpf: parsed.data.CPF,
      telefone: parsed.data.Telefone || undefined,
      cargo_id: cargoId,
      departamento_id: departamento.id,
      unidade_id: departamento.unidade_id,
      data_admissao: parsed.data["Data de admissão"],
      tipo_contrato: parsed.data["Tipo de contrato"],
      cnpj: parsed.data.CNPJ || undefined,
      criado_por: admin.id,
    });

    if (error) {
      erros.push({
        linha: numeroLinha,
        motivo:
          error.code === "23505"
            ? "Já existe um colaborador com este e-mail ou CPF."
            : "Erro ao salvar esta linha.",
      });
      continue;
    }

    sucesso += 1;
  }

  if (sucesso > 0) revalidatePath("/colaboradores");
  return { sucesso, erros };
}
