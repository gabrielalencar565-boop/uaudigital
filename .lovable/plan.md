

## Plano

### 1. Remover "Dados de Postagem" e "Cronograma" das subtarefas em PDF
**Arquivo:** `src/features/gestao/components/PmTaskDetailDialog.tsx`

- **Linhas 1728-1732:** remover o bloco que renderiza `<PmPostingFields>` quando a subtarefa está em `pdf` (`task.parent_task_id && task.stage_current === "pdf"`).
- **Linhas 1750-1765:** remover o bloco `Cronograma` que aparece para tarefas pai em PDF (`!task.parent_task_id && task.stage_current === "pdf"`).
- Remover imports não utilizados: `PmPostingFields`, `PmCronogramaTab` e `CalendarDays` (validar antes de remover, podem ser usados em outros pontos).

### 2. Pills da Agenda para PDF — gradientes PDF/DSG e PDF/VDO
Aplicar o mesmo padrão usado em REV/DSG e REV/VDO.

**Arquivo:** `src/features/agenda/AgendaPanel.tsx` (linhas 246-282)
- Estender o `revisaoPostTypes` (renomear conceitualmente para `originPostTypes`) para incluir também tarefas com `t.stage === "pdf"` que tenham `description` iniciando com `pm:`. Assim o `getPostType` retorna o `post_type` para tarefas PDF também.

**Arquivo:** `src/features/agenda/components/AgendaWeekTaskItem.tsx`
- Adicionar suporte ao `stage === "pdf"` com `postType`:
  - `isPdfWithOrigin = stage === "pdf" && !!postType`
  - Sigla: `PDF/VDO` (vídeo) ou `PDF/DSG` (foto/imagem)
  - Gradiente:
    - vídeo: `bg-gradient-to-r from-stage-pdf to-stage-edicao_videos text-stage-foreground-pdf` 
    - design: `bg-gradient-to-r from-stage-pdf to-stage-design text-stage-foreground-pdf`
- Incluir `isPdfWithOrigin` em `hasGradientPill` e nos cálculos de `gradientShort` / `gradientClass` (estrutura idêntica ao REV).

### Resultado
- Subtarefas em PDF: sem campos de postagem nem cronograma (esses ficam na tarefa pai onde já existem normalmente).
- Agenda: tarefas PDF originadas de pm_tasks exibem pill com gradiente amarelo→roxo (PDF/VDO) ou amarelo→teal (PDF/DSG), seguindo o mesmo padrão de REV.

