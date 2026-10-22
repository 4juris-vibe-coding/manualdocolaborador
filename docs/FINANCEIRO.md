# Gestão de prestadores PJ (financeiro) e segurança da sincronização

Este documento descreve o módulo de **fornecedores, contratos, documentos, notas fiscais, contas a pagar, retenções e pagamentos** (`api/_v2/modulos/financeiro/`, `db/v2/60-financeiro.sql`, telas em `src/pages/v2/financeiro/`) e a mudança de segurança do `/api/estado`.

## 1. O que NÃO existe (e não é simulado)

- **Integração bancária:** o sistema nunca transfere dinheiro. "Paga" significa que alguém autorizado **registrou** um pagamento feito fora do sistema, com data, forma, referência e/ou comprovante.
- **Integração fiscal (prefeitura, Emissor Nacional, SEFAZ, Receita):** "conferida" é a conferência interna do documento. O sistema não valida a nota junto ao órgão emissor.
- **Assinatura eletrônica:** o contrato assinado é anexado como arquivo. A data de assinatura é informada por quem cadastra.
- **E-mail nos alertas:** os alertas do financeiro são notificações internas (sino do portal).
- **Folha CLT:** não há folha, holerite, férias, 13º, FGTS, horas extras, verbas rescisórias nem eventos do eSocial. O encerramento de contrato é **comercial**.

## 2. Modelo

| Entidade | Tabela | Observação |
|---|---|---|
| Fornecedor (empresa PJ/MEI ou autônomo) | `fin_fornecedores` | CNPJ/CPF único e validado; a pessoa do portal é a `representante`. Os dados de pagamento da empresa têm prioridade; se estiverem vazios, valem os do perfil da representante. |
| Centro de custo | `fin_centros_custo` | |
| Contrato | `fin_contratos` | Partes, objeto, escopo, modelo de remuneração (mensal fixo, projeto, hora, entrega), valor, periodicidade, prazo de pagamento, vigência (determinada ou indeterminada), renovação (automática por N meses, manual ou não renova), aviso, obrigações, situação e encerramento. |
| Aditivo | `fin_aditivos` | É a única forma de mudar valor, vigência e modelo de um contrato **em vigor**. O valor ou o prazo anterior fica registrado. |
| Documento | `doc_documentos` + `arq_arquivos` | Arquivo real (PDF/PNG/JPG até 3 MB, tipo verificado pelo conteúdo), categoria, emissão, validade, conferência, substituição. Nunca há URL pública. |
| Nota fiscal | `fin_notas` | Número, série, emissão, competência, valor bruto, arquivo, divergências e trilha de conferência, aceite e devolução. |
| Conta a pagar | `fin_contas` | Origem: nota (uma conta por nota, garantido por `unique`), reembolso aprovado ou avulsa. Valor líquido = bruto − retenções. |
| Retenção | `fin_retencoes`, `fin_regras_retencao` | Ver seção 5. |
| Pagamento | `fin_pagamentos` | Um por conta (`unique`). Valor igual ao líquido autorizado. |

Pessoas, áreas e cargos continuam nas coleções legadas (`app_*`). As tabelas novas guardam esses ids como referência.

## 3. Fluxo e segregação de funções

```
Nota enviada pelo prestador (com arquivo)
  → recebida ──(conferência documental: fin:conferir)──► conferida ──(aceite do serviço: gestor do contrato / liderança da área / fin:aprovar)──► aprovada
        │                                                    │                                                                                  │
        └──── devolvida (motivo) ◄────────────────────────────┘                                                         cria a conta a pagar (prevista)
               └── reenvio pelo prestador → recebida                                                                   + retenções das regras (a revisar)
Conta: prevista ──(retenções revisadas; fin:autorizar)──► autorizada ──(registro manual com referência/comprovante: fin:pagar)──► paga ──(fin:pagar)──► conciliada
```

Regras aplicadas no servidor:

- Ninguém decide sobre registro em nome próprio: a pessoa não confere, não aceita, não autoriza, não paga nem concilia a própria nota ou conta (vale também para quem representa o fornecedor).
- Com a **segregação ligada** (padrão, em *Configurações financeiras*):
  - quem deu o aceite do serviço não autoriza o pagamento;
  - quem registrou o pagamento não faz a conciliação.
- Divergência entre nota e contrato não bloqueia o envio. O aceite, porém, exige uma justificativa registrada. Os casos detectados são:
  - valor diferente do mensal ou acima do global;
  - competência fora da vigência;
  - emissão antes do início;
  - contrato não vigente;
  - outra nota na mesma competência.
- Duplicidade: a mesma nota (fornecedor + número + série) só entra uma vez, exceto se estiver cancelada. Uma nota gera uma única conta, e uma conta tem um único pagamento (`unique` + `select … for update`).
- Pagamento com data futura é recusado. O valor pago deve ser igual ao líquido autorizado; um valor diferente exige revogar a autorização e corrigir a conta.
- Uma nota paga não pode ser cancelada. Cancelar uma nota cancela a conta ainda não paga.

