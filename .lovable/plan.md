

## Proteger pontuação de tarefas anteriores ao alterar critérios

### Problema atual

Quando os critérios de pontuação são alterados em `scoring_config`, a função `recompute_all_scores` recalcula tarefas concluídas que **não possuem snapshot** (`point_value IS NULL`) usando os **novos valores**, alterando retroativamente a pontuação dos colaboradores.

### Solução

Ao salvar alterações nos critérios, **antes** de atualizar a `scoring_config`, executar uma função que grava o `point_value` (snapshot) em todas as tarefas concluídas que ainda não possuem snapshot. Assim, quando o recompute rodar com os novos valores, essas tarefas antigas preservam a pontuação original.

---

### Etapa 1 — Criar função de snapshot no banco

**Migração SQL**: Criar `snapshot_unscored_tasks()` que, para cada tarefa concluída com `point_value IS NULL`, calcula e grava o valor usando a configuração **atual** (antes da mudança).

```sql
CREATE OR REPLACE FUNCTION public.snapshot_unscored_tasks()
RETURNS integer  -- retorna quantas tarefas foram atualizadas
LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $$
DECLARE
  v_count integer;
BEGIN
  UPDATE public.tasks t
  SET point_value = (
    COALESCE(sc.base_points, 1)
    * CASE WHEN COALESCE(sc.uses_quantity, false) THEN COALESCE(t.quantity, 1) ELSE 1 END
    * CASE WHEN t.is_extra_demand AND COALESCE(sc.uses_quantity, false) 
           THEN COALESCE(sc.extra_demand_multiplier, 1.5) ELSE 1 END
  )
  FROM public.scoring_config sc
  WHERE sc.stage = t.stage::text
    AND t.status = 'concluido'
    AND t.deleted_at IS NULL
    AND t.point_value IS NULL
    AND t.completed_at IS NOT NULL;

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;
```

### Etapa 2 — Alterar fluxo de salvamento no painel

**Arquivo: `src/features/admin/AdminPontuacaoPanel.tsx`**

- Adicionar um banner informativo permanente explicando que alterações afetam apenas novas tarefas
- No `saveMut`, **antes** de atualizar as linhas da `scoring_config`, chamar `supabase.rpc('snapshot_unscored_tasks')` para congelar as pontuações existentes
- Exibir um toast com quantas tarefas foram protegidas (ex: "42 tarefas anteriores protegidas")

```text
Fluxo de salvamento:
1. Chamar snapshot_unscored_tasks() → congela tarefas antigas
2. Atualizar scoring_config com os novos valores
3. Toast de sucesso com contagem
```

### Etapa 3 — Banner informativo na UI

Adicionar um `Alert` abaixo do título do painel:

> "Alterações nos critérios afetam apenas tarefas futuras. Tarefas já concluídas mantêm a pontuação original automaticamente."

---

### Arquivos alterados

| Arquivo | Tipo |
|---|---|
| Nova migração SQL | Criar função `snapshot_unscored_tasks` |
| `src/features/admin/AdminPontuacaoPanel.tsx` | Chamar RPC antes de salvar + banner informativo |

