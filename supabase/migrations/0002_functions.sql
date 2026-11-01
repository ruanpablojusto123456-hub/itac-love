-- =====================================================================
-- ITAC LOVE — Regras de negócio no servidor (funções RPC e triggers)
-- Toda regra sensível (cotas, match, verificação, nota de confiança)
-- roda aqui, então web e APK compartilham o mesmo saldo e as mesmas regras.
-- =====================================================================

-- ---------------------------------------------------------------- helpers
create or replace function public.is_admin() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.admins where user_id = auth.uid());
$$;

create or replace function public.br_today() returns date
language sql stable as $$ select (now() at time zone 'America/Sao_Paulo')::date $$;

create or replace function public.br_next_midnight() returns timestamptz
language sql stable as $$
  select ((public.br_today() + 1)::timestamp at time zone 'America/Sao_Paulo')
$$;

create or replace function public.sha256_hex(v text) returns text
language sql immutable as $$ select encode(digest(v, 'sha256'), 'hex') $$;

-- Normaliza número de documento (só letras e números, maiúsculo)
create or replace function public.doc_hash(v text) returns text
language sql immutable as $$ select public.sha256_hex(upper(regexp_replace(coalesce(v,''), '[^0-9A-Za-z]', '', 'g'))) $$;

-- Agrupa identidade de gênero para feed e cotas
create or replace function public.gender_group(g text) returns text
language sql immutable as $$
  select case
    when g in ('mulher_cis','mulher_trans','travesti') then 'mulheres'
    when g in ('homem_cis','homem_trans') then 'homens'
    else 'nao_binarios' end
$$;

create or replace function public.age_of(d date) returns int
language sql stable as $$ select extract(year from age(public.br_today(), d))::int $$;

create or replace function public.settings() returns public.app_settings
language sql stable security definer set search_path = public as $$
  select * from public.app_settings where id = 1
$$;

create or replace function public.notify(p_user uuid, p_type text, p_title text, p_body text, p_data jsonb default '{}')
returns void language sql security definer set search_path = public as $$
  insert into public.notifications(user_id, type, title, body, data) values (p_user, p_type, p_title, p_body, coalesce(p_data,'{}'));
$$;

create or replace function public.require_approved() returns public.profiles
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'NAO_AUTENTICADO'; end if;
  if me.status = 'suspended' and me.suspended_until is not null and me.suspended_until <= now() then
    update public.profiles set status = 'approved', suspended_until = null where id = me.id;
    me.status := 'approved';
  end if;
  if me.status <> 'approved' then raise exception 'CONTA_NAO_LIBERADA'; end if;
  return me;
end $$;

-- ---------------------------------------------------- novo usuário (Auth)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  if exists (select 1 from public.banned_identifiers
             where kind = 'email' and value_hash = public.sha256_hex(lower(coalesce(new.email,'')))) then
    raise exception 'EMAIL_BANIDO';
  end if;
  insert into public.profiles (id, email, name)
  values (new.id, lower(new.email),
          coalesce(new.raw_user_meta_data->>'full_name', new.raw_user_meta_data->>'name'))
  on conflict (id) do nothing;
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- -------------------------------- proteção de colunas + validação de idade
create or replace function public.profiles_guard() returns trigger
language plpgsql as $$
begin
  -- Usuário comum não altera campos controlados pelo servidor/admin
  if current_user in ('authenticated','anon') and not public.is_admin() then
    new.status := old.status;                 new.rejection_reason := old.rejection_reason;
    new.verified := old.verified;             new.verified_at := old.verified_at;
    new.trust_score := old.trust_score;       new.trust_last_gain_at := old.trust_last_gain_at;
    new.warnings := old.warnings;             new.suspended_until := old.suspended_until;
    new.extra_likes := old.extra_likes;       new.extra_invites := old.extra_invites;
    new.vip_until := old.vip_until;           new.email := old.email;
    -- depois de aprovado, nome e data de nascimento ficam travados
    if old.verified then new.birth_date := old.birth_date; new.name := old.name; end if;
  end if;
  if new.birth_date is not null and new.birth_date > (public.br_today() - interval '18 years')::date then
    raise exception 'MENOR_DE_IDADE';
  end if;
  if new.gender_identity is distinct from 'outro' then new.gender_other := null; end if;
  new.updated_at := now();
  return new;
end $$;

drop trigger if exists profiles_guard on public.profiles;
create trigger profiles_guard before update on public.profiles
  for each row execute function public.profiles_guard();

