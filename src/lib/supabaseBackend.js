// =====================================================================
// MODO REAL — Supabase (mesmo banco para web e APK)
// =====================================================================
import { createClient } from '@supabase/supabase-js'
import { App } from '@capacitor/app'
import { Browser } from '@capacitor/browser'
import { isNative } from './platform'
import { toJpeg } from './image'

const NATIVE_REDIRECT = 'br.com.itaclove.app://login-callback'

export function createSupabaseBackend(url, anonKey) {
  const sb = createClient(url, anonKey, { auth: { flowType: 'pkce', persistSession: true, autoRefreshToken: true, detectSessionInUrl: true } })
  const listeners = new Set()
  // Agrupa vários eventos seguidos em uma única atualização (evita tempestade de requisições)
  let emitTimer = null
  const emit = () => { clearTimeout(emitTimer); emitTimer = setTimeout(() => listeners.forEach(fn => fn()), 400) }
  let channel = null
  let channelUser = null
  let adminCache = { uid: null, value: false }
  const urlCache = new Map()

  async function uidOrThrow() {
    const { data } = await sb.auth.getSession()   // local, sem ida ao servidor
    const id = data.session?.user?.id
    if (!id) throw new Error('NAO_AUTENTICADO')
    return id
  }
  const check = ({ data, error }) => { if (error) throw error; return data }

  function subscribe(userId) {
    if (userId === channelUser) return
    channelUser = userId || null
    if (channel) { sb.removeChannel(channel); channel = null }
    if (!userId) return
    channel = sb.channel('me-' + userId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'profiles', filter: `id=eq.${userId}` }, emit)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` }, emit)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'messages' }, emit)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'conversations' }, emit)
      .subscribe()
  }

  sb.auth.onAuthStateChange((event, session) => {
    // A troca automática de token não muda nada na tela: não recarrega
    if (event === 'TOKEN_REFRESHED') return
    // Depois de sair do callback (setTimeout) para não travar o cliente de auth
    setTimeout(() => { subscribe(session?.user?.id); emit() }, 0)
  })

  // Retorno do login Google no APK (deep link). Cada código só pode ser usado uma vez.
  const usedCodes = new Set()
  async function handleDeepLink(link) {
    if (!link || !link.startsWith(NATIVE_REDIRECT)) return
    try { await Browser.close() } catch { /* no Android o Chrome fecha sozinho */ }
    const u = new URL(link.replace(NATIVE_REDIRECT, 'https://x/cb').replace('#', '?'))
    const code = u.searchParams.get('code')
    const err = u.searchParams.get('error_description')
    if (err) { console.error('Login Google:', err); return }
    if (!code || usedCodes.has(code)) return
    usedCodes.add(code)
    const { error } = await sb.auth.exchangeCodeForSession(code)
    if (error) console.error('Login Google:', error.message)
    emit()
  }
  if (isNative()) {
    App.addListener('appUrlOpen', ({ url: link }) => handleDeepLink(link))
    // App aberto "a frio" pelo link de retorno
    App.getLaunchUrl().then(r => handleDeepLink(r?.url)).catch(() => {})
  }

  async function signed(bucket, path) {
    if (!path) return null
    const k = bucket + '/' + path, c = urlCache.get(k)
    if (c && c.exp > Date.now()) return c.url
    const { data, error } = await sb.storage.from(bucket).createSignedUrl(path, 3600)
    if (error) return null
    urlCache.set(k, { url: data.signedUrl, exp: Date.now() + 50 * 60e3 })
    return data.signedUrl
  }

  return {
    mode: 'supabase',
    client: sb,
    onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },

    async getSessionUser() { const { data } = await sb.auth.getSession(); const u = data.session?.user; return u ? { id: u.id, email: u.email } : null },
    onDeepLink: handleDeepLink,
    async signUpEmail(email, password) {
      const data = check(await sb.auth.signUp({ email: email.trim(), password, options: { emailRedirectTo: isNative() ? NATIVE_REDIRECT : window.location.origin + window.location.pathname } }))
      if (!data.session) throw new Error('Enviamos um e-mail de confirmação. Confirme e depois entre com sua senha.')
    },
    async signInEmail(email, password) { check(await sb.auth.signInWithPassword({ email: email.trim(), password })) },
    async signInGoogle() {
      if (isNative()) {
        const data = check(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: NATIVE_REDIRECT, skipBrowserRedirect: true } }))
        await Browser.open({ url: data.url })
      } else {
        check(await sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: window.location.origin + window.location.pathname } }))
      }
    },
    async signOut() { await sb.auth.signOut() },
    async resetPassword(email) { check(await sb.auth.resetPasswordForEmail(email.trim())) },

    async getMyProfile() {
      const id = await uidOrThrow()
      return check(await sb.from('profiles').select('*').eq('id', id).maybeSingle())
    },
    async updateProfile(patch) {
      const id = await uidOrThrow()
      return check(await sb.from('profiles').update(patch).eq('id', id).select().single())
    },
    async listTags() { return check(await sb.from('interest_tags').select('*').order('id')) },
    async getMyInterests() {
      const id = await uidOrThrow()
      return check(await sb.from('profile_interests').select('tag_id').eq('user_id', id)).map(r => r.tag_id)
    },
    async setInterests(ids) {
      const id = await uidOrThrow()
      check(await sb.from('profile_interests').delete().eq('user_id', id))
      if (ids.length) check(await sb.from('profile_interests').insert(ids.map(tag_id => ({ user_id: id, tag_id }))))
    },
    async getMyPhotos() {
      const id = await uidOrThrow()
      return check(await sb.from('profile_photos').select('position, storage_path').eq('user_id', id).order('position')).map(r => ({ position: r.position, path: r.storage_path }))
    },
    async uploadPhoto(position, blob) {
      const id = await uidOrThrow()
      const jpg = await toJpeg(blob, 1080, 0.82)
      const path = `${id}/${position}-${Date.now()}.jpg`
      check(await sb.storage.from('photos').upload(path, jpg, { contentType: 'image/jpeg' }))
      const old = (await sb.from('profile_photos').select('storage_path').eq('user_id', id).eq('position', position).maybeSingle()).data
      check(await sb.from('profile_photos').upsert({ user_id: id, position, storage_path: path }, { onConflict: 'user_id,position' }))
      if (old?.storage_path) await sb.storage.from('photos').remove([old.storage_path])
      return path
    },
    async removePhoto(position) {
      const id = await uidOrThrow()
      const old = (await sb.from('profile_photos').select('storage_path').eq('user_id', id).eq('position', position).maybeSingle()).data
      check(await sb.from('profile_photos').delete().eq('user_id', id).eq('position', position))
      if (old?.storage_path) await sb.storage.from('photos').remove([old.storage_path])
    },
    photoUrl: (path) => signed('photos', path),
    selfieUrl: (path) => signed('verifications', path),
    async acceptTerms() {
      const id = await uidOrThrow(); const t = new Date().toISOString()
      check(await sb.from('profiles').update({ terms_accepted_at: t, privacy_accepted_at: t, terms_version: '2026-11-01' }).eq('id', id))
    },
    async submitVerification(blob) {
      const id = await uidOrThrow()
      const jpg = await toJpeg(blob, 1400, 0.85)
      const path = `${id}/${Date.now()}.jpg`
      check(await sb.storage.from('verifications').upload(path, jpg, { contentType: 'image/jpeg' }))
      check(await sb.rpc('submit_verification', { p_selfie_path: path }))
    },
    async getMyLatestVerification() {
      const id = await uidOrThrow()
      return check(await sb.from('verifications').select('id,status,reason,created_at,reviewed_at').eq('user_id', id).order('created_at', { ascending: false }).limit(1).maybeSingle())
    },
    async listNotifications() {
      const id = await uidOrThrow()
      return check(await sb.from('notifications').select('*').eq('user_id', id).order('created_at', { ascending: false }).limit(50))
    },
    async markNotificationsRead() {
      const id = await uidOrThrow()
      await sb.from('notifications').update({ read_at: new Date().toISOString() }).eq('user_id', id).is('read_at', null)
    },
    async deleteAccount() {
      const id = await uidOrThrow()
      const { data: files } = await sb.storage.from('photos').list(id)
      if (files?.length) await sb.storage.from('photos').remove(files.map(f => `${id}/${f.name}`))
      check(await sb.rpc('delete_my_account'))
      await sb.auth.signOut()
    },
    async recordAccess(platform) { return check(await sb.rpc('record_access', { p_platform: platform })) },


    // ------------------------------------------------------------ FEED / MATCH
    async getFeed(f = {}) {
      const rows = check(await sb.rpc('get_feed', { p_min_age: f.minAge || 18, p_max_age: f.maxAge || 99, p_max_km: f.maxKm || null,
        p_genders: f.genders?.length ? f.genders : null, p_looking: f.looking?.length ? f.looking : null, p_tags: f.tags?.length ? f.tags : null, p_limit: 30 }))
      return rows
    },
    async getPublicProfile(id) {
      const me = await uidOrThrow()
      const p = check(await sb.from('public_profiles').select('*').eq('id', id).maybeSingle())
      if (!p) return null
      const mine = check(await sb.from('profile_interests').select('tag_id').eq('user_id', me)).map(r => r.tag_id)
      const { data: aff } = await sb.rpc('affinity', { a: me, b: id })
      return { ...p, affinity: aff ?? 0, common_tags: (p.tags || []).filter(t => mine.includes(t)) }
    },
    async quotaStatus() { return check(await sb.rpc('quota_status')) },
    async like(target, kind = 'like') {
      const r = check(await sb.rpc('like_profile', { p_target: target, p_kind: kind }))
      if (r.matched) {
        const m = check(await sb.from('matches').select('expires_at').eq('id', r.match_id).single())
        r.expires_at = m.expires_at; r.other = await this.getPublicProfile(target)
      }
      return r
    },
    async sendInvite(target, message) {
      const id = check(await sb.rpc('send_invite', { p_target: target, p_message: message || null }))
      return { id, quota: await this.quotaStatus() }
    },
    async respondInvite(id, accept) { return check(await sb.rpc('respond_invite', { p_invite: id, p_accept: accept })) },
    async listInvites() {
      const me = await uidOrThrow()
      const rows = check(await sb.from('invites').select('*').or(`from_id.eq.${me},to_id.eq.${me}`).order('created_at', { ascending: false }))
      const ids = [...new Set(rows.map(r => (r.from_id === me ? r.to_id : r.from_id)))]
      const profs = ids.length ? check(await sb.from('public_profiles').select('*').in('id', ids)) : []
      const withOther = rows.map(r => ({ ...r, other: profs.find(p => p.id === (r.from_id === me ? r.to_id : r.from_id)) })).filter(r => r.other)
      return { received: withOther.filter(r => r.to_id === me), sent: withOther.filter(r => r.from_id === me) }
    },
    // ------------------------------------------------------------ CHAT
    async listConversations() { return check(await sb.rpc('my_conversations')) },
    async getConversation(convId) {
      const me = await uidOrThrow()
      const c = check(await sb.from('conversations').select('*, match:matches(*)').eq('id', convId).single())
      const other = await this.getPublicProfile(c.user_a === me ? c.user_b : c.user_a)
      return { ...c, other }
    },
    async listMessages(convId) { return check(await sb.from('messages').select('*').eq('conversation_id', convId).order('created_at')) },
    async sendMessage(convId, body) {
      const me = await uidOrThrow()
      check(await sb.from('messages').insert({ conversation_id: convId, sender_id: me, body: String(body).trim().slice(0, 2000) }))
    },
    async sendMedia(convId, blob, { type, viewOnce = false, duration = null } = {}) {
      const me = await uidOrThrow()
      const file = type === 'image' ? await toJpeg(blob, 1280, 0.8) : blob
      const ext = type === 'image' ? 'jpg' : ((blob.type || '').includes('mp4') ? 'm4a' : 'webm')
      const path = `${convId}/${crypto.randomUUID()}.${ext}`
      check(await sb.storage.from('chat').upload(path, file, { contentType: type === 'image' ? 'image/jpeg' : (blob.type || 'audio/webm') }))
      check(await sb.from('messages').insert({ conversation_id: convId, sender_id: me, body: '', media_type: type, media_path: path, view_once: type === 'image' && !!viewOnce, duration_sec: duration }))
    },
    mediaUrl: (path) => signed('chat', path),
    async openViewOnce(msgId) {
      const path = check(await sb.rpc('open_view_once', { p_msg: msgId }))
      const { data, error } = await sb.storage.from('chat').createSignedUrl(path, 90)
      if (error) throw new Error('JA_VISUALIZADA')
      return data.signedUrl
    },
    async finishViewOnce(msgId) {
      const m = (await sb.from('messages').select('media_path, view_once, viewed_at').eq('id', msgId).maybeSingle()).data
      if (m?.view_once && m.viewed_at && m.media_path) await sb.storage.from('chat').remove([m.media_path])
    },
    async whoLikedMe() { return check(await sb.rpc('who_liked_me')) },
    async setSelfDestruct(convId, secs) { check(await sb.rpc('set_self_destruct', { p_conv: convId, p_seconds: secs || null })) },
    async reportScreenshot(convId) { await sb.rpc('report_screenshot', { p_conv: convId }) },
    async markRead(convId) { await sb.rpc('mark_read', { p_conv: convId }) },
    // ------------------------------------------------------------ SEGURANÇA
    async blockUser(target) { check(await sb.rpc('block_user', { p_target: target })) },
    async reportUser(target, reason, details, convId) { check(await sb.rpc('report_user', { p_target: target, p_reason: reason, p_details: details || null, p_conversation: convId || null })) },
    // ------------------------------------------------------------ ENCONTRO SEGURO
    async listContacts() { const me = await uidOrThrow(); return check(await sb.from('trusted_contacts').select('*').eq('user_id', me).order('created_at')) },
    async addContact(name, phone) { const me = await uidOrThrow(); check(await sb.from('trusted_contacts').insert({ user_id: me, name, phone })) },
    async removeContact(id) { check(await sb.from('trusted_contacts').delete().eq('id', id)) },
    async createSafeDate(d) {
      const me = await uidOrThrow()
      const sd = check(await sb.from('safe_dates').insert({ ...d, user_id: me }).select().single())
      // Envia o link aos contatos (Edge Function "safe-dates", modo "share")
      await sb.functions.invoke('safe-dates', { body: { action: 'share', safe_date_id: sd.id } }).catch(() => {})
      return sd
    },
    async listSafeDates() {
      const me = await uidOrThrow()
      const rows = check(await sb.from('safe_dates').select('*').eq('user_id', me).order('created_at', { ascending: false }))
      const ids = [...new Set(rows.map(r => r.partner_id).filter(Boolean))]
      const profs = ids.length ? check(await sb.from('public_profiles').select('id,name,photos').in('id', ids)) : []
      return rows.map(r => { const p = profs.find(x => x.id === r.partner_id); return { ...r, partner_name: p?.name, partner_photo: p?.photos?.[0] } })
    },
    async respondCheckin(id, ok) { check(await sb.rpc('respond_safe_checkin', { p_id: id, p_ok: ok })) },
    async cancelSafeDate(id) { check(await sb.from('safe_dates').update({ status: 'cancelled' }).eq('id', id)) },
    async shareLocation(id, lat, lng) { await sb.rpc('update_safe_location', { p_id: id, p_lat: lat, p_lng: lng }) },
    // ------------------------------------------------------------ PIX
    async createPixPayment(product) {
      const { data, error } = await sb.functions.invoke('pix-create', { body: { product } })
      if (error) throw new Error('Não foi possível gerar o Pix agora. Tente de novo.')
      return data
    },
    async getPayment(id) { return check(await sb.from('payments').select('*').eq('id', id).maybeSingle()) },
    async listPayments() { const me = await uidOrThrow(); return check(await sb.from('payments').select('*').eq('user_id', me).eq('status', 'paid').order('created_at', { ascending: false })) },
    // ------------------------------------------------------------ ADMIN
    async adminListReports(status = 'open') {
      let q = sb.from('reports').select('*, reported:profiles!reports_reported_id_fkey(id,name,email,status,trust_score,warnings), reporter:profiles!reports_reporter_id_fkey(name)').order('created_at', { ascending: false })
      if (status !== 'all') q = q.eq('status', status)
      const rows = check(await q)
      const ids = [...new Set(rows.map(r => r.reported_id))]
      const hist = ids.length ? check(await sb.from('reports').select('id,reported_id,reason,status,created_at').in('reported_id', ids)) : []
      const photos = ids.length ? check(await sb.from('profile_photos').select('user_id,storage_path').in('user_id', ids).eq('position', 1)) : []
      return rows.map(r => ({ ...r, reporter_name: r.reporter?.name || '—',
        reported: r.reported ? { ...r.reported, photo: photos.find(p => p.user_id === r.reported_id)?.storage_path } : null,
        history: hist.filter(h => h.reported_id === r.reported_id && h.id !== r.id) })).filter(r => r.reported)
    },
    async adminResolveReport(id, confirm, note, action, days) {
      check(await sb.rpc('admin_resolve_report', { p_report: id, p_confirm: confirm, p_note: note || null, p_action: action || null, p_days: days || null }))
    },
    async adminListUsers(q = '') {
      let query = sb.from('profiles').select('id,name,email,status,trust_score,warnings,verified,created_at').order('created_at', { ascending: false }).limit(100)
      if (q.trim()) query = query.or(`name.ilike.%${q.trim()}%,email.ilike.%${q.trim()}%`)
      const rows = check(await query)
      const ids = rows.map(r => r.id)
      const photos = ids.length ? check(await sb.from('profile_photos').select('user_id,storage_path').in('user_id', ids).eq('position', 1)) : []
      return rows.map(r => ({ ...r, photo: photos.find(p => p.user_id === r.id)?.storage_path }))
    },
    async adminModerate(userId, action, reason, days) { check(await sb.rpc('admin_moderate', { p_user: userId, p_action: action, p_reason: reason || null, p_days: days || null })) },
    async adminListPayments() {
      const rows = check(await sb.from('payments').select('*, profile:profiles(name)').eq('status', 'paid').order('paid_at', { ascending: false }).limit(100))
      return rows.map(r => ({ ...r, name: r.profile?.name }))
    },

    // ------------------------------------------------------------ ADMIN
    async isAdmin() {
      const id = (await sb.auth.getSession()).data.session?.user?.id
      if (!id) return false
      if (adminCache.uid === id) return adminCache.value
      const { data, error } = await sb.rpc('is_admin')
      if (error) return false
      adminCache = { uid: id, value: !!data }
      return adminCache.value
    },
    async adminListPending() {
      const rows = check(await sb.from('verifications').select('*, profile:profiles(*)').eq('status', 'pending').order('created_at'))
      const ids = rows.map(r => r.user_id)
      if (!ids.length) return []
      const photos = check(await sb.from('profile_photos').select('user_id, position, storage_path').in('user_id', ids).order('position'))
      const ints = check(await sb.from('profile_interests').select('user_id, interest_tags(label)').in('user_id', ids))
      const prev = check(await sb.from('verifications').select('user_id').in('user_id', ids).neq('status', 'pending'))
      return rows.map(r => ({
        ...r,
        photos: photos.filter(p => p.user_id === r.user_id).map(p => p.storage_path),
        interests: ints.filter(i => i.user_id === r.user_id).map(i => i.interest_tags?.label).filter(Boolean),
        previous: prev.filter(p => p.user_id === r.user_id).length,
      }))
    },
    async adminReview(id, decision, reason, documentNumber) {
      const path = check(await sb.rpc('admin_review_verification', { p_id: id, p_decision: decision, p_reason: reason || null, p_document: documentNumber || null }))
      // Exclui a imagem do documento após a análise (fica só o registro)
      if (path) {
        await sb.storage.from('verifications').remove([path])
        await sb.rpc('admin_mark_selfie_deleted', { p_id: id })
      }
      return decision
    },
    async adminDashboard() { return check(await sb.rpc('admin_dashboard')) },
    async adminRecentReviews() {
      const rows = check(await sb.from('verifications').select('id,status,reason,reviewed_at,created_at,profile:profiles(name)').neq('status', 'pending').order('reviewed_at', { ascending: false }).limit(20))
      return rows.map(r => ({ ...r, name: r.profile?.name || '(conta excluída)' }))
    },
    async getSettings() { return check(await sb.from('app_settings').select('*').eq('id', 1).single()) },
    async updateSettings(patch) { check(await sb.from('app_settings').update({ ...patch, updated_at: new Date().toISOString() }).eq('id', 1)) },
  }
}
