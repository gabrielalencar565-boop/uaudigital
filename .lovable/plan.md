
Objetivo

Fazer o filtro “Etapas” funcionar de verdade na Agenda de Tarefas da tela que você está usando.

Diagnóstico

- A tela certa é `GestaoPanel` → `AgendaCalendarView`, não o `AgendaPanel` separado.
- Confirmei isso em `src/pages/Index.tsx`: a aba `agenda_gestao` renderiza `<GestaoPanel forcedView="agenda" />`.
- O dropdown está conectado ao estado `filterStage`, mas a filtragem falha por 2 motivos em `src/features/gestao/GestaoPanel.tsx`:
  1. `filteredTasks` usa `filterStage`, porém o `useMemo` não tem `filterStage` na lista de dependências.
  2. `tasksByDay` ainda adiciona tarefas legadas da tabela antiga sem aplicar `filterStage`, então parte da agenda ignora o filtro.

Plano de implementação

1. Corrigir o `useMemo` de `filteredTasks` para recalcular sempre que `filterStage` mudar.
2. Aplicar o mesmo filtro por etapa ao bloco que injeta tarefas legadas em `tasksByDay`.
3. Adicionar `filterStage` também nas dependências do `useMemo` de `tasksByDay`, para o calendário recomputar corretamente.
4. Validar que o filtro reflita em todos os pontos que dependem de `tasksByDay`:
   - grade mensal
   - grade semanal
   - contadores “hoje” e “atrasadas”
   - modal “+X mais”

Detalhes técnicos

- Arquivo principal: `src/features/gestao/GestaoPanel.tsx`
- Sem mudança de banco/backend.
- Sem mexer no Kanban, porque lá o filtro por etapa já está conectado corretamente.
- Sem mexer no `src/features/agenda/AgendaPanel.tsx` neste ajuste, porque ele não é a tela usada no fluxo atual.

Resultado esperado

Ao selecionar “Captação”, “Planejamento”, “Design” etc., a Agenda de Tarefas passará a mostrar apenas tarefas daquela etapa, inclusive as legadas, em mês, semana e listas expandidas.
