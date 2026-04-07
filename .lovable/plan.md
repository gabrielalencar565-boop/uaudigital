

## Corrigir contagem e intensificar destaque vermelho das tarefas atrasadas

### Problemas identificados

1. **Contagem errada**: O badge "X atrasadas" conta tarefas onde `status_global !== "concluido"`, mas NÃO exclui tarefas no estágio `entrega`. Já a função `isOverdue` exclui `entrega`. Isso faz o badge mostrar 2 quando só 1 deveria contar.

2. **Destaque fraco**: O vermelho atual usa opacidade baixa (`bg-destructive/10`). O usuário quer 100% de fundo vermelho.

### Alterações

**Arquivo:** `src/features/gestao/GestaoPanel.tsx`

1. **Corrigir contagem do badge** (linha ~842): usar a mesma lógica de `isOverdue` no filtro do `reduce`:
   ```ts
   .reduce((sum, [, ts]) => sum + ts.filter(t => isOverdue(t)).length, 0);
   ```

2. **Intensificar destaque do badge toggle** (linha ~849): quando `highlightOverdue` ativo, usar fundo vermelho sólido no badge:
   ```
   highlightOverdue && "ring-2 ring-destructive/60 ring-offset-2 bg-red-700 shadow-md"
   ```

3. **Intensificar destaque dos cards** (linha ~713): trocar de `bg-destructive/10` para fundo vermelho 100%:
   ```
   highlightOverdue && isOverdue(t) && "bg-red-600 border-red-600 ring-1 ring-red-500 text-white"
   ```
   E no `style` inline (linha ~715), garantir que o fundo vermelho sólido prevalece sobre o gradiente de alteração.

4. **Borda dos dias com atrasadas**: manter `border-destructive/50` nos dias (já funciona).

