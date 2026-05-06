## Problema

Nas tarefas com `stage_current = "planejamento"`, as seções **Vídeo** e **Design** dentro do `PmPlanningSubtasks` só aparecem quando já existem subtarefas daquele tipo (`videoTasks.length > 0` / `designTasks.length > 0`). Quando não há nenhuma subtarefa, ambas as seções ficam ocultas e o usuário não consegue criar novas.

A tarefa **[Mariana] - Planejamento - Maio** (`482849b4-...`) não tinha nenhuma subtarefa criada (nem ativas nem deletadas).

## Solução

**Arquivo: `src/features/gestao/components/PmPlanningSubtasks.tsx`**

Alterar as condições nas linhas 225 e 251:
- Quando a tarefa pai está na etapa `planejamento` (e não é `isSinglePostType` vindo de revisão/alteração), renderizar SEMPRE ambas as seções, independentemente de haver subtarefas.
- Para tarefas REV/DSG, REV/VDO, ALT/DSG, ALT/VDO (single post type em revisão/alteração), manter a lógica atual de mostrar apenas a seção correspondente.

Lógica concreta:
```
const isPlanningParent = parentTask.stage_current === "planejamento" 
  || parentTask.stage_current === "pdf" 
  || parentTask.stage_current === "agendamento" 
  || parentTask.stage_current === "entrega";

// Vídeo section: show if has video tasks OR is a planning-type parent
{(videoTasks.length > 0 || isPlanningParent) && <PlanningSection type="video" ... />}

// Design section: show if has design tasks OR is a planning-type parent  
{(designTasks.length > 0 || isPlanningParent) && <PlanningSection type="design" ... />}
```

Isso garante que em tarefas de planejamento (e derivadas como PDF/Agendamento/Entrega) as duas seções sempre apareçam com o botão "+" para adicionar subtarefas, mesmo quando vazias.

## Sobre a tarefa Mariana

A tarefa nunca teve subtarefas criadas (nem deletadas). Não há dados para recuperar — bastará que, com a correção acima, as seções apareçam para que a Ana possa criar as subtarefas de Vídeo e Design normalmente.
