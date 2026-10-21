/* ============================================================
   Guarda de escrita do /api/estado (sincronização legada).
   O cliente envia coleções INTEIRAS; sem esta verificação, qualquer
   pessoa autenticada poderia reescrever papéis, áreas e contratos —
   e com isso obter permissões nos módulos v2 (o papel vem de
   app_colaboradores). Aqui o servidor recusa o que a pessoa não
   poderia fazer pela interface. Função pura, testável.
   ============================================================ */

type Obj = Record<string, any>

/** Coleções que só RH/admin escrevem (estrutura da organização e contratos). */
export const COLECOES_SO_RH = ['setores', 'cargos', 'unidades', 'contratos', 'competencias', 'gruposCompetencia', 'motivosEncerramento', 'tiposRegistro'] as const

/** Campos do cadastro de pessoa que só RH/admin alteram. */
const CAMPOS_ESTRUTURAIS = ['setorId', 'cargoId', 'unidadeId', 'responsavelId', 'papel'] as const

const igual = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b)

export interface QuemEscreve { colaboradorId: string; papel: string }

/** Devolve a mensagem de recusa, ou null se a escrita é permitida. */
export function validarEscritaLegada(
  mudancas: Record<string, unknown>,
  atuais: { colaboradores: Obj[]; [colecao: string]: unknown },
  quem: QuemEscreve,
): string | null {
  const privilegiado = quem.papel === 'rh' || quem.papel === 'admin'
  const admin = quem.papel === 'admin'

  for (const nome of Object.keys(mudancas)) {
    const novo = mudancas[nome]

    if (nome === 'auditoria' && !privilegiado) {
      // Só se aceita acrescentar (trilha); nunca apagar nem reescrever registros existentes.
      const antes = (atuais.auditoria as Obj[] | undefined) ?? []
      if (!Array.isArray(novo) || novo.length < antes.length || antes.some((r, i) => !igual(r, novo[i]))) return 'A trilha de auditoria não pode ser alterada.'
    }

    if ((COLECOES_SO_RH as readonly string[]).includes(nome) && !privilegiado) {
      if (!igual(novo, atuais[nome])) return 'Apenas RH ou administração alteram esta informação.'
    }

    if (nome === 'config' && !privilegiado) {
      if (!igual(novo, atuais.config)) return 'Apenas RH ou administração alteram as configurações.'
    }

    if (nome === 'colaboradores') {
      if (!Array.isArray(novo)) return 'Cadastro de pessoas inválido.'
      const antes = new Map(atuais.colaboradores.map((c) => [c.id, c]))
      const depois = new Map((novo as Obj[]).map((c) => [c.id, c]))

      for (const id of antes.keys()) {
        if (!depois.has(id) && !privilegiado) return 'Apenas RH ou administração removem pessoas.'
      }
      for (const [id, c] of depois) {
        const a = antes.get(id)
        if (!a) {
          // Cadastro novo: RH cria colaborador/gestor; papéis elevados só a administração.
          if (!privilegiado) return 'Apenas RH ou administração cadastram pessoas.'
          if (!admin && !['colaborador', 'gestor'].includes(c.papel)) return 'Apenas a administração concede este papel.'
          continue
        }
        if (igual(a, c)) continue
        if (!privilegiado && id !== quem.colaboradorId) {
          // Única exceção: concluir a integração de alguém muda o status integração → ativo.
          const { status: _s1, ...restoA } = a
          const { status: _s2, ...restoC } = c
          const soConcluiuIntegracao = igual(restoA, restoC) && a.status === 'integracao' && c.status === 'ativo'
          if (!soConcluiuIntegracao) return 'Você só pode alterar o próprio cadastro.'
          continue
        }
        if (a.papel !== c.papel && !admin) return 'Apenas a administração altera papéis.'
        if (!privilegiado) {
          for (const campo of CAMPOS_ESTRUTURAIS) {
            if (!igual(a[campo], c[campo])) return 'Apenas RH ou administração alteram a estrutura (área, função, gestor).'
          }
        }
      }
    }
  }
  return null
}
