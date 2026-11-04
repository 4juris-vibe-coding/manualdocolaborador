/* ============================================================
   Entrevista → agenda pessoal: link do Google Agenda e convite .ics.
   Só GERA o evento (nada é sincronizado). O evento é o da equipe:
   candidato, vaga, data, local/link e entrevistadores — nunca parecer,
   resultado ou notas internas. Ver src/domain/v2/agendaEntrevista.ts.
   ============================================================ */
import { Button } from '@/components/ui'
import { eventoDaEntrevista, gerarIcs, nomeArquivoIcs, urlGoogleAgenda, type EntrevistaAgenda } from '@/domain/v2/agendaEntrevista'

export interface EntrevistaParaAgenda extends EntrevistaAgenda {
  candidatoNome?: string; vagaTitulo?: string; participantes?: { nome: string | null }[]
}

export function BotoesAgenda({ e, vagaTitulo, candidatoNome }: { e: EntrevistaParaAgenda; vagaTitulo?: string; candidatoNome?: string }) {
  if (e.status === 'cancelada') return null
  const evento = eventoDaEntrevista(e, {
    vagaTitulo: vagaTitulo ?? e.vagaTitulo ?? 'Processo seletivo', candidatoNome: candidatoNome ?? e.candidatoNome,
    entrevistadores: (e.participantes ?? []).map((p) => p.nome).filter((n): n is string => !!n),
  }, 'equipe')
  const baixar = () => {
    const url = URL.createObjectURL(new Blob([gerarIcs(evento)], { type: 'text/calendar;charset=utf-8' }))
    const a = document.createElement('a')
    a.href = url; a.download = nomeArquivoIcs(e)
    document.body.appendChild(a); a.click(); a.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }
  return (
    <>
      <a href={urlGoogleAgenda(evento)} target="_blank" rel="noopener noreferrer"><Button size="sm" variant="ghost" icon="CalendarPlus" type="button">Adicionar ao Google Agenda</Button></a>
      <Button size="sm" variant="ghost" icon="Download" onClick={baixar}>Baixar convite (.ics)</Button>
    </>
  )
}
