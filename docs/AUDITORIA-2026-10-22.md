# Auditoria de integração e integridade de dados — 22/10/2026

Escopo: código (`api/`, `src/`, `db/`) e banco de produção. O banco foi lido **somente em modo leitura**
(`begin transaction read only` + `rollback`); nenhum dado foi alterado. Este relatório usa IDs internos, sem nomes,
documentos ou valores.

## 1. Resumo executivo

- **Arquitetura real.** São duas camadas de dados:
  - **Legado:** coleções JSONB `app_<coleção>`, gravadas registro a registro por `PUT /api/estado`
    (`api/_v2/estadoLegado.ts` + `api/_v2/guarda.ts`). Lidas com filtro por papel (`estadoPara`).
  - **v2:** tabelas relacionais `rec_*`, `pq_*`, `cg_*`, `fin_*`, `org_*`, que referenciam os IDs do legado.
  - **Fonte oficial da organização:** `app_colaboradores`, `app_setores`, `app_cargos` e `app_unidades`.
  - **Fonte oficial de contratos e remuneração:** `fin_contratos`. A tabela `app_contratos` é um espelho mantido pelo
    servidor.
- **O que está bem integrado:**
  - organograma e hierarquia por ID;
  - vagas ligadas a cargo e área por ID;
  - anonimato das pesquisas;
  - pagamento único;
  - conflito de edição por registro.
- **Corrigido nesta auditoria:** 9 problemas (1 crítico de acesso, 3 altos, 5 médios), com 13 testes novos de
  regressão.
- **Maior lacuna de dados:** nenhuma das 33 pessoas tem contrato ou remuneração cadastrada, e 30 de 32 funções não
  têm faixa salarial. Isso depende de informação do RH ou financeiro e não foi preenchido por suposição.

## 2. Matriz de integrações

