-- =====================================================================
-- ITAC LOVE — Segurança (Row Level Security) e Storage
-- =====================================================================

-- Funções internas: ninguém chama direto pelo app
revoke execute on function public.notify(uuid,text,text,text,jsonb) from public, anon, authenticated;
revoke execute on function public.system_message(uuid,text) from public, anon, authenticated;
revoke execute on function public.consume_quota(public.profiles,text) from public, anon, authenticated;
revoke execute on function public.quota_limits(public.profiles) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
revoke execute on function public.job_expire_matches() from public, anon, authenticated;
revoke execute on function public.job_match_reminders() from public, anon, authenticated;
revoke execute on function public.job_purge_messages() from public, anon, authenticated;
revoke execute on function public.job_trust_gain() from public, anon, authenticated;
revoke execute on function public.job_safe_dates() from public, anon, authenticated;

-- Liga RLS em todas as tabelas
do $$ declare t text; begin
  foreach t in array array['app_settings','admins','profiles','profile_photos','interest_tags','profile_interests',
    'verifications','banned_identifiers','document_registry','notifications','likes','daily_usage','matches','invites',
    'conversations','messages','blocks','reports','moderation_actions','trust_events','trusted_contacts','safe_dates',
    'payments','platform_access'] loop
    execute format('alter table public.%I enable row level security', t);
  end loop;
end $$;

-- Configurações: todos leem, só admin altera
drop policy if exists settings_read on public.app_settings;
create policy settings_read on public.app_settings for select using (true);
drop policy if exists settings_admin on public.app_settings;
create policy settings_admin on public.app_settings for update using (public.is_admin()) with check (public.is_admin());

drop policy if exists admins_self on public.admins;
create policy admins_self on public.admins for select using (user_id = auth.uid() or public.is_admin());

-- Perfis: a linha completa só para o dono e admins.
-- Outros usuários veem a VIEW public_profiles (sem e-mail, data de nascimento, localização ou nota).
drop policy if exists profiles_own on public.profiles;
create policy profiles_own on public.profiles for select using (id = auth.uid() or public.is_admin());
drop policy if exists profiles_upd on public.profiles;
create policy profiles_upd on public.profiles for update using (id = auth.uid() or public.is_admin()) with check (id = auth.uid() or public.is_admin());

create or replace view public.public_profiles as
  select p.id, p.name, public.age_of(p.birth_date) as age, p.city, p.bio, p.looking_for,
         p.gender_identity, p.gender_other, p.verified,
         array(select tag_id from public.profile_interests i where i.user_id = p.id) as tags,
         array(select storage_path from public.profile_photos f where f.user_id = p.id order by position) as photos
  from public.profiles p
  where p.status = 'approved'
    and exists (select 1 from public.profiles me where me.id = auth.uid() and me.status = 'approved')
    and not public.is_blocked_between(auth.uid(), p.id);
grant select on public.public_profiles to authenticated;

-- Fotos de perfil
drop policy if exists photos_read on public.profile_photos;
create policy photos_read on public.profile_photos for select using (auth.role() = 'authenticated');
drop policy if exists photos_own on public.profile_photos;
create policy photos_own on public.profile_photos for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists tags_read on public.interest_tags;
create policy tags_read on public.interest_tags for select using (true);
drop policy if exists tags_admin on public.interest_tags;
create policy tags_admin on public.interest_tags for all using (public.is_admin()) with check (public.is_admin());

drop policy if exists interests_read on public.profile_interests;
create policy interests_read on public.profile_interests for select using (auth.role() = 'authenticated');
drop policy if exists interests_own on public.profile_interests;
create policy interests_own on public.profile_interests for all using (user_id = auth.uid()) with check (user_id = auth.uid());

-- Verificações: dono vê o status; só admin vê tudo. Inserção apenas via submit_verification().
drop policy if exists verif_read on public.verifications;
create policy verif_read on public.verifications for select using (user_id = auth.uid() or public.is_admin());

drop policy if exists banned_admin on public.banned_identifiers;
create policy banned_admin on public.banned_identifiers for all using (public.is_admin()) with check (public.is_admin());
drop policy if exists docreg_admin on public.document_registry;
create policy docreg_admin on public.document_registry for select using (public.is_admin());

