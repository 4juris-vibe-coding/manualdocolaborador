/* ============================================================
   4JURIS Pessoas · Chaves anônimas (caixa de sugestões)
   Gera identificadores opacos que permitem à PRÓPRIA pessoa editar,
   excluir ou apoiar sem que a interface (ou o RH) saiba quem é.
   - Modo demonstração: o hash usa um sal público (todos os dados
     convivem no navegador; o anonimato é só de interface).
   - Modo com banco: o servidor entrega a cada pessoa um SEGREDO
     PRÓPRIO, derivado por HMAC de uma chave que não fica no banco
     (ANON_SECRET). Sem o segredo de outra pessoa, ninguém (nem o RH)
     consegue recalcular a chave dela; o servidor confere autoria e
     apoios com o mesmo cálculo (api/_v2/guarda.ts).
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

/** Segredo da sessão (modo com banco). Vazio = esquema da demonstração. */
let segredoSessao = ''
export function definirSegredoAnonimo(s: string) { segredoSessao = s }

/** Chave de autoria: identifica a pessoa como autora, sem revelar quem é. `segredo` explícito é usado pelo servidor. */
export const chaveAutor = (pessoaId: string, segredo = segredoSessao) =>
  segredo ? hash(`${segredo}|autor`) : hash(`${SAL}|autor|${pessoaId}`)

/** Chave de apoio: diferente por sugestão, para não ligar apoios entre si nem ao autor. */
export const chaveApoio = (pessoaId: string, sugestaoId: string, segredo = segredoSessao) =>
  segredo ? hash(`${segredo}|apoio|${sugestaoId}`) : hash(`${SAL}|apoio|${sugestaoId}|${pessoaId}`)
