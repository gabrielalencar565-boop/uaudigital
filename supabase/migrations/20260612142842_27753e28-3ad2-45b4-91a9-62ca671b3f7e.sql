
CREATE TABLE IF NOT EXISTS public.ops_db_health_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  connections int,
  max_connections int,
  db_size_bytes bigint,
  wal_size_bytes bigint,
  rollbacks bigint,
  commits bigint,
  deadlocks bigint,
  note text
);
GRANT SELECT ON public.ops_db_health_snapshots TO authenticated;
GRANT ALL ON public.ops_db_health_snapshots TO service_role;
ALTER TABLE public.ops_db_health_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops health admin read" ON public.ops_db_health_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE TABLE IF NOT EXISTS public.ops_top_queries_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  snapshot_at timestamptz NOT NULL DEFAULT now(),
  rank int NOT NULL,
  queryid bigint,
  calls bigint,
  total_ms numeric,
  mean_ms numeric,
  rows bigint,
  query text
);
CREATE INDEX IF NOT EXISTS idx_ops_top_queries_snapshot_at ON public.ops_top_queries_snapshots(snapshot_at DESC);
GRANT SELECT ON public.ops_top_queries_snapshots TO authenticated;
GRANT ALL ON public.ops_top_queries_snapshots TO service_role;
ALTER TABLE public.ops_top_queries_snapshots ENABLE ROW LEVEL SECURITY;
CREATE POLICY "ops top queries admin read" ON public.ops_top_queries_snapshots
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE OR REPLACE FUNCTION public.ops_capture_snapshot(_note text DEFAULT NULL)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, pg_catalog
AS $$
DECLARE
  v_conns int;
  v_max int;
  v_db_size bigint;
  v_wal_size bigint;
  v_rollbacks bigint;
  v_commits bigint;
  v_deadlocks bigint;
BEGIN
  SELECT count(*) INTO v_conns FROM pg_stat_activity;
  SELECT setting::int INTO v_max FROM pg_settings WHERE name = 'max_connections';
  SELECT pg_database_size(current_database()) INTO v_db_size;
  BEGIN
    SELECT COALESCE(sum(size), 0) INTO v_wal_size FROM pg_ls_waldir();
  EXCEPTION WHEN OTHERS THEN v_wal_size := NULL;
  END;
  SELECT COALESCE(sum(xact_rollback),0), COALESCE(sum(xact_commit),0), COALESCE(sum(deadlocks),0)
    INTO v_rollbacks, v_commits, v_deadlocks
  FROM pg_stat_database WHERE datname = current_database();

  INSERT INTO public.ops_db_health_snapshots(connections, max_connections, db_size_bytes, wal_size_bytes, rollbacks, commits, deadlocks, note)
  VALUES (v_conns, v_max, v_db_size, v_wal_size, v_rollbacks, v_commits, v_deadlocks, _note);

  INSERT INTO public.ops_top_queries_snapshots(rank, queryid, calls, total_ms, mean_ms, rows, query)
  SELECT
    row_number() OVER (ORDER BY s.total_exec_time DESC)::int AS rank,
    s.queryid,
    s.calls,
    round(s.total_exec_time::numeric, 2),
    round(s.mean_exec_time::numeric, 3),
    s.rows,
    left(s.query, 800)
  FROM extensions.pg_stat_statements s
  JOIN pg_database d ON d.oid = s.dbid AND d.datname = current_database()
  WHERE s.query NOT ILIKE '%pg_stat_statements%'
    AND s.query NOT ILIKE '%ops_capture_snapshot%'
  ORDER BY s.total_exec_time DESC
  LIMIT 15;
END;
$$;