drop policy if exists notif_own on public.notifications;
create policy notif_own on public.notifications for select using (user_id = auth.uid());
drop policy if exists notif_upd on public.notifications;
create policy notif_upd on public.notifications for update using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists likes_own on public.likes;
create policy likes_own on public.likes for select using (from_id = auth.uid() or public.is_admin());
drop policy if exists usage_own on public.daily_usage;
create policy usage_own on public.daily_usage for select using (user_id = auth.uid());

drop policy if exists matches_part on public.matches;
create policy matches_part on public.matches for select using (auth.uid() in (user_a, user_b) or public.is_admin());
drop policy if exists invites_part on public.invites;
create policy invites_part on public.invites for select using (auth.uid() in (from_id, to_id) or public.is_admin());

drop policy if exists conv_part on public.conversations;
create policy conv_part on public.conversations for select using (auth.uid() in (user_a, user_b) or public.is_admin());

drop policy if exists msg_read on public.messages;
create policy msg_read on public.messages for select using (
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b))
  or public.is_admin());
drop policy if exists msg_insert on public.messages;
create policy msg_insert on public.messages for insert with check (
  sender_id = auth.uid() and kind = 'text' and
  exists (select 1 from public.conversations c where c.id = conversation_id and auth.uid() in (c.user_a, c.user_b) and c.closed_at is null));

drop policy if exists blocks_own on public.blocks;
create policy blocks_own on public.blocks for select using (blocker_id = auth.uid() or public.is_admin());

drop policy if exists reports_admin on public.reports;
create policy reports_admin on public.reports for select using (public.is_admin() or reporter_id = auth.uid());
drop policy if exists modact_admin on public.moderation_actions;
create policy modact_admin on public.moderation_actions for select using (public.is_admin());
drop policy if exists trust_admin on public.trust_events;
create policy trust_admin on public.trust_events for select using (public.is_admin());

drop policy if exists contacts_own on public.trusted_contacts;
create policy contacts_own on public.trusted_contacts for all using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists safe_own on public.safe_dates;
create policy safe_own on public.safe_dates for all using (user_id = auth.uid() or public.is_admin()) with check (user_id = auth.uid());

drop policy if exists pay_own on public.payments;
create policy pay_own on public.payments for select using (user_id = auth.uid() or public.is_admin());
drop policy if exists access_admin on public.platform_access;
create policy access_admin on public.platform_access for select using (public.is_admin());

-- =====================================================================
-- Storage
--  photos/<user_id>/1.jpg ...         → fotos de perfil (usuários logados leem)
--  verifications/<user_id>/<arq>.jpg  → selfie + documento (SÓ admin lê; apagada após análise)
-- Os arquivos ficam criptografados em repouso (AES-256) no Supabase Storage.
-- =====================================================================
insert into storage.buckets (id, name, public) values ('photos','photos', false) on conflict (id) do nothing;
insert into storage.buckets (id, name, public) values ('verifications','verifications', false) on conflict (id) do nothing;

drop policy if exists "photos read" on storage.objects;
create policy "photos read" on storage.objects for select
  using (bucket_id = 'photos' and auth.role() = 'authenticated');
drop policy if exists "photos write own" on storage.objects;
create policy "photos write own" on storage.objects for insert
  with check (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos update own" on storage.objects;
create policy "photos update own" on storage.objects for update
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "photos delete own" on storage.objects;
create policy "photos delete own" on storage.objects for delete
  using (bucket_id = 'photos' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "verif upload own" on storage.objects;
create policy "verif upload own" on storage.objects for insert
  with check (bucket_id = 'verifications' and (storage.foldername(name))[1] = auth.uid()::text);
drop policy if exists "verif admin read" on storage.objects;
create policy "verif admin read" on storage.objects for select
  using (bucket_id = 'verifications' and public.is_admin());
drop policy if exists "verif admin delete" on storage.objects;
create policy "verif admin delete" on storage.objects for delete
  using (bucket_id = 'verifications' and public.is_admin());
