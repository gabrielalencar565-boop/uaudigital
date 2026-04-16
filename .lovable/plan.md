

## Restaurar coluna "Exceção" + manter edição direta na pontuação

### O que será feito
Adicionar de volta a coluna **"Exceção"** ao lado da coluna "Pontuação", mantendo ambas funcionalidades:

1. **Coluna "Pontuação"** — clicável para editar o valor diretamente (comportamento atual)
2. **Coluna "Exceção"** — Select dropdown com opções rápidas: `Auto`, `0`, `-1`, pontuação esperada da etapa, e `Personalizar...`

### Detalhes técnicos
- Arquivo: `src/features/performance/components/AdminDeadlineReport.tsx`
- Adicionar `<TableHead>Exceção</TableHead>` após a coluna Pontuação (linha ~635)
- Adicionar nova `<TableCell>` com o `<Select>` dropdown contendo as opções predefinidas (`auto`, `0`, `-1`, valor esperado)
- A coluna Pontuação continua mostrando o `finalPts` com click-to-edit via Input
- A coluna Exceção usa o Select para atalhos rápidos — ambas gravam no mesmo `task_deadline_overrides`

