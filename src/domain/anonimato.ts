/* ============================================================
   4JURIS Pessoas · Chaves anônimas (caixa de sugestões)
   Gera identificadores opacos que permitem à PRÓPRIA pessoa editar,
   excluir ou apoiar sem que a interface (ou o RH) saiba quem é.
   ATENÇÃO: na demonstração o hash roda no navegador, onde todos os
   dados convivem. Em produção, derive a chave no SERVIDOR com HMAC e
   segredo que não fique no banco (ver docs/ARQUITETURA.md).
   ============================================================ */

const SAL = '4juris-caixa-de-sugestoes-v1'

/** FNV-1a de 32 bits, duas rodadas → 16 hex. Suficiente para a demonstração. */
function hash(texto: string): string {
  let h1 = 0x811c9dc5, h2 = 0x01000193
  for (let i = 0; i < texto.length; i++) {
    h1 = Math.imul(h1 ^ texto.charCodeAt(i), 0x01000193) >>> 0
    h2 = Math.imul(h2 ^ texto.charCodeAt(texto.length - 1 - i), 0x85ebca6b) >>> 0
  }
  return h1.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')
}

/** Chave de autoria: identifica a pessoa como autora, sem revelar quem é. */
export const chaveAutor = (pessoaId: string) => hash(`${SAL}|autor|${pessoaId}`)

/** Chave de apoio: diferente por sugestão, para não ligar apoios entre si nem ao autor. */
export const chaveApoio = (pessoaId: string, sugestaoId: string) => hash(`${SAL}|apoio|${sugestaoId}|${pessoaId}`)
