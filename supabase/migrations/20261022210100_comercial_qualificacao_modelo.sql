-- Qualificação UAU: acerta o texto padrão das respostas no fluxo e cria a automação nova, PAUSADA, ao lado da "Boas-vindas ao lead" (que não é apagada nem mexida).
create or replace function public.comercial_fill2(p_text text, p_lead public.comercial_leads, p_vars jsonb)
returns text
language plpgsql
stable
set search_path = ''
as $fn$
declare
  v text := coalesce(p_text, '');
  k text;
  x text;
  v_src text := case when coalesce(p_lead.source, '') ilike '%meta%' then 'Meta Ads'
                     when coalesce(p_lead.source, '') in ('', 'WhatsApp') then 'WhatsApp orgânico'
                     else p_lead.source end;
begin
  for k, x in select key, value from jsonb_each_text(coalesce(p_vars -> 'answers', '{}'::jsonb)) loop
    v := replace(v, '{' || k || '}', coalesce(nullif(btrim(x), ''), '—'));
  end loop;
  v := replace(v, '{resposta}', coalesce(nullif(btrim(p_vars ->> 'answer'), ''), '—'));
  v := replace(v, '{origem}', v_src);
  v := regexp_replace(v, '\{(segmento|momento|objetivo|objetivo_lead)\}', '—', 'g');
  return public.comercial_fill(v, p_lead);
end;
$fn$;

insert into public.comercial_automations (agency_id, name, trigger, steps, active)
select distinct a.agency_id, 'Qualificação UAU (WhatsApp)', $j${"type": "msg_in"}$j$::jsonb, $j$[{"id": "bmvjyogmq26ta", "type": "cond", "field": "business_hours", "value": "nao", "yes": [{"id": "bmvjyogmq10zy", "type": "msg", "text": "Oi! Aqui é a UAU Digital 😊 Nosso time responde em horário comercial, mas já vou adiantando seu atendimento por aqui."}], "no": []}, {"id": "bmvjyogmq3hpu", "type": "ask", "text": "Oi, {nome}! Aqui é a UAU Digital 😊 Pra eu te direcionar certinho, você…", "options": ["Quero crescer minha empresa/marca", "Já sou cliente", "Vagas ou parcerias"], "saveTo": "triagem", "numbered": true, "strict": true, "remindAfterMin": 120, "remindText": "Oi! Ficou alguma dúvida? É só responder aqui que eu continuo 😊", "giveUpAfterMin": 1440, "giveUpTag": "Não concluiu fluxo"}, {"id": "bmvjyogmq82bw", "type": "cond", "field": "answer", "value": "cliente", "yes": [{"id": "bmvjyogmq4u9z", "type": "tag", "tag": "Cliente atual"}, {"id": "bmvjyogmq57fk", "type": "msg", "text": "Show! Vou te passar agora pro time de atendimento 💜"}, {"id": "bmvjyogmq618y", "type": "note", "text": "Já é cliente: passado para o time de atendimento."}, {"id": "bmvjyogmq712o", "type": "human", "owner": "lead"}], "no": []}, {"id": "bmvjyogmqccm7", "type": "cond", "field": "answer", "value": "vagas", "yes": [{"id": "bmvjyogmq96yt", "type": "tag", "tag": "Vagas/Parcerias"}, {"id": "bmvjyogmqack8", "type": "msg", "text": "Que legal o interesse! Envie seu contato/portfólio para [E-MAIL_OU_LINK] que nosso time analisa 😉"}, {"id": "bmvjyogmqbhtn", "type": "end"}], "no": []}, {"id": "bmvjyogmqd5u0", "type": "ask", "text": "Qual é o ramo do seu negócio?", "options": ["Saúde", "Jurídico", "Comércio/varejo", "Outro"], "saveTo": "segment", "numbered": true, "strict": true, "remindAfterMin": 120, "remindText": "Oi! Ficou alguma dúvida? É só responder aqui que eu continuo 😊", "giveUpAfterMin": 1440, "giveUpTag": "Não concluiu fluxo"}, {"id": "bmvjyogmqeqo1", "type": "tag", "tag": "Segmento: {segmento}"}, {"id": "bmvjyogmqfpno", "type": "ask", "text": "E hoje vocês já fazem marketing?", "options": ["Sim, com agência ou equipe", "Sim, por conta própria", "Ainda não"], "saveTo": "momento", "numbered": true, "strict": true, "remindAfterMin": 120, "remindText": "Oi! Ficou alguma dúvida? É só responder aqui que eu continuo 😊", "giveUpAfterMin": 1440, "giveUpTag": "Não concluiu fluxo"}, {"id": "bmvjyogmqhdq4", "type": "cond", "field": "answer", "value": "agência", "yes": [{"id": "bmvjyogmqgud3", "type": "tag", "tag": "Momento: já tem agência"}], "no": []}, {"id": "bmvjyogmqjwb9", "type": "cond", "field": "answer", "value": "própria", "yes": [{"id": "bmvjyogmqizcq", "type": "tag", "tag": "Momento: faz sozinho"}], "no": []}, {"id": "bmvjyogmqlkjv", "type": "cond", "field": "answer", "value": "ainda", "yes": [{"id": "bmvjyogmqkxd6", "type": "tag", "tag": "Momento: começando"}], "no": []}, {"id": "bmvjyogmqmb88", "type": "ask", "text": "Perfeito! Pra adiantar, me conta em uma frase: o que você mais quer melhorar no marketing hoje?", "options": [], "saveTo": "objetivo_lead", "timeoutMinutes": 10}, {"id": "bmvjyogmqppjm", "type": "cond", "field": "business_hours", "value": "sim", "yes": [{"id": "bmvjyogmqn855", "type": "msg", "text": "Anotado! Nosso comercial vai continuar com você em instantes 🙌"}], "no": [{"id": "bmvjyogmqoo5o", "type": "msg", "text": "Anotado! Nosso comercial te responde no próximo horário comercial 🙌"}]}, {"id": "bmvjyogmqqn79", "type": "tag", "tag": "Lead WhatsApp"}, {"id": "bmvjyogmqtz6r", "type": "cond", "field": "source", "value": "meta", "yes": [{"id": "bmvjyogmqrvj3", "type": "tag", "tag": "Origem: Meta Ads"}], "no": [{"id": "bmvjyogmqsouo", "type": "tag", "tag": "Origem: WhatsApp orgânico"}]}, {"id": "bmvjyogmquu7b", "type": "note", "text": "Novo lead • Ramo: {segmento} • Marketing hoje: {momento} • Objetivo: {objetivo_lead} • Origem: {origem}"}, {"id": "bmvjyogmqvy46", "type": "human", "owner": "lead"}]$j$::jsonb, false
from public.comercial_automations a
where a.name = 'Boas-vindas ao lead'
  and not exists (select 1 from public.comercial_automations b where b.agency_id = a.agency_id and b.name = 'Qualificação UAU (WhatsApp)');
