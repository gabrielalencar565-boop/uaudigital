## Objetivo

Reverter a mudança anterior e implementar o comportamento inverso: dias com **100% das tarefas concluídas** devem ficar **compactos** (encolhidos), mostrando apenas um botão tipo "ver tarefas" que abre um painel lateral (sidebar) com a lista completa das tarefas daquele dia.

## Mudanças em `src/features/gestao/GestaoPanel.tsx`

### 1. Reverter lógica anterior
Nas 3 visualizações (Semana compacta, Semana cards largos, Mês desktop), voltar para `dayTasks.slice(0, 5).map(renderTaskCard)` + botão "+N mais" sem a flag `allDone` afetando a renderização das tarefas.

### 2. Comportamento "100% concluído"
Quando `allDone === true` (e `dayTasks.length > 0`):
- **Não renderizar nenhum task card** dentro da célula.
- **Reduzir altura** do card: remover `min-h-28`/padding interno da lista, manter só o cabeçalho (número do dia + dia da semana + badge `X/X`).
- Exibir **um único botão pill** abaixo do cabeçalho: `"✓ X tarefas — ver"` (ícone `PanelRightOpen` + texto), com estilo verde/success suave (`bg-success/10 text-success border border-success/20`).
- Ao clicar nesse botão, abre um **Sheet lateral** (componente `Sheet` do shadcn já disponível) com:
  - Título: data formatada (`dd/MM · EEEE`).
  - Lista das tarefas concluídas usando o mesmo `renderTaskCard`.
  - Fecha clicando fora ou no X.

### 3. Estrutura do Sheet
- Adicionar imports: `Sheet, SheetContent, SheetHeader, SheetTitle` e ícone `PanelRightOpen`.
- Novo estado: `const [donePanelDayKey, setDonePanelDayKey] = useState<string | null>(null);`
- Renderizar `<Sheet open={!!donePanelDayKey} onOpenChange={(o) => !o && setDonePanelDayKey(null)}>` no final do componente, próximo ao Dialog "More tasks".
- O `SheetContent side="right"` lista todas as tarefas do dia.

### 4. Aplicar em todas as 3 visualizações
- **Semana grid compacto** (~linhas 1020-1069)
- **Semana cards largos** (~linhas 1074-1126)
- **Mês desktop grade 7 colunas** (~linhas 1178-1240)

A versão mobile (lista mensal) mantém comportamento atual.

## Resultado visual

- Dia com tarefas pendentes: comportamento padrão (5 cards + "+N mais" se houver mais).
- Dia com 100% concluído: cabeçalho + pill verde compacto `✓ 5 tarefas` → clica e abre painel lateral com as tarefas.
- Dia vazio: "Sem tarefas" como hoje.
