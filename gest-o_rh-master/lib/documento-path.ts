/** Monta o caminho do objeto no bucket "colaboradores" do Storage para um
 * documento anexado à ficha do colaborador. Usado tanto no upload
 * (Client Component, antes de chamar supabase.storage.upload) quanto nas
 * Server Actions que registram/excluem o registro. */
export function caminhoDocumento(colaboradorId: string, nomeArquivo: string) {
  const nomeSeguro = nomeArquivo.replace(/[^\w.-]+/g, "_");
  return `${colaboradorId}/documentos/${Date.now()}-${nomeSeguro}`;
}
