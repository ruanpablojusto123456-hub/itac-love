-- =====================================================================
-- ITAC LOVE — Estrutura do banco de dados (Supabase / PostgreSQL)
-- Execute no Supabase: SQL Editor > cole este arquivo > Run.
-- Depois rode 0002_functions.sql, 0003_policies.sql e 0004_cron.sql.
-- =====================================================================

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------
-- Configurações globais (editáveis no painel admin, sem atualizar o app)
-- ---------------------------------------------------------------------
create table if not exists public.app_settings (
  id                      int primary key default 1 check (id = 1),
  -- Cotas diárias (renovam à meia-noite de Brasília)
  quota_male_likes        int  not null default 20,
  quota_male_invites      int  not null default 5,
  quota_other_unlimited   boolean not null default false, -- não binários e demais identidades
  quota_other_likes       int  not null default 20,
  quota_other_invites     int  not null default 5,
  -- Alerta de golpe
  scam_words              text[] not null default array['pix','empréstimo','emprestimo','transferência','transferencia','depósito','deposito','dinheiro','cartão','cartao'],
  -- Nota de confiança
  trust_initial           int  not null default 50,
  trust_weekly_gain       int  not null default 2,
  trust_report_penalty    int  not null default 15,
  trust_review_threshold  int  not null default 30,
  -- Match
  match_ttl_hours         int  not null default 48,
  match_reminder_hours    int  not null default 6,
  -- Encontro seguro
  safe_date_grace_minutes int  not null default 30,
  -- Preços (centavos)
  price_likes_pack_cents   int not null default 990,
  likes_pack_size          int not null default 30,
  price_invites_pack_cents int not null default 990,
  invites_pack_size        int not null default 10,
  price_vip_month_cents    int not null default 2990,
  -- Atualização do APK
  latest_app_version      text not null default '1.0.0',
  apk_download_url        text,
  terms_version           text not null default '2026-11-01',
  updated_at              timestamptz not null default now()
);
insert into public.app_settings (id) values (1) on conflict do nothing;

-- ---------------------------------------------------------------------
-- Administradores (login separado do app, mas usando o mesmo Auth)
-- ---------------------------------------------------------------------
create table if not exists public.admins (
  user_id    uuid primary key references auth.users(id) on delete cascade,
  name       text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Perfis
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id               uuid primary key references auth.users(id) on delete cascade,
  email            text,
  name             text,
  birth_date       date,
  gender_identity  text check (gender_identity in (
                     'mulher_cis','mulher_trans','homem_cis','homem_trans','nao_binario',
                     'genero_fluido','agenero','travesti','outro','prefiro_nao_informar')),
  gender_other     text,           -- campo livre quando gender_identity = 'outro'
  orientation      text,
  city             text,
  lat              double precision,
  lng              double precision,
  bio              text check (char_length(bio) <= 500),
  looking_for      text check (looking_for in ('serio','casual','amizade','nao_sei')),
  show_genders     text[] not null default '{}', -- 'mulheres','homens','nao_binarios'
  -- Fluxo de cadastro / verificação
  status           text not null default 'onboarding' check (status in (
                     'onboarding',      -- preenchendo cadastro
                     'pending_review',  -- selfie enviada, aguardando admin
                     'needs_new_photo', -- admin pediu nova selfie
                     'rejected',        -- reprovado (motivo em rejection_reason)
                     'approved',        -- liberado
                     'under_review',    -- caiu para revisão (nota baixa)
                     'suspended',       -- suspenso até suspended_until
                     'banned')),        -- banido permanentemente
  rejection_reason text,
  verified         boolean not null default false,
  verified_at      timestamptz,
  trust_score      int not null default 50 check (trust_score between 0 and 100),
  trust_last_gain_at timestamptz,
  warnings         int not null default 0,
  suspended_until  timestamptz,
  -- Privacidade
  invisible        boolean not null default false,
  paused           boolean not null default false,
  -- Termos
  terms_accepted_at   timestamptz,
  privacy_accepted_at timestamptz,
  terms_version       text,
  -- Saldo extra comprado via Pix
  extra_likes      int not null default 0,
  extra_invites    int not null default 0,
  vip_until        timestamptz,
  -- Push
  fcm_token        text,
  last_platform    text check (last_platform in ('web','android')),
  last_seen_at     timestamptz,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);
create index if not exists profiles_status_idx on public.profiles(status);

-- Fotos de perfil (exatamente 3, posições 1..3)
create table if not exists public.profile_photos (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references public.profiles(id) on delete cascade,
  position     int  not null check (position between 1 and 3),
  storage_path text not null,
  created_at   timestamptz not null default now(),
  unique (user_id, position)
);

-- Tags de interesse
create table if not exists public.interest_tags (
  id       serial primary key,
  category text not null check (category in ('musica','esportes','religiao','pets','filhos','hobbies','comida','viagens')),
  label    text not null,
  unique (category, label)
);
create table if not exists public.profile_interests (
  user_id uuid not null references public.profiles(id) on delete cascade,
  tag_id  int  not null references public.interest_tags(id) on delete cascade,
  primary key (user_id, tag_id)
);

