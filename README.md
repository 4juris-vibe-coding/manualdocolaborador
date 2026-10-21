# 4JURIS Pessoas

Plataforma da comunidade 4JURIS para prestadores de serviço (PJ). Reúne:

- **Área pessoal:** início, perfil, disponibilidade, notas fiscais, reembolsos, comunicados, agenda, celebrações, reconhecimento, pesquisas, integração e conteúdos.
- **Liderança:** coordenação das áreas.
- **RH & administração:** indicadores, pessoas e contratos, integração e encerramento, documentos, gamificação, pesquisas, estrutura, acessos e auditoria.

> **Modo demonstração.** Ainda não há banco de dados nem autenticação real. Os dados são fictícios e ficam no `localStorage` do navegador. No login, escolha um perfil (colaborador, liderança, RH, diretoria ou administração) para ver o que cada papel acessa.

## Rodando

```bash
npm install
npm run dev        # http://localhost:4177
npm run check      # typecheck + testes + build
```

Para configurar variáveis, copie `.env.example` para `.env.local`.

## Documentação

- [`docs/ARQUITETURA.md`](docs/ARQUITETURA.md): camadas, permissões, decisões do modelo PJ e da gamificação, e passo a passo para conectar um banco.
- [`docs/banco/schema.sql`](docs/banco/schema.sql): schema PostgreSQL proposto, com esboço de RLS.

## Sobre `gest-o_rh-master/`

Sistema de RH anterior (Next.js + Supabase), mantido como referência. Suas funcionalidades válidas foram incorporadas a esta aplicação. O mapeamento do que foi integrado, adaptado ou descontinuado está em `docs/ARQUITETURA.md`.
