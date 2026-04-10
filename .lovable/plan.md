

## Plano: Opções de exceção dinâmicas baseadas na pontuação da etapa

### Problema atual
O dropdown de exceção oferece apenas valores fixos: +1, 0, -1. Porém as etapas têm pontuações variadas (Captação = 2.5, Planejamento = 8, PDF = 1.5, etc.), e tarefas de Design/Vídeo pontuam por tags das subtarefas. Quando uma tarefa atrasou, o admin precisa forçar a pontuação que ela **teria** recebido, mas o dropdown não oferece esse valor.

### Solução
Mostrar no dropdown de exceção o valor que a tarefa **valeria se tivesse sido entregue no prazo**, calculado automaticamente com base na etapa e nas tags/subtarefas. Assim o admin pode "forçar a exceção" com o valor correto.

### Mudanças

**1. Migração: alterar `override_points` de `integer` para `numeric`**
- A coluna atual é `integer` e não suporta valores como 2.5 ou 1.5.
- Alterar para `numeric` para aceitar decimais.

**2. Atualizar `AdminDeadlineReport.tsx`**
- Calcular o valor "on-time" que a tarefa teria (`expectedPoints`) usando a mesma lógica de `calcPoints` mas assumindo entrega no prazo.
- No dropdown de exceção, adicionar uma opção dinâmica: `Forçar +{expectedPoints}` (ex: "Forçar +2.5" para captação).
- Manter as opções existentes (Auto, Forçar 0, Forçar -1) e remover o "Forçar +1" genérico, substituindo pelo valor calculado.
- Remover a validação que restringe a `[1, 0, -1]` no `setOverrideMut`, permitindo qualquer valor numérico.

**3. Lógica de cálculo do valor esperado**
- Para etapas com `base_points` fixo (captação, planejamento, pdf, agendamento): usar o `base_points` da config.
- Para etapas com tags (design, vídeo): usar o `point_value` do snapshot da tarefa (que já reflete as subtarefas), ou calcular a partir das tags se disponível.
- Considerar multiplicador de demanda extra quando aplicável.

### Detalhes técnicos
- Criar função auxiliar `calcExpectedPoints(task, configMap, pmTagsMap)` que retorna a pontuação que a tarefa valeria no prazo.
- O dropdown mostrará: Auto | Forçar +{expected} | Forçar 0 | Forçar -{penalty}.

