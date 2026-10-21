/* Rede de segurança das páginas: sem isto, qualquer erro de renderização (ou falha ao baixar uma página
   sob demanda depois de uma nova versão do app) derruba a tela inteira e deixa só o fundo branco. */
import { Component, type ReactNode } from 'react'

const FLAG = '4juris_recarregou_chunk'
const ehFalhaDeCarga = (e: unknown) => /dynamically imported module|Importing a module script failed|Loading chunk|ChunkLoadError|error loading dynamically/i.test(String((e as Error)?.message ?? e))

interface Props { children: ReactNode }
interface Estado { erro: Error | null }

export class ErroPagina extends Component<Props, Estado> {
  state: Estado = { erro: null }
  timer?: number

  static getDerivedStateFromError(erro: Error): Estado { return { erro } }

  componentDidMount() {
    // Carregou bem: libera o recarregamento automático para a próxima vez.
    this.timer = window.setTimeout(() => { try { sessionStorage.removeItem(FLAG) } catch { /* ignore */ } }, 4000)
  }
  componentWillUnmount() { window.clearTimeout(this.timer) }

  componentDidCatch(erro: Error) {
    console.error('Erro na página:', erro)
    // Versão nova publicada com o app aberto: os arquivos antigos sumiram. Recarrega uma vez, sozinho.
    if (ehFalhaDeCarga(erro)) {
      try {
        if (!sessionStorage.getItem(FLAG)) { sessionStorage.setItem(FLAG, '1'); window.location.reload() }
      } catch { /* ignore */ }
    }
  }

  render() {
    const { erro } = this.state
    if (!erro) return this.props.children
    const carga = ehFalhaDeCarga(erro)
    return (
      <div role="alert" className="card p-8 max-w-xl mx-auto mt-10 text-center">
        <h1 className="text-[18px] font-extrabold text-ink">{carga ? 'Há uma versão nova do sistema' : 'Não foi possível abrir esta página'}</h1>
        <p className="text-[13.5px] text-muted mt-2 leading-relaxed">
          {carga ? 'Recarregue a página para continuar. Nada do que você fez foi perdido.' : 'Algo deu errado ao montar a tela. Tente recarregar; se continuar, volte ao início e avise o RH com o detalhe abaixo.'}
        </p>
        <div className="flex flex-wrap justify-center gap-2.5 mt-5">
          <button type="button" className="h-10 px-4 rounded-xl bg-brand text-white text-[13px] font-semibold" onClick={() => window.location.reload()}>Recarregar</button>
          <a href="/" className="h-10 px-4 rounded-xl border border-line-strong text-ink text-[13px] font-semibold inline-flex items-center">Voltar ao início</a>
        </div>
        <details className="mt-5 text-left text-[12px] text-muted">
          <summary className="cursor-pointer font-semibold">Detalhe técnico</summary>
          <pre className="mt-2 whitespace-pre-wrap break-words">{String(erro.message || erro)}</pre>
        </details>
      </div>
    )
  }
}
