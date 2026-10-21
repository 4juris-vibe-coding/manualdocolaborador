import { useState } from 'react'
import { useStore } from '@/lib/store'
import { PageHeader, Card, CardHead, Avatar, Badge, Button, Field, EmptyState, Toggle, Callout } from '@/components/ui'
import { Modal } from '@/components/Modal'
import { feedback } from '@/components/toast'
import { cn, relTime, firstName } from '@/lib/utils'
import { hojeISO, parseDia } from '@/domain/datas'
import { aniversariosDoMes, marcosDoMes, rotuloDiaMes, type Celebracao } from '@/domain/aniversarios'

const MESES = Array.from({ length: 12 }, (_, i) => new Date(2000, i, 1).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''))

export default function Aniversarios() {
  const s = useStore()
  const me = s.realUser()
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

  const enviar = () => {
    if (!msg) return
    if (feedback(s.enviarParabens(msg.pessoa.id, ocasiao(msg), texto), 'Mensagem enviada! 🎉')) { setMsg(null); setTexto('') }
  }

  const Linha = ({ c }: { c: Celebracao }) => (
    <li className={cn('flex items-center gap-3 p-3 sm:p-4', ehHoje(c) && 'bg-gold-soft/60')}>
      <div className={cn('h-12 w-12 rounded-xl flex flex-col items-center justify-center shrink-0 leading-none', ehHoje(c) ? 'bg-gold text-white' : 'bg-winter text-ink')}>
        <span className="text-[16px] font-extrabold">{c.dia}</span>
        <span className="text-[9px] font-bold uppercase">{MESES[c.mes]}</span>
      </div>
      <Avatar nome={c.pessoa.nome} cor={c.pessoa.avatarCor} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="text-[13.5px] font-semibold text-ink truncate">{c.pessoa.nomeSocial || c.pessoa.nome}{c.pessoa.id === me.id && <span className="text-brand"> · você</span>}</div>
        <div className="text-[12px] text-muted truncate">
          {s.setorNome(c.pessoa.setorId)}{c.tipo === 'marco' && ` · ${c.anos} ${c.anos === 1 ? 'ano' : 'anos'} de parceria`}
          {qtdMensagens(c) > 0 && ` · ${qtdMensagens(c)} mensagem(ns)`}
        </div>
      </div>
      {ehHoje(c) && <Badge tone="gold">Hoje!</Badge>}
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

      <div className="grid lg:grid-cols-[1.3fr_1fr] gap-6">
        <div className="space-y-6 min-w-0">
          <Card>
            <CardHead title="🎂 Aniversários" sub={`${anivs.length} em ${new Date(2000, mes, 1).toLocaleDateString('pt-BR', { month: 'long' })} · somente dia e mês`} />
            {anivs.length === 0 ? <EmptyState icon="Cake" title="Nenhum aniversário compartilhado neste mês" desc="Só aparecem pessoas que optaram por mostrar o aniversário." /> : (
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
            <h3 className="text-[15px] font-bold text-ink mb-1">Sua privacidade</h3>
            <p className="text-[12.5px] text-muted mb-4">Você escolhe o que a comunidade vê. O ano de nascimento nunca é exibido.</p>
            <div className="space-y-3">
              <Toggle checked={me.privacidade.mostrarAniversario} onChange={(v) => feedback(s.atualizarPrivacidade({ mostrarAniversario: v }), v ? 'Seu aniversário aparecerá nas celebrações.' : 'Seu aniversário ficará oculto.')} label="Mostrar meu aniversário (dia e mês)" disabled={!me.nascimento} />
              {!me.nascimento && <p className="text-[11.5px] text-muted -mt-1.5 ml-12">Informe sua data de nascimento no perfil para ativar.</p>}
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
                      <Avatar nome={de?.nome ?? '?'} cor={de?.avatarCor} size="sm" />
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
