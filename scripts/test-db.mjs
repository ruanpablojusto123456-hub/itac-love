// Testa as migrações SQL num PostgreSQL embutido (PGlite), simulando o ambiente Supabase.
import { PGlite } from '@electric-sql/pglite'
import { pgcrypto } from '@electric-sql/pglite/contrib/pgcrypto'
import fs from 'node:fs'

const db = new PGlite({ extensions: { pgcrypto } })
const ok = (c, m) => { if (!c) { console.error('❌', m); process.exitCode = 1 } else console.log('✅', m) }

await db.exec(`
create role anon; create role authenticated; create role service_role;
create schema extensions; create extension pgcrypto with schema extensions;
create schema auth; create schema storage;
create table auth.users (id uuid primary key default gen_random_uuid(), email text, raw_user_meta_data jsonb default '{}');
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claim.role', true),''),'anon') $$;
create table storage.buckets (id text primary key, name text, public boolean);
create table storage.objects (id uuid primary key default gen_random_uuid(), bucket_id text, name text);
alter table storage.objects enable row level security;
create function storage.foldername(name text) returns text[] language sql immutable as $$ select string_to_array(name,'/') $$;
grant usage on schema public, auth, storage, extensions to anon, authenticated, service_role;
alter default privileges in schema public grant all on tables to anon, authenticated, service_role;
alter default privileges in schema public grant all on sequences to anon, authenticated, service_role;
`)
for (const f of ['0001_schema.sql', '0002_functions.sql', '0003_policies.sql', '0005_media_prompts_vip.sql', '0006_chat_reply_delete.sql']) {
  await db.exec(fs.readFileSync(new URL(`../supabase/migrations/${f}`, import.meta.url), 'utf8'))
  console.log('✅ migração', f)
}
await db.exec(`grant all on all tables in schema public to authenticated, anon; grant all on all sequences in schema public to authenticated;`)

// helpers
async function newUser(email, name) {
  const r = await db.query(`insert into auth.users(email, raw_user_meta_data) values ($1, $2) returning id`, [email, { full_name: name }])
  return r.rows[0].id
}
async function as(uid, fn) {
  await db.exec(`reset role`)
  await db.query(`select set_config('request.jwt.claim.sub', $1, false), set_config('request.jwt.claim.role', 'authenticated', false)`, [uid])
  await db.exec(`set role authenticated`)
  try { return await fn() } finally { await db.exec(`reset role`) }
}
async function expectErr(p, code, msg) {
  try { await p; ok(false, msg + ' (deveria falhar)') } catch (e) { ok(String(e.message).includes(code), `${msg} → ${code}`) }
}
const q = (s, p) => db.query(s, p).then(r => r.rows)

const admin = await newUser('admin@itaclove.com', 'Admin')
await q(`insert into public.admins(user_id, name) values ($1,'Admin')`, [admin])
const ana = await newUser('ana@x.com', 'Ana')
const bruno = await newUser('bruno@x.com', 'Bruno')
const kid = await newUser('kid@x.com', 'Kid')
ok((await q(`select count(*)::int n from profiles`))[0].n === 4, 'perfil criado automaticamente no cadastro do Auth')

const tags = (await q(`select id from interest_tags order by id limit 5`)).map(r => r.id)
async function onboard(uid, gender, show, tagIds) {
  await as(uid, async () => {
    await q(`update profiles set birth_date='1995-05-10', gender_identity=$2, orientation='Hétero', city='Itacarambi, MG', bio='Oi', looking_for='serio', show_genders=$3, terms_accepted_at=now(), privacy_accepted_at=now(), status='approved', trust_score=100 where id=$1`, [uid, gender, show])
    for (let i = 1; i <= 3; i++) await q(`insert into profile_photos(user_id, position, storage_path) values ($1,$2,$3)`, [uid, i, `${uid}/${i}.jpg`])
    for (const t of tagIds) await q(`insert into profile_interests(user_id, tag_id) values ($1,$2)`, [uid, t])
  })
}
await onboard(ana, 'mulher_cis', ['homens'], tags.slice(0, 4))
await onboard(bruno, 'homem_cis', ['mulheres'], tags.slice(1, 5))
const st = await q(`select status, trust_score from profiles where id=$1`, [ana])
ok(st[0].status === 'onboarding' && st[0].trust_score === 50, 'usuário NÃO consegue se auto-aprovar nem mudar a nota')

