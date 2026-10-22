/* ============================================================
   API v2 · envio de e-mail (Resend). Compartilhado por recrutamento
   e pesquisas. NUNCA devolve "enviada" sem a confirmação do provedor:
   - sem RESEND_API_KEY → 'nao_configurado' (nada foi enviado)
   - provedor recusou / rede falhou → 'falhou' (com o motivo)
   ============================================================ */
import { emailDeTexto } from '../_emailsPortal.js'

export type StatusEnvio = 'enviada' | 'falhou' | 'nao_configurado'
export interface ResultadoEnvio { status: StatusEnvio; erro?: string }

export const emailConfigurado = () => !!process.env.RESEND_API_KEY

/** Converte texto simples em e-mail HTML no layout da marca 4JURIS (o texto continua indo como alternativa). */
export const textoParaHtml = (t: string, assunto = '4JURIS') =>
  emailDeTexto({ assunto, texto: t, portal: (process.env.PORTAL_URL || 'https://portaldocolaborador.somos4juris.com.br').replace(/\/$/, '') })

export async function enviarEmail(para: string, assunto: string, corpoTexto: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) return { status: 'nao_configurado', erro: 'RESEND_API_KEY não configurada no servidor.' }
  try {
    const r = await (opts.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || '4JURIS <nao-responda@4jurismarketing.com.br>',
        to: [para],
        subject: assunto,
        html: textoParaHtml(corpoTexto, assunto),
        text: corpoTexto,
      }),
    })
    if (!r.ok) {
      const detalhe = (await r.text().catch(() => '')).slice(0, 300)
      return { status: 'falhou', erro: `Provedor de e-mail respondeu ${r.status}${detalhe ? `: ${detalhe}` : '.'}` }
    }
    return { status: 'enviada' }
  } catch (e) {
    return { status: 'falhou', erro: e instanceof Error ? e.message.slice(0, 200) : 'Falha de rede ao enviar.' }
  }
}

/** Substitui {{variavel}} nos modelos; variáveis ausentes viram vazio. Valores não são interpretados como HTML. */
export function preencherModelo(modelo: string, vars: Record<string, string | number | null | undefined>): string {
  return modelo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}
