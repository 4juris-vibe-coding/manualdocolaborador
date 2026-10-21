/* ============================================================
   API v2 · envio de e-mail (Resend). Compartilhado por recrutamento
   e pesquisas. NUNCA devolve "enviada" sem a confirmação do provedor:
   - sem RESEND_API_KEY → 'nao_configurado' (nada foi enviado)
   - provedor recusou / rede falhou → 'falhou' (com o motivo)
   ============================================================ */
export type StatusEnvio = 'enviada' | 'falhou' | 'nao_configurado'
export interface ResultadoEnvio { status: StatusEnvio; erro?: string }

export const emailConfigurado = () => !!process.env.RESEND_API_KEY

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)

/** Converte texto simples (com quebras de linha) em HTML seguro. */
export const textoParaHtml = (t: string) => `<div style="font-family:Arial,sans-serif;font-size:14px;line-height:1.6;color:#122029">${esc(t).replace(/\n/g, '<br>')}</div>`

export async function enviarEmail(para: string, assunto: string, corpoTexto: string, opts: { fetchImpl?: typeof fetch } = {}): Promise<ResultadoEnvio> {
  const chave = process.env.RESEND_API_KEY
  if (!chave) return { status: 'nao_configurado', erro: 'RESEND_API_KEY não configurada no servidor.' }
  try {
    const r = await (opts.fetchImpl ?? fetch)('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${chave}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: process.env.RESEND_FROM || '4JURIS <nao-responda@somos4juris.com.br>',
        to: [para],
        subject: assunto,
        html: textoParaHtml(corpoTexto),
        text: corpoTexto,
      }),
    })
    if (!r.ok) return { status: 'falhou', erro: `Provedor de e-mail respondeu ${r.status}.` }
    return { status: 'enviada' }
  } catch (e) {
    return { status: 'falhou', erro: e instanceof Error ? e.message.slice(0, 200) : 'Falha de rede ao enviar.' }
  }
}

/** Substitui {{variavel}} nos modelos; variáveis ausentes viram vazio. Valores não são interpretados como HTML. */
export function preencherModelo(modelo: string, vars: Record<string, string | number | null | undefined>): string {
  return modelo.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, k: string) => String(vars[k] ?? ''))
}