-- ---------------------------------------------------------------------
-- Verificação (selfie com documento) — bucket PRIVADO, só admin lê.
-- A imagem é apagada após a análise; fica só o registro.
-- ---------------------------------------------------------------------
create table if not exists public.verifications (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references public.profiles(id) on delete cascade,
  selfie_path     text,                -- null depois que a imagem é apagada
  status          text not null default 'pending' check (status in ('pending','approved','rejected','resubmit')),
  reason          text,
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  selfie_deleted_at timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists verifications_pending_idx on public.verifications(status, created_at);

-- Documentos / e-mails banidos (guardamos apenas o HASH)
create table if not exists public.banned_identifiers (
  id         uuid primary key default gen_random_uuid(),
  kind       text not null check (kind in ('email','document')),
  value_hash text not null,
  reason     text,
  created_at timestamptz not null default now(),
  unique (kind, value_hash)
);
-- Hash do documento de quem foi aprovado (para detectar contas duplicadas/banidas)
create table if not exists public.document_registry (
  user_id    uuid primary key references public.profiles(id) on delete cascade,
  doc_hash   text not null unique,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Notificações (push no APK / navegador são disparados a partir daqui)
-- ---------------------------------------------------------------------
create table if not exists public.notifications (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  type       text not null, -- verification_result, match, invite, message, match_expiring, safe_checkin, ...
  title      text not null,
  body       text,
  data       jsonb not null default '{}',
  read_at    timestamptz,
  pushed_at  timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_idx on public.notifications(user_id, created_at desc);

-- ---------------------------------------------------------------------
-- Curtidas, cotas, matches e convites
-- ---------------------------------------------------------------------
create table if not exists public.likes (
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  kind       text not null check (kind in ('like','pass')),
  created_at timestamptz not null default now(),
  primary key (from_id, to_id)
);
create index if not exists likes_to_idx on public.likes(to_id) where kind = 'like';

create table if not exists public.daily_usage (
  user_id      uuid not null references public.profiles(id) on delete cascade,
  day          date not null, -- dia no fuso America/Sao_Paulo
  likes_used   int  not null default 0,
  invites_used int  not null default 0,
  primary key (user_id, day)
);

create table if not exists public.matches (
  id               uuid primary key default gen_random_uuid(),
  user_a           uuid not null references public.profiles(id) on delete cascade,
  user_b           uuid not null references public.profiles(id) on delete cascade,
  status           text not null default 'active' check (status in ('active','expired','closed')),
  created_at       timestamptz not null default now(),
  expires_at       timestamptz not null,
  first_message_at timestamptz,
  reminder_sent    boolean not null default false,
  check (user_a < user_b),
  unique (user_a, user_b)
);

create table if not exists public.invites (
  id           uuid primary key default gen_random_uuid(),
  from_id      uuid not null references public.profiles(id) on delete cascade,
  to_id        uuid not null references public.profiles(id) on delete cascade,
  message      text check (char_length(message) <= 300),
  status       text not null default 'pending' check (status in ('pending','accepted','declined','cancelled')),
  created_at   timestamptz not null default now(),
  responded_at timestamptz
);
create unique index if not exists invites_one_pending on public.invites(from_id, to_id) where status = 'pending';

-- ---------------------------------------------------------------------
-- Conversas e mensagens
-- ---------------------------------------------------------------------
create table if not exists public.conversations (
  id                    uuid primary key default gen_random_uuid(),
  match_id              uuid references public.matches(id) on delete set null,
  invite_id             uuid references public.invites(id) on delete set null,
  user_a                uuid not null references public.profiles(id) on delete cascade,
  user_b                uuid not null references public.profiles(id) on delete cascade,
  self_destruct_seconds int check (self_destruct_seconds in (3600, 86400, 604800)), -- null = desativado
  closed_at             timestamptz,
  created_at            timestamptz not null default now(),
  check (user_a < user_b)
);
create index if not exists conversations_users_idx on public.conversations(user_a, user_b);

create table if not exists public.messages (
  id              uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  sender_id       uuid references public.profiles(id) on delete set null, -- null = mensagem do sistema
  kind            text not null default 'text' check (kind in ('text','system')),
  body            text not null check (char_length(body) <= 2000),
  created_at      timestamptz not null default now(),
  read_at         timestamptz,
  expires_at      timestamptz -- autodestruição
);
create index if not exists messages_conv_idx on public.messages(conversation_id, created_at);
create index if not exists messages_expires_idx on public.messages(expires_at) where expires_at is not null;

-- ---------------------------------------------------------------------
-- Segurança: bloqueios, denúncias, moderação, nota de confiança
-- ---------------------------------------------------------------------
create table if not exists public.blocks (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id)
);

create table if not exists public.reports (
  id              uuid primary key default gen_random_uuid(),
  reporter_id     uuid references public.profiles(id) on delete set null,
  reported_id     uuid not null references public.profiles(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  message_id      uuid references public.messages(id) on delete set null,
  reason          text not null check (reason in ('perfil_falso','fotos_de_outra_pessoa','golpe','assedio','conteudo_improprio','menor_de_idade','outro')),
  details         text,
  status          text not null default 'open' check (status in ('open','confirmed','dismissed')),
  admin_note      text,
  reviewed_by     uuid references auth.users(id) on delete set null,
  reviewed_at     timestamptz,
  created_at      timestamptz not null default now()
);
create index if not exists reports_open_idx on public.reports(status, created_at);

create table if not exists public.moderation_actions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  admin_id   uuid references auth.users(id) on delete set null,
  action     text not null check (action in ('approve','reject','resubmit','warn','suspend','ban','restore','review')),
  reason     text,
  until      timestamptz,
  created_at timestamptz not null default now()
);

create table if not exists public.trust_events (
  id         bigserial primary key,
  user_id    uuid not null references public.profiles(id) on delete cascade,
  delta      int  not null,
  reason     text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------
-- Modo encontro seguro
-- ---------------------------------------------------------------------
create table if not exists public.trusted_contacts (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles(id) on delete cascade,
  name       text not null,
  phone      text not null,
  created_at timestamptz not null default now()
);

create table if not exists public.safe_dates (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references public.profiles(id) on delete cascade,
  partner_id       uuid references public.profiles(id) on delete set null,
  conversation_id  uuid references public.conversations(id) on delete set null,
  place            text not null,
  starts_at        timestamptz not null,
  ends_at          timestamptz not null,
  status           text not null default 'scheduled' check (status in ('scheduled','checkin_sent','ok','help','alerted','cancelled')),
  checkin_sent_at  timestamptz,
  responded_at     timestamptz,
  alerted_at       timestamptz,
  last_lat         double precision,
  last_lng         double precision,
  last_location_at timestamptz,
  share_token      text not null default encode(extensions.gen_random_bytes(16), 'hex') unique,
  created_at       timestamptz not null default now(),
  check (ends_at > starts_at)
);
create index if not exists safe_dates_due_idx on public.safe_dates(status, ends_at);

-- ---------------------------------------------------------------------
-- Pagamentos Pix
-- ---------------------------------------------------------------------
create table if not exists public.payments (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid references public.profiles(id) on delete set null,
  product         text not null check (product in ('likes_pack','invites_pack','vip_month')),
  quantity        int  not null default 1,
  amount_cents    int  not null,
  provider        text not null default 'mercadopago',
  provider_id     text unique,
  status          text not null default 'pending' check (status in ('pending','paid','expired','refunded')),
  pix_qr_base64   text,
  pix_copy_paste  text,
  created_at      timestamptz not null default now(),
  paid_at         timestamptz
);

-- ---------------------------------------------------------------------
-- Acessos por plataforma (web x APK) — 1 linha por usuário/dia/plataforma
-- ---------------------------------------------------------------------
create table if not exists public.platform_access (
  user_id  uuid not null references public.profiles(id) on delete cascade,
  day      date not null,
  platform text not null check (platform in ('web','android')),
  primary key (user_id, day, platform)
);

-- ---------------------------------------------------------------------
-- Tags iniciais
-- ---------------------------------------------------------------------
insert into public.interest_tags (category, label) values
 ('musica','Sertanejo'),('musica','Forró'),('musica','Pagode'),('musica','Funk'),('musica','MPB'),('musica','Rock'),('musica','Gospel'),('musica','Pop'),('musica','Eletrônica'),('musica','Rap'),
 ('esportes','Futebol'),('esportes','Academia'),('esportes','Corrida'),('esportes','Vôlei'),('esportes','Ciclismo'),('esportes','Natação'),('esportes','Pesca'),
 ('religiao','Católico(a)'),('religiao','Evangélico(a)'),('religiao','Espírita'),('religiao','Religiões de matriz africana'),('religiao','Sem religião'),('religiao','Espiritualizado(a)'),
 ('pets','Amo cachorros'),('pets','Amo gatos'),('pets','Tenho pet'),('pets','Não curto pets'),
 ('filhos','Tenho filhos'),('filhos','Quero ter filhos'),('filhos','Não quero filhos'),('filhos','Ainda não sei'),
 ('hobbies','Cinema e séries'),('hobbies','Leitura'),('hobbies','Games'),('hobbies','Dança'),('hobbies','Fotografia'),('hobbies','Cozinhar'),('hobbies','Rio e cachoeira'),('hobbies','Festas'),('hobbies','Violão'),
 ('comida','Churrasco'),('comida','Pizza'),('comida','Comida mineira'),('comida','Japonesa'),('comida','Vegetariano(a)'),('comida','Doces'),('comida','Açaí'),
 ('viagens','Praia'),('viagens','Montanha'),('viagens','Mochilão'),('viagens','Roça e interior'),('viagens','Viagem internacional'),('viagens','Road trip')
on conflict do nothing;
