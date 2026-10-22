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

export interface Conteudo {
  /** Texto curto que aparece ao lado do assunto na caixa de entrada. */
  previa: string
  titulo: string
  /** Linha pequena acima do título (ex.: "Acesso", "Recrutamento"). */
  etiqueta?: string
  /** Parágrafos em HTML já escapado. */
  paragrafos: string[]
  destaque?: { rotulo: string; valor: string }
  botao?: { texto: string; link: string }
  /** Observações em letra menor, abaixo do botão. */
  notas: string[]
  portal: string
}

/** Moldura comum: cabeçalho azul com a marca, cartão branco, botão e rodapé escuro. */
export function layoutEmail(c: Conteudo): string {
  const p = (html: string) => `<p style="margin:0 0 16px;font-family:${FONTE};font-size:15px;line-height:1.65;color:${TINTA}">${html}</p>`
  const nota = (html: string) => `<p style="margin:0 0 10px;font-family:${FONTE};font-size:13px;line-height:1.6;color:${SUAVE}">${html}</p>`
  const rh = emailRH()
  const botao = c.botao ? `
        <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 28px"><tr>
          <td bgcolor="${AZUL}" style="border-radius:12px;background:${AZUL};box-shadow:0 6px 16px rgba(0,50,210,.28)"><a href="${esc(c.botao.link)}" target="_blank" style="display:inline-block;padding:16px 34px;font-family:${FONTE};font-size:15px;font-weight:700;color:#ffffff;text-decoration:none;border-radius:12px">${esc(c.botao.texto)} &rarr;</a></td>
        </tr></table>` : ''
  const alternativo = c.botao ? `
        <p style="margin:22px 0 0;padding-top:18px;border-top:1px solid ${LINHA};font-family:${FONTE};font-size:12px;line-height:1.6;color:${SUAVE}">Se o botão não abrir, copie e cole este endereço no navegador:<br><a href="${esc(c.botao.link)}" style="color:${AZUL};word-break:break-all">${esc(c.botao.link)}</a></p>` : ''
  return `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light"><meta name="supported-color-schemes" content="light"><title>${esc(c.titulo)}</title></head>
<body style="margin:0;padding:0;background:${FUNDO};-webkit-text-size-adjust:100%">
<div style="display:none;max-height:0;overflow:hidden;opacity:0;mso-hide:all">${esc(c.previa)}</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${FUNDO}">
  <tr><td align="center" style="padding:36px 16px">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:580px">
      <tr><td bgcolor="${AZUL}" style="background:${AZUL};background-image:linear-gradient(135deg,#0032D2 0%,#001F83 100%);border-radius:20px 20px 0 0;padding:28px 36px 26px">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0"><tr>
          <td style="padding-right:14px;width:44px"><img src="${c.portal}/email/logo-4juris.png" width="44" height="44" alt="4JURIS" style="display:block;border:0;border-radius:12px"></td>
          <td style="font-family:${FONTE};color:#ffffff">
            <div style="font-size:19px;font-weight:800;letter-spacing:.4px;line-height:1.1">4JURIS</div>
            <div style="font-size:12px;color:#c9d5fb;line-height:1.5;letter-spacing:.2px">Portal do Colaborador</div>
          </td>
        </tr></table>
      </td></tr>
      <tr><td height="4" style="height:4px;line-height:4px;font-size:0;background:#4D6BEC;background-image:linear-gradient(90deg,#4D6BEC,#9DB0FF)">&nbsp;</td></tr>
      <tr><td style="background:#ffffff;padding:38px 36px 32px;border:1px solid ${LINHA};border-top:0;border-radius:0 0 20px 20px">
        ${c.etiqueta ? `<div style="margin:0 0 10px;font-family:${FONTE};font-size:11px;font-weight:800;letter-spacing:1.4px;text-transform:uppercase;color:${AZUL}">${esc(c.etiqueta)}</div>` : ''}
        <h1 style="margin:0 0 20px;font-family:${FONTE};font-size:24px;line-height:1.3;color:${TINTA};font-weight:800;letter-spacing:-.3px">${esc(c.titulo)}</h1>
        ${c.paragrafos.map(p).join('\n        ')}
        ${c.destaque ? `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 26px"><tr><td style="background:#f2f5fe;border:1px solid #dbe3fb;border-left:4px solid ${AZUL};border-radius:12px;padding:16px 20px;font-family:${FONTE}">
          <div style="font-size:11px;color:${AZUL};text-transform:uppercase;letter-spacing:1px;font-weight:800">${esc(c.destaque.rotulo)}</div>
          <div style="font-size:17px;color:${TINTA};font-weight:700;margin-top:5px;word-break:break-all">${esc(c.destaque.valor)}</div>
        </td></tr></table>` : ''}${botao}
        ${c.notas.map(nota).join('\n        ')}${alternativo}
      </td></tr>
      <tr><td align="center" style="padding:24px 28px 0;font-family:${FONTE};font-size:12px;line-height:1.7;color:${SUAVE}">
        <b style="color:${TINTA}">Dúvidas?</b> Fale com o RH: <a href="mailto:${rh}" style="color:${AZUL};text-decoration:none;font-weight:600">${rh}</a><br>
        E-mail automático da 4JURIS. Não é preciso responder.
      </td></tr>
      <tr><td align="center" style="padding:14px 28px 0;font-family:${FONTE};font-size:11px;color:#8a95a1;letter-spacing:.3px">&copy; 4JURIS · Todos os direitos reservados</td></tr>
    </table>
  </td></tr>
</table>
</body></html>`
}

/** Converte uma mensagem em texto simples (parágrafos separados por linha em branco; links viram links) em e-mail na moldura da marca. */
export function emailDeTexto(d: { assunto: string; texto: string; portal: string; etiqueta?: string }): string {
  const linkar = (t: string) => esc(t).replace(/(https?:\/\/[^\s<]+)/g, (u) => `<a href="${u}" style="color:${AZUL};word-break:break-all">${u}</a>`).replace(/\n/g, '<br>')
  const blocos = d.texto.trim().split(/\n{2,}/).filter(Boolean)
  return layoutEmail({ previa: d.texto.replace(/\s+/g, ' ').trim().slice(0, 110), titulo: d.assunto, etiqueta: d.etiqueta, paragrafos: blocos.map(linkar), notas: [], portal: d.portal })
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
