

# Plano: Dashboard de Squad — Dados reais do Magic Number + Funções por Colaborador

## Resumo

Três mudanças principais no `SquadDashboardDialog.tsx`:

1. **Desempenho por Cliente** — baseado nas 7 etapas do Magic Number (não em tarefas genéricas). Barra de progresso colorida: vermelho (<50%), amarelo (50-99%), verde (100%).

2. **Produtividade por Colaborador** — filtrada pelas etapas da função de cada pessoa:
   - **Social Media**: planejamento, pdf, alterações, agendamento
   - **Videomaker**: captação, edicao_videos
   - **Designer**: design
   
   O `role_title` do `teamMap` será usado para mapear a função. As etapas exibidas e contabilizadas serão apenas as da responsabilidade da pessoa.

3. **Maximizar seções** — cada bloco (Evolução por Etapa, Produtividade por Colaborador, Desempenho por Cliente) terá um botão de maximizar que expande a seção em tela cheia (Dialog dentro de Dialog, ou estado fullscreen por seção).

## Detalhes técnicos

### Arquivo: `src/features/projetos/components/SquadDashboardDialog.tsx`

**Mapeamento de funções → etapas:**
```typescript
const ROLE_STAGES: Record<string, string[]> = {
  "social media": ["planejamento", "pdf", "alteracoes", "agendamento"],
  "videomaker": ["captacao", "edicao_videos"],
  "designer": ["design"],
};

function getRoleStages(roleTitle: string): string[] {
  const normalized = roleTitle.toLowerCase().trim();
  for (const [key, stages] of Object.entries(ROLE_STAGES)) {
    if (normalized.includes(key)) return stages;
  }
  return STAGE_ORDER; // fallback: todas
}
```

**Produtividade por Colaborador:**
- Para cada membro, filtrar `squadStages` por `completed_by === uid` E `stage` dentro das etapas da sua função.
- Total possível = nº de clientes do squad × nº de etapas da função.
- Mostrar percentual e barra de progresso com cor baseada no progresso.

**Desempenho por Cliente:**
- Cada cliente tem 7 etapas no Magic Number.
- Contar `completed` stages do ciclo atual.
- Barra: vermelho se `<50%`, amarelo se `50-99%`, verde se `100%`.
- Mostrar badge "Completo" verde ou "Em andamento" amarelo/vermelho.

**Maximizar seções:**
- Adicionar estado `maximizedSection: string | null` ("stages" | "productivity" | "clients").
- Quando ativo, renderizar a seção em um Dialog fullscreen dedicado com botão de fechar.
- Ícone `Maximize2` no header de cada seção.

### Arquivo: `src/features/projetos/components/VisaoGeralTab.tsx`
- Nenhuma mudança necessária — os dados já são passados corretamente (squadStages contém `completed_by` e `stage`).

