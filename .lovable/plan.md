

## Correções: Renomeação, Subtarefas e Filtro Automático

### 3 problemas a resolver

1. **Renomeação removendo "Planejamento"** — A lógica de regex falha em alguns formatos de título. Solução: sempre construir o título como `[Cliente] - Planejamento (Vídeo/Design) - Mês`, usando o nome do cliente do `clientsMap` e o mês da `due_date` da tarefa, sem depender de parsing do título existente.

2. **Vídeo/Design aparece nas subtarefas** — O seletor deve aparecer apenas na tarefa principal (sem `parent_task_id`). Adicionar condição `!task.parent_task_id` junto com `task.stage_current === "planejamento"`.

3. **Filtro do Kanban não filtra por usuário ao abrir** — O `useState(user?.id ?? "__all__")` captura `null` no primeiro render (user ainda carregando). Adicionar `useEffect` para atualizar `filterAssignee` quando `user` carregar.

### Alterações por arquivo

**`src/features/gestao/components/PmTaskDetailDialog.tsx`**
- Linha 832: mudar condição para `task.stage_current === "planejamento" && !task.parent_task_id`
- Linhas 851-875: substituir lógica de renomeação por abordagem direta:
  - Buscar nome do cliente via prop `clientsMap[task.client_id]`
  - Buscar mês via `task.due_date` (format com date-fns ptBR, capitalizado)
  - Construir: `${clientName} - Planejamento (${typeLabel}) - ${month}`
  - Se não houver `due_date`, omitir o mês
  - Precisa receber `clientsMap` como prop (verificar se já recebe)

**`src/features/gestao/GestaoPanel.tsx`**
- Após linha 75: adicionar `useEffect` que seta `filterAssignee` para `user.id` quando user carrega e filterAssignee ainda é `"__all__"`

### Detalhes técnicos

```text
Renomeação (simplificada):
  clientName = clientsMap[task.client_id] ?? task.title.split(" - ")[0]
  month = task.due_date ? capitalize(format(parseISO(due_date), "MMMM", {locale: ptBR})) : null
  title = month 
    ? `${clientName} - Planejamento (${typeLabel}) - ${month}`
    : `${clientName} - Planejamento (${typeLabel})`

Filtro auto:
  useEffect(() => {
    if (user?.id && filterAssignee === "__all__") {
      setFilterAssignee(user.id);
    }
  }, [user?.id]);
```