| Entidade | Origem (escrita) | Telas dependentes | Fonte oficial | Situação | Problema | Correção | Validação |
|---|---|---|---|---|---|---|---|
| Acesso de pessoa encerrada | `encerrarParceria` (store) | login, todas as telas | `app_colaboradores.status` | **Corrigido** | Login e `/api/estado` só olhavam `usuarios.ativo`. A pessoa encerrada continuava entrando com os privilégios do papel; só a API v2 barrava. | `api/[acao].ts`: login e sessão recusam `status='encerrado'`, a mesma regra de `montarUsuario` | `api/encerrados.test.ts` (4) ✅ |
| Função (cargo) | Funções (store) | Pessoas, ficha, organograma, vagas, Arquitetura de cargos, histórico | `app_cargos` | **Corrigido** | Remover só checava pessoas ativas. Ficavam órfãos: pessoas encerradas, `historicoFuncao`, `rec_vagas`, `cg_fichas`, `cg_faixas`, `cg_cargo_competencias` | `estadoLegado.ts` `conferirReferenciasEstrutura` (servidor) + mensagens na store | `api/integridade.test.ts` ✅ |
| Departamento | Estrutura (store) | Pessoas, funções, vagas, organograma | `app_setores` | **Corrigido** | `removerSetor` apagava em cascata as funções do setor, mesmo as que estavam em uso | Mesma checagem no servidor; a store recusa antes | `integridade.test.ts` ✅ |
| Liderança de área × encerramento | `encerrarParceria` | Avaliações, reembolsos, edição da área | `app_setores.gestorId/liderancaIds` | **Corrigido** | A pessoa encerrada continuava líder: virava avaliadora e travava `salvarSetor` | `encerrarParceria` tira a pessoa de `gestorId` e `liderancaIds` | typecheck/testes ✅ (sem teste dedicado: regra de cliente) |
| Reembolso | Área pessoal / financeiro | Reembolsos, Contas a pagar | `app_reembolsos` → `fin_contas` | **Corrigido** | (a) O financeiro criava pedido já aprovado ou pago, inclusive o próprio. (b) O valor podia mudar depois de aprovado, divergindo da conta a pagar | `guarda.ts`: todo pedido nasce pendente; depois de decidido, só a decisão muda | `integridade.test.ts` ✅ |
| Faixa salarial legada (`Cargo.faixaValor`) | Funções | Funções, Perfil | — | **Corrigido (exposição)** | "Visível para as pessoas desta função" chegava a toda a empresa | `guarda.ts`: só quem exerce a função, RH ou `cargos:ver_faixas` | `integridade.test.ts` ✅ |
| Comparativo salário × faixa | `cg_faixas` + `app_contratos` | Cargos › Faixas | `cg_faixas`, `fin_contratos` | **Corrigido (exposição)** | Cargo com 1 ocupante revelava "acima da faixa" a quem não vê contratos (`analista_rh`) | `cargos.ts`: grupos com menos de 5 ficam ocultos sem `pessoas:ver_contratos`; a tela `Faixas.tsx` mostra o aviso | `integridade.test.ts` ✅ |
| Contratação (vaga) | ATS | Vagas, painel | `rec_vagas.posicoes_preenchidas` | **Corrigido** | Corrida: duas contratações simultâneas passavam do número de posições | `atsLib.ts`: `for update of c, v` | suíte ATS ✅ |
| Aprovadores e avisos por função | `acl_funcoes` | Vagas, pesquisas, notificações | `acl_funcoes` + status | **Corrigido** | `idsComFuncao` incluía pessoas encerradas | `nucleo.ts` filtra as encerradas | suíte v2 ✅ |
| Faixa salarial: duas fontes | Funções (`faixaValor`) e Cargos v2 (`cg_faixas`) | Funções × Ficha do cargo × Vaga | **deveria ser `cg_faixas`** | **Pendente (decisão)** | Aprovar faixa v2 não altera a tela Funções; a vaga não valida o salário contra a faixa | Ver plano P2-1 | — |
| Área e gestor no contrato | `contratosBase.ts` copia `setor_id/gestor_id` | Escopo de leitura do valor e aceite de NF | `app_colaboradores` | **Pendente** | Cópia não ressincronizada: a liderança antiga continua vendo e aprovando | Ver P1-2 (arquivos do financeiro em edição por outra sessão) | — |
| Espelho de contrato | `espelharContrato` | Perfil, PessoaDetalhe, comparativo | `fin_contratos` | **Pendente** | `suspenso` vira `vigente`; valor de projeto ou hora vira `valorMensal` | P2-3 | — |
| Contratação → colaborador | Modal no cliente | Pessoas | — | **Pendente** | Setor, cargo, gestor e regime não vêm da vaga; sem `colaborador_id` na candidatura; deduplicação só por e-mail, reaproveitando cadastro encerrado | P2-2 | — |
| Histórico de função e valor | Cliente | Aba Histórico | — | **Pendente** | Em modo API, mudança de valor, área e gestor não gera histórico; RH pode editar ou apagar o histórico | P2-4 | — |
| Destino de pagamento | Perfil (dados bancários) | Contas a pagar | `app_colaboradores` / `fin_fornecedores` | **Pendente** | Lido ao vivo, sem retrato na autorização; trilha de auditoria gerada pelo cliente | P1-3 | — |
| Organograma / hierarquia | Ficha, editor de hierarquia | Organograma, analytics, liderança | `responsavelId`, `setorId` | Correto | — | — | auditoria de dados: 0 ciclos, 0 gestores inexistentes |
| Pesquisas (anonimato) | Central de pesquisas | Resultados, analytics, CSV | `pq_*` | Correto | (participação por área mistura área atual e área no momento da resposta: P4) | — | código revisado |
| Remuneração de vagas e ATS | Vagas/ATS | Listas, CSV, eventos, portal | `rec_*` | Correto | — | — | `vagas.ts` e `ats.ts` mascaram sem `vagas:ver_remuneracao` |
| Pagamentos | Contas | Kanban, painel | `fin_contas/fin_pagamentos` | Correto | — | — | `unique` + `for update` |

## 3. Pendências de dados (banco de produção, leitura de 22/10/2026)

