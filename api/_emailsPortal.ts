/* ============================================================
   E-mails do portal (acesso, redefinição de senha, acesso liberado)
   no layout da marca 4JURIS. HTML em tabelas com estilos inline,
   que é o que Gmail, Outlook e celulares exibem do mesmo jeito.
   ============================================================ */

const AZUL = '#0032D2'
const TINTA = '#122029'
const SUAVE = '#5b6672'
const LINHA = '#e6e9ef'
const FUNDO = '#f3f5f9'
const FONTE = `'Segoe UI', Roboto, Helvetica, Arial, sans-serif`

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]!)
const primeiroNome = (nome: string) => nome.trim().split(/\s+/)[0] ?? ''

export interface Email { assunto: string; html: string; texto: string }

interface Conteudo {
  /** Texto curto que aparece ao lado do assunto na caixa de entrada. */
  previa: string
  titulo: string
  /** Parágrafos em HTML já escapado. */
  paragrafos: string[]
  destaque?: { rotulo: string; valor: string }
  botao: { texto: string; link: string }
  /** Observações em letra menor, abaixo do botão. */
  notas: string[]
  portal: string
}

/** Moldura comum: faixa azul com a marca, cartão branco, botão e rodapé. */
export function layoutEmail(c: Conteudo): string {
  const p = (html: string) => `<p style="margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:1.6;color:${TINTA}">${html}</p>`
  const nota = (html: string) => `<p style="margin:0 0 10px;font-family:${FONTE};font-size:13px;line-height:1.55;color:${SUAVE}">${html}</p>`
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><title>${esc(c.titulo)}</title></head>
<body style="margin:0;padding:0;background:${FUNDO}">
<div style="display:none;max-height:0;overflow:hidden;opacity:0">${esc(c.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FUNDO}">
  <tr><td align="center" style="padding:32px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px">
      <tr><td style="background:${AZUL};border-radius:16px 16px 0 0;padding:22px 32px">
        <table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:12px"><img src="${c.portal}/email/logo-4juris.png" width="40" height="40" alt="4" style="display:block;border:0;border-radius:10px"></td>
          <td style="font-family:${FONTE};color:#ffffff">
            <div style="font-size:18px;font-weight:800;letter-spacing:-0.2px;line-height:1.1">4JURIS</div>
            <div style="font-size:12px;opacity:.85;line-height:1.4">Portal do Colaborador</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td style="background:#ffffff;padding:36px 32px 30px;border:1px solid ${LINHA};border-top:0;border-radius:0 0 16px 16px">
        <h1 style="margin:0 0 18px;font-family:${FONTE};font-size:22px;line-height:1.3;color:${TINTA};font-weight:700">${esc(c.titulo)}</h1>
        ${c.paragrafos.map(p).join('\n        ')}
        ${c.destaque ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 24px"><tr><td style="background:${FUNDO};border-radius:12px;padding:14px 18px;font-family:${FONTE}">
          <div style="font-size:12px;color:${SUAVE};text-transform:uppercase;letter-spacing:.6px;font-weight:700">${esc(c.destaque.rotulo)}</div>
          <div style="font-size:16px;color:${TINTA};font-weight:600;margin-top:4px;word-break:break-all">${esc(c.destaque.valor)}</div>
        </td></tr></table>` : ''}
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:4px 0 28px"><tr>
          <td style="border-radius:12px;background:${AZUL}"><a href="${esc(c.botao.link)}" target="_blank" style="display:inline-block;padding:15px 30px;font-family:${FONTE};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(c.botao.texto)} &rarr;</a></td>
        </tr></table>
        ${c.notas.map(nota).join('\n        ')}
        <p style="margin:18px 0 0;padding-top:16px;border-top:1px solid ${LINHA};font-family:${FONTE};font-size:12px;line-height:1.55;color:${SUAVE}">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${esc(c.botao.link)}" style="color:${AZUL};word-break:break-all">${esc(c.botao.link)}</a></p>
      </td></tr>
      <tr><td align="center" style="padding:20px 24px 0;font-family:${FONTE};font-size:12px;line-height:1.6;color:${SUAVE}">
        Dúvidas? Fale com o RH: <a href="mailto:${emailRH()}" style="color:${AZUL};text-decoration:none">${emailRH()}</a><br>
        E-mail automático da 4JURIS. Não é preciso responder.
      </td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

export const emailRH = () => process.env.EMAIL_RH || 'recursoshumanos@4jurismarketing.com.br'

/** Boas-vindas com o link para a pessoa criar a própria senha. */
export function emailBoasVindas(d: { nome: string; email: string; link: string; portal: string; validadeDias: number }): Email {
  const nome = primeiroNome(d.nome)
  const assunto = 'Seu acesso ao Portal do Colaborador 4JURIS'
  const html = layoutEmail({
    previa: 'Crie sua senha e entre no portal. Leva menos de um minuto.',
    titulo: `Olá, ${nome}! Seu acesso está pronto`,
    paragrafos: [
      'Você já tem acesso ao <b>Portal do Colaborador da 4JURIS</b>. Por lá você acompanha os comunicados e a agenda, envia notas fiscais e pedidos de reembolso e mantém seus dados em dia.',
      'Para entrar pela primeira vez, crie a sua senha no botão abaixo. O seu login é este e-mail:',
    ],
    destaque: { rotulo: 'Seu login', valor: d.email },
    botao: { texto: 'Criar minha senha', link: d.link },
    notas: [
      `O link vale por ${d.validadeDias} dias e só funciona uma vez. Depois de criar a senha, é só entrar em <a href="${esc(d.portal)}" style="color:${AZUL}">${esc(d.portal.replace(/^https?:\/\//, ''))}</a> com o seu e-mail.`,
      'Se o link expirar, clique em <b>“Esqueceu a senha?”</b> na tela de entrada e receba um novo.',
    ],
    portal: d.portal,
  })
  const texto = `Olá, ${nome}!

Você já tem acesso ao Portal do Colaborador da 4JURIS.
Seu login: ${d.email}

Crie a sua senha neste link (vale por ${d.validadeDias} dias e só funciona uma vez):
${d.link}

Depois, é só entrar em ${d.portal} com o seu e-mail.
Se o link expirar, use "Esqueceu a senha?" na tela de entrada.

Dúvidas? Fale com o RH: ${emailRH()}`
  return { assunto, html, texto }
}

/** Link de "Esqueceu a senha?". */
export function emailRedefinicao(d: { link: string; portal: string }): Email {
  const assunto = 'Redefinição de senha · Portal 4JURIS'
  const html = layoutEmail({
    previa: 'Use o link para criar uma nova senha. Ele vale por 1 hora.',
    titulo: 'Vamos criar uma nova senha',
    paragrafos: ['Recebemos um pedido para redefinir a sua senha no Portal do Colaborador da 4JURIS. Clique no botão abaixo para escolher a nova senha.'],
    botao: { texto: 'Criar nova senha', link: d.link },
    notas: ['O link vale por 1 hora e só funciona uma vez.', 'Se não foi você quem pediu, ignore este e-mail: a sua senha atual continua valendo.'],
    portal: d.portal,
  })
  const texto = `Recebemos um pedido para redefinir a sua senha no Portal 4JURIS.

Crie a nova senha neste link (vale por 1 hora):
${d.link}

Se não foi você, ignore este e-mail.`
  return { assunto, html, texto }
}

/** Solicitação de acesso aprovada (a pessoa já definiu a senha ao se cadastrar). */
export function emailAcessoLiberado(d: { nome: string; email: string; portal: string }): Email {
  const assunto = 'Seu acesso foi liberado · Portal 4JURIS'
  const html = layoutEmail({
    previa: 'Seu cadastro foi aprovado. Já dá para entrar no portal.',
    titulo: `Tudo certo, ${primeiroNome(d.nome)}! Seu acesso foi liberado`,
    paragrafos: ['O seu cadastro no Portal do Colaborador da 4JURIS foi aprovado. Entre com o e-mail abaixo e a senha que você escolheu ao se cadastrar.'],
    destaque: { rotulo: 'Seu login', valor: d.email },
    botao: { texto: 'Entrar no portal', link: `${d.portal}/login` },
    notas: ['Esqueceu a senha? Use <b>“Esqueceu a senha?”</b> na tela de entrada.'],
    portal: d.portal,
  })
  return { assunto, html, texto: `Seu acesso ao Portal 4JURIS foi liberado.\nLogin: ${d.email}\nEntre em ${d.portal}/login` }
}
