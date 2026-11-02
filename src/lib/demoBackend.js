// =====================================================================
// MODO DEMONSTRAÇÃO — simula o Supabase dentro do navegador (localStorage).
// Aplica as MESMAS regras do banco (0002_functions.sql) para você testar o
// fluxo completo sem servidor. Os dados ficam só neste navegador.
// =====================================================================
import { DEFAULT_TAGS, ageFrom } from './constants'
import { blobToDataURL, demoAvatar, demoSelfie, toJpeg } from './image'
import { SEED_PROFILES } from './demoSeeds'
import { handleIncomingNotification } from './notify'

const KEY = 'itaclove_demo_v3'
const listeners = new Set()
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2) + Date.now().toString(36))
const now = () => new Date().toISOString()

const DEFAULT_SETTINGS = {
  quota_male_likes: 20, quota_male_invites: 5, quota_other_unlimited: false, quota_other_likes: 20, quota_other_invites: 5,
  scam_words: ['pix', 'empréstimo', 'transferência', 'depósito', 'dinheiro', 'cartão'],
  trust_initial: 50, trust_weekly_gain: 2, trust_report_penalty: 15, trust_review_threshold: 30,
  match_ttl_hours: 48, match_reminder_hours: 6, safe_date_grace_minutes: 30,
  price_likes_pack_cents: 990, likes_pack_size: 30, price_invites_pack_cents: 990, invites_pack_size: 10, price_vip_month_cents: 2990,
  latest_app_version: '1.0.0', apk_download_url: '', terms_version: '2026-11-01',
}

let memory = null
function load() {
  if (memory) return memory
  try { memory = JSON.parse(localStorage.getItem(KEY) || 'null') } catch { memory = null }
  if (!memory) memory = seed()
  return memory
}
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(memory)) }
  catch (e) {
    if (String(e).includes('Quota')) throw new Error('Armazenamento do navegador cheio (modo demonstração). Use "Zerar demonstração".')
  }
  listeners.forEach(fn => fn())
}
// Sincroniza entre abas (ex.: painel admin em outra aba aprovando o cadastro)
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => { if (e.key === KEY) { memory = null; listeners.forEach(fn => fn()) } })
}

function emptyProfile(id, email, name) {
  return {
    id, email, name: name || null, birth_date: null, gender_identity: null, gender_other: null, orientation: null, city: null,
    lat: null, lng: null, bio: '', looking_for: null, show_genders: [], status: 'onboarding', rejection_reason: null,
    verified: false, verified_at: null, trust_score: 50, invisible: false, paused: false, prompts: [],
    terms_accepted_at: null, privacy_accepted_at: null, extra_likes: 0, extra_invites: 0, created_at: now(),
  }
}