| Módulo | Registro | Campo | Problema | Fonte necessária | Ação | Gravidade | Correção |
|---|---|---|---|---|---|---|---|
| Contratos/remuneração | as 33 pessoas ativas | contrato vigente / valor | **Ausente** (0 em `fin_contratos` e `app_contratos`) | Contratos assinados (financeiro/RH) | Cadastrar em Financeiro › Contratos | Crítico | Humana |
| Funções | 30 de 32 (ex.: `g6`…`g12`, `gs4se8robq86`…) | faixa salarial | **Ausente** (`faixaValor` vazio; `cg_faixas` = 0) | Política salarial da empresa | Definir em Cargos › Faixas (fonte única) | Alto | Humana |
| Funções | 30 de 32 | descrição/atividades | Ausente | Gestores das áreas | Preencher na ficha | Médio | Humana |
| Pessoas | `c906a2jh56qq` | função | Ausente | RH | Atribuir função | Alto | Humana |
| Pessoas | 1 pessoa | CPF | Ausente | A própria pessoa ou RH | Completar | Médio | Humana |
| Pessoas | 32 de 33 | cidade, telefone, razão social | Ausente | Cadastro | Completar (opcional para autônomos) | Baixo | Humana |
| Pessoas | 32 de 33 (`regime=autonomo`) | CNPJ | **Não se aplica** a autônomo | — | Nenhuma | — | — |
| Financeiro | 32 fornecedores (todos) | dados bancários | Ausentes no fornecedor; 1 PIX existe só no cadastro da pessoa; 1 razão social diverge do nome | Prestador | Unificar a fonte (P1-3) e completar | Alto | Humana |
| Financeiro | 1 pessoa | fornecedor | Pessoa sem fornecedor vinculado | Financeiro | Criar ao cadastrar o contrato | Médio | Automática (contrato-base) |
| Histórico | 30 de 33 pessoas | `historicoFuncao` | Função atual sem registro de origem (cadastro importado) | — | Aceitar como linha de base; daqui em diante, registro automático | Baixo | — |
| Acessos | `cgpb2vydatif` | `usuarios.papel` | Diverge do papel real (`rh` × `admin`) | — | Coluna **não é usada** para autorização (o papel vem de `app_colaboradores`); recomenda-se remover ou sincronizar | Baixo | Automática |
| Funções | 9 sem ocupante ativo (`g4`, `g6`, `g7`, `g9`–`g12`, `gxns54wvbuh9`, `gtlccdbuvudx`) | — | Sem uso (não é erro) | RH | Revisar se ainda existem | Baixo | Humana |
| Departamentos | `s4`, `s5` | — | Sem pessoas ativas | RH | Revisar | Baixo | Humana |
| Vagas | 2 (`rascunho`, `cancelada`) | `cargo_id` | Vaga sem função vinculada | Recrutamento | Vincular a função | Médio | Humana |

Verificado sem problemas:
- 0 e-mails, nomes, CPFs ou CNPJs duplicados;
- 0 funções ou áreas inexistentes;
- 0 ciclos hierárquicos;
- 0 gestores inexistentes ou encerrados;
- 0 funções com nome duplicado;
- 0 registros de demonstração;
- 0 logins sem pessoa ou com e-mail divergente.

**Indicadores de qualidade:**

| Indicador | Resultado |
|---|---|
| Pessoas com função | 32/33 (97%) |
| Pessoas com área | 33/33 |
| Pessoas com gestor ou topo definido | 33/33 |
| Pessoas com remuneração | 0/33 (0%) |
| Funções com faixa | 2/32 (6%) |
| Relacionamentos inválidos | 0 |
| Duplicados confirmados | 0 |
| Pendências que exigem informação humana | 11 |
| Problemas corrigidos e validados | 9 |

## 4. Alterações implementadas

| # | Problema e causa raiz | Arquivos | Teste |
|---|---|---|---|
| 1 | Pessoa encerrada mantinha o acesso: a regra de status existia só na API v2 | `api/[acao].ts` (login + checagem de sessão) | `api/encerrados.test.ts` |
| 2 | Remoção de função ou área deixava referências órfãs: a store checava só pessoas ativas, e o servidor não checava nada | `api/_v2/estadoLegado.ts` (`conferirReferenciasEstrutura`), `src/lib/store.ts` (`removeCargo`, `removerSetor`) | `api/integridade.test.ts` |
| 3 | Encerrado continuava líder de área | `src/lib/store.ts` (`encerrarParceria`) | suíte completa |
| 4 | Reembolso criado já aprovado ou editado depois de aprovado: o servidor liberava tudo para `financeiro:gerenciar` | `api/_v2/guarda.ts` | `integridade.test.ts` |
| 5 | Faixa legada exposta a toda a empresa | `api/_v2/guarda.ts` | `integridade.test.ts` |
| 6 | Comparativo de faixas sem grupo mínimo | `api/_v2/modulos/cargos.ts`, `src/pages/v2/cargos/Faixas.tsx` | `integridade.test.ts` |
| 7 | Corrida em `concluirContratacao` (leitura sem trava + escrita absoluta) | `api/_v2/atsLib.ts` | suíte ATS |
| 8 | `idsComFuncao` notificava e designava pessoas encerradas | `api/_v2/nucleo.ts` | suíte v2 |

