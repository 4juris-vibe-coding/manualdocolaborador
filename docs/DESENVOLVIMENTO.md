# Ciclo de Desenvolvimento e Avaliação de Desempenho

Complementa `docs/V2.md`. Acompanhamento inicial (30, 60 e 90 dias), AVD formal semestral, feedback da equipe sobre a liderança, devolutiva e PDI.

| Camada | Arquivo |
|---|---|
| Regras puras (cronograma, liderança, escala, notas, status) | `src/domain/v2/desenvolvimento.ts` |
| Banco (aditivo e idempotente) | `db/v2/101-desenvolvimento.sql` |
| API, rotina automática e controle de acesso | `api/_v2/modulos/desenvolvimento.ts` |
| Telas | `src/pages/v2/desenvolvimento/*`, `src/components/v2/desenvolvimento/*` |
| Testes | `src/domain/v2/desenvolvimento.test.ts`, `api/_v2/desenvolvimento.test.ts` |

O módulo só funciona com o banco (`VITE_DATA_SOURCE=api`). No modo demonstração, o "Início de parceria" antigo continua disponível.

## 1. Cronograma automático

- A **data de admissão** é o início do período de parceria (vínculo) em aberto: `Colaborador.vinculos`, ou `dataEntrada` em cadastros antigos.
- Marcos: acompanhamentos aos **30, 60 e 90 dias**. **AVD** aos **6 meses** e depois a cada 6 meses, sem fim (12, 18, 24…). O mês é somado mantendo o dia; quando o dia não existe, vale o último dia do mês.
- O ciclo **abre** alguns dias antes da data (antecedência configurável). Cada participante recebe uma notificação com o prazo.
- **Sem duplicidade:** a chave única no banco é `(pessoa, vínculo, marco)`. A rotina pode rodar várias vezes.
- **Implantação:** a data em que o módulo começou a valer fica em `dsv_config.inicioVigencia`. Marcos anteriores a ela, com a folga do prazo, **não são gerados retroativamente**. Para quem já está na base, o próximo marco semestral abre normalmente.
- Nunca abrem duas AVDs ao mesmo tempo. Se a rotina ficar parada, só a mais recente é aberta.
- **Quando roda:** na rotina diária (`rh/cron/diario`, 09:15 UTC, junto com as demais rotinas do RH), ao abrir o painel do RH e, só para a própria pessoa, a equipe dela e a liderança dela, ao abrir "Meu desenvolvimento" ou "Desenvolvimento da equipe". O RH também pode acionar "Rodar rotina agora".

### Mudanças no cadastro

| Situação | Tratamento |
|---|---|
| Data de admissão corrigida | Ciclo aberto **sem nenhuma resposta**: é removido e recriado na data certa (a mudança fica na auditoria). Ciclo **com respostas**: é mantido e a nova base é registrada. Ciclos concluídos não mudam. |
| Novo período de parceria (retorno) | Os ciclos abertos do período anterior são cancelados. O cronograma recomeça pelo novo início. |
| Encerramento da parceria | Os ciclos abertos são cancelados (motivo "Parceria encerrada"). As respostas enviadas ficam no histórico. Com encerramento agendado, os marcos a partir da data agendada não abrem. |
| Troca de liderança | Formulários da liderança **ainda não enviados** passam à nova liderança, que também assume as próximas etapas (devolutiva e PDI). O que já foi enviado continua ligado a quem respondeu. |
| Membro sai da equipe de uma liderança | O feedback pendente dele sobre essa liderança é dispensado. Não conta como resposta nem como avaliação negativa. |
| Mudança de função ou área | O ciclo guarda área e função **da abertura** (retrato). A jornada mostra as mudanças a partir de `historicoFuncao`. |
| Afastamento | O RH registra o afastamento na **jornada da pessoa** (tipo, início e retorno previsto, sem motivo médico). Enquanto durar, a rotina **suspende** os ciclos abertos, não abre marcos novos e não manda lembretes à pessoa. No retorno, os ciclos **voltam sozinhos** à etapa em que estavam, com o prazo estendido pelos dias de pausa (mínimo de 5 dias para responder), e a pessoa e a liderança são avisadas. O RH também pode suspender/retomar à mão ou **dispensar** um formulário específico. |
| Sem liderança no cadastro | O ciclo fica "Sem liderança definida" e o RH é avisado. O RH **designa** quem conduz, e a rotina passa a respeitar a designação. |

