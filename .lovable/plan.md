

# Plano: Remover maximizar, manter apenas minimizar (colapsar/expandir)

## Resumo

Remover o botão de maximizar (`Maximize2`) das seções "Evolução por Etapa" e "Produtividade por Colaborador". Todas as seções passarão a ter apenas a seta de minimizar/expandir (`ChevronUp`/`ChevronDown`), igual ao que já existe em "Desempenho por Cliente".

## Mudanças em `SquadDashboardDialog.tsx`

1. **Remover estado `maximized`** e o tipo `MaxSection`.
2. **Remover `renderMaximized()`** e sua chamada no JSX.
3. **Adicionar estados de colapso** para as seções "stages" e "productivity" (`stagesCollapsed`, `productivityCollapsed`).
4. **Substituir o botão `Maximize2`** em `renderStagesSection` e `renderProductivitySection` por botão `ChevronUp`/`ChevronDown` que alterna o colapso da seção.
5. **Envolver o conteúdo** de cada seção (gráfico, grid, lista) em condicional baseado no estado colapsado.
6. **Remover imports** não mais usados: `Maximize2`, `X`.
7. **Remover parâmetro `fullscreen`** das funções de renderização, já que não haverá mais maximização.

