-- =====================================================================
-- ITAC LOVE — Tempo real e rotinas automáticas
-- No Supabase: Database > Extensions > ative "pg_cron" (e "pg_net" para a fase 2).
-- =====================================================================

-- Tempo real (chat, notificações e status da verificação)
do $$ begin
  begin alter publication supabase_realtime add table public.messages;      exception when others then null; end;
  begin alter publication supabase_realtime add table public.notifications; exception when others then null; end;
  begin alter publication supabase_realtime add table public.conversations; exception when others then null; end;
  begin alter publication supabase_realtime add table public.profiles;      exception when others then null; end;
end $$;

grant execute on function public.job_safe_dates() to service_role;
grant execute on function public.credit_payment(text) to service_role;

create extension if not exists pg_cron;

-- Remove agendamentos antigos com o mesmo nome (para poder rodar de novo)
do $$ declare j text; begin
  foreach j in array array['itac-expire-matches','itac-match-reminders','itac-purge-messages','itac-trust-gain','itac-safe-dates'] loop
    begin perform cron.unschedule(j); exception when others then null; end;
  end loop;
end $$;

select cron.schedule('itac-expire-matches',  '*/5 * * * *', $$ select public.job_expire_matches() $$);
select cron.schedule('itac-match-reminders', '*/10 * * * *', $$ select public.job_match_reminders() $$);
select cron.schedule('itac-purge-messages',  '* * * * *',   $$ select public.job_purge_messages() $$);
select cron.schedule('itac-trust-gain',      '0 4 * * *',   $$ select public.job_trust_gain() $$);   -- 01:00 Brasília

-- Encontro seguro: o check-in roda no servidor a cada minuto, mesmo com app/navegador fechado.
-- Fase 2: trocar pela chamada à Edge Function "safe-dates", que também envia SMS/WhatsApp aos contatos:
--   select net.http_post(url := '<URL_DO_PROJETO>/functions/v1/safe-dates',
--                        headers := '{"Authorization":"Bearer <SERVICE_ROLE_KEY>"}'::jsonb);
select cron.schedule('itac-safe-dates', '* * * * *', $$ select public.job_safe_dates() $$);
