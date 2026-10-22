import { useEffect, useRef, useState } from 'react'
import { useStore } from '@/lib/store'
import { Avatar, Icon, Logo } from '@/components/ui'
import { cn, firstName } from '@/lib/utils'
import { uid } from '@/lib/utils'
import { useAlturaDisponivel } from '@/lib/layout'

interface Msg { id: string; autor: 'user' | 'ia'; texto: string }

const SUGESTOES = [
  { icon: 'FileText', t: 'Como emitir minha nota fiscal?' },
  { icon: 'ReceiptText', t: 'Como solicito um reembolso?' },
  { icon: 'Palmtree', t: 'Como registro um período de descanso?' },
  { icon: 'Wallet', t: 'Quando eu recebo o pagamento?' },
  { icon: 'Gift', t: 'Quais parcerias estão disponíveis?' },
  { icon: 'Trophy', t: 'Como funciona a gamificação?' },
]

/** Base de respostas do assistente (mock). Conecte a uma LLM mantendo a assinatura. */
function responder(pergunta: string, ctx: { nome: string }): string {
  const q = pergunta.toLowerCase()
  const m = (...termos: string[]) => termos.some((t) => q.includes(t))

  if (m('nota', 'nf', 'fiscal', 'nfs')) {
    return `Claro, ${ctx.nome}! Para emitir sua **nota fiscal**:\n\n1. Acesse o Emissor Nacional (nfse.gov.br) e faça login.\n2. Clique em "Nova NFS-e".\n3. Informe o tomador: **4JURIS MARKETING LTDA · CNPJ 46.937.316/0001-05**.\n4. Preencha a descrição do serviço e o valor conforme contrato.\n5. Emita, baixe o PDF e anexe aqui na **Central de Notas Fiscais**.\n\n📅 O prazo de envio é até o **dia 22** e o pagamento é feito no **dia 25**.`
  }
  if (m('reembolso', 'reembols')) {
    return `Para pedir um **reembolso**, vá em *Reembolsos*, clique em "Solicitar reembolso", escolha a categoria, informe valor e descrição e **anexe o comprovante**. Depois é só acompanhar o status (pendente → aprovado → pago).\n\n⚠️ Em alguns setores, apenas lideranças podem solicitar reembolsos.`
  }
  if (m('folga', 'recesso', 'férias', 'ferias', 'day off', 'descanso', 'indispon', 'pausa')) {
    return `Em *Disponibilidade* você registra os períodos em que não estará disponível para os projetos (descanso combinado). Não há saldo de dias nem aprovação hierárquica: a liderança da área é avisada e pode registrar o **alinhamento da continuidade** das entregas. Os períodos seguem o que está combinado no seu contrato de prestação de serviços.`
  }
  if (m('pagamento', 'recebo', 'salário', 'salario', 'quando recebo', 'dia 25')) {
    return `O **pagamento** é realizado todo **dia 25**. Para garantir o recebimento, envie sua nota fiscal até o **dia 22** (data de vencimento para envio das NFs). Notas aprovadas seguem para o Financeiro efetuar o pagamento.`
  }
  if (m('benefício', 'beneficio', 'wellhub', 'saúde', 'saude')) {
    return `Em *Vantagens & parcerias* você encontra parcerias de adesão opcional (academias, descontos em saúde, apoio emocional), a **Academy 4JURIS** e descontos em estabelecimentos parceiros. A Central de dúvidas tem o passo a passo de cada uma.`
  }
  if (m('gamific', 'pontos', 'nível', 'nivel', 'ranking', 'badge', 'tarefa', 'kanban', 'missõ', 'misso')) {
    return `Os **pontos** vêm de ações de participação: presença em eventos (registrada pela organização), reconhecer e ser reconhecido por colegas, concluir conteúdos, responder pesquisas, desafios opcionais e iniciativas voluntárias. Cada ação pontua uma vez, tudo fica no seu histórico em *Minha jornada*, e pontos **não** têm relação com pagamentos ou avaliação profissional.`
  }
  if (m('senha', 'acesso', 'login', 'entrar')) {
    return `Para questões de **acesso e senha**, fale com o RH em **rh@4juris.com.br**. O administrador pode redefinir sua senha pelo Painel Administrativo.`
  }
  if (m('setor', 'liderança', 'lideranca', 'gestor')) {
    return `Cada pessoa está ligada a uma **área**, que pode ter uma ou mais **lideranças** responsáveis pela coordenação dos projetos. Algumas seções (como reembolsos) podem ser restritas às lideranças, conforme a configuração da área feita pelo RH.`
  }
  if (m('oi', 'olá', 'ola', 'bom dia', 'boa tarde', 'boa noite', 'tudo bem')) {
    return `Olá, ${ctx.nome}! 👋 Sou o assistente da plataforma 4JURIS. Posso te ajudar com notas fiscais, reembolsos, disponibilidade, parcerias, pagamentos e mais. Sobre o que você quer saber?`
  }
  return `Boa pergunta, ${ctx.nome}! Ainda estou aprendendo sobre isso. Posso ajudar com **notas fiscais, reembolsos, disponibilidade, pagamentos, parcerias e reconhecimento**. Para temas mais específicos, fale com o RH em **rh@4juris.com.br**.`
}

