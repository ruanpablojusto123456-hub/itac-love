-- =====================================================================
-- ITAC LOVE — Push (notificação com o app fechado)
-- Cada notificação criada chama a Edge Function "push-dispatch" pelo pg_net.
-- A URL e o segredo ficam numa tabela privada (fora da API).
-- =====================================================================
create extension if not exists pg_net with schema extensions;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table if not exists private.push_config (id int primary key default 1 check (id = 1), function_url text not null, secret text not null);

create or replace function public.notifications_push() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare cfg record;
begin
  select * into cfg from private.push_config where id = 1;
  if cfg.function_url is not null then
    perform net.http_post(url := cfg.function_url,
      headers := jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', cfg.secret),
      body := jsonb_build_object('notification_id', new.id));
  end if;
  return new;
exception when others then
  return new; -- push nunca pode impedir a notificação de ser criada
end $$;
revoke execute on function public.notifications_push() from public, anon, authenticated;

drop trigger if exists notifications_push on public.notifications;
create trigger notifications_push after insert on public.notifications
  for each row execute function public.notifications_push();

-- A Edge Function confere o segredo por aqui (só a service_role executa)
create or replace function public.push_check(p_secret text) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from private.push_config where id = 1 and secret = p_secret)
$$;
revoke execute on function public.push_check(text) from public, anon, authenticated;
grant execute on function public.push_check(text) to service_role;

-- Configuração (rode uma vez trocando <PROJETO>):
-- insert into private.push_config (id, function_url, secret)
-- values (1, 'https://<PROJETO>.supabase.co/functions/v1/push-dispatch', encode(extensions.gen_random_bytes(24), 'hex'))
-- on conflict (id) do update set function_url = excluded.function_url;
