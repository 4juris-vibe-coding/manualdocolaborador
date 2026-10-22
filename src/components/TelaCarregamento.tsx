/* Tela de carregamento 4JURIS. O estilo (classes .tc-*) mora no index.html, que mostra a mesma tela antes do JS
   carregar: quando o app assume (ex.: esperando a sessão), a troca entre as duas é invisível. */

const Marca = () => (
  <div className="tc-marca">
    <div className="tc-anel" />
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <rect width="64" height="64" rx="16" fill="#0032D2" />
      <text x="50%" y="53%" dominantBaseline="middle" textAnchor="middle" fontFamily="Sora, Arial, sans-serif" fontSize="30" fontWeight="800" letterSpacing="-2" fill="#fff">4J</text>
    </svg>
  </div>
)

/** Tela cheia: início do app, sessão e páginas públicas que dependem do servidor. */
export function TelaCarregamento({ mensagem = 'Carregando o portal…' }: { mensagem?: string }) {
  return (
    <div className="tc" role="status" aria-live="polite">
      <Marca />
      <div className="tc-nome">4JURIS <span>Pessoas</span></div>
      <div className="tc-barra" />
      <div className="tc-msg">{mensagem}</div>
    </div>
  )
}

/** Dentro do layout (menu e topo já visíveis): só o indicador, sem cobrir a tela. */
export function CarregandoArea({ mensagem = 'Carregando…' }: { mensagem?: string }) {
  return (
    <div className="flex flex-col items-center justify-center gap-4 py-24" role="status" aria-live="polite">
      <div className="h-9 w-9 rounded-full border-[3px] border-brand-100 border-t-brand animate-spin" />
      <div className="text-[13px] text-muted">{mensagem}</div>
    </div>
  )
}
