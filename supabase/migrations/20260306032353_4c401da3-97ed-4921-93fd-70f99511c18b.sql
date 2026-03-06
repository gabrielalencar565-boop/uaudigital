
-- Add missing stage values to pm_stage enum to sync with stage_type (agenda)
ALTER TYPE public.pm_stage ADD VALUE IF NOT EXISTS 'edicao_videos';
ALTER TYPE public.pm_stage ADD VALUE IF NOT EXISTS 'pdf';
ALTER TYPE public.pm_stage ADD VALUE IF NOT EXISTS 'alteracoes';
ALTER TYPE public.pm_stage ADD VALUE IF NOT EXISTS 'agendamento';
