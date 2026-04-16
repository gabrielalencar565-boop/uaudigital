

## Fix: Campo vazio ao selecionar "Personalizar..."

### Problema
Quando um valor personalizado é salvo (ex: `7`), o `current` vira `"7"`. Mas o `<Select>` só tem opções `auto`, `String(expected)`, `0`, `-1`, `custom`. Como `"7"` não bate com nenhuma, o dropdown aparece vazio.

### Solução
No `<Select>`, quando o `current` não corresponde a nenhuma opção predefinida (é um override personalizado), mostrar o valor como uma `SelectItem` dinâmica com o texto do valor, ou usar o input customizado diretamente.

**Arquivo:** `src/features/performance/components/AdminDeadlineReport.tsx`

1. Alterar a lógica do `value` do Select: quando o override existe e o valor não é uma das opções fixas (`auto`, `String(expected)`, `0`, `-1`), setar `value="custom"` e exibir o valor real no label.
2. Adicionar uma `SelectItem` dinâmica que mostra o valor personalizado atual quando existe um override que não bate com as opções fixas.

Concretamente:
- Detectar se `current` é um valor personalizado (não está entre as opções fixas)
- Se sim, usar `value="custom"` no Select e adicionar uma `SelectItem value="custom"` que mostra `Personalizado: {valor}`
- Ao clicar "Personalizar..." novamente, pré-preencher o input com o valor atual do override

