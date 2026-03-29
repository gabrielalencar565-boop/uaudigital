

## Correções no Tipo de Planejamento (Vídeo/Design)

### Problemas identificados
1. **Seletor aparece em "captação" e "planejamento"** — deve aparecer **apenas em "planejamento"**
2. **Título com mês duplicado** — formato atual: `[Cliente] - Planejamento (Vídeo) - Março`. Formato correto: sem mês, apenas `[Cliente] - Planejamento - Vídeo` ou similar sem repetir mês
3. **Popovers dentro do diálogo ficam por trás** — falta `z-[130]` nos PopoverContent/DatePicker dentro do dialog z-[120]
4. **Cards Vídeo/Design desalinhados** — devem ficar alinhados à esquerda como "Demanda Extra" e "Cliente", usando `PropertyRow`
5. **Cores de fundo dos cards** — devem usar as cores de estágio (Vídeo = azul/roxo `border-blue-500`, Design = teal `border-teal-500`) como fundo translúcido **sempre**, não apenas quando selecionado

### Alterações

**`src/features/gestao/components/PmTaskDetailDialog.tsx`**

1. **Linha 832**: Mudar condição de `(task.stage_current === "planejamento" || task.stage_current === "captacao")` para apenas `task.stage_current === "planejamento"`

2. **Linhas 831-878**: Envolver os botões Vídeo/Design em um `PropertyRow` com ícone e label (ex: ícone Layers, sem label ou label "Tipo"), alinhando com os demais campos. Remover o texto "Vídeo"/"Design" dos botões, manter apenas ícones. Aplicar cores de fundo baseadas na etapa:
   - Vídeo: `bg-blue-500/15 text-blue-500` (sempre, não só quando ativo)
   - Design: `bg-teal-500/15 text-teal-500` (sempre, não só quando ativo)
   - Quando selecionado: adicionar `ring-1` para indicar seleção

3. **Título auto-rename (linhas 852-868)**: Corrigir para não adicionar mês. Garantir que o sufixo seja apenas `- Vídeo` ou `- Design`, e o regex de limpeza capture todas as variações existentes

4. **Z-index em todos os PopoverContent** sem `z-[130]` (linhas 767, 808, 892): Adicionar `z-[130]` para garantir que apareçam acima do dialog z-[120]

**`src/features/gestao/components/PmTaskCard.tsx`**
- Os badges de tipo no Kanban card já estão implementados, manter como estão

