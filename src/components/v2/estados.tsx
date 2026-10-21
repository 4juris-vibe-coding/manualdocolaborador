/* Estados padrão de tela dos módulos v2: carregando, erro, sem permissão, sem banco. */
import type { ReactNode } from 'react'
import { Button, Card, Callout, EmptyState } from '@/components/ui'
import { MODO_API } from '@/data/config'
import type { Remoto } from '@/data/v2/api'

export function CarregandoBloco({ linhas = 3, className = '' }: { linhas?: number; className?: string }) {
  return (
    <div className={`space-y-3 ${className}`} aria-busy="true" aria-label="Carregando">
      {Array.from({ length: linhas }).map((_, i) => <div key={i} className="h-16 rounded-2xl bg-winter/70 animate-pulse" />)}
    </div>
  )
}

export function ErroBloco({ mensagem, onTentar }: { mensagem: string; onTentar?: () => void }) {
  return (
    <Card className="p-6">
      <EmptyState icon="AlertTriangle" title="Não foi possível carregar" desc={mensagem}
        action={onTentar && <Button variant="ghost" icon="RefreshCw" onClick={onTentar}>Tentar de novo</Button>} />
    </Card>
  )
}

export function SemPermissao() {
  return <Card className="p-6"><EmptyState icon="Lock" title="Sem permissão" desc="Seu perfil não tem acesso a esta área. Se isso parece um engano, fale com o RH." /></Card>
}

/** Os módulos v2 gravam no banco; no modo demonstração (sem servidor) eles não funcionam. */
export function SoComBanco({ children }: { children: ReactNode }) {
  if (MODO_API) return <>{children}</>
  return (
    <Callout tone="warning" icon="DatabaseZap">
      Este módulo grava em banco de dados e só funciona com o servidor conectado (<code>VITE_DATA_SOURCE=api</code>). No modo demonstração ele fica indisponível para não exibir dados fictícios como se fossem reais.
    </Callout>
  )
}

/**
 * Renderiza um `useApi`: carregando → esqueleto, erro → bloco com nova tentativa,
 * 403 → sem permissão, dados → children. `vazio` decide quando mostrar o estado vazio.
 */
export function Aguardar<T>({ r, children, vazio, linhas }: { r: Remoto<T>; children: (dados: T) => ReactNode; vazio?: (d: T) => ReactNode | null; linhas?: number }) {
  if (r.erro && !r.dados) return r.erro.status === 403 ? <SemPermissao /> : <ErroBloco mensagem={r.erro.message} onTentar={r.recarregar} />
  if (r.carregando && !r.dados) return <CarregandoBloco linhas={linhas} />
  if (!r.dados) return null
  const v = vazio?.(r.dados)
  return <>{v ?? children(r.dados)}</>
}
