# Evolução do módulo de RH — 04/11/2026

Complementa `docs/ARQUITETURA.md` e `docs/V2.md`. Registra o que mudou, as regras e as premissas adotadas.

## 1. Problemas corrigidos (causa na origem)

| Problema | Causa | Correção |
|---|---|---|
| Data de encerramento errada na Integração | O cartão mostrava `iniciadoEm` (dia em que o checklist foi aberto) | Processo guarda `referencia` = data **efetiva**; a tela usa `referenciaDe()`. Migração 97 preenche os antigos |
| Pessoa aparecendo duas vezes na Integração | Encerrar → reativar → encerrar criava um **segundo** checklist de encerramento (confirmado no banco: 1 pessoa com 2 abertos) | Reativação cancela o checklist aberto; reencerrar reaproveita o existente; o **servidor** recusa (409) 2 processos abertos do mesmo tipo para a mesma pessoa; migração 97 cancela o duplicado (sem apagar) |
| Reativação apagava o histórico | `reativarParceria` fazia `encerramento: undefined` | Modelo de **vínculos** + **movimentações** (só acrescenta) |
| Iniciativa deduzida do texto do motivo | `metricas.ts` procurava "prestadora"/"contratante" no nome | Classificação estruturada (`IniciativaEncerramento`), escolhida pelo RH em cada encerramento; motivos sugerem um padrão |
| Recontratação pelo ATS reaproveitava cadastro encerrado sem reabrir | `cadastrarEEnviarAcesso` só procurava por e-mail | Abre **novo período** no mesmo cadastro |
| Mensagem de bloqueio seca; sessão aberta caía sem explicação | — | Mensagem cordial, sem motivo interno, no login e na sessão interrompida (`codigo: 'parceria_encerrada'`) |

## 2. Ciclo de vida (pessoa × vínculo)

- **Pessoa** = `Colaborador.id` (único). **Vínculo** = período `{inicio, fim?, motivoId, iniciativa, encerradoPorId, encerradoEm, origem}` em `Colaborador.vinculos`.
- Cadastros antigos não têm `vinculos`: `vinculosDe()` deriva de `dataEntrada` + `encerramento` (sem migração de dados).
- **Reativar** desfaz o encerramento do mesmo vínculo. **Novo período** abre outro vínculo (retorno). Em ambos o cadastro é o mesmo.
- `movimentacoes`: encerramento, reativação, novo vínculo, correção do encerramento e correção do início, com quem, quando, valores anteriores e justificativa.
- Servidor (`api/_v2/guarda.ts`): histórico só acrescenta (409); períodos sem sobreposição e coerentes com o status (400); só o RH altera situação e períodos.
- Editar o cadastro depois do encerramento nunca muda a data efetiva nem a situação.
- Encerramento com data futura é recusado. **Premissa:** registrar no dia efetivo, porque o bloqueio de acesso é imediato.

## 3. Indicadores (`src/domain/vinculos.ts`, tela Turnover & movimentação)

- A pessoa conta no quadro do dia `inicio` até a véspera de `fim`. Assim, para todo mês: **final = inicial + admissões − desligamentos** (coberto por teste).
- Headcount médio: `(inicial + final) ÷ 2`, o padrão. A tela também oferece a **média diária**, que é mais precisa. O critério escolhido vale para todos os meses e para o consolidado, que é a média dos médios mensais.
- Turnover geral: `((adm + desl) ÷ 2) ÷ HC médio × 100`.
- Turnover involuntário: `desligamentos com iniciativa 'empresa' ÷ HC médio × 100`. Desligamentos sem classificação ficam fora e aparecem num alerta.
- Saldo: `adm − desl`.
- Filtros por área, função, forma de contratação e unidade usam o cadastro **atual**. Não há histórico de transferência entre áreas.

## 4. Recrutamento

- Portal: conteúdo institucional editável em *Configurar recrutamento › Portal de carreiras* (`rec_config.portal`, validado em `src/domain/v2/portal.ts`, só links `https://`). Inclui topbar, "Você tem um código?", duas colunas e filtros de nível e de contratação. As vagas encerradas recentemente aparecem só como informação.
- Acompanhamento: o código vai por *state* e é removido da URL. A linha do tempo usa as etapas da vaga com **nome público** (`rec_vaga_etapas.nome_publico`, migração 99). Sem nome público, mostra um rótulo genérico por tipo. O nome interno nunca é exibido.
  - O "Nome para o candidato" é editado no editor de etapas da vaga e no editor de colunas do kanban (vazio = rótulo genérico).
- O código de acompanhamento tem 256 bits, guarda só o hash e tem limite por IP. Por isso não foi adicionada segunda verificação por e-mail.
- Questionários por etapa (fit cultural e DISC interno) e documentos por etapa: `db/v2/98-avaliacoes-etapa.sql` e `api/_v2/modulos/avaliacoesEtapa.ts`.
  - O DISC interno é rotulado como **sem validação psicométrica**. A interface `ProvedorDisc` fica pronta para um instrumento validado.
