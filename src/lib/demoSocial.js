// Modo demonstração — feed, match, convites, chat, segurança, encontro seguro, Pix e moderação.
// Espelha as funções do banco (0002_functions.sql).
import { ageFrom } from './constants'
import { seedById, SEED_PROFILES } from './demoSeeds'
import { blobToDataURL, toJpeg } from './image'

export const genderGroup = (g) => ['mulher_cis', 'mulher_trans', 'travesti'].includes(g) ? 'mulheres' : ['homem_cis', 'homem_trans'].includes(g) ? 'homens' : 'nao_binarios'
const brDay = (d = new Date()) => new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Sao_Paulo' }).format(d)
function nextMidnightBR() {
  const t = new Date(); for (let i = 0; i < 48; i++) { const n = new Date(t.getTime() + i * 1800e3); if (brDay(n) !== brDay(t)) return new Date(n.getTime() - (n.getTime() % 1800e3)).toISOString() }
  return new Date(t.getTime() + 864e5).toISOString()
}
const pair = (a, b) => (a < b ? [a, b] : [b, a])

export function createDemoSocial(I) {
  const { load, save, requireMe, requireAdmin, notify, uid, now } = I
  const P = (id) => load().profiles[id]
  const approvedMe = () => {
    const u = requireMe(); const p = P(u.id)
    if (!p || p.status !== 'approved') throw new Error('CONTA_NAO_LIBERADA')
    return p
  }
  const blocked = (a, b) => load().blocks.some(x => (x.blocker === a && x.blocked === b) || (x.blocker === b && x.blocked === a))
  const tagsOf = (id) => load().interests[id] || []
  const photosOf = (id) => (load().photos[id] || []).map(p => p.path)

  function affinity(a, b) {
    const ta = tagsOf(a), tb = tagsOf(b), cc = ta.filter(t => tb.includes(t)).length
    const tag = ta.length + tb.length ? (2 * cc) / (ta.length + tb.length) : 0
    const la = P(a)?.looking_for, lb = P(b)?.looking_for
    const look = la === lb ? 1 : (la === 'nao_sei' || lb === 'nao_sei') ? 0.5 : (la === 'amizade' || lb === 'amizade') ? 0.2 : 0
    return Math.round(Math.min(100, 70 * tag + 30 * look))
  }
  function limits(p) {
    const s = load().settings
    if (p.vip_until && new Date(p.vip_until) > new Date()) return { likes: null, invites: null }
    const g = genderGroup(p.gender_identity)
    if (g === 'mulheres') return { likes: null, invites: null }
    if (g === 'homens') return { likes: s.quota_male_likes, invites: s.quota_male_invites }
    return s.quota_other_unlimited ? { likes: null, invites: null } : { likes: s.quota_other_likes, invites: s.quota_other_invites }
  }
  function usage(id, write = false) {
    const db = load(); const u = db.usage[id]
    if (u && u.day === brDay()) return u
    const fresh = { day: brDay(), likes: 0, invites: 0 }
    if (write) db.usage[id] = fresh
    return fresh
  }
  function quotaStatus(p) {
    const l = limits(p), u = usage(p.id)
    return {
      likes_unlimited: l.likes == null, invites_unlimited: l.invites == null,
      likes_left: l.likes == null ? null : Math.max(0, l.likes - u.likes), invites_left: l.invites == null ? null : Math.max(0, l.invites - u.invites),
      extra_likes: p.extra_likes || 0, extra_invites: p.extra_invites || 0, resets_at: nextMidnightBR(),
    }
  }
  function consume(p, kind) {
    const l = limits(p); const lim = kind === 'like' ? l.likes : l.invites
    if (lim == null) return
    const u = usage(p.id, true); const key = kind === 'like' ? 'likes' : 'invites'; const extra = kind === 'like' ? 'extra_likes' : 'extra_invites'
    if (u[key] < lim) u[key]++
    else if ((p[extra] || 0) > 0) p[extra]--
    else throw new Error(kind === 'like' ? 'COTA_CURTIDAS_ESGOTADA' : 'COTA_CONVITES_ESGOTADA')
  }
  function card(meId, p) {
    const mine = tagsOf(meId)
    return {
      id: p.id, name: p.name, age: ageFrom(p.birth_date), city: p.city, bio: p.bio, looking_for: p.looking_for,
      gender_identity: p.gender_identity, gender_other: p.gender_other, verified: p.verified, distance_km: p.km ?? null,
      affinity: affinity(meId, p.id), tags: tagsOf(p.id), common_tags: tagsOf(p.id).filter(t => mine.includes(t)), photos: photosOf(p.id), prompts: p.prompts || [],
    }
  }
  function sysMsg(convId, body) { load().messages.push({ id: uid(), conversation_id: convId, sender_id: null, kind: 'system', body, created_at: now(), read_at: null, expires_at: null }) }
  function myConv(convId, meId) {
    const c = load().conversations.find(x => x.id === convId)
    if (!c || ![c.user_a, c.user_b].includes(meId)) throw new Error('NAO_PARTICIPANTE')
    return c
  }
  const other = (c, meId) => (c.user_a === meId ? c.user_b : c.user_a)

  // Respostas automáticas dos perfis de exemplo (simulam a outra pessoa)
  function scheduleReply(convId, seedId) {
    const s = seedById(seedId); if (!s) return
    setTimeout(() => {
      try {
        const db = load(); const c = db.conversations.find(x => x.id === convId)
        if (!c || c.closed_at) return
        db.messages.forEach(m => { if (m.conversation_id === convId && m.sender_id !== seedId && m.sender_id && !m.read_at) m.read_at = now() })
        const n = db.messages.filter(m => m.conversation_id === convId && m.sender_id === seedId).length
        if (n >= s.replies.length) { save(); return }
        const exp = c.self_destruct_seconds ? new Date(Date.now() + c.self_destruct_seconds * 1000).toISOString() : null
        db.messages.push({ id: uid(), conversation_id: convId, sender_id: seedId, kind: 'text', body: s.replies[n], created_at: now(), read_at: null, expires_at: exp })
        const meId = other(c, seedId)
        notify(meId, 'message', s.name, s.replies[n], { conversation_id: convId })
        save()
      } catch { /* ignore */ }
    }, 1800 + Math.random() * 1500)
  }

  // Rotinas que no servidor rodam pelo pg_cron
  function jobs() {
    const db = load(); if (!db.matches) return
    const t = Date.now(); let changed = false
    db.matches.forEach(m => {
      if (m.status !== 'active' || m.first_message_at) return
      const exp = new Date(m.expires_at).getTime()
      if (exp <= t) { m.status = 'expired'; changed = true; db.conversations.forEach(c => { if (c.match_id === m.id) c.closed_at = now() }) }
      else if (!m.reminder_sent && exp - t <= db.settings.match_reminder_hours * 3600e3) {
        m.reminder_sent = true; changed = true
        ;[m.user_a, m.user_b].forEach(u => notify(u, 'match_expiring', 'Seu match está quase expirando ⏳', 'Mande um oi antes que expire!'))
      }
    })
    const before = db.messages.length
    db.messages = db.messages.filter(m => !m.expires_at || new Date(m.expires_at).getTime() > t)
    if (db.messages.length !== before) changed = true
    db.safeDates.forEach(d => {
      if (d.status === 'scheduled' && new Date(d.ends_at).getTime() <= t) {
        d.status = 'checkin_sent'; d.checkin_sent_at = now(); changed = true
        notify(d.user_id, 'safe_checkin', 'Está tudo bem? 💙', 'Seu encontro deveria ter terminado. Toque para responder.')
      }
      const grace = db.settings.safe_date_grace_minutes * 60e3
      if (!d.alerted_at && (d.status === 'help' || (d.status === 'checkin_sent' && t - new Date(d.checkin_sent_at).getTime() >= grace))) {
        if (d.status !== 'help') d.status = 'alerted'
        d.alerted_at = now(); changed = true
        const contacts = db.contacts[d.user_id] || []
        d.alert_log = contacts.map(c => `SMS/WhatsApp para ${c.name} (${c.phone}): "${P(d.user_id)?.name} pode precisar de ajuda. Encontro com ${P(d.partner_id)?.name || '—'} em ${d.place}. Última localização: ${d.last_lat ? `${d.last_lat.toFixed(4)}, ${d.last_lng.toFixed(4)}` : 'não compartilhada'}."`)
      }
    })
    if (changed) save()
  }
  if (typeof window !== 'undefined') setInterval(() => { try { jobs() } catch { /* sem sessão */ } }, 15000)

  return {
    runJobs: jobs,
    // ---------------------------------------------------------------- FEED
    async getFeed(f = {}) {
      jobs()
      const me = approvedMe(); const db = load(); const myG = genderGroup(me.gender_identity)
      const genders = f.genders?.length ? f.genders : me.show_genders
      const list = Object.values(db.profiles).filter(p =>
        p.id !== me.id && p.status === 'approved' && !p.paused &&
        genders.includes(genderGroup(p.gender_identity)) &&
        (!p.show_genders?.length || p.show_genders.includes(myG)) &&
        !db.likes.some(l => l.from === me.id && l.to === p.id) && !blocked(me.id, p.id) &&
        (!p.invisible || db.likes.some(l => l.from === p.id && l.to === me.id && l.kind === 'like')) &&
        (!f.minAge || ageFrom(p.birth_date) >= f.minAge) && (!f.maxAge || ageFrom(p.birth_date) <= f.maxAge) &&
        (!f.looking?.length || f.looking.includes(p.looking_for)) &&
        (!f.tags?.length || tagsOf(p.id).some(t => f.tags.includes(t))) &&
        (!f.maxKm || p.km == null || p.km <= f.maxKm))
      return list.map(p => card(me.id, p)).sort((a, b) => b.affinity - a.affinity)
    },
    async getPublicProfile(id) { const me = requireMe(); const p = P(id); if (!p || p.status !== 'approved' || blocked(me.id, id)) return null; return card(me.id, p) },
    async quotaStatus() { return quotaStatus(approvedMe()) },
    async like(target, kind = 'like') {
      const me = approvedMe(); const db = load(); const t = P(target)
      if (me.paused) throw new Error('CONTA_PAUSADA')
      if (!t || t.status !== 'approved' || blocked(me.id, target) || (kind === 'like' && t.paused)) throw new Error('PERFIL_INDISPONIVEL')
      if (kind === 'like') consume(me, 'like')
      db.likes = db.likes.filter(l => !(l.from === me.id && l.to === target))
      db.likes.push({ from: me.id, to: target, kind, at: now() })
      // perfis de exemplo marcados como "fã" já curtiram você
      const seed = seedById(target)
      const liked = db.likes.some(l => l.from === target && l.to === me.id && l.kind === 'like') || (seed?.fan && kind === 'like')
      if (kind === 'like' && liked) {
        const [a, b] = pair(me.id, target)
        if (!db.matches.some(m => m.user_a === a && m.user_b === b)) {
          const m = { id: uid(), user_a: a, user_b: b, status: 'active', created_at: now(), expires_at: new Date(Date.now() + db.settings.match_ttl_hours * 3600e3).toISOString(), first_message_at: null, reminder_sent: false }
          const c = { id: uid(), match_id: m.id, invite_id: null, user_a: a, user_b: b, self_destruct_seconds: null, closed_at: null, created_at: now() }
          db.matches.push(m); db.conversations.push(c)
          notify(me.id, 'match', 'Deu match! 💘', `Você e ${t.name} se curtiram. Mandem mensagem em até 48h!`)
          save()
          return { matched: true, match_id: m.id, conversation_id: c.id, expires_at: m.expires_at, other: card(me.id, t), quota: quotaStatus(me) }
        }
      }
      save()
      return { matched: false, quota: quotaStatus(me) }
    },
    // ------------------------------------------------------------ CONVITES
    async sendInvite(target, message) {
      const me = approvedMe(); const db = load(); const t = P(target)
      if (!t || t.status !== 'approved' || t.paused || blocked(me.id, target)) throw new Error('PERFIL_INDISPONIVEL')
      if (db.invites.some(i => i.from_id === me.id && i.to_id === target && i.status === 'pending')) throw new Error('CONVITE_JA_ENVIADO')
      consume(me, 'invite')
      const inv = { id: uid(), from_id: me.id, to_id: target, message: (message || '').slice(0, 300), status: 'pending', created_at: now() }
      db.invites.push(inv)
      db.likes = db.likes.filter(l => !(l.from === me.id && l.to === target)); db.likes.push({ from: me.id, to: target, kind: 'invite', at: now() })
      save()
      // perfis de exemplo aceitam o convite depois de alguns segundos
      if (seedById(target)) setTimeout(() => {
        const d = load(); const i = d.invites.find(x => x.id === inv.id); if (!i || i.status !== 'pending') return
        i.status = 'accepted'; i.responded_at = now()
        const [a, b] = pair(i.from_id, i.to_id)
        const c = { id: uid(), match_id: null, invite_id: i.id, user_a: a, user_b: b, self_destruct_seconds: null, closed_at: null, created_at: now() }
        d.conversations.push(c); notify(i.from_id, 'invite_accepted', 'Convite aceito! 🎉', `${t.name} aceitou seu convite. O chat está aberto.`, { conversation_id: c.id })
        save(); scheduleReply(c.id, target)
      }, 4000)
      return { id: inv.id, quota: quotaStatus(me) }
    },
    async respondInvite(id, accept) {
      const me = approvedMe(); const db = load(); const i = db.invites.find(x => x.id === id)
      if (!i || i.to_id !== me.id || i.status !== 'pending') throw new Error('CONVITE_INVALIDO')
      i.status = accept ? 'accepted' : 'declined'; i.responded_at = now()
      let convId = null
      if (accept) {
        const [a, b] = pair(i.from_id, i.to_id)
        const c = { id: uid(), match_id: null, invite_id: i.id, user_a: a, user_b: b, self_destruct_seconds: null, closed_at: null, created_at: now() }
        db.conversations.push(c); convId = c.id
        if (i.message) db.messages.push({ id: uid(), conversation_id: c.id, sender_id: i.from_id, kind: 'text', body: i.message, created_at: i.created_at, read_at: now(), expires_at: null })
      }
      save(); return convId
    },
    async listInvites() {
      const me = approvedMe(); const db = load()
      const map = (i, otherId) => ({ ...i, other: P(otherId) && !blocked(me.id, otherId) ? card(me.id, P(otherId)) : null })
      return {
        received: db.invites.filter(i => i.to_id === me.id).map(i => map(i, i.from_id)).filter(i => i.other).reverse(),
        sent: db.invites.filter(i => i.from_id === me.id).map(i => map(i, i.to_id)).filter(i => i.other).reverse(),
      }
    },
    // ---------------------------------------------------------------- CHAT
    async listConversations() {
      jobs()
      const me = approvedMe(); const db = load()
      return db.conversations.filter(c => [c.user_a, c.user_b].includes(me.id) && !c.closed_at).map(c => {
        const o = P(other(c, me.id)); const m = db.matches.find(x => x.id === c.match_id)
        if (m && m.status !== 'active') return null
        const msgs = db.messages.filter(x => x.conversation_id === c.id && !(x.hidden_for || []).includes(me.id))
        const last = msgs[msgs.length - 1]
        return {
          conversation_id: c.id, match_id: c.match_id, other_id: o.id, other_name: o.name, other_photo: photosOf(o.id)[0], other_verified: o.verified,
          expires_at: m?.expires_at || null, first_message_at: m?.first_message_at || null, self_destruct_seconds: c.self_destruct_seconds,
          last_body: last ? (last.deleted_for_all ? '🚫 Mensagem apagada' : last.media_type === 'image' ? '📷 Foto' : last.media_type === 'audio' ? '🎤 Áudio' : last.body) : null, last_at: last?.created_at || null, created_at: c.created_at,
          unread: msgs.filter(x => x.sender_id === o.id && !x.read_at).length,
        }
      }).filter(Boolean).sort((a, b) => (b.last_at || b.created_at).localeCompare(a.last_at || a.created_at))
    },
    async getConversation(convId) {
      const me = approvedMe(); const c = myConv(convId, me.id); const db = load()
      const m = db.matches.find(x => x.id === c.match_id)
      return { ...c, match: m || null, other: card(me.id, P(other(c, me.id))) }
    },
    async listMessages(convId) {
      jobs()
      const me = approvedMe(); myConv(convId, me.id)
      return load().messages.filter(m => m.conversation_id === convId && !(m.hidden_for || []).includes(me.id)).sort((a, b) => a.created_at.localeCompare(b.created_at))
    },
    async deleteMessage(msgId, forAll) {
      const me = approvedMe(); const db = load(); const m = db.messages.find(x => x.id === msgId)
      if (!m) return; myConv(m.conversation_id, me.id)
      if (forAll) {
        if (m.sender_id !== me.id) throw new Error('SO_QUEM_ENVIOU')
        if (m.media_path) delete db.files[m.media_path]
        Object.assign(m, { deleted_for_all: true, body: '', media_type: null, media_path: null, view_once: false })
      } else m.hidden_for = [...(m.hidden_for || []), me.id]
      save()
    },
    async sendMessage(convId, body, { replyTo = null } = {}) {
      const me = approvedMe(); const c = myConv(convId, me.id); const db = load()
      if (c.closed_at) throw new Error('CONVERSA_ENCERRADA')
      const text = String(body || '').trim().slice(0, 2000); if (!text) return
      const row = { id: uid(), conversation_id: convId, sender_id: me.id, kind: 'text', body: text, reply_to: replyTo, created_at: now(), read_at: null, expires_at: c.self_destruct_seconds ? new Date(Date.now() + c.self_destruct_seconds * 1000).toISOString() : null }
      db.messages.push(row)
      const m = db.matches.find(x => x.id === c.match_id); if (m && !m.first_message_at) m.first_message_at = now()
      save(); scheduleReply(convId, other(c, me.id))
      return { ...row }
    },
    async setSelfDestruct(convId, secs) {
      const me = approvedMe(); const c = myConv(convId, me.id)
      c.self_destruct_seconds = secs || null
      const label = { 3600: '1 hora', 86400: '24 horas', 604800: '7 dias' }[secs]
      sysMsg(convId, secs ? `${me.name} ativou a autodestruição: novas mensagens somem após ${label}.` : `${me.name} desativou a autodestruição das mensagens.`)
      save()
    },
    async reportScreenshot(convId) {
      const me = approvedMe(); const c = myConv(convId, me.id); if (c.closed_at) return
      sysMsg(convId, `${me.name} tentou tirar um print desta conversa.`); save()
    },
    // ---------------------------------------------------- MÍDIA NO CHAT
    async sendMedia(convId, blob, { type, viewOnce = false, duration = null, replyTo = null } = {}) {
      const me = approvedMe(); const c = myConv(convId, me.id); const db = load()
      if (c.closed_at) throw new Error('CONVERSA_ENCERRADA')
      const data = type === 'image' ? await blobToDataURL(await toJpeg(blob, 900, 0.72)) : await blobToDataURL(blob)
      const path = `chat/${convId}/${uid()}.${type === 'image' ? 'jpg' : 'webm'}`
      db.files[path] = data
      db.messages.push({ id: uid(), conversation_id: convId, sender_id: me.id, kind: 'text', body: '', media_type: type, media_path: path,
        view_once: type === 'image' && !!viewOnce, viewed_at: null, duration_sec: duration, reply_to: replyTo, created_at: now(), read_at: null,
        expires_at: c.self_destruct_seconds ? new Date(Date.now() + c.self_destruct_seconds * 1000).toISOString() : null })
      const m = db.matches.find(x => x.id === c.match_id); if (m && !m.first_message_at) m.first_message_at = now()
      save(); scheduleReply(convId, other(c, me.id))
      // o perfil de exemplo "abre" a foto de visualização única
      if (viewOnce && seedById(other(c, me.id))) setTimeout(() => { const d = load(); const msg = d.messages.find(x => x.media_path === path); if (msg) { msg.viewed_at = now(); delete d.files[path]; save() } }, 2500)
    },
    async mediaUrl(path) { return path ? load().files[path] || null : null },
    async openViewOnce(msgId) {
      const me = approvedMe(); const db = load(); const m = db.messages.find(x => x.id === msgId)
      if (!m) throw new Error('NAO_PARTICIPANTE')
      myConv(m.conversation_id, me.id)
      if (!m.view_once) return db.files[m.media_path]
      if (m.sender_id === me.id) throw new Error('SO_DESTINATARIO')
      if (m.viewed_at) throw new Error('JA_VISUALIZADA')
      const url = db.files[m.media_path]
      m.viewed_at = now(); m.read_at ||= now(); save()
      return url
    },
    async finishViewOnce(msgId) { const db = load(); const m = db.messages.find(x => x.id === msgId); if (m?.view_once && m.viewed_at) { delete db.files[m.media_path]; save() } },
    // ------------------------------------------- QUEM CURTIU VOCÊ (VIP)
    async whoLikedMe() {
      const me = approvedMe(); const db = load()
      const vip = !!(me.vip_until && new Date(me.vip_until) > new Date())
      const myG = genderGroup(me.gender_identity)
      const ids = new Set(db.likes.filter(l => l.to === me.id && l.kind === 'like').map(l => l.from))
      SEED_PROFILES.forEach(sp => { const p = P(sp.id); if (sp.fan && p && (!p.show_genders?.length || p.show_genders.includes(myG))) ids.add(sp.id) })
      const fans = [...ids].map(P).filter(p => p && p.status === 'approved' && !blocked(me.id, p.id) && !db.likes.some(l => l.from === me.id && l.to === p.id))
      return { vip, count: fans.length, people: vip ? fans.map(p => card(me.id, p)) : [] }
    },
    async markRead(convId) {
      const me = approvedMe(); myConv(convId, me.id); let ch = false
      load().messages.forEach(m => { if (m.conversation_id === convId && m.sender_id && m.sender_id !== me.id && !m.read_at) { m.read_at = now(); ch = true } })
      if (ch) save()
    },
    // ----------------------------------------------------------- SEGURANÇA
    async blockUser(target) {
      const me = requireMe(); const db = load()
      if (!db.blocks.some(b => b.blocker === me.id && b.blocked === target)) db.blocks.push({ blocker: me.id, blocked: target, at: now() })
      const [a, b] = pair(me.id, target)
      db.conversations.forEach(c => { if (c.user_a === a && c.user_b === b && !c.closed_at) c.closed_at = now() })
      db.matches.forEach(m => { if (m.user_a === a && m.user_b === b && m.status === 'active') m.status = 'closed' })
      db.invites.forEach(i => { if (i.status === 'pending' && [i.from_id, i.to_id].includes(target) && [i.from_id, i.to_id].includes(me.id)) i.status = 'cancelled' })
      save()
    },
    async reportUser(target, reason, details, convId) {
      const me = requireMe(); load().reports.push({ id: uid(), reporter_id: me.id, reported_id: target, reason, details: (details || '').slice(0, 1000), conversation_id: convId || null, status: 'open', created_at: now() }); save()
    },
    // ------------------------------------------------------ ENCONTRO SEGURO
    async listContacts() { return load().contacts[requireMe().id] || [] },
    async addContact(name, phone) { const me = requireMe(); const db = load(); (db.contacts[me.id] ||= []).push({ id: uid(), name, phone }); save() },
    async removeContact(id) { const me = requireMe(); const db = load(); db.contacts[me.id] = (db.contacts[me.id] || []).filter(c => c.id !== id); save() },
    async createSafeDate(d) {
      const me = approvedMe(); const db = load()
      if (new Date(d.ends_at) <= new Date(d.starts_at)) throw new Error('O horário de término precisa ser depois do início.')
      if (!(db.contacts[me.id] || []).length) throw new Error('Cadastre pelo menos um contato de confiança.')
      const sd = { id: uid(), user_id: me.id, partner_id: d.partner_id, conversation_id: d.conversation_id, place: d.place, starts_at: d.starts_at, ends_at: d.ends_at, status: 'scheduled', share_token: uid().replace(/-/g, ''), created_at: now() }
      db.safeDates.push(sd); save(); return sd
    },
    async listSafeDates() { jobs(); const me = requireMe(); return load().safeDates.filter(d => d.user_id === me.id).map(d => ({ ...d, partner_name: P(d.partner_id)?.name, partner_photo: photosOf(d.partner_id)[0] })).reverse() },
    async respondCheckin(id, ok) { const me = requireMe(); const d = load().safeDates.find(x => x.id === id && x.user_id === me.id); if (!d) return; d.status = ok ? 'ok' : 'help'; d.responded_at = now(); save(); if (!ok) jobs() },
    async cancelSafeDate(id) { const me = requireMe(); const d = load().safeDates.find(x => x.id === id && x.user_id === me.id); if (d && ['scheduled', 'checkin_sent'].includes(d.status)) { d.status = 'cancelled'; save() } },
    async shareLocation(id, lat, lng) { const me = requireMe(); const d = load().safeDates.find(x => x.id === id && x.user_id === me.id); if (d) { Object.assign(d, { last_lat: lat, last_lng: lng, last_location_at: now() }); save() } },
    // ------------------------------------------------------------------ PIX
    async createPixPayment(product) {
      const me = approvedMe(); const db = load(); const s = db.settings
      const amount = { likes_pack: s.price_likes_pack_cents, invites_pack: s.price_invites_pack_cents, vip_month: s.price_vip_month_cents }[product]
      const id = uid()
      const copy = `00020126580014BR.GOV.BCB.PIX0136demo-itaclove-${id.slice(0, 8)}5204000053039865406${(amount / 100).toFixed(2)}5802BR5910ITAC LOVE6011ITACARAMBI62070503***6304DEMO`
      const pay = { id, user_id: me.id, product, quantity: 1, amount_cents: amount, provider: 'demo', status: 'pending', pix_copy_paste: copy, created_at: now() }
      db.payments.push(pay); save(); return pay
    },
    async getPayment(id) { return load().payments.find(p => p.id === id) || null },
    async simulatePixPaid(id) {
      const db = load(); const p = db.payments.find(x => x.id === id); if (!p || p.status === 'paid') return
      p.status = 'paid'; p.paid_at = now(); const u = P(p.user_id); const s = db.settings
      if (p.product === 'likes_pack') u.extra_likes = (u.extra_likes || 0) + s.likes_pack_size
      if (p.product === 'invites_pack') u.extra_invites = (u.extra_invites || 0) + s.invites_pack_size
      if (p.product === 'vip_month') u.vip_until = new Date(Math.max(Date.now(), new Date(u.vip_until || 0).getTime()) + 30 * 864e5).toISOString()
      notify(p.user_id, 'payment', 'Pagamento confirmado ✅', 'Seu Pix foi confirmado e o saldo já está disponível.'); save()
    },
    async listPayments() { const me = requireMe(); return load().payments.filter(p => p.user_id === me.id && p.status === 'paid').reverse() },
    // --------------------------------------------------------------- ADMIN
    async adminListReports(status = 'open') {
      requireAdmin(); const db = load()
      return db.reports.filter(r => status === 'all' || r.status === status).map(r => {
        const u = P(r.reported_id)
        return { ...r, reported: u ? { id: u.id, name: u.name, email: u.email, status: u.status, trust_score: u.trust_score, warnings: u.warnings || 0, photo: photosOf(u.id)[0] } : null,
          reporter_name: P(r.reporter_id)?.name || '—',
          history: db.reports.filter(x => x.reported_id === r.reported_id && x.id !== r.id).map(x => ({ reason: x.reason, status: x.status, created_at: x.created_at })) }
      }).filter(r => r.reported).reverse()
    },
    async adminResolveReport(id, confirm, note, action, days) {
      const admin = requireAdmin(); const db = load(); const s = db.settings
      const r = db.reports.find(x => x.id === id); if (!r || r.status !== 'open') throw new Error('Denúncia já analisada.')
      Object.assign(r, { status: confirm ? 'confirmed' : 'dismissed', admin_note: note, reviewed_by: admin.id, reviewed_at: now() })
      if (confirm) {
        const u = P(r.reported_id); u.trust_score = Math.max(0, u.trust_score - s.trust_report_penalty)
        db.trust.push({ user_id: u.id, delta: -s.trust_report_penalty, reason: 'Denúncia confirmada: ' + r.reason, at: now() })
        if (u.trust_score < s.trust_review_threshold && u.status === 'approved') u.status = 'under_review'
        if (action) { save(); await this.adminModerate(u.id, action, note, days); return }
      }
      save()
    },
    async adminListUsers(q = '') {
      requireAdmin(); const db = load(); const t = q.trim().toLowerCase()
      return Object.values(db.profiles).filter(p => !t || (p.name || '').toLowerCase().includes(t) || (p.email || '').includes(t))
        .map(p => ({ id: p.id, name: p.name, email: p.email, status: p.status, trust_score: p.trust_score, warnings: p.warnings || 0, verified: p.verified, photo: photosOf(p.id)[0], created_at: p.created_at, reports: db.reports.filter(r => r.reported_id === p.id).length }))
        .sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''))
    },
    async adminModerate(userId, action, reason, days = 7) {
      const admin = requireAdmin(); const db = load(); const u = P(userId); if (!u) throw new Error('Usuário não encontrado.')
      if (action === 'warn') { u.warnings = (u.warnings || 0) + 1; notify(u.id, 'warning', 'Advertência', reason || 'Você recebeu uma advertência da moderação.') }
      if (action === 'suspend') { u.status = 'suspended'; u.suspended_until = new Date(Date.now() + days * 864e5).toISOString() }
      if (action === 'ban') {
        u.status = 'banned'; u.paused = true; (db.banned ||= []).push(u.email)
        if (db.docs?.[u.id]) (db.bannedDocs ||= []).push(db.docs[u.id])
        db.conversations.forEach(c => { if ([c.user_a, c.user_b].includes(u.id)) c.closed_at ||= now() })
      }
      if (action === 'restore') { u.status = 'approved'; u.suspended_until = null }
      db.moderation.push({ user_id: u.id, admin_id: admin.id, action, reason, at: now() }); save()
    },
    async adminListPayments() { requireAdmin(); const db = load(); return db.payments.filter(p => p.status === 'paid').map(p => ({ ...p, name: P(p.user_id)?.name })).reverse() },
    async adminDashboardExtra() {
      requireAdmin(); const db = load(); const paid = db.payments.filter(p => p.status === 'paid')
      return { denuncias_abertas: db.reports.filter(r => r.status === 'open').length, encontros_ativos: db.safeDates.filter(d => ['scheduled', 'checkin_sent', 'help'].includes(d.status)).length, vendas_pix_qtd: paid.length, vendas_pix_total_cents: paid.reduce((s, p) => s + p.amount_cents, 0) }
    },
    // Atalho da demonstração: aprova a própria conta sem abrir o painel
    async demoSelfApprove() {
      const u = requireMe(); const db = load(); const v = db.verifications.find(x => x.user_id === u.id && x.status === 'pending')
      if (!v) return
      const p = P(u.id)
      Object.assign(p, { status: 'approved', verified: true, verified_at: now(), rejection_reason: null, trust_score: db.settings.trust_initial })
      Object.assign(v, { status: 'approved', reviewed_by: 'admin', reviewed_at: now(), selfie_path: null, selfie_deleted_at: now() })
      notify(p.id, 'verification_result', 'Perfil aprovado! 💙', 'Seu perfil foi verificado.')
      if (!db.invites.some(i => i.to_id === p.id)) {
        db.invites.push({ id: uid(), from_id: 'p_larissa', to_id: p.id, message: 'Oi! Vi que você também é daqui. Bora conversar? 😊', status: 'pending', created_at: now() })
        notify(p.id, 'invite', 'Novo convite de conversa 💌', 'Larissa quer conversar com você.')
      }
      save()
    },
  }
}