## 2. Fluxos

**Acompanhamento (30/60/90):**
1. Percepção do(a) colaborador(a) e percepção da liderança.
2. Registro do acompanhamento pela liderança: pontos positivos, dificuldades, orientações e ações combinadas com responsável e prazo.
3. Ao registrar, o acompanhamento é concluído.

A escala é de **percepção do momento** ("Com dificuldade" … "Muito bem"), sem classificação de desempenho e sem justificativa obrigatória.

**AVD (membro):** autoavaliação + avaliação da liderança direta → devolutiva → PDI (com ao menos uma ação) → encerramento formal pelo RH.

**AVD (liderança):**
- Autoavaliação com **critérios de liderança**.
- Avaliação pelo superior, quando houver.
- Feedback da equipe direta. Participa quem está na equipe há pelo menos N dias (padrão 60, configurável).
- Depois disso: **consolidação** pelo RH → devolutiva → PDI → encerramento.

Ninguém fica de fora por ser liderança. Uma liderança com superior segue também o fluxo dele.

Status exibidos:
- Aguardando colaborador(a) / autoavaliação / avaliação da liderança / feedback da equipe.
- Sem liderança definida.
- Em consolidação.
- Aguardando registro do acompanhamento / devolutiva / PDI / encerramento pelo RH.
- Concluída, Cancelada, Suspensa.
- **Em atraso**: aparece como selo adicional quando o prazo da etapa atual venceu.

Um ciclo **não é concluído** com etapa obrigatória pendente. O servidor recusa:
- a devolutiva antes de terminar a coleta;
- o PDI sem nenhuma ação;
- o encerramento sem devolutiva e PDI registrados.

A coleta fecha quando:
- os formulários obrigatórios foram enviados (ou dispensados pelo RH);
- o feedback da equipe terminou, ou o prazo dele acabou. Nesse caso, os não respondidos ficam como **expirados**: não responder não é avaliação negativa.

## 3. Escala, critérios e pesos

- Escala da AVD de 1 a 5 (Abaixo do esperado, Em desenvolvimento, Dentro do esperado, Acima do esperado, Destaque) + **N/A**. A descrição de cada nível aparece junto da escolha.
- Notas **1, 2 e 5** exigem exemplo ou evidência (configurável).
- Formulários distintos para cada caso:
  - membros (autoavaliação e liderança avalia membro);
  - lideranças (autoavaliação, superior avalia liderança e equipe avalia liderança);
  - acompanhamentos.
- Critérios, dimensões, **pesos**, perguntas abertas, rótulos da escala e prazos são editados pelo RH em *Ciclo de desenvolvimento › Configuração*. Os pesos não ficam fixos no código.
- Cada edição de formulário cria uma **nova versão** (`dsv_modelos`). Formulários já abertos guardam o retrato da versão que receberam.
- A média ponderada (1–5) é exibida como **indicador de apoio**. Não existe nota final combinada, e nenhuma regra gera promoção, desligamento ou decisão salarial.

## 4. Quem vê o quê (decidido no servidor)

| Informação | Quem acessa |
|---|---|
| Formulário (rascunho e envio) | Só quem responde. Respostas enviadas são **imutáveis**: ninguém altera, nem RH nem liderança |
| Ciclo | RH e diretoria (`dsv:gerenciar`), a pessoa avaliada e a liderança responsável. Para qualquer outra pessoa, a API responde 404 (não revela que o ciclo existe) |
| Afastamentos | Só `dsv:gerenciar`, na jornada da pessoa. Ninguém registra o próprio |
| Autoavaliação / percepção do(a) colaborador(a) | A pessoa, o RH e a liderança, esta **só depois de enviar a própria avaliação** (evita ancoragem) |
| Avaliação feita pela liderança | A liderança e o RH. A pessoa avaliada vê **depois da devolutiva** (configurável) |
| Feedback da equipe sobre a liderança | Ver seção 5 |
| Ações do PDI | Liderança e RH editam. A pessoa atualiza o andamento e o resultado das ações sob sua responsabilidade (não cancela) |
| Painel, listas, exportação, configuração | `dsv:gerenciar`: RH, administração, diretoria ou a função adicional **Gestão de desenvolvimento** |