await expectErr(as(kid, () => q(`update profiles set birth_date = current_date - interval '16 years' where id=$1`, [kid])), 'MENOR_DE_IDADE', 'bloqueia menor de 18')
await expectErr(as(kid, () => q(`select submit_verification($1)`, [`${kid}/s.jpg`])), 'CADASTRO_INCOMPLETO', 'não envia verificação com cadastro incompleto')
await expectErr(as(ana, () => q(`select submit_verification($1)`, [`${bruno}/s.jpg`])), 'CAMINHO_INVALIDO', 'selfie precisa estar na pasta do próprio usuário')
await expectErr(as(ana, () => q(`select * from get_feed()`)), 'CONTA_NAO_LIBERADA', 'sem aprovação não acessa o feed')

await as(ana, () => q(`select submit_verification($1)`, [`${ana}/selfie.jpg`]))
await as(bruno, () => q(`select submit_verification($1)`, [`${bruno}/selfie.jpg`]))
ok((await q(`select status from profiles where id=$1`, [ana]))[0].status === 'pending_review', 'status "Em análise" após enviar a selfie')
await expectErr(as(ana, () => q(`select admin_review_verification((select id from verifications where user_id=$1), 'approve')`, [ana])), 'SOMENTE_ADMIN', 'usuário comum não aprova')
ok((await as(bruno, () => q(`select count(*)::int n from verifications`)))[0].n === 1, 'usuário só vê a própria verificação')

const vA = (await q(`select id from verifications where user_id=$1`, [ana]))[0].id
const vB = (await q(`select id from verifications where user_id=$1`, [bruno]))[0].id
await as(admin, () => q(`select admin_review_verification($1,'resubmit','Documento ilegível')`, [vB]))
ok((await q(`select status, rejection_reason from profiles where id=$1`, [bruno]))[0].status === 'needs_new_photo', 'admin pede nova foto')
await as(bruno, () => q(`select submit_verification($1)`, [`${bruno}/selfie2.jpg`]))
const vB2 = (await q(`select id from verifications where user_id=$1 and status='pending'`, [bruno]))[0].id
const path = await as(admin, () => q(`select admin_review_verification($1,'approve',null,'MG-12.345.678') p`, [vA]))
ok(path[0].p === `${ana}/selfie.jpg`, 'aprovação devolve caminho da selfie para apagar')
await as(admin, () => q(`select admin_mark_selfie_deleted($1)`, [vA]))
await as(admin, () => q(`select admin_review_verification($1,'approve',null,'MG12345678')`, [vB2]))
const b = await q(`select status, rejection_reason from profiles where id=$1`, [bruno])
ok(b[0].status === 'rejected' && /outra conta/.test(b[0].rejection_reason), 'mesmo documento em duas contas é reprovado')
// aprova Bruno com documento próprio
await as(bruno, () => q(`select submit_verification($1)`, [`${bruno}/selfie3.jpg`]))
await as(admin, () => q(`select admin_review_verification((select id from verifications where user_id=$1 and status='pending'),'approve',null,'MG99999')`, [bruno]))
const a = await q(`select status, verified, trust_score from profiles where id=$1`, [ana])
ok(a[0].status === 'approved' && a[0].verified && a[0].trust_score === 50, 'aprovado: selo verificado e nota 50')
ok((await q(`select count(*)::int n from notifications where user_id=$1 and type='verification_result'`, [bruno]))[0].n === 3, 'notificações do resultado enviadas')

// feed + afinidade
const feedA = await as(ana, () => q(`select * from get_feed()`))
ok(feedA.length === 1 && feedA[0].id === bruno, 'feed da Ana mostra o Bruno (filtro de gênero mútuo)')
ok(feedA[0].affinity > 50 && feedA[0].common_tags.length === 3, `afinidade calculada: ${feedA[0].affinity}% com 3 tags em comum`)
ok(feedA[0].photos.length === 3, 'feed traz as 3 fotos')

