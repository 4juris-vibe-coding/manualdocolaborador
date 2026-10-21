/* ============================================================
   4JURIS Pessoas · Permissões (RBAC por capacidade)
   ------------------------------------------------------------
   Fonte única das regras de acesso usadas pela navegação, pelas
   guardas de rota e pelas ações da interface.

   IMPORTANTE: esconder botões no frontend NÃO é segurança. Quando
   houver backend, cada capacidade abaixo deve ser verificada também
   no servidor (ex.: políticas RLS ou middleware da API) — ver
   docs/ARQUITETURA.md, seção "Autorização".
   ============================================================ */
import type { Papel } from '@/lib/types'

export type Capacidade =
  // Área pessoal (todo participante)
  | 'portal:usar'
  // Liderança — escopo limitado às próprias áreas
  | 'lideranca:painel'
  | 'lideranca:ver_disponibilidade_equipe'
  | 'eventos:gerenciar_area'
  | 'iniciativas:gerenciar'
  | 'reembolsos:aprovar_area'
  // RH
  | 'rh:painel'
  | 'pessoas:gerenciar'
  | 'pessoas:ver_contratos'
  | 'documentos:gerenciar'
  | 'estrutura:gerenciar'
  | 'onboarding:gerenciar'
  | 'eventos:gerenciar'
  | 'comunicados:publicar'
  | 'gamificacao:configurar'
  | 'pesquisas:gerenciar'
  | 'disponibilidade:configurar'
  | 'financeiro:gerenciar'
  | 'relatorios:exportar'
  | 'desenvolvimento:gerenciar'
  | 'beneficios:gerenciar'
  | 'feedbacks:registrar'
  | 'perfis:consultar'
  | 'config:geral'
  | 'sugestoes:moderar'
  // Administração da plataforma
  | 'admin:usuarios'
  | 'admin:auditoria'
  | 'admin:privacidade'
  | 'admin:dados_demo'

const LIDERANCA: Capacidade[] = [
  'lideranca:painel', 'lideranca:ver_disponibilidade_equipe', 'eventos:gerenciar_area',
  'iniciativas:gerenciar', 'reembolsos:aprovar_area', 'comunicados:publicar', 'feedbacks:registrar',
]

const RH: Capacidade[] = [
  ...LIDERANCA,
  'rh:painel', 'pessoas:gerenciar', 'pessoas:ver_contratos', 'documentos:gerenciar',
  'estrutura:gerenciar', 'onboarding:gerenciar', 'eventos:gerenciar', 'gamificacao:configurar',
  'pesquisas:gerenciar', 'disponibilidade:configurar', 'financeiro:gerenciar', 'relatorios:exportar',
  'desenvolvimento:gerenciar', 'beneficios:gerenciar', 'perfis:consultar', 'sugestoes:moderar',
]

/** Matriz papel → capacidades. Ajuste aqui (e só aqui) as permissões. */
export const MATRIZ: Record<Papel, Capacidade[]> = {
  colaborador: ['portal:usar'],
  gestor: ['portal:usar', ...LIDERANCA],
  rh: ['portal:usar', ...RH],
  // Diretoria: visão executiva (indicadores agregados), sem editar cadastros.
  diretoria: ['portal:usar', 'lideranca:painel', 'lideranca:ver_disponibilidade_equipe', 'rh:painel', 'relatorios:exportar', 'comunicados:publicar', 'eventos:gerenciar'],
  admin: ['portal:usar', ...RH, 'admin:usuarios', 'admin:auditoria', 'admin:privacidade', 'admin:dados_demo', 'config:geral'],
}

export const PAPEL_LABEL: Record<Papel, string> = {
  colaborador: 'Colaborador(a)',
  gestor: 'Liderança',
  rh: 'RH & Pessoas',
  diretoria: 'Diretoria',
  admin: 'Administração',
}

export const PAPEL_DESC: Record<Papel, string> = {
  colaborador: 'Acessa a área pessoal: perfil, agenda, comunidade e as próprias solicitações.',
  gestor: 'Coordena áreas sob sua responsabilidade: disponibilidade da equipe, iniciativas e eventos da área.',
  rh: 'Administra pessoas, contratos, documentos, integração, eventos, pesquisas e gamificação.',
  diretoria: 'Consulta indicadores agregados e publica comunicados; não edita cadastros.',
  admin: 'Tudo do RH, mais usuários e papéis, auditoria, privacidade e dados de demonstração.',
}

export function can(papel: Papel, cap: Capacidade): boolean {
  return MATRIZ[papel]?.includes(cap) ?? false
}

export function canAny(papel: Papel, caps: Capacidade[]): boolean {
  return caps.some((c) => can(papel, c))
}
