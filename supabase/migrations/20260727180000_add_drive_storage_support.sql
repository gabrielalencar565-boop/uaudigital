-- Adiciona suporte a Google Drive como provedor de armazenamento alternativo
-- para anexos (fotos/vídeos de clientes), para não depender só da cota de
-- Storage do Supabase.

ALTER TABLE public.pm_attachments
  ADD COLUMN IF NOT EXISTS storage_provider text NOT NULL DEFAULT 'supabase',
  ADD COLUMN IF NOT EXISTS drive_file_id text;

ALTER TABLE public.pm_attachments
  ADD CONSTRAINT pm_attachments_storage_provider_check
  CHECK (storage_provider IN ('supabase', 'drive', 'missing'));

CREATE INDEX IF NOT EXISTS idx_pm_attachments_storage_provider ON public.pm_attachments (storage_provider);

-- Drive-hosted attachments have no Supabase storage path.
ALTER TABLE public.pm_attachments ALTER COLUMN storage_path DROP NOT NULL;
