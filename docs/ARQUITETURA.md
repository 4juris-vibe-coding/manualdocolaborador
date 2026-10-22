# 4JURIS Pessoas — Arquitetura

Plataforma única com três áreas: **área pessoal** (todos), **liderança** (coordenação das próprias áreas) e **RH & administração**. Ela foi construída sobre o app Vite + React deste repositório e incorpora as capacidades administrativas do antigo sistema de RH (`gest-o_rh-master/`, Next.js + Supabase), adaptadas ao modelo de **prestação de serviços PJ**.

## Stack

- Vite 7, React 18, TypeScript (strict), React Router 6, Tailwind 3, Zustand 4.
- Vitest para testes de regras e do adaptador de dados.
- Sem backend: os dados de demonstração ficam no `localStorage` do navegador e a interface mostra isso sempre ("Modo demonstração").

## Camadas

```
src/
  domain/        Regras de negócio puras (sem React, sem estado) — testáveis e reaproveitáveis no servidor
    permissions.ts   Matriz papel → capacidades (fonte única de autorização)
    visibilidade.ts  Quem vê o quê (documentos, períodos, eventos, comunicados) — LGPD
    gamificacao.ts   Ledger de pontos, idempotência, limites, níveis, conquistas, desafios
    disponibilidade.ts  Validação de períodos, sobreposição na área (sem saldo/aprovação)
    pesquisas.ts     Agregação anônima com supressão de grupos pequenos
    analytics.ts     Indicadores do RH (definição + fonte + período)
    jornada.ts, aniversarios.ts, lgpd.ts, validacao.ts, csv.ts, datas.ts
  data/
    config.ts        Variáveis de ambiente (VITE_DATA_SOURCE, VITE_API_URL…)
    contrato.ts      Interfaces de repositório que um backend deve implementar
  lib/
    types.ts         Modelo de domínio (entidades e relacionamentos)
    store.ts         ADAPTADOR DE DEMONSTRAÇÃO: estado + ações (comandos) + auditoria + notificações
    mock.ts          Dados fictícios (datas relativas a hoje; pontos derivados de ações)
  components/        UI kit, layout (sidebar com gaveta no mobile), timeline, formulários
  pages/             Telas da área pessoal, liderança, RH (pages/rh/*) e administração
docs/banco/schema.sql  Schema PostgreSQL proposto (com esboço de RLS)
```

### Como as páginas acessam dados

As páginas leem o estado via `useStore` e alteram dados **somente** por ações da store (`salvarPessoa`, `registrarPeriodo`, `reconhecer`…). Cada ação:

1. verifica a permissão (`can(papel, capacidade)`), em defesa em profundidade;
2. valida a entrada (regras de `src/domain`);
3. aplica a mudança, registra **auditoria** e gera **notificações**;
4. devolve `Resultado` (`{ ok: true, info?, avisos? }` ou `{ ok: false, erro }`), que a interface converte em feedback (`feedback()` em `components/toast.tsx`).

Essas ações correspondem 1:1 aos métodos de `src/data/contrato.ts`. Isso é o que torna o adaptador substituível.

## Autorização

> **Com banco (`VITE_DATA_SOURCE=api`)**, o servidor filtra o que cada pessoa recebe e valida cada gravação por registro (`api/_v2/guarda.ts`). O módulo financeiro é todo no servidor. Ver [`docs/FINANCEIRO.md`](FINANCEIRO.md), seções 3 e 9.

`src/domain/permissions.ts` define a matriz. Ela é usada:

- na navegação (itens com `cap`);
- na guarda de rotas (`AppLayout` + `itemDaRota`);
- dentro das ações da store.

A guarda de rotas e o menu servem só à experiência. **Segurança de verdade exige o servidor**: replicar a matriz em políticas RLS ou middleware. O esboço está no fim de `docs/banco/schema.sql`.

| Papel | Resumo |
|---|---|
| Colaborador(a) | Área pessoal |
| Liderança (`gestor`) | Painel das áreas que coordena. Não vê contratos, documentos, dados bancários nem observações privadas |
| RH | Pessoas, contratos, documentos, jornadas, eventos, pesquisas, gamificação, disponibilidade, financeiro |
| Diretoria | Indicadores agregados e comunicados, sem editar cadastros |
| Administração | Tudo do RH, mais papéis, auditoria, anonimização e dados de demonstração |

## Modelo PJ (decisões)

