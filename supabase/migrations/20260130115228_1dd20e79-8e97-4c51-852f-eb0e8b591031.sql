-- Garantir que o usuário principal tenha papel admin também no ambiente publicado
-- (dados do ambiente de teste não são sincronizados automaticamente para o publicado)

insert into public.user_roles (user_id, role)
values ('e140cfe0-bd4e-4793-a3f2-258b726b1de9', 'admin')
on conflict do nothing;

update public.access_requests
set status = 'approved',
    decided_at = now(),
    decided_by = 'e140cfe0-bd4e-4793-a3f2-258b726b1de9'
where user_id = 'e140cfe0-bd4e-4793-a3f2-258b726b1de9'
  and status = 'pending';
