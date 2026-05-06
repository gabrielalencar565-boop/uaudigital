## O que muda

O painel "Revisão de Alterações" (criado na última iteração) passará a aparecer na etapa **Revisão** — onde o revisor marca cada subtarefa como aprovada ou com necessidade de alteração e descreve o que precisa mudar. Quando a tarefa for enviada para **Alteração**, o painel aparece em modo somente-leitura, mostrando apenas as subtarefas que precisam de ajuste e os detalhes escritos pelo revisor.

---

### 1. Adicionar prop `mode` ao `AlteracaoReviewPanel`

**Arquivo:** `src/features/gestao/components/AlteracaoReviewPanel.tsx`

- Nova prop `mode: "revisao" | "alteracao"`.
- **Modo revisão:** botões interativos (aprovar / marcar alteração), campo de texto editável para a nota, barra de progresso, contagem de pendentes. Titulo: "Checklist de Revisão", icone rosa.
- **Modo alteração:** botões e notas em read-only. Filtra e exibe apenas subtarefas marcadas como "alteracao". Notas aparecem auto-expandidas em bloco estilizado. Titulo: "Alterações Necessárias", icone amarelo. Se tudo aprovado, mostra badge verde resumo.

### 2. Exibir o painel na etapa Revisão

**Arquivo:** `src/features/gestao/components/PmTaskDetailDialog.tsx`

- Alterar a condição atual `task.stage_current === "alteracoes"` para `task.stage_current === "alteracoes" || task.stage_current === "revisao"`.
- Passar `mode="revisao"` quando `stage_current === "revisao"` e `mode="alteracao"` quando `stage_current === "alteracoes"`.
- O painel continua aparecendo apenas para tarefas pai com subtarefas (`!task.parent_task_id && childTasks.length > 0`).

### 3. Atualizar chamada existente com `mode`

A chamada existente do `AlteracaoReviewPanel` precisa receber a nova prop `mode` obrigatória.

---

### Detalhes técnicos

- `revision_notes` (coluna JSONB já existente em `pm_tasks`) armazena `{ [subtask_id]: { status, note } }`.
- No modo `revisao`, salva no DB a cada toggle de status e onBlur da nota.
- No modo `alteracao`, os dados são somente leitura — nenhuma mutação é disparada.
- Nenhuma migração de banco necessária (coluna já existe).