Capacidades novas: `dsv:gerenciar` e `dsv:confidencial` (RH, administração e diretoria). A diretoria tem o mesmo acesso do RH no módulo, inclusive o feedback confidencial da equipe sobre lideranças (cada leitura fica registrada). A função adicional `gestor_desenvolvimento` dá as duas a quem tem outro papel, como autorização expressa. Ela é concedida em *Administração › Funções adicionais*.

**Imparcialidade (regras do servidor, valem para RH, administração e diretoria):**
- Ninguém administra o **próprio ciclo**: no próprio ciclo e na própria jornada, quem tem acesso de gestão vê e faz só o que qualquer pessoa avaliada vê e faz (não cancela, não suspende, não designa, não vê a avaliação da liderança antes da devolutiva). Outra pessoa do RH, da administração ou da diretoria age.
- Quem **conduz a devolutiva de uma liderança** (normalmente o superior dela) não lê os comentários confidenciais da equipe sobre ela, mesmo tendo `dsv:confidencial`. Vê, como a própria liderança, só médias e síntese depois de liberadas. A consolidação fica com outra pessoa.

## 5. Feedback da equipe sobre a liderança (confidencial)

- Antes de responder, a pessoa vê **como as respostas são usadas**. O texto não promete anonimato absoluto: em equipe pequena, um comentário pode identificar quem escreveu.
- A resposta vai para `dsv_respostas_equipe`. Essa tabela **não tem respondente, convite nem hora** (só a data). O formulário guarda apenas "enviado" (com data) e nunca o conteúdo.
- Abaixo do **mínimo de respostas** (padrão 3, configurável de 2 a 20), nada é exibido a ninguém além da contagem, e não é possível liberar resultados.
- **RH e diretoria (`dsv:confidencial`):** vê médias, comentários e exemplos, sem identificação e em ordem embaralhada. **Cada acesso fica registrado** (`feedback_equipe_visualizado`) e aparece em *Acessos a dados sensíveis*.
- O RH escreve uma **síntese construtiva** e a **libera**. A partir daí, a liderança avaliada (e quem conduz a devolutiva dela) vê **só médias por critério + síntese**, nunca comentários ou respostas individuais.
- A exportação CSV do RH não inclui o feedback da equipe.

## 6. Notificações

Usam a infraestrutura existente (`ntf_notificacoes`, com chave que impede duplicidade). Eventos notificados:
- ciclo iniciado (a cada participante e ao RH);
- prazo próximo (X dias antes, configurável) e formulário em atraso (respondente e RH);
- devolutiva, consolidação, PDI e encerramento pendentes ou atrasados (para quem conduz a etapa);
- devolutiva registrada e síntese liberada (para a pessoa avaliada);
- ação de PDI com prazo em até 7 dias ou atrasada (responsável e, no atraso, a liderança);
- revisão do PDI: lembrete antes da data combinada e aviso se ela passar sem revisão registrada (pessoa e liderança; só o PDI mais recente);
- ciclo retomado depois de um afastamento.

**Quem recebe o quê.** Os avisos operacionais vão para RH, administração e quem tem a função *Gestão de desenvolvimento*. A **diretoria** recebe um **resumo semanal** (ciclos em andamento, em atraso, aguardando o RH, suspensos, concluídos na semana e ações de PDI atrasadas), um por semana, na primeira execução completa da rotina. Dá para desligar em *Configuração*. Pessoas afastadas não recebem lembretes.

**E-mail.** Os avisos a quem participa também saem por e-mail (Resend, a mesma infraestrutura do recrutamento e das pesquisas): formulário aberto, prazo próximo, atraso, hora da devolutiva, revisão do PDI, retomada e o resumo da diretoria. O RH acompanha pelo portal (não recebe e-mail por ciclo). O e-mail só sai quando a notificação é nova, depois de gravada a rotina, com limite de 150 por execução (o excedente fica só no portal). Sem `RESEND_API_KEY`, ou com a opção desligada em *Configuração*, nada é enviado.

Os alertas antigos de "marco de 30/60/90 dias" deixaram de virar notificação no modo com banco, para não duplicar com os do módulo.

## 7. Banco (`db/v2/101-desenvolvimento.sql` e `102-desenvolvimento-afastamentos.sql`)

