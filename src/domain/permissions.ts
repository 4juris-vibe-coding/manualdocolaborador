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
  // Recrutamento (v2) — verificadas também no servidor (api/_v2)
  | 'vagas:solicitar'          // gestor: pede abertura de vaga da própria área
  | 'vagas:ver'                // ver vagas (gestor: só as da própria área/solicitadas por ele)
  | 'vagas:gerenciar'          // criar/editar/publicar/encerrar qualquer vaga
  | 'vagas:ver_remuneracao'    // faixa salarial da vaga e proposta
  | 'vagas:config'             // fluxos de aprovação, etapas padrão, canais
  | 'ats:ver'                  // candidaturas das vagas que pode acompanhar
  | 'ats:gerenciar'            // mover candidatos, comunicar, propostas
  | 'ats:avaliar'              // registrar avaliações das entrevistas em que participa
  | 'ats:notas_rh'             // notas internas restritas ao RH
  | 'ats:exportar'
  // Pesquisas (v2)
  | 'pesq:gerenciar'
  | 'pesq:resultados'
  | 'pesq:exportar'
  // Engenharia de cargos (v2)
  | 'cargos:ver'
  | 'cargos:gerenciar'
  | 'cargos:aprovar'
  | 'cargos:ver_faixas'
  // Organograma e analytics (v2)
  | 'org:ver'
  | 'org:ver_contato'
  | 'org:editar'
  | 'analytics:ver'
  // Gestão de prestadores PJ (v2) — verificadas no servidor (api/_v2/modulos/financeiro.ts)
  | 'fin:ver'                  // painel, contratos, notas, contas e documentos de todos os fornecedores
  | 'fin:cadastrar'            // fornecedores, contratos, aditivos, centros de custo, encerramentos
  | 'fin:conferir'             // conferência documental de notas fiscais e documentos
  | 'fin:aprovar'              // aceite do serviço em qualquer contrato (o gestor do contrato aceita os seus)
  | 'fin:pagar'                // retenções, registro manual de pagamento e conciliação
  | 'fin:autorizar'            // autorização de pagamento
  | 'fin:config'               // configurações financeiras e segregação de funções
  // Administração da plataforma
  | 'admin:usuarios'
  | 'admin:auditoria'
  | 'admin:privacidade'
  | 'admin:dados_demo'

const LIDERANCA: Capacidade[] = [
  'vagas:solicitar', 'vagas:ver', 'ats:ver', 'ats:avaliar', 'org:ver', 'cargos:ver',
  'lideranca:painel', 'lideranca:ver_disponibilidade_equipe', 'eventos:gerenciar_area',
  'iniciativas:gerenciar', 'reembolsos:aprovar_area', 'comunicados:publicar', 'feedbacks:registrar',
]

/** Recrutamento/pesquisas/cargos: o que o RH completo faz. */
const RH_V2: Capacidade[] = [
  'vagas:solicitar', 'vagas:ver', 'vagas:gerenciar', 'vagas:ver_remuneracao', 'vagas:config',
  'ats:ver', 'ats:gerenciar', 'ats:avaliar', 'ats:notas_rh', 'ats:exportar',
  'pesq:gerenciar', 'pesq:resultados', 'pesq:exportar',
  'cargos:ver', 'cargos:gerenciar', 'cargos:aprovar', 'cargos:ver_faixas',
  'org:ver', 'org:ver_contato', 'org:editar', 'analytics:ver',
]

/** Financeiro PJ do RH: cadastra, confere, aceita e registra pagamentos. Autorizar pagamento é de outra função (segregação). */
const RH_FIN: Capacidade[] = ['fin:ver', 'fin:cadastrar', 'fin:conferir', 'fin:aprovar', 'fin:pagar']

const RH: Capacidade[] = [
  ...LIDERANCA,
  ...RH_V2,
  ...RH_FIN,
  'rh:painel', 'pessoas:gerenciar', 'pessoas:ver_contratos', 'documentos:gerenciar',
  'estrutura:gerenciar', 'onboarding:gerenciar', 'eventos:gerenciar', 'gamificacao:configurar',
  'pesquisas:gerenciar', 'disponibilidade:configurar', 'financeiro:gerenciar', 'relatorios:exportar',
  'desenvolvimento:gerenciar', 'beneficios:gerenciar', 'perfis:consultar', 'sugestoes:moderar',
]