// cotas
await q(`update app_settings set quota_male_likes = 1`)
const qs = await as(bruno, () => q(`select quota_status() s`))
ok(qs[0].s.likes_left === 1 && !qs[0].s.likes_unlimited, 'homem: cota limitada exibida')
ok((await as(ana, () => q(`select quota_status() s`)))[0].s.likes_unlimited, 'mulher: curtidas ilimitadas')
const carla = await newUser('carla@x.com', 'Carla')
await onboard(carla, 'mulher_trans', ['homens'], tags.slice(0, 3))
await q(`update profiles set status='approved', verified=true where id=$1`, [carla])

const r1 = await as(bruno, () => q(`select like_profile($1,'like') r`, [carla]))
ok(r1[0].r.matched === false && r1[0].r.quota.likes_left === 0, 'curtida desconta da cota no servidor')
await expectErr(as(bruno, () => q(`select like_profile($1,'like')`, [ana])), 'COTA_CURTIDAS_ESGOTADA', 'cota esgotada bloqueia nova curtida')
await q(`update profiles set extra_likes = 1 where id=$1`, [bruno])
await as(bruno, () => q(`select like_profile($1,'like')`, [ana]))
ok((await q(`select extra_likes from profiles where id=$1`, [bruno]))[0].extra_likes === 0, 'usa curtida extra comprada quando a cota acaba')
const m = await as(ana, () => q(`select like_profile($1,'like') r`, [bruno]))
ok(m[0].r.matched === true, 'MATCH quando os dois se curtem')
const conv = m[0].r.conversation_id

// chat
await as(ana, () => q(`insert into messages(conversation_id, sender_id, body) values ($1,$2,'Oi, Bruno!')`, [conv, ana]))
ok((await q(`select first_message_at from matches where id=$1`, [m[0].r.match_id]))[0].first_message_at, 'primeira mensagem segura o match (não expira)')
await expectErr(as(carla, () => q(`insert into messages(conversation_id, sender_id, body) values ($1,$2,'invasão')`, [conv, carla])), '', 'quem não participa não envia mensagem')
ok((await as(carla, () => q(`select count(*)::int n from messages`)))[0].n === 0, 'quem não participa não lê a conversa')
await expectErr(as(ana, () => q(`insert into messages(conversation_id, sender_id, kind, body) values ($1,null,'system','falso')`, [conv])), '', 'usuário não forja mensagem do sistema')
await expectErr(as(ana, () => q(`select system_message($1,'x')`, [conv])), 'permission denied', 'função interna system_message bloqueada')
await as(bruno, () => q(`select set_self_destruct($1, 3600)`, [conv]))
await as(bruno, () => q(`insert into messages(conversation_id, sender_id, body) values ($1,$2,'some em 1h')`, [conv, bruno]))
ok((await q(`select expires_at from messages where body='some em 1h'`))[0].expires_at, 'autodestruição define validade da mensagem')
await as(ana, () => q(`select report_screenshot($1)`, [conv]))
ok((await q(`select body from messages where kind='system' order by created_at desc limit 1`))[0].body === 'Ana tentou tirar um print desta conversa.', 'aviso de print no chat')
await as(ana, () => q(`select mark_read($1)`, [conv]))
ok((await q(`select read_at from messages where body='some em 1h'`))[0].read_at, 'indicador de lida')
await q(`update messages set expires_at = now() - interval '1 minute' where body='some em 1h'`)
ok((await q(`select job_purge_messages() n`))[0].n === 1, 'mensagens vencidas apagadas do servidor')
const lst = await as(ana, () => q(`select * from my_conversations()`))
ok(lst.length === 1 && lst[0].other_name === 'Bruno', 'lista de conversas')

