-- =====================================================================
-- ITAC LOVE — v1.1: fotos (visualização única) e áudio no chat,
-- perguntas no perfil e "Quem curtiu você" (benefício VIP)
-- =====================================================================

-- ---------------------------------------------------------------- perfil
alter table public.profiles add column if not exists prompts jsonb not null default '[]'
  check (jsonb_typeof(prompts) = 'array' and jsonb_array_length(prompts) <= 3);

-- ---------------------------------------------------------------- mídia no chat
alter table public.messages add column if not exists media_type text check (media_type in ('image','audio'));
alter table public.messages add column if not exists media_path text;
alter table public.messages add column if not exists view_once boolean not null default false;
alter table public.messages add column if not exists viewed_at timestamptz;
alter table public.messages add column if not exists duration_sec int check (duration_sec between 0 and 180);
alter table public.messages drop constraint if exists messages_body_check;
alter table public.messages add constraint messages_body_check check (char_length(body) <= 2000);
alter table public.messages drop constraint if exists messages_media_check;
alter table public.messages add constraint messages_media_check check (
  (media_type is null and media_path is null and char_length(body) > 0)
  or (media_type is not null and media_path is not null));

create or replace function public.is_conv_participant(p_conv uuid) returns boolean
language sql stable security definer set search_path = public, extensions as $$
  select exists (select 1 from public.conversations c where c.id = p_conv and auth.uid() in (c.user_a, c.user_b))
$$;

create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare c public.conversations; other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null or c.closed_at is not null then raise exception 'CONVERSA_ENCERRADA'; end if;
  -- Mensagens de usuário (as do sistema vêm das funções do servidor; o RLS impede o usuário de criá-las)
  if new.kind = 'text' then
    if new.sender_id is null or auth.uid() is null or new.sender_id is distinct from auth.uid() or auth.uid() not in (c.user_a, c.user_b) then raise exception 'NAO_PARTICIPANTE'; end if;
    other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
    if public.is_blocked_between(auth.uid(), other) then raise exception 'CONVERSA_ENCERRADA'; end if;
    if new.media_path is not null and new.media_path not like c.id::text || '/%' then raise exception 'CAMINHO_INVALIDO'; end if;
    if new.media_type is distinct from 'image' then new.view_once := false; end if;
  end if;
  new.created_at := now(); new.read_at := null; new.viewed_at := null;
  if c.self_destruct_seconds is not null then new.expires_at := now() + make_interval(secs => c.self_destruct_seconds); end if;
  return new;
end $$;

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
declare c public.conversations; other uuid; nm text;
begin
  if new.kind <> 'text' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  if c.match_id is not null then
    update public.matches set first_message_at = now() where id = c.match_id and first_message_at is null;
  end if;
  other := case when c.user_a = new.sender_id then c.user_b else c.user_a end;
  select name into nm from public.profiles where id = new.sender_id;
  perform public.notify(other, 'message', coalesce(nm,'Nova mensagem'),
    case new.media_type when 'image' then '📷 Enviou uma foto' when 'audio' then '🎤 Enviou um áudio' else left(new.body, 80) end,
    jsonb_build_object('conversation_id', c.id));
  return new;
end $$;

-- Abre a foto de visualização única (só quem recebeu, uma única vez)
create or replace function public.open_view_once(p_msg uuid) returns text
language plpgsql security definer set search_path = public, extensions as $$
declare m public.messages;
begin
  select * into m from public.messages where id = p_msg for update;
  if m.id is null or not public.is_conv_participant(m.conversation_id) then raise exception 'NAO_PARTICIPANTE'; end if;
  if not m.view_once then return m.media_path; end if;
  if m.sender_id = auth.uid() then raise exception 'SO_DESTINATARIO'; end if;
  if m.viewed_at is not null then raise exception 'JA_VISUALIZADA'; end if;
  update public.messages set viewed_at = now(), read_at = coalesce(read_at, now()) where id = p_msg;
  return m.media_path;
end $$;

drop function if exists public.my_conversations();
create function public.my_conversations() returns table (
  conversation_id uuid, match_id uuid, other_id uuid, other_name text, other_photo text, other_verified boolean,
  expires_at timestamptz, first_message_at timestamptz, self_destruct_seconds int,
  last_body text, last_at timestamptz, unread int, created_at timestamptz)
language sql stable security definer set search_path = public, extensions as $$
  select c.id, c.match_id, o.id, o.name,
    (select storage_path from public.profile_photos where user_id = o.id order by position limit 1), o.verified,
    m.expires_at, m.first_message_at, c.self_destruct_seconds,
    case lm.media_type when 'image' then '📷 Foto' when 'audio' then '🎤 Áudio' else lm.body end, lm.created_at,
    (select count(*)::int from public.messages x where x.conversation_id = c.id and x.sender_id = o.id and x.read_at is null),
    c.created_at
  from public.conversations c
  join public.profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join public.matches m on m.id = c.match_id
  left join lateral (select body, media_type, created_at from public.messages where conversation_id = c.id order by created_at desc limit 1) lm on true
  where auth.uid() in (c.user_a, c.user_b) and c.closed_at is null
    and (m.id is null or m.status = 'active')
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- Bucket privado das mídias do chat: chat/<conversation_id>/<arquivo>
insert into storage.buckets (id, name, public) values ('chat','chat', false) on conflict (id) do nothing;
drop policy if exists "chat upload" on storage.objects;
create policy "chat upload" on storage.objects for insert
  with check (bucket_id = 'chat' and public.is_conv_participant(((storage.foldername(name))[1])::uuid));
