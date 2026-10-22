import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Avatar, Badge, Button, Field, EmptyState, Toggle, Callout, Icon } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn, relTime, firstName } from '@/lib/utils'
import { hojeISO, parseDia } from '@/domain/datas'
import { GOSTOS, aniversariosDoMes, marcosDoMes, rotuloDiaMes, type Celebracao } from '@/domain/aniversarios'

const MESES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''))
const MES_LONGO = (m: number) => new Date(2000, m, 1).toLocaleDateString('pt-BR', { month: 'long' })
const dataLonga = (dia: number, mes: number) => `${dia} de ${MES_LONGO(mes)}`


export default function Aniversarios() {
  const s = useStore()
  const navigate = useNavigate()
  const me = s.realUser()
  // RH e administração criam as artes no 4juris Canva.
  const podeArte = s.pode('pessoas:gerenciar')
  const hoje = hojeISO()
  const dHoje = parseDia(hoje)
  const ano = dHoje.getFullYear()
  const [mes, setMes] = useState(dHoje.getMonth())
  const [msg, setMsg] = useState<Celebracao | null>(null)
  const [texto, setTexto] = useState('')

  const anivs = aniversariosDoMes(s.colaboradores, mes)
  const marcos = marcosDoMes(s.colaboradores, mes, ano)
  const ocasiao = (c: Celebracao) => `${c.tipo === 'aniversario' ? 'aniversario' : 'marco'}-${ano}`
  const jaEnviei = (c: Celebracao) => s.parabens.some((p) => p.deId === me.id && p.paraId === c.pessoa.id && p.ocasiao === ocasiao(c))
  const qtdMensagens = (c: Celebracao) => s.parabens.filter((p) => p.paraId === c.pessoa.id && p.ocasiao === ocasiao(c)).length
  const recebidas = s.parabens.filter((p) => p.paraId === me.id).sort((a, b) => b.criadoEm.localeCompare(a.criadoEm))
  const ehHoje = (c: Celebracao) => mes === dHoje.getMonth() && c.dia === dHoje.getDate()
  const passou = (c: Celebracao) => mes < dHoje.getMonth() || (mes === dHoje.getMonth() && c.dia < dHoje.getDate())

  // Cria a arte no Canva já preenchida (nome, área, data) e abre o editor.
  const criarArte = (c: Celebracao) => {
    const nome = c.pessoa.nomeSocial || c.pessoa.nome
    const aniv = c.tipo === 'aniversario'
    const r = s.criarApresentacao(`editor-livre:${aniv ? 'aniversario' : 'marco-parceria'}`, `${aniv ? 'Aniversário' : 'Marco de parceria'} · ${nome}`)
    if (!feedback(r, 'Arte criada no 4juris Canva.') || !r.ok) return
    const cargo = [s.cargoNome(c.pessoa.cargoId), s.setorNome(c.pessoa.setorId)].filter((x) => x && x !== '—').join(' · ')
    const bolo = c.pessoa.preferencias?.boloFavorito
    navigate(`/canva/${r.id}`, { state: { preencher: { pessoa: {
      nome, cargo,
      data: aniv ? dataLonga(c.dia, c.mes) : `${c.anos} ${c.anos === 1 ? 'ano' : 'anos'} de 4JURIS`,
      ...(aniv ? { kicker: 'Feliz aniversário! 🎂', frase: `Hoje o dia é seu, ${firstName(nome)}! Que este novo ciclo venha cheio de conquistas.${bolo ? ` Já separamos o bolo de ${bolo.toLowerCase()} 😉` : ''} Parabéns de todo o time 4JURIS.` } : {}),
    } } } })
  }
  const criarArteDoMes = () => {
    const r = s.criarApresentacao('editor-livre:aniversariantes', `Aniversariantes de ${MES_LONGO(mes)}`)
    if (!feedback(r, 'Arte do mês criada no 4juris Canva.') || !r.ok) return
    navigate(`/canva/${r.id}`, { state: { preencher: {
      titulo: `Aniversariantes de ${MES_LONGO(mes)}`,
      pessoas: anivs.map((c) => ({ nome: c.pessoa.nomeSocial || c.pessoa.nome, info: `${String(c.dia).padStart(2, '0')}/${String(c.mes + 1).padStart(2, '0')}` })),
    } } })
  }

  const enviar = () => {
    if (!msg) return
    if (feedback(s.enviarParabens(msg.pessoa.id, ocasiao(msg), texto), 'Mensagem enviada! 🎉')) { setMsg(null); setTexto('') }
  }

  const Linha = ({ c }: { c: Celebracao }) => (
    <li className={cn('flex items-center gap-3 p-3 sm:p-4 flex-wrap sm:flex-nowrap', ehHoje(c) && 'bg-gold-soft/60')}>
      <div className={cn('h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none', ehHoje(c) ? 'bg-gold text-white' : 'bg-winter text-ink')}>
        <span className="text-[16px] font-extrabold">{c.dia}</span>
        <span className="text-[9px] font-bold uppercase">{MESES[c.mes]}</span>
      </div>
      <Avatar pessoaId={c.pessoa.id} nome={c.pessoa.nome} cor={c.pessoa.avatarCor} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-ink truncate">{c.pessoa.nomeSocial || c.pessoa.nome}{c.pessoa.id === me.id && <span className="text-brand"> · você</span>}</div>
        <div className="text-[12px] text-muted truncate">
          {s.setorNome(c.pessoa.setorId)}{c.tipo === 'marco' && ` · ${c.anos} ${c.anos === 1 ? 'ano' : 'anos'} de parceria`}
          {qtdMensagens(c) > 0 && ` · ${qtdMensagens(c)} mensagem(ns)`}
        </div>
        {c.tipo === 'aniversario' && GOSTOS.some((g) => c.pessoa.preferencias?.[g.chave]) && (
          <div className="flex flex-wrap gap-1 mt-1.5">
            {GOSTOS.filter((g) => c.pessoa.preferencias?.[g.chave]).slice(0, 3).map((g) => (
              <span key={g.chave} title={g.rotulo} className="inline-flex items-center gap-1 rounded-full bg-surface-2 border border-line px-2 py-0.5 text-[11px] text-ink-2 max-w-[200px] truncate">
                <span aria-hidden>{g.emoji}</span><span className="sr-only">{g.rotulo}:</span>{c.pessoa.preferencias![g.chave]}
              </span>
            ))}
          </div>
        )}
      </div>
      {ehHoje(c) && <Badge tone="gold">Hoje!</Badge>}
      {podeArte && (
        <Button size="sm" variant="ghost" icon="Palette" onClick={() => criarArte(c)} title="Criar uma arte no 4juris Canva já preenchida com esta celebração">
          <span className="hidden sm:inline">Criar arte</span><span className="sm:hidden sr-only">Criar arte</span>
        </Button>
      )}
      {c.pessoa.id !== me.id && !passou(c) && (
        jaEnviei(c)
          ? <Badge tone="success" dot>Enviada</Badge>
          : <Button size="sm" variant="soft" icon="PartyPopper" onClick={() => { setMsg(c); setTexto(c.tipo === 'aniversario' ? `Feliz aniversário, ${firstName(c.pessoa.nome)}! 🎉` : `Parabéns pelos ${c.anos} anos de parceria, ${firstName(c.pessoa.nome)}!`) }}>Parabenizar</Button>
      )}
    </li>
  )

  return (
    <>
      <PageHeader title="Celebrações" subtitle="Aniversários e marcos de parceria da comunidade." />

      <div className="flex gap-1.5 overflow-x-auto pb-1 mb-5 -mx-4 px-4 sm:mx-0 sm:px-0" role="group" aria-label="Selecionar mês">
        {MESES.map((m, i) => (
          <button key={m} type="button" aria-pressed={mes === i} onClick={() => setMes(i)} className={cn('chip capitalize shrink-0', mes === i && 'chip-active', i === dHoje.getMonth() && mes !== i && 'border-brand text-brand')}>{m}</button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="🎂 Aniversários" sub={`${anivs.length} em ${MES_LONGO(mes)} · somente dia e mês`}
              action={podeArte && anivs.length > 0 ? <Button size="sm" variant="soft" icon="Sparkles" onClick={criarArteDoMes} title="Arte com todos os aniversariantes do mês, no 4juris Canva">Arte do mês</Button> : undefined} />
            {anivs.length === 0 ? <EmptyState icon="Cake" title="Nenhum aniversário neste mês" desc="Aparecem todas as pessoas ativas com data de nascimento no cadastro." /> : (
              <ul className="divide-y divide-line">{anivs.map((c) => <Linha key={c.pessoa.id} c={c} />)}</ul>
            )}
          </Card>
          <Card>
            <CardHead title="🤝 Marcos de parceria" sub="Aniversários do início da parceria com a 4JURIS" />
            {marcos.length === 0 ? <EmptyState icon="Handshake" title="Nenhum marco neste mês" /> : (
              <ul className="divide-y divide-line">{marcos.map((c) => <Linha key={c.pessoa.id + 'm'} c={c} />)}</ul>
            )}
          </Card>
        </div>

        <div className="space-y-6 min-w-0">
          <Card className="p-5">
            <h3 className="text-[15px] font-bold text-ink mb-1">Seus gostos</h3>
            <p className="text-[12.5px] text-muted mb-4">Conte do que você gosta para o time acertar no seu dia. Aparece junto do seu aniversário (só dia e mês, nunca o ano).</p>
            {GOSTOS.some((g) => me.preferencias?.[g.chave]) ? (
              <ul className="grid grid-cols-2 gap-2 mb-4">
                {GOSTOS.filter((g) => me.preferencias?.[g.chave]).map((g) => (
                  <li key={g.chave} className="rounded-xl bg-surface-2 border border-line px-3 py-2 min-w-0">
                    <div className="text-[11px] text-muted">{g.emoji} {g.rotulo}</div>
                    <div className="text-[13px] font-semibold text-ink truncate">{me.preferencias![g.chave]}</div>
                  </li>
                ))}
              </ul>
            ) : <p className="text-[12.5px] text-ink-2 mb-4">Você ainda não contou seus gostos.</p>}
            {!me.nascimento && <Callout tone="warning" icon="Cake" className="mb-4 text-[12.5px]">Informe sua data de nascimento no perfil para aparecer nos aniversários.</Callout>}
            <div className="flex items-center gap-3 flex-wrap">
              <Link to="/perfil?editar=gostos" className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-brand hover:underline"><Icon name="Pencil" className="h-3.5 w-3.5" />{GOSTOS.some((g) => me.preferencias?.[g.chave]) ? 'Editar meus gostos' : 'Contar meus gostos'}</Link>
            </div>
            <div className="mt-4 pt-4 border-t border-line">
              <Toggle checked={me.privacidade.mostrarMarcos} onChange={(v) => feedback(s.atualizarPrivacidade({ mostrarMarcos: v }), 'Preferência salva.')} label="Mostrar meus marcos de parceria" />
            </div>
          </Card>

          <Card>
            <CardHead title="Mensagens que você recebeu" sub="Visíveis apenas para você" />
            {recebidas.length === 0 ? <p className="text-[13px] text-muted p-5">Quando alguém te parabenizar, a mensagem aparece aqui.</p> : (
              <ul className="divide-y divide-line">
                {recebidas.slice(0, 8).map((p) => {
                  const de = s.pessoa(p.deId)
                  return (
                    <li key={p.id} className="flex gap-3 p-4">
                      <Avatar pessoaId={de?.id} nome={de?.nome ?? '?'} cor={de?.avatarCor} size="sm" />
                      <div className="min-w-0">
                        <div className="text-[12.5px] text-muted"><b className="text-ink">{de?.nome ?? 'Alguém'}</b> · {relTime(p.criadoEm)}</div>
                        <p className="text-[13.5px] text-ink-2 mt-0.5">{p.mensagem}</p>
                      </div>
                    </li>
                  )
                })}
              </ul>
            )}
          </Card>
          <Callout tone="neutral" icon="Info">Marcos de parceria celebram a trajetória conjunta e não representam tempo de serviço ou direitos trabalhistas.</Callout>
        </div>
      </div>

      <Modal open={!!msg} onClose={() => setMsg(null)} title={msg ? `Mensagem para ${firstName(msg.pessoa.nome)}` : ''}
        subtitle={msg ? (msg.tipo === 'aniversario' ? `Aniversário em ${rotuloDiaMes(msg.dia, msg.mes)}` : `${msg.anos} ano(s) de parceria`) : ''}
        footer={<><Button variant="ghost" onClick={() => setMsg(null)}>Cancelar</Button><Button icon="Send" onClick={enviar}>Enviar</Button></>}>
        <Field label="Mensagem" hint={`Só a pessoa homenageada vê o texto. ${texto.length}/280`} htmlFor="pb-msg">
          <textarea id="pb-msg" className="input !h-auto py-2.5" rows={3} maxLength={280} value={texto} onChange={(e) => setTexto(e.target.value)} />
        </Field>
      </Modal>
    </>
  )
}
