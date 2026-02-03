-- Permitir que TODOS os usuários autenticados vejam as pontuações de desempenho
-- (Pontuação e ranking são públicos conforme regra de negócio)

-- Remove as policies restritivas de leitura
DROP POLICY IF EXISTS "Users can read own performance" ON public.performance_scores;
DROP POLICY IF EXISTS "Admins can read performance" ON public.performance_scores;

-- Cria nova policy que permite leitura para todos os autenticados
CREATE POLICY "Performance scores readable by all authenticated"
ON public.performance_scores
FOR SELECT
TO authenticated
USING (true);