- **Disponibilidade / descanso combinado** substitui férias, folgas e recesso. Não há saldo, direito anual, aprovação hierárquica nem desconto. A antecedência é apenas sugerida; sobreposições geram aviso informativo. A liderança registra o "alinhamento de continuidade", que não é aprovação. A política é configurável pelo RH.
- Status da pessoa: `integracao | ativo | pendente | encerrado`. Saíram `ferias` e `recesso`.
- "Admissão/demissão" virou **início/encerramento de parceria**, com motivos próprios de contrato PJ.
- Valor e vigência ficam no **Contrato**; a NF mensal usa o valor do contrato vigente.
- Registros administrativos não têm tipos disciplinares (advertência e suspensão foram removidos).

## Integração do sistema `gest-o_rh-master/`

O sistema anterior depende de Supabase (sem credenciais neste ambiente) e usa outra stack (Next 16, React 19, Tailwind 4). Por isso, em vez de fundir as aplicações, **suas capacidades válidas foram portadas** para esta, com a mesma identidade visual e a mesma camada de dados. A pasta foi mantida intacta como referência.

| Módulo no sistema de RH | Na plataforma |
|---|---|
| Colaboradores (CRUD, ficha completa, importar/exportar CSV, desligar/reativar) | **RH → Pessoas & contratos**: ficha complementar (endereço, contatos, escolaridade, responsável direto, matrícula, fuso, camiseta), contratos, documentos, histórico de função e valor, encerramento/reativação |
| Departamentos + gestores, Unidades | **Áreas & unidades** (localização, telefone, ramal, e-mail, orçamento, lideranças) |
| Engenharia de cargo + Busca de perfil | **Engenharia de funções** (CBO, função superior/organograma, atividades, habilidades, faixa de valor, perfil DISC e 24 traços) e **Busca de perfil** (personalizar, por indicador, perfis prontos e aderência à função) — só com consentimento |
| Registros + tipos, Feedbacks (com análise e exportação) | **Registros** e **Feedbacks**, com análise, filtros, CSV e impressão; liderança registra feedback das próprias áreas |
| Checklists | **Integração & encerramento** com acompanhamento por pessoa |
| Saúde ocupacional | **Exigências & certificações** (validade, alertas, situação sem dados clínicos) |
| Competências + grupos (9 box) | **Competências** (grupos, pesos, funções, arquivamento) |
| Avaliação de desempenho (assistente de 4 etapas, 90°/180°/360°/customizada, relatórios) | **Ciclos de avaliação** completos: assistente, pares automáticos/manuais, **tela de resposta**, participação, relatório geral com 9 box e relatórios individuais (que no sistema original não existiam) |
| Avaliação de experiência + cron | **Início de parceria** (marcos 30/60/90, geração automática ao abrir, expiração, resposta com encaminhamento, relatório de participação) |
| Metas | **Metas** (RH) e **Objetivos** (liderança) |
| Análise de performance | **Análise de grupos** (agrupamento manual e comparação agregada) |
| Benefícios + beneficiários (+ múltiplos) + dependentes | **Benefícios**: cadastro, coparticipação, vínculo individual/em lote, dependentes; o portal mostra "Meus benefícios" |
| Métricas do colaborador, Rotatividade, Métricas de desligamento, Faturamentos | **Métricas de pessoas** (diversidade só agregada e com consentimento), **Rotatividade**, **Métricas de encerramento**, **Faturamento** |
| Cultura organizacional, Pesquisas | **Cultura** (editável, alimenta os valores de reconhecimento) e **Pesquisas** anônimas |
| Configurações (geral, usuários, tipos de registro) | **Configurações gerais**, **Usuários & acessos**, listas em Áreas & unidades |
| Campos CTPS/PIS/eSocial, banco de horas, ponto, insalubridade/periculosidade, turno | **Não incluídos** — controles próprios de vínculo empregatício (ver relatório) |

## Gamificação (decisões)

- O saldo é a **soma do histórico** (`lancamentos`). Não existe campo "pontos" editável.
- Cada (pessoa, ação, referência) pontua uma única vez. Há limites mensais configuráveis.
- **Removidos:** streak de "dias ativo" (métrica de presença digital), loja de recompensas (pontos ligados a valor), ranking geral e tarefas de trabalho com "prova foto/vídeo".
- **Adicionados:**
  - reconhecimento entre pares;
  - desafios opcionais com critério transparente;
  - iniciativas **voluntárias** confirmadas por outra pessoa;
  - destaques só para quem optou;
  - estorno justificado em vez de pontos negativos.
- A presença em evento pontua quando a organização registra a presença. A simples confirmação não pontua, para evitar exploração.

## Dados de demonstração

