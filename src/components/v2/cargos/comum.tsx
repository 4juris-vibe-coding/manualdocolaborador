/* Rótulos, tipos e pequenos componentes compartilhados pelas telas de cargos. */
import type { ReactNode } from 'react'
import { Callout } from '@/components/ui'
import type { MapaStatus } from '@/components/v2/StatusBadge'
import { SoComBanco } from '@/components/v2/estados'

export const STATUS_FICHA: MapaStatus = {
  sem_ficha: { rotulo: 'Sem ficha', tom: 'neutral' },
  rascunho: { rotulo: 'Rascunho', tom: 'warning' },
  em_aprovacao: { rotulo: 'Em aprovação', tom: 'brand' },
  vigente: { rotulo: 'Vigente', tom: 'success' },
  inativo: { rotulo: 'Inativo', tom: 'neutral' },
}

export const STATUS_FAIXA: MapaStatus = {
  rascunho: { rotulo: 'Rascunho', tom: 'warning' },
  em_aprovacao: { rotulo: 'Em aprovação', tom: 'brand' },
  vigente: { rotulo: 'Vigente', tom: 'success' },
  futura: { rotulo: 'Futura', tom: 'brand' },
  encerrada: { rotulo: 'Encerrada', tom: 'neutral' },
  rejeitada: { rotulo: 'Rejeitada', tom: 'danger' },
}

export interface Familia { id: string; nome: string; descricao?: string | null; paiId?: string | null; ativa: boolean; cargos: number }
export interface Nivel { id: string; trilhaId: string; ordem: number; nome: string; criteriosEvolucao?: string | null; requisitos?: string | null; cargos: number }
export interface Trilha { id: string; nome: string; descricao?: string | null; ordem: number; ativa: boolean; niveis: Nivel[] }
export interface Taxonomia { familias: Familia[]; trilhas: Trilha[] }

export interface ItemCatalogo {
  cargoId: string; nome: string; setorId: string; setorNome: string | null; nivelLegado: string | null; codigo: string | null
  familiaId: string | null; familia: string | null; trilhaId: string | null; trilha: string | null; nivel: string | null
  status: string; versaoVigente: number; revisaoPendente: boolean; vagas: number; pessoas: number
}

export const MOTIVO_DUP: Record<string, string> = { nome_igual: 'Mesmo nome', codigo_igual: 'Mesmo código', nome_parecido: 'Nome muito parecido' }

/** Envolve as telas: exige banco e exibe aviso de que comparações salariais são apenas apoio quando necessário. */
export function TelaCargos({ children }: { children: ReactNode }) {
  return <SoComBanco>{children}</SoComBanco>
}

export function AvisoFaixas({ texto }: { texto: string }) {
  return <Callout tone="neutral" icon="Info" className="mb-4">{texto}</Callout>
}
