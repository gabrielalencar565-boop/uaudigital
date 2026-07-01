Implementar opção de minimizar/expandir cada categoria de anexos na tela de detalhes da tarefa.

## Contexto
A seção de anexos foi separada em duas categorias:
- 🎯 Materiais de Produção
- 🚀 Conteúdo Final

Atualmente ambas as seções são sempre renderizadas abertas, ocupando espaço mesmo quando o usuário quer focar em apenas uma delas.

## O que será feito
1. Adicionar botão de minimizar/expandir no cabeçalho de cada `CategorySection` em `PmAttachmentsSection.tsx`.
2. Usar o componente `Collapsible` já existente no shadcn/ui para manter consistência com o resto do app (ex.: painel "Meu Painel").
3. Estado local controlará o colapso de cada categoria separadamente, respeitando a ação do usuário.
4. O conteúdo colapsado incluirá: lista de arquivos, uploads em progresso, drop zones e estado vazio.
5. O cabeçalho permanecerá visível com: ícone da categoria, título, contador de arquivos, botão de upload e o botão de expandir/minimizar.
6. O botão de upload continuará acessível mesmo quando a seção estiver minimizada, para permitir envio rápido sem precisar expandir.
7. Será usado ícone `ChevronDown` / `ChevronUp` com rotação suave, seguindo o padrão do `Collapsible`.

## Arquivos alterados
- `src/features/gestao/components/PmAttachmentsSection.tsx`

## Não será alterado
- Banco de dados (a coluna `category` já existe e funciona).
- Lógica de upload, exclusão, renomear, mover categoria ou download.
- `PmTaskDetailDialog.tsx` e demais componentes de tarefa (apenas a seção de anexos terá o colapso).