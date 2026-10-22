/* ============================================================
   4JURIS Pessoas · Modelos de apresentação
   ------------------------------------------------------------
   Um MODELO é só dado: uma lista de slides, cada um com um layout
   visual e os campos editáveis. O editor, o preview, o modo de
   apresentação e o PDF funcionam para qualquer modelo.

   COMO ADICIONAR O SEU MODELO PRONTO
   1. Escolha, para cada slide, um dos LAYOUTS abaixo (ou crie um novo
      em src/components/SlideView.tsx).
   2. Liste os campos editáveis (rótulo, tipo, valor padrão).
   3. Acrescente o modelo ao array MODELOS no final deste arquivo.
   ============================================================ */
import type { Apresentacao, SlideInstancia, TemaApresentacao } from '@/lib/types'

export type LayoutSlide = 'capa' | 'topicos' | 'destaques' | 'texto' | 'citacao' | 'encerramento'
export type TipoCampo = 'texto' | 'longo' | 'lista'

export interface CampoModelo {
  chave: string
  rotulo: string
  tipo: TipoCampo
  dica?: string
  padrao: string
  /** Limite de caracteres (por item, nas listas). */
  max?: number
}

export interface SlideModelo {
  id: string
  nome: string
  layout: LayoutSlide
  campos: CampoModelo[]
}

export interface ModeloApresentacao {
  id: string
  nome: string
  descricao: string
  /** Slides que já vêm no modelo, na ordem. */
  roteiro: string[]
  slides: SlideModelo[]
  temaPadrao: TemaApresentacao
}

export const CORES_TEMA = [
  { nome: 'Azul 4JURIS', cor: '#0032D2' }, { nome: 'Ciano', cor: '#0891b2' }, { nome: 'Verde', cor: '#0f9d6b' },
  { nome: 'Violeta', cor: '#7c3aed' }, { nome: 'Magenta', cor: '#db2777' }, { nome: 'Âmbar', cor: '#c98a12' },
]

const t = (chave: string, rotulo: string, padrao: string, extra: Partial<CampoModelo> = {}): CampoModelo => ({ chave, rotulo, tipo: 'texto', padrao, ...extra })
const l = (chave: string, rotulo: string, padrao: string, extra: Partial<CampoModelo> = {}): CampoModelo => ({ chave, rotulo, tipo: 'lista', padrao, dica: 'Um item por linha', ...extra })
const g = (chave: string, rotulo: string, padrao: string, extra: Partial<CampoModelo> = {}): CampoModelo => ({ chave, rotulo, tipo: 'longo', padrao, ...extra })

const capa: SlideModelo = { id: 'capa', nome: 'Capa', layout: 'capa', campos: [
  t('titulo', 'Título', 'Título da apresentação', { max: 80 }), t('subtitulo', 'Subtítulo', 'Uma frase que resume o assunto', { max: 120 }), t('rodape', 'Apresentado por · data', 'Nome da pessoa · mês/ano', { max: 80 }),
] }
const topicos: SlideModelo = { id: 'topicos', nome: 'Tópicos', layout: 'topicos', campos: [
  t('titulo', 'Título', 'Agenda', { max: 60 }), l('itens', 'Tópicos', 'Primeiro tópico\nSegundo tópico\nTerceiro tópico', { max: 90 }),
] }
const destaques: SlideModelo = { id: 'destaques', nome: 'Números em destaque', layout: 'destaques', campos: [
  t('titulo', 'Título', 'Números do período', { max: 60 }),
  t('v1', 'Número 1', '120'), t('r1', 'Descrição 1', 'o que esse número mede', { max: 50 }),
  t('v2', 'Número 2', '85%'), t('r2', 'Descrição 2', 'o que esse número mede', { max: 50 }),
  t('v3', 'Número 3', '4,8'), t('r3', 'Descrição 3', 'o que esse número mede', { max: 50 }),
  t('nota', 'Observação (opcional)', 'Fonte e período dos dados', { max: 120 }),
] }
const texto: SlideModelo = { id: 'texto', nome: 'Texto com destaque', layout: 'texto', campos: [
  t('titulo', 'Título', 'Título do assunto', { max: 60 }), g('corpo', 'Texto', 'Escreva aqui o conteúdo principal deste slide. Seja direto: poucas frases funcionam melhor em apresentações.', { max: 420 }),
  t('destaque', 'Destaque lateral', 'Ideia principal em uma frase', { max: 90 }),
] }
const citacao: SlideModelo = { id: 'citacao', nome: 'Citação', layout: 'citacao', campos: [
  g('citacao', 'Citação', 'Uma frase que inspira o time.', { max: 200 }), t('autor', 'Quem disse', 'Nome · cargo', { max: 60 }),
] }
const encerramento: SlideModelo = { id: 'encerramento', nome: 'Encerramento', layout: 'encerramento', campos: [
  t('titulo', 'Título', 'Obrigado!', { max: 40 }), t('mensagem', 'Mensagem', 'Dúvidas, ideias e sugestões são bem-vindas.', { max: 140 }), t('contato', 'Contato', 'rh@4juris.com.br', { max: 80 }),
] }