function seed() {
  const db = { users: [], profiles: {}, photos: {}, files: {}, interests: {}, verifications: [], notifications: [], settings: { ...DEFAULT_SETTINGS }, session: null, access: [] }
  db.users.push({ id: 'admin', email: 'admin@itaclove.com', password: 'admin123', isAdmin: true })
  // Dois cadastros de exemplo aguardando análise, para o painel não começar vazio
  const people = [
    { name: 'Juliana Souza', g: 'mulher_cis', show: ['homens'], birth: '1997-03-14', look: 'serio', hue: 340, bio: 'Professora, amo forró e um bom pé de serra no fim de semana.', tags: [2, 17, 33, 39] },
    { name: 'Rafael Lima', g: 'homem_cis', show: ['mulheres'], birth: '1993-08-02', look: 'nao_sei', hue: 200, bio: 'Pescador nas horas vagas, Rio São Francisco é meu lugar.', tags: [11, 17, 39, 43] },
  ]
  people.forEach((p, i) => {
    const id = 'seed' + i, email = `exemplo${i + 1}@itaclove.com`
    db.users.push({ id, email, password: 'exemplo123' })
    db.profiles[id] = { ...emptyProfile(id, email, p.name), birth_date: p.birth, gender_identity: p.g, orientation: 'Heterossexual', city: 'Itacarambi, MG', bio: p.bio, looking_for: p.look, show_genders: p.show, status: 'pending_review', terms_accepted_at: now(), privacy_accepted_at: now() }
    db.photos[id] = [0, 1, 2].map(v => { const path = `photos/${id}/${v + 1}.jpg`; db.files[path] = demoAvatar(p.name, p.hue, v); return { position: v + 1, path } })
    db.interests[id] = p.tags
    const sp = `verifications/${id}/selfie.jpg`; db.files[sp] = demoSelfie(p.name, p.hue)
    db.verifications.push({ id: uid(), user_id: id, selfie_path: sp, status: 'pending', created_at: new Date(Date.now() - (i + 1) * 3600e3).toISOString() })
  })
  // Perfis de exemplo já aprovados (para testar feed, match e chat)
  Object.assign(db, { likes: [], usage: {}, matches: [], invites: [], conversations: [], messages: [], blocks: [], reports: [], contacts: {}, safeDates: [], payments: [], moderation: [], trust: [] })
  SEED_PROFILES.forEach((p, i) => {
    const id = p.id, email = `${id}@exemplo.itaclove.com`
    db.users.push({ id, email, password: 'exemplo123', seed: true })
    const birth = new Date(Date.now() - (p.age * 365.25 + 40) * 864e5).toISOString().slice(0, 10)
    db.profiles[id] = { ...emptyProfile(id, email, p.name), birth_date: birth, gender_identity: p.g, orientation: p.o || 'Heterossexual', city: p.city || 'Itacarambi, MG', bio: p.bio, looking_for: p.look, show_genders: p.show, status: 'approved', verified: true, verified_at: now(), trust_score: p.trust ?? 70, terms_accepted_at: now(), privacy_accepted_at: now(), km: p.km, prompts: p.prompts || [] }
    db.photos[id] = [0, 1, 2].map(v => { const path = `photos/${id}/${v + 1}.jpg`; db.files[path] = demoAvatar(p.name, p.hue, v, 300); return { position: v + 1, path } })
    db.interests[id] = p.tags
  })
  // Uma denúncia de exemplo na fila do admin
  db.reports.push({ id: uid(), reporter_id: 'p_camila', reported_id: 'p_carlos', reason: 'golpe', details: 'Pediu dinheiro no Pix logo na segunda mensagem.', status: 'open', created_at: new Date(Date.now() - 5 * 3600e3).toISOString() })
  memory = db
  try { localStorage.setItem(KEY, JSON.stringify(db)) } catch { /* sem storage: segue em memória */ }
  return db
}

const me = () => { const db = load(); return db.session ? db.users.find(u => u.id === db.session) : null }
const requireMe = () => { const u = me(); if (!u) throw new Error('NAO_AUTENTICADO'); return u }
const requireAdmin = () => { const u = requireMe(); if (!u.isAdmin) throw new Error('SOMENTE_ADMIN'); return u }
const notify = (user_id, type, title, body, data = {}) => {
  const db = load(); db.notifications.unshift({ id: uid(), user_id, type, title, body, data, created_at: now(), read_at: null })
  if (db.session === user_id) setTimeout(() => handleIncomingNotification({ title, body, data }), 0)
}
const docHash = (v) => String(v || '').replace(/[^0-9a-z]/gi, '').toUpperCase()

export const _internals = { load, save, me, requireMe, requireAdmin, notify, uid, now, emit: () => listeners.forEach(fn => fn()) }

