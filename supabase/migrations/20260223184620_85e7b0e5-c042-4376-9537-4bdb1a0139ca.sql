
-- Add a sentinel column to identify the freelancer client
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS is_freelancer_sentinel boolean NOT NULL DEFAULT false;

-- Insert the freelancer sentinel client (only if not exists)
INSERT INTO public.clients (name, magic_due_date, is_active, is_freelancer_sentinel, notes)
SELECT 'Freelancer', '2099-12-27', true, true, 'Cliente sentinela para tarefas freelancer — não remover'
WHERE NOT EXISTS (SELECT 1 FROM public.clients WHERE is_freelancer_sentinel = true);
