/* ============================================================
   4JURIS Pessoas · Perfil comportamental e busca de perfil
   Portado de gest-o_rh-master (lib/cargo-tracos.ts, lib/perfil-disc.ts
   e cargos/busca-perfil). Diferenças:
   - o perfil da pessoa é opcional e só entra nas buscas com
     consentimento registrado;
   - os resultados são apoio à conversa, nunca decisão automática.
   ============================================================ */
import type { Colaborador, PerfilDisc } from '@/lib/types'

export const TRACOS = [
  { chave: 'realista_otimista', esquerda: 'Realista', direita: 'Otimista' },
  { chave: 'analise_comunicacao', esquerda: 'Habilidade em análise', direita: 'Habilidade em comunicação' },
  { chave: 'introspectiva_social', esquerda: 'Habilidade introspectiva', direita: 'Habilidade social' },
  { chave: 'sensivel_motivador', esquerda: 'Sensível', direita: 'Motivador' },
  { chave: 'reservado_comunicador', esquerda: 'Reservado', direita: 'Comunicador e divulgador' },
  { chave: 'detalhista_generalista', esquerda: 'Atento a detalhes', direita: 'Generalista' },
  { chave: 'exatidao_entusiasmo', esquerda: 'Busca exatidão', direita: 'Entusiasta' },
  { chave: 'decisao_segura_rapida', esquerda: 'Decisões mais seguras', direita: 'Decisões mais rápidas' },
  { chave: 'condescendente_dominante', esquerda: 'Condescendente', direita: 'Dominante' },
  { chave: 'estruturado_multitarefa', esquerda: 'Trabalho estruturado', direita: 'Várias coisas ao mesmo tempo' },
  { chave: 'conhecido_novo', esquerda: 'Prefere o conhecido', direita: 'Gosta de novos empreendimentos' },
  { chave: 'regularidade_praticidade', esquerda: 'Preocupa-se com a regularidade', direita: 'Preocupa-se com a praticidade' },
  { chave: 'consultivo_agressivo', esquerda: 'Estilo consultivo', direita: 'Estilo assertivo' },
  { chave: 'calmo_agitado', esquerda: 'Calmo', direita: 'Agitado' },
  { chave: 'rotina_nao_rotina', esquerda: 'Gosta de rotina', direita: 'Não gosta de rotina' },
  { chave: 'cauteloso_destemido', esquerda: 'Cauteloso', direita: 'Destemido' },
  { chave: 'ambiente_calmo_agitado', esquerda: 'Ambientes calmos', direita: 'Ambientes agitados' },
  { chave: 'concentrado_dinamico', esquerda: 'Concentrado', direita: 'Dinâmico' },
  { chave: 'orientado_proatividade', esquerda: 'Prefere ser orientado', direita: 'Gosta de tomar a frente' },
  { chave: 'evita_assume_riscos', esquerda: 'Evita riscos', direita: 'Assume riscos' },
  { chave: 'introvertido_extrovertido', esquerda: 'Introvertido', direita: 'Extrovertido' },
  { chave: 'formal_informal', esquerda: 'Mais formal', direita: 'Mais informal' },
  { chave: 'critico_amigavel', esquerda: 'Mais crítico', direita: 'Amigável' },
  { chave: 'trabalho_relacionamento', esquerda: 'Desenvolve-se via trabalho', direita: 'Desenvolve-se via relacionamentos' },
] as const

export type ChaveTraco = (typeof TRACOS)[number]['chave']
export const VALOR_TRACO_PADRAO = 50

export const CATEGORIAS_DISC = [
  { chave: 'executor', label: 'Executor', cor: '#DC2626' },
  { chave: 'comunicador', label: 'Comunicador', cor: '#F59E0B' },
  { chave: 'planejador', label: 'Planejador', cor: '#16A34A' },
  { chave: 'analista', label: 'Analista', cor: '#2563EB' },
] as const
export type CategoriaDisc = (typeof CATEGORIAS_DISC)[number]['chave']

export const DISC_NEUTRO: PerfilDisc = { executor: 50, comunicador: 50, planejador: 50, analista: 50 }

export function discDominante(d?: PerfilDisc): (typeof CATEGORIAS_DISC)[number] | null {
  if (!d) return null
  return [...CATEGORIAS_DISC].sort((a, b) => d[b.chave] - d[a.chave])[0]
}

export function tracosPadrao(): Record<string, number> {
  return Object.fromEntries(TRACOS.map((t) => [t.chave, VALOR_TRACO_PADRAO]))
}

/** Pessoas que podem aparecer em buscas de perfil (consentimento + parceria vigente). */
export function comPerfilConsentido(pessoas: Colaborador[]): Colaborador[] {
  return pessoas.filter((c) => c.status !== 'encerrado' && c.perfil?.consentimento)
}

const clamp = (n: number) => Math.max(0, Math.min(100, Math.round(n)))

/** Modo "Personalizar": 100 − média das diferenças absolutas entre o alvo e o perfil. */
export function aderenciaDisc(alvo: Partial<PerfilDisc>, d: PerfilDisc): number {
  const chaves = (Object.keys(alvo) as (keyof PerfilDisc)[]).filter((k) => alvo[k] != null)
  if (!chaves.length) return 0
  return clamp(100 - chaves.reduce((s, k) => s + Math.abs((alvo[k] as number) - d[k]), 0) / chaves.length)
}

/** Modo "Por indicador": 100 dentro da faixa; cai na proporção da distância fora dela. */
export function aderenciaIndicador(valor: number, min: number, max: number): number {
  if (valor >= min && valor <= max) return 100
  return clamp(100 - (valor < min ? min - valor : valor - max))
}

/** Média DISC da empresa (entre perfis consentidos). */
export function mediaDisc(pessoas: Colaborador[]): PerfilDisc {
  const ps = comPerfilConsentido(pessoas).map((c) => c.perfil!.disc)
  if (!ps.length) return { ...DISC_NEUTRO }
  const m = (k: keyof PerfilDisc) => Math.round(ps.reduce((s, d) => s + d[k], 0) / ps.length)
  return { executor: m('executor'), comunicador: m('comunicador'), planejador: m('planejador'), analista: m('analista') }
}

/** Compatibilidade com o perfil ideal de uma função (DISC com peso 60%, traços 40%). */
export function compatibilidadeFuncao(
  ideal: { disc: PerfilDisc; tracos: Record<string, number> },
  perfil: { disc: PerfilDisc; tracos: Record<string, number> },
): number {
  const disc = aderenciaDisc(ideal.disc, perfil.disc)
  const chaves = TRACOS.map((t) => t.chave)
  const tr = 100 - chaves.reduce((s, k) => s + Math.abs((ideal.tracos[k] ?? 50) - (perfil.tracos[k] ?? 50)), 0) / chaves.length
  return clamp(disc * 0.6 + tr * 0.4)
}

export interface ResultadoBusca { pessoa: Colaborador; aderencia: number }

export function ranquear(pessoas: Colaborador[], pontuar: (c: Colaborador) => number): ResultadoBusca[] {
  return comPerfilConsentido(pessoas).map((p) => ({ pessoa: p, aderencia: pontuar(p) })).sort((a, b) => b.aderencia - a.aderencia)
}
