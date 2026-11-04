/* ============================================================
   Agenda de entrevistas · regras PURAS (sem React/DB)
   - Convite .ics (RFC 5545: VCALENDAR/VEVENT, datas em UTC, texto
     escapado e linhas dobradas em 75 octetos).
   - Link de modelo do Google Agenda (abre o evento preenchido; não
     sincroniza nada).
   - O evento do CANDIDATO nunca leva parecer, resultado, notas internas
     nem o nome de quem avalia: só vaga, tipo, data e local/link.
   Usado pelo servidor (anexo do convite por e-mail) e pela interface.
   ============================================================ */

export interface EventoAgenda {
  /** Identificador estável do evento (o mesmo a cada geração: reagendar atualiza, não duplica). */
  uid: string
  titulo: string
  descricao?: string
  local?: string
  inicio: string | Date
  /** Sem fim: usa `duracaoPadraoMin` (60 min). */
  fim?: string | Date | null
  duracaoPadraoMin?: number
  /** Incrementado a cada reagendamento (SEQUENCE). */
  sequencia?: number
  cancelado?: boolean
}

const paraData = (v: string | Date) => (v instanceof Date ? v : new Date(v))

/** Data/hora em UTC no formato básico do iCalendar e do Google: AAAAMMDDTHHMMSSZ. */
export function dataUtc(v: string | Date): string {
  const d = paraData(v)
  if (Number.isNaN(d.getTime())) throw new Error('Data inválida para o convite.')
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '')
}

/** Fim efetivo do evento (fim informado ou início + duração padrão). */
export function fimDoEvento(e: Pick<EventoAgenda, 'inicio' | 'fim' | 'duracaoPadraoMin'>): Date {
  const ini = paraData(e.inicio)
  const fim = e.fim ? paraData(e.fim) : null
  if (fim && !Number.isNaN(fim.getTime()) && fim.getTime() > ini.getTime()) return fim
  return new Date(ini.getTime() + (e.duracaoPadraoMin ?? 60) * 60_000)
}

/** Escapa um valor TEXT (RFC 5545 §3.3.11): barra invertida, ponto e vírgula, vírgula e quebras de linha. */
export function escaparTexto(t: string): string {
  return t.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\r\n|\r|\n/g, '\\n')
}

const bytesUtf8 = (ch: string) => {
  const c = ch.codePointAt(0) ?? 0
  return c < 0x80 ? 1 : c < 0x800 ? 2 : c < 0x10000 ? 3 : 4
}

/**
 * Dobra uma linha de conteúdo em no máximo 75 octetos (RFC 5545 §3.1): as continuações começam com um espaço.
 * Nunca quebra um caractere UTF-8 no meio.
 */
export function dobrarLinha(linha: string): string {
  const partes: string[] = []
  let atual = '', tam = 0
  for (const ch of linha) {
    const b = bytesUtf8(ch)
    const limite = partes.length === 0 ? 75 : 74 // a continuação já tem 1 octeto do espaço inicial
    if (tam + b > limite) { partes.push(atual); atual = ''; tam = 0 }
    atual += ch; tam += b
  }
  partes.push(atual)
  return partes.join('\r\n ')
}

/** Arquivo .ics (VCALENDAR com um VEVENT), linhas terminadas em CRLF. `agora` vira o DTSTAMP. */
export function gerarIcs(e: EventoAgenda, agora: Date = new Date()): string {
  const linhas = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//4JURIS//Pessoas Recrutamento//PT-BR',
    'CALSCALE:GREGORIAN',
    `METHOD:${e.cancelado ? 'CANCEL' : 'PUBLISH'}`,
    'BEGIN:VEVENT',
    `UID:${e.uid.replace(/[\r\n]/g, '')}`,
    `DTSTAMP:${dataUtc(agora)}`,
    `DTSTART:${dataUtc(e.inicio)}`,
    `DTEND:${dataUtc(fimDoEvento(e))}`,
    `SEQUENCE:${Math.max(0, Math.floor(e.sequencia ?? 0))}`,
    `SUMMARY:${escaparTexto(e.titulo)}`,
    ...(e.descricao ? [`DESCRIPTION:${escaparTexto(e.descricao)}`] : []),
    ...(e.local ? [`LOCATION:${escaparTexto(e.local)}`] : []),
    ...(e.local && /^https:\/\//i.test(e.local.trim()) ? [`URL:${e.local.trim().replace(/[\r\n]/g, '')}`] : []),
    `STATUS:${e.cancelado ? 'CANCELLED' : 'CONFIRMED'}`,
    'TRANSP:OPAQUE',
    'END:VEVENT',
    'END:VCALENDAR',
  ]
  return linhas.map(dobrarLinha).join('\r\n') + '\r\n'
}

/** Link de modelo do Google Agenda (abre a tela de novo evento já preenchida). */
export function urlGoogleAgenda(e: EventoAgenda): string {
  const enc = encodeURIComponent
  const partes = [
    'action=TEMPLATE',
    `text=${enc(e.titulo)}`,
    `dates=${dataUtc(e.inicio)}/${dataUtc(fimDoEvento(e))}`,
    ...(e.descricao ? [`details=${enc(e.descricao)}`] : []),
    ...(e.local ? [`location=${enc(e.local)}`] : []),
  ]
  return `https://calendar.google.com/calendar/render?${partes.join('&')}`
}

