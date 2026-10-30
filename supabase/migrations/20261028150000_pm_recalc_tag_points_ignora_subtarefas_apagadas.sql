-- _pm_recalc_tag_points_impl somava também as subtarefas apagadas (deleted_at) da tarefa-mãe:
-- ex.: Doce Rio - Vídeo - Outubro tinha 9 subtarefas ativas e 20 apagadas e gravava 35 pontos em vez de 11.
-- Só passa a contar subtarefas ativas. Não altera nenhum ponto já gravado: vale nos próximos cálculos.
DO $$
DECLARE
  d text;
  patched text;
BEGIN
  d := pg_get_functiondef('public._pm_recalc_tag_points_impl(uuid)'::regprocedure);
  IF d LIKE '%sub.deleted_at IS NULL%' THEN
    RETURN;
  END IF;
  patched := regexp_replace(
    d,
    'WHERE sub\.parent_task_id = _pm_task_id(\s+)AND \(v_scoring_assignee',
    E'WHERE sub.parent_task_id = _pm_task_id\\1AND sub.deleted_at IS NULL\\1AND (v_scoring_assignee'
  );
  IF patched = d THEN
    RAISE EXCEPTION 'trecho esperado não encontrado em _pm_recalc_tag_points_impl';
  END IF;
  EXECUTE patched;
END $$;
