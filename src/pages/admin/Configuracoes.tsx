import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { ConfigGeral, Produto } from '@/lib/types'
import { PageHeader, Card, CardHead, Button, Field, Icon } from '@/components/ui'
import { feedback } from '@/components/toast'
import { mascaraCNPJ } from '@/domain/validacao'
import { uid } from '@/lib/utils'

const ATALHOS = [
  { to: '/admin', icon: 'ShieldCheck', t: 'Usuários & acessos', d: 'Papéis e matriz de permissões' },
  { to: '/rh/estrutura', icon: 'ListTree', t: 'Listas', d: 'Motivos de encerramento e tipos de registro' },
  { to: '/rh/disponibilidade', icon: 'CalendarRange', t: 'Política de disponibilidade', d: 'Antecedência sugerida e alinhamento' },
  { to: '/rh/gamificacao', icon: 'SlidersHorizontal', t: 'Gamificação', d: 'Regras, níveis e limites' },
  { to: '/rh/inicio-parceria', icon: 'Sprout', t: 'Avaliação de início', d: 'Marcos e prazos' },
  { to: '/rh/cultura', icon: 'Sparkle', t: 'Cultura', d: 'Propósito e valores' },
  { to: '/seguranca', icon: 'ScrollText', t: 'Privacidade & auditoria', d: 'LGPD e histórico de ações' },
]

export default function Configuracoes() {
  const s = useStore()
  const [g, setG] = useState<ConfigGeral>(s.config.geral)
  const [fin, setFin] = useState(s.config.financeiro)
  const [produtos, setProdutos] = useState<Produto[]>(s.config.produtos ?? [])
  const mudarProduto = (id: string, patch: Partial<Produto>) => setProdutos((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  return (
    <>
      <PageHeader title="Configurações gerais" subtitle="Dados da empresa usados no portal e nas instruções de emissão de notas fiscais." />
      <div className="grid grid-cols-1 lg:grid-cols-[1.2fr_1fr] gap-6">
        <Card className="p-5 sm:p-6">
          <h3 className="text-[15px] font-bold text-ink mb-4">Empresa</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4">
            <Field label="Nome da empresa" required htmlFor="cg-n"><input id="cg-n" className="input" value={g.nomeEmpresa} onChange={(e) => setG({ ...g, nomeEmpresa: e.target.value })} /></Field>
            <Field label="Razão social do tomador" htmlFor="cg-r" hint="Quem aparece como tomador nas NFs"><input id="cg-r" className="input" value={g.razaoSocialTomador} onChange={(e) => setG({ ...g, razaoSocialTomador: e.target.value })} /></Field>
            <Field label="CNPJ do tomador" htmlFor="cg-c"><input id="cg-c" className="input" inputMode="numeric" value={g.cnpjTomador} onChange={(e) => setG({ ...g, cnpjTomador: mascaraCNPJ(e.target.value) })} /></Field>
            <Field label="E-mail do RH" htmlFor="cg-e"><input id="cg-e" type="email" className="input" value={g.emailRH} onChange={(e) => setG({ ...g, emailRH: e.target.value })} /></Field>
            <Field label="E-mail do Financeiro" htmlFor="cg-f"><input id="cg-f" type="email" className="input" value={g.emailFinanceiro} onChange={(e) => setG({ ...g, emailFinanceiro: e.target.value })} /></Field>
          </div>
          <Button icon="Check" onClick={() => feedback(s.salvarConfigGeral(g), 'Configurações salvas.')}>Salvar empresa</Button>
          <h3 className="text-[15px] font-bold text-ink mb-4 mt-8">Calendário de notas fiscais</h3>
          <div className="grid grid-cols-2 gap-4 max-w-sm">
            <Field label="Dia limite de envio" htmlFor="cg-de"><input id="cg-de" type="number" min={1} max={28} className="input" value={fin.diaEnvioNF} onChange={(e) => setFin({ ...fin, diaEnvioNF: Number(e.target.value) })} /></Field>
            <Field label="Dia de pagamento" htmlFor="cg-dp"><input id="cg-dp" type="number" min={1} max={28} className="input" value={fin.diaPagamento} onChange={(e) => setFin({ ...fin, diaPagamento: Number(e.target.value) })} /></Field>
          </div>
          <Button variant="ghost" icon="Check" onClick={() => {
            if (!(fin.diaEnvioNF >= 1 && fin.diaEnvioNF <= 28 && fin.diaPagamento >= 1 && fin.diaPagamento <= 28)) { feedback({ ok: false, erro: 'Use dias entre 1 e 28.' }, ''); return }
            useStore.setState((st) => ({ config: { ...st.config, financeiro: fin } })); feedback({ ok: true }, 'Calendário atualizado (vale para as próximas competências geradas).')
          }}>Salvar calendário</Button>
          <h3 className="text-[15px] font-bold text-ink mb-1 mt-8">Produtos</h3>
          <p className="text-[12.5px] text-muted mb-4">Negócios da empresa (ex.: 4Juris, Lexfy). Cada pessoa pode atuar em mais de um; aparecem como etiqueta e filtro no organograma, sem mudar quem responde a quem.</p>
          <ul className="space-y-2 mb-3">
            {produtos.map((p) => (
              <li key={p.id} className="flex items-center gap-2">
                <input type="color" aria-label={`Cor de ${p.nome || 'produto'}`} className="h-9 w-10 rounded-lg border border-line bg-surface p-1 shrink-0" value={p.cor} onChange={(e) => mudarProduto(p.id, { cor: e.target.value })} />
                <input aria-label="Nome do produto" className="input flex-1" value={p.nome} onChange={(e) => mudarProduto(p.id, { nome: e.target.value })} />
                <Button size="sm" variant="ghost" icon="Trash2" aria-label={`Remover ${p.nome || 'produto'}`} onClick={() => setProdutos((ps) => ps.filter((x) => x.id !== p.id))} />
              </li>
            ))}
          </ul>
          <div className="flex gap-2 flex-wrap">
            <Button variant="ghost" icon="Plus" onClick={() => setProdutos((ps) => [...ps, { id: uid('pr'), nome: '', cor: '#0032D2' }])}>Adicionar produto</Button>
            <Button icon="Check" onClick={() => feedback(s.salvarProdutos(produtos), 'Produtos salvos.')}>Salvar produtos</Button>
          </div>
        </Card>
        <Card>
          <CardHead title="Outras configurações" />
          <ul className="divide-y divide-line">
            {ATALHOS.map((a) => <li key={a.to}><Link to={a.to} className="flex items-center gap-3 px-5 py-3.5 hover:bg-surface-2"><span className="h-9 w-9 rounded-lg bg-brand-50 text-brand flex items-center justify-center"><Icon name={a.icon} className="h-4 w-4" /></span><span className="flex-1"><span className="block text-[13.5px] font-semibold text-ink">{a.t}</span><span className="block text-[12px] text-muted">{a.d}</span></span><Icon name="ChevronRight" className="h-4 w-4 text-muted" /></Link></li>)}
          </ul>
        </Card>
      </div>
    </>
  )
}