| Tabela | Conteúdo |
|---|---|
| `dsv_config` | Prazos, escala, mínimo de respostas, vigência |
| `dsv_modelos` | Versões dos formulários editados pelo RH (sem linha, vale o padrão do código) |
| `dsv_ciclos` | Um por pessoa × vínculo × marco: etapa, prazo, liderança responsável, retrato de área e função |
| `dsv_formularios` | Um por participante: retrato do modelo, status, rascunho, respostas, nota de apoio |
| `dsv_respostas_equipe` | Feedback da equipe sem respondente |
| `dsv_sinteses` | Síntese do RH e data de liberação |
| `dsv_devolutivas` | Devolutiva / registro do acompanhamento e percepção da pessoa |
| `dsv_pdis` | Metas, treinamentos, indicadores, data de revisão |
| `dsv_acoes` | Ações (PDI e acompanhamento) com responsável, prazo, indicador, andamento e resultado |
| `dsv_afastamentos` | Afastamentos: pessoa, tipo (descanso, licença, afastamento, outro), início, último dia, observação curta |
| `dsv_ciclos.afastamento_id`, `suspenso_em` | Suspensão automática por afastamento e a data, para estender o prazo no retorno |
| `dsv_pdis.revisoes` | Revisões do PDI: data, quem registrou e o que foi visto |

Também amplia a restrição `acl_funcoes_funcao_check` para aceitar `gestor_desenvolvimento`. Tudo é aditivo: nenhuma tabela existente perde dados. O histórico de ações fica em `aud_eventos` (entidade `dsv_ciclo`).

## 8. Indicadores, calibração e apoio à devolutiva

- **Andamento por área** (*Visão histórica*): ciclos no período, concluídos (%), em aberto, em atraso e dias, em média, da data prevista até o encerramento.
- **Calibração**: média das avaliações da liderança por **quem avaliou** e por **área**, comparada com a média geral e com a autoavaliação, mais a proporção de notas ≥ 4 e ≤ 2. Alerta quando um grupo com 3 ou mais avaliações fica 0,7 ponto ou mais acima ou abaixo da média geral. Serve para alinhar critérios entre lideranças, não para corrigir notas.
- **Autoavaliação × liderança** (tela do ciclo, a partir da devolutiva): os critérios lado a lado, com as maiores diferenças primeiro. Diferenças de 2 pontos ou mais aparecem como "conversar".
- **Revisão do PDI**: a liderança ou o RH registram cada revisão (o que foi visto e a próxima data). Sem próxima data, os lembretes param.

## 9. Depende de decisão ou configuração do RH

- Revisar os **critérios, perguntas e pesos** padrão, que seguem o briefing e são editáveis.
- Definir os **prazos** e o **mínimo de respostas** do feedback da equipe.
- Decidir se a pessoa avaliada vê a avaliação da liderança após a devolutiva (ligado por padrão).
- Conceder a função **Gestão de desenvolvimento** a quem mais deva administrar os ciclos ou ler o feedback confidencial.
- Conferir no cadastro o **responsável direto** de cada pessoa. É dele que vem a liderança de cada ciclo.
- Configurar `CRON_SECRET` na Vercel para a rotina diária. Sem ele, os ciclos abrem quando o RH, a pessoa ou a liderança acessam as telas.
- Conferir `RESEND_API_KEY` na Vercel para os e-mails, e decidir se ficam ligados (*Configuração*).
- Registrar os afastamentos na jornada de cada pessoa.

## 10. Limitações conhecidas

- O tempo na equipe para avaliar a liderança usa o último registro de mudança de gestor no histórico. Sem esse registro, usa o início da parceria.
- Afastamentos ficam no módulo de desenvolvimento, não no cadastro geral da pessoa. Marcos que venceriam durante o afastamento podem não ser abertos depois, se passarem da folga de prazo. Nesse caso o próximo marco abre normalmente.
- Se quem conduz o ciclo (a liderança) se afastar, os ciclos da equipe dele não param sozinhos: o RH designa outra pessoa para conduzir.
- A separação entre respondente e resposta impede a ligação pela aplicação e pelo banco de dados. Um administrador de banco com acesso físico às páginas da tabela ainda poderia tentar correlacionar pela ordem de gravação. O mesmo limite vale para a Central de pesquisas.
