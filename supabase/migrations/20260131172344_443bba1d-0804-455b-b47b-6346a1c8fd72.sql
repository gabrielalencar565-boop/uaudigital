-- ============================================================
-- Fase 1: Limpar dados órfãos de usuários que não existem mais
-- ============================================================

-- Remove access_requests de usuários deletados do auth.users
DELETE FROM public.access_requests
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove team_members de usuários deletados
DELETE FROM public.team_members
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove profiles de usuários deletados
DELETE FROM public.profiles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove user_roles de usuários deletados
DELETE FROM public.user_roles
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- Remove task_assignees de usuários deletados
DELETE FROM public.task_assignees
WHERE user_id NOT IN (SELECT id FROM auth.users);

-- ============================================================
-- Fase 2: Criar função RPC para listar usuários com email real
-- ============================================================

CREATE OR REPLACE FUNCTION public.list_users_admin()
RETURNS TABLE (
  user_id uuid,
  email text,
  display_name text,
  role_title text,
  avatar_url text,
  is_active boolean,
  access_status public.access_request_status,
  requested_at timestamptz,
  decided_at timestamptz,
  decided_by uuid,
  access_request_id uuid
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT 
    au.id as user_id,
    au.email::text,
    COALESCE(tm.display_name, p.full_name, split_part(au.email, '@', 1)) as display_name,
    COALESCE(tm.role_title, p.role_title, 'Colaborador') as role_title,
    COALESCE(tm.avatar_url, p.avatar_url) as avatar_url,
    COALESCE(tm.is_active, true) as is_active,
    ar.status as access_status,
    ar.requested_at,
    ar.decided_at,
    ar.decided_by,
    ar.id as access_request_id
  FROM auth.users au
  LEFT JOIN public.access_requests ar ON ar.user_id = au.id
  LEFT JOIN public.team_members tm ON tm.user_id = au.id
  LEFT JOIN public.profiles p ON p.user_id = au.id
  WHERE ar.id IS NOT NULL  -- Apenas quem solicitou acesso
  ORDER BY 
    CASE ar.status 
      WHEN 'pending' THEN 1 
      WHEN 'approved' THEN 2 
      WHEN 'rejected' THEN 3 
    END,
    ar.requested_at DESC NULLS LAST
$$;

-- ============================================================
-- Fase 3: Prevenir duplicatas de clientes (nome único)
-- ============================================================

-- Adicionar índice único case-insensitive para nome do cliente
-- Primeiro, identificar e remover duplicatas mantendo a mais recente
WITH duplicates AS (
  SELECT id, name, created_at,
         ROW_NUMBER() OVER (PARTITION BY LOWER(TRIM(name)) ORDER BY created_at DESC) as rn
  FROM public.clients
)
DELETE FROM public.clients 
WHERE id IN (
  SELECT id FROM duplicates WHERE rn > 1
);

-- Agora criar o índice único
CREATE UNIQUE INDEX IF NOT EXISTS clients_name_unique_idx 
ON public.clients (LOWER(TRIM(name)));

-- ============================================================
-- Fase 4: Função para verificar se cliente já existe
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_client_exists(_name text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clients
    WHERE LOWER(TRIM(name)) = LOWER(TRIM(_name))
  )
$$;