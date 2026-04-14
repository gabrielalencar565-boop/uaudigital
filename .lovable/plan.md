
## Diagnóstico

Confirmei 2 causas principais no fluxo de conclusão do Planejamento:

1. **Conclusão acontece cedo demais**
   - Em `PmTaskDetailDialog.tsx`, o ramo de `handleConcluido()` para `planejamento` já grava `status_global = "concluido"` no banco e no cache **antes** de terminar a fila de vinculações.
   - Isso faz a tarefa entrar em modo de snapshot concluído enquanto o diálogo de vínculo ainda está sendo aberto/processado, o que explica o comportamento de **“aparece e some”**.

2. **Busca da tarefa existente usa a data errada no split**
   - Em `processSplitQueue()`, a busca de tarefa já existente para `design`/`edicao_videos` está usando `snapshotDueDate`.
   - Para tarefas da próxima etapa, o correto é procurar com base em **`nextDueDate`**. Isso pode fazer uma tarefa já criada não ser encontrada, principalmente quando a próxima etapa cai em outra janela/mês.

## Regras já confirmadas

A regra de negócio que você pediu já existe na busca e deve ser mantida:
- **não vincular demanda extra**
- **não vincular tarefa já concluída**

Hoje isso já está filtrado por:
- `.eq("is_extra_demand", false)`
- `.neq("status_global", "concluido")`

Então **não precisa mudança de banco nem de permissões**. O problema é de fluxo no frontend.

## Plano de correção

### 1. Adiar a conclusão real do Planejamento
No fluxo de `planejamento`, vou remover a conclusão antecipada.

Em vez de:
- marcar pai/filhas como concluídas logo no começo
- abrir os diálogos depois

o fluxo ficará assim:
1. detectar os splits de **Vídeo** e **Design**
2. abrir os diálogos de vínculo, se existirem tarefas elegíveis
3. criar/vincular as próximas tarefas
4. **só no final** marcar o Planejamento como concluído

Isso evita que a UI entre em estado de concluído antes da hora.

### 2. Fazer o `finalizePlanejamentoCompletion()` concluir de verdade
Hoje essa função praticamente só sincroniza/invalida dados.

Vou mover para ela a finalização real:
- atualizar pai e subtarefas originais para `status_global = "concluido"`
- aplicar atualização otimista no cache só nesse momento
- sincronizar pontuação
- invalidar queries ao final

Assim a conclusão fica exatamente na ordem correta: **primeiro vínculo/criação, depois conclusão**.

### 3. Corrigir a busca de tarefa existente para Design/Vídeo
No `processSplitQueue()`, vou trocar a busca para usar **`nextDueDate`** ao procurar tarefa já existente da próxima etapa.

Resultado:
- se já existir **Design**, aparece opção de vincular
- se já existir **Vídeo**, aparece opção de vincular
- se não existir, o sistema cria normalmente

### 4. Manter o diálogo estável até o fim da fila
Vou preservar a lógica para o diálogo só fechar quando a fila terminar, mas sem depender do estado “concluído” da tarefa.

Também vou garantir que:
- fechar/cancelar o diálogo limpa os estados pendentes
- cancelar **não conclui** o Planejamento por engano
- a abertura do próximo diálogo (Vídeo → Design) não seja interrompida por mudança prematura de status

## Arquivo principal a ajustar

- `src/features/gestao/components/PmTaskDetailDialog.tsx`

Possivelmente **sem necessidade** de mexer no `LinkOrDateDialog.tsx`, porque o problema atual está na ordem das ações no pai.

## Validação esperada após a correção

### Cenário 1
Planejamento com **Vídeo já criado** e **Design já criado**:
- clicar em **Concluir**
- aparecer vínculo de um
- depois aparecer vínculo do outro
- **só depois** o Planejamento fica concluído

### Cenário 2
Planejamento com só uma tarefa existente:
- aparece vínculo apenas para a que existe
- a outra é criada automaticamente
- no fim, Planejamento fica concluído

### Cenário 3
Se existir tarefa de próxima etapa que seja:
- **demanda extra**, ou
- **já concluída**

ela **não deve aparecer** como opção de vínculo.

## Detalhes técnicos

- Não há necessidade de migration, tabela nova, RLS ou backend.
- A correção é totalmente no controle de estado e na sequência de execução do fluxo de `planejamento`.
- Vou manter a fluidez já introduzida no split em background, mas sem sacrificar a ordem correta de conclusão.
