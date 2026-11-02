import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, Crown, Heart, Lock, X } from 'lucide-react'
import { Button, ErrorBox, Spinner } from '../components/ui'
import PhotoImg from '../components/PhotoImg'
import { AffinityBadge } from './ProfileView'
import { MatchOverlay } from './Feed'
import { api } from '../lib/api'
import { useLive } from '../lib/hooks'
import { friendlyError } from '../lib/constants'

// "Quem curtiu você": todos veem quantas pessoas curtiram; só VIP vê quem.
export default function WhoLiked() {
  const { data, error, reload } = useLive(() => api.whoLikedMe())
  const [busy, setBusy] = useState('')
  const [err, setErr] = useState('')
  const [match, setMatch] = useState(null)
  const [hidden, setHidden] = useState([])
  const [myPhoto, setMyPhoto] = useState(null)
  useEffect(() => { api.getMyPhotos().then(p => setMyPhoto(p[0]?.path)).catch(() => {}) }, [])

  async function decide(p, kind) {
    setBusy(p.id); setErr('')
    try {
      const r = await api.like(p.id, kind)
      setHidden(h => [...h, p.id])
      if (r.matched) setMatch(r)
    } catch (e) { setErr(friendlyError(e)) } finally { setBusy('') }
  }
  const people = (data?.people || []).filter(p => !hidden.includes(p.id))

  return (
    <div className="max-w-xl mx-auto px-4 pt-3 pb-10 lg:pt-8">
      <Link to="/app/descobrir" className="inline-flex items-center gap-1 text-ink-soft font-semibold"><ArrowLeft className="w-5 h-5" />Voltar</Link>
      <h1 className="text-[28px] font-bold mt-2 flex items-center gap-2"><Heart className="w-7 h-7 text-secondary fill-secondary" />Quem curtiu você</h1>
      {!data ? <Spinner error={error} onRetry={reload} /> : (<>
        <p className="text-ink-soft mt-1">{data.count === 0 ? 'Ninguém novo por enquanto. Capriche nas fotos e nas perguntas do perfil!' : <><b className="text-ink">{data.count} pessoa{data.count > 1 ? 's' : ''}</b> curti{data.count > 1 ? 'ram' : 'u'} você e ainda espera{data.count > 1 ? 'm' : ''} sua resposta.</>}</p>
        <div className="mt-3"><ErrorBox>{err}</ErrorBox></div>

        {data.vip ? (
          <div className="grid grid-cols-2 gap-3 mt-4">
            {people.map(p => (
              <div key={p.id} className="bg-card rounded-2xl shadow-sm overflow-hidden">
                <div className="relative aspect-[3/4]">
                  <PhotoImg path={p.photos?.[0]} className="w-full h-full object-cover no-select" alt="" />
                  <div className="absolute inset-x-0 bottom-0 p-2.5 bg-gradient-to-t from-black/80 text-white">
                    <div className="flex items-center gap-1 font-display font-semibold">{p.name}, {p.age}{p.verified && <BadgeCheck className="w-4 h-4 text-mint" />}</div>
                    <AffinityBadge value={p.affinity} className="!px-2 !py-0.5 !text-[11px] mt-1" />
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 p-2">
                  <button disabled={!!busy} onClick={() => decide(p, 'pass')} aria-label={`Passar ${p.name}`} className="rounded-xl bg-surface-low py-2 flex justify-center text-secondary"><X className="w-5 h-5" /></button>
                  <button disabled={!!busy} onClick={() => decide(p, 'like')} aria-label={`Curtir ${p.name} de volta`} className="rounded-xl bg-secondary py-2 flex justify-center text-white"><Heart className="w-5 h-5 fill-white" /></button>
                </div>
              </div>
            ))}
          </div>
        ) : data.count > 0 && (
          <>
            <div className="grid grid-cols-3 gap-2 mt-4">
              {Array.from({ length: Math.min(data.count, 6) }, (_, i) => (
                <div key={i} className="relative aspect-[3/4] rounded-2xl overflow-hidden bg-gradient-to-br from-secondary-container to-primary-container">
                  <div className="absolute inset-0 backdrop-blur-xl bg-white/10 flex items-center justify-center"><Lock className="w-7 h-7 text-white" /></div>
                </div>
              ))}
            </div>
            <div className="mt-5 rounded-2xl bg-amber/15 border border-amber/40 p-5 text-center">
              <Crown className="w-10 h-10 text-amber mx-auto" />
              <h2 className="text-[20px] font-bold mt-2">Descubra quem curtiu você</h2>
              <p className="text-[14px] text-ink-soft mt-1">Com o ITAC VIP você vê quem já curtiu seu perfil, dá match na hora e ainda tem curtidas e convites ilimitados por 30 dias.</p>
              <Link to="/app/loja"><Button variant="love" className="w-full mt-4"><Crown className="w-5 h-5" />Quero ser VIP</Button></Link>
            </div>
          </>
        )}
      </>)}
      <MatchOverlay match={match} me={{ photo: myPhoto }} onClose={() => setMatch(null)} />
    </div>
  )
}
