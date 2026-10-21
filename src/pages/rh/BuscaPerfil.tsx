import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { useStore } from '@/lib/store'
import type { PerfilDisc } from '@/lib/types'
import { PageHeader, Card, CardHead, Tabs, Avatar, Badge, Callout, Select, EmptyState, Progress, Field } from '@/components/ui'
import { SliderBipolar } from '@/components/inputs'
import { BarrasDisc } from '@/components/charts'
import { cn } from '@/lib/utils'
import { CATEGORIAS_DISC, TRACOS, DISC_NEUTRO, aderenciaDisc, aderenciaIndicador, mediaDisc, compatibilidadeFuncao, ranquear, comPerfilConsentido, type CategoriaDisc } from '@/domain/perfil'

export default function BuscaPerfil() {
  const s = useStore()
  const [modo, setModo] = useState('personalizar')
  const [alvo, setAlvo] = useState<PerfilDisc>({ ...DISC_NEUTRO, executor: 70 })
  const [traco, setTraco] = useState<string>(TRACOS[0].chave)
  const [faixa, setFaixa] = useState({ min: 40, max: 70 })
  const [grupo, setGrupo] = useState<CategoriaDisc>('executor')
  const [pronto, setPronto] = useState<'grupo' | 'empresa'>('grupo')
  const [funcao, setFuncao] = useState(s.cargos.find((c) => c.perfilIdeal)?.id ?? '')
  const consentidos = comPerfilConsentido(s.colaboradores)
  const media = mediaDisc(s.colaboradores)
  const fn = s.cargos.find((c) => c.id === funcao)

  const resultado = useMemo(() => {
    if (modo === 'personalizar') return ranquear(s.colaboradores, (p) => aderenciaDisc(alvo, p.perfil!.disc))
    if (modo === 'indicador') return ranquear(s.colaboradores, (p) => aderenciaIndicador(p.perfil!.tracos[traco] ?? 50, faixa.min, faixa.max))
    if (modo === 'prontos') return pronto === 'grupo' ? ranquear(s.colaboradores, (p) => Math.round(p.perfil!.disc[grupo])) : ranquear(s.colaboradores, (p) => aderenciaDisc(media, p.perfil!.disc))
    return fn?.perfilIdeal ? ranquear(s.colaboradores, (p) => compatibilidadeFuncao(fn.perfilIdeal!, p.perfil!)) : []
  }, [modo, alvo, traco, faixa, grupo, pronto, media, fn, s.colaboradores])

  const t = TRACOS.find((x) => x.chave === traco)!

  return (
    <>
      <PageHeader title="Busca de perfil" subtitle="Encontre perfis comportamentais aderentes a um alvo — apenas entre pessoas que consentiram com o registro do perfil." />
      <Callout tone="warning" icon="ShieldAlert" className="mb-5">
        {consentidos.length} de {s.colaboradores.filter((c) => c.status !== 'encerrado').length} pessoas têm perfil com consentimento. A busca é apoio para formar times e conversas — <b>não</b> use como filtro automático de contratação, renovação ou encerramento.
      </Callout>
      <Tabs tabs={[{ key: 'personalizar', label: 'Personalizar (DISC)' }, { key: 'indicador', label: 'Por indicador' }, { key: 'prontos', label: 'Perfis prontos' }, { key: 'funcao', label: 'Aderência à função' }]} active={modo} onChange={setModo} />
      <div className="grid lg:grid-cols-[340px_1fr] gap-6 [&>*]:min-w-0">
        <Card className="p-5 self-start">
          {modo === 'personalizar' && <>
            <h3 className="text-[13px] font-bold text-ink mb-2">Perfil alvo</h3>
            {CATEGORIAS_DISC.map((d) => <SliderBipolar key={d.chave} esquerda={`${d.label}: ${alvo[d.chave]}`} valor={alvo[d.chave]} cor={d.cor} onChange={(v) => setAlvo({ ...alvo, [d.chave]: v })} />)}
            <p className="text-[11.5px] text-muted mt-2">Aderência = 100 − média das diferenças entre o alvo e o perfil.</p>
          </>}
          {modo === 'indicador' && <>
            <Field label="Indicador (traço)" htmlFor="bp-t"><select id="bp-t" className="input" value={traco} onChange={(e) => setTraco(e.target.value)}>{TRACOS.map((x) => <option key={x.chave} value={x.chave}>{x.esquerda} ↔ {x.direita}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Mínimo aceito" htmlFor="bp-mi"><input id="bp-mi" type="number" min={0} max={100} className="input" value={faixa.min} onChange={(e) => setFaixa({ ...faixa, min: Math.min(Number(e.target.value), faixa.max) })} /></Field>
              <Field label="Máximo aceito" htmlFor="bp-ma"><input id="bp-ma" type="number" min={0} max={100} className="input" value={faixa.max} onChange={(e) => setFaixa({ ...faixa, max: Math.max(Number(e.target.value), faixa.min) })} /></Field>
            </div>
            <div className="relative h-3 rounded-full bg-winter mt-1"><div className="absolute h-3 rounded-full bg-brand/60" style={{ left: `${faixa.min}%`, width: `${faixa.max - faixa.min}%` }} /></div>
            <div className="flex justify-between text-[11px] text-muted mt-1"><span>{t.esquerda}</span><span>{t.direita}</span></div>
          </>}
          {modo === 'prontos' && <>
            <div className="flex gap-2 mb-4">{(['grupo', 'empresa'] as const).map((k) => <button key={k} type="button" aria-pressed={pronto === k} onClick={() => setPronto(k)} className={cn('chip', pronto === k && 'chip-active')}>{k === 'grupo' ? 'Por grupo DISC' : 'Média da empresa'}</button>)}</div>
            {pronto === 'grupo' ? (
              <div className="grid grid-cols-2 gap-2">{CATEGORIAS_DISC.map((d) => <button key={d.chave} type="button" aria-pressed={grupo === d.chave} onClick={() => setGrupo(d.chave)} className={cn('rounded-xl border p-3 text-left', grupo === d.chave ? 'border-brand bg-brand-50' : 'border-line')}><span className="h-2.5 w-2.5 rounded-full inline-block mr-1.5" style={{ background: d.cor }} /><b className="text-[13px]">{d.label}</b></button>)}</div>
            ) : (<><h3 className="text-[13px] font-bold text-ink mb-2">Perfil médio da empresa</h3><BarrasDisc valores={CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: media[d.chave], cor: d.cor }))} /></>)}
          </>}
          {modo === 'funcao' && <>
            <Field label="Função" htmlFor="bp-f"><Select id="bp-f" label="Função" value={funcao} onChange={setFuncao}>{s.cargos.filter((c) => c.perfilIdeal).map((c) => <option key={c.id} value={c.id}>{c.nome}</option>)}</Select></Field>
            {fn?.perfilIdeal ? <><h3 className="text-[12px] font-bold uppercase text-muted mb-2">Perfil ideal</h3><BarrasDisc valores={CATEGORIAS_DISC.map((d) => ({ rotulo: d.label, valor: fn.perfilIdeal!.disc[d.chave], cor: d.cor }))} /><p className="text-[11.5px] text-muted mt-3">DISC (60%) + 24 traços (40%).</p></> : <p className="text-[13px] text-muted">Defina o perfil ideal em Engenharia de funções.</p>}
          </>}
        </Card>
        <Card>
          <CardHead title="Resultado" sub={`${resultado.length} pessoa(s) · ordenadas por aderência`} />
          {resultado.length === 0 ? <EmptyState icon="ScanSearch" title="Sem perfis para comparar" /> : (
            <ol className="divide-y divide-line">
              {resultado.map(({ pessoa: p, aderencia }, i) => (
                <li key={p.id} className="flex items-center gap-3 px-5 py-3">
                  <span className="w-6 text-[13px] font-bold text-muted">{i + 1}</span>
                  <Avatar nome={p.nome} cor={p.avatarCor} size="sm" />
                  <div className="flex-1 min-w-0"><Link to={`/rh/pessoas/${p.id}`} className="text-[13.5px] font-semibold text-ink hover:text-brand">{p.nome}</Link><div className="text-[11.5px] text-muted">{s.cargoNome(p.cargoId)} · {s.setorNome(p.setorId)}</div></div>
                  <div className="w-36 hidden sm:block"><Progress value={aderencia} color={aderencia >= 75 ? '#0f9d6b' : aderencia >= 55 ? '#c98a12' : undefined} /></div>
                  <Badge tone={aderencia >= 75 ? 'success' : aderencia >= 55 ? 'gold' : 'neutral'} className="tabular-nums">{aderencia}{modo === 'prontos' && pronto === 'grupo' ? '' : '%'}</Badge>
                </li>
              ))}
            </ol>
          )}
        </Card>
      </div>
    </>
  )
}
