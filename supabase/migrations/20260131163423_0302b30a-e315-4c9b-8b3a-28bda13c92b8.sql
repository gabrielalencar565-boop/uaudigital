-- ============================================================
-- Phase 3: Add planner role to app_role enum
-- ============================================================
ALTER TYPE public.app_role ADD VALUE IF NOT EXISTS 'planner';