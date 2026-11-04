/* ============================================================
   Portal de carreiras · conteúdo institucional editável pelo RH
   (rec_config chave 'portal'). Puro: usado pelo servidor (validação)
   e pelo cliente (editor e página pública). Só imports relativos.
   ============================================================ */

export interface EtapaProcessoPortal { titulo: string; descricao?: string }
export interface RedeSocial { rede: 'instagram' | 'linkedin' | 'site' | 'youtube' | 'facebook' | 'tiktok' | 'outro'; url: string; rotulo?: string }

export interface PortalConfig {
  titulo: string
  apresentacao: string
  quemSomos?: string
  missao?: string
  visao?: string
  valores?: { nome: string; descricao?: string }[]
  cultura?: string
  comoTrabalhar?: string
  /** Etapas gerais do processo seletivo (cada vaga ainda mostra as suas). */
  processoSeletivo?: EtapaProcessoPortal[]
  diferenciais?: string[]
  redes?: RedeSocial[]
  contatoEmail?: string
}

export const PORTAL_PADRAO: PortalConfig = {
  titulo: 'Trabalhe na 4JURIS',
  apresentacao: 'Conheça as oportunidades abertas e envie a sua candidatura. Analisamos cada perfil com atenção e informamos você sobre os próximos passos.',
  processoSeletivo: [
    { titulo: 'Inscrição', descricao: 'Você envia seus dados e currículo pela página da vaga e recebe um código para acompanhar.' },
    { titulo: 'Análise', descricao: 'Nossa equipe avalia cada candidatura com atenção.' },
    { titulo: 'Conversas e avaliações', descricao: 'Entrevistas e etapas definidas para cada vaga.' },
    { titulo: 'Resultado', descricao: 'Você é informado(a) sobre o resultado em todas as situações.' },
  ],
}

export const REDES: RedeSocial['rede'][] = ['instagram', 'linkedin', 'site', 'youtube', 'facebook', 'tiktok', 'outro']
export const ROTULO_REDE: Record<RedeSocial['rede'], string> = { instagram: 'Instagram', linkedin: 'LinkedIn', site: 'Site', youtube: 'YouTube', facebook: 'Facebook', tiktok: 'TikTok', outro: 'Outro canal' }

const str = (v: unknown, max: number): string | undefined => {
  if (v == null) return undefined
  if (typeof v !== 'string') throw new Error('Texto inválido.')
  const t = v.trim()
  if (t.length > max) throw new Error(`Texto acima de ${max} caracteres.`)
  return t || undefined
}
const urlSegura = (v: unknown): string => {
  const t = str(v, 300)
  if (!t || !/^https:\/\/[^\s<>"']+$/i.test(t)) throw new Error('Use links completos começando com https://.')
  return t
}

/** Valida e normaliza o conteúdo enviado pelo RH. Lança Error com mensagem em pt-BR. */
export function validarPortal(e: unknown): PortalConfig {
  if (!e || typeof e !== 'object') throw new Error('Conteúdo inválido.')
  const o = e as Record<string, unknown>
  const lista = <T,>(v: unknown, max: number, f: (x: Record<string, unknown>) => T): T[] | undefined => {
    if (v == null) return undefined
    if (!Array.isArray(v)) throw new Error('Lista inválida.')
    if (v.length > max) throw new Error(`No máximo ${max} itens por lista.`)
    return v.map((x) => f((x ?? {}) as Record<string, unknown>))
  }
  const titulo = str(o.titulo, 120)
  const apresentacao = str(o.apresentacao, 600)
  if (!titulo) throw new Error('Informe o título do portal.')
  if (!apresentacao) throw new Error('Informe a apresentação.')
  const email = str(o.contatoEmail, 160)
  if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) throw new Error('E-mail de contato inválido.')
  return {
    titulo, apresentacao,
    quemSomos: str(o.quemSomos, 2000), missao: str(o.missao, 600), visao: str(o.visao, 600),
    valores: lista(o.valores, 12, (x) => { const nome = str(x.nome, 80); if (!nome) throw new Error('Valor sem nome.'); return { nome, descricao: str(x.descricao, 300) } }),
    cultura: str(o.cultura, 2000), comoTrabalhar: str(o.comoTrabalhar, 2000),
    processoSeletivo: lista(o.processoSeletivo, 10, (x) => { const t = str(x.titulo, 80); if (!t) throw new Error('Etapa sem título.'); return { titulo: t, descricao: str(x.descricao, 300) } }),
    diferenciais: o.diferenciais == null ? undefined : (() => {
      if (!Array.isArray(o.diferenciais) || o.diferenciais.length > 12) throw new Error('No máximo 12 diferenciais.')
      return o.diferenciais.map((x) => str(x, 120)).filter((x): x is string => !!x)
    })(),
    redes: lista(o.redes, 10, (x) => {
      const rede = x.rede as RedeSocial['rede']
      if (!REDES.includes(rede)) throw new Error('Rede social inválida.')
      return { rede, url: urlSegura(x.url), rotulo: str(x.rotulo, 40) }
    }),
    contatoEmail: email,
  }
}

/** Conteúdo efetivo do portal (padrão + o que o RH configurou). */
export const portalEfetivo = (cfg: Partial<PortalConfig> | null | undefined): PortalConfig => ({ ...PORTAL_PADRAO, ...(cfg ?? {}) })