const institucional: ModeloApresentacao = {
  id: 'institucional', nome: '4JURIS · Institucional',
  descricao: 'Apresentação geral: capa, agenda, quem somos, números, citação e encerramento.',
  roteiro: ['capa', 'topicos', 'texto', 'destaques', 'citacao', 'encerramento'],
  slides: [capa, topicos, texto, destaques, citacao, encerramento],
  temaPadrao: { variante: 'escuro', cor: '#0032D2', mostrarLogo: true },
}
const resultados: ModeloApresentacao = {
  id: 'resultados', nome: 'Resultados do período',
  descricao: 'Relatório objetivo de área ou projeto: números, conquistas e próximos passos.',
  roteiro: ['capa', 'destaques', 'topicos', 'topicos', 'encerramento'],
  slides: [
    { ...capa, campos: capa.campos.map((c) => (c.chave === 'titulo' ? { ...c, padrao: 'Resultados do período' } : c)) },
    destaques,
    { ...topicos, id: 'topicos', nome: 'Tópicos' },
    texto, encerramento,
  ],
  temaPadrao: { variante: 'claro', cor: '#0f9d6b', mostrarLogo: true },
}

/** `modeloId` das apresentações feitas no Editor livre (HTML embutido), que não usam modelo de campos.
 *  Formato: "editor-livre" ou "editor-livre:<id do modelo pronto>" (ids em MODELOS_EDITOR_LIVRE). */
export const MODELO_EDITOR_LIVRE = 'editor-livre'
export const ehEditorLivre = (modeloId: string) => modeloId === MODELO_EDITOR_LIVRE || modeloId.startsWith(`${MODELO_EDITOR_LIVRE}:`)
export const modeloProntoDe = (modeloId: string) => (modeloId.split(':')[1] ?? '4jurisday')

/** Modelos prontos do Editor livre. Os slides de cada um ficam em public/4jurisday-apresentacao.html (TEMPLATES);
 *  mantenha os ids iguais nos dois lugares. */
