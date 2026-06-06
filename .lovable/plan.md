## Timeline horizontal de recompensas

Substituir a barra "Progresso para o Próximo Nível" atual por uma timeline horizontal com marcos para cada recompensa cadastrada na loja.

### Comportamento

- Linha horizontal atravessando o header roxo, com um marco (bolinha) por recompensa, ordenadas por XP crescente.
- Trecho preenchido (verde/teal, mesma cor da barra atual) vai de 0 até a posição do XP atual do usuário.
- Cada marco mostra abaixo: ícone (emoji da recompensa) + nome + custo em XP.
- Estados do marco:
  - **Conquistado** (XP do usuário ≥ custo): bolinha preenchida, ícone destacado, leve glow.
  - **Próximo** (primeira recompensa ainda não conquistada): bolinha pulsante com anel, label em destaque.
  - **Futuro**: bolinha vazia/translúcida, texto com opacidade reduzida.
- Mantém o badge de XP atual à esquerda e "faltam X XP para [próximo prêmio]" à direita.
- Scroll horizontal interno quando houver muitas recompensas (>8) para não estourar no mobile.
- Hover/tap em cada marco mostra tooltip com nome completo + XP.

### Posicionamento

Dentro do mesmo card roxo do header "Vitrine de Prêmios", substituindo o bloco atual com `Progress` + textos "100.0%" / "959.000 XP" / "-958.900 XP para próximo nível". Header (título + botões Infinito/Ver todos/Ranking) permanece igual.

### Detalhes técnicos

- Componente novo `RewardsTimeline.tsx` em `src/features/recompensas/`.
- Consome a mesma query de `rewards` já usada no `RecompensasPanel` (lista de prêmios com `xp_cost`, `icon`, `name`) + XP atual do usuário.
- Posição de cada marco = `(reward.xp_cost / maxXp) * 100%` onde `maxXp` = maior custo da loja.
- Posição do preenchimento = `min(userXp, maxXp) / maxXp * 100%`.
- Tokens do design system (purple HSL 263 70% 50%, `--success` para preenchido). Sem cores hardcoded.
- Tooltip via `@/components/ui/tooltip`.
- Animação suave do fill ao mudar XP (`transition-all duration-500`).
- Responsivo: em telas <768px, scroll-x com snap nos marcos.

### Arquivos

- **Criar:** `src/features/recompensas/RewardsTimeline.tsx`
- **Editar:** `src/features/recompensas/RecompensasPanel.tsx` — substituir o bloco do progress atual pelo `<RewardsTimeline />`.
