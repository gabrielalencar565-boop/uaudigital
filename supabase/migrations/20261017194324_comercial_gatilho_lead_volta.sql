-- Novo gatilho de automação: "Lead que já existe manda nova mensagem" (type 'msg_back', com 'hours' = horas sem falar, 24 por padrão).
-- Dispara quando quem já era lead escreve de novo depois de ficar pelo menos esse tempo sem falar, e não repete se a mesma automação ainda está rodando ou esperando para aquele lead.
create or replace function pg_temp.patch_fn(p_sig text, p_old text, p_new text)
returns void
language plpgsql
as $fn$
declare d text;
begin
  d := pg_get_functiondef(p_sig::regprocedure);
  if position(p_old in d) = 0 then raise exception 'patch em %: trecho não encontrado: %', p_sig, p_old; end if;
  execute replace(d, p_old, p_new);
end;
$fn$;

select pg_temp.patch_fn('public.comercial_fire(text,uuid,jsonb)',
$old$      and (p_type <> 'stage' or trigger ->> 'stage' = p_param ->> 'stage')
$old$,
$new$      and (p_type <> 'stage' or trigger ->> 'stage' = p_param ->> 'stage')
      and (p_type <> 'msg_back' or coalesce((trigger ->> 'hours')::numeric, 24) <= coalesce((p_param ->> 'silence_hours')::numeric, 0))
      and (p_type <> 'msg_back' or not exists (
        select 1 from public.comercial_automation_runs r
        where r.automation_id = comercial_automations.id and r.lead_id = l.id and r.status in ('running', 'waiting')))
$new$);

select pg_temp.patch_fn('public.comercial_wa_inbound()', $old$  v_name text;
begin$old$, $new$  v_name text;
  v_prev timestamptz;
begin$new$);

select pg_temp.patch_fn('public.comercial_wa_inbound()', $old$    else
      update public.comercial_leads
      set last_message_at = new.created_at,$old$, $new$    else
      select last_message_at into v_prev from public.comercial_leads where id = v_lead;
      update public.comercial_leads
      set last_message_at = new.created_at,$new$);

select pg_temp.patch_fn('public.comercial_wa_inbound()', $old$        perform public.comercial_run_resume(v_run, true, new.body);
      end loop;
    end if;$old$, $new$        perform public.comercial_run_resume(v_run, true, new.body);
      end loop;
      -- quem já era lead escreveu de novo depois de um tempo sem falar: gatilho "lead que volta"
      perform public.comercial_fire('msg_back', v_lead, jsonb_build_object(
        'silence_hours', case when v_prev is null then 100000 else extract(epoch from (new.created_at - v_prev)) / 3600 end));
    end if;$new$);