- Pipeline: visões Kanban e Lista, filtros por data, localização, pretensão (só com permissão) e avaliação.

## 5. Migrações (aditivas e idempotentes; aplicadas automaticamente pela função serverless ou por `npm run db:setup`)

- `97-ciclo-vida.sql`: cancela checklists duplicados em aberto (mantém o de maior progresso) e preenche `referencia`. **Altera dados de produção** no primeiro deploy, sem apagar nada.
- `98-avaliacoes-etapa.sql`: `rec_etapa_config`, `rec_questionarios`, `rec_questionario_respostas`, `rec_candidatura_documentos`.
- `99-portal-etapas-publicas.sql`: `rec_vaga_etapas.nome_publico`.

## 6. Atualização automática

Não há tempo real no servidor. As telas de Integração e de Turnover releem o estado a cada 45 s com a aba visível e ao voltar para a aba (`useAtualizacaoAutomatica`). Nunca releem com alterações locais pendentes.

## 7. Segunda rodada (04/11/2026)

### Ciclo de vida e indicadores
- **Histórico de área, função e gestor com data efetiva**
  - Usa a coleção `historicoFuncao`, que já existia. Ganhou os campos `setor*`, `gestor*`, `dataEfetiva` e `observacao`.
  - Ao mudar área, função ou gestor, o formulário pede a data efetiva e o motivo.
  - Os indicadores usam a área e a função que a pessoa tinha **na data**: a reconstrução fica em `organizacaoEm()`, em `domain/vinculos.ts`.
  - No servidor, o histórico só acrescenta (409 se alguém tentar alterar). Apagar só é permitido junto com a exclusão do cadastro, pela administração.
  - A diretoria lê o histórico sem valores de contrato.
- **Encerramento agendado**
  - Uma data futura grava `encerramentoAgendado`, e a parceria e o acesso continuam até lá.
  - No dia, o servidor aplica o encerramento com a mesma função da ação do RH (`aplicarEncerramento`). Ele é aplicado pela rotina diária, no login e na abertura do portal. Login e sessão já tratam o agendamento vencido como encerrado, mesmo antes de a rotina rodar.
  - O agendamento pode ser cancelado.
  - O modo demonstração aplica o agendamento ao entrar.
- **Painel de alertas** (`/rh/alertas`, `domain/alertasRH.ts`)
  - Cobre: aniversários de parceria, marcos de 30/60/90 dias, contratos (vencendo, vencidos ou vigentes de pessoa encerrada), documentos, exigências, checklists atrasados, encerramentos agendados, encerramentos sem classificação e cadastros pendentes.
  - A rotina diária transforma os alertas de atenção e críticos em notificações para RH e administração, uma vez por alerta.
  - A **classificação dos encerramentos** é feita ali mesmo, pelo RH.
- **Pesquisa de desligamento**
  - Rota `POST pesquisas/:id/convidar-pessoa`, só para pesquisas criadas a partir do modelo "desligamento".
  - Ao encerrar, o RH convida a pessoa. No agendamento, o convite sai no dia.
  - O link funciona sem login.
- **Retenção nos primeiros 30/60/90/180 dias**
  - Por área, calculada no cliente a partir dos vínculos.
  - Por recrutador e por vaga: `GET rh/retencao-contratacoes`. A contratação do ATS é ligada ao vínculo pelo e-mail.

### Rotina diária
- `GET /api/v2/rh/cron/diario`, agendado em `vercel.json` para 09:15 UTC. Exige `CRON_SECRET`.
- Faz três coisas: aplica os encerramentos agendados, notifica os alertas e roda a retenção LGPD (`processarRetencaoCandidatos`).
- O RH pode executar manualmente com `POST rh/rotinas/executar`.

### Recrutamento e LGPD (ver também `docs/V2.md`)
- Nome público da etapa no editor.
- E-mail automático ao entrar numa etapa, opcional por etapa (`rec_etapa_config.avisar_candidato`).
- Banco de talentos → vaga.
- Entrevista: botão "Adicionar ao Google Agenda" e convite `.ics`. A sincronização bidirecional exige credenciais OAuth da 4JURIS; a interface está pronta em `SincronizadorAgenda`.
- Funil de recrutamento no dashboard.
- Retenção LGPD de candidatos: anonimiza depois do prazo e apaga currículo e documentos. Simular e aplicar exigem `admin:privacidade`.
- Relatório de acessos a dados sensíveis (`/admin/acessos-sensiveis`, `admin:auditoria`).

### Migrações
- `100-recrutamento-automacoes.sql`.
- A ordem de aplicação passou a ser **numérica** em todos os lugares (script, setup e testes). Antes, `100-…` rodaria antes de `98-…`.

### Correção importante nos testes
O plugin de desenvolvimento do `vite.config.ts` carregava o `.env.local` também no vitest. Com isso, os testes enxergavam a chave real do Resend e o banco de produção, e e-mails de teste eram enviados de verdade para endereços fictícios. Eram essas as "3 falhas de ambiente".

Agora o `src/test/setup.ts` remove esses segredos e a suíte inteira passa.
