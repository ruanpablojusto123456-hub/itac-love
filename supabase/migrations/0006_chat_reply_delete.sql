-- =====================================================================
-- ITAC LOVE — v1.2: responder uma mensagem específica e apagar mensagens
-- ("apagar para mim" e "apagar para todos", como no WhatsApp)
-- =====================================================================

alter table public.messages add column if not exists reply_to uuid references public.messages(id) on delete set null;
alter table public.messages add column if not exists deleted_for_all boolean not null default false;
alter table public.messages add column if not exists hidden_for uuid[] not null default '{}';
create index if not exists messages_reply_idx on public.messages(reply_to) where reply_to is not null;

alter table public.messages drop constraint if exists messages_media_check;
alter table public.messages add constraint messages_media_check check (
  deleted_for_all
  or (media_type is null and media_path is null and char_length(body) > 0)
  or (media_type is not null and media_path is not null));

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare c public.conversations; other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null or c.closed_at is not null then raise exception 'CONVERSA_ENCERRADA'; end if;
  if new.kind = 'text' then
    if new.sender_id is null or auth.uid() is null or new.sender_id is distinct from auth.uid() or auth.uid() not in (c.user_a, c.user_b) then raise exception 'NAO_PARTICIPANTE'; end if;
    other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
    if public.is_blocked_between(auth.uid(), other) then raise exception 'CONVERSA_ENCERRADA'; end if;
    if new.media_path is not null and new.media_path not like c.id::text || '/%' then raise exception 'CAMINHO_INVALIDO'; end if;
    if new.media_type is distinct from 'image' then new.view_once := false; end if;
    -- a resposta precisa citar uma mensagem da mesma conversa
    if new.reply_to is not null and not exists (select 1 from public.messages r where r.id = new.reply_to and r.conversation_id = c.id) then
      new.reply_to := null;
    end if;
  end if;
  new.created_at := now(); new.read_at := null; new.viewed_at := null;
  new.deleted_for_all := false; new.hidden_for := '{}';
  if c.self_destruct_seconds is not null then new.expires_at := now() + make_interval(secs => c.self_destruct_seconds); end if;
  return new;
end $$;

-- Apaga uma mensagem. Para todos: só quem enviou. Retorna o arquivo de mídia a remover (se houver).
create or replace function public.delete_message(p_msg uuid, p_for_all boolean default false) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_msg for update;
  if m.id is null or not public.is_conv_participant(m.conversation_id) then raise exception 'NAO_PARTICIPANTE'; end if;
  if m.kind <> 'text' then raise exception 'NAO_PERMITIDO'; end if;
  if p_for_all then
    if m.sender_id is distinct from auth.uid() then raise exception 'SO_QUEM_ENVIOU'; end if;
    update public.messages set deleted_for_all = true, body = '', media_type = null, media_path = null,
      view_once = false, duration_sec = null where id = m.id;
    return m.media_path;
  else
    update public.messages set hidden_for = array_append(hidden_for, auth.uid())
    where id = m.id and not (auth.uid() = any(hidden_for));
    return null;
  end if;
end $$;

create or replace function public.my_conversations() returns table (
  conversation_id uuid, match_id uuid, other_id uuid, other_name text, other_photo text, other_verified boolean,
  expires_at timestamptz, first_message_at timestamptz, self_destruct_seconds int,
  last_body text, last_at timestamptz, unread int, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.match_id, o.id, o.name,
    (select storage_path from public.profile_photos where user_id = o.id order by position limit 1), o.verified,
    m.expires_at, m.first_message_at, c.self_destruct_seconds,
    case when lm.deleted_for_all then '🚫 Mensagem apagada'
         when lm.media_type = 'image' then '📷 Foto' when lm.media_type = 'audio' then '🎤 Áudio' else lm.body end,
    lm.created_at,
    (select count(*)::int from public.messages x where x.conversation_id = c.id and x.sender_id = o.id and x.read_at is null and not x.deleted_for_all),
    c.created_at
  from public.conversations c
  join public.profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join public.matches m on m.id = c.match_id
  left join lateral (select body, media_type, deleted_for_all, created_at from public.messages
                     where conversation_id = c.id and not (auth.uid() = any(hidden_for))
                     order by created_at desc limit 1) lm on true
  where auth.uid() in (c.user_a, c.user_b) and c.closed_at is null
    and (m.id is null or m.status = 'active')
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- Tempo real: o UPDATE (apagar, lida) precisa mandar a linha completa
alter table public.messages replica identity full;

do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('messages_before_insert','delete_message','my_conversations') loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
    execute format('grant execute on function %s to authenticated', f.sig);
  end loop;
end $$;
