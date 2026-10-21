import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { gerarAvaliacoesExperiencia } from "@/lib/avaliacao-experiencia/gerar";

/**
 * Chamada pelo Vercel Cron (ver `vercel.json`) — não passa por sessão de
 * usuário, então exige o header `Authorization: Bearer $CRON_SECRET`
 * (variável de ambiente a configurar na Vercel; o próprio Vercel Cron já
 * envia esse header automaticamente quando CRON_SECRET está definida).
 */
export async function GET(request: Request) {
  const auth = request.headers.get("authorization");
  if (!process.env.CRON_SECRET || auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Não autorizado." }, { status: 401 });
  }

  const supabase = createAdminClient();
  const resultado = await gerarAvaliacoesExperiencia(supabase);
  return NextResponse.json(resultado);
}