-- --------------------------------------------- envio para verificação
create or replace function public.submit_verification(p_selfie_path text)
returns void language plpgsql security definer set search_path = public as $$
declare me public.profiles; n_photos int; n_tags int;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'NAO_AUTENTICADO'; end if;
  if me.status not in ('onboarding','needs_new_photo','rejected') then raise exception 'STATUS_INVALIDO'; end if;
  if p_selfie_path is null or p_selfie_path not like me.id::text || '/%' then raise exception 'CAMINHO_INVALIDO'; end if;
  if me.name is null or me.birth_date is null or me.gender_identity is null or me.city is null
     or me.looking_for is null or coalesce(array_length(me.show_genders,1),0) = 0 then
    raise exception 'CADASTRO_INCOMPLETO';
  end if;
  if public.age_of(me.birth_date) < 18 then raise exception 'MENOR_DE_IDADE'; end if;
  select count(*) into n_photos from public.profile_photos where user_id = me.id;
  if n_photos <> 3 then raise exception 'PRECISA_3_FOTOS'; end if;
  select count(*) into n_tags from public.profile_interests where user_id = me.id;
  if n_tags < 3 then raise exception 'PRECISA_3_INTERESSES'; end if;
  if me.terms_accepted_at is null or me.privacy_accepted_at is null then raise exception 'TERMOS_NAO_ACEITOS'; end if;

  insert into public.verifications(user_id, selfie_path) values (me.id, p_selfie_path);
  update public.profiles set status = 'pending_review', rejection_reason = null where id = me.id;
end $$;

-- --------------------------------------------- análise pelo admin
-- p_decision: 'approve' | 'reject' | 'resubmit'
-- p_document: número do RG/CNH visto na foto (guardamos só o hash) — opcional
-- Retorna o caminho da selfie para o painel apagar o arquivo do Storage.
create or replace function public.admin_review_verification(p_id uuid, p_decision text, p_reason text default null, p_document text default null)
returns text language plpgsql security definer set search_path = public as $$
declare v public.verifications; s public.app_settings; h text; other uuid;
begin
  if not public.is_admin() then raise exception 'SOMENTE_ADMIN'; end if;
  select * into v from public.verifications where id = p_id for update;
  if v.id is null or v.status <> 'pending' then raise exception 'VERIFICACAO_INVALIDA'; end if;
  s := public.settings();

  if p_decision = 'approve' and nullif(trim(p_document),'') is not null then
    h := public.doc_hash(p_document);
    if exists (select 1 from public.banned_identifiers where kind = 'document' and value_hash = h) then
      p_decision := 'ban'; p_reason := 'Documento vinculado a conta banida.';
    else
      select user_id into other from public.document_registry where doc_hash = h;
      if other is not null and other <> v.user_id then
        p_decision := 'reject'; p_reason := 'Este documento já está vinculado a outra conta.';
      else
        insert into public.document_registry(user_id, doc_hash) values (v.user_id, h)
          on conflict (user_id) do update set doc_hash = excluded.doc_hash;
      end if;
    end if;
  end if;

  if p_decision = 'approve' then
    update public.verifications set status='approved', reviewed_by=auth.uid(), reviewed_at=now() where id = p_id;
    update public.profiles set status='approved', verified=true, verified_at=now(), rejection_reason=null,
      trust_score = s.trust_initial, trust_last_gain_at = now() where id = v.user_id;
    perform public.notify(v.user_id,'verification_result','Perfil aprovado! 💙','Seu perfil foi verificado. O ITAC LOVE está liberado para você.', jsonb_build_object('result','approved'));
  elsif p_decision = 'reject' then
    if nullif(trim(p_reason),'') is null then raise exception 'MOTIVO_OBRIGATORIO'; end if;
    update public.verifications set status='rejected', reason=p_reason, reviewed_by=auth.uid(), reviewed_at=now() where id = p_id;
    update public.profiles set status='rejected', rejection_reason=p_reason where id = v.user_id;
    perform public.notify(v.user_id,'verification_result','Verificação reprovada', p_reason, jsonb_build_object('result','rejected'));
  elsif p_decision = 'resubmit' then
    update public.verifications set status='resubmit', reason=p_reason, reviewed_by=auth.uid(), reviewed_at=now() where id = p_id;
    update public.profiles set status='needs_new_photo', rejection_reason=coalesce(p_reason,'Envie uma nova selfie com o documento.') where id = v.user_id;
    perform public.notify(v.user_id,'verification_result','Precisamos de uma nova foto', coalesce(p_reason,'Envie uma nova selfie com o documento.'), jsonb_build_object('result','resubmit'));
  elsif p_decision = 'ban' then
    update public.verifications set status='rejected', reason=p_reason, reviewed_by=auth.uid(), reviewed_at=now() where id = p_id;
    perform public.admin_moderate(v.user_id, 'ban', p_reason, null);
  else
    raise exception 'DECISAO_INVALIDA';
  end if;

  insert into public.moderation_actions(user_id, admin_id, action, reason)
  values (v.user_id, auth.uid(), case p_decision when 'approve' then 'approve' when 'reject' then 'reject' when 'resubmit' then 'resubmit' else 'ban' end, p_reason);
  return v.selfie_path;