### Permissões

| Capacidade | Quem tem |
|---|---|
| `fin:ver` | RH, administração, diretoria, analista financeiro, autorizador de pagamentos |
| `fin:cadastrar`, `fin:aprovar` | RH, administração |
| `fin:conferir`, `fin:pagar` | RH, administração, analista financeiro |
| `fin:autorizar` | Administração e quem recebe a função "Autorização de pagamentos" |
| `fin:config` | Administração |

O RH **não autoriza** pagamentos por padrão. Para isso, conceda a função adicional em *Administração › Funções adicionais*.

Gestores veem e aceitam as notas dos contratos em que são gestores ou que pertencem às áreas que lideram, sem acesso a dados bancários. Prestadores veem os próprios contratos, notas, pagamentos e retenções aplicadas.

## 4. Indicadores (painel financeiro)

Todos são calculados na hora a partir do banco. Cada um mostra a definição na tela.

| Indicador | Fórmula |
|---|---|
| Contratado (mensal) | Σ `valor` dos contratos vigentes de valor mensal fixo |
| Faturado | Σ valor bruto das notas não canceladas com competência no período |
| Aprovado | Σ valor bruto das notas aprovadas com competência no período |
| Previsto | Σ (bruto − retenções) das contas prevista/autorizada com vencimento no período |
| Pago | Σ `valor_pago` dos pagamentos com data no período |
| Vencido | Σ (bruto − retenções) das contas não pagas com vencimento anterior a hoje |
| Obrigações futuras | Σ líquido das contas não pagas com vencimento depois do período |
| Concentração | Participação de cada fornecedor no total pago no período |
| Dias até o aceite | Média de (aceite − envio) das notas aprovadas (exclui as importadas) |
| Dias até o pagamento | Média de (data do pagamento − aceite) |

Valor contratado, faturado, aprovado, previsto e pago são números **diferentes** e aparecem separados. Não há mistura com custos CLT.

## 5. Retenções (controle interno, não apuração fiscal)

- **Nenhuma alíquota está fixada no código.** As regras são cadastradas por fornecedor, por quem tem `fin:pagar`, com tributo, alíquota, **fundamento** (norma ou orientação contábil) e vigência.
- No aceite da nota, as regras vigentes na data de emissão viram retenções `origem = regra`, que **ficam aguardando revisão**. A autorização do pagamento só é liberada depois de revisá-las. Uma retenção manual já entra revisada por quem a registrou.
- Cálculo: `valor = arredonda(base × alíquota ÷ 100)` na 2ª casa, **meio para cima**. A conta é feita em inteiros (centavos × alíquota com 4 casas, `BigInt`), sem erro de ponto flutuante (`src/domain/v2/financeiro.ts`, testado em `api/_v2/financeiro.test.ts`).
- As retenções não podem superar o valor bruto. Elas só são alteradas antes da autorização.
- O regime tributário do fornecedor é **informativo** e não aplica cálculo por si só. A tela avisa que o registro não substitui a apuração oficial nem o contador.

## 6. Documentos

- O envio é feito pela própria pessoa (em seu nome, do fornecedor que representa ou do contrato que presta) ou pelo RH/financeiro.
- Quem confere é a equipe de conferência (`fin:conferir` ou `documentos:gerenciar`), nunca a pessoa titular.
- Para substituir, envia-se uma nova versão: a anterior fica com a situação "substituído", sem ser apagada.
- Downloads são autenticados e auditados (`aud_eventos`). O gestor do contrato vê apenas os documentos contratuais (contrato, aditivo, nota, aprovação, encerramento), nunca os pessoais.
- Os registros antigos (`app_documentos`) só tinham metadados. Foram copiados como **legado sem arquivo**, e o painel mostra quantos ainda aguardam o arquivo.

## 7. Alertas e renovação automática

`processarAlertas` (`painel.ts`) roda:

- **pelo agendador**: `vercel.json` → `crons`, diariamente às 9h UTC, com `Authorization: Bearer $CRON_SECRET`; sem a variável, o agendamento é recusado;
- **como reserva**: quando alguém abre o painel e a última execução tem mais de 12 h;
- **manualmente**: pelo botão "Processar alertas".

| Gera | Para |
|---|---|
| Renovação automática (aditivo do sistema) | Contratos vigentes com renovação automática e término vencido |
| Aviso de término ou contrato vencido sem regularização | Gestor do contrato e cadastro |
| Nota parada há N dias | Quem confere ou dá o aceite |
| Pagamento a vencer ou vencido | Autorizadores (contas previstas) ou pagadores (contas autorizadas) |
| Documento a vencer ou vencido | Titular e conferentes |
| Nota do mês não enviada (a partir de 5 dias antes do dia limite) | Prestador |

