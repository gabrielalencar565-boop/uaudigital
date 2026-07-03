## Melhoria no widget de Menções

Adicionar controle de leitura e limpeza automática das menções no widget "Menções" do Meu Painel.

### Comportamento
1. **Marcar como lida**: cada menção terá um botão (ícone de check) para marcar como lida manualmente.
2. **Auto-marcar ao clicar**: ao clicar na menção para abrir a tarefa, ela é marcada como lida automaticamente (já acontece no sino de notificações — mesmo padrão).
3. **Sumir após 24h de lida**: menções marcadas como lidas há mais de 24h deixam de aparecer no widget.
4. **Remover (dispensar)**: cada menção terá um botão (ícone X) para remover imediatamente do widget, sem esperar 24h.
5. **Visual**: menções não lidas ganham um leve destaque (bg sutil + bolinha), lidas ficam esmaecidas — consistente com o dropdown de notificações.

### Detalhes técnicos
- Reutilizar a tabela `notification_reads` já existente (usada pelo `NotificationsDropdown`), com chave `mention-{comment_id}` — assim uma menção marcada como lida em qualquer um dos dois lugares fica sincronizada.
- Adicionar nova tabela `notification_dismissals` (`user_id`, `notification_key`, `dismissed_at`) para o "remover", separada de `notification_reads` para não afetar o contador de não-lidas do sino.
- Filtragem no `MentionsWidget`:
  - Excluir menções presentes em `notification_dismissals`.
  - Excluir menções lidas há mais de 24h (`read_at < now() - 24h`). Requer adicionar coluna `read_at` (timestamp) em `notification_reads` — hoje só existe a chave; usar `updated_at`/`created_at` da linha se já houver, senão adicionar.
- UI: botões pequenos (Check e X do lucide) aparecendo no hover de cada item, seguindo o estilo compacto atual do widget.

### Arquivos afetados
- `src/features/meu-painel/components/MentionsWidget.tsx` — filtros, estado de lida, botões de ação, invalidação de queries.
- Migração no backend — nova tabela `notification_dismissals` + coluna de timestamp em `notification_reads` se necessário, com RLS e GRANTs.

### Não será alterado
- `NotificationsDropdown` (sino) — continua funcionando igual; se a menção foi marcada como lida lá, some do widget após 24h automaticamente.
- Lógica de menções/comentários em si.
