
## Problema

Quando abre uma tarefa REV/VDO, aparecem as duas seções (Vídeo e Design) dentro do `PmPlanningSubtasks`. O esperado é que REV/VDO mostre apenas a seção de Vídeo e REV/DSG apenas a seção de Design, com os mesmos controles de aprovação/alteração que já existem no REV/PLAN.

## Solução

**Arquivo: `src/features/gestao/components/PmPlanningSubtasks.tsx`**

Condicionar a renderização das seções Vídeo e Design: só renderizar cada `PlanningSection` quando houver subtarefas daquele tipo (`videoTasks.length > 0` / `designTasks.length > 0`).

Como os `childTasks` já chegam filtrados pelo `PmTaskDetailDialog` (apenas vídeo para REV/VDO, apenas design para REV/DSG), basta esconder a seção vazia. Nenhuma outra mudança necessária — o `reviewMode` já está sendo passado corretamente.