/** Renderiza *negrito* simples do texto do assistente. */
function RichText({ texto }: { texto: string }) {
  return (
    <>
      {texto.split('\n').map((linha, i) => (
        <p key={i} className={cn(linha.trim() === '' ? 'h-2' : 'mb-1 last:mb-0')}>
          {linha.split(/(\*\*[^*]+\*\*)/g).map((parte, j) =>
            parte.startsWith('**') && parte.endsWith('**')
              ? <b key={j} className="font-bold text-ink">{parte.slice(2, -2)}</b>
              : <span key={j}>{parte}</span>,
          )}
        </p>
      ))}
    </>
  )
}

export default function Assistente() {
  const user = useStore((s) => s.currentUser())
  const nome = firstName(user.nome)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [texto, setTexto] = useState('')
  const [digitando, setDigitando] = useState(false)
  const scrollRef = useRef<HTMLDivElement>(null)
  const taRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
  }, [msgs, digitando])

  const enviar = (pergunta: string) => {
    const q = pergunta.trim()
    if (!q || digitando) return
    setMsgs((m) => [...m, { id: uid('u'), autor: 'user', texto: q }])
    setTexto('')
    setDigitando(true)
    const resposta = responder(q, { nome })
    // pequena pausa para a resposta não aparecer de forma abrupta
    window.setTimeout(() => {
      setMsgs((m) => [...m, { id: uid('a'), autor: 'ia', texto: resposta }])
      setDigitando(false)
    }, 650)
  }

  const onSubmit = (e: React.FormEvent) => { e.preventDefault(); enviar(texto) }

  // A conversa rola por dentro; a página termina no rodapé da janela para não haver duas rolagens.
  const caixaRef = useRef<HTMLDivElement>(null)
  const altura = useAlturaDisponivel(caixaRef, { min: 460 })
  const vazio = msgs.length === 0

  return (
    <div ref={caixaRef} className="flex flex-col" style={{ height: altura ?? 'calc(100dvh - 140px)' }}>
      {/* Cabeçalho */}
      <div className="flex items-center gap-3 pb-4 border-b border-line mb-4 shrink-0">
        <span className="h-11 w-11 rounded-2xl bg-brand text-white flex items-center justify-center"><Icon name="Bot" className="h-6 w-6" /></span>
        <div>
          <h1 className="text-[19px] font-bold text-ink tracking-tight flex items-center gap-2">Assistente <span className="text-[10.5px] font-bold bg-winter text-ink-2 rounded-full px-2 py-0.5">respostas automáticas</span></h1>
          <p className="text-[12.5px] text-muted">Tire suas dúvidas sobre a 4JURIS em linguagem natural.</p>
        </div>
      </div>

      {/* Conversa */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        {vazio ? (
          <div className="h-full flex flex-col items-center justify-center text-center px-4">
            <Logo size={56} rounded="rounded-2xl" />
            <h2 className="text-[22px] font-bold text-ink mt-5">Olá, {nome}! Como posso ajudar?</h2>
            <p className="text-[13.5px] text-muted mt-1.5 max-w-md">Pergunte sobre processos, parcerias e políticas da 4JURIS.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mt-8 w-full max-w-xl">
              {SUGESTOES.map((sg) => (
                <button key={sg.t} onClick={() => enviar(sg.t)}
                  className="flex items-center gap-3 text-left rounded-xl border border-line bg-surface px-4 py-3 hover:border-brand hover:bg-brand-50/40 transition">
                  <span className="h-9 w-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center shrink-0"><Icon name={sg.icon} className="h-[18px] w-[18px]" /></span>
                  <span className="text-[13px] font-medium text-ink-2">{sg.t}</span>
                </button>
              ))}
            </div>
          </div>
        ) : (
          <div className="max-w-2xl mx-auto space-y-5 pb-2">
            {msgs.map((m) => (
              <div key={m.id} className={cn('flex gap-3', m.autor === 'user' && 'flex-row-reverse')}>
                {m.autor === 'ia'
                  ? <span className="h-8 w-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0"><Icon name="Bot" className="h-[18px] w-[18px]" /></span>
                  : <Avatar nome={user.nome} cor={user.avatarCor} size="sm" />}
                <div className={cn('rounded-2xl px-4 py-3 text-[13.5px] leading-relaxed max-w-[80%]',
                  m.autor === 'user' ? 'bg-brand text-white rounded-tr-sm' : 'bg-surface border border-line text-ink-2 rounded-tl-sm')}>
                  {m.autor === 'ia' ? <RichText texto={m.texto} /> : m.texto}
                </div>
              </div>
            ))}
            {digitando && (
              <div className="flex gap-3">
                <span className="h-8 w-8 rounded-lg bg-brand text-white flex items-center justify-center shrink-0"><Icon name="Bot" className="h-[18px] w-[18px]" /></span>
                <div className="bg-surface border border-line rounded-2xl rounded-tl-sm px-4 py-3.5 flex items-center gap-1">
                  {[0, 1, 2].map((i) => <span key={i} className="h-2 w-2 rounded-full bg-muted-2 animate-bounce" style={{ animationDelay: `${i * 0.15}s` }} />)}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Barra de pergunta */}
      <div className="shrink-0 pt-4">
        <form onSubmit={onSubmit} className="max-w-2xl mx-auto">
          <div className="flex items-end gap-2 bg-surface border border-line-strong rounded-2xl p-2 shadow-xs focus-within:border-brand focus-within:ring-1 focus-within:ring-brand transition">
            <textarea
              ref={taRef}
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); enviar(texto) } }}
              rows={1}
              placeholder="Pergunte ao assistente..."
              className="flex-1 resize-none bg-transparent outline-none text-[14px] text-ink placeholder:text-muted-2 px-2.5 py-2 max-h-32"
            />
            <button type="submit" disabled={!texto.trim() || digitando}
              className="h-10 w-10 shrink-0 rounded-xl bg-brand text-white flex items-center justify-center hover:bg-brand-600 transition disabled:opacity-40 disabled:pointer-events-none">
              <Icon name="ArrowUp" className="h-5 w-5" />
            </button>
          </div>
          <p className="text-center text-[11px] text-muted-2 mt-2">Respostas automáticas por palavras-chave (ainda não há IA conectada). Confirme informações importantes com o RH.</p>
        </form>
      </div>
    </div>
  )
}
