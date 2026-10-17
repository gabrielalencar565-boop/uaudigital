-- Áudios que a equipe envia pelo CRM: guardados num bucket privado, em uma pasta por agência (<agency_id>/<arquivo>.mp3).
-- Só quem é da mesma agência consegue ouvir (a tela pede um link temporário); quem grava é a função do servidor.
insert into storage.buckets (id, name, public, file_size_limit)
values ('crm-chat-audio', 'crm-chat-audio', false, 10485760)
on conflict (id) do nothing;

create policy "crm_chat_audio_read" on storage.objects for select to authenticated
  using (bucket_id = 'crm-chat-audio' and (storage.foldername(name))[1] = (select public.current_agency_id())::text);