// v1.1: mídia, visualização única, perguntas, quem curtiu você
await as(ana, () => q(`insert into messages(conversation_id, sender_id, body, media_type, media_path, view_once) values ($1,$2,'', 'image', $3, true)`, [conv, ana, `${conv}/foto.jpg`]))
const vo = (await q(`select id from messages where media_type='image'`))[0].id
await expectErr(as(ana, () => q(`select open_view_once($1)`, [vo])), 'SO_DESTINATARIO', 'quem enviou não reabre a foto de visualização única')
ok((await as(bruno, () => q(`select open_view_once($1) p`, [vo])))[0].p === `${conv}/foto.jpg`, 'destinatário abre a foto uma vez')
await expectErr(as(bruno, () => q(`select open_view_once($1)`, [vo])), 'JA_VISUALIZADA', 'segunda abertura é bloqueada')
await expectErr(as(ana, () => q(`insert into messages(conversation_id, sender_id, body, media_type, media_path) values ($1,$2,'', 'image', 'outra/foto.jpg')`, [conv, ana])), 'CAMINHO_INVALIDO', 'mídia só na pasta da conversa')
await as(bruno, () => q(`insert into messages(conversation_id, sender_id, body, media_type, media_path, duration_sec) values ($1,$2,'', 'audio', $3, 12)`, [conv, bruno, `${conv}/a.webm`]))
ok((await as(ana, () => q(`select last_body from my_conversations()`)))[0].last_body === '🎤 Áudio', 'lista de conversas mostra "Áudio"')
await as(ana, () => q(`update profiles set prompts = '[{"q":"Meu rolê ideal","a":"Forró na praça"}]' where id=$1`, [ana]))
ok((await as(bruno, () => q(`select prompts from public_profiles where id=$1`, [ana])))[0].prompts.length === 1, 'perguntas do perfil visíveis para outros')
const carla2 = await newUser('carla2@x.com', 'Carla2')
await onboard(carla2, 'mulher_cis', ['homens'], tags.slice(0, 3))
await q(`update profiles set status='approved', verified=true where id=$1`, [carla2])
await q(`update profiles set extra_likes = 5 where id=$1`, [bruno])
await as(bruno, () => q(`select like_profile($1,'like')`, [carla2]))
const w1 = (await as(carla2, () => q(`select who_liked_me() w`)))[0].w
ok(w1.count === 1 && w1.people.length === 0 && !w1.vip, 'sem VIP: vê só quantas pessoas curtiram')
await q(`update profiles set vip_until = now() + interval '30 days' where id=$1`, [carla2])
const w2 = (await as(carla2, () => q(`select who_liked_me() w`)))[0].w
ok(w2.vip && w2.people.length === 1 && w2.people[0].name === 'Bruno', 'com VIP: vê quem curtiu')

// v1.2: responder e apagar mensagens
const orig = (await q(`select id from messages where body='Oi, Bruno!'`))[0].id
await as(bruno, () => q(`insert into messages(conversation_id, sender_id, body, reply_to) values ($1,$2,'Oi Ana! Respondendo',$3)`, [conv, bruno, orig]))
ok((await q(`select reply_to from messages where body='Oi Ana! Respondendo'`))[0].reply_to === orig, 'resposta guarda a mensagem citada')
const rep2 = (await q(`select id from messages where body='Oi Ana! Respondendo'`))[0].id
await expectErr(as(ana, () => q(`select delete_message($1, true)`, [rep2])), 'SO_QUEM_ENVIOU', 'só quem enviou apaga para todos')
await as(ana, () => q(`select delete_message($1, false)`, [rep2]))
ok((await q(`select $1 = any(hidden_for) h from messages where id=$2`, [ana, rep2]))[0].h, 'apagar para mim esconde só para quem apagou')
await as(bruno, () => q(`select delete_message($1, true)`, [rep2]))
const del = (await q(`select deleted_for_all, body from messages where id=$1`, [rep2]))[0]
ok(del.deleted_for_all && del.body === '', 'apagar para todos remove o conteúdo do servidor')
ok((await as(bruno, () => q(`select last_body from my_conversations() where conversation_id=$1`, [conv])))[0].last_body === '🚫 Mensagem apagada', 'lista mostra "Mensagem apagada"')