end $$;

-- Chamado pelo painel depois de apagar a imagem do Storage
create or replace function public.admin_mark_selfie_deleted(p_id uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'SOMENTE_ADMIN'; end if;
  update public.verifications set selfie_path = null, selfie_deleted_at = now() where id = p_id;
end $$;

-- --------------------------------------------- moderação
-- p_action: 'warn' | 'suspend' | 'ban' | 'restore'
create or replace function public.admin_moderate(p_user uuid, p_action text, p_reason text, p_days int default null)
returns void language plpgsql security definer set search_path = public as $$
declare u public.profiles; d text;
begin
  if not public.is_admin() then raise exception 'SOMENTE_ADMIN'; end if;
  select * into u from public.profiles where id = p_user;
  if u.id is null then raise exception 'USUARIO_NAO_ENCONTRADO'; end if;
  if p_action = 'warn' then
    update public.profiles set warnings = warnings + 1 where id = p_user;
    perform public.notify(p_user,'warning','Advertência', coalesce(p_reason,'Você recebeu uma advertência da moderação.'));
  elsif p_action = 'suspend' then
    update public.profiles set status='suspended', suspended_until = now() + make_interval(days => coalesce(p_days,7)) where id = p_user;
    perform public.notify(p_user,'suspended','Conta suspensa', coalesce(p_reason,'Sua conta foi suspensa temporariamente.'));
  elsif p_action = 'ban' then
    update public.profiles set status='banned', paused = true where id = p_user;
    insert into public.banned_identifiers(kind, value_hash, reason)
      values ('email', public.sha256_hex(lower(coalesce(u.email,''))), p_reason) on conflict do nothing;
    select doc_hash into d from public.document_registry where user_id = p_user;
    if d is not null then
      insert into public.banned_identifiers(kind, value_hash, reason) values ('document', d, p_reason) on conflict do nothing;
    end if;
    update public.conversations set closed_at = now() where (user_a = p_user or user_b = p_user) and closed_at is null;
    update public.matches set status = 'closed' where (user_a = p_user or user_b = p_user) and status = 'active';
  elsif p_action = 'restore' then
    update public.profiles set status='approved', suspended_until=null where id = p_user;
  else
    raise exception 'ACAO_INVALIDA';
  end if;
  insert into public.moderation_actions(user_id, admin_id, action, reason, until)
  values (p_user, auth.uid(), p_action, p_reason,
          case when p_action='suspend' then now() + make_interval(days => coalesce(p_days,7)) end);
end $$;

-- --------------------------------------------- cotas
create or replace function public.quota_limits(p public.profiles, out likes int, out invites int)
language plpgsql stable security definer set search_path = public as $$
declare s public.app_settings := public.settings(); g text := public.gender_group(p.gender_identity);
begin
  if p.vip_until is not null and p.vip_until > now() then likes := null; invites := null; return; end if;
  if g = 'mulheres' then likes := null; invites := null;          -- ilimitado
  elsif g = 'homens' then likes := s.quota_male_likes; invites := s.quota_male_invites;
  elsif s.quota_other_unlimited then likes := null; invites := null;
  else likes := s.quota_other_likes; invites := s.quota_other_invites; end if;
end $$;

create or replace function public.quota_status() returns jsonb
language plpgsql stable security definer set search_path = public as $$
declare me public.profiles; lim record; u public.daily_usage;
begin
  select * into me from public.profiles where id = auth.uid();
  if me.id is null then raise exception 'NAO_AUTENTICADO'; end if;
  select * into lim from public.quota_limits(me);
  select * into u from public.daily_usage where user_id = me.id and day = public.br_today();
  return jsonb_build_object(
    'likes_unlimited', lim.likes is null,
    'invites_unlimited', lim.invites is null,
    'likes_left',   case when lim.likes   is null then null else greatest(lim.likes   - coalesce(u.likes_used,0),0) end,
    'invites_left', case when lim.invites is null then null else greatest(lim.invites - coalesce(u.invites_used,0),0) end,
    'extra_likes', me.extra_likes, 'extra_invites', me.extra_invites,
    'resets_at', public.br_next_midnight());
end $$;

-- Consome 1 unidade da cota (kind = 'like' | 'invite'); erro se esgotada
create or replace function public.consume_quota(me public.profiles, kind text) returns void
language plpgsql security definer set search_path = public as $$
declare lim record; used int;
begin
  select * into lim from public.quota_limits(me);
  if (kind = 'like' and lim.likes is null) or (kind = 'invite' and lim.invites is null) then return; end if;
  insert into public.daily_usage(user_id, day) values (me.id, public.br_today()) on conflict do nothing;
  if kind = 'like' then
    select likes_used into used from public.daily_usage where user_id = me.id and day = public.br_today() for update;
    if used < lim.likes then
      update public.daily_usage set likes_used = likes_used + 1 where user_id = me.id and day = public.br_today();
    elsif me.extra_likes > 0 then
      update public.profiles set extra_likes = extra_likes - 1 where id = me.id;
    else raise exception 'COTA_CURTIDAS_ESGOTADA'; end if;
  else
    select invites_used into used from public.daily_usage where user_id = me.id and day = public.br_today() for update;
    if used < lim.invites then
      update public.daily_usage set invites_used = invites_used + 1 where user_id = me.id and day = public.br_today();
    elsif me.extra_invites > 0 then
      update public.profiles set extra_invites = extra_invites - 1 where id = me.id;
    else raise exception 'COTA_CONVITES_ESGOTADA'; end if;
  end if;
end $$;

create or replace function public.is_blocked_between(a uuid, b uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.blocks where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a))
$$;

