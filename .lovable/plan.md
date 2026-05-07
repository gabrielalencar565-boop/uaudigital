## Problema

O dropdown "TRANSFORMAR EM" no editor de legendas (SmartCaptionEditor) não funciona ao selecionar "Texto", "Cabeçalho 1", etc. O texto selecionado não muda de formato.

## Causa

A função `applyHeading` usa `document.execCommand("formatBlock", false, "h1")`, mas no Chrome/navegadores modernos o comando `formatBlock` exige o tag com angle brackets: `"<h1>"` em vez de `"h1"`.

## Correção

No arquivo `src/features/gestao/components/SmartCaptionEditor.tsx`:

1. **Na função `applyHeading` (linha 361-373)**: Envolver o tag em angle brackets ao chamar `formatBlock` — usar `<${tag}>` em vez de `tag` diretamente.

2. **Na detecção do bloco atual (linha 275)**: O `queryCommandValue("formatBlock")` retorna valores inconsistentes entre navegadores (às vezes com aspas, às vezes sem). Normalizar o valor retornado para comparar corretamente com os tags dos `HEADING_OPTIONS`.

Ambas as mudanças são no mesmo arquivo, apenas 2-3 linhas alteradas.
