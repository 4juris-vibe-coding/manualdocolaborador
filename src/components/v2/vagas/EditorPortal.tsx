/* Editor do conteúdo institucional do portal de carreiras (sem mexer no código da página). */
import { useEffect, useState } from 'react'
import { Button, Callout, Card, CardHead, Field } from '@/components/ui'
import { Dropdown } from '@/components/Dropdown'
import { api, executar } from '@/data/v2/api'
import { REDES, ROTULO_REDE, type PortalConfig, type RedeSocial } from '@/domain/v2/portal'

export function EditorPortal({ inicial, edita, onSalvo }: { inicial: PortalConfig; edita: boolean; onSalvo: () => void }) {
  const [p, setP] = useState<PortalConfig>(inicial)
  const [salvando, setSalvando] = useState(false)
  useEffect(() => setP(inicial), [inicial])
  const set = (patch: Partial<PortalConfig>) => setP((x) => ({ ...x, ...patch }))
  // Função (não componente): um componente declarado aqui seria recriado a cada render e o campo perderia o foco.
  const texto = (k: keyof PortalConfig, rotulo: string, max: number, linhas = 3, dica?: string) => (
    <Field label={rotulo} htmlFor={`po-${k}`} hint={dica ?? `Até ${max} caracteres.`}>
      {linhas === 1
        ? <input id={`po-${k}`} className="input" disabled={!edita} maxLength={max} value={(p[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value } as Partial<PortalConfig>)} />
        : <textarea id={`po-${k}`} rows={linhas} className="input !h-auto py-2.5" disabled={!edita} maxLength={max} value={(p[k] as string) ?? ''} onChange={(e) => set({ [k]: e.target.value } as Partial<PortalConfig>)} />}
    </Field>
  )
  const salvar = async () => {
    setSalvando(true)
    const limpo: PortalConfig = {
      ...p,
      valores: (p.valores ?? []).filter((v) => v.nome.trim()),
      processoSeletivo: (p.processoSeletivo ?? []).filter((e) => e.titulo.trim()),
      diferenciais: (p.diferenciais ?? []).filter((d) => d.trim()),
      redes: (p.redes ?? []).filter((r) => r.url.trim()),
    }
    const ok = await executar(() => api.put('recrutamento/config/portal', { dados: limpo }), 'Portal atualizado. As mudanças já aparecem na página de carreiras.')
    setSalvando(false)
    if (ok) onSalvo()
  }
  return (
    <div className="space-y-5">
      <Callout tone="brand" icon="Globe">Este conteúdo aparece na página pública <a href="/carreiras" target="_blank" rel="noreferrer" className="font-semibold underline">/carreiras</a>. Seções vazias não são exibidas. Não inclua dados pessoais.</Callout>
      <Card><CardHead title="Apresentação" /><div className="p-5">
        {texto("titulo", "Título", 120, 1)}
        {texto("apresentacao", "Apresentação (logo abaixo do título)", 600, 2)}
        {texto("quemSomos", "Quem somos", 2000, 4)}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-x-4">{texto("missao", "Missão", 600)}{texto("visao", "Visão", 600)}</div>
        {texto("cultura", "Cultura organizacional", 2000, 4)}
        {texto("comoTrabalhar", "Como é trabalhar na 4JURIS", 2000, 4)}
        {texto("contatoEmail", "E-mail de contato para candidatos (opcional)", 160, 1, "Aparece no rodapé do portal.")}
      </div></Card>

      <Card><CardHead title="Valores" sub="Até 12" /><div className="p-5 space-y-2">
        {(p.valores ?? []).map((v, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-2">
            <input aria-label={`Valor ${i + 1}`} className="input" disabled={!edita} maxLength={80} value={v.nome} onChange={(e) => set({ valores: p.valores!.map((x, j) => (j === i ? { ...x, nome: e.target.value } : x)) })} placeholder="Nome do valor" />
            <input aria-label={`Descrição do valor ${i + 1}`} className="input" disabled={!edita} maxLength={300} value={v.descricao ?? ''} onChange={(e) => set({ valores: p.valores!.map((x, j) => (j === i ? { ...x, descricao: e.target.value } : x)) })} placeholder="Descrição (opcional)" />
            {edita && <Button size="icon" variant="subtle" icon="X" aria-label="Remover valor" onClick={() => set({ valores: p.valores!.filter((_, j) => j !== i) })} />}
          </div>
        ))}
        {edita && (p.valores?.length ?? 0) < 12 && <Button size="sm" variant="soft" icon="Plus" onClick={() => set({ valores: [...(p.valores ?? []), { nome: '' }] })}>Adicionar valor</Button>}
      </div></Card>

      <Card><CardHead title="Como funciona o processo seletivo" sub="Visão geral; cada vaga mostra as próprias etapas" /><div className="p-5 space-y-2">
        {(p.processoSeletivo ?? []).map((e, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[220px_1fr_auto] gap-2">
            <input aria-label={`Etapa ${i + 1}`} className="input" disabled={!edita} maxLength={80} value={e.titulo} onChange={(x) => set({ processoSeletivo: p.processoSeletivo!.map((y, j) => (j === i ? { ...y, titulo: x.target.value } : y)) })} />
            <input aria-label={`Descrição da etapa ${i + 1}`} className="input" disabled={!edita} maxLength={300} value={e.descricao ?? ''} onChange={(x) => set({ processoSeletivo: p.processoSeletivo!.map((y, j) => (j === i ? { ...y, descricao: x.target.value } : y)) })} />
            {edita && <Button size="icon" variant="subtle" icon="X" aria-label="Remover etapa" onClick={() => set({ processoSeletivo: p.processoSeletivo!.filter((_, j) => j !== i) })} />}
          </div>
        ))}
        {edita && (p.processoSeletivo?.length ?? 0) < 10 && <Button size="sm" variant="soft" icon="Plus" onClick={() => set({ processoSeletivo: [...(p.processoSeletivo ?? []), { titulo: '' }] })}>Adicionar etapa</Button>}
      </div></Card>

      <Card><CardHead title="Diferenciais" sub="Frases curtas, até 12" /><div className="p-5 space-y-2">
        {(p.diferenciais ?? []).map((d, i) => (
          <div key={i} className="flex gap-2"><input aria-label={`Diferencial ${i + 1}`} className="input flex-1" disabled={!edita} maxLength={120} value={d} onChange={(e) => set({ diferenciais: p.diferenciais!.map((x, j) => (j === i ? e.target.value : x)) })} />
            {edita && <Button size="icon" variant="subtle" icon="X" aria-label="Remover diferencial" onClick={() => set({ diferenciais: p.diferenciais!.filter((_, j) => j !== i) })} />}</div>
        ))}
        {edita && (p.diferenciais?.length ?? 0) < 12 && <Button size="sm" variant="soft" icon="Plus" onClick={() => set({ diferenciais: [...(p.diferenciais ?? []), ''] })}>Adicionar diferencial</Button>}
      </div></Card>

      <Card><CardHead title="Redes sociais e canais oficiais" sub="Links completos com https://" /><div className="p-5 space-y-2">
        {(p.redes ?? []).map((r, i) => (
          <div key={i} className="grid grid-cols-1 sm:grid-cols-[170px_1fr_160px_auto] gap-2">
            <Dropdown aria-label="Rede" className="input" disabled={!edita} value={r.rede} onChange={(e) => set({ redes: p.redes!.map((x, j) => (j === i ? { ...x, rede: e.target.value as RedeSocial['rede'] } : x)) })}>{REDES.map((x) => <option key={x} value={x}>{ROTULO_REDE[x]}</option>)}</Dropdown>
            <input aria-label="Link" className="input" disabled={!edita} maxLength={300} value={r.url} placeholder="https://" onChange={(e) => set({ redes: p.redes!.map((x, j) => (j === i ? { ...x, url: e.target.value } : x)) })} />
            <input aria-label="Rótulo (opcional)" className="input" disabled={!edita} maxLength={40} value={r.rotulo ?? ''} placeholder="Rótulo (opcional)" onChange={(e) => set({ redes: p.redes!.map((x, j) => (j === i ? { ...x, rotulo: e.target.value } : x)) })} />
            {edita && <Button size="icon" variant="subtle" icon="X" aria-label="Remover rede" onClick={() => set({ redes: p.redes!.filter((_, j) => j !== i) })} />}
          </div>
        ))}
        {edita && (p.redes?.length ?? 0) < 10 && <Button size="sm" variant="soft" icon="Plus" onClick={() => set({ redes: [...(p.redes ?? []), { rede: 'instagram', url: '' }] })}>Adicionar canal</Button>}
      </div></Card>

      {edita && <div className="flex justify-end"><Button icon="Check" disabled={salvando} onClick={() => void salvar()}>{salvando ? 'Salvando…' : 'Salvar e publicar'}</Button></div>}
    </div>
  )
}