/* ---------- evento a partir de uma entrevista ---------- */
export const ROTULO_TIPO_ENTREVISTA: Record<string, string> = { rh: 'com o RH', tecnica: 'técnica', gestor: 'com a liderança', final: 'final', outra: '' }
export const ROTULO_MODALIDADE_ENTREVISTA: Record<string, string> = { online: 'Online', presencial: 'Presencial', telefone: 'Por telefone' }

export interface EntrevistaAgenda {
  id: string; tipo: string; inicio: string | Date; fim?: string | Date | null; modalidade: string; localOuLink?: string | null
  status?: string; reagendamentos?: unknown[]
}
export interface ContextoAgenda {
  vagaTitulo: string; empresa?: string
  /** Só no evento INTERNO (equipe): nome do candidato e de quem entrevista. */
  candidatoNome?: string; entrevistadores?: string[]
}

/** UID estável por entrevista. */
export const uidEntrevista = (id: string) => `entrevista-${id}@pessoas.4juris`

/**
 * Monta o evento. `para = 'candidato'`: só dados que o candidato já conhece (vaga, tipo, data, modalidade e local/link).
 * `para = 'equipe'`: acrescenta o nome do candidato e dos entrevistadores. Parecer, resultado e notas nunca entram.
 */
export function eventoDaEntrevista(e: EntrevistaAgenda, ctx: ContextoAgenda, para: 'candidato' | 'equipe'): EventoAgenda {
  const empresa = ctx.empresa ?? '4JURIS'
  const tipo = ROTULO_TIPO_ENTREVISTA[e.tipo] ?? ''
  const modalidade = ROTULO_MODALIDADE_ENTREVISTA[e.modalidade] ?? e.modalidade
  const local = (e.localOuLink ?? '').trim()
  const titulo = para === 'candidato'
    ? `Entrevista${tipo ? ` ${tipo}` : ''} · ${ctx.vagaTitulo} · ${empresa}`
    : `Entrevista${tipo ? ` ${tipo}` : ''}: ${ctx.candidatoNome ?? 'candidato(a)'} · ${ctx.vagaTitulo}`
  const descricao = para === 'candidato'
    ? [`Processo seletivo: ${ctx.vagaTitulo}`, `Modalidade: ${modalidade}`, ...(local ? [`Local / link: ${local}`] : []), '', `Em caso de imprevisto, responda o e-mail do convite. Equipe ${empresa}`].join('\n')
    : [`Candidato(a): ${ctx.candidatoNome ?? '—'}`, `Vaga: ${ctx.vagaTitulo}`, `Modalidade: ${modalidade}`, ...(local ? [`Local / link: ${local}`] : []),
      ...(ctx.entrevistadores?.length ? [`Entrevistadores: ${ctx.entrevistadores.join(', ')}`] : [])].join('\n')
  return {
    uid: uidEntrevista(e.id), titulo, descricao, local: local || undefined, inicio: e.inicio, fim: e.fim ?? null,
    sequencia: Array.isArray(e.reagendamentos) ? e.reagendamentos.length : 0, cancelado: e.status === 'cancelada',
  }
}

/** Nome do arquivo do convite. */
export const nomeArquivoIcs = (e: Pick<EntrevistaAgenda, 'inicio'>) => `entrevista-${dataUtc(e.inicio).slice(0, 8)}.ics`

/* ---------- sincronização em duas vias (NÃO implementada) ---------- */
/**
 * Contrato para uma futura sincronização real com o Google Agenda (ou outro provedor).
 *
 * Hoje o sistema só GERA o convite (.ics e link de modelo do Google); nada é gravado na agenda de ninguém e
 * mudanças feitas na agenda não voltam para o sistema. Uma sincronização de verdade exige:
 *  1. que a empresa crie um cliente OAuth 2.0 no Google Cloud (tela de consentimento, domínio verificado,
 *     escopo `https://www.googleapis.com/auth/calendar.events`), com client_id/secret guardados no servidor;
 *  2. consentimento de cada entrevistador(a) e armazenamento seguro dos tokens de atualização;
 *  3. webhooks (`events.watch`) ou varredura periódica para trazer cancelamentos e alterações.
 * Nada disso existe ainda: não há OAuth, tokens nem chamadas à API do Google neste código.
 */
export interface SincronizadorAgenda {
  /** Identificador do provedor (ex.: 'google'). */
  readonly provedor: string
  /** Cria ou atualiza o evento na agenda do(a) organizador(a); devolve o id do evento no provedor. */
  publicar(evento: EventoAgenda, organizadorId: string): Promise<{ idExterno: string }>
  /** Cancela o evento no provedor. */
  cancelar(idExterno: string, organizadorId: string): Promise<void>
  /** Traz alterações feitas direto na agenda desde `desde` (ISO). */
  alteracoesDesde(desde: string, organizadorId: string): Promise<{ idExterno: string; inicio?: string; fim?: string; cancelado?: boolean }[]>
}