Nenhuma migração de banco foi necessária. Nada foi gravado em produção.

**Resultado final:**
- `npm run typecheck`: ok
- `vitest`: 41 arquivos, 431 testes, todos aprovados
- `vite build`: ok (gerado em pasta temporária para não alterar o `dist/` versionado)

**Risco remanescente:**
- Antes, remover uma função usada só por pessoas encerradas era aceito; agora é recusado. É intencional: para "aposentar"
  uma função, use o status da ficha em Cargos (v2).
- O líder encerrado sai da área, mas os subordinados diretos continuam apontando para ele até o RH escolher o novo
  gestor. O organograma já mostra essa pendência.

## 5. Plano de ação prioritário

**P1 — Integridade e segurança**

1. **Ressincronizar ou derivar o escopo de `fin_contratos.setor_id/gestor_id`.**
   - Dependência: as edições em andamento em `api/_v2/modulos/financeiro/*`.
   - Pronto quando: mudar a área de uma pessoa transfere a visão do contrato e o aceite de NF para a nova liderança.
2. **Retratar o destino do pagamento na autorização e auditar no servidor a troca de dados bancários.**
   - Pronto quando: trocar o PIX depois da autorização não altera o destino da conta autorizada.
3. **Encerramento atômico (pessoa + contratos) numa rota do servidor.**
   - Corrigir também a corrida de reembolso: `atualizarReembolso` sem o advisory lock de `app_estado:reembolsos`.
4. **Normalizar número e série de NF e travar o contrato no envio,** para impedir duas notas da mesma competência.
   - Recalcular as divergências no aceite.
   - Rodar os alertas do painel fora da transação, para não engolir erros.

**P2 — Integrações críticas**

1. **Faixa salarial com fonte única em `cg_faixas`.**
   - A tela Funções passa a só ler.
   - A vaga sugere e valida o salário contra a faixa vigente do `cargo_id`.
   - Decisão de negócio: o que fazer com as 2 faixas legadas existentes.
2. **Contratação pelo servidor.**
   - Pré-cadastro com setor, cargo, unidade, gestor e regime da vaga.
   - `rec_candidaturas.colaborador_id`.
   - Reativação explícita de cadastro encerrado.
3. **Espelho de contrato fiel.**
   - `suspenso` como está; `valorMensal` só para `mensal_fixo`.
   - O comparativo deve ler `fin_contratos`.
4. **Histórico de função gerado no servidor e só de acréscimo.**
   - Incluir área e gestor; unificar com `fin_aditivos`.
5. **Recarregar o estado legado (`recarregarEstado`) depois das mutações financeiras.**
   - O Dashboard deve ler `financeiro/eu` para o lembrete de NF.

**P3 — Completude de dados:** os itens da seção 3 marcados como "Humana".

**P4 — Regras de negócio**

- Predicado único de "pessoa ativa": hoje `analytics.ts` usa `ativoEm` e a v2 usa `status !== 'encerrado'`.
- Participação de pesquisa por área no momento do convite.
- Aprovador "gestor" restrito à área da vaga.
- Validar o ciclo e a janela de datas nas respostas de avaliação.
- Importação de pessoas: não atribuir função de outra área e não anunciar promoção que não foi aplicada.
- Alinhar o V2.md e a matriz quanto ao recrutador ver remuneração.

**P5 — Robustez**

- Mensagem de sucesso só depois da confirmação do servidor nas telas legadas.
- Uma recusa no lote de 600 ms não deve descartar edições não relacionadas.
- Erros `23505` devolvidos como 409 em vez de 500.
- `alertas/processar` exigir permissão de escrita.

## 6. Limitações

- **Não houve teste de interface no navegador.** A propagação entre telas foi validada pela API, com o mesmo
  despachante e o mesmo schema (PGlite), e pela leitura do código. Telas que leem a store legada só refletem mudanças
  feitas por outra pessoa depois de recarregar. Esse é o comportamento previsto pela arquitetura (sem tempo real).
- **Integrações externas não foram exercitadas** (e-mail Resend, cron da Vercel), para não disparar mensagens reais.
- **Arquivos do módulo financeiro não foram alterados:** estavam sendo editados por outra sessão durante a auditoria.