/** Matriz papel → capacidades. Ajuste aqui (e só aqui) as permissões. */
export const MATRIZ: Record<Papel, Capacidade[]> = {
  colaborador: ['portal:usar', 'org:ver'],
  gestor: ['portal:usar', ...LIDERANCA],
  rh: ['portal:usar', ...RH],
  // Diretoria: visão executiva (indicadores agregados), sem editar cadastros.
  diretoria: ['portal:usar', 'lideranca:painel', 'lideranca:ver_disponibilidade_equipe', 'rh:painel', 'relatorios:exportar', 'comunicados:publicar', 'eventos:gerenciar',
    'vagas:ver', 'ats:ver', 'pesq:resultados', 'cargos:ver', 'org:ver', 'analytics:ver', 'fin:ver'],
  admin: ['portal:usar', ...RH, 'admin:usuarios', 'admin:auditoria', 'admin:privacidade', 'admin:dados_demo', 'config:geral', 'fin:autorizar', 'fin:config'],
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
  rh: 'Administra pessoas, contratos, documentos, notas fiscais, integração, eventos, pesquisas e gamificação.',
  diretoria: 'Consulta indicadores agregados e publica comunicados; não edita cadastros.',
  admin: 'Tudo do RH, mais usuários e papéis, auditoria, privacidade e dados de demonstração.',
}

/** Funções adicionais (além do papel), concedidas pelo RH. Tabela acl_funcoes. */
export type FuncaoAdicional = 'recrutador' | 'analista_rh' | 'resp_pesquisas' | 'aprovador_financeiro' | 'analista_financeiro' | 'autorizador_pagamentos'

export const FUNCAO_LABEL: Record<FuncaoAdicional, string> = {
  recrutador: 'Recrutador(a)',
  analista_rh: 'Analista de RH',
  resp_pesquisas: 'Responsável por pesquisas',
  aprovador_financeiro: 'Aprovação financeira de vagas',
  analista_financeiro: 'Analista financeiro (notas e pagamentos)',
  autorizador_pagamentos: 'Autorização de pagamentos',
}

const FUNCOES_CAPS: Record<FuncaoAdicional, Capacidade[]> = {
  recrutador: ['vagas:solicitar', 'vagas:ver', 'vagas:gerenciar', 'ats:ver', 'ats:gerenciar', 'ats:avaliar', 'ats:notas_rh', 'ats:exportar', 'org:ver', 'cargos:ver'],
  // Analista de RH solicita vagas para qualquer área (passam pelo fluxo de aprovação); não publica nem gerencia.
  analista_rh: ['vagas:solicitar', 'vagas:ver', 'ats:ver', 'cargos:ver', 'cargos:ver_faixas', 'org:ver', 'org:ver_contato', 'analytics:ver', 'pesq:resultados'],
  resp_pesquisas: ['pesq:gerenciar', 'pesq:resultados', 'pesq:exportar'],
  aprovador_financeiro: ['vagas:ver', 'vagas:ver_remuneracao'],
  analista_financeiro: ['fin:ver', 'fin:conferir', 'fin:pagar'],
  autorizador_pagamentos: ['fin:ver', 'fin:autorizar'],
}

/** Capacidades efetivas: as do papel mais as das funções adicionais. Usada no servidor e no cliente. */
export function capacidadesDe(papel: Papel, funcoes: FuncaoAdicional[] = []): Set<Capacidade> {
  const s = new Set<Capacidade>(MATRIZ[papel] ?? [])
  for (const f of funcoes) for (const c of FUNCOES_CAPS[f] ?? []) s.add(c)
  return s
}

/** Capacidades extras da pessoa em sessão (carregadas de /api/v2/eu). Só afetam a interface; o servidor decide de verdade. */
let extrasDaSessao: Set<Capacidade> = new Set()
export function definirExtrasDaSessao(caps: Capacidade[]) { extrasDaSessao = new Set(caps) }

export function can(papel: Papel, cap: Capacidade): boolean {
  return (MATRIZ[papel]?.includes(cap) ?? false) || extrasDaSessao.has(cap)
}

export function canAny(papel: Papel, caps: Capacidade[]): boolean {
  return caps.some((c) => can(papel, c))
}
