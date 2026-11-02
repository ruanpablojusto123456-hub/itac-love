import { useState } from 'react'
import { BadgeCheck, ChevronLeft, ChevronRight, Heart, MapPin, Sparkles } from 'lucide-react'
import PhotoImg from '../components/PhotoImg'
import Watermark from '../components/Watermark'
import { LOOKING_FOR, genderLabel } from '../lib/constants'
import { tagLabel, useTags } from '../lib/hooks'
import { useSession } from '../lib/session'
import { blockCopy } from '../lib/protection'

export function AffinityBadge({ value, className = '' }) {
  const tone = value >= 70 ? 'bg-tertiary text-white' : value >= 40 ? 'bg-violet text-white' : 'bg-card/90 text-ink'
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[13px] font-bold shadow ${tone} ${className}`}><Sparkles className="w-3.5 h-3.5" />{value}% afinidade</span>
}

export function TagList({ tags, common = [], max, solid }) {
  const all = useTags()
  const sorted = [...tags].sort((a, b) => common.includes(b) - common.includes(a))
  const shown = max ? sorted.slice(0, max) : sorted
  return (
    <div className="flex flex-wrap gap-1.5">
      {shown.map(t => common.includes(t)
        ? <span key={t} className="rounded-full bg-tertiary-fixed text-tertiary px-2.5 py-1 text-[12px] font-bold ring-1 ring-tertiary/30">✓ {tagLabel(all, t)}</span>
        : <span key={t} className={`rounded-full text-ink px-2.5 py-1 text-[12px] font-semibold ${solid ? 'bg-surface-mid' : 'bg-card/80'}`}>{tagLabel(all, t)}</span>)}
      {max && sorted.length > max && <span className="rounded-full bg-card/60 px-2.5 py-1 text-[12px] font-semibold">+{sorted.length - max}</span>}
    </div>
  )
}

// Carrossel de fotos com marca d'água (tocar nas laterais troca a foto)
export function PhotoCarousel({ photos, className = '', blurred }) {
  const { profile } = useSession()
  const [i, setI] = useState(0)
  const n = photos?.length || 0
  return (
    <div className={`relative overflow-hidden bg-surface-mid no-select ${className}`} {...blockCopy}>
      {n > 0 && <PhotoImg path={photos[i]} className={`w-full h-full object-cover transition ${blurred ? 'blur-2xl scale-110' : ''}`} alt="" />}
      <Watermark name={profile?.name} id={profile?.id} />
      {n > 1 && <>
        <div className="absolute top-2 inset-x-2 flex gap-1 z-20">{photos.map((_, k) => <span key={k} className={`h-1 flex-1 rounded-full ${k === i ? 'bg-card' : 'bg-white/40'}`} />)}</div>
        <button aria-label="Foto anterior" onClick={e => { e.stopPropagation(); setI((i - 1 + n) % n) }} className="absolute left-0 top-0 bottom-1/3 w-1/3 z-20 flex items-center justify-start pl-1 text-white/0 hover:text-white/80"><ChevronLeft className="w-8 h-8 drop-shadow" /></button>
        <button aria-label="Próxima foto" onClick={e => { e.stopPropagation(); setI((i + 1) % n) }} className="absolute right-0 top-0 bottom-1/3 w-1/3 z-20 flex items-center justify-end pr-1 text-white/0 hover:text-white/80"><ChevronRight className="w-8 h-8 drop-shadow" /></button>
      </>}
    </div>
  )
}

// Perfil completo (folha que abre sobre o feed ou o chat)
export function ProfileDetails({ p, blurred, actions }) {
  const look = LOOKING_FOR.find(l => l.id === p.looking_for)
  return (
    <div>
      <PhotoCarousel photos={p.photos} blurred={blurred} className="aspect-[4/5] max-h-[60vh] w-full" />
      <div className="p-5 space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-[28px] font-bold">{p.name}, {p.age}</h2>
          {p.verified && <BadgeCheck className="w-7 h-7 text-tertiary" aria-label="Verificado" />}
          {p.affinity != null && <AffinityBadge value={p.affinity} />}
        </div>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-[14px] text-ink-soft">
          <span className="inline-flex items-center gap-1"><MapPin className="w-4 h-4" />{p.city}{p.distance_km != null ? ` · ${p.distance_km} km` : ''}</span>
          <span>{genderLabel(p.gender_identity, p.gender_other)}</span>
        </div>
        {look && <span className="inline-flex items-center gap-2 rounded-full bg-secondary-fixed/60 px-3 py-1 text-[13px] font-semibold"><Heart className="w-4 h-4 text-secondary" />{look.label}</span>}
        <p className="text-[15px] leading-relaxed no-select">{p.bio}</p>
        {p.prompts?.length > 0 && <div className="space-y-2">{p.prompts.map((pr, i) => (
          <div key={i} className="rounded-2xl bg-surface-low p-3.5"><div className="text-[12px] font-bold text-primary uppercase tracking-wide">{pr.q}</div><div className="font-display font-semibold text-[17px] mt-0.5 no-select">{pr.a}</div></div>))}</div>}
        {p.common_tags?.length > 0 && <p className="text-[13px] font-bold text-tertiary">Vocês têm {p.common_tags.length} interesse{p.common_tags.length > 1 ? 's' : ''} em comum</p>}
        <TagList solid tags={p.tags || []} common={p.common_tags || []} />
        {actions}
      </div>
    </div>
  )
}