export const MODELOS_EDITOR_LIVRE = [
  { id: 'avisos', nome: 'Aviso importante', descricao: 'Foto de fundo, mensagem e data/público.', icone: 'Megaphone' },
  { id: 'novo-colaborador', nome: 'Boas-vindas · novo colaborador', descricao: 'Foto, nome, cargo e mensagem de boas-vindas.', icone: 'UserPlus' },
  { id: 'novas-contratacoes', nome: 'Novas contratações', descricao: 'Abertura e grade de pessoas com foto.', icone: 'Users' },
  { id: 'aniversariantes', nome: 'Aniversariantes do mês', descricao: 'Fotos e datas em fundo claro.', icone: 'Cake' },
  { id: 'destaque-mes', nome: 'Destaque do mês', descricao: 'Homenagem a uma pessoa, com foto.', icone: 'Trophy' },
  { id: 'aniversario', nome: 'Feliz aniversário', descricao: 'Homenagem individual com nome, área e data.', icone: 'Cake' },
  { id: 'marco-parceria', nome: 'Marco de parceria', descricao: 'Anos de parceria com a 4JURIS.', icone: 'Handshake' },
  { id: 'evento', nome: 'Convite de evento', descricao: 'Foto de fundo com data, hora e local.', icone: 'CalendarDays' },
  { id: 'comunicado', nome: 'Comunicado com imagem', descricao: 'Imagem de um lado, texto do outro.', icone: 'FileText' },
  { id: 'galeria', nome: 'Galeria do evento', descricao: 'Até 4 fotos com legenda.', icone: 'Heart' },
  { id: '4jurisday', nome: '4JURIS Day completo', descricao: 'Roteiro completo do evento.', icone: 'Presentation' },
  { id: 'branco', nome: 'Em branco', descricao: 'Só uma capa para começar.', icone: 'Square' },
] as const

export const MODELOS: ModeloApresentacao[] = [institucional, resultados]
export const modeloPorId = (id: string) => MODELOS.find((m) => m.id === id) ?? MODELOS[0]

export function slideDoModelo(modelo: ModeloApresentacao, id: string): SlideModelo {
  return modelo.slides.find((s) => s.id === id) ?? modelo.slides[0]
}

export function valoresPadrao(sm: SlideModelo): Record<string, string> {
  return Object.fromEntries(sm.campos.map((c) => [c.chave, c.padrao]))
}

export function novoSlide(modelo: ModeloApresentacao, modeloSlideId: string, novoId: () => string): SlideInstancia {
  const sm = slideDoModelo(modelo, modeloSlideId)
  return { id: novoId(), modeloSlideId: sm.id, valores: valoresPadrao(sm) }
}

export function criarApresentacao(modelo: ModeloApresentacao, titulo: string, autorId: string, hoje: string, novoId: () => string): Apresentacao {
  const slides = modelo.roteiro.map((sid) => novoSlide(modelo, sid, novoId))
  // O título da capa acompanha o título da apresentação.
  if (slides[0]?.valores.titulo !== undefined) slides[0].valores.titulo = titulo
  return { id: novoId(), titulo, modeloId: modelo.id, tema: { ...modelo.temaPadrao }, slides, criadaPorId: autorId, compartilhada: false, criadaEm: hoje, atualizadaEm: hoje }
}

/** Itens de um campo "lista" (ignora linhas vazias). */
export const itensDe = (valor: string | undefined): string[] => (valor ?? '').split('\n').map((x) => x.trim()).filter(Boolean)

export interface ProblemaApresentacao { slideId: string; campo: string; mensagem: string }

/** Avisos leves (não bloqueiam): campos vazios e textos acima do limite. */
export function revisar(modelo: ModeloApresentacao, a: Apresentacao): ProblemaApresentacao[] {
  const out: ProblemaApresentacao[] = []
  for (const s of a.slides) {
    const sm = slideDoModelo(modelo, s.modeloSlideId)
    for (const c of sm.campos) {
      const v = (s.valores[c.chave] ?? '').trim()
      if (!v && !/opcional/i.test(c.rotulo)) out.push({ slideId: s.id, campo: c.rotulo, mensagem: 'campo vazio' })
      const itens = c.tipo === 'lista' ? itensDe(v) : [v]
      if (c.max && itens.some((i) => i.length > c.max!)) out.push({ slideId: s.id, campo: c.rotulo, mensagem: `texto acima de ${c.max} caracteres (pode não caber no slide)` })
      if (c.tipo === 'lista' && itensDe(v).length > 6) out.push({ slideId: s.id, campo: c.rotulo, mensagem: 'mais de 6 itens (o slide mostra os 6 primeiros)' })
    }
  }
  return out
}

export const PLACEHOLDER_VAZIO = '—'
