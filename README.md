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

## Banco de dados (Supabase) e login

- `VITE_DATA_SOURCE=api` liga o modo com banco: login por e-mail e senha (cookie HttpOnly assinado) e tudo o que a interface altera é gravado no PostgreSQL. `demo` mantém os dados fictícios no navegador.
- Configure em `.env.local` (e nas variáveis do deploy): `DATABASE_URL` (senha com `@` vira `%40`) e `SESSION_SECRET` (≥ 32 caracteres). Veja `.env.example`.
- `npm run db:setup` cria as tabelas (`db/schema.sql`), grava a estrutura padrão uma única vez e garante o usuário admin `social@4jurismarketing.com.br` (a senha é gerada e mostrada uma vez). Para trocar a senha: `ADMIN_SENHA='nova-senha-forte' npm run db:setup -- --senha`.
- As funções do servidor ficam em `api/` (Vercel) e rodam no `npm run dev` pelo plugin do `vite.config.ts`.

## Gestão de prestadores PJ (financeiro)

Fornecedores, contratos (aditivos, renovação, encerramento comercial), documentos com arquivo, notas fiscais de serviço (conferência → aceite), contas a pagar (retenções revisáveis → autorização → registro manual do pagamento → conciliação), painel com fórmulas e alertas. Regras, permissões, migração e limites em [`docs/FINANCEIRO.md`](docs/FINANCEIRO.md). Não há integração bancária nem fiscal: pagamentos são registros manuais com comprovante.

Variáveis novas: `CRON_SECRET` (alertas diários pelo agendador da Vercel) e `ANON_SECRET` (caixa de sugestões anônima). Funções adicionais novas: *Analista financeiro* e *Autorização de pagamentos*.

## Módulos v2 (recrutamento, pesquisas, cargos, organograma, analytics)

Veja `docs/V2.md`. Para ativar no banco: `npm run db:setup` (aplica `db/v2/*.sql`, aditivo e idempotente). Depois, em **Administração > Funções adicionais**, conceda recrutador / analista de RH / responsável por pesquisas. E-mails reais exigem `RESEND_API_KEY`; sem ela as mensagens ficam como "não configurado".