// expiração de match
await as(carla, () => q(`select like_profile($1,'like')`, [ana]))
await q(`update app_settings set quota_male_likes = 20`)
const ana_c = await as(ana, () => q(`select like_profile($1,'like') r`, [carla]))
await q(`update matches set expires_at = now() + interval '5 hours' where id=$1`, [ana_c[0].r.match_id])
ok((await q(`select job_match_reminders() n`))[0].n === 1, 'lembrete 6h antes de expirar')
await q(`update matches set expires_at = now() - interval '1 minute' where id=$1`, [ana_c[0].r.match_id])
await q(`select job_expire_matches()`)
ok((await q(`select status from matches where id=$1`, [ana_c[0].r.match_id]))[0].status === 'expired', 'match sem mensagem em 48h expira')

// convites
const inv = await as(carla, () => q(`select send_invite($1,'Vamos conversar?') id`, [bruno]))
const cid = await as(bruno, () => q(`select respond_invite($1,true) c`, [inv[0].id]))
ok(!!cid[0].c, 'convite aceito abre o chat')

// bloqueio e denúncia
await as(bruno, () => q(`select block_user($1)`, [carla]))
ok((await q(`select closed_at from conversations where id=$1`, [cid[0].c]))[0].closed_at, 'bloqueio encerra o chat')
await as(ana, () => q(`select report_user($1,'golpe','pediu pix')`, [bruno]))
const rep = (await q(`select id from reports`))[0].id
ok((await as(ana, () => q(`select count(*)::int n from trust_events`)))[0].n === 0, 'usuário não vê nota de confiança')
await q(`update app_settings set trust_report_penalty = 25`)
await as(admin, () => q(`select admin_resolve_report($1,true,'Confirmado')`, [rep]))
const br = await q(`select trust_score, status from profiles where id=$1`, [bruno])
ok(br[0].trust_score === 25 && br[0].status === 'under_review', 'denúncia confirmada reduz a nota e manda para revisão abaixo do limite')

// banimento bloqueia e-mail e documento
await as(admin, () => q(`select admin_moderate($1,'ban','Golpe')`, [bruno]))
await expectErr(newUser('bruno@x.com', 'Bruno 2'), 'EMAIL_BANIDO', 'e-mail banido não cria nova conta')
ok((await q(`select count(*)::int n from banned_identifiers where kind='document'`))[0].n === 1, 'documento banido registrado (hash)')

// encontro seguro
await as(ana, () => q(`insert into safe_dates(user_id, partner_id, place, starts_at, ends_at) values ($1,$2,'Praça','${new Date(Date.now()-7200e3).toISOString()}','${new Date(Date.now()-60e3).toISOString()}')`, [ana, carla]))
await q(`select job_safe_dates()`)
ok((await q(`select status from safe_dates`))[0].status === 'checkin_sent', 'check-in "Está tudo bem?" enviado pelo servidor')
await q(`update safe_dates set checkin_sent_at = now() - interval '31 minutes'`)
const al = await q(`select job_safe_dates() ids`)
ok(al[0].ids.length === 1, 'sem resposta em 30 min → alerta aos contatos')

// view pública não vaza dados sensíveis
const pv = await as(ana, () => q(`select * from public_profiles`))
ok(pv.length >= 1 && !('birth_date' in pv[0]) && !('trust_score' in pv[0]) && !('email' in pv[0]), 'perfil público não expõe e-mail, nascimento nem nota')
ok((await as(ana, () => q(`select count(*)::int n from profiles`)))[0].n === 1, 'usuário só lê a própria linha completa')

// exclusão de conta
await as(carla, () => q(`select delete_my_account()`))
ok((await q(`select count(*)::int n from profiles where id=$1`, [carla]))[0].n === 0, 'excluir conta apaga os dados (LGPD)')

const dash = await as(admin, () => q(`select admin_dashboard() d`))
console.log('📊 painel:', JSON.stringify(dash[0].d))
console.log(process.exitCode ? '\nHÁ FALHAS' : '\nTODOS OS TESTES PASSARAM')
