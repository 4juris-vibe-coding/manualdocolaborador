import { describe, expect, it } from 'vitest'
import { ehAreaDeTrabalho, ehAreaLarga, ehImersivo } from './layout'

describe('áreas de trabalho', () => {
  it('editor do Canva e assistente ocupam a altura da janela', () => {
    expect(ehAreaDeTrabalho('/canva/ap1')).toBe(true)
    expect(ehAreaDeTrabalho('/canva/ap1/')).toBe(true)
    expect(ehAreaDeTrabalho('/assistente')).toBe(true)
  })
  it('listas e demais páginas mantêm a rolagem comum', () => {
    expect(ehAreaDeTrabalho('/canva')).toBe(false)
    expect(ehAreaDeTrabalho('/recrutamento/vagas')).toBe(false)
    expect(ehAreaDeTrabalho('/organograma')).toBe(false)
  })
  it('só o editor usa a largura toda', () => {
    expect(ehAreaLarga('/canva/ap1')).toBe(true)
    expect(ehAreaLarga('/assistente')).toBe(false)
  })
  it('o editor do Canva abre em tela cheia; a galeria, não', () => {
    expect(ehImersivo('/canva/ap1')).toBe(true)
    expect(ehImersivo('/canva')).toBe(false)
    expect(ehImersivo('/assistente')).toBe(false)
  })
})