-- --------------------------------------------- afinidade
create or replace function public.affinity(a uuid, b uuid) returns int
language plpgsql stable security definer set search_path = public as $$
declare ca int; cb int; cc int; la text; lb text; tag_score numeric; look_score numeric;
begin
  select count(*) into ca from public.profile_interests where user_id = a;
  select count(*) into cb from public.profile_interests where user_id = b;
  select count(*) into cc from public.profile_interests x join public.profile_interests y on y.tag_id = x.tag_id and y.user_id = b where x.user_id = a;
  select looking_for into la from public.profiles where id = a;
  select looking_for into lb from public.profiles where id = b;
  tag_score := case when ca + cb = 0 then 0 else (2.0 * cc) / (ca + cb) end;          -- coeficiente de Dice
  look_score := case
    when la = lb then 1.0
    when la = 'nao_sei' or lb = 'nao_sei' then 0.5
    when (la = 'amizade' or lb = 'amizade') then 0.2
    else 0.0 end;                                                                       -- sério x casual
  return round(least(100, 70 * tag_score + 30 * look_score))::int;
end $$;

-- --------------------------------------------- feed
create or replace function public.get_feed(
  p_min_age int default 18, p_max_age int default 99, p_max_km int default null,
  p_genders text[] default null, p_looking text[] default null, p_tags int[] default null, p_limit int default 20)
returns table (id uuid, name text, age int, city text, bio text, looking_for text, gender_identity text,
               verified boolean, distance_km int, affinity int, common_tags int[], tags int[], photos text[])
language plpgsql stable security definer set search_path = public as $$
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
         array(select ph.storage_path from public.profile_photos ph where ph.user_id = c.id order by ph.position)
  from cand c
  where p_max_km is null or c.dist is null or c.dist <= p_max_km
  order by public.affinity(me.id, c.id) desc, random()
  limit p_limit;
end $$;

-- --------------------------------------------- curtir / passar
create or replace function public.like_profile(p_target uuid, p_kind text default 'like') returns jsonb
language plpgsql security definer set search_path = public as $$
declare me public.profiles; t public.profiles; mid uuid; cid uuid; a uuid; b uuid; s public.app_settings := public.settings();
begin
  me := public.require_approved();
  if me.paused then raise exception 'CONTA_PAUSADA'; end if;
  if p_kind not in ('like','pass') then raise exception 'TIPO_INVALIDO'; end if;
  select * into t from public.profiles where id = p_target;
  if t.id is null or t.id = me.id or t.status <> 'approved' or public.is_blocked_between(me.id, t.id) then
    raise exception 'PERFIL_INDISPONIVEL'; end if;
  if p_kind = 'like' and t.paused then raise exception 'PERFIL_INDISPONIVEL'; end if;
  if p_kind = 'like' and exists (select 1 from public.likes where from_id = me.id and to_id = t.id and kind = 'like') then
    return jsonb_build_object('matched', false, 'already', true);
  end if;

  if p_kind = 'like' then perform public.consume_quota(me, 'like'); end if;
  insert into public.likes(from_id, to_id, kind) values (me.id, t.id, p_kind)
    on conflict (from_id, to_id) do update set kind = excluded.kind, created_at = now();

  if p_kind = 'like' and exists (select 1 from public.likes where from_id = t.id and to_id = me.id and kind = 'like') then
    a := least(me.id, t.id); b := greatest(me.id, t.id);
    insert into public.matches(user_a, user_b, expires_at) values (a, b, now() + make_interval(hours => s.match_ttl_hours))
      on conflict (user_a, user_b) do nothing returning id into mid;
    if mid is not null then
      insert into public.conversations(match_id, user_a, user_b) values (mid, a, b) returning id into cid;
      perform public.notify(t.id, 'match', 'Deu match! 💘', 'Você e ' || coalesce(me.name,'alguém') || ' se curtiram. Mandem mensagem em até 48h!', jsonb_build_object('match_id', mid, 'conversation_id', cid));
      perform public.notify(me.id, 'match', 'Deu match! 💘', 'Você e ' || coalesce(t.name,'alguém') || ' se curtiram. Mandem mensagem em até 48h!', jsonb_build_object('match_id', mid, 'conversation_id', cid));
      return jsonb_build_object('matched', true, 'match_id', mid, 'conversation_id', cid, 'quota', public.quota_status());
    end if;
  end if;
  return jsonb_build_object('matched', false, 'quota', public.quota_status());
