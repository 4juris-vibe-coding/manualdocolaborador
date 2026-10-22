/* Envio do e-mail de acesso (boas-vindas + link para criar a senha), com o resumo em aviso na tela. */
import { toast } from '@/components/toast'
import { enviarAcessoPorEmail } from '@/data/sync'
import { useStore } from '@/lib/store'

/** Devolve quantos e-mails saíram de fato. */
export async function enviarAcessos(ids: string[]): Promise<number> {
  const r = await enviarAcessoPorEmail(ids)
  if ('erro' in r) { toast(r.erro, 'danger'); return 0 }
  const enviados = r.resultados.filter((x) => x.status === 'enviado').length
  const falhas = r.resultados.filter((x) => x.status !== 'enviado')
  if (r.resultados.some((x) => x.status === 'nao_configurado')) {
    toast('Nenhum e-mail saiu: o envio não está configurado no servidor (falta a RESEND_API_KEY na Vercel).', 'danger')
  } else if (falhas.length) {
    const nomeDe = useStore.getState().nomeDe
    toast(`${enviados} e-mail(s) enviado(s). Não enviados: ${falhas.map((f) => `${nomeDe(f.colaboradorId)} (${f.erro})`).join('; ')}`, enviados ? 'info' : 'danger')
  } else toast(enviados === 1 ? 'E-mail de acesso enviado.' : `${enviados} e-mails de acesso enviados.`, 'success')
  return enviados
}
