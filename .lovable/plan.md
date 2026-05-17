## Objetivo

Na Agenda, quando todas as tarefas de um dia estiverem concluídas, o card do dia deve manter o tamanho normal (igual aos demais) e NÃO exibir o botão "+N mais" embaixo. Hoje, o botão aparece sempre que há mais de 5 tarefas, mesmo quando todas já estão 100% concluídas, o que dá a aparência de "encolhido + botão de abrir".

## Mudanças

Arquivo: `src/features/gestao/GestaoPanel.tsx`

Adicionar uma flag `allDone = dayTasks.length > 0 && dayTasks.every(t => t.status_global === "concluido")` em cada um dos 3 renderizadores de célula de dia:

1. **Semana (grid compacto)** — linhas ~1020-1069: quando `allDone`, renderizar todas as tarefas (`dayTasks.map(renderTaskCard)`) e não mostrar o botão "+N mais".
2. **Semana (cards largos com scroll)** — linhas ~1074-1126: mesma lógica, listar todas e suprimir o botão "+N mais".
3. **Mês (grade desktop 7 colunas)** — linhas ~1178-1240: idem. O `max-h-[520px] overflow-y-auto` já existente garante que o card não cresça além do limite — então o tamanho visual continua o mesmo dos outros dias.

Para versão mobile (lista mensal, linhas ~1132-1168) nada muda — ela já lista tudo sem botão.

## Resultado

- Dia com 5/5 concluídas: mostra as 5 normalmente, sem botão.
- Dia com 8/8 concluídas: mostra todas (scroll interno se passar da altura), sem botão "+3 mais".
- Dia com tarefas pendentes (qualquer quantidade): comportamento atual mantido (limite de 5 visíveis + botão "+N mais").
- Tamanho/altura visual do card permanece igual ao dos outros dias graças aos `max-h` já existentes.
