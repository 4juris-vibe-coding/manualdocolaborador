import { NextResponse } from "next/server";

function csvEscape(valor: string) {
  if (/[",\n]/.test(valor)) return `"${valor.replace(/"/g, '""')}"`;
  return valor;
}

/** Monta uma resposta CSV pronta pra download (com BOM, pro Excel abrir os
 * acentos certo). Usado pelos Route Handlers de exportação. */
export function toCsvResponse(
  cabecalho: string[],
  linhas: string[][],
  nomeArquivo: string,
) {
  const csv = [cabecalho, ...linhas]
    .map((linha) => linha.map(csvEscape).join(","))
    .join("\n");
  const BOM = "﻿";

  return new NextResponse(BOM + csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