export const demoBackend = {
  mode: 'demo',
  onChange(fn) { listeners.add(fn); return () => listeners.delete(fn) },
  reset() { localStorage.removeItem(KEY); memory = null; load(); listeners.forEach(fn => fn()) },

  async getSessionUser() { const u = me(); return u ? { id: u.id, email: u.email } : null },
  async signUpEmail(email, password) {
    const db = load(); email = email.trim().toLowerCase()
    if ((db.banned || []).includes(email)) throw new Error('EMAIL_BANIDO')
    if (db.users.some(u => u.email === email)) throw new Error('User already registered')
    if (password.length < 6) throw new Error('A senha precisa ter pelo menos 6 caracteres.')
    const id = uid(); db.users.push({ id, email, password }); db.profiles[id] = emptyProfile(id, email)
    db.session = id; save()
  },
  async signInEmail(email, password) {
    const db = load(); const u = db.users.find(x => x.email === email.trim().toLowerCase() && x.password === password)
    if (!u) throw new Error('Invalid login credentials')
    db.session = u.id; save()
  },
  async signInGoogle() {
    // Simulação: no modo real abre a tela de login do Google
    const db = load(); const email = 'voce.google@gmail.com'
    let u = db.users.find(x => x.email === email)
    if (!u) { u = { id: uid(), email, password: null }; db.users.push(u); db.profiles[u.id] = emptyProfile(u.id, email, 'Você (Google)') }
    db.session = u.id; save()
  },
  async signOut() { load().session = null; save() },
  async resetPassword() { /* no modo real envia e-mail */ },

  async getMyProfile() { const u = requireMe(); return u.isAdmin ? null : { ...load().profiles[u.id] } },
  async updateProfile(patch) {
    const u = requireMe(); const p = load().profiles[u.id]
    const blocked = ['status', 'verified', 'verified_at', 'trust_score', 'rejection_reason', 'extra_likes', 'extra_invites', 'email']
    blocked.forEach(k => delete patch[k])
    if (p.verified) { delete patch.name; delete patch.birth_date }
    if (patch.birth_date && ageFrom(patch.birth_date) < 18) throw new Error('MENOR_DE_IDADE')
    Object.assign(p, patch); save(); return { ...p }
  },
  async listTags() { return DEFAULT_TAGS },
  async getMyInterests() { return load().interests[requireMe().id] || [] },
  async setInterests(ids) { load().interests[requireMe().id] = [...new Set(ids)]; save() },
  async getMyPhotos() { return load().photos[requireMe().id] || [] },
  async uploadPhoto(position, blob) {
    const u = requireMe(); const db = load()
    const small = await toJpeg(blob, 800, 0.75)
    const path = `photos/${u.id}/${position}-${Date.now()}.jpg`
    const list = (db.photos[u.id] || []).filter(p => p.position !== position)
    const old = (db.photos[u.id] || []).find(p => p.position === position); if (old) delete db.files[old.path]
    db.files[path] = await blobToDataURL(small)
    db.photos[u.id] = [...list, { position, path }].sort((a, b) => a.position - b.position); save()
    return path
  },
  async removePhoto(position) {
    const u = requireMe(); const db = load()
    const old = (db.photos[u.id] || []).find(p => p.position === position); if (old) delete db.files[old.path]
    db.photos[u.id] = (db.photos[u.id] || []).filter(p => p.position !== position); save()
  },
  async photoUrl(path) { return path ? load().files[path] || null : null },
  async selfieUrl(path) { return path ? load().files[path] || null : null },
  async acceptTerms() { const p = load().profiles[requireMe().id]; p.terms_accepted_at = now(); p.privacy_accepted_at = now(); save() },

  async submitVerification(blob) {
    const u = requireMe(); const db = load(); const p = db.profiles[u.id]
    if (!['onboarding', 'needs_new_photo', 'rejected'].includes(p.status)) throw new Error('STATUS_INVALIDO')
    if (!p.name || !p.birth_date || !p.gender_identity || !p.city || !p.looking_for || !p.show_genders?.length) throw new Error('CADASTRO_INCOMPLETO')
    if (ageFrom(p.birth_date) < 18) throw new Error('MENOR_DE_IDADE')
    if ((db.photos[u.id] || []).length !== 3) throw new Error('PRECISA_3_FOTOS')
    if ((db.interests[u.id] || []).length < 3) throw new Error('PRECISA_3_INTERESSES')
    if (!p.terms_accepted_at) throw new Error('TERMOS_NAO_ACEITOS')
    const path = `verifications/${u.id}/${Date.now()}.jpg`
    db.files[path] = await blobToDataURL(await toJpeg(blob, 900, 0.75))
    db.verifications.push({ id: uid(), user_id: u.id, selfie_path: path, status: 'pending', created_at: now() })
    p.status = 'pending_review'; p.rejection_reason = null; save()
  },
  async getMyLatestVerification() {
    const u = requireMe(); return load().verifications.filter(v => v.user_id === u.id).sort((a, b) => b.created_at.localeCompare(a.created_at))[0] || null
  },
  async listNotifications() { const u = requireMe(); return load().notifications.filter(n => n.user_id === u.id) },
  async markNotificationsRead() { const u = requireMe(); load().notifications.forEach(n => { if (n.user_id === u.id && !n.read_at) n.read_at = now() }); save() },
  async deleteAccount() {
    const u = requireMe(); const db = load()
    ;(db.photos[u.id] || []).forEach(p => delete db.files[p.path])
    delete db.photos[u.id]; delete db.profiles[u.id]; delete db.interests[u.id]
    db.verifications = db.verifications.filter(v => v.user_id !== u.id)
    db.notifications = db.notifications.filter(n => n.user_id !== u.id)
    db.users = db.users.filter(x => x.id !== u.id); db.session = null; save()
  },
  async recordAccess(platform) {
    const db = load(); const u = me()
    if (u && !u.isAdmin) { const day = new Date().toISOString().slice(0, 10); if (!db.access.some(a => a.u === u.id && a.d === day && a.p === platform)) { db.access.push({ u: u.id, d: day, p: platform }); save() } }
    return { latest_app_version: db.settings.latest_app_version, apk_download_url: db.settings.apk_download_url }
  },

  // ------------------------------------------------------------ ADMIN
  async isAdmin() { return !!me()?.isAdmin },
  async adminListPending() {
    requireAdmin(); const db = load()
    return db.verifications.filter(v => v.status === 'pending').sort((a, b) => a.created_at.localeCompare(b.created_at)).map(v => ({
      ...v, profile: { ...db.profiles[v.user_id] },
      photos: (db.photos[v.user_id] || []).map(p => p.path),
      interests: (db.interests[v.user_id] || []).map(id => DEFAULT_TAGS.find(t => t.id === id)?.label).filter(Boolean),
      previous: db.verifications.filter(x => x.user_id === v.user_id && x.id !== v.id).length,
    }))
  },
  async adminReview(id, decision, reason, documentNumber) {
    const admin = requireAdmin(); const db = load(); const s = db.settings
    const v = db.verifications.find(x => x.id === id)
    if (!v || v.status !== 'pending') throw new Error('Verificação já analisada.')
    const p = db.profiles[v.user_id]
    db.docs = db.docs || {}
    if (decision === 'approve' && documentNumber?.trim()) {
      const h = docHash(documentNumber)
      if ((db.bannedDocs || []).includes(h)) { decision = 'reject'; reason = 'Documento vinculado a conta banida.' }
      else if (Object.entries(db.docs).some(([u, d]) => d === h && u !== v.user_id)) { decision = 'reject'; reason = 'Este documento já está vinculado a outra conta.' }
      else db.docs[v.user_id] = h
    }
    if (decision === 'approve') {
      Object.assign(p, { status: 'approved', verified: true, verified_at: now(), rejection_reason: null, trust_score: s.trust_initial })
      notify(p.id, 'verification_result', 'Perfil aprovado! 💙', 'Seu perfil foi verificado. O ITAC LOVE está liberado para você.')
      if (db.invites && !db.users.find(x => x.id === p.id)?.seed && !db.invites.some(i => i.to_id === p.id)) {
        db.invites.push({ id: uid(), from_id: 'p_larissa', to_id: p.id, message: 'Oi! Vi que você também é daqui. Bora conversar? 😊', status: 'pending', created_at: now() })
        notify(p.id, 'invite', 'Novo convite de conversa 💌', 'Larissa quer conversar com você.')
      }
    } else if (decision === 'reject') {
      if (!reason?.trim()) throw new Error('Informe o motivo da reprovação.')
      Object.assign(p, { status: 'rejected', rejection_reason: reason })
      notify(p.id, 'verification_result', 'Verificação reprovada', reason)
    } else {
      Object.assign(p, { status: 'needs_new_photo', rejection_reason: reason || 'Envie uma nova selfie com o documento.' })
      notify(p.id, 'verification_result', 'Precisamos de uma nova foto', p.rejection_reason)
    }
    Object.assign(v, { status: decision === 'approve' ? 'approved' : decision === 'reject' ? 'rejected' : 'resubmit', reason, reviewed_by: admin.id, reviewed_at: now() })
    // Apaga a imagem do documento após a análise — fica só o registro
    delete db.files[v.selfie_path]; v.selfie_path = null; v.selfie_deleted_at = now()
    save()
    return decision
  },
  async adminDashboard() {
    requireAdmin(); const db = load(); const ps = Object.values(db.profiles)
    return {
      cadastros: ps.length, aprovados: ps.filter(p => p.status === 'approved').length,
      pendentes: db.verifications.filter(v => v.status === 'pending').length,
      denuncias_abertas: 0, banidos: ps.filter(p => p.status === 'banned').length, encontros_ativos: 0,
      vendas_pix_qtd: 0, vendas_pix_total_cents: 0,
      acessos_web_30d: db.access.filter(a => a.p === 'web').length, acessos_android_30d: db.access.filter(a => a.p === 'android').length,
    }
  },
  async adminRecentReviews() {
    requireAdmin(); const db = load()
    return db.verifications.filter(v => v.status !== 'pending').sort((a, b) => (b.reviewed_at || '').localeCompare(a.reviewed_at || '')).slice(0, 20)
      .map(v => ({ ...v, name: db.profiles[v.user_id]?.name || '(conta excluída)' }))
  },
  async getSettings() { return { ...load().settings } },
  async updateSettings(patch) { requireAdmin(); Object.assign(load().settings, patch); save() },
}