drop policy if exists "chat read" on storage.objects;
create policy "chat read" on storage.objects for select using (
  bucket_id = 'chat' and public.is_conv_participant(((storage.foldername(name))[1])::uuid)
  and not exists (select 1 from public.messages m where m.media_path = storage.objects.name
                  and m.view_once and m.viewed_at is not null and m.viewed_at < now() - interval '2 minutes'));
drop policy if exists "chat delete" on storage.objects;
create policy "chat delete" on storage.objects for delete
  using (bucket_id = 'chat' and public.is_conv_participant(((storage.foldername(name))[1])::uuid));

-- ---------------------------------------------------------------- feed com perguntas
drop function if exists public.get_feed(int, int, int, text[], text[], int[], int);
create function public.get_feed(
  p_min_age int default 18, p_max_age int default 99, p_max_km int default null,
  p_genders text[] default null, p_looking text[] default null, p_tags int[] default null, p_limit int default 20)
returns table (id uuid, name text, age int, city text, bio text, looking_for text, gender_identity text,
               verified boolean, distance_km int, affinity int, common_tags int[], tags int[], photos text[], prompts jsonb)
language plpgsql stable security definer set search_path = public, extensions as $$
declare me public.profiles; my_group text;
begin
  me := public.require_approved();
  my_group := public.gender_group(me.gender_identity);
  return query
  with cand as (
    select p.*,
      case when me.lat is not null and p.lat is not null then
        round(6371 * acos(least(1, cos(radians(me.lat))*cos(radians(p.lat))*cos(radians(p.lng)-radians(me.lng)) + sin(radians(me.lat))*sin(radians(p.lat)))))::int
      end as dist
    from public.profiles p
    where p.status = 'approved' and not p.paused and p.id <> me.id
      and public.gender_group(p.gender_identity) = any(coalesce(p_genders, me.show_genders))
      and (coalesce(array_length(p.show_genders,1),0) = 0 or my_group = any(p.show_genders))
      and public.age_of(p.birth_date) between p_min_age and p_max_age
      and (p_looking is null or p.looking_for = any(p_looking))
      and not exists (select 1 from public.likes l where l.from_id = me.id and l.to_id = p.id)
      and not public.is_blocked_between(me.id, p.id)
      and (not p.invisible or exists (select 1 from public.likes l2 where l2.from_id = p.id and l2.to_id = me.id and l2.kind = 'like'))
      and (p_tags is null or exists (select 1 from public.profile_interests pi where pi.user_id = p.id and pi.tag_id = any(p_tags)))
  )
  select c.id, c.name, public.age_of(c.birth_date), c.city, c.bio, c.looking_for, c.gender_identity, c.verified, c.dist,
         public.affinity(me.id, c.id),
         array(select x.tag_id from public.profile_interests x join public.profile_interests y on y.tag_id = x.tag_id and y.user_id = me.id where x.user_id = c.id),
         array(select x.tag_id from public.profile_interests x where x.user_id = c.id),
         array(select ph.storage_path from public.profile_photos ph where ph.user_id = c.id order by ph.position),
         c.prompts
  from cand c
  where p_max_km is null or c.dist is null or c.dist <= p_max_km
  order by public.affinity(me.id, c.id) desc, random()
  limit p_limit;
end $$;

create or replace view public.public_profiles as
  select p.id, p.name, public.age_of(p.birth_date) as age, p.city, p.bio, p.looking_for,
         p.gender_identity, p.gender_other, p.verified,
         array(select tag_id from public.profile_interests i where i.user_id = p.id) as tags,
         array(select storage_path from public.profile_photos f where f.user_id = p.id order by position) as photos,
         p.prompts
  from public.profiles p
  where p.status = 'approved'
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'approved')
    and not public.is_blocked_between(auth.uid(), p.id);
grant select on public.public_profiles to authenticated;

-- ---------------------------------------------------------------- quem curtiu você (VIP)
-- Todos veem QUANTAS pessoas curtiram; só VIP vê QUEM.
create or replace function public.who_liked_me() returns jsonb
language plpgsql stable security definer set search_path = public, extensions as $$
declare me public.profiles; is_vip boolean; total int; people jsonb;
begin
  me := public.require_approved();
  is_vip := me.vip_until is not null and me.vip_until > now();
  with fans as (
    select p.*, l.created_at as liked_at from public.likes l join public.profiles p on p.id = l.from_id
    where l.to_id = me.id and l.kind = 'like' and p.status = 'approved'
      and not exists (select 1 from public.likes mine where mine.from_id = me.id and mine.to_id = p.id)
      and not public.is_blocked_between(me.id, p.id))
  select count(*), case when is_vip then coalesce(jsonb_agg(jsonb_build_object(
      'id', f.id, 'name', f.name, 'age', public.age_of(f.birth_date), 'city', f.city, 'verified', f.verified,
      'affinity', public.affinity(me.id, f.id), 'liked_at', f.liked_at,
      'photos', (select jsonb_agg(storage_path order by position) from public.profile_photos where user_id = f.id))
      order by f.liked_at desc), '[]') else '[]' end
  into total, people from fans f;
  return jsonb_build_object('vip', is_vip, 'count', total, 'people', people);
end $$;

-- ---------------------------------------------------------------- permissões
do $$ declare f record; begin
  for f in select p.oid::regprocedure as sig, p.proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' loop
    execute format('alter function %s set search_path = public, extensions', f.sig);
    execute format('revoke execute on function %s from public, anon', f.sig);
    if f.proname not in ('notify','system_message','consume_quota','quota_limits','handle_new_user','credit_payment') and f.proname not like 'job\_%' then
      execute format('grant execute on function %s to authenticated', f.sig);
    end if;
  end loop;
  execute 'grant execute on function public.safe_date_public(text) to anon';
end $$;