Cada aviso tem uma chave por evento (`ntf_notificacoes.unique(destinatario, chave)`), então rodar de novo não duplica. A renovação acontece uma vez por término, porque o aditivo muda o término. As execuções ficam em `fin_execucoes_alertas`.

## 8. Migração e compatibilidade

`db/v2/60-financeiro.sql` é aditivo e idempotente. É aplicado sozinho pela função serverless (`garantirSchemaV2`) ou por `npm run db:setup`. Ele copia os dados antigos uma única vez, por id, **sem apagar nada**:

- **Fornecedores**: um por CNPJ/CPF válido do cadastro. Quem tem contrato e não tem documento válido recebe um fornecedor sem documento, com uma observação pedindo para completar.
- **Contratos**: mantêm o mesmo id. Números repetidos ganham sufixo ` (2)`, e datas inválidas não abortam a migração (`fin_data`).
- **Documentos**: entram como legado, sem arquivo.
- **Notas antigas** enviadas, aprovadas ou pagas: viram notas `LEG-<id>` (sem arquivo), com conta. As pagas recebem um pagamento marcado como "importado (sem comprovante)". As notas antigas "aguardando" eram só expectativa de envio e não são copiadas: o módulo calcula as notas esperadas a partir dos contratos.

As coleções `app_contratos` e `app_documentos` passam a ser **espelhos mantidos pelo servidor**, para que as telas antigas (perfil, indicadores, dashboard) continuem coerentes. A interface não grava mais nelas, e `app_notas` fica somente leitura. Os reembolsos continuam no fluxo antigo até a aprovação; o pagamento passa por *Contas a pagar*, e o servidor atualiza o status do pedido.

## 9. Segurança do `/api/estado` (sincronização das telas antigas)

**Antes:**

- o `GET` entregava **o banco inteiro** a qualquer pessoa logada: CPF, dados bancários, contratos, documentos, auditoria e notificações de todos;
- o `PUT` aceitava a substituição de **coleções inteiras**. Um colaborador podia aprovar ou pagar a própria nota, alterar reembolsos e pontos de outras pessoas, e duas pessoas editando ao mesmo tempo apagavam o trabalho uma da outra.

**Agora** (`api/_v2/guarda.ts`, `api/_v2/estadoLegado.ts`, `src/domain/sincronia.ts`):

- **Leitura filtrada por papel.** Cada coleção tem uma regra de visibilidade, e os dados pessoais de terceiros são removidos. O aniversário aparece sem o ano, e notificações são só as próprias. A diretoria vê dados gerenciais, sem dados pessoais sensíveis.
- **Escrita por registro.**
  - Cada registro criado, alterado ou removido passa pela regra da sua coleção, que espelha as permissões das ações da interface.
  - Os campos que a pessoa não viu são preservados.
  - O lote é tudo-ou-nada, com `pg_advisory_xact_lock` por coleção.
  - Conflito de edição (o hash da versão vista é diferente do atual) devolve 409, e a tela recarrega.
  - Recusas não ficam mais em repetição infinita.
- **Pontuação.** Os pontos são recalculados pelo motor de regras no servidor, então não dá para inventar pontos.
- **Trilha de auditoria.** É só de acréscimo, em nome próprio.
- **Pesquisa anônima.** A resposta só entra junto com a participação da própria pessoa.
- **Exclusão de pessoa.** Não é possível excluir quem tem histórico contratual ou financeiro; o caminho é anonimizar.
- **Caixa de sugestões.**
  - A chave de autoria passou a usar um segredo por pessoa, derivado no servidor por HMAC (`ANON_SECRET`). Antes, ela era recalculável por qualquer pessoa com um sal público.
  - As chaves antigas são convertidas uma única vez.
- **CSRF.** Toda mutação autenticada exige o cabeçalho `X-Requested-With: 4juris`.

## 10. Variáveis de ambiente novas

| Variável | Uso | Sem ela |
|---|---|---|
| `CRON_SECRET` (≥ 16 caracteres) | Alertas diários pelo agendador da Vercel | Os alertas rodam só pelo painel (reserva de 12 h) ou pelo botão |
| `ANON_SECRET` (≥ 32 caracteres, recomendado) | Chaves anônimas da caixa de sugestões | Usa `SESSION_SECRET` |

## 11. Limitações conhecidas

- Não há pagamento parcial: uma conta tem um único pagamento, no valor líquido.
- Não há leitura automática do XML ou PDF da nota: os dados são digitados por quem envia e conferidos por outra pessoa.
- Com o banco conectado, a exportação LGPD da pessoa (*Privacidade & auditoria*) ainda não inclui as tabelas do módulo financeiro.
- Os indicadores de diversidade não aparecem para a diretoria, porque os dados individuais sensíveis não saem do servidor para esse papel.