end $$;

-- --------------------------------------------- convites
create or replace function public.send_invite(p_target uuid, p_message text default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles; t public.profiles; iid uuid;
begin
  me := public.require_approved();
  select * into t from public.profiles where id = p_target;
  if t.id is null or t.id = me.id or t.status <> 'approved' or t.paused or public.is_blocked_between(me.id, t.id) then
    raise exception 'PERFIL_INDISPONIVEL'; end if;
  if exists (select 1 from public.invites where from_id = me.id and to_id = t.id and status = 'pending') then
    raise exception 'CONVITE_JA_ENVIADO'; end if;
  perform public.consume_quota(me, 'invite');
  insert into public.invites(from_id, to_id, message) values (me.id, t.id, left(p_message, 300)) returning id into iid;
  perform public.notify(t.id, 'invite', 'Novo convite de conversa 💌', coalesce(me.name,'Alguém') || ' quer conversar com você.', jsonb_build_object('invite_id', iid));
  return iid;
end $$;

create or replace function public.respond_invite(p_invite uuid, p_accept boolean) returns uuid
language plpgsql security definer set search_path = public as $$
declare me public.profiles; i public.invites; cid uuid;
begin
  me := public.require_approved();
  select * into i from public.invites where id = p_invite for update;
  if i.id is null or i.to_id <> me.id or i.status <> 'pending' then raise exception 'CONVITE_INVALIDO'; end if;
  update public.invites set status = case when p_accept then 'accepted' else 'declined' end, responded_at = now() where id = i.id;
  if p_accept then
    insert into public.conversations(invite_id, user_a, user_b) values (i.id, least(i.from_id, i.to_id), greatest(i.from_id, i.to_id)) returning id into cid;
    perform public.notify(i.from_id, 'invite_accepted', 'Convite aceito! 🎉', coalesce(me.name,'Alguém') || ' aceitou seu convite. O chat está aberto.', jsonb_build_object('conversation_id', cid));
  end if;
  return cid;
end $$;

-- --------------------------------------------- mensagens
create or replace function public.messages_before_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; other uuid;
begin
  select * into c from public.conversations where id = new.conversation_id;
  if c.id is null or c.closed_at is not null then raise exception 'CONVERSA_ENCERRADA'; end if;
  if current_user in ('authenticated','anon') then
    if new.sender_id is distinct from auth.uid() or auth.uid() not in (c.user_a, c.user_b) then raise exception 'NAO_PARTICIPANTE'; end if;
    new.kind := 'text';
    other := case when c.user_a = auth.uid() then c.user_b else c.user_a end;
    if public.is_blocked_between(auth.uid(), other) then raise exception 'CONVERSA_ENCERRADA'; end if;
  end if;
  new.created_at := now(); new.read_at := null;
  if c.self_destruct_seconds is not null then new.expires_at := now() + make_interval(secs => c.self_destruct_seconds); end if;
  return new;
end $$;
drop trigger if exists messages_before_insert on public.messages;
create trigger messages_before_insert before insert on public.messages
  for each row execute function public.messages_before_insert();

create or replace function public.messages_after_insert() returns trigger
language plpgsql security definer set search_path = public as $$
declare c public.conversations; other uuid; nm text;
begin
  if new.kind <> 'text' then return new; end if;
  select * into c from public.conversations where id = new.conversation_id;
  if c.match_id is not null then
    update public.matches set first_message_at = now() where id = c.match_id and first_message_at is null;
  end if;
  other := case when c.user_a = new.sender_id then c.user_b else c.user_a end;
  select name into nm from public.profiles where id = new.sender_id;
  perform public.notify(other, 'message', coalesce(nm,'Nova mensagem'), left(new.body, 80), jsonb_build_object('conversation_id', c.id));
  return new;
end $$;
drop trigger if exists messages_after_insert on public.messages;
create trigger messages_after_insert after insert on public.messages
  for each row execute function public.messages_after_insert();

create or replace function public.my_conversation(p_conv uuid) returns public.conversations
language plpgsql stable security definer set search_path = public as $$
declare c public.conversations;
begin
  select * into c from public.conversations where id = p_conv;
  if c.id is null or auth.uid() not in (c.user_a, c.user_b) then raise exception 'NAO_PARTICIPANTE'; end if;
  return c;
end $$;

create or replace function public.system_message(p_conv uuid, p_body text) returns void
language sql security definer set search_path = public as $$
  insert into public.messages(conversation_id, sender_id, kind, body) values (p_conv, null, 'system', p_body);
$$;

-- p_seconds: 3600 | 86400 | 604800 | null (desativado)
create or replace function public.set_self_destruct(p_conv uuid, p_seconds int) returns void
language plpgsql security definer set search_path = public as $$
declare c public.conversations; nm text; label text;
begin
  c := public.my_conversation(p_conv);
  if c.closed_at is not null then raise exception 'CONVERSA_ENCERRADA'; end if;
  update public.conversations set self_destruct_seconds = p_seconds where id = p_conv;
  select name into nm from public.profiles where id = auth.uid();
  label := case p_seconds when 3600 then '1 hora' when 86400 then '24 horas' when 604800 then '7 dias' end;
  perform public.system_message(p_conv, case when p_seconds is null
    then coalesce(nm,'Alguém') || ' desativou a autodestruição das mensagens.'
    else coalesce(nm,'Alguém') || ' ativou a autodestruição: novas mensagens somem após ' || label || '.' end);
end $$;

create or replace function public.report_screenshot(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
declare c public.conversations; nm text;
begin
  c := public.my_conversation(p_conv);
  if c.closed_at is not null then return; end if;
  select name into nm from public.profiles where id = auth.uid();
  perform public.system_message(p_conv, coalesce(nm,'Alguém') || ' tentou tirar um print desta conversa.');
end $$;

create or replace function public.mark_read(p_conv uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  perform public.my_conversation(p_conv);
  update public.messages set read_at = now()
  where conversation_id = p_conv and sender_id is not null and sender_id <> auth.uid() and read_at is null;
end $$;

-- Lista de matches e conversas do usuário
create or replace function public.my_conversations() returns table (
  conversation_id uuid, match_id uuid, other_id uuid, other_name text, other_photo text, other_verified boolean,
  expires_at timestamptz, first_message_at timestamptz, self_destruct_seconds int,
  last_body text, last_at timestamptz, unread int)
language sql stable security definer set search_path = public as $$
  select c.id, c.match_id, o.id, o.name,
    (select storage_path from public.profile_photos where user_id = o.id order by position limit 1), o.verified,
    m.expires_at, m.first_message_at, c.self_destruct_seconds,
    lm.body, lm.created_at,
    (select count(*)::int from public.messages x where x.conversation_id = c.id and x.sender_id = o.id and x.read_at is null)
  from public.conversations c
  join public.profiles o on o.id = case when c.user_a = auth.uid() then c.user_b else c.user_a end
  left join public.matches m on m.id = c.match_id
  left join lateral (select body, created_at from public.messages where conversation_id = c.id order by created_at desc limit 1) lm on true
  where auth.uid() in (c.user_a, c.user_b) and c.closed_at is null
    and (m.id is null or m.status = 'active')
  order by coalesce(lm.created_at, c.created_at) desc
$$;

-- --------------------------------------------- bloqueio e denúncia
create or replace function public.block_user(p_target uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null or p_target = auth.uid() then raise exception 'INVALIDO'; end if;
  insert into public.blocks(blocker_id, blocked_id) values (auth.uid(), p_target) on conflict do nothing;
  update public.conversations set closed_at = now()
    where user_a = least(auth.uid(), p_target) and user_b = greatest(auth.uid(), p_target) and closed_at is null;
  update public.matches set status = 'closed'
    where user_a = least(auth.uid(), p_target) and user_b = greatest(auth.uid(), p_target) and status = 'active';
  update public.invites set status = 'cancelled'
    where status = 'pending' and ((from_id = auth.uid() and to_id = p_target) or (from_id = p_target and to_id = auth.uid()));
end $$;

create or replace function public.report_user(p_target uuid, p_reason text, p_details text default null,
                                              p_conversation uuid default null, p_message uuid default null) returns uuid
language plpgsql security definer set search_path = public as $$
declare rid uuid;
begin
  if auth.uid() is null or p_target = auth.uid() then raise exception 'INVALIDO'; end if;
  insert into public.reports(reporter_id, reported_id, reason, details, conversation_id, message_id)
  values (auth.uid(), p_target, p_reason, left(p_details, 1000), p_conversation, p_message) returning id into rid;
  return rid;
end $$;

-- Admin resolve denúncia. Só denúncia CONFIRMADA reduz a nota.
create or replace function public.admin_resolve_report(p_report uuid, p_confirm boolean, p_note text default null,
                                                       p_action text default null, p_days int default null) returns void
language plpgsql security definer set search_path = public as $$
declare r public.reports; s public.app_settings := public.settings(); newscore int;
begin
  if not public.is_admin() then raise exception 'SOMENTE_ADMIN'; end if;
  select * into r from public.reports where id = p_report for update;
  if r.id is null or r.status <> 'open' then raise exception 'DENUNCIA_INVALIDA'; end if;
  update public.reports set status = case when p_confirm then 'confirmed' else 'dismissed' end,
    admin_note = p_note, reviewed_by = auth.uid(), reviewed_at = now() where id = r.id;
  if p_confirm then
    update public.profiles set trust_score = greatest(0, trust_score - s.trust_report_penalty), trust_last_gain_at = now()
      where id = r.reported_id returning trust_score into newscore;
    insert into public.trust_events(user_id, delta, reason) values (r.reported_id, -s.trust_report_penalty, 'Denúncia confirmada: ' || r.reason);
    if newscore < s.trust_review_threshold then
      update public.profiles set status = 'under_review' where id = r.reported_id and status = 'approved';
      insert into public.moderation_actions(user_id, admin_id, action, reason) values (r.reported_id, null, 'review', 'Nota de confiança abaixo do limite');
    end if;
    if p_action is not null then perform public.admin_moderate(r.reported_id, p_action, p_note, p_days); end if;
  end if;
end $$;

-- --------------------------------------------- encontro seguro
create or replace function public.respond_safe_checkin(p_id uuid, p_ok boolean) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.safe_dates set status = case when p_ok then 'ok' else 'help' end, responded_at = now()
  where id = p_id and user_id = auth.uid() and status in ('scheduled','checkin_sent');
end $$;

create or replace function public.update_safe_location(p_id uuid, p_lat double precision, p_lng double precision) returns void
language sql security definer set search_path = public as $$
  update public.safe_dates set last_lat = p_lat, last_lng = p_lng, last_location_at = now()
  where id = p_id and user_id = auth.uid() and status in ('scheduled','checkin_sent','help');
$$;

-- Página pública para os contatos de confiança (acesso pelo link com token)
create or replace function public.safe_date_public(p_token text) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object(
    'user_name', u.name, 'partner_name', p.name,
    'partner_photo', (select storage_path from public.profile_photos where user_id = p.id order by position limit 1),
    'place', d.place, 'starts_at', d.starts_at, 'ends_at', d.ends_at, 'status', d.status,
    'last_lat', d.last_lat, 'last_lng', d.last_lng, 'last_location_at', d.last_location_at)
  from public.safe_dates d join public.profiles u on u.id = d.user_id left join public.profiles p on p.id = d.partner_id
  where d.share_token = p_token
$$;

-- --------------------------------------------- conta
create or replace function public.delete_my_account() returns void
language plpgsql security definer set search_path = public, auth as $$
begin
  if auth.uid() is null then raise exception 'NAO_AUTENTICADO'; end if;
  -- apaga em cascata: perfil, fotos (registro), curtidas, matches, conversas, mensagens...
  delete from auth.users where id = auth.uid();
end $$;

create or replace function public.record_access(p_platform text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare s public.app_settings := public.settings();
begin
  if auth.uid() is not null and p_platform in ('web','android') then
    insert into public.platform_access(user_id, day, platform) values (auth.uid(), public.br_today(), p_platform) on conflict do nothing;
    update public.profiles set last_platform = p_platform, last_seen_at = now() where id = auth.uid();
  end if;
  return jsonb_build_object('latest_app_version', s.latest_app_version, 'apk_download_url', s.apk_download_url, 'terms_version', s.terms_version);
end $$;

-- --------------------------------------------- pagamentos (chamado pelo webhook com service_role)
create or replace function public.credit_payment(p_provider_id text) returns void
language plpgsql security definer set search_path = public as $$
declare p public.payments; s public.app_settings := public.settings();
begin
  select * into p from public.payments where provider_id = p_provider_id for update;
  if p.id is null or p.status = 'paid' then return; end if;
  update public.payments set status = 'paid', paid_at = now() where id = p.id;
  if p.product = 'likes_pack' then
    update public.profiles set extra_likes = extra_likes + s.likes_pack_size * p.quantity where id = p.user_id;
  elsif p.product = 'invites_pack' then
    update public.profiles set extra_invites = extra_invites + s.invites_pack_size * p.quantity where id = p.user_id;
  elsif p.product = 'vip_month' then
    update public.profiles set vip_until = greatest(coalesce(vip_until, now()), now()) + interval '30 days' where id = p.user_id;
  end if;
  perform public.notify(p.user_id, 'payment', 'Pagamento confirmado ✅', 'Seu Pix foi confirmado e o saldo já está disponível.');
end $$;
revoke all on function public.credit_payment(text) from public, anon, authenticated;

-- --------------------------------------------- painel: números
create or replace function public.admin_dashboard() returns jsonb
language plpgsql stable security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'SOMENTE_ADMIN'; end if;
  return jsonb_build_object(
    'cadastros', (select count(*) from public.profiles),
    'cadastros_7d', (select count(*) from public.profiles where created_at > now() - interval '7 days'),
    'aprovados', (select count(*) from public.profiles where status = 'approved'),
    'pendentes', (select count(*) from public.verifications where status = 'pending'),
    'denuncias_abertas', (select count(*) from public.reports where status = 'open'),
    'em_revisao', (select count(*) from public.profiles where status = 'under_review'),
    'banidos', (select count(*) from public.profiles where status = 'banned'),
    'encontros_ativos', (select count(*) from public.safe_dates where status in ('scheduled','checkin_sent','help')),
    'vendas_pix_qtd', (select count(*) from public.payments where status = 'paid'),
    'vendas_pix_total_cents', (select coalesce(sum(amount_cents),0) from public.payments where status = 'paid'),
    'acessos_web_30d', (select count(*) from public.platform_access where platform = 'web' and day > public.br_today() - 30),
    'acessos_android_30d', (select count(*) from public.platform_access where platform = 'android' and day > public.br_today() - 30));
end $$;

-- =====================================================================
-- Rotinas automáticas (chamadas pelo pg_cron — ver 0004_cron.sql)
-- =====================================================================
create or replace function public.job_expire_matches() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  with ex as (
    update public.matches set status = 'expired'
    where status = 'active' and first_message_at is null and expires_at <= now() returning id)
  update public.conversations set closed_at = now() where match_id in (select id from ex) and closed_at is null;
  get diagnostics n = row_count;
  return n;
end $$;

create or replace function public.job_match_reminders() returns int
language plpgsql security definer set search_path = public as $$
declare m record; n int := 0; s public.app_settings := public.settings();
begin
  for m in select * from public.matches
           where status = 'active' and first_message_at is null and not reminder_sent
             and expires_at <= now() + make_interval(hours => s.match_reminder_hours) loop
    perform public.notify(m.user_a, 'match_expiring', 'Seu match está quase expirando ⏳', 'Faltam menos de ' || s.match_reminder_hours || ' horas. Mande um oi!', jsonb_build_object('match_id', m.id));
    perform public.notify(m.user_b, 'match_expiring', 'Seu match está quase expirando ⏳', 'Faltam menos de ' || s.match_reminder_hours || ' horas. Mande um oi!', jsonb_build_object('match_id', m.id));
    update public.matches set reminder_sent = true where id = m.id;
    n := n + 1;
  end loop;
  return n;
end $$;

create or replace function public.job_purge_messages() returns int
language plpgsql security definer set search_path = public as $$
declare n int;
begin
  delete from public.messages where expires_at is not null and expires_at <= now();
  get diagnostics n = row_count;
  return n;
end $$;

-- +X pontos por semana sem denúncia confirmada (até 100)
create or replace function public.job_trust_gain() returns int
language plpgsql security definer set search_path = public as $$
declare n int; s public.app_settings := public.settings();
begin
  with up as (
    update public.profiles p set trust_score = least(100, trust_score + s.trust_weekly_gain), trust_last_gain_at = now()
    where status = 'approved' and trust_score < 100
      and coalesce(trust_last_gain_at, verified_at, created_at) <= now() - interval '7 days'
      and not exists (select 1 from public.reports r where r.reported_id = p.id and r.status = 'confirmed'
                      and r.reviewed_at > now() - interval '7 days')
    returning p.id)
  insert into public.trust_events(user_id, delta, reason) select id, s.trust_weekly_gain, 'Semana sem denúncias' from up;
  get diagnostics n = row_count;
  return n;
end $$;

-- Encontro seguro: envia o "Está tudo bem?" e marca quem precisa de alerta.
-- Retorna os IDs que precisam de alerta aos contatos (o cron chama a Edge Function).
create or replace function public.job_safe_dates() returns uuid[]
language plpgsql security definer set search_path = public as $$
declare d record; s public.app_settings := public.settings(); to_alert uuid[] := '{}';
begin
  for d in select * from public.safe_dates where status = 'scheduled' and ends_at <= now() loop
    update public.safe_dates set status = 'checkin_sent', checkin_sent_at = now() where id = d.id;
    perform public.notify(d.user_id, 'safe_checkin', 'Está tudo bem? 💙', 'Seu encontro deveria ter terminado. Toque para responder.', jsonb_build_object('safe_date_id', d.id));
  end loop;
  for d in select * from public.safe_dates
           where alerted_at is null and (status = 'help'
              or (status = 'checkin_sent' and checkin_sent_at <= now() - make_interval(mins => s.safe_date_grace_minutes))) loop
    update public.safe_dates set status = case when status = 'help' then 'help' else 'alerted' end, alerted_at = now() where id = d.id;
    to_alert := to_alert || d.id;
  end loop;
  return to_alert;
end $$;
