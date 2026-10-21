import { NextResponse } from "next/server";
import { Document, Page, Text, View, StyleSheet, renderToBuffer } from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: { padding: 24, fontSize: 9, fontFamily: "Helvetica" },
  title: { fontSize: 14, marginBottom: 12, fontFamily: "Helvetica-Bold", color: "#7A2182" },
  table: { display: "flex", flexDirection: "column", width: "100%" },
  headerRow: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#7A2182",
    paddingVertical: 4,
  },
  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e5e5",
    paddingVertical: 4,
  },
  cell: { flex: 1, paddingHorizontal: 4 },
  headerCell: { flex: 1, paddingHorizontal: 4, fontFamily: "Helvetica-Bold", color: "#7A2182" },
});

function TabelaPdf({
  titulo,
  cabecalho,
  linhas,
}: {
  titulo: string;
  cabecalho: string[];
  linhas: string[][];
}) {
  return (
    <Document>
      <Page size="A4" orientation="landscape" style={styles.page}>
        <Text style={styles.title}>{titulo}</Text>
        <View style={styles.table}>
          <View style={styles.headerRow}>
            {cabecalho.map((coluna, i) => (
              <Text key={i} style={styles.headerCell}>
                {coluna}
              </Text>
            ))}
          </View>
          {linhas.map((linha, i) => (
            <View key={i} style={styles.row}>
              {linha.map((valor, j) => (
                <Text key={j} style={styles.cell}>
                  {valor}
                </Text>
              ))}
            </View>
          ))}
        </View>
      </Page>
    </Document>
  );
}

/** Monta um PDF simples (título + tabela) pronto pra download — usado
 * pelos Route Handlers de exportação quando `?formato=pdf`. */
export async function toPdfResponse(
  titulo: string,
  cabecalho: string[],
  linhas: string[][],
  nomeArquivo: string,
) {
  const buffer = await renderToBuffer(
    <TabelaPdf titulo={titulo} cabecalho={cabecalho} linhas={linhas} />,
  );
  return new NextResponse(new Uint8Array(buffer), {
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${nomeArquivo}"`,
    },
  });
}
