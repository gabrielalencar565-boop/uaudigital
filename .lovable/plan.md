Vou ajustar a aparência da opção **“ver alteração”** dentro da lista de subtarefas.

O problema encontrado é que o botão está usando `bg-amber-500/10 text-amber-500`, mas quando a linha da subtarefa está em alteração ela também recebe fundo amber forte (`!bg-amber-500`) e texto branco. Nesse contexto, o botão fica com pouco contraste e parece invisível.

Plano de ajuste:

1. Alterar a cor do botão **“ver alteração”** para ter contraste alto quando estiver dentro de uma linha em alteração:
   - fundo branco/semitransparente ou escuro com borda clara;
   - texto branco ou amber escuro dependendo do fundo;
   - ícone e seta com a mesma cor visível.

2. Garantir que o botão continue aparecendo em todas as subtarefas com status `alteracao` e com descrição vinculada.

3. Manter o comportamento atual de clique:
   - clicar em **“ver alteração”** expande/fecha o campo abaixo da subtarefa;
   - a descrição continua aparecendo embaixo da própria subtarefa, não na tarefa pai.

4. Revisar visualmente no componente `PmPlanningSubtasks.tsx` para evitar que o botão fique escondido pelo fundo amber da linha ou pelo texto branco herdado.