- `seed()` gera datas relativas ao dia atual e calcula pontos e conquistas pelo mesmo motor da aplicação.
- E-mails usam `@demo.4juris.com.br`, e as razões sociais trazem "(demo)".
- A chave de armazenamento é `4juris_pessoas_demo_v3`. Versões anteriores (modelo com férias e senha em texto) são descartadas.
- Em *Usuários & acessos → Dados da demonstração* é possível restaurar os dados.

## Apresentações

- Modelos são **dados** em `src/domain/apresentacoes.ts` (`MODELOS`): lista de slides, cada um com um layout e campos editáveis. O editor, o preview ao vivo, o modo apresentação (setas/Esc) e a exportação em PDF funcionam para qualquer modelo.
- **Para subir o modelo pré-pronto:** defina os slides com um dos layouts existentes (`capa`, `topicos`, `destaques`, `texto`, `citacao`, `encerramento`) ou crie um layout novo em `src/components/SlideView.tsx`, e acrescente o modelo ao array `MODELOS`. Slides são desenhados em 1280×720 e escalados por CSS, então preview, PDF e apresentação ficam idênticos.
- PDF: usa a impressão do navegador ("Salvar como PDF"), uma página 16:9 por slide. Exportar `.pptx` exigiria uma biblioteca de geração (ex.: PptxGenJS) — não incluída.
- Cada pessoa edita as próprias apresentações; as marcadas como compartilhadas são somente leitura para os outros (que podem duplicar).

## Caixa de sugestões (anônima)

- A sugestão **não guarda quem enviou**. Guarda `autorChave`, um hash opaco com sal (`src/domain/anonimato.ts`), usado só para a própria pessoa editar ou excluir (enquanto "aguardando"). Apoios usam uma chave diferente por sugestão, para não ligar apoios entre si nem ao autor.
- Nenhuma ação de enviar, editar, excluir ou apoiar grava auditoria ou notificação; datas são sem hora. A moderação (RH/Admin) é auditada, mas mostra só o título da sugestão.
- **Limite da demonstração:** o hash roda no navegador, onde todos os dados convivem — o anonimato é de interface e de modelo de dados, não criptográfico. Em produção, derive a chave **no servidor** com HMAC e um segredo fora do banco, de modo que nem a equipe técnica consiga ligar sugestão a pessoa, e limite a taxa de envio no servidor.

## Visual

- Tema claro/escuro (tokens em `src/index.css`; `midnight` é o fundo escuro fixo, `ink` é o texto que inverte).
- Menu com grupos recolhíveis, paleta de comandos (Ctrl+K), gráficos SVG (rosca, radial, colunas), tabelas ordenáveis, impressão/PDF.
- Ícones por nome vêm de um registro gerado: rode `node scripts/gerar-icones.mjs` ao usar um ícone novo.

## Testes

```
npm run typecheck   # tsc --noEmit
npm run test        # vitest (regras de domínio + adaptador de dados)
npm run build       # build de produção
npm run check       # os três
```

## Conectar um banco de dados (próxima etapa)

1. **Banco:** aplicar `docs/banco/schema.sql` numa base de desenvolvimento (Supabase/Postgres) e revisar tipos e índices. Migrar o que for útil de `gest-o_rh-master/supabase` (unidades, departamentos→`areas`, cargos→`funcoes`, colaboradores→`pessoas` sem colunas CLT).
2. **Autenticação:** provedor de identidade (Supabase Auth, SSO corporativo…). Ligar `pessoas.auth_user_id`. Remover o seletor de personas do login quando `VITE_DATA_SOURCE=api`.
3. **Autorização:** RLS por tabela seguindo `permissions.ts` e `visibilidade.ts`; *views* para campos públicos. Funções `security definer` para pontuar (motor de `gamificacao.ts`) e para responder pesquisas (resposta + participação em tabelas separadas).
4. **Adaptador:** criar `src/data/api/` implementando `FonteDeDados` (`contrato.ts`). Trocar o corpo das ações da store por chamadas à API, mantendo as assinaturas e o `Resultado`, e usar a store como cache. Adicionar estados de carregamento e erro de rede (hoje tudo é síncrono).
5. **Storage:** bucket privado para documentos, NFs e comprovantes, com URLs assinadas de curta duração. Hoje a demo guarda só metadados.
6. **Migração de dados:** importar pessoas pelo CSV (já validado linha a linha) ou por script. Não importar dados de demonstração.
7. **Variáveis:** `VITE_DATA_SOURCE=api` e `VITE_API_URL` no cliente. Segredos (`DATABASE_URL`, chaves de serviço) apenas no servidor, nunca com prefixo `VITE_`.
